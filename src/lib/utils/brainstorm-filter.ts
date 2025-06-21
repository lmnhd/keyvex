/**
 * Brainstorm Data Filtering Utilities (Phase 1.3)
 * Enhanced for Unified TCC Interface Integration
 * 
 * Each agent should only receive the specific brainstorm data relevant to its task.
 * This prevents context window bloat and improves AI focus on relevant information.
 * Now works with the unified TCC interface - NO GENERIC TYPES!
 */

import logger from '@/lib/logger';
import { 
  AgentType,
  CoreBrainstormData,
  FunctionPlannerBrainstormData,
  StateDesignBrainstormData,
  JSXLayoutBrainstormData,
  TailwindStylingBrainstormData,
  ComponentAssemblerBrainstormData,
  BrainstormFilterContext
} from '@/lib/types/tcc-unified';
import { BrainstormData } from '@/lib/types/product-tool-creation-v2/tcc';

/**
 * Convert raw brainstorm data to typed core data structure
 * Handles backward compatibility with legacy field names
 */
function convertToCoreData(brainstormData: BrainstormData): CoreBrainstormData {
  return {
    coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept || 'Not specified',
    valueProposition: brainstormData.valueProposition || 'Not specified',
    toolType: 'calculator', // Default type, can be enhanced
    targetAudience: 'general', // Default audience, can be enhanced
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
 * Create filter context for logging and analysis
 */
function createFilterContext(
  agentType: AgentType,
  originalData: BrainstormData,
  filteredData: Partial<CoreBrainstormData>,
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
 * Filter brainstorm data for Function Planner Agent
 * Needs: Core data + inputs + calculations + flow + enhancements
 */
export function filterBrainstormForFunctionPlanner(
  brainstormData: BrainstormData,
  jobId: string
): FunctionPlannerBrainstormData | null {
  if (!brainstormData) return null;

  const coreData = convertToCoreData(brainstormData);
  const filtered: FunctionPlannerBrainstormData = {
    ...coreData // Function Planner needs all core data
  };

  const fieldsIncluded = Object.keys(filtered).filter(key => 
    filtered[key as keyof FunctionPlannerBrainstormData] !== undefined
  );
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
  }, '🎯 BRAINSTORM FILTER: Function Planner data filtered');

  return filtered;
}

/**
 * Filter brainstorm data for State Design Agent  
 * Needs: Core data + inputs + calculations + calculation logic
 */
export function filterBrainstormForStateDesign(
  brainstormData: BrainstormData,
  jobId: string
): StateDesignBrainstormData | null {
  if (!brainstormData) return null;

  const coreData = convertToCoreData(brainstormData);
  const filtered: StateDesignBrainstormData = {
    coreConcept: coreData.coreConcept,
    valueProposition: coreData.valueProposition,
    toolType: coreData.toolType,
    targetAudience: coreData.targetAudience,
    suggestedInputs: coreData.suggestedInputs,
    keyCalculations: coreData.keyCalculations,
    calculationLogic: coreData.calculationLogic,
    // Excluded for State Design: interactionFlow, leadCaptureStrategy, creativeEnhancements
    interactionFlow: [], // Required by interface but empty for State Design
    leadCaptureStrategy: { timing: '', method: '', incentive: '' }, // Required by interface but empty
    creativeEnhancements: [] // Required by interface but empty
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
    fieldsKept: fieldsIncluded.length
  }, '🎯 BRAINSTORM FILTER: State Design data filtered');

  return filtered;
}

/**
 * Filter brainstorm data for JSX Layout Agent
 * Needs: Core data + inputs + interaction flow + calculations + lead capture
 */
export function filterBrainstormForJSXLayout(
  brainstormData: BrainstormData,
  jobId: string
): JSXLayoutBrainstormData | null {
  if (!brainstormData) return null;

  const coreData = convertToCoreData(brainstormData);
  const filtered: JSXLayoutBrainstormData = {
    coreConcept: coreData.coreConcept,
    valueProposition: coreData.valueProposition,
    toolType: coreData.toolType,
    targetAudience: coreData.targetAudience,
    suggestedInputs: coreData.suggestedInputs,
    interactionFlow: coreData.interactionFlow,
    keyCalculations: coreData.keyCalculations,
    leadCaptureStrategy: coreData.leadCaptureStrategy,
    // Excluded for JSX Layout: calculationLogic, creativeEnhancements
    calculationLogic: [], // Required by interface but empty for JSX Layout
    creativeEnhancements: [] // Required by interface but empty
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
    fieldsKept: fieldsIncluded.length
  }, '🎯 BRAINSTORM FILTER: JSX Layout data filtered');

  return filtered;
}

/**
 * Filter brainstorm data for Tailwind Styling Agent
 * Needs: Core data + creative enhancements + lead capture (for styling themes)
 */
export function filterBrainstormForTailwindStyling(
  brainstormData: BrainstormData,
  jobId: string
): TailwindStylingBrainstormData | null {
  if (!brainstormData) return null;

  const coreData = convertToCoreData(brainstormData);
  const filtered: TailwindStylingBrainstormData = {
    coreConcept: coreData.coreConcept,
    valueProposition: coreData.valueProposition,
    toolType: coreData.toolType,
    targetAudience: coreData.targetAudience,
    creativeEnhancements: coreData.creativeEnhancements,
    leadCaptureStrategy: coreData.leadCaptureStrategy,
    // Excluded for Tailwind Styling: suggestedInputs, keyCalculations, calculationLogic, interactionFlow
    suggestedInputs: [], // Required by interface but empty
    keyCalculations: [], // Required by interface but empty
    calculationLogic: [], // Required by interface but empty
    interactionFlow: [] // Required by interface but empty
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
    fieldsKept: fieldsIncluded.length
  }, '🎯 BRAINSTORM FILTER: Tailwind Styling data filtered');

  return filtered;
}

/**
 * Filter brainstorm data for Component Assembler Agent
 * Needs: Complete core data for metadata and context
 */
export function filterBrainstormForComponentAssembler(
  brainstormData: BrainstormData,
  jobId: string
): ComponentAssemblerBrainstormData | null {
  if (!brainstormData) return null;

  const coreData = convertToCoreData(brainstormData);
  const filtered: ComponentAssemblerBrainstormData = {
    ...coreData // Component Assembler needs all core data for context
  };

  const fieldsIncluded = Object.keys(filtered).filter(key => 
    filtered[key as keyof ComponentAssemblerBrainstormData] !== undefined
  );
  const fieldsExcluded: string[] = []; // Component Assembler includes all fields

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
    fieldsKept: fieldsIncluded.length
  }, '🎯 BRAINSTORM FILTER: Component Assembler data filtered');

  return filtered;
}

/**
 * Generate filtered brainstorm context string for AI prompts
 * Converts filtered data to a structured string for AI consumption
 */
export function generateFilteredBrainstormContext(
  filteredData: CoreBrainstormData,
  agentName: string
): string {
  const sections: string[] = [];

  // Core concept and value
  sections.push(`## Core Concept\n${filteredData.coreConcept}`);
  sections.push(`## Value Proposition\n${filteredData.valueProposition}`);
  sections.push(`## Tool Type\n${filteredData.toolType}`);
  sections.push(`## Target Audience\n${filteredData.targetAudience}`);

  // Key calculations (if available)
  if (filteredData.keyCalculations && filteredData.keyCalculations.length > 0) {
    const calculationsText = filteredData.keyCalculations
      .map(calc => `- **${calc.name}**: ${calc.formula}\n  ${calc.description}\n  Variables: ${calc.variables.join(', ')}`)
      .join('\n');
    sections.push(`## Key Calculations\n${calculationsText}`);
  }

  // Suggested inputs (if available)
  if (filteredData.suggestedInputs && filteredData.suggestedInputs.length > 0) {
    const inputsText = filteredData.suggestedInputs
      .map(input => `- **${input.label}** (${input.type}): ${input.description}${input.required ? ' [Required]' : ''}`)
      .join('\n');
    sections.push(`## Suggested Inputs\n${inputsText}`);
  }

  // Interaction flow (if available)
  if (filteredData.interactionFlow && filteredData.interactionFlow.length > 0) {
    const flowText = filteredData.interactionFlow
      .map(step => `${step.step}. **${step.title}**: ${step.description}\n   User Action: ${step.userAction}`)
      .join('\n');
    sections.push(`## Interaction Flow\n${flowText}`);
  }

  // Creative enhancements (if available)
  if (filteredData.creativeEnhancements && filteredData.creativeEnhancements.length > 0) {
    const enhancementsText = filteredData.creativeEnhancements
      .map(enhancement => `- ${enhancement}`)
      .join('\n');
    sections.push(`## Creative Enhancements\n${enhancementsText}`);
  }

  return `# Brainstorm Context for ${agentName}\n\n${sections.join('\n\n')}`;
} 