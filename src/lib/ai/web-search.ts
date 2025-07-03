import { z } from 'zod';

// -----------------------------------------------------------------------------
// Perplexity AI Search Wrapper (Sonar-Pro or other search models)
// -----------------------------------------------------------------------------
// Strongly-typed helper around the Perplexity /chat/completions endpoint to
// perform a single web-search style query and return a structured response.
// -----------------------------------------------------------------------------

export const WebSearchOptionsSchema = z.object({
  /** The search query to execute */
  query: z.string().min(3),
  /** Perplexity model ID – default 'sonar-pro' */
  model: z.string().default('sonar-pro').optional(),
  /** Whether to include images in the response */
  returnImages: z.boolean().optional(),
  /** Max tokens for completion */
  maxTokens: z.number().int().positive().optional(),
  /** Temperature (0-2) */
  temperature: z.number().min(0).max(2).optional(),
});
export type WebSearchOptions = z.infer<typeof WebSearchOptionsSchema>;

export const WebSearchResultSchema = z.object({
  query: z.string(),
  answer: z.string(),
  citations: z.array(z.string()).optional(),
  raw: z.unknown().optional(),
});
export type WebSearchResult = z.infer<typeof WebSearchResultSchema>;

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Executes a single Perplexity Sonar search query.
 * Throws descriptive error messages on failure.
 */
export async function webSearch(options: WebSearchOptions): Promise<WebSearchResult> {
  const opts = WebSearchOptionsSchema.parse(options);

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }

  // Build request body
  const body = {
    model: opts.model ?? 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: 'Provide a concise, factual answer with key data points. Respond in plain text.',
      },
      {
        role: 'user',
        content: opts.query,
      },
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 512,
    return_images: opts.returnImages ?? false,
    stream: false,
  } as const;

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API request failed with status ${response.status}`);
  }

  const json = (await response.json()) as unknown;

  // The schema of Perplexity responses is loosely documented; we capture what we need.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answer = (json as any)?.choices?.[0]?.message?.content as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const citations = (json as any)?.citations as string[] | undefined;

  if (!answer) {
    throw new Error('Perplexity API returned no answer content');
  }

  return {
    query: opts.query,
    answer,
    citations,
    raw: json,
  };
}

// Backward compatibility alias
export const perplexity_web_search = webSearch;
