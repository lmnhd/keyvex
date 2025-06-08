import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  ToolConstructionContext,
} from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

const CheckCompletionRequestSchema = z.object({
  jobId: z.string().uuid(),
  tcc: z.custom<ToolConstructionContext>(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, tcc } = CheckCompletionRequestSchema.parse(body);

    logger.info(
      { jobId },
      '🔍 CHECK-COMPLETION: Checking parallel agent completion status using passed-in TCC',
    );

    if (!tcc) {
      return NextResponse.json(
        {
          success: false,
          error: 'TCC not provided in request body',
          jobId,
        },
        { status: 400 },
      );
    }

    if (tcc.status === OrchestrationStatusEnum.enum.error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Process has failed',
          jobId,
          currentStep: tcc.currentOrchestrationStep,
          status: tcc.status,
        },
        { status: 400 },
      );
    }

    logger.info(
      {
        jobId,
        stateFromRequest: {
          hasStateLogic: !!tcc.stateLogic,
          hasJsxLayout: !!tcc.jsxLayout,
          currentStep: tcc.currentOrchestrationStep
        },
      },
      '🔍 CHECK-COMPLETION: Using TCC state from request body',
    );

    const parallelCompletionResult = checkParallelStepCompletion(tcc);

    logger.info(
      {
        jobId,
        currentStep: tcc.currentOrchestrationStep,
        decisionDetails: parallelCompletionResult,
      },
      '🔍 CHECK-COMPLETION: Parallel completion status determined',
    );

    if (parallelCompletionResult.readyToTriggerNext && parallelCompletionResult.nextStep) {
      logger.info(
        {
          jobId,
          nextStep: parallelCompletionResult.nextStep,
        },
        '🔍 CHECK-COMPLETION: Handing off to official trigger-next-step endpoint',
      );

      fetch(
        `${request.nextUrl.origin}/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            nextStep: parallelCompletionResult.nextStep,
            tcc,
          }),
        },
      ).catch(error => {
        logger.error(
          { jobId, nextStep: parallelCompletionResult.nextStep, error },
          '🔍 CHECK-COMPLETION: Failed to call official trigger-next-step endpoint',
        );
      });
    }

    const response = {
      success: true,
      jobId,
      currentStep: tcc.currentOrchestrationStep,
      ...parallelCompletionResult,
      status: tcc.status,
      progress: {
        functionsPlanned: !!tcc.definedFunctionSignatures,
        stateDesigned: !!tcc.stateLogic,
        jsxLayoutCreated: !!tcc.jsxLayout,
        stylingApplied: !!(tcc as any).styling,
        componentAssembled: !!tcc.assembledComponentCode,
        validated: !!tcc.validationResult?.isValid,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : String(error),
        endpoint: '/orchestrate/check-parallel-completion',
      },
      '🔍 CHECK-COMPLETION: Request failed',
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

function checkParallelStepCompletion(tcc: any): {
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