// File Path: keyvex_app/src/lib/ai/models/model-config.ts
// Minimal implementation to resolve import errors from unified agent modules

interface ModelInfo {
  id: string;
  name: string;
}

interface ModelConfig {
  modelInfo: ModelInfo;
  provider: string;
}

interface ModelResult {
  modelInfo: ModelInfo;
  provider: string;
}

export function getPrimaryModel(agentName: string): ModelResult | null {
  // Default configurations for known agents
  const defaultConfigs: Record<string, ModelResult> = {
    functionPlanner: {
      modelInfo: { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      provider: 'anthropic'
    },
    stateDesigner: {
      modelInfo: { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      provider: 'anthropic'
    },
    jsxLayoutDesigner: {
      modelInfo: { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      provider: 'anthropic'
    },
    tailwindStylist: {
      modelInfo: { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      provider: 'anthropic'
    },
    componentAssembler: {
      modelInfo: { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      provider: 'anthropic'
    },
    validator: {
      modelInfo: { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      provider: 'anthropic'
    },
    toolFinalizer: {
      modelInfo: { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      provider: 'anthropic'
    },
    toolCreator: {
      modelInfo: { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      provider: 'anthropic'
    },
    logicArchitect: {
      modelInfo: { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      provider: 'anthropic'
    }
  };

  return defaultConfigs[agentName] || null;
}

export function getFallbackModel(agentName: string): ModelResult | null {
  // All agents use Claude 4 Sonnet as fallback
  return {
    modelInfo: { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet' },
    provider: 'anthropic'
  };
}

export function getModelProvider(modelId: string): string {
  // Simple provider detection based on model ID patterns
  if (modelId.includes('claude')) return 'anthropic';
  if (modelId.includes('gpt')) return 'openai';
  if (modelId.includes('o1')) return 'openai';
  if (modelId.includes('text-')) return 'openai';
  return 'openai'; // Default fallback
}

// ---------------------------------------------------------------------------
// Convenience helpers for existing admin UI code ----------------------------
// ---------------------------------------------------------------------------

export function getProcesses(): Record<string, boolean> {
  return {
    functionPlanner: true,
    stateDesigner: true,
    jsxLayoutDesigner: true,
    tailwindStylist: true,
    componentAssembler: true,
    validator: true,
    toolFinalizer: true,
  };
}

export function getProviders(): Record<string, boolean> {
  return {
    anthropic: true,
    openai: true,
  };
}

// Default export (legacy compatibility) ------------------------------------
const modelConfig = {
  getPrimaryModel,
  getFallbackModel,
  getModelProvider,
  getProcesses,
  getProviders,
};
export default modelConfig;
