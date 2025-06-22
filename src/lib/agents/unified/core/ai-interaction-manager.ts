/**
 * AI Interaction Manager (Phase 1.2 - Core Infrastructure)
 * Centralized AI SDK interactions for all unified agents
 * NO GENERIC TYPES - Only strongly typed interfaces
 * 
 * This manager handles:
 * - Model instantiation and configuration
 * - Prompt preparation and execution  
 * - Response parsing and validation
 * - Retry logic and error handling
 * - Model fallback strategies
 */

import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { 
  AgentType,
  AgentResult,
  AgentExecutionContext,
  ModelConfiguration
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import { PromptManager } from './prompt-manager';
import { ResponseParser, ParsedResponse } from './response-parser';
import { RetryManager } from './retry-manager';
import { getModelProvider } from '../../../ai/models/model-config';
import logger from '../../../logger';

/**
 * AI interaction request configuration
 */
interface AIInteractionRequest {
  agentType: AgentType;
  context: AgentExecutionContext;
  tcc: BaseTCC;
  editMode?: {
    isEditMode: boolean;
    editInstructions?: string;
    currentResult?: any;
  };
  useStructuredOutput?: boolean;
  customSchema?: z.ZodSchema;
}

/**
 * AI interaction result
 */
interface AIInteractionResult<T extends AgentResult> {
  success: boolean;
  data: T | null;
  rawResponse: any;
  errors: string[];
  warnings: string[];
  metadata: {
    modelUsed: string;
    tokensUsed?: number;
    responseTime: number;
    attemptNumber: number;
    parseTime: number;
    validationScore: number;
  };
}

/**
 * AI Interaction Manager - Centralized AI SDK interactions
 */
export class AIInteractionManager {
  private static instance: AIInteractionManager;
  private promptManager: PromptManager;
  private responseParser: ResponseParser;
  private retryManager: RetryManager;

  private constructor() {
    this.promptManager = PromptManager.getInstance();
    this.responseParser = ResponseParser.getInstance();
    this.retryManager = new RetryManager();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AIInteractionManager {
    if (!AIInteractionManager.instance) {
      AIInteractionManager.instance = new AIInteractionManager();
    }
    return AIInteractionManager.instance;
  }

  /**
   * Execute AI interaction for an agent
   */
  async executeAgentInteraction<T extends AgentResult>(
    request: AIInteractionRequest
  ): Promise<AIInteractionResult<T>> {
    const startTime = Date.now();
    const { agentType, context, tcc, editMode, useStructuredOutput } = request;

    logger.info({
      jobId: context.jobId,
      agentType,
      modelId: context.modelConfig.modelId,
      useStructuredOutput: useStructuredOutput || false,
      isEditMode: editMode?.isEditMode || false
    }, '🤖 AI INTERACTION MANAGER: Starting agent interaction');

    try {
      // Execute with retry capability
      const result = await this.retryManager.executeWithRetry(
        context,
        async () => {
          return await this.performSingleInteraction<T>(request);
        }
      );

      const totalTime = Date.now() - startTime;

      logger.info({
        jobId: context.jobId,
        agentType,
        success: result.success,
        responseTime: totalTime,
        modelUsed: result.metadata.modelUsed,
        validationScore: result.metadata.validationScore
      }, '🤖 AI INTERACTION MANAGER: Agent interaction completed');

      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({
        jobId: context.jobId,
        agentType,
        error: errorMessage,
        responseTime: totalTime
      }, '🤖 AI INTERACTION MANAGER: Agent interaction failed');

      return {
        success: false,
        data: null,
        rawResponse: null,
        errors: [errorMessage],
        warnings: [],
        metadata: {
          modelUsed: context.modelConfig.modelId,
          responseTime: totalTime,
          attemptNumber: 1,
          parseTime: 0,
          validationScore: 0
        }
      };
    }
  }

  /**
   * Perform single AI interaction (used by retry manager)
   */
  private async performSingleInteraction<T extends AgentResult>(
    request: AIInteractionRequest
  ): Promise<AIInteractionResult<T>> {
    const { agentType, context, tcc, editMode, useStructuredOutput, customSchema } = request;
    const interactionStartTime = Date.now();

    try {
      // 1. Generate prompts using PromptManager
      const promptConfig = await this.promptManager.generatePromptConfig({
        agentType,
        tcc,
        context,
        editMode
      });

      // 2. Get model instance
      const model = await this.getModelInstance(context.modelConfig);

      // 3. Prepare messages
      const messages = [
        { role: 'system' as const, content: promptConfig.systemPrompt },
        { role: 'user' as const, content: promptConfig.userPrompt }
      ];

      // Add context data if available
      if (promptConfig.contextData.trim()) {
        messages.push({
          role: 'user' as const,
          content: `## Additional Context\n${promptConfig.contextData}`
        });
      }

      // 4. Execute AI call
      let rawResponse: any;
      let tokensUsed: number | undefined;

      if (useStructuredOutput && (customSchema || this.supportsStructuredOutput(agentType))) {
        // Use structured output for compatible agents
        const schema = customSchema || this.getDefaultSchemaForAgent(agentType);
        const response = await generateObject({
          model,
          messages,
          schema,
          temperature: context.modelConfig.temperature,
          maxTokens: context.modelConfig.maxTokens
        });
        
        rawResponse = response.object;
        tokensUsed = response.usage?.totalTokens;
      } else {
        // Use text generation
        const response = await generateText({
          model,
          messages,
          temperature: context.modelConfig.temperature,
          maxTokens: context.modelConfig.maxTokens,
          topP: context.modelConfig.topP,
          frequencyPenalty: context.modelConfig.frequencyPenalty,
          presencePenalty: context.modelConfig.presencePenalty
        });

        rawResponse = response.text;
        tokensUsed = response.usage?.totalTokens;
      }

      const responseTime = Date.now() - interactionStartTime;

      // 5. Parse response using ResponseParser
      const parseStartTime = Date.now();
      const parseResult = await this.responseParser.parseAgentResponse<T>(
        agentType,
        rawResponse,
        context.jobId
      );
      const parseTime = Date.now() - parseStartTime;

      // 6. Return result
      return {
        success: parseResult.success,
        data: parseResult.data,
        rawResponse,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
        metadata: {
          modelUsed: context.modelConfig.modelId,
          tokensUsed,
          responseTime,
          attemptNumber: 1, // Will be updated by retry manager
          parseTime,
          validationScore: parseResult.metadata.validationScore
        }
      };

    } catch (error) {
      const responseTime = Date.now() - interactionStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({
        jobId: context.jobId,
        agentType,
        error: errorMessage,
        responseTime
      }, '🤖 AI INTERACTION MANAGER: Single interaction failed');

      throw error; // Re-throw for retry manager
    }
  }

  /**
   * Get model instance from configuration
   */
  private async getModelInstance(config: ModelConfiguration): Promise<any> {
    try {
      // Import the appropriate model provider
      if (config.provider === 'openai') {
        const { openai } = await import('@ai-sdk/openai');
        return openai(config.modelId);
      } else if (config.provider === 'anthropic') {
        const { anthropic } = await import('@ai-sdk/anthropic');
        return anthropic(config.modelId);
      } else {
        throw new Error(`Unsupported model provider: ${config.provider}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create model instance: ${errorMessage}`);
    }
  }

  /**
   * Check if agent supports structured output
   */
  private supportsStructuredOutput(agentType: AgentType): boolean {
    // These agents benefit from structured output
    const structuredOutputAgents: AgentType[] = [
      'function-planner',
      'state-design', 
      'jsx-layout',
      'tailwind-styling',
      'code-validator',
      'tool-finalizer'
    ];
    
    return structuredOutputAgents.includes(agentType);
  }

  /**
   * Get default schema for agent (fallback when no custom schema provided)
   */
  private getDefaultSchemaForAgent(agentType: AgentType): z.ZodSchema {
    switch (agentType) {
      case 'function-planner':
        return z.object({
          functionSignatures: z.array(z.object({
            name: z.string(),
            description: z.string(),
            parameters: z.array(z.any()).optional(),
            returnType: z.string().optional()
          })),
          metadata: z.object({
            totalFunctions: z.number(),
            complexityLevel: z.enum(['simple', 'moderate', 'complex']),
            estimatedImplementationTime: z.string()
          })
        });

      case 'state-design':
        return z.object({
          stateLogic: z.object({
            variables: z.array(z.any()),
            functions: z.array(z.any()),
            imports: z.array(z.string()).optional()
          }),
          metadata: z.object({
            stateVariableCount: z.number(),
            functionCount: z.number(),
            complexityScore: z.number()
          })
        });

      case 'jsx-layout':
        return z.object({
          jsxLayout: z.object({
            componentStructure: z.string()
          }),
          metadata: z.object({
            componentCount: z.number(),
            nestingDepth: z.number(),
            accessibilityScore: z.number()
          })
        });

      case 'tailwind-styling':
        return z.object({
          styling: z.object({
            styledComponentCode: z.string(),
            styleMap: z.record(z.string())
          }),
          metadata: z.object({
            classCount: z.number(),
            responsiveBreakpoints: z.array(z.string()),
            colorSchemeType: z.string()
          })
        });

      case 'code-validator':
        return z.object({
          validationResult: z.object({
            isValid: z.boolean(),
            error: z.string().optional()
          }),
          metadata: z.object({
            issuesFound: z.number(),
            securityScore: z.number(),
            performanceScore: z.number()
          })
        });

      case 'tool-finalizer':
        return z.object({
          finalProduct: z.any(),
          metadata: z.object({
            completionTime: z.string(),
            qualityScore: z.number(),
            readinessLevel: z.enum(['development', 'staging', 'production'])
          })
        });

      default:
        // Generic fallback schema
        return z.object({
          result: z.any(),
          metadata: z.object({}).optional()
        });
    }
  }
}

/**
 * Convenience function to get AI interaction manager instance
 */
export function getAIInteractionManager(): AIInteractionManager {
  return AIInteractionManager.getInstance();
}

/**
 * Convenience function to execute agent AI interaction
 */
export async function executeAgentAI<T extends AgentResult>(
  agentType: AgentType,
  context: AgentExecutionContext,
  tcc: BaseTCC,
  options?: {
    editMode?: { isEditMode: boolean; editInstructions?: string; currentResult?: any };
    useStructuredOutput?: boolean;
    customSchema?: z.ZodSchema;
  }
): Promise<AIInteractionResult<T>> {
  const manager = getAIInteractionManager();
  return manager.executeAgentInteraction<T>({
    agentType,
    context,
    tcc,
    editMode: options?.editMode,
    useStructuredOutput: options?.useStructuredOutput,
    customSchema: options?.customSchema
  });
} 