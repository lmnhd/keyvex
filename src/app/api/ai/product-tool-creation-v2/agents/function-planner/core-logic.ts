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

  console.log('🔧 FunctionPlanner: ==================== STARTING FUNCTION SIGNATURE PLANNING ====================');
  console.log('🔧 FunctionPlanner: Request parameters:', { 
    jobId, 
    selectedModel: selectedModel || 'default',
    timestamp: new Date().toISOString()
  });

  try {
    // Load current TCC state
    console.log('🔧 FunctionPlanner: Loading TCC state from store...');
    const tcc = await getTCC(jobId);
    if (!tcc) {
      const errorMsg = `TCC not found for jobId: ${jobId}`;
      console.error('🔧 FunctionPlanner: ❌ CRITICAL ERROR - TCC not found:', errorMsg);
      throw new Error(errorMsg);
    }

    console.log('🔧 FunctionPlanner: ✅ TCC loaded successfully');
    console.log('🔧 FunctionPlanner: TCC Analysis:', {
      currentStep: tcc.currentOrchestrationStep,
      status: tcc.status,
      hasUserInput: !!tcc.userInput,
      userInputKeys: Object.keys(tcc.userInput || {}),
      targetAudience: tcc.targetAudience || 'not specified',
      hasExistingSignatures: !!tcc.definedFunctionSignatures?.length
    });

    logger.info({ 
      jobId, 
      selectedModel: selectedModel || 'default',
      stepName: 'planning_function_signatures' 
    }, '🔧 FunctionPlanner: Starting function signature planning');

    // Update status to in_progress
    console.log('🔧 FunctionPlanner: Emitting WebSocket progress - STARTED...');
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'started',
      'Analyzing user requirements to plan function signatures...'
    );
    console.log('🔧 FunctionPlanner: ✅ WebSocket progress emitted - STARTED');

    // Update TCC status
    console.log('🔧 FunctionPlanner: Updating TCC status to IN_PROGRESS...');
    const tccInProgress = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccInProgress);
    console.log('🔧 FunctionPlanner: ✅ TCC status updated to IN_PROGRESS');

    // Generate function signatures using AI with proper model selection
    console.log('🔧 FunctionPlanner: Calling AI to generate function signatures...');
    console.log('🔧 FunctionPlanner: AI Input parameters:', {
      selectedModel: selectedModel || 'default',
      userInputDescription: tcc.userInput?.description?.substring(0, 100) + '...' || 'No description',
      targetAudience: tcc.targetAudience || 'not specified'
    });
    const functionSignatures = await generateFunctionSignatures(tcc, selectedModel);
    console.log('🔧 FunctionPlanner: ✅ AI generated function signatures:', functionSignatures);

    // Update TCC with function signatures
    console.log('🔧 FunctionPlanner: Updating TCC with generated function signatures...');
    const updatedTCC: ToolConstructionContext = {
      ...tcc,
      currentOrchestrationStep: OrchestrationStepEnum.enum.designing_state_logic,
      status: OrchestrationStatusEnum.enum.pending,
      definedFunctionSignatures: functionSignatures,
      functionSignatures: functionSignatures, // Add backward compatibility alias
      updatedAt: new Date().toISOString()
    };

    await saveTCC(updatedTCC);
    console.log('🔧 FunctionPlanner: ✅ TCC updated with function signatures');
    console.log('🔧 FunctionPlanner: TCC function signature fields set:', {
      definedFunctionSignatures: functionSignatures.length,
      functionSignatures: functionSignatures.length, // Both fields should be identical
      signatureNames: functionSignatures.map(f => f.name)
    });
    console.log('🔧 FunctionPlanner: Next orchestration step set to:', OrchestrationStepEnum.enum.designing_state_logic);

    console.log('🔧 FunctionPlanner: Emitting WebSocket progress - COMPLETED...');
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'completed',
      `Generated ${functionSignatures.length} function signatures for component interaction.`,
      { functionCount: functionSignatures.length, signatures: functionSignatures.map(f => f.name) }
    );
    console.log('🔧 FunctionPlanner: ✅ WebSocket progress emitted - COMPLETED');

    logger.info({ 
      jobId, 
      signaturesGenerated: functionSignatures.length,
      signatures: functionSignatures.map(f => f.name) 
    }, '🔧 FunctionPlanner: Generated function signatures successfully');

    console.log('🔧 FunctionPlanner: ==================== FUNCTION SIGNATURE PLANNING COMPLETED SUCCESSFULLY ====================');
    console.log('🔧 FunctionPlanner: Final result:', {
      success: true,
      signatureCount: functionSignatures.length,
      signatureNames: functionSignatures.map(f => f.name),
      nextStep: OrchestrationStepEnum.enum.designing_state_logic
    });

    return {
      success: true,
      functionSignatures
    };

  } catch (error) {
    console.error('🔧 FunctionPlanner: ==================== ERROR OCCURRED ====================');
    console.error('🔧 FunctionPlanner: ❌ Error details:', {
      jobId,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    if (error instanceof Error && error.stack) {
      console.error('🔧 FunctionPlanner: ❌ Error stack:', error.stack);
    }

    logger.error({ 
      jobId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error) 
    }, '🔧 FunctionPlanner: Error planning function signatures');
    
    console.log('🔧 FunctionPlanner: Emitting WebSocket progress - FAILED...');
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'failed',
      `Failed to plan function signatures: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { errorDetails: { message: String(error) } }
    );
    console.log('🔧 FunctionPlanner: ✅ WebSocket progress emitted - FAILED');

    console.error('🔧 FunctionPlanner: ==================== FUNCTION SIGNATURE PLANNING FAILED ====================');
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

  console.log('🔧 FunctionPlanner: ==================== MODEL SELECTION ====================');
  console.log('🔧 FunctionPlanner: Model selection details:', {
    originalSelectedModel: selectedModel || 'none',
    selectionMethod,
    finalProvider: modelConfig.provider,
    finalModelId: modelConfig.modelId,
    actualModelName,
    timestamp: new Date().toISOString()
  });
      
  logger.info({ 
    provider: modelConfig.provider,
    modelName: actualModelName,
    selectionMethod,
    originalSelectedModel: selectedModel || 'none'
  }, '🔧 FunctionPlanner Model Selection:');

  console.log('🔧 FunctionPlanner: Creating model instance...');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);
  console.log('🔧 FunctionPlanner: ✅ Model instance created successfully');
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

  console.log('🔧 FunctionPlanner: ==================== CALLING AI MODEL ====================');
  console.log('🔧 FunctionPlanner: AI call parameters:', {
    provider: modelConfig.provider,
    modelId: modelConfig.modelId,
    temperature: 0.3,
    maxTokens: 1000,
    userPromptLength: userPrompt.length,
    systemPromptLength: systemPrompt.length
  });

  logger.info({ 
    provider: modelConfig.provider,
    modelId: modelConfig.modelId,
    userInputLength: userPrompt.length 
  }, '🔧 FunctionPlanner: Calling AI model for function signature generation');

  console.log('🔧 FunctionPlanner: Sending request to AI model...');
  const startTime = Date.now();
  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
    maxTokens: 1000
  });
  const duration = Date.now() - startTime;
  
  console.log('🔧 FunctionPlanner: ✅ AI model response received:', {
    duration: `${duration}ms`,
    contentLength: content?.length || 0,
    hasContent: !!content
  });

  if (!content) {
    const error = 'Failed to generate function signatures - empty response';
    console.error('🔧 FunctionPlanner: ❌ AI ERROR - Empty response:', error);
    throw new Error(error);
  }

  console.log('🔧 FunctionPlanner: ==================== PARSING AI RESPONSE ====================');
  console.log('🔧 FunctionPlanner: Raw AI response preview:', content.substring(0, 200) + '...');

  try {
    // Extract JSON from response
    console.log('🔧 FunctionPlanner: Extracting JSON from AI response...');
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('🔧 FunctionPlanner: ❌ No JSON array found in response');
      throw new Error('No JSON array found in response');
    }

    console.log('🔧 FunctionPlanner: ✅ JSON array found, parsing...');
    const signatures = JSON.parse(jsonMatch[0]);
    console.log('🔧 FunctionPlanner: Raw parsed signatures:', signatures);
    
    // Validate the signatures
    console.log('🔧 FunctionPlanner: Validating signature format...');
    const validatedSignatures = signatures.map((sig: any, index: number) => {
      console.log(`🔧 FunctionPlanner: Validating signature ${index + 1}:`, sig);
      if (!sig.name || typeof sig.name !== 'string') {
        console.error(`🔧 FunctionPlanner: ❌ Invalid signature ${index + 1}: missing or invalid name`);
        throw new Error('Invalid function signature: missing or invalid name');
      }
      return {
        name: sig.name,
        description: sig.description || `Handler function: ${sig.name}`
      };
    });

    console.log('🔧 FunctionPlanner: ✅ All signatures validated');

    // Ensure we have at least one function
    if (validatedSignatures.length === 0) {
      console.log('🔧 FunctionPlanner: ⚠️ No signatures found, adding default...');
      validatedSignatures.push({
        name: 'handleSubmit',
        description: 'Handles form submission and primary tool interaction'
      });
    }

    console.log('🔧 FunctionPlanner: Final validated signatures:', validatedSignatures);
    return validatedSignatures;

  } catch (parseError) {
    console.error('🔧 FunctionPlanner: ==================== PARSING ERROR ====================');
    console.error('🔧 FunctionPlanner: ❌ Failed to parse AI response:', {
      errorType: parseError instanceof Error ? parseError.constructor.name : typeof parseError,
      errorMessage: parseError instanceof Error ? parseError.message : String(parseError),
      rawResponseLength: content?.length || 0,
      modelUsed: actualModelName
    });
    console.error('🔧 FunctionPlanner: Raw AI response for debugging:', content);

    logger.error({ 
      parseError: parseError instanceof Error ? parseError.message : String(parseError),
      rawResponseLength: content?.length || 0,
      modelUsed: actualModelName 
    }, '🔧 FunctionPlanner: Failed to parse AI response');
    logger.debug({ rawResponse: content }, '🔧 FunctionPlanner: Raw AI response for debugging');
    
    // Fallback to default signatures
    console.log('🔧 FunctionPlanner: Using fallback default signatures...');
    const fallbackSignatures = [
      {
        name: 'handleSubmit',
        description: 'Handles form submission and primary tool interaction'
      },
      {
        name: 'handleReset',
        description: 'Resets form inputs to initial state'
      }
    ];
    console.log('🔧 FunctionPlanner: Fallback signatures:', fallbackSignatures);
    return fallbackSignatures;
  }
} 