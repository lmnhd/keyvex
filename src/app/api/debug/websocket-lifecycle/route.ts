import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

export async function GET(request: NextRequest) {
  try {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    
    const docClient = DynamoDBDocumentClient.from(dynamoClient);
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    
    if (!tableName) {
      return NextResponse.json({ error: 'DYNAMODB_TABLE_NAME not configured' }, { status: 500 });
    }
    
    // Get all connections with timing analysis
    const allConnections = await docClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'CONNECTION#',
      },
      Limit: 20,
    }));
    
    const now = Math.floor(Date.now() / 1000);
    const nowDate = new Date();
    
    const connectionAnalysis = (allConnections.Items || []).map(item => {
      const connectedAt = new Date(item.connectedAt);
      const ttlTimestamp = item.ttl;
      const ttlDate = new Date(ttlTimestamp * 1000);
      const secondsSinceConnection = Math.floor((nowDate.getTime() - connectedAt.getTime()) / 1000);
      const secondsUntilExpiry = ttlTimestamp - now;
      
      return {
        connectionId: item.connectionId,
        userId: item.userId,
        jobId: item.jobId,
        connectedAt: item.connectedAt,
        connectedAtDate: connectedAt.toISOString(),
        ttl: ttlTimestamp,
        ttlDate: ttlDate.toISOString(),
        secondsSinceConnection,
        secondsUntilExpiry,
        isExpired: secondsUntilExpiry <= 0,
        isValid: secondsUntilExpiry > 0,
        GSI1PK: item.GSI1PK,
        GSI1SK: item.GSI1SK
      };
    });
    
    return NextResponse.json({
      success: true,
      currentTime: {
        iso: nowDate.toISOString(),
        unix: now
      },
      totalConnections: connectionAnalysis.length,
      validConnections: connectionAnalysis.filter(c => c.isValid).length,
      expiredConnections: connectionAnalysis.filter(c => c.isExpired).length,
      connections: connectionAnalysis,
      environment: {
        AWS_REGION: process.env.AWS_REGION,
        DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME,
        hasAwsCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      }
    });
    
  } catch (error) {
    console.error('WebSocket lifecycle debug error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 
