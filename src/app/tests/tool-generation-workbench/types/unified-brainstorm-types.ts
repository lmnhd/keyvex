import { z } from 'zod';

// --- PHASE 1: UNIFIED BRAINSTORM TYPES ---
// This file replaces the conflicting BrainstormData and SavedLogicResult types
// with a single, strongly-typed structure that matches BrainstormDataSchema

// Re-export the authoritative brainstorm data schema from TCC
export { BrainstormDataSchema, type BrainstormData } from '@/lib/types/product-tool-creation-v2/tcc';

// User input that generates a brainstorm
export const BrainstormUserInputSchema = z.object({
  toolType: z.string(),
  targetAudience: z.string(),
  industry: z.string().optional(),
  businessContext: z.string(), // The description that drives brainstorm generation
  selectedModel: z.string().optional(),
});
export type BrainstormUserInput = z.infer<typeof BrainstormUserInputSchema>;

// Complete brainstorm result - replaces both BrainstormData and SavedLogicResult
export const BrainstormResultSchema = z.object({
  // Metadata
  id: z.string(),
  timestamp: z.number(),
  date: z.string(), // ISO string for display
  
  // User input that generated this brainstorm
  userInput: BrainstormUserInputSchema,
  
  // The actual brainstorm data (flat structure, no nesting)
  brainstormData: BrainstormDataSchema,
});
export type BrainstormResult = z.infer<typeof BrainstormResultSchema>;

// Stream data for real-time brainstorm generation
export const BrainstormStreamDataSchema = z.object({
  type: z.enum(['partial', 'complete', 'error']),
  data: z.any(), // During streaming, this can be partial data
  timestamp: z.number(),
  message: z.string().optional(),
});
export type BrainstormStreamData = z.infer<typeof BrainstormStreamDataSchema>;

// Request for generating a brainstorm
export const BrainstormRequestSchema = z.object({
  toolType: z.string(),
  targetAudience: z.string(),
  industry: z.string().optional(),
  businessContext: z.string(),
  selectedModel: z.string().optional(),
});
export type BrainstormRequest = z.infer<typeof BrainstormRequestSchema>;

// --- VALIDATION HELPERS ---

export function validateBrainstormResult(data: unknown): BrainstormResult {
  return BrainstormResultSchema.parse(data);
}

export function isBrainstormResult(data: unknown): data is BrainstormResult {
  return BrainstormResultSchema.safeParse(data).success;
}

export function validateBrainstormData(data: unknown): BrainstormData {
  return BrainstormDataSchema.parse(data);
}

export function isBrainstormData(data: unknown): data is BrainstormData {
  return BrainstormDataSchema.safeParse(data).success;
}

// --- MIGRATION HELPERS ---

// Convert legacy SavedLogicResult to new BrainstormResult
export function migrateLegacySavedLogicResult(legacy: any): BrainstormResult {
  // Handle the nested structure from legacy data
  const brainstormData = legacy.result?.brainstormOutput || legacy.result || {};
  
  // Handle the user input extraction
  const userInput: BrainstormUserInput = {
    toolType: legacy.toolType || legacy.result?.userInput?.toolType || 'Unknown',
    targetAudience: legacy.targetAudience || legacy.result?.userInput?.targetAudience || 'Unknown',
    industry: legacy.industry || legacy.result?.userInput?.industry,
    businessContext: legacy.result?.userInput?.businessContext || 'Legacy data',
    selectedModel: legacy.result?.userInput?.selectedModel,
  };

  return {
    id: legacy.id,
    timestamp: legacy.timestamp,
    date: legacy.date || new Date(legacy.timestamp).toISOString(),
    userInput,
    brainstormData: validateBrainstormData(brainstormData),
  };
}

// Convert legacy BrainstormData to new BrainstormResult
export function migrateLegacyBrainstormData(legacy: any): BrainstormResult {
  const userInput: BrainstormUserInput = {
    toolType: legacy.toolType || 'Unknown',
    targetAudience: legacy.targetAudience || 'Unknown',
    industry: legacy.industry,
    businessContext: legacy.businessContext || 'Legacy data',
  };

  return {
    id: legacy.id,
    timestamp: legacy.timestamp,
    date: new Date(legacy.timestamp).toISOString(),
    userInput,
    brainstormData: validateBrainstormData(legacy.result || legacy),
  };
} 