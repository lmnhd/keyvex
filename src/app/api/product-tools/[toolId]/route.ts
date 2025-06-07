import { NextRequest, NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb/product-tools';
import { ProductToolDefinition } from '@/lib/types/product-tool';

interface UpdateProductToolRequest {
  definition: ProductToolDefinition;
}

// ============================================================================
// GET /api/product-tools/[toolId] - Get specific product tool
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { toolId: string } }
) {
  try {
    const { toolId } = params;
    const userId = request.headers.get('x-user-id') || 'dev-user-123'; // Fallback for dev

    if (!toolId) {
      return NextResponse.json({ success: false, error: 'Tool ID is required' }, { status: 400 });
    }

    const toolService = new ProductToolService();
    const tool = await toolService.getProductTool(userId, toolId);

    if (!tool) {
      return NextResponse.json({ success: false, error: 'Product tool not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: tool });

  } catch (error) {
    console.error('Error getting product tool:', error);
    return NextResponse.json({ success: false, error: 'Failed to get product tool' }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/product-tools/[toolId] - Delete product tool
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { toolId: string } }
) {
  try {
    const { toolId } = params;
    const userId = request.headers.get('x-user-id') || 'dev-user-123'; // Fallback for dev

    if (!toolId) {
      return NextResponse.json({ success: false, error: 'Tool ID is required' }, { status: 400 });
    }

    const toolService = new ProductToolService();
    await toolService.deleteProductTool(userId, toolId);

    return NextResponse.json({ success: true, message: 'Product tool deleted successfully' });

  } catch (error) {
    console.error('Error deleting product tool:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete product tool' }, { status: 500 });
  }
} 