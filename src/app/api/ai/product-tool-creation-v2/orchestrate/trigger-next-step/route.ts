import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveTCC } from '@/lib/db/tcc-store';
import { OrchestrationStepEnum, OrchestrationStatusEnum, ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import logger from '@/lib/logger';

const TriggerNextStepRequestSchema = z.object({
  jobId: z.string().uuid(),
  nextStep: z.string(),
  tcc: z.custom<ToolConstructionContext>(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, nextStep, tcc } = TriggerNextStepRequestSchema.parse(body);
    
    logger.info({ jobId, nextStep }, '🚀 TRIGGER-NEXT: Triggering next step in orchestration');

    if (!tcc) {
      // This case should ideally not be hit if the schema is enforced
      return NextResponse.json({ 
        success: false, 
        error: 'TCC must be provided in the request body.',
        jobId 
      }, { status: 400 });
    }

    // Validate the next step is valid
    if (!Object.values(OrchestrationStepEnum.enum).includes(nextStep as any)) {
      return NextResponse.json({
        success: false,
        error: `Invalid next step: ${nextStep}`,
        jobId
      }, { status: 400 });
    }

    // Update TCC to the next step
    const updatedTCC = {
      ...tcc,
      currentOrchestrationStep: nextStep as any,
      status: OrchestrationStatusEnum.enum.pending,
      updatedAt: new Date().toISOString()
    };
    
    await saveTCC(updatedTCC);
    logger.info({ jobId, nextStep }, '🚀 TRIGGER-NEXT: TCC updated to next step');

    // Determine which agent to trigger based on next step
    let agentPath: string | null = null;
    let stepDisplayName = '';

    switch (nextStep) {
      case OrchestrationStepEnum.enum.planning_function_signatures:
        agentPath = 'function-planner';
        stepDisplayName = 'Function Signature Planning';
        break;
        
      case OrchestrationStepEnum.enum.designing_state_logic:
        agentPath = 'state-design';
        stepDisplayName = 'State Design';
        break;
        
      case OrchestrationStepEnum.enum.designing_jsx_layout:
        agentPath = 'jsx-layout';
        stepDisplayName = 'JSX Layout Design';
        break;
        
      case OrchestrationStepEnum.enum.applying_tailwind_styling:
        agentPath = 'tailwind-styling';
        stepDisplayName = 'Tailwind Styling';
        break;
        
      case OrchestrationStepEnum.enum.assembling_component:
        agentPath = 'component-assembler';
        stepDisplayName = 'Component Assembly';
        break;
        
      case OrchestrationStepEnum.enum.validating_code:
        agentPath = 'validator';
        stepDisplayName = 'Code Validation';
        break;

      case OrchestrationStepEnum.enum.finalizing_tool:
        agentPath = 'tool-finalizer';
        stepDisplayName = 'Tool Finalization';
        break;
        
      case OrchestrationStepEnum.enum.completed:
        agentPath = null;
        stepDisplayName = 'Completed';
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: `No agent defined for step: ${nextStep}`,
          jobId
        }, { status: 400 });
    }

    // Trigger the appropriate agent
    if (agentPath) {
      try {
        const agentUrl = new URL(
          `/api/ai/product-tool-creation-v2/agents/${agentPath}`,
          request.nextUrl.origin
        );

        // Persist the updated TCC before triggering the next agent
        await saveTCC(tcc);

        await emitStepProgress(
          jobId,
          nextStep as any,
          'started',
          `[DEV-FALLBACK] Starting ${stepDisplayName}...`,
          { tcc } // Pass the full TCC in the progress update
        );

        // Trigger the agent asynchronously (fire and forget)
        fetch(agentUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId, tcc: updatedTCC }),
        }).catch(fetchError => {
          logger.error({ jobId, agentPath, fetchError }, '🚀 TRIGGER-NEXT: Failed to trigger agent');
          // Emit failure progress
          emitStepProgress(
            jobId, 
            nextStep as any, 
            'failed', 
            `Failed to start ${stepDisplayName}: ${fetchError.message}`
          ).catch(console.error);
        });

        logger.info({ jobId, agentPath, stepDisplayName }, '🚀 TRIGGER-NEXT: Agent triggered successfully');
        
        return NextResponse.json({
          success: true,
          jobId,
          nextStep,
          agentTriggered: agentPath,
          stepDisplayName,
          message: `${stepDisplayName} started successfully`
        });

      } catch (triggerError) {
        logger.error({ jobId, agentPath, triggerError }, '🚀 TRIGGER-NEXT: Error triggering agent');
        
        // Update TCC to error status
        const failedTCC = {
          ...updatedTCC,
          status: OrchestrationStatusEnum.enum.error,
          updatedAt: new Date().toISOString()
        };
        await saveTCC(failedTCC);

        await emitStepProgress(
          jobId,
          nextStep as any,
          'failed',
          `Failed to trigger ${stepDisplayName}: ${triggerError instanceof Error ? triggerError.message : 'Unknown error'}`
        );

        return NextResponse.json({
          success: false,
          error: `Failed to trigger agent: ${triggerError instanceof Error ? triggerError.message : 'Unknown error'}`,
          jobId,
          nextStep
        }, { status: 500 });
      }
    } else {
      // No agent to trigger (e.g., completion or assembly steps)
      if (nextStep === OrchestrationStepEnum.enum.completed) {
        const completedTCC = {
          ...updatedTCC,
          status: OrchestrationStatusEnum.enum.completed,
          updatedAt: new Date().toISOString()
        };
        await saveTCC(completedTCC);

        await emitStepProgress(
          jobId,
          nextStep as any,
          'completed',
          'Tool creation process completed successfully!'
        );

        logger.info({ jobId }, '🚀 TRIGGER-NEXT: Process marked as completed');
        
        return NextResponse.json({
          success: true,
          jobId,
          nextStep,
          stepDisplayName,
          message: 'Tool creation process completed!'
        });
      } else {
        // Assembly step or other steps without agents
        await emitStepProgress(
          jobId,
          nextStep as any,
          'initiated',
          `${stepDisplayName} step reached - awaiting implementation`
        );

        return NextResponse.json({
          success: true,
          jobId,
          nextStep,
          stepDisplayName,
          message: `${stepDisplayName} step reached - no agent implementation yet`
        });
      }
    }

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message
      } : String(error),
      endpoint: '/orchestrate/trigger-next-step'
    }, '🚀 TRIGGER-NEXT: Request failed');

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 