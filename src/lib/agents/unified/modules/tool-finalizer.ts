/**
 * Tool Finalizer Unified Module (Phase 1.2)
 * Extracted logic for the unified agent system
 */

import { AgentExecutionContext, ToolFinalizerResult } from '@/lib/types/tcc-unified';
import { ToolConstructionContext, FinalProductToolDefinition } from '@/lib/types/product-tool-creation-v2/tcc';
import { finalizeTool } from '@/app/api/ai/product-tool-creation-v2/agents/tool-finalizer/core-logic';

export async function executeToolFinalizer(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<ToolFinalizerResult> {
  // Use existing core logic
  const result = await finalizeTool({
    jobId: context.jobId,
    selectedModel: context.modelConfig.modelId,
    tcc
  });

  if (!result.success) {
    throw new Error(result.error || 'Tool finalizer execution failed');
  }

  // Convert to unified result format
  return {
    finalProduct: result.finalProduct as FinalProductToolDefinition,
    metadata: {
      completionTime: calculateCompletionTime(),
      qualityScore: calculateQualityScore(result.finalProduct as FinalProductToolDefinition),
      readinessLevel: determineReadinessLevel(result.finalProduct as FinalProductToolDefinition)
    }
  };
}

function calculateCompletionTime(): string {
  // Simple completion time calculation
  return new Date().toISOString();
}

function calculateQualityScore(finalProduct: FinalProductToolDefinition): number {
  // Simple quality scoring based on completeness
  let score = 0;
  
  if (finalProduct.componentCode) score += 30;
  if (finalProduct.metadata) score += 20;
  if (finalProduct.colorScheme) score += 20;
  if (finalProduct.analytics) score += 15;
  if (finalProduct.currentStyleMap) score += 15;
  
  return score;
}

function determineReadinessLevel(finalProduct: FinalProductToolDefinition): 'development' | 'staging' | 'production' {
  const qualityScore = calculateQualityScore(finalProduct);
  
  if (qualityScore >= 90) return 'production';
  if (qualityScore >= 70) return 'staging';
  return 'development';
}
