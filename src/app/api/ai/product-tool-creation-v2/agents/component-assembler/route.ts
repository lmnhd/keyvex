import { NextRequest, NextResponse } from 'next/server';
import { assembleComponent } from './core-logic';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  logger.info('🔧 ComponentAssembler Route: Route handler started');

  try {
    // ADD Zod schema validation:
    const componentAssemblerRequestSchema = z.object({
      jobId: z.string(),
      selectedModel: z.string().optional(),
      model: z.string().optional(),                    // ✅ Alternative parameter name
      tcc: z.custom<ToolConstructionContext>().optional(),
      mockTcc: z.custom<ToolConstructionContext>().optional(),
      isIsolatedTest: z.boolean().optional(),
      isSequentialMode: z.boolean().optional(),         // ✅ Sequential mode detection (ADD)
    });

    const body = await request.json();
    const parsedRequest = componentAssemblerRequestSchema.parse(body);
    const { jobId, selectedModel, model, tcc, mockTcc, isIsolatedTest, isSequentialMode } = parsedRequest;
    const effectiveModel = selectedModel || model;    // ✅ Accept both

    // Detect if this is an isolated test - check explicit parameter OR mockTcc presence
    const isActuallyIsolatedTest = isIsolatedTest || !!mockTcc;

    if (!jobId || (!tcc && !mockTcc)) {
      return NextResponse.json(
        { success: false, error: "jobId and either tcc or mockTcc must be provided." },
        { status: 400 }
      );
    }

    logger.info({ 
      jobId, 
      isIsolatedTest: isActuallyIsolatedTest, 
      isSequentialMode,
      selectedModel: effectiveModel,
      hasExplicitIsolatedFlag: !!isIsolatedTest,
      hasMockTcc: !!mockTcc
    }, '🔧 ComponentAssembler: Request received with isolation detection');

    // Call the pure core logic function
    const result = await assembleComponent({
      jobId,
      selectedModel: effectiveModel,
      tcc: mockTcc || tcc,
    });
    
    if (!result.success || !result.updatedTcc) {
      logger.error({ jobId, error: result.error }, '🔧 ComponentAssembler Route: Core logic failed');
      return NextResponse.json(
        { success: false, error: result.error || 'Component assembly failed' },
        { status: 500 },
      );
    }

    // Only trigger next step if NOT in isolated test mode AND NOT in sequential mode
    if (!isActuallyIsolatedTest && !isSequentialMode && result.success && result.updatedTcc) {
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
    } else if (isSequentialMode) {
      logger.info({ jobId }, '🔧 ComponentAssembler Route: ✅ Sequential mode - skipping orchestration trigger, orchestrator will handle next step');
    } else if (isActuallyIsolatedTest) {
      logger.info({ jobId }, '🔧 ComponentAssembler Route: ✅ Isolated test mode - NOT triggering next step');
    }

    // ALWAYS return updatedTcc for isolated tests to fix finalization steps bug
    const responseData: any = { 
      success: true, 
      assembledComponent: result.assembledComponent
    };
    
    if (isActuallyIsolatedTest) {
      responseData.updatedTcc = result.updatedTcc;
      logger.info({ jobId }, '🔧 ComponentAssembler Route: ✅ Including updatedTcc in isolated test response');
    }

    return NextResponse.json(responseData);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🔧 ComponentAssembler Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}