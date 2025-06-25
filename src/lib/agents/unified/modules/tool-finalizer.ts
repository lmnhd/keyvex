/**
 * Tool Finalizer Unified Module (Phase 1.2 - Refactored for Centralized Execution)
 * Conforms to the new simplified agent module structure.
 */

import { z } from 'zod';
import { 
  ToolFinalizerResult,
  AgentResult,
  ValidationResult,
  ToolConstructionContext
} from '../../../types/tcc-unified';
import { 
  BaseAgentModule
} from '../core/base-agent-module';
import { ProductToolDefinition } from '../../../types/product-tool';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../../logger';

/**
 * Zod schema for the ToolFinalizer's output.
 * Uses the main ProductToolDefinitionSchema.
 */
const ToolFinalizerResultSchema = z.object({
  finalProduct: ProductToolDefinitionSchema,
  metadata: z.object({
    completionTime: z.string(),
    qualityScore: z.number(),
    readinessLevel: z.enum(['development', 'staging', 'production']),
  }),
});

/**
 * ToolFinalizerModule - Now a configuration and validation provider.
 */
export class ToolFinalizerModule extends BaseAgentModule {
  constructor() {
    super('tool-finalizer', 10000); // 10 second timeout
  }

  /**
   * Exposes the Zod schema for this agent's output.
   */
  getOutputSchema(): z.ZodType<AgentResult> {
    return ToolFinalizerResultSchema;
  }

  /**
   * Validate the finalizer's structured output.
   */
  validate(output: ToolFinalizerResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

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
      if (!output.finalProduct.metadata?.title) {
        warnings.push('Missing tool title');
        score -= 5;
      }
      // Validate required fields for finalized tools
      if (!output.finalProduct.version) {
        errors.push('Missing version for finalized tool');
        score -= 15;
      }
      if (!output.finalProduct.status) {
        errors.push('Missing status for finalized tool');
        score -= 15;
      }
      if (!output.finalProduct.createdBy) {
        errors.push('Missing createdBy for finalized tool');
        score -= 10;
      }
    }

    if (output.metadata?.qualityScore < 70) {
      warnings.push('Low quality score detected');
      score -= 15;
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
   * 🔄 PROGRAMMATIC EXECUTION: Core method for finalizing tools
   * Takes validated JSX component and packages it into ProductToolDefinition
   */
  finalizeComponent(tcc: ToolConstructionContext): ToolFinalizerResult {
    const startTime = Date.now();
    
    logger.info({
      jobId: tcc.jobId,
      agentType: 'tool-finalizer'
    }, '🎯 TOOL FINALIZER: Starting programmatic finalization');

    try {
      // Validate required inputs
      if (!tcc.assembledComponentCode) {
        throw new Error('Missing assembled component code - component-assembler must run first');
      }

      // Calculate quality score based on validation results and completeness
      const qualityScore = this.calculateQualityScore(tcc);
      const readinessLevel = this.determineReadinessLevel(qualityScore, tcc);
      
      // Create the final ProductToolDefinition
      const finalProduct: ProductToolDefinition = {
        id: tcc.toolId || uuidv4(),
        version: '1.0.0',
        status: 'active',
        createdBy: tcc.userId || 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Core component data
        componentCode: tcc.assembledComponentCode,
        
        // Metadata from brainstorming and planning
        metadata: {
          title: tcc.brainstormData?.coreConcept || 'Generated Tool',
          description: tcc.brainstormData?.description || 'AI-generated tool',
          category: tcc.brainstormData?.category || 'utility',
          tags: tcc.brainstormData?.features || [],
          difficulty: 'intermediate',
          estimatedTime: '5-10 minutes'
        },
        
        // Function signatures for tool interface
        functionSignatures: tcc.functionSignatures || [],
        
        // State management information
        stateLogic: tcc.stateLogic || {
          variables: [],
          functions: [],
          imports: []
        },
        
        // Layout and styling
        jsxLayout: tcc.jsxLayout || {
          componentStructure: '',
          componentTree: {},
          componentSections: {}
        },
        
        styling: tcc.styling || {
          styleMap: {},
          globalStyles: '',
          componentStyles: {}
        },
        
        // Quality and validation data
        validationResult: tcc.validationResult || {
          isValid: true,
          syntaxErrors: [],
          typeErrors: [],
          warnings: [],
          suggestions: [],
          dependencies: [],
          complexity: 1
        },
        
        // Tool-specific metadata
        toolMetadata: {
          assemblyMethod: 'programmatic-jsx',
          codeLength: tcc.assembledComponentCode.length,
          hasState: (tcc.stateLogic?.variables?.length || 0) > 0,
          hasFunctions: (tcc.stateLogic?.functions?.length || 0) > 0,
          complexity: this.calculateComplexity(tcc),
          dependencies: this.extractDependencies(tcc.assembledComponentCode)
        }
      };

      const completionTime = Date.now() - startTime;

      const result: ToolFinalizerResult = {
        finalProduct,
        metadata: {
          completionTime: `${completionTime}ms`,
          qualityScore,
          readinessLevel
        }
      };

      logger.info({
        jobId: tcc.jobId,
        agentType: 'tool-finalizer',
        qualityScore,
        readinessLevel,
        completionTime,
        codeLength: finalProduct.componentCode.length
      }, '✅ TOOL FINALIZER: Programmatic finalization completed successfully');

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const completionTime = Date.now() - startTime;
      
      logger.error({
        jobId: tcc.jobId,
        agentType: 'tool-finalizer',
        error: errorMessage,
        completionTime
      }, '❌ TOOL FINALIZER: Programmatic finalization failed');
      
      throw error;
    }
  }

  /**
   * Calculate overall quality score based on validation and completeness
   */
  private calculateQualityScore(tcc: ToolConstructionContext): number {
    let score = 100;
    
    // Validation penalties
    if (tcc.validationResult) {
      score -= (tcc.validationResult.syntaxErrors?.length || 0) * 15;
      score -= (tcc.validationResult.typeErrors?.length || 0) * 10;
      score -= (tcc.validationResult.warnings?.length || 0) * 5;
    }
    
    // Completeness bonuses
    if (tcc.functionSignatures && tcc.functionSignatures.length > 0) score += 10;
    if (tcc.stateLogic && tcc.stateLogic.variables && tcc.stateLogic.variables.length > 0) score += 5;
    if (tcc.styling && tcc.styling.styleMap && Object.keys(tcc.styling.styleMap).length > 0) score += 10;
    if (tcc.brainstormData && tcc.brainstormData.features && tcc.brainstormData.features.length > 2) score += 5;
    
    // Code quality bonuses
    if (tcc.assembledComponentCode) {
      if (tcc.assembledComponentCode.includes('useState')) score += 5;
      if (tcc.assembledComponentCode.includes('import React')) score += 5;
      if (tcc.assembledComponentCode.length > 500) score += 10; // Substantial component
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine readiness level based on quality score and validation
   */
  private determineReadinessLevel(qualityScore: number, tcc: ToolConstructionContext): 'development' | 'staging' | 'production' {
    if (qualityScore >= 90 && tcc.validationResult?.isValid) {
      return 'production';
    } else if (qualityScore >= 70) {
      return 'staging';
    } else {
      return 'development';
    }
  }

  /**
   * Calculate code complexity based on various factors
   */
  private calculateComplexity(tcc: ToolConstructionContext): number {
    let complexity = 1;
    
    if (tcc.stateLogic?.variables) complexity += tcc.stateLogic.variables.length * 0.5;
    if (tcc.stateLogic?.functions) complexity += tcc.stateLogic.functions.length * 1;
    if (tcc.functionSignatures) complexity += tcc.functionSignatures.length * 0.8;
    
    if (tcc.assembledComponentCode) {
      // Count JSX elements
      const jsxElements = (tcc.assembledComponentCode.match(/<[A-Z]/g) || []).length;
      complexity += jsxElements * 0.2;
      
      // Count hooks
      const hooks = (tcc.assembledComponentCode.match(/use[A-Z]/g) || []).length;
      complexity += hooks * 0.5;
    }
    
    return Math.round(complexity * 10) / 10; // Round to 1 decimal
  }

  /**
   * Extract dependencies from the assembled component code
   */
  private extractDependencies(componentCode: string): string[] {
    const dependencies: string[] = [];
    
    // Extract import statements
    const importMatches = componentCode.match(/import.*?from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      importMatches.forEach(importStatement => {
        const match = importStatement.match(/from\s+['"]([^'"]+)['"]/);
        if (match && match[1]) {
          // Only include external dependencies (not relative imports)
          if (!match[1].startsWith('./') && !match[1].startsWith('../') && !match[1].startsWith('@/')) {
            dependencies.push(match[1]);
          }
        }
      });
    }
    
    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Define the required TCC fields for this agent.
   * 🔄 UPDATED: Now looks at assembledComponentCode from Phase 2
   */
  getRequiredInputFields(): string[] {
    return [
      'assembledComponentCode'
    ];
  }

  /**
   * Provide a description for logging.
   */
  protected getAgentDescription(): string {
    return 'Creates final ProductToolDefinition with metadata, styling, and packaging for deployment.';
  }
}
