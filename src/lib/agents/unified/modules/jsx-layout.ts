/**
 * JSX Layout Unified Module (Phase 1.2 - Refactored for Centralized Execution)
 * Conforms to the new simplified agent module structure.
 */

import { z } from 'zod';
import { 
  JsxLayoutResult,
  AgentResult,
  ValidationResult
} from '../../../types/tcc-unified';
import { 
  BaseAgentModule
} from '../core/base-agent-module';

/**
 * Zod schema for the JSX Layout's output.
 */
const JSXLayoutResultSchema = z.object({
  jsxLayout: z.object({
    componentStructure: z.string(),
    elementMap: z.array(z.object({
      elementId: z.string(),
      type: z.string(),
      purpose: z.string(),
      placeholderClasses: z.array(z.string())
    })),
    accessibilityFeatures: z.array(z.string()),
    responsiveBreakpoints: z.array(z.string())
  }),
  metadata: z.object({
    componentCount: z.number(),
    nestingDepth: z.number(),
    accessibilityScore: z.number()
  })
});

/**
 * JSXLayoutModule - Now a configuration and validation provider.
 */
export class JSXLayoutModule extends BaseAgentModule {
  constructor() {
    super('jsx-layout', 30000); // 30 second timeout
  }

  /**
   * Exposes the Zod schema for this agent's output.
   */
  getOutputSchema(): z.ZodType<AgentResult> {
    return JSXLayoutResultSchema;
  }

  /**
   * Validate the layout agent's structured output.
   */
  validate(output: JsxLayoutResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    if (!output.jsxLayout) {
      errors.push('Missing JSX layout object');
      score -= 50;
    } else {
      if (!output.jsxLayout.componentStructure) {
        errors.push('Missing component structure');
        score -= 30;
      }
      if (!output.jsxLayout.elementMap || output.jsxLayout.elementMap.length === 0) {
        warnings.push('No element mapping provided');
        score -= 10;
      }
      if (!output.jsxLayout.accessibilityFeatures || output.jsxLayout.accessibilityFeatures.length === 0) {
        warnings.push('No accessibility features specified');
        score -= 15;
      }
      if (!output.jsxLayout.responsiveBreakpoints || output.jsxLayout.responsiveBreakpoints.length === 0) {
        warnings.push('No responsive breakpoints specified');
        score -= 10;
      }
    }

    if (!output.metadata) {
      warnings.push('Missing metadata');
      score -= 5;
    } else {
      if (output.metadata.accessibilityScore < 70) {
        warnings.push('Low accessibility score');
        score -= 10;
      }
      if (output.metadata.nestingDepth > 5) {
        warnings.push('High nesting depth may impact performance');
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
      'brainstormData.suggestedInputs',
      'brainstormData.interactionFlow',
      'definedFunctionSignatures'
    ];
  }

  /**
   * Support edit mode
   */
  supportsEditMode(): boolean {
    return true;
  }

  /**
   * Provide a description for logging.
   */
  protected getAgentDescription(): string {
    return 'Generates semantic React component structure with accessibility features and responsive design.';
  }
} 