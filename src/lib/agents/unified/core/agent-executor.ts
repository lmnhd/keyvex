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
import { executeFunctionPlanner } from '../modules/function-planner';
import { executeStateDesign } from '../modules/state-design';
import { executeJSXLayout } from '../modules/jsx-layout';
import { executeTailwindStyling } from '../modules/tailwind-styling';
import { executeComponentAssembler } from '../modules/component-assembler';
import { executeValidator } from '../modules/code-validator';
import { executeToolFinalizer } from '../modules/tool-finalizer';

type AgentResult = 
  | FunctionPlannerResult
  | StateDesignResult
  | JsxLayoutResult
  | TailwindStylingResult
  | ComponentAssemblerResult
  | CodeValidatorResult
  | ToolFinalizerResult;

export async function executeAgent(
  agentType: AgentType,
  context: AgentExecutionContext,
  tcc: BaseTCC
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

    switch (agentType) {
      case 'function-planner':
        result = await executeFunctionPlanner(context, tcc);
        break;
      case 'state-design':
        result = await executeStateDesign(context, tcc);
        break;
      case 'jsx-layout':
        result = await executeJSXLayout(context, tcc);
        break;
      case 'tailwind-styling':
        result = await executeTailwindStyling(context, tcc);
        break;
      case 'component-assembler':
        result = await executeComponentAssembler(context, tcc);
        break;
      case 'code-validator':
        result = await executeValidator(context, tcc);
        break;
      case 'tool-finalizer':
        result = await executeToolFinalizer(context, tcc);
        break;
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }

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
