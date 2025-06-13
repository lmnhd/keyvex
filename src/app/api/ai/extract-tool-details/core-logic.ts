import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';

// Define the Zod schema for the expected output object
export const ToolDetailsSchema = z.object({
  toolType: z.string().describe("The primary type or category of the tool, e.g., 'ROI Calculator', 'Lead Qualification Quiz', 'Content Generator', 'Healthcare Compliance Assessment', 'Manufacturing Efficiency Analyzer', 'Real Estate Investment Evaluator'."),
  targetAudience: z.string().describe("The main group that will ultimately use the tool; this is the audience that will be using the tool as opposed to the client that is providing the tool to the audience, e.g., 'University Students', 'Small Business Owners', 'Consultants', 'Entrepreneurs', 'Coaches', 'B2B Service Providers', 'Health enthusiasts', 'Content creators', etc."),
});

export type ExtractedToolDetails = z.infer<typeof ToolDetailsSchema>;

interface ExtractToolDetailsLogicInput {
  description: string;
}

/**
 * Extracts toolType and targetAudience from a given description using the o4-mini model.
 * @param {ExtractToolDetailsLogicInput} input - The input object containing the tool description.
 * @returns {Promise<ExtractedToolDetails>} The extracted tool details.
 * @throws Will throw an error if the AI fails to generate the object or if the output doesn't match the schema.
 */
export async function extractToolDetailsLogic(
  input: ExtractToolDetailsLogicInput
): Promise<ExtractedToolDetails> {
  const { description } = input;

  if (!description || description.trim() === '') {
    throw new Error('Input description cannot be empty.');
  }

  console.log(`[CoreLogic] Attempting to extract tool details with o4-mini for description: "${description.substring(0, 100)}..."`);

  try {
    const { object } = await generateObject({
      model: openai('o4-mini'), // Explicitly use o4-mini
      schema: ToolDetailsSchema,
      mode: 'json', // Explicitly request JSON output mode
      prompt: `You are an expert assistant helping define specialized interactive tools for Keyvex. \
Keyvex empowers consultants, coaches, and B2B service providers to create unique lead magnets such as calculators, quizzes, and assessments. \
These tools are not generic templates; they are designed for real-world business applications, often reflecting our clients\' proprietary business models and internal processes. \
They aim to provide tangible value, automate client interactions, and generate qualified leads by offering insightful calculations or evaluations.\

From the user\'s tool description below, your task is to identify:
1.  \'toolType\': The specific category or nature of this interactive lead magnet (e.g., \'Financial Projection Calculator\', \'Client Onboarding Assessment\', \'Market Readiness Quiz\', \'Custom Process Optimizer\', \'Service Value Demonstrator\'). Think creatively and aim for a type that captures the unique essence and core function of the described tool. Avoid overly generic terms if a more specific and impactful type can be inferred.
2.  \'targetAudience\': The primary group of users, professionals, or businesses this tool is intended for (e.g., \'Independent Financial Advisors\', \'SaaS Startups seeking Series A funding\', \'E-commerce Managers optimizing conversion funnels\', \'Manufacturing SMEs exploring automation\'). Be as specific as the description allows and consider the niche the tool serves.

Strive for uniqueness and precision in both fields, reflecting the bespoke nature of Keyvex tools. Your output must be a JSON object with exactly two keys: "toolType" and "targetAudience".

Tool Description:
"${description}"`,
      temperature: 0.2, // Slightly higher temperature for a bit more creativity but still grounded
      maxTokens: 800, // Significantly increased max tokens for internal tool reliability
    });

    console.log('[CoreLogic] Successfully extracted tool details:', object);
    return object;
  } catch (error) {
    console.error('[CoreLogic] Error extracting tool details using o4-mini:', error);
    // Check if the error is from the AI SDK and has more specific details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during AI object generation.';
    if ((error as any)?.cause?.message) {
        // Log more specific cause if available from AI SDK
        console.error('[CoreLogic] AI SDK Cause:', (error as any).cause.message);
    }
    throw new Error(`Failed to extract tool details with o4-mini: ${errorMessage}`);
  }
}
