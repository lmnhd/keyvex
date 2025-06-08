import { NextRequest, NextResponse } from 'next/server';
import { assembleComponent } from './core-logic';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

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
  logger.info('🔧 ComponentAssembler: Route handler started');

  try {
    const body: { jobId: string; selectedModel?: string; tcc: ToolConstructionContext; } = await request.json();
    const { jobId, selectedModel, tcc } = body;

    if (!jobId || !tcc) {
      throw new Error("jobId and tcc must be provided in the request body.");
    }

    const result = await assembleComponent({
      jobId,
      selectedModel,
      tcc, // Pass the in-memory TCC
    });
    
    if (result.success && result.updatedTcc) {
      // Trigger the next step in the orchestration with the new TCC
      await triggerNextOrchestrationStep(request.nextUrl.origin, jobId, result.updatedTcc);
      
      return NextResponse.json({ 
        success: true, 
        assembledComponent: result.assembledComponent 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Component assembly failed to return an updated TCC.'
      }, { status: 500 });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🔧 ComponentAssembler: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// Triggers the main orchestrator to proceed to the next step
async function triggerNextOrchestrationStep(
  baseUrl: string, 
  jobId: string,
  tcc: ToolConstructionContext
): Promise<void> {
  try {
    const nextStep = tcc.currentOrchestrationStep; // The core logic should have set this.
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, nextStep, tcc }), // Pass the full TCC
    });

    if (!response.ok) {
      throw new Error(`Orchestrator responded with status: ${response.status}`);
    }

    logger.info({ jobId, nextStep }, '🔧 ComponentAssembler: Successfully triggered next orchestration step.');
  } catch (error) {
    logger.error({ jobId, error }, '🔧 ComponentAssembler: Failed to trigger next orchestration step.');
    throw error;
  }
} 