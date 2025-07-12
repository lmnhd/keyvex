import { getTccByJobId } from '@/lib/data/tcc';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/tcc-unified';

export interface GetTccResponse {
  success: boolean;
  tcc?: ToolConstructionContext;
  error?: string;
  /** HTTP status code to be used by the route handler */
  status: number;
}

/**
 * Core business logic for retrieving a Tool Construction Context (TCC) by jobId.
 * This function is framework-agnostic – it does **not** depend on Next.js Response helpers.
 * Route handlers should import and wrap its result in `NextResponse` (or equivalent).
 */
export async function fetchTccByJobId(jobId: string | undefined): Promise<GetTccResponse> {
  if (!jobId) {
    return { success: false, error: 'Job ID is required', status: 400 };
  }

  try {
    const tcc = await getTccByJobId(jobId);

    if (!tcc) {
      return { success: false, error: 'TCC not found', status: 404 };
    }

    return { success: true, tcc, status: 200 };
  } catch (error) {
    logger.error({ error, jobId }, 'Failed to fetch TCC by job ID');
    return { success: false, error: 'Internal Server Error', status: 500 };
  }
}
