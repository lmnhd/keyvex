/**
 * Agent Executor (Phase 1.2 - Core Infrastructure)
 * Unified execution logic for all agents
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
} from '@/lib/types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

// Import unified agent modules
import { FunctionPlannerModule } from '../modules/function-planner';
// TODO: Import other modules when they're implemented
// import { StateDesignModule } from '../modules/state-design';
// import { JSXLayoutModule } from '../modules/jsx-layout';
// import { TailwindStylingModule } from '../modules/tailwind-styling';
// import { ComponentAssemblerModule } from '../modules/component-assembler';
// import { CodeValidatorModule } from '../modules/code-validator';
// import { ToolFinalizerModule } from '../modules/tool-finalizer';

type AgentResult = 
  | FunctionPlannerResult
  | StateDesignResult
  | JsxLayoutResult
  | TailwindStylingResult
  | ComponentAssemblerResult
  | CodeValidatorResult
  | ToolFinalizerResult;

// Initialize agent modules
const agentModules = {
  'function-planner': new FunctionPlannerModule(),
  // TODO: Add other modules when implemented
  // 'state-design': new StateDesignModule(),
  // 'jsx-layout': new JSXLayoutModule(),
  // 'tailwind-styling': new TailwindStylingModule(),
  // 'component-assembler': new ComponentAssemblerModule(),
  // 'code-validator': new CodeValidatorModule(),
  // 'tool-finalizer': new ToolFinalizerModule(),
};

export async function executeAgent(
  agentType: AgentType,
  context: AgentExecutionContext,
  tcc: BaseTCC,
  rawModelResult?: any
): Promise<AgentResult> {
  const startTime = Date.now();
  
  logger.info({
    jobId: context.jobId,
    agentType,
    modelId: context.modelConfig.modelId,
    isIsolatedTest: context.isIsolatedTest
  }, `🚀 Executing unified agent: ${agentType}`);

  try {
    let result: AgentResult;

    // Get the appropriate agent module
    const agentModule = agentModules[agentType as keyof typeof agentModules];
    
    if (!agentModule) {
      throw new Error(`Agent module not implemented yet: ${agentType}`);
    }

    // Execute the agent module
    result = await agentModule.execute(context, { tcc, rawModelResult });

    const duration = Date.now() - startTime;
    
    logger.info({
      jobId: context.jobId,
      agentType,
      duration,
      success: true
    }, `✅ Agent execution completed: ${agentType}`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      jobId: context.jobId,
      agentType,
      duration,
      error: errorMessage
    }, `❌ Agent execution failed: ${agentType}`);

    throw error;
  }
}

export function getAgentTimeout(agentType: AgentType): number {
  const timeouts: Record<AgentType, number> = {
    'function-planner': 30000,    // 30 seconds
    'state-design': 45000,        // 45 seconds
    'jsx-layout': 40000,          // 40 seconds
    'tailwind-styling': 35000,    // 35 seconds
    'component-assembler': 60000, // 60 seconds
    'code-validator': 25000,      // 25 seconds
    'tool-finalizer': 30000       // 30 seconds
  };

  return timeouts[agentType] || 30000;
}

export function validateAgentModule(agentType: AgentType, result: AgentResult): any {
  const agentModule = agentModules[agentType as keyof typeof agentModules];
  
  if (!agentModule) {
    throw new Error(`Agent module not implemented yet: ${agentType}`);
  }

  // Type-safe validation by casting result to the expected type for each agent
  switch (agentType) {
    case 'function-planner':
      return agentModule.validate(result as FunctionPlannerResult);
    // TODO: Add other cases when modules are implemented
    // case 'state-design':
    //   return agentModule.validate(result as StateDesignResult);
    default:
      throw new Error(`Validation not implemented for agent: ${agentType}`);
  }
}
