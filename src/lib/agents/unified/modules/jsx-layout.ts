/**
 * JSX Layout Unified Module (Phase 2)
 * Properly extends BaseAgentModule - NO GENERIC TYPES!
 */

import { z } from 'zod';
import { 
  AgentExecutionContext, 
  JsxLayoutResult,
  AgentType,
  JSXLayoutBrainstormData
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import { BaseAgentModule, AgentExecutionInput, BaseValidationResult } from '../core/base-agent-module';
import { AIInteractionManager } from '../core/ai-interaction-manager';
import { filterBrainstormForJSXLayout, generateFilteredBrainstormContext } from '../../../utils/brainstorm-filter';
import logger from '../../../logger';

// Zod schema for JSX Layout result - STRONGLY TYPED
const jsxLayoutSchema = z.object({
  componentStructure: z.string().describe('The complete JSX component structure as a single string of semantic HTML'),
  elementMap: z.array(z.object({
    elementId: z.string().describe('The unique ID of the HTML element'),
    type: z.string().describe('The HTML tag type (e.g., "div", "input", "button")'),
    purpose: z.string().describe("A brief description of the element's role"),
    placeholderClasses: z.array(z.string()).describe('An array of placeholder CSS class names')
  })).optional().default([]).describe('An array of objects mapping element IDs to their details'),
  accessibilityFeatures: z.array(z.string()).optional().default(['Basic semantic HTML']).describe('A list of key accessibility features implemented'),
  responsiveBreakpoints: z.array(z.string()).optional().default(['mobile', 'desktop']).describe('A list of responsive breakpoints considered')
});

/**
 * JSXLayoutModule - Generates React component structure with semantic HTML
 */
export class JSXLayoutModule extends BaseAgentModule {
  private aiManager: AIInteractionManager;

  constructor() {
    super('jsx-layout' as AgentType, 30000); // 30 second timeout
    this.aiManager = new AIInteractionManager();
  }

  /**
   * Execute JSX layout generation
   */
  async execute(
    context: AgentExecutionContext,
    input: AgentExecutionInput
  ): Promise<JsxLayoutResult> {
    this.logExecution(context, 'start', {
      hasTcc: !!input.tcc,
      hasBrainstormData: !!input.tcc.brainstormData,
      hasFunctionSignatures: !!(input.tcc.definedFunctionSignatures || input.tcc.functionSignatures),
      hasStateLogic: !!input.tcc.stateLogic
    });

    try {
      // Validate required inputs
      const validation = this.validateRequired(input.tcc, this.getRequiredInputFields());
      if (!validation.isValid) {
        throw new Error(`Missing required fields: ${validation.missingFields.join(', ')}`);
      }

      // Generate JSX layout using centralized AI interaction
      const jsxLayoutData = await this.generateJsxLayoutWithAI(context, input.tcc);

      // Convert to unified result format with NO GENERIC TYPES
      const jsxLayoutResult: JsxLayoutResult = {
        jsxLayout: {
          componentStructure: jsxLayoutData.componentStructure,
          layoutDecisions: jsxLayoutData.elementMap || [],
          accessibilityFeatures: jsxLayoutData.accessibilityFeatures || ['Basic semantic HTML'],
          responsiveBreakpoints: jsxLayoutData.responsiveBreakpoints || ['mobile', 'desktop']
        },
        metadata: {
          componentCount: this.countComponents(jsxLayoutData.componentStructure),
          nestingDepth: this.calculateNestingDepth(jsxLayoutData.componentStructure),
          accessibilityScore: this.calculateAccessibilityScore(jsxLayoutData.accessibilityFeatures || [])
        }
      };

      this.logExecution(context, 'success', {
        componentCount: jsxLayoutResult.metadata.componentCount,
        nestingDepth: jsxLayoutResult.metadata.nestingDepth,
        accessibilityScore: jsxLayoutResult.metadata.accessibilityScore,
        hasElementMap: jsxLayoutResult.jsxLayout.layoutDecisions.length > 0
      });

      return jsxLayoutResult;
    } catch (error) {
      this.handleExecutionError(context, error, 'JSX layout generation');
    }
  }

  /**
   * Validate JSX layout result
   */
  validate(output: JsxLayoutResult): BaseValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required JSX layout fields
    if (!output.jsxLayout) {
      errors.push('Missing JSX layout object');
      score -= 50;
    } else {
      if (!output.jsxLayout.componentStructure) {
        errors.push('Missing component structure');
        score -= 30;
      } else {
        // Basic JSX validation
        if (!output.jsxLayout.componentStructure.includes('<')) {
          errors.push('Component structure does not contain valid JSX');
          score -= 25;
        }
        
        if (output.jsxLayout.componentStructure.length < 50) {
          warnings.push('Component structure seems too short');
          score -= 10;
        }
      }

      if (!output.jsxLayout.layoutDecisions || output.jsxLayout.layoutDecisions.length === 0) {
        warnings.push('No layout decisions provided');
        score -= 5;
      }

      if (!output.jsxLayout.accessibilityFeatures || output.jsxLayout.accessibilityFeatures.length === 0) {
        warnings.push('No accessibility features specified');
        score -= 10;
      }
    }

    // Check metadata
    if (!output.metadata) {
      warnings.push('Missing JSX layout metadata');
      score -= 5;
    } else {
      if (output.metadata.componentCount === 0) {
        warnings.push('Component count is zero');
        score -= 10;
      }

      if (output.metadata.nestingDepth > 10) {
        warnings.push('Very deep nesting detected - may impact performance');
        score -= 5;
      }

      if (output.metadata.accessibilityScore < 50) {
        warnings.push('Low accessibility score');
        score -= 15;
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
   * Get required input fields
   */
  getRequiredInputFields(): string[] {
    return [
      'brainstormData',
      'definedFunctionSignatures'
    ];
  }

  /**
   * Get agent description
   */
  protected getAgentDescription(): string {
    return 'Generates semantic React component structure with accessibility features and responsive design';
  }

  /**
   * Support edit mode
   */
  supportsEditMode(): boolean {
    return true;
  }

  /**
   * Private helper: Generate JSX layout using AI
   */
  private async generateJsxLayoutWithAI(
    context: AgentExecutionContext,
    tcc: BaseTCC
  ): Promise<z.infer<typeof jsxLayoutSchema>> {
    // Build user prompt with filtered brainstorm data
    let userPrompt = this.buildUserPrompt(tcc);

    // Handle edit mode if present
    if (context.editMode?.isEditMode && context.editMode.instructions.length > 0) {
      userPrompt += this.buildEditModePrompt(context.editMode, tcc);
    }

    // Use centralized AI interaction
    const result = await this.aiManager.executeAgentAI({
      context,
      systemPrompt: this.getSystemPrompt(),
      userPrompt,
      schema: jsxLayoutSchema,
      agentName: 'JSXLayout'
    });

    return result;
  }

  /**
   * Private helper: Build user prompt with filtered brainstorm data
   */
  private buildUserPrompt(tcc: BaseTCC): string {
    let toolDescription = 'Business calculation tool';
    
    if (tcc.brainstormData) {
      const brainstorm = tcc.brainstormData;
      toolDescription = `${brainstorm.coreConcept || brainstorm.coreWConcept || 'Business Tool'}: ${brainstorm.valueProposition || 'A tool to help users make informed decisions.'}`;
    } else {
      toolDescription = tcc.userInput?.description || toolDescription;
    }

    let userPrompt = `Tool: ${toolDescription}
Target Audience: ${tcc.targetAudience || 'General users'}

Function Signatures:
${
  (tcc.definedFunctionSignatures || tcc.functionSignatures)
    ?.map(sig => `- ${sig.name}: ${sig.description}`)
    .join('\n') || 'None'
}

State Logic Available:
${
  tcc.stateLogic?.variables?.map(v => `- ${v.name}: ${v.type}`).join('\n') ||
  'None'
}`;

    // Add filtered brainstorm context
    if (tcc.brainstormData) {
      const filteredBrainstormData = filterBrainstormForJSXLayout(tcc.brainstormData, tcc.jobId);
      
      if (filteredBrainstormData) {
        const brainstormContext = generateFilteredBrainstormContext(filteredBrainstormData, 'JSXLayout');
        userPrompt += brainstormContext;
      }
    }

    return userPrompt;
  }

  /**
   * Private helper: Build edit mode prompt
   */
  private buildEditModePrompt(editMode: any, tcc: BaseTCC): string {
    let editPrompt = `

🔄 EDIT MODE INSTRUCTIONS:
You are EDITING an existing JSX layout. Here is the current layout:

CURRENT LAYOUT:
\`\`\`jsx
${tcc.jsxLayout?.componentStructure || 'No existing layout found'}
\`\`\`

EDIT INSTRUCTIONS TO FOLLOW:`;

    editMode.instructions.forEach((instruction: any, index: number) => {
      editPrompt += `

${index + 1}. ${instruction.editType.toUpperCase()} REQUEST (${instruction.priority} priority):
${instruction.instructions}

Created: ${instruction.createdAt}`;
    });

    editPrompt += `

Please apply these edit instructions to create an improved version of the JSX layout. Maintain the structure where appropriate but implement the requested changes.`;

    return editPrompt;
  }

  /**
   * Private helper: Get system prompt
   */
  private getSystemPrompt(): string {
    // Import the existing system prompt
    const { getJsxLayoutSystemPrompt } = require('../../../prompts/v2/jsx-layout-prompt');
    return getJsxLayoutSystemPrompt(false);
  }

  /**
   * Private helper: Count components in JSX
   */
  private countComponents(jsx: string): number {
    const componentMatches = jsx.match(/<[a-zA-Z][^>]*>/g) || [];
    return componentMatches.length;
  }

  /**
   * Private helper: Calculate nesting depth
   */
  private calculateNestingDepth(jsx: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (let i = 0; i < jsx.length; i++) {
      if (jsx[i] === '<') {
        if (jsx[i + 1] === '/') {
          currentDepth--;
        } else {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);
        }
      }
    }
    
    return maxDepth;
  }

  /**
   * Private helper: Calculate accessibility score
   */
  private calculateAccessibilityScore(features: string[]): number {
    let score = 0;
    
    // Basic scoring based on accessibility features
    if (features.includes('Basic semantic HTML')) score += 20;
    if (features.some(f => f.toLowerCase().includes('aria'))) score += 30;
    if (features.some(f => f.toLowerCase().includes('keyboard'))) score += 25;
    if (features.some(f => f.toLowerCase().includes('screen reader'))) score += 25;
    
    return Math.min(100, score);
  }
} 