import { NextRequest, NextResponse } from 'next/server';
import ProductToolService from '@/lib/db/dynamodb/product-tools';
import { ProductToolDefinition } from '@/lib/types/product-tool';

export async function POST(request: NextRequest) {
  try {
    // Skip auth for development - use hardcoded user ID
    const userId = 'dev-user-123';
    
    const body = await request.json();
    const { toolDefinition } = body as { toolDefinition: ProductToolDefinition };

    if (!toolDefinition) {
      return NextResponse.json({ error: 'Tool definition required' }, { status: 400 });
    }

    const savedTool = await ProductToolService.saveProductTool(toolDefinition, userId);
    return NextResponse.json({ success: true, tool: savedTool });

  } catch (error) {
    console.error('Error saving product tool:', error);
    return NextResponse.json({ error: 'Failed to save tool' }, { status: 500 });
  }
}