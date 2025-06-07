import { NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb/product-tools';
import { requireAuth } from '@/lib/auth/debug';
import logger from '@/lib/logger';

export async function GET() {
  logger.info('[API /product-tools/list] - Request received.');
  try {
    const userId = await requireAuth();
    logger.info(`[API /product-tools/list] - Auth successful for userId: ${userId}`);

    // Get all tools for the user from DynamoDB
    const toolService = new ProductToolService();
    logger.info('[API /product-tools/list] - ProductToolService instantiated. Calling listUserTools...');
    const tools = await toolService.listUserTools(userId);
    logger.info(`[API /product-tools/list] - listUserTools returned ${tools.length} tools.`);
    
    return NextResponse.json({
      success: true,
      tools,
      count: tools.length
    });
    
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