import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC, updateTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
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
 * State Design Agent - Generates React state logic from AI
 */
export async function designStateLogic(request: StateDesignRequest): Promise<{
  success: boolean;
  stateLogic?: StateLogicResult;
  error?: string;
}> {
  const { jobId, selectedModel, mockTcc, testingOptions } = StateDesignRequestSchema.parse(request);

  console.log('🎯 StateDesign: ==================== STARTING STATE LOGIC DESIGN ====================');
      console.log('🎯 StateDesign: Request parameters:', { 
      jobId, 
      selectedModel: selectedModel || 'default',
      isMockMode: !!mockTcc,
      testingOptions: testingOptions || 'none',
      timestamp: new Date().toISOString()
    });

  try {
    let tcc: ToolConstructionContext;
    
    if (mockTcc) {
      console.log('🎯 StateDesign: 🧪 MOCK MODE - Using provided mock TCC');
      tcc = mockTcc as ToolConstructionContext;
    } else {
      console.log('🎯 StateDesign: Loading TCC state from store...');
      const loadedTcc = await getTCC(jobId);
      if (!loadedTcc) {
        const errorMsg = `TCC not found for jobId: ${jobId}`;
        console.error('🎯 StateDesign: ❌ CRITICAL ERROR - TCC not found:', errorMsg);
        throw new Error(errorMsg);
      }
      tcc = loadedTcc;
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
      functionNames: tcc.functionSignatures?.map((f: DefinedFunctionSignature) => f.name) || [],
      hasDefinedFunctionSignatures: !!tcc.definedFunctionSignatures?.length,
      definedFunctionSignatureCount: tcc.definedFunctionSignatures?.length || 0,
      definedFunctionNames: tcc.definedFunctionSignatures?.map((f: DefinedFunctionSignature) => f.name) || [],
      
    });

    // Enhanced testing mode logic
    const shouldStreamWebSocket = !mockTcc || testingOptions?.enableWebSocketStreaming;
    const shouldUpdateTcc = !mockTcc || testingOptions?.enableTccOperations;
    const shouldTriggerOrchestration = !mockTcc || testingOptions?.enableOrchestrationTriggers;
    
    // Progress update 1: TCC data loaded and validated
    if (shouldStreamWebSocket) {
      console.log('🎯 StateDesign: Emitting WebSocket progress - TCC LOADED...');
      const functionCount = tcc.definedFunctionSignatures?.length || tcc.functionSignatures?.length || 0;
      await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_state_logic, 'initiated', `TCC loaded with ${functionCount} function signatures to implement`);
      console.log('🎯 StateDesign: ✅ WebSocket progress emitted - TCC LOADED');
    } else {
      console.log('🎯 StateDesign: 🧪 TESTING MODE - Skipping TCC loaded progress emission');
    }

    logger.info({ 
      jobId, 
      selectedModel: selectedModel || 'default',
      isMockMode: !!mockTcc,
      testingOptions: testingOptions || 'none'
    }, '🎯 StateDesign: Starting');
    
    if (shouldStreamWebSocket) {
      console.log('🎯 StateDesign: Emitting WebSocket progress - STARTED...');
      await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_state_logic, 'started', 'Designing React state logic...');
      console.log('🎯 StateDesign: ✅ WebSocket progress emitted - STARTED');
    } else {
      console.log('🎯 StateDesign: 🧪 TESTING MODE - Skipping WebSocket progress emission');
    }

    if (shouldUpdateTcc) {
      // Update TCC status
      console.log('🎯 StateDesign: Updating TCC status to IN_PROGRESS...');
      const tccInProgress = { ...tcc, status: OrchestrationStatusEnum.enum.in_progress, updatedAt: new Date().toISOString() };
      await saveTCC(tccInProgress);
      console.log('🎯 StateDesign: ✅ TCC status updated to IN_PROGRESS');
    } else {
      console.log('🎯 StateDesign: 🧪 TESTING MODE - Skipping TCC status updates');
    }

    // Progress update 2: About to call AI for state logic generation
    console.log('🎯 StateDesign: DEBUG - shouldStreamWebSocket value:', shouldStreamWebSocket, 'testingOptions:', testingOptions);
    if (shouldStreamWebSocket) {
      console.log('🎯 StateDesign: Emitting WebSocket progress - AI GENERATION STARTING...');
      await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_state_logic, 'llm_call_pending', 'Calling AI to generate React state variables and functions...');
      console.log('🎯 StateDesign: ✅ WebSocket progress emitted - AI GENERATION STARTING');
    } else {
      console.log('🎯 StateDesign: 🧪 TESTING MODE - Skipping AI generation starting progress emission');
    }

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

    // Progress update 3: AI generation completed, now processing data
    console.log('🎯 StateDesign: DEBUG - shouldStreamWebSocket for AI completed:', shouldStreamWebSocket);
    if (shouldStreamWebSocket) {
      console.log('🎯 StateDesign: Emitting WebSocket progress - AI GENERATION COMPLETED...');
      await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_state_logic, 'llm_data_received', `Generated ${stateLogic.stateVariables.length} state variables and ${stateLogic.functions.length} functions`);
      console.log('🎯 StateDesign: ✅ WebSocket progress emitted - AI GENERATION COMPLETED');
    } else {
      console.log('🎯 StateDesign: 🧪 TESTING MODE - Skipping AI generation completed progress emission');
    }

    // Convert to TCC-compatible format
    console.log('🎯 StateDesign: Converting state logic to TCC-compatible format...');
    
    const tccCompatibleStateLogic = {
      variables: stateLogic.stateVariables.map((v: StateVariable): TccStateVariable => ({
        name: v.name,
        type: v.type,
        initialValue: v.initialValue,
        description: v.description,
      })),
      functions: stateLogic.functions.map((f: StateFunction): TccStateFunction => ({
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
      variableNames: tccCompatibleStateLogic.variables?.map((v: TccStateVariable) => v.name) || [],
      functionNames: tccCompatibleStateLogic.functions?.map((f: TccStateFunction) => f.name) || []
    });

    if (shouldUpdateTcc) {
      // COMPREHENSIVE LOGGING: TCC State BEFORE State Design update
      logger.info({ 
        jobId,
        beforeStateDesignUpdate: {
          currentOrchestrationStep: tcc.currentOrchestrationStep,
          status: tcc.status,
          hasFunctionSignatures: !!tcc.definedFunctionSignatures,
          functionSignatureCount: tcc.definedFunctionSignatures?.length || 0,
          hasStateLogic: !!tcc.stateLogic,
          hasJsxLayout: !!tcc.jsxLayout,
          existingStateVariableCount: tcc.stateLogic?.variables?.length || 0,
          updatedAt: tcc.updatedAt
        }
      }, '🎯 StateDesign: TCC state BEFORE State Design update');

      // Update TCC with results using updateTCC to avoid race conditions
      console.log('🎯 StateDesign: About to update TCC with stateLogic using updateTCC...');
      const updateData = {
        stateLogic: tccCompatibleStateLogic,
        currentOrchestrationStep: tcc.currentOrchestrationStep, // Preserve orchestration step
        steps: {
          ...tcc.steps,
          designingStateLogic: {
            status: OrchestrationStatusEnum.enum.completed,
            startedAt: tcc.steps?.designingStateLogic?.startedAt || new Date().toISOString(),
            completedAt: new Date().toISOString(),
            result: stateLogic
          }
        }
      };

      // COMPREHENSIVE LOGGING: What we're about to update
      logger.info({ 
        jobId,
        updateData: {
          preservedOrchestrationStep: updateData.currentOrchestrationStep,
          newStateVariableCount: updateData.stateLogic.variables?.length || 0,
          newFunctionCount: updateData.stateLogic.functions?.length || 0,
          stateVariableNames: updateData.stateLogic.variables?.map(v => v.name) || [],
          functionNames: updateData.stateLogic.functions?.map(f => f.name) || [],
          stepStatus: updateData.steps.designingStateLogic.status
        }
      }, '🎯 StateDesign: Update data being applied to TCC');

      await updateTCC(jobId, updateData);

      // COMPREHENSIVE LOGGING: Verify TCC state after update
      const updatedTCC = await getTCC(jobId);
      logger.info({ 
        jobId,
        afterStateDesignUpdate: {
          currentOrchestrationStep: updatedTCC?.currentOrchestrationStep,
          status: updatedTCC?.status,
          hasStateLogic: !!updatedTCC?.stateLogic,
          stateVariableCount: updatedTCC?.stateLogic?.variables?.length || 0,
          hasJsxLayout: !!updatedTCC?.jsxLayout,
          updatedAt: updatedTCC?.updatedAt,
          orchestrationStepPreserved: updatedTCC?.currentOrchestrationStep === tcc.currentOrchestrationStep
        }
      }, '🎯 StateDesign: TCC state AFTER State Design update (verified from DB)');

      console.log('🎯 StateDesign: ✅ TCC updated successfully with stateLogic data');
      
      // CRITICAL: Small delay to ensure filesystem sync before parallel completion check
      console.log('🎯 StateDesign: Waiting for filesystem sync...');
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('🎯 StateDesign: ✅ Filesystem sync delay completed');
    } else {
      console.log('🎯 StateDesign: 🧪 TESTING MODE - Skipping TCC updates');
    }

    if (shouldStreamWebSocket) {
      console.log('🎯 StateDesign: Emitting WebSocket progress - COMPLETED...');
      await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_state_logic, 'completed', `Generated ${stateLogic.stateVariables.length} state variables and ${stateLogic.functions.length} functions`);
      console.log('🎯 StateDesign: ✅ WebSocket progress emitted - COMPLETED');
    } else {
      console.log('🎯 StateDesign: 🧪 TESTING MODE - Skipping WebSocket progress completion');
    }

    // CRITICAL: Trigger the next step in the orchestration
    if (shouldTriggerOrchestration) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Filesystem sync
        await triggerNextOrchestrationStep(jobId);
    }

    logger.info({ jobId, stateVariablesGenerated: stateLogic.stateVariables.length, functionsGenerated: stateLogic.functions.length }, '🎯 StateDesign: Completed successfully');

    console.log('🎯 StateDesign: ==================== STATE LOGIC DESIGN COMPLETED SUCCESSFULLY ====================');
    console.log('🎯 StateDesign: Final result summary:', {
      success: true,
      stateVariableCount: stateLogic.stateVariables.length,
      functionCount: stateLogic.functions.length,
      variableNames: stateLogic.stateVariables.map((v: StateVariable) => v.name),
      functionNames: stateLogic.functions.map((f: StateFunction) => f.name)
    });

    return { success: true, stateLogic };

  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, '🎯 StateDesign: Error');
    await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_state_logic, 'failed', `State design failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

async function triggerNextOrchestrationStep(jobId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  try {
    logger.info({ jobId, baseUrl }, '🎯 StateDesign: Triggering next orchestration step...');
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    if (!response.ok) {
      throw new Error(`Orchestrator responded with status ${response.status}`);
    }
    logger.info({ jobId }, '🎯 StateDesign: Successfully triggered next orchestration step.');
  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? { message: error.message } : String(error) }, '🎯 StateDesign: Failed to trigger next orchestration step.');
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