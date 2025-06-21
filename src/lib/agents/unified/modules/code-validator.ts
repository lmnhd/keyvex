/**
 * Code Validator Unified Module (Phase 1.2)
 * Properly extends BaseAgentModule - NO GENERIC TYPES!
 */

import { 
  AgentExecutionContext, 
  CodeValidatorResult,
  AgentType
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import { BaseAgentModule, AgentExecutionInput, BaseValidationResult } from '../core/base-agent-module';
import { validateComponent } from '../../../../app/api/ai/product-tool-creation-v2/agents/validator/core-logic';

/**
 * ValidationResult interface matching the actual structure
 */
interface ValidationResultStructure {
  isValid: boolean;
  syntaxErrors: string[];
  typeErrors: string[];
  warnings: string[];
  suggestions: string[];
  dependencies: string[];
  complexity: number;
}

/**
 * CodeValidatorModule - Validates and auto-corrects generated component code
 */
export class CodeValidatorModule extends BaseAgentModule {
  constructor() {
    super('code-validator' as AgentType, 20000); // 20 second timeout
  }

  /**
   * Execute code validation and auto-correction
   */
  async execute(
    context: AgentExecutionContext,
    input: AgentExecutionInput
  ): Promise<CodeValidatorResult> {
    this.logExecution(context, 'start', {
      hasTcc: !!input.tcc,
      hasFinalProduct: !!input.tcc.finalProduct
    });

    try {
      // Validate required inputs
      const validation = this.validateRequired(input.tcc, this.getRequiredInputFields());
      if (!validation.isValid) {
        throw new Error(`Missing required fields: ${validation.missingFields.join(', ')}`);
      }

      // Use existing core logic
      const result = await validateComponent({
        jobId: context.jobId,
        selectedModel: context.modelConfig.modelId,
        tcc: input.tcc
      });

      if (!result.success) {
        throw new Error(result.error || 'Code validation execution failed');
      }

      // Convert to unified result format with NO GENERIC TYPES
      const validationResult: CodeValidatorResult = {
        validationResult: result.validationResult!,
        metadata: {
          issuesFound: this.countValidationIssues(result.validationResult! as ValidationResultStructure),
          securityScore: this.calculateSecurityScore(result.validationResult! as ValidationResultStructure),
          performanceScore: this.calculatePerformanceScore(result.validationResult! as ValidationResultStructure)
        }
      };

      this.logExecution(context, 'success', {
        issuesFound: validationResult.metadata.issuesFound,
        securityScore: validationResult.metadata.securityScore,
        performanceScore: validationResult.metadata.performanceScore,
        autoCorrectionApplied: !!result.autoCorrectedCode
      });

      return validationResult;
    } catch (error) {
      this.handleExecutionError(context, error, 'code validation');
    }
  }

  /**
   * Validate validation result (meta-validation)
   */
  validate(output: CodeValidatorResult): BaseValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required validation fields
    if (!output.validationResult) {
      errors.push('Missing validation result object');
      score -= 50;
    } else {
      if (output.validationResult.isValid === undefined) {
        errors.push('Missing isValid field in validation result');
        score -= 20;
      }
    }

    // Check metadata
    if (!output.metadata) {
      warnings.push('Missing metadata');
      score -= 5;
    } else {
      if (output.metadata.issuesFound > 10) {
        warnings.push('High number of validation issues found');
        score -= 10;
      }

      if (output.metadata.securityScore < 70) {
        warnings.push('Low security score detected');
        score -= 15;
      }

      if (output.metadata.performanceScore < 70) {
        warnings.push('Low performance score detected');
        score -= 10;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Get required input fields
   */
  getRequiredInputFields(): string[] {
    return [
      'finalProduct.componentCode'
    ];
  }

  /**
   * Get agent description
   */
  protected getAgentDescription(): string {
    return 'Validates component code for syntax errors, security issues, and performance problems with auto-correction';
  }

  /**
   * Support edit mode
   */
  supportsEditMode(): boolean {
    return false; // Validator doesn't need edit mode
  }

  /**
   * Private helper: Count validation issues
   */
  private countValidationIssues(validationResult: ValidationResultStructure): number {
    const syntaxErrorsCount = (validationResult.syntaxErrors?.length || 0);
    const typeErrorsCount = (validationResult.typeErrors?.length || 0);
    const warningsCount = (validationResult.warnings?.length || 0);
    return syntaxErrorsCount + typeErrorsCount + warningsCount;
  }

  /**
   * Private helper: Calculate security score
   */
  private calculateSecurityScore(validationResult: ValidationResultStructure): number {
    const allIssues = [
      ...(validationResult.syntaxErrors || []),
      ...(validationResult.typeErrors || []),
      ...(validationResult.warnings || [])
    ];
    
    const hasSecurityIssues = allIssues.some((issue: string) => 
      issue.toLowerCase().includes('security') || 
      issue.toLowerCase().includes('xss') || 
      issue.toLowerCase().includes('injection') ||
      issue.toLowerCase().includes('unsafe')
    );
    
    return hasSecurityIssues ? 60 : 95;
  }

  /**
   * Private helper: Calculate performance score
   */
  private calculatePerformanceScore(validationResult: ValidationResultStructure): number {
    const allIssues = [
      ...(validationResult.syntaxErrors || []),
      ...(validationResult.typeErrors || []),
      ...(validationResult.warnings || [])
    ];
    
    const hasPerformanceIssues = allIssues.some((issue: string) => 
      issue.toLowerCase().includes('performance') || 
      issue.toLowerCase().includes('slow') || 
      issue.toLowerCase().includes('memory') ||
      issue.toLowerCase().includes('inefficient')
    );
    
    return hasPerformanceIssues ? 70 : 90;
  }
}
