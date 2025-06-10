import { NextRequest, NextResponse } from 'next/server';
import { finalizeTool } from './core-logic';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, selectedModel, tcc, mockTcc, isIsolatedTest } = body;

    // Detect if this is an isolated test
    const isIsolated = isIsolatedTest || !!mockTcc;
    
    logger.info({ 
      jobId, 
      isIsolated, 
      selectedModel 
    }, '📦 ToolFinalizer: Route handler started');
    
    const result = await finalizeTool(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Tool finalization failed'
      }, { status: 500 });
    }
    
    if (isIsolated) {
      logger.info({ jobId }, '📦 ToolFinalizer Route: Isolated test mode - skipping orchestration trigger');
    }
    
    return NextResponse.json({
      success: true,
      finalProduct: result.finalProduct
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