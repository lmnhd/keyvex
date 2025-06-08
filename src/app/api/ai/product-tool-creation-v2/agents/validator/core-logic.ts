import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import logger from '@/lib/logger';
import * as babel from '@babel/standalone';
import * as ts from 'typescript';

// Input schema
const ValidatorRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
});

export type ValidatorRequest = z.infer<typeof ValidatorRequestSchema>;

/**
 * Validator Agent - Validates assembled component code
 */
export async function validateComponent(request: ValidatorRequest): Promise<{
  success: boolean;
  validationResult?: {
    isValid: boolean;
    syntaxErrors: string[];
    typeErrors: string[];
    warnings: string[];
    metrics: {
      linesOfCode: number;
      componentComplexity: number;
      dependencies: string[];
    };
  };
  error?: string;
}> {
  const { jobId } = ValidatorRequestSchema.parse(request);

  try {
    const tcc = await getTCC(jobId);
    if (!tcc) throw new Error(`TCC not found for jobId: ${jobId}`);

    logger.info({ jobId }, '🔍 Validator: Starting validation');

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'started',
      'Validating component code...',
    );

    // Validate we have the assembled component
    if (!tcc.assembledComponentCode)
      throw new Error('Assembled component code not found in TCC');

    // Update TCC status
    const tccInProgress = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString(),
    };
    await saveTCC(tccInProgress);

    // Validate the component
    const validationResult = await validateCode(tcc.assembledComponentCode);

    // Update TCC with results
    const updatedTCC = {
      ...tccInProgress,
      validationResult,
      steps: {
        ...tccInProgress.steps,
        validatingCode: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt:
            tccInProgress.steps?.validatingCode?.startedAt ||
            new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: validationResult,
        },
      },
      updatedAt: new Date().toISOString(),
    };
    await saveTCC(updatedTCC);

    const validationStatus = validationResult.isValid ? 'passed' : 'failed';
    const errorCount =
      validationResult.syntaxErrors.length + validationResult.typeErrors.length;

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'completed',
      `Validation ${validationStatus}: ${errorCount} errors, ${validationResult.warnings.length} warnings`,
    );

    // CRITICAL: Trigger the next step in the orchestration
    await triggerNextOrchestrationStep(
      jobId,
      OrchestrationStepEnum.enum.finalizing_tool,
    );

    logger.info(
      {
        jobId,
        isValid: validationResult.isValid,
        errorCount,
        warningCount: validationResult.warnings.length,
      },
      '🔍 Validator: Completed validation',
    );

    return { success: true, validationResult };
  } catch (error) {
    logger.error(
      { jobId, error: error instanceof Error ? error.message : String(error) },
      '🔍 Validator: Error',
    );
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'failed',
      `Validation failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Triggers the trigger-next-step endpoint to move the orchestration forward.
 * @param jobId The ID of the current tool creation job.
 * @param nextStep The next step to trigger in the orchestration.
 */
async function triggerNextOrchestrationStep(
  jobId: string,
  nextStep: z.infer<typeof OrchestrationStepEnum>,
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';

  try {
    logger.info(
      { jobId, baseUrl, nextStep },
      '🔍 Validator: Triggering next orchestration step...',
    );

    const response = await fetch(
      `${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, nextStep }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Orchestrator responded with status ${response.status}: ${errorBody}`,
      );
    }

    logger.info(
      { jobId },
      '🔍 Validator: Successfully triggered next orchestration step.',
    );
  } catch (error) {
    logger.error(
      {
        jobId,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      },
      '🔍 Validator: Failed to trigger next orchestration step.',
    );
  }
}

/**
 * Validate component code using Babel and TypeScript
 */
async function validateCode(code: string) {
  const syntaxErrors: string[] = [];
  const typeErrors: string[] = [];
  const warnings: string[] = [];

  // Babel syntax validation
  try {
    babel.transform(code, {
      presets: ['typescript', 'react'],
      filename: 'component.tsx',
    });
  } catch (error) {
    if (error instanceof Error) {
      syntaxErrors.push(error.message);
    }
  }

  // TypeScript validation
  const tsResult = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    reportDiagnostics: true,
  });

  if (tsResult.diagnostics) {
    tsResult.diagnostics.forEach(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n',
      );
      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        typeErrors.push(message);
      } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
        warnings.push(message);
      }
    });
  }

  // Calculate metrics
  const linesOfCode = code.split('\n').length;
  const dependencies = extractDependencies(code);
  const componentComplexity = calculateComplexity(code);

  return {
    isValid: syntaxErrors.length === 0 && typeErrors.length === 0,
    syntaxErrors,
    typeErrors,
    warnings,
    metrics: {
      linesOfCode,
      componentComplexity,
      dependencies,
    },
  };
}

/**
 * Extract dependencies from imports
 */
function extractDependencies(code: string): string[] {
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const dependencies = new Set<string>();
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    dependencies.add(match[1]);
  }

  return Array.from(dependencies);
}

/**
 * Calculate component complexity (simple metric based on code patterns)
 */
function calculateComplexity(code: string): number {
  let complexity = 0;

  // Count state variables
  complexity += (code.match(/useState/g) || []).length * 2;

  // Count effects
  complexity += (code.match(/useEffect/g) || []).length * 3;

  // Count callbacks
  complexity += (code.match(/useCallback/g) || []).length * 2;

  // Count memos
  complexity += (code.match(/useMemo/g) || []).length * 2;

  // Count conditional rendering
  complexity += (code.match(/\?\s*[^\s:]+\s*:\s*[^\s]+/g) || []).length;

  // Count loops/iterations
  complexity += (code.match(/\.(map|filter|reduce|forEach)\(/g) || []).length * 2;

  // Count event handlers
  complexity += (code.match(/on[A-Z][a-zA-Z]+=/g) || []).length;

  return complexity;
}