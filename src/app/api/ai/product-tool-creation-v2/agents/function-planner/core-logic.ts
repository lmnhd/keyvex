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

// Phase 2: Edit mode context type
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
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
}): Promise<{
  success: boolean;
  functionSignatures?: DefinedFunctionSignature[];
  error?: string;
  updatedTcc?: ToolConstructionContext;
}> {
  const { jobId, selectedModel, isIsolatedTest = false, editMode } = request;
  const tcc = request.mockTcc || request.tcc;
  
  // Phase 2: Edit mode detection
  const isEditMode = editMode?.isEditMode || false;
  const editInstructions = editMode?.instructions || [];

  try {
    logger.info({ jobId }, '🔧 FunctionPlanner: Starting function signature planning');
    
    if (!tcc || !tcc.agentModelMapping) {
      throw new Error(`Valid TCC was not provided in tcc or mockTcc for jobId: ${jobId}`);
    }

    if (selectedModel) {
      logger.info({ jobId, selectedModel }, '🔧 FunctionPlanner: User selected explicit model');
      tcc.agentModelMapping['function-planner'] = selectedModel;
    }

    if (!isIsolatedTest) {
    await emitStepProgress(
      jobId, 
      OrchestrationStepEnum.enum.planning_function_signatures,
      'in_progress',
      'Beginning function signature planning...',
      tcc // Pass TCC with userId
    );
    } else {
      logger.info({ jobId }, '🔧 FunctionPlanner: Isolated test mode - skipping progress emission');
    }

    const functionSignatures = await generateFunctionSignatures(tcc, selectedModel, isIsolatedTest, editMode);

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

    if (!isIsolatedTest) {
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'completed',
      `Successfully planned ${functionSignatures.length} function signatures.`,
      updatedTcc // Pass updated TCC with userId
    );
    } else {
      logger.info({ jobId }, '🔧 FunctionPlanner: Isolated test mode - skipping final progress emission');
    }

    logger.info({ jobId, count: functionSignatures.length }, '🔧 FunctionPlanner: Successfully planned function signatures');
    return { success: true, functionSignatures, updatedTcc };
  } catch (error) {
    logger.error({ jobId, error }, '🔧 FunctionPlanner: Error planning function signatures');
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'failed',
      error instanceof Error ? error.message : 'Unknown error',
      tcc // Pass TCC with userId even on failure
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
  selectedModel?: string,
  isIsolatedTest?: boolean,
  editMode?: EditModeContext
): Promise<DefinedFunctionSignature[]> {
  const primaryModelInfo = getPrimaryModel('functionPlanner');
  if (!primaryModelInfo) throw new Error('No primary model configured for FunctionPlanner.');
  const primaryModel = createModelInstance(primaryModelInfo.provider, primaryModelInfo.modelInfo.id);
  logger.info({ provider: primaryModelInfo.provider, modelName: primaryModelInfo.modelInfo.id }, '🔧 FunctionPlanner: Attempting primary model');

  const systemPrompt = getFunctionPlannerSystemPrompt(false);
  const userPrompt = createUserPrompt(tcc, editMode);

  // Log prompts when in isolated test mode for debugging
  if (isIsolatedTest) {
    logger.info({ 
      jobId: tcc.jobId,
      modelId: primaryModelInfo.modelInfo.id,
      systemPrompt: systemPrompt.substring(0, 500) + (systemPrompt.length > 500 ? '...' : ''),
      userPrompt: userPrompt.substring(0, 1000) + (userPrompt.length > 1000 ? '...' : '')
    }, '🔧 FunctionPlanner: [ISOLATED TEST] Prompt Preview');
    
    logger.info({ 
      jobId: tcc.jobId,
      fullSystemPrompt: systemPrompt 
    }, '🔧 FunctionPlanner: [ISOLATED TEST] Full System Prompt');
    
    logger.info({ 
      jobId: tcc.jobId,
      fullUserPrompt: userPrompt 
    }, '🔧 FunctionPlanner: [ISOLATED TEST] Full User Prompt');
  }

  try {
    const {
      object: { signatures },
    } = await generateObject({
      model: primaryModel,
      schema: functionSignaturesSchema,
      system: systemPrompt,
      prompt: userPrompt,
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
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
      maxTokens: 2000,
    });
    return signatures;
  }
}

/**
 * Creates the user prompt for the function planner based on TCC data
 * Phase 1: Enhanced with brainstorm data integration for richer context
 * Phase 2: Enhanced with edit mode support for iterative refinement
 */
function createUserPrompt(tcc: ToolConstructionContext, editMode?: EditModeContext): string {
  let prompt = `Please analyze this tool description and provide the function signatures needed:

TOOL DESCRIPTION: ${tcc.userInput.description}
TOOL TYPE: ${tcc.userInput.toolType || 'Not specified'}

Additional Context:
- User Industry: ${tcc.userInput.targetAudience || 'General'}`;

  // Phase 1: Inject rich brainstorm context when available
  if (tcc.brainstormData) {
    const brainstorm = tcc.brainstormData;
    
    prompt += `

DETAILED BRAINSTORM CONTEXT (Use this rich context to design more specific functions):

CORE CONCEPT: ${brainstorm.coreConcept || brainstorm.coreWConcept || 'Not specified'}

VALUE PROPOSITION: ${brainstorm.valueProposition || 'Not specified'}`;

    // Add suggested inputs for better function parameter design
    if (brainstorm.suggestedInputs && brainstorm.suggestedInputs.length > 0) {
      prompt += `

SUGGESTED INPUT FIELDS (Design functions to handle these):`;
      brainstorm.suggestedInputs.forEach(input => {
        prompt += `\n- ${input.label} (${input.type}): ${input.description}`;
      });
    }

    // Add key calculations for calculation-focused functions
    if (brainstorm.keyCalculations && brainstorm.keyCalculations.length > 0) {
      prompt += `

KEY CALCULATIONS TO IMPLEMENT:`;
      brainstorm.keyCalculations.forEach(calc => {
        prompt += `\n- ${calc.name}: ${calc.formula} (${calc.description})`;
      });
    }

    // Add interaction flow for user experience functions
    if (brainstorm.interactionFlow && brainstorm.interactionFlow.length > 0) {
      prompt += `

INTERACTION FLOW (Design functions to support this flow):`;
      brainstorm.interactionFlow.forEach(step => {
        prompt += `\n${step.step}. ${step.title}: ${step.userAction}`;
      });
    }

    // Add creative enhancements for additional functionality
    if (brainstorm.creativeEnhancements && brainstorm.creativeEnhancements.length > 0) {
      prompt += `

CREATIVE ENHANCEMENTS TO CONSIDER:`;
      brainstorm.creativeEnhancements.forEach(enhancement => {
        prompt += `\n- ${enhancement}`;
      });
    }
  }

  // Phase 2: Add edit mode context if in edit mode
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    prompt += `

🔄 EDIT MODE INSTRUCTIONS:
You are EDITING existing function signatures. Here are the current functions:

CURRENT FUNCTION SIGNATURES:`;

    if (tcc.definedFunctionSignatures && tcc.definedFunctionSignatures.length > 0) {
      tcc.definedFunctionSignatures.forEach(func => {
        prompt += `\n- ${func.name}: ${func.description}`;
      });
    } else {
      prompt += `\n- No existing function signatures found`;
    }

    prompt += `

EDIT INSTRUCTIONS TO FOLLOW:`;

    editMode.instructions.forEach((instruction, index) => {
      prompt += `

${index + 1}. ${instruction.editType.toUpperCase()} REQUEST (${instruction.priority} priority):
${instruction.instructions}

Created: ${instruction.createdAt}`;
    });

    prompt += `

Please apply these edit instructions to improve the function signatures. Maintain overall consistency while implementing the requested changes.`;
  }

  prompt += `

Please provide the JSON array of function signatures as specified in the guidelines.`;

  return prompt;
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