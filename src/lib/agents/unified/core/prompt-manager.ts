/**
 * Prompt Manager (Phase 2.1 - Core Infrastructure Integration)
 * Centralized prompt management for all unified agents - NO GENERIC TYPES!
 */

import { 
  AgentType,
  AgentExecutionContext,
  CoreBrainstormData,
  FunctionPlannerBrainstormData,
  StateDesignBrainstormData,
  JSXLayoutBrainstormData,
  TailwindStylingBrainstormData,
  ComponentAssemblerBrainstormData
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC, DefinedFunctionSignature } from '../../../types/product-tool-creation-v2/tcc';
import { 
  filterBrainstormForFunctionPlanner,
  filterBrainstormForStateDesign,
  filterBrainstormForJSXLayout,
  filterBrainstormForTailwindStyling,
  filterBrainstormForComponentAssembler,
  generateFilteredBrainstormContext
} from '../../../utils/brainstorm-filter';
import logger from '../../../logger';

// Import existing prompt modules from v2 directory (with proper fallbacks)
import { getFunctionPlannerSystemPrompt, getFunctionPlannerUserPrompt } from '../../../prompts/v2/function-planner-prompt';
import { getStateDesignSystemPrompt, getStateDesignUserPrompt } from '../../../prompts/v2/state-design-prompt';
import { getJsxLayoutSystemPrompt, getJsxLayoutUserPrompt } from '../../../prompts/v2/jsx-layout-prompt';
import { getTailwindStylingSystemPrompt, getTailwindStylingUserPrompt } from '../../../prompts/v2/tailwind-styling-prompt';
import { getComponentAssemblerSystemPrompt } from '../../../prompts/component-assembler-prompt';
import { getValidatorSystemPrompt, getValidatorUserPrompt } from '../../../prompts/v2/validator-prompt';
import { getToolFinalizerSystemPrompt, getToolFinalizerUserPrompt } from '../../../prompts/tool-finalizer-prompt';

/**
 * Prompt configuration for each agent type
 */
interface AgentPromptConfig {
  systemPrompt: string;
  userPrompt: string;
  contextData: string;
  metadata: {
    promptLength: number;
    contextLength: number;
    totalLength: number;
    agentType: AgentType;
  };
}

/**
 * Prompt generation context
 */
interface PromptGenerationContext {
  agentType: AgentType;
  tcc: BaseTCC;
  context: AgentExecutionContext;
  editMode?: {
    isEditMode: boolean;
    editInstructions?: string;
    currentResult?: any;
  };
}

/**
 * PromptManager - Centralized prompt management for all agents
 */
export class PromptManager {
  private static instance: PromptManager;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  /**
   * Generate complete prompt configuration for an agent
   */
  async generatePromptConfig(
    promptContext: PromptGenerationContext
  ): Promise<AgentPromptConfig> {
    const { agentType, tcc, context, editMode } = promptContext;
    
    logger.info({
      jobId: context.jobId,
      agentType,
      isEditMode: editMode?.isEditMode || false
    }, '📝 PROMPT MANAGER: Generating prompt configuration');

    try {
      // Get filtered brainstorm data for this agent
      const filteredBrainstormData = await this.getFilteredBrainstormData(agentType, tcc, context.jobId);
      
      // Generate system and user prompts
      const systemPrompt = await this.generateSystemPrompt(agentType, context, editMode);
      const userPrompt = await this.generateUserPrompt(agentType, tcc, filteredBrainstormData, editMode);
      
      // Generate context string
      const contextData = filteredBrainstormData 
        ? generateFilteredBrainstormContext(filteredBrainstormData, this.getAgentDisplayName(agentType))
        : '';

      const config: AgentPromptConfig = {
        systemPrompt,
        userPrompt,
        contextData,
        metadata: {
          promptLength: systemPrompt.length + userPrompt.length,
          contextLength: contextData.length,
          totalLength: systemPrompt.length + userPrompt.length + contextData.length,
          agentType
        }
      };

      logger.info({
        jobId: context.jobId,
        agentType,
        promptLength: config.metadata.promptLength,
        contextLength: config.metadata.contextLength,
        totalLength: config.metadata.totalLength
      }, '📝 PROMPT MANAGER: Prompt configuration generated successfully');

      return config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        jobId: context.jobId,
        agentType,
        error: errorMessage
      }, '📝 PROMPT MANAGER: Failed to generate prompt configuration');
      throw new Error(`Failed to generate prompt for ${agentType}: ${errorMessage}`);
    }
  }

  /**
   * Get filtered brainstorm data for specific agent
   */
  private async getFilteredBrainstormData(
    agentType: AgentType,
    tcc: BaseTCC,
    jobId: string
  ): Promise<CoreBrainstormData | null> {
    if (!tcc.brainstormData) {
      logger.warn({ jobId, agentType }, '📝 PROMPT MANAGER: No brainstorm data available');
      return null;
    }

    switch (agentType) {
      case 'function-planner':
        return filterBrainstormForFunctionPlanner(tcc.brainstormData, jobId);
      case 'state-design':
        return filterBrainstormForStateDesign(tcc.brainstormData, jobId);
      case 'jsx-layout':
        return filterBrainstormForJSXLayout(tcc.brainstormData, jobId);
      case 'tailwind-styling':
        return filterBrainstormForTailwindStyling(tcc.brainstormData, jobId);
      case 'component-assembler':
        return filterBrainstormForComponentAssembler(tcc.brainstormData, jobId);
      case 'code-validator':
      case 'tool-finalizer':
        // These agents don't need filtered brainstorm data
        return null;
      default:
        logger.warn({ jobId, agentType }, '📝 PROMPT MANAGER: Unknown agent type for brainstorm filtering');
        return null;
    }
  }

  /**
   * Generate system prompt for specific agent
   */
  private async generateSystemPrompt(
    agentType: AgentType,
    context: AgentExecutionContext,
    editMode?: { isEditMode: boolean; editInstructions?: string }
  ): Promise<string> {
    const baseSystemPrompt = await this.getBaseSystemPrompt(agentType, editMode?.isEditMode || false);
    
    // Add edit mode instructions if applicable
    if (editMode?.isEditMode && editMode.editInstructions) {
      return `${baseSystemPrompt}\n\n## EDIT MODE INSTRUCTIONS\nYou are in edit mode. Your task is to modify the existing result based on these instructions:\n${editMode.editInstructions}`;
    }

    return baseSystemPrompt;
  }

  /**
   * Generate user prompt for specific agent
   */
  private async generateUserPrompt(
    agentType: AgentType,
    tcc: BaseTCC,
    filteredBrainstormData: CoreBrainstormData | null,
    editMode?: { isEditMode: boolean; currentResult?: any }
  ): Promise<string> {
    const baseUserPrompt = await this.getBaseUserPrompt(agentType, tcc, filteredBrainstormData);
    
    // Add current result if in edit mode
    if (editMode?.isEditMode && editMode.currentResult) {
      return `${baseUserPrompt}\n\n## CURRENT RESULT TO EDIT\n${JSON.stringify(editMode.currentResult, null, 2)}`;
    }

    return baseUserPrompt;
  }

  /**
   * Get base system prompt for agent type
   */
  private async getBaseSystemPrompt(agentType: AgentType, isEditMode: boolean = false): Promise<string> {
    try {
      switch (agentType) {
        case 'function-planner':
          return getFunctionPlannerSystemPrompt(isEditMode);
        case 'state-design':
          return getStateDesignSystemPrompt(isEditMode);
        case 'jsx-layout':
          return getJsxLayoutSystemPrompt(isEditMode);
        case 'tailwind-styling':
          return getTailwindStylingSystemPrompt(isEditMode);
        case 'component-assembler':
          return getComponentAssemblerSystemPrompt();
        case 'code-validator':
          return getValidatorSystemPrompt();
        case 'tool-finalizer':
          return getToolFinalizerSystemPrompt();
        default:
          throw new Error(`Unknown agent type: ${agentType}`);
      }
    } catch (error) {
      logger.warn({ agentType, error: String(error) }, '📝 PROMPT MANAGER: Falling back to basic system prompt');
      return `You are a ${agentType} agent. Process the provided input and return a structured result.`;
    }
  }

  /**
   * Get base user prompt for agent type
   */
  private async getBaseUserPrompt(
    agentType: AgentType,
    tcc: BaseTCC,
    filteredBrainstormData: CoreBrainstormData | null
  ): Promise<string> {
    try {
      switch (agentType) {
        case 'function-planner':
          return getFunctionPlannerUserPrompt(tcc, undefined);
        case 'state-design':
          const functionSignatures = tcc.definedFunctionSignatures || [];
          return getStateDesignUserPrompt(tcc, functionSignatures, undefined, false, undefined);
        case 'jsx-layout':
          return getJsxLayoutUserPrompt(tcc, undefined);
        case 'tailwind-styling':
          return getTailwindStylingUserPrompt(tcc, undefined);
        case 'component-assembler':
          return `Please assemble the component based on the provided TCC data.`;
        case 'code-validator':
          return getValidatorUserPrompt(tcc);
        case 'tool-finalizer':
          return getToolFinalizerUserPrompt(tcc);
        default:
          throw new Error(`Unknown agent type: ${agentType}`);
      }
    } catch (error) {
      logger.warn({ agentType, error: String(error) }, '📝 PROMPT MANAGER: Falling back to basic user prompt');
      return `Please process the provided TCC data and return a structured result for ${agentType}.`;
    }
  }

  /**
   * Get display name for agent
   */
  private getAgentDisplayName(agentType: AgentType): string {
    const displayNames: Record<AgentType, string> = {
      'function-planner': 'Function Planner',
      'state-design': 'State Design Agent',
      'jsx-layout': 'JSX Layout Agent',
      'tailwind-styling': 'Tailwind Styling Agent',
      'component-assembler': 'Component Assembler',
      'code-validator': 'Code Validator',
      'tool-finalizer': 'Tool Finalizer'
    };
    
    return displayNames[agentType] || agentType;
  }

  /**
   * Validate prompt configuration
   */
  validatePromptConfig(config: AgentPromptConfig): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // Check prompt length limits
    if (config.metadata.totalLength > 100000) {
      warnings.push(`Total prompt length (${config.metadata.totalLength}) exceeds recommended limit`);
    }
    
    if (config.metadata.promptLength < 100) {
      warnings.push('System/user prompt appears very short');
    }
    
    // Check for empty prompts
    if (!config.systemPrompt.trim()) {
      warnings.push('System prompt is empty');
    }
    
    if (!config.userPrompt.trim()) {
      warnings.push('User prompt is empty');
    }

    return {
      isValid: warnings.length === 0,
      warnings
    };
  }
}

/**
 * Convenience function to get prompt manager instance
 */
export function getPromptManager(): PromptManager {
  return PromptManager.getInstance();
}
