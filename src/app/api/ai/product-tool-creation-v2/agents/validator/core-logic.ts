import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import logger from '@/lib/logger';

// Input schema
const ValidatorRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional()
});

export type ValidatorRequest = z.infer<typeof ValidatorRequestSchema>;

/**
 * Code Validator Agent - Validates React component code using AWS Lambda + Babel
 */
export async function validateComponent(request: ValidatorRequest): Promise<{
  success: boolean;
  validationResult?: {
    isValid: boolean;
    error?: string;
    details?: any;
    syntaxErrors?: Array<{
      line: number;
      column: number;
      message: string;
    }>;
    transpiled?: {
      successful: boolean;
      code?: string;
    };
  };
  error?: string;
}> {
  const { jobId } = ValidatorRequestSchema.parse(request);

  try {
    const tcc = await getTCC(jobId);
    if (!tcc) throw new Error(`TCC not found for jobId: ${jobId}`);

    logger.info({ jobId }, '🔍 Validator: Starting component validation');

    await emitStepProgress(jobId, OrchestrationStepEnum.enum.validating_code, 'started', 'Validating component code...');

    // Validate we have component code to validate
    if (!tcc.assembledComponentCode) throw new Error('No assembled component code found in TCC');

    // Update TCC status
    const tccInProgress = { ...tcc, status: OrchestrationStatusEnum.enum.in_progress, updatedAt: new Date().toISOString() };
    await saveTCC(tccInProgress);

    // Call AWS Lambda for validation
    const validationResult = await callValidationLambda(tcc.assembledComponentCode, jobId);

    // Update TCC with results
    const updatedTCC = {
      ...tccInProgress,
      validationResult,
      steps: {
        ...tccInProgress.steps,
        validatingCode: {
          status: validationResult.isValid ? OrchestrationStatusEnum.enum.completed : OrchestrationStatusEnum.enum.error,
          startedAt: tccInProgress.steps?.validatingCode?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: validationResult
        }
      },
      updatedAt: new Date().toISOString()
    };
    await saveTCC(updatedTCC);

    const statusMessage = validationResult.isValid 
      ? 'Component validation successful' 
      : `Component validation failed: ${validationResult.error}`;

    await emitStepProgress(
      jobId, 
      OrchestrationStepEnum.enum.validating_code, 
      validationResult.isValid ? 'completed' : 'failed', 
      statusMessage
    );

    logger.info({ 
      jobId, 
      isValid: validationResult.isValid,
      hasErrors: !!validationResult.error 
    }, '🔍 Validator: Validation completed');

    return { success: true, validationResult };

  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, '🔍 Validator: Error');
    await emitStepProgress(jobId, OrchestrationStepEnum.enum.validating_code, 'failed', 
      `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

/**
 * Call AWS Lambda for JavaScript/TypeScript validation using Babel
 */
async function callValidationLambda(componentCode: string, jobId: string) {
  try {
    // TODO: Replace with actual AWS Lambda endpoint
    const lambdaEndpoint = process.env.VALIDATION_LAMBDA_ENDPOINT || 'https://your-lambda-endpoint.amazonaws.com/validate';
    
    logger.info({ jobId, codeLength: componentCode.length }, '🔍 Validator: Calling validation Lambda');

    const response = await fetch(lambdaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LAMBDA_API_KEY || 'dev-key'}`
      },
      body: JSON.stringify({
        code: componentCode,
        options: {
          preset: 'react-typescript',
          plugins: ['@babel/plugin-transform-typescript', '@babel/plugin-syntax-jsx'],
          sourceType: 'module'
        },
        jobId
      }),
      // Validation can take time, but should be under Vercel limit
      signal: AbortSignal.timeout(45000) // 45 second timeout
    });

    if (!response.ok) {
      throw new Error(`Lambda validation service responded with status: ${response.status}`);
    }

    const result = await response.json();
    
    logger.info({ 
      jobId, 
      isValid: result.isValid,
      hasTranspiled: !!result.transpiled?.successful 
    }, '🔍 Validator: Lambda validation completed');

    return result;

  } catch (error) {
    logger.error({ jobId, error }, '🔍 Validator: Lambda call failed');
    
    // Fallback to basic validation if Lambda fails
    return performFallbackValidation(componentCode);
  }
}

/**
 * Fallback validation when Lambda is unavailable
 */
function performFallbackValidation(componentCode: string) {
  logger.warn('🔍 Validator: Using fallback validation (limited)');
  
  // Basic syntax checks
  const syntaxErrors: Array<{ line: number; column: number; message: string }> = [];
  
  // Check for basic React component structure
  if (!componentCode.includes('import React')) {
    syntaxErrors.push({
      line: 1,
      column: 1,
      message: 'Missing React import'
    });
  }
  
  if (!componentCode.includes('export')) {
    syntaxErrors.push({
      line: 1,
      column: 1,
      message: 'Missing component export'
    });
  }
  
  // Check for unmatched brackets (basic)
  const openBrackets = (componentCode.match(/\{/g) || []).length;
  const closeBrackets = (componentCode.match(/\}/g) || []).length;
  
  if (openBrackets !== closeBrackets) {
    syntaxErrors.push({
      line: 1,
      column: 1,
      message: `Unmatched brackets: ${openBrackets} open, ${closeBrackets} close`
    });
  }
  
  // Check for unmatched parentheses (basic)
  const openParens = (componentCode.match(/\(/g) || []).length;
  const closeParens = (componentCode.match(/\)/g) || []).length;
  
  if (openParens !== closeParens) {
    syntaxErrors.push({
      line: 1,
      column: 1,
      message: `Unmatched parentheses: ${openParens} open, ${closeParens} close`
    });
  }
  
  const isValid = syntaxErrors.length === 0;
  
  return {
    isValid,
    error: isValid ? undefined : 'Fallback validation found syntax errors',
    details: {
      validationType: 'fallback',
      message: 'Full validation requires AWS Lambda service'
    },
    syntaxErrors: syntaxErrors.length > 0 ? syntaxErrors : undefined,
    transpiled: {
      successful: false,
      code: undefined
    }
  };
} 