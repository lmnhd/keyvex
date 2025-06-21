/**
 * Prompt Manager - Prompt loading and management (Phase 1.2)
 * Provides centralized prompt management for all agents
 */

import { AgentType } from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

// Import existing prompt functions
import { getFunctionPlannerSystemPrompt, getFunctionPlannerUserPrompt } from '@/lib/prompts/v2/function-planner-prompt';
import { getStateDesignSystemPrompt, getStateDesignUserPrompt } from '@/lib/prompts/v2/state-design-prompt';
import { getJsxLayoutSystemPrompt, getJsxLayoutUserPrompt } from '@/lib/prompts/v2/jsx-layout-prompt';
import { getTailwindStylingSystemPrompt, getTailwindStylingUserPrompt } from '@/lib/prompts/v2/tailwind-styling-prompt';
import { getValidatorSystemPrompt, getValidatorUserPrompt } from '@/lib/prompts/v2/validator-prompt';
// TODO: Import component-assembler and tool-finalizer prompts when they exist
// import { getComponentAssemblerSystemPrompt, getComponentAssemblerUserPrompt } from '@/lib/prompts/v2/component-assembler-prompt';
// import { getToolFinalizerSystemPrompt, getToolFinalizerUserPrompt } from '@/lib/prompts/v2/tool-finalizer-prompt';

export interface PromptContext {
  tcc: ToolConstructionContext;
  agentType: AgentType;
  isIsolatedTest?: boolean;
  editMode?: any;
  modelId?: string;
  customContext?: Record<string, unknown>;
}

export interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
  metadata: {
    agentType: AgentType;
    promptLength: number;
    templateVariables: string[];
    generatedAt: string;
    cacheKey: string;
  };
}

class PromptManager {
  private promptCache = new Map<string, PromptResult>();
  private readonly cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private readonly maxCacheSize = 100;

  constructor() {}

  /**
   * Get prompts for specific agent with caching
   */
  async getPromptsForAgent(context: PromptContext): Promise<PromptResult> {
    const cacheKey = this.generateCacheKey(context);
    
    // Check cache first
    const cached = this.promptCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      logger.debug({
        agentType: context.agentType,
        cacheKey
      }, '📝 PromptManager: Using cached prompts');
      
      return cached;
    }

    // Generate fresh prompts
    const prompts = await this.generatePrompts(context);
    
    // Cache the result
    this.cachePrompts(cacheKey, prompts);
    
    logger.info({
      agentType: context.agentType,
      systemPromptLength: prompts.systemPrompt.length,
      userPromptLength: prompts.userPrompt.length,
      cacheKey
    }, '📝 PromptManager: Generated fresh prompts');

    return prompts;
  }

  /**
   * Invalidate cache for specific agent or all agents
   */
  invalidateCache(agentType?: AgentType): void {
    if (agentType) {
      // Remove entries for specific agent
      const keysToDelete = Array.from(this.promptCache.keys())
        .filter(key => key.includes(`agent:${agentType}`));
      
      keysToDelete.forEach(key => this.promptCache.delete(key));
      
      logger.info({
        agentType,
        deletedKeys: keysToDelete.length
      }, '📝 PromptManager: Invalidated cache for agent');
    } else {
      // Clear entire cache
      this.promptCache.clear();
      logger.info({}, '📝 PromptManager: Cleared entire prompt cache');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    cacheHitRate: number;
    averagePromptLength: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  } {
    const entries = Array.from(this.promptCache.values());
    const totalEntries = entries.length;
    
    if (totalEntries === 0) {
      return {
        totalEntries: 0,
        cacheHitRate: 0,
        averagePromptLength: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }

    const averagePromptLength = Math.round(
      entries.reduce((sum, entry) => sum + entry.metadata.promptLength, 0) / totalEntries
    );

    const sortedByTime = entries.sort((a, b) => 
      new Date(a.metadata.generatedAt).getTime() - new Date(b.metadata.generatedAt).getTime()
    );

    return {
      totalEntries,
      cacheHitRate: 0, // Would need to track hits/misses for accurate calculation
      averagePromptLength,
      oldestEntry: sortedByTime[0]?.metadata.generatedAt || null,
      newestEntry: sortedByTime[sortedByTime.length - 1]?.metadata.generatedAt || null
    };
  }

  /**
   * Preload prompts for all agents (useful for warming cache)
   */
  async preloadPrompts(tcc: ToolConstructionContext): Promise<void> {
    const agentTypes: AgentType[] = [
      'function-planner',
      'state-design',
      'jsx-layout',
      'tailwind-styling',
      'component-assembler',
      'code-validator',
      'tool-finalizer'
    ];

    logger.info({
      jobId: tcc.jobId,
      agentCount: agentTypes.length
    }, '📝 PromptManager: Preloading prompts for all agents');

    const preloadPromises = agentTypes.map(agentType => 
      this.getPromptsForAgent({
        tcc,
        agentType,
        isIsolatedTest: false
      })
    );

    await Promise.all(preloadPromises);

    logger.info({
      jobId: tcc.jobId,
      cacheSize: this.promptCache.size
    }, '📝 PromptManager: Completed prompt preloading');
  }

  /**
   * Generate prompts for specific agent
   */
  private async generatePrompts(context: PromptContext): Promise<PromptResult> {
    const { agentType, tcc, isIsolatedTest, editMode, modelId } = context;

    let systemPrompt: string;
    let userPrompt: string;
    let templateVariables: string[] = [];

    try {
      switch (agentType) {
        case 'function-planner':
          systemPrompt = getFunctionPlannerSystemPrompt(!!editMode?.isEditMode);
          userPrompt = getFunctionPlannerUserPrompt(tcc, editMode);
          templateVariables = this.extractTemplateVariables(systemPrompt + userPrompt);
          break;

        case 'state-design':
          systemPrompt = getStateDesignSystemPrompt(!!editMode?.isEditMode);
          userPrompt = getStateDesignUserPrompt(tcc, tcc.definedFunctionSignatures || [], editMode);
          templateVariables = this.extractTemplateVariables(systemPrompt + userPrompt);
          break;

        case 'jsx-layout':
          systemPrompt = getJsxLayoutSystemPrompt(!!editMode?.isEditMode);
          userPrompt = getJsxLayoutUserPrompt(tcc, editMode);
          templateVariables = this.extractTemplateVariables(systemPrompt + userPrompt);
          break;

        case 'tailwind-styling':
          systemPrompt = getTailwindStylingSystemPrompt(!!editMode?.isEditMode);
          userPrompt = getTailwindStylingUserPrompt(tcc, editMode);
          templateVariables = this.extractTemplateVariables(systemPrompt + userPrompt);
          break;

        case 'code-validator':
          systemPrompt = getValidatorSystemPrompt();
          userPrompt = getValidatorUserPrompt(tcc, editMode);
          templateVariables = this.extractTemplateVariables(systemPrompt + userPrompt);
          break;

        // TODO: Implement when prompt files exist
        case 'component-assembler':
        case 'tool-finalizer':
          throw new Error(`Prompt functions not implemented yet for agent: ${agentType}`);

        default:
          throw new Error(`Unknown agent type: ${agentType}`);
      }

      // Apply any custom context processing
      if (context.customContext) {
        systemPrompt = this.processCustomContext(systemPrompt, context.customContext);
        userPrompt = this.processCustomContext(userPrompt, context.customContext);
      }

      const totalLength = systemPrompt.length + userPrompt.length;
      const cacheKey = this.generateCacheKey(context);

      return {
        systemPrompt,
        userPrompt,
        metadata: {
          agentType,
          promptLength: totalLength,
          templateVariables,
          generatedAt: new Date().toISOString(),
          cacheKey
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        agentType,
        error: errorMessage
      }, '📝 PromptManager: Failed to generate prompts');

      throw new Error(`Failed to generate prompts for ${agentType}: ${errorMessage}`);
    }
  }

  /**
   * Generate cache key for prompt context
   */
  private generateCacheKey(context: PromptContext): string {
    const { agentType, tcc, isIsolatedTest, editMode, modelId } = context;
    
    // Create a hash-like key based on context
    const keyComponents = [
      `agent:${agentType}`,
      `job:${tcc.jobId}`,
      `test:${isIsolatedTest || false}`,
      `edit:${!!editMode?.isEditMode || false}`,
      `model:${modelId || 'default'}`,
      `step:${tcc.currentOrchestrationStep || 'unknown'}`
    ];

    // Add TCC state indicators
    const stateIndicators = [
      tcc.definedFunctionSignatures ? 'fp' : '',
      tcc.stateLogic ? 'sd' : '',
      tcc.jsxLayout ? 'jl' : '',
      tcc.styling ? 'ts' : '',
      tcc.validationResult ? 'cv' : '',
      tcc.finalProduct ? 'tf' : ''
    ].filter(Boolean).join('-');

    if (stateIndicators) {
      keyComponents.push(`state:${stateIndicators}`);
    }

    return keyComponents.join('|');
  }

  /**
   * Check if cached prompt is still valid
   */
  private isCacheValid(cached: PromptResult): boolean {
    const age = Date.now() - new Date(cached.metadata.generatedAt).getTime();
    return age < this.cacheExpiry;
  }

  /**
   * Cache prompts with size management
   */
  private cachePrompts(cacheKey: string, prompts: PromptResult): void {
    // Remove expired entries
    this.cleanExpiredCache();

    // If cache is full, remove oldest entry
    if (this.promptCache.size >= this.maxCacheSize) {
      const oldestKey = this.findOldestCacheKey();
      if (oldestKey) {
        this.promptCache.delete(oldestKey);
      }
    }

    this.promptCache.set(cacheKey, prompts);
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.promptCache.forEach((value, key) => {
      const age = now - new Date(value.metadata.generatedAt).getTime();
      if (age >= this.cacheExpiry) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.promptCache.delete(key));
  }

  /**
   * Find oldest cache key for eviction
   */
  private findOldestCacheKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.promptCache.forEach((value, key) => {
      const time = new Date(value.metadata.generatedAt).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    });

    return oldestKey;
  }

  /**
   * Extract template variables from prompt text
   */
  private extractTemplateVariables(text: string): string[] {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Process custom context into prompts
   */
  private processCustomContext(prompt: string, customContext: Record<string, unknown>): string {
    let processedPrompt = prompt;

    Object.entries(customContext).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const replacement = typeof value === 'string' ? value : JSON.stringify(value);
      processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), replacement);
    });

    return processedPrompt;
  }
}

// Create a singleton instance for convenience
const promptManagerInstance = new PromptManager();

/**
 * Convenience function for getting prompts for an agent
 * This function is used by the unified-agent-executor
 */
export async function getPromptForAgent(
  agentType: AgentType, 
  tcc: ToolConstructionContext, 
  editMode?: any
): Promise<{ systemPrompt: string; userPrompt: string }> {
  const context: PromptContext = {
    agentType,
    tcc,
    isIsolatedTest: false,
    editMode
  };

  const result = await promptManagerInstance.getPromptsForAgent(context);
  
  return {
    systemPrompt: result.systemPrompt,
    userPrompt: result.userPrompt
  };
}

/**
 * Export the PromptManager class and singleton instance
 */
export { PromptManager };
export const promptManager = promptManagerInstance;
