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
import { filterBrainstormForStateDesign } from '../../../utils/brainstorm-filter';
import { generateObject } from '../../../ai/ai-client';
import { z } from 'zod';
import logger from '../../../logger';

// State Design Result Schema
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
      parameters: z.array(z.string()),
      body: z.string(),
      description: z.string(),
      dependencies: z.array(z.string()).optional()
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
  getAgentInfo() {
    return {
      type: 'state-design' as const,
      timeout: 45000,
      description: 'Generates React state variables and calculation functions based on tool requirements'
    };
  }

  getRequiredInputFields(): string[] {
    return [
      'brainstormData.keyCalculations',
      'brainstormData.suggestedInputs',
      'brainstormData.calculationLogic',
      'definedFunctionSignatures'
    ];
  }

  supportsEditMode(): boolean {
    return true;
  }

  async execute(
    context: AgentExecutionContext,
    input: AgentExecutionInput
  ): Promise<StateDesignResult> {
    const startTime = Date.now();
    
    logger.info({
      jobId: context.jobId,
      agentType: 'state-design',
      isEditMode: context.editMode?.isEditMode || false
    }, '🎯 STATE DESIGN: Starting state logic generation');

    try {
      // Filter brainstorm data for state design
      const filteredBrainstorm = filterBrainstormForStateDesign(
        input.tcc.brainstormData,
        context.jobId
      );

      if (!filteredBrainstorm) {
        throw new Error('No brainstorm data available for state design');
      }

      // Generate state design using AI
      const result = await this.generateStateDesign(
        context,
        input.tcc,
        filteredBrainstorm
      );

      const executionTime = Date.now() - startTime;

      logger.info({
        jobId: context.jobId,
        agentType: 'state-design',
        executionTime,
        stateVariableCount: result.stateLogic.variables.length,
        functionCount: result.stateLogic.functions.length,
        complexityScore: result.metadata.complexityScore
      }, '✅ STATE DESIGN: State logic generation completed');

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        jobId: context.jobId,
        agentType: 'state-design',
        executionTime,
        error: errorMessage
      }, '❌ STATE DESIGN: State logic generation failed');

      throw error;
    }
  }

  private async generateStateDesign(
    context: AgentExecutionContext,
    tcc: ToolConstructionContext,
    brainstormData: StateDesignBrainstormData
  ): Promise<StateDesignResult> {
    
    // Create system prompt for state design
    const systemPrompt = this.createSystemPrompt();
    
    // Create user prompt with brainstorm data and function signatures
    const userPrompt = this.createUserPrompt(tcc, brainstormData, context.editMode);

    logger.info({
      jobId: context.jobId,
      agentType: 'state-design',
      modelId: context.modelConfig.modelId,
      promptLength: systemPrompt.length + userPrompt.length
    }, '🤖 STATE DESIGN: Generating state logic with AI');

    const result = await generateObject({
      model: context.modelConfig.modelId,
      schema: StateDesignResultSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: context.modelConfig.temperature,
      maxTokens: context.modelConfig.maxTokens
    });

    return result;
  }

  private createSystemPrompt(): string {
    return `You are a React State Design Expert specializing in creating clean, efficient state management for interactive tools.

CORE RESPONSIBILITIES:
1. Generate React state variables for all user inputs and calculated values
2. Create calculation functions that implement the tool's core logic
3. Ensure proper state dependencies and update flows
4. Follow React best practices for state management

CRITICAL REQUIREMENTS:
- NEVER use generic 'any' types - always specify exact TypeScript types
- ALL calculations from brainstorm data MUST be implemented
- State variables must cover ALL user inputs and calculation results
- Functions must handle edge cases and validation
- Use proper React hooks (useState, useEffect, useCallback)
- Ensure functions are pure and testable where possible

STATE VARIABLE PATTERNS:
- Input fields: const [fieldName, setFieldName] = useState<type>(initialValue)
- Calculation results: const [resultName, setResultName] = useState<number>(0)
- UI state: const [isLoading, setIsLoading] = useState<boolean>(false)
- Form validation: const [errors, setErrors] = useState<Record<string, string>>({})

FUNCTION PATTERNS:
- Calculation functions: const calculateResult = useCallback(() => { ... }, [dependencies])
- Input handlers: const handleInputChange = (field: string, value: any) => { ... }
- Validation functions: const validateInputs = () => { ... }
- Reset functions: const resetCalculation = () => { ... }

TYPESCRIPT TYPES:
- Use specific types: number, string, boolean, Date
- For arrays: Array<SpecificType> or SpecificType[]
- For objects: { field1: type1; field2: type2 }
- For unions: 'option1' | 'option2' | 'option3'

OUTPUT FORMAT:
Return a complete StateDesignResult with:
1. variables: All state variables with proper types and initial values
2. functions: All calculation and handler functions with implementation
3. imports: Required React imports and any utility imports
4. metadata: Analysis of complexity and structure

VALIDATION:
- Ensure all keyCalculations have corresponding state variables and functions
- Verify all suggestedInputs have state variables and handlers
- Check that function dependencies are properly tracked
- Validate that types are specific and not generic`;
  }

  private createUserPrompt(
    tcc: ToolConstructionContext,
    brainstormData: StateDesignBrainstormData,
    editMode?: { isEditMode: boolean; activeEditInstructions?: any[] }
  ): string {
    
    let prompt = `# State Design Task

## Tool Overview
**Concept**: ${brainstormData.coreConcept}
**Value Proposition**: ${brainstormData.valueProposition}
**Tool Type**: ${brainstormData.toolType}
**Target Audience**: ${brainstormData.targetAudience}

## Key Calculations to Implement
${brainstormData.keyCalculations.map(calc => 
  `**${calc.name}**
  - Formula: ${calc.formula}
  - Variables: ${calc.variables.join(', ')}
  - Description: ${calc.description}`
).join('\n\n')}

## Suggested Input Fields
${brainstormData.suggestedInputs.map(input => 
  `**${input.label}** (${input.type})
  - Required: ${input.required}
  - Description: ${input.description}`
).join('\n\n')}

## Calculation Logic Details
${brainstormData.calculationLogic.map(logic => 
  `**${logic.name}**
  - Formula: ${logic.formula}
  - Dependencies: ${logic.dependencies.join(', ')}
  - Output Format: ${logic.outputFormat}`
).join('\n\n')}`;

    // Add function signatures if available
    if (tcc.definedFunctionSignatures && tcc.definedFunctionSignatures.length > 0) {
      prompt += `\n\n## Defined Function Signatures
${tcc.definedFunctionSignatures.map(sig => 
  `**${sig.name}**: ${sig.description}`
).join('\n')}`;
    }

    // Add edit mode instructions if applicable
    if (editMode?.isEditMode && editMode.activeEditInstructions) {
      prompt += `\n\n## EDIT MODE INSTRUCTIONS
${editMode.activeEditInstructions.map(instruction => 
        `**${instruction.editType.toUpperCase()}**: ${instruction.instructions}`
      ).join('\n')}

Previous state logic exists. Please modify according to the instructions above while maintaining functionality.`;
    }

    prompt += `\n\n## TASK
Generate complete React state logic including:
1. State variables for ALL inputs and calculation results
2. Calculation functions implementing ALL keyCalculations
3. Input handlers and validation functions
4. Proper TypeScript types for everything
5. Required React imports

Ensure the state design supports the complete user workflow from input to calculation to results display.`;

    return prompt;
  }

  validate(result: StateDesignResult): { isValid: boolean; score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    // Validate state variables
    if (!result.stateLogic.variables || result.stateLogic.variables.length === 0) {
      issues.push('No state variables defined');
      score -= 30;
    } else {
      // Check for proper typing
      result.stateLogic.variables.forEach((variable, index) => {
        if (!variable.name || !variable.type) {
          issues.push(`State variable ${index} missing name or type`);
          score -= 10;
        }
        if (variable.type === 'any') {
          issues.push(`State variable ${variable.name} uses generic 'any' type`);
          score -= 15;
        }
      });
    }

    // Validate functions
    if (!result.stateLogic.functions || result.stateLogic.functions.length === 0) {
      issues.push('No functions defined');
      score -= 30;
    } else {
      result.stateLogic.functions.forEach((func, index) => {
        if (!func.name || !func.body) {
          issues.push(`Function ${index} missing name or implementation`);
          score -= 10;
        }
        if (func.body.includes('any') || func.body.includes('TODO')) {
          issues.push(`Function ${func.name} has incomplete implementation`);
          score -= 5;
        }
      });
    }

    // Validate imports
    if (!result.stateLogic.imports || !result.stateLogic.imports.includes('react')) {
      issues.push('Missing React imports');
      score -= 10;
    }

    // Validate metadata
    if (!result.metadata) {
      issues.push('Missing metadata');
      score -= 10;
    }

    return {
      isValid: issues.length === 0,
      score: Math.max(0, score),
      issues
    };
  }
}
