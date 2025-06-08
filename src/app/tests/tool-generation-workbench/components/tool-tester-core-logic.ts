import { loadLogicResultsFromDB } from '../../ui/db-utils'; // Adjusted path
import type { SavedLogicResult } from '../../ui/types'; // Adjusted path, use import type
import { ProductToolDefinition } from '@/lib/types/product-tool';

export { loadLogicResultsFromDB }; // Export function normally
export type { SavedLogicResult }; // Re-export type using 'export type'

export interface ToolCreationJob {
  modelId: string;
  jobId?: string; // Add the V2 orchestrator's jobId
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

/**
 * Starts the V2 tool creation process by calling the orchestration/start endpoint.
 *
 * @param brainstormResult The selected brainstorm data.
 * @param modelId The ID of the AI model to use for generation.
 * @param agentModelMapping Optional mapping of agent IDs to specific model IDs.
 * @returns A promise that resolves to the initial job state including the orchestrator's jobId.
 */
async function startV2ToolCreation(
  brainstormResult: SavedLogicResult,
  modelId: string,
  agentModelMapping?: Record<string, string>
): Promise<{ jobId: string }> {
  console.log(`Requesting V2 tool creation with model: ${modelId} for brainstorm: ${brainstormResult.id}`);

  const userInputData = brainstormResult.result?.userInput || {};
  
  const requestBody = {
    userInput: {
      description: userInputData.businessContext || userInputData.description || 'No description provided.',
      targetAudience: brainstormResult.targetAudience,
      industry: brainstormResult.industry,
      toolType: brainstormResult.toolType,
      features: userInputData.features || []
    },
    selectedModel: modelId,
    agentModelMapping: agentModelMapping || {},
    testingOptions: {
      enableWebSocketStreaming: true,
      enableTccOperations: true,
      enableOrchestrationTriggers: true
    }
  };

  console.log(`[V2 Start] API Request Body to /api/ai/product-tool-creation-v2/orchestrate/start:`, JSON.stringify(requestBody, null, 2));

  const response = await fetch('/api/ai/product-tool-creation-v2/orchestrate/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const responseData = await response.json();

  if (!response.ok || !responseData.success) {
    const errorMessage = responseData.error || `Tool creation failed for model ${modelId} with status ${response.status}`;
    console.error(`[V2 Start] API error response:`, responseData);
    throw new Error(errorMessage);
  }

  console.log(`[V2 Start] API success response:`, responseData);
  return { jobId: responseData.jobId };
}

/**
 * Main function to run the tool creation process. This is the new entry point from the UI.
 * It now starts the V2 orchestration and returns the initial job status.
 *
 * NOTE: This function no longer waits for the tool to be fully generated. The UI will
 * need to use the returned jobId to track progress via WebSockets.
 *
 * @param brainstormResult The selected brainstorm data.
 * @param selectedModelId The ID of the single model chosen for generation.
 * @param onJobUpdate Callback to update the UI with the job's initial state.
 * @param agentModelMapping Optional mapping of agent IDs to specific model IDs.
 * @returns The initial state of the creation job.
 */
export async function runToolCreationProcess(
  brainstormResult: SavedLogicResult,
  selectedModelId: string,
  onJobUpdate: (job: ToolCreationJob) => void,
  agentModelMapping?: Record<string, string>
): Promise<ToolCreationJob> {
  let job: ToolCreationJob = {
    modelId: selectedModelId,
    status: 'loading',
    startTime: Date.now(),
  };
  onJobUpdate(job);
  
  try {
    const { jobId } = await startV2ToolCreation(brainstormResult, selectedModelId, agentModelMapping);
    job = {
      ...job,
      jobId: jobId,
      status: 'loading', // Status remains 'loading' as the async process has just started
    };
  } catch (error) {
    console.error(`Error starting tool creation with model ${selectedModelId}:`, error);
    job = {
      ...job,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      endTime: Date.now(),
    };
  }
  
  onJobUpdate(job);
  return job;
}
