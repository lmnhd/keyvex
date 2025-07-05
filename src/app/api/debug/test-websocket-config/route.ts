import { NextRequest, NextResponse } from 'next/server';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';

/**
 * Debug endpoint to test WebSocket configuration and message sending
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = 'debug-user-123', jobId = 'test-job-123', testMessage = 'Test progress message' } = body;

    console.log('🔧 [DEBUG] Testing WebSocket configuration...');

    // Test basic configuration check
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL;
    
    const configCheck = {
      AWS_REGION,
      WEBSOCKET_API_URL: WEBSOCKET_API_URL || 'Not Set',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not Set',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not Set',
      DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'Not Set',
    };

    console.log('🔧 [DEBUG] Configuration:', configCheck);

    // Test getUserConnections manually
    let connectionTestResult: any = { error: 'Not tested' };
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
      
      const response = await docClient.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': `USER#${userId}`,
        },
      }));

      connectionTestResult = {
        success: true,
        connectionCount: response.Items?.length || 0,
        connections: response.Items?.map(item => ({
          connectionId: item.connectionId,
          ttl: item.ttl,
          created: item.created
        })) || []
      };
    } catch (error) {
      connectionTestResult = {
        error: error instanceof Error ? error.message : String(error)
      };
    }

    // Test actual progress emission
    let emissionTestResult: any = { error: 'Not tested' };
    try {
      console.log('🔧 [DEBUG] Testing emitStepProgress...');
      await emitStepProgress(
        jobId,
        'planning_function_signatures',
        'in_progress',
        testMessage,
        { userId } // Include userId in details
      );
      emissionTestResult = { success: true };
    } catch (error) {
      emissionTestResult = {
        error: error instanceof Error ? error.message : String(error)
      };
    }

    return NextResponse.json({
      success: true,
      configCheck,
      connectionTestResult,
      emissionTestResult,
      testParams: { userId, jobId, testMessage }
    });

  } catch (error) {
    console.error('🔧 [DEBUG-ERROR]', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'WebSocket Config Test - Use POST with { userId, jobId, testMessage }',
    defaultParams: {
      userId: 'debug-user-123',
      jobId: 'test-job-123',
      testMessage: 'Test progress message'
    }
  });
} 
