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
  maxPasses = 3,
): Promise<{ updatedTcc: ToolConstructionContext; passes: number }> {
  let accumulated = tcc.stateLogic ?? { variables: [], functions: [], imports: [] };
  const plannerSigs = (tcc.functionSignatures ?? []) as Array<{ name: string }>;
  let remaining = plannerSigs.map((s) => s.name);
  let passCount = 0;

  while (remaining.length > 0 && passCount < maxPasses) {
    passCount += 1;

    const missingSignatures = plannerSigs.filter((s) => remaining.includes(s.name));

    // Provide minimal, focused context to the agent
    // Clone TCC with only the missing signatures for sharper prompts
    const tccForPass: ToolConstructionContext = {
      ...tcc,
      functionSignatures: missingSignatures,
    } as ToolConstructionContext;

    const loopContext: AgentExecutionContext = {
      ...context,
      additionalInput: {
        missingFunctionSignatures: missingSignatures,
        existingStateLogic: accumulated,
      },
    };

    const { result, updatedTcc } = await executeAgent('state-design' as AgentType, loopContext, tccForPass);

    const newStateLogic = (result as any).stateLogic;

    // Merge logic — avoid duplicates
    accumulated = {
      variables: [...accumulated.variables, ...newStateLogic.variables],
      functions: [
        ...accumulated.functions,
        ...newStateLogic.functions.filter(
          (f: any) => !accumulated.functions.some((af: any) => af.name === f.name),
        ),
      ],
      imports: Array.from(new Set([...(accumulated.imports ?? []), ...(newStateLogic.imports ?? [])])),
    };

    // Update TCC for next iteration
    tcc = { ...updatedTcc, stateLogic: accumulated } as ToolConstructionContext;

    remaining = plannerSigs
      .filter((sig) => !accumulated.functions.some((f: any) => f.name === sig.name))
      .map((s) => s.name);

    logger.info(
      {
        jobId: context.jobId,
        pass: passCount,
        remainingCount: remaining.length,
        remaining,
      },
      '🔄 State-Design loop pass completed',
    );

    // Break early if agent produced nothing new (to avoid endless loops)
    if (!newStateLogic.functions || newStateLogic.functions.length === 0) break;
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
