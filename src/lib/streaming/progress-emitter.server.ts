/**
 * Server-side WebSocket Progress Emitter
 * Simplified version for real-time progress updates
 */

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
  
  logger.info({ userId, queryKey: `USER#${userId}`, tableName }, 'Querying DynamoDB for user connections')
;
  
  const response = await docClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: {
      ':gsi1pk': `USER#${userId}`,
    },
  }));
  
  // 🔍 ADDED: Detailed logging for DynamoDB query response to investigate Reason #3
  logger.info({
      jobId: 'N/A',
      userId,
      resultCount: response.Items?.length || 0,
      scannedCount: response.ScannedCount,
      rawResponse: response.Items,
  }, '🔍 [DynamoDB-QUERY-RESULT]');

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
  payload: any // Can be ProgressEvent or TCC update
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
    const wsUrl = WEBSOCKET_API_URL?.replace('wss://', '').replace('ws://', '') || '';
    const urlParts = wsUrl.split('/');
    const domainName = urlParts[0];
    const stage = urlParts[1] || process.env.AWS_STAGE || 'dev';
    const callbackUrl = `https://${domainName}/${stage}`;
    
    // 🔍 ADDED: Detailed logging for URL construction to investigate Reason #4
    logger.info({
      jobId,
      envUrl: WEBSOCKET_API_URL,
      parsedWsUrl: wsUrl,
      parsedDomain: domainName,
      parsedStage: stage,
      finalCallbackUrl: callbackUrl
    }, '🔍 [URL-CONSTRUCTION-DETAILS]');

    const apiGwClient = new ApiGatewayManagementApiClient({
      endpoint: callbackUrl,
        region: AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      
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
          Data: JSON.stringify(payload),
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
  
  logger.info({ jobId, stepName, status, message }, '📡 [WEBSOCKET-EMIT-START] Emitting progress event'); 
  
  let userId = details?.userId;
  if (!userId && details?.tcc?.userId) {
    userId = details.tcc.userId;
  }
  
  if (!userId) {
    logger.warn({
      jobId,
    }, '📡 [WEBSOCKET-EMIT-ABORT] No userId found in details (TCC), cannot send WebSocket message');
    return;
  }
  
  const payload = {
    type: 'step_progress',
    jobId,
    stepName: event.stepName,
    status: event.status,
    message: event.message,
    data: event.details,
    timestamp: event.timestamp,
  };
  
  try {
    const success = await sendViaWebSocket(userId, jobId, payload);
    
    if (success) {
      logger.info({ jobId, userId, stepName, status }, '📡 [WEBSOCKET-EMIT-SUCCESS] Successfully sent WebSocket message');
    } else {
      logger.info({ jobId, userId, stepName, status }, '📡 [WEBSOCKET-EMIT-FAIL] Failed to send via AWS WebSocket');
    }
    
  } catch (error) {
    logger.error({ jobId, stepName, status, error: error instanceof Error ? error.message : String(error) }, '📡 [WEBSOCKET-EMIT-FATAL] Unhandled exception in emitStepProgress');
  }
}

/**
* RESTORED: Emit a TCC update event for a specific job.
*/
export async function emitTccUpdate(
jobId: string,
updatedTcc: ToolConstructionContext,
agentType?: string
): Promise<void> {
const userId = updatedTcc.userId;

if (!userId) {
  logger.warn({
    jobId,
    agentType,
  }, '📡 [TCC-EMIT-ABORT] No userId in TCC, cannot send WebSocket message');
  return;
}

const payload = {
  type: 'tcc_update',
  jobId,
  agentType,
  updatedTcc,
  timestamp: new Date().toISOString(),
};

logger.info({ jobId, agentType, userId }, '📊 Emitting TCC update event');

try {
  const success = await sendViaWebSocket(userId, jobId, payload);
  if (success) {
    logger.info({ jobId, userId, agentType }, '📊 Successfully sent TCC update via WebSocket');
  } else {
    logger.warn({ jobId, userId, agentType }, '📊 Failed to send TCC update via WebSocket');
  }
} catch (error) {
  logger.error({
    jobId,
    agentType,
    error: error instanceof Error ? error.message : String(error),
  }, '❌ Fatal error in emitTccUpdate');
}
}