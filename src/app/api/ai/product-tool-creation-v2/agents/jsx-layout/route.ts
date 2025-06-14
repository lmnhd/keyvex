import { NextRequest, NextResponse } from 'next/server';
import { designJsxLayout } from './core-logic';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { z } from 'zod';

// Phase 2: Edit mode schema for agents
const EditModeContextSchema = z.object({
  isEditMode: z.boolean(),
  instructions: z.array(z.object({
    targetAgent: z.string(),
    editType: z.enum(['refine', 'replace', 'enhance']),
    instructions: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    createdAt: z.string(),
  })),
  context: z.string(),
});

// Define the request schema locally - Phase 2: Added edit mode support
const jsxLayoutRequestSchema = z.object({ 
  jobId: z.string().uuid(), 
  selectedModel: z.string().optional(), 
  tcc: z.custom<ToolConstructionContext>().optional(), 
  mockTcc: z.custom<ToolConstructionContext>().optional(),
  // Phase 2: Edit mode context from orchestration
  editMode: EditModeContextSchema.optional(),
});

export async function POST(request: NextRequest) {
  logger.info('🏗️ JSXLayout Route: Route handler started');

  try {
    const body = await request.json();
    const parsedRequest = jsxLayoutRequestSchema.parse(body);
    
    // Detect isolated testing mode - if mockTcc is provided, it's likely an isolated test
    const isIsolatedTest = !!parsedRequest.mockTcc;
    
    // Phase 2: Detect edit mode context
    const isEditMode = parsedRequest.editMode?.isEditMode || false;
    const editInstructions = parsedRequest.editMode?.instructions || [];
    
    logger.info({ 
      jobId: parsedRequest.jobId, 
      selectedModel: parsedRequest.selectedModel,
      isIsolatedTest,
      isEditMode,
      editInstructionsCount: editInstructions.length
    }, '🏗️ JSXLayout API: Request received');

    // Call the core logic with isolated test flag and edit mode context
    const result = await designJsxLayout({
      jobId: parsedRequest.jobId,
      selectedModel: parsedRequest.selectedModel,
      tcc: parsedRequest.tcc, 
      mockTcc: parsedRequest.mockTcc,
      isIsolatedTest,
      // Phase 2: Pass edit mode context to core logic
      editMode: parsedRequest.editMode
    });

    // Skip orchestration triggering during isolated testing
    if (!isIsolatedTest && result.success && result.updatedTcc) {
      logger.info({ jobId: parsedRequest.jobId }, '🏗️ JSXLayout Route: Core logic successful, triggering parallel completion check.');

      // Trigger the next step by calling the centralized orchestrator endpoint
      const triggerUrl = new URL('/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion', request.nextUrl.origin);
      fetch(triggerUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: parsedRequest.jobId,
          tcc: result.updatedTcc,
        }),
      }).catch(error => {
        logger.error({ jobId: parsedRequest.jobId, error: error.message }, '🏗️ JSXLayout Route: Failed to trigger parallel completion check endpoint');
      });
        
      logger.info({ jobId: parsedRequest.jobId }, '🏗️ JSXLayout Route: Successfully triggered parallel completion check.');
    } else if (isIsolatedTest) {
      logger.info({ jobId: parsedRequest.jobId }, '🏗️ JSXLayout Route: ✅ Isolated test mode - skipping parallel completion check');
    }

    // Return appropriate response for isolated vs normal mode
    const responseData: any = result;
    
    if (isIsolatedTest && result.updatedTcc) {
      // Ensure updatedTcc is explicitly included for isolated tests
      responseData.updatedTcc = result.updatedTcc;
      logger.info({ jobId: parsedRequest.jobId }, '🏗️ JSXLayout Route: ✅ Including updatedTcc in isolated test response');
    }

    return NextResponse.json(responseData);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🏗️ JSXLayout Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
