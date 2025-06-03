// AI Model Configuration Manager
// Centralized management of AI models and their configurations

import defaultModels from './default-models.json';

// Type definitions
export interface ModelInfo {
  id: string;
  name: string;
  maxTokens: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  capabilities: string[];
  recommended: string[];
}

export interface ProviderInfo {
  name: string;
  baseUrl: string;
  models: Record<string, ModelInfo>;
}

export interface ProcessConfig {
  description: string;
  primary: {
    provider: string;
    model: string;
    reason: string;
  };
  fallback: {
    provider: string;
    model: string;
    reason: string;
  };
  streaming: boolean;
  temperature: number;
  maxTokens: number;
}

export interface ModelConfiguration {
  version: string;
  lastUpdated: string;
  description: string;
  providers: Record<string, ProviderInfo>;
  processModels: Record<string, ProcessConfig>;
  environments: Record<string, any>;
  features: Record<string, any>;
  limits: any;
}

// Load configuration
const config: ModelConfiguration = defaultModels as ModelConfiguration;

// Current environment
const currentEnv = process.env.NODE_ENV || 'development';

/**
 * Get model configuration for a specific process
 */
export function getProcessConfig(processName: string): ProcessConfig | null {
  const processConfig = config.processModels[processName];
  if (!processConfig) {
    console.warn(`Process configuration not found: ${processName}`);
    return null;
  }

  // Apply environment overrides if they exist
  const envConfig = config.environments[currentEnv];
  if (envConfig?.modelOverrides?.[processName]) {
    const override = envConfig.modelOverrides[processName];
    return {
      ...processConfig,
      primary: {
        ...processConfig.primary,
        provider: override.provider || processConfig.primary.provider,
        model: override.model || processConfig.primary.model,
        reason: override.reason || processConfig.primary.reason
      }
    };
  }

  return processConfig;
}

/**
 * Get model information for a specific provider and model
 */
export function getModelInfo(provider: string, modelKey: string): ModelInfo | null {
  const providerConfig = config.providers[provider];
  if (!providerConfig) {
    console.warn(`Provider not found: ${provider}`);
    return null;
  }

  const modelInfo = providerConfig.models[modelKey];
  if (!modelInfo) {
    console.warn(`Model not found: ${modelKey} for provider ${provider}`);
    return null;
  }

  return modelInfo;
}

/**
 * Get the primary model configuration for a process
 */
export function getPrimaryModel(processName: string): {
  provider: string;
  model: string;
  modelInfo: ModelInfo;
  config: ProcessConfig;
} | null {
  const processConfig = getProcessConfig(processName);
  if (!processConfig) return null;

  const modelInfo = getModelInfo(processConfig.primary.provider, processConfig.primary.model);
  if (!modelInfo) return null;

  return {
    provider: processConfig.primary.provider,
    model: processConfig.primary.model,
    modelInfo,
    config: processConfig
  };
}

/**
 * Get the fallback model configuration for a process
 */
export function getFallbackModel(processName: string): {
  provider: string;
  model: string;
  modelInfo: ModelInfo;
  config: ProcessConfig;
} | null {
  const processConfig = getProcessConfig(processName);
  if (!processConfig) return null;

  const modelInfo = getModelInfo(processConfig.fallback.provider, processConfig.fallback.model);
  if (!modelInfo) return null;

  return {
    provider: processConfig.fallback.provider,
    model: processConfig.fallback.model,
    modelInfo,
    config: processConfig
  };
}

/**
 * Get all available providers
 */
export function getProviders(): Record<string, ProviderInfo> {
  return config.providers;
}

/**
 * Get all available processes
 */
export function getProcesses(): Record<string, ProcessConfig> {
  return config.processModels;
}

/**
 * Calculate estimated cost for a request
 */
export function calculateCost(
  provider: string,
  modelKey: string,
  inputTokens: number,
  outputTokens: number
): number {
  const modelInfo = getModelInfo(provider, modelKey);
  if (!modelInfo) return 0;

  const inputCost = (inputTokens / 1000) * modelInfo.costPer1kTokens.input;
  const outputCost = (outputTokens / 1000) * modelInfo.costPer1kTokens.output;
  
  return inputCost + outputCost;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(featureName: string): boolean {
  return config.features[featureName]?.enabled || false;
}

/**
 * Get rate limiting configuration
 */
export function getRateLimits(): any {
  return config.limits.rateLimiting;
}

/**
 * Get timeout configuration
 */
export function getTimeout(): number {
  return config.limits.timeoutSeconds * 1000; // Convert to milliseconds
}

/**
 * Get max retries configuration
 */
export function getMaxRetries(): number {
  return config.limits.maxRetries;
}

/**
 * Validate if a model supports a specific capability
 */
export function supportsCapability(
  provider: string,
  modelKey: string,
  capability: string
): boolean {
  const modelInfo = getModelInfo(provider, modelKey);
  if (!modelInfo) return false;
  
  return modelInfo.capabilities.includes(capability);
}

/**
 * Get recommended models for a specific use case
 */
export function getRecommendedModels(useCase: string): Array<{
  provider: string;
  model: string;
  modelInfo: ModelInfo;
}> {
  const recommendations: Array<{
    provider: string;
    model: string;
    modelInfo: ModelInfo;
  }> = [];

  Object.entries(config.providers).forEach(([providerName, providerInfo]) => {
    Object.entries(providerInfo.models).forEach(([modelKey, modelInfo]) => {
      if (modelInfo.recommended.includes(useCase)) {
        recommendations.push({
          provider: providerName,
          model: modelKey,
          modelInfo
        });
      }
    });
  });

  // Sort by cost (cheapest first)
  return recommendations.sort((a, b) => 
    a.modelInfo.costPer1kTokens.input - b.modelInfo.costPer1kTokens.input
  );
}

/**
 * Get model configuration summary for debugging
 */
export function getConfigSummary(): {
  version: string;
  environment: string;
  totalProviders: number;
  totalModels: number;
  totalProcesses: number;
  enabledFeatures: string[];
} {
  const totalModels = Object.values(config.providers)
    .reduce((sum, provider) => sum + Object.keys(provider.models).length, 0);

  const enabledFeatures = Object.entries(config.features)
    .filter(([_, feature]) => feature.enabled)
    .map(([name, _]) => name);

  return {
    version: config.version,
    environment: currentEnv,
    totalProviders: Object.keys(config.providers).length,
    totalModels,
    totalProcesses: Object.keys(config.processModels).length,
    enabledFeatures
  };
}

/**
 * Export the raw configuration for advanced use cases
 */
export { config as rawConfig };

// Default export for convenience
export default {
  getProcessConfig,
  getModelInfo,
  getPrimaryModel,
  getFallbackModel,
  getProviders,
  getProcesses,
  calculateCost,
  isFeatureEnabled,
  getRateLimits,
  getTimeout,
  getMaxRetries,
  supportsCapability,
  getRecommendedModels,
  getConfigSummary,
  config
};

// Function to get all available models for UI display
export function getAvailableModelsForUI(): Array<{ id: string; name: string; provider: string }> {
  try {
    const providers = config.providers;
    const availableModels: Array<{ id: string; name: string; provider: string }> = [];
    
    // Extract OpenAI models
    if (providers.openai && providers.openai.models) {
      Object.entries(providers.openai.models).forEach(([key, model]) => {
        // Skip deprecated models unless specifically needed
        if (!('deprecated' in model) || !model.deprecated) {
          availableModels.push({
            id: model.id,
            name: model.name,
            provider: 'openai'
          });
        }
      });
    }
    
    // Extract Anthropic models
    if (providers.anthropic && providers.anthropic.models) {
      Object.entries(providers.anthropic.models).forEach(([key, model]) => {
        // Skip deprecated models unless specifically needed
        if (!('deprecated' in model) || !model.deprecated) {
          availableModels.push({
            id: model.id,
            name: model.name,
            provider: 'anthropic'
          });
        }
      });
    }
    
    // Sort models by provider first, then by name for better organization
    availableModels.sort((a, b) => {
      if (a.provider !== b.provider) {
        // OpenAI first, then Anthropic
        return a.provider === 'openai' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    console.log('📋 Available models for UI:', availableModels);
    return availableModels;
    
  } catch (error) {
    console.error('Error loading available models for UI:', error);
    // Fallback to basic models if config loading fails
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic' }
    ];
  }
}

// Function to get model provider from model ID
export function getModelProvider(modelId: string): 'openai' | 'anthropic' | 'unknown' {
  try {
    const providers = config.providers;
    
    // Check OpenAI models
    if (providers.openai && providers.openai.models) {
      for (const model of Object.values(providers.openai.models)) {
        if (model.id === modelId) {
          return 'openai';
        }
      }
    }
    
    // Check Anthropic models
    if (providers.anthropic && providers.anthropic.models) {
      for (const model of Object.values(providers.anthropic.models)) {
        if (model.id === modelId) {
          return 'anthropic';
        }
      }
    }
    
    // Fallback detection based on common prefixes
    if (modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4') || modelId.startsWith('chatgpt-')) {
      return 'openai';
    } else if (modelId.startsWith('claude-')) {
      return 'anthropic';
    }
    
    return 'unknown';
  } catch (error) {
    console.error('Error determining model provider:', error);
    return 'unknown';
  }
} 