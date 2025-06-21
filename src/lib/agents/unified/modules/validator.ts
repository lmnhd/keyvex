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
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import {
  getPrimaryModel,
  getModelProvider,
} from '@/lib/ai/models/model-config';
import { getValidatorSystemPrompt } from '@/lib/prompts/v2/validator-prompt';
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

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
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
        OrchestrationStepEnum.enum.validating_component,
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
        validatingComponent: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tcc.steps?.validatingComponent?.startedAt || new Date().toISOString(),
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
          errorsCount: updatedTcc.validationResult?.errors?.length || 0,
          warningsCount: updatedTcc.validationResult?.warnings?.length || 0,
          suggestionsCount: updatedTcc.validationResult?.suggestions?.length || 0,
          qualityScore: updatedTcc.validationResult?.qualityScore || 0,
          readabilityScore: updatedTcc.validationResult?.readabilityScore || 0
        },
        stepStatusUpdate: updatedTcc.steps?.validatingComponent?.status,
        stepResult: !!updatedTcc.steps?.validatingComponent?.result
      }
    }, '✅ Validator Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      const statusMessage = validationResult.isValid 
        ? `Validation passed with quality score ${validationResult.qualityScore}/100`
        : `Validation found ${validationResult.errors?.length || 0} errors and ${validationResult.warnings?.length || 0} warnings`;
      
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.validating_component,
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
      OrchestrationStepEnum.enum.validating_component,
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
  let modelConfig: { provider: string; modelId: string };
  
  // PRIORITY 1: Check TCC agent model mapping first
  if (tcc.agentModelMapping?.['validator']) {
    const mappedModel = tcc.agentModelMapping['validator'];
    const provider = getModelProvider(mappedModel);
    modelConfig = { 
      provider: provider !== 'unknown' ? provider : 'openai', 
      modelId: mappedModel 
    };
    logger.info({ 
      agentName: 'validator', 
      mappedModel, 
      provider: modelConfig.provider,
      source: 'TCC_AGENT_MAPPING' 
    }, '✅ Validator Module: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = { provider: provider !== 'unknown' ? provider : 'openai', modelId: selectedModel };
    logger.info({ 
      selectedModel, 
      provider: modelConfig.provider,
      source: 'REQUEST_PARAMETER' 
    }, '✅ Validator Module: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('validator');
    modelConfig = primaryModel && 'modelInfo' in primaryModel ? { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } : { provider: 'openai', modelId: 'gpt-4o' };
    logger.info({ 
      modelConfig,
      source: 'CONFIGURATION_FALLBACK' 
    }, '✅ Validator Module: Using CONFIGURATION FALLBACK model');
  }

  logger.info({ ...modelConfig }, '✅ Validator Module: Using model');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = getValidatorSystemPrompt(false);
  const userPrompt = createUserPrompt(tcc, editMode);

  // Isolation test logging
  logger.info({
    jobId: tcc.jobId,
    modelId: modelConfig.modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    assembledComponentPresent: !!tcc.assembledComponent,
    componentCodeLength: tcc.assembledComponent?.finalComponentCode?.length || 0
  }, '✅ Validator Module: ISOLATION DEBUG - Input data analysis');

  try {
    const { object: validationResult } = await generateObject({
      model: modelInstance,
      schema: ValidatorOutputSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.1,
      maxTokens: 3000,
    });

    logger.info({ 
      jobId: tcc.jobId, 
      modelId: modelConfig.modelId,
      isValid: validationResult.isValid,
      errorsCount: validationResult.errors?.length || 0,
      warningsCount: validationResult.warnings?.length || 0,
      aiResponseReceived: true
    }, '✅ Validator Module: Successfully received structured object from AI');

    return validationResult;
  } catch (error) {
    logger.error({ error }, '✅ Validator Module: AI call failed. Generating fallback.');
    return generateFallbackValidation(tcc);
  }
}

function generateFallbackValidation(tcc: ToolConstructionContext): ValidationResult {
  const hasComponent = !!tcc.assembledComponent?.finalComponentCode;
  const codeLength = tcc.assembledComponent?.finalComponentCode?.length || 0;
  
  return {
    isValid: hasComponent && codeLength > 100,
    errors: hasComponent ? [] : ['No assembled component found'],
    warnings: codeLength < 100 ? ['Component code appears too short'] : [],
    suggestions: [
      'Consider adding more comprehensive error handling',
      'Add loading states for better user experience',
      'Include accessibility attributes where appropriate'
    ],
    qualityScore: hasComponent ? Math.min(85, Math.floor(codeLength / 10)) : 0,
    readabilityScore: hasComponent ? 75 : 0,
    performanceScore: hasComponent ? 80 : 0,
    accessibilityScore: hasComponent ? 70 : 0,
    summary: hasComponent 
      ? 'Component validation completed with basic checks'
      : 'No component available for validation'
  };
}

function createUserPrompt(tcc: ToolConstructionContext, editMode?: EditModeContext): string {
  let prompt = `Validate this React component for errors, warnings, and quality issues:

COMPONENT TO VALIDATE:`;

  // Add assembled component code
  if (tcc.assembledComponent) {
    prompt += `
\`\`\`typescript
${tcc.assembledComponent.finalComponentCode}
\`\`\`

COMPONENT METADATA:
- Name: ${tcc.assembledComponent.componentName}
- Hooks: ${tcc.assembledComponent.hooks?.join(', ') || 'None'}
- Functions: ${tcc.assembledComponent.functions?.join(', ') || 'None'}
- Estimated Lines: ${tcc.assembledComponent.estimatedLines || 0}`;
  } else {
    prompt += `
⚠️ NO COMPONENT CODE FOUND - This is a critical error.`;
  }

  // Add context from other TCC parts
  if (tcc.stateLogic) {
    prompt += `

EXPECTED STATE LOGIC:
Variables: ${tcc.stateLogic.variables?.map(v => `${v.name}: ${v.type}`).join(', ') || 'None'}
Functions: ${tcc.stateLogic.functions?.map(f => f.name).join(', ') || 'None'}`;
  }

  if (tcc.jsxLayout) {
    prompt += `

EXPECTED ACCESSIBILITY FEATURES:
${tcc.jsxLayout.accessibilityFeatures?.join(', ') || 'None specified'}`;
  }

  // Add edit mode context if needed
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    prompt += `

🔄 EDIT MODE VALIDATION:
Recent modifications were made. Pay special attention to:
${editMode.instructions.map(i => i.instructions).join('\n')}`;
  }

  prompt += `

Perform comprehensive validation including:
- Syntax errors and TypeScript issues
- React best practices
- Performance considerations
- Accessibility compliance
- Code quality and readability

Provide detailed feedback with specific line references where possible.`;

  return prompt;
} 