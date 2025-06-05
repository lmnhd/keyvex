import { ProgressEvent, ProgressEventSchema, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';

// Re-export for convenience if needed elsewhere, or import directly from tcc.ts
export type { ProgressEvent, OrchestrationStep, OrchestrationStatus } from '@/lib/types/product-tool-creation-v2/tcc';
export { OrchestrationStepEnum as OrchestrationSteps, OrchestrationStatusEnum as OrchestrationStatuses };

/**
 * Emits a progress event.
 * In a production environment, this function would send the event to a message queue (SQS/SNS)
 * which would then be picked up by a WebSocket message forwarder Lambda.
 * For now, it logs to the console.
 *
 * @param jobId The job ID associated with the progress event.
 * @param eventData Data for the progress event.
 */
export async function emitProgress(
  jobId: string,
  eventData: Omit<ProgressEvent, 'timestamp'> // Timestamp will be added by this function
): Promise<void> {
  const timestamp = new Date().toISOString();
  const progressEvent: ProgressEvent = {
    ...eventData,
    timestamp,
  };

  try {
    // Validate the event against the schema before processing
    ProgressEventSchema.parse(progressEvent);
    console.log(`[PROGRESS_EMITTER] JobID [${jobId}]: Step [${progressEvent.stepName}] - Status [${progressEvent.status}] - Message: "${progressEvent.message}"`);
    if (progressEvent.details) {
      console.log(`[PROGRESS_EMITTER] JobID [${jobId}]: Details:`, progressEvent.details);
    }

    // TODO: Replace with actual SQS/SNS publishing logic
    // Example (pseudo-code):
    // const sqsClient = new SQSClient({ region: "your-region" });
    // const command = new SendMessageCommand({
    //   QueueUrl: "your-sqs-queue-url",
    //   MessageBody: JSON.stringify({ jobId, ...progressEvent }),
    //   MessageAttributes: {
    //     JobId: { DataType: "String", StringValue: jobId },
    //     StepName: { DataType: "String", StringValue: progressEvent.stepName },
    //     Status: { DataType: "String", StringValue: progressEvent.status },
    //   }
    // });
    // await sqsClient.send(command);

  } catch (error) {
    console.error(`[PROGRESS_EMITTER] Error emitting progress for JobID [${jobId}]:`, error);
    // Decide on error handling: throw, log, or silent fail for console logging phase
  }
}

// Helper function to quickly emit a simple message for a step
export async function emitStepProgress(
  jobId: string,
  stepName: ProgressEvent['stepName'],
  status: ProgressEvent['status'],
  message: string,
  details?: any
) {
  await emitProgress(jobId, { stepName, status, message, details });
} 