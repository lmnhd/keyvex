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
export function transformBrainstormDataToNewSchema(brainstormResult: SavedLogicResult | any): any {
  console.log('🚨 TRANSFORMATION FUNCTION CALLED! 🚨');
  console.log('🔄 [TRANSFORM] Converting brainstorm data to new schema format');
  console.log('🔍 [TRANSFORM] Full brainstormResult structure:', JSON.stringify(brainstormResult, null, 2));
  
  // Check if this is a SavedLogicResult (nested structure) or direct brainstorm data
  const isDirectBrainstormData = brainstormResult.coreConcept || brainstormResult.keyCalculations || brainstormResult.suggestedInputs;
  
  if (isDirectBrainstormData) {
    console.log('🎯 [TRANSFORM] Detected DIRECT brainstorm data - using as-is');
    console.log('🔍 [TRANSFORM] Direct data keys:', Object.keys(brainstormResult));
    console.log('🔍 [TRANSFORM] Direct coreConcept:', brainstormResult.coreConcept);
    console.log('🔍 [TRANSFORM] Direct keyCalculations count:', brainstormResult.keyCalculations?.length || 0);
    console.log('🔍 [TRANSFORM] Direct suggestedInputs count:', brainstormResult.suggestedInputs?.length || 0);
    
    // This is direct brainstorm data - return it as-is
    return brainstormResult;
  }
  
  // Original nested logic for SavedLogicResult
  const brainstormOutput = brainstormResult.result?.brainstormOutput;
  const rawResult = brainstormResult.result;
  
  console.log('🔍 [TRANSFORM] brainstormOutput found:', !!brainstormOutput);
  console.log('🔍 [TRANSFORM] brainstormOutput structure:', brainstormOutput ? Object.keys(brainstormOutput) : 'N/A');
  console.log('🔍 [TRANSFORM] brainstormOutput DETAILED:', brainstormOutput);
  
  // 🚨 CRITICAL DEBUG: Check if we have rich brainstormOutput data
  if (brainstormOutput && typeof brainstormOutput === 'object') {
    console.log('🔍 [TRANSFORM] brainstormOutput coreConcept:', brainstormOutput.coreConcept);
    console.log('🔍 [TRANSFORM] brainstormOutput keyCalculations count:', brainstormOutput.keyCalculations?.length);
    console.log('🔍 [TRANSFORM] brainstormOutput suggestedInputs count:', brainstormOutput.suggestedInputs?.length);
    
    // Check if it has the expected new schema fields
    if (brainstormOutput.valueProposition || brainstormOutput.keyCalculations || brainstormOutput.interactionFlow) {
      console.log('✅ [TRANSFORM] BrainstormOutput already matches new schema - using directly');
      console.log('🔍 [TRANSFORM] Returning rich brainstorm data with keys:', Object.keys(brainstormOutput));
      console.log('🔍 [TRANSFORM] FINAL CORE CONCEPT BEING RETURNED:', brainstormOutput.coreConcept);
      return brainstormOutput;
    }
  }
  
  console.log('🔄 [TRANSFORM] Converting legacy brainstorm format to new schema');
  console.log('🔍 [TRANSFORM] Raw result structure:', Object.keys(rawResult || {}));
  
  // 🚨 BUG FIX: If we have brainstormOutput but it doesn't match the schema check above,
  // it might still contain rich data that we should use instead of generic fallbacks
  const sourceData = brainstormOutput && typeof brainstormOutput === 'object' ? brainstormOutput : rawResult;
  console.log('🔍 [TRANSFORM] Using sourceData from:', brainstormOutput ? 'brainstormOutput' : 'rawResult');
  console.log('🔍 [TRANSFORM] SourceData keys:', Object.keys(sourceData || {}));
  
  // Transform legacy format to new comprehensive schema
  const transformedData = {
    // Core concept (handle both spellings) - USE ACTUAL DATA
    coreConcept: sourceData?.coreConcept || sourceData?.coreWConcept || 'Business tool',
    valueProposition: sourceData?.valueProposition || 'Provides value to users',
    
    // Key calculations - extract from various legacy fields - USE ACTUAL DATA
    keyCalculations: sourceData?.keyCalculations || sourceData?.calculations || [
      {
        name: 'Main Calculation',
        formula: 'Basic calculation logic',
        description: 'Primary tool calculation',
        variables: ['input']
      }
    ],
    
    // Interaction flow - build from legacy data or create default - USE ACTUAL DATA
    interactionFlow: sourceData?.interactionFlow || [
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
    
    // Lead capture strategy - USE ACTUAL DATA
    leadCaptureStrategy: sourceData?.leadCaptureStrategy || {
      timing: 'after_completion',
      method: 'email_signup',
      incentive: 'Save and share results'
    },
    
    // Creative enhancements - USE ACTUAL DATA
    creativeEnhancements: sourceData?.creativeEnhancements || [
      'Professional styling and branding',
      'Mobile-responsive design',
      'Clear result presentation'
    ],
    
    // Suggested inputs - extract from legacy or create defaults - USE ACTUAL DATA
    suggestedInputs: sourceData?.suggestedInputs || [
      {
        id: 'primary_input',
        label: 'Primary Input',
        type: 'number',
        required: true,
        description: 'Main input for calculation'
      }
    ],
    
    // Calculation logic - more detailed than keyCalculations - USE ACTUAL DATA
    calculationLogic: sourceData?.calculationLogic || [
      {
        id: 'main_calc',
        name: 'Main Calculation',
        formula: 'result = input * factor',
        dependencies: ['input'],
        outputFormat: 'number',
        engagementMoment: 'Real-time calculation display'
      }
    ],
    
    // Prompt options that guided generation - USE ACTUAL DATA
    promptOptions: sourceData?.promptOptions || {
      includeComprehensiveColors: true,
      includeGorgeousStyling: true,
      includeAdvancedLayouts: false,
      styleComplexity: 'standard',
      industryFocus: brainstormResult.industry || undefined,
      toolComplexity: 'standard'
    }
  };
  
  console.log('✅ [TRANSFORM] Successfully transformed to new schema with keys:', Object.keys(transformedData));
  console.log('🔍 [TRANSFORM] Final coreConcept:', transformedData.coreConcept);
  console.log('🔍 [TRANSFORM] Final valueProposition:', transformedData.valueProposition);
  console.log('🔍 [TRANSFORM] Final keyCalculations count:', transformedData.keyCalculations?.length);
  console.log('🔍 [TRANSFORM] Final suggestedInputs count:', transformedData.suggestedInputs?.length);
  
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
  
  // Phase 3.1: Transform brainstorm data to match new comprehensive schema FIRST
  const transformedBrainstormData = transformBrainstormDataToNewSchema(brainstormResult);
  console.log('🔍 [V2-START-DEBUG] Transformed brainstorm data keys:', Object.keys(transformedBrainstormData));
  
  // 🚨 FIX: Use rich brainstorm data for description instead of generic fallback - ALWAYS USE PRIMARY DATA
  const finalDescription = userInputData.businessContext || 
                          userInputData.description || 
                          (transformedBrainstormData.coreConcept ? 
                            `${transformedBrainstormData.coreConcept}: ${transformedBrainstormData.valueProposition}` :
                            'Business calculation tool');
  console.log('🔍 [V2-START-DEBUG] Final description used:', finalDescription);
  
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

/**
 * Helper function to run the final 3 TCC stages: component-assembler, validator, tool-finalizer
 * Takes a modified TCC and runs it through the final assembly, validation, and finalization steps
 */
export async function runTccFinalizationSteps(
  tcc: any,
  agentModelMapping?: Record<string, string>
): Promise<{
  success: boolean;
  finalProduct?: any;
  error?: string;
  intermediateResults?: {
    assembledComponent?: any;
    validationResult?: any;
  };
}> {
  try {
    const intermediateResults: any = {};
    
    // Step 1: Component Assembly
    console.log('🔧 Starting Component Assembly...');
    const assemblerResponse = await fetch('/api/ai/product-tool-creation-v2/agents/component-assembler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jobId: tcc.jobId,
        selectedModel: agentModelMapping?.['component-assembler'],
        tcc: tcc,
        isIsolatedTest: true // Prevent triggering next step automatically
      })
    });
    
    if (!assemblerResponse.ok) {
      throw new Error(`Component Assembler failed: ${assemblerResponse.statusText}`);
    }
    
    const assemblerResult = await assemblerResponse.json();
    if (!assemblerResult.success) {
      throw new Error(`Component Assembler error: ${assemblerResult.error}`);
    }
    
    intermediateResults.assembledComponent = assemblerResult.assembledComponent;
    const updatedTccAfterAssembly = assemblerResult.updatedTcc;
    
    console.log('✅ Component Assembly completed');
    
    // Step 2: Validation
    console.log('🔍 Starting Validation...');
    const validatorResponse = await fetch('/api/ai/product-tool-creation-v2/agents/validator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jobId: tcc.jobId,
        selectedModel: agentModelMapping?.['validator'],
        tcc: updatedTccAfterAssembly,
        isIsolatedTest: true // Prevent triggering next step automatically
      })
    });
    
    if (!validatorResponse.ok) {
      throw new Error(`Validator failed: ${validatorResponse.statusText}`);
    }
    
    const validatorResult = await validatorResponse.json();
    if (!validatorResult.success) {
      throw new Error(`Validator error: ${validatorResult.error}`);
    }
    
    intermediateResults.validationResult = validatorResult.validationResult;
    const updatedTccAfterValidation = validatorResult.updatedTcc;
    
    console.log('✅ Validation completed');
    
    // Step 3: Tool Finalization
    console.log('🎯 Starting Tool Finalization...');
    const finalizerResponse = await fetch('/api/ai/product-tool-creation-v2/agents/tool-finalizer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jobId: tcc.jobId,
        selectedModel: agentModelMapping?.['tool-finalizer'],
        tcc: updatedTccAfterValidation,
        isIsolatedTest: true // Prevent triggering next step automatically
      })
    });
    
    if (!finalizerResponse.ok) {
      throw new Error(`Tool Finalizer failed: ${finalizerResponse.statusText}`);
    }
    
    const finalizerResult = await finalizerResponse.json();
    if (!finalizerResult.success) {
      throw new Error(`Tool Finalizer error: ${finalizerResult.error}`);
    }
    
    console.log('✅ Tool Finalization completed');
    
    return {
      success: true,
      finalProduct: finalizerResult.finalProduct,
      intermediateResults
    };
    
  } catch (error) {
    console.error('❌ TCC Finalization Steps Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
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