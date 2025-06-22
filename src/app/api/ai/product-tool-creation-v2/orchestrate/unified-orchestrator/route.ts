/**
 * UNIFIED ORCHESTRATOR - Sequential Agent Execution through Universal Route
 * 
 * This orchestrator calls ALL agents through the single universal agent route.
 * This gives you ONE place to monitor and debug the entire tool creation pipeline.
 * 
 * PHASE 2 COMPLETE: Now using /api/ai/agents/universal route!
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
 * 🎯 UNIFIED ORCHESTRATOR ENDPOINT - PHASE 2 COMPLETE!
 * 
 * Executes the complete tool creation pipeline using the universal agent route.
 * Every agent call goes through /api/ai/agents/universal route.
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
      isIsolatedTest,
      universalRouteUsed: true
    }, '🚀 UNIFIED ORCHESTRATOR: Starting orchestration with Universal Route');

    // Determine which agents to execute
    const startIndex = startFromAgent ? AGENT_EXECUTION_ORDER.indexOf(startFromAgent) : 0;
    const stopIndex = stopAfterAgent ? AGENT_EXECUTION_ORDER.indexOf(stopAfterAgent) : AGENT_EXECUTION_ORDER.length - 1;
    const agentsToExecute = AGENT_EXECUTION_ORDER.slice(startIndex, stopIndex + 1);

    logger.info({
      jobId,
      agentsToExecute,
      totalAgents: agentsToExecute.length,
      universalRoute: '/api/ai/agents/universal'
    }, '🚀 UNIFIED ORCHESTRATOR: Agent execution plan with Universal Route');

    let currentTcc = initialTcc;
    const executionResults: Array<{
      agentType: AgentType;
      success: boolean;
      duration: number;
      error?: string;
      result?: any;
      modelUsed?: string;
      executionTime?: number;
      validationScore?: number;
    }> = [];

    // Execute each agent sequentially through the universal route
    for (let i = 0; i < agentsToExecute.length; i++) {
      const agentType = agentsToExecute[i];
      const agentStartTime = Date.now();
      
      logger.info({
        jobId,
        agentType,
        stepNumber: i + 1,
        totalSteps: agentsToExecute.length,
        route: '/api/ai/agents/universal'
      }, `🤖 UNIFIED ORCHESTRATOR: Executing agent ${i + 1}/${agentsToExecute.length} via Universal Route`);

      try {
        // Call the universal agent route for this agent
        const universalResponse = await callUniversalRoute({
          jobId,
          agentType,
          tcc: currentTcc,
          selectedModel,
          isIsolatedTest,
          retryAttempt: 0
        });

        const agentDuration = Date.now() - agentStartTime;

        if (universalResponse.success) {
          // Update TCC with the result
          currentTcc = universalResponse.updatedTcc || currentTcc;
          
          executionResults.push({
            agentType,
            success: true,
            duration: agentDuration,
            result: universalResponse.result,
            modelUsed: universalResponse.modelUsed,
            executionTime: universalResponse.executionTime,
            validationScore: universalResponse.validationScore
          });

          logger.info({
            jobId,
            agentType,
            duration: agentDuration,
            stepNumber: i + 1,
            modelUsed: universalResponse.modelUsed,
            validationScore: universalResponse.validationScore
          }, `✅ UNIFIED ORCHESTRATOR: Agent ${agentType} completed successfully via Universal Route`);
        } else {
          // Agent failed
          executionResults.push({
            agentType,
            success: false,
            duration: agentDuration,
            error: universalResponse.error
          });

          logger.error({
            jobId,
            agentType,
            error: universalResponse.error,
            duration: agentDuration,
            retryInfo: universalResponse.retryInfo
          }, `❌ UNIFIED ORCHESTRATOR: Agent ${agentType} failed via Universal Route`);

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
      overallSuccess,
      universalRouteUsed: true
    }, '🏁 UNIFIED ORCHESTRATOR: Orchestration completed via Universal Route');

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
        executedAgents: executionResults.map(r => r.agentType),
        averageValidationScore: executionResults
          .filter(r => r.validationScore)
          .reduce((sum, r) => sum + (r.validationScore || 0), 0) / 
          executionResults.filter(r => r.validationScore).length || 0
      },
      debugInfo: {
        universalRouteUsed: true,
        executorEndpoint: '/api/ai/agents/universal',
        agentExecutionOrder: agentsToExecute,
        phase: 'Phase 2 Complete - Universal Route Integration'
      }
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      totalDuration,
      universalRouteUsed: true
    }, '❌ UNIFIED ORCHESTRATOR: Orchestration failed');

    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      totalDuration,
      debugInfo: {
        universalRouteUsed: true,
        executorEndpoint: '/api/ai/agents/universal'
      }
    }, { status: 500 });
  }
}

/**
 * Call the universal agent route (Phase 2 Implementation)
 */
async function callUniversalRoute(request: {
  jobId: string;
  agentType: AgentType;
  tcc: ToolConstructionContext;
  selectedModel?: string;
  isIsolatedTest?: boolean;
  retryAttempt?: number;
}): Promise<{
  success: boolean;
  result?: any;
  updatedTcc?: ToolConstructionContext;
  error?: string;
  modelUsed?: string;
  executionTime?: number;
  validationScore?: number;
  retryInfo?: any;
}> {
  
  try {
    // Make HTTP call to the universal agent route
    const universalRouteUrl = `/api/ai/agents/universal`;
    
    const requestBody = {
      agentType: request.agentType,
      jobId: request.jobId,
      tcc: request.tcc,
      selectedModel: request.selectedModel,
      isIsolatedTest: request.isIsolatedTest || false,
      retryAttempt: request.retryAttempt || 0
    };

    logger.info({
      jobId: request.jobId,
      agentType: request.agentType,
      url: universalRouteUrl
    }, '📡 UNIVERSAL ROUTE CALL: Making request to universal agent route');

    // For server-side execution, we need to import and call directly
    // In production, this would be an actual HTTP call
    const { POST } = await import('../../../../../../api/ai/agents/universal/route');
    
    // Create a mock request object
    const mockRequest = {
      json: async () => requestBody
    } as NextRequest;

    const response = await POST(mockRequest);
    const responseData = await response.json();

    if (responseData.success) {
      logger.info({
        jobId: request.jobId,
        agentType: request.agentType,
        modelUsed: responseData.modelUsed,
        executionTime: responseData.executionTime,
        validationScore: responseData.validationScore
      }, '✅ UNIVERSAL ROUTE CALL: Successful response');

      return {
        success: true,
        result: responseData.result,
        updatedTcc: responseData.updatedTcc,
        modelUsed: responseData.modelUsed,
        executionTime: responseData.executionTime,
        validationScore: responseData.validationScore,
        retryInfo: responseData.retryInfo
      };
    } else {
      logger.error({
        jobId: request.jobId,
        agentType: request.agentType,
        error: responseData.error
      }, '❌ UNIVERSAL ROUTE CALL: Error response');

      return {
        success: false,
        error: responseData.error,
        retryInfo: responseData.retryInfo
      };
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error({
      jobId: request.jobId,
      agentType: request.agentType,
      error: errorMessage
    }, '❌ UNIVERSAL ROUTE CALL: Request failed');

    return {
      success: false,
      error: `Universal route call failed: ${errorMessage}`
    };
  }
} 