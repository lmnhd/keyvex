/**
 * Function Planner Unified Module (Phase 1.2)
 * Extracted logic for the unified agent system
 */

import { AgentExecutionContext, FunctionPlannerResult } from '@/lib/types/tcc-unified';
import { ToolConstructionContext, DefinedFunctionSignature } from '@/lib/types/product-tool-creation-v2/tcc';
import { planFunctionSignatures } from '@/app/api/ai/product-tool-creation-v2/agents/function-planner/core-logic';

export async function executeFunctionPlanner(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<FunctionPlannerResult> {
  // Use existing core logic
  const result = await planFunctionSignatures({
    jobId: context.jobId,
    selectedModel: context.modelConfig.modelId,
    tcc,
    isIsolatedTest: context.isIsolatedTest,
    editMode: context.editMode
  });

  if (!result.success) {
    throw new Error(result.error || 'Function planner execution failed');
  }

  // Convert to unified result format
  return {
    functionSignatures: result.functionSignatures || [],
    metadata: {
      totalFunctions: result.functionSignatures?.length || 0,
      complexityLevel: determineFunctionComplexity(result.functionSignatures || []),
      estimatedImplementationTime: estimateImplementationTime(result.functionSignatures || [])
    }
  };
}

function determineFunctionComplexity(signatures: DefinedFunctionSignature[]): 'simple' | 'moderate' | 'complex' {
  if (signatures.length <= 2) return 'simple';
  if (signatures.length <= 5) return 'moderate';
  return 'complex';
}

function estimateImplementationTime(signatures: DefinedFunctionSignature[]): string {
  const baseTime = signatures.length * 2; // 2 minutes per function
  return `${baseTime} minutes`;
}
