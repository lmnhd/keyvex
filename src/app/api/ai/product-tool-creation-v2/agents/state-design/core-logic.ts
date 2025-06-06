import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC, updateTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Input schema
const StateDesignRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional()
});

export type StateDesignRequest = z.infer<typeof StateDesignRequestSchema>;

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

/**
 * State Design Agent - Generates React state logic from AI
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

  console.log('🎯 StateDesign: ==================== STARTING STATE LOGIC DESIGN ====================');
  console.log('🎯 StateDesign: Request parameters:', { 
    jobId, 
    selectedModel: selectedModel || 'default',
    timestamp: new Date().toISOString()
  });

  try {
    console.log('🎯 StateDesign: Loading TCC state from store...');
    const tcc = await getTCC(jobId);
    if (!tcc) {
      const errorMsg = `TCC not found for jobId: ${jobId}`;
      console.error('🎯 StateDesign: ❌ CRITICAL ERROR - TCC not found:', errorMsg);
      throw new Error(errorMsg);
    }

    console.log('🎯 StateDesign: ✅ TCC loaded successfully');
    console.log('🎯 StateDesign: TCC Analysis:', {
      currentStep: tcc.currentOrchestrationStep,
      status: tcc.status,
      hasUserInput: !!tcc.userInput,
      userInputKeys: Object.keys(tcc.userInput || {}),
      targetAudience: tcc.targetAudience || 'not specified',
      hasFunctionSignatures: !!tcc.functionSignatures?.length,
      functionSignatureCount: tcc.definedFunctionSignatures?.length || tcc.functionSignatures?.length || 0,
      functionNames: tcc.functionSignatures?.map(f => f.name) || [],
      hasDefinedFunctionSignatures: !!tcc.definedFunctionSignatures?.length,
      definedFunctionSignatureCount: tcc.definedFunctionSignatures?.length || 0,
      definedFunctionNames: tcc.definedFunctionSignatures?.map(f => f.name) || [],
      
    });

    logger.info({ jobId, selectedModel: selectedModel || 'default' }, '🎯 StateDesign: Starting');

    console.log('🎯 StateDesign: Emitting WebSocket progress - STARTED...');
    await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_state_logic, 'started', 'Designing React state logic...');
    console.log('🎯 StateDesign: ✅ WebSocket progress emitted - STARTED');

    // Update TCC status
    console.log('🎯 StateDesign: Updating TCC status to IN_PROGRESS...');
    const tccInProgress = { ...tcc, status: OrchestrationStatusEnum.enum.in_progress, updatedAt: new Date().toISOString() };
    await saveTCC(tccInProgress);
    console.log('🎯 StateDesign: ✅ TCC status updated to IN_PROGRESS');

    // Generate state logic with AI
    console.log('🎯 StateDesign: Calling AI to generate state logic...');
    console.log('🎯 StateDesign: AI Input parameters:', {
      selectedModel: selectedModel || 'default',
      userInputDescription: tcc.userInput?.description?.substring(0, 100) + '...' || 'No description',
      targetAudience: tcc.targetAudience || 'not specified',
      functionSignatureCount: tcc.definedFunctionSignatures?.length || tcc.functionSignatures?.length || 0
    });
    const stateLogic = await generateStateLogic(tcc, selectedModel);
    console.log('🎯 StateDesign: ✅ AI generated state logic successfully');
    console.log('🎯 StateDesign: Generated state logic summary:', {
      stateVariableCount: stateLogic?.stateVariables?.length || 0,
      functionCount: stateLogic?.functions?.length || 0,
      importsCount: stateLogic?.imports?.length || 0,
      hooksCount: stateLogic?.hooks?.length || 0
    });
    console.log('🎯 StateDesign: Full stateLogic data:', JSON.stringify(stateLogic, null, 2));

    // Convert to TCC-compatible format
    console.log('🎯 StateDesign: Converting state logic to TCC-compatible format...');
    const tccCompatibleStateLogic = {
      variables: stateLogic.stateVariables.map((v: { name: string; type: string; initialValue: string; description: string }) => ({
        name: v.name,
        type: v.type,
        initialValue: v.initialValue,
        description: v.description,
      })),
      functions: stateLogic.functions.map((f: { name: string; parameters: string[]; logic: string; description: string }) => ({
        name: f.name,
        body: f.logic,
        description: f.description,
        dependencies: f.parameters,
      })),
      imports: stateLogic.imports,
      stateVariables: stateLogic.stateVariables,
    };
    console.log('🎯 StateDesign: ✅ State logic converted to TCC format');
    console.log('🎯 StateDesign: TCC-compatible format summary:', {
      variableCount: tccCompatibleStateLogic.variables?.length || 0,
      functionCount: tccCompatibleStateLogic.functions?.length || 0,
      variableNames: tccCompatibleStateLogic.variables?.map((v: { name: string }) => v.name) || [],
      functionNames: tccCompatibleStateLogic.functions?.map((f: { name: string }) => f.name) || []
    });

    // Update TCC with results using updateTCC to avoid race conditions
    console.log('🎯 StateDesign: About to update TCC with stateLogic using updateTCC...');
    await updateTCC(jobId, {
      stateLogic: tccCompatibleStateLogic,
      steps: {
        ...tccInProgress.steps,
        designingStateLogic: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tccInProgress.steps?.designingStateLogic?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: stateLogic
        }
      }
    });
    console.log('🎯 StateDesign: TCC updated successfully with stateLogic data');

    console.log('🎯 StateDesign: Emitting WebSocket progress - COMPLETED...');
    await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_state_logic, 'completed', `Generated ${stateLogic.stateVariables.length} state variables and ${stateLogic.functions.length} functions`);
    console.log('🎯 StateDesign: ✅ WebSocket progress emitted - COMPLETED');

    logger.info({ jobId, stateVariablesGenerated: stateLogic.stateVariables.length, functionsGenerated: stateLogic.functions.length }, '🎯 StateDesign: Completed successfully');

    console.log('🎯 StateDesign: ==================== STATE LOGIC DESIGN COMPLETED SUCCESSFULLY ====================');
    console.log('🎯 StateDesign: Final result summary:', {
      success: true,
      stateVariableCount: stateLogic.stateVariables.length,
      functionCount: stateLogic.functions.length,
      variableNames: stateLogic.stateVariables.map((v: { name: string }) => v.name),
      functionNames: stateLogic.functions.map((f: { name: string }) => f.name)
    });

    return { success: true, stateLogic };

  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, '🎯 StateDesign: Error');
    await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_state_logic, 'failed', `State design failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

/**
 * Generate state logic using AI
 */
async function generateStateLogic(tcc: ToolConstructionContext, selectedModel?: string) {
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