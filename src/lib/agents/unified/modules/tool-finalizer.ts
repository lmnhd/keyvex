/**
 * Tool Finalizer Unified Module (Phase 1.2 - Refactored for Centralized Execution)
 * Conforms to the new simplified agent module structure.
 */

import { z } from 'zod';
import { 
  ToolFinalizerResult,
  ValidationResult,
  ToolConstructionContext
} from '../../../types/tcc-unified';
import { 
  BaseAgentModule
} from '../core/base-agent-module';
import { ProductToolDefinition, ToolColorScheme } from '../../../types/product-tool';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../../logger';

/**
 * Zod schema for the ToolFinalizer's output.
 * Uses a custom schema since ProductToolDefinitionSchema doesn't exist.
 */
const ToolFinalizerResultSchema = z.object({
  finalProduct: z.object({
    id: z.string(),
    slug: z.string(),
    componentCode: z.string(),
    metadata: z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.string(),
      dependencies: z.array(z.string()),
      userInstructions: z.string(),
      developerNotes: z.string(),
      source: z.string(),
      version: z.string(),
      shortDescription: z.string().optional(),
      category: z.string().optional(),
      targetAudience: z.string().optional(),
      industry: z.string().optional(),
      tags: z.array(z.string()).optional(),
      estimatedCompletionTime: z.number().optional(),
      difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      features: z.array(z.string()).optional(),
      icon: z.object({
        type: z.enum(['lucide', 'emoji']),
        value: z.string(),
      }).optional(),
    }),
    initialStyleMap: z.record(z.string()),
    currentStyleMap: z.record(z.string()),
    createdAt: z.number(),
    updatedAt: z.number(),
    version: z.string().optional(),
    status: z.enum(['draft', 'published', 'archived', 'public']).optional(),
    createdBy: z.string().optional(),
    componentSet: z.enum(['shadcn', 'legacy']).optional(),
    colorScheme: z.object({
      primary: z.string(),
      secondary: z.string(),
      background: z.string(),
      surface: z.string(),
      text: z.object({
        primary: z.string(),
        secondary: z.string(),
        muted: z.string(),
      }),
      border: z.string(),
      success: z.string(),
      warning: z.string(),
      error: z.string(),
    }).optional(),
    analytics: z.object({
      enabled: z.boolean(),
      completions: z.number(),
      averageTime: z.number(),
    }).optional(),
  }),
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
   * Fixed to return the correct schema type for ToolFinalizerResult
   */
  getOutputSchema(): z.ZodSchema<any> {
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
      const toolId = tcc.jobId ? `tool-${tcc.jobId}` : `tool-${uuidv4()}`;
      const toolSlug = this.generateSlug(tcc.brainstormData?.coreConcept || tcc.brainstormData?.coreWConcept || 'Generated Tool');
      const timestamp = Date.now();

      const finalProduct: ProductToolDefinition = {
        // Basic info
        id: toolId,
        slug: toolSlug,
        componentCode: tcc.assembledComponentCode,
        
        // Metadata (following ProductToolMetadata interface)
        metadata: {
          id: toolId,
          slug: toolSlug,
          title: tcc.brainstormData?.coreConcept || tcc.brainstormData?.coreWConcept || 'Generated Tool',
          description: tcc.brainstormData?.valueProposition || 'AI-generated tool',
          type: 'calculator', // Default type since toolType doesn't exist in BrainstormData
          dependencies: this.extractDependencies(tcc.assembledComponentCode),
          userInstructions: this.generateUserInstructions(tcc),
          developerNotes: this.generateDeveloperNotes(tcc),
          source: 'ai-generated',
          version: '1.0.0',
          shortDescription: tcc.brainstormData?.coreConcept || tcc.brainstormData?.coreWConcept || 'AI-generated tool',
          category: 'utility', // Default category since it doesn't exist in BrainstormData
          targetAudience: tcc.userInput?.targetAudience || 'General users',
          industry: tcc.userInput?.industry || 'General',
          tags: tcc.brainstormData?.creativeEnhancements?.slice(0, 5) || [], // Use creative enhancements as tags
          estimatedCompletionTime: 5,
          difficultyLevel: this.determineDifficultyLevel(tcc),
          features: tcc.brainstormData?.creativeEnhancements || [], // Use creative enhancements as features
          icon: {
            type: 'lucide',
            value: 'Calculator'
          }
        },
        
        // Style information
        initialStyleMap: tcc.styling?.styleMap || {},
        currentStyleMap: tcc.styling?.styleMap || {},
        
        // Timestamps
        createdAt: timestamp,
        updatedAt: timestamp,
        
        // Optional fields
        version: '1.0.0',
        status: 'draft',
        createdBy: tcc.userId || 'system',
        componentSet: 'shadcn',
        colorScheme: this.extractColorScheme(tcc),
        
        // Analytics
        analytics: {
          enabled: false,
          completions: 0,
          averageTime: 0
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
      score -= (tcc.validationResult.errors?.length || 0) * 15;
      score -= (tcc.validationResult.warnings?.length || 0) * 5;
    }
    
    // Completeness bonuses
    if (tcc.functionSignatures && tcc.functionSignatures.length > 0) score += 10;
    if (tcc.stateLogic && tcc.stateLogic.variables && tcc.stateLogic.variables.length > 0) score += 5;
    if (tcc.styling && tcc.styling.styleMap && Object.keys(tcc.styling.styleMap).length > 0) score += 10;
    if (tcc.brainstormData && tcc.brainstormData.creativeEnhancements && tcc.brainstormData.creativeEnhancements.length > 2) score += 5;
    
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
    
    return Array.from(new Set(dependencies)); // Remove duplicates
  }

  /**
   * Generate a URL-friendly slug from the tool title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single
      .trim();
  }

  /**
   * Generate user instructions for the tool
   */
  private generateUserInstructions(tcc: ToolConstructionContext): string {
    const instructions: string[] = [];
    
    if (tcc.brainstormData?.suggestedInputs) {
      instructions.push('1. Fill in the required input fields');
      instructions.push('2. Click the calculate/submit button to get your results');
      instructions.push('3. Review the detailed breakdown and recommendations');
    }
    
    if (tcc.brainstormData?.interactionFlow) {
      tcc.brainstormData.interactionFlow.forEach((step, index) => {
        if (typeof step === 'string') {
          instructions.push(`${index + 1}. ${step}`);
        } else if (step && typeof step === 'object' && 'description' in step) {
          instructions.push(`${index + 1}. ${step.description}`);
        }
      });
    }

    return instructions.length > 0 
      ? instructions.join('\n') 
      : 'Use this tool to perform calculations and get insights based on your input data.';
  }

  /**
   * Generate developer notes for the tool
   */
  private generateDeveloperNotes(tcc: ToolConstructionContext): string {
    const notes: string[] = [];
    
    notes.push(`Generated using AI-powered tool assembly system`);
    notes.push(`Component uses React hooks and Tailwind CSS for styling`);
    
    if (tcc.stateLogic?.functions && tcc.stateLogic.functions.length > 0) {
      notes.push(`Contains ${tcc.stateLogic.functions.length} calculation functions`);
    }
    
    if (tcc.functionSignatures && tcc.functionSignatures.length > 0) {
      notes.push(`Implements ${tcc.functionSignatures.length} defined functions`);
    }
    
    if (tcc.validationResult && !tcc.validationResult.isValid) {
      notes.push(`Note: Tool has ${tcc.validationResult.errors?.length || 0} validation issues`);
    }

    return notes.join('\n');
  }

  /**
   * Determine difficulty level based on tool complexity
   */
  private determineDifficultyLevel(tcc: ToolConstructionContext): 'beginner' | 'intermediate' | 'advanced' {
    let complexity = 0;
    
    // Count state variables
    if (tcc.stateLogic?.variables) complexity += tcc.stateLogic.variables.length;
    
    // Count functions
    if (tcc.stateLogic?.functions) complexity += tcc.stateLogic.functions.length * 2;
    
    // Count input fields
    if (tcc.brainstormData?.suggestedInputs) complexity += tcc.brainstormData.suggestedInputs.length;
    
    // Count calculations
    if (tcc.brainstormData?.keyCalculations) complexity += tcc.brainstormData.keyCalculations.length * 3;

    if (complexity <= 5) return 'beginner';
    if (complexity <= 15) return 'intermediate';
    return 'advanced';
  }

  /**
   * Extract color scheme from TCC styling data
   */
  private extractColorScheme(tcc: ToolConstructionContext): ToolColorScheme | undefined {
    if (!tcc.styling?.colorScheme) {
      return {
        primary: '#007bff',
        secondary: '#6c757d',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: {
          primary: '#212529',
          secondary: '#6c757d',
          muted: '#adb5bd'
        },
        border: '#dee2e6',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545'
      };
    }

    // Use the existing color scheme from styling
    return {
      primary: tcc.styling.colorScheme.primary || '#007bff',
      secondary: tcc.styling.colorScheme.secondary || '#6c757d',
      background: tcc.styling.colorScheme.background || '#ffffff',
      surface: tcc.styling.colorScheme.surface || '#f8f9fa',
      text: {
        primary: tcc.styling.colorScheme.text?.primary || '#212529',
        secondary: tcc.styling.colorScheme.text?.secondary || '#6c757d',
        muted: tcc.styling.colorScheme.text?.muted || '#adb5bd'
      },
      border: tcc.styling.colorScheme.border || '#dee2e6',
      success: tcc.styling.colorScheme.success || '#28a745',
      warning: tcc.styling.colorScheme.warning || '#ffc107',
      error: tcc.styling.colorScheme.error || '#dc3545'
    };
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
