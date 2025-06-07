import { NextRequest, NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb/product-tools';
import { ProductToolDefinition } from '@/lib/types/product-tool';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tool } = body as { tool: ProductToolDefinition };

    if (!tool) {
      return NextResponse.json({ success: false, error: 'Tool data not provided' }, { status: 400 });
    }

    const toolService = new ProductToolService();
    await toolService.saveProductTool(tool);

    return NextResponse.json({ success: true, message: 'Tool saved successfully' });
  } catch (error) {
    console.error('Error saving product tool:', error);
    return NextResponse.json({ success: false, error: 'Failed to save tool' }, { status: 500 });
  }
}