import { NextRequest, NextResponse } from 'next/server';
import { V2ToolCreationJobService } from '@/lib/db/dynamodb/v2-tool-creation-jobs';
import { requireAuth } from '@/lib/auth/debug';

// ============================================================================
// GET /api/tool-generation/status/[jobId] - Get specific tool generation job
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');

    
    let userId: string;
    if (queryUserId) {
      userId = queryUserId;
    } else {
      userId = await requireAuth();
    }

    const { jobId } = await params;

    //return NextResponse.json({success: true, jobId, userId})

    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 });
    }

    try{
      const jobService = new V2ToolCreationJobService();
      const job = await jobService.getJob(userId, jobId);
  
      if (!job) {
        return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
      }
  
      return NextResponse.json(job);
    } catch(err) {
      console.error(err)
      
    }
    
    return NextResponse.json({success: false})
  } catch (error) {
    console.error('Error getting tool generation job:', error);
    return NextResponse.json({ success: false, error: 'Failed to get tool generation job' }, { status: 500 });
  }
}
