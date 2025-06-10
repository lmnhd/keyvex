import { NextRequest, NextResponse } from 'next/server';
import { assembleComponent } from './core-logic';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  logger.info('🔧 ComponentAssembler Route: Route handler started');

  try {
    const body: { jobId: string; selectedModel?: string; tcc?: ToolConstructionContext; mockTcc?: ToolConstructionContext; } = await request.json();
    const { jobId, selectedModel, tcc, mockTcc } = body;

    // Detect if this is an isolated test
    const isIsolatedTest = !!mockTcc;

    if (!jobId || (!tcc && !mockTcc)) {
      return NextResponse.json(
        { success: false, error: "jobId and either tcc or mockTcc must be provided." },
        { status: 400 }
      );
    }

    logger.info({ 
      jobId, 
      isIsolatedTest, 
      selectedModel 
    }, '🔧 ComponentAssembler: Request received');

    // Call the pure core logic function
    const result = await assembleComponent({
      jobId,
      selectedModel,
      tcc: mockTcc || tcc,
    });
    
    if (!result.success || !result.updatedTcc) {
      logger.error({ jobId, error: result.error }, '🔧 ComponentAssembler Route: Core logic failed');
      return NextResponse.json(
        { success: false, error: result.error || 'Component assembly failed' },
        { status: 500 },
      );
    }

    // Only trigger next step if NOT in isolated test mode
    if (!isIsolatedTest && result.success && result.updatedTcc) {
      logger.info({ jobId }, '🔧 ComponentAssembler Route: Core logic successful, triggering next step.');

      // Trigger the next step by calling the centralized orchestrator endpoint
      const triggerUrl = new URL('/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step', request.nextUrl.origin);
      fetch(triggerUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          nextStep: result.updatedTcc.currentOrchestrationStep,
          tcc: result.updatedTcc,
        }),
      }).catch(error => {
        logger.error({ jobId, error: error.message }, '🔧 ComponentAssembler Route: Failed to trigger next step orchestration endpoint');
      });
        
      logger.info({ jobId }, '🔧 ComponentAssembler Route: Successfully triggered next step.');
    } else if (isIsolatedTest) {
      logger.info({ jobId }, '🔧 ComponentAssembler Route: ✅ Isolated test mode - NOT triggering next step');
    }

    return NextResponse.json({ 
      success: true, 
      assembledComponent: result.assembledComponent,
      ...(isIsolatedTest && { updatedTcc: result.updatedTcc }) // Include TCC in isolated test mode
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🔧 ComponentAssembler Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}