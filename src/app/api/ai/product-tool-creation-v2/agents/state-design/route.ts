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
      // Trigger the next step (JSX Layout Agent) 
      const baseUrl = request.nextUrl.origin;
      
      // Trigger JSX Layout Agent without awaiting (fire and forget)
      triggerJsxLayoutAgent(baseUrl, body.jobId, body.selectedModel).catch(error => {
        console.error(`[StateDesign] Failed to trigger JSX Layout Agent for jobId ${body.jobId}:`, error);
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

// Helper function to trigger the next agent in the pipeline
async function triggerJsxLayoutAgent(
  baseUrl: string, 
  jobId: string, 
  selectedModel?: string
): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/agents/jsx-layout`, {
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
      throw new Error(`JSX Layout Agent responded with status: ${response.status}`);
    }

    console.log(`[StateDesign] Successfully triggered JSX Layout Agent for jobId: ${jobId}`);
  } catch (error) {
    console.error(`[StateDesign] Failed to trigger JSX Layout Agent:`, error);
    throw error;
  }
}
