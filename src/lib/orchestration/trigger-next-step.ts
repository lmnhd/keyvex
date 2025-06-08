import { OrchestrationStepEnum, ToolConstructionContext } from "@/lib/types/product-tool-creation-v2/tcc";
import logger from "@/lib/logger";
import { z } from "zod";

/**
 * Triggers the trigger-next-step endpoint to move the orchestration forward.
 * @param jobId The ID of the current tool creation job.
 * @param nextStep The next step to trigger in the orchestration.
 * @param tcc The full, updated TCC object to pass along.
 */
export async function triggerNextOrchestrationStep(
  jobId: string,
  nextStep: z.infer<typeof OrchestrationStepEnum>,
  tcc: ToolConstructionContext,
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';

  try {
    logger.info(
      { jobId, baseUrl, nextStep },
      'Orchestration Helper: Triggering next step...',
    );

    const response = await fetch(
      `${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, nextStep, tcc }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Orchestrator responded with status ${response.status}: ${errorBody}`,
      );
    }

    logger.info(
      { jobId },
      'Orchestration Helper: Successfully triggered next step.',
    );
  } catch (error) {
    logger.error(
      {
        jobId,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      },
      'Orchestration Helper: Failed to trigger next step.',
    );
    // Re-throw the error to be handled by the calling agent
    throw error;
  }
} 