import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  DefinedFunctionSignature,
  // ✅ FIXED: Use ACTUAL TCC schemas - NO custom types!
  StateLogic,
  StateLogicSchema,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import {
  getPrimaryModel,
  getModelProvider,
} from '@/lib/ai/models/model-config';
import { getStateDesignSystemPrompt } from '@/lib/prompts/v2/state-design-prompt';
import logger from '@/lib/logger';
import { filterBrainstormForStateDesign } from '@/lib/utils/brainstorm-filter';

// ✅ FIXED: Use TCC schema directly - NO custom schemas!
const StateDesignOutputSchema = StateLogicSchema;
export type StateDesignOutput = StateLogic;

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

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

export async function designStateLogic(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
  editMode?: EditModeContext;
  isEditMode?: boolean;
  editInstructions?: string;
}): Promise<{
  success: boolean;
  stateLogic?: StateLogic;
  error?: string;
  updatedTcc?: ToolConstructionContext;
}> {
  const { jobId, selectedModel, editMode } = request;
  const tcc = request.mockTcc || request.tcc;
  
  // Phase 2: Edit mode detection
  const isEditMode = request.isEditMode || editMode?.isEditMode || false;
  const editInstructions = request.editInstructions || (editMode?.instructions ? editMode.instructions.map(i => i.instructions).join('\n') : undefined);

  logger.info({ jobId }, '🎯 StateDesign: Starting state logic design');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'in_progress',
      'Designing state logic and functions...',
      tcc
    );

    logger.info({ jobId }, '🎯 StateDesign: Calling AI to generate state logic...');
    const stateLogic = await generateStateLogic(tcc, selectedModel, editMode, isEditMode, editInstructions);
    logger.info({ jobId }, '🎯 StateDesign: AI generated state logic successfully');

    // ✅ COMPREHENSIVE TCC UPDATE LOGGING 📋
    logger.info({
      jobId,
      agentName: 'StateDesign',
      tccUpdateDetail: {
        beforeStateLogic: !!tcc.stateLogic,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🎯 StateDesign: 📋 TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      stateLogic, // ✅ FIXED: Direct assignment - no conversion needed!
      steps: {
        ...tcc.steps,
        designingStateLogic: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tcc.steps?.designingStateLogic?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: stateLogic,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // ✅ COMPREHENSIVE TCC UPDATE LOGGING 📋 - DETAILED OUTPUT
    logger.info({
      jobId,
      agentName: 'StateDesign',
      tccUpdateDetail: {
        afterStateLogic: !!updatedTcc.stateLogic,
        afterSteps: Object.keys(updatedTcc.steps || {}),
        afterLastUpdated: updatedTcc.updatedAt,
        stateVariablesCreated: updatedTcc.stateLogic?.variables?.map(v => ({
          name: v.name,
          type: v.type || 'unknown',
          initialValue: v.initialValue,
          description: (v.description?.substring(0, 100) + (v.description && v.description.length > 100 ? '...' : '')) || 'No description'
        })) || [],
        functionsCreated: updatedTcc.stateLogic?.functions?.map(f => ({
          name: f.name,
          dependencies: f.dependencies || [],
          description: (f.description?.substring(0, 100) + (f.description && f.description.length > 100 ? '...' : '')) || 'No description',
          bodyLength: f.body?.length || 0,
          bodyPreview: f.body?.substring(0, 200) + (f.body?.length > 200 ? '...' : '') || ''
        })) || [],
        importsCreated: updatedTcc.stateLogic?.imports || [],
        stepStatusUpdate: updatedTcc.steps?.designingStateLogic?.status,
        stepResult: !!updatedTcc.steps?.designingStateLogic?.result
      }
    }, '🎯 StateDesign: 📋 TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    logger.info({
      jobId,
      updateData: {
        stateVariableCount: updatedTcc.stateLogic?.variables?.length,
        functionCount: updatedTcc.stateLogic?.functions?.length,
      },
    }, '🎯 StateDesign: TCC update prepared');

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'completed',
      `Successfully designed ${updatedTcc.stateLogic?.variables?.length || 0} state variables and ${updatedTcc.stateLogic?.functions?.length || 0} functions.`,
      updatedTcc
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
      tcc
    );
    
    return { success: false, error: errorMessage };
  }
}

async function generateStateLogic(
  tcc: ToolConstructionContext,
  selectedModel?: string,
  editMode?: EditModeContext,
  isEditMode?: boolean,
  editInstructions?: string,
): Promise<StateLogic> {
  let modelConfig: { provider: string; modelId: string };
  
  // PRIORITY 1: Check TCC agent model mapping first
  if (tcc.agentModelMapping?.['state-design']) {
    const mappedModel = tcc.agentModelMapping['state-design'];
    const provider = getModelProvider(mappedModel);
    modelConfig = { 
      provider: provider !== 'unknown' ? provider : 'openai', 
      modelId: mappedModel 
    };
    logger.info({ 
      agentName: 'state-design', 
      mappedModel, 
      provider: modelConfig.provider,
      source: 'TCC_AGENT_MAPPING' 
    }, '🎯 StateDesign: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = { provider: provider !== 'unknown' ? provider : 'openai', modelId: selectedModel };
    logger.info({ 
      selectedModel, 
      provider: modelConfig.provider,
      source: 'REQUEST_PARAMETER' 
    }, '🎯 StateDesign: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('stateDesigner');
    modelConfig = primaryModel && 'modelInfo' in primaryModel ? { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } : { provider: 'openai', modelId: 'gpt-4o' };
    logger.info({ 
      modelConfig,
      source: 'CONFIGURATION_FALLBACK' 
    }, '🎯 StateDesign: Using CONFIGURATION FALLBACK model');
  }

  logger.info({ ...modelConfig }, '🎯 StateDesign: Using model');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const functionSignatures = tcc.definedFunctionSignatures || [];
  const userPrompt = getUserPrompt(tcc, functionSignatures, editMode, isEditMode, editInstructions);
  const systemPrompt = getStateDesignSystemPrompt(false);

  // 🚨 ISOLATION TEST LOGGING
  logger.info({
    jobId: tcc.jobId,
    modelId: modelConfig.modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    functionSignatureCount: functionSignatures.length,
    brainstormDataPresent: !!tcc.brainstormData,
    brainstormDataKeys: tcc.brainstormData ? Object.keys(tcc.brainstormData) : [],
    tccKeys: Object.keys(tcc)
  }, '🎯 StateDesign: 🔍 ISOLATION DEBUG - Input data analysis');

  try {
    const { object: stateLogic } = await generateObject({
      model: modelInstance,
      schema: StateDesignOutputSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.4,
      maxTokens: 4000,
    });

    logger.info({ 
      jobId: tcc.jobId, 
      modelId: modelConfig.modelId,
      variableCount: stateLogic.variables?.length || 0,
      functionCount: stateLogic.functions?.length || 0,
      aiResponseReceived: true
    }, '🎯 StateDesign: ✅ Successfully received structured object from AI');

    return stateLogic;
  } catch (error) {
    logger.error({ error }, '🎯 StateDesign: AI call failed. Generating fallback.');
    return generateFallbackStateLogic(tcc, functionSignatures);
  }
}

function generateFallbackStateLogic(tcc: ToolConstructionContext, functionSignatures: DefinedFunctionSignature[]): StateLogic {
  return {
    variables: [
      {
        name: 'isLoading',
        type: 'boolean',
        initialValue: false,
        description: 'Loading state for the application'
      }
    ],
    functions: [
      {
        name: 'handleSubmit',
        body: 'console.log("Submit clicked");',
        description: 'Handle form submission',
        dependencies: []
      }
    ],
    imports: ["import React, { useState } from 'react';"],
  };
}

function getUserPrompt(
  tcc: ToolConstructionContext, 
  functionSignatures: DefinedFunctionSignature[], 
  editMode?: EditModeContext,
  isEditMode?: boolean,
  editInstructions?: string
): string {
  // 🎯 FILTERED BRAINSTORM DATA: Only get State Design specific data
  const brainstormData = filterBrainstormForStateDesign(tcc.brainstormData, tcc.jobId);
  
  // 🚨 CRITICAL FIX: Handle null brainstorm data from filter
  if (!brainstormData) {
    logger.warn({ jobId: tcc.jobId }, '🎯 StateDesign: ⚠️ Brainstorm filter returned null, using original brainstorm data');
    // Fallback to original brainstorm data if filter returns null
    const fallbackData = tcc.brainstormData as any || {};
    
    return `Generate React state logic for this tool:

TOOL DETAILS:
- Tool Type: ${fallbackData.toolType || tcc.userInput?.description || 'Business Tool'}
- Target Audience: ${tcc.targetAudience || 'Professionals'}
- Description: ${tcc.userInput?.description || 'A business calculation tool'}

FUNCTION SIGNATURES TO IMPLEMENT:
${functionSignatures.map(sig => `- ${sig.name}: ${sig.description || 'No description provided'}`).join('\n') || 'No specific functions defined'}

Generate the complete state logic with variables and functions that match the StateLogic schema exactly.`;
  }

  let prompt = `Generate React state logic for this tool:

TOOL DETAILS:
- Tool Type: ${brainstormData.toolType || tcc.userInput?.description || 'Business Tool'}
- Target Audience: ${tcc.targetAudience || 'Professionals'}
- Description: ${tcc.userInput?.description || 'A business calculation tool'}

KEY CALCULATIONS TO IMPLEMENT:
${brainstormData.keyCalculations?.map(calc => `- ${calc.name}: ${calc.formula} (${calc.description})`).join('\n') || 'No calculations defined'}

SUGGESTED INPUTS:
${brainstormData.suggestedInputs?.map(input => `- ${input.label} (${input.type}): ${input.description}`).join('\n') || 'No inputs defined'}

FUNCTION SIGNATURES TO IMPLEMENT:
${functionSignatures.map(sig => `- ${sig.name}: ${sig.description || 'No description provided'}`).join('\n') || 'No specific functions defined'}

🚨 CRITICAL REQUIREMENTS:
- Generate state variables for ALL suggested inputs
- Implement ALL keyCalculations as functions
- Use proper TypeScript types
- Include validation functions
- 🚨 FAILURE TO IMPLEMENT ANY keyCalculation = INCOMPLETE TOOL!

Generate the complete state logic matching the StateLogic schema exactly.`;

  // Add edit mode context if needed
  if (isEditMode && editInstructions) {
    prompt += `

🔄 EDIT MODE:
Current state logic exists. Apply these modifications:
${editInstructions}

Modify the existing state logic while maintaining all core functionality.`;
  }

  return prompt;
} 