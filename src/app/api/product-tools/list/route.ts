import { NextRequest, NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb/product-tools';
import { requireAuth } from '@/lib/auth/debug';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Environment variable diagnostic check
  const clerkKeyLoaded = !!process.env.CLERK_SECRET_KEY;
  const awsAccessKeyLoaded = false;
  const awsSecretKeyLoaded = false;
  const dbTableNameLoaded = !!process.env.DYNAMODB_TABLE_NAME;

  logger.info({
    clerkKeyLoaded,
    awsAccessKeyLoaded,
    awsSecretKeyLoaded,
    dbTableNameLoaded,
    nodeEnv: process.env.NODE_ENV
  }, '[API /product-tools/list] - Environment Variable Check');

  logger.info('[API /product-tools/list] - Request received.');
  try {
    // Check if userId is provided in query parameters (for client calls)
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');
    
    let userId: string;
    if (queryUserId) {
      // Use provided userId from client
      userId = queryUserId;
      logger.info(`[API /product-tools/list] - Using provided userId: ${userId}`);
    } else {
      // Try to get authenticated user, but allow fallback for testing
      try {
        userId = await requireAuth();
        logger.info(`[API /product-tools/list] - Auth successful for userId: ${userId}`);
      } catch (authError) {
        // Use fallback user ID for testing purposes
        userId = 'lem1'; // Use a consistent test user ID that matches your saved tools
        logger.warn('[API /product-tools/list] - Auth failed, using fallback user ID for testing');
      }
    }

    // Get all tools for the user from DynamoDB
    const toolService = new ProductToolService();
    logger.info('[API /product-tools/list] - ProductToolService instantiated. Calling listUserTools...');
    const tools = await toolService.listUserTools(userId);
    logger.info(`[API /product-tools/list] - listUserTools returned ${tools.length} tools.`);
    
    // Return just the tools array for client compatibility
    return NextResponse.json(tools);
    
  } catch (error) {
    logger.error({ 
        message: 'Error in /api/product-tools/list', 
        error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
        } : JSON.stringify(error)
    }, 'Caught exception in list route handler');

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to list tools from database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 
