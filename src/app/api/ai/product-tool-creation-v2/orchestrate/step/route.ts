import { NextRequest, NextResponse } from 'next/server';
import { getTCC, updateTCC } from '@/lib/db/tcc-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get current TCC to determine next step
    const currentTCC = await getTCC(jobId);
    
    if (!currentTCC) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Update TCC to mark as step-forward mode
    const updatedTCC = await updateTCC(jobId, {
      status: 'in_progress',
      updatedAt: new Date().toISOString()
    });

    // TODO: Determine and trigger the next step based on current progress
    // This would involve checking what steps are completed and triggering the next one
    const nextStep = determineNextStep(currentTCC);

    return NextResponse.json({
      success: true,
      message: 'Step forward executed successfully',
      jobId,
      status: 'step-forward',
      nextStep
    });

  } catch (error) {
    console.error('Error stepping forward:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to step forward' },
      { status: 500 }
    );
  }
}

function determineNextStep(tcc: any): string {
  // Simple logic to determine next step
  if (!tcc.definedFunctionSignatures) return 'function-planner';
  if (!tcc.stateLogic) return 'state-design';
  if (!tcc.jsxLayout) return 'jsx-layout';
  if (!tcc.styling) return 'tailwind-styling';
  if (!tcc.assembledComponentCode) return 'component-assembler';
  return 'completed';
} 