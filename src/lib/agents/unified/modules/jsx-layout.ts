/**
 * JSX Layout Unified Module (Phase 1.2)
 * Extracted logic for the unified agent system
 */

import { AgentExecutionContext, JsxLayoutResult } from '@/lib/types/tcc-unified';
import { ToolConstructionContext, JsxLayout } from '@/lib/types/product-tool-creation-v2/tcc';
import { designJsxLayout } from '@/app/api/ai/product-tool-creation-v2/agents/jsx-layout/core-logic';

export async function executeJSXLayout(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<JsxLayoutResult> {
  // Use existing core logic
  const result = await designJsxLayout({
    jobId: context.jobId,
    selectedModel: context.modelConfig.modelId,
    tcc,
    isIsolatedTest: context.isIsolatedTest
  });

  if (!result.success) {
    throw new Error(result.error || 'JSX layout execution failed');
  }

  // Convert to unified result format
  return {
    jsxLayout: result.jsxLayout as JsxLayout,
    metadata: {
      componentCount: result.jsxLayout?.elementMap?.length || 0,
      nestingDepth: calculateNestingDepth(result.jsxLayout?.componentStructure || ''),
      accessibilityScore: calculateAccessibilityScore(result.jsxLayout as JsxLayout)
    }
  };
}

function calculateNestingDepth(componentStructure: string): number {
  const openTags = (componentStructure.match(/</g) || []).length;
  const closeTags = (componentStructure.match(/>/g) || []).length;
  return Math.max(0, Math.floor((openTags + closeTags) / 4));
}

function calculateAccessibilityScore(jsxLayout: JsxLayout): number {
  // Simple accessibility scoring based on presence of accessibility features
  if (jsxLayout?.accessibilityFeatures) {
    return 85; // Good accessibility
  }
  return 60; // Basic accessibility
}
