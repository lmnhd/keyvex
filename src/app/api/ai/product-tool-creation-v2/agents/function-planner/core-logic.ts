import { z } from 'zod';
import {
  ToolConstructionContext,
  DefinedFunctionSignature,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
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
  mockTcc?: ToolConstructionContext;
}): Promise<{
  success: boolean;
  functionSignatures?: DefinedFunctionSignature[];
  error?: string;
}> {
  const { jobId, selectedModel, mockTcc } = request;

  try {
    logger.info({ jobId }, '🔧 FunctionPlanner: Starting function signature planning');
    const tcc = mockTcc || (await getTCC(jobId));
    if (!tcc || !tcc.agentModelMapping) {
      throw new Error(`TCC not found for jobId: ${jobId}`);
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

    // COMPREHENSIVE LOGGING: TCC State BEFORE changes
    logger.info({ 
      jobId,
      beforeChanges: {
        currentOrchestrationStep: tcc.currentOrchestrationStep,
        status: tcc.status,
        hasFunctionSignatures: !!tcc.definedFunctionSignatures,
        functionSignatureCount: tcc.definedFunctionSignatures?.length || 0,
        hasStateLogic: !!tcc.stateLogic,
        hasJsxLayout: !!tcc.jsxLayout,
        updatedAt: tcc.updatedAt
      }
    }, '🔧 FunctionPlanner: TCC state BEFORE applying changes');

    tcc.definedFunctionSignatures = functionSignatures;
    tcc.currentOrchestrationStep = OrchestrationStepEnum.enum.designing_state_logic; // Move to parallel phase
    tcc.status = OrchestrationStatusEnum.enum.in_progress;

    // COMPREHENSIVE LOGGING: TCC State AFTER changes but BEFORE save
    logger.info({ 
      jobId,
      afterChanges: {
        currentOrchestrationStep: tcc.currentOrchestrationStep,
        status: tcc.status,
        hasFunctionSignatures: !!tcc.definedFunctionSignatures,
        functionSignatureCount: tcc.definedFunctionSignatures?.length || 0,
        newFunctionNames: functionSignatures.map(f => f.name),
        hasStateLogic: !!tcc.stateLogic,
        hasJsxLayout: !!tcc.jsxLayout,
        changesMade: 'Added function signatures, updated orchestration step to designing_state_logic'
      }
    }, '🔧 FunctionPlanner: TCC state AFTER applying changes, about to save');

    await saveTCC(tcc);

    // COMPREHENSIVE LOGGING: Confirm save operation
    logger.info({ 
      jobId,
      savedState: {
        currentOrchestrationStep: tcc.currentOrchestrationStep,
        status: tcc.status,
        functionSignatureCount: tcc.definedFunctionSignatures?.length || 0,
        timestamp: new Date().toISOString()
      }
    }, '🔧 FunctionPlanner: TCC successfully saved with new state');

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'completed',
      `Successfully planned ${functionSignatures.length} function signatures.`
    );

    logger.info({ jobId, count: functionSignatures.length }, '🔧 FunctionPlanner: Successfully planned function signatures');
    return { success: true, functionSignatures };
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