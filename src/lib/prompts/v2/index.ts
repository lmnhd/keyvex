// ============================================================================
// V2 AGENT PROMPTS INDEX
// Exports all prompts for the Product Tool Creation V2 multi-agent system
// ============================================================================

export { 
  FUNCTION_PLANNER_SYSTEM_PROMPT, 
  ALLOWED_COMPONENTS, 
  ALL_ALLOWED_COMPONENTS,
  type AllowedComponentType 
} from './function-planner-prompt';

export { STATE_DESIGN_SYSTEM_PROMPT } from './state-design-prompt';

export { JSX_LAYOUT_SYSTEM_PROMPT } from './jsx-layout-prompt';

export { TAILWIND_STYLING_SYSTEM_PROMPT } from './tailwind-styling-prompt';

// Convenience object for accessing all prompts
export const V2_AGENT_PROMPTS = {
  functionPlanner: FUNCTION_PLANNER_SYSTEM_PROMPT,
  stateDesign: STATE_DESIGN_SYSTEM_PROMPT,
  jsxLayout: JSX_LAYOUT_SYSTEM_PROMPT,
  tailwindStyling: TAILWIND_STYLING_SYSTEM_PROMPT
} as const;

// Agent prompt selector helper
export function getAgentPrompt(agentType: keyof typeof V2_AGENT_PROMPTS): string {
  return V2_AGENT_PROMPTS[agentType];
} 