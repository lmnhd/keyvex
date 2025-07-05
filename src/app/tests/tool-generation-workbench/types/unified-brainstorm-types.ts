import { z } from 'zod';
import { BrainstormDataSchema, type BrainstormData } from '@/lib/types/tcc-unified';

// --- PHASE 1: UNIFIED BRAINSTORM TYPES ---
// This file replaces the conflicting BrainstormData and SavedLogicResult types
// with a single, strongly-typed structure that matches BrainstormDataSchema

// Re-export the authoritative brainstorm data schema from TCC
export { BrainstormDataSchema, type BrainstormData } from '@/lib/types/tcc-unified';

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

// Validation function with detailed error logging
export function validateBrainstormData(data: any): BrainstormData {
  console.log('🔍 [BRAINSTORM-VALIDATION] Starting brainstorm data validation', { 
    dataKeys: Object.keys(data || {}),
    dataType: typeof data 
  });

  try {
    const result = BrainstormDataSchema.parse(data);
    console.log('✅ [BRAINSTORM-VALIDATION] Brainstorm data validation successful', {
      validatedFields: Object.keys(result)
    });
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ [BRAINSTORM-VALIDATION] Zod validation failed for brainstorm data', {
        errorCount: error.errors.length,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          code: err.code,
          message: err.message,
          // Safely access expected/received properties that may not exist on all ZodIssue types
          ...(('expected' in err) && { expected: err.expected }),
          ...(('received' in err) && { received: err.received })
        })),
        inputData: data,
        inputDataKeys: Object.keys(data || {}),
        missingRequiredFields: error.errors
          .filter(err => err.code === 'invalid_type' && ('received' in err) && err.received === 'undefined')
          .map(err => err.path.join('.')),
        invalidTypeFields: error.errors
          .filter(err => err.code === 'invalid_type' && ('received' in err) && err.received !== 'undefined')
          .map(err => ({
            field: err.path.join('.'),
            ...(('expected' in err) && { expected: err.expected }),
            ...(('received' in err) && { received: err.received })
          }))
      });

      // Log specific field analysis
      const requiredFields = [
        'coreConcept',
        'keyCalculations', 
        'interactionFlow',
        'valueProposition',
        'leadCaptureStrategy',
        'creativeEnhancements',
        'suggestedInputs',
        'calculationLogic',
        'promptOptions'
      ];

      const fieldAnalysis = requiredFields.map(field => ({
        field,
        present: data && data[field] !== undefined,
        type: data && data[field] !== undefined ? typeof data[field] : 'undefined',
        value: data && data[field] !== undefined ? (
          Array.isArray(data[field]) ? `Array(${data[field].length})` :
          typeof data[field] === 'object' ? `Object(${Object.keys(data[field]).join(', ')})` :
          String(data[field]).substring(0, 100)
        ) : 'undefined'
      }));

      console.error('📊 [BRAINSTORM-VALIDATION] Field-by-field analysis', { fieldAnalysis });

      // Special focus on problematic fields
      if (data?.leadCaptureStrategy) {
        console.error('🎯 [BRAINSTORM-VALIDATION] leadCaptureStrategy analysis', {
          leadCaptureStrategy: data.leadCaptureStrategy,
          hasTimingField: data.leadCaptureStrategy.timing !== undefined,
          hasMethodField: data.leadCaptureStrategy.method !== undefined,
          hasIncentiveField: data.leadCaptureStrategy.incentive !== undefined,
          timingValue: data.leadCaptureStrategy.timing,
          methodValue: data.leadCaptureStrategy.method,
          incentiveValue: data.leadCaptureStrategy.incentive
        });
      } else {
        console.error('🎯 [BRAINSTORM-VALIDATION] leadCaptureStrategy is completely missing');
      }

      if (data?.promptOptions) {
        console.error('🎯 [BRAINSTORM-VALIDATION] promptOptions analysis', {
          promptOptions: data.promptOptions,
          requiredBooleans: {
            includeComprehensiveColors: data.promptOptions.includeComprehensiveColors,
            includeGorgeousStyling: data.promptOptions.includeGorgeousStyling,
            includeAdvancedLayouts: data.promptOptions.includeAdvancedLayouts
          },
          requiredEnums: {
            styleComplexity: data.promptOptions.styleComplexity,
            toolComplexity: data.promptOptions.toolComplexity
          }
        });
      } else {
        console.error('🎯 [BRAINSTORM-VALIDATION] promptOptions is completely missing');
      }
    }

    console.error('💥 [BRAINSTORM-VALIDATION] Throwing validation error after detailed logging');
    throw error;
  }
}

export function isBrainstormData(data: unknown): data is BrainstormData {
  return BrainstormDataSchema.safeParse(data).success;
}

// --- MIGRATION HELPERS ---

// Convert legacy SavedLogicResult to new BrainstormResult
export function migrateLegacySavedLogicResult(legacy: any): BrainstormResult {
  // Handle the nested structure from legacy data
  const rawBrainstormData = legacy.result?.brainstormOutput || legacy.result || {};
  
  // Handle the user input extraction
  const userInput: BrainstormUserInput = {
    toolType: legacy.toolType || legacy.result?.userInput?.toolType || 'Unknown',
    targetAudience: legacy.targetAudience || legacy.result?.userInput?.targetAudience || 'Unknown',
    industry: legacy.industry || legacy.result?.userInput?.industry,
    businessContext: legacy.result?.userInput?.businessContext || 'Legacy data',
    selectedModel: legacy.result?.userInput?.selectedModel,
  };

  // Safely migrate brainstorm data with fallbacks for missing fields
  const brainstormData = migrateBrainstormDataSafely(rawBrainstormData, userInput);

  return {
    id: legacy.id,
    timestamp: legacy.timestamp,
    date: legacy.date || new Date(legacy.timestamp).toISOString(),
    userInput,
    brainstormData,
  };
}

// NO FALLBACK MIGRATION - Let it fail to expose the real issues
export function migrateBrainstormDataSafely(rawData: any, userInput: BrainstormUserInput): BrainstormData {
  console.error('🚨 [MIGRATION] ATTEMPTING TO MIGRATE LEGACY DATA - THIS SHOULD NOT HAPPEN!');
  console.error('🚨 [MIGRATION] Raw data received:', JSON.stringify(rawData, null, 2));
  console.error('🚨 [MIGRATION] User input:', JSON.stringify(userInput, null, 2));
  
  // NO FALLBACKS - Use the actual data or throw an error
  const actualData = {
    coreConcept: rawData.coreConcept || rawData.coreWConcept,
    valueProposition: rawData.valueProposition,
    keyCalculations: rawData.keyCalculations,
    interactionFlow: rawData.interactionFlow,
    leadCaptureStrategy: rawData.leadCaptureStrategy,
    creativeEnhancements: rawData.creativeEnhancements,
    suggestedInputs: rawData.suggestedInputs,
    calculationLogic: rawData.calculationLogic,
    promptOptions: rawData.promptOptions
  };

  console.error('🚨 [MIGRATION] Attempting validation with actual data (no fallbacks)');
  
  // Validate with actual data - let it throw if invalid
  return validateBrainstormData(actualData);
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
    brainstormData: migrateBrainstormDataSafely(legacy.result || legacy, userInput),
  };
} 
