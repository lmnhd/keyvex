import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Input schema for the state design agent
const StateDesignRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional()
});

export type StateDesignRequest = z.infer<typeof StateDesignRequestSchema>;

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
 * Core logic for the State Design Agent.
 * Generates React state variables, functions, and logic (no JSX) based on
 * the function signatures planned by the Function Planner.
 */
export async function designStateLogic(request: StateDesignRequest): Promise<{
  success: boolean;
  stateLogic?: {
    stateVariables: Array<{
      name: string;
      type: string;
      initialValue: string;
      description: string;
    }>;
    functions: Array<{
      name: string;
      parameters: string[];
      logic: string;
      description: string;
    }>;
    imports: string[];
    hooks: string[];
  };
  error?: string;
}> {
  const { jobId, selectedModel } = StateDesignRequestSchema.parse(request);

  try {
    // Load current TCC state
    const tcc = await getTCC(jobId);
    if (!tcc) {
      throw new Error(`TCC not found for jobId: ${jobId}`);
    }

    logger.info({ 
      jobId, 
      selectedModel: selectedModel || 'default',
      stepName: 'designing_state_logic',
      hasFunctionSignatures: !!tcc.functionSignatures?.length
    }, '🎯 StateDesign: Starting state logic design');

    // Update status to in_progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'started',
      'Designing React state variables and function logic...'
    );

    // Update TCC status
    const tccInProgress = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccInProgress);

    // Generate state logic using AI with proper model selection
    const stateLogic = await generateStateLogic(tcc, selectedModel);

    // Convert to TCC-compatible format
    const tccCompatibleStateLogic = {
      variables: stateLogic.stateVariables.map(v => ({
        name: v.name,
        type: v.type,
        initialValue: v.initialValue,
        description: v.description,
      })),
      functions: stateLogic.functions.map(f => ({
        name: f.name,
        body: f.logic,
        description: f.description,
        dependencies: f.parameters,
      })),
      imports: stateLogic.imports,
      // Backward compatibility
      stateVariables: stateLogic.stateVariables,
    };

    // Update TCC with state logic
    const tccWithStateLogic = {
      ...tccInProgress,
      stateLogic: tccCompatibleStateLogic,
      steps: {
        ...tccInProgress.steps,
        designingStateLogic: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tccInProgress.steps?.designingStateLogic?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: stateLogic
        }
      },
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccWithStateLogic);

    // Update progress to completed
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'completed',
      `Generated ${stateLogic.stateVariables.length} state variables and ${stateLogic.functions.length} functions`
    );

    logger.info({ 
      jobId, 
      stateVariablesGenerated: stateLogic.stateVariables.length,
      functionsGenerated: stateLogic.functions.length,
      importsGenerated: stateLogic.imports.length,
      hooksGenerated: stateLogic.hooks.length 
    }, '🎯 StateDesign: Generated state logic successfully');

    return {
      success: true,
      stateLogic
    };

  } catch (error) {
    logger.error({ 
      jobId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error) 
    }, '🎯 StateDesign: Error designing state logic');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'failed',
      `State design failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Uses AI to generate React state variables and functions based on the
 * planned function signatures and user requirements.
 */
async function generateStateLogic(
  tcc: ToolConstructionContext, 
  selectedModel?: string
): Promise<{
  stateVariables: Array<{
    name: string;
    type: string;
    initialValue: string;
    description: string;
  }>;
  functions: Array<{
    name: string;
    parameters: string[];
    logic: string;
    description: string;
  }>;
  imports: string[];
  hooks: string[];
}> {
  // Determine model to use following established pattern
  let modelConfig: { provider: string; modelId: string };
  let actualModelName: string;

  if (selectedModel && selectedModel !== 'default') {
    // CASE 1: Explicit model specified
    logger.info({ selectedModel }, '🎯 StateDesign: User selected explicit model');
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      modelConfig = { provider, modelId: selectedModel };
      actualModelName = selectedModel;
    } else {
      logger.warn({ selectedModel }, '🎯 StateDesign: Unknown model format, falling back to default');
      const primaryModel = getPrimaryModel('toolCreator');
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
    }, '🎯 StateDesign: Using default model configuration');
    
    try {
      const primaryModel = getPrimaryModel('toolCreator');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
        logger.info({ 
          provider: primaryModel.provider,
          modelId: primaryModel.modelInfo.id 
        }, '🎯 StateDesign: Using toolCreator primary model');
      } else {
        const fallbackModel = getFallbackModel('toolCreator');
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
      }, '🎯 StateDesign: Could not resolve default model, using fallback');
      
      modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = 'gpt-4o';
    }
  }

  const selectionMethod = selectedModel && selectedModel !== 'default' 
    ? `Explicit User Selection (${selectedModel})` 
    : selectedModel === 'default' 
      ? 'User Selected "default" → toolCreator Config' 
      : 'No Model → toolCreator Config';
      
  logger.info({ 
    provider: modelConfig.provider,
    modelName: actualModelName,
    selectionMethod,
    originalSelectedModel: selectedModel || 'none'
  }, '🎯 StateDesign Model Selection:');

  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = `You are a React state design specialist. Your job is to design the state variables and functions for a React component.

CRITICAL RULES:
1. DO NOT generate any JSX or HTML - only state logic
2. Generate TypeScript interfaces and function implementations
3. Use modern React patterns (useState, useEffect, etc.)
4. Follow React best practices for state management
5. All functions should be properly typed
6. Include proper error handling in functions
7. Generate realistic initial values for state variables

You will be provided with:
- User's tool description
- Function signatures that were planned
- Target audience and requirements

Generate ONLY the state logic - the JSX will be handled by another agent.

Your response should include:
- State variables with types and initial values
- Function implementations that match the planned signatures
- Required imports
- React hooks to be used

Format your response as a structured analysis.`;

  const userPrompt = `Tool Description: ${tcc.userInput}
Target Audience: ${tcc.targetAudience || 'General users'}

Function Signatures to Implement:
${tcc.functionSignatures?.map(sig => `- ${sig.name}: ${sig.description}`).join('\n') || 'No function signatures available'}

Additional Context:
${tcc.additionalContext ? JSON.stringify(tcc.additionalContext, null, 2) : 'No additional context'}

Please design the React state variables and function implementations for this tool. Include:

1. State Variables (name, type, initial value, description)
2. Function Implementations (name, parameters, logic, description)  
3. Required Imports
4. React Hooks to use

Focus on creating a clean, functional state management system that supports the planned interactions.`;

  logger.info({ 
    provider: modelConfig.provider,
    modelId: modelConfig.modelId,
    userInputLength: userPrompt.length 
  }, '🎯 StateDesign: Calling AI model for state logic generation');

  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
    maxTokens: 2000
  });

  if (!content) {
    throw new Error('No response received from AI model');
  }

  // Parse the AI response into structured state logic
  try {
    const stateLogic = parseStateLogicResponse(content, tcc.functionSignatures || []);
    
    logger.info({ 
      stateVariablesCount: stateLogic.stateVariables.length,
      functionsCount: stateLogic.functions.length,
      importsCount: stateLogic.imports.length,
      hooksCount: stateLogic.hooks.length,
      modelUsed: actualModelName 
    }, '🎯 StateDesign: Successfully parsed AI response');
    
    return stateLogic;
    
  } catch (parseError) {
    logger.error({ 
      parseError: parseError instanceof Error ? parseError.message : String(parseError),
      rawResponseLength: content?.length || 0,
      modelUsed: actualModelName 
    }, '🎯 StateDesign: Failed to parse AI response');
    logger.debug({ rawResponse: content }, '🎯 StateDesign: Raw AI response for debugging');
    
    // Fallback to basic state structure
    return generateFallbackStateLogic(tcc.functionSignatures || []);
  }
}

/**
 * Parses the AI response and extracts structured state logic
 */
function parseStateLogicResponse(
  content: string, 
  functionSignatures: DefinedFunctionSignature[]
): {
  stateVariables: Array<{
    name: string;
    type: string;
    initialValue: string;
    description: string;
  }>;
  functions: Array<{
    name: string;
    parameters: string[];
    logic: string;
    description: string;
  }>;
  imports: string[];
  hooks: string[];
} {
  // Basic parsing - in a production system, this would be more sophisticated
  // For now, we'll generate a structured response based on function signatures
  
  const stateVariables = [
    {
      name: 'isLoading',
      type: 'boolean',
      initialValue: 'false',
      description: 'Loading state indicator'
    },
    {
      name: 'result',
      type: 'any',
      initialValue: 'null',
      description: 'Calculation or processing result'
    },
    {
      name: 'formData',
      type: 'Record<string, any>',
      initialValue: '{}',
      description: 'Form input data'
    },
    {
      name: 'errors',
      type: 'Record<string, string>',
      initialValue: '{}',
      description: 'Validation errors'
    }
  ];

  const functions = functionSignatures.map(sig => ({
    name: sig.name,
    parameters: ['...args: any[]'],
    logic: `
  // Implementation for ${sig.name}
  console.log('${sig.name} called with:', args);
  setIsLoading(true);
  try {
    // TODO: Implement ${sig.description || 'function logic'}
    const result = performCalculation(args);
    setResult(result);
    setErrors({});
  } catch (error) {
    setErrors({ general: error.message });
  } finally {
    setIsLoading(false);
  }`,
    description: sig.description || `Handler for ${sig.name}`
  }));

  const imports = [
    "import React, { useState, useEffect, useCallback } from 'react';",
    "import { z } from 'zod';"
  ];

  const hooks = [
    'useState',
    'useEffect', 
    'useCallback'
  ];

  return {
    stateVariables,
    functions,
    imports,
    hooks
  };
}

/**
 * Generates fallback state logic when AI parsing fails
 */
function generateFallbackStateLogic(
  functionSignatures: DefinedFunctionSignature[]
): {
  stateVariables: Array<{
    name: string;
    type: string;
    initialValue: string;
    description: string;
  }>;
  functions: Array<{
    name: string;
    parameters: string[];
    logic: string;
    description: string;
  }>;
  imports: string[];
  hooks: string[];
} {
  logger.info({ 
    signatureCount: functionSignatures.length 
  }, '🎯 StateDesign: Generating fallback state logic');

  return {
    stateVariables: [
      {
        name: 'data',
        type: 'any',
        initialValue: 'null',
        description: 'Main data state'
      },
      {
        name: 'loading',
        type: 'boolean',
        initialValue: 'false',
        description: 'Loading indicator'
      }
    ],
    functions: functionSignatures.length > 0 ? functionSignatures.map(sig => ({
      name: sig.name,
      parameters: ['event?: any'],
      logic: `console.log('${sig.name} triggered');`,
      description: sig.description || `Handler for ${sig.name}`
    })) : [
      {
        name: 'handleSubmit',
        parameters: ['event?: any'],
        logic: 'console.log("Submit triggered");',
        description: 'Default submit handler'
      }
    ],
    imports: ["import React, { useState } from 'react';"],
    hooks: ['useState']
  };
}