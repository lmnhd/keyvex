import { kv } from '@vercel/kv';
import { ToolConstructionContext } from '@/lib/types/tcc-unified';
import logger from '@/lib/logger';

/**
 * Retrieves the Tool Construction Context (TCC) for a given job ID from Vercel KV.
 * @param jobId The ID of the job to retrieve the TCC for.
 * @returns The TCC object, or null if not found.
 */
export async function getTccByJobId(jobId: string): Promise<ToolConstructionContext | null> {
  try {
    const tcc = await kv.get<ToolConstructionContext>(`tcc:${jobId}`);
    return tcc;
  } catch (error) {
    logger.error({ error, jobId }, 'Failed to retrieve TCC from Vercel KV');
    throw new Error('Could not fetch TCC data.');
  }
}

/**
 * Saves the Tool Construction Context (TCC) for a given job ID to Vercel KV.
 * @param jobId The ID of the job.
 * @param tcc The TCC object to save.
 */
export async function saveTcc(jobId: string, tcc: ToolConstructionContext): Promise<void> {
  try {
    await kv.set(`tcc:${jobId}`, tcc);
  } catch (error) {
    logger.error({ error, jobId }, 'Failed to save TCC to Vercel KV');
    throw new Error('Could not save TCC data.');
  }
}