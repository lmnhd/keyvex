/**
 * Component Assembler Unified Module (Phase 1.2 - Refactored for Centralized Execution)
 * Conforms to the new simplified agent module structure.
 */

import { z } from 'zod';
import { 
  ComponentAssemblerResult,
} from '../../../types/tcc-unified';
import { 
  BaseAgentModule, 
  BaseValidationResult 
} from '../core/base-agent-module';

/**
 * Zod schema for the Component Assembler's output.
 */
const ComponentAssemblerResultSchema = z.object({
  assembledCode: z.string(),
  metadata: z.object({
    codeLength: z.number(),
    estimatedRenderTime: z.string(),
    bundleSize: z.string()
  })
});

/**
 * ComponentAssemblerModule - Now a configuration and validation provider.
 */
export class ComponentAssemblerModule extends BaseAgentModule {
  constructor() {
    super('component-assembler', 60000); // 60 second timeout for complex assembly
  }

  /**
   * Exposes the Zod schema for this agent's output.
   */
  getOutputSchema(): z.ZodSchema<any> {
    return ComponentAssemblerResultSchema;
  }

  /**
   * Validate the component assembler's structured output.
   */
  validate(output: ComponentAssemblerResult): BaseValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required assembled code
    if (!output.assembledCode) {
      errors.push('Missing assembled component code');
      score -= 50;
    } else {
      // Basic React component validation
      if (!output.assembledCode.includes('React.createElement')) {
        errors.push('Component code does not use React.createElement syntax');
        score -= 30;
      }
      
      if (output.assembledCode.includes('import ')) {
        errors.push('Component code contains import statements (should be removed for runtime execution)');
        score -= 25;
      }
      
      if (output.assembledCode.includes('export ')) {
        warnings.push('Component code contains export statements (may cause issues in dynamic rendering)');
        score -= 10;
      }
      
      if (output.assembledCode.length < 100) {
        warnings.push('Component code seems too short');
        score -= 15;
      }
      
      // Check for common React patterns
      if (!output.assembledCode.includes('useState') && !output.assembledCode.includes('React.useState')) {
        warnings.push('Component does not appear to use state management');
        score -= 5;
      }
    }

    // Check metadata
    if (!output.metadata) {
      warnings.push('Missing component assembler metadata');
      score -= 5;
    } else {
      if (output.metadata.codeLength === 0) {
        errors.push('Code length is zero');
        score -= 20;
      }
      
      if (output.metadata.codeLength > 50000) {
        warnings.push('Component code is very large - may impact performance');
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
   */
  getRequiredInputFields(): string[] {
    return [
      'jsxLayout.componentStructure',
      'stateLogic.variables',
      'styling.styledComponentCode'
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
    return 'Combines JSX layout, state logic, and styling into final executable React component.';
  }
} 