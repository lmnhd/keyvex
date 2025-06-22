/**
 * Response Parser for Unified Agents (Phase 1.2)
 * Handles parsing and validation of AI responses for all unified agents
 * ✅ FIXED: NO GENERIC TYPES - All types are strongly defined and used.
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
  ToolFinalizerResult,
  StateLogic,
  DefinedFunctionSignature
} from '../../../types/tcc-unified';
import { JsxLayout, Styling, ValidationResult } from '@/lib/types/product-tool-creation-v2/tcc';
import { ProductToolDefinition } from '@/lib/types/product-tool';
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

// ✅ FIXED: These raw response types are used for type-safe casting
export type FunctionPlannerRawResponse = { functionSignatures?: Partial<DefinedFunctionSignature>[], metadata?: Partial<FunctionPlannerResult['metadata']> };
export type StateDesignRawResponse = { stateLogic?: Partial<StateLogic>, metadata?: Partial<StateDesignResult['metadata']> };
export type JsxLayoutRawResponse = { jsxLayout?: Partial<JsxLayout>, metadata?: Partial<JsxLayoutResult['metadata']> };
export type TailwindStylingRawResponse = { styling?: Partial<Styling>, metadata?: Partial<TailwindStylingResult['metadata']> };
export type ComponentAssemblerRawResponse = Partial<ComponentAssemblerResult>;
export type CodeValidatorRawResponse = { validationResult?: Partial<ValidationResult>, metadata?: Partial<CodeValidatorResult['metadata']> };
export type ToolFinalizerRawResponse = { finalProduct?: Partial<ProductToolDefinition>, metadata?: Partial<ToolFinalizerResult['metadata']> };

/**
 * ResponseParser - Centralized AI response parsing for all agents
 */
export class ResponseParser {
  private static instance: ResponseParser;

  private constructor() {}

  /** Get singleton instance */
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
    rawResponse: AgentResult | string,
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
      const parseResult = await this.parseWithValidation(agentType, rawResponse);
      const parseTime = Date.now() - startTime;

      if (parseResult.success) {
        logger.info({ jobId, agentType, parseTime, validationScore: parseResult.metadata.validationScore }, '🔍 RESPONSE PARSER: Response parsed successfully');
      } else {
        logger.error({ jobId, agentType, errors: parseResult.errors, parseTime }, '🔍 RESPONSE PARSER: Response parsing failed');
      }

      return parseResult as ParsedResponse<T>;
    } catch (error) {
      const parseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ jobId, agentType, error: errorMessage, parseTime }, '🔍 RESPONSE PARSER: Unexpected parsing error');
      return this.createFailedParseResult(rawResponse, [errorMessage], []);
    }
  }

  /**
   * Parse response with validation
   */
  private async parseWithValidation(agentType: AgentType, rawResponse: AgentResult | string): Promise<ParsedResponse<AgentResult>> {
    try {
      let dataToProcess: object;
      
      if (typeof rawResponse === 'string') {
        try {
            dataToProcess = JSON.parse(rawResponse);
        } catch (jsonError) {
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    dataToProcess = JSON.parse(jsonMatch[0]);
                } catch (extractError) {
                    return this.createFailedParseResult(rawResponse, ['Failed to parse JSON from text response'], []);
                }
            } else {
                return this.createFailedParseResult(rawResponse, ['No valid JSON found in response'], []);
            }
        }
      } else {
        dataToProcess = rawResponse;
      }
      
      const processedData = await this.processResponseForAgent(agentType, dataToProcess as AgentResult);
      if (!processedData) {
        return this.createFailedParseResult(rawResponse, [`Failed to process data for agent ${agentType}`], []);
      }
      
      return {
        success: true,
        data: processedData,
        errors: [],
        warnings: [],
        metadata: {
          responseSize: JSON.stringify(rawResponse).length,
          parseTime: 0,
          validationScore: this.calculateValidationScore(processedData, agentType)
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createFailedParseResult(rawResponse, [`Parsing error: ${errorMessage}`], []);
    }
  }

  /**
   * Process response for a specific agent type
   */
  private async processResponseForAgent(agentType: AgentType, data: AgentResult): Promise<AgentResult | null> {
    try {
      switch (agentType) {
        case 'function-planner':
          return this.processFunctionPlannerResponse(data as FunctionPlannerRawResponse);
        case 'state-design':
          return this.processStateDesignResponse(data as StateDesignRawResponse);
        case 'jsx-layout':
          return this.processJsxLayoutResponse(data as JsxLayoutRawResponse);
        case 'tailwind-styling':
          return this.processTailwindStylingResponse(data as TailwindStylingRawResponse);
        case 'component-assembler':
          return this.processComponentAssemblerResponse(data as ComponentAssemblerRawResponse);
        case 'code-validator':
          return this.processCodeValidatorResponse(data as CodeValidatorRawResponse);
        case 'tool-finalizer':
          return this.processToolFinalizerResponse(data as ToolFinalizerRawResponse);
        default:
          return null;
      }
    } catch (error) {
      logger.error({ agentType, error: error instanceof Error ? error.message : String(error) }, 
        'Failed to process response for agent');
      return null;
    }
  }

  /** Create failed parse result */
  private createFailedParseResult<T extends AgentResult>(rawResponse: AgentResult | string, errors: string[], warnings: string[]): ParsedResponse<T> {
    return {
      success: false, data: null, errors, warnings,
      metadata: { responseSize: JSON.stringify(rawResponse).length, parseTime: 0, validationScore: 0 }
    };
  }

  /** Calculate validation score based on data completeness */
  private calculateValidationScore(data: AgentResult, agentType: AgentType): number {
    let score = 100;
    switch (agentType) {
      case 'function-planner': {
        const d = data as FunctionPlannerResult;
        if (!d.functionSignatures || d.functionSignatures.length === 0) score -= 50;
        if (!d.metadata) score -= 20;
        break;
      }
      case 'state-design': {
        const d = data as StateDesignResult;
        if (!d.stateLogic) score -= 50;
        if (!d.stateLogic?.variables || d.stateLogic.variables.length === 0) score -= 20;
        if (!d.stateLogic?.functions || d.stateLogic.functions.length === 0) score -= 15;
        break;
      }
    }
    return Math.max(0, score);
  }

  /**
   * Agent-specific processors with strongly-typed responses
   */
  private processFunctionPlannerResponse(data: FunctionPlannerRawResponse): FunctionPlannerResult | null {
    if (!data.functionSignatures) return null;
    return {
      functionSignatures: data.functionSignatures.map(f => ({ 
        name: f.name || 'defaultName', 
        description: f.description || 'No description provided',
      })),
      metadata: {
        totalFunctions: data.metadata?.totalFunctions || data.functionSignatures.length,
        complexityLevel: data.metadata?.complexityLevel || 'moderate',
        estimatedImplementationTime: data.metadata?.estimatedImplementationTime || 'N/A',
      }
    };
  }

  private processStateDesignResponse(data: StateDesignRawResponse): StateDesignResult | null {
    if (!data.stateLogic) return null;
    return {
      stateLogic: {
        variables: data.stateLogic.variables || [],
        functions: data.stateLogic.functions || [],
        imports: data.stateLogic.imports || [],
      },
      metadata: {
        stateVariableCount: data.metadata?.stateVariableCount || data.stateLogic.variables?.length || 0,
        functionCount: data.metadata?.functionCount || data.stateLogic.functions?.length || 0,
        complexityScore: data.metadata?.complexityScore || 50,
      }
    };
  }

  private processJsxLayoutResponse(data: JsxLayoutRawResponse): JsxLayoutResult | null {
    if (!data.jsxLayout?.componentStructure) return null;
    return {
      jsxLayout: {
        componentStructure: data.jsxLayout.componentStructure,
        elementMap: data.jsxLayout.elementMap || [],
        accessibilityFeatures: data.jsxLayout.accessibilityFeatures || [],
        responsiveBreakpoints: data.jsxLayout.responsiveBreakpoints || [],
      },
      metadata: {
        componentCount: data.metadata?.componentCount || 1,
        nestingDepth: data.metadata?.nestingDepth || 1,
        accessibilityScore: data.metadata?.accessibilityScore || 80,
      }
    };
  }

  private processTailwindStylingResponse(data: TailwindStylingRawResponse): TailwindStylingResult | null {
    if (!data.styling?.styledComponentCode) return null;
    const defaultColorScheme = {
        primary: '#3b82f6', secondary: '#6b7280', background: '#ffffff', surface: '#f9fafb', accent: '#8b5cf6',
        text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
        border: '#e5e7eb', success: '#10b981', warning: '#f59e0b', error: '#ef4444'
    };
    const defaultDesignTokens = {
        spacing: {}, typography: {}, shadows: {}, animations: {}
    };
    return {
      styling: {
        styledComponentCode: data.styling.styledComponentCode,
        styleMap: data.styling.styleMap || {},
        colorScheme: { ...defaultColorScheme, ...(data.styling.colorScheme as object || {}) },
        designTokens: data.styling.designTokens || defaultDesignTokens,
      },
      metadata: {
        classCount: data.metadata?.classCount || 0,
        responsiveBreakpoints: data.metadata?.responsiveBreakpoints || [],
        colorSchemeType: data.metadata?.colorSchemeType || 'modern',
      }
    };
  }

  private processComponentAssemblerResponse(data: ComponentAssemblerRawResponse): ComponentAssemblerResult | null {
    if (!data.assembledCode) return null;
    return {
      assembledCode: data.assembledCode,
      metadata: {
        codeLength: data.metadata?.codeLength || data.assembledCode.length,
        estimatedRenderTime: data.metadata?.estimatedRenderTime || '<100ms',
        bundleSize: data.metadata?.bundleSize || 'Unknown',
      }
    };
  }

  private processCodeValidatorResponse(data: CodeValidatorRawResponse): CodeValidatorResult | null {
    if (!data.validationResult) return null;
    return {
      validationResult: {
        isValid: data.validationResult.isValid || false,
        error: data.validationResult.error,
        details: data.validationResult.details,
      },
      metadata: {
        issuesFound: data.metadata?.issuesFound || 0,
        securityScore: data.metadata?.securityScore || 100,
        performanceScore: data.metadata?.performanceScore || 100,
      }
    };
  }

  private processToolFinalizerResponse(data: ToolFinalizerRawResponse): ToolFinalizerResult | null {
    if (!data.finalProduct) return null;
    const now = Date.now();
    return {
      finalProduct: {
        id: data.finalProduct.id || '',
        slug: data.finalProduct.slug || '',
        componentCode: data.finalProduct.componentCode || '',
        status: data.finalProduct.status || 'draft',
        version: data.finalProduct.version || '1.0.0',
        createdAt: data.finalProduct.createdAt || now,
        updatedAt: data.finalProduct.updatedAt || now,
        createdBy: data.finalProduct.createdBy || 'ai-agent',
        metadata: {
          id: data.finalProduct.metadata?.id || data.finalProduct.id || '',
          slug: data.finalProduct.metadata?.slug || data.finalProduct.slug || '',
          title: data.finalProduct.metadata?.title || 'Untitled Tool',
          description: data.finalProduct.metadata?.description || 'AI-generated tool',
          type: data.finalProduct.metadata?.type || 'calculator',
          shortDescription: data.finalProduct.metadata?.shortDescription || 'AI-generated tool',
          category: data.finalProduct.metadata?.category || 'general',
          targetAudience: data.finalProduct.metadata?.targetAudience || 'general',
          industry: data.finalProduct.metadata?.industry || 'general',
          tags: data.finalProduct.metadata?.tags || [],
          estimatedCompletionTime: data.finalProduct.metadata?.estimatedCompletionTime || 5,
          difficultyLevel: data.finalProduct.metadata?.difficultyLevel || 'beginner',
          features: data.finalProduct.metadata?.features || [],
          dependencies: data.finalProduct.metadata?.dependencies || ['react'],
          userInstructions: data.finalProduct.metadata?.userInstructions || 'Use this tool to perform calculations.',
          developerNotes: data.finalProduct.metadata?.developerNotes || 'Generated by AI agent.',
          source: data.finalProduct.metadata?.source || 'ai-generated',
          version: data.finalProduct.metadata?.version || '1.0.0',
          icon: data.finalProduct.metadata?.icon || { name: 'calculator', color: '#3b82f6' }
        },
        componentSet: data.finalProduct.componentSet || 'shadcn',
        colorScheme: data.finalProduct.colorScheme || {},
        initialStyleMap: data.finalProduct.initialStyleMap || {},
        currentStyleMap: data.finalProduct.currentStyleMap || data.finalProduct.initialStyleMap || {},
        analytics: data.finalProduct.analytics || { enabled: false, completions: 0, averageTime: 0 }
      } as ProductToolDefinition,
      metadata: {
        completionTime: data.metadata?.completionTime || '0s',
        qualityScore: data.metadata?.qualityScore || 80,
        readinessLevel: data.metadata?.readinessLevel || 'development',
      }
    };
  }
}

/** Convenience function to get response parser instance */
export function getResponseParser(): ResponseParser {
  return ResponseParser.getInstance();
}

/**
 * Convenience function to parse agent response
 */
export async function parseAgentResponse<T extends AgentResult>(
  agentType: AgentType,
  rawResponse: AgentResult | string,
  jobId: string
): Promise<ParsedResponse<T>> {
  const parser = getResponseParser();
  return parser.parseAgentResponse<T>(agentType, rawResponse, jobId);
}