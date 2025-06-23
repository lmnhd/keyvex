/**
 * Unified Brainstorm Filter Utility (Phase 1.3)
 * Enhanced filtering for the unified TCC system
 * 
 * Provides agent-specific brainstorm data filtering to optimize context windows
 * and improve AI focus on relevant information.
 */

import { 
  AgentType,
  CoreBrainstormData,
  StateDesignBrainstormData,
  JSXLayoutBrainstormData,
  TailwindStylingBrainstormData,
  BrainstormFilterContext
} from '@/lib/types/tcc-unified';
import { BrainstormData } from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

/**
 * Main filtering function for unified system
 */
export function filterBrainstormDataForAgent(
  brainstormData: BrainstormData | null,
  agentType: AgentType,
  jobId: string
): CoreBrainstormData | null {
  if (!brainstormData) {
    logger.warn({ agentType, jobId }, '🎯 Unified Filter: No brainstorm data provided');
    return null;
  }

  logger.info({
    agentType,
    jobId,
    originalDataSize: JSON.stringify(brainstormData).length
  }, '🎯 Unified Filter: Starting brainstorm data filtering');

  switch (agentType) {
    case 'function-planner':
      return filterForFunctionPlanner(brainstormData, jobId);
    case 'state-design':
      return filterForStateDesign(brainstormData, jobId);
    case 'jsx-layout':
      return filterForJSXLayout(brainstormData, jobId);
    case 'tailwind-styling':
      return filterForTailwindStyling(brainstormData, jobId);
    case 'component-assembler':
      return filterForComponentAssembler(brainstormData, jobId);
    case 'code-validator':
      return filterForCodeValidator(brainstormData, jobId);
    case 'tool-finalizer':
      return filterForToolFinalizer(brainstormData, jobId);
    default:
      logger.error({ agentType, jobId }, '🎯 Unified Filter: Unknown agent type');
      return null;
  }
}

/**
 * Convert raw brainstorm data to unified core structure
 */
function convertToUnifiedCoreData(brainstormData: BrainstormData): CoreBrainstormData {
  return {
    coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept || 'Not specified',
    valueProposition: brainstormData.valueProposition || 'Not specified',
    toolType: determineToolType(brainstormData),
    targetAudience: (typeof brainstormData.targetAudience === 'string' ? brainstormData.targetAudience : 'general'),
    keyCalculations: brainstormData.keyCalculations || [],
    calculationLogic: brainstormData.calculationLogic || [],
    suggestedInputs: brainstormData.suggestedInputs || [],
    interactionFlow: brainstormData.interactionFlow || [],
    leadCaptureStrategy: brainstormData.leadCaptureStrategy || {
      timing: 'after_calculation',
      method: 'email_form',
      incentive: 'detailed_report'
    },
    creativeEnhancements: brainstormData.creativeEnhancements || []
  };
}

/**
 * Determine tool type from brainstorm data
 */
function determineToolType(brainstormData: BrainstormData): string {
  const concept = (brainstormData.coreConcept || brainstormData.coreWConcept || '').toLowerCase();
  
  if (concept.includes('calculator') || concept.includes('calculate')) {
    return 'calculator';
  }
  if (concept.includes('comparison') || concept.includes('compare')) {
    return 'comparison';
  }
  if (concept.includes('assessment') || concept.includes('score')) {
    return 'assessment';
  }
  if (concept.includes('planner') || concept.includes('planning')) {
    return 'planner';
  }
  if (concept.includes('analyzer') || concept.includes('analysis')) {
    return 'analyzer';
  }
  
  return 'calculator'; // Default
}

/**
 * Create filter context for logging
 */
function createFilterContext(
  agentType: AgentType,
  originalData: BrainstormData,
  filteredData: CoreBrainstormData,
  fieldsIncluded: string[],
  fieldsExcluded: string[]
): BrainstormFilterContext {
  const originalSize = JSON.stringify(originalData).length;
  const filteredSize = JSON.stringify(filteredData).length;
  const reductionPercentage = Math.round(((originalSize - filteredSize) / originalSize) * 100);

  return {
    agentType,
    originalDataSize: originalSize,
    filteredDataSize: filteredSize,
    reductionPercentage,
    fieldsIncluded,
    fieldsExcluded
  };
}

/**
 * Function Planner filtering - needs comprehensive data
 */
function filterForFunctionPlanner(
  brainstormData: BrainstormData,
  jobId: string
): CoreBrainstormData {
  const coreData = convertToUnifiedCoreData(brainstormData);
  
  // Function Planner needs all core data for comprehensive function planning
  const filtered: CoreBrainstormData = { ...coreData };

  const fieldsIncluded = Object.keys(filtered);
  const fieldsExcluded: string[] = []; // Function Planner includes all fields

  const filterContext = createFilterContext(
    'function-planner',
    brainstormData,
    filtered,
    fieldsIncluded,
    fieldsExcluded
  );

  logger.info({
    jobId,
    ...filterContext,
    fieldsKept: fieldsIncluded.length
  }, '🎯 Unified Filter: Function Planner data filtered');

  return filtered;
}

/**
 * State Design filtering - focuses on calculations and logic
 */
function filterForStateDesign(
  brainstormData: BrainstormData,
  jobId: string
): StateDesignBrainstormData {
  const coreData = convertToUnifiedCoreData(brainstormData);
  
  const filtered: StateDesignBrainstormData = {
    coreConcept: coreData.coreConcept,
    valueProposition: coreData.valueProposition,
    toolType: coreData.toolType,
    targetAudience: coreData.targetAudience,
    suggestedInputs: coreData.suggestedInputs,
    keyCalculations: coreData.keyCalculations,
    calculationLogic: coreData.calculationLogic,
    // Minimal data for required fields
    interactionFlow: [],
    leadCaptureStrategy: { timing: '', method: '', incentive: '' },
    creativeEnhancements: []
  };

  const fieldsIncluded = ['coreConcept', 'valueProposition', 'toolType', 'targetAudience', 'suggestedInputs', 'keyCalculations', 'calculationLogic'];
  const fieldsExcluded = ['interactionFlow', 'leadCaptureStrategy', 'creativeEnhancements'];

  const filterContext = createFilterContext(
    'state-design',
    brainstormData,
    filtered,
    fieldsIncluded,
    fieldsExcluded
  );

  logger.info({
    jobId,
    ...filterContext,
    calculationsCount: filtered.keyCalculations.length,
    logicCount: filtered.calculationLogic.length
  }, '🎯 Unified Filter: State Design data filtered');

  return filtered;
}

/**
 * JSX Layout filtering - focuses on structure and flow
 */
function filterForJSXLayout(
  brainstormData: BrainstormData,
  jobId: string
): JSXLayoutBrainstormData {
  const coreData = convertToUnifiedCoreData(brainstormData);
  
  const filtered: JSXLayoutBrainstormData = {
    coreConcept: coreData.coreConcept,
    valueProposition: coreData.valueProposition,
    toolType: coreData.toolType,
    targetAudience: coreData.targetAudience,
    suggestedInputs: coreData.suggestedInputs,
    interactionFlow: coreData.interactionFlow,
    keyCalculations: coreData.keyCalculations,
    leadCaptureStrategy: coreData.leadCaptureStrategy,
    // Minimal data for required fields
    calculationLogic: [],
    creativeEnhancements: []
  };

  const fieldsIncluded = ['coreConcept', 'valueProposition', 'toolType', 'targetAudience', 'suggestedInputs', 'interactionFlow', 'keyCalculations', 'leadCaptureStrategy'];
  const fieldsExcluded = ['calculationLogic', 'creativeEnhancements'];

  const filterContext = createFilterContext(
    'jsx-layout',
    brainstormData,
    filtered,
    fieldsIncluded,
    fieldsExcluded
  );

  logger.info({
    jobId,
    ...filterContext,
    inputsCount: filtered.suggestedInputs.length,
    flowSteps: filtered.interactionFlow.length
  }, '🎯 Unified Filter: JSX Layout data filtered');

  return filtered;
}

/**
 * Tailwind Styling filtering - focuses on aesthetics and themes
 */
function filterForTailwindStyling(
  brainstormData: BrainstormData,
  jobId: string
): TailwindStylingBrainstormData {
  const coreData = convertToUnifiedCoreData(brainstormData);
  
  const filtered: TailwindStylingBrainstormData = {
    coreConcept: coreData.coreConcept,
    valueProposition: coreData.valueProposition,
    toolType: coreData.toolType,
    targetAudience: coreData.targetAudience,
    creativeEnhancements: coreData.creativeEnhancements,
    leadCaptureStrategy: coreData.leadCaptureStrategy,
    // Minimal data for required fields
    suggestedInputs: [],
    keyCalculations: [],
    calculationLogic: [],
    interactionFlow: []
  };

  const fieldsIncluded = ['coreConcept', 'valueProposition', 'toolType', 'targetAudience', 'creativeEnhancements', 'leadCaptureStrategy'];
  const fieldsExcluded = ['suggestedInputs', 'keyCalculations', 'calculationLogic', 'interactionFlow'];

  const filterContext = createFilterContext(
    'tailwind-styling',
    brainstormData,
    filtered,
    fieldsIncluded,
    fieldsExcluded
  );

  logger.info({
    jobId,
    ...filterContext,
    enhancementsCount: filtered.creativeEnhancements.length,
    toolType: filtered.toolType
  }, '🎯 Unified Filter: Tailwind Styling data filtered');

  return filtered;
}

/**
 * Component Assembler filtering - needs core context only
 */
function filterForComponentAssembler(
  brainstormData: BrainstormData,
  jobId: string
): CoreBrainstormData {
  const coreData = convertToUnifiedCoreData(brainstormData);
  
  // Component Assembler needs core context for metadata
  const filtered: CoreBrainstormData = { ...coreData };

  const fieldsIncluded = Object.keys(filtered);
  const fieldsExcluded: string[] = []; // Component Assembler includes all for context

  const filterContext = createFilterContext(
    'component-assembler',
    brainstormData,
    filtered,
    fieldsIncluded,
    fieldsExcluded
  );

  logger.info({
    jobId,
    ...filterContext,
    concept: filtered.coreConcept
  }, '🎯 Unified Filter: Component Assembler data filtered');

  return filtered;
}

/**
 * Code Validator filtering - minimal context needed
 */
function filterForCodeValidator(
  brainstormData: BrainstormData,
  jobId: string
): CoreBrainstormData {
  const coreData = convertToUnifiedCoreData(brainstormData);
  
  // Code Validator only needs basic context
  const filtered: CoreBrainstormData = {
    coreConcept: coreData.coreConcept,
    valueProposition: coreData.valueProposition,
    toolType: coreData.toolType,
    targetAudience: coreData.targetAudience,
    // Minimal arrays for validation context
    keyCalculations: coreData.keyCalculations.slice(0, 3), // Only first 3 for context
    calculationLogic: [],
    suggestedInputs: coreData.suggestedInputs.slice(0, 5), // Only first 5 for context
    interactionFlow: [],
    leadCaptureStrategy: { timing: '', method: '', incentive: '' },
    creativeEnhancements: []
  };

  const fieldsIncluded = ['coreConcept', 'valueProposition', 'toolType', 'targetAudience', 'keyCalculations(limited)', 'suggestedInputs(limited)'];
  const fieldsExcluded = ['calculationLogic', 'interactionFlow', 'leadCaptureStrategy', 'creativeEnhancements'];

  const filterContext = createFilterContext(
    'code-validator',
    brainstormData,
    filtered,
    fieldsIncluded,
    fieldsExcluded
  );

  logger.info({
    jobId,
    ...filterContext,
    limitedCalculations: filtered.keyCalculations.length,
    limitedInputs: filtered.suggestedInputs.length
  }, '🎯 Unified Filter: Code Validator data filtered');

  return filtered;
}

/**
 * Tool Finalizer filtering - comprehensive context for final product
 */
function filterForToolFinalizer(
  brainstormData: BrainstormData,
  jobId: string
): CoreBrainstormData {
  const coreData = convertToUnifiedCoreData(brainstormData);
  
  // Tool Finalizer needs comprehensive context for final product creation
  const filtered: CoreBrainstormData = { ...coreData };

  const fieldsIncluded = Object.keys(filtered);
  const fieldsExcluded: string[] = []; // Tool Finalizer includes all for final product

  const filterContext = createFilterContext(
    'tool-finalizer',
    brainstormData,
    filtered,
    fieldsIncluded,
    fieldsExcluded
  );

  logger.info({
    jobId,
    ...filterContext,
    finalContext: 'comprehensive'
  }, '🎯 Unified Filter: Tool Finalizer data filtered');

  return filtered;
}

/**
 * Get filtering statistics for analysis
 */
export function getBrainstormFilteringStats(
  originalData: BrainstormData,
  agentType: AgentType
): {
  originalSize: number;
  estimatedFilteredSize: number;
  estimatedReduction: number;
  fieldsKept: number;
  fieldsExcluded: number;
} {
  const coreData = convertToUnifiedCoreData(originalData);
  const originalSize = JSON.stringify(originalData).length;
  
  // Estimate filtered size based on agent type
  let estimatedFilteredSize: number;
  let fieldsKept: number;
  let fieldsExcluded: number;

  switch (agentType) {
    case 'function-planner':
    case 'component-assembler':
    case 'tool-finalizer':
      estimatedFilteredSize = JSON.stringify(coreData).length;
      fieldsKept = 9; // All core fields
      fieldsExcluded = 0;
      break;
    
    case 'state-design':
    case 'jsx-layout':
      estimatedFilteredSize = Math.round(JSON.stringify(coreData).length * 0.7); // ~70% of core data
      fieldsKept = 7;
      fieldsExcluded = 2;
      break;
    
    case 'tailwind-styling':
      estimatedFilteredSize = Math.round(JSON.stringify(coreData).length * 0.5); // ~50% of core data
      fieldsKept = 6;
      fieldsExcluded = 3;
      break;
    
    case 'code-validator':
      estimatedFilteredSize = Math.round(JSON.stringify(coreData).length * 0.3); // ~30% of core data
      fieldsKept = 4;
      fieldsExcluded = 5;
      break;
    
    default:
      estimatedFilteredSize = originalSize;
      fieldsKept = 9;
      fieldsExcluded = 0;
  }

  const estimatedReduction = Math.round(((originalSize - estimatedFilteredSize) / originalSize) * 100);

  return {
    originalSize,
    estimatedFilteredSize,
    estimatedReduction,
    fieldsKept,
    fieldsExcluded
  };
}
