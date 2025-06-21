import { z } from 'zod';
import {
  ToolConstructionContext,
  DefinedFunctionSignature,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import {
  getPrimaryModel,
  getFallbackModel,
  getModelProvider,
} from '@/lib/ai/models/model-config';
import { getJsxLayoutSystemPrompt, getJsxLayoutUserPrompt } from '@/lib/prompts/v2/jsx-layout-prompt';
import logger from '@/lib/logger';
import { filterBrainstormForJSXLayout, generateFilteredBrainstormContext } from '@/lib/utils/brainstorm-filter';

// Zod schema for the element map
const elementMapSchema = z.object({
  elementId: z.string().describe('The unique ID of the HTML element.'),
  type: z
    .string()
    .describe('The HTML tag type (e.g., "div", "input", "button").'),
  purpose: z.string().describe("A brief description of the element's role."),
  placeholderClasses: z
    .array(z.string())
    .describe('An array of placeholder CSS class names.'),
});

// Zod schema for the entire JSX layout result
const jsxLayoutSchema = z.object({
  componentStructure: z
    .string()
    .describe(
      'The complete JSX component structure as a single string of semantic HTML.',
    ),
  elementMap: z
    .array(elementMapSchema)
    .optional()
    .default([])
    .describe('An array of objects mapping element IDs to their details.'),
  accessibilityFeatures: z
    .array(z.string())
    .optional()
    .default(['Basic semantic HTML'])
    .describe('A list of key accessibility features implemented.'),
  responsiveBreakpoints: z
    .array(z.string())
    .optional()
    .default(['mobile', 'desktop'])
    .describe('A list of responsive breakpoints considered (e.g., "mobile").'),
});

// Type definitions for JSX layout components, inferred from Zod schemas
export type ElementMap = z.infer<typeof elementMapSchema>;
export type JsxLayoutResult = z.infer<typeof jsxLayoutSchema>;

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
export interface JSXLayoutRequest {
  jobId: string;
  selectedModel?: string;
  tcc: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
}

export interface JSXLayoutResult {
  success: boolean;
  jsxLayout?: JsxLayoutResult;
  error?: string;
  updatedTcc: ToolConstructionContext;
}

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
 * JSX Layout Module - Extracted core logic for unified agent system
 * Designs JSX component structure and layout
 */
export async function executeJSXLayout(request: JSXLayoutRequest): Promise<JSXLayoutResult> {
  const { jobId, selectedModel, tcc, isIsolatedTest = false, editMode } = request;
  
  // Edit mode detection
  const isEditMode = editMode?.isEditMode || false;
  const editInstructions = editMode?.instructions || [];

  logger.info({ 
    jobId, 
    isIsolatedTest,
    hasTcc: !!tcc,
    tccKeys: tcc ? Object.keys(tcc) : [],
    tccUserId: tcc?.userId,
    tccStatus: tcc?.status
  }, '🏗️ JSXLayout Module: Starting JSX layout design');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Additional TCC validation
    if (!tcc.jobId) {
      throw new Error(`TCC missing jobId for jobId: ${jobId}`);
    }

    if (!tcc.userId) {
      logger.warn({ 
        jobId, 
        tccKeys: Object.keys(tcc),
        tccJobId: tcc.jobId 
      }, '🏗️ JSXLayout Module: WARNING - TCC missing userId, this will cause WebSocket emission to fail');
    }

    // Emit progress for orchestration mode
    if (!isIsolatedTest) {
      logger.info({ jobId }, '🏗️ JSXLayout Module: About to emit progress...');
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.designing_jsx_layout,
        'in_progress',
        'Designing JSX component structure...',
        tcc
      );
      logger.info({ jobId }, '🏗️ JSXLayout Module: Progress emitted successfully');
    }

    logger.info({ 
      jobId, 
      isEditMode, 
      editInstructionsCount: editInstructions.length 
    }, '🏗️ JSXLayout Module: About to call generateJsxLayoutWithAI...');
    
    const jsxLayout = await generateJsxLayoutWithAI(tcc, selectedModel, isIsolatedTest, editMode);
    logger.info({ jobId }, '🏗️ JSXLayout Module: generateJsxLayoutWithAI completed successfully');

    // Comprehensive TCC update logging
    logger.info({
      jobId,
      agentName: 'JSXLayout',
      tccUpdateDetail: {
        beforeJsxLayout: !!tcc.jsxLayout,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🏗️ JSXLayout Module: TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      jsxLayout,
      steps: {
        ...tcc.steps,
        designingJsxLayout: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt:
            tcc.steps?.designingJsxLayout?.startedAt ||
            new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: jsxLayout,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // Comprehensive TCC update logging - detailed output
    logger.info({
      jobId,
      agentName: 'JSXLayout',
      tccUpdateDetail: {
        afterJsxLayout: !!updatedTcc.jsxLayout,
        afterSteps: Object.keys(updatedTcc.steps || {}),
        afterLastUpdated: updatedTcc.updatedAt,
        componentStructureLength: updatedTcc.jsxLayout?.componentStructure?.length || 0,
        elementMapCount: updatedTcc.jsxLayout?.elementMap?.length || 0,
        accessibilityFeaturesCount: updatedTcc.jsxLayout?.accessibilityFeatures?.length || 0,
        responsiveBreakpointsCount: updatedTcc.jsxLayout?.responsiveBreakpoints?.length || 0,
        stepStatusUpdate: updatedTcc.steps?.designingJsxLayout?.status,
        stepResult: !!updatedTcc.steps?.designingJsxLayout?.result
      }
    }, '🏗️ JSXLayout Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.designing_jsx_layout,
        'completed',
        `Successfully designed JSX layout with ${jsxLayout.elementMap?.length || 0} elements and ${jsxLayout.accessibilityFeatures?.length || 0} accessibility features.`,
        updatedTcc
      );
    }

    return { success: true, jsxLayout, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🏗️ JSXLayout Module: Error');
    
    // Emit failure progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_jsx_layout,
      'failed',
      errorMessage,
      tcc
    );
    
    return { success: false, error: errorMessage, updatedTcc: tcc };
  }
}

async function generateJsxLayoutWithAI(
  tcc: ToolConstructionContext,
  selectedModel?: string,
  isIsolatedTest?: boolean,
  editMode?: EditModeContext,
): Promise<JsxLayoutResult> {
  let modelConfig: { provider: string; modelId: string };
  
  // PRIORITY 1: Check TCC agent model mapping first
  if (tcc.agentModelMapping?.['jsx-layout']) {
    const mappedModel = tcc.agentModelMapping['jsx-layout'];
    const provider = getModelProvider(mappedModel);
    modelConfig = { 
      provider: provider !== 'unknown' ? provider : 'openai', 
      modelId: mappedModel 
    };
    logger.info({ 
      agentName: 'jsx-layout', 
      mappedModel, 
      provider: modelConfig.provider,
      source: 'TCC_AGENT_MAPPING' 
    }, '🏗️ JSXLayout Module: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = { provider: provider !== 'unknown' ? provider : 'openai', modelId: selectedModel };
    logger.info({ 
      selectedModel, 
      provider: modelConfig.provider,
      source: 'REQUEST_PARAMETER' 
    }, '🏗️ JSXLayout Module: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('jsxLayoutDesigner');
    modelConfig = primaryModel && 'modelInfo' in primaryModel ? { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } : { provider: 'openai', modelId: 'gpt-4o' };
    logger.info({ 
      modelConfig,
      source: 'CONFIGURATION_FALLBACK' 
    }, '🏗️ JSXLayout Module: Using CONFIGURATION FALLBACK model');
  }

  logger.info({ ...modelConfig }, '🏗️ JSXLayout Module: Using model');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = getJsxLayoutSystemPrompt(false);
  const userPrompt = getJsxLayoutUserPrompt(tcc, editMode);

  // Isolation test logging
  logger.info({
    jobId: tcc.jobId,
    modelId: modelConfig.modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    brainstormDataPresent: !!tcc.brainstormData,
    stateLogicPresent: !!tcc.stateLogic,
    functionSignaturesCount: tcc.definedFunctionSignatures?.length || 0
  }, '🏗️ JSXLayout Module: ISOLATION DEBUG - Input data analysis');

  try {
    const { object: jsxLayout } = await generateObject({
      model: modelInstance,
      schema: jsxLayoutSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.3,
      maxTokens: 4000,
    });

    logger.info({ 
      jobId: tcc.jobId, 
      modelId: modelConfig.modelId,
      componentStructureLength: jsxLayout.componentStructure?.length || 0,
      elementMapCount: jsxLayout.elementMap?.length || 0,
      aiResponseReceived: true
    }, '🏗️ JSXLayout Module: Successfully received structured object from AI');

    return jsxLayout;
  } catch (error) {
    logger.error({ error }, '🏗️ JSXLayout Module: AI call failed. Generating fallback.');
    return generateFallbackJsxLayout(tcc);
  }
}

function generateFallbackJsxLayout(tcc: ToolConstructionContext): JsxLayoutResult {
  const functionSignatures = tcc.definedFunctionSignatures || [];
  
  return {
    componentStructure: `
      <div className="container">
        <h1>Business Tool</h1>
        <form>
          <input type="text" placeholder="Enter value" />
          <button type="submit">Calculate</button>
        </form>
        <div className="results">
          <p>Results will appear here</p>
        </div>
      </div>
    `,
    elementMap: [
      {
        elementId: 'container',
        type: 'div',
        purpose: 'Main container',
        placeholderClasses: ['container', 'mx-auto', 'p-4']
      },
      {
        elementId: 'submit-button',
        type: 'button',
        purpose: 'Submit form',
        placeholderClasses: ['btn', 'btn-primary']
      }
    ],
    accessibilityFeatures: ['Basic semantic HTML', 'Form labels'],
    responsiveBreakpoints: ['mobile', 'desktop']
  };
}

 