import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
// TCC Store operations removed - using prop-based TCC passing
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Enhanced testing options for granular control
export type TestingOptions = {
  enableWebSocketStreaming?: boolean;    // Test progress emissions
  enableTccOperations?: boolean;         // Test TCC store operations  
  enableOrchestrationTriggers?: boolean; // Test agent coordination
};

// Input schema
const StateDesignRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  mockTcc: z.custom<Partial<ToolConstructionContext>>().optional(), // For testing purposes - properly typed
  testingOptions: z.object({
    enableWebSocketStreaming: z.boolean().optional(),
    enableTccOperations: z.boolean().optional(),
    enableOrchestrationTriggers: z.boolean().optional()
  }).optional()
});

export type StateDesignRequest = z.infer<typeof StateDesignRequestSchema>;

// Proper type definitions for state logic components
export type StateVariable = {
  name: string;
  type: string;
  initialValue: string;
  description: string;
};

export type StateFunction = {
  name: string;
  parameters: string[];
  logic: string;
  description: string;
};

export type TccStateVariable = {
  name: string;
  type: string;
  initialValue: string;
  description: string;
};

export type TccStateFunction = {
  name: string;
  body: string;
  description: string;
  dependencies: string[];
};

export type StateLogicResult = {
  stateVariables: StateVariable[];
  functions: StateFunction[];
  imports: string[];
  hooks: string[];
};

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

/**
 * State Design Agent - Generates React state logic from AI.
 * This function is a pure, testable unit of logic that takes a TCC,
 * performs state design, and returns an updated TCC without side effects.
 */
export async function designStateLogic(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
}): Promise<{
  success: boolean;
  stateLogic?: StateLogicResult;
  error?: string;
  updatedTcc?: ToolConstructionContext; // Return the updated TCC
}> {
  const { jobId, selectedModel } = request;
  const tcc = request.mockTcc || request.tcc;

  logger.info({ jobId }, '🎯 StateDesign: Starting state logic design');

  try {
    if (!tcc) {
      throw new Error(
        `A valid TCC object was not provided for jobId: ${jobId}`,
      );
    }

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'in_progress',
      'Designing state logic and functions...',
      tcc // Pass TCC with userId
    );

    logger.info({ jobId }, '🎯 StateDesign: Calling AI to generate state logic...');
    const stateLogic = await generateStateLogic(tcc, selectedModel);
    logger.info({ jobId }, '🎯 StateDesign: AI generated state logic successfully');

    // Convert to TCC-compatible format
    const tccCompatibleStateLogic = {
      variables: stateLogic.stateVariables.map(
        (v: StateVariable): TccStateVariable => ({
          name: v.name,
          type: v.type,
          initialValue: v.initialValue,
          description: v.description,
        }),
      ),
      functions: stateLogic.functions.map(
        (f: StateFunction): TccStateFunction => ({
          name: f.name,
          body: f.logic,
          description: f.description,
          dependencies: f.parameters,
        }),
      ),
      imports: stateLogic.imports,
    };

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      stateLogic: tccCompatibleStateLogic,
      steps: {
        ...tcc.steps,
        designingStateLogic: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt:
            tcc.steps?.designingStateLogic?.startedAt ||
            new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: stateLogic,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    logger.info(
      {
        jobId,
        updateData: {
          stateVariableCount: updatedTcc.stateLogic?.variables?.length,
          functionCount: updatedTcc.stateLogic?.functions?.length,
        },
      },
      '🎯 StateDesign: TCC update prepared',
    );

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'completed',
      `Successfully designed ${updatedTcc.stateLogic?.variables?.length || 0} state variables and ${updatedTcc.stateLogic?.functions?.length || 0} functions.`,
      updatedTcc // Pass updated TCC with userId
    );

    return { success: true, stateLogic, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🎯 StateDesign: Error');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'failed',
      errorMessage,
      tcc // Pass TCC with userId even on failure
    );
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate state logic using AI
 */
async function generateStateLogic(tcc: ToolConstructionContext, selectedModel?: string): Promise<StateLogicResult> {
  // Model selection logic (same pattern as JSX agent)
  let modelConfig: { provider: string; modelId: string };
  let actualModelName: string;

  if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      modelConfig = { provider, modelId: selectedModel };
      actualModelName = selectedModel;
    } else {
      const primaryModel = getPrimaryModel('toolCreator');
      modelConfig = primaryModel && 'modelInfo' in primaryModel ? 
        { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } :
        { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = modelConfig.modelId;
    }
  } else {
    try {
      const primaryModel = getPrimaryModel('toolCreator');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
      } else {
        const fallbackModel = getFallbackModel('toolCreator');
        modelConfig = fallbackModel && 'modelInfo' in fallbackModel ?
          { provider: fallbackModel.provider, modelId: fallbackModel.modelInfo.id } :
          { provider: 'openai', modelId: 'gpt-4o' };
        actualModelName = modelConfig.modelId;
      }
    } catch (error) {
      modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = 'gpt-4o';
    }
  }

  console.log('🎯 StateDesign: ==================== MODEL SELECTION ====================');
  console.log('🎯 StateDesign: Model selection details:', {
    originalSelectedModel: selectedModel || 'none',
    finalProvider: modelConfig.provider,
    finalModelId: modelConfig.modelId,
    actualModelName,
    timestamp: new Date().toISOString()
  });

  logger.info({ provider: modelConfig.provider, modelName: actualModelName }, '🎯 StateDesign: Using model');

  console.log('🎯 StateDesign: Creating model instance...');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);
  console.log('🎯 StateDesign: ✅ Model instance created successfully');

  const systemPrompt = `You are a React state design specialist. Create state variables and functions for a React component.

CRITICAL: Generate ONLY state logic - NO JSX or HTML.
Design TypeScript interfaces, useState hooks, and function implementations.
Use modern React patterns and proper error handling.

Return structured JSON with:
{
  "stateVariables": [{"name": "...", "type": "...", "initialValue": "...", "description": "..."}],
  "functions": [{"name": "...", "parameters": ["..."], "logic": "...", "description": "..."}],
  "imports": ["..."],
  "hooks": ["..."]
}`;

  const userPrompt = `Tool: ${tcc.userInput}
Target Audience: ${tcc.targetAudience || 'General users'}

Function Signatures to Implement:
${(tcc.definedFunctionSignatures || tcc.functionSignatures)?.map(sig => `- ${sig.name}: ${sig.description}`).join('\n') || 'None'}

Design React state variables and function implementations for this tool.`;

  logger.info({ modelId: modelConfig.modelId, promptLength: userPrompt.length }, '🎯 StateDesign: Calling AI');

  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
    maxTokens: 2000
  });

  if (!content) throw new Error('No response from AI model');

  // AI FIRST: Parse the response
  return parseStateResponse(content, tcc.definedFunctionSignatures || tcc.functionSignatures || []);
}

/**
 * AI FIRST: Parse AI response for state logic
 */
function parseStateResponse(content: string, functionSignatures: DefinedFunctionSignature[]) {
  // Try to extract JSON from AI response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                   content.match(/\{[\s\S]*"stateVariables"[\s\S]*\}/);
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      logger.info({ hasStateVariables: !!parsed.stateVariables, hasFunctions: !!parsed.functions }, '🎯 StateDesign: AI FIRST - Using AI JSON');
      
      return {
        stateVariables: parsed.stateVariables || generateDefaultStateVariables(functionSignatures),
        functions: parsed.functions || generateDefaultFunctions(functionSignatures),
        imports: parsed.imports || ["import React, { useState, useEffect } from 'react';"],
        hooks: parsed.hooks || ['useState', 'useEffect']
      };
    } catch (parseError) {
      logger.warn({ parseError: parseError instanceof Error ? parseError.message : String(parseError) }, '🎯 StateDesign: Failed to parse AI JSON');
    }
  }

  // Fallback: Generate basic structure
  logger.warn('🎯 StateDesign: No AI JSON found, using fallback');
  return {
    stateVariables: generateDefaultStateVariables(functionSignatures),
    functions: generateDefaultFunctions(functionSignatures),
    imports: ["import React, { useState, useEffect } from 'react';"],
    hooks: ['useState', 'useEffect']
  };
}

/**
 * Generate default state variables when AI parsing fails
 */
function generateDefaultStateVariables(functionSignatures: DefinedFunctionSignature[]) {
  return [
    { name: 'isLoading', type: 'boolean', initialValue: 'false', description: 'Loading state' },
    { name: 'result', type: 'any', initialValue: 'null', description: 'Processing result' },
    { name: 'errors', type: 'Record<string, string>', initialValue: '{}', description: 'Validation errors' },
    { name: 'formData', type: 'Record<string, any>', initialValue: '{}', description: 'Form input data' }
  ];
}

/**
 * Generate default functions when AI parsing fails
 */
function generateDefaultFunctions(functionSignatures: DefinedFunctionSignature[]) {
  return functionSignatures.map(sig => ({
    name: sig.name,
    parameters: ['...args: any[]'],
    logic: `
  setIsLoading(true);
  try {
    // TODO: Implement ${sig.description || sig.name}
    console.log('${sig.name} called');
    setResult('success');
  } catch (error) {
    setErrors({ general: error instanceof Error ? error.message : 'Error occurred' });
  } finally {
    setIsLoading(false);
  }`,
    description: sig.description || `Handler for ${sig.name}`
  }));
} 