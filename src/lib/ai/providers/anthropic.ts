// Anthropic Provider for Keyvex AI System

import { anthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject, streamText, streamObject } from 'ai';
import { z } from 'zod';
import { AIProvider, AIRequest, AIResponse } from '@/lib/types/ai';

export class AnthropicProvider {
  private client: any;
  private defaultModel: string;
  private apiKey: string;

  constructor(apiKey?: string, defaultModel: string = 'claude-3-7-sonnet-20250219') {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.defaultModel = defaultModel;
    this.client = anthropic(this.defaultModel);
    
    if (!this.apiKey) {
      console.warn('Anthropic API key not provided. Some features may not work.');
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
      const model = anthropic(options.model || this.defaultModel);
      
      const { text, usage, finishReason } = await generateText({
        model,
        prompt,
        system: options.systemPrompt,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 4000,
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
          provider: 'anthropic'
        }
      };

    } catch (error) {
      console.error('Anthropic completion error:', error);
      throw new Error(`Anthropic completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const model = anthropic(options.model || this.defaultModel);
      
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
      console.error('Anthropic structured output error:', error);
      throw new Error(`Anthropic structured output failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const model = anthropic(options.model || this.defaultModel);
      
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
      const err = new Error(`Anthropic streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const model = anthropic(options.model || this.defaultModel);
      
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
      const err = new Error(`Anthropic structured streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onError?.(err);
    }
  }

  /**
   * Tool use with Claude (Anthropic's function calling)
   */
  async useTools(
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
      const model = anthropic(options.model || this.defaultModel);
      
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
      console.error('Anthropic tool use error:', error);
      throw new Error(`Anthropic tool use failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze content for reasoning and safety
   */
  async analyzeContent(
    content: string,
    analysisType: 'reasoning' | 'safety' | 'sentiment' | 'factuality' = 'reasoning'
  ): Promise<{
    analysis: string;
    score: number;
    confidence: number;
    details: Record<string, any>;
  }> {
    try {
      const prompts = {
        reasoning: `Analyze the reasoning quality in this content: "${content}". Evaluate logical structure, evidence quality, and argument coherence. Provide a score from 1-10.`,
        safety: `Analyze this content for safety concerns: "${content}". Check for harmful, biased, or inappropriate content. Provide a safety score from 1-10 (10 being completely safe).`,
        sentiment: `Analyze the sentiment of this content: "${content}". Determine emotional tone, positivity/negativity, and overall sentiment. Provide a sentiment score from 1-10.`,
        factuality: `Analyze the factual accuracy of this content: "${content}". Check for verifiable claims, potential misinformation, and factual consistency. Provide a factuality score from 1-10.`
      };

      const analysisSchema = z.object({
        analysis: z.string(),
        score: z.number().min(1).max(10),
        confidence: z.number().min(0).max(1),
        details: z.record(z.any()),
        recommendations: z.array(z.string()).optional()
      });

      const { object } = await this.generateStructuredOutput(
        prompts[analysisType],
        analysisSchema
      );

      return object;

    } catch (error) {
      console.error('Anthropic content analysis error:', error);
      throw new Error(`Anthropic content analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Constitutional AI - Apply principles to content
   */
  async applyConstitutionalPrinciples(
    content: string,
    principles: string[],
    action: 'evaluate' | 'revise' = 'evaluate'
  ): Promise<{
    evaluation: Record<string, { score: number; explanation: string }>;
    revisedContent?: string;
    overallScore: number;
  }> {
    try {
      const prompt = action === 'evaluate' 
        ? `Evaluate this content against these constitutional principles: ${principles.join(', ')}. Content: "${content}". For each principle, provide a score (1-10) and explanation.`
        : `Revise this content to better align with these constitutional principles: ${principles.join(', ')}. Original content: "${content}". Provide both evaluation and revised version.`;

      const constitutionalSchema = z.object({
        evaluation: z.record(z.object({
          score: z.number().min(1).max(10),
          explanation: z.string()
        })),
        revisedContent: z.string().optional(),
        overallScore: z.number().min(1).max(10),
        improvements: z.array(z.string()).optional()
      });

      const { object } = await this.generateStructuredOutput(
        prompt,
        constitutionalSchema
      );

      return object;

    } catch (error) {
      console.error('Anthropic constitutional AI error:', error);
      throw new Error(`Anthropic constitutional AI failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch process multiple requests with rate limiting
   */
  async batchProcess(
    requests: Array<{
      prompt: string;
      options?: any;
    }>,
    concurrency: number = 2 // Lower for Anthropic rate limits
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
        
        // Add delay between batches to respect rate limits
        if (i + concurrency < requests.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Batch ${Math.floor(i / concurrency)} failed:`, error);
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
   * Estimate token count for text (Claude-specific)
   */
  estimateTokens(text: string): number {
    // Claude uses a different tokenization than GPT
    // Rough estimation: ~3.5 characters per token for English text
    return Math.ceil(text.length / 3.5);
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
      'claude-3-5-sonnet-20241022',
      'claude-3-7-sonnet-20250219',
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }

  /**
   * Get model capabilities
   */
  getModelCapabilities(model: string): {
    maxTokens: number;
    contextWindow: number;
    supportsVision: boolean;
    supportsTools: boolean;
  } {
    const capabilities: Record<string, any> = {
      'claude-sonnet-4-20250514': {
        maxTokens: 64000,
        contextWindow: 200000,
        supportsVision: true,
        supportsTools: true
      },
      'claude-opus-4-20250514': {
        maxTokens: 32000,
        contextWindow: 200000,
        supportsVision: true,
        supportsTools: true
      },
      'claude-3-7-sonnet-20250219': {
        maxTokens: 64000,
        contextWindow: 200000,
        supportsVision: true,
        supportsTools: true
      },
      'claude-3-5-sonnet-20241022': {
        maxTokens: 8192,
        contextWindow: 200000,
        supportsVision: true,
        supportsTools: true
      },
      'claude-3-5-sonnet-20240620': {
        maxTokens: 4096,
        contextWindow: 200000,
        supportsVision: true,
        supportsTools: true
      },
      'claude-3-opus-20240229': {
        maxTokens: 4096,
        contextWindow: 200000,
        supportsVision: true,
        supportsTools: true
      },
      'claude-3-sonnet-20240229': {
        maxTokens: 4096,
        contextWindow: 200000,
        supportsVision: true,
        supportsTools: true
      },
      'claude-3-haiku-20240307': {
        maxTokens: 4096,
        contextWindow: 200000,
        supportsVision: true,
        supportsTools: true
      }
    };
    
    return capabilities[model] || capabilities['claude-3-5-sonnet-20241022'];
  }

  /**
   * Get model pricing information
   */
  getModelPricing(model: string): { input: number; output: number } | null {
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
      'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
      'claude-3-7-sonnet-20250219': { input: 0.003, output: 0.015 },
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
      'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
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

  /**
   * Generate with safety guidelines
   */
  async generateWithSafety(
    prompt: string,
    safetyLevel: 'strict' | 'moderate' | 'permissive' = 'moderate',
    options: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<AIResponse> {
    const safetyPrompts = {
      strict: "You must be extremely careful to avoid any harmful, biased, or inappropriate content. Prioritize safety over all other considerations.",
      moderate: "Please ensure your response is helpful, harmless, and honest. Avoid content that could be harmful or inappropriate.",
      permissive: "Provide a helpful response while maintaining basic safety standards."
    };

    const systemPrompt = options.systemPrompt 
      ? `${options.systemPrompt}\n\n${safetyPrompts[safetyLevel]}`
      : safetyPrompts[safetyLevel];

    return this.generateCompletion(prompt, {
      ...options,
      systemPrompt
    });
  }

  /**
   * Multi-step reasoning with Claude
   */
  async multiStepReasoning(
    problem: string,
    steps: string[],
    options: {
      model?: string;
      temperature?: number;
    } = {}
  ): Promise<{
    stepResults: Array<{ step: string; reasoning: string; conclusion: string }>;
    finalAnswer: string;
    confidence: number;
  }> {
    try {
      const prompt = `Solve this problem step by step: "${problem}"

Follow these steps:
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

For each step, provide:
- Your reasoning process
- Intermediate conclusions
- How it connects to the next step

Finally, provide your overall conclusion and confidence level.`;

      const reasoningSchema = z.object({
        stepResults: z.array(z.object({
          step: z.string(),
          reasoning: z.string(),
          conclusion: z.string()
        })),
        finalAnswer: z.string(),
        confidence: z.number().min(0).max(1),
        reasoning_quality: z.string().optional()
      });

      const { object } = await this.generateStructuredOutput(
        prompt,
        reasoningSchema,
        options
      );

      return object;

    } catch (error) {
      console.error('Anthropic multi-step reasoning error:', error);
      throw new Error(`Anthropic multi-step reasoning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 