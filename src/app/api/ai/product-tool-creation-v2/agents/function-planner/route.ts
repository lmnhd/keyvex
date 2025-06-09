import { NextRequest, NextResponse } from 'next/server';
import { planFunctionSignatures } from './core-logic';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  console.log('📋 FunctionPlanner Route: ==================== INCOMING REQUEST ====================');
  console.log('📋 FunctionPlanner Route: Request received at:', new Date().toISOString());

  try {
    const body: { jobId: string; selectedModel?: string, tcc: ToolConstructionContext, mockTcc?: ToolConstructionContext } = await request.json();
    
    const { jobId, selectedModel, tcc, mockTcc } = body;
    const parsedRequest = { jobId, selectedModel, tcc, mockTcc };
    const isIsolatedTest = !!parsedRequest.mockTcc;

    console.log('📋 FunctionPlanner Route: ✅ Request body parsed:', {
      jobId: jobId,
      selectedModel: selectedModel || 'default',
      hasTcc: !!tcc,
      hasMockTcc: !!mockTcc,
      isIsolatedTest,
      tccStatus: tcc?.status,
      bodyKeys: Object.keys(body)
    });

    if (!jobId || (!tcc && !mockTcc)) {
      throw new Error('jobId and either tcc or mockTcc must be provided in the request body.');
    }

    // Pass the received TCC directly to the core logic
    const result = await planFunctionSignatures({
      jobId,
      selectedModel,
      tcc, // Pass the in-memory TCC
      mockTcc,
      isIsolatedTest
    });

    if (result.success && result.updatedTcc) {
      // Only trigger orchestration if not in isolated test mode
      if (!isIsolatedTest) {
      // Trigger the next parallel agents (State Design + JSX Layout) with the NEW TCC
      const baseUrl = request.nextUrl.origin;
      
      const stateDesignModel = result.updatedTcc.agentModelMapping?.['state-design'] || result.updatedTcc.selectedModel;
      const jsxLayoutModel = result.updatedTcc.agentModelMapping?.['jsx-layout'] || result.updatedTcc.selectedModel;
      
      // Trigger both agents in parallel, passing the updated TCC
      Promise.all([
        triggerStateDesignAgent(baseUrl, jobId, stateDesignModel, result.updatedTcc),
        triggerJsxLayoutAgent(baseUrl, jobId, jsxLayoutModel, result.updatedTcc)
      ]).catch(error => {
        console.error(`[FunctionPlanner] Failed to trigger parallel agents for jobId ${jobId}:`, error);
      });
      } else {
        console.log('📋 FunctionPlanner Route: Isolated test mode - skipping orchestration triggering');
      }

      // Return the function signatures, but not the whole TCC
      return NextResponse.json({
        success: true,
        functionSignatures: result.functionSignatures,
        ...(isIsolatedTest && { updatedTcc: result.updatedTcc }) // Include TCC in isolated test mode
      }, { status: 200 });

    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Planning failed to return an updated TCC.'
      }, { status: 500 });
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
 * Triggers the State Design Agent, passing the full TCC
 */
async function triggerStateDesignAgent(baseUrl: string, jobId: string, selectedModel: string | undefined, tcc: ToolConstructionContext): Promise<void> {
  const stateAgentUrl = new URL('/api/ai/product-tool-creation-v2/agents/state-design', baseUrl);
  
  try {
    const response = await fetch(stateAgentUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, selectedModel, tcc }) // Pass the full TCC object
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
 * Triggers the JSX Layout Agent, passing the full TCC
 */
async function triggerJsxLayoutAgent(baseUrl: string, jobId: string, selectedModel: string | undefined, tcc: ToolConstructionContext): Promise<void> {
  const jsxAgentUrl = new URL('/api/ai/product-tool-creation-v2/agents/jsx-layout', baseUrl);
  
  try {
    const response = await fetch(jsxAgentUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, selectedModel, tcc }) // Pass the full TCC object
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