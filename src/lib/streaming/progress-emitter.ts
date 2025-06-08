import { ProgressEvent, ProgressEventSchema, OrchestrationStepEnum, OrchestrationStatusEnum, OrchestrationStep, OrchestrationStatus } from '@/lib/types/product-tool-creation-v2/tcc';

// Re-export for convenience if needed elsewhere, or import directly from tcc.ts
export type { ProgressEvent, OrchestrationStep, OrchestrationStatus } from '@/lib/types/product-tool-creation-v2/tcc';
export { OrchestrationStepEnum as OrchestrationSteps, OrchestrationStatusEnum as OrchestrationStatuses };

// In-memory WebSocket store for development (replace with Redis/SQS in production)
const progressListeners = new Map<string, Array<(event: ProgressEvent & { jobId: string }) => void>>();

// AWS WebSocket configuration
const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * Check if AWS WebSocket is available
 */
function isWebSocketAvailable(): boolean {
  return !!(WEBSOCKET_API_URL && process.env.AWS_ACCESS_KEY_ID);
}

/**
 * Send progress via AWS WebSocket API if available
 */
async function sendViaWebSocket(
  userId: string,
  jobId: string,
  event: ProgressEvent
): Promise<boolean> {
  if (!isWebSocketAvailable()) {
    return false;
  }

  try {
    // Use AWS SDK to invoke the WebSocket Lambda function directly
    if (typeof window === 'undefined') {
      // Server-side: Use AWS SDK
      const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
      
      const lambdaClient = new LambdaClient({
        region: AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const payload = {
        type: 'emit_progress',
        userId,
        jobId,
        stepName: event.stepName,
        status: event.status,
        message: event.message,
        data: event.details,
        domainName: WEBSOCKET_API_URL?.replace('wss://', '').replace('ws://', ''),
        stage: process.env.AWS_STAGE || 'dev',
      };

      const command = new InvokeCommand({
        FunctionName: process.env.WEBSOCKET_LAMBDA_FUNCTION_NAME || 'websocket-handler',
        InvocationType: 'Event', // Async invocation
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
      });

      await lambdaClient.send(command);
      console.log(`📡 [AWS-WEBSOCKET] Successfully invoked WebSocket Lambda for ${jobId}`);
      return true;
      
    } else {
      // Client-side: Cannot use AWS SDK directly, would need to go through API
      console.warn(`📡 [WEBSOCKET-INFO] Client-side WebSocket emission not supported yet`);
      return false;
    }
  } catch (error) {
    console.warn(`📡 [WEBSOCKET-ERROR] WebSocket Lambda invocation failed:`, error);
    return false;
  }
}

/**
 * Subscribe to progress updates for a specific job
 */
export function subscribeToProgress(jobId: string, callback: (event: ProgressEvent & { jobId: string }) => void): () => void {
  console.log(`🔄 [FALLBACK MODE] Subscribing to progress for job: ${jobId}`);
  console.warn('⚠️ [FALLBACK MODE] This is NOT a real WebSocket connection - using in-memory emitter for development');
  
  if (!progressListeners.has(jobId)) {
    progressListeners.set(jobId, []);
  }
  
  progressListeners.get(jobId)!.push(callback);
  
  // Return unsubscribe function
  return () => {
    const listeners = progressListeners.get(jobId);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      if (listeners.length === 0) {
        progressListeners.delete(jobId);
      }
    }
  };
}

/**
 * Emit a progress event for a specific job to all subscribers
 * First tries AWS WebSocket, falls back to in-memory if unavailable
 */
export async function emitStepProgress(
  jobId: string,
  stepName: OrchestrationStep,
  status: 'initiated' | 'started' | 'in_progress' | 'llm_call_pending' | 'llm_data_received' | 'completed' | 'failed' | 'skipped',
  message?: string,
  details?: any
): Promise<void> {
  const event: ProgressEvent = {
    stepName,
    status,
    message: message || 'Progress update',
    details,
    timestamp: new Date().toISOString()
  };

  const eventWithJobId = { ...event, jobId };

  // First, try to get userId from TCC store for WebSocket
  let userId: string | undefined;
  try {
    // Try to extract userId from TCC or context if available
    if (details?.tcc?.userId) {
      userId = details.tcc.userId;
    } else if (details?.userId) {
      userId = details.userId;
    }
    // TODO: Could also look up userId from jobId via TCC store
  } catch (error) {
    console.warn('Could not determine userId for WebSocket emission');
  }

  // Try AWS WebSocket first if userId is available
  let sentViaWebSocket = false;
  if (userId) {
    sentViaWebSocket = await sendViaWebSocket(userId, jobId, event);
  }

  if (sentViaWebSocket) {
    // Successfully sent via AWS WebSocket
    console.log(`📡 [AWS-WEBSOCKET] ${jobId} - ${stepName}: ${status}`, {
      message: event.message,
      details: details ? JSON.stringify(details).substring(0, 200) + '...' : 'none',
      userId
    });
  } else {
    // Fall back to in-memory emitter
    console.log(`📡 [FALLBACK MODE] ${jobId} - ${stepName}: ${status}`, {
      message: `[DEV-FALLBACK] ${event.message}`,
      details: details ? JSON.stringify(details).substring(0, 200) + '...' : 'none',
      warning: 'Using in-memory emitter - not production WebSocket'
    });

    // Broadcast to in-memory listeners
    const listeners = progressListeners.get(jobId);
    if (listeners && listeners.length > 0) {
      console.log(`🔄 [FALLBACK MODE] Broadcasting to ${listeners.length} local subscribers for ${jobId}`);
      listeners.forEach(callback => {
        try {
          callback(eventWithJobId);
        } catch (error) {
          console.error('🔄 [FALLBACK MODE] Error calling progress listener:', error);
        }
      });
    } else {
      console.log(`🔄 [FALLBACK MODE] No local subscribers found for job ${jobId}`);
    }
  }
}

/**
 * Get current connection mode for debugging
 */
export function getConnectionMode(): 'websocket' | 'fallback' | 'unknown' {
  if (isWebSocketAvailable()) {
    return 'websocket';
  } else if (progressListeners.size > 0) {
    return 'fallback';
  } else {
    return 'unknown';
  }
}

/**
 * Get connection status for debugging
 */
export function getConnectionStatus(): {
  mode: 'websocket' | 'fallback' | 'unknown';
  websocketAvailable: boolean;
  activeJobs: string[];
  listenerCount: number;
} {
  return {
    mode: getConnectionMode(),
    websocketAvailable: isWebSocketAvailable(),
    activeJobs: Array.from(progressListeners.keys()),
    listenerCount: Array.from(progressListeners.values()).reduce((total, listeners) => total + listeners.length, 0)
  };
} 