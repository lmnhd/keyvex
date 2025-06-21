/**
 * Agent Executor (Phase 1.2 - Core Infrastructure)
 * Unified execution logic for all agents with retry capability
 */

import { 
  AgentExecutionContext, 
  AgentType, 
  ToolConstructionContext,
  FunctionPlannerResult,
  StateDesignResult,
  JsxLayoutResult,
  TailwindStylingResult,
  ComponentAssemblerResult,
  CodeValidatorResult,
  ToolFinalizerResult
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import { updateTccWithAgentResult } from './tcc-manager';
import { RetryManager } from './retry-manager';
import { BaseAgentModule, AgentExecutionInput } from './base-agent-module';
import logger from '../../../logger';

// Import unified agent modules - ALL IMPLEMENTED!
import { FunctionPlannerModule } from '../modules/function-planner';
import { StateDesignModule } from '../modules/state-design';
import { JSXLayoutModule } from '../modules/jsx-layout';
import { ComponentAssemblerModule } from '../modules/component-assembler';
import { TailwindStylingModule } from '../modules/tailwind-styling';
import { CodeValidatorModule } from '../modules/code-validator';
import { ToolFinalizerModule } from '../modules/tool-finalizer';

type AgentResult = 
  | FunctionPlannerResult
  | StateDesignResult
  | JsxLayoutResult
  | TailwindStylingResult
  | ComponentAssemblerResult
  | CodeValidatorResult
  | ToolFinalizerResult;

// Initialize agent modules - ALL COMPLETE!
const agentModules: Record<string, BaseAgentModule> = {
  'function-planner': new FunctionPlannerModule(),
  'state-design': new StateDesignModule(),
  'jsx-layout': new JSXLayoutModule(),
  'tailwind-styling': new TailwindStylingModule(),
  'component-assembler': new ComponentAssemblerModule(),
  'code-validator': new CodeValidatorModule(),
  'tool-finalizer': new ToolFinalizerModule(),
};

// Initialize retry manager
const retryManager = new RetryManager();

/**
 * Execute agent and return both result and updated TCC
 * This is the SINGLE SOURCE OF TRUTH for agent execution
 */
export async function executeAgent(
  agentType: AgentType,
  context: AgentExecutionContext,
  tcc: BaseTCC,
  rawModelResult?: any
): Promise<{ result: AgentResult; updatedTcc: BaseTCC }> {
  const startTime = Date.now();
  
  logger.info({
    jobId: context.jobId,
    agentType,
    modelId: context.modelConfig.modelId,
    isIsolatedTest: context.isIsolatedTest
  }, `🚀 AGENT EXECUTOR: Starting unified agent execution: ${agentType}`);

  try {
    // Get the appropriate agent module
    const agentModule = agentModules[agentType];
    
    if (!agentModule) {
      throw new Error(`Agent module not implemented yet: ${agentType}`);
    }

    // Validate TCC has required data for this agent
    const requiredFields = agentModule.getRequiredInputFields();
    const missingFields = validateTccRequiredFields(tcc, requiredFields);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required TCC fields for ${agentType}: ${missingFields.join(', ')}`);
    }

    // Create agent execution input
    const agentInput: AgentExecutionInput = {
      tcc,
      rawModelResult
    };

    // Execute with retry logic
    const enhancedContext: AgentExecutionContext = {
      ...context,
      agentType
    };
    
    const result = await retryManager.executeWithRetry(
      enhancedContext,
      async () => {
        logger.info({
          jobId: context.jobId,
          agentType
        }, `🎯 AGENT EXECUTOR: Executing ${agentType} module`);

        return await agentModule.execute(enhancedContext, agentInput);
      }
    );
    
    const executionTime = Date.now() - startTime;

    // Update TCC with the result using TCC Manager
    const updatedTcc = updateTccWithAgentResult(
      tcc,
      agentType,
      result,
      context.modelConfig.modelId,
      executionTime
    );
    
    logger.info({
      jobId: context.jobId,
      agentType,
      duration: executionTime,
      success: true,
      resultValidation: agentModule.validate(result).score
    }, `✅ AGENT EXECUTOR: Agent execution completed successfully: ${agentType}`);

    return { result, updatedTcc };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      jobId: context.jobId,
      agentType,
      duration,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, `❌ AGENT EXECUTOR: Agent execution failed: ${agentType}`);

    throw error;
  }
}

/**
 * Validate that TCC has required fields for agent execution
 */
function validateTccRequiredFields(tcc: BaseTCC, requiredFields: string[]): string[] {
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    const fieldPath = field.split('.');
    let current: any = tcc;
    
    for (const pathSegment of fieldPath) {
      if (!current || current[pathSegment] === undefined || current[pathSegment] === null) {
        missingFields.push(field);
        break;
      }
      current = current[pathSegment];
    }
  }
  
  return missingFields;
}

/**
 * Get timeout for specific agent type
 */
export function getAgentTimeout(agentType: AgentType): number {
  const agentModule = agentModules[agentType];
  return agentModule?.getTimeout() || 30000; // Default 30 seconds
}

/**
 * Validate agent result using the agent module's validation
 */
export function validateAgentModule(agentType: AgentType, result: AgentResult): any {
  const agentModule = agentModules[agentType];
  
  if (!agentModule) {
    throw new Error(`Agent module not implemented yet: ${agentType}`);
  }

  return agentModule.validate(result);
}

/**
 * Get agent module information
 */
export function getAgentModuleInfo(agentType: AgentType): {
  type: AgentType;
  timeout: number;
  description: string;
  supportsEditMode: boolean;
  requiredFields: string[];
} | null {
  const agentModule = agentModules[agentType];
  
  if (!agentModule) {
    return null;
  }

  const info = agentModule.getAgentInfo();
  return {
    ...info,
    supportsEditMode: agentModule.supportsEditMode(),
    requiredFields: agentModule.getRequiredInputFields()
  };
}

/**
 * Get retry statistics for monitoring
 */
export function getRetryStatistics() {
  return retryManager.getRetryStatistics();
}

/**
 * Get retry context for specific job and agent
 */
export function getRetryContext(jobId: string, agentType: AgentType) {
  return retryManager.getRetryContext(jobId, agentType);
}

/**
 * Clear retry context (for cleanup)
 */
export function clearRetryContext(jobId: string, agentType: AgentType) {
  retryManager.clearRetryContext(jobId, agentType);
}
