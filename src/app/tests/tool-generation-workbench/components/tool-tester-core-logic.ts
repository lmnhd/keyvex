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
  console.log(`🔍 [UNIFIED-WORKFLOW] Starting unified workflow with sequential agent execution`);
  console.log(`🔍 [UNIFIED-WORKFLOW] Brainstorm ID: ${brainstormResult.id}, Model: ${modelId}`);
  
  const actualJobId = jobId || `workflow-${Date.now()}`;
  
  // Create initial TCC from brainstorm data for unified workflow
  const initialTcc = {
    userId: 'workbench-user', // BrainstormResult doesn't have userId property
    jobId: actualJobId,
    userInput: brainstormResult.userInput || {},
    brainstormData: brainstormResult.brainstormData || {},
    stepStatus: {},
    agentModelMapping: agentModelMapping || { 'default': modelId },
    status: 'in_progress',
    currentOrchestrationStep: 'planning_function_signatures',
    targetAudience: brainstormResult.userInput?.targetAudience || 'General users',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: {}
  };

  try {
    // Execute all 7 agents in sequence using the unified architecture
    const agentSequence = [
      'function-planner',
      'state-design', 
      'jsx-layout',
      'tailwind-styling',
      'component-assembler',
      'code-validator',
      'tool-finalizer'
    ];

    // Map agent types to valid step names for emitStepProgress
    const stepNameMapping: Record<string, string> = {
      'function-planner': 'planning_function_signatures',
      'state-design': 'designing_state_logic',
      'jsx-layout': 'designing_jsx_layout',
      'tailwind-styling': 'applying_tailwind_styling',
      'component-assembler': 'assembling_component',
      'code-validator': 'validating_code',
      'tool-finalizer': 'finalizing_tool'
    };

    let currentTcc = initialTcc;
    
    console.log(`🚀 [UNIFIED-WORKFLOW] Starting sequential execution of ${agentSequence.length} agents`);

    for (let i = 0; i < agentSequence.length; i++) {
      const agentType = agentSequence[i];
      const agentModel = agentModelMapping?.[agentType] || modelId;
      
      console.log(`🔄 [UNIFIED-WORKFLOW] Step ${i + 1}/${agentSequence.length}: Executing ${agentType} with model ${agentModel}`);
      
      const requestBody = {
        jobId: actualJobId,
        agentType: agentType,
        selectedModel: agentModel,
        tcc: currentTcc,
        isIsolatedTest: false, // This is full workflow, not isolated testing
        retryAttempt: 0
      };

      const response = await fetch('/api/ai/agents/universal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Agent ${agentType} failed: ${errorData.error || 'Unknown error'}`);
      }

      const agentResult = await response.json();
      
      if (!agentResult.success) {
        throw new Error(`Agent ${agentType} execution failed: ${agentResult.error}`);
      }

      // Update TCC with the agent's result for next step
      currentTcc = agentResult.updatedTcc;
      
      console.log(`✅ [UNIFIED-WORKFLOW] ${agentType} completed successfully - TCC updated for next step`);
    }

    console.log(`🎉 [UNIFIED-WORKFLOW] All agents completed successfully! Job ID: ${actualJobId}`);
    
    return { jobId: actualJobId };
    
  } catch (error) {
    console.error(`❌ [UNIFIED-WORKFLOW] Workflow failed:`, error);
    throw error;
  }
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
    
    // Execute the final 3 agents in sequence using the unified architecture
    const finalizationAgents = ['component-assembler', 'code-validator', 'tool-finalizer'];
    let currentTcc = { ...tcc };
    
    for (let i = 0; i < finalizationAgents.length; i++) {
      const agentType = finalizationAgents[i];
      const agentModel = agentModelMapping?.[agentType] || 'claude-3-7-sonnet-20250219';
      
      console.log(`🔧 [FINALIZATION] Step ${i + 1}/3: ${agentType}...`);
      
      const response = await fetch('/api/ai/agents/universal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: currentTcc.jobId,
          agentType: agentType,
          selectedModel: agentModel,
          tcc: currentTcc,
          isIsolatedTest: true // Prevent triggering next step automatically
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`${agentType} failed: ${errorData.error || 'Unknown error'}`);
      }
      
      const agentResult = await response.json();
      if (!agentResult.success) {
        throw new Error(`${agentType} error: ${agentResult.error}`);
      }
      
      // Store intermediate results and update TCC
      if (agentType === 'component-assembler') {
        intermediateResults.assembledComponent = agentResult.result;
      } else if (agentType === 'code-validator') {
        intermediateResults.validationResult = agentResult.result;
      }
      
      currentTcc = agentResult.updatedTcc;
      
      // 🔍 LOG TCC AFTER EACH STEP
      console.log(`🔍 [FINALIZATION-${agentType.toUpperCase()}] TCC Keys:`, Object.keys(currentTcc || {}).join(', '));
      console.log(`🔍 [FINALIZATION-${agentType.toUpperCase()}] TCC Structure:`, {
        hasJsxLayout: !!currentTcc?.jsxLayout,
        hasStateLogic: !!currentTcc?.stateLogic,
        hasStyling: !!currentTcc?.styling,
        hasAssembledCode: !!currentTcc?.assembledComponentCode,
        assembledCodeLength: currentTcc?.assembledComponentCode?.length || 0,
        hasFinalProduct: !!currentTcc?.finalProduct,
        hasValidationResult: !!currentTcc?.validationResult,
      });

      console.log(`✅ [FINALIZATION] ${agentType} completed successfully`);
    }
    
    // Extract final product from the tool-finalizer result
    const finalProduct = currentTcc?.finalProduct;
    
    if (!finalProduct) {
      throw new Error('Tool finalization did not produce a final product');
    }

    console.log('🎉 [TCC-FINALIZATION] All finalization steps completed successfully');
    
    return {
      success: true,
      finalProduct,
      intermediateResults
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [TCC-FINALIZATION] Finalization failed:', errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      intermediateResults: {}
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
    
    // 🎯 CRITICAL FIX: Check if we have in-memory TCC data from previous agents
    // This enables TRUE SEQUENTIAL TESTING where agents build on each other's work
    const hasValidInMemoryTcc = currentTcc && 
      currentTcc.jobId && 
      currentTcc.brainstormData && 
      currentTcc.userInput;
    
    // 🚨 SEQUENTIAL MODE: If we have valid in-memory TCC, use it instead of starting fresh
    if (hasValidInMemoryTcc && tccSource !== 'mockScenario' && tccSource !== 'savedV2Job') {
      addLog('debug', '🔄 SEQUENTIAL MODE DETECTED: Using in-memory TCC with previous agent results');
      addLog('debug', `📋 Current TCC state: jobId=${currentTcc.jobId?.slice(0, 8)}..., hasFunction=${!!currentTcc.definedFunctionSignatures}, hasState=${!!currentTcc.stateLogic}, hasLayout=${!!currentTcc.jsxLayout}, hasStyling=${!!currentTcc.styling}`);
      
      tcc = {
        ...currentTcc,
        // ✅ Ensure agentModelMapping includes current agent
        agentModelMapping: {
          ...currentTcc.agentModelMapping,
          [agentId]: modelId
        }
      };
      
      addLog('debug', `✅ SEQUENTIAL TCC LOADED: Building on existing work (Function Sigs: ${currentTcc.definedFunctionSignatures?.length || 0}, State Vars: ${currentTcc.stateLogic?.variables?.length || 0})`);
    }
    // 🔧 FRESH START MODE: Only create new TCC if no valid in-memory data exists
    else if (tccSource === 'brainstorm') {
      if (!brainstormId) throw new Error('Brainstorm ID is required for brainstorm TCC source.');
      const brainstorms = await loadLogicResultsFromDB();
      const selectedBrainstorm = brainstorms.find((b: any) => b.id === brainstormId);
      if (!selectedBrainstorm) throw new Error(`Brainstorm with ID ${brainstormId} not found.`);
      
      addLog('debug', '🆕 FRESH START MODE: Creating new TCC from brainstorm data');
      
      tcc = {
        userId,
        jobId: `debug-${uuidv4()}`,
        userInput: selectedBrainstorm.userInput || {},
        brainstormData: selectedBrainstorm.brainstormData || {},
        stepStatus: {},
        // ✅ CRITICAL FIX: Add agentModelMapping required by agents
        agentModelMapping: {
          [agentId]: modelId
        },
        // ✅ Add other essential TCC fields that agents expect
        status: 'in_progress',
        currentOrchestrationStep: 'planning_function_signatures',
        targetAudience: selectedBrainstorm.userInput?.targetAudience || 'General users',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: {}
      };
      addLog('debug', 'Loaded TCC from brainstorm', { id: brainstormId });
    } else if (tccSource === 'mockScenario') {
      if (!mockScenarioId) throw new Error('Mock Scenario ID is required.');
      const scenario = getScenarioById(mockScenarioId);
      if (!scenario) throw new Error(`Mock scenario with ID ${mockScenarioId} not found.`);
      tcc = {
        ...scenario.tcc,
        // ✅ Ensure agentModelMapping exists for mock scenarios too
        agentModelMapping: {
          ...scenario.tcc.agentModelMapping,
          [agentId]: modelId
        }
      };
      addLog('debug', 'Loaded TCC from mock scenario', { id: mockScenarioId });
    } else if (tccSource === 'savedV2Job') {
      if (!savedV2JobId) throw new Error('Saved V2 Job ID is required.');
      const v2Jobs = await loadV2JobsFromDB();
      const selectedJob = v2Jobs.find((j: any) => j.id === savedV2JobId);
      if (!selectedJob) throw new Error(`V2 Job with ID ${savedV2JobId} not found.`);
      tcc = {
        ...selectedJob.toolConstructionContext,
        // ✅ Ensure agentModelMapping exists and includes current agent
        agentModelMapping: {
          ...selectedJob.toolConstructionContext.agentModelMapping,
          [agentId]: modelId
        }
      };
      addLog('debug', 'Loaded TCC from saved V2 Job', { id: savedV2JobId });
    } else if (tccSource === 'inMemory') {
      if (!currentTcc) {
        throw new Error('No in-memory TCC data available');
      }
      
      // ✅ CRITICAL FIX: Ensure in-memory TCC has ALL essential fields for agent operation
      // The currentTcc from workbench might be a final TCC missing intermediate fields
      addLog('debug', '🔍 IN-MEMORY TCC ANALYSIS - Checking for essential fields');
      
      if (currentTcc.brainstormData && currentTcc.definedFunctionSignatures && currentTcc.userInput) {
        addLog('debug', '✅ IN-MEMORY TCC COMPLETE - All essential fields present');
        tcc = {
          ...currentTcc,
          // ✅ Ensure agentModelMapping exists and includes current agent
          agentModelMapping: {
            ...currentTcc.agentModelMapping,
            [agentId]: modelId
          }
        };
      } else {
        // If still missing essential fields, create minimal required structure
        const enhancedTcc = {
          ...currentTcc,
          // ✅ CRITICAL FIX: Ensure jobId exists for all isolation tests
          jobId: currentTcc.jobId || uuidv4(),
          // ✅ CRITICAL FIX: Add agentModelMapping required by all agents
          agentModelMapping: {
            ...currentTcc.agentModelMapping,
            [agentId]: modelId
          },
          // Ensure essential fields exist with minimal structure
          userInput: currentTcc.userInput || {
            description: "Enhanced tool from in-memory TCC data",
            targetAudience: "General users",
            industry: "General"
          },
          brainstormData: currentTcc.brainstormData || {
            coreConcept: "Tool enhancement from existing data",
            valueProposition: "Improved tool functionality",
            targetAudience: "General users",
            suggestedInputs: [
              {
                label: "Input Value",
                type: "number",
                description: "Primary input for calculations",
                placeholder: "Enter value",
                validation: { required: true, min: 0 }
              }
            ],
            keyCalculations: [
              {
                name: "processValue",
                description: "Process the input value",
                formula: "inputValue * 1.0",
                variables: ["inputValue"]
              }
            ],
            interactionFlow: [
              "User provides input",
              "System processes value", 
              "Results are displayed"
            ]
          },
          definedFunctionSignatures: currentTcc.definedFunctionSignatures || [
            {
              name: "processValue",
              description: "Process the input value with basic calculation",
              parameters: [
                { name: "inputValue", type: "number", description: "The value to process" }
              ],
              returnType: "number",
              implementation: "return inputValue * 1.0;"
            }
          ]
        };
        
        addLog('debug', '🔧 ENHANCED IN-MEMORY TCC - Added minimal required structure for agent operation');
        
        tcc = enhancedTcc;
      }
    } else {
      throw new Error(`Invalid TCC source: ${tccSource}`);
    }

    // If in edit mode, ensure the current TCC data is used.
    if (agentMode === 'edit' && currentTcc) {
      tcc = { ...currentTcc }; // Use the most recent TCC from the state
      // Ensure jobId exists for edit mode
      if (!tcc.jobId) {
        tcc.jobId = uuidv4(); // Generate valid UUID
        addLog('debug', 'Generated new jobId for edit mode TCC data (UUID format)', { jobId: tcc.jobId });
      }
      addLog('debug', 'Running in EDIT mode, using current TCC data from state.', { keys: Object.keys(tcc) });
    }
    
    // 2. Prepare the request body for Universal Agent Route
    const requestBody = {
      jobId: tcc.jobId,
      agentType: agentId,                              // ✅ Universal Agent Route parameter
      selectedModel: modelId,                          // ✅ Model selection
      tcc: tcc,                                       // ✅ TCC with agentModelMapping
      isSequentialMode: false,                        // ✅ Isolation mode (not sequential)
      editMode: agentMode === 'edit' ? {              // ✅ Edit mode support
        isEditMode: true,
        instructions: [{
          targetAgent: agentId,
          editType: 'enhance',
          instructions: editMessage,
          priority: 'high',
          createdAt: new Date().toISOString()
        }],
        context: `Isolated edit mode testing for ${agentId}`
      } : undefined
    };

    addLog('debug', `Sending request to Universal Agent Route for ${agentId}`, requestBody);

    // 3. Make the API call to Universal Agent Route
    const response = await fetch('/api/ai/agents/universal', {
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