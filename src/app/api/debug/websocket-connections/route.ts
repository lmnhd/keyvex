import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'debug-user-123';
    
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
    
    // Query for specific user connections
    const userConnections = await docClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `USER#${userId}`,
      },
    }));
    
    // Scan for all connection records (limited)
    const allConnections = await docClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'CONNECTION#',
      },
      Limit: 10, // Limit to avoid large scans
    }));
    
    return NextResponse.json({
      success: true,
      queriedUserId: userId,
      queryKey: `USER#${userId}`,
      tableName,
      userConnections: {
        count: userConnections.Items?.length || 0,
        items: userConnections.Items || []
      },
      allConnections: {
        count: allConnections.Items?.length || 0,
        items: allConnections.Items || []
      },
      environment: {
        AWS_REGION: process.env.AWS_REGION,
        DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME,
        hasAwsCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 