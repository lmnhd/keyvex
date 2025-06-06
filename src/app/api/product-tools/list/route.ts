import { NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb/product-tools';

export async function GET() {
  try {
    // For development, we'll use a hardcoded userId
    // In production, this would come from authentication
    const userId = 'dev-user-123';
    
    // Get all tools for the user from DynamoDB
    const tools = await ProductToolService.listUserTools(userId);
    
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