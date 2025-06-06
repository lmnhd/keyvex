import { NextRequest, NextResponse } from 'next/server';
import { planFunctionSignatures } from './core-logic';
import { getTCC } from '@/lib/db/tcc-store';

export async function POST(request: NextRequest) {
  console.log('📋 FunctionPlanner Route: ==================== INCOMING REQUEST ====================');
  console.log('📋 FunctionPlanner Route: Request received at:', new Date().toISOString());

  try {
    const body = await request.json();
    
    console.log('📋 FunctionPlanner Route: ✅ Request body parsed:', {
      jobId: body.jobId,
      selectedModel: body.selectedModel || 'default',
      hasJobId: !!body.jobId,
      hasMockTcc: !!body.mockTcc,
      bodyKeys: Object.keys(body)
    });

    // Check if this is a mock testing scenario
    if (body.mockTcc) {
      console.log('📋 FunctionPlanner Route: 🧪 MOCK TESTING MODE DETECTED');
      console.log('📋 FunctionPlanner Route: Using provided mock TCC for testing');
      
      console.log('📋 FunctionPlanner Route: Calling planFunctionSignatures with mock data...');
      const startTime = Date.now();
      const result = await planFunctionSignatures({
        jobId: body.mockTcc.jobId || crypto.randomUUID(),
        selectedModel: body.selectedModel || body.mockTcc.agentModelMapping?.['function-planner'] || 'gpt-4-turbo',
        mockTcc: body.mockTcc
      });
      const duration = Date.now() - startTime;
      
      console.log('📋 FunctionPlanner Route: ✅ Mock testing completed:', {
        success: result.success,
        duration: `${duration}ms`,
        functionSignaturesCount: result.functionSignatures?.length || 0,
        error: result.error || 'none'
      });

      // For mock testing, return immediately without triggering orchestration
      return NextResponse.json({
        success: result.success,
        functionSignatures: result.functionSignatures,
        message: result.success ? 'Function signatures planned successfully (mock mode)' : 'Function planning failed (mock mode)',
        mockMode: true,
        error: result.error
      });
    }

    // Normal orchestration mode
    const result = await planFunctionSignatures({
      jobId: body.jobId,
      selectedModel: body.selectedModel
    });

    if (result.success) {
      // Trigger the next parallel agents (State Design + JSX Layout)
      const baseUrl = request.nextUrl.origin;
      
      // Get TCC to determine which models each agent should use
      const tcc = await getTCC(body.jobId);
      const stateDesignModel = tcc?.agentModelMapping?.['state-design'] || tcc?.selectedModel;
      const jsxLayoutModel = tcc?.agentModelMapping?.['jsx-layout'] || tcc?.selectedModel;
      
      // Trigger both agents in parallel without awaiting
      Promise.all([
        triggerStateDesignAgent(baseUrl, body.jobId, stateDesignModel),
        triggerJsxLayoutAgent(baseUrl, body.jobId, jsxLayoutModel)
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
async function triggerStateDesignAgent(baseUrl: string, jobId: string, selectedModel?: string): Promise<void> {
  const stateAgentUrl = new URL('/api/ai/product-tool-creation-v2/agents/state-design', baseUrl);
  
  try {
    const response = await fetch(stateAgentUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, selectedModel })
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
async function triggerJsxLayoutAgent(baseUrl: string, jobId: string, selectedModel?: string): Promise<void> {
  const jsxAgentUrl = new URL('/api/ai/product-tool-creation-v2/agents/jsx-layout', baseUrl);
  
  try {
    const response = await fetch(jsxAgentUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, selectedModel })
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