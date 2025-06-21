/**
 * UNIFIED ORCHESTRATOR - Sequential Agent Execution through Unified Executor
 * 
 * This orchestrator calls ALL agents through the single unified-agent-executor route.
 * This gives you ONE place to monitor and debug the entire tool creation pipeline.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AgentType } from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

const OrchestrationRequestSchema = z.object({
  jobId: z.string().uuid(),
  tcc: z.any(), // TCC data
  selectedModel: z.string().optional(),
  isIsolatedTest: z.boolean().default(false),
  startFromAgent: z.enum([
    'function-planner',
    'state-design', 
    'jsx-layout',
    'tailwind-styling',
    'component-assembler',
    'code-validator',
    'tool-finalizer'
  ]).optional(),
  stopAfterAgent: z.enum([
    'function-planner',
    'state-design', 
    'jsx-layout',
    'tailwind-styling',
    'component-assembler',
    'code-validator',
    'tool-finalizer'
  ]).optional()
});

// Define the agent execution order
const AGENT_EXECUTION_ORDER: AgentType[] = [
  'function-planner',
  'state-design',
  'jsx-layout',
  'tailwind-styling',
  'component-assembler',
  'code-validator',
  'tool-finalizer'
];

/**
 * 🎯 UNIFIED ORCHESTRATOR ENDPOINT
 * 
 * Executes the complete tool creation pipeline using the unified executor.
 * Every agent call goes through the single unified-agent-executor route.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const validatedRequest = OrchestrationRequestSchema.parse(body);
    
    const { jobId, tcc: initialTcc, selectedModel, isIsolatedTest, startFromAgent, stopAfterAgent } = validatedRequest;
    
    logger.info({
      jobId,
      startFromAgent: startFromAgent || 'function-planner',
      stopAfterAgent: stopAfterAgent || 'tool-finalizer',
      isIsolatedTest
    }, '🚀 UNIFIED ORCHESTRATOR: Starting orchestration');

    // Determine which agents to execute
    const startIndex = startFromAgent ? AGENT_EXECUTION_ORDER.indexOf(startFromAgent) : 0;
    const stopIndex = stopAfterAgent ? AGENT_EXECUTION_ORDER.indexOf(stopAfterAgent) : AGENT_EXECUTION_ORDER.length - 1;
    const agentsToExecute = AGENT_EXECUTION_ORDER.slice(startIndex, stopIndex + 1);

    logger.info({
      jobId,
      agentsToExecute,
      totalAgents: agentsToExecute.length
    }, '🚀 UNIFIED ORCHESTRATOR: Agent execution plan');

    let currentTcc = initialTcc;
    const executionResults: Array<{
      agentType: AgentType;
      success: boolean;
      duration: number;
      error?: string;
      result?: any;
    }> = [];

    // Execute each agent sequentially through the unified executor
    for (let i = 0; i < agentsToExecute.length; i++) {
      const agentType = agentsToExecute[i];
      const agentStartTime = Date.now();
      
      logger.info({
        jobId,
        agentType,
        stepNumber: i + 1,
        totalSteps: agentsToExecute.length
      }, `🤖 UNIFIED ORCHESTRATOR: Executing agent ${i + 1}/${agentsToExecute.length}`);

      try {
        // Call the unified executor for this agent
        const executorResponse = await callUnifiedExecutor({
          jobId,
          agentType,
          tcc: currentTcc,
          selectedModel,
          isIsolatedTest,
          retryAttempt: 0,
          maxRetries: 3
        });

        const agentDuration = Date.now() - agentStartTime;

        if (executorResponse.success) {
          // Update TCC with the result
          currentTcc = executorResponse.updatedTcc || currentTcc;
          
          executionResults.push({
            agentType,
            success: true,
            duration: agentDuration,
            result: executorResponse.result
          });

          logger.info({
            jobId,
            agentType,
            duration: agentDuration,
            stepNumber: i + 1
          }, `✅ UNIFIED ORCHESTRATOR: Agent ${agentType} completed successfully`);
        } else {
          // Agent failed
          executionResults.push({
            agentType,
            success: false,
            duration: agentDuration,
            error: executorResponse.error
          });

          logger.error({
            jobId,
            agentType,
            error: executorResponse.error,
            duration: agentDuration
          }, `❌ UNIFIED ORCHESTRATOR: Agent ${agentType} failed`);

          // Stop orchestration on failure
          break;
        }
      } catch (error) {
        const agentDuration = Date.now() - agentStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        executionResults.push({
          agentType,
          success: false,
          duration: agentDuration,
          error: errorMessage
        });

        logger.error({
          jobId,
          agentType,
          error: errorMessage,
          duration: agentDuration
        }, `❌ UNIFIED ORCHESTRATOR: Agent ${agentType} execution failed`);

        // Stop orchestration on failure
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    const successfulAgents = executionResults.filter(r => r.success).length;
    const overallSuccess = executionResults.length > 0 && executionResults.every(r => r.success);

    logger.info({
      jobId,
      totalDuration,
      successfulAgents,
      totalAgents: executionResults.length,
      overallSuccess
    }, '🏁 UNIFIED ORCHESTRATOR: Orchestration completed');

    return Response.json({
      success: overallSuccess,
      jobId,
      finalTcc: currentTcc,
      executionResults,
      summary: {
        totalDuration,
        agentsExecuted: executionResults.length,
        successfulAgents,
        overallSuccess,
        executedAgents: executionResults.map(r => r.agentType)
      },
      debugInfo: {
        unifiedExecutorUsed: true,
        executorEndpoint: '/api/ai/product-tool-creation-v2/orchestrate/unified-agent-executor',
        agentExecutionOrder: agentsToExecute
      }
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      totalDuration
    }, '❌ UNIFIED ORCHESTRATOR: Orchestration failed');

    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      totalDuration
    }, { status: 500 });
  }
}

/**
 * Call the unified agent executor
 */
async function callUnifiedExecutor(request: {
  jobId: string;
  agentType: AgentType;
  tcc: ToolConstructionContext;
  selectedModel?: string;
  isIsolatedTest?: boolean;
  retryAttempt?: number;
  maxRetries?: number;
}): Promise<{
  success: boolean;
  result?: any;
  updatedTcc?: ToolConstructionContext;
  error?: string;
}> {
  
  // In a real environment, this would be an HTTP call
  // For now, we'll import and call the executor directly
  const { executeAgent } = await import('../unified-agent-executor/route');
  
  // Call the unified executor's core function
  return await executeAgent({
    jobId: request.jobId,
    agentType: request.agentType,
    tcc: request.tcc,
    selectedModel: request.selectedModel,
    isIsolatedTest: request.isIsolatedTest || false,
    retryAttempt: request.retryAttempt || 0,
    maxRetries: request.maxRetries || 3
  });
} 