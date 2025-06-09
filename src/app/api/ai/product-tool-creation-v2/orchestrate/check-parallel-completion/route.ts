import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { kv } from '@vercel/kv';
import {
  OrchestrationStepEnum,
  ToolConstructionContext,
} from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';
import { merge } from 'lodash';

const CheckCompletionRequestSchema = z.object({
  jobId: z.string().uuid(),
  tcc: z.custom<ToolConstructionContext>(),
});

const CACHE_EXPIRATION_SECONDS = 300; // 5 minutes

export async function POST(request: NextRequest) {
  let jobId = 'unknown';
  try {
    const body = await request.json();
    const { jobId: parsedJobId, tcc: partialTcc } =
      CheckCompletionRequestSchema.parse(body);
    jobId = parsedJobId;
    const cacheKey = `tcc-merge:${jobId}`;

    logger.info(
      { jobId, keysInPartialTcc: Object.keys(partialTcc) },
      '🔍 KV-MERGE: Received partial TCC from a completing agent',
    );

    // 1. Check cache for the other agent's result
    const cachedTcc = await kv.get<ToolConstructionContext>(cacheKey);

    if (!cachedTcc) {
      // This is the first agent to finish.
      logger.info({ jobId, cacheKey }, '🔍 KV-MERGE: First agent finished. Caching partial TCC.');
      await kv.set(cacheKey, partialTcc, { ex: CACHE_EXPIRATION_SECONDS });

      return NextResponse.json({
        success: true,
        jobId,
        status: 'pending_merge',
        message: 'Partial TCC cached. Waiting for parallel agent to complete.',
      });
    }

    // This is the second agent to finish.
    logger.info({ jobId, cacheKey }, '🔍 KV-MERGE: Second agent finished. Merging TCCs.');

    // 2. Perform a deep merge of the cached TCC and the current agent's TCC
    const mergedTcc = merge({}, cachedTcc, partialTcc);
    mergedTcc.updatedAt = new Date().toISOString();

    logger.info(
      {
        jobId,
        mergedKeys: Object.keys(mergedTcc),
        stateLogic: !!mergedTcc.stateLogic,
        jsxLayout: !!mergedTcc.jsxLayout,
      },
      '🔍 KV-MERGE: TCCs merged successfully.',
    );

    // 3. Clean up the cache
    await kv.del(cacheKey);
    logger.info({ jobId, cacheKey }, '🔍 KV-MERGE: Cache key deleted.');

    // 4. Determine the next step after the merge
    const nextStep = OrchestrationStepEnum.enum.applying_tailwind_styling;
    mergedTcc.currentOrchestrationStep = nextStep;

    // 5. Asynchronously trigger the next step in the orchestration
    fetch(
      new URL(
        '/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step',
        request.url,
      ),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          nextStep: nextStep,
          tcc: mergedTcc, // Pass the fully merged TCC
        }),
      },
    ).catch(error => {
      logger.error(
        { jobId, nextStep, error },
        '🔍 KV-MERGE: Fire-and-forget call to trigger-next-step failed',
      );
    });

    logger.info(
      { jobId, nextStep },
      '🔍 KV-MERGE: Handed off to trigger-next-step endpoint.',
    );

    return NextResponse.json({
      success: true,
      jobId,
      status: 'merge_complete',
      nextStep,
      message: 'TCCs merged and next step triggered.',
      mergedTcc,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error({ jobId, error: errorMessage }, '🔍 KV-MERGE: Request failed');

    return NextResponse.json(
      {
        success: false,
        jobId,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}