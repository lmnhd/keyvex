/**
 * Retry Manager (Phase 1.2 - Core Infrastructure)
 * Handles agent execution retries with exponential backoff
 * NO GENERIC TYPES - Only strongly typed interfaces
 */

import { AgentType, AgentExecutionContext } from '../../../types/tcc-unified';
import logger from '../../../logger';

/**
 * Retry configuration for agents
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  backoffMultiplier: number;
  maxDelay: number; // maximum delay cap
}

/**
 * Retry attempt metadata
 */
export interface RetryAttempt {
  attemptNumber: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  success: boolean;
  error?: string;
  delayBeforeRetry?: number;
}

/**
 * Retry context for tracking retry state
 */
export interface RetryContext {
  agentType: AgentType;
  jobId: string;
  attempts: RetryAttempt[];
  totalRetryTime: number;
  isComplete: boolean;
  finalSuccess: boolean;
}

/**
 * Default retry configurations by agent type
 */
const DEFAULT_RETRY_CONFIGS: Record<AgentType, RetryConfig> = {
  'function-planner': {
    maxAttempts: 3,
    baseDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000
  },
  'state-design': {
    maxAttempts: 3,
    baseDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 15000
  },
  'jsx-layout': {
    maxAttempts: 3,
    baseDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 12000
  },
  'tailwind-styling': {
    maxAttempts: 3,
    baseDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 8000
  },
  'component-assembler': {
    maxAttempts: 4, // More attempts for assembler due to complexity
    baseDelay: 2000,
    backoffMultiplier: 1.5,
    maxDelay: 20000
  },
  'code-validator': {
    maxAttempts: 2,
    baseDelay: 500,
    backoffMultiplier: 2,
    maxDelay: 5000
  },
  'tool-finalizer': {
    maxAttempts: 2,
    baseDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 8000
  }
};

/**
 * Retry Manager class
 */
export class RetryManager {
  private retryContexts: Map<string, RetryContext> = new Map();

  /**
   * Execute function with retry logic and validation support
   * CRITICAL FIX: Now supports validation-aware retries
   */
  async executeWithRetry<T>(
    context: AgentExecutionContext,
    executeFn: () => Promise<{ result: T; validation: any }>,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<{ result: T; validationResult: any }> {
    const retryConfig = this.getRetryConfig(context.agentType, customRetryConfig);
    const retryContext = this.initializeRetryContext(context);

    logger.info({
      jobId: context.jobId,
      agentType: context.agentType,
      maxAttempts: retryConfig.maxAttempts
    }, '🔄 RETRY MANAGER: Starting execution with retry capability');

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      const attemptStartTime = new Date().toISOString();
      const attemptStart = Date.now();

      try {
        logger.info({
          jobId: context.jobId,
          agentType: context.agentType,
          attempt,
          maxAttempts: retryConfig.maxAttempts
        }, `🎯 RETRY MANAGER: Attempt ${attempt}/${retryConfig.maxAttempts}`);

        const executionResult = await executeFn();

        // CRITICAL FIX: Check validation result to determine if retry is needed
        if (!executionResult.validation.isValid && executionResult.validation.canRetry) {
          // Validation failed but can retry - treat as retriable error
          throw new Error(`Validation failed: ${executionResult.validation.errors.join(', ')}`);
        }

        // Success (either validation passed or validation failed but cannot retry)
        const attemptEnd = Date.now();
        const duration = attemptEnd - attemptStart;

        this.recordAttempt(retryContext, {
          attemptNumber: attempt,
          startTime: attemptStartTime,
          endTime: new Date().toISOString(),
          duration,
          success: true
        });

        this.completeRetryContext(retryContext, true);

        logger.info({
          jobId: context.jobId,
          agentType: context.agentType,
          attempt,
          duration,
          totalRetryTime: retryContext.totalRetryTime,
          validationPassed: executionResult.validation.isValid,
          qualityScore: executionResult.validation.qualityScore
        }, '✅ RETRY MANAGER: Execution completed with validation');

        return {
          result: executionResult.result,
          validationResult: executionResult.validation
        };
      } catch (error) {
        const attemptEnd = Date.now();
        const duration = attemptEnd - attemptStart;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Record failed attempt
        this.recordAttempt(retryContext, {
          attemptNumber: attempt,
          startTime: attemptStartTime,
          endTime: new Date().toISOString(),
          duration,
          success: false,
          error: errorMessage
        });

        logger.warn({
          jobId: context.jobId,
          agentType: context.agentType,
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          error: errorMessage,
          duration
        }, `⚠️ RETRY MANAGER: Attempt ${attempt} failed`);

        // If this was the last attempt, fail completely
        if (attempt === retryConfig.maxAttempts) {
          this.completeRetryContext(retryContext, false);
          
          logger.error({
            jobId: context.jobId,
            agentType: context.agentType,
            totalAttempts: attempt,
            totalRetryTime: retryContext.totalRetryTime,
            finalError: errorMessage
          }, '❌ RETRY MANAGER: All retry attempts exhausted');

          throw new Error(`Agent ${context.agentType} failed after ${attempt} attempts. Final error: ${errorMessage}`);
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, retryConfig);
        retryContext.attempts[retryContext.attempts.length - 1].delayBeforeRetry = delay;

        logger.info({
          jobId: context.jobId,
          agentType: context.agentType,
          nextAttempt: attempt + 1,
          delayMs: delay
        }, `⏳ RETRY MANAGER: Waiting ${delay}ms before retry`);

        // Wait before retry
        await this.delay(delay);
        retryContext.totalRetryTime += delay;
      }
    }

    // This should never be reached due to the throw above, but TypeScript requires it
    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Get retry configuration for agent type
   */
  private getRetryConfig(agentType: AgentType, customConfig?: Partial<RetryConfig>): RetryConfig {
    const defaultConfig = DEFAULT_RETRY_CONFIGS[agentType];
    return {
      ...defaultConfig,
      ...customConfig
    };
  }

  /**
   * Initialize retry context for tracking
   */
  private initializeRetryContext(context: AgentExecutionContext): RetryContext {
    const retryContext: RetryContext = {
      agentType: context.agentType,
      jobId: context.jobId,
      attempts: [],
      totalRetryTime: 0,
      isComplete: false,
      finalSuccess: false
    };

    this.retryContexts.set(`${context.jobId}-${context.agentType}`, retryContext);
    return retryContext;
  }

  /**
   * Record an attempt in the retry context
   */
  private recordAttempt(retryContext: RetryContext, attempt: RetryAttempt): void {
    retryContext.attempts.push(attempt);
  }

  /**
   * Complete retry context
   */
  private completeRetryContext(retryContext: RetryContext, success: boolean): void {
    retryContext.isComplete = true;
    retryContext.finalSuccess = success;
  }

  /**
   * Calculate delay for next retry attempt
   */
  private calculateDelay(attemptNumber: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1);
    return Math.min(exponentialDelay, config.maxDelay);
  }

  /**
   * Delay utility function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry context for a job and agent
   */
  getRetryContext(jobId: string, agentType: AgentType): RetryContext | undefined {
    return this.retryContexts.get(`${jobId}-${agentType}`);
  }

  /**
   * Clear retry context (for cleanup)
   */
  clearRetryContext(jobId: string, agentType: AgentType): void {
    this.retryContexts.delete(`${jobId}-${agentType}`);
  }

  /**
   * Get retry statistics for all contexts
   */
  getRetryStatistics(): {
    totalContexts: number;
    completedContexts: number;
    successfulContexts: number;
    averageAttempts: number;
  } {
    const contexts = Array.from(this.retryContexts.values());
    const completedContexts = contexts.filter(c => c.isComplete);
    const successfulContexts = contexts.filter(c => c.finalSuccess);
    const totalAttempts = contexts.reduce((sum, c) => sum + c.attempts.length, 0);

    return {
      totalContexts: contexts.length,
      completedContexts: completedContexts.length,
      successfulContexts: successfulContexts.length,
      averageAttempts: contexts.length > 0 ? totalAttempts / contexts.length : 0
    };
  }
}
