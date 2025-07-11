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
import { runStateDesignLoop } from '../../../../../lib/agents/unified/loops/state-design-loop';

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
    const jobId = providedJobId || `workflow-${uuidv4()}`;
    
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
        userId: userId, // Pass userId here
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
      'jsx-layout',
      'tailwind-styling',
      'component-assembler',
      'code-validator',
      'tool-finalizer'
    ];

    // Start background processing (don't await - return immediately)
    processAgentsInBackground(userId, jobId, agentSequence, initialTcc, agentModelMapping, primaryModel);

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
  userId: string, // <-- Pass userId explicitly
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
            userId: userId, // Use explicitly passed userId
            agentType,
            modelUsed: agentModel,
            startTime: new Date().toISOString()
          }
        );
        
        logger.info({
          jobId,
          agentType,
          model: agentModel,
          tccKeys: Object.keys(currentTcc)
        }, `🔗 Executing ${agentType} agent directly`);
        
        const executionContext = createAgentExecutionContext(
          agentType as AgentType,
          jobId,
          currentTcc,
          agentModel,
          false
        );

        const { result, updatedTcc } = await executeAgent(agentType as AgentType, executionContext, currentTcc);
        
        logger.info({
          jobId,
          agentType,
          success: true,
          hasUpdatedTcc: !!updatedTcc
        }, `✅ Direct agent execution completed for ${agentType}`);

        // 🔍 Additional debug summaries for key agents
        if (agentType === 'function-planner' && result && Array.isArray((result as any).functionSignatures)) {
          const sigs = (result as any).functionSignatures;
          logger.info({
            jobId,
            fnCount: sigs.length,
            names: sigs.map((f: any) => f.name).slice(0, 20)
          }, '🧩 Function-Planner output summary');
        }

        if (agentType === 'state-design' && result && (result as any).stateLogic?.functions) {
          const funcs = (result as any).stateLogic.functions;
          logger.info({
            jobId,
            fnCount: funcs.length,
            names: funcs.map((f: any) => f.name).slice(0, 20)
          }, '🧩 State-Design output summary');
        }

        currentTcc = updatedTcc || currentTcc;

        // Mark planning_function_signatures as completed immediately
        if (agentType === 'function-planner') {
          await emitStepProgress(
            jobId,
            'planning_function_signatures' as any,
            'completed',
            'function-planner completed successfully',
            { userId, agentType }
          );
        }

        // 🚀 Invoke iterative State-Design loop immediately after Function-Planner
        if (agentType === 'function-planner') {
          const stateDesignModel = agentModelMapping?.['state-design'] || primaryModel || 'claude-3-7-sonnet-20250219';

          await emitStepProgress(
            jobId,
            'designing_state_logic' as any,
            'started',
            'State-Design loop initiated',
            { userId, modelUsed: stateDesignModel }
          );

          const loopExecutionContext = createAgentExecutionContext(
            'state-design' as AgentType,
            jobId,
            currentTcc,
            stateDesignModel,
            false
          );

          const { updatedTcc: loopTcc, passes } = await runStateDesignLoop(loopExecutionContext, currentTcc);
          currentTcc = loopTcc;

          await emitStepProgress(
            jobId,
            'designing_state_logic' as any,
            'completed',
            `State-Design loop completed in ${passes} pass(es)`,
            { userId, passes }
          );
          await emitTccUpdate(jobId, currentTcc, 'state-design');
        }
        
        // Skip duplicate completion for planner (already emitted)
        if (agentType !== 'function-planner') {
          await emitStepProgress(
            jobId,
            stepName as any,
            'completed',
            `${agentType} completed successfully`,
            {
              userId: userId, // Use explicitly passed userId
              agentType,
              completedAt: new Date().toISOString(),
              tccUpdated: !!updatedTcc
            }
          );
        }
         
        
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

        await emitStepProgress(
          jobId,
          'failed',
          'failed',
          `Workflow failed at ${agentType}: ${errorMessage}`,
          {
            userId: userId, // Use explicitly passed userId
            failedAgent: agentType,
            step: `${i + 1}/${agentSequence.length}`,
            error: errorMessage,
            failedAt: new Date().toISOString()
          }
        );
        
        await emitTccUpdate(jobId, { ...currentTcc, status: 'failed', error: errorMessage }, 'orchestrator');

        return;
      }
    }

    // 🚨 CRITICAL FIX: ALWAYS SEND COMPLETE TCC WITH FINAL PRODUCT
    await emitStepProgress(
      jobId,
      'completed',
      'completed',
      'V2 Orchestration workflow completed successfully',
      {
        userId: userId,
        updatedTcc: currentTcc, // 🎯 SEND THE COMPLETE TCC
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
        userId: userId, // <-- CRITICAL FIX: Add userId here
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
