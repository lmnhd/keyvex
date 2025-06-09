import { NextRequest, NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb/product-tools';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { requireAuth } from '@/lib/auth/debug';

interface UpdateProductToolRequest {
  definition: ProductToolDefinition;
}

// ============================================================================
// GET /api/product-tools/[toolId] - Get specific product tool
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    // Check if userId is provided in query parameters (for client calls)
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');
    
    let userId: string;
    if (queryUserId) {
      // Use provided userId from client
      userId = queryUserId;
    } else {
      // Try to get authenticated user
      userId = await requireAuth();
    }
    
    const { toolId } = await params;

    if (!toolId) {
      return NextResponse.json({ success: false, error: 'Tool ID is required' }, { status: 400 });
    }

    const toolService = new ProductToolService();
    const tool = await toolService.getProductTool(userId, toolId);

    if (!tool) {
      return NextResponse.json({ success: false, error: 'Product tool not found' }, { status: 404 });
    }

    // Return just the tool data for client compatibility
    return NextResponse.json(tool);

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
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    // Check if userId is provided in request body (for client calls)
    let userId: string;
    try {
      const body = await request.json();
      if (body.userId) {
        userId = body.userId;
      } else {
        // Fallback to auth
        userId = await requireAuth();
      }
    } catch {
      // If no body or parsing fails, try auth
      userId = await requireAuth();
    }
    
    const { toolId } = await params;

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