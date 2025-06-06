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
  console.log('🔧 ComponentAssembler Route: ==================== INCOMING REQUEST ====================');
  console.log('🔧 ComponentAssembler Route: Request received at:', new Date().toISOString());

  try {
    const body = await request.json();
    
    console.log('🔧 ComponentAssembler Route: ✅ Request body parsed:', {
      jobId: body.jobId,
      selectedModel: body.selectedModel || 'default',
      hasJobId: !!body.jobId,
      hasMockTcc: !!body.mockTcc,
      bodyKeys: Object.keys(body)
    });

    // Check if this is a mock testing scenario
    if (body.mockTcc) {
      console.log('🔧 ComponentAssembler Route: 🧪 MOCK TESTING MODE DETECTED');
      console.log('🔧 ComponentAssembler Route: Using provided mock TCC for testing');
      
      console.log('🔧 ComponentAssembler Route: Calling assembleComponent with mock data...');
      const startTime = Date.now();
      const result = await assembleComponent({
        ...body,
        mockTcc: body.mockTcc
      });
      const duration = Date.now() - startTime;
      
      console.log('🔧 ComponentAssembler Route: ✅ Mock testing completed:', {
        success: result.success,
        duration: `${duration}ms`,
        hasAssembledComponent: !!result.assembledComponent,
        error: result.error || 'none'
      });

      // For mock testing, return immediately without triggering orchestration
      return NextResponse.json({
        success: result.success,
        assembledComponent: result.assembledComponent,
        message: result.success ? 'Component assembled successfully (mock mode)' : 'Component assembly failed (mock mode)',
        mockMode: true,
        error: result.error
      });
    }

    // Normal orchestration mode
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