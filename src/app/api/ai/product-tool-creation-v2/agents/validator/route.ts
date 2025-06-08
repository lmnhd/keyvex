import { NextRequest, NextResponse } from 'next/server';
import { validateComponent } from './core-logic';
import logger from '@/lib/logger';
import { triggerNextOrchestrationStep } from '@/lib/orchestration/trigger-next-step';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    logger.info({ jobId }, '🔍 Validator Route: Received request');

    // Call the pure core logic function
    const result = await validateComponent(body);

    if (!result.success || !result.updatedTcc) {
      logger.error({ jobId, error: result.error }, '🔍 Validator Route: Core logic failed');
      return NextResponse.json(
        { success: false, error: result.error || 'Validation failed in core logic' },
        { status: 500 },
      );
    }

    logger.info({ jobId }, '🔍 Validator Route: Core logic successful, triggering next step.');

    // Trigger the next step in the orchestration with the updated TCC
    await triggerNextOrchestrationStep(
      jobId,
      result.updatedTcc.currentOrchestrationStep,
      result.updatedTcc,
    );
    
    logger.info({ jobId }, '🔍 Validator Route: Successfully triggered next step.');

    return NextResponse.json({
      success: true,
      validationResult: result.validationResult,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      { error: errorMessage, endpoint: request.url },
      '🔍 Validator Route: Unhandled error in route handler',
    );

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
} 