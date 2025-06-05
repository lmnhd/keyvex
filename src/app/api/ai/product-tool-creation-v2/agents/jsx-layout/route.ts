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
      // SUCCESS: Return to client immediately to avoid Vercel timeouts
      // The orchestration client will determine next steps based on TCC state
      return NextResponse.json({
        success: true,
        jsxLayout: result.jsxLayout,
        message: 'JSX layout designed successfully',
        nextStep: 'check_parallel_completion' // Hint for orchestration client
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

// REMOVED: Direct agent-to-agent calls to prevent Vercel timeouts
// All orchestration now handled by client-side coordination