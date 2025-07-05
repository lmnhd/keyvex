import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStatusEnum } from '@/lib/types/tcc-unified';
import logger from '@/lib/logger';

const PauseRequestSchema = z.object({
  jobId: z.string().uuid(),
  tcc: z.custom<ToolConstructionContext>(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, tcc } = PauseRequestSchema.parse(body);

    if (!tcc) {
      return NextResponse.json(
        { success: false, error: 'TCC object is required - TCC store has been deprecated' },
        { status: 400 }
      );
    }

    logger.info({ jobId, currentStep: tcc.currentOrchestrationStep }, '⏸️ PAUSE: Pausing orchestration');

    // Update TCC to mark orchestration as paused
    const updatedTCC: ToolConstructionContext = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.pending,
      updatedAt: new Date().toISOString()
    };

    logger.info({ jobId, status: updatedTCC.status }, '⏸️ PAUSE: Orchestration paused successfully');

    return NextResponse.json({
      success: true,
      message: 'Orchestration paused successfully',
      jobId,
      status: 'paused',
      updatedTcc: updatedTCC
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '⏸️ PAUSE: Error pausing orchestration');
    return NextResponse.json(
      { success: false, error: 'Failed to pause orchestration' },
      { status: 500 }
    );
  }
} 
