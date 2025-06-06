import { NextRequest, NextResponse } from 'next/server';
import { getTCC } from '@/lib/db/tcc-store';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Retrieve TCC from store
    const tcc = await getTCC(jobId);

    if (!tcc) {
      return NextResponse.json(
        { success: false, error: 'TCC not found for the given job ID' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tcc,
      jobId
    });

  } catch (error) {
    console.error('Error retrieving TCC:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve TCC' },
      { status: 500 }
    );
  }
} 