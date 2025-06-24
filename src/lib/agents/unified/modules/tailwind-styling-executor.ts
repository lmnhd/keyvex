/**
 * Custom executor for the Tailwind Styling agent to handle two-step generation.
 * This approach prevents token limit errors by splitting the large generation task.
 */
import { z } from 'zod';
import { 
  AgentExecutionContext,
  TailwindStylingResult,
  ToolConstructionContext
} from '../../../types/tcc-unified';
import { AIInteractionManager } from '../core/ai-interaction-manager';
import { getTailwindStyling_Step1_StyleMap_Prompt, getTailwindStyling_Step2_ComponentCode_Prompt } from '../../../prompts/v2/tailwind-styling-prompt';
import logger from '../../../logger';

const aiManager = AIInteractionManager.getInstance();

// Step 1: Schema for getting styleMap and colorScheme
const Step1Schema = z.object({
  styleMap: z.record(z.string()),
  colorScheme: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    text: z.string(),
    accent: z.string()
  }).optional()
});

type Step1Result = z.infer<typeof Step1Schema>;

// Step 2: Schema for getting the final styled code
const Step2Schema = z.object({
  styledComponentCode: z.string(),
  metadata: z.object({
    classCount: z.number(),
    responsiveBreakpoints: z.array(z.string()),
    colorSchemeType: z.string()
  })
});

type Step2Result = z.infer<typeof Step2Schema>;

export async function executeTailwindStylingTwoStep(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<TailwindStylingResult> {
  const { jobId, agentType, model } = context;
  
  logger.info({ jobId, agentType }, '🚀 Starting two-step Tailwind Styling execution.');

  // --- STEP 1: Generate StyleMap and ColorScheme ---
  logger.info({ jobId, agentType }, '   ➡️  Step 1: Generating StyleMap and ColorScheme.');
  const step1Prompt = getTailwindStyling_Step1_StyleMap_Prompt(tcc);
  const step1Result = await aiManager.generateObject<Step1Result>({
    jobId,
    agentType,
    prompt: step1Prompt,
    model,
    schema: Step1Schema
  });

  if (!step1Result.styleMap || Object.keys(step1Result.styleMap).length === 0) {
    throw new Error('AI failed to generate a valid styleMap in Step 1.');
  }
  
  logger.info({ jobId, agentType, styleMapKeys: Object.keys(step1Result.styleMap).length }, '   ✅ Step 1: Successfully generated StyleMap.');

  // --- STEP 2: Generate Styled Component Code ---
  logger.info({ jobId, agentType }, '   ➡️  Step 2: Generating Styled Component Code using the new StyleMap.');
  const step2Prompt = getTailwindStyling_Step2_ComponentCode_Prompt(tcc, step1Result.styleMap);
  const step2Result = await aiManager.generateObject<Step2Result>({
    jobId,
    agentType,
    prompt: step2Prompt,
    model,
    schema: Step2Schema
  });
  
  if (!step2Result.styledComponentCode) {
    throw new Error('AI failed to generate styledComponentCode in Step 2.');
  }

  logger.info({ jobId, agentType, codeLength: step2Result.styledComponentCode.length }, '   ✅ Step 2: Successfully generated Styled Component Code.');

  // --- COMBINE RESULTS ---
  const finalResult: TailwindStylingResult = {
    styling: {
      styledComponentCode: step2Result.styledComponentCode,
      styleMap: step1Result.styleMap,
      colorScheme: step1Result.colorScheme,
    },
    metadata: step2Result.metadata
  };
  
  logger.info({ jobId, agentType }, '🎉 Successfully combined results from both steps.');

  return finalResult;
} 