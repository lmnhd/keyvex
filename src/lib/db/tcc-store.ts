import { ToolConstructionContext, ToolConstructionContextSchema } from '@/lib/types/product-tool-creation-v2/tcc';

// In-memory store for TCCs during development. Replace with actual DB logic (Vercel KV, Upstash, DynamoDB, etc.)
const tccInMemoryStore: Record<string, ToolConstructionContext> = {};

/**
 * Saves or updates the ToolConstructionContext in the store.
 * @param tcc The ToolConstructionContext object to save.
 * @returns A promise that resolves when the save is complete.
 */
export async function saveTCC(tcc: ToolConstructionContext): Promise<void> {
  console.log(`[TCC_STORE] Saving TCC for jobId: ${tcc.jobId}`);
  try {
    // Validate TCC before saving (optional, but good practice)
    ToolConstructionContextSchema.parse(tcc);
    tccInMemoryStore[tcc.jobId] = JSON.parse(JSON.stringify(tcc)); // Basic deep clone
    console.log(`[TCC_STORE] TCC for jobId: ${tcc.jobId} saved successfully.`);
  } catch (error) {
    console.error(`[TCC_STORE] Error saving TCC for jobId: ${tcc.jobId}`, error);
    throw new Error(`Failed to save TCC: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Retrieves the ToolConstructionContext from the store.
 * @param jobId The job ID of the TCC to retrieve.
 * @returns A promise that resolves with the TCC object, or null if not found.
 */
export async function getTCC(jobId: string): Promise<ToolConstructionContext | null> {
  console.log(`[TCC_STORE] Getting TCC for jobId: ${jobId}`);
  const tcc = tccInMemoryStore[jobId];
  if (tcc) {
    console.log(`[TCC_STORE] TCC for jobId: ${jobId} retrieved successfully.`);
    // Return a deep copy to prevent direct modification of the stored object
    return JSON.parse(JSON.stringify(tcc));
  }
  console.log(`[TCC_STORE] TCC for jobId: ${jobId} not found.`);
  return null;
}

/**
 * Updates specific parts of an existing ToolConstructionContext in the store.
 * @param jobId The job ID of the TCC to update.
 * @param updates A partial TCC object containing the fields to update.
 * @returns A promise that resolves with the updated TCC object, or null if not found.
 * @throws Error if the TCC is not found or if the update fails schema validation.
 */
export async function updateTCC(jobId: string, updates: Partial<ToolConstructionContext>): Promise<ToolConstructionContext | null> {
  console.log(`[TCC_STORE] Updating TCC for jobId: ${jobId}`);
  const existingTCC = tccInMemoryStore[jobId];
  if (!existingTCC) {
    console.error(`[TCC_STORE] Error updating TCC: JobId ${jobId} not found.`);
    throw new Error(`Cannot update TCC: JobId ${jobId} not found.`);
  }

  // Create a new object with updates applied
  const updatedTCCData = { ...existingTCC, ...updates, updatedAt: new Date().toISOString() };
  
  try {
    // Validate the entire updated object before saving
    ToolConstructionContextSchema.parse(updatedTCCData);
    tccInMemoryStore[jobId] = JSON.parse(JSON.stringify(updatedTCCData)); // Basic deep clone
    console.log(`[TCC_STORE] TCC for jobId: ${jobId} updated successfully.`);
    return tccInMemoryStore[jobId];
  } catch (error) {
    console.error(`[TCC_STORE] Error validating or saving updated TCC for jobId: ${jobId}`, error);
    throw new Error(`Failed to update TCC: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Optional: Function to delete a TCC (e.g., for cleanup)
export async function deleteTCC(jobId: string): Promise<void> {
  console.log(`[TCC_STORE] Deleting TCC for jobId: ${jobId}`);
  if (tccInMemoryStore[jobId]) {
    delete tccInMemoryStore[jobId];
    console.log(`[TCC_STORE] TCC for jobId: ${jobId} deleted successfully.`);
  } else {
    console.log(`[TCC_STORE] TCC for jobId: ${jobId} not found, nothing to delete.`);
  }
} 