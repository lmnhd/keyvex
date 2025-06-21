/**
 * TCC Manager (Phase 1.1 - Core Infrastructure)
 * Centralized TCC state management with strongly typed updates
 * NO GENERIC TYPES - Only strongly typed interfaces
 */

import { 
  AgentType,
  FunctionPlannerResult,
  StateDesignResult,
  JsxLayoutResult,
  TailwindStylingResult,
  ComponentAssemblerResult,
  CodeValidatorResult,
  ToolFinalizerResult
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import logger from '../../../logger';

/**
 * Union type for all possible agent results - strongly typed
 */
type AgentResult = 
  | FunctionPlannerResult
  | StateDesignResult
  | JsxLayoutResult
  | TailwindStylingResult
  | ComponentAssemblerResult
  | CodeValidatorResult
  | ToolFinalizerResult;

/**
 * Update TCC with agent result - SINGLE SOURCE OF TRUTH for TCC mutations
 * Each agent type has its own specific update logic
 * Works with existing base TCC structure
 */
export function updateTccWithAgentResult(
  tcc: BaseTCC,
  agentType: AgentType,
  result: AgentResult,
  modelUsed: string,
  executionTime: number
): BaseTCC {
  const startTime = Date.now();
  
  logger.info({
    jobId: tcc.jobId,
    agentType,
    modelUsed,
    executionTime
  }, `🔄 TCC MANAGER: Updating TCC with ${agentType} result`);

  // Create updated TCC - shallow copy to avoid mutation
  const updatedTcc: BaseTCC = {
    ...tcc,
    updatedAt: new Date().toISOString()
  };

  // Agent-specific TCC updates using switch statement for type safety
  // Only update fields that exist in the base TCC schema
  switch (agentType) {
    case 'function-planner': {
      const functionPlannerResult = result as FunctionPlannerResult;
      updatedTcc.definedFunctionSignatures = functionPlannerResult.functionSignatures;
      // Store result in steps for tracking
      if (!updatedTcc.steps) {
        updatedTcc.steps = {};
      }
      if (!updatedTcc.steps.designingStateLogic) {
        updatedTcc.steps.designingStateLogic = {};
      }
      updatedTcc.steps.designingStateLogic.result = functionPlannerResult;
      
      logger.info({
        jobId: tcc.jobId,
        functionsPlanned: functionPlannerResult.functionSignatures.length,
        complexityLevel: functionPlannerResult.metadata.complexityLevel
      }, '✅ TCC MANAGER: Function Planner result integrated');
      break;
    }

    case 'state-design': {
      const stateDesignResult = result as StateDesignResult;
      updatedTcc.stateLogic = stateDesignResult.stateLogic;
      // Store result in steps for tracking
      if (!updatedTcc.steps) {
        updatedTcc.steps = {};
      }
      if (!updatedTcc.steps.designingStateLogic) {
        updatedTcc.steps.designingStateLogic = {};
      }
      updatedTcc.steps.designingStateLogic.result = stateDesignResult;
      
      logger.info({
        jobId: tcc.jobId,
        stateVariables: stateDesignResult.metadata.stateVariableCount,
        functions: stateDesignResult.metadata.functionCount,
        complexityScore: stateDesignResult.metadata.complexityScore
      }, '✅ TCC MANAGER: State Design result integrated');
      break;
    }

    case 'jsx-layout': {
      const jsxLayoutResult = result as JsxLayoutResult;
      updatedTcc.jsxLayout = jsxLayoutResult.jsxLayout;
      // Store result in steps for tracking
      if (!updatedTcc.steps) {
        updatedTcc.steps = {};
      }
      if (!updatedTcc.steps.designingJsxLayout) {
        updatedTcc.steps.designingJsxLayout = {};
      }
      updatedTcc.steps.designingJsxLayout.result = jsxLayoutResult;
      
      logger.info({
        jobId: tcc.jobId,
        componentCount: jsxLayoutResult.metadata.componentCount,
        nestingDepth: jsxLayoutResult.metadata.nestingDepth,
        accessibilityScore: jsxLayoutResult.metadata.accessibilityScore
      }, '✅ TCC MANAGER: JSX Layout result integrated');
      break;
    }

    case 'tailwind-styling': {
      const tailwindStylingResult = result as TailwindStylingResult;
      updatedTcc.styling = tailwindStylingResult.styling;
      // Store result in steps for tracking
      if (!updatedTcc.steps) {
        updatedTcc.steps = {};
      }
      if (!updatedTcc.steps.applyingTailwindStyling) {
        updatedTcc.steps.applyingTailwindStyling = {};
      }
      updatedTcc.steps.applyingTailwindStyling.result = tailwindStylingResult;
      
      logger.info({
        jobId: tcc.jobId,
        classCount: tailwindStylingResult.metadata.classCount,
        responsiveBreakpoints: tailwindStylingResult.metadata.responsiveBreakpoints.length,
        colorScheme: tailwindStylingResult.metadata.colorSchemeType
      }, '✅ TCC MANAGER: Tailwind Styling result integrated');
      break;
    }

    case 'component-assembler': {
      const componentAssemblerResult = result as ComponentAssemblerResult;
      // Update finalProduct with assembled code
      if (!updatedTcc.finalProduct) {
        updatedTcc.finalProduct = {};
      }
      (updatedTcc.finalProduct as any).componentCode = componentAssemblerResult.assembledCode;
      
      // Store result in steps for tracking
      if (!updatedTcc.steps) {
        updatedTcc.steps = {};
      }
      if (!updatedTcc.steps.assemblingComponent) {
        updatedTcc.steps.assemblingComponent = {};
      }
      updatedTcc.steps.assemblingComponent.result = componentAssemblerResult;
      
      logger.info({
        jobId: tcc.jobId,
        codeLength: componentAssemblerResult.metadata.codeLength,
        estimatedRenderTime: componentAssemblerResult.metadata.estimatedRenderTime,
        bundleSize: componentAssemblerResult.metadata.bundleSize
      }, '✅ TCC MANAGER: Component Assembler result integrated');
      break;
    }

    case 'code-validator': {
      const codeValidatorResult = result as CodeValidatorResult;
      updatedTcc.validationResult = codeValidatorResult.validationResult;
      // Store result in steps for tracking
      if (!updatedTcc.steps) {
        updatedTcc.steps = {};
      }
      if (!updatedTcc.steps.validatingCode) {
        updatedTcc.steps.validatingCode = {};
      }
      updatedTcc.steps.validatingCode.result = codeValidatorResult;
      
      logger.info({
        jobId: tcc.jobId,
        issuesFound: codeValidatorResult.metadata.issuesFound,
        securityScore: codeValidatorResult.metadata.securityScore,
        performanceScore: codeValidatorResult.metadata.performanceScore
      }, '✅ TCC MANAGER: Code Validator result integrated');
      break;
    }

    case 'tool-finalizer': {
      const toolFinalizerResult = result as ToolFinalizerResult;
      updatedTcc.finalProduct = toolFinalizerResult.finalProduct;
      // Store result in steps for tracking (no specific step for tool finalizer)
      
      logger.info({
        jobId: tcc.jobId,
        completionTime: toolFinalizerResult.metadata.completionTime,
        qualityScore: toolFinalizerResult.metadata.qualityScore,
        readinessLevel: toolFinalizerResult.metadata.readinessLevel
      }, '✅ TCC MANAGER: Tool Finalizer result integrated');
      break;
    }

    default: {
      // TypeScript exhaustiveness check - this should never happen
      const exhaustiveCheck: never = agentType;
      throw new Error(`Unknown agent type: ${exhaustiveCheck}`);
    }
  }

  const updateTime = Date.now() - startTime;
  logger.info({
    jobId: tcc.jobId,
    agentType,
    updateTime
  }, '🎯 TCC MANAGER: TCC update completed successfully');

  return updatedTcc;
}

/**
 * Validate TCC state for a specific agent execution
 * Ensures required dependencies are present
 */
export function validateTccForAgent(tcc: BaseTCC, agentType: AgentType): {
  isValid: boolean;
  missingDependencies: string[];
  errors: string[];
} {
  const missingDependencies: string[] = [];
  const errors: string[] = [];

  switch (agentType) {
    case 'function-planner':
      // Function planner needs brainstorm data
      if (!tcc.brainstormData) {
        missingDependencies.push('brainstormData');
        errors.push('Function planner requires brainstorm data');
      }
      break;

    case 'state-design':
      // State design needs function signatures
      if (!tcc.definedFunctionSignatures || tcc.definedFunctionSignatures.length === 0) {
        missingDependencies.push('definedFunctionSignatures');
        errors.push('State design requires function signatures from function planner');
      }
      break;

    case 'jsx-layout':
      // JSX layout needs state logic
      if (!tcc.stateLogic) {
        missingDependencies.push('stateLogic');
        errors.push('JSX layout requires state logic from state design');
      }
      break;

    case 'tailwind-styling':
      // Tailwind styling needs JSX layout
      if (!tcc.jsxLayout) {
        missingDependencies.push('jsxLayout');
        errors.push('Tailwind styling requires JSX layout');
      }
      break;

    case 'component-assembler':
      // Component assembler needs state logic, JSX layout, and styling
      if (!tcc.stateLogic) {
        missingDependencies.push('stateLogic');
        errors.push('Component assembler requires state logic');
      }
      if (!tcc.jsxLayout) {
        missingDependencies.push('jsxLayout');
        errors.push('Component assembler requires JSX layout');
      }
      if (!tcc.styling) {
        missingDependencies.push('styling');
        errors.push('Component assembler requires styling');
      }
      break;

    case 'code-validator':
      // Code validator needs assembled component code
      if (!tcc.finalProduct || !(tcc.finalProduct as any).componentCode) {
        missingDependencies.push('finalProduct.componentCode');
        errors.push('Code validator requires assembled component code');
      }
      break;

    case 'tool-finalizer':
      // Tool finalizer needs validation results
      if (!tcc.validationResult) {
        missingDependencies.push('validationResult');
        errors.push('Tool finalizer requires validation results');
      }
      break;

    default: {
      const exhaustiveCheck: never = agentType;
      errors.push(`Unknown agent type: ${exhaustiveCheck}`);
    }
  }

  const isValid = missingDependencies.length === 0 && errors.length === 0;

  logger.info({
    jobId: tcc.jobId,
    agentType,
    isValid,
    missingDependencies,
    errorCount: errors.length
  }, `🔍 TCC MANAGER: TCC validation for ${agentType} - ${isValid ? 'VALID' : 'INVALID'}`);

  return {
    isValid,
    missingDependencies,
    errors
  };
}

/**
 * Get TCC completion status
 * Shows which agents have completed successfully
 */
export function getTccCompletionStatus(tcc: BaseTCC): {
  completedAgents: AgentType[];
  remainingAgents: AgentType[];
  completionPercentage: number;
  isComplete: boolean;
} {
  const allAgents: AgentType[] = [
    'function-planner',
    'state-design',
    'jsx-layout',
    'tailwind-styling',
    'component-assembler',
    'code-validator',
    'tool-finalizer'
  ];

  const completedAgents: AgentType[] = [];
  
  // Check which agents have completed based on TCC state
  if (tcc.definedFunctionSignatures && tcc.definedFunctionSignatures.length > 0) {
    completedAgents.push('function-planner');
  }
  if (tcc.stateLogic) {
    completedAgents.push('state-design');
  }
  if (tcc.jsxLayout) {
    completedAgents.push('jsx-layout');
  }
  if (tcc.styling) {
    completedAgents.push('tailwind-styling');
  }
  if (tcc.finalProduct && (tcc.finalProduct as any).componentCode) {
    completedAgents.push('component-assembler');
  }
  if (tcc.validationResult) {
    completedAgents.push('code-validator');
  }
  if (tcc.finalProduct && tcc.validationResult) {
    completedAgents.push('tool-finalizer');
  }

  const remainingAgents = allAgents.filter(agent => !completedAgents.includes(agent));
  const completionPercentage = Math.round((completedAgents.length / allAgents.length) * 100);
  const isComplete = completedAgents.length === allAgents.length;

  return {
    completedAgents,
    remainingAgents,
    completionPercentage,
    isComplete
  };
}
