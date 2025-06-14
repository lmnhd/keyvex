import { NextRequest, NextResponse } from 'next/server';
import { planFunctionSignatures } from './core-logic';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { z } from 'zod';

// Phase 2: Edit mode schema for validation
const EditModeContextSchema = z.object({
  isEditMode: z.boolean(),
  instructions: z.array(z.object({
    targetAgent: z.string(),
    editType: z.enum(['refine', 'replace', 'enhance']),
    instructions: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    createdAt: z.string()
  })),
  context: z.string()
}).optional();

export async function POST(request: NextRequest) {
  console.log('📋 FunctionPlanner Route: ==================== INCOMING REQUEST ====================');
  console.log('📋 FunctionPlanner Route: Request received at:', new Date().toISOString());

  try {
    const body: { 
      jobId: string; 
      selectedModel?: string; 
      tcc: ToolConstructionContext; 
      mockTcc?: ToolConstructionContext;
      editMode?: z.infer<typeof EditModeContextSchema>;
    } = await request.json();
    
    const { jobId, selectedModel, tcc, mockTcc, editMode } = body;
    
    // Phase 2: Validate edit mode context if provided
    let validatedEditMode: z.infer<typeof EditModeContextSchema> | undefined;
    if (editMode) {
      try {
        validatedEditMode = EditModeContextSchema.parse(editMode);
        console.log('📋 FunctionPlanner Route: Edit mode validated:', {
          isEditMode: validatedEditMode?.isEditMode,
          instructionCount: validatedEditMode?.instructions?.length || 0
        });
      } catch (error) {
        console.error('📋 FunctionPlanner Route: Edit mode validation failed:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid edit mode context provided' 
        }, { status: 400 });
      }
    }
    
    const parsedRequest = { jobId, selectedModel, tcc, mockTcc, editMode: validatedEditMode };
    const isIsolatedTest = !!parsedRequest.mockTcc;

    console.log('📋 FunctionPlanner Route: ✅ Request body parsed:', {
      jobId: jobId,
      selectedModel: selectedModel || 'default',
      hasTcc: !!tcc,
      hasMockTcc: !!mockTcc,
      isIsolatedTest,
      tccStatus: tcc?.status,
      bodyKeys: Object.keys(body)
    });

    if (!jobId || (!tcc && !mockTcc)) {
      throw new Error('jobId and either tcc or mockTcc must be provided in the request body.');
    }

    // Pass the received TCC directly to the core logic
    const result = await planFunctionSignatures({
      jobId,
      selectedModel,
      tcc, // Pass the in-memory TCC
      mockTcc,
      isIsolatedTest,
      editMode: validatedEditMode
    });

    if (result.success && result.updatedTcc) {
      // Only trigger orchestration if not in isolated test mode
      if (!isIsolatedTest) {
        console.log('📋 FunctionPlanner Route: Core logic successful, triggering next orchestration step.');

        // CRITICAL FIX: Use standard orchestration endpoint like other agents
        const triggerUrl = new URL('/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step', request.nextUrl.origin);
        fetch(triggerUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            nextStep: 'designing_state_logic', // Function planner triggers the parallel state/layout step
            tcc: result.updatedTcc,
          }),
        }).catch(error => {
          console.error(`📋 FunctionPlanner Route: Failed to trigger orchestration endpoint for jobId ${jobId}:`, error);
        });
      } else {
        console.log('📋 FunctionPlanner Route: ✅ Isolated test mode - skipping orchestration triggering');
      }

      // Return the function signatures, but not the whole TCC
      return NextResponse.json({
        success: true,
        functionSignatures: result.functionSignatures,
        ...(isIsolatedTest && { updatedTcc: result.updatedTcc }) // Include TCC in isolated test mode
      }, { status: 200 });

    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Planning failed to return an updated TCC.'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[FunctionPlanner] Route error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}

// REMOVED: Direct agent triggering functions - now using standard orchestration endpoint 