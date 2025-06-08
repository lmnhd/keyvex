import { ToolConstructionContext } from "@/lib/types/product-tool-creation-v2/tcc";
import logger from "@/lib/logger";

/**
 * A non-blocking helper to call the check-parallel-completion endpoint.
 * @param jobId The ID of the current tool creation job.
 * @param tcc The full, updated TCC object from the calling agent.
 */
export async function checkParallelCompletion(
  jobId: string,
  tcc: ToolConstructionContext,
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';

  try {
    logger.info(
      { jobId, baseUrl },
      'Orchestration Helper: Triggering parallel completion check...',
    );

    // This is a fire-and-forget call, so we don't await the response fully
    fetch(
      `${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, tcc }),
      },
    ).catch(fetchError => {
        // Log errors from the fetch call itself, but don't let it crash the caller
        logger.error({jobId, error: fetchError.message}, 'Orchestration Helper: Fetch to check-parallel-completion failed');
    });

  } catch (error) {
    logger.error(
      {
        jobId,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      },
      'Orchestration Helper: Failed to initiate parallel completion check.',
    );
    // Do not re-throw, as this is a non-blocking call
  }
} 