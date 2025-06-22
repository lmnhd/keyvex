/**
 * Tool Finalizer Unified Module (Phase 1.2 - Refactored for Centralized Execution)
 * Conforms to the new simplified agent module structure.
 */

import { z } from 'zod';
import { 
  ToolFinalizerResult,
  AgentResult,
  ValidationResult
} from '../../../types/tcc-unified';
import { 
  BaseAgentModule
} from '../core/base-agent-module';
import { ProductToolDefinitionSchema } from '@/lib/types/product-tool.schema';

/**
 * Zod schema for the ToolFinalizer's output.
 * Uses the main ProductToolDefinitionSchema.
 */
const ToolFinalizerResultSchema = z.object({
  finalProduct: ProductToolDefinitionSchema,
  metadata: z.object({
    completionTime: z.string(),
    qualityScore: z.number(),
    readinessLevel: z.enum(['development', 'staging', 'production']),
  }),
});

/**
 * ToolFinalizerModule - Now a configuration and validation provider.
 */
export class ToolFinalizerModule extends BaseAgentModule {
  constructor() {
    super('tool-finalizer', 10000); // 10 second timeout
  }

  /**
   * Exposes the Zod schema for this agent's output.
   */
  getOutputSchema(): z.ZodType<AgentResult> {
    return ToolFinalizerResultSchema;
  }

  /**
   * Validate the finalizer's structured output.
   */
  validate(output: ToolFinalizerResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    if (!output.finalProduct) {
      errors.push('Missing final product object');
      score -= 50;
    } else {
      if (!output.finalProduct.id) {
        errors.push('Missing final product ID');
        score -= 20;
      }
      if (!output.finalProduct.componentCode) {
        errors.push('Missing component code');
        score -= 30;
      }
      if (!output.finalProduct.metadata?.title) {
        warnings.push('Missing tool title');
        score -= 5;
      }
      // Validate required fields for finalized tools
      if (!output.finalProduct.version) {
        errors.push('Missing version for finalized tool');
        score -= 15;
      }
      if (!output.finalProduct.status) {
        errors.push('Missing status for finalized tool');
        score -= 15;
      }
      if (!output.finalProduct.createdBy) {
        errors.push('Missing createdBy for finalized tool');
        score -= 10;
      }
    }

    if (output.metadata?.qualityScore < 70) {
      warnings.push('Low quality score detected');
      score -= 15;
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
      'finalProduct.componentCode',
      'validationResult.isValid'
    ];
  }

  /**
   * Provide a description for logging.
   */
  protected getAgentDescription(): string {
    return 'Creates final ProductToolDefinition with metadata, styling, and packaging for deployment.';
  }
}
