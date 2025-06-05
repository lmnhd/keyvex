import { NextRequest, NextResponse } from 'next/server';
import { validateComponent } from './core-logic';
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
    console.error(`[Validator] Failed to trigger check-parallel-completion for jobId ${jobId}:`, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    logger.info({ jobId: body.jobId }, '🔍 Validator: Route handler started');
    
    const result = await validateComponent(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Validation failed'
      }, { status: 500 });
    }
    
    // SUCCESS: Trigger check for parallel completion 
    const baseUrl = request.nextUrl.origin;
    
    // Check if parallel step completion allows proceeding to next step
    checkParallelCompletion(baseUrl, body.jobId).catch(error => {
      console.error(`[Validator] Failed to check parallel completion for jobId ${body.jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      validationResult: result.validationResult
    });
    
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      endpoint: '/api/ai/product-tool-creation-v2/agents/validator'
    }, '🔍 Validator: Route handler error');
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 