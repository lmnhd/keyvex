import { NextRequest, NextResponse } from 'next/server';
import { V2ToolCreationJobService } from '@/lib/db/dynamodb/v2-tool-creation-jobs';
import { requireAuth } from '@/lib/auth/debug';
import logger from '@/lib/logger';

// ============================================================================
// GET /api/tool-generation/status/[jobId] - Get specific tool generation job
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');

    let userId: string;
    if (queryUserId) {
      userId = queryUserId;
      logger.info({ userId: queryUserId, source: 'query' }, '🔍 Status API: Using userId from query parameter');
    } else {
      userId = await requireAuth();
      logger.info({ userId, source: 'auth' }, '🔍 Status API: Using userId from authentication');
    }

    const { jobId } = await params;

    if (!jobId) {
      logger.warn({ userId }, '🔍 Status API: Job ID is missing');
      return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 });
    }

    logger.info({ jobId, userId }, '🔍 Status API: Fetching job status');

    const jobService = new V2ToolCreationJobService();
    const job = await jobService.getJob(userId, jobId);

    if (!job) {
      logger.warn({ jobId, userId }, '🔍 Status API: Job not found');
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    logger.info({ 
      jobId, 
      userId, 
      status: job.status,
      hasProductToolDefinition: !!job.productToolDefinition,
      hasTcc: !!job.toolConstructionContext
    }, '🔍 Status API: Job found successfully');

    return NextResponse.json(job);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, '🔍 Status API: Error getting tool generation job');
    
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to get tool generation job',
      details: errorMessage
    }, { status: 500 });
  }
}
