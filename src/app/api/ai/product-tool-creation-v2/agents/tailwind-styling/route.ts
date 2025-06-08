import { applyStyling } from './core-logic';
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  console.log('🎨 TailwindStyling Route: ==================== INCOMING REQUEST ====================');
  
  try {
    const body = await request.json();
    const { jobId, selectedModel, mockTcc } = body;

    if (!jobId && !mockTcc) {
      throw new Error("jobId is required for orchestration mode.");
    }
    
    // Asynchronous processing starts here
    // We don't await this call, allowing the response to be sent immediately
    applyStyling({
      jobId: jobId || mockTcc.jobId,
      selectedModel: selectedModel,
      mockTcc: mockTcc
    }).catch(error => {
      // Log errors from the async operation
      logger.error({ 
        jobId: jobId || mockTcc?.jobId,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : String(error),
        agent: 'tailwind-styling'
      }, "🎨 TailwindStyling: Background processing failed");
    });

    console.log(`🎨 TailwindStyling Route: ✅ Task for jobId ${jobId} accepted for background processing.`);
    
    // Immediately return 202 Accepted
    return new NextResponse(JSON.stringify({ 
      success: true, 
      message: 'Styling request accepted and is being processed in the background.' 
    }), { 
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🎨 TailwindStyling Route: ==================== ROUTE ERROR ====================');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, '🎨 TailwindStyling: Route failed to process request.');

    return NextResponse.json({
      success: false,
      error: `Failed to accept styling request: ${errorMessage}`
    }, { status: 400 }); // Bad Request for parsing errors or missing data
  }
}

// Helper function to check parallel completion and trigger next step
async function checkParallelCompletion(
  baseUrl: string, 
  jobId: string
): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      throw new Error(`Check parallel completion responded with status: ${response.status}`);
    }

    logger.info({ jobId }, '🎨 TailwindStyling: Successfully triggered parallel completion check');
  } catch (error) {
    logger.error({ jobId, error }, '🎨 TailwindStyling: Failed to check parallel completion');
    throw error;
  }
}