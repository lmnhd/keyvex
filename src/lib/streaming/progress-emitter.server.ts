import {
    ProgressEvent,
    OrchestrationStep,
  ToolConstructionContext,
  } from '@/lib/types/product-tool-creation-v2/tcc';
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
 * Get WebSocket connection IDs for a user from DynamoDB
 */
async function getUserConnections(userId: string): Promise<string[]> {
  try {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    
    const dynamoClient = new DynamoDBClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    
    const docClient = DynamoDBDocumentClient.from(dynamoClient);
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    
    if (!tableName) {
      logger.warn('DYNAMODB_TABLE_NAME not configured');
      return [];
    }
    
    logger.info({ userId, queryKey: `USER#${userId}`, tableName }, 'Querying DynamoDB for user connections');
 
    const response = await docClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `USER#${userId}`,
      },
    }));
    
    if (!response.Items || response.Items.length === 0) {
      logger.info({ userId }, 'No active WebSocket connections found for user');
      return [];
    }
    
    return response.Items.map(item => item.connectionId).filter(Boolean);
  } catch (error) {
    logger.error({ 
      userId, 
      error: error instanceof Error ? error.message : String(error) 
    }, 'Failed to get user connections from DynamoDB');
    return [];
  }
}

/**
 * Send progress via AWS WebSocket API Gateway Management API
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
      // Get user's WebSocket connection IDs
      const connectionIds = await getUserConnections(userId);
      
      if (connectionIds.length === 0) {
        logger.info({ userId, jobId }, '📡 [WEBSOCKET-INFO] No active connections found for user');
        return false;
      }
      
      const { ApiGatewayManagementApiClient, PostToConnectionCommand } = await import('@aws-sdk/client-apigatewaymanagementapi');
      
      // Extract domain and stage from WebSocket URL
      const domainName = WEBSOCKET_API_URL?.replace('wss://', '').replace('ws://', '');
      const stage = process.env.AWS_STAGE || 'dev';
      const callbackUrl = `https://${domainName}/${stage}`;
      
      const apiGwClient = new ApiGatewayManagementApiClient({
        endpoint: callbackUrl,
          region: AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
  
      const progressMessage = {
        type: 'step_progress',
          jobId,
          stepName: event.stepName,
          status: event.status,
          message: event.message,
          data: event.details,
        timestamp: event.timestamp,
      };

      logger.info({ 
        callbackUrl, 
        connectionCount: connectionIds.length, 
        jobId 
      }, '📡 [AWS-WEBSOCKET] Preparing to send to WebSocket connections');

      // Send to all connections for this user
      const sendPromises = connectionIds.map(async (connectionId) => {
        try {
          await apiGwClient.send(new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify(progressMessage),
          }));
          logger.info({ connectionId, jobId }, '📡 [AWS-WEBSOCKET] Message sent successfully');
          return true;
        } catch (error) {
          logger.error({ 
            connectionId, 
            jobId,
            error: error instanceof Error ? error.message : String(error)
          }, '📡 [WEBSOCKET-ERROR] Failed to send to connection (connection may be stale)');
          return false;
        }
      });

      const results = await Promise.allSettled(sendPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      
      logger.info({ 
        jobId, 
        successCount, 
        totalConnections: connectionIds.length 
      }, `📡 [AWS-WEBSOCKET] Message sending completed`);
      
      return successCount > 0;
        
    } catch (error) {
      logger.error({ 
          jobId, 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack'
    }, `📡 [WEBSOCKET-ERROR] WebSocket message sending failed`);
      return false;
    }
  }
  
  /**
   * Emit a progress event for a specific job.
 * This is the main entry point for sending progress updates.
 * 
 * @param jobId - The job ID
 * @param stepName - The orchestration step
 * @param status - The step status 
 * @param message - Optional message
 * @param details - Optional details object which should contain either userId directly or TCC object
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
  
  // Extract userId from various sources
    let userId: string | undefined;

  logger.info({ jobId, stepName, status, message, details }, '📡 [WEBSOCKET-EMIT-START] Emitting progress event');
  if (!details || !details.userId) {
    // Return early if no userId is found
    return;
  }
  
  try {
    // Priority 1: Direct userId in details
    if (details?.userId) {
      userId = details.userId;
      logger.info({ jobId, userId, source: 'details.userId' }, '📡 [USER-ID-LOOKUP] Found userId in details');
    }
    // Priority 2: TCC object in details
    else if (details?.tcc?.userId) {
        userId = details.tcc.userId;
      logger.info({ jobId, userId, source: 'details.tcc.userId' }, '📡 [USER-ID-LOOKUP] Found userId in TCC from details');
    }
    // Priority 3: Direct TCC object as details
    else if (details?.jobId && details?.userId) {
      // This looks like a TCC object itself
        userId = details.userId;
      logger.info({ jobId, userId, source: 'details as TCC' }, '📡 [USER-ID-LOOKUP] Found userId in details as TCC object');
    }
    else {
      logger.warn({ 
        jobId, 
        hasDetails: !!details,
        detailsKeys: details ? Object.keys(details) : [],
        debugMode: process.env.DISABLE_AUTH_FOR_DEBUG
      }, '📡 [WEBSOCKET-EMIT-ABORT] No userId found, cannot send WebSocket message');
      return;
    }


    // Attempt to send via WebSocket
    const success = await sendViaWebSocket(userId!, jobId, event);
    
    if (success) {
      logger.info({ jobId, userId, stepName, status }, '📡 [WEBSOCKET-EMIT-SUCCESS] Successfully sent WebSocket message');
    } else {
      logger.info({ jobId, userId, stepName, status }, '📡 [WEBSOCKET-EMIT-FAIL] Failed to send via AWS WebSocket');
    }

  } catch (error) {
    logger.error({ 
        jobId,
      error: error instanceof Error ? error.message : String(error),
        stepName,
      status
    }, '📡 [WEBSOCKET-EMIT-ERROR] Error occurred while emitting progress');
  }
}

/**
 * In-memory progress subscriptions for fallback/testing
 */
const progressSubscriptions = new Map<string, ((event: ProgressEvent & { jobId: string }) => void)[]>();

/**
 * Subscribe to progress updates for a specific job (for testing/fallback)
 */
export function subscribeToProgress(
  jobId: string, 
  callback: (event: ProgressEvent & { jobId: string }) => void
): () => void {
  if (!progressSubscriptions.has(jobId)) {
    progressSubscriptions.set(jobId, []);
  }
  
  progressSubscriptions.get(jobId)!.push(callback);
  
  // Return unsubscribe function
  return () => {
    const callbacks = progressSubscriptions.get(jobId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        progressSubscriptions.delete(jobId);
      }
    }
  };
}

/**
 * Emit progress to in-memory subscribers (for testing/fallback)
 */
function emitToSubscribers(jobId: string, event: ProgressEvent): void {
  const callbacks = progressSubscriptions.get(jobId);
  if (callbacks && callbacks.length > 0) {
    const eventWithJobId = { ...event, jobId };
    callbacks.forEach(callback => {
      try {
        callback(eventWithJobId);
      } catch (error) {
        logger.error({ jobId, error }, 'Error in progress subscription callback');
      }
    });
  }
}
