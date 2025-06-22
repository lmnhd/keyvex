/**
 * Component Assembler Unified Module (Phase 2)
 * Properly extends BaseAgentModule - NO GENERIC TYPES!
 */

import { 
  AgentExecutionContext, 
  ComponentAssemblerResult,
  AgentType
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import { BaseAgentModule, AgentExecutionInput, BaseValidationResult } from '../core/base-agent-module';
import { generateAssembledComponent } from '../../../../app/api/ai/product-tool-creation-v2/agents/component-assembler/core-logic';
import logger from '../../../logger';

/**
 * ComponentAssemblerModule - Combines JSX layout, state logic, and styling into final React component
 */
export class ComponentAssemblerModule extends BaseAgentModule {
  constructor() {
    super('component-assembler' as AgentType, 60000); // 60 second timeout for complex assembly
  }

  /**
   * Execute component assembly
   */
  async execute(
    context: AgentExecutionContext,
    input: AgentExecutionInput
  ): Promise<ComponentAssemblerResult> {
    this.logExecution(context, 'start', {
      hasTcc: !!input.tcc,
      hasJsxLayout: !!input.tcc.jsxLayout,
      hasStateLogic: !!input.tcc.stateLogic,
      hasStyling: !!input.tcc.styling
    });

    try {
      // Validate required inputs
      const validation = this.validateRequired(input.tcc, this.getRequiredInputFields());
      if (!validation.isValid) {
        throw new Error(`Missing required fields: ${validation.missingFields.join(', ')}`);
      }

      // Use existing core logic with enhanced error handling
      const result = await generateAssembledComponent({
        jobId: context.jobId,
        selectedModel: context.modelConfig.modelId,
        tcc: input.tcc,
        isIsolatedTest: context.isIsolatedTest,
        editMode: context.editMode
      });

      if (!result.success) {
        throw new Error(result.error || 'Component assembly execution failed');
      }

      if (!result.assembledComponent) {
        throw new Error('Component assembly succeeded but no assembled component returned');
      }

      // Convert to unified result format with NO GENERIC TYPES
      const assemblerResult: ComponentAssemblerResult = {
        assembledCode: result.assembledComponent.finalComponentCode,
        metadata: {
          codeLength: result.assembledComponent.finalComponentCode.length,
          estimatedRenderTime: this.estimateRenderTime(result.assembledComponent.finalComponentCode),
          bundleSize: this.estimateBundleSize(result.assembledComponent.finalComponentCode)
        }
      };

      this.logExecution(context, 'success', {
        codeLength: assemblerResult.metadata.codeLength,
        estimatedRenderTime: assemblerResult.metadata.estimatedRenderTime,
        bundleSize: assemblerResult.metadata.bundleSize,
        componentName: result.assembledComponent.componentName,
        hooksUsed: result.assembledComponent.hooks?.length || 0,
        functionsCount: result.assembledComponent.functions?.length || 0
      });

      return assemblerResult;
    } catch (error) {
      this.handleExecutionError(context, error, 'component assembly');
    }
  }

  /**
   * Validate component assembler result
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
   * Get required input fields
   */
  getRequiredInputFields(): string[] {
    return [
      'jsxLayout.componentStructure',
      'stateLogic.variables',
      'styling.styledComponentCode'
    ];
  }

  /**
   * Get agent description
   */
  protected getAgentDescription(): string {
    return 'Combines JSX layout, state logic, and styling into final executable React component';
  }

  /**
   * Support edit mode
   */
  supportsEditMode(): boolean {
    return true;
  }

  /**
   * Private helper: Estimate render time based on component complexity
   */
  private estimateRenderTime(componentCode: string): string {
    const lines = componentCode.split('\n').length;
    const stateHooks = (componentCode.match(/useState/g) || []).length;
    const effectHooks = (componentCode.match(/useEffect/g) || []).length;
    
    // Simple heuristic based on complexity
    if (lines < 50 && stateHooks < 3) {
      return '< 1ms';
    } else if (lines < 200 && stateHooks < 10) {
      return '< 5ms';
    } else if (lines < 500) {
      return '< 10ms';
    } else {
      return '< 20ms';
    }
  }

  /**
   * Private helper: Estimate bundle size
   */
  private estimateBundleSize(componentCode: string): string {
    const bytes = new Blob([componentCode]).size;
    
    if (bytes < 1024) {
      return `${bytes}B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)}KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }
  }
} 