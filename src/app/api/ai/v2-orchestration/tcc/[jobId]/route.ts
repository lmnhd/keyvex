import { NextResponse } from 'next/server';
import { fetchTccByJobId } from '../../product-tool-creation-v2/orchestrate/tcc/core-logic';

export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } }
) {
  const result = await fetchTccByJobId(params.jobId);
  return NextResponse.json(result, { status: result.status });
}
