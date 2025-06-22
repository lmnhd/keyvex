/**
 * Function Planner Unified Module (Phase 1.2 - Refactored for Centralized Execution)
 * Conforms to the new simplified agent module structure.
 */

import { z } from 'zod';
import { 
  FunctionPlannerResult,
} from '../../../types/tcc-unified';
import { 
  BaseAgentModule, 
  BaseValidationResult 
} from '../core/base-agent-module';

/**
 * Zod schema for the Function Planner's output.
 */
const FunctionPlannerResultSchema = z.object({
  functionSignatures: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string(),
      required: z.boolean()
    })),
    returnType: z.string(),
    category: z.enum(['calculation', 'utility', 'validation']),
    complexity: z.enum(['simple', 'moderate', 'complex'])
  })),
  metadata: z.object({
    totalFunctions: z.number(),
    complexityLevel: z.enum(['simple', 'moderate', 'complex']),
    estimatedImplementationTime: z.string()
  })
});

/**
 * FunctionPlannerModule - Now a configuration and validation provider.
 */
export class FunctionPlannerModule extends BaseAgentModule {
  constructor() {
    super('function-planner', 30000); // 30 second timeout
  }

  /**
   * Exposes the Zod schema for this agent's output.
   */
  getOutputSchema(): z.ZodSchema<any> {
    return FunctionPlannerResultSchema;
  }

  /**
   * Validate the function planner's structured output.
   */
  validate(output: FunctionPlannerResult): BaseValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    if (!output.functionSignatures || output.functionSignatures.length === 0) {
      errors.push('No function signatures generated');
      score -= 50;
    } else {
      // Validate each function signature
      output.functionSignatures.forEach((func, index) => {
        if (!func.name) {
          errors.push(`Function ${index} missing name`);
          score -= 10;
        }
        if (!func.description) {
          errors.push(`Function ${func.name || index} missing description`);
          score -= 10;
        }
                 // Additional validation can be added here when the exact interface is known
      });
    }

    if (!output.metadata) {
      errors.push('Missing metadata');
      score -= 20;
    } else {
      if (!output.metadata.complexityLevel) {
        errors.push('Missing complexity level in metadata');
        score -= 10;
      }
      if (!output.metadata.estimatedImplementationTime) {
        warnings.push('Missing estimated implementation time');
        score -= 5;
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
   */
  getRequiredInputFields(): string[] {
    return [
      'brainstormData.keyCalculations',
      'brainstormData.suggestedInputs'
    ];
  }

  /**
   * Provide a description for logging.
   */
  protected getAgentDescription(): string {
    return 'Analyzes brainstorm data and generates function signatures for tool implementation.';
  }
} 