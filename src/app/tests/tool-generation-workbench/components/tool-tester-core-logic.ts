import { loadLogicResultsFromDB } from '../../ui/db-utils';
import type { SavedLogicResult } from '../../ui/types';
import { ProductToolDefinition } from '@/lib/types/product-tool';

// Using console logging for test utilities

export { loadLogicResultsFromDB };
export type { SavedLogicResult };

export interface ToolCreationJob {
  modelId: string;
  jobId?: string;
  status: 'pending' | 'loading' | 'success' | 'error' | 'completed';
  result?: ProductToolDefinition | null;
  error?: string | null;
  startTime?: number;
  endTime?: number;
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
  brainstormResult: SavedLogicResult,
  modelId: string,
  agentModelMapping?: Record<string, string>,
  jobId?: string // NEW: Accept optional jobId
): Promise<{ jobId: string }> {
  console.log(`Requesting V2 tool creation with model: ${modelId} for brainstorm: ${brainstormResult.id}`);
  
  // CRITICAL FIX: Log the jobId being passed
  if (jobId) {
    console.log(`🔍 [V2-START] Using provided jobId: ${jobId}`);
  } else {
    console.log(`⚠️ [V2-START] No jobId provided - server will generate new one`);
  }

  const userInputData = brainstormResult.result?.userInput || {};
  
  // Debug log the entire brainstorm result
  console.log('🔍 [V2-START] Full brainstorm result:', JSON.stringify(brainstormResult, null, 2));
  console.log('🔍 [V2-START] User input data:', JSON.stringify(userInputData, null, 2));
  
  // Get description and validate it's not empty
  const description = userInputData.businessContext || 'Tool creation request';
  if (!description || description.trim().length === 0) {
    throw new Error('Description is required but was empty');
  }
  
  console.log('🔍 [V2-START] Using description:', description);
  
  // 🎯 NEW: Direct brainstorm data extraction - no transformation needed
  // Logic Architect now generates data in correct V2 format when called with 'v2' parameter
  console.log('🔍 [V2-START] Extracting brainstorm data directly from result...');
  
  // ENHANCED DEBUGGING: Log the complete structure
  console.log('🔍 [V2-START] Complete brainstormResult structure analysis:', {
    id: brainstormResult.id,
    timestamp: brainstormResult.timestamp,
    toolType: brainstormResult.toolType,
    hasResult: !!brainstormResult.result,
    resultType: typeof brainstormResult.result,
    resultKeys: brainstormResult.result ? Object.keys(brainstormResult.result) : [],
    hasUserInput: !!brainstormResult.result?.userInput,
    userInputKeys: brainstormResult.result?.userInput ? Object.keys(brainstormResult.result.userInput) : [],
    hasBrainstormOutput: !!brainstormResult.result?.brainstormOutput,
    brainstormOutputType: brainstormResult.result?.brainstormOutput ? typeof brainstormResult.result.brainstormOutput : 'undefined',
    brainstormOutputIsNull: brainstormResult.result?.brainstormOutput === null,
    brainstormOutputIsUndefined: brainstormResult.result?.brainstormOutput === undefined,
    brainstormOutputKeys: brainstormResult.result?.brainstormOutput && typeof brainstormResult.result.brainstormOutput === 'object' 
      ? Object.keys(brainstormResult.result.brainstormOutput) : []
  });
  
    // Check if this is new V2 format data - FLEXIBLE MODE: Handle both structures
  let actualBrainstormData = brainstormResult.result?.brainstormOutput || (brainstormResult as any).brainstormOutput;
  
  if (!actualBrainstormData) {
    console.error('🚨 [V2-START] No brainstorm data found in either location');
    console.error('🚨 [V2-START] Original brainstormResult structure:', JSON.stringify(brainstormResult, null, 2));
    console.error('🚨 [V2-START] Checked locations:', {
      hasResult: !!brainstormResult.result,
      resultKeys: brainstormResult.result ? Object.keys(brainstormResult.result) : [],
      hasBrainstormOutputInResult: !!brainstormResult.result?.brainstormOutput,
      hasBrainstormOutputDirect: !!(brainstormResult as any).brainstormOutput,
      hasUserInput: !!brainstormResult.result?.userInput,
      directBrainstormOutputValue: (brainstormResult as any).brainstormOutput,
      nestedBrainstormOutputValue: brainstormResult.result?.brainstormOutput,
      directBrainstormOutputType: typeof (brainstormResult as any).brainstormOutput,
      nestedBrainstormOutputType: typeof brainstormResult.result?.brainstormOutput
    });
    throw new Error('CRITICAL: No brainstormOutput found in either result.brainstormOutput or direct brainstormOutput - brainstorm generation failed or data corruption occurred');
  }
  
  console.log('🔍 [V2-START] Using brainstorm data:', JSON.stringify(actualBrainstormData, null, 2));

  const requestBody = {
    jobId: jobId,
    userInput: {
      description: description.trim(),
      targetAudience: brainstormResult.targetAudience,
      industry: brainstormResult.industry,
      toolType: brainstormResult.toolType,
      features: userInputData.features || []
    },
    selectedModel: modelId,
    agentModelMapping: agentModelMapping || {},
    brainstormData: actualBrainstormData, // FIXED: Use the actual brainstorm data, not the wrapper
    testingOptions: {
      enableWebSocketStreaming: true,
      enableTccOperations: true,
      enableOrchestrationTriggers: true
    }
  };

  console.log('🔍 [V2-START] Full request body:', JSON.stringify(requestBody, null, 2));

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

// this must be the legacy tool creation process
// this must be the legacy tool creation process
export async function runToolCreationProcess(
  brainstormResult: SavedLogicResult,
  selectedModelId: string,
  agentModelMapping?: Record<string, string>,
  jobId?: string // NEW: Accept optional jobId
): Promise<ToolCreationJob> {
  let job: ToolCreationJob = {
    modelId: selectedModelId,
    status: 'loading',
    startTime: Date.now(),
    jobId: jobId, // Set the jobId immediately if provided
  };
  
  try {
    const { jobId: returnedJobId } = await startV2ToolCreation(
      brainstormResult, 
      selectedModelId, 
      agentModelMapping,
      jobId // CRITICAL: Pass the jobId to ensure consistency
    );
    job = {
      ...job,
      jobId: returnedJobId, // This should be the same as the input jobId
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
  agentId: string,
  tcc: any,
  modelId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 🔍 LOG TCC BEFORE PROCESSING
    const jobId = tcc.jobId || 'debug';
    console.log(`🔍 [TCC-BEFORE] Agent: ${agentId} | JobId: ${jobId}`);
    console.log(`🔍 [TCC-BEFORE] TCC Keys:`, Object.keys(tcc || {}).join(', '));
    console.log(`🔍 [TCC-BEFORE] TCC Structure:`, {
      hasJsxLayout: !!tcc?.jsxLayout,
      hasStateLogic: !!tcc?.stateLogic,
      hasStyling: !!tcc?.styling,
      hasAssembledCode: !!tcc?.assembledComponentCode,
      hasFinalProduct: !!tcc?.finalProduct,
      brainstormDataKeys: tcc?.brainstormData ? Object.keys(tcc.brainstormData) : [],
      stepStatus: tcc?.stepStatus || {},
      tccVersion: tcc?.tccVersion || 'unknown'
    });
    
    // Log a hash/summary of the TCC for comparison
    const tccSummary = JSON.stringify({
      jsxLayoutLength: tcc?.jsxLayout?.componentStructure?.length || 0,
      stateLogicKeys: tcc?.stateLogic ? Object.keys(tcc.stateLogic) : [],
      stylingKeys: tcc?.styling ? Object.keys(tcc.styling) : [],
      assembledCodeLength: tcc?.assembledComponentCode?.length || 0,
      finalProductLength: tcc?.finalProduct?.componentCode?.length || 0,
    });
    console.log(`🔍 [TCC-BEFORE] Content Summary:`, tccSummary);

    // 📊 CONSOLE LOGGING - BEFORE PROCESSING
    console.log(`🔍 [TCC-ISOLATION] Agent ${agentId} - TCC state before processing`, {
      agentId,
      jobId,
      phase: 'before_processing',
      tccKeys: Object.keys(tcc || {}),
      tccStructure: {
        hasJsxLayout: !!tcc?.jsxLayout,
        hasStateLogic: !!tcc?.stateLogic,
        hasStyling: !!tcc?.styling,
        hasAssembledCode: !!tcc?.assembledComponentCode,
        hasFinalProduct: !!tcc?.finalProduct,
        brainstormDataPresent: !!tcc?.brainstormData,
      },
      contentSummary: {
        jsxLayoutLength: tcc?.jsxLayout?.componentStructure?.length || 0,
        stateLogicKeys: tcc?.stateLogic ? Object.keys(tcc.stateLogic) : [],
        stylingKeys: tcc?.styling ? Object.keys(tcc.styling) : [],
        assembledCodeLength: tcc?.assembledComponentCode?.length || 0,
        finalProductLength: tcc?.finalProduct?.componentCode?.length || 0,
      }
    });

    const response = await fetch(`/api/ai/product-tool-creation-v2/agents/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: jobId,
        selectedModel: modelId,
        mockTcc: tcc,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Agent ${agentId} failed with status ${response.status}`);
    }

    const result = await response.json();
    
    // 🔍 LOG TCC AFTER PROCESSING
    const updatedTcc = result?.updatedTcc;
    console.log(`🔍 [TCC-AFTER] Agent: ${agentId} | JobId: ${jobId}`);
    console.log(`🔍 [TCC-AFTER] TCC Keys:`, Object.keys(updatedTcc || {}).join(', '));
    console.log(`🔍 [TCC-AFTER] TCC Structure:`, {
      hasJsxLayout: !!updatedTcc?.jsxLayout,
      hasStateLogic: !!updatedTcc?.stateLogic,
      hasStyling: !!updatedTcc?.styling,
      hasAssembledCode: !!updatedTcc?.assembledComponentCode,
      hasFinalProduct: !!updatedTcc?.finalProduct,
      brainstormDataKeys: updatedTcc?.brainstormData ? Object.keys(updatedTcc.brainstormData) : [],
      stepStatus: updatedTcc?.stepStatus || {},
      tccVersion: updatedTcc?.tccVersion || 'unknown'
    });
    
    // Log updated content summary for comparison
    const updatedTccSummary = JSON.stringify({
      jsxLayoutLength: updatedTcc?.jsxLayout?.componentStructure?.length || 0,
      stateLogicKeys: updatedTcc?.stateLogic ? Object.keys(updatedTcc.stateLogic) : [],
      stylingKeys: updatedTcc?.styling ? Object.keys(updatedTcc.styling) : [],
      assembledCodeLength: updatedTcc?.assembledComponentCode?.length || 0,
      finalProductLength: updatedTcc?.finalProduct?.componentCode?.length || 0,
    });
    console.log(`🔍 [TCC-AFTER] Content Summary:`, updatedTccSummary);
    
    // Log differences detected
    const hasDifferences = tccSummary !== updatedTccSummary;
    console.log(`🔍 [TCC-DIFF] Changes Detected: ${hasDifferences ? 'YES' : 'NO'}`);
    if (hasDifferences) {
      console.log(`🔍 [TCC-DIFF] Before: ${tccSummary}`);
      console.log(`🔍 [TCC-DIFF] After:  ${updatedTccSummary}`);
    }

    // 📊 CONSOLE LOGGING - AFTER PROCESSING
    console.log(`🔍 [TCC-ISOLATION] Agent ${agentId} - TCC state after processing (changes: ${hasDifferences ? 'YES' : 'NO'})`, {
      agentId,
      jobId,
      phase: 'after_processing',
      tccKeys: Object.keys(updatedTcc || {}),
      tccStructure: {
        hasJsxLayout: !!updatedTcc?.jsxLayout,
        hasStateLogic: !!updatedTcc?.stateLogic,
        hasStyling: !!updatedTcc?.styling,
        hasAssembledCode: !!updatedTcc?.assembledComponentCode,
        hasFinalProduct: !!updatedTcc?.finalProduct,
        brainstormDataPresent: !!updatedTcc?.brainstormData,
      },
      contentSummary: {
        jsxLayoutLength: updatedTcc?.jsxLayout?.componentStructure?.length || 0,
        stateLogicKeys: updatedTcc?.stateLogic ? Object.keys(updatedTcc.stateLogic) : [],
        stylingKeys: updatedTcc?.styling ? Object.keys(updatedTcc.styling) : [],
        assembledCodeLength: updatedTcc?.assembledComponentCode?.length || 0,
        finalProductLength: updatedTcc?.finalProduct?.componentCode?.length || 0,
      },
      changesDetected: hasDifferences,
      summaryComparison: {
        before: tccSummary,
        after: updatedTccSummary
      }
    });

    return { success: true, data: result };
  } catch (error) {
    console.log(`🔍 [TCC-ERROR] Agent: ${agentId} | Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // 📊 CONSOLE LOGGING - ERROR
    console.error(`🔍 [TCC-ISOLATION] Agent ${agentId} - Processing failed`, {
      agentId,
      jobId: tcc.jobId || 'debug',
      phase: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
    
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}