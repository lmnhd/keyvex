import { NextRequest, NextResponse } from 'next/server';
import { designStateLogic } from './core-logic';
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

const StateDesignRequestSchema = z.object({
  jobId: z.string(),
  selectedModel: z.string().optional(),
  tcc: z.custom<ToolConstructionContext>().optional(),
  mockTcc: z.custom<ToolConstructionContext>().optional(),
  editMode: EditModeContextSchema.optional(),       // ✅ Complex edit mode (existing)
  isEditMode: z.boolean().optional(),               // ✅ Simple edit mode (ADD)
  editInstructions: z.string().optional(),          // ✅ Simple edit mode (ADD)
});

export async function POST(request: NextRequest) {
  logger.info('🎯 StateDesign Route: Route handler started');
  
  try {
    const body = await request.json();
    const { jobId, selectedModel, tcc, mockTcc, editMode, isEditMode, editInstructions } = StateDesignRequestSchema.parse(body);

    // Detect isolated test mode
    const isIsolatedTest = !!mockTcc;

    if (!jobId || (!tcc && !mockTcc)) {
      return NextResponse.json(
        { success: false, error: "jobId and either tcc or mockTcc must be provided." },
        { status: 400 }
      );
    }

    // ADD to both agents' route handlers:
    const isEditModeActive = isEditMode || editMode?.isEditMode || false;
    const editInstructionsArray = editInstructions ? [editInstructions] : (editMode?.instructions || []);

    logger.info({ 
      jobId, 
      selectedModel,
      isEditMode: isEditModeActive,
      editInstructionsCount: editInstructionsArray.length,
      isIsolatedTest
    }, '🎯 StateDesign Route: Request received with isolation detection');
    
    // Call the pure core logic function with edit mode context
    const result = await designStateLogic({
      jobId,
      selectedModel,
      tcc: mockTcc || tcc,
      editMode,
    });

    if (!result.success || !result.updatedTcc) {
      logger.error({ jobId, error: result.error }, '🎯 StateDesign Route: Core logic failed');
      return NextResponse.json(
        { success: false, error: result.error || 'State design failed' },
        { status: 500 }
      );
    }

    // Only trigger orchestration if NOT in isolated test mode
    if (!isIsolatedTest) {
      logger.info({ jobId }, '🎯 StateDesign Route: Core logic successful, checking parallel completion.');

      // Non-blocking call to the centralized parallel completion checker endpoint
      const checkCompletionUrl = new URL('/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion', request.nextUrl.origin);
      fetch(checkCompletionUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              jobId,
              tcc: result.updatedTcc,
          }),
      }).catch(error => {
          logger.error({ jobId, error: error.message }, '🎯 StateDesign Route: Failed to trigger parallel completion check endpoint');
      });
    } else {
      logger.info({ jobId }, '🎯 StateDesign Route: ✅ Isolated test mode - skipping parallel completion check');
    }

    // Return appropriate response for isolated vs normal mode
    const responseData: any = {
      success: true,
      stateLogic: result.stateLogic,
    };

    if (isIsolatedTest) {
      responseData.updatedTcc = result.updatedTcc;
      logger.info({ jobId }, '🎯 StateDesign Route: ✅ Including updatedTcc in isolated test response');
    }

    logger.info({ jobId }, '🎯 StateDesign Route: Returning success response.');
    return NextResponse.json(responseData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🎯 StateDesign Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}