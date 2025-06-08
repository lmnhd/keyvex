import { NextRequest, NextResponse } from 'next/server';
import { applyStyling } from './core-logic';
import logger from '@/lib/logger';
import { triggerNextOrchestrationStep } from '@/lib/orchestration/trigger-next-step';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  logger.info('🎨 TailwindStyling Route: Route handler started');

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
    const result = await applyStyling({
      jobId,
      selectedModel,
      tcc,
    });

    if (!result.success || !result.updatedTcc) {
      logger.error({ jobId, error: result.error }, '🎨 TailwindStyling Route: Core logic failed');
      return NextResponse.json(
        { success: false, error: result.error || 'Styling application failed' },
        { status: 500 }
      );
    }

    logger.info({ jobId }, '🎨 TailwindStyling Route: Core logic successful, triggering next step.');

    // Trigger the next step using the centralized helper
    await triggerNextOrchestrationStep(
      jobId,
      result.updatedTcc.currentOrchestrationStep,
      result.updatedTcc,
    );
      
    logger.info({ jobId }, '🎨 TailwindStyling Route: Successfully triggered next step.');

    return NextResponse.json({ 
      success: true, 
      styling: result.styling 
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🎨 TailwindStyling Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}