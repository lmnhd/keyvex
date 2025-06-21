/**
 * JSX Layout Agent Module (Phase 3.2)
 * Generates React component structure and JSX layout
 * Integrates with unified agent architecture
 */

import { 
  JsxLayoutResult,
  JSXLayoutBrainstormData,
  AgentExecutionContext 
} from '../../../types/tcc-unified';
import { ToolConstructionContext } from '../../../types/product-tool-creation-v2/tcc';
import { BaseAgentModule, AgentExecutionInput } from '../core/base-agent-module';
import { filterBrainstormForJSXLayout } from '../../../utils/brainstorm-filter';
import { generateObject } from '../../../ai/ai-client';
import { z } from 'zod';
import logger from '../../../logger';

// JSX Layout Result Schema
const JSXLayoutResultSchema = z.object({
  jsxLayout: z.object({
    componentStructure: z.string(),
    layoutDecisions: z.object({
      formLayout: z.string(),
      inputGrouping: z.array(z.string()),
      resultDisplayStyle: z.string(),
      responsiveBreakpoints: z.array(z.string()),
      accessibilityFeatures: z.array(z.string())
    }),
    componentHierarchy: z.array(z.object({
      componentName: z.string(),
      purpose: z.string(),
      children: z.array(z.string()).optional()
    }))
  }),
  metadata: z.object({
    componentCount: z.number(),
    inputFieldCount: z.number(),
    layoutComplexity: z.string(),
    accessibilityScore: z.number()
  })
});

export class JSXLayoutModule extends BaseAgentModule {
  getAgentInfo() {
    return {
      type: 'jsx-layout' as const,
      timeout: 45000,
      description: 'Generates React component structure and JSX layout for the tool interface'
    };
  }

  getRequiredInputFields(): string[] {
    return [
      'brainstormData.suggestedInputs',
      'brainstormData.interactionFlow',
      'brainstormData.keyCalculations',
      'brainstormData.leadCaptureStrategy'
    ];
  }

  supportsEditMode(): boolean {
    return true;
  }

  async execute(
    context: AgentExecutionContext,
    input: AgentExecutionInput
  ): Promise<JsxLayoutResult> {
    const startTime = Date.now();
    
    logger.info({
      jobId: context.jobId,
      agentType: 'jsx-layout',
      isEditMode: context.editMode?.isEditMode || false
    }, '🎯 JSX LAYOUT: Starting component layout generation');

    try {
      // Filter brainstorm data for JSX layout
      const filteredBrainstorm = filterBrainstormForJSXLayout(
        input.tcc.brainstormData,
        context.jobId
      );

      if (!filteredBrainstorm) {
        throw new Error('No brainstorm data available for JSX layout');
      }

      // Generate JSX layout using AI
      const result = await this.generateJSXLayout(
        context,
        input.tcc,
        filteredBrainstorm
      );

      const executionTime = Date.now() - startTime;

      logger.info({
        jobId: context.jobId,
        agentType: 'jsx-layout',
        executionTime,
        componentCount: result.metadata.componentCount,
        inputFieldCount: result.metadata.inputFieldCount,
        layoutComplexity: result.metadata.layoutComplexity
      }, '✅ JSX LAYOUT: Component layout generation completed');

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        jobId: context.jobId,
        agentType: 'jsx-layout',
        executionTime,
        error: errorMessage
      }, '❌ JSX LAYOUT: Component layout generation failed');

      throw error;
    }
  }

  private async generateJSXLayout(
    context: AgentExecutionContext,
    tcc: ToolConstructionContext,
    brainstormData: JSXLayoutBrainstormData
  ): Promise<JsxLayoutResult> {
    
    // Create system prompt for JSX layout
    const systemPrompt = this.createSystemPrompt();
    
    // Create user prompt with brainstorm data
    const userPrompt = this.createUserPrompt(tcc, brainstormData, context.editMode);

    logger.info({
      jobId: context.jobId,
      agentType: 'jsx-layout',
      modelId: context.modelConfig.modelId,
      promptLength: systemPrompt.length + userPrompt.length
    }, '🤖 JSX LAYOUT: Generating component layout with AI');

    const result = await generateObject({
      model: context.modelConfig.modelId,
      schema: JSXLayoutResultSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: context.modelConfig.temperature,
      maxTokens: context.modelConfig.maxTokens
    });

    return result;
  }

  private createSystemPrompt(): string {
    return `You are a React JSX Layout Expert specializing in creating intuitive, accessible, and responsive user interfaces for interactive tools.

CORE RESPONSIBILITIES:
1. Design clean, logical component structure and hierarchy
2. Create optimal input field layout and grouping
3. Design effective results display and data visualization areas
4. Ensure responsive design and accessibility compliance
5. Implement proper form flow and user experience patterns

CRITICAL REQUIREMENTS:
- Use semantic HTML elements and proper ARIA labels
- Implement responsive design with mobile-first approach
- Group related inputs logically for better UX
- Create clear visual hierarchy and information flow
- Design prominent, engaging results display areas
- Include proper loading states and error handling
- Follow React component composition best practices

LAYOUT PATTERNS:
- Input Section: Logical grouping with clear labels and validation
- Calculation Section: Prominent call-to-action buttons
- Results Section: Visual hierarchy with charts, metrics, and insights
- Lead Capture: Contextual placement based on engagement strategy
- Navigation: Clear progress indicators and action buttons

COMPONENT STRUCTURE:
- Main Container: Tool wrapper with proper spacing
- Input Groups: Related fields with consistent styling
- Action Buttons: Primary and secondary actions
- Results Display: Charts, metrics, summaries
- Feedback Elements: Loading, success, error states

ACCESSIBILITY FEATURES:
- Proper heading hierarchy (h1, h2, h3)
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance
- Focus management

RESPONSIVE DESIGN:
- Mobile-first approach
- Flexible grid systems
- Adaptive typography
- Touch-friendly interactions
- Optimized for various screen sizes

OUTPUT FORMAT:
Return a complete JSXLayoutResult with:
1. componentStructure: Complete JSX structure as string
2. layoutDecisions: Detailed rationale for layout choices
3. componentHierarchy: Breakdown of component organization
4. metadata: Analysis of complexity and accessibility

VALIDATION:
- Ensure all suggested inputs are included in layout
- Verify proper component hierarchy and nesting
- Check accessibility compliance
- Validate responsive design considerations`;
  }

  private createUserPrompt(
    tcc: ToolConstructionContext,
    brainstormData: JSXLayoutBrainstormData,
    editMode?: { isEditMode: boolean; activeEditInstructions?: any[] }
  ): string {
    
    let prompt = `# JSX Layout Design Task

## Tool Overview
**Concept**: ${brainstormData.coreConcept}
**Value Proposition**: ${brainstormData.valueProposition}
**Tool Type**: ${brainstormData.toolType}
**Target Audience**: ${brainstormData.targetAudience}

## Input Fields to Layout
${brainstormData.suggestedInputs.map(input => 
  `**${input.label}** (${input.type})
  - Required: ${input.required}
  - Description: ${input.description}
  - Placeholder: ${input.placeholder || 'None'}`
).join('\n\n')}

## Interaction Flow
${brainstormData.interactionFlow.map(step => 
  `**Step ${step.step}: ${step.title}**
  - Description: ${step.description}
  - User Action: ${step.userAction}
  - Engagement Hook: ${step.engagementHook || 'None'}`
).join('\n\n')}

## Key Calculations (for Results Display)
${brainstormData.keyCalculations.map(calc => 
  `**${calc.name}**
  - Description: ${calc.description}
  - Variables: ${calc.variables.join(', ')}`
).join('\n\n')}

## Lead Capture Strategy
**Timing**: ${brainstormData.leadCaptureStrategy.timing}
**Method**: ${brainstormData.leadCaptureStrategy.method}
**Incentive**: ${brainstormData.leadCaptureStrategy.incentive}`;

    // Add state logic context if available
    if (tcc.stateLogic?.variables) {
      prompt += `\n\n## Available State Variables
${tcc.stateLogic.variables.map(variable => 
        `**${variable.name}** (${variable.type}): ${variable.description}`
      ).join('\n')}`;
    }

    // Add edit mode instructions if applicable
    if (editMode?.isEditMode && editMode.activeEditInstructions) {
      prompt += `\n\n## EDIT MODE INSTRUCTIONS
${editMode.activeEditInstructions.map(instruction => 
        `**${instruction.editType.toUpperCase()}**: ${instruction.instructions}`
      ).join('\n')}

Previous JSX layout exists. Please modify according to the instructions above while maintaining usability.`;
    }

    prompt += `\n\n## TASK
Generate a complete JSX component layout including:
1. Logical input field grouping and organization
2. Clear visual hierarchy and information flow
3. Responsive design with mobile-first approach
4. Accessible form elements with proper labels
5. Engaging results display area for calculations
6. Contextual lead capture integration
7. Loading states and error handling UI

Focus on creating an intuitive, professional interface that guides users through the tool workflow effectively.`;

    return prompt;
  }

  validate(result: JsxLayoutResult): { isValid: boolean; score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    // Validate component structure
    if (!result.jsxLayout.componentStructure || result.jsxLayout.componentStructure.length < 100) {
      issues.push('Component structure is missing or too short');
      score -= 30;
    } else {
      // Check for essential JSX elements
      const structure = result.jsxLayout.componentStructure;
      if (!structure.includes('form') && !structure.includes('input')) {
        issues.push('Missing form or input elements');
        score -= 20;
      }
      if (!structure.includes('button')) {
        issues.push('Missing interactive buttons');
        score -= 10;
      }
      if (structure.includes('TODO') || structure.includes('placeholder')) {
        issues.push('Contains placeholder content');
        score -= 15;
      }
    }

    // Validate layout decisions
    if (!result.jsxLayout.layoutDecisions) {
      issues.push('Missing layout decisions');
      score -= 20;
    } else {
      if (!result.jsxLayout.layoutDecisions.formLayout) {
        issues.push('Missing form layout specification');
        score -= 10;
      }
      if (!result.jsxLayout.layoutDecisions.accessibilityFeatures || 
          result.jsxLayout.layoutDecisions.accessibilityFeatures.length === 0) {
        issues.push('Missing accessibility features');
        score -= 15;
      }
    }

    // Validate component hierarchy
    if (!result.jsxLayout.componentHierarchy || result.jsxLayout.componentHierarchy.length === 0) {
      issues.push('Missing component hierarchy');
      score -= 15;
    }

    // Validate metadata
    if (!result.metadata) {
      issues.push('Missing metadata');
      score -= 10;
    } else {
      if (result.metadata.accessibilityScore < 80) {
        issues.push('Low accessibility score');
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
