import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { BrainstormData } from '@/lib/types/tcc-unified';
import { getModelProvider } from '@/lib/ai/models/model-config';

// ----------------------------------------------
// Zod schema describing the research result
// ----------------------------------------------
export const DataRequirementsResearchSchema = z.object({
  hasExternalDataNeeds: z.boolean(),
  requiredDataTypes: z.array(z.string()),
  researchQueries: z.array(
    z.object({
      query: z.string(),
      domain: z.string(),
      dataType: z.string(),
      priority: z.string(),
      locationDependent: z.boolean(),
    })
  ),
  dummyData: z.record(z.any()).optional(),
  userInstructions: z.object({
    summary: z.string(),
    dataNeeded: z.array(z.string()),
    format: z.string(),
  }),
});

export type DataRequirementsResearchResult = z.infer<typeof DataRequirementsResearchSchema>;

// ----------------------------------------------
// Core logic: call an LLM (Anthropic / OpenAI) to
// analyse brainstorm data & produce structured
// data requirements research.
// ----------------------------------------------
export async function runDataRequirementsResearch(
  brainstormData: BrainstormData,
  modelId: string,
  userLocation?: { state?: string; country?: string; zipCode?: string }
): Promise<DataRequirementsResearchResult> {
  // Determine provider from the model ID pattern
  const provider = getModelProvider(modelId);
  const model = provider === 'anthropic' ? anthropic(modelId) : openai(modelId);

  const prompt = `You are an AI product architect tasked with analysing a software tool brainstorm and identifying any external data requirements.\n\n` +
    `--- BRAINSTORM DATA (JSON) ---\n` +
    `${JSON.stringify(brainstormData, null, 2)}\n` +
    `--- USER LOCATION (optional) ---\n` +
    `${JSON.stringify(userLocation || {}, null, 2)}\n` +
    `--------------------------------\n` +
    `For the given brainstorm, determine:\n` +
    `1. Whether the tool needs any data that is external to the user.\n` +
    `2. Which data types are required.\n` +
    `3. Up to 10 search queries that could be executed in Perplexity (or any search engine) to obtain that data.\n` +
    `4. Example dummy data for each data type.\n` +
    `5. Clear instructions to the user on how to provide or connect this data.\n` +
    `Return ONLY valid JSON that matches exactly the following schema: \n${DataRequirementsResearchSchema.toString()}`;

  // Call the model and validate the structured output in one step
  const { object } = await generateObject({
    model,
    schema: DataRequirementsResearchSchema,
    prompt,
    temperature: 0.3,
  });

  return object;
}
