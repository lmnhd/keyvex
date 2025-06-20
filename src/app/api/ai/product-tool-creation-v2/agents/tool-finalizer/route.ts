import { NextRequest, NextResponse } from 'next/server';
import { finalizeTool } from './core-logic';
import { V2ToolCreationJobService } from '@/lib/db/dynamodb/v2-tool-creation-jobs';
import logger from '@/lib/logger';
import { z } from 'zod';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  try {
    // ADD Zod schema validation:
    const toolFinalizerRequestSchema = z.object({
      jobId: z.string(),
      selectedModel: z.string().optional(),
      model: z.string().optional(),                    // ✅ Alternative parameter name
      tcc: z.custom<ToolConstructionContext>().optional(),
      mockTcc: z.custom<ToolConstructionContext>().optional(),
      isIsolatedTest: z.boolean().optional(),
    });

    const body = await request.json();
    const parsedRequest = toolFinalizerRequestSchema.parse(body);
    const { jobId, selectedModel, model, tcc, mockTcc, isIsolatedTest } = parsedRequest;
    const effectiveModel = selectedModel || model;    // ✅ Accept both

    // Detect if this is an isolated test
    const isIsolated = isIsolatedTest || !!mockTcc;
    
    logger.info({ 
      jobId, 
      isIsolated, 
      selectedModel: effectiveModel 
    }, '📦 ToolFinalizer: Route handler started');
    
    const result = await finalizeTool({
      jobId,
      selectedModel: effectiveModel,
      tcc: mockTcc || tcc,
      mockTcc
    });
    
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Tool finalization failed'
      }, { status: 500 });
    }
    
    if (isIsolated) {
      logger.info({ jobId }, '📦 ToolFinalizer Route: Isolated test mode - skipping orchestration trigger');
    }
    
    // Create updatedTcc with the finalProduct included for workbench state updates
    const updatedTcc = {
      ...(mockTcc || tcc),
      finalProduct: result.finalProduct,
      // ✅ SINGLE SOURCE OF TRUTH: Component code only exists in finalProduct.componentCode
      // ❌ REMOVED: assembledComponentCode preservation - no more dual storage!
      // Update status and step
      status: 'completed' as const,
      currentOrchestrationStep: 'finalizing_tool' as const,
      updatedAt: new Date().toISOString()
    };

    // CRITICAL FIX: Update the database with completed job for polling fallback
    if (!isIsolated && jobId && tcc?.userId) {
      try {
        const jobService = new V2ToolCreationJobService();
        await jobService.updateJob(tcc.userId, jobId, {
          status: 'completed',
          toolConstructionContext: updatedTcc,
          productToolDefinition: result.finalProduct,
          updatedAt: Date.now()
        });
        logger.info({ jobId, userId: tcc.userId }, '📦 ToolFinalizer: ✅ Database updated with completed job for polling fallback');
      } catch (dbError) {
        logger.error({ 
          jobId, 
          userId: tcc.userId,
          error: dbError instanceof Error ? dbError.message : String(dbError)
        }, '📦 ToolFinalizer: ⚠️ Failed to update database - polling fallback may not work');
        // Don't fail the request if database update fails
      }
    }

    const responseData: any = {
      success: true,
      finalProduct: result.finalProduct
    };

    // For isolated tests AND regular finalizations, return updatedTcc so workbench state updates properly
    responseData.updatedTcc = updatedTcc;
    logger.info({ jobId }, '📦 ToolFinalizer Route: ✅ Including updatedTcc with finalProduct in response');
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      endpoint: '/api/ai/product-tool-creation-v2/agents/tool-finalizer'
    }, '📦 ToolFinalizer: Route handler error');
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 