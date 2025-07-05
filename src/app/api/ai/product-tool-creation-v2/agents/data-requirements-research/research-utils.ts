import { z } from 'zod';
import { webSearch, WebSearchResult } from '@/lib/ai/web-search';
import { BrainstormData } from '@/lib/types/tcc-unified';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getModelProvider } from '@/lib/ai/models/model-config';
import { DataRequirementsResearchOutputSchema } from './schema';

// Re-export schema type
export type DataRequirementsResearchOutput = z.infer<typeof DataRequirementsResearchOutputSchema>;

type ResearchQuery = {
  query: string;
  domain: string;
  dataType: string;
  priority: string;
  locationDependent: boolean;
  expectedDataStructure: string;
};

export async function executeResearchQueries(queries: ResearchQuery[]): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];

  for (const q of queries) {
    try {
      const res = await webSearch({ query: q.query, model: 'sonar-pro' });
      results.push(res);
    } catch (err) {
      // Continue even if individual query fails
      results.push({ query: q.query, answer: `NOT_AVAILABLE: ${(err as Error).message}` });
    }
  }

  return results;
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

// --- Refinement step ---------------------------------------------------------
const RefinementSchema = z.object({
  mockData: z.record(z.any()),
  userInstructions: DataRequirementsResearchOutputSchema.shape.userInstructions,
});
export type RefinementResult = z.infer<typeof RefinementSchema>;

export async function refineMockDataWithResearch(
  brainstorm: BrainstormData,
  initialAnalysis: DataRequirementsResearchOutput,
  searchResults: WebSearchResult[],
  modelId = 'gpt-4o'
): Promise<RefinementResult> {
  const prompt = `You are refining mock data for a tool based on fresh web-search research. \n\n` +
    `--- TOOL BRAINSTORM DATA ---\n${JSON.stringify(brainstorm, null, 2)}\n` +
    `--- INITIAL ANALYSIS ---\n${JSON.stringify(initialAnalysis, null, 2)}\n` +
    `--- SEARCH RESULTS ---\n${JSON.stringify(searchResults, null, 2)}\n` +
    `\nRefine the mockData so it is consistent with the real search answers, and update userInstructions if needed. Return ONLY JSON that matches this schema: ${RefinementSchema.toString()}`;

  const provider = getModelProvider(modelId);
  const model = createModelInstance(provider, modelId);

  const { object } = await generateObject({
    model,
    schema: RefinementSchema,
    prompt,
    temperature: 0.3,
  });

  return object;
}
