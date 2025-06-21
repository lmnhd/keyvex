/**
 * Code Validator Unified Module (Phase 1.2)
 * Extracted logic for the unified agent system
 */

import { AgentExecutionContext, CodeValidatorResult } from '@/lib/types/tcc-unified';
import { ToolConstructionContext, ValidationResult } from '@/lib/types/product-tool-creation-v2/tcc';
import { validateCode } from '@/app/api/ai/product-tool-creation-v2/agents/validator/core-logic';

export async function executeValidator(
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<CodeValidatorResult> {
  // Use existing core logic
  const result = await validateCode({
    jobId: context.jobId,
    selectedModel: context.modelConfig.modelId,
    tcc
  });

  if (!result.success) {
    throw new Error(result.error || 'Code validation execution failed');
  }

  // Convert to unified result format
  return {
    validationResult: result.validationResult as ValidationResult,
    metadata: {
      issuesFound: countValidationIssues(result.validationResult as ValidationResult),
      securityScore: calculateSecurityScore(result.validationResult as ValidationResult),
      performanceScore: calculatePerformanceScore(result.validationResult as ValidationResult)
    }
  };
}

function countValidationIssues(validationResult: ValidationResult): number {
  // Count issues based on validation result structure
  return (validationResult.issues?.length || 0) + (validationResult.warnings?.length || 0);
}

function calculateSecurityScore(validationResult: ValidationResult): number {
  // Simple security scoring based on validation results
  const hasSecurityIssues = validationResult.issues?.some(issue => 
    issue.toLowerCase().includes('security') || 
    issue.toLowerCase().includes('xss') || 
    issue.toLowerCase().includes('injection')
  );
  
  return hasSecurityIssues ? 60 : 95;
}

function calculatePerformanceScore(validationResult: ValidationResult): number {
  // Simple performance scoring based on validation results
  const hasPerformanceIssues = validationResult.issues?.some(issue => 
    issue.toLowerCase().includes('performance') || 
    issue.toLowerCase().includes('slow') || 
    issue.toLowerCase().includes('memory')
  );
  
  return hasPerformanceIssues ? 70 : 90;
}
