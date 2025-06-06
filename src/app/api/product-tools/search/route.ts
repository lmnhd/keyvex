import { NextRequest, NextResponse } from 'next/server';
import { ProductToolService } from '@/lib/db/dynamodb';
import { ProductToolDefinition } from '@/lib/types/product-tool';

// Define missing type
type ProductToolType = string;

// ============================================================================
// GET /api/product-tools/search - Search product tools
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('q');
    if (!query) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bad Request',
          message: 'Search query is required'
        },
        { status: 400 }
      );
    }
    
    // Parse optional filters
    const filters = {
      category: searchParams.get('category') || undefined,
      type: searchParams.get('type') as ProductToolType || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      limit: parseInt(searchParams.get('limit') || '20')
    };
    
    // Use existing methods for search - this is a simplified implementation
    // In a real implementation, you'd want to add a proper search method
    let results = [];
    if (filters.type) {
      results = await ProductToolService.getToolsByType(filters.type, filters.limit);
    } else {
      // Default to published tools
      results = await ProductToolService.getToolsByStatus('published', filters.limit);
    }
    
    // Simple text filtering (in a real app, you'd use proper search)
    if (query) {
      results = results.filter((tool: ProductToolDefinition) => 
        tool.metadata.title.toLowerCase().includes(query.toLowerCase()) ||
        tool.metadata.description.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        query,
        filters,
        results,
        count: results.length
      }
    });
    
  } catch (error) {
    console.error('Error searching product tools:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/product-tools/search - Advanced search with body
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { query, filters = {} } = body;
    
    if (!query) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bad Request',
          message: 'Search query is required'
        },
        { status: 400 }
      );
    }
    
    // Use existing methods for search - this is a simplified implementation
    let results = [];
    if (filters.type) {
      results = await ProductToolService.getToolsByType(filters.type, filters.limit || 20);
    } else {
      // Default to published tools
      results = await ProductToolService.getToolsByStatus('published', filters.limit || 20);
    }
    
    // Simple text filtering
    if (query) {
      results = results.filter((tool: ProductToolDefinition) => 
        tool.metadata.title.toLowerCase().includes(query.toLowerCase()) ||
        tool.metadata.description.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        query,
        filters,
        results,
        count: results.length
      }
    });
    
  } catch (error) {
    console.error('Error in advanced search:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Advanced search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 