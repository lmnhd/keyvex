/**
 * Brainstorm Data Filtering Utilities
 * 
 * Each agent should only receive the specific brainstorm data relevant to its task.
 * This prevents context window bloat and improves AI focus on relevant information.
 */

import logger from '@/lib/logger';

// Core fields that all agents need
interface CoreBrainstormData {
  coreConcept?: string;
  coreWConcept?: string;
  valueProposition?: string;
  toolType?: string;
  targetAudience?: string;
}

// Function Planner specific data
interface FunctionPlannerBrainstormData extends CoreBrainstormData {
  suggestedInputs?: any[];
  keyCalculations?: any[];
  interactionFlow?: any[];
  creativeEnhancements?: string[];
}

// State Design specific data  
interface StateDesignBrainstormData extends CoreBrainstormData {
  suggestedInputs?: any[];
  keyCalculations?: any[];
  calculationLogic?: any[];
}

// JSX Layout specific data
interface JSXLayoutBrainstormData extends CoreBrainstormData {
  suggestedInputs?: any[];
  interactionFlow?: any[];
  keyCalculations?: any[];
  leadCaptureStrategy?: any;
}

// Tailwind Styling specific data
interface TailwindStylingBrainstormData extends CoreBrainstormData {
  creativeEnhancements?: string[];
  leadCaptureStrategy?: any;
}

// Component Assembler specific data
interface ComponentAssemblerBrainstormData extends CoreBrainstormData {
  // Component Assembler mainly needs core data for metadata
}

/**
 * Filter brainstorm data for Function Planner Agent
 * Needs: Core data + inputs + calculations + flow + enhancements
 */
export function filterBrainstormForFunctionPlanner(
  brainstormData: any,
  jobId: string
): FunctionPlannerBrainstormData | null {
  if (!brainstormData) return null;

  const filtered: FunctionPlannerBrainstormData = {
    coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept,
    valueProposition: brainstormData.valueProposition,
    toolType: brainstormData.toolType,
    targetAudience: brainstormData.targetAudience,
    suggestedInputs: brainstormData.suggestedInputs,
    keyCalculations: brainstormData.keyCalculations,
    interactionFlow: brainstormData.interactionFlow,
    creativeEnhancements: brainstormData.creativeEnhancements
  };

  const originalSize = JSON.stringify(brainstormData).length;
  const filteredSize = JSON.stringify(filtered).length;
  const reductionPercent = Math.round(((originalSize - filteredSize) / originalSize) * 100);

  logger.info({
    jobId,
    agent: 'FunctionPlanner',
    originalSize,
    filteredSize,
    reductionPercent,
    fieldsKept: Object.keys(filtered).filter(key => filtered[key as keyof FunctionPlannerBrainstormData] !== undefined).length
  }, '🎯 BRAINSTORM FILTER: Function Planner data filtered');

  return filtered;
}

/**
 * Filter brainstorm data for State Design Agent  
 * Needs: Core data + inputs + calculations + calculation logic
 */
export function filterBrainstormForStateDesign(
  brainstormData: any,
  jobId: string
): StateDesignBrainstormData | null {
  if (!brainstormData) return null;

  const filtered: StateDesignBrainstormData = {
    coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept,
    valueProposition: brainstormData.valueProposition,
    toolType: brainstormData.toolType,
    targetAudience: brainstormData.targetAudience,
    suggestedInputs: brainstormData.suggestedInputs,
    keyCalculations: brainstormData.keyCalculations,
    calculationLogic: brainstormData.calculationLogic
  };

  const originalSize = JSON.stringify(brainstormData).length;
  const filteredSize = JSON.stringify(filtered).length;
  const reductionPercent = Math.round(((originalSize - filteredSize) / originalSize) * 100);

  logger.info({
    jobId,
    agent: 'StateDesign',
    originalSize,
    filteredSize,
    reductionPercent,
    fieldsKept: Object.keys(filtered).filter(key => filtered[key as keyof StateDesignBrainstormData] !== undefined).length
  }, '🎯 BRAINSTORM FILTER: State Design data filtered');

  return filtered;
}

/**
 * Filter brainstorm data for JSX Layout Agent
 * Needs: Core data + inputs + interaction flow + calculations + lead capture
 */
export function filterBrainstormForJSXLayout(
  brainstormData: any,
  jobId: string
): JSXLayoutBrainstormData | null {
  if (!brainstormData) return null;

  const filtered: JSXLayoutBrainstormData = {
    coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept,
    valueProposition: brainstormData.valueProposition,
    toolType: brainstormData.toolType,
    targetAudience: brainstormData.targetAudience,
    suggestedInputs: brainstormData.suggestedInputs,
    interactionFlow: brainstormData.interactionFlow,
    keyCalculations: brainstormData.keyCalculations,
    leadCaptureStrategy: brainstormData.leadCaptureStrategy
  };

  const originalSize = JSON.stringify(brainstormData).length;
  const filteredSize = JSON.stringify(filtered).length;
  const reductionPercent = Math.round(((originalSize - filteredSize) / originalSize) * 100);

  logger.info({
    jobId,
    agent: 'JSXLayout',
    originalSize,
    filteredSize,
    reductionPercent,
    fieldsKept: Object.keys(filtered).filter(key => filtered[key as keyof JSXLayoutBrainstormData] !== undefined).length
  }, '🎯 BRAINSTORM FILTER: JSX Layout data filtered');

  return filtered;
}

/**
 * Filter brainstorm data for Tailwind Styling Agent
 * Needs: Core data + creative enhancements + lead capture (for styling themes)
 */
export function filterBrainstormForTailwindStyling(
  brainstormData: any,
  jobId: string
): TailwindStylingBrainstormData | null {
  if (!brainstormData) return null;

  const filtered: TailwindStylingBrainstormData = {
    coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept,
    valueProposition: brainstormData.valueProposition,
    toolType: brainstormData.toolType,
    targetAudience: brainstormData.targetAudience,
    creativeEnhancements: brainstormData.creativeEnhancements,
    leadCaptureStrategy: brainstormData.leadCaptureStrategy
  };

  const originalSize = JSON.stringify(brainstormData).length;
  const filteredSize = JSON.stringify(filtered).length;
  const reductionPercent = Math.round(((originalSize - filteredSize) / originalSize) * 100);

  logger.info({
    jobId,
    agent: 'TailwindStyling',
    originalSize,
    filteredSize,
    reductionPercent,
    fieldsKept: Object.keys(filtered).filter(key => filtered[key as keyof TailwindStylingBrainstormData] !== undefined).length
  }, '🎯 BRAINSTORM FILTER: Tailwind Styling data filtered');

  return filtered;
}

/**
 * Filter brainstorm data for Component Assembler Agent
 * Needs: Only core data for component metadata
 */
export function filterBrainstormForComponentAssembler(
  brainstormData: any,
  jobId: string
): ComponentAssemblerBrainstormData | null {
  if (!brainstormData) return null;

  const filtered: ComponentAssemblerBrainstormData = {
    coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept,
    valueProposition: brainstormData.valueProposition,
    toolType: brainstormData.toolType,
    targetAudience: brainstormData.targetAudience
  };

  const originalSize = JSON.stringify(brainstormData).length;
  const filteredSize = JSON.stringify(filtered).length;
  const reductionPercent = Math.round(((originalSize - filteredSize) / originalSize) * 100);

  logger.info({
    jobId,
    agent: 'ComponentAssembler',
    originalSize,
    filteredSize,
    reductionPercent,
    fieldsKept: Object.keys(filtered).filter(key => filtered[key as keyof ComponentAssemblerBrainstormData] !== undefined).length
  }, '🎯 BRAINSTORM FILTER: Component Assembler data filtered');

  return filtered;
}

/**
 * Generate filtered brainstorm context string for prompts
 */
export function generateFilteredBrainstormContext(
  filteredData: any,
  agentName: string
): string {
  if (!filteredData) return '';

  let context = `

RELEVANT BRAINSTORM CONTEXT (${agentName} specific):

CORE CONCEPT: ${filteredData.coreConcept || 'Not specified'}

VALUE PROPOSITION: ${filteredData.valueProposition || 'Not specified'}`;

  // Add agent-specific sections
  if (filteredData.suggestedInputs && filteredData.suggestedInputs.length > 0) {
    context += `

SUGGESTED INPUT FIELDS:`;
    filteredData.suggestedInputs.forEach((input: any) => {
      context += `\n- ${input.label} (${input.type}): ${input.description}`;
    });
  }

  if (filteredData.keyCalculations && filteredData.keyCalculations.length > 0) {
    context += `

KEY CALCULATIONS:`;
    filteredData.keyCalculations.forEach((calc: any) => {
      context += `\n- ${calc.name}: ${calc.formula} (${calc.description})`;
    });
  }

  if (filteredData.interactionFlow && filteredData.interactionFlow.length > 0) {
    context += `

INTERACTION FLOW:`;
    filteredData.interactionFlow.forEach((step: any) => {
      context += `\n${step.step}. ${step.title}: ${step.userAction}`;
    });
  }

  if (filteredData.calculationLogic && filteredData.calculationLogic.length > 0) {
    context += `

CALCULATION LOGIC:`;
    filteredData.calculationLogic.forEach((logic: any) => {
      context += `\n- ${logic.name}: ${logic.formula}`;
    });
  }

  if (filteredData.creativeEnhancements && filteredData.creativeEnhancements.length > 0) {
    context += `

CREATIVE ENHANCEMENTS:`;
    filteredData.creativeEnhancements.forEach((enhancement: string) => {
      context += `\n- ${enhancement}`;
    });
  }

  if (filteredData.leadCaptureStrategy) {
    context += `

LEAD CAPTURE STRATEGY:
- Timing: ${filteredData.leadCaptureStrategy.timing}
- Method: ${filteredData.leadCaptureStrategy.method}
- Incentive: ${filteredData.leadCaptureStrategy.incentive}`;
  }

  return context;
} 