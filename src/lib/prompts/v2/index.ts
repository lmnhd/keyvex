// ============================================================================
// V2 AGENT PROMPTS INDEX
// Exports all prompts for the Product Tool Creation V2 multi-agent system
// ============================================================================

import { 
  getFunctionPlannerSystemPrompt,
  FUNCTION_PLANNER_SYSTEM_PROMPT
} from './function-planner-prompt';

import { 
  getStateDesignSystemPrompt,
  STATE_DESIGN_SYSTEM_PROMPT 
} from './state-design-prompt';

import { 
  getJsxLayoutSystemPrompt,
  JSX_LAYOUT_SYSTEM_PROMPT 
} from './jsx-layout-prompt';

import { 
  getTailwindStylingSystemPrompt,
  TAILWIND_STYLING_SYSTEM_PROMPT 
} from './tailwind-styling-prompt';

import { 
  getDataRequirementsResearchSystemPrompt,
  getDataRequirementsResearchUserPrompt,
  DATA_REQUIREMENTS_RESEARCH_SYSTEM_PROMPT 
} from './data-requirements-research-prompt';

// Re-export individual components (including dynamic getters)
export { 
  getFunctionPlannerSystemPrompt,
  getStateDesignSystemPrompt,
  getJsxLayoutSystemPrompt,
  getTailwindStylingSystemPrompt,
  getDataRequirementsResearchSystemPrompt,
  getDataRequirementsResearchUserPrompt,
  FUNCTION_PLANNER_SYSTEM_PROMPT,
  STATE_DESIGN_SYSTEM_PROMPT,
  JSX_LAYOUT_SYSTEM_PROMPT,
  TAILWIND_STYLING_SYSTEM_PROMPT,
  DATA_REQUIREMENTS_RESEARCH_SYSTEM_PROMPT
};

// Convenience object for accessing all prompts (deprecated - use dynamic getters)
export const V2_AGENT_PROMPTS = {
  functionPlanner: FUNCTION_PLANNER_SYSTEM_PROMPT,
  stateDesign: STATE_DESIGN_SYSTEM_PROMPT,
  jsxLayout: JSX_LAYOUT_SYSTEM_PROMPT,
  tailwindStyling: TAILWIND_STYLING_SYSTEM_PROMPT,
  dataRequirementsResearch: DATA_REQUIREMENTS_RESEARCH_SYSTEM_PROMPT
} as const;

// Agent prompt selector helper (deprecated - use specific getters)
export function getAgentPrompt(agentType: keyof typeof V2_AGENT_PROMPTS): string {
  return V2_AGENT_PROMPTS[agentType];
}

// V2 Dynamic Prompt Selectors
export function getV2AgentPrompt(
  agentType: 'function-planner' | 'state-design' | 'jsx-layout' | 'tailwind-styling' | 'data-requirements-research',
  isEditing: boolean = false
): string {
  switch (agentType) {
    case 'function-planner':
      return getFunctionPlannerSystemPrompt(isEditing);
    case 'state-design':
      return getStateDesignSystemPrompt(isEditing);
    case 'jsx-layout':
      return getJsxLayoutSystemPrompt(isEditing);
    case 'tailwind-styling':
      return getTailwindStylingSystemPrompt(isEditing);
    case 'data-requirements-research':
      return getDataRequirementsResearchSystemPrompt(isEditing);
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
} 
