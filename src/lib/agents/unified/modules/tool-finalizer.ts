/**
 * Tool Finalizer Unified Module (Phase 1.2)
 * Properly extends BaseAgentModule - NO GENERIC TYPES!
 */

import { 
  AgentExecutionContext, 
  ToolFinalizerResult,
  AgentType
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import { BaseAgentModule, AgentExecutionInput, BaseValidationResult } from '../core/base-agent-module';
import { finalizeTool } from '../../../../app/api/ai/product-tool-creation-v2/agents/tool-finalizer/core-logic';

/**
 * ToolFinalizerModule - Creates final ProductToolDefinition from validated TCC
 */
export class ToolFinalizerModule extends BaseAgentModule {
  constructor() {
    super('tool-finalizer' as AgentType, 10000); // 10 second timeout
  }

  /**
   * Execute tool finalization
   */
  async execute(
    context: AgentExecutionContext,
    input: AgentExecutionInput
  ): Promise<ToolFinalizerResult> {
    this.logExecution(context, 'start', {
      hasTcc: !!input.tcc,
      hasValidationResult: !!input.tcc.validationResult,
      hasFinalProduct: !!input.tcc.finalProduct
    });

    try {
      // Validate required inputs
      const validation = this.validateRequired(input.tcc, this.getRequiredInputFields());
      if (!validation.isValid) {
        throw new Error(`Missing required fields: ${validation.missingFields.join(', ')}`);
      }

      // Use existing core logic
      const result = await finalizeTool({
        jobId: context.jobId,
        selectedModel: context.modelConfig.modelId,
        tcc: input.tcc
      });

      if (!result.success) {
        throw new Error(result.error || 'Tool finalization execution failed');
      }

      // Convert to unified result format with NO GENERIC TYPES
      const finalizerResult: ToolFinalizerResult = {
        finalProduct: result.finalProduct!,
        metadata: {
          completionTime: this.calculateCompletionTime(input.tcc),
          qualityScore: this.calculateQualityScore(input.tcc, result.finalProduct!),
          readinessLevel: this.determineReadinessLevel(input.tcc)
        }
      };

      this.logExecution(context, 'success', {
        completionTime: finalizerResult.metadata.completionTime,
        qualityScore: finalizerResult.metadata.qualityScore,
        readinessLevel: finalizerResult.metadata.readinessLevel,
        toolId: result.finalProduct?.id
      });

      return finalizerResult;
    } catch (error) {
      this.handleExecutionError(context, error, 'tool finalization');
    }
  }

  /**
   * Validate finalizer result
   */
  validate(output: ToolFinalizerResult): BaseValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required final product fields
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

      if (!output.finalProduct.metadata) {
        errors.push('Missing final product metadata');
        score -= 20;
      } else {
        if (!output.finalProduct.metadata.title) {
          warnings.push('Missing tool title');
          score -= 5;
        }
        
        if (!output.finalProduct.metadata.description) {
          warnings.push('Missing tool description');
          score -= 5;
        }
      }
    }

    // Check metadata
    if (!output.metadata) {
      warnings.push('Missing finalizer metadata');
      score -= 5;
    } else {
      if (output.metadata.qualityScore < 70) {
        warnings.push('Low quality score detected');
        score -= 15;
      }

      if (output.metadata.readinessLevel === 'development') {
        warnings.push('Tool still in development readiness level');
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
      'finalProduct.componentCode',
      'validationResult.isValid'
    ];
  }

  /**
   * Get agent description
   */
  protected getAgentDescription(): string {
    return 'Creates final ProductToolDefinition with metadata, styling, and packaging for deployment';
  }

  /**
   * Support edit mode
   */
  supportsEditMode(): boolean {
    return false; // Finalizer doesn't need edit mode
  }

  /**
   * Private helper: Calculate completion time
   */
  private calculateCompletionTime(tcc: BaseTCC): string {
    const startTime = tcc.createdAt ? new Date(tcc.createdAt).getTime() : Date.now();
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Private helper: Calculate quality score
   */
  private calculateQualityScore(tcc: BaseTCC, finalProduct: any): number {
    let score = 100;
    
    // Deduct points for validation issues
    if (tcc.validationResult && !tcc.validationResult.isValid) {
      score -= 20;
    }
    
    // Check for complete metadata
    if (!finalProduct.metadata?.title || !finalProduct.metadata?.description) {
      score -= 10;
    }
    
    // Check for styling completeness
    if (!tcc.styling?.styleMap || Object.keys(tcc.styling.styleMap).length === 0) {
      score -= 15;
    }
    
    // Check for state logic completeness
    if (!tcc.stateLogic?.variables || tcc.stateLogic.variables.length === 0) {
      score -= 10;
    }
    
    return Math.max(0, score);
  }

  /**
   * Private helper: Determine readiness level
   */
  private determineReadinessLevel(tcc: BaseTCC): 'development' | 'staging' | 'production' {
    // Check validation status
    if (!tcc.validationResult || !tcc.validationResult.isValid) {
      return 'development';
    }
    
    // Check completeness of all components
    const hasCompleteComponents = !!(
      tcc.stateLogic &&
      tcc.jsxLayout &&
      tcc.styling &&
      tcc.finalProduct
    );
    
    if (!hasCompleteComponents) {
      return 'development';
    }
    
    // If validation passes and all components exist, consider staging ready
    return 'staging';
  }
}
