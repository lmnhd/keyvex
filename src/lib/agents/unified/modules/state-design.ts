/**
 * State Design Unified Module (Phase 1.2)
 * Extracted logic for the unified agent system
 */

import { AgentExecutionContext, StateDesignResult } from '@/lib/types/tcc-unified';
import { ToolConstructionContext, StateLogic } from '@/lib/types/product-tool-creation-v2/tcc';
import { designStateLogic } from '@/app/api/ai/product-tool-creation-v2/agents/state-design/core-logic';

export async function executeStateDesign(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<StateDesignResult> {
  // Use existing core logic
  const result = await designStateLogic({
    jobId: context.jobId,
    selectedModel: context.modelConfig.modelId,
    tcc,
    isIsolatedTest: context.isIsolatedTest,
    editMode: context.editMode ? {
      isEditMode: context.editMode.isEditMode,
      instructions: context.editMode.activeEditInstructions || [],
      context: 'unified_agent_execution'
    } : undefined
  });

  if (!result.success) {
    throw new Error(result.error || 'State design execution failed');
  }

  // Convert to unified result format
  return {
    stateLogic: result.stateLogic as StateLogic,
    metadata: {
      stateVariableCount: result.stateLogic?.variables?.length || 0,
      functionCount: result.stateLogic?.functions?.length || 0,
      complexityScore: calculateComplexityScore(result.stateLogic as StateLogic)
    }
  };
}

function calculateComplexityScore(stateLogic: StateLogic): number {
  const variableCount = stateLogic?.variables?.length || 0;
  const functionCount = stateLogic?.functions?.length || 0;
  
  // Simple complexity scoring: variables * 2 + functions * 3
  return (variableCount * 2) + (functionCount * 3);
}
