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

    // Update TCC to mark orchestration as paused
    const updatedTCC = await updateTCC(jobId, {
      status: 'pending',
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Orchestration paused successfully',
      jobId,
      status: 'paused'
    });

  } catch (error) {
    console.error('Error pausing orchestration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to pause orchestration' },
      { status: 500 }
    );
  }
} 