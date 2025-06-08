// File Path: keyvex_app/src/lib/streaming/progress-emitter.server.ts
import {
    ProgressEvent,
    OrchestrationStep,
  } from '@/lib/types/product-tool-creation-v2/tcc';
  import { getTCC } from '@/lib/db/tcc-store';
  import logger from '../logger';
  
  const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL;
  const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  
  /**
   * Check if AWS WebSocket is available
   */
  function isWebSocketAvailable(): boolean {
    const urlAvailable = !!WEBSOCKET_API_URL;
    const accessKeyAvailable = !!process.env.AWS_ACCESS_KEY_ID;
    const secretKeyAvailable = !!process.env.AWS_SECRET_ACCESS_KEY;
    logger.info({
      urlAvailable,
      accessKeyAvailable,
      secretKeyAvailable,
      WEBSOCKET_API_URL: process.env.WEBSOCKET_API_URL || 'Not Set',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not Set',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not Set',
    }, '📡 [AWS-WEBSOCKET-CHECK]');
    return urlAvailable && accessKeyAvailable && secretKeyAvailable;
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
      logger.warn({ jobId }, '📡 [WEBSOCKET-ERROR] AWS WebSocket is not available or not configured. Cannot send message.');
      return false;
    }
  
    try {
        const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
        
        const lambdaClient = new LambdaClient({
          region: AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
  
        const domainName = WEBSOCKET_API_URL?.replace('wss://', '').replace('ws://', '');
        const stage = process.env.AWS_STAGE || 'dev';
        const functionName = process.env.WEBSOCKET_LAMBDA_FUNCTION_NAME || 'websocket-handler';
        
        const payload = {
          type: 'emit_progress',
          userId,
          jobId,
          stepName: event.stepName,
          status: event.status,
          message: event.message,
          data: event.details,
          domainName: domainName,
          stage: stage,
        };
  
        logger.info({ functionName, domainName, stage, jobId }, '📡 [AWS-WEBSOCKET] Preparing to invoke WebSocket Lambda');
  
        const command = new InvokeCommand({
          FunctionName: functionName,
          InvocationType: 'Event', // Async invocation
          Payload: new TextEncoder().encode(JSON.stringify(payload)),
        });
  
        await lambdaClient.send(command);
        logger.info({ jobId }, `📡 [AWS-WEBSOCKET] Successfully invoked WebSocket Lambda`);
        return true;
        
    } catch (error) {
      logger.error({ 
          jobId, 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack'
      }, `📡 [WEBSOCKET-ERROR] WebSocket Lambda invocation failed`);
      return false;
    }
  }
  
  /**
   * Emit a progress event for a specific job.
   * This is the sole entry point for server-side code to send progress updates.
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
  
    // First, try to get userId from TCC store for WebSocket
    let userId: string | undefined;
    try {
      const tcc = await getTCC(jobId);
      if(tcc && tcc.userId) {
        userId = tcc.userId
      } else if (details?.tcc?.userId) {
        userId = details.tcc.userId;
      } else if (details?.userId) {
        userId = details.userId;
      }
      logger.info({ jobId, userId: userId || 'Not Found' }, '📡 [USER-ID-LOOKUP]');
    } catch (error) {
      logger.warn({ jobId, error: error instanceof Error ? error.message : String(error) }, 'Could not determine userId for WebSocket emission from TCC');
    }
  
    if (userId) {
      const sentViaWebSocket = await sendViaWebSocket(userId, jobId, event);
      if (sentViaWebSocket) {
          logger.info({jobId, stepName, status}, '📡 [WEBSOCKET-EMIT] Successfully sent via AWS WebSocket');
      } else {
          logger.warn({ jobId, stepName, status, details: 'Review previous logs for invocation errors or config issues.' }, '📡 [WEBSOCKET-EMIT-FAIL] Failed to send via AWS WebSocket');
      }
    } else {
      logger.warn({
        jobId,
        stepName,
        status,
        warning: 'No userId found in TCC or details, cannot send WebSocket message.'
      }, `📡 [WEBSOCKET-EMIT-ABORT]`);
    }
  }