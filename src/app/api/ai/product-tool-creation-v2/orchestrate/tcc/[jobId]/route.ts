import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    logger.warn({ jobId }, '🚫 TCC-GET: TCC store has been deprecated - TCC is now managed via props');

    // TCC store has been deprecated - TCC is now passed as props between agents
    // This endpoint is no longer functional and should not be used
    return NextResponse.json({
      success: false,
      error: 'TCC store has been deprecated. TCC is now managed via props between agents and orchestrator.',
      deprecationNotice: 'This endpoint is no longer functional. Use the TCC props pattern instead.',
      jobId
    }, { status: 410 }); // 410 Gone - resource no longer available

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '🚫 TCC-GET: Error in deprecated endpoint');
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve TCC - endpoint deprecated' },
      { status: 500 }
    );
  }
} 