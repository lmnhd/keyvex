/**
 * Tailwind Styling Unified Module (Phase 1.2)
 * Properly extends BaseAgentModule - NO GENERIC TYPES!
 */

import { 
  AgentExecutionContext, 
  TailwindStylingResult,
  AgentType
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import { BaseAgentModule, AgentExecutionInput, BaseValidationResult } from '../core/base-agent-module';
import { applyStyling } from '../../../../app/api/ai/product-tool-creation-v2/agents/tailwind-styling/core-logic';

/**
 * TailwindStylingModule - Applies comprehensive Tailwind CSS styling
 */
export class TailwindStylingModule extends BaseAgentModule {
  constructor() {
    super('tailwind-styling' as AgentType, 15000); // 15 second timeout
  }

  /**
   * Execute Tailwind styling application
   */
  async execute(
    context: AgentExecutionContext,
    input: AgentExecutionInput
  ): Promise<TailwindStylingResult> {
    this.logExecution(context, 'start', {
      hasTcc: !!input.tcc,
      hasJsxLayout: !!input.tcc.jsxLayout
    });

    try {
      // Validate required inputs
      const validation = this.validateRequired(input.tcc, this.getRequiredInputFields());
      if (!validation.isValid) {
        throw new Error(`Missing required fields: ${validation.missingFields.join(', ')}`);
      }

      // Use existing core logic
      const result = await applyStyling({
        jobId: context.jobId,
        selectedModel: context.modelConfig.modelId,
        tcc: input.tcc,
        isIsolatedTest: context.isIsolatedTest
      });

      if (!result.success) {
        throw new Error(result.error || 'Tailwind styling execution failed');
      }

      // Convert to unified result format with NO GENERIC TYPES
      const stylingResult: TailwindStylingResult = {
        styling: result.styling!,
        metadata: {
          classCount: this.countTailwindClasses(result.styling?.styledComponentCode || ''),
          responsiveBreakpoints: this.extractResponsiveBreakpoints(result.styling?.styledComponentCode || ''),
          colorSchemeType: this.determineColorSchemeType(result.styling!)
        }
      };

      this.logExecution(context, 'success', {
        classCount: stylingResult.metadata.classCount,
        responsiveBreakpoints: stylingResult.metadata.responsiveBreakpoints.length,
        colorSchemeType: stylingResult.metadata.colorSchemeType
      });

      return stylingResult;
    } catch (error) {
      this.handleExecutionError(context, error, 'styling application');
    }
  }

  /**
   * Validate styling result
   */
  validate(output: TailwindStylingResult): BaseValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required styling fields
    if (!output.styling) {
      errors.push('Missing styling object');
      score -= 50;
    } else {
      if (!output.styling.styledComponentCode) {
        errors.push('Missing styled component code');
        score -= 30;
      }
      
      if (!output.styling.styleMap) {
        errors.push('Missing style map');
        score -= 20;
      } else if (Object.keys(output.styling.styleMap).length === 0) {
        warnings.push('Style map is empty');
        score -= 10;
      }

      if (!output.styling.colorScheme) {
        warnings.push('Missing color scheme');
        score -= 10;
      }
    }

    // Check metadata
    if (!output.metadata) {
      warnings.push('Missing metadata');
      score -= 5;
    } else {
      if (output.metadata.classCount === 0) {
        warnings.push('No Tailwind classes detected');
        score -= 10;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Get required input fields
   */
  getRequiredInputFields(): string[] {
    return [
      'jsxLayout.componentStructure',
      'jsxLayout.elementMap'
    ];
  }

  /**
   * Get agent description
   */
  protected getAgentDescription(): string {
    return 'Applies comprehensive Tailwind CSS styling with responsive design and color schemes';
  }

  /**
   * Support edit mode
   */
  supportsEditMode(): boolean {
    return true;
  }

  /**
   * Private helper: Count Tailwind classes
   */
  private countTailwindClasses(styledCode: string): number {
    const classMatches = styledCode.match(/className="[^"]*"/g) || [];
    let totalClasses = 0;
    
    classMatches.forEach(match => {
      const classes = match.replace(/className="/, '').replace(/"$/, '').split(' ');
      totalClasses += classes.filter(cls => cls.trim().length > 0).length;
    });
    
    return totalClasses;
  }

  /**
   * Private helper: Extract responsive breakpoints
   */
  private extractResponsiveBreakpoints(styledCode: string): string[] {
    const breakpoints = new Set<string>();
    const responsiveMatches = styledCode.match(/\b(sm|md|lg|xl|2xl):/g) || [];
    
    responsiveMatches.forEach(match => {
      breakpoints.add(match.replace(':', ''));
    });
    
    return Array.from(breakpoints);
  }

  /**
   * Private helper: Determine color scheme type
   */
  private determineColorSchemeType(styling: any): string {
    if (styling?.colorScheme) {
      return 'custom';
    }
    return 'default';
  }
}
