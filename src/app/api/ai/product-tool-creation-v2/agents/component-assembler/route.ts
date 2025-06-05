import { NextRequest, NextResponse } from 'next/server';
import { assembleComponent } from './core-logic';
import logger from '@/lib/logger';

// Helper function to check parallel completion (non-blocking)
async function checkParallelCompletion(baseUrl: string, jobId: string) {
  try {
    await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
  } catch (error) {
    // Non-blocking - if it fails, we don't stop the process
    console.error(`[ComponentAssembler] Failed to trigger check-parallel-completion for jobId ${jobId}:`, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    logger.info({ jobId: body.jobId }, '🔧 ComponentAssembler: Route handler started');
    
    const result = await assembleComponent(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Component assembly failed'
      }, { status: 500 });
    }
    
    // SUCCESS: Trigger check for parallel completion 
    const baseUrl = request.nextUrl.origin;
    
    // Check if parallel step completion allows proceeding to next step
    checkParallelCompletion(baseUrl, body.jobId).catch(error => {
      console.error(`[ComponentAssembler] Failed to check parallel completion for jobId ${body.jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      assembledComponent: result.assembledComponent
    });
    
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      endpoint: '/api/ai/product-tool-creation-v2/agents/component-assembler'
    }, '🔧 ComponentAssembler: Route handler error');
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 