// AI Orchestrator - Coordinates all AI agents for complete tool creation

import { MagicSparkAgent } from './agents/magic-spark';
import { LogicArchitectAgent } from './agents/logic-architect';
import { ContentCrafterAgent } from './agents/content-crafter';
import { StyleMasterAgent } from './agents/style-master';
import { 
  ToolSuggestion, 
  FrameworkInput, 
  LogicStructure, 
  ContentPieces, 
  BrandingInput, 
  StyleConfig,
  AISession,
  AIStep
} from '@/lib/types/ai';

export interface ToolCreationRequest {
  // Initial input
  expertise: string;
  targetAudience: string;
  industry?: string;
  goals: string[];
  branding: BrandingInput;
  
  // Optional overrides
  selectedSuggestion?: ToolSuggestion;
  customFramework?: Partial<FrameworkInput>;
  contentPreferences?: {
    tone?: string;
    style?: string;
    language?: string;
  };
  stylePreferences?: {
    theme?: string;
    colorScheme?: string;
    layout?: string;
  };
  
  // Configuration
  provider?: 'openai' | 'anthropic';
  streaming?: boolean;
  sessionId?: string;
}

export interface ToolCreationResult {
  suggestion: ToolSuggestion;
  framework: LogicStructure;
  content: ContentPieces;
  styling: StyleConfig;
  metadata: {
    sessionId: string;
    totalProcessingTime: number;
    stepTimings: Record<AIStep, number>;
    provider: string;
    quality: {
      suggestion: number;
      framework: number;
      content: number;
      styling: number;
      overall: number;
    };
  };
}

export interface StreamingCallbacks {
  onStepStart?: (step: AIStep) => void;
  onStepProgress?: (step: AIStep, progress: any) => void;
  onStepComplete?: (step: AIStep, result: any) => void;
  onError?: (step: AIStep, error: Error) => void;
  onComplete?: (result: ToolCreationResult) => void;
}

export class AIOrchestrator {
  private magicSpark: MagicSparkAgent;
  private logicArchitect: LogicArchitectAgent;
  private contentCrafter: ContentCrafterAgent;
  private styleMaster: StyleMasterAgent;
  private provider: 'openai' | 'anthropic';

  constructor(provider: 'openai' | 'anthropic' = 'anthropic') {
    this.provider = provider;
    this.magicSpark = new MagicSparkAgent();
    this.logicArchitect = new LogicArchitectAgent(provider);
    this.contentCrafter = new ContentCrafterAgent(provider);
    this.styleMaster = new StyleMasterAgent(provider);
  }

  /**
   * Create a complete tool with all AI agents
   */
  async createTool(
    request: ToolCreationRequest,
    callbacks?: StreamingCallbacks
  ): Promise<ToolCreationResult> {
    const startTime = Date.now();
    const stepTimings: Record<AIStep, number> = {} as any;
    const sessionId = request.sessionId || this.generateSessionId();

    try {
      // Step 1: Magic Spark - Generate or use suggestion
      callbacks?.onStepStart?.('magic-spark');
      const stepStart = Date.now();
      
      let suggestion: ToolSuggestion;
      if (request.selectedSuggestion) {
        suggestion = request.selectedSuggestion;
      } else {
        suggestion = await this.generateSuggestion(request, callbacks);
      }
      
      stepTimings['magic-spark'] = Date.now() - stepStart;
      callbacks?.onStepComplete?.('magic-spark', suggestion);

      // Step 2: Logic Architect - Build framework
      callbacks?.onStepStart?.('logic-architect');
      const frameworkStart = Date.now();
      
      const framework = await this.buildFramework(
        suggestion, 
        request, 
        callbacks
      );
      
      stepTimings['logic-architect'] = Date.now() - frameworkStart;
      callbacks?.onStepComplete?.('logic-architect', framework);

      // Step 3: Content Crafter - Generate content
      callbacks?.onStepStart?.('content-crafter');
      const contentStart = Date.now();
      
      const content = await this.generateContent(
        suggestion,
        framework,
        request,
        callbacks
      );
      
      stepTimings['content-crafter'] = Date.now() - contentStart;
      callbacks?.onStepComplete?.('content-crafter', content);

      // Step 4: Style Master - Create styling
      callbacks?.onStepStart?.('style-master');
      const styleStart = Date.now();
      
      const styling = await this.generateStyling(
        suggestion,
        request,
        callbacks
      );
      
      stepTimings['style-master'] = Date.now() - styleStart;
      callbacks?.onStepComplete?.('style-master', styling);

      // Calculate quality scores
      const quality = await this.calculateQualityScores(
        suggestion,
        framework,
        content,
        styling
      );

      const result: ToolCreationResult = {
        suggestion,
        framework,
        content,
        styling,
        metadata: {
          sessionId,
          totalProcessingTime: Date.now() - startTime,
          stepTimings,
          provider: this.provider,
          quality
        }
      };

      callbacks?.onComplete?.(result);
      return result;

    } catch (error) {
      console.error('Tool creation failed:', error);
      const err = new Error(`Tool creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      callbacks?.onError?.('magic-spark', err);
      throw err;
    }
  }

  /**
   * Stream tool creation with real-time updates
   */
  async streamToolCreation(
    request: ToolCreationRequest,
    callbacks: StreamingCallbacks
  ): Promise<void> {
    const sessionId = request.sessionId || this.generateSessionId();

    try {
      // Step 1: Stream suggestion generation
      callbacks.onStepStart?.('magic-spark');
      
      let suggestion: ToolSuggestion | null = null;
      
      if (request.selectedSuggestion) {
        suggestion = request.selectedSuggestion;
        callbacks.onStepComplete?.('magic-spark', suggestion);
      } else {
        await this.magicSpark.streamInitialSpark(
          request.expertise,
          request.targetAudience,
          (partial) => callbacks.onStepProgress?.('magic-spark', partial),
          (suggestions) => {
            suggestion = suggestions[0]; // Use first suggestion
            callbacks.onStepComplete?.('magic-spark', suggestion);
          },
          (error) => callbacks.onError?.('magic-spark', error)
        );
      }

      if (!suggestion) {
        throw new Error('Failed to generate suggestion');
      }

      // Step 2: Stream framework building
      callbacks.onStepStart?.('logic-architect');
      
      let framework: LogicStructure | null = null;
      
             const frameworkInput: FrameworkInput = {
         toolType: suggestion.type,
         expertise: request.expertise,
         targetAudience: request.targetAudience,
         goals: request.goals,
         methodology: request.customFramework?.methodology,
         existingContent: request.customFramework?.existingContent
       };

      await this.logicArchitect.streamFrameworkBuilding(
        frameworkInput,
        (partial) => callbacks.onStepProgress?.('logic-architect', partial),
        (result) => {
          framework = result;
          callbacks.onStepComplete?.('logic-architect', framework);
        },
        (error) => callbacks.onError?.('logic-architect', error)
      );

      if (!framework) {
        throw new Error('Failed to build framework');
      }

      // Step 3: Stream content generation
      callbacks.onStepStart?.('content-crafter');
      
      let content: any = null;
      
      await this.contentCrafter.streamContentGeneration(
        suggestion.type,
        request.expertise,
        request.targetAudience,
        (partial) => callbacks.onStepProgress?.('content-crafter', partial),
        (result) => {
          content = result;
          callbacks.onStepComplete?.('content-crafter', content);
        },
        (error) => callbacks.onError?.('content-crafter', error)
      );

      if (!content) {
        throw new Error('Failed to generate content');
      }

      // Step 4: Stream styling generation
      callbacks.onStepStart?.('style-master');
      
      let styling: StyleConfig | null = null;
      
      await this.styleMaster.streamStyleGeneration(
        request.branding,
        request.targetAudience,
        suggestion.type,
        (partial) => callbacks.onStepProgress?.('style-master', partial),
        (result) => {
          styling = result;
          callbacks.onStepComplete?.('style-master', styling);
        },
        (error) => callbacks.onError?.('style-master', error)
      );

      if (!styling) {
        throw new Error('Failed to generate styling');
      }

      // Calculate final quality scores
      const quality = await this.calculateQualityScores(
        suggestion,
        framework,
        content,
        styling
      );

      const finalResult: ToolCreationResult = {
        suggestion,
        framework,
        content,
        styling,
        metadata: {
          sessionId,
          totalProcessingTime: 0, // Will be calculated by caller
          stepTimings: {} as any,
          provider: this.provider,
          quality
        }
      };

      callbacks.onComplete?.(finalResult);

    } catch (error) {
      console.error('Streaming tool creation failed:', error);
      const err = new Error(`Streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      callbacks.onError?.('magic-spark', err);
    }
  }

  /**
   * Generate suggestion (Step 1)
   */
  private async generateSuggestion(
    request: ToolCreationRequest,
    callbacks?: StreamingCallbacks
  ): Promise<ToolSuggestion> {
    const suggestions = await this.magicSpark.generateInitialSpark(
      request.expertise,
      request.targetAudience,
      request.industry,
      request.goals
    );

    if (suggestions.length === 0) {
      throw new Error('No suggestions generated');
    }

    // Return the highest-rated suggestion
    return suggestions.reduce((best, current) => 
      (current.metadata?.score || 0) > (best.metadata?.score || 0) ? current : best
    );
  }

  /**
   * Build framework (Step 2)
   */
  private async buildFramework(
    suggestion: ToolSuggestion,
    request: ToolCreationRequest,
    callbacks?: StreamingCallbacks
  ): Promise<LogicStructure> {
         const frameworkInput: FrameworkInput = {
       toolType: suggestion.type,
       expertise: request.expertise,
       targetAudience: request.targetAudience,
       goals: request.goals,
       methodology: request.customFramework?.methodology || 'best-practices',
       existingContent: request.customFramework?.existingContent
     };

    const framework = await this.logicArchitect.buildFramework(frameworkInput);
    
    // Validate framework
    const validation = await this.logicArchitect.validateFramework(framework);
    if (!validation.isValid) {
      console.warn('Framework validation issues:', validation.issues);
      // Attempt to optimize
      return await this.logicArchitect.optimizeFramework(
        framework,
        ['clarity', 'user-experience', 'accuracy']
      );
    }

    return framework;
  }

  /**
   * Generate content (Step 3)
   */
  private async generateContent(
    suggestion: ToolSuggestion,
    framework: LogicStructure,
    request: ToolCreationRequest,
    callbacks?: StreamingCallbacks
  ): Promise<any> {
    const content = await this.contentCrafter.generateToolContent(
      suggestion.type,
      request.expertise,
      request.targetAudience,
      request.branding,
      framework
    );

    // Optimize content if needed
    const optimized = await this.contentCrafter.optimizeContent(
      content,
      request.targetAudience,
      request.goals
    );

    // Validate content quality
    const validation = await this.contentCrafter.validateContent(
      optimized,
      request.branding,
      request.targetAudience
    );

    if (validation.score < 7) {
      console.warn('Content quality below threshold:', validation.score);
      // Could implement additional optimization here
    }

    return optimized;
  }

  /**
   * Generate styling (Step 4)
   */
  private async generateStyling(
    suggestion: ToolSuggestion,
    request: ToolCreationRequest,
    callbacks?: StreamingCallbacks
  ): Promise<StyleConfig> {
    const styling = await this.styleMaster.generateStyleConfig(
      request.branding,
      request.targetAudience,
      suggestion.type
    );

    // Validate accessibility and consistency
    const validation = await this.styleMaster.validateStyles(styling, 'AA');
    
    if (!validation.isValid || validation.accessibilityScore < 8) {
      console.warn('Style validation issues:', validation.issues);
      // Optimize for accessibility and performance
      return await this.styleMaster.optimizeStyles(
        styling,
        ['accessibility', 'performance', 'consistency']
      );
    }

    return styling;
  }

  /**
   * Calculate quality scores for all components
   */
  private async calculateQualityScores(
    suggestion: ToolSuggestion,
    framework: LogicStructure,
    content: any,
    styling: StyleConfig
  ): Promise<{
    suggestion: number;
    framework: number;
    content: number;
    styling: number;
    overall: number;
  }> {
    // Suggestion quality (based on completeness and relevance)
    const suggestionScore = this.scoreSuggestion(suggestion);
    
    // Framework quality (based on logic and structure)
    const frameworkValidation = await this.logicArchitect.validateFramework(framework);
    const frameworkScore = frameworkValidation.isValid ? 8.5 : 6.0;
    
    // Content quality (if validation was performed)
    const contentScore = 8.0; // Default, would use actual validation results
    
    // Styling quality (based on accessibility and design)
    const styleValidation = await this.styleMaster.validateStyles(styling);
    const stylingScore = styleValidation.accessibilityScore;
    
    // Overall quality (weighted average)
    const overall = (
      suggestionScore * 0.2 +
      frameworkScore * 0.3 +
      contentScore * 0.3 +
      stylingScore * 0.2
    );

    return {
      suggestion: suggestionScore,
      framework: frameworkScore,
      content: contentScore,
      styling: stylingScore,
      overall
    };
  }

  /**
   * Score suggestion quality
   */
     private scoreSuggestion(suggestion: ToolSuggestion): number {
     let score = 5; // Base score
     
     // Check completeness
     if (suggestion.title && suggestion.description) score += 1;
     if (suggestion.targetAudience) score += 0.5;
     if (suggestion.metadata?.valueProposition) score += 1;
     if (suggestion.metadata?.businessImpact) score += 0.5;
     if (suggestion.suggestedQuestions && suggestion.suggestedQuestions.length > 0) score += 1;
     if (suggestion.estimatedCompletionTime > 0) score += 0.5;
     if (suggestion.complexity) score += 0.5;
     
     return Math.min(score, 10);
   }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get orchestrator status and capabilities
   */
  getStatus(): {
    provider: string;
    agents: string[];
    capabilities: string[];
    ready: boolean;
  } {
    return {
      provider: this.provider,
      agents: ['magic-spark', 'logic-architect', 'content-crafter', 'style-master'],
      capabilities: [
        'tool-suggestion',
        'framework-building',
        'content-generation',
        'style-creation',
        'streaming',
        'validation',
        'optimization'
      ],
      ready: true
    };
  }

  /**
   * Switch AI provider
   */
  switchProvider(provider: 'openai' | 'anthropic'): void {
    this.provider = provider;
    this.magicSpark = new MagicSparkAgent();
    this.logicArchitect = new LogicArchitectAgent(provider);
    this.contentCrafter = new ContentCrafterAgent(provider);
    this.styleMaster = new StyleMasterAgent(provider);
  }
}

// Export singleton instance
export const aiOrchestrator = new AIOrchestrator();

// TODO: Add error recovery and retry logic
// TODO: Implement caching for common requests
// TODO: Add analytics and performance monitoring
// TODO: Implement A/B testing for different approaches
// TODO: Add support for custom agent configurations
// TODO: Implement batch processing for multiple tools
// TODO: Add integration with external services
// TODO: Implement advanced quality scoring algorithms 