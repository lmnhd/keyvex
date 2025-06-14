import { NextRequest, NextResponse } from 'next/server';
import { validateComponent } from './core-logic';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  logger.info('🔍 Validator Route: Route handler started');
  
  try {
    // ADD Zod schema validation:
    const validatorRequestSchema = z.object({
      jobId: z.string(),
      selectedModel: z.string().optional(),
      model: z.string().optional(),                    // ✅ Alternative parameter name
      tcc: z.custom<ToolConstructionContext>().optional(),
      mockTcc: z.custom<ToolConstructionContext>().optional(),
      isIsolatedTest: z.boolean().optional(),
    });

    const body = await request.json();
    const parsedRequest = validatorRequestSchema.parse(body);
    const { jobId, selectedModel, model, tcc, mockTcc, isIsolatedTest } = parsedRequest;
    const effectiveModel = selectedModel || model;    // ✅ Accept both

    // Detect if this is an isolated test
    const isIsolated = isIsolatedTest || !!mockTcc;

    if (!jobId || (!tcc && !mockTcc)) {
      return NextResponse.json(
        { success: false, error: "jobId and either tcc or mockTcc must be provided." },
        { status: 400 }
      );
    }
    
    logger.info({ 
      jobId, 
      isIsolated, 
      selectedModel: effectiveModel 
    }, '🔍 Validator: Request received');
    
    // Call the pure core logic function
    const result = await validateComponent({
      jobId,
      selectedModel: effectiveModel,
      tcc: mockTcc || tcc,
    });

    if (!result.success || !result.updatedTcc) {
      logger.error({ jobId, error: result.error }, '🔍 Validator Route: Core logic failed');
      return NextResponse.json(
        { success: false, error: result.error || 'Validation failed in core logic' },
        { status: 500 },
      );
    }

    // Only trigger next step if NOT in isolated test mode
    if (!isIsolated && result.success && result.updatedTcc) {
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
    } else if (isIsolated) {
      logger.info({ jobId }, '🔍 Validator Route: Isolated test mode - skipping orchestration trigger');
    }

    return NextResponse.json({
      success: true,
      validationResult: result.validationResult,
      ...(isIsolated && { updatedTcc: result.updatedTcc }) // Include TCC in isolated test mode
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