/**
 * Base Agent Module (Phase 1.2 - Refactored for Centralized Execution)
 * Agent modules are now primarily for configuration and validation, not execution.
 * 
 * CRITICAL FIX: Now accepts and uses retry context for adaptive behavior
 * - Modules can access attempt number, previous errors, and strategy hints
 * - Enables sophisticated retry strategies as planned in Phase 2.3
 */

import { 
  AgentType, 
  AgentExecutionContext,
  RetryAttemptInfo,
  ValidationResult,
  ToolConstructionContext
} from '../../../types/tcc-unified';
import { z } from 'zod';
import logger from '../../../logger';

/**
 * Agent execution input - what every agent receives
 */
export interface AgentExecutionInput {
  tcc: ToolConstructionContext;
  retryContext?: RetryAttemptInfo; // CRITICAL: Retry context for adaptive behavior
  rawModelResult?: any; // For agents that need raw model output
  promptConfig?: any; // Prompt configuration from Prompt Manager (Phase 2)
}

export interface RequiredFieldValidation {
  isValid: boolean;
  missingFields: string[];
}

/**
 * Base Agent Module (Phase 1.2 - Refactored for Centralized Execution)
 * Agent modules are now primarily for configuration and validation, not execution.
 */
export abstract class BaseAgentModule {
  protected readonly agentType: AgentType;
  protected readonly timeout: number;

  constructor(agentType: AgentType, timeout: number = 30000) {
    this.agentType = agentType;
    this.timeout = timeout;
  }

  /**
   * Validate the structured data returned by the AI.
   * ✅ UPDATED: Now uses unified ValidationResult interface
   */
  abstract validate(output: any): ValidationResult;

  /**
   * ✅ NEW: Expose the Zod schema for the expected AI output.
   * This is used by the AIInteractionManager to ensure structured responses.
   */
  abstract getOutputSchema(): z.ZodSchema<any>;

  /**
   * Get the list of TCC fields required for this agent to run.
   */
  abstract getRequiredInputFields(): string[];

  /**
   * Get agent metadata
   */
  getAgentInfo(): {
    type: AgentType;
    timeout: number;
    description: string;
  } {
    return {
      type: this.agentType,
      timeout: this.timeout,
      description: this.getAgentDescription()
    };
  }

  /**
   * A description of the agent's purpose.
   */
  protected abstract getAgentDescription(): string;

  /**
   * Standard execution logging (can be used for other purposes now).
   */
  protected log(phase: string, context: { jobId: string }, metadata?: any): void {
    logger.info({
      jobId: context.jobId,
      agentType: this.agentType,
      phase,
      ...metadata
    }, `[${this.agentType}] ${phase}`);
  }

  /**
   * Validate required fields in TCC.
   */
  validateRequired(tcc: ToolConstructionContext, requiredFields: string[]): RequiredFieldValidation {
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!this.hasNestedProperty(tcc, field)) {
        missingFields.push(field);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Get timeout for this agent
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Check if agent can handle edit mode
   */
  supportsEditMode(): boolean {
    return false; // Override in agents that support edit mode
  }

  /**
   * ✅ NEW: Check if agent is being retried and adapt behavior
   * This is called by agent modules to adjust their strategy
   */
  protected isRetryAttempt(input: AgentExecutionInput): boolean {
    return !!(input.retryContext && input.retryContext.attemptNumber > 1);
  }

  /**
   * ✅ NEW: Get retry strategy hints for adaptive behavior
   */
  protected getRetryHints(input: AgentExecutionInput): string[] {
    return input.retryContext?.adaptedPromptHints || [];
  }

  /**
   * ✅ NEW: Get current retry attempt number
   */
  protected getAttemptNumber(input: AgentExecutionInput): number {
    return input.retryContext?.attemptNumber || 1;
  }

  /**
   * ✅ NEW: Get last error message for context
   */
  protected getLastError(input: AgentExecutionInput): string | null {
    return input.retryContext?.lastError || null;
  }

  /**
   * ✅ NEW: Get current retry strategy
   */
  protected getRetryStrategy(input: AgentExecutionInput): string {
    return input.retryContext?.strategy || 'standard';
  }

  /**
   * ✅ NEW: Check if this is a specific attempt number
   */
  protected isFirstAttempt(input: AgentExecutionInput): boolean {
    return input.retryContext?.isFirstAttempt ?? true;
  }

  protected isSecondAttempt(input: AgentExecutionInput): boolean {
    return input.retryContext?.isSecondAttempt ?? false;
  }

  protected isThirdAttempt(input: AgentExecutionInput): boolean {
    return input.retryContext?.isThirdAttempt ?? false;
  }

  protected isFinalAttempt(input: AgentExecutionInput): boolean {
    return input.retryContext?.isFinalAttempt ?? false;
  }

  /**
   * ✅ NEW: Log retry-aware execution info
   */
  protected logRetryAwareExecution(context: AgentExecutionContext, input: AgentExecutionInput, phase: string, metadata?: any): void {
    const retryInfo = input.retryContext;
    
    logger.info({
      jobId: context.jobId,
      agentType: this.agentType,
      phase,
      attemptNumber: retryInfo?.attemptNumber || 1,
      isRetry: this.isRetryAttempt(input),
      retryStrategy: retryInfo?.strategy || 'standard',
      hasLastError: !!(retryInfo?.lastError),
      promptHints: retryInfo?.adaptedPromptHints?.length || 0,
      adaptedModel: retryInfo?.adaptedModel,
      ...metadata
    }, `🔄 ${this.agentType.toUpperCase()}: ${phase} (attempt ${retryInfo?.attemptNumber || 1}${retryInfo?.strategy ? `, strategy: ${retryInfo.strategy}` : ''})`);
  }

  /**
   * Check if nested property exists
   */
  private hasNestedProperty(obj: any, path: string): boolean {
    return path.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined && current[prop] !== null;
    }, obj) !== undefined;
  }
} 