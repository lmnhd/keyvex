import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import * as babel from '@babel/standalone';
import * as ts from 'typescript';

// Input schema
const ValidatorRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
});

export type ValidatorRequest = z.infer<typeof ValidatorRequestSchema>;

/**
 * Validator Agent - Validates assembled component code.
 * This is now a pure function that returns an updated TCC.
 */
export async function validateComponent(
  request: ValidatorRequest & {
    tcc?: ToolConstructionContext;
    mockTcc?: ToolConstructionContext;
  },
): Promise<{
  success: boolean;
  validationResult?: any;
  updatedTcc?: ToolConstructionContext;
  error?: string;
}> {
  const { jobId } = ValidatorRequestSchema.parse(request);
  const tcc = request.mockTcc || request.tcc;

  try {
    if (!tcc) throw new Error(`TCC not provided for jobId: ${jobId}`);

    logger.info({ jobId }, '🔍 Validator: Starting validation');

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'in_progress',
      'Validating component code...'
    );

    if (!tcc.assembledComponentCode) {
      throw new Error('Assembled component code not found in TCC');
    }

    const validationResult = await validateCode(tcc.assembledComponentCode);

    const updatedTCC: ToolConstructionContext = {
      ...tcc,
      validationResult,
      currentOrchestrationStep: OrchestrationStepEnum.enum.finalizing_tool,
      steps: {
        ...tcc.steps,
        validatingCode: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt:
            tcc.steps?.validatingCode?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: validationResult,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'completed',
      `Code validation completed. ${validationResult.isValid ? 'No issues found' : `Found ${validationResult.syntaxErrors.length + validationResult.typeErrors.length} errors`}.`
    );

    logger.info(
      {
        jobId,
        isValid: validationResult.isValid,
        errorCount:
          validationResult.syntaxErrors.length +
          validationResult.typeErrors.length,
        warningCount: validationResult.warnings.length,
      },
      '🔍 Validator: Completed validation',
    );

    return { success: true, validationResult, updatedTcc: updatedTCC };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🔍 Validator: Error');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'failed',
      errorMessage
    );
    
    return {
      success: false,
      error: errorMessage,
    };
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