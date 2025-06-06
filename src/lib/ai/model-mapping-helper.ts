import type { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

/**
 * Helper function to determine which model a specific agent should use
 * based on the TCC's agentModelMapping and selectedModel fallback
 */
export function getModelForAgent(
  agentName: string, 
  tcc: ToolConstructionContext
): string | undefined {
  // First priority: Check if there's a specific mapping for this agent
  if (tcc.agentModelMapping && tcc.agentModelMapping[agentName]) {
    return tcc.agentModelMapping[agentName];
  }
  
  // Second priority: Use the global selectedModel as fallback
  if (tcc.selectedModel && tcc.selectedModel !== 'default') {
    return tcc.selectedModel;
  }
  
  // Let the agent use its own default configuration
  return undefined;
}

/**
 * Maps agent path names to standard agent names used in agentModelMapping
 */
export function getAgentNameFromPath(agentPath: string): string {
  const pathToAgentMap: Record<string, string> = {
    'function-planner': 'function-planner',
    'state-design': 'state-design', 
    'jsx-layout': 'jsx-layout',
    'tailwind-styling': 'tailwind-styling',
    'component-assembler': 'component-assembler',
    'validator': 'validator',
    'tool-finalizer': 'tool-finalizer'
  };
  
  return pathToAgentMap[agentPath] || agentPath;
} 