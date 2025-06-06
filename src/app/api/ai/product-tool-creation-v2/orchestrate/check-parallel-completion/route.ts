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

    // V5 ORCHESTRATION LOGIC: Handle parallel completion properly
    const parallelCompletionResult = checkParallelStepCompletion(tcc);
    
    logger.info({ 
      jobId, 
      currentStep: tcc.currentOrchestrationStep,
      ...parallelCompletionResult
    }, '🔍 CHECK-COMPLETION: Parallel completion status determined');

    // If we're ready to trigger the next step, do it asynchronously
    if (parallelCompletionResult.readyToTriggerNext && parallelCompletionResult.nextStep) {
      logger.info({ 
        jobId, 
        nextStep: parallelCompletionResult.nextStep,
        baseUrl: request.nextUrl.origin 
      }, '🔍 CHECK-COMPLETION: About to trigger next step');
      
      triggerNextStep(request.nextUrl.origin, jobId, parallelCompletionResult.nextStep).catch(error => {
        logger.error({ jobId, nextStep: parallelCompletionResult.nextStep, error }, '🔍 CHECK-COMPLETION: Failed to trigger next step');
      });
    } else {
      logger.info({ 
        jobId, 
        readyToTriggerNext: parallelCompletionResult.readyToTriggerNext,
        nextStep: parallelCompletionResult.nextStep,
        currentStep: tcc.currentOrchestrationStep
      }, '🔍 CHECK-COMPLETION: Not ready to trigger next step yet');
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
      logger.warn({ currentStep }, '🔍 CHECK-COMPLETION: Unknown orchestration step');
      return {
        isComplete: false,
        nextStep: null,
        readyToTriggerNext: false
      };
  }
}

/**
 * Trigger the next step in the orchestration asynchronously
 */
async function triggerNextStep(baseUrl: string, jobId: string, nextStep: string): Promise<void> {
  try {
    logger.info({ jobId, nextStep, baseUrl }, '🔍 CHECK-COMPLETION: Starting triggerNextStep');
    
    // Get TCC to determine which model the agent should use
    const tcc = await getTCC(jobId);
    if (!tcc) {
      throw new Error(`TCC not found for jobId: ${jobId}`);
    }
    
    let triggerUrl: string;
    let agentName: string;
    let selectedModel: string | undefined;
    
    if (nextStep === OrchestrationStepEnum.enum.planning_function_signatures) {
      // Trigger the Function Planner Agent
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/agents/function-planner`;
      agentName = 'function-planner';
    } else if (nextStep === OrchestrationStepEnum.enum.designing_state_logic) {
      // Trigger the State Design Agent
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/agents/state-design`;
      agentName = 'state-design';
    } else if (nextStep === OrchestrationStepEnum.enum.designing_jsx_layout) {
      // Trigger the JSX Layout Agent
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/agents/jsx-layout`;
      agentName = 'jsx-layout';
    } else if (nextStep === OrchestrationStepEnum.enum.applying_tailwind_styling) {
      // Trigger the Tailwind Styling Agent
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/agents/tailwind-styling`;
      agentName = 'tailwind-styling';
    } else if (nextStep === OrchestrationStepEnum.enum.assembling_component) {
      // Trigger the Component Assembler Agent
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/agents/component-assembler`;
      agentName = 'component-assembler';
    } else if (nextStep === OrchestrationStepEnum.enum.validating_code) {
      // Trigger the Validator Agent
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/agents/validator`;
      agentName = 'validator';
    } else if (nextStep === OrchestrationStepEnum.enum.finalizing_tool) {
      // Trigger the Tool Finalizer Agent
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/agents/tool-finalizer`;
      agentName = 'tool-finalizer';
    } else {
      throw new Error(`Unknown next step: ${nextStep}`);
    }

    // Determine which model this agent should use
    selectedModel = tcc.agentModelMapping?.[agentName] || tcc.selectedModel;

    console.log('🔍 CHECK-COMPLETION: ==================== TRIGGERING NEXT AGENT ====================');
    console.log('🔍 CHECK-COMPLETION: Agent trigger details:', {
      jobId,
      nextStep,
      agentName,
      triggerUrl,
      selectedModel: selectedModel || 'default',
      agentModelMapping: tcc.agentModelMapping || {},
      fallbackModel: tcc.selectedModel || 'none',
      timestamp: new Date().toISOString()
    });

    logger.info({ 
      jobId, 
      nextStep, 
      triggerUrl, 
      agentName,
      selectedModel: selectedModel || 'default'
    }, '🔍 CHECK-COMPLETION: About to call fetch to trigger next step');

    console.log('🔍 CHECK-COMPLETION: Sending HTTP request to agent...');
    console.log('🔍 CHECK-COMPLETION: Request payload:', { jobId, selectedModel });
    
    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId, selectedModel }),
    });

    console.log('🔍 CHECK-COMPLETION: ✅ HTTP response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    logger.info({ 
      jobId, 
      nextStep, 
      triggerUrl, 
      responseStatus: response.status,
      responseOk: response.ok 
    }, '🔍 CHECK-COMPLETION: Fetch response received');

    if (!response.ok) {
      console.error('🔍 CHECK-COMPLETION: ❌ Agent responded with error status');
      const responseText = await response.text();
      console.error('🔍 CHECK-COMPLETION: Error response body:', responseText);
      
      logger.error({ 
        jobId, 
        nextStep, 
        triggerUrl, 
        status: response.status,
        responseText 
      }, '🔍 CHECK-COMPLETION: Next step responded with error status');
      throw new Error(`Next step ${nextStep} responded with status: ${response.status}, body: ${responseText}`);
    }

    console.log('🔍 CHECK-COMPLETION: ✅ Agent triggered successfully');
    logger.info({ jobId, nextStep, triggerUrl }, '🔍 CHECK-COMPLETION: Successfully triggered next step');
  } catch (error) {
    logger.error({ 
      jobId, 
      nextStep, 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error)
    }, '🔍 CHECK-COMPLETION: Failed to trigger next step');
    throw error;
  }
} 