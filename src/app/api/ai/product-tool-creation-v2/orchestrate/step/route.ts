import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStatusEnum, isAgentInEditMode, getActiveEditInstructions } from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

const StepRequestSchema = z.object({
  jobId: z.string().uuid(),
  tcc: z.custom<ToolConstructionContext>(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, tcc } = StepRequestSchema.parse(body);

    if (!tcc) {
      return NextResponse.json(
        { success: false, error: 'TCC object is required - TCC store has been deprecated' },
        { status: 400 }
      );
    }

    logger.info({ jobId, currentStep: tcc.currentOrchestrationStep }, '👣 STEP: Stepping forward in orchestration');

    // Update TCC to mark as step-forward mode
    const updatedTCC: ToolConstructionContext = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString()
    };

    // Determine and trigger the next step based on current progress
    const nextStep = determineNextStep(tcc);

    logger.info({ jobId, nextStep }, '👣 STEP: Next step determined');

    return NextResponse.json({
      success: true,
      message: 'Step forward executed successfully',
      jobId,
      status: 'step-forward',
      nextStep,
      updatedTcc: updatedTCC
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '👣 STEP: Error stepping forward');
    return NextResponse.json(
      { success: false, error: 'Failed to step forward' },
      { status: 500 }
    );
  }
}

function determineNextStep(tcc: ToolConstructionContext): string {
  // Phase 2: Check for edit mode first - prioritize pending edits
  if (tcc.editModeContext?.isEditMode && tcc.editModeContext.activeEditInstructions) {
    // Find the highest priority edit instruction
    const sortedInstructions = tcc.editModeContext.activeEditInstructions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    const highestPriorityInstruction = sortedInstructions[0];
    
    // Map agent names to orchestration steps
    const agentToStepMap: Record<string, string> = {
      'function-planner': 'planning_function_signatures',
      'state-design': 'designing_state_logic', 
      'jsx-layout': 'designing_jsx_layout',
      'tailwind-styling': 'applying_tailwind_styling',
      'component-assembler': 'assembling_component',
      'validator': 'validating_code',
      'tool-finalizer': 'finalizing_tool'
    };
    
    const editStep = agentToStepMap[highestPriorityInstruction.targetAgent];
    if (editStep) {
      logger.info({ 
        jobId: tcc.jobId, 
        editAgent: highestPriorityInstruction.targetAgent,
        editType: highestPriorityInstruction.editType,
        priority: highestPriorityInstruction.priority 
      }, '🔄 EDIT MODE: Routing to agent for editing');
      return editStep;
    }
  }
  
  // Standard creation mode logic - determine next step based on current progress
  if (!tcc.definedFunctionSignatures) return 'planning_function_signatures';
  if (!tcc.stateLogic) return 'designing_state_logic';
  if (!tcc.jsxLayout) return 'designing_jsx_layout';
  if (!tcc.styling) return 'applying_tailwind_styling';
  if (!tcc.assembledComponentCode) return 'assembling_component';
  return 'completed';
} 