import { NextRequest, NextResponse } from 'next/server';
import { finalizeTool } from './core-logic';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    logger.info({ jobId: body.jobId }, '📦 ToolFinalizer: Route handler started');
    
    const result = await finalizeTool(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Tool finalization failed'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      finalToolDefinition: result.finalToolDefinition
    });
    
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      endpoint: '/api/ai/product-tool-creation-v2/agents/tool-finalizer'
    }, '📦 ToolFinalizer: Route handler error');
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 