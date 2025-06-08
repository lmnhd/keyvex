import { NextRequest, NextResponse } from 'next/server';
import { assembleComponent } from './core-logic';
import logger from '@/lib/logger';
import { triggerNextOrchestrationStep } from '@/lib/orchestration/trigger-next-step';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  logger.info('🔧 ComponentAssembler Route: Route handler started');

  try {
    const body: { jobId: string; selectedModel?: string; tcc: ToolConstructionContext; } = await request.json();
    const { jobId, selectedModel, tcc } = body;

    if (!jobId || !tcc) {
      return NextResponse.json(
        { success: false, error: "jobId and tcc must be provided." },
        { status: 400 }
      );
    }

    // Call the pure core logic function
    const result = await assembleComponent({
      jobId,
      selectedModel,
      tcc,
    });
    
    if (!result.success || !result.updatedTcc) {
      logger.error({ jobId, error: result.error }, '🔧 ComponentAssembler Route: Core logic failed');
      return NextResponse.json(
        { success: false, error: result.error || 'Component assembly failed' },
        { status: 500 },
      );
    }

    logger.info({ jobId }, '🔧 ComponentAssembler Route: Core logic successful, triggering next step.');

    // Trigger the next step using the centralized helper
    await triggerNextOrchestrationStep(
      jobId,
      result.updatedTcc.currentOrchestrationStep,
      result.updatedTcc,
    );
      
    logger.info({ jobId }, '🔧 ComponentAssembler Route: Successfully triggered next step.');

    return NextResponse.json({ 
      success: true, 
      assembledComponent: result.assembledComponent 
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🔧 ComponentAssembler Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}