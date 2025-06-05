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

    const tcc = await getTCC(jobId);
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

    // V5 ORCHESTRATION LOGIC: Handle parallel completion properly
    const parallelCompletionResult = checkParallelStepCompletion(tcc);
    
    logger.info({ 
      jobId, 
      currentStep: tcc.currentOrchestrationStep,
      ...parallelCompletionResult
    }, '🔍 CHECK-COMPLETION: Parallel completion status determined');

    // If we're ready to trigger the next step, do it asynchronously
    if (parallelCompletionResult.readyToTriggerNext && parallelCompletionResult.nextStep) {
      triggerNextStep(request.nextUrl.origin, jobId, parallelCompletionResult.nextStep).catch(error => {
        logger.error({ jobId, nextStep: parallelCompletionResult.nextStep, error }, '🔍 CHECK-COMPLETION: Failed to trigger next step');
      });
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
      const stateDesignComplete = !!tcc.stateLogic && !!tcc.stateLogic.variables && tcc.stateLogic.variables.length > 0;
      const jsxLayoutComplete = !!tcc.jsxLayout && !!tcc.jsxLayout.componentStructure;
      
      const bothParallelAgentsComplete = stateDesignComplete && jsxLayoutComplete;
      
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
      // Check if assembly is complete
      const assemblyComplete = !!tcc.assembledComponentCode;
      return {
        isComplete: assemblyComplete,
        nextStep: assemblyComplete ? 'validation' : null,
        readyToTriggerNext: assemblyComplete
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
    let triggerUrl: string;
    
    if (nextStep === OrchestrationStepEnum.enum.applying_tailwind_styling) {
      // Trigger the Tailwind Styling Agent
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/agents/tailwind-styling`;
    } else if (nextStep === OrchestrationStepEnum.enum.assembling_component) {
      // Trigger the Assembly step (to be created)
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/assemble`;
    } else if (nextStep === 'validation') {
      // Trigger the Validation step (to be created)
      triggerUrl = `${baseUrl}/api/ai/product-tool-creation-v2/validate`;
    } else {
      throw new Error(`Unknown next step: ${nextStep}`);
    }

    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      throw new Error(`Next step ${nextStep} responded with status: ${response.status}`);
    }

    logger.info({ jobId, nextStep, triggerUrl }, '🔍 CHECK-COMPLETION: Successfully triggered next step');
  } catch (error) {
    logger.error({ jobId, nextStep, error }, '🔍 CHECK-COMPLETION: Failed to trigger next step');
    throw error;
  }
} 