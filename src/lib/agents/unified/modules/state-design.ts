 /**
 * State Design Agent Module (Phase 3.1)
 * Generates React state variables and functions for tool functionality
 * Integrates with unified agent architecture
 */

import { 
    StateDesignResult,
    StateDesignBrainstormData,
    AgentExecutionContext 
  } from '../../../types/tcc-unified';
  import { ToolConstructionContext } from '../../../types/product-tool-creation-v2/tcc';
  import { BaseAgentModule, AgentExecutionInput } from '../core/base-agent-module';
  import { ValidationResult } from '../../../types/tcc-unified';
  import { z } from 'zod';
  import { filterBrainstormForStateDesign } from '../../../utils/brainstorm-filter';
  import logger from '../../../logger';
  
  // Zod schema for State Design output
  const StateDesignResultSchema = z.object({
    stateLogic: z.object({
      variables: z.array(z.object({
        name: z.string(),
        type: z.string(),
        initialValue: z.any(),
        description: z.string()
      })),
      functions: z.array(z.object({
        name: z.string(),
        description: z.string(),
        parameters: z.array(z.string()).optional(),
        returnType: z.string().optional(),
        body: z.string(),
        dependencies: z.array(z.string())
      })),
      imports: z.array(z.string())
    }),
    metadata: z.object({
      stateVariableCount: z.number(),
      functionCount: z.number(),
      complexityScore: z.number()
    })
  });
  
  export class StateDesignModule extends BaseAgentModule {
    constructor() {
      super('state-design', 45000);
    }
  
    getRequiredInputFields(): string[] {
      return [
        'brainstormData.keyCalculations',
        'brainstormData.suggestedInputs',
        'brainstormData.calculationLogic'
      ];
    }
  
    /**
     * Exposes the Zod schema for this agent's output.
     */
    getOutputSchema(): z.ZodSchema<any> {
      return StateDesignResultSchema;
    }
  
    supportsEditMode(): boolean {
      return true;
    }
  
    /**
     * Provide a description for logging.
     */
    protected getAgentDescription(): string {
      return 'Generates React state variables and functions for tool functionality based on brainstorm calculations and inputs.';
    }
  
    // ✅ CENTRALIZED ARCHITECTURE: All execution logic moved to AgentExecutor + AIInteractionManager
    // This module now only provides schema, validation, and configuration
  
    validate(result: StateDesignResult): ValidationResult {
      const errors: string[] = [];
      const warnings: string[] = [];
      let score = 100;
  
      // Validate state variables
      if (!result.stateLogic.variables || result.stateLogic.variables.length === 0) {
        errors.push('No state variables defined');
        score -= 30;
      } else {
        // Check for proper typing
        result.stateLogic.variables.forEach((variable, index) => {
          if (!variable.name || !variable.type) {
            errors.push(`State variable ${index} missing name or type`);
            score -= 10;
          }
          if (variable.type === 'any') {
            warnings.push(`State variable ${variable.name} uses generic 'any' type`);
            score -= 15;
          }
        });
      }
  
      // Validate functions
      if (!result.stateLogic.functions || result.stateLogic.functions.length === 0) {
        errors.push('No functions defined');
        score -= 30;
      } else {
        result.stateLogic.functions.forEach((func, index) => {
          if (!func.name || !func.body) {
            errors.push(`Function ${index} missing name or implementation`);
            score -= 10;
          }
          if (func.body.includes('any') || func.body.includes('TODO')) {
            warnings.push(`Function ${func.name} has incomplete implementation`);
            score -= 5;
          }
        });
      }
  
      // Validate imports
      if (!result.stateLogic.imports || !result.stateLogic.imports.includes('react')) {
        warnings.push('Missing React imports');
        score -= 10;
      }
  
      // Validate metadata
      if (!result.metadata) {
        errors.push('Missing metadata');
        score -= 10;
      }
  
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        score: Math.max(0, score),
        missingFields: [] // No missing fields in output validation
      };
    }
  }
