// File Path: keyvex_app/src/lib/agents/unified/modules/tool-finalizer.ts
import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  FinalProductToolDefinitionSchema,
  BrainstormData,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { callModelForObject } from '@/lib/ai/model-caller';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import { getToolFinalizerSystemPrompt, getToolFinalizerUserPrompt } from '@/lib/prompts/tool-finalizer-prompt';
import logger from '@/lib/logger';

// Use the existing schema from TCC
const ToolFinalizerOutputSchema = FinalProductToolDefinitionSchema;
export type ToolFinalizerOutput = z.infer<typeof FinalProductToolDefinitionSchema>;

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
export interface ToolFinalizerRequest {
  jobId: string;
  selectedModel?: string;
  tcc: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
}

export interface ToolFinalizerResult {
  success: boolean;
  finalizedTool?: z.infer<typeof FinalProductToolDefinitionSchema>;
  error?: string;
  updatedTcc: ToolConstructionContext;
}

/**
 * Tool Finalizer Module - Extracted core logic for unified agent system
 * Finalizes the tool with metadata, deployment configuration, and packaging
 */
export async function executeToolFinalizer(request: ToolFinalizerRequest): Promise<ToolFinalizerResult> {
  const { jobId, selectedModel, tcc, isIsolatedTest = false, editMode } = request;
  
  // Edit mode detection
  const isEditMode = editMode?.isEditMode || false;
  const editInstructions = editMode?.instructions || [];

  logger.info({ jobId, isIsolatedTest }, '🏁 ToolFinalizer Module: Starting tool finalization');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Emit progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.finalizing_tool,
        'in_progress',
        'Finalizing tool with metadata and deployment configuration...',
        tcc
      );
    }

    logger.info({ jobId }, '🏁 ToolFinalizer Module: Calling AI to finalize tool...');
    const finalizedTool = await generateFinalizedTool(tcc, selectedModel, editMode);
    logger.info({ jobId }, '🏁 ToolFinalizer Module: AI finalization completed');

    // Comprehensive TCC update logging
    logger.info({
      jobId,
      agentName: 'ToolFinalizer',
      tccUpdateDetail: {
        beforeFinalProduct: !!tcc.finalProduct,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🏁 ToolFinalizer Module: TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      finalProduct: {
        ...tcc.finalProduct,
        ...finalizedTool
      },
      status: 'completed',
      updatedAt: new Date().toISOString(),
    };

    // Comprehensive TCC update logging - detailed output
    logger.info({
      jobId,
      agentName: 'ToolFinalizer',
      tccUpdateDetail: {
        afterFinalProduct: !!updatedTcc.finalProduct,
        afterLastUpdated: updatedTcc.updatedAt,
        afterStatus: updatedTcc.status,
        toolDetails: {
          toolId: updatedTcc.finalProduct?.id,
          toolSlug: updatedTcc.finalProduct?.slug,
          toolVersion: updatedTcc.finalProduct?.version,
          toolStatus: updatedTcc.finalProduct?.status,
          hasMetadata: !!updatedTcc.finalProduct?.metadata,
          hasComponentCode: !!updatedTcc.finalProduct?.componentCode
        }
      }
    }, '🏁 ToolFinalizer Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.finalizing_tool,
        'completed',
        `Successfully finalized tool v${finalizedTool.version} - Tool is ready for deployment`,
        updatedTcc
      );
    }

    return { success: true, finalizedTool, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🏁 ToolFinalizer Module: Error');
    
    // Emit failure progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.finalizing_tool,
      'failed',
      errorMessage,
      tcc
    );
    
    return { success: false, error: errorMessage, updatedTcc: tcc };
  }
}

async function generateFinalizedTool(
  tcc: ToolConstructionContext,
  selectedModel?: string,
  editMode?: EditModeContext,
): Promise<z.infer<typeof FinalProductToolDefinitionSchema>> {
  // PRIORITY 1: Check TCC agent model mapping first
  let modelId: string;
  if (tcc.agentModelMapping?.['tool-finalizer']) {
    modelId = tcc.agentModelMapping['tool-finalizer'];
    logger.info({ 
      agentName: 'tool-finalizer', 
      mappedModel: modelId,
      source: 'TCC_AGENT_MAPPING' 
    }, '🏁 ToolFinalizer Module: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    modelId = selectedModel;
    logger.info({ 
      selectedModel: modelId,
      source: 'REQUEST_PARAMETER' 
    }, '🏁 ToolFinalizer Module: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('toolFinalizer');
    modelId = primaryModel?.modelInfo?.id || 'claude-3-7-sonnet-20250219';
    logger.info({ 
      modelId,
      source: 'CONFIGURATION_FALLBACK' 
    }, '🏁 ToolFinalizer Module: Using CONFIGURATION FALLBACK model');
  }

  const systemPrompt = getToolFinalizerSystemPrompt(false);
  const userPrompt = getToolFinalizerUserPrompt(tcc, editMode);

  // Isolation test logging
  logger.info({
    jobId: tcc.jobId,
    modelId: modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    finalProductPresent: !!tcc.finalProduct,
    validationResultPresent: !!tcc.validationResult,
    validationPassed: tcc.validationResult?.isValid || false
  }, '🏁 ToolFinalizer Module: ISOLATION DEBUG - Input data analysis');

  try {
    const { object: finalizedTool } = await callModelForObject<z.infer<typeof FinalProductToolDefinitionSchema>>(modelId, {
      schema: ToolFinalizerOutputSchema,
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      temperature: 0.2,
      maxTokens: 4000,
      maxRetries: 3
    });

    logger.info({ 
      jobId: tcc.jobId, 
      modelId: modelId,
      toolId: finalizedTool.id,
      toolSlug: finalizedTool.slug,
      toolVersion: finalizedTool.version,
      aiResponseReceived: true
    }, '🏁 ToolFinalizer Module: Successfully received structured object from AI');

    return finalizedTool;
  } catch (error) {
    logger.error({ error }, '🏁 ToolFinalizer Module: AI call failed. Generating fallback.');
    return generateFallbackFinalizedTool(tcc);
  }
}

function generateFallbackFinalizedTool(tcc: ToolConstructionContext): z.infer<typeof FinalProductToolDefinitionSchema> {
  const toolName = tcc.brainstormData?.coreConcept || 'BusinessTool';
  const timestamp = Date.now();
  
  return {
    id: `tool-${timestamp}`,
    slug: toolName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    status: 'published',
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: 'ai-generator',
    metadata: {
      type: 'business-tool',
      description: tcc.userInput?.description || 'A business calculation tool',
      targetAudience: 'business professionals',
      industry: 'general',
      features: ['calculation', 'analysis'],
      title: toolName,
      id: `tool-${timestamp}`,
      icon: { value: '📊', type: 'emoji' },
      slug: toolName.toLowerCase().replace(/\s+/g, '-'),
      shortDescription: tcc.userInput?.description || 'Business tool',
      category: 'business',
      tags: ['business', 'calculator', 'tool'],
      estimatedCompletionTime: 5,
      difficultyLevel: 'beginner'
    },
    componentSet: 'shadcn',
    componentCode: tcc.finalProduct?.componentCode || '',
    colorScheme: {
      primary: '#3b82f6',
      secondary: '#64748b',
      background: '#ffffff',
      surface: '#f8fafc',
      text: {
        primary: '#1e293b',
        secondary: '#64748b',
        muted: '#94a3b8'
      },
      border: '#e2e8f0',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444'
    },
    analytics: {
      enabled: true,
      completions: 0,
      averageTime: 0
    }
  };
}

 