import { NextRequest, NextResponse } from 'next/server';
import ProductToolService from '@/lib/db/dynamodb/product-tools';
import { ProductToolType } from '@/lib/types/product-tool';

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
    
    const results = await ProductToolService.searchProductTools(query, filters);
    
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
    
    const results = await ProductToolService.searchProductTools(query, filters);
    
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