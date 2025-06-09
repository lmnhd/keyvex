import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
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
  // Simple logic to determine next step
  if (!tcc.definedFunctionSignatures) return 'function-planner';
  if (!tcc.stateLogic) return 'state-design';
  if (!tcc.jsxLayout) return 'jsx-layout';
  if (!tcc.styling) return 'tailwind-styling';
  if (!tcc.assembledComponentCode) return 'component-assembler';
  return 'completed';
} 