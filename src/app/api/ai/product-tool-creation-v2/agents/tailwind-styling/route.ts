import { NextRequest, NextResponse } from 'next/server';
import { applyStyling } from './core-logic';
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

// Define the request schema locally since it's not exported from core-logic
const tailwindStylingRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  model: z.string().optional(), // Alternative model field name
  tcc: z.custom<ToolConstructionContext>().optional(), // For orchestration calls
  mockTcc: z.custom<ToolConstructionContext>().optional(), // For isolated testing
  editMode: EditModeContextSchema.optional(), // Phase 2: Edit mode context (legacy)
  isEditMode: z.boolean().optional(), // Simple edit mode flag
  editInstructions: z.string().optional(), // Simple edit instructions
  isSequentialMode: z.boolean().optional(), // ✅ Sequential mode detection (ADD)
});

export async function POST(request: NextRequest) {
  logger.info('🎨 TailwindStyling Route: Route handler started');

  try {
    const body = await request.json();
    const parsedRequest = tailwindStylingRequestSchema.parse(body);
    
    // Detect isolated testing mode - if mockTcc is provided, it's likely an isolated test
    const isIsolatedTest = !!parsedRequest.mockTcc;
    const isSequentialMode = parsedRequest.isSequentialMode || false;
    
    // Phase 2: Edit mode detection (support both legacy and simple modes)
    const isEditMode = parsedRequest.isEditMode || parsedRequest.editMode?.isEditMode || false;
    const editInstructions = parsedRequest.editInstructions || parsedRequest.editMode?.instructions || [];

    logger.info({ 
      jobId: parsedRequest.jobId, 
      selectedModel: parsedRequest.selectedModel,
      isIsolatedTest,
      isSequentialMode,
      isEditMode,
      editInstructionsCount: editInstructions.length
    }, '🎨 TailwindStyling API: Request received');

    // Call the core logic with both tcc and mockTcc and edit mode context
    const result = await applyStyling({
      jobId: parsedRequest.jobId,
      selectedModel: parsedRequest.selectedModel || parsedRequest.model,
      tcc: parsedRequest.tcc, // Pass tcc from orchestration
      mockTcc: parsedRequest.mockTcc, // Pass mockTcc for isolated testing
      isIsolatedTest,
      editMode: parsedRequest.editMode, // Phase 2: Pass edit mode context (legacy)
      isEditMode, // Simple edit mode flag
      editInstructions: typeof editInstructions === 'string' ? editInstructions : undefined // Simple edit instructions
    });

    // Skip orchestration triggering during isolated testing AND sequential mode
    if (!isIsolatedTest && !isSequentialMode && result.success && result.updatedTcc) {
      logger.info({ jobId: parsedRequest.jobId }, '🎨 TailwindStyling Route: Core logic successful, triggering next step.');
    // Trigger the next step by calling the centralized orchestrator endpoint
    const triggerUrl = new URL('/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step', request.nextUrl.origin);
    fetch(triggerUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          jobId: parsedRequest.jobId,
        nextStep: result.updatedTcc.currentOrchestrationStep,
        tcc: result.updatedTcc,
      }),
    }).catch(error => {
        logger.error({ jobId: parsedRequest.jobId, error: error.message }, '🎨 TailwindStyling Route: Failed to trigger next step orchestration endpoint');
    });
      
      logger.info({ jobId: parsedRequest.jobId }, '🎨 TailwindStyling Route: Successfully triggered next step.');
    } else if (isSequentialMode) {
      logger.info({ jobId: parsedRequest.jobId }, '🎨 TailwindStyling Route: ✅ Sequential mode - skipping orchestration trigger, orchestrator will handle next step');
    } else if (isIsolatedTest) {
      logger.info({ jobId: parsedRequest.jobId }, '🎨 TailwindStyling Route: Isolated test mode - skipping orchestration trigger');
    }

    // Return appropriate response for isolated vs normal mode
    const responseData: any = result;
    
    if ((isIsolatedTest || isSequentialMode) && result.updatedTcc) {
      // Ensure updatedTcc is explicitly included for isolated tests and sequential mode
      responseData.updatedTcc = result.updatedTcc;
      logger.info({ jobId: parsedRequest.jobId }, `🎨 TailwindStyling Route: ✅ Including updatedTcc in ${isIsolatedTest ? 'isolated test' : 'sequential'} response`);
    }

    return NextResponse.json(responseData);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🎨 TailwindStyling Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}