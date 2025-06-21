/**
 * Model Manager (Phase 1.2 - Core Infrastructure)
 * Unified model configuration and selection logic
 */

import { 
  ModelConfiguration, 
  AgentType, 
  AgentExecutionContext 
} from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { getModelProvider, getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

export function createModelConfiguration(
  modelId: string,
  provider?: string
): ModelConfiguration {
  const resolvedProvider = provider || getModelProvider(modelId);
  
  return {
    provider: resolvedProvider as 'openai' | 'anthropic',
    modelId,
    temperature: 0.7,
    maxTokens: 4000,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0
  };
}

export function resolveAgentModel(
  agentType: AgentType,
  tcc: ToolConstructionContext,
  selectedModel?: string
): string {
  // Priority 1: TCC agent model mapping
  if (tcc.agentModelMapping?.[agentType]) {
    logger.info({
      agentType,
      modelId: tcc.agentModelMapping[agentType],
      source: 'TCC_AGENT_MAPPING'
    }, 'Using model from TCC agent mapping');
    return tcc.agentModelMapping[agentType];
  }

  // Priority 2: User-selected model
  if (selectedModel && selectedModel !== 'default') {
    logger.info({
      agentType,
      modelId: selectedModel,
      source: 'USER_SELECTED'
    }, 'Using user-selected model');
    return selectedModel;
  }

  // Priority 3: Primary model
  const primaryModel = getPrimaryModel();
  logger.info({
    agentType,
    modelId: primaryModel,
    source: 'PRIMARY_MODEL'
  }, 'Using primary model');
  return primaryModel;
}

export function createAgentExecutionContext(
  agentType: AgentType,
  jobId: string,
  tcc: ToolConstructionContext,
  selectedModel?: string,
  isIsolatedTest: boolean = false
): AgentExecutionContext {
  const modelId = resolveAgentModel(agentType, tcc, selectedModel);
  const modelConfig = createModelConfiguration(modelId);

  return {
    agentType,
    jobId,
    userId: tcc.userId,
    modelConfig,
    isIsolatedTest,
    editMode: tcc.editModeContext,
    timeout: getAgentTimeout(agentType),
    retryConfig: {
      maxAttempts: 3,
      backoffMultiplier: 2,
      baseDelay: 1000
    }
  };
}

function getAgentTimeout(agentType: AgentType): number {
  const timeouts: Record<AgentType, number> = {
    'function-planner': 30000,    // 30 seconds
    'state-design': 45000,        // 45 seconds
    'jsx-layout': 40000,          // 40 seconds
    'tailwind-styling': 35000,    // 35 seconds
    'component-assembler': 60000, // 60 seconds
    'code-validator': 25000,      // 25 seconds
    'tool-finalizer': 30000       // 30 seconds
  };

  return timeouts[agentType] || 30000;
}

export function getOptimalModelForAgent(agentType: AgentType): string {
  // Agent-specific model optimization
  const agentModelPreferences: Record<AgentType, string> = {
    'function-planner': 'gpt-4o',           // Good at architectural planning
    'state-design': 'gpt-4o',               // Excellent at code structure
    'jsx-layout': 'claude-3-5-sonnet-20241022', // Great at UI composition
    'tailwind-styling': 'claude-3-5-sonnet-20241022', // Excellent at CSS/styling
    'component-assembler': 'gpt-4o',        // Good at code integration
    'code-validator': 'gpt-4o',             // Strong at code analysis
    'tool-finalizer': 'gpt-4o'              // Good at finalizing and formatting
  };

  return agentModelPreferences[agentType] || getPrimaryModel();
}
