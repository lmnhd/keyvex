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
import { callModelForObject } from '@/lib/ai/model-caller';
import logger from '@/lib/logger';
import { getFunctionPlannerSystemPrompt } from '@/lib/prompts/v2/function-planner-prompt';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import { filterBrainstormForFunctionPlanner, generateFilteredBrainstormContext } from '@/lib/utils/brainstorm-filter';

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
  
  // Use selected model if provided, otherwise fall back to primary
  const modelId = selectedModel || primaryModelInfo.modelInfo.id;
  
  logger.info({ modelId }, '🔧 FunctionPlanner: Using model for generation');

  const systemPrompt = getFunctionPlannerSystemPrompt(false);
  const userPrompt = createUserPrompt(tcc, editMode);

  // Log prompts when in isolated test mode for debugging
  if (isIsolatedTest) {
    // Use console.log for prompts to make them readable during isolation testing
    console.log(`\n🔧 ========== FUNCTION PLANNER AGENT - ISOLATION TEST PROMPTS ==========`);
    console.log(`JobId: ${tcc.jobId}`);
    console.log(`Model: ${modelId}`);
    
    console.log(`\n🔧 SYSTEM PROMPT PREVIEW (first 500 chars):`);
    console.log(systemPrompt.substring(0, 500) + (systemPrompt.length > 500 ? '...' : ''));
    
    console.log(`\n🔧 USER PROMPT PREVIEW (first 1000 chars):`);
    console.log(userPrompt.substring(0, 1000) + (userPrompt.length > 1000 ? '...' : ''));
    
    console.log(`\n🔧 FULL SYSTEM PROMPT:`);
    console.log(systemPrompt);
    
    console.log(`\n🔧 FULL USER PROMPT:`);
    console.log(userPrompt);
    
    console.log(`\n🔧 ========== END PROMPTS ==========\n`);
    
    // Keep minimal structured logging for debugging
    logger.info({ 
      jobId: tcc.jobId,
      modelId: modelId,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length
    }, '🔧 FunctionPlanner: [ISOLATED TEST] Prompt lengths logged to console');
  }

  try {
    // 🌟 CENTRALIZED MODEL CALLER: Automatically handles OpenAI mode: 'json' and Anthropic thinking mode
    const {
      object: { signatures },
    } = await callModelForObject<{ signatures: DefinedFunctionSignature[] }>(modelId, {
      schema: functionSignaturesSchema,
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      temperature: 0.2,
      maxTokens: 2000,
      maxRetries: 3
    });
    
    return signatures;
  } catch (error) {
    logger.error({ error, modelId }, `🔧 FunctionPlanner: Model call failed`);
    
    // Try fallback model if primary failed and fallback is configured
    const fallbackModelInfo = getFallbackModel('functionPlanner');
    if (!fallbackModelInfo) {
      throw new Error(`Function planning failed with model ${modelId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    logger.info({ 
      fallbackModelId: fallbackModelInfo.modelInfo.id,
      provider: fallbackModelInfo.provider 
    }, '🔧 FunctionPlanner: Attempting fallback model');

    const {
      object: { signatures },
    } = await callModelForObject<{ signatures: DefinedFunctionSignature[] }>(fallbackModelInfo.modelInfo.id, {
      schema: functionSignaturesSchema,
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      temperature: 0.2,
      maxTokens: 2000,
      maxRetries: 3
    });
    
    return signatures;
  }
}

/**
 * Creates the user prompt for the function planner based on TCC data
 * Phase 1: Enhanced with FILTERED brainstorm data integration for efficient context
 * Phase 2: Enhanced with edit mode support for iterative refinement
 */
function createUserPrompt(tcc: ToolConstructionContext, editMode?: EditModeContext): string {
  // 🎯 FILTERED BRAINSTORM DATA: Only get Function Planner specific data
  const filteredBrainstormData = filterBrainstormForFunctionPlanner(tcc.brainstormData, tcc.jobId);
  
  // 🚨 FIX: Use brainstorm data for tool description instead of fallback
  let toolDescription = tcc.userInput?.description;
  if (!toolDescription && filteredBrainstormData) {
    toolDescription = `${filteredBrainstormData.coreConcept || 'Business Tool'}: ${filteredBrainstormData.valueProposition || 'A tool to help users make informed decisions.'}`;
  }

  let prompt = `Please analyze this tool description and provide the function signatures needed:

TOOL DESCRIPTION: ${toolDescription || 'Business calculation tool'}
TOOL TYPE: ${tcc.userInput.toolType || 'Not specified'}

Additional Context:
- User Industry: ${tcc.userInput.targetAudience || 'General'}`;

  // Phase 1: Add filtered brainstorm context when available
  if (filteredBrainstormData) {
    const brainstormContext = generateFilteredBrainstormContext(filteredBrainstormData, 'FunctionPlanner');
    prompt += brainstormContext;

    logger.info({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: true,
      dataReduction: 'Applied Function Planner specific filtering'
    }, '🔧 FunctionPlanner: [FILTERED BRAINSTORM] Context successfully added to prompt');
  } else {
    logger.warn({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: false
    }, '🔧 FunctionPlanner: [FILTERED BRAINSTORM] ⚠️ Prompt created WITHOUT brainstorm context - tool may be too generic');
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