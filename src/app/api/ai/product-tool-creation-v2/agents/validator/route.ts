import { NextRequest, NextResponse } from 'next/server';
import { validateComponent } from './core-logic';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  logger.info('🔍 Validator Route: Route handler started');
  
  try {
    const body: { jobId: string; selectedModel?: string; tcc: ToolConstructionContext; } = await request.json();
    const { jobId, tcc } = body;

    if (!jobId || !tcc) {
      return NextResponse.json(
        { success: false, error: "jobId and tcc must be provided." },
        { status: 400 }
      );
    }
    
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
      logger.error({ jobId, error: error.message }, '🔍 Validator Route: Failed to trigger next step orchestration endpoint');
    });

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