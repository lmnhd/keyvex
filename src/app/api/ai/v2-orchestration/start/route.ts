/**
 * V2 Orchestration Start Endpoint
 * Handles the complete agent workflow with real-time WebSocket progress updates
 * Replaces the frontend sequential execution with proper backend orchestration
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../../../../lib/logger';
import { emitStepProgress, emitTccUpdate } from '../../../../../lib/streaming/progress-emitter.server';
import { requireAuth } from '@/lib/auth/debug';

// Import direct agent execution (instead of HTTP calls)
import { executeAgent } from '../../../../../lib/agents/unified/core/agent-executor';
import { createAgentExecutionContext } from '../../../../../lib/agents/unified/core/model-manager';
import { AgentType } from '../../../../../lib/types/tcc-unified';

// Request schema for V2 orchestration
const V2OrchestrationRequestSchema = z.object({
  brainstormData: z.object({
    id: z.string(),
    userInput: z.object({
      toolType: z.string(),
      targetAudience: z.string(),
      industry: z.string().optional(),
      businessContext: z.string().optional(),
      selectedModel: z.string().optional(),
    }),
    brainstormData: z.any(), // The actual brainstorm content
  }),
  agentModelMapping: z.record(z.string()).optional(),
  primaryModel: z.string().optional(),
  jobId: z.string().optional(),
});

type V2OrchestrationRequest = z.infer<typeof V2OrchestrationRequestSchema>;

interface V2OrchestrationResponse {
  success: boolean;
  jobId: string;
  message: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<V2OrchestrationResponse>> {
  const startTime = Date.now();
  
  try {
    const userId = await requireAuth();
    const body = await request.json();
    
    // 🔍 DEBUG: Log the incoming request body
    logger.info({
      bodyKeys: Object.keys(body),
      brainstormDataKeys: body.brainstormData ? Object.keys(body.brainstormData) : [],
      userInputKeys: body.brainstormData?.userInput ? Object.keys(body.brainstormData.userInput) : [],
      userInputData: body.brainstormData?.userInput
    }, '🔍 V2 Orchestration: Incoming request structure');
    
    const validatedRequest = V2OrchestrationRequestSchema.parse(body);
    const { brainstormData, agentModelMapping, primaryModel, jobId: providedJobId } = validatedRequest;

    // Generate job ID if not provided
    const jobId = providedJobId || uuidv4();
    
    logger.info({
      jobId,
      brainstormId: brainstormData.id,
      primaryModel,
      agentMappingCount: Object.keys(agentModelMapping || {}).length
    }, '🚀 V2 Orchestration: Starting backend workflow');

    // 🎬 EMIT WORKFLOW START
    await emitStepProgress(
      jobId,
      'initialization',
      'started',
      'V2 Orchestration workflow has begun',
      {
        brainstormId: brainstormData.id,
        targetAudience: brainstormData.userInput.targetAudience,
        totalAgents: 7,
        startTime: new Date().toISOString()
      }
    );

    // Create initial TCC from brainstorm data
    const initialTcc = {
      userId: userId,
      jobId,
      userInput: {
        description: brainstormData.userInput.businessContext || 'Tool description not provided',
        targetAudience: brainstormData.userInput.targetAudience,
        industry: brainstormData.userInput.industry,
        toolType: brainstormData.userInput.toolType,
        features: [],
      },
      brainstormData: brainstormData.brainstormData,
      stepStatus: {},
      agentModelMapping: agentModelMapping || { 'default': primaryModel || 'claude-3-7-sonnet-20250219' },
      status: 'in_progress',
      currentOrchestrationStep: 'planning_function_signatures',
      targetAudience: brainstormData.userInput.targetAudience || 'General users',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: {}
    };

    // Execute agents sequentially with WebSocket updates
    const agentSequence = [
      'function-planner',
      'state-design', 
      'jsx-layout',
      'tailwind-styling',
      'component-assembler',
      'code-validator',
      'tool-finalizer'
    ];

    let currentTcc = initialTcc;

    // Start background processing (don't await - return immediately)
    processAgentsInBackground(jobId, agentSequence, currentTcc, agentModelMapping, primaryModel);

    // Return success immediately - client will receive updates via WebSocket
    return NextResponse.json({
      success: true,
      jobId,
      message: `V2 Orchestration started successfully. Monitor progress via WebSocket connection.`,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      error: errorMessage,
      executionTime: Date.now() - startTime
    }, '❌ V2 Orchestration: Failed to start workflow');

    return NextResponse.json({
      success: false,
      jobId: 'unknown',
      message: 'Failed to start V2 orchestration',
      error: errorMessage,
    }, { status: 500 });
  }
}

/**
 * Process agents in background with real-time updates
 */
async function processAgentsInBackground(
  jobId: string,
  agentSequence: string[],
  initialTcc: any,
  agentModelMapping?: Record<string, string>,
  primaryModel?: string
): Promise<void> {
  let currentTcc = initialTcc;
  
  try {
    logger.info({ jobId, totalAgents: agentSequence.length }, '🔄 Starting background agent processing');

    for (let i = 0; i < agentSequence.length; i++) {
      const agentType = agentSequence[i];
      const agentModel = agentModelMapping?.[agentType] || primaryModel || 'claude-3-7-sonnet-20250219';
      
      logger.info({
        jobId,
        agentType,
        step: `${i + 1}/${agentSequence.length}`,
        model: agentModel
      }, `🤖 Processing agent: ${agentType}`);

      try {
        // 🚀 EMIT AGENT START PROGRESS
        const stepMapping: Record<string, string> = {
          'function-planner': 'planning_function_signatures',
          'state-design': 'designing_state_logic',
          'jsx-layout': 'designing_jsx_layout',
          'tailwind-styling': 'applying_tailwind_styling',
          'component-assembler': 'assembling_component',
          'code-validator': 'validating_code',
          'tool-finalizer': 'finalizing_tool'
        };
        
        const stepName = stepMapping[agentType] || 'processing';
        await emitStepProgress(
          jobId,
          stepName as any,
          'started',
          `${agentType} is processing...`,
          {
            userId: currentTcc.userId,
            agentType,
            modelUsed: agentModel,
            startTime: new Date().toISOString()
          }
        );
        
        // Execute agent directly instead of HTTP call to avoid "fetch failed" issues
        logger.info({
          jobId,
          agentType,
          model: agentModel,
          tccKeys: Object.keys(currentTcc)
        }, `🔗 Executing ${agentType} agent directly`);
        
        // Create execution context
        const executionContext = createAgentExecutionContext(
          agentType as AgentType,
          jobId,
          currentTcc,
          agentModel,
          false // not isolated test
        );

        // Execute the agent directly
        const { result, updatedTcc } = await executeAgent(agentType as AgentType, executionContext, currentTcc);
        
        logger.info({
          jobId,
          agentType,
          success: true,
          hasUpdatedTcc: !!updatedTcc
        }, `✅ Direct agent execution completed for ${agentType}`);

        // Update TCC with the agent's result
        currentTcc = updatedTcc || currentTcc;
        
        // 🎉 EMIT AGENT COMPLETION PROGRESS
        await emitStepProgress(
          jobId,
          stepName as any,
          'completed',
          `${agentType} completed successfully`,
          {
            userId: currentTcc.userId,
            agentType,
            completedAt: new Date().toISOString(),
            tccUpdated: !!updatedTcc
          }
        );
        
        // 📊 EMIT TCC UPDATE - Send updated TCC to workbench
        await emitTccUpdate(jobId, currentTcc, agentType);
        
        logger.info({
          jobId,
          agentType,
          step: `${i + 1}/${agentSequence.length}`,
          hasResult: !!result,
          hasUpdatedTcc: !!updatedTcc
        }, `✅ Agent ${agentType} completed successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        logger.error({
          jobId,
          agentType,
          step: `${i + 1}/${agentSequence.length}`,
          error: errorMessage
        }, `❌ Agent ${agentType} failed`);

        // 💥 EMIT WORKFLOW FAILURE
        await emitStepProgress(
          jobId,
          'failed',
          'failed',
          `Workflow failed at ${agentType}: ${errorMessage}`,
          {
            userId: currentTcc.userId,
            failedAgent: agentType,
            step: `${i + 1}/${agentSequence.length}`,
            error: errorMessage,
            failedAt: new Date().toISOString()
          }
        );
        
        // 📊 Also emit the final TCC so the workbench can inspect the failure state
        await emitTccUpdate(jobId, { ...currentTcc, status: 'failed', error: errorMessage }, 'orchestrator');

        return; // Stop processing
      }
    }

    // 🎉 EMIT WORKFLOW COMPLETION
    await emitStepProgress(
      jobId,
      'completed',
      'completed',
      'V2 Orchestration workflow completed successfully',
      {
        totalAgents: agentSequence.length,
        finalTccKeys: Object.keys(currentTcc),
        completedAt: new Date().toISOString(),
        hasFinalProduct: !!currentTcc.finalProduct
      }
    );

    logger.info({
      jobId,
      totalAgents: agentSequence.length,
      finalTccKeys: Object.keys(currentTcc)
    }, '🎉 V2 Orchestration: All agents completed successfully');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      jobId,
      error: errorMessage
    }, '❌ V2 Orchestration: Background processing failed');

    await emitStepProgress(
      jobId,
      'failed',
      'failed',
      `Workflow processing failed: ${errorMessage}`,
      {
        error: errorMessage,
        failedAt: new Date().toISOString()
      }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'V2 Orchestration API',
    endpoints: {
      'POST /start': 'Start V2 orchestration workflow',
    },
    status: 'ready'
  });
} 