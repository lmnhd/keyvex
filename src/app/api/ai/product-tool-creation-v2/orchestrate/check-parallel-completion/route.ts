import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTCC } from '@/lib/db/tcc-store';
import { OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

// Input schema for checking completion
const CheckCompletionRequestSchema = z.object({
  jobId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = CheckCompletionRequestSchema.parse(body);
    
    logger.info({ jobId }, '🔍 CHECK-COMPLETION: Checking parallel agent completion status');

    // CRITICAL: Get FRESH TCC to avoid race conditions with parallel agents
    let tcc = await getTCC(jobId);
    if (!tcc) {
      return NextResponse.json({ 
        success: false, 
        error: 'TCC not found',
        jobId 
      }, { status: 404 });
    }

    // Check if the TCC status indicates failure
    if (tcc.status === OrchestrationStatusEnum.enum.error) {
      return NextResponse.json({
        success: false,
        error: 'Process has failed',
        jobId,
        currentStep: tcc.currentOrchestrationStep,
        status: tcc.status
      }, { status: 400 });
    }

    // RACE CONDITION FIX: Refresh TCC right before completion check 
    // This ensures we have the latest data from parallel agents
    console.log('🔍 CHECK-COMPLETION: ==================== REFRESHING TCC FOR LATEST DATA ====================');
    console.log('🔍 CHECK-COMPLETION: State before TCC refresh:', {
      hasStateLogic: !!tcc.stateLogic,
      hasJsxLayout: !!tcc.jsxLayout,
      currentStep: tcc.currentOrchestrationStep,
      status: tcc.status,
      lastUpdated: tcc.updatedAt
    });
    
    logger.info({ 
      jobId,
      beforeRefresh: {
        hasStateLogic: !!tcc.stateLogic,
        hasJsxLayout: !!tcc.jsxLayout
      }
    }, '🔍 CHECK-COMPLETION: State before TCC refresh');
    
    console.log('🔍 CHECK-COMPLETION: Calling getTCC to refresh data...');
    
    // CRITICAL FIX: Add delay to ensure TCC save operations have completed
    // This prevents race conditions where we check completion before saves are committed
    // Using 500ms to ensure filesystem + memory sync on Windows
    await new Promise(resolve => setTimeout(resolve, 500));
    
    tcc = await getTCC(jobId);
    if (!tcc) {
      console.error('🔍 CHECK-COMPLETION: ❌ CRITICAL ERROR - TCC not found on refresh');
      return NextResponse.json({ 
        success: false, 
        error: 'TCC not found on refresh',
        jobId 
      }, { status: 404 });
    }
    
    console.log('🔍 CHECK-COMPLETION: ✅ TCC refreshed successfully');
    console.log('🔍 CHECK-COMPLETION: State after TCC refresh:', {
      hasStateLogic: !!tcc.stateLogic,
      hasJsxLayout: !!tcc.jsxLayout,
      stateLogicStructure: tcc.stateLogic ? {
        hasVariables: !!tcc.stateLogic.variables,
        variableCount: tcc.stateLogic.variables?.length || 0,
        hasFunctions: !!tcc.stateLogic.functions,
        functionCount: tcc.stateLogic.functions?.length || 0,
        keys: Object.keys(tcc.stateLogic)
      } : 'null',
      jsxLayoutStructure: tcc.jsxLayout ? {
        hasComponentStructure: !!tcc.jsxLayout.componentStructure,
        componentStructureLength: tcc.jsxLayout.componentStructure?.length || 0,
        hasElementMap: !!tcc.jsxLayout.elementMap,
        elementMapCount: tcc.jsxLayout.elementMap?.length || 0,
        keys: Object.keys(tcc.jsxLayout)
      } : 'null',
      currentStep: tcc.currentOrchestrationStep,
      status: tcc.status,
      lastUpdated: tcc.updatedAt
    });
    
    logger.info({ 
      jobId,
      afterRefresh: {
        hasStateLogic: !!tcc.stateLogic,
        hasJsxLayout: !!tcc.jsxLayout,
        stateLogicKeys: tcc.stateLogic ? Object.keys(tcc.stateLogic) : 'none',
        jsxLayoutKeys: tcc.jsxLayout ? Object.keys(tcc.jsxLayout) : 'none'
      }
    }, '🔍 CHECK-COMPLETION: State after TCC refresh');

    // COMPREHENSIVE LOGGING: Complete TCC analysis before decision
    logger.info({ 
      jobId,
      completeStateAnalysis: {
        currentOrchestrationStep: tcc.currentOrchestrationStep,
        status: tcc.status,
        hasFunctionSignatures: !!tcc.definedFunctionSignatures,
        functionSignatureCount: tcc.definedFunctionSignatures?.length || 0,
        hasStateLogic: !!tcc.stateLogic,
        stateLogicDetail: tcc.stateLogic ? {
          hasVariables: !!tcc.stateLogic.variables,
          variableCount: tcc.stateLogic.variables?.length || 0,
          hasStateVariables: !!tcc.stateLogic.stateVariables,
          stateVariableCount: tcc.stateLogic.stateVariables?.length || 0,
          hasFunctions: !!tcc.stateLogic.functions,
          functionCount: tcc.stateLogic.functions?.length || 0
        } : null,
        hasJsxLayout: !!tcc.jsxLayout,
        jsxLayoutDetail: tcc.jsxLayout ? {
          hasComponentStructure: !!tcc.jsxLayout.componentStructure,
          componentStructureLength: tcc.jsxLayout.componentStructure?.length || 0,
          hasElementMap: !!tcc.jsxLayout.elementMap,
          elementMapCount: tcc.jsxLayout.elementMap?.length || 0
        } : null,
        updatedAt: tcc.updatedAt,
        allTopLevelKeys: Object.keys(tcc)
      }
    }, '🔍 CHECK-COMPLETION: Complete TCC state analysis');

    // V5 ORCHESTRATION LOGIC: Handle parallel completion properly
    const parallelCompletionResult = checkParallelStepCompletion(tcc);
    
    // COMPREHENSIVE LOGGING: Decision details
    logger.info({ 
      jobId, 
      currentStep: tcc.currentOrchestrationStep,
      decisionDetails: {
        ...parallelCompletionResult,
        reasoningUsed: `Step ${tcc.currentOrchestrationStep} checked against completion logic`,
        stateDesignComplete: parallelCompletionResult.parallelStatus?.stateDesignComplete,
        jsxLayoutComplete: parallelCompletionResult.parallelStatus?.jsxLayoutComplete,
        willTriggerNext: parallelCompletionResult.readyToTriggerNext && !!parallelCompletionResult.nextStep
      }
    }, '🔍 CHECK-COMPLETION: Parallel completion status determined');

    // If we're ready to trigger the next step, do it asynchronously
    if (parallelCompletionResult.readyToTriggerNext && parallelCompletionResult.nextStep) {
      logger.info({ 
        jobId, 
        nextStep: parallelCompletionResult.nextStep,
        baseUrl: request.nextUrl.origin 
      }, '🔍 CHECK-COMPLETION: Handing off to official trigger-next-step endpoint');
      
      // A-SYNCHRONOUSLY CALL THE OFFICIAL TRIGGER ENDPOINT
      fetch(`${request.nextUrl.origin}/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, nextStep: parallelCompletionResult.nextStep }),
      }).catch(error => {
        logger.error({ jobId, nextStep: parallelCompletionResult.nextStep, error }, '🔍 CHECK-COMPLETION: Failed to call official trigger-next-step endpoint');
      });

    } else {
      logger.info({ 
        jobId, 
        readyToTriggerNext: parallelCompletionResult.readyToTriggerNext,
        nextStep: parallelCompletionResult.nextStep,
        currentStep: tcc.currentOrchestrationStep
      }, `🔍 CHECK-COMPLETION: Not ready to trigger next step yet - readyToTriggerNext=${parallelCompletionResult.readyToTriggerNext}, nextStep=${parallelCompletionResult.nextStep}, currentStep=${tcc.currentOrchestrationStep}`);
    }

    const response = {
      success: true,
      jobId,
      currentStep: tcc.currentOrchestrationStep,
      ...parallelCompletionResult,
      status: tcc.status,
      progress: {
        functionsPlanned: !!tcc.definedFunctionSignatures,
        stateDesigned: !!tcc.stateLogic,
        jsxLayoutCreated: !!tcc.jsxLayout,
        stylingApplied: !!(tcc as any).styling,
        componentAssembled: !!tcc.assembledComponentCode
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message
      } : String(error),
      endpoint: '/orchestrate/check-parallel-completion'
    }, '🔍 CHECK-COMPLETION: Request failed');

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * V5 ORCHESTRATION: Check parallel step completion and determine next step
 */
function checkParallelStepCompletion(tcc: any): {
  isComplete: boolean;
  nextStep: string | null;
  readyToTriggerNext: boolean;
  parallelStatus?: {
    stateDesignComplete: boolean;
    jsxLayoutComplete: boolean;
  };
} {
  const currentStep = tcc.currentOrchestrationStep;

  switch (currentStep) {
    case OrchestrationStepEnum.enum.planning_function_signatures:
      // Function planner is complete if we have function signatures
      const functionPlannerComplete = !!tcc.definedFunctionSignatures && tcc.definedFunctionSignatures.length > 0;
      return {
        isComplete: functionPlannerComplete,
        nextStep: functionPlannerComplete ? 'parallel_state_jsx' : null,
        readyToTriggerNext: false // This step triggers both agents simultaneously from function-planner
      };

    case OrchestrationStepEnum.enum.designing_state_logic:
    case OrchestrationStepEnum.enum.designing_jsx_layout:
      // CRITICAL: Check if BOTH parallel agents are complete
      // State Design agent can save either 'variables' (TCC-compatible) OR 'stateVariables' (original)
      const stateDesignComplete = !!tcc.stateLogic && (
        (!!tcc.stateLogic.variables && tcc.stateLogic.variables.length > 0) ||
        (!!tcc.stateLogic.stateVariables && tcc.stateLogic.stateVariables.length > 0)
      );
      const jsxLayoutComplete = !!tcc.jsxLayout && !!tcc.jsxLayout.componentStructure;
      
      const bothParallelAgentsComplete = stateDesignComplete && jsxLayoutComplete;

      // CRITICAL DEBUG: Log the exact values being checked
      logger.info({}, `🔍 CRITICAL DEBUG: jobId=${tcc.jobId}, stateDesignComplete=${stateDesignComplete} (hasStateLogic=${!!tcc.stateLogic}, hasVariables=${!!tcc.stateLogic?.variables}, varCount=${tcc.stateLogic?.variables?.length || 0}, hasStateVars=${!!tcc.stateLogic?.stateVariables}, stateVarCount=${tcc.stateLogic?.stateVariables?.length || 0}), jsxLayoutComplete=${jsxLayoutComplete} (hasJsxLayout=${!!tcc.jsxLayout}, hasComponentStructure=${!!tcc.jsxLayout?.componentStructure}), bothComplete=${bothParallelAgentsComplete}`);

      // COMPREHENSIVE LOGGING: Detailed parallel completion analysis
      logger.info({ 
        jobId: tcc.jobId,
        parallelCompletionAnalysis: {
          currentStep,
          stateDesignComplete,
          stateDesignReason: {
            hasStateLogic: !!tcc.stateLogic,
            hasVariables: !!tcc.stateLogic?.variables,
            variableCount: tcc.stateLogic?.variables?.length || 0,
            hasStateVariables: !!tcc.stateLogic?.stateVariables,
            stateVariableCount: tcc.stateLogic?.stateVariables?.length || 0,
            variablesMeetsCriteria: !!tcc.stateLogic?.variables && tcc.stateLogic.variables.length > 0,
            stateVariablesMeetsCriteria: !!tcc.stateLogic?.stateVariables && tcc.stateLogic.stateVariables.length > 0
          },
          jsxLayoutComplete,
          jsxLayoutReason: {
            hasJsxLayout: !!tcc.jsxLayout,
            hasComponentStructure: !!tcc.jsxLayout?.componentStructure,
            componentStructureLength: tcc.jsxLayout?.componentStructure?.length || 0,
            hasElementMap: !!tcc.jsxLayout?.elementMap,
            elementMapCount: tcc.jsxLayout?.elementMap?.length || 0
          },
          bothParallelAgentsComplete,
          nextStepWillBe: bothParallelAgentsComplete ? OrchestrationStepEnum.enum.applying_tailwind_styling : null,
          readyToTrigger: bothParallelAgentsComplete
        }
      }, '🔍 CHECK-COMPLETION: Detailed parallel completion analysis');
      
      logger.info({ 
        jobId: tcc.jobId,
        currentStep,
        stateDesignComplete,
        jsxLayoutComplete,
        bothParallelAgentsComplete,
        hasStateLogic: !!tcc.stateLogic,
        hasJsxLayout: !!tcc.jsxLayout,
        stateVariablesCount: tcc.stateLogic?.variables?.length || 0,
        stateVariablesCountAlt: tcc.stateLogic?.stateVariables?.length || 0,
        hasStateLogicVariables: !!tcc.stateLogic?.variables,
        hasStateLogicStateVariables: !!tcc.stateLogic?.stateVariables,
        jsxComponentStructureLength: tcc.jsxLayout?.componentStructure?.length || 0,
        stateLogicStructure: tcc.stateLogic ? Object.keys(tcc.stateLogic) : 'null',
        jsxLayoutStructure: tcc.jsxLayout ? Object.keys(tcc.jsxLayout) : 'null'
      }, '🔍 CHECK-COMPLETION: Parallel agent completion status');
      
      console.log('🔍 CHECK-COMPLETION: Full TCC stateLogic:', JSON.stringify(tcc.stateLogic, null, 2));
      console.log('🔍 CHECK-COMPLETION: Full TCC jsxLayout:', JSON.stringify(tcc.jsxLayout, null, 2));
      
      // Additional debugging for race condition detection
      console.log('🔍 CHECK-COMPLETION: TCC Last Updated:', tcc.updatedAt);
      console.log('🔍 CHECK-COMPLETION: TCC Status:', tcc.status);
      console.log('🔍 CHECK-COMPLETION: TCC All Top-Level Keys:', Object.keys(tcc));
      
      // Check if we have stateLogic but it's empty or missing critical fields
      if (tcc.stateLogic) {
        console.log('🔍 CHECK-COMPLETION: StateLogic Analysis:', {
          keys: Object.keys(tcc.stateLogic),
          hasVariables: 'variables' in tcc.stateLogic,
          hasStateVariables: 'stateVariables' in tcc.stateLogic,
          variablesLength: tcc.stateLogic.variables?.length,
          stateVariablesLength: tcc.stateLogic.stateVariables?.length,
          variablesType: typeof tcc.stateLogic.variables,
          stateVariablesType: typeof tcc.stateLogic.stateVariables
        });
      }
      
      return {
        isComplete: bothParallelAgentsComplete,
        nextStep: bothParallelAgentsComplete ? OrchestrationStepEnum.enum.applying_tailwind_styling : null,
        readyToTriggerNext: bothParallelAgentsComplete,
        parallelStatus: {
          stateDesignComplete,
          jsxLayoutComplete
        }
      };

    case OrchestrationStepEnum.enum.applying_tailwind_styling:
      // Check if styling is complete (using any property to avoid typing issues)
      const stylingComplete = !!(tcc as any).styling && !!(tcc as any).styling.styleMap;
      return {
        isComplete: stylingComplete,
        nextStep: stylingComplete ? OrchestrationStepEnum.enum.assembling_component : null,
        readyToTriggerNext: stylingComplete
      };

    case OrchestrationStepEnum.enum.assembling_component:
      // Check if component assembly is complete
      const assemblyComplete = !!tcc.assembledComponentCode && tcc.assembledComponentCode.length > 0;
      return {
        isComplete: assemblyComplete,
        nextStep: assemblyComplete ? OrchestrationStepEnum.enum.validating_code : null,
        readyToTriggerNext: assemblyComplete
      };

    case OrchestrationStepEnum.enum.validating_code:
      // Check if validation is complete
      const validationComplete = !!tcc.validationResult;
      return {
        isComplete: validationComplete,
        nextStep: validationComplete ? OrchestrationStepEnum.enum.finalizing_tool : null,
        readyToTriggerNext: validationComplete
      };

    case OrchestrationStepEnum.enum.completed:
      return {
        isComplete: true,
        nextStep: null,
        readyToTriggerNext: false
      };

    default:
      // For any other step, this checker is not applicable
      return {
        isComplete: false,
        nextStep: null,
        readyToTriggerNext: false
      };
  }
}

// REMOVED INTERNAL triggerNextStep function to prevent logic duplication.
// All triggering is now handled by the dedicated /api/ai/product-tool-creation-v2/orchestrate/trigger-next-step route. 