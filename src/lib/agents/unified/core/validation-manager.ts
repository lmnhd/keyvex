/**
 * Validation Manager - Result validation and quality assessment (Phase 1.2)
 * Provides intelligent validation logic for all agent results
 */

import { 
  AgentType, 
  ValidationError, 
  ValidationResultEnhanced, 
  FunctionPlannerResult,
  StateDesignResult,
  JsxLayoutResult,
  TailwindStylingResult,
  ComponentAssemblerResult,
  CodeValidatorResult,
  ToolFinalizerResult
} from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/tcc-unified';
import logger from '@/lib/logger';

export class ValidationManager {
  private readonly qualityThresholds = {
    'function-planner': { minScore: 75, minFunctions: 1, maxFunctions: 10 },
    'state-design': { minScore: 80, minVariables: 1, minFunctions: 1 },
    'jsx-layout': { minScore: 70, minComponents: 1, maxNesting: 5 },
    'tailwind-styling': { minScore: 75, minClasses: 10, maxClasses: 200 },
    'component-assembler': { minScore: 85, minCodeLength: 100, maxCodeLength: 10000 },
    'code-validator': { minScore: 90, maxErrors: 0, maxWarnings: 3 },
    'tool-finalizer': { minScore: 95, readinessLevel: 'production' }
  } as const;

  constructor() {}

  /**
   * Validate agent result with comprehensive quality assessment
   */
  validateAgentResult<T>(
    agentType: AgentType,
    result: T,
    tcc: ToolConstructionContext,
    attemptNumber: number = 1
  ): ValidationResultEnhanced {
    const startTime = Date.now();
    
    logger.info({
      agentType,
      jobId: tcc.jobId,
      attemptNumber
    }, '🔍 ValidationManager: Starting agent result validation');

    try {
      const validation = this.performAgentSpecificValidation(agentType, result, tcc);
      const duration = Date.now() - startTime;
      
      logger.info({
        agentType,
        jobId: tcc.jobId,
        overallScore: validation.overallScore,
        passesValidation: validation.passesValidation,
        errorsCount: validation.errors.length,
        warningsCount: validation.warnings.length,
        duration
      }, '🔍 ValidationManager: Validation completed');

      return validation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        agentType,
        jobId: tcc.jobId,
        error: errorMessage
      }, '🔍 ValidationManager: Validation failed');

      return this.createFailedValidation(agentType, errorMessage);
    }
  }

  /**
   * Determine if agent should be retried based on validation results
   */
  shouldRetryAgent(
    agentType: AgentType,
    validation: ValidationResultEnhanced,
    attemptNumber: number,
    maxAttempts: number = 3
  ): {
    shouldRetry: boolean;
    reason: string;
    recommendedDelay: number;
  } {
    // Don't retry if max attempts reached
    if (attemptNumber >= maxAttempts) {
      return {
        shouldRetry: false,
        reason: `Maximum attempts (${maxAttempts}) reached`,
        recommendedDelay: 0
      };
    }

    // Don't retry if validation passes
    if (validation.passesValidation) {
      return {
        shouldRetry: false,
        reason: 'Validation passed',
        recommendedDelay: 0
      };
    }

    // Retry logic based on error types and scores
    const hasRecoverableErrors = validation.errors.some(error => 
      error.type === 'syntax' || error.type === 'type' || error.suggestion
    );

    const scoreThreshold = this.qualityThresholds[agentType].minScore;
    const isScoreReasonable = validation.overallScore >= (scoreThreshold * 0.6); // 60% of threshold

    if (hasRecoverableErrors && isScoreReasonable) {
      return {
        shouldRetry: true,
        reason: 'Recoverable errors detected with reasonable quality score',
        recommendedDelay: Math.pow(2, attemptNumber - 1) * 1000 // Exponential backoff
      };
    }

    if (validation.errors.length <= 2 && validation.overallScore >= (scoreThreshold * 0.5)) {
      return {
        shouldRetry: true,
        reason: 'Few errors with acceptable quality baseline',
        recommendedDelay: attemptNumber * 2000 // Linear backoff
      };
    }

    return {
      shouldRetry: false,
      reason: 'Quality too low or errors not recoverable',
      recommendedDelay: 0
    };
  }

  /**
   * Generate improvement suggestions for failed validations
   */
  generateImprovementSuggestions(
    agentType: AgentType,
    validation: ValidationResultEnhanced,
    tcc: ToolConstructionContext
  ): string[] {
    const suggestions: string[] = [];

    // Agent-specific suggestions
    switch (agentType) {
      case 'function-planner':
        if (validation.errors.some(e => e.message.includes('function'))) {
          suggestions.push('Review function signature definitions and ensure all required parameters are included');
          suggestions.push('Check that function descriptions are clear and comprehensive');
        }
        break;

      case 'state-design':
        if (validation.errors.some(e => e.message.includes('state'))) {
          suggestions.push('Ensure all state variables have proper TypeScript types');
          suggestions.push('Verify state functions handle all calculation requirements');
        }
        break;

      case 'jsx-layout':
        if (validation.errors.some(e => e.message.includes('component'))) {
          suggestions.push('Review component structure for proper nesting and accessibility');
          suggestions.push('Ensure all form inputs have proper labels and validation');
        }
        break;

      case 'tailwind-styling':
        if (validation.errors.some(e => e.message.includes('class'))) {
          suggestions.push('Check Tailwind class names for typos and validity');
          suggestions.push('Ensure responsive design patterns are properly implemented');
        }
        break;

      case 'component-assembler':
        if (validation.errors.some(e => e.type === 'syntax')) {
          suggestions.push('Review React component syntax and JSX structure');
          suggestions.push('Ensure all imports and exports are properly defined');
        }
        break;
    }

    // General suggestions based on error types
    const errorTypes = [...new Set(validation.errors.map(e => e.type))];
    if (errorTypes.includes('syntax')) {
      suggestions.push('Fix syntax errors before proceeding to next agent');
    }
    if (errorTypes.includes('type')) {
      suggestions.push('Resolve TypeScript type mismatches');
    }
    if (errorTypes.includes('logic')) {
      suggestions.push('Review business logic implementation');
    }

    return suggestions;
  }

  /**
   * Perform agent-specific validation logic
   */
  private performAgentSpecificValidation<T>(
    agentType: AgentType,
    result: T,
    tcc: ToolConstructionContext
  ): ValidationResultEnhanced {
    switch (agentType) {
      case 'function-planner':
        return this.validateFunctionPlannerResult(result as FunctionPlannerResult);
      case 'state-design':
        return this.validateStateDesignResult(result as StateDesignResult);
      case 'jsx-layout':
        return this.validateJsxLayoutResult(result as JsxLayoutResult);
      case 'tailwind-styling':
        return this.validateTailwindStylingResult(result as TailwindStylingResult);
      case 'component-assembler':
        return this.validateComponentAssemblerResult(result as ComponentAssemblerResult);
      case 'code-validator':
        return this.validateCodeValidatorResult(result as CodeValidatorResult);
      case 'tool-finalizer':
        return this.validateToolFinalizerResult(result as ToolFinalizerResult);
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  private validateFunctionPlannerResult(result: FunctionPlannerResult): ValidationResultEnhanced {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: ValidationError[] = [];

    const threshold = this.qualityThresholds['function-planner'];
    
    // Check function count
    if (result.functionSignatures.length < threshold.minFunctions) {
      errors.push({
        type: 'logic',
        severity: 'error',
        message: `Too few functions: ${result.functionSignatures.length} (minimum: ${threshold.minFunctions})`,
        suggestion: 'Add more function signatures to cover all required calculations'
      });
    }
    
    if (result.functionSignatures.length > threshold.maxFunctions) {
      warnings.push({
        type: 'logic',
        severity: 'warning',
        message: `Many functions: ${result.functionSignatures.length} (maximum recommended: ${threshold.maxFunctions})`,
        suggestion: 'Consider consolidating related functions'
      });
    }

    // Check function signature quality
    result.functionSignatures.forEach((sig, index) => {
      if (!sig.name || sig.name.length < 3) {
        errors.push({
          type: 'logic',
          severity: 'error',
          message: `Function ${index + 1} has invalid name: "${sig.name}"`,
          suggestion: 'Use descriptive function names with at least 3 characters'
        });
      }
      
      if (!sig.description || sig.description.length < 10) {
        warnings.push({
          type: 'logic',
          severity: 'warning',
          message: `Function "${sig.name}" has insufficient description`,
          suggestion: 'Provide detailed function descriptions'
        });
      }
    });

    const score = this.calculateScore(errors, warnings, threshold.minScore);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      overallScore: score,
      passesValidation: score >= threshold.minScore && errors.length === 0
    };
  }

  private validateStateDesignResult(result: StateDesignResult): ValidationResultEnhanced {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: ValidationError[] = [];

    const threshold = this.qualityThresholds['state-design'];
    
    // Check state variables
    if (result.stateLogic.variables.length < threshold.minVariables) {
      errors.push({
        type: 'logic',
        severity: 'error',
        message: `Too few state variables: ${result.stateLogic.variables.length}`,
        suggestion: 'Add necessary state variables for all inputs and calculations'
      });
    }

    // Check state functions
    if (result.stateLogic.functions.length < threshold.minFunctions) {
      errors.push({
        type: 'logic',
        severity: 'error',
        message: `Too few state functions: ${result.stateLogic.functions.length}`,
        suggestion: 'Implement calculation functions for all required computations'
      });
    }

    const score = this.calculateScore(errors, warnings, threshold.minScore);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      overallScore: score,
      passesValidation: score >= threshold.minScore && errors.length === 0
    };
  }

  private validateJsxLayoutResult(result: JsxLayoutResult): ValidationResultEnhanced {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: ValidationError[] = [];

    const threshold = this.qualityThresholds['jsx-layout'];
    
    // Check component structure
    if (!result.jsxLayout.componentStructure || result.jsxLayout.componentStructure.length < 50) {
      errors.push({
        type: 'logic',
        severity: 'error',
        message: 'Component structure is too minimal or missing',
        suggestion: 'Create a comprehensive component structure with proper JSX'
      });
    }

    // Check nesting depth
    if (result.metadata.nestingDepth > threshold.maxNesting) {
      warnings.push({
        type: 'logic',
        severity: 'warning',
        message: `Component nesting is too deep: ${result.metadata.nestingDepth} levels`,
        suggestion: 'Simplify component structure to reduce nesting'
      });
    }

    const score = this.calculateScore(errors, warnings, threshold.minScore);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      overallScore: score,
      passesValidation: score >= threshold.minScore && errors.length === 0
    };
  }

  private validateTailwindStylingResult(result: TailwindStylingResult): ValidationResultEnhanced {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: ValidationError[] = [];

    const threshold = this.qualityThresholds['tailwind-styling'];
    
    // Check styling completeness
    if (!result.styling.styledComponentCode || result.styling.styledComponentCode.length < 100) {
      errors.push({
        type: 'logic',
        severity: 'error',
        message: 'Styled component code is insufficient',
        suggestion: 'Provide comprehensive Tailwind styling'
      });
    }

    // Check class count
    const classCount = result.metadata.classCount;
    if (classCount < threshold.minClasses) {
      warnings.push({
        type: 'logic',
        severity: 'warning',
        message: `Few Tailwind classes: ${classCount}`,
        suggestion: 'Add more styling for better visual design'
      });
    }

    const score = this.calculateScore(errors, warnings, threshold.minScore);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      overallScore: score,
      passesValidation: score >= threshold.minScore && errors.length === 0
    };
  }

  private validateComponentAssemblerResult(result: ComponentAssemblerResult): ValidationResultEnhanced {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: ValidationError[] = [];

    const threshold = this.qualityThresholds['component-assembler'];
    
    // Check assembled code
    if (!result.assembledCode || result.assembledCode.length < threshold.minCodeLength) {
      errors.push({
        type: 'logic',
        severity: 'error',
        message: `Assembled code too short: ${result.assembledCode?.length || 0} characters`,
        suggestion: 'Ensure all components are properly assembled'
      });
    }

    if (result.assembledCode && result.assembledCode.length > threshold.maxCodeLength) {
      warnings.push({
        type: 'performance',
        severity: 'warning',
        message: `Assembled code very long: ${result.assembledCode.length} characters`,
        suggestion: 'Consider code optimization and refactoring'
      });
    }

    const score = this.calculateScore(errors, warnings, threshold.minScore);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      overallScore: score,
      passesValidation: score >= threshold.minScore && errors.length === 0
    };
  }

  private validateCodeValidatorResult(result: CodeValidatorResult): ValidationResultEnhanced {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: ValidationError[] = [];

    const threshold = this.qualityThresholds['code-validator'];
    
    // Check validation results
    if (!result.validationResult.isValid) {
      errors.push({
        type: 'logic',
        severity: 'error',
        message: 'Code validation failed',
        suggestion: 'Fix all validation issues before proceeding'
      });
    }

    // Check issue counts
    if (result.metadata.issuesFound > threshold.maxErrors) {
      errors.push({
        type: 'logic',
        severity: 'error',
        message: `Too many issues found: ${result.metadata.issuesFound}`,
        suggestion: 'Resolve critical issues'
      });
    }

    const score = this.calculateScore(errors, warnings, threshold.minScore);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      overallScore: score,
      passesValidation: score >= threshold.minScore && errors.length === 0
    };
  }

  private validateToolFinalizerResult(result: ToolFinalizerResult): ValidationResultEnhanced {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: ValidationError[] = [];

    const threshold = this.qualityThresholds['tool-finalizer'];
    
    // Check final product
    if (!result.finalProduct) {
      errors.push({
        type: 'logic',
        severity: 'error',
        message: 'Final product is missing',
        suggestion: 'Ensure tool finalizer creates complete product'
      });
    }

    // Check readiness level
    if (result.metadata.readinessLevel !== threshold.readinessLevel) {
      warnings.push({
        type: 'logic',
        severity: 'warning',
        message: `Readiness level: ${result.metadata.readinessLevel} (expected: ${threshold.readinessLevel})`,
        suggestion: 'Improve quality to reach production readiness'
      });
    }

    const score = this.calculateScore(errors, warnings, threshold.minScore);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      overallScore: score,
      passesValidation: score >= threshold.minScore && errors.length === 0
    };
  }

  private calculateScore(errors: ValidationError[], warnings: ValidationError[], baseScore: number): number {
    let score = baseScore;
    
    // Deduct points for errors and warnings
    score -= errors.length * 15; // 15 points per error
    score -= warnings.length * 5; // 5 points per warning
    
    // Ensure score doesn't go below 0
    return Math.max(0, score);
  }

  private createFailedValidation(agentType: AgentType, errorMessage: string): ValidationResultEnhanced {
    return {
      isValid: false,
      errors: [{
        type: 'logic',
        severity: 'error',
        message: `Validation failed: ${errorMessage}`,
        suggestion: 'Review agent implementation and fix critical issues'
      }],
      warnings: [],
      suggestions: [],
      overallScore: 0,
      passesValidation: false
    };
  }
}
