import logger from '../../../logger';
import { executeAgent } from '../core/agent-executor';
import {
  AgentExecutionContext,
  ToolConstructionContext,
  AgentResult,
  AgentType,
} from '@/lib/types/tcc-unified';

/**
 * Iteratively calls the existing `state-design` AI agent to ensure that
 * every function signature planned by function-planner is implemented.
 *
 * Strategy:
 * 1. Determine which signatures are still missing.
 * 2. Call the state-design agent with ONLY the missing signatures plus
 *    any accumulated stateLogic for context.
 * 3. Validate each pass using the agent's built-in validator (handled
 *    by executeAgent + StateDesignModule.validate).
 * 4. Merge newly returned stateLogic with the accumulated one.
 * 5. Repeat until either all functions are covered or maxPasses reached.
 * 6. Throw if still incomplete so orchestration can retry/fail.
 */
export async function runStateDesignLoop(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext,
  maxPasses = 5,
): Promise<{ updatedTcc: ToolConstructionContext; passes: number }> {
  let accumulated = tcc.stateLogic ?? { variables: [], functions: [], imports: [] };
  const plannerSigs = (tcc.functionSignatures ?? []) as Array<{ name: string }>;
  let remaining = plannerSigs.map((s) => s.name);

  /**
   * Quick Levenshtein distance implementation for short strings (< 50 chars).
   * Used only to detect minor spelling drift from the model.
   */
  function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );
      }
    }
    return dp[m][n];
  }

  /**
   * Attempts to match a newly generated function to a planned signature even
   * when the name isn\'t an *exact* match (e.g. extra prefix/suffix, plural).
   * If the similarity threshold passes the check, we treat it as fulfilling
   * the requirement and optionally rename the function to the exact signature
   * for consistency.
   */
  function splitWords(name: string): string[] {
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_\-]/g, ' ')
      .toLowerCase()
      .split(' ');
  }

  function tryResolveNameMismatch(funcName: string, missingNames: string[]): string | null {
    const lower = funcName.toLowerCase();
    const words = new Set(splitWords(funcName));

    for (const missing of missingNames) {
      if (lower === missing.toLowerCase()) return missing; // exact ignoring case

      // Wider Levenshtein tolerance
      if (levenshtein(lower, missing.toLowerCase()) <= 6) return missing;

      // Compare camel/snake word sets
      const missingWords = new Set(splitWords(missing));
      if (
        words.size === missingWords.size &&
        [...words].every((w) => missingWords.has(w))
      ) {
        return missing;
      }
    }
    return null;
  }
  let passCount = 0;

  while (remaining.length > 0 && passCount < maxPasses) {
    passCount += 1;

    const missingSignatures = plannerSigs.filter((s) => remaining.includes(s.name));

    // Provide ONLY the missing signatures in functionSignatures to keep the prompt laser-focused.
    // Pass the full planner list separately in additionalInput so the agent still sees dependencies.
    const tccForPass: ToolConstructionContext = {
      ...tcc,
      functionSignatures: missingSignatures,
    } as ToolConstructionContext;

    const loopContext: AgentExecutionContext = {
      ...context,
      additionalInput: {
        missingFunctionSignatures: missingSignatures,
        allPlannedFunctionSignatures: plannerSigs,
        existingStateLogic: accumulated,
      },
    };

    const { result, updatedTcc } = await executeAgent('state-design' as AgentType, loopContext, tccForPass);

    const newStateLogic = (result as any).stateLogic;

    // Debug: log which functions came back and which ones are merely TODO stubs
    try {
      const implementedNames: string[] = (newStateLogic?.functions ?? []).map((f: any) => f.name);
      const todoStubs: string[] = (newStateLogic?.functions ?? [])
        .filter((f: any) => /TODO/i.test((f.body ?? f.code ?? '')))
        .map((f: any) => f.name);

      logger.debug(
        {
          jobId: context.jobId,
          pass: passCount,
          implemented: implementedNames,
          todoStubs,
        },
        '📝 State-Design returned functions',
      );
    } catch (err) {
      // Guard against unexpected structure so loop never fails due to logging
      logger.error({ jobId: context.jobId, err }, 'Failed to debug-log State-Design response');
    }

    // Track progress to detect if the pass produced any NEW unique functions
    const preLen = accumulated.functions.length;

    // Merge logic — avoid duplicates
    accumulated = {
      variables: [...accumulated.variables, ...(newStateLogic?.variables ?? [])],
      functions: [
        ...accumulated.functions,
        ...(newStateLogic?.functions ?? []).filter(
          (f: any) => !accumulated.functions.some((af: any) => af.name === f.name),
        ),
      ],
      imports: Array.from(
        new Set([...(accumulated.imports ?? []), ...((newStateLogic?.imports ?? []) as any[])]),
      ),
    };

    const uniqueAdded = accumulated.functions.length - preLen;

    // Update TCC for next iteration
    tcc = { ...updatedTcc, stateLogic: accumulated } as ToolConstructionContext;

    remaining = plannerSigs
      .filter((sig) => {
        // Exact match already fulfilled
        if (accumulated.functions.some((f: any) => f.name === sig.name)) return false;
        // Check for near-match names and treat as fulfilled
        const near = accumulated.functions.find((f: any) => tryResolveNameMismatch(f.name, [sig.name]));
        if (near) {
          // Rename the function to exact signature for consistency
          logger.warn({ jobId: context.jobId, originalName: near.name, expected: sig.name }, '⚠️ Function name mismatch auto-resolved');
          near.name = sig.name;
          return false;
        }
        return true;
      })
      .map((s) => s.name);

    logger.info(
      {
        jobId: context.jobId,
        pass: passCount,
        remainingCount: remaining.length,
        remaining,
      },
      ' State-Design loop pass completed',
    );

    // Break early if this pass added no NEW unique functions (to avoid endless loops)
    if (uniqueAdded === 0) break;
  }

  const missingFinal = plannerSigs.filter(
    (sig) => !accumulated.functions.some((f: any) => f.name === sig.name),
  );

  if (missingFinal.length) {
    throw new Error(
      `State-Design loop incomplete after ${maxPasses} passes, missing: ${missingFinal
        .map((f) => f.name)
        .join(', ')}`,
    );
  }

  return { updatedTcc: tcc, passes: passCount };
}
