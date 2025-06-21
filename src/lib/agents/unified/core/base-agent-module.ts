/**
 * Base Agent Module (Phase 1.2 - Core Infrastructure)
 * Abstract base class for all unified agent modules
 * NO GENERIC TYPES - Only strongly typed interfaces
 */

import { 
  AgentExecutionContext,
  ValidationResultEnhanced,
  AgentType
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import logger from '../../../logger';

/**
 * Agent execution input - what every agent receives
 */
export interface AgentExecutionInput {
  tcc: BaseTCC;
  rawModelResult?: any; // For agents that need raw model output
}

/**
 * Base validation result for all agents
 */
export interface BaseValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100 quality score
}

/**
 * Abstract base class for all agent modules
 * Each agent type will extend this with their specific input/output types
 */
export abstract class BaseAgentModule {
  protected readonly agentType: AgentType;
  protected readonly timeout: number;

  constructor(agentType: AgentType, timeout: number = 30000) {
    this.agentType = agentType;
    this.timeout = timeout;
  }

  /**
   * Execute the agent - must be implemented by each agent
   */
  abstract execute(
    context: AgentExecutionContext, 
    input: AgentExecutionInput
  ): Promise<any>;

  /**
   * Validate the agent's output - must be implemented by each agent
   */
  abstract validate(output: any): BaseValidationResult;

  /**
   * Get required input fields for this agent
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
   * Get agent description - should be overridden by each agent
   */
  protected getAgentDescription(): string {
    return `${this.agentType} agent module`;
  }

  /**
   * Common logging helper for all agents
   */
  protected logExecution(
    context: AgentExecutionContext,
    phase: 'start' | 'success' | 'error',
    metadata?: Record<string, any>
  ): void {
    const logData = {
      jobId: context.jobId,
      agentType: this.agentType,
      modelId: context.modelConfig.modelId,
      isIsolatedTest: context.isIsolatedTest,
      ...metadata
    };

    switch (phase) {
      case 'start':
        logger.info(logData, `🚀 ${this.agentType}: Starting execution`);
        break;
      case 'success':
        logger.info(logData, `✅ ${this.agentType}: Execution completed successfully`);
        break;
      case 'error':
        logger.error(logData, `❌ ${this.agentType}: Execution failed`);
        break;
    }
  }

  /**
   * Common validation helper
   */
  protected validateRequired(
    data: any,
    requiredFields: string[]
  ): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!data || data[field] === undefined || data[field] === null) {
        missingFields.push(field);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Common error handling
   */
  protected handleExecutionError(
    context: AgentExecutionContext,
    error: unknown,
    phase: string
  ): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    this.logExecution(context, 'error', {
      phase,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    throw new Error(`${this.agentType} failed during ${phase}: ${errorMessage}`);
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
} 