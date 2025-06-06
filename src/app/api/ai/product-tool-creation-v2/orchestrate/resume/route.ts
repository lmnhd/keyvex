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

    // Update TCC to mark orchestration as resumed
    const updatedTCC = await updateTCC(jobId, {
      status: 'in_progress',
      updatedAt: new Date().toISOString()
    });

    // TODO: Trigger the next step in the orchestration
    // This would involve checking the current step and triggering the appropriate agent

    return NextResponse.json({
      success: true,
      message: 'Orchestration resumed successfully',
      jobId,
      status: 'running'
    });

  } catch (error) {
    console.error('Error resuming orchestration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resume orchestration' },
      { status: 500 }
    );
  }
} 