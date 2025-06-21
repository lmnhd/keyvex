// File Path: keyvex_app/src/lib/agents/unified/modules/validator.ts
import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  ValidationResult,
  ValidationResultSchema,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { callModelForObject } from '@/lib/ai/model-caller';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import { getValidatorSystemPrompt, getValidatorUserPrompt } from '@/lib/prompts/v2/validator-prompt';
import logger from '@/lib/logger';

// Use TCC schema directly
const ValidatorOutputSchema = ValidationResultSchema;
export type ValidatorOutput = ValidationResult;

// Edit mode context type
type EditModeContext = {
  isEditMode: boolean;
  instructions: Array<{
    targetAgent: string;
    editType: 'refine' | 'replace' | 'enhance';
    instructions: string;
    priority: 'low' | 'medium' | 'high';
    createdAt: string;
  }>;
  context: string;
};

// Module interface for the unified agent system
export interface ValidatorRequest {
  jobId: string;
  selectedModel?: string;
  tcc: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
}

export interface ValidatorResult {
  success: boolean;
  validationResult?: ValidationResult;
  error?: string;
  updatedTcc: ToolConstructionContext;
}

/**
 * Validator Module - Extracted core logic for unified agent system
 * Validates generated component for syntax errors and quality issues
 */
export async function executeValidator(request: ValidatorRequest): Promise<ValidatorResult> {
  const { jobId, selectedModel, tcc, isIsolatedTest = false, editMode } = request;
  
  // Edit mode detection
  const isEditMode = editMode?.isEditMode || false;
  const editInstructions = editMode?.instructions || [];

  logger.info({ jobId, isIsolatedTest }, '✅ Validator Module: Starting component validation');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Emit progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.validating_code,
        'in_progress',
        'Validating component code and structure...',
        tcc
      );
    }

    logger.info({ jobId }, '✅ Validator Module: Calling AI to validate component...');
    const validationResult = await generateValidationResult(tcc, selectedModel, editMode);
    logger.info({ jobId }, '✅ Validator Module: AI validation completed');

    // Comprehensive TCC update logging
    logger.info({
      jobId,
      agentName: 'Validator',
      tccUpdateDetail: {
        beforeValidationResult: !!tcc.validationResult,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '✅ Validator Module: TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      validationResult,
      steps: {
        ...tcc.steps,
        validatingCode: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tcc.steps?.validatingCode?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: validationResult,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // Comprehensive TCC update logging - detailed output
    logger.info({
      jobId,
      agentName: 'Validator',
      tccUpdateDetail: {
        afterValidationResult: !!updatedTcc.validationResult,
        afterSteps: Object.keys(updatedTcc.steps || {}),
        afterLastUpdated: updatedTcc.updatedAt,
        validationDetails: {
          isValid: updatedTcc.validationResult?.isValid,
          errorPresent: !!updatedTcc.validationResult?.error,
          hasDetails: !!updatedTcc.validationResult?.details
        },
        stepStatusUpdate: updatedTcc.steps?.validatingCode?.status,
        stepResult: !!updatedTcc.steps?.validatingCode?.result
      }
    }, '✅ Validator Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      const statusMessage = validationResult.isValid 
        ? `Validation passed successfully`
        : `Validation found issues: ${validationResult.error || 'Unknown validation errors'}`;
      
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.validating_code,
        'completed',
        statusMessage,
        updatedTcc
      );
    }

    return { success: true, validationResult, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '✅ Validator Module: Error');
    
    // Emit failure progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'failed',
      errorMessage,
      tcc
    );
    
    return { success: false, error: errorMessage, updatedTcc: tcc };
  }
}

async function generateValidationResult(
  tcc: ToolConstructionContext,
  selectedModel?: string,
  editMode?: EditModeContext,
): Promise<ValidationResult> {
  // PRIORITY 1: Check TCC agent model mapping first
  let modelId: string;
  if (tcc.agentModelMapping?.['validator']) {
    modelId = tcc.agentModelMapping['validator'];
    logger.info({ 
      agentName: 'validator', 
      mappedModel: modelId,
      source: 'TCC_AGENT_MAPPING' 
    }, '✅ Validator Module: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    modelId = selectedModel;
    logger.info({ 
      selectedModel: modelId,
      source: 'REQUEST_PARAMETER' 
    }, '✅ Validator Module: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('validator');
    modelId = primaryModel?.modelInfo?.id || 'claude-3-7-sonnet-20250219';
    logger.info({ 
      modelId,
      source: 'CONFIGURATION_FALLBACK' 
    }, '✅ Validator Module: Using CONFIGURATION FALLBACK model');
  }

  const systemPrompt = getValidatorSystemPrompt();
  const userPrompt = getValidatorUserPrompt(tcc, editMode);

  // Isolation test logging
  logger.info({
    jobId: tcc.jobId,
    modelId: modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    finalProductPresent: !!tcc.finalProduct,
    componentCodeLength: tcc.finalProduct?.componentCode?.length || 0
  }, '✅ Validator Module: ISOLATION DEBUG - Input data analysis');

  try {
    const { object: validationResult } = await callModelForObject<ValidationResult>(modelId, {
      schema: ValidatorOutputSchema,
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      temperature: 0.1,
      maxTokens: 3000,
      maxRetries: 3
    });

    logger.info({ 
      jobId: tcc.jobId, 
      modelId: modelId,
      isValid: validationResult.isValid,
      hasError: !!validationResult.error,
      aiResponseReceived: true
    }, '✅ Validator Module: Successfully received structured object from AI');

    return validationResult;
  } catch (error) {
    logger.error({ error }, '✅ Validator Module: AI call failed. Generating fallback.');
    return generateFallbackValidation(tcc);
  }
}

function generateFallbackValidation(tcc: ToolConstructionContext): ValidationResult {
  const hasComponent = !!tcc.finalProduct?.componentCode;
  const codeLength = tcc.finalProduct?.componentCode?.length || 0;
  
  return {
    isValid: hasComponent && codeLength > 100,
    error: hasComponent ? undefined : 'No component code found in finalProduct.componentCode',
    details: {
      hasComponent,
      codeLength,
      basic_checks: hasComponent ? 'passed' : 'failed'
    }
  };
}

 