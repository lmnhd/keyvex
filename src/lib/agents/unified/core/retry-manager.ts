/**
 * Retry Manager - Intelligent retry logic and strategies (Phase 1.2)
 * Provides sophisticated retry mechanisms for agent failures
 */

import { 
  AgentType, 
  RetryContext, 
  ValidationResultEnhanced, 
  AgentExecutionContext 
} from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

export class RetryManager {
  private readonly retryConfigs = {
    'function-planner': { maxAttempts: 3, baseDelay: 1000, backoffMultiplier: 2 },
    'state-design': { maxAttempts: 3, baseDelay: 1500, backoffMultiplier: 2 },
    'jsx-layout': { maxAttempts: 2, baseDelay: 1000, backoffMultiplier: 2 },
    'tailwind-styling': { maxAttempts: 2, baseDelay: 800, backoffMultiplier: 1.5 },
    'component-assembler': { maxAttempts: 4, baseDelay: 2000, backoffMultiplier: 2.5 },
    'code-validator': { maxAttempts: 3, baseDelay: 1000, backoffMultiplier: 2 },
    'tool-finalizer': { maxAttempts: 2, baseDelay: 1500, backoffMultiplier: 2 }
  } as const;

  private readonly rateLimitPatterns = [
    /rate limit.*?(\d+(\.\d+)?)\s*seconds?/i,
    /retry.*?after.*?(\d+(\.\d+)?)\s*seconds?/i,
    /too many requests.*?try again in (\d+(\.\d+)?)\s*seconds?/i,
    /quota exceeded.*?retry after (\d+(\.\d+)?)\s*seconds?/i
  ];

  constructor() {}

  /**
   * Create retry context for an agent execution
   */
  createRetryContext(
    agentType: AgentType,
    jobId: string,
    error: string,
    attemptNumber: number
  ): RetryContext {
    const config = this.retryConfigs[agentType];
    const retryReason = this.determineRetryReason(error);
    const backoffDelay = this.calculateBackoffDelay(agentType, attemptNumber, retryReason);

    return {
      agentType,
      attemptNumber,
      maxAttempts: config.maxAttempts,
      lastError: error,
      retryReason,
      backoffDelay,
      totalRetryTime: 0 // Will be updated by orchestrator
    };
  }

  /**
   * Determine if agent should be retried based on error and validation
   */
  shouldRetryAgent(
    context: RetryContext,
    validation?: ValidationResultEnhanced
  ): {
    shouldRetry: boolean;
    reason: string;
    delay: number;
    strategy: 'immediate' | 'exponential' | 'linear' | 'rate_limit';
  } {
    // Check max attempts
    if (context.attemptNumber >= context.maxAttempts) {
      return {
        shouldRetry: false,
        reason: `Maximum attempts (${context.maxAttempts}) reached for ${context.agentType}`,
        delay: 0,
        strategy: 'immediate'
      };
    }

    // Handle rate limit errors with special strategy
    if (context.retryReason === 'rate_limit') {
      const rateLimitDelay = this.parseRateLimitDelay(context.lastError);
      return {
        shouldRetry: true,
        reason: 'Rate limit encountered - using provider-specified delay',
        delay: rateLimitDelay,
        strategy: 'rate_limit'
      };
    }

    // Handle validation-based retries
    if (validation && context.retryReason === 'validation_failed') {
      const hasRecoverableErrors = validation.errors.some(error => 
        error.type === 'syntax' || error.type === 'type' || error.suggestion
      );

      if (!hasRecoverableErrors) {
        return {
          shouldRetry: false,
          reason: 'Validation errors are not recoverable',
          delay: 0,
          strategy: 'immediate'
        };
      }

      if (validation.overallScore < 30) {
        return {
          shouldRetry: false,
          reason: 'Quality score too low for retry',
          delay: 0,
          strategy: 'immediate'
        };
      }
    }

    // Handle timeout errors
    if (context.retryReason === 'timeout') {
      return {
        shouldRetry: context.attemptNumber < 2, // Only retry once for timeouts
        reason: context.attemptNumber < 2 ? 'Timeout - attempting retry with longer timeout' : 'Multiple timeouts - not retrying',
        delay: context.backoffDelay,
        strategy: 'linear'
      };
    }

    // Handle model errors
    if (context.retryReason === 'model_error') {
      return {
        shouldRetry: true,
        reason: 'Model error - retrying with exponential backoff',
        delay: context.backoffDelay,
        strategy: 'exponential'
      };
    }

    // Default retry logic
    return {
      shouldRetry: true,
      reason: `Attempting retry ${context.attemptNumber + 1}/${context.maxAttempts}`,
      delay: context.backoffDelay,
      strategy: 'exponential'
    };
  }

  /**
   * Execute retry with proper delay and logging
   */
  async executeRetry<T>(
    retryContext: RetryContext,
    retryFunction: () => Promise<T>,
    onRetryStart?: (context: RetryContext) => void
  ): Promise<T> {
    const startTime = Date.now();

    logger.info({
      agentType: retryContext.agentType,
      attemptNumber: retryContext.attemptNumber,
      maxAttempts: retryContext.maxAttempts,
      retryReason: retryContext.retryReason,
      backoffDelay: retryContext.backoffDelay
    }, '🔄 RetryManager: Starting retry execution');

    // Execute pre-retry callback
    if (onRetryStart) {
      onRetryStart(retryContext);
    }

    // Apply backoff delay
    if (retryContext.backoffDelay > 0) {
      logger.info({
        agentType: retryContext.agentType,
        delay: retryContext.backoffDelay
      }, '⏳ RetryManager: Applying backoff delay');

      await this.delay(retryContext.backoffDelay);
    }

    try {
      const result = await retryFunction();
      const executionTime = Date.now() - startTime;

      logger.info({
        agentType: retryContext.agentType,
        attemptNumber: retryContext.attemptNumber,
        executionTime,
        success: true
      }, '✅ RetryManager: Retry execution successful');

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({
        agentType: retryContext.agentType,
        attemptNumber: retryContext.attemptNumber,
        executionTime,
        error: errorMessage
      }, '❌ RetryManager: Retry execution failed');

      throw error;
    }
  }

  /**
   * Update retry context after attempt
   */
  updateRetryContext(
    context: RetryContext,
    newError?: string,
    additionalTime: number = 0
  ): RetryContext {
    return {
      ...context,
      attemptNumber: context.attemptNumber + 1,
      lastError: newError || context.lastError,
      retryReason: newError ? this.determineRetryReason(newError) : context.retryReason,
      backoffDelay: this.calculateBackoffDelay(
        context.agentType, 
        context.attemptNumber + 1, 
        newError ? this.determineRetryReason(newError) : context.retryReason
      ),
      totalRetryTime: context.totalRetryTime + additionalTime
    };
  }

  /**
   * Get retry statistics for analysis
   */
  getRetryStatistics(retryHistory: RetryContext[]): {
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    averageRetryTime: number;
    retryReasons: Record<string, number>;
    agentRetryRates: Record<AgentType, number>;
  } {
    const totalRetries = retryHistory.length;
    const retryReasons: Record<string, number> = {};
    const agentRetryRates: Record<AgentType, number> = {} as Record<AgentType, number>;

    let totalRetryTime = 0;
    let successfulRetries = 0;

    retryHistory.forEach(context => {
      // Count retry reasons
      retryReasons[context.retryReason] = (retryReasons[context.retryReason] || 0) + 1;
      
      // Count agent retry rates
      agentRetryRates[context.agentType] = (agentRetryRates[context.agentType] || 0) + 1;
      
      // Sum retry times
      totalRetryTime += context.totalRetryTime;
      
      // Count successful retries (those that didn't reach max attempts)
      if (context.attemptNumber < context.maxAttempts) {
        successfulRetries++;
      }
    });

    return {
      totalRetries,
      successfulRetries,
      failedRetries: totalRetries - successfulRetries,
      averageRetryTime: totalRetries > 0 ? totalRetryTime / totalRetries : 0,
      retryReasons,
      agentRetryRates
    };
  }

  /**
   * Optimize retry configuration based on historical data
   */
  optimizeRetryConfig(
    agentType: AgentType,
    retryHistory: RetryContext[]
  ): {
    recommendedMaxAttempts: number;
    recommendedBaseDelay: number;
    recommendedBackoffMultiplier: number;
    confidence: number;
  } {
    const agentRetries = retryHistory.filter(ctx => ctx.agentType === agentType);
    
    if (agentRetries.length < 5) {
      // Not enough data for optimization
      const current = this.retryConfigs[agentType];
      return {
        recommendedMaxAttempts: current.maxAttempts,
        recommendedBaseDelay: current.baseDelay,
        recommendedBackoffMultiplier: current.backoffMultiplier,
        confidence: 0
      };
    }

    const successfulRetries = agentRetries.filter(ctx => ctx.attemptNumber < ctx.maxAttempts);
    const successRate = successfulRetries.length / agentRetries.length;
    
    // Calculate average successful attempt number
    const avgSuccessfulAttempt = successfulRetries.length > 0 
      ? successfulRetries.reduce((sum, ctx) => sum + ctx.attemptNumber, 0) / successfulRetries.length
      : 0;

    // Optimize based on success patterns
    let recommendedMaxAttempts = Math.ceil(avgSuccessfulAttempt * 1.5);
    recommendedMaxAttempts = Math.max(2, Math.min(5, recommendedMaxAttempts));

    // Optimize delay based on success rate
    const current = this.retryConfigs[agentType];
    let recommendedBaseDelay: number = current.baseDelay;
    let recommendedBackoffMultiplier: number = current.backoffMultiplier;

    if (successRate < 0.5) {
      // Low success rate - increase delays
      recommendedBaseDelay = Math.min(current.baseDelay * 1.5, 3000);
      recommendedBackoffMultiplier = Math.min(current.backoffMultiplier * 1.2, 3);
    } else if (successRate > 0.8) {
      // High success rate - can reduce delays
      recommendedBaseDelay = Math.max(current.baseDelay * 0.8, 500);
      recommendedBackoffMultiplier = Math.max(current.backoffMultiplier * 0.9, 1.5);
    }

    const confidence = Math.min(agentRetries.length / 20, 1); // Max confidence at 20 samples

         return {
       recommendedMaxAttempts,
       recommendedBaseDelay: Math.round(recommendedBaseDelay),
       recommendedBackoffMultiplier: Math.round(recommendedBackoffMultiplier * 10) / 10,
       confidence
     };
  }

  /**
   * Determine retry reason based on error message
   */
  private determineRetryReason(error: string): RetryContext['retryReason'] {
    const errorLower = error.toLowerCase();

    if (this.rateLimitPatterns.some(pattern => pattern.test(error))) {
      return 'rate_limit';
    }

    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return 'timeout';
    }

    if (errorLower.includes('validation') || errorLower.includes('invalid')) {
      return 'validation_failed';
    }

    if (errorLower.includes('model') || errorLower.includes('api') || errorLower.includes('server')) {
      return 'model_error';
    }

    return 'model_error'; // Default
  }

  /**
   * Calculate backoff delay based on attempt number and retry reason
   */
  private calculateBackoffDelay(
    agentType: AgentType,
    attemptNumber: number,
    retryReason: RetryContext['retryReason']
  ): number {
    const config = this.retryConfigs[agentType];
    
    switch (retryReason) {
      case 'rate_limit':
        return 0; // Will be overridden by rate limit parser
      
      case 'timeout':
        return config.baseDelay * attemptNumber; // Linear backoff for timeouts
      
      case 'validation_failed':
        return config.baseDelay * 0.5; // Shorter delay for validation issues
      
      case 'model_error':
      default:
        return Math.round(config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1));
    }
  }

  /**
   * Parse rate limit delay from error message
   */
  private parseRateLimitDelay(error: string): number {
    for (const pattern of this.rateLimitPatterns) {
      const match = error.match(pattern);
      if (match && match[1]) {
        const seconds = parseFloat(match[1]);
        return Math.ceil(seconds * 1000) + 500; // Add 500ms buffer
      }
    }
    
    return 5000; // Default 5 second delay if can't parse
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
