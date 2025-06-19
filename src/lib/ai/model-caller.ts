import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText } from 'ai';
import { getModelProvider } from '@/lib/ai/models/model-config';

// Types for the centralized model caller
export interface ModelCallOptions {
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  systemPrompt?: string;
}

export interface GenerateObjectOptions extends ModelCallOptions {
  schema: z.ZodSchema<any>;
  prompt: string;
}

export interface GenerateTextOptions extends ModelCallOptions {
  prompt: string;
}

/**
 * Create model instance with provider-specific configuration
 */
function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    default:
      console.warn(`Unknown provider: ${provider}, defaulting to OpenAI`);
      return openai('gpt-4o');
  }
}

/**
 * Determine if a model supports thinking mode (extended reasoning)
 */
function supportsThinkingMode(modelId: string): boolean {
  // Claude 3.7+ and Claude 4 models support thinking mode
  const thinkingModels = [
    'claude-3-7-sonnet-20250219',
    'claude-sonnet-4-20250514', 
    'claude-opus-4-20250514'
  ];
  
  return thinkingModels.includes(modelId) || 
         modelId.includes('claude-3-7') || 
         modelId.includes('claude-4');
}

/**
 * Get provider-specific parameters for generateObject calls
 */
function getProviderSpecificObjectParams(provider: string, modelId: string, options: GenerateObjectOptions) {
  const baseParams = {
    schema: options.schema,
    prompt: options.prompt,
    system: options.systemPrompt,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2000,
    maxRetries: options.maxRetries ?? 3
  };

  switch (provider) {
    case 'openai':
      // OpenAI requires mode: 'json' for structured generation
      return {
        ...baseParams,
        mode: 'json' as const
      };
      
    case 'anthropic':
      // Anthropic supports thinking mode for advanced models
      if (supportsThinkingMode(modelId)) {
        return {
          ...baseParams,
          providerOptions: {
            anthropic: {
              thinking: { 
                type: "enabled" as const, 
                budgetTokens: 12000 
              }
            }
          }
        };
      }
      return baseParams;
      
    default:
      return baseParams;
  }
}

/**
 * Get provider-specific parameters for generateText calls
 */
function getProviderSpecificTextParams(provider: string, modelId: string, options: GenerateTextOptions) {
  const baseParams = {
    prompt: options.prompt,
    system: options.systemPrompt,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2000
  };

  switch (provider) {
    case 'anthropic':
      // Anthropic supports thinking mode for advanced models
      if (supportsThinkingMode(modelId)) {
        return {
          ...baseParams,
          providerOptions: {
            anthropic: {
              thinking: { 
                type: "enabled" as const, 
                budgetTokens: 12000 
              }
            }
          }
        };
      }
      return baseParams;
      
    default:
      return baseParams;
  }
}

/**
 * 🌟 CENTRALIZED MODEL CALLER: generateObject with automatic provider handling
 * 
 * This function automatically handles:
 * - OpenAI: mode: 'json' parameter for structured generation
 * - Anthropic: thinking mode for Claude 3.7+ and Claude 4 models
 * - Model instance creation
 * - Provider detection
 * - Error handling with provider context
 */
export async function callModelForObject<T>(
  modelId: string,
  options: GenerateObjectOptions
): Promise<{ object: T; usage?: any }> {
  try {
    const provider = getModelProvider(modelId);
    const modelInstance = createModelInstance(provider, modelId);
    const providerParams = getProviderSpecificObjectParams(provider, modelId, options);

    console.log(`🤖 Model Caller: Calling ${provider}/${modelId} for structured generation`);
    
    const result = await generateObject({
      model: modelInstance,
      ...providerParams
    });

    console.log(`✅ Model Caller: Successfully generated object from ${provider}/${modelId}`);
    
    return {
      object: result.object as T,
      usage: result.usage
    };

  } catch (error) {
    const provider = getModelProvider(modelId);
    console.error(`❌ Model Caller: ${provider}/${modelId} object generation failed:`, error);
    throw new Error(`${provider} object generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 🌟 CENTRALIZED MODEL CALLER: generateText with automatic provider handling
 * 
 * This function automatically handles:
 * - Anthropic: thinking mode for Claude 3.7+ and Claude 4 models
 * - Model instance creation
 * - Provider detection
 * - Error handling with provider context
 */
export async function callModelForText(
  modelId: string,
  options: GenerateTextOptions
): Promise<{ text: string; usage?: any; finishReason?: string }> {
  try {
    const provider = getModelProvider(modelId);
    const modelInstance = createModelInstance(provider, modelId);
    const providerParams = getProviderSpecificTextParams(provider, modelId, options);

    console.log(`🤖 Model Caller: Calling ${provider}/${modelId} for text generation`);
    
    const result = await generateText({
      model: modelInstance,
      ...providerParams
    });

    console.log(`✅ Model Caller: Successfully generated text from ${provider}/${modelId}`);
    
    return {
      text: result.text,
      usage: result.usage,
      finishReason: result.finishReason
    };

  } catch (error) {
    const provider = getModelProvider(modelId);
    console.error(`❌ Model Caller: ${provider}/${modelId} text generation failed:`, error);
    throw new Error(`${provider} text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 🌟 UTILITY: Check if a model/provider combination is valid
 */
export function validateModelSelection(modelId: string): {
  isValid: boolean;
  provider: string;
  supportsThinking: boolean;
  error?: string;
} {
  try {
    const provider = getModelProvider(modelId);
    const supportsThinking = supportsThinkingMode(modelId);
    
    return {
      isValid: true,
      provider,
      supportsThinking,
    };
  } catch (error) {
    return {
      isValid: false,
      provider: 'unknown',
      supportsThinking: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
} 