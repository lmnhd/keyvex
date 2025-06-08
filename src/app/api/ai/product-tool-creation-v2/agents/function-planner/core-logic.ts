// File Path: keyvex_app/src/app/api/ai/product-tool-creation-v2/agents/function-planner/core-logic.ts
import { z } from 'zod';
import {
  ToolConstructionContext,
  DefinedFunctionSignature,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
// TCC Store operations removed - using prop-based TCC passing
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import logger from '@/lib/logger';
import { getFunctionPlannerSystemPrompt } from '@/lib/prompts/v2/function-planner-prompt';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';

const functionSignaturesSchema = z.object({
  signatures: z.array(
    z.object({
      name: z.string().describe('The camelCase name of the function.'),
      description: z
        .string()
        .describe('A brief explanation of what the function does.'),
    }),
  ),
});

/**
 * Main exported function for the Function Planner agent.
 * This is the entry point that the route handler will call.
 */
export async function planFunctionSignatures(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
}): Promise<{
  success: boolean;
  functionSignatures?: DefinedFunctionSignature[];
  error?: string;
  updatedTcc?: ToolConstructionContext;
}> {
  const { jobId, selectedModel } = request;
  const tcc = request.mockTcc || request.tcc;

  try {
    logger.info({ jobId }, '🔧 FunctionPlanner: Starting function signature planning');
    
    if (!tcc || !tcc.agentModelMapping) {
      throw new Error(`Valid TCC was not provided in tcc or mockTcc for jobId: ${jobId}`);
    }

    if (selectedModel) {
      logger.info({ jobId, selectedModel }, '🔧 FunctionPlanner: User selected explicit model');
      tcc.agentModelMapping['function-planner'] = selectedModel;
    }

    await emitStepProgress(
      jobId, 
      OrchestrationStepEnum.enum.planning_function_signatures,
      'in_progress',
      'Beginning function signature planning...'
    );

    const functionSignatures = await generateFunctionSignatures(tcc, selectedModel);

    const updatedTcc = { ...tcc };

    logger.info({ 
      jobId,
      beforeChanges: {
        currentOrchestrationStep: updatedTcc.currentOrchestrationStep,
        status: updatedTcc.status,
        hasFunctionSignatures: !!updatedTcc.definedFunctionSignatures,
        functionSignatureCount: updatedTcc.definedFunctionSignatures?.length || 0,
      }
    }, '🔧 FunctionPlanner: TCC state BEFORE applying changes');

    updatedTcc.definedFunctionSignatures = functionSignatures;
    updatedTcc.currentOrchestrationStep = OrchestrationStepEnum.enum.designing_state_logic;
    updatedTcc.status = OrchestrationStatusEnum.enum.in_progress;

    logger.info({ 
      jobId,
      afterChanges: {
        currentOrchestrationStep: updatedTcc.currentOrchestrationStep,
        status: updatedTcc.status,
        hasFunctionSignatures: !!updatedTcc.definedFunctionSignatures,
        functionSignatureCount: updatedTcc.definedFunctionSignatures?.length || 0,
        newFunctionNames: functionSignatures.map(f => f.name),
        changesMade: 'Added function signatures, updated orchestration step to designing_state_logic'
      }
    }, '🔧 FunctionPlanner: TCC state AFTER applying changes, about to save');

    // TCC Store operation removed - returning updatedTcc for orchestrator to handle persistence

    logger.info({ 
      jobId,
      preparedState: {
        currentOrchestrationStep: updatedTcc.currentOrchestrationStep,
        status: updatedTcc.status,
        functionSignatureCount: updatedTcc.definedFunctionSignatures?.length || 0,
      }
    }, '🔧 FunctionPlanner: TCC updated state prepared for return');

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'completed',
      `Successfully planned ${functionSignatures.length} function signatures.`
    );

    logger.info({ jobId, count: functionSignatures.length }, '🔧 FunctionPlanner: Successfully planned function signatures');
    return { success: true, functionSignatures, updatedTcc };
  } catch (error) {
    logger.error({ jobId, error }, '🔧 FunctionPlanner: Error planning function signatures');
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Uses AI to analyze the user input and generate function signatures
 * that will be needed for component interactivity.
 */
async function generateFunctionSignatures(
  tcc: ToolConstructionContext,
  selectedModel?: string
): Promise<DefinedFunctionSignature[]> {
  const primaryModelInfo = getPrimaryModel('functionPlanner');
  if (!primaryModelInfo) throw new Error('No primary model configured for FunctionPlanner.');
  const primaryModel = createModelInstance(primaryModelInfo.provider, primaryModelInfo.modelInfo.id);
  logger.info({ provider: primaryModelInfo.provider, modelName: primaryModelInfo.modelInfo.id }, '🔧 FunctionPlanner: Attempting primary model');

  try {
    const {
      object: { signatures },
    } = await generateObject({
      model: primaryModel,
      schema: functionSignaturesSchema,
      system: getFunctionPlannerSystemPrompt(false),
      prompt: createUserPrompt(tcc),
      temperature: 0.2,
      maxTokens: 2000,
    });
    return signatures;
  } catch (error) {
    logger.warn({ error }, `🔧 FunctionPlanner: Primary model failed. Attempting fallback.`);
    
    const fallbackModelInfo = getFallbackModel('functionPlanner');
    if (!fallbackModelInfo) throw new Error('No fallback model configured for FunctionPlanner.');
    
    const fallbackModel = createModelInstance(fallbackModelInfo.provider, fallbackModelInfo.modelInfo.id);
    logger.info({ provider: fallbackModelInfo.provider, modelName: fallbackModelInfo.modelInfo.id }, '🔧 FunctionPlanner: Using fallback model');

    const {
      object: { signatures },
    } = await generateObject({
      model: fallbackModel,
      schema: functionSignaturesSchema,
      system: getFunctionPlannerSystemPrompt(false),
      prompt: createUserPrompt(tcc),
      temperature: 0.2,
      maxTokens: 2000,
    });
    return signatures;
  }
}

/**
 * Creates the user prompt for the function planner based on TCC data
 */
function createUserPrompt(tcc: ToolConstructionContext): string {
  return `Please analyze this tool description and provide the function signatures needed:

TOOL DESCRIPTION: ${tcc.userInput.description}
TOOL TYPE: ${tcc.userInput.toolType || 'Not specified'}

Additional Context:
- User Industry: ${tcc.userInput.targetAudience || 'General'}

Please provide the JSON array of function signatures as specified in the guidelines.`;
}

/**
 * Creates a model instance based on provider and model ID
 */
function createModelInstance(provider: string, modelId: string) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    default:
      throw new Error(`Unsupported model provider: ${provider}`);
  }
}