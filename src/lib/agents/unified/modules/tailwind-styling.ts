/**
 * Tailwind Styling Unified Module (Phase 1.2)
 * Extracted logic for the unified agent system
 */

import { AgentExecutionContext, TailwindStylingResult } from '@/lib/types/tcc-unified';
import { ToolConstructionContext, Styling } from '@/lib/types/product-tool-creation-v2/tcc';
import { applyStyling } from '@/app/api/ai/product-tool-creation-v2/agents/tailwind-styling/core-logic';

export async function executeTailwindStyling(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<TailwindStylingResult> {
  // Use existing core logic
  const result = await applyStyling({
    jobId: context.jobId,
    selectedModel: context.modelConfig.modelId,
    tcc,
    isIsolatedTest: context.isIsolatedTest
  });

  if (!result.success) {
    throw new Error(result.error || 'Tailwind styling execution failed');
  }

  // Convert to unified result format
  return {
    styling: result.styling as Styling,
    metadata: {
      classCount: countTailwindClasses(result.styling?.styledComponentCode || ''),
      responsiveBreakpoints: extractResponsiveBreakpoints(result.styling?.styledComponentCode || ''),
      colorSchemeType: determineColorSchemeType(result.styling as Styling)
    }
  };
}

function countTailwindClasses(styledCode: string): number {
  const classMatches = styledCode.match(/className="[^"]*"/g) || [];
  let totalClasses = 0;
  
  classMatches.forEach(match => {
    const classes = match.replace(/className="/, '').replace(/"$/, '').split(' ');
    totalClasses += classes.filter(cls => cls.trim().length > 0).length;
  });
  
  return totalClasses;
}

function extractResponsiveBreakpoints(styledCode: string): string[] {
  const breakpoints = new Set<string>();
  const responsiveMatches = styledCode.match(/\b(sm|md|lg|xl|2xl):/g) || [];
  
  responsiveMatches.forEach(match => {
    breakpoints.add(match.replace(':', ''));
  });
  
  return Array.from(breakpoints);
}

function determineColorSchemeType(styling: Styling): string {
  if (styling?.colorScheme) {
    return 'custom';
  }
  return 'default';
}
