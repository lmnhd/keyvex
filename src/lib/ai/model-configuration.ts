/**
 * Model Configuration Utilities (Centralized)
 * Single source of truth for all model configuration types and utilities
 * 
 * ✅ CENTRALIZED: Moved from scattered imports across multiple files
 * Now all model configuration logic is in one place
 */

// Model Configuration Interface
export interface ModelConfiguration {
  provider: 'openai' | 'anthropic';
  modelId: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

// Default configurations for different use cases
export const DEFAULT_MODEL_CONFIGS = {
  AGENT_EXECUTION: {
    temperature: 0.2,
    maxTokens: 4000,
    topP: 0.9
  },
  CREATIVE_GENERATION: {
    temperature: 0.7,
    maxTokens: 6000,
    topP: 0.9
  },
  CONSERVATIVE_VALIDATION: {
    temperature: 0.1,
    maxTokens: 2000,
    topP: 0.8
  }
} as const;

// Model provider utilities
export function isAnthropicModel(modelId: string): boolean {
  return modelId.includes('claude') || modelId.startsWith('anthropic');
}

export function isOpenAIModel(modelId: string): boolean {
  return modelId.includes('gpt') || modelId.startsWith('openai') || modelId.includes('o1');
}

export function getProviderFromModelId(modelId: string): 'openai' | 'anthropic' {
  if (isAnthropicModel(modelId)) return 'anthropic';
  if (isOpenAIModel(modelId)) return 'openai';
  
  // Default fallback
  return 'openai';
}

// Create a model configuration with defaults
export function createModelConfig(
  modelId: string,
  overrides?: Partial<ModelConfiguration>
): ModelConfiguration {
  const provider = getProviderFromModelId(modelId);
  const defaults = DEFAULT_MODEL_CONFIGS.AGENT_EXECUTION;
  
  return {
    provider,
    modelId,
    temperature: defaults.temperature,
    maxTokens: defaults.maxTokens,
    topP: defaults.topP,
    ...overrides
  };
}

// Validate model configuration
export function validateModelConfig(config: ModelConfiguration): { 
  isValid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  if (!config.modelId) {
    errors.push('modelId is required');
  }
  
  if (config.temperature < 0 || config.temperature > 2) {
    errors.push('temperature must be between 0 and 2');
  }
  
  if (config.maxTokens < 1 || config.maxTokens > 32000) {
    errors.push('maxTokens must be between 1 and 32000');
  }
  
  if (config.topP && (config.topP < 0 || config.topP > 1)) {
    errors.push('topP must be between 0 and 1');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
} 