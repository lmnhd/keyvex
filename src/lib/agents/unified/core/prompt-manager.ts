// Prompt Manager - Dynamic prompt loading for all agents
// Preserves all existing prompts and adds retry logic

import { AgentType, ToolConstructionContext } from '@/lib/types/tcc-unified';

export interface PromptSet {
  systemPrompt: string;
  userPrompt: string;
}

export class PromptManager {
  
  async getPromptsForAgent(
    agent: AgentType,
    tcc: ToolConstructionContext,
    isRetry: boolean = false,
    validationErrors?: string[]
  ): Promise<PromptSet> {
    try {
      // Load the appropriate prompt functions based on agent type
      const promptModule = await this.loadPromptModule(agent);
      
      // Get base prompts
      let systemPrompt = await promptModule.getSystemPrompt(tcc, isRetry, validationErrors);
      let userPrompt = await promptModule.getUserPrompt(tcc, isRetry, validationErrors);
      
      // Add retry enhancements if needed
      if (isRetry && validationErrors && validationErrors.length > 0) {
        systemPrompt = this.enhanceSystemPromptForRetry(systemPrompt, validationErrors);
        userPrompt = this.enhanceUserPromptForRetry(userPrompt, validationErrors);
      }

      return {
        systemPrompt,
        userPrompt,
      };

    } catch (error) {
      console.error(`Failed to load prompts for agent ${agent}:`, error);
      throw error;
    }
  }

  private async loadPromptModule(agent: AgentType): Promise<any> {
    // Load existing prompt modules - PRESERVE ALL EXISTING PROMPTS
    switch (agent) {
      case 'function-planner':
        const fpPrompts = await import('@/lib/prompts/function-planner-prompt');
        return {
          getSystemPrompt: fpPrompts.getFunctionPlannerSystemPrompt,
          getUserPrompt: fpPrompts.getFunctionPlannerUserPrompt,
        };
        
      case 'state-design':
        const sdPrompts = await import('@/lib/prompts/state-design-prompt');
        return {
          getSystemPrompt: sdPrompts.getStateDesignSystemPrompt,
          getUserPrompt: sdPrompts.getStateDesignUserPrompt,
        };
        
      case 'jsx-layout':
        const jlPrompts = await import('@/lib/prompts/jsx-layout-prompt');
        return {
          getSystemPrompt: jlPrompts.getJSXLayoutSystemPrompt,
          getUserPrompt: jlPrompts.getJSXLayoutUserPrompt,
        };
        
      case 'tailwind-styling':
        const tsPrompts = await import('@/lib/prompts/tailwind-styling-prompt');
        return {
          getSystemPrompt: tsPrompts.getTailwindStylingSystemPrompt,
          getUserPrompt: tsPrompts.getTailwindStylingUserPrompt,
        };
        
      case 'component-assembler':
        const caPrompts = await import('@/lib/prompts/component-assembler-prompt');
        return {
          getSystemPrompt: caPrompts.getComponentAssemblerSystemPrompt,
          getUserPrompt: caPrompts.getComponentAssemblerUserPrompt,
        };
        
      case 'code-validator':
        const cvPrompts = await import('@/lib/prompts/code-validator-prompt');
        return {
          getSystemPrompt: cvPrompts.getCodeValidatorSystemPrompt,
          getUserPrompt: cvPrompts.getCodeValidatorUserPrompt,
        };
        
      case 'tool-finalizer':
        const tfPrompts = await import('@/lib/prompts/tool-finalizer-prompt');
        return {
          getSystemPrompt: tfPrompts.getToolFinalizerSystemPrompt,
          getUserPrompt: tfPrompts.getToolFinalizerUserPrompt,
        };
        
      default:
        throw new Error(`Unknown agent type: ${agent}`);
    }
  }

  private enhanceSystemPromptForRetry(
    originalPrompt: string, 
    validationErrors: string[]
  ): string {
    const retryGuidance = `
RETRY ATTEMPT - VALIDATION ERRORS DETECTED:

The previous attempt failed validation with the following errors:
${validationErrors.map((error, index) => `${index + 1}. ${error}`).join('\n')}

CRITICAL RETRY INSTRUCTIONS:
- Address each validation error specifically
- Follow the exact schema requirements
- Ensure all required fields are present
- Double-check data types and structures
- Focus on the specific issues mentioned above

ORIGINAL PROMPT:
${originalPrompt}`;

    return retryGuidance;
  }

  private enhanceUserPromptForRetry(
    originalPrompt: string, 
    validationErrors: string[]
  ): string {
    const retryPrefix = `
⚠️ RETRY ATTEMPT - Previous validation failed with these specific issues:
${validationErrors.map((error, index) => `   ${index + 1}. ${error}`).join('\n')}

Please address each issue above in your response.

---

${originalPrompt}`;

    return retryPrefix;
  }

  // Utility method to get prompt statistics
  getPromptStats(prompts: PromptSet): {
    systemPromptLength: number;
    userPromptLength: number;
    totalLength: number;
    estimatedTokens: number;
  } {
    const systemLength = prompts.systemPrompt.length;
    const userLength = prompts.userPrompt.length;
    const totalLength = systemLength + userLength;
    
    return {
      systemPromptLength: systemLength,
      userPromptLength: userLength,
      totalLength,
      estimatedTokens: Math.ceil(totalLength / 4), // Rough token estimation
    };
  }

  // Method to validate prompt requirements
  validatePrompts(prompts: PromptSet): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!prompts.systemPrompt || prompts.systemPrompt.trim().length === 0) {
      issues.push('System prompt is empty or missing');
    }

    if (!prompts.userPrompt || prompts.userPrompt.trim().length === 0) {
      issues.push('User prompt is empty or missing');
    }

    if (prompts.systemPrompt.length > 50000) {
      issues.push('System prompt exceeds recommended length (50k characters)');
    }

    if (prompts.userPrompt.length > 100000) {
      issues.push('User prompt exceeds recommended length (100k characters)');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
} 