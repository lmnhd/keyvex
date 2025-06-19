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
    // ADD Zod schema validation:
    const functionPlannerRequestSchema = z.object({
      jobId: z.string(),
      selectedModel: z.string().optional(),
      model: z.string().optional(),                    // ✅ Alternative parameter name
      tcc: z.custom<ToolConstructionContext>().optional(),
      mockTcc: z.custom<ToolConstructionContext>().optional(),
      editMode: EditModeContextSchema.optional(),
      isEditMode: z.boolean().optional(),              // ✅ Simple edit mode
      editInstructions: z.string().optional(),         // ✅ Simple edit mode
      isIsolatedTest: z.boolean().optional(),
      // ✅ SEQUENTIAL MODE FIX: Prevent auto-triggering when orchestrator controls flow
      isSequentialMode: z.boolean().optional(),
    });

    const body = await request.json();
    const parsedRequest = functionPlannerRequestSchema.parse(body);
    const { jobId, selectedModel, model, tcc, mockTcc, editMode, isEditMode, editInstructions, isIsolatedTest, isSequentialMode } = parsedRequest;
    const effectiveModel = selectedModel || model;    // ✅ Accept both
    
    // Phase 2: Edit mode handling - merge simple and complex edit modes
    const isEditModeActive = isEditMode || editMode?.isEditMode || false;
    const editInstructionsArray = editInstructions ? [editInstructions] : (editMode?.instructions || []);
    const isIsolatedTestActive = isIsolatedTest || !!mockTcc;

    console.log('📋 FunctionPlanner Route: ✅ Request body parsed:', {
      jobId: jobId,
      selectedModel: effectiveModel || 'default',
      hasTcc: !!tcc,
      hasMockTcc: !!mockTcc,
      isIsolatedTest: isIsolatedTestActive,
      tccStatus: tcc?.status,
      bodyKeys: Object.keys(body)
    });

    if (!jobId || (!tcc && !mockTcc)) {
      throw new Error('jobId and either tcc or mockTcc must be provided in the request body.');
    }

    // Pass the received TCC directly to the core logic
    const result = await planFunctionSignatures({
      jobId,
      selectedModel: effectiveModel,
      tcc, // Pass the in-memory TCC
      mockTcc,
      isIsolatedTest: isIsolatedTestActive,
      editMode: editMode
    });

    if (result.success && result.updatedTcc) {
      // ✅ SEQUENTIAL MODE FIX: Only trigger orchestration if not in sequential or isolated test mode
      if (!isIsolatedTestActive && !isSequentialMode) {
        // Trigger the next parallel agents (State Design + JSX Layout) with the NEW TCC
        const baseUrl = request.nextUrl.origin;
        
        const stateDesignModel = result.updatedTcc.agentModelMapping?.['state-design'] || result.updatedTcc.selectedModel;
        const jsxLayoutModel = result.updatedTcc.agentModelMapping?.['jsx-layout'] || result.updatedTcc.selectedModel;
        
        // Trigger both agents in parallel, passing the updated TCC
        Promise.all([
          triggerStateDesignAgent(baseUrl, jobId, stateDesignModel, result.updatedTcc),
          triggerJsxLayoutAgent(baseUrl, jobId, jsxLayoutModel, result.updatedTcc)
        ]).catch(error => {
          console.error(`[FunctionPlanner] Failed to trigger parallel agents for jobId ${jobId}:`, error);
        });
      } else {
        console.log('📋 FunctionPlanner Route: Sequential/isolated test mode - orchestrator controls flow');
      }

      // ✅ SEQUENTIAL MODE FIX: Always return updated TCC to orchestrator
      return NextResponse.json({
        success: true,
        functionSignatures: result.functionSignatures,
        updatedTcc: result.updatedTcc // Always include updated TCC
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

/**
 * Triggers the State Design Agent, passing the full TCC
 */
async function triggerStateDesignAgent(baseUrl: string, jobId: string, selectedModel: string | undefined, tcc: ToolConstructionContext): Promise<void> {
  const stateAgentUrl = new URL('/api/ai/product-tool-creation-v2/agents/state-design', baseUrl);
  
  try {
    const response = await fetch(stateAgentUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, selectedModel, tcc }) // Pass the full TCC object
    });

    if (!response.ok) {
      throw new Error(`State agent responded with status: ${response.status}`);
    }

    console.log(`📋 FunctionPlanner Route: Successfully triggered State Design Agent for jobId: ${jobId}`);
    
  } catch (error) {
    console.error(`📋 FunctionPlanner Route: Failed to trigger State Design Agent for jobId ${jobId}:`, error);
    throw error;
  }
}

/**
 * Triggers the JSX Layout Agent, passing the full TCC
 */
async function triggerJsxLayoutAgent(baseUrl: string, jobId: string, selectedModel: string | undefined, tcc: ToolConstructionContext): Promise<void> {
  const jsxAgentUrl = new URL('/api/ai/product-tool-creation-v2/agents/jsx-layout', baseUrl);
  
  try {
    const response = await fetch(jsxAgentUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, selectedModel, tcc }) // Pass the full TCC object
    });

    if (!response.ok) {
      throw new Error(`JSX Layout agent responded with status: ${response.status}`);
    }

    console.log(`📋 FunctionPlanner Route: Successfully triggered JSX Layout Agent for jobId: ${jobId}`);
    
  } catch (error) {
    console.error(`📋 FunctionPlanner Route: Failed to trigger JSX Layout Agent for jobId ${jobId}:`, error);
    throw error;
  }
}