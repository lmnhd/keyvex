/**
 * Function Planner Module (Phase 1.2 - Agent Implementation)
 * Unified Function Planning Agent with strongly typed interfaces
 * NO GENERIC TYPES - Only strongly typed interfaces
 */

import { 
  AgentExecutionContext,
  FunctionPlannerResult,
  FunctionPlannerBrainstormData
} from '../../../types/tcc-unified';
import { 
  DefinedFunctionSignature,
  ToolConstructionContext as BaseTCC 
} from '../../../types/product-tool-creation-v2/tcc';
import { BaseAgentModule, AgentExecutionInput, BaseValidationResult } from '../core/base-agent-module';
import { filterBrainstormForFunctionPlanner } from '../../../utils/brainstorm-filter';
import logger from '../../../logger';

/**
 * Function Planner specific validation result
 */
interface FunctionPlannerValidationResult extends BaseValidationResult {
  functionCount: number;
  hasCalculationFunctions: boolean;
  hasUtilityFunctions: boolean;
  complexityLevel: 'simple' | 'moderate' | 'complex';
}

/**
 * Function Planner Module
 * Analyzes brainstorm data and creates function signatures for the tool
 */
export class FunctionPlannerModule extends BaseAgentModule {
  constructor() {
    super('function-planner', 30000); // 30 second timeout
  }

  /**
   * Execute function planning
   */
  async execute(
    context: AgentExecutionContext,
    input: AgentExecutionInput
  ): Promise<FunctionPlannerResult> {
    this.logExecution(context, 'start');

    try {
      // Validate input
      const validation = this.validateInput(input);
      if (!validation.isValid) {
        throw new Error(`Invalid input: ${validation.missingFields.join(', ')}`);
      }

      // Filter brainstorm data for function planner
      const filteredBrainstorm = filterBrainstormForFunctionPlanner(
        input.tcc.brainstormData!,
        context.jobId
      );

      if (!filteredBrainstorm) {
        throw new Error('Failed to filter brainstorm data for function planner');
      }

      // Generate function signatures
      const functionSignatures = await this.generateFunctionSignatures(
        context,
        filteredBrainstorm
      );

      // Create result
      const result: FunctionPlannerResult = {
        functionSignatures,
        metadata: {
          totalFunctions: functionSignatures.length,
          complexityLevel: this.determineComplexityLevel(functionSignatures),
          estimatedImplementationTime: this.estimateImplementationTime(functionSignatures)
        }
      };

      // Validate result
      const resultValidation = this.validate(result);
      if (!resultValidation.isValid) {
        throw new Error(`Invalid result: ${resultValidation.errors.join(', ')}`);
      }

      this.logExecution(context, 'success', {
        functionsGenerated: functionSignatures.length,
        complexityLevel: result.metadata.complexityLevel
      });

      return result;
    } catch (error) {
      this.handleExecutionError(context, error, 'function planning');
    }
  }

  /**
   * Validate function planner result
   */
  validate(output: FunctionPlannerResult): FunctionPlannerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if we have function signatures
    if (!output.functionSignatures || output.functionSignatures.length === 0) {
      errors.push('No function signatures generated');
    }

    // Validate each function signature
    let calculationFunctions = 0;
    let utilityFunctions = 0;

    for (const func of output.functionSignatures) {
      if (!func.name || func.name.trim().length === 0) {
        errors.push('Function signature missing name');
      }
      if (!func.description || func.description.trim().length === 0) {
        errors.push(`Function ${func.name} missing description`);
      }
      if (!func.parameters || !Array.isArray(func.parameters)) {
        errors.push(`Function ${func.name} missing parameters array`);
      }

      // Categorize functions
      if (func.name.toLowerCase().includes('calculate') || 
          func.name.toLowerCase().includes('compute')) {
        calculationFunctions++;
      } else {
        utilityFunctions++;
      }
    }

    // Check metadata
    if (!output.metadata) {
      errors.push('Missing metadata');
    } else {
      if (output.metadata.totalFunctions !== output.functionSignatures.length) {
        warnings.push('Metadata totalFunctions does not match actual count');
      }
    }

    // Calculate score
    let score = 100;
    score -= errors.length * 20; // -20 for each error
    score -= warnings.length * 5; // -5 for each warning
    score = Math.max(0, score);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score,
      functionCount: output.functionSignatures.length,
      hasCalculationFunctions: calculationFunctions > 0,
      hasUtilityFunctions: utilityFunctions > 0,
      complexityLevel: output.metadata.complexityLevel
    };
  }

  /**
   * Get required input fields
   */
  getRequiredInputFields(): string[] {
    return ['tcc.brainstormData'];
  }

  /**
   * Get agent description
   */
  protected getAgentDescription(): string {
    return 'Analyzes brainstorm data and generates function signatures for tool implementation';
  }

  /**
   * Validate input for function planner
   */
  private validateInput(input: AgentExecutionInput): { isValid: boolean; missingFields: string[] } {
    const requiredFields = ['tcc.brainstormData'];
    const missingFields: string[] = [];

    if (!input.tcc) {
      missingFields.push('tcc');
      return { isValid: false, missingFields };
    }

    if (!input.tcc.brainstormData) {
      missingFields.push('tcc.brainstormData');
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Generate function signatures from brainstorm data
   */
  private async generateFunctionSignatures(
    context: AgentExecutionContext,
    brainstormData: FunctionPlannerBrainstormData
  ): Promise<DefinedFunctionSignature[]> {
    const signatures: DefinedFunctionSignature[] = [];

    // Generate calculation functions from key calculations
    for (const calc of brainstormData.keyCalculations) {
      const signature: DefinedFunctionSignature = {
        name: this.generateFunctionName(calc.name),
        description: calc.description,
        parameters: this.extractParametersFromFormula(calc.formula, calc.variables),
        returnType: 'number',
        isAsync: false
      };
      signatures.push(signature);
    }

    // Generate utility functions from calculation logic
    for (const logic of brainstormData.calculationLogic) {
      const signature: DefinedFunctionSignature = {
        name: this.generateFunctionName(logic.name),
        description: `Process ${logic.name} calculation`,
        parameters: this.extractParametersFromDependencies(logic.dependencies),
        returnType: this.determineReturnType(logic.outputFormat),
        isAsync: false
      };
      signatures.push(signature);
    }

    // Add validation function
    signatures.push({
      name: 'validateInputs',
      description: 'Validate all user inputs before calculations',
      parameters: brainstormData.suggestedInputs.map(input => ({
        name: input.id,
        type: this.mapInputTypeToParameterType(input.type),
        required: input.required,
        description: input.description
      })),
      returnType: 'boolean',
      isAsync: false
    });

    logger.info({
      jobId: context.jobId,
      functionsGenerated: signatures.length,
      calculationFunctions: brainstormData.keyCalculations.length,
      utilityFunctions: brainstormData.calculationLogic.length
    }, '🔧 Function Planner: Generated function signatures');

    return signatures;
  }

  /**
   * Generate camelCase function name from display name
   */
  private generateFunctionName(displayName: string): string {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .map((word, index) => 
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join('');
  }

  /**
   * Extract parameters from formula and variables
   */
  private extractParametersFromFormula(formula: string, variables: string[]): Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }> {
    return variables.map(variable => ({
      name: variable.toLowerCase().replace(/[^a-z0-9]/g, ''),
      type: 'number',
      required: true,
      description: `${variable} value for calculation`
    }));
  }

  /**
   * Extract parameters from dependencies
   */
  private extractParametersFromDependencies(dependencies: string[]): Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }> {
    return dependencies.map(dep => ({
      name: dep.toLowerCase().replace(/[^a-z0-9]/g, ''),
      type: 'any',
      required: true,
      description: `${dep} dependency`
    }));
  }

  /**
   * Determine return type from output format
   */
  private determineReturnType(outputFormat: string): string {
    if (outputFormat.toLowerCase().includes('number') || 
        outputFormat.toLowerCase().includes('currency') ||
        outputFormat.toLowerCase().includes('percentage')) {
      return 'number';
    }
    if (outputFormat.toLowerCase().includes('boolean')) {
      return 'boolean';
    }
    if (outputFormat.toLowerCase().includes('array')) {
      return 'array';
    }
    return 'string';
  }

  /**
   * Map input type to parameter type
   */
  private mapInputTypeToParameterType(inputType: string): string {
    switch (inputType.toLowerCase()) {
      case 'number':
      case 'currency':
      case 'percentage':
        return 'number';
      case 'boolean':
      case 'checkbox':
        return 'boolean';
      case 'select':
      case 'multiselect':
        return 'array';
      default:
        return 'string';
    }
  }

  /**
   * Determine complexity level
   */
  private determineComplexityLevel(signatures: DefinedFunctionSignature[]): 'simple' | 'moderate' | 'complex' {
    const totalFunctions = signatures.length;
    const avgParameters = signatures.reduce((sum, sig) => sum + sig.parameters.length, 0) / totalFunctions;

    if (totalFunctions <= 3 && avgParameters <= 3) {
      return 'simple';
    } else if (totalFunctions <= 6 && avgParameters <= 5) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }

  /**
   * Estimate implementation time
   */
  private estimateImplementationTime(signatures: DefinedFunctionSignature[]): string {
    const totalFunctions = signatures.length;
    const complexity = this.determineComplexityLevel(signatures);
    
    let baseMinutes = totalFunctions * 15; // 15 minutes per function
    
    switch (complexity) {
      case 'simple':
        baseMinutes *= 1;
        break;
      case 'moderate':
        baseMinutes *= 1.5;
        break;
      case 'complex':
        baseMinutes *= 2;
        break;
    }

    const hours = Math.ceil(baseMinutes / 60);
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
} 