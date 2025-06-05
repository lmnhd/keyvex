import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Input schema for the function planner
const FunctionPlannerRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional()
});

export type FunctionPlannerRequest = z.infer<typeof FunctionPlannerRequestSchema>;

// Helper function to create model instance
function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    default:
      return openai('gpt-4o');
  }
}

/**
 * Core logic for the Function Signature Planner Agent.
 * Analyzes user input and generates function signatures that will be needed
 * for the React component, creating shared interfaces for State and JSX agents.
 */
export async function planFunctionSignatures(request: FunctionPlannerRequest): Promise<{
  success: boolean;
  functionSignatures?: DefinedFunctionSignature[];
  error?: string;
}> {
  const { jobId, selectedModel } = FunctionPlannerRequestSchema.parse(request);

  try {
    // Load current TCC state
    const tcc = await getTCC(jobId);
    if (!tcc) {
      throw new Error(`TCC not found for jobId: ${jobId}`);
    }

    logger.info({ 
      jobId, 
      selectedModel: selectedModel || 'default',
      stepName: 'planning_function_signatures' 
    }, '🔧 FunctionPlanner: Starting function signature planning');

    // Update status to in_progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'started',
      'Analyzing user requirements to plan function signatures...'
    );

    // Update TCC status
    const tccInProgress = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccInProgress);

    // Generate function signatures using AI with proper model selection
    const functionSignatures = await generateFunctionSignatures(tcc, selectedModel);

    // Update TCC with function signatures
    const updatedTCC: ToolConstructionContext = {
      ...tcc,
      currentOrchestrationStep: OrchestrationStepEnum.enum.generating_state_logic,
      status: OrchestrationStatusEnum.enum.pending,
      definedFunctionSignatures: functionSignatures,
      updatedAt: new Date().toISOString()
    };

    await saveTCC(updatedTCC);

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'completed',
      `Generated ${functionSignatures.length} function signatures for component interaction.`,
      { functionCount: functionSignatures.length, signatures: functionSignatures.map(f => f.name) }
    );

    logger.info({ 
      jobId, 
      signaturesGenerated: functionSignatures.length,
      signatures: functionSignatures.map(f => f.name) 
    }, '🔧 FunctionPlanner: Generated function signatures successfully');

    return {
      success: true,
      functionSignatures
    };

  } catch (error) {
    logger.error({ 
      jobId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error) 
    }, '🔧 FunctionPlanner: Error planning function signatures');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'failed',
      `Failed to plan function signatures: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { errorDetails: { message: String(error) } }
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
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
  // Determine model to use following established pattern
  let modelConfig: { provider: string; modelId: string };
  let actualModelName: string;

  if (selectedModel && selectedModel !== 'default') {
    // CASE 1: Explicit model specified (e.g., 'gpt-4o', 'claude-3-5-sonnet', etc.)
    logger.info({ selectedModel }, '🔧 FunctionPlanner: User selected explicit model');
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      modelConfig = { provider, modelId: selectedModel };
      actualModelName = selectedModel;
    } else {
      logger.warn({ selectedModel }, '🔧 FunctionPlanner: Unknown model format, falling back to default');
      // Fall through to default logic below
      const primaryModel = getPrimaryModel('functionPlanner');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
      } else {
        modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
        actualModelName = 'gpt-4o';
      }
    }
  } else {
    // CASE 2: selectedModel is 'default' or no model specified
    logger.info({ 
      selectedModel: selectedModel || 'none' 
    }, '🔧 FunctionPlanner: Using default model configuration');
    
    try {
      const primaryModel = getPrimaryModel('functionPlanner');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
        logger.info({ 
          provider: primaryModel.provider,
          modelId: primaryModel.modelInfo.id 
        }, '🔧 FunctionPlanner: Using functionPlanner primary model');
      } else {
        const fallbackModel = getFallbackModel('functionPlanner');
        if (fallbackModel && 'modelInfo' in fallbackModel) {
          modelConfig = { provider: fallbackModel.provider, modelId: fallbackModel.modelInfo.id };
          actualModelName = fallbackModel.modelInfo.id;
        } else {
          modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
          actualModelName = 'gpt-4o';
        }
      }
    } catch (error) {
      logger.warn({ 
        error: error instanceof Error ? error.message : String(error),
        fallbackProvider: 'openai',
        fallbackModel: 'gpt-4o'
      }, '🔧 FunctionPlanner: Could not resolve default model, using fallback');
      
      modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = 'gpt-4o';
    }
  }

  const selectionMethod = selectedModel && selectedModel !== 'default' 
    ? `Explicit User Selection (${selectedModel})` 
    : selectedModel === 'default' 
      ? 'User Selected "default" → functionPlanner Config' 
      : 'No Model → functionPlanner Config';
      
  logger.info({ 
    provider: modelConfig.provider,
    modelName: actualModelName,
    selectionMethod,
    originalSelectedModel: selectedModel || 'none'
  }, '🔧 FunctionPlanner Model Selection:');

  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);
  const systemPrompt = `You are a React component architect specializing in function signature planning.

Your task is to analyze a user's tool description and determine what JavaScript functions will be needed for the component's interactivity.

Focus on:
1. Form handling functions (onSubmit, onChange, validation)
2. Calculation functions (business logic, data processing)
3. UI interaction functions (reset, clear, show/hide elements)
4. State manipulation functions (add/remove items, update values)

Return a JSON array of function signatures in this format:
[
  {
    "name": "handleCalculate",
    "description": "Processes user inputs and performs the main calculation logic"
  },
  {
    "name": "handleReset", 
    "description": "Resets all form inputs and calculations to initial state"
  }
]

Guidelines:
- Use descriptive, camelCase function names
- Focus on USER ACTIONS that need handling
- Include input validation functions if forms are complex
- Consider data manipulation needs (add/remove/update)
- Keep function names concise but clear
- Typical tools need 3-8 functions total`;

  const userPrompt = `Analyze this tool request and determine what JavaScript functions will be needed:

TOOL DESCRIPTION: "${tcc.userInput.description}"

ADDITIONAL CONTEXT:
- Target Audience: ${tcc.userInput.targetAudience || 'General business users'}
- Industry: ${tcc.userInput.industry || 'General'}
- Tool Type: ${tcc.userInput.toolType || 'Interactive tool'}
- Features: ${tcc.userInput.features?.join(', ') || 'Standard functionality'}

Please analyze what user interactions this tool will need and generate the corresponding function signatures.`;

  logger.info({ 
    provider: modelConfig.provider,
    modelId: modelConfig.modelId,
    userInputLength: userPrompt.length 
  }, '🔧 FunctionPlanner: Calling AI model for function signature generation');

  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
    maxTokens: 1000
  });
  if (!content) {
    throw new Error('Failed to generate function signatures - empty response');
  }

  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const signatures = JSON.parse(jsonMatch[0]);
    
    // Validate the signatures
    const validatedSignatures = signatures.map((sig: any) => {
      if (!sig.name || typeof sig.name !== 'string') {
        throw new Error('Invalid function signature: missing or invalid name');
      }
      return {
        name: sig.name,
        description: sig.description || `Handler function: ${sig.name}`
      };
    });

    // Ensure we have at least one function
    if (validatedSignatures.length === 0) {
      validatedSignatures.push({
        name: 'handleSubmit',
        description: 'Handles form submission and primary tool interaction'
      });
    }

    return validatedSignatures;

  } catch (parseError) {
    logger.error({ 
      parseError: parseError instanceof Error ? parseError.message : String(parseError),
      rawResponseLength: content?.length || 0,
      modelUsed: actualModelName 
    }, '🔧 FunctionPlanner: Failed to parse AI response');
    logger.debug({ rawResponse: content }, '🔧 FunctionPlanner: Raw AI response for debugging');
    
    // Fallback to default signatures
    return [
      {
        name: 'handleSubmit',
        description: 'Handles form submission and primary tool interaction'
      },
      {
        name: 'handleReset',
        description: 'Resets form inputs to initial state'
      }
    ];
  }
} 