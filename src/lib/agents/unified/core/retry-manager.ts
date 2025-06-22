/**
 * Intelligent Retry Manager (Phase 2.3)
 * Implements stateful retry strategies with prompt adaptation and model switching
 * NO GENERIC TYPES! - Strongly typed throughout
 */

import { 
  AgentType,
  AgentExecutionContext,
  RetryContext,
  RetryStrategy,
  RetryAttemptInfo,
  AgentRetryCapabilities
} from '../../../types/tcc-unified';
import logger from '../../../logger';

/**
 * Default retry strategies per agent type
 */
const DEFAULT_RETRY_STRATEGIES: Record<AgentType, RetryStrategy> = {
  'function-planner': {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    enablePromptAdaptation: true,
    enableModelSwitching: true,
    fallbackModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'claude-3-haiku-20240307']
  },
  'state-design': {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    enablePromptAdaptation: true,
    enableModelSwitching: true,
    fallbackModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'claude-3-haiku-20240307']
  },
  'jsx-layout': {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    enablePromptAdaptation: true,
    enableModelSwitching: true,
    fallbackModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'claude-3-haiku-20240307']
  },
  'tailwind-styling': {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    enablePromptAdaptation: true,
    enableModelSwitching: true,
    fallbackModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'claude-3-haiku-20240307']
  },
  'component-assembler': {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    enablePromptAdaptation: true,
    enableModelSwitching: true,
    fallbackModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'claude-3-haiku-20240307']
  },
  'code-validator': {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    enablePromptAdaptation: true,
    enableModelSwitching: true,
    fallbackModels: ['claude-3-5-sonnet-20241022', 'gpt-4o', 'claude-3-haiku-20240307']
  },
  'tool-finalizer': {
    maxAttempts: 2,
    backoffStrategy: 'linear',
    enablePromptAdaptation: false,
    enableModelSwitching: true,
    fallbackModels: ['claude-3-5-sonnet-20241022', 'gpt-4o']
  }
};

/**
 * Intelligent Retry Manager with stateful retry strategies
 * Supports prompt adaptation on second attempts and model switching on third attempts
 */
export class RetryManager {
  private retryContexts: Map<string, RetryContext> = new Map();

  /**
   * Execute function with intelligent retry capabilities
   * CRITICAL FIX: Now passes RetryAttemptInfo to execution function!
   */
  async executeWithRetry<T>(
    context: AgentExecutionContext,
    executionFunction: (retryInfo: RetryAttemptInfo) => Promise<T>
  ): Promise<T> {
    const agentType = context.agentType;
    const strategy = this.getRetryStrategy(agentType);
    const contextKey = `${context.jobId}-${agentType}`;
    
    let retryContext = this.retryContexts.get(contextKey);
    if (!retryContext) {
      retryContext = {
        agentType,
        jobId: context.jobId,
        totalAttempts: 0,
        lastError: null,
        adaptationHistory: [],
        startTime: Date.now()
      };
      this.retryContexts.set(contextKey, retryContext);
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      retryContext.totalAttempts = attempt;
      
      const retryInfo: RetryAttemptInfo = {
        attemptNumber: attempt,
        isFirstAttempt: attempt === 1,
        isSecondAttempt: attempt === 2,
        isThirdAttempt: attempt === 3,
        isFinalAttempt: attempt === strategy.maxAttempts,
        lastError: lastError?.message || null,
        strategy: this.determineAttemptStrategy(attempt, strategy),
        adaptedModel: this.determineModelForAttempt(attempt, context.modelConfig.modelId, strategy),
        adaptedPromptHints: this.generatePromptAdaptationHints(attempt, lastError, retryContext)
      };

      logger.info({
        jobId: context.jobId,
        agentType,
        attempt,
        strategy: retryInfo.strategy,
        adaptedModel: retryInfo.adaptedModel
      }, `🔄 RETRY MANAGER: Attempt ${attempt}/${strategy.maxAttempts} for ${agentType}`);

      try {
        const result = await executionFunction(retryInfo);
        this.retryContexts.delete(contextKey);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryContext.lastError = lastError.message;
        retryContext.adaptationHistory.push({
          attempt,
          error: lastError.message,
          strategy: retryInfo.strategy,
          modelUsed: retryInfo.adaptedModel
        });
        
        if (attempt === strategy.maxAttempts) {
          this.retryContexts.delete(contextKey);
          throw lastError;
        }

        const delayMs = this.calculateBackoffDelay(attempt, strategy);
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error('Retry execution failed');
  }

  private getRetryStrategy(agentType: AgentType): RetryStrategy {
    return DEFAULT_RETRY_STRATEGIES[agentType] || DEFAULT_RETRY_STRATEGIES['function-planner'];
  }

  private determineAttemptStrategy(
    attempt: number, 
    strategy: RetryStrategy
  ): 'standard' | 'conservative' | 'aggressive' | 'structured' {
    if (attempt === 1) return 'standard';
    if (attempt === 2) return strategy.enablePromptAdaptation ? 'conservative' : 'standard';
    return 'structured';
  }

  private determineModelForAttempt(
    attempt: number,
    originalModel: string,
    strategy: RetryStrategy
  ): string {
    if (attempt === 1 || !strategy.enableModelSwitching) return originalModel;
    const fallbackIndex = Math.min(attempt - 2, strategy.fallbackModels.length - 1);
    return strategy.fallbackModels[fallbackIndex] || originalModel;
  }

  private generatePromptAdaptationHints(
    attempt: number,
    lastError: Error | null,
    retryContext: RetryContext
  ): string[] {
    const hints: string[] = [];
    if (attempt === 1) return hints;

    if (attempt === 2) {
      hints.push('RETRY ADAPTATION: Second attempt - use conservative approach.');
      if (lastError) {
        hints.push(`PREVIOUS ERROR: ${lastError.message}`);
        if (lastError.message.includes('validation')) {
          hints.push('VALIDATION FOCUS: Pay attention to schema compliance.');
        }
      }
    }

    if (attempt === 3) {
      hints.push('RETRY ADAPTATION: Final attempt - use structured approach.');
      hints.push('SIMPLIFICATION: Focus on core requirements only.');
    }

    return hints;
  }

  private calculateBackoffDelay(attempt: number, strategy: RetryStrategy): number {
    const baseDelay = 1000;
    switch (strategy.backoffStrategy) {
      case 'exponential': return baseDelay * Math.pow(2, attempt - 1);
      case 'linear': return baseDelay * attempt;
      default: return baseDelay;
    }
  }

  getAgentRetryCapabilities(agentType: AgentType): AgentRetryCapabilities {
    const strategy = this.getRetryStrategy(agentType);
    return {
      maxAttempts: strategy.maxAttempts,
      supportsPromptAdaptation: strategy.enablePromptAdaptation,
      supportsModelSwitching: strategy.enableModelSwitching,
      availableFallbackModels: strategy.fallbackModels,
      backoffStrategy: strategy.backoffStrategy
    };
  }
}