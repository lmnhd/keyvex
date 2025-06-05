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

    // Determine what step we're checking for completion
    const currentStep = tcc.currentOrchestrationStep;
    logger.info({ jobId, currentStep }, '🔍 CHECK-COMPLETION: Current orchestration step');

    // Check completion status based on current step
    let isComplete = false;
    let nextStep: string | null = null;
    let readyToTriggerNext = false;
    
    switch (currentStep) {
      case OrchestrationStepEnum.enum.planning_function_signatures:
        // Check if function planner is complete
        isComplete = !!tcc.definedFunctionSignatures && tcc.definedFunctionSignatures.length > 0;
        nextStep = OrchestrationStepEnum.enum.designing_state_logic;
        readyToTriggerNext = isComplete;
        break;

      case OrchestrationStepEnum.enum.designing_state_logic:
        // Check if state design is complete  
        isComplete = !!tcc.stateLogic && !!tcc.stateLogic.variables && tcc.stateLogic.variables.length > 0;
        nextStep = OrchestrationStepEnum.enum.designing_jsx_layout;
        readyToTriggerNext = isComplete;
        break;

      case OrchestrationStepEnum.enum.designing_jsx_layout:
        // Check if JSX layout is complete
        isComplete = !!tcc.jsxLayout && !!tcc.jsxLayout.componentStructure;
        nextStep = OrchestrationStepEnum.enum.applying_tailwind_styling;
        readyToTriggerNext = isComplete;
        break;

      case OrchestrationStepEnum.enum.applying_tailwind_styling:
        // Check if styling is complete
        isComplete = !!tcc.tailwindStyles && !!tcc.tailwindStyles.styleMap;
        nextStep = OrchestrationStepEnum.enum.assembling_component;
        readyToTriggerNext = isComplete;
        break;

      case OrchestrationStepEnum.enum.assembling_component:
        // Final assembly step
        isComplete = !!tcc.assembledComponentCode;
        nextStep = OrchestrationStepEnum.enum.completed;
        readyToTriggerNext = isComplete;
        break;

      case OrchestrationStepEnum.enum.completed:
        isComplete = true;
        nextStep = null;
        readyToTriggerNext = false;
        break;

      default:
        logger.warn({ jobId, currentStep }, '🔍 CHECK-COMPLETION: Unknown orchestration step');
        break;
    }

    // Also check if the TCC status indicates failure
    if (tcc.status === OrchestrationStatusEnum.enum.error) {
      return NextResponse.json({
        success: false,
        error: 'Process has failed',
        jobId,
        currentStep,
        status: tcc.status
      }, { status: 400 });
    }

    const response = {
      success: true,
      jobId,
      currentStep,
      isComplete,
      nextStep,
      readyToTriggerNext,
      status: tcc.status,
      progress: {
        functionsPlanned: !!tcc.definedFunctionSignatures,
        stateDesigned: !!tcc.stateLogic,
        jsxLayoutCreated: !!tcc.jsxLayout,
        stylingApplied: !!tcc.tailwindStyles,
        componentAssembled: !!tcc.assembledComponentCode
      }
    };

    logger.info({ 
      jobId, 
      currentStep, 
      isComplete, 
      nextStep, 
      readyToTriggerNext 
    }, '🔍 CHECK-COMPLETION: Status determined');

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