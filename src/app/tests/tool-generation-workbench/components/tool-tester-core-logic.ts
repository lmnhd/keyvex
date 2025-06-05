import { loadLogicResultsFromDB } from '../../ui/db-utils'; // Adjusted path
import type { SavedLogicResult } from '../../ui/types'; // Adjusted path, use import type
import { ProductToolDefinition } from '@/lib/types/product-tool';

export { loadLogicResultsFromDB }; // Export function normally
export type { SavedLogicResult }; // Re-export type using 'export type'

export interface ToolCreationJob {
  modelId: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  result?: ProductToolDefinition | null;
  error?: string | null;
  startTime?: number;
  endTime?: number;
}

// 🔧 CRITICAL FIX: Clean brainstorm data to prevent AI confusion
function cleanBrainstormData(brainstormData: any): any {
  if (!brainstormData) return null;
  
  // Create a clean copy without potentially problematic fields
  const cleaned = { ...brainstormData };
  
  // Remove prompt options that might conflict with tool creation
  delete cleaned.promptOptions;
  
  // Remove overly complex metadata that might confuse the AI
  if (cleaned.suggestedInputs && Array.isArray(cleaned.suggestedInputs)) {
    // Keep only essential input fields
    cleaned.suggestedInputs = cleaned.suggestedInputs.map((input: any) => ({
      id: input.id,
      label: input.label,
      type: input.type,
      required: input.required
    }));
  }
  
  // Simplify calculation logic to prevent AI confusion
  if (cleaned.calculationLogic && Array.isArray(cleaned.calculationLogic)) {
    cleaned.calculationLogic = cleaned.calculationLogic.map((calc: any) => ({
      id: calc.id,
      name: calc.name,
      formula: calc.formula,
      outputFormat: calc.outputFormat
    }));
  }
  
  // Keep core concepts simple
  const simplifiedData = {
    coreConcept: cleaned.coreConcept || cleaned.coreWConcept,
    valueProposition: cleaned.valueProposition,
    keyCalculations: cleaned.keyCalculations || [],
    suggestedInputs: cleaned.suggestedInputs || [],
    calculationLogic: cleaned.calculationLogic || [],
    interactionFlow: cleaned.interactionFlow || [],
    creativeEnhancements: cleaned.creativeEnhancements || []
  };
  
  console.log('🧹 BRAINSTORM CLEANER: Simplified brainstorm data to prevent AI confusion');
  return simplifiedData;
}

// This function is a simplified adaptation of callToolCreationAgent from '../../ui/ai-processing.ts'
async function createToolForModel(
  brainstormResult: SavedLogicResult,
  modelId: string
): Promise<ProductToolDefinition> {
  console.log(`Requesting tool creation with model: ${modelId} for brainstorm: ${brainstormResult.id}`);

  // 🔧 CRITICAL FIX: Clean the brainstorm data before sending to API
  const rawBrainstormData = brainstormResult.result?.brainstormOutput || brainstormResult.result;
  const cleanedBrainstormData = cleanBrainstormData(rawBrainstormData);
  
  console.log(`🧹 [${modelId}] Cleaned brainstorm data:`, JSON.stringify(cleanedBrainstormData, null, 2));

  const requestBody = {
    userIntent: `Create a ${brainstormResult.toolType} for ${brainstormResult.targetAudience}`,
    selectedModel: modelId, // ✅ Move selectedModel to top level for API route
    context: {
      targetAudience: brainstormResult.targetAudience,
      industry: brainstormResult.industry,
      toolType: brainstormResult.toolType,
      // Use cleaned brainstorm data instead of raw data
      logicArchitectInsights: cleanedBrainstormData,
      brainstormingResult: cleanedBrainstormData,
      // Ensure other potentially expected fields by the API are present, even if empty or default
      features: (cleanedBrainstormData as any)?.features || [],
      colors: (cleanedBrainstormData as any)?.colors || [],
      businessDescription: (cleanedBrainstormData as any)?.businessDescription || (brainstormResult.result?.userInput as any)?.businessContext || '',
      collectedAnswers: (cleanedBrainstormData as any)?.collectedAnswers || {},
      conversationHistory: (cleanedBrainstormData as any)?.conversationHistory || [],
    },
  };

  console.log(`[${modelId}] API Request Body to /api/ai/create-tool:`, JSON.stringify(requestBody, null, 2));
  console.log(`[${modelId}] 🚨 DEBUGGING: selectedModel value being sent:`, requestBody.selectedModel);

  const response = await fetch('/api/ai/create-tool', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to create tool and parse error response.' }));
    console.error(`[${modelId}] API error response from /api/ai/create-tool:`, errorData);
    throw new Error(errorData.message || `Tool creation failed for model ${modelId} with status ${response.status}`);
  }

  const apiResponse = await response.json();
  console.log(`[${modelId}] API success response from /api/ai/create-tool:`, apiResponse);

  if (!apiResponse.success || !apiResponse.tool) {
    console.error(`[${modelId}] Invalid API response structure:`, apiResponse);
    throw new Error(apiResponse.message || `Tool creation returned success:false or no tool object for model ${modelId}.`);
  }

  // TODO: Add validation using isValidProductToolDefinition if available and needed here
  return apiResponse.tool as ProductToolDefinition;
}

export async function runToolCreationTests(
  brainstormResult: SavedLogicResult,
  selectedModelIds: string[],
  onJobUpdate: (job: ToolCreationJob) => void
): Promise<ToolCreationJob[]> {
  const jobs: ToolCreationJob[] = selectedModelIds.map(modelId => ({
    modelId,
    status: 'pending',
  }));

  const promises = jobs.map(async (job) => {
    // Explicitly type currentJobState to ensure its status can be updated
    let currentJobState: ToolCreationJob = { ...job, status: 'loading', startTime: Date.now() };
    onJobUpdate(currentJobState);
    try {
      const toolDefinition = await createToolForModel(brainstormResult, job.modelId);
      currentJobState = {
        ...currentJobState,
        status: 'success', 
        result: toolDefinition, 
        endTime: Date.now(),
      };
    } catch (error) {
      console.error(`Error creating tool with model ${job.modelId}:`, error);
      currentJobState = {
        ...currentJobState,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        endTime: Date.now(),
      };
    }
    onJobUpdate(currentJobState);
    return currentJobState;
  });

  // Wait for all promises to settle (either resolve or reject)
  const settledJobs = await Promise.allSettled(promises);

  // Process settled promises to return the final job states
  return settledJobs.map((settledPromise, index) => {
    if (settledPromise.status === 'fulfilled') {
      return settledPromise.value; // This is the ToolCreationJob object from the try/catch block
    }
    // This case should ideally not be reached if errors are caught within createToolForModel and the map function
    // But as a fallback:
    console.error(`[${jobs[index].modelId}] Unexpected promise rejection in runToolCreationTests:`, settledPromise.reason);
    return {
      ...jobs[index],
      status: 'error',
      error: 'Unexpected error during test execution. See console.',
      endTime: Date.now(),
    } as ToolCreationJob;
  });
}
