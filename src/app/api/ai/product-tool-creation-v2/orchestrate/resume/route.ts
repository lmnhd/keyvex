import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStatusEnum } from '@/lib/types/tcc-unified';
import logger from '@/lib/logger';

const ResumeRequestSchema = z.object({
  jobId: z.string().uuid(),
  tcc: z.custom<ToolConstructionContext>(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, tcc } = ResumeRequestSchema.parse(body);

    if (!tcc) {
      return NextResponse.json(
        { success: false, error: 'TCC object is required - TCC store has been deprecated' },
        { status: 400 }
      );
    }

    logger.info({ jobId, currentStep: tcc.currentOrchestrationStep }, '⏯️ RESUME: Resuming orchestration');

    // Update TCC to mark orchestration as resumed
    const updatedTCC: ToolConstructionContext = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString()
    };

    // TODO: Trigger the next step in the orchestration
    // This would involve checking the current step and triggering the appropriate agent
    // For now, we just return the updated TCC for the caller to handle

    logger.info({ jobId, status: updatedTCC.status }, '⏯️ RESUME: Orchestration resumed successfully');

    return NextResponse.json({
      success: true,
      message: 'Orchestration resumed successfully',
      jobId,
      status: 'running',
      updatedTcc: updatedTCC
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '⏯️ RESUME: Error resuming orchestration');
    return NextResponse.json(
      { success: false, error: 'Failed to resume orchestration' },
      { status: 500 }
    );
  }
} 
