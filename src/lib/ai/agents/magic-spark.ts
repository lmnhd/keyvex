// Magic Spark Agent for initial tool suggestions (10-15 seconds)
import { generateObject, streamObject } from 'ai';
import { z } from 'zod';
import { ToolSuggestion, FrameworkInput } from '@/lib/types/ai';
import { MAGIC_SPARK_PROMPTS } from '@/lib/prompts/magic-spark';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getPrimaryModel, getFallbackModel } from '../models/model-config';

// Simple debug logging for client-side use
const debugLog = (message: string, data?: any): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔧 DEBUG: ${message}`, data || '');
  }
};

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

// Enhanced schemas for visual brand analysis
const brandAnalysisSchema = z.object({
  colors: z.array(z.object({
    hex: z.string(),
    name: z.string(),
    usage: z.enum(['primary', 'secondary', 'accent', 'neutral']),
    confidence: z.number().min(0).max(1)
  })),
  personality: z.array(z.string()),
  style: z.enum(['modern', 'classic', 'minimalist', 'bold', 'playful', 'professional', 'elegant', 'corporate']),
  typography: z.object({
    suggestedFonts: z.array(z.string()),
    style: z.enum(['serif', 'sans-serif', 'script', 'display', 'monospace'])
  }),
  recommendations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  designElements: z.object({
    logoType: z.enum(['wordmark', 'symbol', 'combination', 'emblem', 'abstract']).optional(),
    complexity: z.enum(['simple', 'moderate', 'complex']),
    industry: z.string().optional()
  }).optional()
});

// Schema for conversational responses with dynamic UI components
const visualConversationalResponseSchema = z.object({
  narrative: z.string(),
  thinking: z.string().optional(),
  
  visualAnalysis: z.object({
    hasImage: z.boolean(),
    imageType: z.enum(['logo', 'screenshot', 'mockup', 'reference']).optional(),
    extractedColors: z.array(z.object({
      hex: z.string(),
      name: z.string(),
      usage: z.enum(['primary', 'secondary', 'accent', 'neutral'])
    })).optional(),
    brandPersonality: z.array(z.string()).optional(),
    designStyle: z.enum(['modern', 'classic', 'minimalist', 'bold', 'playful', 'professional']).optional(),
    typography: z.object({
      suggestedFonts: z.array(z.string()),
      style: z.enum(['serif', 'sans-serif', 'script', 'display'])
    }).optional()
  }).optional(),
  
  components: z.array(z.object({
    type: z.enum(['FileUpload', 'ColorPalette', 'FontSelector', 'StylePreview', 'BrandForm', 'ToolSuggestions']),
    id: z.string(),
    props: z.record(z.any()),
    priority: z.enum(['immediate', 'next', 'optional']),
    dependencies: z.array(z.string()).optional()
  })).optional(),
  
  state: z.object({
    phase: z.enum(['discovery', 'analysis', 'refinement', 'generation']),
    waitingFor: z.array(z.string()).optional(),
    canProceed: z.boolean(),
    confidence: z.number().min(0).max(1),
    nextAction: z.string().optional()
  }),
  
  suggestions: z.array(z.object({
    action: z.string(),
    reason: z.string(),
    priority: z.enum(['high', 'medium', 'low'])
  })).optional()
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
  private visionModel: any;
  private config: any;
  private fallbackConfig: any;
  private visionConfig: any;
  
  constructor() {
    // Get model configuration from centralized config
    const primaryModel = getPrimaryModel('magicSpark');
    const fallbackModel = getFallbackModel('magicSpark');
    const visionModel = getPrimaryModel('brandAnalyzer');
    
    if (!primaryModel) {
      throw new Error('No primary model configuration found for Magic Spark');
    }
    
    this.config = primaryModel;
    this.fallbackConfig = fallbackModel;
    this.visionConfig = visionModel;
    
    // Initialize primary model
    this.model = this.createModelInstance(primaryModel.provider, primaryModel.modelInfo.id);
    
    // Initialize fallback model if available
    if (fallbackModel) {
      this.fallbackModel = this.createModelInstance(fallbackModel.provider, fallbackModel.modelInfo.id);
    }
    
    // Initialize vision model if available
    if (visionModel) {
      this.visionModel = this.createModelInstance(visionModel.provider, visionModel.modelInfo.id);
    }
    
    debugLog('Magic Spark Agent initialized', {
      primary: `${primaryModel.provider}/${primaryModel.model}`,
      fallback: fallbackModel ? `${fallbackModel.provider}/${fallbackModel.model}` : 'none',
      vision: visionModel ? `${visionModel.provider}/${visionModel.model}` : 'none'
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
   * Analyze uploaded brand assets (logo, images, etc.) using vision models
   */
  async analyzeBrandAssets(
    imageData: string, // base64 encoded image
    imageType: 'logo' | 'screenshot' | 'reference' = 'logo',
    context?: {
      businessType?: string;
      targetAudience?: string;
      industry?: string;
    }
  ): Promise<{
    colors: Array<{hex: string; name: string; usage: string; confidence: number}>;
    personality: string[];
    style: string;
    typography: {suggestedFonts: string[]; style: string};
    recommendations: string[];
    confidence: number;
    designElements?: any;
  }> {
    
    if (!this.visionModel) {
      throw new Error('No vision model available for brand analysis');
    }
    
    try {
      const prompt = `Analyze this ${imageType} and extract comprehensive brand intelligence:
      
      Context: ${context ? JSON.stringify(context) : 'No additional context provided'}
      
      Please provide detailed analysis of:
      1. Color palette - Extract 3-6 main colors with accurate hex codes and descriptive names
      2. Brand personality traits - 3-5 adjectives that describe the brand's character
      3. Design style - Overall aesthetic approach (modern, classic, minimalist, etc.)
      4. Typography recommendations - Suggest fonts that would complement this brand
      5. Strategic recommendations - How this brand should approach digital tool creation
      
      Focus on actionable insights for creating professional business tools that align with this brand identity.
      Be specific about colors (provide exact hex codes) and concrete about personality traits.`;
      
      debugLog('Analyzing brand assets with vision model', { 
        model: `${this.visionConfig.provider}/${this.visionConfig.model}`,
        imageType,
        hasContext: !!context
      });

      const { object } = await generateObject({
        model: this.visionModel,
        schema: brandAnalysisSchema,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { 
                type: 'image', 
                image: imageData
              }
            ]
          }
        ],
        temperature: this.visionConfig.config.temperature || 0.4,
        maxRetries: 2
      });

      return {
        colors: object.colors,
        personality: object.personality,
        style: object.style,
        typography: object.typography,
        recommendations: object.recommendations,
        confidence: object.confidence,
        designElements: object.designElements
      };

    } catch (error) {
      console.error('Error analyzing brand assets:', error);
      
      // Fallback to text-based analysis if vision fails
      if (this.fallbackModel && this.fallbackConfig) {
        debugLog('Vision analysis failed, attempting text-based fallback', { 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        return {
          colors: [
            { hex: '#2563eb', name: 'Primary Blue', usage: 'primary', confidence: 0.5 },
            { hex: '#64748b', name: 'Neutral Gray', usage: 'secondary', confidence: 0.5 }
          ],
          personality: ['professional', 'trustworthy', 'modern'],
          style: 'professional',
          typography: { suggestedFonts: ['Inter', 'Roboto'], style: 'sans-serif' },
          recommendations: ['Focus on clean, professional design', 'Use consistent color scheme'],
          confidence: 0.3
        };
      }
      
      throw new Error(`Failed to analyze brand assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream conversational brand discovery with dynamic UI generation
   */
  async streamBrandDiscovery(
    userInput: string,
    uploadedAssets?: Array<{
      type: 'logo' | 'screenshot' | 'reference';
      data: string; // base64
      filename: string;
    }>,
    context?: {
      businessType?: string;
      previousAnalysis?: any;
      sessionHistory?: any[];
    },
    callbacks?: {
      onNarrative?: (text: string) => void;
      onComponent?: (component: any) => void;
      onAnalysis?: (analysis: any) => void;
      onStateUpdate?: (state: any) => void;
      onComplete?: (result: any) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    
    try {
      let visualAnalysis = null;
      
      // If assets uploaded, analyze them first
      if (uploadedAssets && uploadedAssets.length > 0) {
        debugLog('Analyzing uploaded brand assets', { 
          assetCount: uploadedAssets.length,
          types: uploadedAssets.map(a => a.type)
        });
        
        for (const asset of uploadedAssets) {
          try {
            const analysis = await this.analyzeBrandAssets(
              asset.data, 
              asset.type, 
              context
            );
            visualAnalysis = analysis;
            callbacks?.onAnalysis?.(analysis);
            
            debugLog('Brand analysis completed', { 
              colors: analysis.colors.length,
              style: analysis.style,
              confidence: analysis.confidence
            });
          } catch (error) {
            console.error(`Failed to analyze asset ${asset.filename}:`, error);
            callbacks?.onError?.(new Error(`Failed to analyze ${asset.filename}`));
          }
        }
      }
      
      // Build context-aware prompt
      const contextPrompt = this.buildBrandDiscoveryPrompt(
        userInput, 
        visualAnalysis, 
        context
      );
      
      // 📋 COMPREHENSIVE PROMPT LOGGING FOR MAGIC SPARK - Added for debugging
      console.log('\n' + '='.repeat(100));
      console.log('✨ FULL MAGIC SPARK BRAND DISCOVERY PROMPT BEING SENT:');
      console.log('='.repeat(100));
      console.log(contextPrompt);
      console.log('='.repeat(100));
      console.log('✨ END MAGIC SPARK BRAND DISCOVERY PROMPT\n');
      
      debugLog('Starting brand discovery stream', {
        hasVisualAnalysis: !!visualAnalysis,
        userInputLength: userInput.length
      });
      
      // Stream conversational response with dynamic components
      const { partialObjectStream } = streamObject({
        model: this.model,
        schema: visualConversationalResponseSchema,
        prompt: contextPrompt,
        temperature: this.config.config.temperature || 0.7,
        maxRetries: 2
      });
      
      for await (const partial of partialObjectStream) {
        // Stream narrative text
        if (partial.narrative) {
          callbacks?.onNarrative?.(partial.narrative);
        }
        
        // Generate components as they become available
        if (partial.components) {
          partial.components.forEach(component => {
            callbacks?.onComponent?.(component);
          });
        }
        
        // Update state
        if (partial.state) {
          callbacks?.onStateUpdate?.(partial.state);
        }
        
        // Handle suggestions
        if (partial.suggestions) {
          // Could trigger additional UI updates
        }
      }
      
      callbacks?.onComplete?.({
        visualAnalysis,
        userInput,
        context
      });
      
    } catch (error) {
      console.error('Error in brand discovery stream:', error);
      const err = new Error(`Brand discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      callbacks?.onError?.(err);
    }
  }
  
  private buildBrandDiscoveryPrompt(
    userInput: string, 
    visualAnalysis: any, 
    context: any
  ): string {
    return `You are a brand intelligence AI helping create interactive business tools. You combine conversational guidance with dynamic UI component generation.

User Input: "${userInput}"

${visualAnalysis ? `
VISUAL ANALYSIS RESULTS:
- Colors: ${visualAnalysis.colors?.map((c: any) => `${c.name} (${c.hex})`).join(', ')}
- Style: ${visualAnalysis.style}
- Personality: ${visualAnalysis.personality?.join(', ')}
- Typography: ${visualAnalysis.typography?.style} fonts like ${visualAnalysis.typography?.suggestedFonts?.join(', ')}
- Confidence: ${Math.round((visualAnalysis.confidence || 0) * 100)}%
- Recommendations: ${visualAnalysis.recommendations?.join('; ')}
` : 'No visual assets provided yet.'}

${context ? `
CONTEXT:
- Business Type: ${context.businessType || 'Not specified'}
- Previous Analysis: ${context.previousAnalysis ? 'Available' : 'None'}
- Session History: ${context.sessionHistory?.length || 0} previous interactions
` : ''}

YOUR TASK:
1. Provide a conversational response that acknowledges their input naturally
2. If you have visual analysis, incorporate those insights seamlessly into the conversation
3. Generate appropriate UI components based on what information you need next
4. Guide them toward creating an effective business tool that matches their brand
5. Be proactive about gathering the right information through smart component generation

COMPONENT GENERATION GUIDELINES:
- FileUpload: When you need visual assets (logos, screenshots, references)
- ColorPalette: When showing extracted colors or suggesting brand colors
- BrandForm: When you need structured brand information (industry, audience, values)
- StylePreview: When demonstrating how their brand could look in a tool
- ToolSuggestions: When ready to suggest specific tool types based on their brand

CONVERSATION STYLE:
- Be enthusiastic and knowledgeable about branding and business tools
- Reference specific visual elements when available (colors, style, personality)
- Ask smart follow-up questions that help refine tool suggestions
- Show expertise in both design and business strategy
- Make the user feel confident about their brand and excited about creating tools

RESPONSE STRUCTURE:
- narrative: Natural, engaging conversation that flows from their input
- components: Smart UI components that gather needed information
- state: Current phase and what you're waiting for to proceed
- suggestions: Optional proactive suggestions for next steps

Remember: You're not just analyzing - you're having a strategic conversation about creating business tools that perfectly represent their brand.`;
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
