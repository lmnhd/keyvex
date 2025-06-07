import { NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb/product-tools';
import { requireAuth } from '@/lib/auth/debug';

export async function GET() {
  try {
    const userId = await requireAuth();

    // Get all tools for the user from DynamoDB
    const toolService = new ProductToolService();
    const tools = await toolService.listUserTools(userId);
    
    return NextResponse.json({
      success: true,
      tools,
      count: tools.length
    });
    
  } catch (error) {
    console.error('Error listing tools:', error);
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