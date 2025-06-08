import { NextRequest, NextResponse } from 'next/server';
import { designStateLogic } from './core-logic';
import logger from '@/lib/logger';
import { checkParallelCompletion } from '@/lib/orchestration/check-parallel-completion';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  logger.info('🎯 StateDesign Route: Route handler started');
  
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
    const result = await designStateLogic({
      jobId,
      selectedModel,
      tcc,
    });

    if (!result.success || !result.updatedTcc) {
      logger.error({ jobId, error: result.error }, '🎯 StateDesign Route: Core logic failed');
      return NextResponse.json(
        { success: false, error: result.error || 'State design failed' },
        { status: 500 }
      );
    }

    logger.info({ jobId }, '🎯 StateDesign Route: Core logic successful, checking parallel completion.');

    // Non-blocking call to the centralized parallel completion checker
    checkParallelCompletion(jobId, result.updatedTcc).catch(error => {
      // Log the error but don't block the response
      logger.error({ jobId, error: error.message }, '🎯 StateDesign Route: Failed to trigger parallel completion check');
    });

    logger.info({ jobId }, '🎯 StateDesign Route: Returning success response.');
    return NextResponse.json({
      success: true,
      stateLogic: result.stateLogic,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🎯 StateDesign Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}