import { NextRequest, NextResponse } from 'next/server';
import { designStateLogic } from './core-logic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await designStateLogic({
      jobId: body.jobId,
      selectedModel: body.selectedModel
    });

    if (result.success) {
      // SUCCESS: Trigger check for parallel completion instead of directly triggering JSX agent
      const baseUrl = request.nextUrl.origin;
      
      // Check if parallel step completion allows proceeding to next step
      checkParallelCompletion(baseUrl, body.jobId).catch(error => {
        console.error(`[StateDesign] Failed to check parallel completion for jobId ${body.jobId}:`, error);
      });

      return NextResponse.json({
        success: true,
        stateLogic: result.stateLogic,
        message: 'State logic designed successfully'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[StateDesign] Route error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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

    console.log(`[StateDesign] Successfully triggered parallel completion check for jobId: ${jobId}`);
  } catch (error) {
    console.error(`[StateDesign] Failed to check parallel completion:`, error);
    throw error;
  }
}
