// File Path: keyvex_app/src/lib/agents/unified/modules/state-design.ts
import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  DefinedFunctionSignature,
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
import { getStateDesignSystemPrompt, getStateDesignUserPrompt } from '@/lib/prompts/v2/state-design-prompt';
import logger from '@/lib/logger';
import { filterBrainstormForStateDesign } from '@/lib/utils/brainstorm-filter';

// Use TCC schema directly
const StateDesignOutputSchema = StateLogicSchema;
export type StateDesignOutput = StateLogic;

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

// Module interface for the unified agent system
export interface StateDesignRequest {
  jobId: string;
  selectedModel?: string;
  tcc: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
  isEditMode?: boolean;
  editInstructions?: string;
}

export interface StateDesignResult {
  success: boolean;
  stateLogic?: StateLogic;
  error?: string;
  updatedTcc: ToolConstructionContext;
}

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

/**
 * State Design Module - Extracted core logic for unified agent system
 * Designs state logic and functions for component interactivity
 */
export async function executeStateDesign(request: StateDesignRequest): Promise<StateDesignResult> {
  const { jobId, selectedModel, tcc, isIsolatedTest = false, editMode } = request;
  
  // Edit mode detection
  const isEditMode = request.isEditMode || editMode?.isEditMode || false;
  const editInstructions = request.editInstructions || (editMode?.instructions ? editMode.instructions.map(i => i.instructions).join('\n') : undefined);

  logger.info({ jobId }, '🎯 StateDesign Module: Starting state logic design');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Emit progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.designing_state_logic,
        'in_progress',
        'Designing state logic and functions...',
        tcc
      );
    }

    logger.info({ jobId }, '🎯 StateDesign Module: Calling AI to generate state logic...');
    const stateLogic = await generateStateLogic(tcc, selectedModel, editMode, isEditMode, editInstructions);
    logger.info({ jobId }, '🎯 StateDesign Module: AI generated state logic successfully');

    // Comprehensive TCC update logging
    logger.info({
      jobId,
      agentName: 'StateDesign',
      tccUpdateDetail: {
        beforeStateLogic: !!tcc.stateLogic,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🎯 StateDesign Module: TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      stateLogic,
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

    // Comprehensive TCC update logging - detailed output
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
    }, '🎯 StateDesign Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    logger.info({
      jobId,
      updateData: {
        stateVariableCount: updatedTcc.stateLogic?.variables?.length,
        functionCount: updatedTcc.stateLogic?.functions?.length,
      },
    }, '🎯 StateDesign Module: TCC update prepared');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.designing_state_logic,
        'completed',
        `Successfully designed ${updatedTcc.stateLogic?.variables?.length || 0} state variables and ${updatedTcc.stateLogic?.functions?.length || 0} functions.`,
        updatedTcc
      );
    }

    return { success: true, stateLogic, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🎯 StateDesign Module: Error');
    
    // Emit failure progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'failed',
      errorMessage,
      tcc
    );
    
    return { success: false, error: errorMessage, updatedTcc: tcc };
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
    }, '🎯 StateDesign Module: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = { provider: provider !== 'unknown' ? provider : 'openai', modelId: selectedModel };
    logger.info({ 
      selectedModel, 
      provider: modelConfig.provider,
      source: 'REQUEST_PARAMETER' 
    }, '🎯 StateDesign Module: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('stateDesigner');
    modelConfig = primaryModel && 'modelInfo' in primaryModel ? { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } : { provider: 'openai', modelId: 'gpt-4o' };
    logger.info({ 
      modelConfig,
      source: 'CONFIGURATION_FALLBACK' 
    }, '🎯 StateDesign Module: Using CONFIGURATION FALLBACK model');
  }

  logger.info({ ...modelConfig }, '🎯 StateDesign Module: Using model');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const functionSignatures = tcc.definedFunctionSignatures || [];
  const userPrompt = getStateDesignUserPrompt(tcc, functionSignatures, editMode, isEditMode, editInstructions);
  const systemPrompt = getStateDesignSystemPrompt(false);

  // Isolation test logging
  logger.info({
    jobId: tcc.jobId,
    modelId: modelConfig.modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    functionSignatureCount: functionSignatures.length,
    brainstormDataPresent: !!tcc.brainstormData,
    brainstormDataKeys: tcc.brainstormData ? Object.keys(tcc.brainstormData) : [],
    tccKeys: Object.keys(tcc)
  }, '🎯 StateDesign Module: ISOLATION DEBUG - Input data analysis');

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
    }, '🎯 StateDesign Module: Successfully received structured object from AI');

    return stateLogic;
  } catch (error) {
    logger.error({ error }, '🎯 StateDesign Module: AI call failed. Generating fallback.');
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


