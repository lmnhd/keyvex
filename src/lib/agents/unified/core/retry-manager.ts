/**
 * Enhanced Retry Manager (Phase 2.3) 
 * Implements sophisticated, state-aware retry strategy with progressive adaptation
 * 
 * CRITICAL FIX: Now provides full retry context to agent modules for adaptive behavior
 * - First retry: Send validation errors for self-correction
 * - Second retry: Adapt prompts based on error patterns
 * - Third retry: Switch to fallback model
 */

import { 
  AgentExecutionContext, 
  RetryContext, 
  RetryAttemptInfo,
  RetryStrategy,
  AgentRetryCapabilities,
  AgentType
} from '../../../types/tcc-unified';
import { ParsedResponse } from './response-parser';
import logger from '../../../logger';

/**
 * Enhanced retry execution function type that receives retry context
 */
type RetryExecutionFunction<T> = (retryInfo: RetryAttemptInfo) => Promise<T>;

/**
 * Retry result with enhanced metadata
 */
interface RetryResult<T> {
  result: T;
  totalAttempts: number;
  finalAttemptNumber: number;
  retryHistory: Array<{
    attempt: number;
    error: string;
    strategy: string;
    modelUsed: string;
    validationScore?: number;
  }>;
  finalStrategy: string;
  finalModelUsed: string;
}

/**
 * Enhanced Retry Manager with stateful strategy adaptation
 */
export class RetryManager {
  private retryContexts = new Map<string, RetryContext>();
  private defaultStrategy: RetryStrategy = {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    enablePromptAdaptation: true,
    enableModelSwitching: true,
    fallbackModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'claude-3-5-haiku-20241022']
  };

  /**
   * Execute function with sophisticated retry strategy
   * CRITICAL: Passes retry context to execution function for adaptive behavior
   */
  async executeWithRetry<T>(
    context: AgentExecutionContext,
    executionFunction: RetryExecutionFunction<T>,
    customStrategy?: Partial<RetryStrategy>
  ): Promise<RetryResult<T>> {
    const strategy = { ...this.defaultStrategy, ...customStrategy };
    const retryKey = `${context.jobId}-${context.agentType}`;
    
    // Initialize or get existing retry context
    let retryContext = this.retryContexts.get(retryKey) || {
      agentType: context.agentType,
      jobId: context.jobId,
      totalAttempts: 0,
      lastError: null,
      adaptationHistory: [],
      startTime: Date.now()
    };

    const retryHistory: Array<{
      attempt: number;
      error: string;
      strategy: string;
      modelUsed: string;
      validationScore?: number;
    }> = [];

    let lastError: Error | null = null;
    let currentModelId = context.modelConfig.modelId;

    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      try {
        // Create comprehensive retry attempt info
        const retryInfo: RetryAttemptInfo = {
          attemptNumber: attempt,
          isFirstAttempt: attempt === 1,
          isSecondAttempt: attempt === 2,
          isThirdAttempt: attempt === 3,
          isFinalAttempt: attempt === strategy.maxAttempts,
          lastError: lastError?.message || retryContext.lastError,
          strategy: this.determineRetryStrategy(attempt, lastError) as 'standard' | 'conservative' | 'aggressive' | 'validation-focused',
          adaptedModel: currentModelId,
          adaptedPromptHints: this.generatePromptAdaptations(attempt, lastError, context.agentType)
        };

        // Update retry context
        retryContext.totalAttempts = attempt;
        this.retryContexts.set(retryKey, retryContext);

        logger.info({
          jobId: context.jobId,
          agentType: context.agentType,
          attempt,
          strategy: retryInfo.strategy,
          modelUsed: currentModelId,
          hasLastError: !!retryInfo.lastError,
          promptHints: retryInfo.adaptedPromptHints.length
        }, `?? RETRY MANAGER: Executing attempt ${attempt}/${strategy.maxAttempts} with strategy: ${retryInfo.strategy}`);

        // CRITICAL: Pass retry context to execution function
        // This allows agent modules to adapt their behavior
        const result = await executionFunction(retryInfo);

        // Success - clean up and return
        this.retryContexts.delete(retryKey);
        
        logger.info({
          jobId: context.jobId,
          agentType: context.agentType,
          totalAttempts: attempt,
          finalStrategy: retryInfo.strategy,
          finalModel: currentModelId
        }, `? RETRY MANAGER: Success on attempt ${attempt} with strategy: ${retryInfo.strategy}`);

        return {
          result,
          totalAttempts: attempt,
          finalAttemptNumber: attempt,
          retryHistory,
          finalStrategy: retryInfo.strategy,
          finalModelUsed: currentModelId
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Extract validation score if this is a quality validation error
        let validationScore: number | undefined;
        if (lastError.name === 'QualityValidationError') {
          validationScore = (lastError as any).validationScore;
        }

        // Record retry attempt
        retryHistory.push({
          attempt,
          error: lastError.message,
          strategy: this.determineRetryStrategy(attempt, lastError),
          modelUsed: currentModelId,
          validationScore
        });

        // Update retry context with error info
        retryContext.lastError = lastError.message;
        retryContext.adaptationHistory.push({
          attempt,
          error: lastError.message,
          strategy: this.determineRetryStrategy(attempt, lastError),
          modelUsed: currentModelId
        });

        logger.warn({
          jobId: context.jobId,
          agentType: context.agentType,
          attempt,
          maxAttempts: strategy.maxAttempts,
          error: lastError.message,
          validationScore,
          willRetry: attempt < strategy.maxAttempts
        }, `?? RETRY MANAGER: Attempt ${attempt} failed - ${lastError.message}`);

        // If this isn't the final attempt, adapt strategy for next attempt
        if (attempt < strategy.maxAttempts) {
          currentModelId = this.adaptModelForNextAttempt(
            attempt + 1, 
            lastError, 
            context.modelConfig.modelId, 
            strategy.fallbackModels
          );

          // Apply backoff delay
          const delay = this.calculateBackoffDelay(attempt, strategy.backoffStrategy);
          if (delay > 0) {
            logger.info({
              jobId: context.jobId,
              delayMs: delay
            }, `? RETRY MANAGER: Waiting ${delay}ms before next attempt`);
            await this.sleep(delay);
          }
        }
      }
    }

    // All attempts failed - clean up and throw
    this.retryContexts.delete(retryKey);
    
    logger.error({
      jobId: context.jobId,
      agentType: context.agentType,
      totalAttempts: strategy.maxAttempts,
      finalError: lastError?.message
    }, `? RETRY MANAGER: All ${strategy.maxAttempts} attempts failed`);

    throw new Error(`All ${strategy.maxAttempts} retry attempts failed. Final error: ${lastError?.message}`);
  }

  /**
   * Determine retry strategy based on attempt number and error type
   */
  private determineRetryStrategy(attempt: number, lastError: Error | null): string {
    if (attempt === 1) {
      return 'standard'; // First attempt uses standard execution
    } else if (attempt === 2) {
      if (lastError?.name === 'QualityValidationError') {
        return 'validation-focused'; // Second attempt focuses on validation errors
      } else {
        return 'conservative'; // Second attempt uses conservative approach
      }
    } else {
      return 'aggressive'; // Third+ attempts use aggressive recovery
    }
  }

  /**
   * Generate prompt adaptations based on attempt and error history
   * CRITICAL: These hints are passed to agent modules for strategy adaptation
   */
  private generatePromptAdaptations(attempt: number, lastError: Error | null, agentType: AgentType): string[] {
    const hints: string[] = [];

    if (attempt === 1) {
      // First attempt - no adaptations needed
      return hints;
    }

    if (attempt === 2 && lastError) {
      // Second attempt - add validation-focused hints
      hints.push('RETRY_FOCUS: Address validation errors from previous attempt');
      hints.push('QUALITY_EMPHASIS: Prioritize schema compliance and data quality');
      
      if (lastError.name === 'QualityValidationError') {
        hints.push('VALIDATION_ERROR: Previous attempt failed validation - review output structure carefully');
        
        // Extract specific validation issues if available
        const validationErrors = (lastError as any).validationErrors || [];
        if (validationErrors.length > 0) {
          hints.push(`SPECIFIC_ISSUES: ${validationErrors.slice(0, 3).join(', ')}`);
        }
      }

      // Agent-specific adaptations for second attempt
      switch (agentType) {
        case 'state-design':
          hints.push('STATE_FOCUS: Ensure all state variables have proper types and initial values');
          break;
        case 'jsx-layout':
          hints.push('STRUCTURE_FOCUS: Verify component hierarchy and prop passing');
          break;
        case 'tailwind-styling':
          hints.push('STYLING_FOCUS: Ensure all CSS classes are valid and properly applied');
          break;
        case 'component-assembler':
          hints.push('ASSEMBLY_FOCUS: Verify all imports and exports are correctly structured');
          break;
      }
    }

    if (attempt === 3) {
      // Third attempt - aggressive recovery hints
      hints.push('AGGRESSIVE_RECOVERY: Use simplified approach if complex solution failed');
      hints.push('FALLBACK_STRATEGY: Prefer working basic implementation over perfect complex one');
      hints.push('MODEL_SWITCH: Different model - approach problem from different angle');
      
      // Add specific recovery strategies based on agent type
      switch (agentType) {
        case 'state-design':
          hints.push('SIMPLIFIED_STATE: Use minimal required state variables only');
          break;
        case 'jsx-layout':
          hints.push('BASIC_LAYOUT: Use simple, tested component patterns');
          break;
        case 'tailwind-styling':
          hints.push('MINIMAL_STYLING: Apply essential styles only, avoid complex combinations');
          break;
        case 'component-assembler':
          hints.push('CONSERVATIVE_ASSEMBLY: Use tried-and-true assembly patterns');
          break;
      }
    }

    return hints;
  }

  /**
   * Adapt model selection for next attempt
   */
  private adaptModelForNextAttempt(
    nextAttempt: number, 
    lastError: Error | null, 
    originalModel: string, 
    fallbackModels: string[]
  ): string {
    if (nextAttempt <= 2) {
      // Keep same model for first retry to see if prompt adaptation helps
      return originalModel;
    }

    // Third attempt and beyond - switch to fallback model
    const fallbackIndex = (nextAttempt - 3) % fallbackModels.length;
    const fallbackModel = fallbackModels[fallbackIndex] || originalModel;
    
    logger.info({
      nextAttempt,
      originalModel,
      fallbackModel,
      reason: 'model_switching_strategy'
    }, `?? RETRY MANAGER: Switching from ${originalModel} to ${fallbackModel} for attempt ${nextAttempt}`);

    return fallbackModel;
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoffDelay(attempt: number, strategy: 'exponential' | 'linear' | 'fixed'): number {
    const baseDelay = 1000; // 1 second base

    switch (strategy) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      case 'linear':
        return baseDelay * attempt;
      case 'fixed':
        return baseDelay;
      default:
        return baseDelay;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry capabilities for an agent type
   */
  getAgentRetryCapabilities(agentType: AgentType): AgentRetryCapabilities {
    return {
      maxAttempts: this.defaultStrategy.maxAttempts,
      supportsPromptAdaptation: this.defaultStrategy.enablePromptAdaptation,
      supportsModelSwitching: this.defaultStrategy.enableModelSwitching,
      availableFallbackModels: this.defaultStrategy.fallbackModels,
      backoffStrategy: this.defaultStrategy.backoffStrategy
    };
  }

  /**
   * Get current retry context for debugging
   */
  getRetryContext(jobId: string, agentType: AgentType): RetryContext | null {
    return this.retryContexts.get(`${jobId}-${agentType}`) || null;
  }

  /**
   * Clear retry context (for testing)
   */
  clearRetryContext(jobId: string, agentType: AgentType): void {
    this.retryContexts.delete(`${jobId}-${agentType}`);
  }
}
