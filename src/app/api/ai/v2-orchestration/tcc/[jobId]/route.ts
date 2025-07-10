import { NextResponse } from 'next/server';
import { getTccByJobId } from '@/lib/data/tcc';
import logger from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;

  if (!jobId) {
    return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 });
  }

  try {
    const tcc = await getTccByJobId(jobId);

    if (!tcc) {
      return NextResponse.json({ success: false, error: 'TCC not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, tcc });
  } catch (error) {
    logger.error({ error, jobId }, 'Failed to fetch TCC by job ID');
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
