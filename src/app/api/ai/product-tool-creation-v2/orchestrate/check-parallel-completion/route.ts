import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  OrchestrationStepEnum,
  ToolConstructionContext,
} from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

const CheckCompletionRequestSchema = z.object({
  jobId: z.string().uuid(),
  tcc: z.custom<ToolConstructionContext>(),
});

export async function POST(request: NextRequest) {
  let jobId = 'unknown';
  try {
    const body = await request.json();
    const parsedBody = CheckCompletionRequestSchema.parse(body);
    jobId = parsedBody.jobId;
    const tcc = parsedBody.tcc;

    if (!tcc) {
      throw new Error('TCC object is required - the TCC store has been deprecated, TCC must be passed as props');
    }

    logger.info({ jobId, agentOutputKeys: Object.keys(tcc) }, '🔍 CHECK-COMPLETION: Received TCC from completing agent');

    // Check parallel step completion status
    const parallelCompletionResult = checkParallelStepCompletion(tcc);

    logger.info(
      {
        jobId,
        currentStep: tcc.currentOrchestrationStep,
        decisionDetails: parallelCompletionResult,
      },
      '🔍 CHECK-COMPLETION: Parallel completion status determined',
    );

    if (
      parallelCompletionResult.readyToTriggerNext &&
      parallelCompletionResult.nextStep
    ) {
      logger.info(
        { jobId, nextStep: parallelCompletionResult.nextStep },
        '🔍 CHECK-COMPLETION: Triggering next step with TCC props pattern',
      );

      // Asynchronously trigger the next step with updated TCC
      const updatedTcc = {
        ...tcc,
        currentOrchestrationStep: parallelCompletionResult.nextStep as any,
        updatedAt: new Date().toISOString()
      };

      fetch(
        `${request.nextUrl.origin}/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            nextStep: parallelCompletionResult.nextStep,
            tcc: updatedTcc,
          }),
        },
      ).catch(error => {
        logger.error(
          { jobId, nextStep: parallelCompletionResult.nextStep, error },
          '🔍 CHECK-COMPLETION: Fire-and-forget call to trigger-next-step failed',
        );
      });
    }

    const response = {
      success: true,
      jobId,
      currentStep: tcc.currentOrchestrationStep,
      ...parallelCompletionResult,
      status: tcc.status,
      updatedTcc: tcc,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      {
        jobId,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : String(error),
      },
      '🔍 CHECK-COMPLETION: Request failed',
    );

    return NextResponse.json(
      {
        success: false,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}
function checkParallelStepCompletion(tcc: ToolConstructionContext): {
  isComplete: boolean;
  nextStep: string | null;
  readyToTriggerNext: boolean;
  parallelStatus?: {
    stateDesignComplete: boolean;
    jsxLayoutComplete: boolean;
  };
} {
  const stateDesignComplete = !!tcc.stateLogic;
  const jsxLayoutComplete = !!tcc.jsxLayout;
  const bothComplete = stateDesignComplete && jsxLayoutComplete;

  logger.info({
    jobId: tcc.jobId,
    stateDesignComplete,
    jsxLayoutComplete,
    bothComplete
  }, '🔍 CHECK-COMPLETION: Final state analysis for parallel step');

  let nextStep = null;
  if (bothComplete) {
    nextStep = OrchestrationStepEnum.enum.applying_tailwind_styling;
  }

  return {
    isComplete: bothComplete,
    nextStep: nextStep,
    readyToTriggerNext: bothComplete,
    parallelStatus: {
      stateDesignComplete,
      jsxLayoutComplete,
    },
  };
}
