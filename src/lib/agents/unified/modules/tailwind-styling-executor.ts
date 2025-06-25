/**
 * Custom executor for the Tailwind Styling agent to handle two-step generation.
 * This approach prevents token limit errors by splitting the large generation task.
 * CRITICAL FIX: This module now handles its own AI calls directly via `generateObject`
 * instead of incorrectly trying to use the AIInteractionManager, aligning it with
 * the project's architecture where custom executors are self-contained.
 */
import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import {
  AgentExecutionContext,
  TailwindStylingResult,
  ToolConstructionContext,
} from '../../../types/tcc-unified';
import {
  getTailwindStyling_Step1_StyleMap_Prompt,
  getTailwindStyling_Step2_ComponentCode_Prompt,
  getTailwindStylingUserPrompt,
} from '../../../prompts/v2/tailwind-styling-prompt';
import logger from '../../../logger';

// Helper function to create model instance
function createModelInstance(modelId: string) {
  const provider = modelId.includes('claude') ? 'anthropic' : 'openai';
  switch (provider) {
    case 'anthropic':
      return anthropic(modelId);
    case 'openai':
      return openai(modelId);
    default:
      logger.warn(
        { provider },
        'Unknown provider in tailwind-executor, defaulting to OpenAI gpt-4o'
      );
      return openai('gpt-4o');
  }
}

// Step 1: Schema for getting styleMap and colorScheme
// CRITICAL FIX: This now matches the final, detailed color scheme expected by the TCC
const Step1Schema = z.object({
  styleMap: z.record(z.string()),
  colorScheme: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    surface: z.string(),
    text: z.object({
      primary: z.string(),
      secondary: z.string(),
      muted: z.string(),
    }),
    border: z.string(),
    success: z.string(),
    warning: z.string(),
    error: z.string(),
  }),
});

type Step1Result = z.infer<typeof Step1Schema>;

// Step 2: Schema for getting the final styled code
const Step2Schema = z.object({
  styledComponentCode: z.string(),
  metadata: z.object({
    classCount: z.number(),
    responsiveBreakpoints: z.array(z.string()),
    colorSchemeType: z.string(),
  }),
});

type Step2Result = z.infer<typeof Step2Schema>;

export async function executeTailwindStylingTwoStep(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<TailwindStylingResult> {
  // CRITICAL FIX: Correctly access modelId from modelConfig
  const { jobId, agentType, modelConfig } = context;
  const modelInstance = createModelInstance(modelConfig.modelId);
  const systemPrompt = getTailwindStylingUserPrompt(tcc);

  logger.info(
    { jobId, agentType },
    '🚀 Starting two-step Tailwind Styling execution.'
  );

  // --- STEP 1: Generate StyleMap and ColorScheme ---
  logger.info(
    { jobId, agentType },
    '   ➡️  Step 1: Generating StyleMap and ColorScheme.'
  );
  const step1Prompt = getTailwindStyling_Step1_StyleMap_Prompt(tcc);

  const { object: step1Result } = await generateObject({
    model: modelInstance,
    system: systemPrompt,
    prompt: step1Prompt,
    schema: Step1Schema,
  });

  if (!step1Result.styleMap || Object.keys(step1Result.styleMap).length === 0) {
    throw new Error('AI failed to generate a valid styleMap in Step 1.');
  }

  logger.info(
    {
      jobId,
      agentType,
      styleMapKeys: Object.keys(step1Result.styleMap).length,
    },
    '   ✅ Step 1: Successfully generated StyleMap.'
  );

  // --- STEP 2: Generate Styled Component Code ---
  logger.info(
    { jobId, agentType },
    '   ➡️  Step 2: Generating Styled Component Code using the new StyleMap.'
  );
  const step2Prompt = getTailwindStyling_Step2_ComponentCode_Prompt(
    tcc,
    step1Result.styleMap
  );

  const { object: step2Result } = await generateObject({
    model: modelInstance,
    system: systemPrompt,
    prompt: step2Prompt,
    schema: Step2Schema,
  });

  if (!step2Result.styledComponentCode) {
    throw new Error('AI failed to generate styledComponentCode in Step 2.');
  }

  logger.info(
    { jobId, agentType, codeLength: step2Result.styledComponentCode.length },
    '   ✅ Step 2: Successfully generated Styled Component Code.'
  );

  // --- COMBINE RESULTS ---
  const finalResult: TailwindStylingResult = {
    styling: {
      styledComponentCode: step2Result.styledComponentCode,
      styleMap: step1Result.styleMap,
      colorScheme: step1Result.colorScheme,
      designTokens: {
        spacing: {
          'xs': '0.25rem',
          'sm': '0.5rem',
          'md': '1rem',
          'lg': '1.5rem',
          'xl': '2rem'
        },
        typography: {
          'heading': 'text-xl font-semibold',
          'body': 'text-sm font-medium',
          'caption': 'text-xs font-normal'
        },
        shadows: {
          'soft': 'shadow-md',
          'medium': 'shadow-lg',
          'hard': 'shadow-xl'
        },
        animations: {
          'fade': 'transition-opacity duration-200',
          'scale': 'transition-transform duration-200',
          'slide': 'transition-all duration-300'
        }
      }
    },
    metadata: step2Result.metadata,
  };

  logger.info(
    { jobId, agentType },
    '🎉 Successfully combined results from both steps.'
  );

  return finalResult;
}