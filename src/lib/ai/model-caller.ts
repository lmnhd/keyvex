import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

interface ModelCallOptions<T> {
  schema: z.ZodSchema<T>;
  prompt: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
}

interface ModelCallResult<T> {
  object: T;
}

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': 
      return openai(modelId);
    case 'anthropic': 
      return anthropic(modelId);
    default: 
      logger.warn({ provider, modelId }, 'Unknown provider, falling back to OpenAI');
      return openai('gpt-4o');
  }
}

export async function callModelForObject<T>(
  modelId: string,
  options: ModelCallOptions<T>
): Promise<ModelCallResult<T>> {
  const {
    schema,
    prompt,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 4000,
    maxRetries = 3
  } = options;

  // Get provider for the model
  const provider = getModelProvider(modelId);
  const model = createModelInstance(provider, modelId);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info({ 
        modelId, 
        provider, 
        attempt, 
        temperature, 
        maxTokens,
        systemPromptLength: systemPrompt.length,
        userPromptLength: prompt.length
      }, `🤖 Model Caller: Attempt ${attempt}/${maxRetries}`);

      const result = await generateObject({
        model,
        schema,
        system: systemPrompt,
        prompt,
        temperature,
        maxTokens
      });

      logger.info({ 
        modelId, 
        provider, 
        attempt, 
        success: true
      }, `🤖 Model Caller: Success on attempt ${attempt}`);

      return { object: result.object };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      logger.error({ 
        modelId, 
        provider, 
        attempt, 
        error: lastError.message,
        willRetry: attempt < maxRetries
      }, `🤖 Model Caller: Attempt ${attempt} failed`);

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const waitTime = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(`Model call failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
} 
