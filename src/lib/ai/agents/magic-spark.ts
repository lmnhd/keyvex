// Magic Spark Agent for initial tool suggestions (10-15 seconds)

import { generateObject, streamObject } from 'ai';
import { z } from 'zod';
import { ToolSuggestion, FrameworkInput } from '@/lib/types/ai';
import { MAGIC_SPARK_PROMPTS } from '@/lib/prompts/magic-spark';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getPrimaryModel, getFallbackModel } from '../models/model-config';
import { debugLog } from '../../auth/debug';

// Zod schemas for structured outputs
const toolSuggestionSchema = z.object({
  id: z.string(),
  type: z.enum(['calculator', 'quiz', 'assessment']),
  title: z.string(),
  description: z.string(),
  targetAudience: z.string(),
  estimatedCompletionTime: z.number(),
  complexity: z.enum(['simple', 'medium', 'complex']),
  suggestedQuestions: z.array(z.string()).optional(),
  valueProposition: z.string(),
  businessImpact: z.string(),
  sampleQuestions: z.array(z.string()),
  metadata: z.record(z.any())
});

const suggestionArraySchema = z.object({
  suggestions: z.array(toolSuggestionSchema),
  metadata: z.object({
    totalSuggestions: z.number(),
    averageComplexity: z.string(),
    recommendedNext: z.string()
  })
});

const frameworkInputSchema = z.object({
  toolType: z.string(),
  expertise: z.string(),
  targetAudience: z.string(),
  goals: z.array(z.string()),
  methodology: z.string().optional(),
  existingContent: z.string().optional(),
  framework: z.object({
    approach: z.string(),
    steps: z.array(z.string()),
    principles: z.array(z.string())
  }),
  questions: z.array(z.object({
    text: z.string(),
    type: z.string(),
    category: z.string()
  })),
  scoringSystem: z.object({
    methodology: z.string(),
    maxScore: z.number(),
    categories: z.array(z.string())
  })
});

const feasibilitySchema = z.object({
  overallScore: z.number().min(1).max(10),
  implementationComplexity: z.number().min(1).max(10),
  timeToCreate: z.number(),
  requiredExpertise: z.string(),
  marketDemand: z.number().min(1).max(10),
  challenges: z.array(z.string()),
  recommendations: z.array(z.string()),
  successProbability: z.number().min(0).max(100)
});

export class MagicSparkAgent {
  private model: any;
  private fallbackModel: any;
  private config: any;
  private fallbackConfig: any;
  
  constructor() {
    // Get model configuration from centralized config
    const primaryModel = getPrimaryModel('magicSpark');
    const fallbackModel = getFallbackModel('magicSpark');
    
    if (!primaryModel) {
      throw new Error('No primary model configuration found for Magic Spark');
    }
    
    this.config = primaryModel;
    this.fallbackConfig = fallbackModel;
    
    // Initialize primary model
    this.model = this.createModelInstance(primaryModel.provider, primaryModel.modelInfo.id);
    
    // Initialize fallback model if available
    if (fallbackModel) {
      this.fallbackModel = this.createModelInstance(fallbackModel.provider, fallbackModel.modelInfo.id);
    }
    
    debugLog('Magic Spark Agent initialized', {
      primary: `${primaryModel.provider}/${primaryModel.model}`,
      fallback: fallbackModel ? `${fallbackModel.provider}/${fallbackModel.model}` : 'none'
    });
  }
  
  private createModelInstance(provider: string, modelId: string): any {
    switch (provider) {
      case 'openai':
        return openai(modelId);
      case 'anthropic':
        return anthropic(modelId);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Generate initial tool suggestions based on user expertise
   */
  async generateInitialSpark(
    expertise: string, 
    targetAudience?: string,
    industry?: string,
    goals?: string[]
  ): Promise<ToolSuggestion[]> {
    try {
      const prompt = MAGIC_SPARK_PROMPTS.INITIAL_SUGGESTION
        .replace('{expertise}', expertise)
        .replace('{targetAudience}', targetAudience || 'General business audience')
        .replace('{industry}', industry || 'General')
        .replace('{goals}', goals?.join(', ') || 'Lead generation and engagement');

      debugLog('Generating initial spark', { 
        model: `${this.config.provider}/${this.config.model}`,
        expertise,
        targetAudience 
      });

      const { object } = await generateObject({
        model: this.model,
        schema: suggestionArraySchema,
        prompt,
        temperature: this.config.config.temperature,
        maxRetries: 3
      });

      // Transform to match ToolSuggestion interface
      return object.suggestions.map((suggestion: any) => ({
        ...suggestion,
        estimatedCompletionTime: suggestion.estimatedCompletionTime,
        suggestedQuestions: suggestion.sampleQuestions
      }));

    } catch (error) {
      console.error('Error generating initial spark:', error);
      
      // Try fallback model if available
      if (this.fallbackModel && this.fallbackConfig) {
        debugLog('Trying fallback model for initial spark', { 
          fallback: `${this.fallbackConfig.provider}/${this.fallbackConfig.model}` 
        });
        
        try {
          const prompt = MAGIC_SPARK_PROMPTS.INITIAL_SUGGESTION
            .replace('{expertise}', expertise)
            .replace('{targetAudience}', targetAudience || 'General business audience')
            .replace('{industry}', industry || 'General')
            .replace('{goals}', goals?.join(', ') || 'Lead generation and engagement');

          const { object } = await generateObject({
            model: this.fallbackModel,
            schema: suggestionArraySchema,
            prompt,
            temperature: this.fallbackConfig.config.temperature,
            maxRetries: 2
          });

          return object.suggestions.map((suggestion: any) => ({
            ...suggestion,
            estimatedCompletionTime: suggestion.estimatedCompletionTime,
            suggestedQuestions: suggestion.sampleQuestions
          }));
        } catch (fallbackError) {
          console.error('Fallback model also failed:', fallbackError);
        }
      }
      
      throw new Error(`Failed to generate tool suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream tool suggestions for real-time updates
   */
  async streamInitialSpark(
    expertise: string,
    targetAudience?: string,
    onPartialSuggestion?: (partial: any) => void,
    onComplete?: (suggestions: ToolSuggestion[]) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const prompt = MAGIC_SPARK_PROMPTS.INITIAL_SUGGESTION
        .replace('{expertise}', expertise)
        .replace('{targetAudience}', targetAudience || 'General business audience');

      const { partialObjectStream } = streamObject({
        model: this.model,
        schema: suggestionArraySchema,
        prompt,
        temperature: 0.7,
        onError: onError ? (event) => onError(new Error(String(event.error))) : undefined
      });

      for await (const partialObject of partialObjectStream) {
        onPartialSuggestion?.(partialObject);
      }

    } catch (error) {
      const err = new Error(`Streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onError?.(err);
    }
  }

  /**
   * Refine tool suggestion based on user feedback
   */
  async refineSuggestion(
    originalSuggestion: ToolSuggestion,
    userFeedback: string
  ): Promise<ToolSuggestion> {
    try {
      const prompt = MAGIC_SPARK_PROMPTS.REFINEMENT
        .replace('{originalSuggestion}', JSON.stringify(originalSuggestion, null, 2))
        .replace('{userFeedback}', userFeedback);

      const { object } = await generateObject({
        model: this.model,
        schema: toolSuggestionSchema,
        prompt,
        temperature: 0.6,
        maxRetries: 2
      });

      return {
        ...object,
        suggestedQuestions: object.sampleQuestions
      };

    } catch (error) {
      console.error('Error refining suggestion:', error);
      throw new Error(`Failed to refine suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate tool prototype based on selected suggestion
   */
  async generatePrototype(suggestion: ToolSuggestion): Promise<FrameworkInput> {
    try {
      const prompt = MAGIC_SPARK_PROMPTS.PROTOTYPE_GENERATION
        .replace('{suggestion}', JSON.stringify(suggestion, null, 2));

      const { object } = await generateObject({
        model: this.model,
        schema: frameworkInputSchema,
        prompt,
        temperature: 0.5,
        maxRetries: 2
      });

      return object;

    } catch (error) {
      console.error('Error generating prototype:', error);
      throw new Error(`Failed to generate prototype: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate tool suggestion feasibility
   */
  async validateFeasibility(
    suggestion: ToolSuggestion,
    userContext: {
      expertiseLevel?: string;
      timeAvailable?: string;
      technicalSkills?: string;
      targetComplexity?: string;
    } = {}
  ): Promise<{
    isValid: boolean;
    score: number;
    analysis: any;
  }> {
    try {
      const prompt = MAGIC_SPARK_PROMPTS.FEASIBILITY_VALIDATION
        .replace('{suggestion}', JSON.stringify(suggestion, null, 2))
        .replace('{expertiseLevel}', userContext.expertiseLevel || 'Intermediate')
        .replace('{timeAvailable}', userContext.timeAvailable || '2-4 hours')
        .replace('{technicalSkills}', userContext.technicalSkills || 'Basic')
        .replace('{targetComplexity}', userContext.targetComplexity || 'Medium');

      const { object } = await generateObject({
        model: this.model,
        schema: feasibilitySchema,
        prompt,
        temperature: 0.3,
        maxRetries: 2
      });

      return {
        isValid: object.overallScore >= 6,
        score: object.overallScore,
        analysis: object
      };

    } catch (error) {
      console.error('Error validating feasibility:', error);
      throw new Error(`Failed to validate feasibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get similar tool examples for inspiration
   */
  async getSimilarExamples(
    toolType: string, 
    industry: string,
    targetAudience?: string
  ): Promise<any[]> {
    try {
      const prompt = MAGIC_SPARK_PROMPTS.SIMILAR_EXAMPLES
        .replace('{toolType}', toolType)
        .replace('{industry}', industry)
        .replace('{targetAudience}', targetAudience || 'Business professionals');

      const examplesSchema = z.object({
        examples: z.array(z.object({
          name: z.string(),
          type: z.string(),
          methodology: z.string(),
          keyFeatures: z.array(z.string()),
          successMetrics: z.string().optional(),
          effectiveness: z.string(),
          lessons: z.array(z.string())
        }))
      });

      const { object } = await generateObject({
        model: this.model,
        schema: examplesSchema,
        prompt,
        temperature: 0.6,
        maxRetries: 2
      });

      return object.examples;

    } catch (error) {
      console.error('Error getting similar examples:', error);
      throw new Error(`Failed to get examples: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhance value proposition for a tool concept
   */
  async enhanceValueProposition(
    toolConcept: string,
    targetAudience: string
  ): Promise<{
    rational: string;
    emotional: string;
    social: string;
    painPoints: string[];
    benefits: string[];
  }> {
    try {
      const prompt = MAGIC_SPARK_PROMPTS.VALUE_PROPOSITION
        .replace('{toolConcept}', toolConcept)
        .replace('{targetAudience}', targetAudience);

      const valuePropositionSchema = z.object({
        rational: z.string(),
        emotional: z.string(),
        social: z.string(),
        painPoints: z.array(z.string()),
        benefits: z.array(z.string()),
        outcomes: z.array(z.string()),
        emotionalAppeal: z.string()
      });

      const { object } = await generateObject({
        model: this.model,
        schema: valuePropositionSchema,
        prompt,
        temperature: 0.7,
        maxRetries: 2
      });

      return object;

    } catch (error) {
      console.error('Error enhancing value proposition:', error);
      throw new Error(`Failed to enhance value proposition: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch generate multiple suggestions with different approaches
   */
  async batchGenerateSuggestions(
    expertise: string,
    approaches: string[] = ['analytical', 'creative', 'practical']
  ): Promise<ToolSuggestion[]> {
    try {
      const promises = approaches.map(approach => {
        const modifiedPrompt = `${MAGIC_SPARK_PROMPTS.INITIAL_SUGGESTION}\n\nApproach: Focus on ${approach} solutions.`
          .replace('{expertise}', expertise);
        
        return generateObject({
          model: this.model,
          schema: suggestionArraySchema,
          prompt: modifiedPrompt,
          temperature: approach === 'creative' ? 0.8 : 0.6
        });
      });

      const results = await Promise.all(promises);
      
      // Combine and deduplicate suggestions
      const allSuggestions = results.flatMap((result: any) => result.object.suggestions);
      const uniqueSuggestions = allSuggestions.filter((suggestion: any, index: number, self: any[]) => 
        index === self.findIndex((s: any) => s.title === suggestion.title)
      );

      return uniqueSuggestions.map((suggestion: any) => ({
        ...suggestion,
        suggestedQuestions: suggestion.sampleQuestions
      }));

    } catch (error) {
      console.error('Error in batch generation:', error);
      throw new Error(`Batch generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// TODO: Add error handling and retry logic
// TODO: Implement streaming responses for real-time feedback
// TODO: Add caching for common suggestions
// TODO: Implement A/B testing for suggestion quality
// TODO: Add analytics tracking for suggestion success rates 