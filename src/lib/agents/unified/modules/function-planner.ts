// File Path: keyvex_app/src/lib/agents/unified/modules/function-planner.ts
import { z } from 'zod';
import {
  ToolConstructionContext,
  DefinedFunctionSignature,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { callModelForObject } from '@/lib/ai/model-caller';
import logger from '@/lib/logger';
import { getFunctionPlannerSystemPrompt } from '@/lib/prompts/v2/function-planner-prompt';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import { filterBrainstormForFunctionPlanner, generateFilteredBrainstormContext } from '@/lib/utils/brainstorm-filter';

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

// Zod schema for function signatures
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

// Module interface for the unified agent system
export interface FunctionPlannerRequest {
  jobId: string;
  selectedModel?: string;
  tcc: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
}

export interface FunctionPlannerResult {
  success: boolean;
  functionSignatures?: DefinedFunctionSignature[];
  error?: string;
  updatedTcc: ToolConstructionContext;
}

/**
 * Function Planner Module - Extracted core logic for unified agent system
 * Plans function signatures needed for component interactivity
 */
export async function executeFunctionPlanner(request: FunctionPlannerRequest): Promise<FunctionPlannerResult> {
  const { jobId, selectedModel, tcc, isIsolatedTest = false, editMode } = request;

  try {
    logger.info({ jobId }, '🔧 FunctionPlanner Module: Starting function signature planning');
    
    if (!tcc || !tcc.agentModelMapping) {
      throw new Error(`Valid TCC was not provided for jobId: ${jobId}`);
    }

    // Apply user model selection if provided
    if (selectedModel) {
      logger.info({ jobId, selectedModel }, '🔧 FunctionPlanner Module: User selected explicit model');
      tcc.agentModelMapping['function-planner'] = selectedModel;
    }

    // Emit progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId, 
        OrchestrationStepEnum.enum.planning_function_signatures,
        'in_progress',
        'Beginning function signature planning...',
        tcc
      );
    }

    // Generate function signatures using AI
    const functionSignatures = await generateFunctionSignatures(tcc, selectedModel, isIsolatedTest, editMode);

    // Update TCC with results
    const updatedTcc = { ...tcc };
    updatedTcc.definedFunctionSignatures = functionSignatures;
    updatedTcc.currentOrchestrationStep = OrchestrationStepEnum.enum.designing_state_logic;
    updatedTcc.status = OrchestrationStatusEnum.enum.in_progress;

    logger.info({ 
      jobId,
      functionSignatureCount: functionSignatures.length,
      newFunctionNames: functionSignatures.map(f => f.name),
    }, '🔧 FunctionPlanner Module: Successfully planned function signatures');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.planning_function_signatures,
        'completed',
        `Successfully planned ${functionSignatures.length} function signatures.`,
        updatedTcc
      );
    }

    return { 
      success: true, 
      functionSignatures, 
      updatedTcc 
    };

  } catch (error) {
    logger.error({ jobId, error }, '🔧 FunctionPlanner Module: Error planning function signatures');
    
    // Emit failure progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'failed',
      error instanceof Error ? error.message : 'Unknown error',
      tcc
    );
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      updatedTcc: tcc
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
  
  logger.info({ modelId }, '🔧 FunctionPlanner Module: Using model for generation');

  const systemPrompt = getFunctionPlannerSystemPrompt(false);
  const userPrompt = createUserPrompt(tcc, editMode);

  // Log prompts when in isolated test mode for debugging
  if (isIsolatedTest) {
    console.log(`\n🔧 ========== FUNCTION PLANNER MODULE - ISOLATION TEST PROMPTS ==========`);
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
    
    logger.info({ 
      jobId: tcc.jobId,
      modelId: modelId,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length
    }, '🔧 FunctionPlanner Module: [ISOLATED TEST] Prompt lengths logged to console');
  }

  try {
    // Primary model attempt
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
    logger.error({ error, modelId }, `🔧 FunctionPlanner Module: Model call failed`);
    
    // Try fallback model if primary failed and fallback is configured
    const fallbackModelInfo = getFallbackModel('functionPlanner');
    if (!fallbackModelInfo) {
      throw new Error(`Function planning failed with model ${modelId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    logger.info({ 
      fallbackModelId: fallbackModelInfo.modelInfo.id,
      provider: fallbackModelInfo.provider 
    }, '🔧 FunctionPlanner Module: Attempting fallback model');

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
 * Enhanced with filtered brainstorm data integration and edit mode support
 */
function createUserPrompt(tcc: ToolConstructionContext, editMode?: EditModeContext): string {
  // Get Function Planner specific filtered data
  const filteredBrainstormData = filterBrainstormForFunctionPlanner(tcc.brainstormData, tcc.jobId);
  
  // Use brainstorm data for tool description instead of fallback
  let toolDescription = tcc.userInput?.description;
  if (!toolDescription && filteredBrainstormData) {
    toolDescription = `${filteredBrainstormData.coreConcept || 'Business Tool'}: ${filteredBrainstormData.valueProposition || 'A tool to help users make informed decisions.'}`;
  }

  let prompt = `Please analyze this tool description and provide the function signatures needed:

TOOL DESCRIPTION: ${toolDescription || 'Business calculation tool'}
TOOL TYPE: ${tcc.userInput.toolType || 'Not specified'}

Additional Context:
- User Industry: ${tcc.userInput.targetAudience || 'General'}`;

  // Add filtered brainstorm context when available
  if (filteredBrainstormData) {
    const brainstormContext = generateFilteredBrainstormContext(filteredBrainstormData, 'FunctionPlanner');
    prompt += brainstormContext;

    logger.info({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: true,
      dataReduction: 'Applied Function Planner specific filtering'
    }, '🔧 FunctionPlanner Module: [FILTERED BRAINSTORM] Context successfully added to prompt');
  } else {
    logger.warn({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: false
    }, '🔧 FunctionPlanner Module: [FILTERED BRAINSTORM] ⚠️ Prompt created WITHOUT brainstorm context - tool may be too generic');
  }

  // Add edit mode context if in edit mode
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
