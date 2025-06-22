/**
 * Unified Agent Executor (Phase 1.2 - Enhanced with Retry & Base Module Pattern)
 * Single source of truth for all unified agent execution
 * Returns both result AND updated TCC to resolve ambiguity
 */

import { 
  AgentType, 
  AgentResult, 
  AgentExecutionContext 
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
    const validation = agentModule.validateRequired(tcc, requiredFields);
    
    if (!validation.isValid) {
      throw new Error(`Missing required TCC fields for ${agentType}: ${validation.missingFields.join(', ')}`);
    }

    // Execute agent with retry capability
    const result = await retryManager.executeWithRetry(
      context,
      async () => {
        const input: AgentExecutionInput = {
          tcc,
          rawModelResult
        };

        logger.info({
          jobId: context.jobId,
          agentType,
          timeout: agentModule.getTimeout()
        }, `🔄 AGENT EXECUTOR: Executing ${agentType} with timeout ${agentModule.getTimeout()}ms`);

        return await agentModule.execute(context, input);
      }
    );

    // Update TCC with agent result using TCC Manager
    const updatedTcc = updateTccWithAgentResult(
      tcc, 
      agentType, 
      result,
      context.modelConfig.modelId,
      Date.now() - startTime
    );

    const duration = Date.now() - startTime;
    
    logger.info({
      jobId: context.jobId,
      agentType,
      duration,
      success: true
    }, `✅ AGENT EXECUTOR: ${agentType} completed successfully in ${duration}ms`);

    return {
      result,
      updatedTcc
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      jobId: context.jobId,
      agentType,
      duration,
      error: errorMessage
    }, `❌ AGENT EXECUTOR: ${agentType} failed after ${duration}ms`);

    throw error;
  }
}

/**
 * Get list of all available agent types
 */
export function getAvailableAgentTypes(): AgentType[] {
  return Object.keys(agentModules) as AgentType[];
}

/**
 * Check if an agent type is available
 */
export function isAgentAvailable(agentType: AgentType): boolean {
  return agentType in agentModules;
}

/**
 * Get agent module for testing/inspection
 */
export function getAgentModule(agentType: AgentType): BaseAgentModule | null {
  return agentModules[agentType] || null;
}
