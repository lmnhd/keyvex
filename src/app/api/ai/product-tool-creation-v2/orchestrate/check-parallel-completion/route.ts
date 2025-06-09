import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { kv } from '@vercel/kv';
import { merge } from 'lodash';
import {
  OrchestrationStepEnum,
  ToolConstructionContext,
  ToolConstructionContextSchema, // Import the authoritative schema
} from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';

// Use the authoritative schema for robust validation
const CheckCompletionRequestSchema = z.object({
  jobId: z.string().uuid(),
  tcc: ToolConstructionContextSchema, // Validate the incoming TCC
});

const CACHE_EXPIRATION_SECONDS = 300; // 5 minutes

export async function POST(request: NextRequest) {
  let jobId = 'unknown';
  try {
    const body = await request.json();
    // This will now throw a detailed error if the TCC is malformed
    const parsedBody = CheckCompletionRequestSchema.parse(body);
    jobId = parsedBody.jobId;
    const incomingTcc = parsedBody.tcc;
    
    const cacheKey = `tcc-merge:${jobId}`;
    const lockKey = `tcc-lock:${jobId}`;
    logger.info({ jobId, cacheKey, agentOutputKeys: Object.keys(incomingTcc) }, '🔍 CHECK-COMPLETION: Received valid TCC, checking cache.');

    // Try to acquire a lock to prevent race conditions
    const lockAcquired = await kv.set(lockKey, 'locked', { ex: 30, nx: true }); // 30 seconds, only if not exists
    
    if (!lockAcquired) {
      // Another agent is currently processing, wait briefly and check again
      logger.info({ jobId, lockKey }, '🔍 CHECK-COMPLETION: Lock already acquired, waiting briefly...');
      await new Promise(resolve => setTimeout(resolve, 100));
      const cachedTcc = await kv.get<ToolConstructionContext>(cacheKey);
      if (cachedTcc) {
        // The other agent finished and merged the results
        logger.info({ jobId }, '🔍 CHECK-COMPLETION: Results already merged by other agent');
        return NextResponse.json({
          success: true,
          jobId,
          status: 'already_merged',
          message: 'Results already merged by parallel agent.',
        });
      }
    }

    // Check for existing partial TCC in cache (now with lock protection)
    const cachedTcc = await kv.get<ToolConstructionContext>(cacheKey);

    if (cachedTcc) {
      // This is the second agent to finish
      logger.info({ jobId, cacheKey }, '🔍 CHECK-COMPLETION: Found cached TCC. Merging results.');
      
      // Perform a deep merge using the specific 'merge' import
      const mergedTcc = merge({}, cachedTcc, incomingTcc);

      // Clean up the cache and lock
      await kv.del(cacheKey);
      await kv.del(lockKey);
      logger.info({ jobId, cacheKey, lockKey }, '🔍 CHECK-COMPLETION: Cache and lock cleaned up.');

      // Update TCC for the next step
      const finalTcc: ToolConstructionContext = {
        ...mergedTcc,
        currentOrchestrationStep: OrchestrationStepEnum.enum.applying_tailwind_styling,
        updatedAt: new Date().toISOString(),
      };

      await emitStepProgress(
        jobId,
        'waiting_for_parallel_completion',
        'completed',
        'State Design and JSX Layout complete. Merged results.',
        finalTcc,
      );

      // Asynchronously trigger the next step (Tailwind Styling)
      fetch(
        `${request.nextUrl.origin}/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            nextStep: OrchestrationStepEnum.enum.applying_tailwind_styling,
            tcc: finalTcc,
          }),
        },
      ).catch(error => {
        logger.error(
          { jobId, nextStep: OrchestrationStepEnum.enum.applying_tailwind_styling, error },
          '🔍 CHECK-COMPLETION: Fire-and-forget call to trigger-next-step failed',
        );
      });

      return NextResponse.json({
        success: true,
        jobId,
        status: 'merged',
        message: 'Parallel agents complete. Triggering next step.',
        mergedTcc: finalTcc,
      });

    } else {
      // This is the first agent to finish
      logger.info({ jobId, cacheKey }, '🔍 CHECK-COMPLETION: No cached TCC found. Storing partial result.');

      // Save the partial TCC to the cache with a 5-minute expiration
      await kv.set(cacheKey, incomingTcc, { ex: CACHE_EXPIRATION_SECONDS });
      
      // Release the lock so the second agent can proceed with merging
      await kv.del(lockKey);
      logger.info({ jobId, lockKey }, '🔍 CHECK-COMPLETION: Lock released for second agent to proceed.');

      await emitStepProgress(
        jobId,
        'waiting_for_parallel_completion',
        'in_progress',
        'One of two parallel agents has completed. Waiting for the other.',
        incomingTcc
      );

      return NextResponse.json({
        success: true,
        jobId,
        status: 'waiting',
        message: 'Partial result stored. Waiting for the parallel agent to complete.',
      });
    }

  } catch (error) {
    logger.error(
      {
        jobId,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, issues: (error as any).issues }
            : String(error),
      },
      '🔍 CHECK-COMPLETION: Request failed, likely due to validation.',
    );

    // Clean up lock in case of error
    try {
      await kv.del(`tcc-lock:${jobId}`);
    } catch (cleanupError) {
      logger.warn({ jobId, cleanupError }, '🔍 CHECK-COMPLETION: Failed to clean up lock on error');
    }

    return NextResponse.json(
      {
        success: false,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        issues: error instanceof z.ZodError ? error.issues : undefined,
      },
      { status: 400 }, // Use 400 for validation errors
    );
  }
}