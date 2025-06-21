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
import { getStateDesignSystemPrompt } from '@/lib/prompts/v2/state-design-prompt';
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

  logger.info({ jobId }, ' StateDesign Module: Starting state logic design');

  try {
    if (!tcc) {
      throw new Error(A valid TCC object was not provided for jobId: );
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

    logger.info({ jobId }, ' StateDesign Module: Calling AI to generate state logic...');
    const stateLogic = await generateStateLogic(tcc, selectedModel, editMode, isEditMode, editInstructions);
    logger.info({ jobId }, ' StateDesign Module: AI generated state logic successfully');

    // Comprehensive TCC update logging
    logger.info({
      jobId,
      agentName: 'StateDesign',
      tccUpdateDetail: {
        beforeStateLogic: !!tcc.stateLogic,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, ' StateDesign Module: TCC STATE BEFORE UPDATE');

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
    }, ' StateDesign Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    logger.info({
      jobId,
      updateData: {
        stateVariableCount: updatedTcc.stateLogic?.variables?.length,
        functionCount: updatedTcc.stateLogic?.functions?.length,
      },
    }, ' StateDesign Module: TCC update prepared');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.designing_state_logic,
        'completed',
        Successfully designed  state variables and  functions.,
        updatedTcc
      );
    }

    return { success: true, stateLogic, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, ' StateDesign Module: Error');
    
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
