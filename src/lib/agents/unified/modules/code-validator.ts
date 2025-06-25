/**
 * Code Validator Unified Module (Phase 1.2 - Refactored for Centralized Execution)
 * Conforms to the new simplified agent module structure.
 */

import { z } from 'zod';
import { 
  CodeValidatorResult,
} from '../../../types/tcc-unified';
import { 
  BaseAgentModule
} from '../core/base-agent-module';
import { ValidationResult } from '../../../types/tcc-unified';

/**
 * Zod schema for the Code Validator's output.
 */
const CodeValidatorResultSchema = z.object({
  validationResult: z.object({
    isValid: z.boolean(),
    syntaxErrors: z.array(z.string()),
    typeErrors: z.array(z.string()),
    warnings: z.array(z.string()),
    suggestions: z.array(z.string()),
    dependencies: z.array(z.string()),
    complexity: z.number()
  }),
  metadata: z.object({
    issuesFound: z.number(),
    securityScore: z.number(),
    performanceScore: z.number()
  })
});

/**
 * CodeValidatorModule - Now a configuration and validation provider.
 */
export class CodeValidatorModule extends BaseAgentModule {
  constructor() {
    super('code-validator', 20000); // 20 second timeout
  }

  /**
   * Exposes the Zod schema for this agent's output.
   */
  getOutputSchema(): z.ZodSchema<any> {
    return CodeValidatorResultSchema;
  }

  /**
   * Validate the code validator's structured output.
   */
  validate(output: CodeValidatorResult): ValidationResult {
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
      score: Math.max(0, score),
      missingFields: []
    };
  }

  /**
   * Define the required TCC fields for this agent.
   * 🔄 UPDATED: Now looks at assembledComponentCode from Phase 2 JSX assembly
   */
  getRequiredInputFields(): string[] {
    return [
      'assembledComponentCode'
    ];
  }

  /**
   * Support edit mode
   */
  supportsEditMode(): boolean {
    return false; // Validator doesn't need edit mode
  }

  /**
   * Provide a description for logging.
   * 🔄 UPDATED: Now optimized for JSX validation from Phase 2
   */
  protected getAgentDescription(): string {
    return 'Validates JSX component code for syntax errors, React hooks usage, security issues, and performance problems with intelligent suggestions.';
  }
}
