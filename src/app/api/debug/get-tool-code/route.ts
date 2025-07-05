import { NextRequest, NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb/product-tools';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const userId = searchParams.get('userId') || 'lem1';

    if (!toolId) {
      return NextResponse.json({ error: 'toolId parameter required' }, { status: 400 });
    }

    const toolService = new ProductToolService();
    const tool = await toolService.getProductTool(userId, toolId);

    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    return NextResponse.json({
      toolId: tool.id,
      title: tool.metadata.title,
      componentCode: tool.componentCode,
      codeLength: tool.componentCode?.length || 0,
      hasImports: tool.componentCode?.includes('import ') || false,
      firstLines: tool.componentCode?.split('\n').slice(0, 10) || []
    });

  } catch (error) {
    console.error('Debug get tool code error:', error);
    return NextResponse.json({ error: 'Failed to get tool code' }, { status: 500 });
  }
} 
