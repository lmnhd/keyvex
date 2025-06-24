/**
 * Unified Prompt Manager (Phase 1.2 - Centralized Logic)
 * Single source of truth for constructing agent prompts.
 * 
 * CRITICAL FIX: Centralizes prompt generation logic by delegating to existing V2 prompts.
 * - Uses the optimized V2 prompts from /lib/prompts/v2/ directory
 * - Properly separates prompts from core logic
 * - Incorporates retry hints for adaptive AI behavior
 * - NO MOCK DATA - delegates to real prompt implementations
 */

import { 
  AgentType, 
  RetryAttemptInfo,
  ToolConstructionContext
} from '../../../types/tcc-unified';
import {
  EditModeContext
} from '../../../types/product-tool-creation-v2/tcc';
import logger from '../../../logger';

// Import V2 prompt functions
import { 
  getFunctionPlannerSystemPrompt,
  getFunctionPlannerUserPrompt
} from '../../../prompts/v2/function-planner-prompt';
import { 
  getStateDesignSystemPrompt,
  getStateDesignUserPrompt
} from '../../../prompts/v2/state-design-prompt';
import { 
  getJsxLayoutSystemPrompt,
  getJsxLayoutUserPrompt
} from '../../../prompts/v2/jsx-layout-prompt';
import { 
  getTailwindStylingUserPrompt,
  TAILWIND_STYLING_SYSTEM_PROMPT
} from '../../../prompts/v2/tailwind-styling-prompt';
import { 
  getValidatorSystemPrompt,
  getValidatorUserPrompt
} from '../../../prompts/v2/validator-prompt';
import { 
  getDataRequirementsResearchSystemPrompt,
  getDataRequirementsResearchUserPrompt
} from '../../../prompts/v2/data-requirements-research-prompt';

/**
 * Convert unified TCC EditModeContext to V2 prompt EditModeContext format
 */
function convertToV2EditModeContext(editMode?: EditModeContext): any {
  if (!editMode?.isEditMode || !editMode.activeEditInstructions?.length) {
    return undefined;
  }

  return {
    isEditMode: editMode.isEditMode,
    instructions: editMode.activeEditInstructions,
    context: editMode.activeEditInstructions.map(i => i.instructions).join('\n')
  };
}

/**
 * Get the system prompt for a given agent by delegating to V2 prompts.
 * NO MOCK DATA - uses existing optimized prompts
 */
export function getSystemPrompt(agentType: AgentType, isEditing: boolean = false): string {
  switch (agentType) {
    case 'function-planner':
      return getFunctionPlannerSystemPrompt(isEditing);
    
    case 'state-design':
      return getStateDesignSystemPrompt(isEditing);
    
    case 'jsx-layout':
      return getJsxLayoutSystemPrompt(isEditing);
    
    case 'tailwind-styling':
      // Use the proper system prompt from the dedicated prompt file that includes JSON format instructions
      return TAILWIND_STYLING_SYSTEM_PROMPT;
    
    case 'code-validator':
      return getValidatorSystemPrompt();
    
    case 'component-assembler':
      // Component Assembler is PROGRAMMATIC - combines State + Layout + Styling mechanically
      throw new Error(`Component Assembler is a programmatic assembly module - it doesn't use AI prompts, just combines the pieces`);
    
    case 'tool-finalizer':
      // Tool Finalizer is NOT an AI agent - it's a packaging/validation module
      throw new Error(`Tool Finalizer doesn't use AI prompts - it's a packaging module, not an AI agent`);
    
    default:
      throw new Error(`System prompt for agent type ${agentType} not found in V2 prompts.`);
  }
}

/**
 * Get the user prompt for a given agent by delegating to V2 prompts.
 * Handles dynamic inputs and TCC context properly
 */
export function getUserPrompt(
  agentType: AgentType, 
  tcc: ToolConstructionContext, 
  editMode?: EditModeContext,
  retryInfo?: RetryAttemptInfo
): string {
  let basePrompt: string;
  const v2EditMode = convertToV2EditModeContext(editMode);

  switch (agentType) {
    case 'function-planner':
      basePrompt = getFunctionPlannerUserPrompt(tcc, v2EditMode);
      break;
    
    case 'state-design':
      // State design requires function signatures from TCC
      const functionSignatures = tcc.definedFunctionSignatures || [];
      basePrompt = getStateDesignUserPrompt(
        tcc, 
        functionSignatures, 
        v2EditMode,
        editMode?.isEditMode,
        editMode?.activeEditInstructions?.[0]?.instructions
      );
      break;
    
    case 'jsx-layout':
      basePrompt = getJsxLayoutUserPrompt(tcc, v2EditMode);
      break;
    
    case 'tailwind-styling':
      basePrompt = getTailwindStylingUserPrompt(
        tcc, 
        v2EditMode,
        editMode?.isEditMode,
        editMode?.activeEditInstructions?.[0]?.instructions
      );
      break;
    
    case 'code-validator':
      basePrompt = getValidatorUserPrompt(tcc, v2EditMode);
      break;
    
    case 'component-assembler':
      // Component Assembler is PROGRAMMATIC - combines State + Layout + Styling mechanically
      throw new Error(`Component Assembler is a programmatic assembly module - it doesn't use AI prompts, just combines the pieces`);
    
    case 'tool-finalizer':
      // Tool Finalizer is NOT an AI agent - it's a packaging/validation module
      throw new Error(`Tool Finalizer doesn't use AI prompts - it's a packaging module, not an AI agent`);
    
    default:
      throw new Error(`User prompt for agent type ${agentType} not found in V2 prompts.`);
  }

  // Add retry context if applicable
  if (retryInfo && retryInfo.attemptNumber > 1) {
    const retryPrefix = `--- RETRY CONTEXT ---
This is attempt #${retryInfo.attemptNumber}.
${retryInfo.lastError ? `Previous Attempt Error: ${retryInfo.lastError}` : ''}
${retryInfo.adaptedPromptHints && retryInfo.adaptedPromptHints.length > 0 
  ? `Please follow these hints to improve the response:\n${retryInfo.adaptedPromptHints.map(hint => `- ${hint}`).join('\n')}` 
  : ''}
---------------------

`;
    basePrompt = retryPrefix + basePrompt;
  }

  return basePrompt;
}

/**
 * Get both system and user prompts for an agent (convenience function for API routes).
 * This is the function that API routes expect to import.
 */
export async function getPromptForAgent(
  agentType: AgentType, 
  tcc: ToolConstructionContext, 
  editMode?: EditModeContext
): Promise<{ systemPrompt: string; userPrompt: string }> {
  const isEditing = editMode?.isEditMode || false;
  
  try {
    const systemPrompt = getSystemPrompt(agentType, isEditing);
    
    // Convert editMode to RetryAttemptInfo for consistency
    const retryInfo: RetryAttemptInfo = {
      attemptNumber: 1,
      isFirstAttempt: true,
      isSecondAttempt: false,
      isThirdAttempt: false,
      isFinalAttempt: true,
      lastError: null,
      strategy: 'standard',
      adaptedModel: '',
      adaptedPromptHints: []
    };
    
    const userPrompt = getUserPrompt(agentType, tcc, editMode, retryInfo);
    
    logger.info({
      jobId: tcc.jobId,
      agentType,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      isEditing,
      delegatedToV2: true,
      hasEditInstructions: editMode?.activeEditInstructions?.length || 0
    }, `✅ PROMPT MANAGER: Successfully delegated to V2 prompts for ${agentType}`);
    
    return {
      systemPrompt,
      userPrompt
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      jobId: tcc.jobId,
      agentType,
      error: errorMessage,
      isEditing
    }, `❌ PROMPT MANAGER: Failed to get prompts for ${agentType}`);
    
    throw error;
  }
}

/**
 * Construct the final user prompt string for the AI with retry context.
 * This centralizes retry hint incorporation for backward compatibility.
 */
export function constructUserPrompt(
  agentType: AgentType,
  tcc: ToolConstructionContext,
  retryInfo: RetryAttemptInfo,
  editMode?: EditModeContext
): string {
  return getUserPrompt(agentType, tcc, editMode, retryInfo);
}
