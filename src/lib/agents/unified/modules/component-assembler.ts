/**
 * Component Assembler Agent Module (Phase 3.3)
 * Combines all agent outputs into a final React component
 * Integrates with unified agent architecture
 */

import { 
  ComponentAssemblerResult,
  ComponentAssemblerBrainstormData,
  AgentExecutionContext 
} from '../../../types/tcc-unified';
import { ToolConstructionContext } from '../../../types/product-tool-creation-v2/tcc';
import { BaseAgentModule, AgentExecutionInput } from '../core/base-agent-module';
import { filterBrainstormForComponentAssembler } from '../../../utils/brainstorm-filter';
import { generateObject } from '../../../ai/ai-client';
import { z } from 'zod';
import logger from '../../../logger';

// Component Assembler Result Schema
const ComponentAssemblerResultSchema = z.object({
  finalComponentCode: z.string(),
  componentName: z.string(),
  hooks: z.array(z.string()).optional(),
  functions: z.array(z.string()).optional(),
  estimatedLines: z.number().optional(),
  metadata: z.object({
    codeLength: z.number(),
    complexityScore: z.number(),
    integrationPoints: z.array(z.string()),
    validationStatus: z.string()
  })
});

export class ComponentAssemblerModule extends BaseAgentModule {
  getAgentInfo() {
    return {
      type: 'component-assembler' as const,
      timeout: 60000, // Longer timeout for complex assembly
      description: 'Assembles all agent outputs into a final React component with complete functionality'
    };
  }

  getRequiredInputFields(): string[] {
    return [
      'brainstormData',
      'definedFunctionSignatures',
      'stateLogic',
      'jsxLayout'
    ];
  }

  supportsEditMode(): boolean {
    return true;
  }

  async execute(
    context: AgentExecutionContext,
    input: AgentExecutionInput
  ): Promise<ComponentAssemblerResult> {
    const startTime = Date.now();
    
    logger.info({
      jobId: context.jobId,
      agentType: 'component-assembler',
      isEditMode: context.editMode?.isEditMode || false,
      hasStateLogic: !!input.tcc.stateLogic,
      hasJSXLayout: !!input.tcc.jsxLayout,
      hasStyling: !!input.tcc.styling
    }, '🎯 COMPONENT ASSEMBLER: Starting final component assembly');

    try {
      // Filter brainstorm data for component assembler
      const filteredBrainstorm = filterBrainstormForComponentAssembler(
        input.tcc.brainstormData,
        context.jobId
      );

      if (!filteredBrainstorm) {
        throw new Error('No brainstorm data available for component assembly');
      }

      // Validate required inputs
      this.validateRequiredInputs(input.tcc);

      // Generate final component using AI
      const result = await this.generateFinalComponent(
        context,
        input.tcc,
        filteredBrainstorm
      );

      const executionTime = Date.now() - startTime;

      logger.info({
        jobId: context.jobId,
        agentType: 'component-assembler',
        executionTime,
        codeLength: result.finalComponentCode.length,
        componentName: result.componentName,
        complexityScore: result.metadata.complexityScore
      }, '✅ COMPONENT ASSEMBLER: Final component assembly completed');

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        jobId: context.jobId,
        agentType: 'component-assembler',
        executionTime,
        error: errorMessage
      }, '❌ COMPONENT ASSEMBLER: Final component assembly failed');

      throw error;
    }
  }

  private validateRequiredInputs(tcc: ToolConstructionContext): void {
    const missingInputs: string[] = [];

    if (!tcc.stateLogic) {
      missingInputs.push('State Logic');
    }
    if (!tcc.jsxLayout) {
      missingInputs.push('JSX Layout');
    }
    if (!tcc.brainstormData) {
      missingInputs.push('Brainstorm Data');
    }

    if (missingInputs.length > 0) {
      throw new Error(`Missing required inputs for component assembly: ${missingInputs.join(', ')}`);
    }
  }

  private async generateFinalComponent(
    context: AgentExecutionContext,
    tcc: ToolConstructionContext,
    brainstormData: ComponentAssemblerBrainstormData
  ): Promise<ComponentAssemblerResult> {
    
    // Create system prompt for component assembly
    const systemPrompt = this.createSystemPrompt();
    
    // Create user prompt with all available data
    const userPrompt = this.createUserPrompt(tcc, brainstormData, context.editMode);

    logger.info({
      jobId: context.jobId,
      agentType: 'component-assembler',
      modelId: context.modelConfig.modelId,
      promptLength: systemPrompt.length + userPrompt.length,
      hasStateLogic: !!tcc.stateLogic,
      hasJSXLayout: !!tcc.jsxLayout,
      hasStyling: !!tcc.styling
    }, '🤖 COMPONENT ASSEMBLER: Generating final component with AI');

    const result = await generateObject({
      model: context.modelConfig.modelId,
      schema: ComponentAssemblerResultSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: context.modelConfig.temperature,
      maxTokens: context.modelConfig.maxTokens
    });

    return result;
  }

  private createSystemPrompt(): string {
    return `You are a React Component Assembly Expert specializing in combining multiple agent outputs into a complete, functional React component.

CORE RESPONSIBILITIES:
1. Integrate state logic, JSX layout, and styling into a cohesive component
2. Ensure all calculation functions are properly implemented and connected
3. Create seamless data flow between inputs, calculations, and results
4. Apply consistent styling and maintain responsive design
5. Implement proper error handling and loading states

CRITICAL REQUIREMENTS:
- NEVER use import statements - all dependencies are provided via props
- Generate complete, self-contained React component code
- Ensure all state variables and functions from state logic are included
- Integrate JSX structure with proper event handlers and data binding
- Apply styling consistently throughout the component
- Handle edge cases and validation properly
- Follow React best practices and hooks patterns

INTEGRATION PATTERNS:
- State Integration: Use all state variables and functions from state logic
- Layout Integration: Implement complete JSX structure with proper nesting
- Styling Integration: Apply all style classes and responsive design
- Event Handling: Connect form inputs to state update functions
- Calculation Flow: Trigger calculations and display results properly
- Error Handling: Include validation and error display logic

COMPONENT STRUCTURE:
- Function component with proper TypeScript typing
- All necessary React hooks (useState, useEffect, useCallback)
- Complete JSX return statement with all UI elements
- Proper event handlers for user interactions
- Calculation trigger logic and result display
- Loading states and error handling UI

CODE QUALITY:
- Clean, readable, and well-structured code
- Proper TypeScript types (no 'any' types)
- Consistent naming conventions
- Efficient re-rendering with proper dependencies
- Accessible HTML elements and ARIA labels
- Responsive design implementation

OUTPUT FORMAT:
Return a ComponentAssemblerResult with:
1. finalComponentCode: Complete React component as string
2. componentName: Descriptive component name
3. hooks: List of React hooks used
4. functions: List of functions implemented
5. metadata: Analysis of code complexity and integration

VALIDATION:
- Ensure component compiles without syntax errors
- Verify all state logic is integrated
- Check all JSX elements are properly styled
- Validate event handlers are connected
- Confirm calculation flow works end-to-end`;
  }

  private createUserPrompt(
    tcc: ToolConstructionContext,
    brainstormData: ComponentAssemblerBrainstormData,
    editMode?: { isEditMode: boolean; activeEditInstructions?: any[] }
  ): string {
    
    let prompt = `# Component Assembly Task

## Tool Overview
**Concept**: ${brainstormData.coreConcept}
**Component Name**: ${this.generateComponentName(brainstormData.coreConcept)}

## State Logic to Integrate
${tcc.stateLogic?.variables?.map(variable => 
  `**State Variable**: ${variable.name} (${variable.type})
  - Initial Value: ${JSON.stringify(variable.initialValue)}
  - Description: ${variable.description}`
).join('\n\n') || 'No state variables available'}

${tcc.stateLogic?.functions?.map(func => 
  `**Function**: ${func.name}
  - Parameters: ${func.parameters?.join(', ') || 'none'}
  - Description: ${func.description}
  - Implementation: ${func.body?.substring(0, 200)}${func.body && func.body.length > 200 ? '...' : ''}`
).join('\n\n') || 'No functions available'}

## JSX Layout to Implement
${tcc.jsxLayout?.componentStructure ? `
**Component Structure**:
\`\`\`jsx
${tcc.jsxLayout.componentStructure}
\`\`\`

**Layout Decisions**:
- Form Layout: ${tcc.jsxLayout.layoutDecisions?.formLayout || 'Not specified'}
- Input Grouping: ${tcc.jsxLayout.layoutDecisions?.inputGrouping?.join(', ') || 'Not specified'}
- Result Display: ${tcc.jsxLayout.layoutDecisions?.resultDisplayStyle || 'Not specified'}
` : 'No JSX layout available'}

## Styling to Apply
${tcc.styling ? `
**Style Map**: ${Object.keys(tcc.styling.styleMap || {}).length} element styles defined
**Color Scheme**: ${tcc.styling.colorScheme ? 
  `Primary: ${tcc.styling.colorScheme.primary}, Secondary: ${tcc.styling.colorScheme.secondary}` : 
  'Not specified'}
**Responsive Features**: ${tcc.styling.responsiveFeatures?.join(', ') || 'Not specified'}
` : 'No styling available'}

## Key Calculations to Implement
${brainstormData.keyCalculations.map(calc => 
  `**${calc.name}**
  - Formula: ${calc.formula}
  - Variables: ${calc.variables.join(', ')}
  - Description: ${calc.description}`
).join('\n\n')}`;

    // Add edit mode instructions if applicable
    if (editMode?.isEditMode && editMode.activeEditInstructions) {
      prompt += `\n\n## EDIT MODE INSTRUCTIONS
${editMode.activeEditInstructions.map(instruction => 
        `**${instruction.editType.toUpperCase()}**: ${instruction.instructions}`
      ).join('\n')}

Previous component exists. Please modify according to the instructions above while maintaining functionality.`;
    }

    prompt += `\n\n## TASK
Assemble a complete React component that:
1. Integrates ALL state variables and functions from state logic
2. Implements the complete JSX structure from layout design
3. Applies all styling consistently throughout
4. Connects user inputs to calculation functions
5. Displays results in an engaging, professional manner
6. Handles loading states and error conditions
7. Maintains responsive design and accessibility

Generate the complete component code as a single string without any import statements.`;

    return prompt;
  }

  private generateComponentName(coreConcept: string): string {
    // Convert core concept to PascalCase component name
    return coreConcept
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
      .replace(/\s/g, '') + 'Tool';
  }

  validate(result: ComponentAssemblerResult): { isValid: boolean; score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    // Validate final component code
    if (!result.finalComponentCode || result.finalComponentCode.length < 500) {
      issues.push('Component code is missing or too short');
      score -= 40;
    } else {
      const code = result.finalComponentCode;
      
      // Check for essential React patterns
      if (!code.includes('useState') && !code.includes('useEffect')) {
        issues.push('Missing React hooks');
        score -= 20;
      }
      if (!code.includes('return (') && !code.includes('return(')) {
        issues.push('Missing JSX return statement');
        score -= 25;
      }
      if (code.includes('import ')) {
        issues.push('Contains import statements (should be import-free)');
        score -= 15;
      }
      if (code.includes('TODO') || code.includes('placeholder')) {
        issues.push('Contains placeholder content');
        score -= 10;
      }
      if (code.includes('any')) {
        issues.push('Contains generic any types');
        score -= 10;
      }
    }

    // Validate component name
    if (!result.componentName || result.componentName.length < 3) {
      issues.push('Missing or invalid component name');
      score -= 10;
    }

    // Validate metadata
    if (!result.metadata) {
      issues.push('Missing metadata');
      score -= 10;
    } else {
      if (result.metadata.complexityScore < 50) {
        issues.push('Component appears too simple');
        score -= 5;
      }
      if (result.metadata.integrationPoints.length === 0) {
        issues.push('No integration points identified');
        score -= 10;
      }
    }

    return {
      isValid: issues.length === 0,
      score: Math.max(0, score),
      issues
    };
  }
}
