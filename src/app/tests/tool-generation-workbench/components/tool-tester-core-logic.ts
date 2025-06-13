import { loadLogicResultsFromDB } from '../../ui/db-utils';
import type { SavedLogicResult } from '../../ui/types';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { 
  type BrainstormResult,
  type BrainstormData,
  migrateLegacySavedLogicResult,
  isBrainstormResult,
  validateBrainstormResult
} from '../types/unified-brainstorm-types';

// Using console logging for test utilities

export { loadLogicResultsFromDB };
export type { SavedLogicResult };

export interface ToolCreationJob {
  jobId?: string;
  modelId: string;
  status: 'loading' | 'success' | 'error' | 'completed';
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
  productToolDefinition?: ProductToolDefinition;
  toolConstructionContext?: any;
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

// Phase 3.1: REMOVED - Transform function no longer needed
// The Logic Architect now generates data in the correct format based on version parameter

async function startV2ToolCreation(
  brainstormResult: BrainstormResult,
  modelId: string,
  agentModelMapping?: Record<string, string>,
  jobId?: string
): Promise<{ jobId: string }> {
  console.log(`🔍 [V2-START] Starting V2 tool creation with unified BrainstormResult`);
  console.log(`🔍 [V2-START] Brainstorm ID: ${brainstormResult.id}, Model: ${modelId}`);
  
  if (jobId) {
    console.log(`🔍 [V2-START] Using provided jobId: ${jobId}`);
  } else {
    console.log(`⚠️ [V2-START] No jobId provided - server will generate new one`);
  }

  // --- PHASE 2: DIRECT ACCESS TO UNIFIED STRUCTURE ---
  // No more complex extraction - direct access to typed data
  const description = (brainstormResult.userInput as any).businessContext;
  if (!description || description.trim().length === 0) {
    throw new Error('Description is required but was empty');
  }
  
  console.log('🔍 [V2-START] Using description:', description);
  console.log('🔍 [V2-START] Brainstorm data keys:', Object.keys(brainstormResult.brainstormData as any));
  
  // --- PHASE 2: DIRECT VALIDATION ---
  // Validate that all required fields are present in the brainstorm data
  const brainstormData = brainstormResult.brainstormData as any;
  const requiredFields = [
    'valueProposition',
    'keyCalculations', 
    'interactionFlow',
    'leadCaptureStrategy',
    'creativeEnhancements',
    'suggestedInputs',
    'calculationLogic',
    'promptOptions'
  ];
  
  const missingFields = requiredFields.filter(field => {
    const value = brainstormData[field];
    return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
  });
  
  if (missingFields.length > 0) {
    console.error('🚨 [V2-START] CRITICAL VALIDATION FAILURE - Missing required brainstorm fields:', missingFields);
    console.error('🚨 [V2-START] Available fields:', Object.keys(brainstormData));
    
    throw new Error(`CRITICAL BRAINSTORM DATA VALIDATION FAILURE: Missing required fields: ${missingFields.join(', ')}. This indicates a problem with the brainstorm generation process.`);
  }
  
  console.log('✅ [V2-START] All required brainstorm fields are present and valid');

  const requestBody = {
    jobId: jobId,
    userInput: {
      description: description.trim(),
      targetAudience: (brainstormResult.userInput as any).targetAudience,
      industry: (brainstormResult.userInput as any).industry,
      toolType: (brainstormResult.userInput as any).toolType,
      features: [] // No features in unified structure
    },
    selectedModel: modelId,
    agentModelMapping: agentModelMapping || {},
    brainstormData: brainstormData, // Direct access to validated data
    testingOptions: {
      enableWebSocketStreaming: true,
      enableTccOperations: true,
      enableOrchestrationTriggers: true
    }
  };

  console.log('🔍 [V2-START] Request body created with unified structure');

  const response = await fetch('/api/ai/product-tool-creation-v2/orchestrate/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const responseData = await response.json();

  if (!response.ok || !responseData.success) {
    const errorMessage = responseData.error || responseData.message || `HTTP ${response.status}: ${response.statusText}`;
    console.error(`[V2 Start] API error response:`, responseData);
    throw new Error(errorMessage);
  }

  console.log(`🔍 [V2-START] Response jobId: ${responseData.jobId}`);
  return { jobId: responseData.jobId };
}

export async function runToolCreationProcess(
  brainstormInput: BrainstormResult | any,
  selectedModelId: string,
  agentModelMapping?: Record<string, string>,
  jobId?: string
): Promise<ToolCreationJob> {
  let job: ToolCreationJob = {
    modelId: selectedModelId,
    status: 'loading',
    startTime: Date.now(),
    jobId: jobId,
  };
  
  try {
    let brainstormResult: BrainstormResult;
    
    if (isBrainstormResult(brainstormInput)) {
      brainstormResult = brainstormInput;
      console.log('🔍 [TOOL-CREATION] Using new unified BrainstormResult format');
    } else {
      console.error('🚨 [TOOL-CREATION] BRAINSTORM INPUT IS NOT IN UNIFIED FORMAT!');
      console.error('🚨 [TOOL-CREATION] Input data:', JSON.stringify(brainstormInput, null, 2));
      console.error('🚨 [TOOL-CREATION] This indicates a problem with brainstorm generation or storage!');
      
      // NO FALLBACK - Let it fail to expose the real problem
      throw new Error('BRAINSTORM DATA FORMAT ERROR: Input is not in unified BrainstormResult format. This indicates a problem with brainstorm generation or storage. Check the console for detailed input data.');
    }

    const { jobId: returnedJobId } = await startV2ToolCreation(
      brainstormResult, 
      selectedModelId, 
      agentModelMapping,
      jobId
    );
    
    job = {
      ...job,
      jobId: returnedJobId,
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
    const jobId = tcc.jobId || 'unknown';
    
    // 🔍 LOG INITIAL TCC STATE
    console.log(`🔍 [FINALIZATION-START] JobId: ${jobId}`);
    console.log(`🔍 [FINALIZATION-START] Initial TCC Keys:`, Object.keys(tcc || {}).join(', '));
    console.log(`🔍 [FINALIZATION-START] Initial TCC Structure:`, {
      hasJsxLayout: !!tcc?.jsxLayout,
      hasStateLogic: !!tcc?.stateLogic,
      hasStyling: !!tcc?.styling,
      hasAssembledCode: !!tcc?.assembledComponentCode,
      hasFinalProduct: !!tcc?.finalProduct,
      brainstormDataKeys: tcc?.brainstormData ? Object.keys(tcc.brainstormData) : [],
      stepStatus: tcc?.stepStatus || {},
    });

    // 📊 CONSOLE LOGGING - FINALIZATION START
    console.log('🔍 [TCC-FINALIZATION] Starting finalization process', {
      jobId,
      phase: 'finalization_start',
      tccKeys: Object.keys(tcc || {}),
      initialTccStructure: {
        hasJsxLayout: !!tcc?.jsxLayout,
        hasStateLogic: !!tcc?.stateLogic,
        hasStyling: !!tcc?.styling,
        hasAssembledCode: !!tcc?.assembledComponentCode,
        hasFinalProduct: !!tcc?.finalProduct,
        brainstormDataPresent: !!tcc?.brainstormData,
      }
    });
    
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
    
    // 🔍 LOG TCC AFTER ASSEMBLY
    console.log(`🔍 [FINALIZATION-ASSEMBLY] TCC Keys:`, Object.keys(updatedTccAfterAssembly || {}).join(', '));
    console.log(`🔍 [FINALIZATION-ASSEMBLY] TCC Structure:`, {
      hasJsxLayout: !!updatedTccAfterAssembly?.jsxLayout,
      hasStateLogic: !!updatedTccAfterAssembly?.stateLogic,
      hasStyling: !!updatedTccAfterAssembly?.styling,
      hasAssembledCode: !!updatedTccAfterAssembly?.assembledComponentCode,
      assembledCodeLength: updatedTccAfterAssembly?.assembledComponentCode?.length || 0,
      hasFinalProduct: !!updatedTccAfterAssembly?.finalProduct,
    });

    // 📊 CONSOLE LOGGING - AFTER ASSEMBLY
    console.log('🔍 [TCC-FINALIZATION] Component Assembly completed', {
      jobId,
      phase: 'after_assembly',
      tccKeys: Object.keys(updatedTccAfterAssembly || {}),
      tccStructure: {
        hasJsxLayout: !!updatedTccAfterAssembly?.jsxLayout,
        hasStateLogic: !!updatedTccAfterAssembly?.stateLogic,
        hasStyling: !!updatedTccAfterAssembly?.styling,
        hasAssembledCode: !!updatedTccAfterAssembly?.assembledComponentCode,
        assembledCodeLength: updatedTccAfterAssembly?.assembledComponentCode?.length || 0,
        hasFinalProduct: !!updatedTccAfterAssembly?.finalProduct,
      }
    });
    
    console.log('✅ Component Assembly completed');
    
    // Step 2: Validation
    console.log('🔍 Starting Validation...');
    
    // Debug: Log what we're sending to the validator
    console.log('🔍 VALIDATOR DEBUG - Request payload:', {
      jobId: tcc.jobId,
      selectedModel: agentModelMapping?.['validator'],
      hasTcc: !!updatedTccAfterAssembly,
      tccKeys: updatedTccAfterAssembly ? Object.keys(updatedTccAfterAssembly) : [],
      assembledCodeLength: updatedTccAfterAssembly?.assembledComponentCode?.length || 0,
      isIsolatedTest: true
    });
    
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
    
    console.log('🔍 VALIDATOR DEBUG - Response status:', validatorResponse.status, validatorResponse.statusText);
    
    if (!validatorResponse.ok) {
      const errorText = await validatorResponse.text();
      console.log('🔍 VALIDATOR DEBUG - Error response body:', errorText);
      throw new Error(`Validator failed: ${validatorResponse.statusText}`);
    }
    
    const validatorResult = await validatorResponse.json();
    if (!validatorResult.success) {
      throw new Error(`Validator error: ${validatorResult.error}`);
    }
    
    intermediateResults.validationResult = validatorResult.validationResult;
    const updatedTccAfterValidation = validatorResult.updatedTcc;
    
    // 🔍 LOG TCC AFTER VALIDATION
    console.log(`🔍 [FINALIZATION-VALIDATION] TCC Keys:`, Object.keys(updatedTccAfterValidation || {}).join(', '));
    console.log(`🔍 [FINALIZATION-VALIDATION] TCC Structure:`, {
      hasJsxLayout: !!updatedTccAfterValidation?.jsxLayout,
      hasStateLogic: !!updatedTccAfterValidation?.stateLogic,
      hasStyling: !!updatedTccAfterValidation?.styling,
      hasAssembledCode: !!updatedTccAfterValidation?.assembledComponentCode,
      assembledCodeLength: updatedTccAfterValidation?.assembledComponentCode?.length || 0,
      hasFinalProduct: !!updatedTccAfterValidation?.finalProduct,
      validationResult: updatedTccAfterValidation?.validationResult?.isValid || false,
    });

    // 📊 CONSOLE LOGGING - AFTER VALIDATION
    console.log('🔍 [TCC-FINALIZATION] Validation completed', {
      jobId,
      phase: 'after_validation',
      tccKeys: Object.keys(updatedTccAfterValidation || {}),
      tccStructure: {
        hasJsxLayout: !!updatedTccAfterValidation?.jsxLayout,
        hasStateLogic: !!updatedTccAfterValidation?.stateLogic,
        hasStyling: !!updatedTccAfterValidation?.styling,
        hasAssembledCode: !!updatedTccAfterValidation?.assembledComponentCode,
        assembledCodeLength: updatedTccAfterValidation?.assembledComponentCode?.length || 0,
        hasFinalProduct: !!updatedTccAfterValidation?.finalProduct,
        validationResult: updatedTccAfterValidation?.validationResult?.isValid || false,
      }
    });
    
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
    
    // 🔍 LOG FINAL TCC STATE
    const finalTcc = finalizerResult.updatedTcc;
    console.log(`🔍 [FINALIZATION-COMPLETE] Final TCC Keys:`, Object.keys(finalTcc || {}).join(', '));
    console.log(`🔍 [FINALIZATION-COMPLETE] Final TCC Structure:`, {
      hasJsxLayout: !!finalTcc?.jsxLayout,
      hasStateLogic: !!finalTcc?.stateLogic,
      hasStyling: !!finalTcc?.styling,
      hasAssembledCode: !!finalTcc?.assembledComponentCode,
      assembledCodeLength: finalTcc?.assembledComponentCode?.length || 0,
      hasFinalProduct: !!finalTcc?.finalProduct,
      finalProductLength: finalTcc?.finalProduct?.componentCode?.length || 0,
    });
    
    // Log final product details
    if (finalizerResult.finalProduct) {
      console.log(`🔍 [FINALIZATION-COMPLETE] Final Product:`, {
        hasComponentCode: !!finalizerResult.finalProduct.componentCode,
        componentCodeLength: finalizerResult.finalProduct.componentCode?.length || 0,
        hasMetadata: !!finalizerResult.finalProduct.metadata,
        toolName: finalizerResult.finalProduct.metadata?.name || 'unknown',
        description: finalizerResult.finalProduct.metadata?.description || 'no description',
      });
    }

    // 📊 CONSOLE LOGGING - FINALIZATION COMPLETE
    console.log('🔍 [TCC-FINALIZATION] Finalization process completed successfully', {
      jobId,
      phase: 'finalization_complete',
      finalTccKeys: Object.keys(finalTcc || {}),
      finalTccStructure: {
        hasJsxLayout: !!finalTcc?.jsxLayout,
        hasStateLogic: !!finalTcc?.stateLogic,
        hasStyling: !!finalTcc?.styling,
        hasAssembledCode: !!finalTcc?.assembledComponentCode,
        assembledCodeLength: finalTcc?.assembledComponentCode?.length || 0,
        hasFinalProduct: !!finalTcc?.finalProduct,
        finalProductLength: finalTcc?.finalProduct?.componentCode?.length || 0,
      },
      finalProduct: finalizerResult.finalProduct ? {
        hasComponentCode: !!finalizerResult.finalProduct.componentCode,
        componentCodeLength: finalizerResult.finalProduct.componentCode?.length || 0,
        hasMetadata: !!finalizerResult.finalProduct.metadata,
        toolName: finalizerResult.finalProduct.metadata?.name || 'unknown',
        description: finalizerResult.finalProduct.metadata?.description || 'no description',
      } : null
    });
    
    console.log('✅ Tool Finalization completed');
    
    return {
      success: true,
      finalProduct: finalizerResult.finalProduct,
      intermediateResults
    };
    
  } catch (error) {
    console.error('❌ TCC Finalization Steps Failed:', error);
    console.log(`🔍 [FINALIZATION-ERROR] Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // 📊 CONSOLE LOGGING - FINALIZATION ERROR
    console.error('🔍 [TCC-FINALIZATION] Finalization process failed', {
      jobId: tcc?.jobId || 'unknown',
      phase: 'finalization_error',
      error: error instanceof Error ? error.message : String(error),
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function runIsolatedAgentTest(
  params: {
    userId: string;
    agentId: string;
    modelId: string;
    tccSource: string;
    brainstormId?: string;
    mockScenarioId?: string;
    savedV2JobId?: string;
    agentMode: string;
    editMessage?: string;
    currentTcc?: any;
  },
  addLog: (type: 'debug' | 'error', message: string, data?: any) => void
): Promise<{ success: boolean; data?: any; error?: string } | undefined> {
  const {
    userId,
    agentId,
    modelId,
    tccSource,
    brainstormId,
    mockScenarioId,
    savedV2JobId,
    agentMode,
    editMessage,
    currentTcc
  } = params;

  addLog('debug', `Starting isolated test for agent: ${agentId}`, params);

  try {
    // Import required utilities
    const { loadLogicResultsFromDB, loadV2JobsFromDB } = await import('../../ui/db-utils');
    const { getScenarioById } = await import('@/lib/testing/mock-tcc-scenarios');
    const { v4: uuidv4 } = await import('uuid');

    // 1. Get the base TCC data based on the selected source
    let tcc: any;
    if (tccSource === 'brainstorm') {
      if (!brainstormId) throw new Error('Brainstorm ID is required for brainstorm TCC source.');
      const brainstorms = await loadLogicResultsFromDB();
      const selectedBrainstorm = brainstorms.find((b: any) => b.id === brainstormId);
      if (!selectedBrainstorm) throw new Error(`Brainstorm with ID ${brainstormId} not found.`);
      tcc = {
        userId,
        jobId: `debug-${uuidv4()}`,
        userInput: selectedBrainstorm.userInput || {},
        brainstormData: selectedBrainstorm.brainstormData || {},
        stepStatus: {}
      };
      addLog('debug', 'Loaded TCC from brainstorm', { id: brainstormId });
    } else if (tccSource === 'mockScenario') {
      if (!mockScenarioId) throw new Error('Mock Scenario ID is required.');
      const scenario = getScenarioById(mockScenarioId);
      if (!scenario) throw new Error(`Mock scenario with ID ${mockScenarioId} not found.`);
      tcc = scenario.tcc;
      addLog('debug', 'Loaded TCC from mock scenario', { id: mockScenarioId });
    } else if (tccSource === 'savedV2Job') {
      if (!savedV2JobId) throw new Error('Saved V2 Job ID is required.');
      const v2Jobs = await loadV2JobsFromDB();
      const selectedJob = v2Jobs.find((j: any) => j.id === savedV2JobId);
      if (!selectedJob) throw new Error(`V2 Job with ID ${savedV2JobId} not found.`);
      tcc = selectedJob.toolConstructionContext;
      addLog('debug', 'Loaded TCC from saved V2 Job', { id: savedV2JobId });
    } else {
      throw new Error(`Invalid TCC source: ${tccSource}`);
    }

    // If in edit mode, ensure the current TCC data is used.
    if (agentMode === 'edit' && currentTcc) {
      tcc = { ...currentTcc }; // Use the most recent TCC from the state
      addLog('debug', 'Running in EDIT mode, using current TCC data from state.', { keys: Object.keys(tcc) });
    }
    
    // 2. Prepare the request body
    const requestBody = {
      jobId: tcc.jobId,
      model: modelId,
      tcc,
      isEditMode: agentMode === 'edit',
      editInstructions: agentMode === 'edit' ? editMessage : undefined,
    };

    addLog('debug', `Sending request to /api/ai/product-tool-creation-v2/agents/${agentId}`, requestBody);

    // 3. Make the API call
    const response = await fetch(`/api/ai/product-tool-creation-v2/agents/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMsg = responseData.error || `Agent ${agentId} failed with status ${response.status}`;
      addLog('error', errorMsg, responseData);
      return { success: false, error: errorMsg, data: responseData };
    }

    addLog('debug', `Agent ${agentId} test successful`, responseData);
    return { success: true, data: responseData };

  } catch (err: any) {
    const errorMsg = err.message || 'An unknown error occurred during the isolated agent test.';
    addLog('error', errorMsg, err);
    return { success: false, error: errorMsg };
  }
}