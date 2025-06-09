import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OrchestrationStepEnum, OrchestrationStatusEnum, ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
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
      return NextResponse.json({ 
        success: false, 
        error: 'TCC must be provided in the request body.',
        jobId 
      }, { status: 400 });
    }

    if (!Object.values(OrchestrationStepEnum.enum).includes(nextStep as any)) {
      return NextResponse.json({
        success: false,
        error: `Invalid next step: ${nextStep}`,
        jobId
      }, { status: 400 });
    }

    const updatedTCC = {
      ...tcc,
      currentOrchestrationStep: nextStep as any,
      status: OrchestrationStatusEnum.enum.pending,
      updatedAt: new Date().toISOString()
    };
    
    // TCC store deprecated - TCC is now managed via props
    logger.info({ jobId, nextStep }, '🚀 TRIGGER-NEXT: TCC updated to next step (props-based)');

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

    if (agentPath) {
      try {
        const agentUrl = new URL(
          `/api/ai/product-tool-creation-v2/agents/${agentPath}`,
          request.nextUrl.origin
        );

        // TCC store deprecated - TCC is managed via props

        await emitStepProgress(
          jobId,
          nextStep as any,
          'started',
          `[DEV-FALLBACK] Starting ${stepDisplayName}...`,
          { tcc }
        );

        fetch(agentUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId, tcc: updatedTCC }),
        }).catch(fetchError => {
          logger.error({ jobId, agentPath, fetchError }, '🚀 TRIGGER-NEXT: Failed to trigger agent');
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
        
        const failedTCC = {
          ...updatedTCC,
          status: OrchestrationStatusEnum.enum.error,
          updatedAt: new Date().toISOString()
        };
        // TCC store deprecated - TCC is managed via props

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
      if (nextStep === OrchestrationStepEnum.enum.completed) {
        const completedTCC = {
          ...updatedTCC,
          status: OrchestrationStatusEnum.enum.completed,
          updatedAt: new Date().toISOString()
        };
        // TCC store deprecated - TCC is managed via props

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