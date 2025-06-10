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

// Phase 1: cleanBrainstormData function removed to ensure full brainstorm data integration
// All brainstorm data will now be passed intact to agents for enhanced context

// TODO: ARCHITECTURAL FIX NEEDED AFTER V2 COMPLETION
// The need for this transformation function indicates a design issue:
// - BrainstormDataSchema should match what BrainstormGenerator actually outputs
// - Data should be stored in correct format from the start
// - This transformation is a band-aid fix for schema vs reality mismatch
// 
// PROPER FIX:
// 1. Update BrainstormGenerator to output BrainstormDataSchema format directly
// 2. Fix storage/retrieval to save in correct format  
// 3. Migrate existing saved data to new format once
// 4. Remove this transformation function entirely
//
// For now, keeping transformation to support legacy data and move V2 forward.

// Phase 3.1: Transform saved brainstorm data to match new comprehensive BrainstormDataSchema
export function transformBrainstormDataToNewSchema(brainstormResult: SavedLogicResult): any {
  console.log('🔄 [TRANSFORM] Converting brainstorm data to new schema format');
  
  const brainstormOutput = brainstormResult.result?.brainstormOutput;
  const rawResult = brainstormResult.result;
  
  // If we already have data matching the new schema, use it directly
  if (brainstormOutput && typeof brainstormOutput === 'object') {
    console.log('🔄 [TRANSFORM] Found brainstormOutput - checking if it matches new schema');
    
    // Check if it has the expected new schema fields
    if (brainstormOutput.valueProposition || brainstormOutput.keyCalculations || brainstormOutput.interactionFlow) {
      console.log('✅ [TRANSFORM] BrainstormOutput already matches new schema - using directly');
      return brainstormOutput;
    }
  }
  
  console.log('🔄 [TRANSFORM] Converting legacy brainstorm format to new schema');
  console.log('🔍 [TRANSFORM] Raw result structure:', Object.keys(rawResult || {}));
  
  // Transform legacy format to new comprehensive schema
  const transformedData = {
    // Core concept (handle both spellings)
    coreConcept: rawResult?.coreConcept || rawResult?.coreWConcept || 'Business tool',
    valueProposition: rawResult?.valueProposition || 'Provides value to users',
    
    // Key calculations - extract from various legacy fields
    keyCalculations: rawResult?.keyCalculations || rawResult?.calculations || [
      {
        name: 'Main Calculation',
        formula: 'Basic calculation logic',
        description: 'Primary tool calculation',
        variables: ['input']
      }
    ],
    
    // Interaction flow - build from legacy data or create default
    interactionFlow: rawResult?.interactionFlow || [
      {
        step: 1,
        title: 'Input Collection',
        description: 'User provides required information',
        userAction: 'Enter data in form fields',
        engagementHook: 'Clear, intuitive interface'
      },
      {
        step: 2,
        title: 'Processing',
        description: 'System processes user input',
        userAction: 'Click calculate/submit button',
        engagementHook: 'Immediate feedback and results'
      }
    ],
    
    // Lead capture strategy
    leadCaptureStrategy: rawResult?.leadCaptureStrategy || {
      timing: 'after_completion',
      method: 'email_signup',
      incentive: 'Save and share results'
    },
    
    // Creative enhancements
    creativeEnhancements: rawResult?.creativeEnhancements || [
      'Professional styling and branding',
      'Mobile-responsive design',
      'Clear result presentation'
    ],
    
    // Suggested inputs - extract from legacy or create defaults
    suggestedInputs: rawResult?.suggestedInputs || [
      {
        id: 'primary_input',
        label: 'Primary Input',
        type: 'number',
        required: true,
        description: 'Main input for calculation'
      }
    ],
    
    // Calculation logic - more detailed than keyCalculations
    calculationLogic: rawResult?.calculationLogic || [
      {
        id: 'main_calc',
        name: 'Main Calculation',
        formula: 'result = input * factor',
        dependencies: ['input'],
        outputFormat: 'number',
        engagementMoment: 'Real-time calculation display'
      }
    ],
    
    // Prompt options that guided generation
    promptOptions: rawResult?.promptOptions || {
      includeComprehensiveColors: true,
      includeGorgeousStyling: true,
      includeAdvancedLayouts: false,
      styleComplexity: 'standard',
      industryFocus: brainstormResult.industry || undefined,
      toolComplexity: 'standard'
    }
  };
  
  console.log('✅ [TRANSFORM] Successfully transformed to new schema with keys:', Object.keys(transformedData));
  return transformedData;
}

async function startV2ToolCreation(
  brainstormResult: SavedLogicResult,
  modelId: string,
  agentModelMapping?: Record<string, string>
): Promise<{ jobId: string }> {
  console.log(`Requesting V2 tool creation with model: ${modelId} for brainstorm: ${brainstormResult.id}`);

  const userInputData = brainstormResult.result?.userInput || {};
  
  // 🔍 DEBUG: Log the exact data structure we're receiving
  console.log('🔍 [V2-START-DEBUG] Full brainstormResult structure:', JSON.stringify(brainstormResult, null, 2));
  console.log('🔍 [V2-START-DEBUG] userInputData extracted:', JSON.stringify(userInputData, null, 2));
  console.log('🔍 [V2-START-DEBUG] businessContext value:', userInputData.businessContext);
  console.log('🔍 [V2-START-DEBUG] description value:', userInputData.description);
  
  const finalDescription = userInputData.businessContext || userInputData.description || 'No description provided.';
  console.log('🔍 [V2-START-DEBUG] Final description used:', finalDescription);
  
  // Phase 3.1: Transform brainstorm data to match new comprehensive schema
  const transformedBrainstormData = transformBrainstormDataToNewSchema(brainstormResult);
  console.log('🔍 [V2-START-DEBUG] Transformed brainstorm data keys:', Object.keys(transformedBrainstormData));
  
  const requestBody = {
    userInput: {
      description: finalDescription,
      targetAudience: brainstormResult.targetAudience,
      industry: brainstormResult.industry,
      toolType: brainstormResult.toolType,
      features: userInputData.features || []
    },
    selectedModel: modelId,
    agentModelMapping: agentModelMapping || {},
    // Phase 3.1: Use transformed brainstorm data that matches BrainstormDataSchema
    brainstormData: transformedBrainstormData,
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