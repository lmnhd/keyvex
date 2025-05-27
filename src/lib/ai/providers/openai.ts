// OpenAI Provider for Keyvex AI System

import { openai } from '@ai-sdk/openai';
import { generateText, generateObject, streamText, streamObject } from 'ai';
import { z } from 'zod';
import { AIProvider, AIRequest, AIResponse } from '@/lib/types/ai';

export class OpenAIProvider {
  private client: any;
  private defaultModel: string;
  private apiKey: string;

  constructor(apiKey?: string, defaultModel: string = 'gpt-4-turbo-preview') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.defaultModel = defaultModel;
    this.client = openai(this.defaultModel);
    
    if (!this.apiKey) {
      console.warn('OpenAI API key not provided. Some features may not work.');
    }
  }

  /**
   * Generate text completion
   */
  async generateCompletion(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<AIResponse> {
    try {
      const model = openai(options.model || this.defaultModel);
      
      const { text, usage, finishReason } = await generateText({
        model,
        prompt,
        system: options.systemPrompt,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 2000,
      });

      return {
        content: text,
        usage: usage ? {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens
        } : undefined,
        finishReason,
        metadata: {
          model: options.model || this.defaultModel,
          provider: 'openai'
        }
      };

    } catch (error) {
      console.error('OpenAI completion error:', error);
      throw new Error(`OpenAI completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate structured object
   */
  async generateStructuredOutput<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
      maxRetries?: number;
    } = {}
  ): Promise<{ object: T; usage?: any }> {
    try {
      const model = openai(options.model || this.defaultModel);
      
      const result = await generateObject({
        model,
        schema,
        prompt,
        system: options.systemPrompt,
        temperature: options.temperature || 0.7,
        maxRetries: options.maxRetries || 3,
      });

      return {
        object: result.object,
        usage: result.usage
      };

    } catch (error) {
      console.error('OpenAI structured output error:', error);
      throw new Error(`OpenAI structured output failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream text completion
   */
  async streamCompletion(
    prompt: string,
    onChunk: (chunk: string) => void,
    onComplete?: (fullText: string) => void,
    onError?: (error: Error) => void,
    options: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<void> {
    try {
      const model = openai(options.model || this.defaultModel);
      
      const { textStream } = streamText({
        model,
        prompt,
        system: options.systemPrompt,
        temperature: options.temperature || 0.7,
        onError: onError ? (event) => onError(new Error(String(event.error))) : undefined
      });

      let fullText = '';
      for await (const textPart of textStream) {
        fullText += textPart;
        onChunk(textPart);
      }

      onComplete?.(fullText);

    } catch (error) {
      const err = new Error(`OpenAI streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onError?.(err);
    }
  }

  /**
   * Stream structured object generation
   */
  async streamStructuredOutput<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    onPartial: (partial: any) => void,
    onComplete?: (object: T) => void,
    onError?: (error: Error) => void,
    options: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<void> {
    try {
      const model = openai(options.model || this.defaultModel);
      
      const { partialObjectStream } = streamObject({
        model,
        schema,
        prompt,
        system: options.systemPrompt,
        temperature: options.temperature || 0.7,
        onError: onError ? (event) => onError(new Error(String(event.error))) : undefined
      });

      for await (const partialObject of partialObjectStream) {
        onPartial(partialObject);
      }

    } catch (error) {
      const err = new Error(`OpenAI structured streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onError?.(err);
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbeddings(
    texts: string[],
    model: string = 'text-embedding-3-small'
  ): Promise<number[][]> {
    try {
      // Note: Vercel AI SDK doesn't have embeddings yet, so we'd use OpenAI directly
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: texts,
          model,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI embeddings API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.map((item: any) => item.embedding);

    } catch (error) {
      console.error('OpenAI embeddings error:', error);
      throw new Error(`OpenAI embeddings failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Moderate content for safety
   */
  async moderateContent(text: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
  }> {
    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI moderation API error: ${response.statusText}`);
      }

      const data = await response.json();
      const result = data.results[0];

      return {
        flagged: result.flagged,
        categories: result.categories,
        categoryScores: result.category_scores
      };

    } catch (error) {
      console.error('OpenAI moderation error:', error);
      throw new Error(`OpenAI moderation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Function calling with tools
   */
  async callFunction(
    prompt: string,
    tools: Record<string, any>,
    options: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<{
    content: string;
    toolCalls?: any[];
    usage?: any;
  }> {
    try {
      const model = openai(options.model || this.defaultModel);
      
      const { text, toolCalls, usage } = await generateText({
        model,
        prompt,
        system: options.systemPrompt,
        temperature: options.temperature || 0.7,
        tools,
      });

      return {
        content: text,
        toolCalls,
        usage
      };

    } catch (error) {
      console.error('OpenAI function calling error:', error);
      throw new Error(`OpenAI function calling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch process multiple requests
   */
  async batchProcess(
    requests: Array<{
      prompt: string;
      options?: any;
    }>,
    concurrency: number = 3
  ): Promise<AIResponse[]> {
    const results: AIResponse[] = [];
    
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchPromises = batch.map(req => 
        this.generateCompletion(req.prompt, req.options)
      );
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Batch ${Math.floor(i / concurrency)} failed:`, error);
        // Add error placeholders for failed batch
        const errorResponse: AIResponse = {
          content: '',
          metadata: { error: 'Batch processing failed' }
        };
        results.push(...Array(batch.length).fill(errorResponse));
      }
    }
    
    return results;
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.generateCompletion('Test', { maxTokens: 1 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return [
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ];
  }

  /**
   * Get model pricing information
   */
  getModelPricing(model: string): { input: number; output: number } | null {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 }
    };
    
    return pricing[model] || null;
  }

  /**
   * Calculate cost for usage
   */
  calculateCost(usage: { promptTokens: number; completionTokens: number }, model: string): number {
    const pricing = this.getModelPricing(model);
    if (!pricing) return 0;
    
    const inputCost = (usage.promptTokens / 1000) * pricing.input;
    const outputCost = (usage.completionTokens / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }
}

// TODO: Add comprehensive error handling
// TODO: Implement request/response caching
// TODO: Add request queuing for rate limiting
// TODO: Implement usage analytics and monitoring
// TODO: Add support for fine-tuned models
// TODO: Implement request retries with exponential backoff 