/**
 * Unified Prompt Manager (Phase 1.2 - Centralized Logic)
 * Single source of truth for constructing agent prompts.
 * 
 * CRITICAL FIX: Centralizes prompt generation logic, removing it from individual agent modules.
 * - Dynamically loads system and user prompts for each agent.
 * - Injects TCC data using the appropriate filter.
 * - Incorporates retry hints for adaptive AI behavior.
 */

import { 
  AgentType, 
  RetryAttemptInfo,
  CoreBrainstormData
} from '../../../types/tcc-unified';
import { 
  ToolConstructionContext as BaseTCC,
  BrainstormData
} from '../../../types/product-tool-creation-v2/tcc';
import {
  filterBrainstormForFunctionPlanner,
  filterBrainstormForStateDesign,
  filterBrainstormForJSXLayout,
  filterBrainstormForTailwindStyling,
  filterBrainstormForComponentAssembler,
  generateFilteredBrainstormContext,
  convertToCoreData
} from '../../../utils/brainstorm-filter';
import logger from '../../../logger';

// TODO: Move these to a dedicated /prompts directory
const MOCK_SYSTEM_PROMPTS: Record<AgentType, string> = {
  'function-planner': 'You are a senior software architect specializing in breaking down requirements into precise function signatures. Analyze the provided brainstorm and define all necessary calculation and utility functions.',
  'state-design': 'You are a React state management expert. Your task is to design the complete state logic, including variables, state-setting functions, and calculation logic based on the provided brainstorm data and function signatures. Ensure a robust and efficient state structure.',
  'jsx-layout': 'You are a UI/UX designer and React developer. Create a logical and accessible JSX structure for the tool. Focus on component hierarchy and user interaction flow. Do not add styling.',
  'tailwind-styling': 'You are a TailwindCSS expert. Apply a clean, modern, and responsive design to the provided JSX layout. Use the provided style map and generate a complete, styled component.',
  'component-assembler': 'You are a senior React developer. Your job is to assemble the final, production-ready React component by combining the state logic, JSX layout, and styling. Ensure all parts are correctly integrated.',
  'code-validator': 'You are a code quality and security auditor. Analyze the provided component code for errors, vulnerabilities, and performance issues. Provide a detailed validation report.',
  'tool-finalizer': 'You are a product manager. Your role is to package the final tool by creating its metadata, description, and user instructions. Prepare it for deployment.'
};

/**
 * Get the system prompt for a given agent.
 */
export function getSystemPrompt(agentType: AgentType): string {
  const prompt = MOCK_SYSTEM_PROMPTS[agentType];
  if (!prompt) {
    throw new Error(`System prompt for agent type ${agentType} not found.`);
  }
  return prompt;
}

// ✅ FIXED: Proper interface for edit mode context
export interface EditModeContext {
  isEditMode?: boolean;
  instructions?: string;
  targetChanges?: string[];
}

/**
 * Get the user prompt context for a given agent.
 * This function centralizes the logic for filtering brainstorm data.
 */
function getAgentContext(agentType: AgentType, brainstormData: BrainstormData, jobId: string): CoreBrainstormData | null {
  switch (agentType) {
    case 'function-planner':
      return filterBrainstormForFunctionPlanner(brainstormData, jobId);
    case 'state-design':
      return filterBrainstormForStateDesign(brainstormData, jobId);
    case 'jsx-layout':
      return filterBrainstormForJSXLayout(brainstormData, jobId);
    case 'tailwind-styling':
      return filterBrainstormForTailwindStyling(brainstormData, jobId);
    case 'component-assembler':
      return filterBrainstormForComponentAssembler(brainstormData, jobId);
    default:
      // For agents that need full data, we still convert to the unified CoreBrainstormData
      return convertToCoreData(brainstormData);
  }
}

/**
 * Construct the final user prompt string for the AI.
 * This centralizes TCC data injection and retry hint incorporation.
 */
export function constructUserPrompt(
  agentType: AgentType,
  tcc: BaseTCC,
  retryInfo: RetryAttemptInfo,
  editMode?: EditModeContext
): string {
  let promptSections: string[] = [];

  // 1. Add Retry Context (if applicable)
  if (retryInfo && retryInfo.attemptNumber > 1) {
    promptSections.push('--- RETRY CONTEXT ---');
    promptSections.push(`This is attempt #${retryInfo.attemptNumber}.`);
    if (retryInfo.lastError) {
      promptSections.push(`Previous Attempt Error: ${retryInfo.lastError}`);
    }
    if (retryInfo.adaptedPromptHints && retryInfo.adaptedPromptHints.length > 0) {
      promptSections.push('Please follow these hints to improve the response:');
      promptSections.push(...retryInfo.adaptedPromptHints.map(hint => `- ${hint}`));
    }
    promptSections.push('---------------------\n');
  }

  // 2. Add Core TCC Data (as a structured context)
  promptSections.push('--- TOOL CONSTRUCTION CONTEXT ---');
  
  if (tcc.brainstormData) {
    const filteredBrainstorm = getAgentContext(agentType, tcc.brainstormData, tcc.jobId);
    if (filteredBrainstorm) {
      const brainstormContextString = generateFilteredBrainstormContext(filteredBrainstorm, agentType);
      promptSections.push(brainstormContextString);
    }
  }

  if (tcc.functionSignatures) {
    promptSections.push('\n## Defined Function Signatures\n' + JSON.stringify(tcc.functionSignatures, null, 2));
  }
  if (tcc.stateLogic) {
    promptSections.push('\n## State Logic\n' + JSON.stringify(tcc.stateLogic, null, 2));
  }
  if (tcc.jsxLayout) {
    promptSections.push('\n## JSX Layout\n' + tcc.jsxLayout.componentStructure);
  }
  if (tcc.styling) {
    promptSections.push('\n## Styling Information\n' + JSON.stringify(tcc.styling, null, 2));
  }
  if (tcc.finalProduct?.componentCode) {
    promptSections.push('\n## Current Component Code\n```javascript\n' + tcc.finalProduct.componentCode + '\n```');
  }

  promptSections.push('---------------------------------\n');
  
  // 3. Add Agent-Specific Instructions
  promptSections.push('--- YOUR TASK ---');
  promptSections.push(`Based on the provided context, perform your role as the ${agentType} and provide the required output in the specified JSON format.`);
  
  if (agentType === 'state-design' && tcc.editModeContext?.isEditMode) {
    const activeInstructions = tcc.editModeContext.activeEditInstructions?.find(
      inst => inst.targetAgent === 'state-design'
    );
    if (activeInstructions) {
      promptSections.push(`\n**Edit Instructions:** ${activeInstructions.instructions}`);
    }
  }
  // Add other agent-specific instructions as needed...

  const finalPrompt = promptSections.join('\n');
  
  logger.info({
    jobId: tcc.jobId,
    agentType,
    finalPromptLength: finalPrompt.length,
    hasRetryContext: !!retryInfo && retryInfo.attemptNumber > 1
  }, 'CONSTRUCTED USER PROMPT');

  return finalPrompt;
}

/**
 * Get both system and user prompts for an agent (convenience function for API routes).
 * This is the function that API routes expect to import.
 */
export async function getPromptForAgent(
  agentType: AgentType,
  tcc: BaseTCC,
  editMode?: EditModeContext
): Promise<{ systemPrompt: string; userPrompt: string }> {
  const systemPrompt = getSystemPrompt(agentType);
  
  // Convert editMode to RetryAttemptInfo if needed
  let retryInfo: RetryAttemptInfo;
  if (editMode?.isEditMode) {
    retryInfo = {
      attemptNumber: 1,
      isFirstAttempt: true,
      isSecondAttempt: false,
      isThirdAttempt: false,
      isFinalAttempt: false,
      lastError: null,
      strategy: 'standard',
      adaptedModel: '',
      adaptedPromptHints: editMode.instructions ? [`Edit Instructions: ${editMode.instructions}`] : []
    };
  } else {
    // Provide a default for non-retry, non-edit scenarios
    retryInfo = {
      attemptNumber: 1,
      isFirstAttempt: true,
      isSecondAttempt: false,
      isThirdAttempt: false,
      isFinalAttempt: true, // Assume single attempt
      lastError: null,
      strategy: 'standard',
      adaptedModel: '',
      adaptedPromptHints: []
    };
  }
  
  const userPrompt = constructUserPrompt(agentType, tcc, retryInfo);
  
  return {
    systemPrompt,
    userPrompt
  };
}
