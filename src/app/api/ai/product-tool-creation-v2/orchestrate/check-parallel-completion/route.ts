import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  OrchestrationStepEnum,
  ToolConstructionContext,
} from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';

const CheckCompletionRequestSchema = z.object({
  jobId: z.string().uuid(),
  tcc: z.custom<ToolConstructionContext>().optional(),
  mockTcc: z.custom<ToolConstructionContext>().optional(),
});

export async function POST(request: NextRequest) {
  let jobId = 'unknown';
  try {
    const body = await request.json();
    const parsedBody = CheckCompletionRequestSchema.parse(body);
    jobId = parsedBody.jobId;
    const partialTccFromAgent = parsedBody.mockTcc || parsedBody.tcc;

    if (!partialTccFromAgent) {
      throw new Error('Partial TCC from calling agent was not provided.');
    }

    logger.info({ jobId, agentOutputKeys: Object.keys(partialTccFromAgent) }, '🔍 CHECK-COMPLETION: Received partial TCC from a completing agent');

    // 1. Load master TCC from the store to get the most complete state
    const masterTcc = await getTCC(jobId, { forceRefresh: true });
    if (!masterTcc) {
      throw new Error(`Master TCC not found in store for jobId: ${jobId}`);
    }
    logger.info(
      {
        jobId,
        masterTccState: {
          hasStateLogic: !!masterTcc.stateLogic,
          hasJsxLayout: !!masterTcc.jsxLayout,
        },
      },
      '🔍 CHECK-COMPLETION: Loaded master TCC from store',
    );

    // 2. Merge the partial TCC from the agent into the master TCC
    const mergedTcc: ToolConstructionContext = {
      ...masterTcc,
      ...partialTccFromAgent,
      steps: { ...masterTcc.steps, ...partialTccFromAgent.steps },
      updatedAt: new Date().toISOString(),
    };

    logger.info(
      {
        jobId,
        mergedTccState: {
          hasStateLogic: !!mergedTcc.stateLogic,
          hasJsxLayout: !!mergedTcc.jsxLayout,
        },
      },
      '🔍 CHECK-COMPLETION: Merged agent TCC into master TCC',
    );

    // 3. Save the newly merged TCC back to the store
    await saveTCC(mergedTcc);
    logger.info({ jobId }, '🔍 CHECK-COMPLETION: Saved merged TCC back to store');

    // 4. Perform completion check on the fully merged TCC
    const parallelCompletionResult = checkParallelStepCompletion(mergedTcc);

    logger.info(
      {
        jobId,
        currentStep: mergedTcc.currentOrchestrationStep,
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
        '🔍 CHECK-COMPLETION: Handing off to official trigger-next-step endpoint',
      );

      // Asynchronously trigger the next step, no need to await
      fetch(
        `${request.nextUrl.origin}/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            nextStep: parallelCompletionResult.nextStep,
            tcc: mergedTcc, // Pass the fully merged TCC
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
      currentStep: mergedTcc.currentOrchestrationStep,
      ...parallelCompletionResult,
      status: mergedTcc.status,
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