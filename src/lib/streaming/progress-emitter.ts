// File Path: keyvex_app/src/lib/streaming/progress-emitter.ts
import { ProgressEvent } from '@/lib/types/tcc-unified';

// In-memory WebSocket store for development fallback ONLY.
// This is used by the useToolGenerationStream hook if a real WebSocket connection cannot be made.
const progressListeners = new Map<string, Array<(event: ProgressEvent & { jobId: string }) => void>>();

/**
 * Subscribe to progress updates for a specific job (IN-MEMORY FALLBACK).
 * This allows the frontend to receive progress updates when a real WebSocket is not available.
 * NOTE: This does NOT communicate with the server. It only works if the emitting code
 * is running in the same memory space (i.e., browser-based testing without a backend).
 */
export function subscribeToProgress(jobId: string, callback: (event: ProgressEvent & { jobId: string }) => void): () => void {
  console.log(`[FALLBACK] Subscribing to progress for job: ${jobId}`);
  
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
 * Emit a progress event for a specific job to all subscribers (IN-MEMORY FALLBACK).
 * NOTE: This is intended for client-side testing only where there is no backend.
 * The real server-side emitter is in `progress-emitter.server.ts`.
 */
export async function emitLocalProgress(
  jobId: string,
  eventData: Partial<ProgressEvent>
): Promise<void> {
    const event: ProgressEvent = {
        stepName: eventData.stepName || 'local_update',
        status: eventData.status || 'in_progress',
        message: eventData.message || 'Local progress update',
        details: eventData.details,
        timestamp: new Date().toISOString()
    };

    const listeners = progressListeners.get(jobId);
    if (listeners && listeners.length > 0) {
      console.log(`[FALLBACK] Broadcasting to ${listeners.length} local subscribers for ${jobId}`);
      listeners.forEach(cb => {
        try {
          cb({ ...event, jobId });
        } catch (error) {
          console.error('[FALLBACK] Error calling progress listener:', error);
        }
      });
    }
}
