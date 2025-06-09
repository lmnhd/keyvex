import { loadLogicResultsFromDB } from '../../ui/db-utils';
import type { SavedLogicResult } from '../../ui/types';
import { ProductToolDefinition } from '@/lib/types/product-tool';

export { loadLogicResultsFromDB };
export type { SavedLogicResult };

export interface ToolCreationJob {
  modelId: string;
  jobId?: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  result?: ProductToolDefinition | null;
  error?: string | null;
  startTime?: number;
  endTime?: number;
}

function cleanBrainstormData(brainstormData: any): any {
  if (!brainstormData) return null;
  
  const cleaned = { ...brainstormData };
  
  delete cleaned.promptOptions;
  
  if (cleaned.suggestedInputs && Array.isArray(cleaned.suggestedInputs)) {
    cleaned.suggestedInputs = cleaned.suggestedInputs.map((input: any) => ({
      id: input.id,
      label: input.label,
      type: input.type,
      required: input.required
    }));
  }
  
  if (cleaned.calculationLogic && Array.isArray(cleaned.calculationLogic)) {
    cleaned.calculationLogic = cleaned.calculationLogic.map((calc: any) => ({
      id: calc.id,
      name: calc.name,
      formula: calc.formula,
      outputFormat: calc.outputFormat
    }));
  }
  
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

  return { jobId: responseData.jobId };
}

export async function runToolCreationProcess(
  brainstormResult: SavedLogicResult,
  selectedModelId: string,
  agentModelMapping?: Record<string, string>
): Promise<ToolCreationJob> {
  let job: ToolCreationJob = {
    modelId: selectedModelId,
    status: 'loading',
    startTime: Date.now(),
  };
  
  try {
    const { jobId } = await startV2ToolCreation(brainstormResult, selectedModelId, agentModelMapping);
    job = {
      ...job,
      jobId: jobId,
      status: 'loading',
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
  
  return job;
}

export async function runIsolatedAgentTest(
  agentId: string,
  tcc: any,
  modelId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(`/api/ai/product-tool-creation-v2/agents/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: tcc.jobId || `debug-${Date.now()}`,
        selectedModel: modelId,
        mockTcc: tcc,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Agent ${agentId} failed with status ${response.status}`);
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}