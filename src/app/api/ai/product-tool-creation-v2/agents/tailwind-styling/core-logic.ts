import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  Styling as TccStyling,
} from '@/lib/types/product-tool-creation-v2/tcc';
// TCC Store operations removed - using prop-based TCC passing
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

// --- START: Authoritative Zod Schema ---
// This schema is a 1:1 mirror of the StylingSchema in tcc.ts.
// The AI will generate an object that perfectly matches the required structure.

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
// --- END: Authoritative Zod Schema ---

const tailwindStylingRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  mockTcc: z.custom<Partial<ToolConstructionContext>>().optional(),
});

export type TailwindStylingRequest = z.infer<typeof tailwindStylingRequestSchema>;

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

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

export async function applyStyling(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
  isEditMode?: boolean;
  editInstructions?: string;
}): Promise<{
  success: boolean;
  styling?: TccStyling;
  error?: string;
  updatedTcc?: ToolConstructionContext;
}> {
  const { jobId, selectedModel, isIsolatedTest = false, editMode } = request;
  const tcc = request.mockTcc || request.tcc;
  
  // Phase 2: Edit mode detection (support both legacy and simple modes)
  const isEditMode = request.isEditMode || editMode?.isEditMode || false;
  const editInstructions = request.editInstructions || (editMode?.instructions ? editMode.instructions.map(i => i.instructions).join('\n') : undefined);

  logger.info({ jobId, isIsolatedTest }, '🎨 TailwindStyling: Starting styling application');

  // Debug: Log TCC structure right at the start
  logger.info({
    jobId,
    tccPresent: !!tcc,
    tccUserId: tcc?.userId,
    tccJobId: tcc?.jobId,
    tccKeys: tcc ? Object.keys(tcc).slice(0, 10) : [], // First 10 keys to avoid too much log spam
    requestKeys: Object.keys(request)
  }, '🎨 TailwindStyling: [DEBUG] TCC structure at entry');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    if (!isIsolatedTest) {
      logger.info({
        jobId,
        aboutToEmitProgress: true,
        tccUserId: tcc?.userId
      }, '🎨 TailwindStyling: [DEBUG] About to emit in_progress');

      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.applying_tailwind_styling,
        'in_progress',
        'Applying Tailwind CSS styling...',
        tcc // Pass TCC with userId
      );

      logger.info({ jobId }, '🎨 TailwindStyling: [DEBUG] in_progress emitted successfully');
    }

    const styling = await generateTailwindStylingWithAI(tcc, selectedModel, isIsolatedTest, editMode, isEditMode, editInstructions);

    // ✅ COMPREHENSIVE TCC UPDATE LOGGING 📋
    logger.info({
      jobId,
      agentName: 'TailwindStyling',
      tccUpdateDetail: {
        beforeStyling: !!tcc.styling,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🎨 TailwindStyling: 📋 TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      styling,
      currentOrchestrationStep: OrchestrationStepEnum.enum.assembling_component,
      steps: {
        ...tcc.steps,
        applyingTailwindStyling: {
          status: 'completed',
          startedAt:
            tcc.steps?.applyingTailwindStyling?.startedAt ||
            new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: styling,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // ✅ COMPREHENSIVE TCC UPDATE LOGGING 📋 - DETAILED OUTPUT
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
    }, '🎨 TailwindStyling: 📋 TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.applying_tailwind_styling,
        'completed',
        'Tailwind CSS styling applied successfully!',
        updatedTcc // Pass updated TCC with userId
      );
    } else {
      logger.info({ jobId }, '🎨 TailwindStyling: Isolated test mode - skipping progress emission');
    }

    logger.info({ jobId }, '🎨 TailwindStyling: Applied styling successfully');
    return { success: true, styling, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { 
        jobId, 
        error: errorMessage,
        tccPresent: !!tcc,
        tccUserId: tcc?.userId,
        tccJobId: tcc?.jobId,
        tccKeys: tcc ? Object.keys(tcc) : []
      },
      '🎨 TailwindStyling: Error applying styling',
    );
    
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.applying_tailwind_styling,
        'failed',
        errorMessage,
        tcc // Pass TCC with userId even on failure
      );
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function triggerNextOrchestrationStep(jobId: string, nextStep: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  try {
    await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, nextStep }),
    });
  } catch (error) {
    logger.error({ jobId, error }, '🎨 TailwindStyling: Failed to trigger next step.');
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
  
  // PRIORITY 1: Check TCC agent model mapping first (user's workbench selection)
  if (tcc.agentModelMapping?.['tailwind-styling']) {
    const mappedModel = tcc.agentModelMapping['tailwind-styling'];
    const provider = getModelProvider(mappedModel);
    modelConfig = { 
      provider: provider !== 'unknown' ? provider : 'openai', 
      modelId: mappedModel 
    };
    logger.info({ 
      agentName: 'tailwindStyling', 
      mappedModel, 
      provider: modelConfig.provider,
      source: 'TCC_AGENT_MAPPING' 
    }, '🎨 TailwindStyling: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = { provider: provider !== 'unknown' ? provider : 'openai', modelId: selectedModel };
    logger.info({ 
      selectedModel, 
      provider: modelConfig.provider,
      source: 'REQUEST_PARAMETER' 
    }, '🎨 TailwindStyling: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('styleMaster');
    modelConfig = primaryModel && 'modelInfo' in primaryModel ? { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } : { provider: 'openai', modelId: 'gpt-4o' };
    logger.info({ 
      modelConfig,
      source: 'CONFIGURATION_FALLBACK' 
    }, '🎨 TailwindStyling: Using CONFIGURATION FALLBACK model');
  }

  logger.info({ ...modelConfig }, '🎨 TailwindStyling: Using model');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  // Get comprehensive styling prompt with industry context if available
  const industryContext = tcc.userInput?.industry || tcc.targetAudience || 'business';
  const systemPrompt = getTailwindStylingSystemPrompt(false, industryContext);

  // Phase 1: Enhanced user prompt with style-specific brainstorm data integration
  // 🚨 FIX: Use brainstorm data for tool description instead of fallback
  let toolDescription = tcc.userInput?.description;
  if (!toolDescription && tcc.brainstormData) {
    const brainstorm = tcc.brainstormData;
    toolDescription = `${brainstorm.coreConcept || brainstorm.coreWConcept || 'Business Tool'}: ${brainstorm.valueProposition || 'A tool to help users make informed decisions.'}`;
  }

  let userPrompt = `Please apply full Tailwind CSS styling to the following JSX component.
User Input/Goal: ${toolDescription || 'Business calculation tool'}
Target Audience: ${tcc.targetAudience || 'Professionals'}
Unstyled JSX:
\`\`\`jsx
${tcc.jsxLayout?.componentStructure || ''}
\`\`\`
Element Map (for context):
${JSON.stringify(tcc.jsxLayout?.elementMap, null, 2)}`;

  // Phase 1: Inject style-specific brainstorm context for enhanced styling decisions
  if (tcc.brainstormData) {
    // 🎯 FILTERED BRAINSTORM DATA: Only get Tailwind Styling specific data
    const filteredBrainstormData = filterBrainstormForTailwindStyling(tcc.brainstormData, tcc.jobId);
    
    if (filteredBrainstormData) {
      const brainstormContext = generateFilteredBrainstormContext(filteredBrainstormData, 'TailwindStyling');
      userPrompt += brainstormContext;

      logger.info({ 
        jobId: tcc.jobId,
        dataReduction: 'Applied Tailwind Styling specific filtering'
      }, '🎨 TailwindStyling: [FILTERED BRAINSTORM] Context successfully added to prompt');
    }
  } else {
    logger.warn({ 
      jobId: tcc.jobId,
    }, '🎨 TailwindStyling: [FILTERED BRAINSTORM] ⚠️ NO BRAINSTORM DATA - Agent working with minimal context only');
  }

  // Phase 2: Add edit mode context if in edit mode
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    userPrompt += `

🔄 EDIT MODE INSTRUCTIONS:
You are EDITING existing styling. Here is the current styling:

CURRENT STYLED CODE:
\`\`\`jsx
${tcc.styling?.styledComponentCode || 'No existing styled code found'}
\`\`\`

CURRENT COLOR SCHEME:
- Primary: ${tcc.styling?.colorScheme?.primary || 'Not set'}
- Secondary: ${tcc.styling?.colorScheme?.secondary || 'Not set'}
- Background: ${tcc.styling?.colorScheme?.background || 'Not set'}

EDIT INSTRUCTIONS TO FOLLOW:`;

    editMode.instructions.forEach((instruction, index) => {
      userPrompt += `

${index + 1}. ${instruction.editType.toUpperCase()} REQUEST (${instruction.priority} priority):
${instruction.instructions}

Created: ${instruction.createdAt}`;
    });

    userPrompt += `

Please apply these edit instructions to improve the styling. Maintain the overall design cohesion while implementing the requested changes.`;
  }

  // Simple edit mode handling
  if (isEditMode && editInstructions && !editMode?.isEditMode) {
    userPrompt += `

🔄 EDIT MODE - SIMPLE INSTRUCTIONS:
You are EDITING existing styling. Here is the current styling:

CURRENT STYLED CODE:
\`\`\`jsx
${tcc.styling?.styledComponentCode || 'No existing styled code found'}
\`\`\`

CURRENT COLOR SCHEME:
- Primary: ${tcc.styling?.colorScheme?.primary || 'Not set'}
- Secondary: ${tcc.styling?.colorScheme?.secondary || 'Not set'}
- Background: ${tcc.styling?.colorScheme?.background || 'Not set'}

EDIT INSTRUCTIONS:
${editInstructions}

Please apply these edit instructions to improve the styling. Maintain the overall design cohesion while implementing the requested changes.`;
  }

  // Simple edit mode handling
  if (isEditMode && editInstructions && !editMode?.isEditMode) {
    userPrompt += `

🔄 EDIT MODE - SIMPLE INSTRUCTIONS:
You are EDITING existing styling. Here is the current styling:

CURRENT STYLED CODE:
\`\`\`jsx
${tcc.styling?.styledComponentCode || 'No existing styled code found'}
\`\`\`

CURRENT COLOR SCHEME:
- Primary: ${tcc.styling?.colorScheme?.primary || 'Not set'}
- Secondary: ${tcc.styling?.colorScheme?.secondary || 'Not set'}
- Background: ${tcc.styling?.colorScheme?.background || 'Not set'}

EDIT INSTRUCTIONS:
${editInstructions}

Please apply these edit instructions to improve the styling. Maintain the overall design cohesion while implementing the requested changes.`;
  }

  userPrompt += `

Generate the complete JSON object with the styled code and all associated styling information, ensuring it strictly matches the provided schema.`;

  logger.info({ modelId: modelConfig.modelId }, '🎨 TailwindStyling: Calling AI');

  // Log prompts when in isolated test mode for debugging
  if (isIsolatedTest) {
    // Use console.log for prompts to make them readable during isolation testing
    console.log(`\n🎨 ========== TAILWIND STYLING AGENT - ISOLATION TEST PROMPTS ==========`);
    console.log(`JobId: ${tcc.jobId}`);
    console.log(`Model: ${modelConfig.modelId}`);
    
    console.log(`\n🎨 SYSTEM PROMPT PREVIEW (first 500 chars):`);
    console.log(systemPrompt.substring(0, 500) + (systemPrompt.length > 500 ? '...' : ''));
    
    console.log(`\n🎨 USER PROMPT PREVIEW (first 1000 chars):`);
    console.log(userPrompt.substring(0, 1000) + (userPrompt.length > 1000 ? '...' : ''));
    
    console.log(`\n🎨 FULL SYSTEM PROMPT:`);
    console.log(systemPrompt);
    
    console.log(`\n🎨 FULL USER PROMPT:`);
    console.log(userPrompt);
    
    console.log(`\n🎨 ========== END PROMPTS ==========\n`);
    
    // Keep minimal structured logging for debugging
    logger.info({ 
      jobId: tcc.jobId,
      modelId: modelConfig.modelId,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length
    }, '🎨 TailwindStyling: [ISOLATED TEST] Prompt lengths logged to console');
  }

  try {
    const { object: styling } = await generateObject({
      model: modelInstance,
      schema: stylingSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.3,
      maxTokens: 8192,
    });
    return styling;
  } catch (error) {
    logger.error({ error }, '🎨 TailwindStyling: AI call failed. Generating fallback styling.');
    return generateFallbackStyling(tcc.jsxLayout);
  }
}

function generateFallbackStyling(jsxLayout?: ToolConstructionContext['jsxLayout']): TccStyling {
  const fallbackStyledCode = jsxLayout?.componentStructure
    ? jsxLayout.componentStructure.replace(/className=""/g, 'className="p-4 bg-gray-100 border rounded"')
    : '<div class="p-4">Fallback UI</div>';
    
  const fallbackStyleMap = jsxLayout?.elementMap?.reduce((acc, el) => {
      acc[el.elementId] = 'p-2 border rounded';
      return acc;
  }, {} as Record<string, string>) || { fallback: 'p-4' };

  return {
    styledComponentCode: fallbackStyledCode,
    styleMap: fallbackStyleMap,
    colorScheme: {
        primary: 'bg-blue-500',
        secondary: 'bg-gray-200',
        accent: 'bg-purple-500',
        background: 'bg-gray-50',
        surface: 'bg-white',
        text: {
            primary: 'text-gray-900',
            secondary: 'text-gray-600',
            muted: 'text-gray-400',
        },
        border: 'border-gray-200',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        error: 'bg-red-500',
    },
    designTokens: {
      spacing: { sm: 'p-2', md: 'p-4' },
      typography: { heading: 'text-lg', body: 'text-base' },
      shadows: { md: 'shadow', lg: 'shadow-lg' },
      animations: { subtle: 'transition-all duration-200' },
    },
  };
}