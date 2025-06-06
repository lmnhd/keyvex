import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { ProductToolService } from '@/lib/db/dynamodb';
import { ProductToolDefinition } from '@/lib/types/product-tool';

// Define missing types
type ProductToolStatus = 'draft' | 'published' | 'archived' | 'public';
type ProductToolType = string;

interface CreateProductToolRequest {
  definition: ProductToolDefinition;
}

// ============================================================================
// GET /api/product-tools - List product tools
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const filters = {
      userId: searchParams.get('userId') || undefined,
      status: searchParams.get('status') as ProductToolStatus || undefined,
      type: searchParams.get('type') as ProductToolType || undefined,
      category: searchParams.get('category') || undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    };
    
    // If filtering by user and no userId specified, use current user
    if (searchParams.has('myTools') && user?.id) {
      filters.userId = user.id;
    }
    
    // Use existing method for listing - adjust filters accordingly
    let result;
    if (filters.userId) {
      result = await ProductToolService.listUserTools(filters.userId);
    } else if (filters.status) {
      result = await ProductToolService.getToolsByStatus(filters.status, filters.limit);
    } else if (filters.type) {
      result = await ProductToolService.getToolsByType(filters.type, filters.limit);
    } else {
      // Default to published tools for public browsing
      result = await ProductToolService.getToolsByStatus('published', filters.limit);
    }
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error listing product tools:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to list product tools',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/product-tools - Create new product tool
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user?.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized',
          message: 'Authentication required'
        },
        { status: 401 }
      );
    }
    
    const body: CreateProductToolRequest = await request.json();
    
    // Validate required fields
    if (!body.definition?.metadata?.title) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation Error',
          message: 'Tool title is required'
        },
        { status: 400 }
      );
    }
    
    // Set default values without overwriting existing ones
    const definition = {
      ...body.definition,
      version: body.definition.version || '1.0.0',
      status: body.definition.status || 'draft' as ProductToolStatus
    };
    
    const result = await ProductToolService.saveProductTool(
      definition,
      user.id
    );
    
    return NextResponse.json({
      success: true,
      data: result
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating product tool:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create product tool',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 