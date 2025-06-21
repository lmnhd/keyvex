/**
 * Component Assembler Unified Module (Phase 1.2)
 * Extracted logic for the unified agent system
 */

import { AgentExecutionContext, ComponentAssemblerResult } from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { assembleComponent } from '@/app/api/ai/product-tool-creation-v2/agents/component-assembler/core-logic';

export async function executeComponentAssembler(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<ComponentAssemblerResult> {
  // Use existing core logic
  const result = await assembleComponent({
    jobId: context.jobId,
    selectedModel: context.modelConfig.modelId,
    tcc
  });

  if (!result.success) {
    throw new Error(result.error || 'Component assembler execution failed');
  }

  // Convert to unified result format
  return {
    assembledCode: result.assembledComponent?.finalComponentCode || '',
    metadata: {
      codeLength: result.assembledComponent?.finalComponentCode?.length || 0,
      estimatedRenderTime: estimateRenderTime(result.assembledComponent?.finalComponentCode || ''),
      bundleSize: estimateBundleSize(result.assembledComponent?.finalComponentCode || '')
    }
  };
}

function estimateRenderTime(code: string): string {
  const complexity = Math.floor(code.length / 1000); // Rough complexity based on code length
  return `${Math.max(1, complexity)} ms`;
}

function estimateBundleSize(code: string): string {
  const sizeInKB = Math.ceil(code.length / 1024);
  return `${sizeInKB} KB`;
}
