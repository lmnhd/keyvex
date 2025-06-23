/**
 * AI Interaction Manager (Phase 1.2 - Centralized & Refactored)
 * Single source of truth for all AI model interactions.
 * ✅ FIXED: NO GENERIC TYPES - All types are strongly defined.
 * 
 * CRITICAL REFACTOR: This module now fully centralizes AI calls.
 * - Uses the new PromptManager to construct prompts.
 * - Handles model selection, including retry-based model switching.
 * - Abstracts the AI SDK call (generateObject) away from all other modules.
 * - Individual agent modules NO LONGER call this manager directly.
 */

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import {
  AgentType,
  RetryAttemptInfo,
  ToolConstructionContext,
  AgentResult,
  AgentExecutionContext
} from '../../../types/tcc-unified';
import { ModelConfiguration } from '../../../ai/model-configuration';
import { getSystemPrompt, constructUserPrompt } from './prompt-manager';
import logger from '../../../logger';

// Helper function to create model instance using AI SDK providers
function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'anthropic':
      return anthropic(modelId);
    case 'openai':
      return openai(modelId);
    default:
      // Fallback to a default model if provider is unknown
      logger.warn({ provider }, 'Unknown provider specified, defaulting to OpenAI gpt-4o');
      return openai('gpt-4o');
  }
}

// ✅ FIXED: No 'any' types. rawResponse is now strongly typed as AgentResult.
interface AIInteractionResult {
  success: boolean;
  rawResponse: AgentResult | null;
  metadata: {
    modelUsed: string;
    tokensUsed?: number;
    responseTime: number;
  };
  errors: string[];
}

/**
 * AIInteractionManager - Centralizes all AI model calls
 */
export class AIInteractionManager {
  private static instance: AIInteractionManager;

  private constructor() {}

  public static getInstance(): AIInteractionManager {
    if (!AIInteractionManager.instance) {
      AIInteractionManager.instance = new AIInteractionManager();
    }
    return AIInteractionManager.instance;
  }

  /**
   * The single, centralized method for executing an agent's AI interaction.
   * This is called by the AgentExecutor, not by individual agent modules.
   * ✅ FIXED: outputSchema is strongly typed to return a Zod schema for an AgentResult.
   */
  public async executeAgentInteraction(
    agentType: AgentType,
    context: AgentExecutionContext,
    tcc: ToolConstructionContext,
    retryInfo: RetryAttemptInfo,
    outputSchema: z.ZodType<AgentResult>
  ): Promise<AIInteractionResult> {
    const startTime = Date.now();
    
    // 1. Determine which model to use (honoring retry adaptations)
    const modelToUse = retryInfo.adaptedModel || context.modelConfig.modelId;
    const provider = modelToUse.includes('claude') ? 'anthropic' : 'openai';
    const modelInstance = createModelInstance(provider, modelToUse);

    logger.info({
      jobId: context.jobId,
      agentType,
      model: modelToUse,
      provider,
      attemptNumber: retryInfo.attemptNumber
    }, '🤖 AI MANAGER: Starting agent interaction');
    
    try {
      // 2. Construct prompts using the centralized PromptManager
      const systemPrompt = getSystemPrompt(agentType);
      const userPrompt = constructUserPrompt(agentType, tcc, retryInfo);

      // 3. Execute the AI call. The `object` is now correctly typed as AgentResult.
      const { object } = await generateObject({
        model: modelInstance,
        schema: outputSchema,
        prompt: userPrompt,
        system: systemPrompt,
        temperature: context.modelConfig.temperature,
        maxTokens: context.modelConfig.maxTokens,
      });

      const responseTime = Date.now() - startTime;
      logger.info({
        jobId: context.jobId,
        agentType,
        model: modelToUse,
        responseTime,
        success: true,
      }, '🤖 AI MANAGER: Agent interaction successful');

      // ✅ FIXED: Return the strongly-typed `object` directly without casting.
      return {
        success: true,
        rawResponse: object,
        metadata: {
          modelUsed: modelToUse,
          responseTime,
          // token usage can be added if the provider returns it
        },
        errors: [],
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({
        jobId: context.jobId,
        agentType,
        model: modelToUse,
        responseTime,
        error: errorMessage,
      }, '🤖 AI MANAGER: Agent interaction failed');

      return {
        success: false,
        rawResponse: null,
        metadata: {
          modelUsed: modelToUse,
          responseTime,
        },
        errors: [errorMessage],
      };
    }
  }
}

/**
 * DEPRECATED - This function should no longer be used.
 * Logic is now centralized in AIInteractionManager.executeAgentInteraction
 * Kept for reference during refactoring, to be deleted later.
 */
export async function executeAgentAI<T>(): Promise<never> {
    throw new Error("executeAgentAI is deprecated and should not be used. All AI interactions must go through the centralized AIInteractionManager.executeAgentInteraction method called by the AgentExecutor.");
} 