import { NextRequest, NextResponse } from 'next/server';
import ProductToolService from '@/lib/db/dynamodb/product-tools';
import { UpdateProductToolRequest } from '@/lib/types/product-tool';

// ============================================================================
// GET /api/product-tools/[toolId] - Get specific product tool
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { toolId: string } }
) {
  try {
    const { toolId } = params;
    
    if (!toolId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bad Request',
          message: 'Tool ID is required'
        },
        { status: 400 }
      );
    }
    
    const tool = await ProductToolService.getProductTool(toolId);
    
    if (!tool) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Not Found',
          message: 'Product tool not found'
        },
        { status: 404 }
      );
    }
    
    // Record analytics for tool viewing
    const sessionId = request.headers.get('x-session-id') || `session_${Date.now()}`;
    await ProductToolService.recordToolUsage(toolId, sessionId, null);
    
    return NextResponse.json({
      success: true,
      data: tool
    });
    
  } catch (error) {
    console.error('Error getting product tool:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get product tool',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/product-tools/[toolId] - Update product tool
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { toolId: string } }
) {
  try {
    // Note: Auth would be handled by middleware in production
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized',
          message: 'Authentication required'
        },
        { status: 401 }
      );
    }
    
    const { toolId } = params;
    const body: UpdateProductToolRequest = await request.json();
    
    if (!toolId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bad Request',
          message: 'Tool ID is required'
        },
        { status: 400 }
      );
    }
    
    const result = await ProductToolService.updateProductTool(
      toolId,
      body.definition,
      userId
    );
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error updating product tool:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized to update this tool') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden',
          message: error.message
        },
        { status: 403 }
      );
    }
    
    if (error instanceof Error && error.message === 'Product tool not found') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Not Found',
          message: error.message
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update product tool',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
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
    // Note: Auth would be handled by middleware in production
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized',
          message: 'Authentication required'
        },
        { status: 401 }
      );
    }
    
    const { toolId } = params;
    
    if (!toolId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bad Request',
          message: 'Tool ID is required'
        },
        { status: 400 }
      );
    }
    
    await ProductToolService.deleteProductTool(toolId, userId);
    
    return NextResponse.json({
      success: true,
      message: 'Product tool deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting product tool:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized or tool not found') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden',
          message: 'Unauthorized to delete this tool'
        },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete product tool',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 