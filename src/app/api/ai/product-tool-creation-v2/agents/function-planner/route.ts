import { NextRequest, NextResponse } from 'next/server';
import { planFunctionSignatures } from './core-logic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await planFunctionSignatures({
      jobId: body.jobId,
      selectedModel: body.selectedModel
    });

    if (result.success) {
      // Trigger the next parallel agents (State Design + JSX Layout)
      const baseUrl = request.nextUrl.origin;
      
      // Trigger both agents in parallel without awaiting
      Promise.all([
        triggerStateDesignAgent(baseUrl, body.jobId),
        triggerJsxLayoutAgent(baseUrl, body.jobId)
      ]).catch(error => {
        console.error(`[FunctionPlanner] Failed to trigger parallel agents for jobId ${body.jobId}:`, error);
      });

      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }

  } catch (error) {
    console.error('[FunctionPlanner] Route error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}

/**
 * Triggers the State Design Agent
 */
async function triggerStateDesignAgent(baseUrl: string, jobId: string): Promise<void> {
  const stateAgentUrl = new URL('/api/ai/product-tool-creation-v2/agents/state-design', baseUrl);
  
  try {
    const response = await fetch(stateAgentUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });

    if (!response.ok) {
      throw new Error(`State agent responded with status: ${response.status}`);
    }

    console.log(`[FunctionPlanner] Successfully triggered State Design Agent for jobId: ${jobId}`);
  } catch (error) {
    console.error(`[FunctionPlanner] Failed to trigger State Design Agent:`, error);
    throw error;
  }
}

/**
 * Triggers the JSX Layout Agent  
 */
async function triggerJsxLayoutAgent(baseUrl: string, jobId: string): Promise<void> {
  const jsxAgentUrl = new URL('/api/ai/product-tool-creation-v2/agents/jsx-layout', baseUrl);
  
  try {
    const response = await fetch(jsxAgentUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });

    if (!response.ok) {
      throw new Error(`JSX agent responded with status: ${response.status}`);
    }

    console.log(`[FunctionPlanner] Successfully triggered JSX Layout Agent for jobId: ${jobId}`);
  } catch (error) {
    console.error(`[FunctionPlanner] Failed to trigger JSX Layout Agent:`, error);
    throw error;
  }
} 