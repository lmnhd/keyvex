import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  Styling as TccStyling,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import {
  getPrimaryModel,
  getModelProvider,
} from '@/lib/ai/models/model-config';
import { getTailwindStylingSystemPrompt } from '@/lib/prompts/v2/tailwind-styling-prompt';
import logger from '@/lib/logger';
import { filterBrainstormForTailwindStyling, generateFilteredBrainstormContext } from '@/lib/utils/brainstorm-filter';

// Authoritative Zod Schema - matches TCC styling schema
const stylingSchema = z.object({
  styledComponentCode: z.string().describe('The complete, styled JSX code with all Tailwind classes applied.'),
  styleMap: z.record(z.string(), z.string()).describe('A map of element IDs to their corresponding Tailwind classes string.'),
  colorScheme: z.object({
    primary: z.string().describe('Primary color for main actions. E.g., "bg-blue-500"'),
    secondary: z.string().describe('Secondary color for accents. E.g., "bg-gray-200"'),
    accent: z.string().describe('Accent color for highlights. E.g., "bg-indigo-600"'),
    background: z.string().describe('Main background color. E.g., "bg-gray-50"'),
    surface: z.string().describe('Color for card backgrounds or surfaces. E.g., "bg-white"'),
    text: z.object({
      primary: z.string().describe('Primary text color. E.g., "text-gray-900"'),
      secondary: z.string().describe('Secondary text color. E.g., "text-gray-600"'),
      muted: z.string().describe('Muted text color. E.g., "text-gray-400"'),
    }),
    border: z.string().describe('Default border color. E.g., "border-gray-200"'),
    success: z.string().describe('Color for success states. E.g., "bg-green-500"'),
    warning: z.string().describe('Color for warning states. E.g., "bg-yellow-500"'),
    error: z.string().describe('Color for error states. E.g., "bg-red-500"'),
  }),
  designTokens: z.object({
    spacing: z.record(z.string(), z.string()).describe('Tokens for margins and padding. E.g., {"sm": "p-2", "md": "p-4"}'),
    typography: z.record(z.string(), z.string()).describe('Tokens for font sizes and weights. E.g., {"heading": "text-2xl font-bold"}'),
    shadows: z.record(z.string(), z.string()).describe('Tokens for box shadows. E.g., {"md": "shadow-md"}'),
    animations: z.record(z.string(), z.string()).describe('Tokens for transitions. E.g., {"subtle": "transition-colors duration-200"}'),
  }),
});

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
export interface TailwindStylingRequest {
  jobId: string;
  selectedModel?: string;
  tcc: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
  isEditMode?: boolean;
  editInstructions?: string;
}

export interface TailwindStylingResult {
  success: boolean;
  styling?: TccStyling;
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
 * Tailwind Styling Module - Extracted core logic for unified agent system
 * Applies Tailwind CSS styling to JSX components
 */
export async function executeTailwindStyling(request: TailwindStylingRequest): Promise<TailwindStylingResult> {
  const { jobId, selectedModel, tcc, isIsolatedTest = false, editMode } = request;
  
  // Edit mode detection (support both legacy and simple modes)
  const isEditMode = request.isEditMode || editMode?.isEditMode || false;
  const editInstructions = request.editInstructions || (editMode?.instructions ? editMode.instructions.map(i => i.instructions).join('\n') : undefined);

  logger.info({ jobId, isIsolatedTest }, '🎨 TailwindStyling Module: Starting styling application');

  // Debug: Log TCC structure right at the start
  logger.info({
    jobId,
    tccPresent: !!tcc,
    tccUserId: tcc?.userId,
    tccJobId: tcc?.jobId,
    tccKeys: tcc ? Object.keys(tcc).slice(0, 10) : [], // First 10 keys to avoid too much log spam
    requestKeys: Object.keys(request)
  }, '🎨 TailwindStyling Module: [DEBUG] TCC structure at entry');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Emit progress for orchestration mode
    if (!isIsolatedTest) {
      logger.info({
        jobId,
        aboutToEmitProgress: true,
        tccUserId: tcc?.userId
      }, '🎨 TailwindStyling Module: [DEBUG] About to emit in_progress');

      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.applying_tailwind_styling,
        'in_progress',
        'Applying Tailwind CSS styling...',
        tcc
      );

      logger.info({ jobId }, '🎨 TailwindStyling Module: [DEBUG] in_progress emitted successfully');
    }

    const styling = await generateTailwindStylingWithAI(tcc, selectedModel, isIsolatedTest, editMode, isEditMode, editInstructions);

    // Comprehensive TCC update logging
    logger.info({
      jobId,
      agentName: 'TailwindStyling',
      tccUpdateDetail: {
        beforeStyling: !!tcc.styling,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🎨 TailwindStyling Module: TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      styling,
      currentOrchestrationStep: OrchestrationStepEnum.enum.assembling_component,
      steps: {
        ...tcc.steps,
        applyingTailwindStyling: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt:
            tcc.steps?.applyingTailwindStyling?.startedAt ||
            new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: styling,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // Comprehensive TCC update logging - detailed output
    logger.info({
      jobId,
      agentName: 'TailwindStyling',
      tccUpdateDetail: {
        afterStyling: !!updatedTcc.styling,
        afterSteps: Object.keys(updatedTcc.steps || {}),
        afterLastUpdated: updatedTcc.updatedAt,
        stylingApplied: {
          styledComponentCodeLength: updatedTcc.styling?.styledComponentCode?.length || 0,
          styledComponentCodePreview: (updatedTcc.styling?.styledComponentCode?.substring(0, 300) || '') + ((updatedTcc.styling?.styledComponentCode?.length || 0) > 300 ? '...' : ''),
          hasColorScheme: !!updatedTcc.styling?.colorScheme,
          colorScheme: updatedTcc.styling?.colorScheme ? {
            primary: updatedTcc.styling.colorScheme.primary,
            secondary: updatedTcc.styling.colorScheme.secondary,
            accent: updatedTcc.styling.colorScheme.accent,
            background: updatedTcc.styling.colorScheme.background,
            text: updatedTcc.styling.colorScheme.text
          } : null,
          hasStyleMap: !!updatedTcc.styling?.styleMap,
          styleMapKeysCount: Object.keys(updatedTcc.styling?.styleMap || {}).length,
          hasDesignTokens: !!updatedTcc.styling?.designTokens,
          designTokensKeys: updatedTcc.styling?.designTokens ? Object.keys(updatedTcc.styling.designTokens) : []
        },
        stepStatusUpdate: updatedTcc.steps?.applyingTailwindStyling?.status,
        stepResult: !!updatedTcc.steps?.applyingTailwindStyling?.result,
        orchestrationStepUpdated: updatedTcc.currentOrchestrationStep
      }
    }, '🎨 TailwindStyling Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.applying_tailwind_styling,
        'completed',
        `Successfully applied Tailwind styling with ${Object.keys(styling.styleMap || {}).length} styled elements.`,
        updatedTcc
      );
    }

    return { success: true, styling, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🎨 TailwindStyling Module: Error');
    
    // Emit failure progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.applying_tailwind_styling,
      'failed',
      errorMessage,
      tcc
    );
    
    return { success: false, error: errorMessage, updatedTcc: tcc };
  }
}

async function generateTailwindStylingWithAI(
  tcc: ToolConstructionContext,
  selectedModel?: string,
  isIsolatedTest?: boolean,
  editMode?: EditModeContext,
  isEditMode?: boolean,
  editInstructions?: string,
): Promise<TccStyling> {
  let modelConfig: { provider: string; modelId: string };
  
  // PRIORITY 1: Check TCC agent model mapping first
  if (tcc.agentModelMapping?.['tailwind-styling']) {
    const mappedModel = tcc.agentModelMapping['tailwind-styling'];
    const provider = getModelProvider(mappedModel);
    modelConfig = { 
      provider: provider !== 'unknown' ? provider : 'openai', 
      modelId: mappedModel 
    };
    logger.info({ 
      agentName: 'tailwind-styling', 
      mappedModel, 
      provider: modelConfig.provider,
      source: 'TCC_AGENT_MAPPING' 
    }, '🎨 TailwindStyling Module: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = { provider: provider !== 'unknown' ? provider : 'openai', modelId: selectedModel };
    logger.info({ 
      selectedModel, 
      provider: modelConfig.provider,
      source: 'REQUEST_PARAMETER' 
    }, '🎨 TailwindStyling Module: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('tailwindStylist');
    modelConfig = primaryModel && 'modelInfo' in primaryModel ? { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } : { provider: 'openai', modelId: 'gpt-4o' };
    logger.info({ 
      modelConfig,
      source: 'CONFIGURATION_FALLBACK' 
    }, '🎨 TailwindStyling Module: Using CONFIGURATION FALLBACK model');
  }

  logger.info({ ...modelConfig }, '🎨 TailwindStyling Module: Using model');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = getTailwindStylingSystemPrompt(false);
  const userPrompt = createUserPrompt(tcc, editMode, isEditMode, editInstructions);

  // Isolation test logging
  logger.info({
    jobId: tcc.jobId,
    modelId: modelConfig.modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    brainstormDataPresent: !!tcc.brainstormData,
    jsxLayoutPresent: !!tcc.jsxLayout,
    stateLogicPresent: !!tcc.stateLogic
  }, '🎨 TailwindStyling Module: ISOLATION DEBUG - Input data analysis');

  try {
    const { object: styling } = await generateObject({
      model: modelInstance,
      schema: stylingSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.3,
      maxTokens: 4000,
    });

    logger.info({ 
      jobId: tcc.jobId, 
      modelId: modelConfig.modelId,
      styledComponentCodeLength: styling.styledComponentCode?.length || 0,
      styleMapKeysCount: Object.keys(styling.styleMap || {}).length,
      aiResponseReceived: true
    }, '🎨 TailwindStyling Module: Successfully received structured object from AI');

    return styling;
  } catch (error) {
    logger.error({ error }, '🎨 TailwindStyling Module: AI call failed. Generating fallback.');
    return generateFallbackStyling(tcc.jsxLayout);
  }
}

function generateFallbackStyling(jsxLayout?: ToolConstructionContext['jsxLayout']): TccStyling {
  return {
    styledComponentCode: jsxLayout?.componentStructure || '<div className="p-4">Fallback Component</div>',
    styleMap: {
      'container': 'max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg',
      'button': 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
    },
    colorScheme: {
      primary: 'bg-blue-500',
      secondary: 'bg-gray-200',
      accent: 'bg-indigo-600',
      background: 'bg-gray-50',
      surface: 'bg-white',
      text: {
        primary: 'text-gray-900',
        secondary: 'text-gray-600',
        muted: 'text-gray-400'
      },
      border: 'border-gray-200',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500'
    },
    designTokens: {
      spacing: {
        sm: 'p-2',
        md: 'p-4',
        lg: 'p-6'
      },
      typography: {
        heading: 'text-2xl font-bold',
        body: 'text-base',
        caption: 'text-sm text-gray-600'
      },
      shadows: {
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg'
      },
      animations: {
        subtle: 'transition-colors duration-200',
        smooth: 'transition-all duration-300'
      }
    }
  };
}

function createUserPrompt(
  tcc: ToolConstructionContext, 
  editMode?: EditModeContext,
  isEditMode?: boolean,
  editInstructions?: string
): string {
  // Get Tailwind Styling specific filtered data
  const filteredBrainstormData = filterBrainstormForTailwindStyling(tcc.brainstormData, tcc.jobId);
  
  let prompt = `Apply Tailwind CSS styling to this component:

TOOL DETAILS:
- Tool Type: ${tcc.userInput?.description || 'Business Tool'}
- Target Audience: ${tcc.userInput?.targetAudience || 'Professionals'}`;

  // Add JSX layout context
  if (tcc.jsxLayout) {
    prompt += `

JSX COMPONENT STRUCTURE:
\`\`\`jsx
${tcc.jsxLayout.componentStructure}
\`\`\`

ELEMENT MAP:
${tcc.jsxLayout.elementMap?.map(el => `- ${el.elementId} (${el.type}): ${el.purpose}`).join('\n') || 'No element map'}`;
  }

  // Add state logic context for interactive styling
  if (tcc.stateLogic) {
    prompt += `

STATE VARIABLES (for interactive styling):
${tcc.stateLogic.variables?.map(v => `- ${v.name}: ${v.type}`).join('\n') || 'No state variables'}`;
  }

  // Add filtered brainstorm context when available
  if (filteredBrainstormData) {
    const brainstormContext = generateFilteredBrainstormContext(filteredBrainstormData, 'TailwindStyling');
    prompt += brainstormContext;

    logger.info({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: true,
      dataReduction: 'Applied Tailwind Styling specific filtering'
    }, '🎨 TailwindStyling Module: [FILTERED BRAINSTORM] Context successfully added to prompt');
  } else {
    logger.warn({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: false
    }, '🎨 TailwindStyling Module: [FILTERED BRAINSTORM] ⚠️ Prompt created WITHOUT brainstorm context - styling may be too generic');
  }

  // Add edit mode context if needed
  if (isEditMode && editInstructions) {
    prompt += `

🔄 EDIT MODE:
Current styling exists. Apply these modifications:
${editInstructions}

Modify the existing styling while maintaining all core functionality and design consistency.`;
  }

  prompt += `

Apply professional Tailwind CSS styling with a cohesive color scheme and design tokens.`;

  return prompt;
} 