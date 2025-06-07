import { NextRequest, NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb/product-tools';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { requireAuth } from '@/lib/auth/debug';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tool } = body as { tool: ProductToolDefinition };

    if (!tool) {
      return NextResponse.json({ success: false, error: 'Tool data not provided' }, { status: 400 });
    }

    // Try to get authenticated user, but allow fallback for testing
    let userId: string;
    try {
      userId = await requireAuth();
      console.log(`[API /product-tools/save] - Auth successful for userId: ${userId}`);
    } catch (authError) {
      // Use fallback user ID for testing purposes
      userId = 'lem1'; // Use a consistent test user ID
      console.warn('[API /product-tools/save] - Auth failed, using fallback user ID for testing');
    }

    // Ensure the tool has the correct createdBy field
    tool.createdBy = userId;

    const toolService = new ProductToolService();
    await toolService.saveProductTool(tool);

    return NextResponse.json({ success: true, message: 'Tool saved successfully' });
  } catch (error) {
    console.error('Error saving product tool:', error);
    return NextResponse.json({ success: false, error: 'Failed to save tool' }, { status: 500 });
  }
}