/**
 * Response Parser (Phase 1.2 - Core Infrastructure)
 * Centralized AI response parsing and validation for all unified agents
 * NO GENERIC TYPES - Only strongly typed interfaces
 */

import { z } from 'zod';
import { 
  AgentType,
  AgentResult,
  FunctionPlannerResult,
  StateDesignResult,
  JsxLayoutResult,
  TailwindStylingResult,
  ComponentAssemblerResult,
  CodeValidatorResult,
  ToolFinalizerResult
} from '../../../types/tcc-unified';
import logger from '../../../logger';

/**
 * Parsed response result
 */
export interface ParsedResponse<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  warnings: string[];
  metadata: {
    responseSize: number;
    parseTime: number;
    validationScore: number;
  };
}

/**
 * ResponseParser - Centralized AI response parsing for all agents
 */
export class ResponseParser {
  private static instance: ResponseParser;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ResponseParser {
    if (!ResponseParser.instance) {
      ResponseParser.instance = new ResponseParser();
    }
    return ResponseParser.instance;
  }

  /**
   * Parse AI response for specific agent type
   */
  async parseAgentResponse<T extends AgentResult>(
    agentType: AgentType,
    rawResponse: any,
    jobId: string
  ): Promise<ParsedResponse<T>> {
    const startTime = Date.now();
    
    logger.info({
      jobId,
      agentType,
      responseType: typeof rawResponse,
      responseSize: JSON.stringify(rawResponse).length
    }, '🔍 RESPONSE PARSER: Starting response parsing');

    try {
      // Parse and validate response
      const parseResult = await this.parseWithValidation(agentType, rawResponse);
      const parseTime = Date.now() - startTime;

      if (parseResult.success) {
        logger.info({
          jobId,
          agentType,
          parseTime,
          validationScore: parseResult.metadata.validationScore
        }, '🔍 RESPONSE PARSER: Response parsed successfully');
      } else {
        logger.error({
          jobId,
          agentType,
          errors: parseResult.errors,
          parseTime
        }, '🔍 RESPONSE PARSER: Response parsing failed');
      }

      return parseResult as ParsedResponse<T>;
    } catch (error) {
      const parseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        jobId,
        agentType,
        error: errorMessage,
        parseTime
      }, '🔍 RESPONSE PARSER: Unexpected parsing error');

      return {
        success: false,
        data: null,
        errors: [errorMessage],
        warnings: [],
        metadata: {
          responseSize: JSON.stringify(rawResponse).length,
          parseTime,
          validationScore: 0
        }
      };
    }
  }

  /**
   * Parse response with validation
   */
  private async parseWithValidation(agentType: AgentType, rawResponse: any): Promise<ParsedResponse<any>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Try to parse as JSON if it's a string
      let parsedData = rawResponse;
      if (typeof rawResponse === 'string') {
        try {
          parsedData = JSON.parse(rawResponse);
        } catch (jsonError) {
          // Try to extract JSON from text response
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsedData = JSON.parse(jsonMatch[0]);
            } catch (extractError) {
              errors.push('Failed to parse JSON from text response');
              return this.createFailedParseResult(rawResponse, errors, warnings);
            }
          } else {
            errors.push('No valid JSON found in response');
            return this.createFailedParseResult(rawResponse, errors, warnings);
          }
        }
      }

      // Apply agent-specific validation and post-processing
      const processedData = await this.processResponseForAgent(agentType, parsedData);
      
      if (processedData) {
        return {
          success: true,
          data: processedData,
          errors: [],
          warnings,
          metadata: {
            responseSize: JSON.stringify(rawResponse).length,
            parseTime: 0, // Will be set by caller
            validationScore: this.calculateValidationScore(processedData, agentType)
          }
        };
      } else {
        errors.push('Failed to process response for agent type');
        return this.createFailedParseResult(rawResponse, errors, warnings);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Parsing error: ${errorMessage}`);
      return this.createFailedParseResult(rawResponse, errors, warnings);
    }
  }

  /**
   * Process response for specific agent types
   */
  private async processResponseForAgent(agentType: AgentType, data: any): Promise<any | null> {
    try {
      switch (agentType) {
        case 'function-planner':
          return this.processFunctionPlannerResponse(data);
        case 'state-design':
          return this.processStateDesignResponse(data);
        case 'jsx-layout':
          return this.processJsxLayoutResponse(data);
        case 'tailwind-styling':
          return this.processTailwindStylingResponse(data);
        case 'component-assembler':
          return this.processComponentAssemblerResponse(data);
        case 'code-validator':
          return this.processCodeValidatorResponse(data);
        case 'tool-finalizer':
          return this.processToolFinalizerResponse(data);
        default:
          return data;
      }
    } catch (error) {
      logger.error({ agentType, error: error instanceof Error ? error.message : String(error) }, 
        'Failed to process response for agent');
      return null;
    }
  }

  /**
   * Create failed parse result
   */
  private createFailedParseResult(rawResponse: any, errors: string[], warnings: string[]): ParsedResponse<any> {
    return {
      success: false,
      data: null,
      errors,
      warnings,
      metadata: {
        responseSize: JSON.stringify(rawResponse).length,
        parseTime: 0,
        validationScore: 0
      }
    };
  }

  /**
   * Calculate validation score based on data completeness
   */
  private calculateValidationScore(data: any, agentType: AgentType): number {
    let score = 100;

    switch (agentType) {
      case 'function-planner':
        if (!data.functionSignatures || data.functionSignatures.length === 0) score -= 50;
        if (!data.metadata) score -= 20;
        break;
      case 'state-design':
        if (!data.stateLogic) score -= 50;
        if (!data.stateLogic?.variables || data.stateLogic.variables.length === 0) score -= 20;
        if (!data.stateLogic?.functions || data.stateLogic.functions.length === 0) score -= 15;
        break;
      // Add more scoring logic as needed
    }

    return Math.max(0, score);
  }

  /**
   * Agent-specific response processing methods
   */
  private processFunctionPlannerResponse(data: any): FunctionPlannerResult | null {
    if (!data.functionSignatures || !Array.isArray(data.functionSignatures)) {
      return null;
    }

    const functionSignatures = data.functionSignatures.map((func: any) => ({
      name: func.name || 'unnamed',
      description: func.description || 'No description',
      parameters: func.parameters || [],
      returnType: func.returnType || 'void',
      complexity: func.complexity || 'moderate'
    }));

    return {
      functionSignatures,
      metadata: {
        totalFunctions: functionSignatures.length,
        complexityLevel: data.metadata?.complexityLevel || 'moderate',
        estimatedImplementationTime: data.metadata?.estimatedImplementationTime || '15-30 minutes'
      }
    };
  }

  private processStateDesignResponse(data: any): StateDesignResult | null {
    if (!data.stateLogic) {
      return null;
    }

    return {
      stateLogic: {
        variables: data.stateLogic.variables || [],
        functions: data.stateLogic.functions || [],
        imports: data.stateLogic.imports || []
      },
      metadata: {
        stateVariableCount: data.stateLogic.variables?.length || 0,
        functionCount: data.stateLogic.functions?.length || 0,
        complexityScore: data.metadata?.complexityScore || 50
      }
    };
  }

  private processJsxLayoutResponse(data: any): JsxLayoutResult | null {
    if (!data.jsxLayout || !data.jsxLayout.componentStructure) {
      return null;
    }

    return {
      jsxLayout: {
        componentStructure: data.jsxLayout.componentStructure,
        elementMap: data.jsxLayout.elementMap || [],
        accessibilityFeatures: data.jsxLayout.accessibilityFeatures || [],
        responsiveBreakpoints: data.jsxLayout.responsiveBreakpoints || []
      },
      metadata: {
        componentCount: data.metadata?.componentCount || 1,
        nestingDepth: data.metadata?.nestingDepth || 1,
        accessibilityScore: data.metadata?.accessibilityScore || 80
      }
    };
  }

  private processTailwindStylingResponse(data: any): TailwindStylingResult | null {
    if (!data.styling || !data.styling.styledComponentCode) {
      return null;
    }

    return {
      styling: {
        styledComponentCode: data.styling.styledComponentCode,
        styleMap: data.styling.styleMap || {},
        colorScheme: data.styling.colorScheme || {
          primary: '#3b82f6',
          secondary: '#6b7280',
          background: '#ffffff',
          surface: '#f9fafb',
          accent: '#8b5cf6',
          text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
          border: '#e5e7eb',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444'
        },
        designTokens: data.styling.designTokens || {}
      },
      metadata: {
        classCount: data.metadata?.classCount || 0,
        responsiveBreakpoints: data.metadata?.responsiveBreakpoints || [],
        colorSchemeType: data.metadata?.colorSchemeType || 'modern'
      }
    };
  }

  private processComponentAssemblerResponse(data: any): ComponentAssemblerResult | null {
    if (!data.assembledCode) {
      return null;
    }

    return {
      assembledCode: data.assembledCode,
      metadata: {
        codeLength: data.metadata?.codeLength || data.assembledCode.length,
        estimatedRenderTime: data.metadata?.estimatedRenderTime || '< 100ms',
        bundleSize: data.metadata?.bundleSize || 'Unknown'
      }
    };
  }

  private processCodeValidatorResponse(data: any): CodeValidatorResult | null {
    if (!data.validationResult) {
      return null;
    }

    return {
      validationResult: {
        isValid: data.validationResult.isValid || false,
        error: data.validationResult.error || (data.validationResult.errors && data.validationResult.errors.length > 0 ? data.validationResult.errors.join('; ') : undefined),
        details: data.validationResult.details || {
          warnings: data.validationResult.warnings || [],
          suggestions: data.validationResult.suggestions || [],
          score: data.validationResult.score || 0
        }
      },
      metadata: {
        issuesFound: data.metadata?.issuesFound || 0,
        securityScore: data.metadata?.securityScore || 100,
        performanceScore: data.metadata?.performanceScore || 100
      }
    };
  }

  private processToolFinalizerResponse(data: any): ToolFinalizerResult | null {
    if (!data.finalProduct) {
      return null;
    }

    return {
      finalProduct: {
        ...data.finalProduct,
        version: data.finalProduct.version || '1.0.0',
        createdBy: data.finalProduct.createdBy || 'unknown',
        componentSet: data.finalProduct.componentSet || 'shadcn',
        createdAt: data.finalProduct.createdAt || Date.now(),
        updatedAt: data.finalProduct.updatedAt || Date.now()
      },
      metadata: {
        completionTime: data.metadata?.completionTime || '0s',
        qualityScore: data.metadata?.qualityScore || 50,
        readinessLevel: data.metadata?.readinessLevel || 'development'
      }
    };
  }
}

/**
 * Convenience function to get response parser instance
 */
export function getResponseParser(): ResponseParser {
  return ResponseParser.getInstance();
}

/**
 * Convenience function to parse agent response
 */
export async function parseAgentResponse<T extends AgentResult>(
  agentType: AgentType,
  rawResponse: any,
  jobId: string
): Promise<ParsedResponse<T>> {
  const parser = getResponseParser();
  return parser.parseAgentResponse<T>(agentType, rawResponse, jobId);
} 