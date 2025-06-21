/**
 * TCC Manager - Tool Construction Context state management (Phase 1.2)
 * Provides centralized TCC operations for the unified agent system
 */

import { 
  AgentType, 
  ToolConstructionContext as UnifiedTCC,
  FunctionPlannerResult,
  StateDesignResult,
  JsxLayoutResult,
  TailwindStylingResult,
  ComponentAssemblerResult,
  CodeValidatorResult,
  ToolFinalizerResult,
  RetryContext
} from '@/lib/types/tcc-unified';
import { 
  ToolConstructionContext as BaseTCC,
  createTCC,
  OrchestrationStepEnum,
  OrchestrationStatusEnum
} from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

export class TCCManager {
  constructor() {}

  /**
   * Update TCC with agent result
   */
  updateTCCWithAgentResult<T>(
    tcc: UnifiedTCC,
    agentType: AgentType,
    result: T,
    executionMetadata: {
      startTime: string;
      endTime: string;
      duration: number;
      modelUsed: string;
      tokensUsed?: number;
      attemptNumber: number;
    }
  ): UnifiedTCC {
    logger.info({
      jobId: tcc.jobId,
      agentType,
      duration: executionMetadata.duration,
      attemptNumber: executionMetadata.attemptNumber
    }, '🔧 TCCManager: Updating TCC with agent result');

    const updatedTcc = { ...tcc };

    // Update agent execution history
    if (!updatedTcc.agentExecutionHistory) {
      updatedTcc.agentExecutionHistory = [];
    }
    
    updatedTcc.agentExecutionHistory.push({
      agentType,
      startTime: executionMetadata.startTime,
      endTime: executionMetadata.endTime,
      duration: executionMetadata.duration,
      success: true,
      attemptNumber: executionMetadata.attemptNumber,
      modelUsed: executionMetadata.modelUsed,
      tokensUsed: executionMetadata.tokensUsed
    });

    // Update model assignments
    if (!updatedTcc.modelAssignments) {
      updatedTcc.modelAssignments = {} as Record<AgentType, string>;
    }
    updatedTcc.modelAssignments[agentType] = executionMetadata.modelUsed;

    // Update TCC with agent-specific results
    this.mergeAgentResultIntoTCC(updatedTcc, agentType, result);

    // Update orchestration step
    this.updateOrchestrationStep(updatedTcc, agentType);

    logger.info({
      jobId: tcc.jobId,
      agentType,
      currentStep: updatedTcc.currentOrchestrationStep
    }, '🔧 TCCManager: TCC updated successfully');

    return updatedTcc;
  }

  /**
   * Record agent failure in TCC
   */
  recordAgentFailure(
    tcc: UnifiedTCC,
    agentType: AgentType,
    error: string,
    executionMetadata: {
      startTime: string;
      endTime: string;
      duration: number;
      modelUsed: string;
      attemptNumber: number;
    }
  ): UnifiedTCC {
    logger.warn({
      jobId: tcc.jobId,
      agentType,
      error,
      attemptNumber: executionMetadata.attemptNumber
    }, '🔧 TCCManager: Recording agent failure');

    const updatedTcc = { ...tcc };

    // Update agent execution history with failure
    if (!updatedTcc.agentExecutionHistory) {
      updatedTcc.agentExecutionHistory = [];
    }
    
    updatedTcc.agentExecutionHistory.push({
      agentType,
      startTime: executionMetadata.startTime,
      endTime: executionMetadata.endTime,
      duration: executionMetadata.duration,
      success: false,
      attemptNumber: executionMetadata.attemptNumber,
      modelUsed: executionMetadata.modelUsed,
      error
    });

    return updatedTcc;
  }

  /**
   * Validate TCC completeness for specific agent
   */
  validateTCCForAgent(
    tcc: UnifiedTCC,
    agentType: AgentType
  ): {
    isValid: boolean;
    missingFields: string[];
    recommendations: string[];
  } {
    const missingFields: string[] = [];
    const recommendations: string[] = [];

    switch (agentType) {
      case 'function-planner':
        if (!tcc.definedFunctionSignatures || tcc.definedFunctionSignatures.length === 0) {
          missingFields.push('definedFunctionSignatures');
          recommendations.push('Function Planner must generate at least one function signature');
        }
        break;

      case 'state-design':
        if (!tcc.stateLogic) {
          missingFields.push('stateLogic');
          recommendations.push('State Design agent must provide state logic');
        } else {
          if (!tcc.stateLogic.variables || tcc.stateLogic.variables.length === 0) {
            missingFields.push('stateLogic.variables');
            recommendations.push('State logic must include state variables');
          }
          if (!tcc.stateLogic.functions || tcc.stateLogic.functions.length === 0) {
            missingFields.push('stateLogic.functions');
            recommendations.push('State logic must include calculation functions');
          }
        }
        break;

      case 'jsx-layout':
        if (!tcc.jsxLayout) {
          missingFields.push('jsxLayout');
          recommendations.push('JSX Layout agent must provide component structure');
        } else if (!tcc.jsxLayout.componentStructure) {
          missingFields.push('jsxLayout.componentStructure');
          recommendations.push('JSX Layout must include component structure');
        }
        break;

      case 'tailwind-styling':
        if (!tcc.styling) {
          missingFields.push('styling');
          recommendations.push('Tailwind Styling agent must provide styling information');
        } else if (!tcc.styling.styledComponentCode) {
          missingFields.push('styling.styledComponentCode');
          recommendations.push('Styling must include styled component code');
        }
        break;

      case 'component-assembler':
        if (!tcc.componentAssemblerResult) {
          missingFields.push('componentAssemblerResult');
          recommendations.push('Component Assembler must provide assembled code result');
        }
        break;

      case 'code-validator':
        if (!tcc.validationResult) {
          missingFields.push('validationResult');
          recommendations.push('Code Validator must provide validation results');
        }
        break;

      case 'tool-finalizer':
        if (!tcc.finalProduct) {
          missingFields.push('finalProduct');
          recommendations.push('Tool Finalizer must provide final product');
        }
        break;
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
      recommendations
    };
  }

  /**
   * Get TCC summary for logging and analysis
   */
  getTCCSummary(tcc: UnifiedTCC): {
    jobId: string;
    currentStep: string;
    completedAgents: AgentType[];
    totalExecutionTime: number;
    modelUsage: Record<string, number>;
    hasErrors: boolean;
    completionPercentage: number;
  } {
    const executionHistory = tcc.agentExecutionHistory || [];
    const completedAgents = executionHistory
      .filter((entry: any) => entry.success)
      .map((entry: any) => entry.agentType as AgentType);

    const totalExecutionTime = executionHistory
      .reduce((total: number, entry: any) => total + (entry.duration || 0), 0);

    const modelUsage: Record<string, number> = {};
    executionHistory.forEach((entry: any) => {
      modelUsage[entry.modelUsed] = (modelUsage[entry.modelUsed] || 0) + 1;
    });

    const hasErrors = executionHistory.some((entry: any) => !entry.success);
    const totalAgents = 7; // Total number of agents in the pipeline
    const completionPercentage = Math.round((completedAgents.length / totalAgents) * 100);

    return {
      jobId: tcc.jobId,
      currentStep: tcc.currentOrchestrationStep || 'unknown',
      completedAgents,
      totalExecutionTime,
      modelUsage,
      hasErrors,
      completionPercentage
    };
  }

  /**
   * Clone TCC for safe modifications
   */
  cloneTCC(tcc: UnifiedTCC): UnifiedTCC {
    return JSON.parse(JSON.stringify(tcc));
  }

  /**
   * Merge two TCCs (useful for parallel processing scenarios)
   */
  mergeTCCs(
    baseTcc: UnifiedTCC,
    updateTcc: UnifiedTCC,
    strategy: 'prefer_base' | 'prefer_update' | 'merge_all' = 'prefer_update'
  ): UnifiedTCC {
    logger.info({
      baseJobId: baseTcc.jobId,
      updateJobId: updateTcc.jobId,
      strategy
    }, '🔧 TCCManager: Merging TCCs');

    const merged = this.cloneTCC(baseTcc);

    // Merge execution histories
    if (updateTcc.agentExecutionHistory) {
      merged.agentExecutionHistory = [
        ...(merged.agentExecutionHistory || []),
        ...updateTcc.agentExecutionHistory
      ];
    }

    // Merge retry histories
    if (updateTcc.retryHistory) {
      merged.retryHistory = [
        ...(merged.retryHistory || []),
        ...updateTcc.retryHistory
      ];
    }

    // Merge model assignments
    if (updateTcc.modelAssignments) {
      merged.modelAssignments = {
        ...(merged.modelAssignments || {}),
        ...updateTcc.modelAssignments
      };
    }

    // Merge agent results based on strategy
    const fieldsToMerge = [
      'definedFunctionSignatures',
      'stateLogic',
      'jsxLayout',
      'styling',
      'componentAssemblerResult',
      'validationResult',
      'finalProduct'
    ] as const;

    fieldsToMerge.forEach(field => {
      const baseValue = (baseTcc as any)[field];
      const updateValue = (updateTcc as any)[field];

      if (strategy === 'prefer_update' && updateValue !== undefined) {
        (merged as any)[field] = updateValue;
      } else if (strategy === 'prefer_base' && baseValue !== undefined) {
        (merged as any)[field] = baseValue;
      } else if (strategy === 'merge_all') {
        if (updateValue !== undefined) {
          (merged as any)[field] = updateValue;
        } else if (baseValue !== undefined) {
          (merged as any)[field] = baseValue;
        }
      }
    });

    return merged;
  }

  /**
   * Reset TCC to specific agent step (for retry scenarios)
   */
  resetTCCToStep(
    tcc: UnifiedTCC,
    targetAgent: AgentType
  ): UnifiedTCC {
    logger.info({
      jobId: tcc.jobId,
      targetAgent
    }, '🔧 TCCManager: Resetting TCC to specific step');

    const resetTcc = this.cloneTCC(tcc);

    // Define agent order and what to reset
    const agentOrder: AgentType[] = [
      'function-planner',
      'state-design', 
      'jsx-layout',
      'tailwind-styling',
      'component-assembler',
      'code-validator',
      'tool-finalizer'
    ];

    const targetIndex = agentOrder.indexOf(targetAgent);
    const agentsToReset = agentOrder.slice(targetIndex);

    // Reset results from target agent onwards
    agentsToReset.forEach(agent => {
      switch (agent) {
        case 'function-planner':
          delete resetTcc.definedFunctionSignatures;
          delete resetTcc.functionPlannerResult;
          break;
        case 'state-design':
          delete resetTcc.stateLogic;
          delete resetTcc.stateDesignResult;
          break;
        case 'jsx-layout':
          delete resetTcc.jsxLayout;
          delete resetTcc.jsxLayoutResult;
          break;
        case 'tailwind-styling':
          delete resetTcc.styling;
          delete resetTcc.tailwindStylingResult;
          break;
        case 'component-assembler':
          delete resetTcc.componentAssemblerResult;
          break;
        case 'code-validator':
          delete resetTcc.validationResult;
          delete resetTcc.codeValidatorResult;
          break;
        case 'tool-finalizer':
          delete resetTcc.finalProduct;
          delete resetTcc.toolFinalizerResult;
          break;
      }
    });

    // Remove execution history for reset agents
    if (resetTcc.agentExecutionHistory) {
      resetTcc.agentExecutionHistory = resetTcc.agentExecutionHistory.filter(
        (entry: any) => !agentsToReset.includes(entry.agentType)
      );
    }

    // Update orchestration step
    const stepMap: Record<AgentType, string> = {
      'function-planner': OrchestrationStepEnum.enum.planning_function_signatures,
      'state-design': OrchestrationStepEnum.enum.designing_state_logic,
      'jsx-layout': OrchestrationStepEnum.enum.designing_jsx_layout,
      'tailwind-styling': OrchestrationStepEnum.enum.applying_tailwind_styling,
      'component-assembler': OrchestrationStepEnum.enum.assembling_component,
      'code-validator': OrchestrationStepEnum.enum.validating_code,
      'tool-finalizer': OrchestrationStepEnum.enum.finalizing_tool
    };

    const nextStep = stepMap[targetAgent];
    if (nextStep && this.isValidOrchestrationStep(nextStep)) {
      resetTcc.currentOrchestrationStep = nextStep as any;
    }

    return resetTcc;
  }

  /**
   * Merge agent result into TCC based on agent type
   */
  private mergeAgentResultIntoTCC<T>(
    tcc: UnifiedTCC,
    agentType: AgentType,
    result: T
  ): void {
    switch (agentType) {
      case 'function-planner':
        const fpResult = result as FunctionPlannerResult;
        tcc.definedFunctionSignatures = fpResult.functionSignatures;
        tcc.functionPlannerResult = fpResult;
        break;

      case 'state-design':
        const sdResult = result as StateDesignResult;
        tcc.stateLogic = sdResult.stateLogic;
        tcc.stateDesignResult = sdResult;
        break;

      case 'jsx-layout':
        const jlResult = result as JsxLayoutResult;
        tcc.jsxLayout = jlResult.jsxLayout;
        tcc.jsxLayoutResult = jlResult;
        break;

      case 'tailwind-styling':
        const tsResult = result as TailwindStylingResult;
        tcc.styling = tsResult.styling;
        tcc.tailwindStylingResult = tsResult;
        break;

      case 'component-assembler':
        const caResult = result as ComponentAssemblerResult;
        tcc.componentAssemblerResult = caResult;
        break;

      case 'code-validator':
        const cvResult = result as CodeValidatorResult;
        tcc.validationResult = cvResult.validationResult;
        tcc.codeValidatorResult = cvResult;
        break;

      case 'tool-finalizer':
        const tfResult = result as ToolFinalizerResult;
        tcc.finalProduct = tfResult.finalProduct;
        tcc.toolFinalizerResult = tfResult;
        break;
    }
  }

  /**
   * Update orchestration step based on completed agent
   */
  private updateOrchestrationStep(
    tcc: UnifiedTCC,
    completedAgent: AgentType
  ): void {
    const stepMap: Record<AgentType, string> = {
      'function-planner': OrchestrationStepEnum.enum.designing_state_logic,
      'state-design': OrchestrationStepEnum.enum.designing_jsx_layout,
      'jsx-layout': OrchestrationStepEnum.enum.applying_tailwind_styling,
      'tailwind-styling': OrchestrationStepEnum.enum.assembling_component,
      'component-assembler': OrchestrationStepEnum.enum.validating_code,
      'code-validator': OrchestrationStepEnum.enum.finalizing_tool,
      'tool-finalizer': OrchestrationStepEnum.enum.finalizing_tool // Final step
    };

    const nextStep = stepMap[completedAgent];
    if (nextStep && this.isValidOrchestrationStep(nextStep)) {
      tcc.currentOrchestrationStep = nextStep as any;
    }

    // Update step status
    if (!tcc.steps) {
      tcc.steps = {};
    }

    const currentStepKey = this.getStepKeyForAgent(completedAgent);
    if (currentStepKey && this.isValidStepKey(currentStepKey)) {
      const stepStatus = {
        status: OrchestrationStatusEnum.enum.completed,
        startedAt: (tcc.steps as any)[currentStepKey]?.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString()
      };
      (tcc.steps as any)[currentStepKey] = stepStatus;
    }
  }

  /**
   * Get step key for agent type
   */
  private getStepKeyForAgent(agentType: AgentType): string | null {
    const stepKeyMap: Record<AgentType, string> = {
      'function-planner': 'planningFunctionSignatures',
      'state-design': 'designingStateLogic',
      'jsx-layout': 'designingJsxLayout',
      'tailwind-styling': 'applyingTailwindStyling',
      'component-assembler': 'assemblingComponent',
      'code-validator': 'validatingCode',
      'tool-finalizer': 'finalizingTool'
    };

    return stepKeyMap[agentType] || null;
  }

  /**
   * Validate orchestration step
   */
  private isValidOrchestrationStep(step: string): boolean {
    const validSteps = Object.values(OrchestrationStepEnum.enum);
    return validSteps.includes(step as any);
  }

  /**
   * Validate step key
   */
  private isValidStepKey(stepKey: string): boolean {
    const validStepKeys = [
      'dataRequirementsResearch',
      'designingStateLogic', 
      'designingJsxLayout',
      'applyingTailwindStyling',
      'assemblingComponent',
      'validatingCode'
    ];
    return validStepKeys.includes(stepKey);
  }
}
