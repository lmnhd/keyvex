// File Path: keyvex_app/src/lib/agents/unified/modules/tool-finalizer.ts
import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  FinalizedTool,
  FinalizedToolSchema,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import {
  getPrimaryModel,
  getModelProvider,
} from '@/lib/ai/models/model-config';
import { getToolFinalizerSystemPrompt } from '@/lib/prompts/v2/tool-finalizer-prompt';
import logger from '@/lib/logger';

// Use TCC schema directly
const ToolFinalizerOutputSchema = FinalizedToolSchema;
export type ToolFinalizerOutput = FinalizedTool;

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
  finalizedTool?: FinalizedTool;
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
        beforeFinalizedTool: !!tcc.finalizedTool,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🏁 ToolFinalizer Module: TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      finalizedTool,
      status: 'completed',
      steps: {
        ...tcc.steps,
        finalizingTool: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tcc.steps?.finalizingTool?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: finalizedTool,
        },
      },
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    // Comprehensive TCC update logging - detailed output
    logger.info({
      jobId,
      agentName: 'ToolFinalizer',
      tccUpdateDetail: {
        afterFinalizedTool: !!updatedTcc.finalizedTool,
        afterSteps: Object.keys(updatedTcc.steps || {}),
        afterLastUpdated: updatedTcc.updatedAt,
        afterStatus: updatedTcc.status,
        afterCompletedAt: updatedTcc.completedAt,
        toolDetails: {
          toolId: updatedTcc.finalizedTool?.toolId,
          toolName: updatedTcc.finalizedTool?.toolName,
          version: updatedTcc.finalizedTool?.version,
          category: updatedTcc.finalizedTool?.category,
          deploymentReady: updatedTcc.finalizedTool?.deploymentReady,
          hasDocumentation: !!updatedTcc.finalizedTool?.documentation,
          hasMetadata: !!updatedTcc.finalizedTool?.metadata
        },
        stepStatusUpdate: updatedTcc.steps?.finalizingTool?.status,
        stepResult: !!updatedTcc.steps?.finalizingTool?.result
      }
    }, '🏁 ToolFinalizer Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.finalizing_tool,
        'completed',
        `Successfully finalized ${finalizedTool.toolName} v${finalizedTool.version} - Tool is ${finalizedTool.deploymentReady ? 'ready for deployment' : 'not ready for deployment'}`,
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
): Promise<FinalizedTool> {
  let modelConfig: { provider: string; modelId: string };
  
  // PRIORITY 1: Check TCC agent model mapping first
  if (tcc.agentModelMapping?.['tool-finalizer']) {
    const mappedModel = tcc.agentModelMapping['tool-finalizer'];
    const provider = getModelProvider(mappedModel);
    modelConfig = { 
      provider: provider !== 'unknown' ? provider : 'openai', 
      modelId: mappedModel 
    };
    logger.info({ 
      agentName: 'tool-finalizer', 
      mappedModel, 
      provider: modelConfig.provider,
      source: 'TCC_AGENT_MAPPING' 
    }, '🏁 ToolFinalizer Module: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = { provider: provider !== 'unknown' ? provider : 'openai', modelId: selectedModel };
    logger.info({ 
      selectedModel, 
      provider: modelConfig.provider,
      source: 'REQUEST_PARAMETER' 
    }, '🏁 ToolFinalizer Module: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('toolFinalizer');
    modelConfig = primaryModel && 'modelInfo' in primaryModel ? { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } : { provider: 'openai', modelId: 'gpt-4o' };
    logger.info({ 
      modelConfig,
      source: 'CONFIGURATION_FALLBACK' 
    }, '🏁 ToolFinalizer Module: Using CONFIGURATION FALLBACK model');
  }

  logger.info({ ...modelConfig }, '🏁 ToolFinalizer Module: Using model');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = getToolFinalizerSystemPrompt(false);
  const userPrompt = createUserPrompt(tcc, editMode);

  // Isolation test logging
  logger.info({
    jobId: tcc.jobId,
    modelId: modelConfig.modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    assembledComponentPresent: !!tcc.assembledComponent,
    validationResultPresent: !!tcc.validationResult,
    validationPassed: tcc.validationResult?.isValid || false
  }, '🏁 ToolFinalizer Module: ISOLATION DEBUG - Input data analysis');

  try {
    const { object: finalizedTool } = await generateObject({
      model: modelInstance,
      schema: ToolFinalizerOutputSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.2,
      maxTokens: 4000,
    });

    logger.info({ 
      jobId: tcc.jobId, 
      modelId: modelConfig.modelId,
      toolId: finalizedTool.toolId,
      toolName: finalizedTool.toolName,
      deploymentReady: finalizedTool.deploymentReady,
      aiResponseReceived: true
    }, '🏁 ToolFinalizer Module: Successfully received structured object from AI');

    return finalizedTool;
  } catch (error) {
    logger.error({ error }, '🏁 ToolFinalizer Module: AI call failed. Generating fallback.');
    return generateFallbackFinalizedTool(tcc);
  }
}

function generateFallbackFinalizedTool(tcc: ToolConstructionContext): FinalizedTool {
  const toolName = tcc.assembledComponent?.componentName || 'BusinessTool';
  const isValid = tcc.validationResult?.isValid || false;
  
  return {
    toolId: `tool-${Date.now()}`,
    toolName,
    version: '1.0.0',
    category: 'business',
    description: tcc.userInput?.description || 'A business calculation tool',
    finalComponentCode: tcc.assembledComponent?.finalComponentCode || '',
    deploymentReady: isValid,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'AI Tool Generator',
      tags: ['business', 'calculator', 'tool'],
      complexity: 'medium',
      estimatedUsageTime: '2-5 minutes'
    },
    documentation: {
      userGuide: `# ${toolName} User Guide\n\nThis tool helps with business calculations.\n\n## How to Use\n1. Enter your values\n2. Click calculate\n3. Review results`,
      technicalSpecs: `# Technical Specifications\n\n- Framework: React\n- Language: TypeScript\n- Styling: Tailwind CSS\n- Estimated Lines: ${tcc.assembledComponent?.estimatedLines || 0}`,
      apiReference: '# API Reference\n\nThis tool is self-contained and does not expose external APIs.'
    },
    deploymentConfig: {
      environment: 'production',
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      dependencies: ['react', 'typescript', 'tailwindcss'],
      environmentVariables: {},
      healthCheckEndpoint: '/health'
    }
  };
}

function createUserPrompt(tcc: ToolConstructionContext, editMode?: EditModeContext): string {
  let prompt = `Finalize this tool with comprehensive metadata and deployment configuration:

TOOL OVERVIEW:
- Description: ${tcc.userInput?.description || 'Business Tool'}
- Target Audience: ${tcc.userInput?.targetAudience || 'Professionals'}
- Job ID: ${tcc.jobId}`;

  // Add component information
  if (tcc.assembledComponent) {
    prompt += `

COMPONENT DETAILS:
- Name: ${tcc.assembledComponent.componentName}
- Code Length: ${tcc.assembledComponent.finalComponentCode?.length || 0} characters
- Hooks Used: ${tcc.assembledComponent.hooks?.join(', ') || 'None'}
- Functions: ${tcc.assembledComponent.functions?.join(', ') || 'None'}
- Estimated Lines: ${tcc.assembledComponent.estimatedLines || 0}`;
  }

  // Add validation results
  if (tcc.validationResult) {
    prompt += `

VALIDATION RESULTS:
- Valid: ${tcc.validationResult.isValid ? 'Yes' : 'No'}
- Errors: ${tcc.validationResult.errors?.length || 0}
- Warnings: ${tcc.validationResult.warnings?.length || 0}
- Quality Score: ${tcc.validationResult.qualityScore || 0}/100
- Readability Score: ${tcc.validationResult.readabilityScore || 0}/100`;
  }

  // Add brainstorm context for categorization
  if (tcc.brainstormData) {
    const brainstormData = tcc.brainstormData as any;
    prompt += `

TOOL CONTEXT:
- Tool Type: ${brainstormData.toolType || 'Unknown'}
- Key Calculations: ${brainstormData.keyCalculations?.map((calc: any) => calc.name).join(', ') || 'None'}
- Target Industry: ${brainstormData.targetIndustry || 'General'}`;
  }

  // Add edit mode context if needed
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    prompt += `

🔄 EDIT MODE FINALIZATION:
Recent modifications were made. Update metadata to reflect:
${editMode.instructions.map(i => i.instructions).join('\n')}`;
  }

  prompt += `

Generate comprehensive tool finalization including:
- Unique tool ID and versioning
- Proper categorization and metadata
- Complete documentation (user guide, technical specs, API reference)
- Production-ready deployment configuration
- Deployment readiness assessment based on validation results

Ensure the tool is properly packaged for production deployment.`;

  return prompt;
} 