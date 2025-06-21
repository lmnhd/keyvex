// Model Manager - Dynamic model loading and configuration
// Respects user model choices and provides fallback logic

import { AgentType, AgentModelMapping } from '@/lib/types/tcc-unified';
import { getProviderFactory } from '@/lib/providers/provider-factory';

export interface ModelConfig {
  modelId: string;
  provider: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export class ModelManager {
  private providerFactory: any;

  constructor() {
    this.providerFactory = getProviderFactory();
  }

  async getModelForAgent(
    agent: AgentType, 
    agentModelMapping: AgentModelMapping
  ): Promise<any> {
    try {
      // 1. Get user's selected model for this agent
      const selectedModelId = agentModelMapping[agent];
      
      if (!selectedModelId) {
        throw new Error(`No model selected for agent: ${agent}`);
      }

      // 2. Get model configuration
      const modelConfig = await this.getModelConfig(selectedModelId);
      
      // 3. Get provider instance
      const provider = await this.providerFactory.getProvider(modelConfig.provider);
      
      // 4. Return configured model
      return provider(modelConfig.modelId, {
        maxTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
      });

    } catch (error) {
      console.error(`Failed to get model for agent ${agent}:`, error);
      throw error;
    }
  }

  private async getModelConfig(modelId: string): Promise<ModelConfig> {
    try {
      // Load default models configuration
      const defaultModels = await import('@/lib/models/default-models.json');
      
      // Find the model configuration
      const modelConfig = defaultModels.models.find((m: any) => m.id === modelId);
      
      if (!modelConfig) {
        throw new Error(`Model configuration not found for: ${modelId}`);
      }

      return {
        modelId: modelConfig.id,
        provider: modelConfig.provider,
        maxTokens: modelConfig.maxTokens || 8000,
        temperature: this.getTemperatureForModel(modelId),
        topP: modelConfig.topP || 0.9,
      };

    } catch (error) {
      console.error(`Failed to get model config for ${modelId}:`, error);
      throw error;
    }
  }

  private getTemperatureForModel(modelId: string): number {
    // Agent-specific temperature optimization
    if (modelId.includes('claude-3-7-sonnet') || modelId.includes('claude-4')) {
      return 0.1; // Lower temperature for structured output
    } else if (modelId.includes('gpt-4o')) {
      return 0.2; // Slightly higher for GPT models
    } else {
      return 0.3; // Default temperature
    }
  }

  async validateModelAvailability(agentModelMapping: AgentModelMapping): Promise<{
    isValid: boolean;
    missingModels: AgentType[];
    invalidModels: { agent: AgentType; modelId: string }[];
  }> {
    const missingModels: AgentType[] = [];
    const invalidModels: { agent: AgentType; modelId: string }[] = [];

    for (const [agent, modelId] of Object.entries(agentModelMapping) as [AgentType, string][]) {
      if (!modelId) {
        missingModels.push(agent);
        continue;
      }

      try {
        await this.getModelConfig(modelId);
      } catch (error) {
        invalidModels.push({ agent, modelId });
      }
    }

    return {
      isValid: missingModels.length === 0 && invalidModels.length === 0,
      missingModels,
      invalidModels,
    };
  }

  getRecommendedModelsForAgent(agent: AgentType): string[] {
    // Recommend models based on agent requirements
    const recommendations: Record<AgentType, string[]> = {
      'function-planner': [
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'gpt-4o-2024-11-20'
      ],
      'state-design': [
        'claude-3-7-sonnet-20250219',
        'claude-4-sonnet-20250514',
        'gpt-4o-2024-11-20'
      ],
      'jsx-layout': [
        'claude-3-5-sonnet-20241022',
        'claude-3-7-sonnet-20250219',
        'gpt-4o-2024-11-20'
      ],
      'tailwind-styling': [
        'claude-3-5-sonnet-20241022',
        'gpt-4o-2024-11-20',
        'claude-3-7-sonnet-20250219'
      ],
      'component-assembler': [
        'claude-3-7-sonnet-20250219',
        'claude-4-sonnet-20250514',
        'gpt-4o-2024-11-20'
      ],
      'code-validator': [
        'claude-4-sonnet-20250514',
        'claude-3-7-sonnet-20250219',
        'gpt-4o-2024-11-20'
      ],
      'tool-finalizer': [
        'claude-3-7-sonnet-20250219',
        'claude-4-sonnet-20250514',
        'gpt-4o-2024-11-20'
      ],
    };

    return recommendations[agent] || [];
  }
} 