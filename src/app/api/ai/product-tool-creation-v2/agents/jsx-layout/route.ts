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
      // Wait for both parallel agents (State Design + JSX Layout) to complete
      // before triggering the next sequential step (Tailwind Styling Agent)
      const baseUrl = request.nextUrl.origin;
      
      // Check if State Design is also complete, then trigger Tailwind Styling
      checkAndTriggerTailwindStyling(baseUrl, body.jobId, body.selectedModel).catch(error => {
        console.error(`[JSXLayout] Failed to trigger Tailwind Styling Agent for jobId ${body.jobId}:`, error);
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

// Helper function to check if both parallel agents are complete and trigger next step
async function checkAndTriggerTailwindStyling(
  baseUrl: string, 
  jobId: string, 
  selectedModel?: string
): Promise<void> {
  try {
    // TODO: In a production system, we would check the TCC state to see if both
    // State Design and JSX Layout are complete before triggering Tailwind Styling
    // For now, we'll trigger it directly since JSX Layout completion indicates readiness
    
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/agents/tailwind-styling`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobId,
        selectedModel
      }),
    });

    if (!response.ok) {
      throw new Error(`Tailwind Styling Agent responded with status: ${response.status}`);
    }

    console.log(`[JSXLayout] Successfully triggered Tailwind Styling Agent for jobId: ${jobId}`);
  } catch (error) {
    console.error(`[JSXLayout] Failed to trigger Tailwind Styling Agent:`, error);
    throw error;
  }
} 