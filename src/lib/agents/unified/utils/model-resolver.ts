/**
 * Model Resolver Utility (Phase 1.2)
 * Intelligent model selection for unified agent system
 * 
 * Provides smart model assignment based on agent requirements,
 * task complexity, retry context, and performance history.
 */

import { AgentType, ModelConfiguration, RetryContext } from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/tcc-unified';
import logger from '@/lib/logger';

export interface ModelSelectionContext {
  agentType: AgentType;
  taskComplexity: 'simple' | 'moderate' | 'complex';
  isRetry: boolean;
  retryContext?: RetryContext;
  userModelPreference?: string;
  budgetConstraints?: 'low' | 'medium' | 'high';
  performanceHistory?: AgentPerformanceHistory[];
}

export interface AgentPerformanceHistory {
  agentType: AgentType;
  modelId: string;
  successRate: number;
  averageExecutionTime: number;
  averageQualityScore: number;
  lastUsed: string;
  totalExecutions: number;
}

export interface ModelRecommendation {
  primaryModel: ModelConfiguration;
  fallbackModel: ModelConfiguration;
  reasoning: string;
  confidence: number;
  estimatedCost: number;
  estimatedTime: number;
}

export class ModelResolver {
  private readonly defaultModels = {
    primary: 'claude-3-7-sonnet-20250219',
    fallback: 'claude-sonnet-4-20250514',
    budget: 'claude-3-5-sonnet-20241022',
    premium: 'claude-opus-4-20250514'
  };

  private readonly agentModelPreferences: Record<AgentType, {
    preferred: string[];
    fallback: string[];
    complexity: Record<string, string>;
  }> = {
    'function-planner': {
      preferred: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022'],
      fallback: ['claude-sonnet-4-20250514'],
      complexity: {
        simple: 'claude-3-5-sonnet-20241022',
        moderate: 'claude-3-7-sonnet-20250219',
        complex: 'claude-sonnet-4-20250514'
      }
    },
    'state-design': {
      preferred: ['claude-3-7-sonnet-20250219', 'claude-sonnet-4-20250514'],
      fallback: ['claude-3-5-sonnet-20241022'],
      complexity: {
        simple: 'claude-3-7-sonnet-20250219',
        moderate: 'claude-3-7-sonnet-20250219',
        complex: 'claude-sonnet-4-20250514'
      }
    },
    'jsx-layout': {
      preferred: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022'],
      fallback: ['claude-sonnet-4-20250514'],
      complexity: {
        simple: 'claude-3-5-sonnet-20241022',
        moderate: 'claude-3-7-sonnet-20250219',
        complex: 'claude-3-7-sonnet-20250219'
      }
    },
    'tailwind-styling': {
      preferred: ['claude-3-5-sonnet-20241022', 'claude-3-7-sonnet-20250219'],
      fallback: ['claude-sonnet-4-20250514'],
      complexity: {
        simple: 'claude-3-5-sonnet-20241022',
        moderate: 'claude-3-5-sonnet-20241022',
        complex: 'claude-3-7-sonnet-20250219'
      }
    },
    'component-assembler': {
      preferred: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219'],
      fallback: ['claude-3-5-sonnet-20241022'],
      complexity: {
        simple: 'claude-3-7-sonnet-20250219',
        moderate: 'claude-sonnet-4-20250514',
        complex: 'claude-sonnet-4-20250514'
      }
    },
    'code-validator': {
      preferred: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219'],
      fallback: ['claude-3-5-sonnet-20241022'],
      complexity: {
        simple: 'claude-3-7-sonnet-20250219',
        moderate: 'claude-sonnet-4-20250514',
        complex: 'claude-sonnet-4-20250514'
      }
    },
    'tool-finalizer': {
      preferred: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'],
      fallback: ['claude-3-7-sonnet-20250219'],
      complexity: {
        simple: 'claude-sonnet-4-20250514',
        moderate: 'claude-sonnet-4-20250514',
        complex: 'claude-opus-4-20250514'
      }
    }
  };

  private readonly modelConfigurations: Record<string, ModelConfiguration> = {
    'claude-3-5-sonnet-20241022': {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      temperature: 0.1,
      maxTokens: 4000,
      topP: 0.95
    },
    'claude-3-7-sonnet-20250219': {
      provider: 'anthropic',
      modelId: 'claude-3-7-sonnet-20250219',
      temperature: 0.1,
      maxTokens: 4000,
      topP: 0.95
    },
    'claude-sonnet-4-20250514': {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      temperature: 0.1,
      maxTokens: 4000,
      topP: 0.95
    },
    'claude-opus-4-20250514': {
      provider: 'anthropic',
      modelId: 'claude-opus-4-20250514',
      temperature: 0.1,
      maxTokens: 4000,
      topP: 0.95
    }
  };

  constructor() {}

  /**
   * Get model recommendation for agent execution
   */
  getModelRecommendation(context: ModelSelectionContext): ModelRecommendation {
    logger.info({
      agentType: context.agentType,
      taskComplexity: context.taskComplexity,
      isRetry: context.isRetry,
      userPreference: context.userModelPreference
    }, '🤖 ModelResolver: Getting model recommendation');

    // Start with agent preferences
    const agentPrefs = this.agentModelPreferences[context.agentType];
    
    // Determine primary model
    let primaryModelId = this.selectPrimaryModel(context, agentPrefs);
    
    // Determine fallback model
    let fallbackModelId = this.selectFallbackModel(context, agentPrefs, primaryModelId);
    
    // Apply performance history adjustments
    if (context.performanceHistory && context.performanceHistory.length > 0) {
      const adjustedModels = this.adjustModelsBasedOnHistory(
        primaryModelId,
        fallbackModelId,
        context
      );
      primaryModelId = adjustedModels.primary;
      fallbackModelId = adjustedModels.fallback;
    }

    const primaryModel = this.modelConfigurations[primaryModelId];
    const fallbackModel = this.modelConfigurations[fallbackModelId];

    // Apply context-specific adjustments
    const adjustedPrimary = this.adjustModelForContext(primaryModel, context);
    const adjustedFallback = this.adjustModelForContext(fallbackModel, context);

    const reasoning = this.generateReasoning(context, primaryModelId, fallbackModelId);
    const confidence = this.calculateConfidence(context);
    const estimatedCost = this.estimateCost(primaryModelId, context);
    const estimatedTime = this.estimateExecutionTime(primaryModelId, context);

    const recommendation: ModelRecommendation = {
      primaryModel: adjustedPrimary,
      fallbackModel: adjustedFallback,
      reasoning,
      confidence,
      estimatedCost,
      estimatedTime
    };

    logger.info({
      agentType: context.agentType,
      primaryModel: primaryModelId,
      fallbackModel: fallbackModelId,
      confidence,
      reasoning
    }, '🤖 ModelResolver: Model recommendation generated');

    return recommendation;
  }

  /**
   * Determine task complexity from TCC context
   */
  determineTaskComplexity(
    agentType: AgentType,
    tcc: ToolConstructionContext
  ): 'simple' | 'moderate' | 'complex' {
    switch (agentType) {
      case 'function-planner':
        const functionCount = tcc.definedFunctionSignatures?.length || 0;
        if (functionCount <= 2) return 'simple';
        if (functionCount <= 5) return 'moderate';
        return 'complex';

      case 'state-design':
        const variableCount = tcc.stateLogic?.variables?.length || 0;
        const functionLogicCount = tcc.stateLogic?.functions?.length || 0;
        const totalStateItems = variableCount + functionLogicCount;
        if (totalStateItems <= 5) return 'simple';
        if (totalStateItems <= 12) return 'moderate';
        return 'complex';

      case 'jsx-layout':
        const inputCount = tcc.brainstormData?.suggestedInputs?.length || 0;
        const flowSteps = tcc.brainstormData?.interactionFlow?.length || 0;
        if (inputCount <= 5 && flowSteps <= 3) return 'simple';
        if (inputCount <= 10 && flowSteps <= 6) return 'moderate';
        return 'complex';

      case 'tailwind-styling':
        const enhancementCount = tcc.brainstormData?.creativeEnhancements?.length || 0;
        if (enhancementCount <= 3) return 'simple';
        if (enhancementCount <= 6) return 'moderate';
        return 'complex';

      case 'component-assembler':
        const codeLength = tcc.finalComponentCode?.length || 0;
        if (codeLength <= 2000) return 'simple';
        if (codeLength <= 5000) return 'moderate';
        return 'complex';

      case 'code-validator':
        const hasValidationIssues = tcc.validationResult && !tcc.validationResult.isValid;
        return hasValidationIssues ? 'complex' : 'simple';

      case 'tool-finalizer':
        // Tool finalizer is always complex as it needs to create final product
        return 'complex';

      default:
        return 'moderate';
    }
  }

  /**
   * Update performance history based on execution results
   */
  updatePerformanceHistory(
    agentType: AgentType,
    modelId: string,
    success: boolean,
    executionTime: number,
    qualityScore: number,
    existingHistory: AgentPerformanceHistory[]
  ): AgentPerformanceHistory[] {
    const updated = [...existingHistory];
    const existing = updated.find(h => h.agentType === agentType && h.modelId === modelId);

    if (existing) {
      // Update existing record
      const newTotalExecutions = existing.totalExecutions + 1;
      const newSuccessCount = (existing.successRate * existing.totalExecutions) + (success ? 1 : 0);
      const newAvgTime = ((existing.averageExecutionTime * existing.totalExecutions) + executionTime) / newTotalExecutions;
      const newAvgQuality = ((existing.averageQualityScore * existing.totalExecutions) + qualityScore) / newTotalExecutions;

      existing.successRate = newSuccessCount / newTotalExecutions;
      existing.averageExecutionTime = newAvgTime;
      existing.averageQualityScore = newAvgQuality;
      existing.totalExecutions = newTotalExecutions;
      existing.lastUsed = new Date().toISOString();
    } else {
      // Create new record
      updated.push({
        agentType,
        modelId,
        successRate: success ? 1 : 0,
        averageExecutionTime: executionTime,
        averageQualityScore: qualityScore,
        lastUsed: new Date().toISOString(),
        totalExecutions: 1
      });
    }

    return updated;
  }

  /**
   * Get performance statistics for analysis
   */
  getPerformanceStatistics(
    history: AgentPerformanceHistory[]
  ): {
    totalExecutions: number;
    overallSuccessRate: number;
    bestPerformingModel: string | null;
    worstPerformingModel: string | null;
    agentStats: Record<AgentType, {
      executions: number;
      successRate: number;
      avgQuality: number;
    }>;
  } {
    if (history.length === 0) {
      return {
        totalExecutions: 0,
        overallSuccessRate: 0,
        bestPerformingModel: null,
        worstPerformingModel: null,
        agentStats: {} as Record<AgentType, any>
      };
    }

    const totalExecutions = history.reduce((sum, h) => sum + h.totalExecutions, 0);
    const totalSuccesses = history.reduce((sum, h) => sum + (h.successRate * h.totalExecutions), 0);
    const overallSuccessRate = totalSuccesses / totalExecutions;

    // Find best and worst performing models
    const modelPerformance = new Map<string, { success: number; total: number; quality: number }>();
    
    history.forEach(h => {
      const existing = modelPerformance.get(h.modelId) || { success: 0, total: 0, quality: 0 };
      existing.success += h.successRate * h.totalExecutions;
      existing.total += h.totalExecutions;
      existing.quality += h.averageQualityScore * h.totalExecutions;
      modelPerformance.set(h.modelId, existing);
    });

    let bestModel: string | null = null;
    let worstModel: string | null = null;
    let bestScore = 0;
    let worstScore = Infinity;

    modelPerformance.forEach((perf, modelId) => {
      const score = (perf.success / perf.total) * (perf.quality / perf.total);
      if (score > bestScore) {
        bestScore = score;
        bestModel = modelId;
      }
      if (score < worstScore) {
        worstScore = score;
        worstModel = modelId;
      }
    });

    // Agent statistics
    const agentStats: Record<AgentType, any> = {} as Record<AgentType, any>;
    const agentGroups = new Map<AgentType, AgentPerformanceHistory[]>();
    
    history.forEach(h => {
      const existing = agentGroups.get(h.agentType) || [];
      existing.push(h);
      agentGroups.set(h.agentType, existing);
    });

    agentGroups.forEach((histories, agentType) => {
      const executions = histories.reduce((sum, h) => sum + h.totalExecutions, 0);
      const successes = histories.reduce((sum, h) => sum + (h.successRate * h.totalExecutions), 0);
      const qualitySum = histories.reduce((sum, h) => sum + (h.averageQualityScore * h.totalExecutions), 0);

      agentStats[agentType] = {
        executions,
        successRate: successes / executions,
        avgQuality: qualitySum / executions
      };
    });

    return {
      totalExecutions,
      overallSuccessRate,
      bestPerformingModel: bestModel,
      worstPerformingModel: worstModel,
      agentStats
    };
  }

  /**
   * Select primary model based on context
   */
  private selectPrimaryModel(
    context: ModelSelectionContext,
    agentPrefs: typeof this.agentModelPreferences[AgentType]
  ): string {
    // User preference takes highest priority
    if (context.userModelPreference && this.modelConfigurations[context.userModelPreference]) {
      return context.userModelPreference;
    }

    // For retries, try a different model if available
    if (context.isRetry && context.retryContext) {
      const lastModel = context.retryContext.agentType;
      const alternatives = agentPrefs.preferred.filter(m => m !== lastModel);
      if (alternatives.length > 0) {
        return alternatives[0];
      }
    }

    // Budget constraints
    if (context.budgetConstraints === 'low') {
      return this.defaultModels.budget;
    }

    // Complexity-based selection
    const complexityModel = agentPrefs.complexity[context.taskComplexity];
    if (complexityModel && this.modelConfigurations[complexityModel]) {
      return complexityModel;
    }

    // Default to first preferred model
    return agentPrefs.preferred[0] || this.defaultModels.primary;
  }

  /**
   * Select fallback model
   */
  private selectFallbackModel(
    context: ModelSelectionContext,
    agentPrefs: typeof this.agentModelPreferences[AgentType],
    primaryModelId: string
  ): string {
    // Fallback should be different from primary
    const candidates = [...agentPrefs.fallback, ...agentPrefs.preferred]
      .filter(m => m !== primaryModelId);

    return candidates[0] || this.defaultModels.fallback;
  }

  /**
   * Adjust models based on performance history
   */
  private adjustModelsBasedOnHistory(
    primaryModelId: string,
    fallbackModelId: string,
    context: ModelSelectionContext
  ): { primary: string; fallback: string } {
    const agentHistory = context.performanceHistory!.filter(h => h.agentType === context.agentType);
    
    if (agentHistory.length === 0) {
      return { primary: primaryModelId, fallback: fallbackModelId };
    }

    // Find best performing model for this agent
    const bestModel = agentHistory.reduce((best, current) => {
      const bestScore = (best.successRate * 0.6) + (best.averageQualityScore * 0.4);
      const currentScore = (current.successRate * 0.6) + (current.averageQualityScore * 0.4);
      return currentScore > bestScore ? current : best;
    });

    // If best performing model is significantly better, use it as primary
    const currentPrimaryHistory = agentHistory.find(h => h.modelId === primaryModelId);
    if (currentPrimaryHistory && bestModel.modelId !== primaryModelId) {
      const bestScore = (bestModel.successRate * 0.6) + (bestModel.averageQualityScore * 0.4);
      const currentScore = (currentPrimaryHistory.successRate * 0.6) + (currentPrimaryHistory.averageQualityScore * 0.4);
      
      if (bestScore > currentScore + 0.1) { // 10% better threshold
        return { primary: bestModel.modelId, fallback: primaryModelId };
      }
    }

    return { primary: primaryModelId, fallback: fallbackModelId };
  }

  /**
   * Adjust model configuration for specific context
   */
  private adjustModelForContext(
    baseModel: ModelConfiguration,
    context: ModelSelectionContext
  ): ModelConfiguration {
    const adjusted = { ...baseModel };

    // Adjust temperature based on task complexity
    switch (context.taskComplexity) {
      case 'simple':
        adjusted.temperature = 0.05; // More deterministic for simple tasks
        break;
      case 'complex':
        adjusted.temperature = 0.15; // Slightly more creative for complex tasks
        break;
    }

    // Adjust for retries - be more conservative
    if (context.isRetry) {
      adjusted.temperature = Math.max(0.05, adjusted.temperature * 0.8);
    }

    return adjusted;
  }

  /**
   * Generate reasoning for model selection
   */
  private generateReasoning(
    context: ModelSelectionContext,
    primaryModelId: string,
    fallbackModelId: string
  ): string {
    const reasons: string[] = [];

    reasons.push(`Selected ${primaryModelId} as primary model for ${context.agentType}`);
    
    if (context.userModelPreference) {
      reasons.push('User preference applied');
    }
    
    if (context.taskComplexity === 'complex') {
      reasons.push('Complex task detected - using advanced model');
    }
    
    if (context.isRetry) {
      reasons.push('Retry attempt - adjusted model selection');
    }
    
    if (context.budgetConstraints === 'low') {
      reasons.push('Budget constraints considered');
    }

    reasons.push(`Fallback: ${fallbackModelId}`);

    return reasons.join('. ');
  }

  /**
   * Calculate confidence in model selection
   */
  private calculateConfidence(context: ModelSelectionContext): number {
    let confidence = 0.8; // Base confidence

    // Increase confidence for user preferences
    if (context.userModelPreference) {
      confidence += 0.1;
    }

    // Increase confidence if we have performance history
    if (context.performanceHistory && context.performanceHistory.length > 5) {
      confidence += 0.1;
    }

    // Decrease confidence for complex tasks
    if (context.taskComplexity === 'complex') {
      confidence -= 0.1;
    }

    // Decrease confidence for retries
    if (context.isRetry) {
      confidence -= 0.1;
    }

    return Math.max(0.5, Math.min(1.0, confidence));
  }

  /**
   * Estimate cost for model execution
   */
  private estimateCost(modelId: string, context: ModelSelectionContext): number {
    // Base costs (in cents) - these are rough estimates
    const baseCosts: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 3,
      'claude-3-7-sonnet-20250219': 5,
      'claude-sonnet-4-20250514': 8,
      'claude-opus-4-20250514': 15
    };

    const baseCost = baseCosts[modelId] || 5;

    // Adjust for task complexity
    const complexityMultiplier = {
      simple: 0.8,
      moderate: 1.0,
      complex: 1.5
    };

    return baseCost * complexityMultiplier[context.taskComplexity];
  }

  /**
   * Estimate execution time
   */
  private estimateExecutionTime(modelId: string, context: ModelSelectionContext): number {
    // Base times in seconds
    const baseTimes: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 15,
      'claude-3-7-sonnet-20250219': 20,
      'claude-sonnet-4-20250514': 30,
      'claude-opus-4-20250514': 45
    };

    const baseTime = baseTimes[modelId] || 20;

    // Adjust for task complexity
    const complexityMultiplier = {
      simple: 0.7,
      moderate: 1.0,
      complex: 1.8
    };

    return Math.round(baseTime * complexityMultiplier[context.taskComplexity]);
  }
}
