/**
 * Prompt Loader Utility (Phase 1.2)
 * Dynamic prompt loading for unified agent system
 * 
 * Provides intelligent prompt loading with caching, validation,
 * and template processing capabilities.
 */

import { AgentType } from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/tcc-unified';
import logger from '@/lib/logger';

export interface PromptLoadContext {
  agentType: AgentType;
  promptType: 'system' | 'user';
  tcc?: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: boolean;
  customVariables?: Record<string, string>;
}

export interface LoadedPrompt {
  content: string;
  metadata: {
    agentType: AgentType;
    promptType: 'system' | 'user';
    loadedAt: string;
    templateVariables: string[];
    processedVariables: string[];
    contentLength: number;
    cacheKey: string;
  };
}

export interface PromptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  quality: {
    clarity: number;
    completeness: number;
    specificity: number;
    overallScore: number;
  };
}

export class PromptLoader {
  private promptCache = new Map<string, LoadedPrompt>();
  private readonly cacheExpiry = 10 * 60 * 1000; // 10 minutes
  private readonly maxCacheSize = 50;

  // Prompt function registry
  private readonly promptRegistry = new Map<string, () => Promise<string> | string>();

  constructor() {
    this.initializePromptRegistry();
  }

  /**
   * Load prompt with caching and processing
   */
  async loadPrompt(context: PromptLoadContext): Promise<LoadedPrompt> {
    const cacheKey = this.generateCacheKey(context);
    
    // Check cache first
    const cached = this.promptCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      logger.debug({
        agentType: context.agentType,
        promptType: context.promptType,
        cacheKey
      }, '📋 PromptLoader: Using cached prompt');
      
      return cached;
    }

    // Load fresh prompt
    const loaded = await this.loadFreshPrompt(context);
    
    // Cache the result
    this.cachePrompt(cacheKey, loaded);
    
    logger.info({
      agentType: context.agentType,
      promptType: context.promptType,
      contentLength: loaded.content.length,
      variablesProcessed: loaded.metadata.processedVariables.length
    }, '📋 PromptLoader: Loaded fresh prompt');

    return loaded;
  }

  /**
   * Validate prompt content and structure
   */
  validatePrompt(prompt: string, agentType: AgentType, promptType: 'system' | 'user'): PromptValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!prompt || prompt.trim().length === 0) {
      errors.push('Prompt content is empty');
      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        quality: { clarity: 0, completeness: 0, specificity: 0, overallScore: 0 }
      };
    }

    // Length validation
    if (prompt.length < 50) {
      warnings.push('Prompt is very short - may lack necessary detail');
    } else if (prompt.length > 10000) {
      warnings.push('Prompt is very long - may overwhelm AI model');
    }

    // Template variable validation
    const templateVars = this.extractTemplateVariables(prompt);
    const unclosedVars = prompt.match(/\{\{[^}]*$/g);
    if (unclosedVars) {
      errors.push(`Unclosed template variables found: ${unclosedVars.join(', ')}`);
    }

    // Agent-specific validation
    this.validateAgentSpecificContent(prompt, agentType, promptType, errors, warnings, suggestions);

    // Calculate quality metrics
    const quality = this.calculatePromptQuality(prompt, agentType, promptType);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      quality
    };
  }

  /**
   * Process template variables in prompt
   */
  processTemplateVariables(
    prompt: string,
    variables: Record<string, string>
  ): { processedPrompt: string; processedVariables: string[] } {
    let processedPrompt = prompt;
    const processedVariables: string[] = [];

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      if (processedPrompt.includes(placeholder)) {
        processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), value);
        processedVariables.push(key);
      }
    });

    return { processedPrompt, processedVariables };
  }

  /**
   * Get prompt statistics for analysis
   */
  getPromptStatistics(): {
    totalCachedPrompts: number;
    cacheHitRate: number;
    averagePromptLength: number;
    agentPromptCounts: Record<AgentType, number>;
    mostUsedAgent: AgentType | null;
    oldestCachedPrompt: string | null;
  } {
    const cached = Array.from(this.promptCache.values());
    const totalCachedPrompts = cached.length;

    if (totalCachedPrompts === 0) {
      return {
        totalCachedPrompts: 0,
        cacheHitRate: 0,
        averagePromptLength: 0,
        agentPromptCounts: {} as Record<AgentType, number>,
        mostUsedAgent: null,
        oldestCachedPrompt: null
      };
    }

    const averagePromptLength = Math.round(
      cached.reduce((sum, prompt) => sum + prompt.content.length, 0) / totalCachedPrompts
    );

    // Count prompts by agent
    const agentPromptCounts: Record<AgentType, number> = {} as Record<AgentType, number>;
    cached.forEach(prompt => {
      const agentType = prompt.metadata.agentType;
      agentPromptCounts[agentType] = (agentPromptCounts[agentType] || 0) + 1;
    });

    // Find most used agent
    let mostUsedAgent: AgentType | null = null;
    let maxCount = 0;
    Object.entries(agentPromptCounts).forEach(([agent, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsedAgent = agent as AgentType;
      }
    });

    // Find oldest cached prompt
    const oldestPrompt = cached.reduce((oldest, current) => {
      const oldestTime = new Date(oldest.metadata.loadedAt).getTime();
      const currentTime = new Date(current.metadata.loadedAt).getTime();
      return currentTime < oldestTime ? current : oldest;
    });

    return {
      totalCachedPrompts,
      cacheHitRate: 0, // Would need to track hits/misses for accurate calculation
      averagePromptLength,
      agentPromptCounts,
      mostUsedAgent,
      oldestCachedPrompt: oldestPrompt.metadata.loadedAt
    };
  }

  /**
   * Clear cache for specific agent or all agents
   */
  clearCache(agentType?: AgentType): void {
    if (agentType) {
      const keysToDelete = Array.from(this.promptCache.keys())
        .filter(key => key.includes(`agent:${agentType}`));
      
      keysToDelete.forEach(key => this.promptCache.delete(key));
      
      logger.info({
        agentType,
        deletedKeys: keysToDelete.length
      }, '📋 PromptLoader: Cleared cache for agent');
    } else {
      this.promptCache.clear();
      logger.info({}, '📋 PromptLoader: Cleared entire prompt cache');
    }
  }

  /**
   * Preload prompts for all agents
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

    const promptTypes: ('system' | 'user')[] = ['system', 'user'];

    logger.info({
      jobId: tcc.jobId,
      agentCount: agentTypes.length,
      promptTypesPerAgent: promptTypes.length
    }, '📋 PromptLoader: Preloading prompts for all agents');

    const preloadPromises: Promise<LoadedPrompt>[] = [];

    agentTypes.forEach(agentType => {
      promptTypes.forEach(promptType => {
        preloadPromises.push(
          this.loadPrompt({
            agentType,
            promptType,
            tcc,
            isIsolatedTest: false,
            editMode: false
          })
        );
      });
    });

    await Promise.all(preloadPromises);

    logger.info({
      jobId: tcc.jobId,
      cacheSize: this.promptCache.size,
      totalPreloaded: preloadPromises.length
    }, '📋 PromptLoader: Completed prompt preloading');
  }

  /**
   * Initialize prompt function registry
   */
  private initializePromptRegistry(): void {
    // System prompts
    this.promptRegistry.set('function-planner:system', async () => {
      const { getFunctionPlannerSystemPrompt } = await import('@/lib/prompts/v2/function-planner-prompt');
      return getFunctionPlannerSystemPrompt();
    });

    this.promptRegistry.set('state-design:system', async () => {
      const { getStateDesignSystemPrompt } = await import('@/lib/prompts/v2/state-design-prompt');
      return getStateDesignSystemPrompt();
    });

    this.promptRegistry.set('jsx-layout:system', async () => {
      const { getJsxLayoutSystemPrompt } = await import('@/lib/prompts/v2/jsx-layout-prompt');
      return getJsxLayoutSystemPrompt();
    });

    this.promptRegistry.set('tailwind-styling:system', async () => {
      const { getTailwindStylingSystemPrompt } = await import('@/lib/prompts/v2/tailwind-styling-prompt');
      return getTailwindStylingSystemPrompt();
    });

    this.promptRegistry.set('component-assembler:system', async () => {
      const { getComponentAssemblerSystemPrompt } = await import('@/lib/prompts/v2/component-assembler-prompt');
      return getComponentAssemblerSystemPrompt();
    });

    this.promptRegistry.set('code-validator:system', async () => {
      const { getValidatorSystemPrompt } = await import('@/lib/prompts/v2/validator-prompt');
      return getValidatorSystemPrompt();
    });

    this.promptRegistry.set('tool-finalizer:system', async () => {
      const { getToolFinalizerSystemPrompt } = await import('@/lib/prompts/v2/tool-finalizer-prompt');
      return getToolFinalizerSystemPrompt();
    });

    // User prompts (require TCC context)
    this.promptRegistry.set('function-planner:user', async () => {
      throw new Error('User prompts require TCC context - use loadFreshPrompt instead');
    });

    logger.info({
      registeredPrompts: this.promptRegistry.size
    }, '📋 PromptLoader: Initialized prompt registry');
  }

  /**
   * Load fresh prompt from registry or file
   */
  private async loadFreshPrompt(context: PromptLoadContext): Promise<LoadedPrompt> {
    const registryKey = `${context.agentType}:${context.promptType}`;
    
    let content: string;
    
    if (context.promptType === 'system') {
      // Load system prompt from registry
      const promptFunction = this.promptRegistry.get(registryKey);
      if (!promptFunction) {
        throw new Error(`No prompt function registered for ${registryKey}`);
      }
      content = await promptFunction();
    } else {
      // Load user prompt with TCC context
      content = await this.loadUserPrompt(context);
    }

    // Extract template variables
    const templateVariables = this.extractTemplateVariables(content);
    
    // Process custom variables if provided
    let processedContent = content;
    let processedVariables: string[] = [];
    
    if (context.customVariables) {
      const processed = this.processTemplateVariables(content, context.customVariables);
      processedContent = processed.processedPrompt;
      processedVariables = processed.processedVariables;
    }

    const cacheKey = this.generateCacheKey(context);

    return {
      content: processedContent,
      metadata: {
        agentType: context.agentType,
        promptType: context.promptType,
        loadedAt: new Date().toISOString(),
        templateVariables,
        processedVariables,
        contentLength: processedContent.length,
        cacheKey
      }
    };
  }

  /**
   * Load user prompt with TCC context
   */
  private async loadUserPrompt(context: PromptLoadContext): Promise<string> {
    if (!context.tcc) {
      throw new Error('TCC context required for user prompts');
    }

    const { agentType, tcc, isIsolatedTest, editMode } = context;

    switch (agentType) {
      case 'function-planner': {
        const { getFunctionPlannerUserPrompt } = await import('@/lib/prompts/v2/function-planner-prompt');
        return getFunctionPlannerUserPrompt(tcc, isIsolatedTest, editMode);
      }
      case 'state-design': {
        const { getStateDesignUserPrompt } = await import('@/lib/prompts/v2/state-design-prompt');
        return getStateDesignUserPrompt(tcc, isIsolatedTest, editMode);
      }
      case 'jsx-layout': {
        const { getJsxLayoutUserPrompt } = await import('@/lib/prompts/v2/jsx-layout-prompt');
        return getJsxLayoutUserPrompt(tcc, isIsolatedTest, editMode);
      }
      case 'tailwind-styling': {
        const { getTailwindStylingUserPrompt } = await import('@/lib/prompts/v2/tailwind-styling-prompt');
        return getTailwindStylingUserPrompt(tcc, isIsolatedTest, editMode);
      }
      case 'component-assembler': {
        const { getComponentAssemblerUserPrompt } = await import('@/lib/prompts/v2/component-assembler-prompt');
        return getComponentAssemblerUserPrompt(tcc, isIsolatedTest, editMode);
      }
      case 'code-validator': {
        const { getValidatorUserPrompt } = await import('@/lib/prompts/v2/validator-prompt');
        return getValidatorUserPrompt(tcc, isIsolatedTest, editMode);
      }
      case 'tool-finalizer': {
        const { getToolFinalizerUserPrompt } = await import('@/lib/prompts/v2/tool-finalizer-prompt');
        return getToolFinalizerUserPrompt(tcc, isIsolatedTest, editMode);
      }
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  /**
   * Generate cache key for prompt context
   */
  private generateCacheKey(context: PromptLoadContext): string {
    const components = [
      `agent:${context.agentType}`,
      `type:${context.promptType}`,
      `test:${context.isIsolatedTest || false}`,
      `edit:${context.editMode || false}`
    ];

    if (context.tcc) {
      components.push(`job:${context.tcc.jobId}`);
      components.push(`step:${context.tcc.currentOrchestrationStep || 'unknown'}`);
    }

    if (context.customVariables) {
      const varKeys = Object.keys(context.customVariables).sort().join(',');
      components.push(`vars:${varKeys}`);
    }

    return components.join('|');
  }

  /**
   * Check if cached prompt is still valid
   */
  private isCacheValid(cached: LoadedPrompt): boolean {
    const age = Date.now() - new Date(cached.metadata.loadedAt).getTime();
    return age < this.cacheExpiry;
  }

  /**
   * Cache prompt with size management
   */
  private cachePrompt(cacheKey: string, prompt: LoadedPrompt): void {
    // Remove expired entries
    this.cleanExpiredCache();

    // If cache is full, remove oldest entry
    if (this.promptCache.size >= this.maxCacheSize) {
      const oldestKey = this.findOldestCacheKey();
      if (oldestKey) {
        this.promptCache.delete(oldestKey);
      }
    }

    this.promptCache.set(cacheKey, prompt);
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.promptCache.forEach((value, key) => {
      const age = now - new Date(value.metadata.loadedAt).getTime();
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
      const time = new Date(value.metadata.loadedAt).getTime();
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
   * Validate agent-specific prompt content
   */
  private validateAgentSpecificContent(
    prompt: string,
    agentType: AgentType,
    promptType: 'system' | 'user',
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    const lowerPrompt = prompt.toLowerCase();

    switch (agentType) {
      case 'function-planner':
        if (!lowerPrompt.includes('function') && !lowerPrompt.includes('signature')) {
          warnings.push('Function Planner prompt should mention functions or signatures');
        }
        break;

      case 'state-design':
        if (!lowerPrompt.includes('state') && !lowerPrompt.includes('variable')) {
          warnings.push('State Design prompt should mention state or variables');
        }
        break;

      case 'jsx-layout':
        if (!lowerPrompt.includes('jsx') && !lowerPrompt.includes('component')) {
          warnings.push('JSX Layout prompt should mention JSX or components');
        }
        break;

      case 'tailwind-styling':
        if (!lowerPrompt.includes('tailwind') && !lowerPrompt.includes('styling')) {
          warnings.push('Tailwind Styling prompt should mention Tailwind or styling');
        }
        break;

      case 'component-assembler':
        if (!lowerPrompt.includes('assemble') && !lowerPrompt.includes('combine')) {
          warnings.push('Component Assembler prompt should mention assembling or combining');
        }
        break;

      case 'code-validator':
        if (!lowerPrompt.includes('validate') && !lowerPrompt.includes('validation')) {
          warnings.push('Code Validator prompt should mention validation');
        }
        break;

      case 'tool-finalizer':
        if (!lowerPrompt.includes('final') && !lowerPrompt.includes('complete')) {
          warnings.push('Tool Finalizer prompt should mention finalizing or completing');
        }
        break;
    }

    // Common validation for all agents
    if (promptType === 'system' && !lowerPrompt.includes('you are')) {
      suggestions.push('System prompts typically start with role definition');
    }

    if (lowerPrompt.includes('todo') || lowerPrompt.includes('fixme')) {
      warnings.push('Prompt contains TODO or FIXME comments');
    }
  }

  /**
   * Calculate prompt quality metrics
   */
  private calculatePromptQuality(
    prompt: string,
    agentType: AgentType,
    promptType: 'system' | 'user'
  ): { clarity: number; completeness: number; specificity: number; overallScore: number } {
    let clarity = 0.5; // Base score
    let completeness = 0.5;
    let specificity = 0.5;

    // Clarity metrics
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    if (avgSentenceLength < 100) clarity += 0.2; // Shorter sentences are clearer
    if (avgSentenceLength > 200) clarity -= 0.2; // Very long sentences reduce clarity

    // Completeness metrics
    if (prompt.includes('example') || prompt.includes('for example')) completeness += 0.1;
    if (prompt.includes('important') || prompt.includes('critical')) completeness += 0.1;
    if (prompt.includes('requirements') || prompt.includes('must')) completeness += 0.1;

    // Specificity metrics
    const specificWords = ['specific', 'exactly', 'precisely', 'detailed', 'comprehensive'];
    specificWords.forEach(word => {
      if (prompt.toLowerCase().includes(word)) specificity += 0.1;
    });

    // Agent-specific adjustments
    const agentKeywords = this.getAgentKeywords(agentType);
    agentKeywords.forEach(keyword => {
      if (prompt.toLowerCase().includes(keyword)) {
        specificity += 0.05;
        completeness += 0.05;
      }
    });

    // Normalize scores
    clarity = Math.max(0, Math.min(1, clarity));
    completeness = Math.max(0, Math.min(1, completeness));
    specificity = Math.max(0, Math.min(1, specificity));

    const overallScore = (clarity * 0.3) + (completeness * 0.4) + (specificity * 0.3);

    return {
      clarity: Math.round(clarity * 100) / 100,
      completeness: Math.round(completeness * 100) / 100,
      specificity: Math.round(specificity * 100) / 100,
      overallScore: Math.round(overallScore * 100) / 100
    };
  }

  /**
   * Get agent-specific keywords for quality assessment
   */
  private getAgentKeywords(agentType: AgentType): string[] {
    const keywords: Record<AgentType, string[]> = {
      'function-planner': ['function', 'signature', 'parameter', 'return', 'calculation'],
      'state-design': ['state', 'variable', 'hook', 'useState', 'logic'],
      'jsx-layout': ['jsx', 'component', 'element', 'layout', 'structure'],
      'tailwind-styling': ['tailwind', 'class', 'style', 'css', 'design'],
      'component-assembler': ['assemble', 'combine', 'merge', 'integrate', 'component'],
      'code-validator': ['validate', 'check', 'error', 'syntax', 'lint'],
      'tool-finalizer': ['final', 'complete', 'product', 'ready', 'publish']
    };

    return keywords[agentType] || [];
  }
}
