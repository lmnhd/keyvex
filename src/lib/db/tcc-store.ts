import { ToolConstructionContext, ToolConstructionContextSchema } from '@/lib/types/product-tool-creation-v2/tcc';
import fs from 'fs';
import path from 'path';

// In-memory store for TCCs during development. Replace with actual DB logic (Vercel KV, Upstash, DynamoDB, etc.)
const tccInMemoryStore: Record<string, ToolConstructionContext> = {};

// Filesystem fallback for development persistence to handle Next.js hot reload
const TCC_TEMP_DIR = path.join(process.cwd(), '.next', 'tcc-store');

// Ensure temp directory exists
function ensureTempDir() {
  if (!fs.existsSync(TCC_TEMP_DIR)) {
    fs.mkdirSync(TCC_TEMP_DIR, { recursive: true });
  }
}

// Get TCC file path
function getTCCFilePath(jobId: string): string {
  return path.join(TCC_TEMP_DIR, `${jobId}.json`);
}

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
    
    // Save to in-memory store
    tccInMemoryStore[tcc.jobId] = JSON.parse(JSON.stringify(tcc)); // Basic deep clone
    
    // Also save to filesystem for persistence during development
    ensureTempDir();
    const filePath = getTCCFilePath(tcc.jobId);
    fs.writeFileSync(filePath, JSON.stringify(tcc, null, 2), { flag: 'w' });
    
    // Ensure file is fully written (Windows filesystem sync)
    fs.fsyncSync(fs.openSync(filePath, 'r+'));
    
    console.log(`[TCC_STORE] TCC for jobId: ${tcc.jobId} saved successfully (memory + file).`);
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
  console.log(`[TCC_STORE] Available TCC jobIds in store:`, Object.keys(tccInMemoryStore));
  
  // First try in-memory store
  let tcc = tccInMemoryStore[jobId];
  if (tcc) {
    console.log(`[TCC_STORE] TCC for jobId: ${jobId} retrieved from memory.`);
    // Return a deep copy to prevent direct modification of the stored object
    return JSON.parse(JSON.stringify(tcc));
  }
  
  // Fallback to filesystem if not in memory (development hot reload scenario)
  try {
    const filePath = getTCCFilePath(jobId);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      tcc = JSON.parse(fileContent);
      
      // Validate the loaded TCC
      ToolConstructionContextSchema.parse(tcc);
      
      // Put it back in memory for faster access
      tccInMemoryStore[jobId] = JSON.parse(JSON.stringify(tcc));
      
      console.log(`[TCC_STORE] TCC for jobId: ${jobId} retrieved from filesystem and restored to memory.`);
      return JSON.parse(JSON.stringify(tcc));
    }
  } catch (error) {
    console.error(`[TCC_STORE] Error reading TCC from filesystem for jobId: ${jobId}`, error);
  }
  
  console.log(`[TCC_STORE] TCC for jobId: ${jobId} not found in memory or filesystem.`);
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
  
  // Get existing TCC (will check both memory and filesystem)
  const existingTCC = await getTCC(jobId);
  if (!existingTCC) {
    console.error(`[TCC_STORE] Error updating TCC: JobId ${jobId} not found.`);
    throw new Error(`Cannot update TCC: JobId ${jobId} not found.`);
  }

  // Create a new object with updates applied
  const updatedTCCData = { ...existingTCC, ...updates, updatedAt: new Date().toISOString() };
  
  try {
    // DEBUG: Log the updates being applied
    console.log(`[TCC_STORE] DEBUG: Updates being applied to TCC ${jobId}:`, {
      updatesKeys: Object.keys(updates),
      hasStyling: !!(updates as any).styling,
      stylingKeys: (updates as any).styling ? Object.keys((updates as any).styling) : [],
      hasStateLogic: !!(updates as any).stateLogic,
      stateLogicKeys: (updates as any).stateLogic ? Object.keys((updates as any).stateLogic) : [],
      stateLogicVariableCount: (updates as any).stateLogic?.variables?.length || 0
    });

    // Validate the entire updated object before saving
    const validationResult = ToolConstructionContextSchema.safeParse(updatedTCCData);
    if (!validationResult.success) {
      console.error(`[TCC_STORE] SCHEMA VALIDATION FAILED for jobId: ${jobId}:`, {
        errors: validationResult.error.errors,
        problematicData: {
          hasStateLogic: !!updatedTCCData.stateLogic,
          stateLogicStructure: updatedTCCData.stateLogic ? Object.keys(updatedTCCData.stateLogic) : null,
          stateLogicVariableCount: updatedTCCData.stateLogic?.variables?.length || 0
        }
      });
      throw new Error(`Schema validation failed: ${JSON.stringify(validationResult.error.errors)}`);
    }
    
    // Save the updated TCC
    await saveTCC(updatedTCCData);
    
    console.log(`[TCC_STORE] TCC for jobId: ${jobId} updated successfully.`);
    return updatedTCCData;
  } catch (error) {
    console.error(`[TCC_STORE] Error validating or saving updated TCC for jobId: ${jobId}`, error);
    
    // DEBUG: If it's a validation error, log more details
    if (error instanceof Error && error.message.includes('validation')) {
      console.error(`[TCC_STORE] VALIDATION ERROR DETAILS:`, {
        updatesKeys: Object.keys(updates),
        errorMessage: error.message,
        stylingData: (updates as any).styling ? JSON.stringify((updates as any).styling, null, 2) : 'No styling data'
      });
    }
    
    throw new Error(`Failed to update TCC: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Optional: Function to delete a TCC (e.g., for cleanup)
export async function deleteTCC(jobId: string): Promise<void> {
  console.log(`[TCC_STORE] Deleting TCC for jobId: ${jobId}`);
  
  // Delete from in-memory store
  if (tccInMemoryStore[jobId]) {
    delete tccInMemoryStore[jobId];
  }
  
  // Delete from filesystem
  try {
    const filePath = getTCCFilePath(jobId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`[TCC_STORE] Error deleting TCC file for jobId: ${jobId}`, error);
  }
  
  console.log(`[TCC_STORE] TCC for jobId: ${jobId} deleted successfully.`);
} 