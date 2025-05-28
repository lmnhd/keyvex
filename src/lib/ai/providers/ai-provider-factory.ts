// AI Provider Factory
// Creates and manages AI provider instances using centralized model configuration

import { getPrimaryModel, getFallbackModel, isFeatureEnabled, getTimeout, getMaxRetries } from '../models/model-config';
import { debugLog } from '../../auth/debug';

// Provider interfaces
export interface AIProvider {
  name: string;
  model: string;
  generateText(prompt: string, options?: GenerationOptions): Promise<string>;
  generateStream(prompt: string, options?: GenerationOptions): AsyncGenerator<string, void, unknown>;
  calculateTokens(text: string): number;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stopSequences?: string[];
  stream?: boolean;
}

export interface ProviderConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  retries: number;
}

// OpenAI Provider Implementation
class OpenAIProvider implements AIProvider {
  public name: string;
  public model: string;
  private apiKey: string;
  private config: ProviderConfig;

  constructor(model: string, config: ProviderConfig) {
    this.name = 'openai';
    this.model = model;
    this.config = config;
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
  }

  async generateText(prompt: string, options?: GenerationOptions): Promise<string> {
    debugLog(`OpenAI generateText called`, { model: this.model, prompt: prompt.substring(0, 100) });
    
    try {
      // TODO: Implement actual OpenAI API call
      // For now, return a mock response
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      
      return `[OpenAI ${this.model}] Generated response for: ${prompt.substring(0, 50)}...`;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async* generateStream(prompt: string, options?: GenerationOptions): AsyncGenerator<string, void, unknown> {
    debugLog(`OpenAI generateStream called`, { model: this.model });
    
    try {
      // TODO: Implement actual OpenAI streaming
      // For now, yield mock chunks
      const chunks = [`[OpenAI ${this.model}] `, 'Streaming ', 'response ', 'for: ', prompt.substring(0, 20), '...'];
      
      for (const chunk of chunks) {
        await new Promise(resolve => setTimeout(resolve, 200));
        yield chunk;
      }
    } catch (error) {
      console.error('OpenAI streaming error:', error);
      throw new Error(`OpenAI streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  calculateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for OpenAI models
    return Math.ceil(text.length / 4);
  }
}

// Anthropic Provider Implementation
class AnthropicProvider implements AIProvider {
  public name: string;
  public model: string;
  private apiKey: string;
  private config: ProviderConfig;

  constructor(model: string, config: ProviderConfig) {
    this.name = 'anthropic';
    this.model = model;
    this.config = config;
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Anthropic API key not found in environment variables');
    }
  }

  async generateText(prompt: string, options?: GenerationOptions): Promise<string> {
    debugLog(`Anthropic generateText called`, { model: this.model, prompt: prompt.substring(0, 100) });
    
    try {
      // TODO: Implement actual Anthropic API call
      // For now, return a mock response
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
      
      return `[Anthropic ${this.model}] Generated response for: ${prompt.substring(0, 50)}...`;
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw new Error(`Anthropic generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async* generateStream(prompt: string, options?: GenerationOptions): AsyncGenerator<string, void, unknown> {
    debugLog(`Anthropic generateStream called`, { model: this.model });
    
    try {
      // TODO: Implement actual Anthropic streaming
      // For now, yield mock chunks
      const chunks = [`[Anthropic ${this.model}] `, 'Streaming ', 'creative ', 'response ', 'for: ', prompt.substring(0, 20), '...'];
      
      for (const chunk of chunks) {
        await new Promise(resolve => setTimeout(resolve, 150));
        yield chunk;
      }
    } catch (error) {
      console.error('Anthropic streaming error:', error);
      throw new Error(`Anthropic streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  calculateTokens(text: string): number {
    // Rough estimation: ~3.5 characters per token for Anthropic models
    return Math.ceil(text.length / 3.5);
  }
}

// Provider Factory Class
export class AIProviderFactory {
  private static instance: AIProviderFactory;
  private providerCache: Map<string, AIProvider> = new Map();

  private constructor() {}

  static getInstance(): AIProviderFactory {
    if (!AIProviderFactory.instance) {
      AIProviderFactory.instance = new AIProviderFactory();
    }
    return AIProviderFactory.instance;
  }

  /**
   * Create a provider for a specific process
   */
  async createProvider(processName: string, useFallback: boolean = false): Promise<AIProvider> {
    const modelConfig = useFallback ? getFallbackModel(processName) : getPrimaryModel(processName);
    
    if (!modelConfig) {
      throw new Error(`No model configuration found for process: ${processName}`);
    }

    const cacheKey = `${modelConfig.provider}-${modelConfig.model}-${processName}`;
    
    // Return cached provider if available
    if (this.providerCache.has(cacheKey)) {
      debugLog(`Using cached provider`, { cacheKey });
      return this.providerCache.get(cacheKey)!;
    }

    // Create provider configuration
    const providerConfig: ProviderConfig = {
      provider: modelConfig.provider,
      model: modelConfig.model,
      temperature: modelConfig.config.temperature,
      maxTokens: modelConfig.config.maxTokens,
      timeout: getTimeout(),
      retries: getMaxRetries()
    };

    // Create provider instance
    let provider: AIProvider;
    
    switch (modelConfig.provider) {
      case 'openai':
        provider = new OpenAIProvider(modelConfig.modelInfo.id, providerConfig);
        break;
      case 'anthropic':
        provider = new AnthropicProvider(modelConfig.modelInfo.id, providerConfig);
        break;
      default:
        throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    }

    // Cache the provider
    this.providerCache.set(cacheKey, provider);
    
    debugLog(`Created new provider`, { 
      provider: modelConfig.provider, 
      model: modelConfig.model, 
      process: processName 
    });

    return provider;
  }

  /**
   * Create a provider with automatic fallback support
   */
  async createProviderWithFallback(processName: string): Promise<{
    primary: AIProvider;
    fallback: AIProvider | null;
  }> {
    const primary = await this.createProvider(processName, false);
    
    let fallback: AIProvider | null = null;
    if (isFeatureEnabled('autoFallback')) {
      try {
        fallback = await this.createProvider(processName, true);
      } catch (error) {
        console.warn(`Failed to create fallback provider for ${processName}:`, error);
      }
    }

    return { primary, fallback };
  }

  /**
   * Generate text with automatic fallback
   */
  async generateText(
    processName: string, 
    prompt: string, 
    options?: GenerationOptions
  ): Promise<string> {
    const { primary, fallback } = await this.createProviderWithFallback(processName);
    
    try {
      return await primary.generateText(prompt, options);
    } catch (error) {
      debugLog(`Primary provider failed, trying fallback`, { processName, error: error instanceof Error ? error.message : 'Unknown' });
      
      if (fallback) {
        try {
          return await fallback.generateText(prompt, options);
        } catch (fallbackError) {
          debugLog(`Fallback provider also failed`, { processName, error: fallbackError instanceof Error ? fallbackError.message : 'Unknown' });
          throw new Error(`Both primary and fallback providers failed for ${processName}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Generate streaming text with automatic fallback
   */
  async* generateStream(
    processName: string, 
    prompt: string, 
    options?: GenerationOptions
  ): AsyncGenerator<string, void, unknown> {
    const { primary, fallback } = await this.createProviderWithFallback(processName);
    
    try {
      yield* primary.generateStream(prompt, options);
    } catch (error) {
      debugLog(`Primary streaming failed, trying fallback`, { processName });
      
      if (fallback) {
        try {
          yield* fallback.generateStream(prompt, options);
        } catch (fallbackError) {
          throw new Error(`Both primary and fallback streaming failed for ${processName}`);
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Clear provider cache
   */
  clearCache(): void {
    this.providerCache.clear();
    debugLog('Provider cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.providerCache.size,
      keys: Array.from(this.providerCache.keys())
    };
  }
}

// Export singleton instance
export const aiProviderFactory = AIProviderFactory.getInstance();

// Convenience functions
export async function createAIProvider(processName: string): Promise<AIProvider> {
  return aiProviderFactory.createProvider(processName);
}

export async function generateAIText(processName: string, prompt: string, options?: GenerationOptions): Promise<string> {
  return aiProviderFactory.generateText(processName, prompt, options);
}

export function generateAIStream(processName: string, prompt: string, options?: GenerationOptions): AsyncGenerator<string, void, unknown> {
  return aiProviderFactory.generateStream(processName, prompt, options);
} 