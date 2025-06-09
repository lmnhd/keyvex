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

export async function applyStyling(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
  isIsolatedTest?: boolean;
}): Promise<{
  success: boolean;
  styling?: TccStyling;
  error?: string;
  updatedTcc?: ToolConstructionContext;
}> {
  const { jobId, selectedModel, isIsolatedTest = false } = request;
  const tcc = request.mockTcc || request.tcc;

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

    const styling = await generateTailwindStylingWithAI(tcc, selectedModel, isIsolatedTest);

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
): Promise<TccStyling> {
  let modelConfig: { provider: string; modelId: string };
  if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = { provider: provider !== 'unknown' ? provider : 'openai', modelId: selectedModel };
  } else {
    const primaryModel = getPrimaryModel('styleMaster');
    modelConfig = primaryModel && 'modelInfo' in primaryModel ? { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } : { provider: 'openai', modelId: 'gpt-4o' };
  }

  logger.info({ ...modelConfig }, '🎨 TailwindStyling: Using model');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  // Get comprehensive styling prompt with industry context if available
  const industryContext = tcc.userInput?.industry || tcc.targetAudience || 'business';
  const systemPrompt = getTailwindStylingSystemPrompt(false, industryContext);

  const userPrompt = `Please apply full Tailwind CSS styling to the following JSX component.
User Input/Goal: ${tcc.userInput?.description || 'A business tool'}
Target Audience: ${tcc.targetAudience || 'Professionals'}
Unstyled JSX:
\`\`\`jsx
${tcc.jsxLayout?.componentStructure || ''}
\`\`\`
Element Map (for context):
${JSON.stringify(tcc.jsxLayout?.elementMap, null, 2)}

Generate the complete JSON object with the styled code and all associated styling information, ensuring it strictly matches the provided schema.`;

  logger.info({ modelId: modelConfig.modelId }, '🎨 TailwindStyling: Calling AI');

  // Log prompts when in isolated test mode for debugging
  if (isIsolatedTest) {
    logger.info({ 
      jobId: tcc.jobId,
      modelId: modelConfig.modelId,
      systemPrompt: systemPrompt.substring(0, 500) + (systemPrompt.length > 500 ? '...' : ''),
      userPrompt: userPrompt.substring(0, 1000) + (userPrompt.length > 1000 ? '...' : '')
    }, '🎨 TailwindStyling: [ISOLATED TEST] Prompt Preview');
    
    logger.info({ 
      jobId: tcc.jobId,
      fullSystemPrompt: systemPrompt 
    }, '🎨 TailwindStyling: [ISOLATED TEST] Full System Prompt');
    
    logger.info({ 
      jobId: tcc.jobId,
      fullUserPrompt: userPrompt 
    }, '🎨 TailwindStyling: [ISOLATED TEST] Full User Prompt');
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