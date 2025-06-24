/**
 * TCC Manager (Phase 1.2)
 * Centralized logic for creating and updating the ToolConstructionContext
 * ✅ FIXED: Ensures results are written to BOTH the generic 'steps' log AND the specific agent fields
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  ToolConstructionContext,
  AgentType,
  AgentResult,
  InitialTcc,
  FunctionPlannerResult,
  StateDesignResult,
  JsxLayoutResult,
  TailwindStylingResult,
  ComponentAssemblerResult,
  CodeValidatorResult,
  ToolFinalizerResult
} from '../../../types/tcc-unified';
import logger from '../../../logger';

/**
 * Creates the initial TCC from the brainstorm data.
 */
export function createInitialTcc(initialData: InitialTcc): ToolConstructionContext {
  const now = new Date().toISOString();
  
  const tcc: ToolConstructionContext = {
    ...initialData,
    status: 'in_progress',
    currentOrchestrationStep: 'planning_function_signatures',
    targetAudience: initialData.userInput.targetAudience || 'General users',
    createdAt: now,
    updatedAt: now,
    tccVersion: '1.0.0', // Required field from base schema
    steps: {}, // Initialize empty steps object
  };
  
  logger.info({
    jobId: tcc.jobId,
    userInput: tcc.userInput,
  }, 'Initial TCC created successfully');

  return tcc;
}

/**
 * Updates the TCC with the result from a completed agent.
 * CRITICAL FIX: This now updates the specific agent field (e.g., tcc.jsxLayout)
 * in addition to the generic steps log. This ensures subsequent agents
 * receive the correct, strongly-typed data.
 */
export function updateTccWithAgentResult(
  tcc: ToolConstructionContext,
  agentType: AgentType,
  result: AgentResult
): ToolConstructionContext {
  const newTcc = { ...tcc };

  // 1. Update the specific, strongly-typed field for the agent
  switch (agentType) {
    case 'function-planner':
      newTcc.functionSignatures = (result as FunctionPlannerResult).functionSignatures;
      break;
    case 'state-design':
      newTcc.stateLogic = (result as StateDesignResult).stateLogic;
      break;
    case 'jsx-layout':
      newTcc.jsxLayout = (result as JsxLayoutResult).jsxLayout;
      break;
    case 'tailwind-styling':
      newTcc.styling = (result as TailwindStylingResult).styling;
      break;
    case 'component-assembler':
      // Component assembler result is not stored in a dedicated TCC field
      break;
    case 'code-validator':
      // Code validator result is not stored in a dedicated TCC field
      break;
    case 'tool-finalizer':
      newTcc.finalProduct = (result as ToolFinalizerResult).finalProduct;
      break;
    }

  // 2. Update the generic steps log based on the base TCC schema structure
  const stepKey = getStepKeyForAgent(agentType);
  if (stepKey && newTcc.steps) {
    newTcc.steps = {
      ...newTcc.steps,
      [stepKey]: {
        ...newTcc.steps[stepKey as keyof typeof newTcc.steps],
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: result,
      },
    };
  }

  // 3. Update timestamps
  newTcc.updatedAt = new Date().toISOString();

  logger.info(
    {
      jobId: newTcc.jobId,
    agentType,
      updatedFields: [agentType, 'steps'],
    },
    `TCC updated with result from ${agentType}`
  );

  return newTcc;
}

/**
 * Maps agent types to their corresponding step keys in the base TCC schema
 */
function getStepKeyForAgent(agentType: AgentType): string | null {
  switch (agentType) {
    case 'function-planner':
      return null; // No specific step key for function planner in base schema
    case 'state-design':
      return 'designingStateLogic';
    case 'jsx-layout':
      return 'designingJsxLayout';
    case 'tailwind-styling':
      return 'applyingTailwindStyling';
    case 'component-assembler':
      return 'assemblingComponent';
    case 'code-validator':
      return 'validatingCode';
    case 'tool-finalizer':
      return null; // No specific step key for tool finalizer in base schema
    default:
      return null;
  }
}

/**
 * Updates the status of a specific step in the TCC.
 */
export function updateTccStepStatus(
  tcc: ToolConstructionContext,
  agentType: AgentType,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  details?: Record<string, any>
): ToolConstructionContext {
  const now = new Date().toISOString();
  const stepKey = getStepKeyForAgent(agentType);
  
  if (!stepKey || !tcc.steps) {
    return { ...tcc, updatedAt: now };
  }

  const existingStep = tcc.steps[stepKey as keyof typeof tcc.steps] || { startedAt: now };

  const newTcc = {
    ...tcc,
    steps: {
      ...tcc.steps,
      [stepKey]: {
        ...existingStep,
        status,
        ...details,
        updatedAt: now,
      },
    },
    updatedAt: now,
  };
  
  return newTcc;
}