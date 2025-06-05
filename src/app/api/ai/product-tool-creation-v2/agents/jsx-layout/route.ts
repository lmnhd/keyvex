import { NextRequest, NextResponse } from 'next/server';
import { designJsxLayout } from './core-logic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await designJsxLayout({
      jobId: body.jobId,
      selectedModel: body.selectedModel
    });

    if (result.success) {
      // SUCCESS: Trigger check for parallel completion 
      const baseUrl = request.nextUrl.origin;
      
      // Check if parallel step completion allows proceeding to next step
      checkParallelCompletion(baseUrl, body.jobId).catch(error => {
        console.error(`[JSXLayout] Failed to check parallel completion for jobId ${body.jobId}:`, error);
      });

      return NextResponse.json({
        success: true,
        jsxLayout: result.jsxLayout,
        message: 'JSX layout designed successfully'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[JSXLayout] Route error:', error);
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

    console.log(`[JSXLayout] Successfully triggered parallel completion check for jobId: ${jobId}`);
  } catch (error) {
    console.error(`[JSXLayout] Failed to check parallel completion:`, error);
    throw error;
  }
}

// REMOVED: Direct agent-to-agent calls to prevent Vercel timeouts
// All orchestration now handled by client-side coordination