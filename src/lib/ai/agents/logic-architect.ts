// Enhanced Logic Architect Agent with Thinking Mode, Quality Validation, and Research Capabilities

import { generateObject, streamObject, generateText } from 'ai';
import { z } from 'zod';
import { FrameworkInput, LogicStructure, Question, ResultCategory } from '@/lib/types/ai';
import { openai } from '@ai-sdk/openai';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { generateLogicBrainstorming } from '@/lib/prompts/logic-architect-prompt';
import { PromptOptions } from '@/lib/prompts/tool-creation-prompt-modular';
import { toolQualityChecklist, ChecklistItem, QualityChecklist } from '../../config';
import { web_search } from '../web-search';

// Schema for quality validation scoring
const qualityScoreSchema = z.object({
  scores: z.record(z.number()), // Checklist item ID -> score
  overallScore: z.number(),
  improvementNeeded: z.boolean(),
  suggestions: z.array(z.string()),
  researchNeeded: z.boolean(),
  researchTopics: z.array(z.string()).optional()
});

// Schema for research results
const researchResultSchema = z.object({
  topic: z.string(),
  findings: z.string(),
  relevantData: z.any().optional(),
  insights: z.array(z.string())
});

// Schema for brainstorming output with PromptOptions
const logicBrainstormingSchema = z.object({
  coreConcept: z.string(),
  keyCalculations: z.array(z.object({
    name: z.string(),
    formula: z.string(),
    description: z.string(),
    variables: z.array(z.string())
  })),
  interactionFlow: z.array(z.object({
    step: z.number(),
    title: z.string(),
    description: z.string(),
    userAction: z.string(),
    engagementHook: z.string().optional()
  })),
  valueProposition: z.string(),
  leadCaptureStrategy: z.object({
    timing: z.string(),
    method: z.string(),
    incentive: z.string()
  }),
  creativeEnhancements: z.array(z.string()),
  suggestedInputs: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string()
  })),
  calculationLogic: z.array(z.object({
    id: z.string(),
    name: z.string(),
    formula: z.string(),
    dependencies: z.array(z.string()),
    outputFormat: z.string(),
    engagementMoment: z.string().optional()
  })),
  // NEW: AI-determined prompt options for optimal tool generation
  promptOptions: z.object({
    includeComprehensiveColors: z.boolean(),
    includeGorgeousStyling: z.boolean(),
    includeAdvancedLayouts: z.boolean(),
    styleComplexity: z.enum(['basic', 'enhanced', 'premium']),
    industryFocus: z.string().optional(),
    toolComplexity: z.enum(['simple', 'moderate', 'complex'])
  })
});

// Simplified schemas that match the existing interfaces
const logicStructureSchema = z.object({
  framework: z.object({
    methodology: z.string(),
    steps: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      order: z.number(),
      questions: z.array(z.string()),
      weight: z.number().optional()
    })),
    scoringSystem: z.object({
      type: z.enum(['points', 'weighted', 'categorical', 'custom']),
      maxScore: z.number().optional(),
      weights: z.record(z.number()).optional(),
      formula: z.string().optional()
    })
  }),
  questions: z.array(z.any()), // Use any to avoid complex schema alignment
  resultCategories: z.array(z.any()), // Use any to avoid complex schema alignment
  metadata: z.record(z.any())
});

const scoringSystemSchema = z.object({
  type: z.enum(['simple-sum', 'weighted-sum', 'average', 'custom']),
  weights: z.record(z.number()).optional(),
  maxScore: z.number().optional(),
  passingScore: z.number().optional(),
  formula: z.string().optional(),
  categories: z.array(z.string()),
  methodology: z.string(),
  explanation: z.string()
});

const branchingLogicSchema = z.object({
  branches: z.array(z.object({
    fromQuestionId: z.string(),
    conditions: z.array(z.object({
      questionId: z.string(),
      operator: z.enum(['equals', 'not-equals', 'greater-than', 'less-than', 'contains', 'not-contains']),
      value: z.any()
    })),
    toQuestionId: z.string(),
    operator: z.enum(['AND', 'OR'])
  }))
});

export class LogicArchitectAgent {
  private model: any;
  private provider: 'openai' | 'anthropic';
  private qualityChecklist: QualityChecklist;
  
  constructor(provider: 'openai' | 'anthropic' = 'anthropic') {
    this.provider = provider;
    this.model = provider === 'openai' 
      ? openai('gpt-4-turbo-preview')
      : anthropic('claude-3-7-sonnet-20250219');
    this.qualityChecklist = toolQualityChecklist;
  }

  /**
   * Enhanced brainstormToolLogic with thinking mode, validation, and research
   * Maintains exact same output format for compatibility
   */
  async brainstormToolLogic(
    toolType: string,
    targetAudience: string,
    industry: string,
    businessContext: string,
    availableData: any,
    outputFormat: 'v1' | 'v2' = 'v2'
  ): Promise<any> {
    try {
      console.log(`🧠 Enhanced Logic Architect brainstorming with thinking mode: ${outputFormat}`);
      
      // Step 1: Generate initial brainstorm using thinking mode
      let currentBrainstorm = await this.generateInitialBrainstorm(
        toolType, targetAudience, industry, businessContext, availableData
      );
      
      // Step 2: Iterative validation and improvement (max 3 iterations)
      let iteration = 0;
      const maxIterations = this.qualityChecklist.iterationGuidelines.maxIterations || 3;
      
      while (iteration < maxIterations) {
        iteration++;
        console.log(`🔍 Quality validation iteration ${iteration}/${maxIterations}`);
        
        // Validate against quality checklist
        const qualityScore = await this.validateQuality(currentBrainstorm, toolType, targetAudience);
        
        if (!qualityScore.improvementNeeded) {
          console.log(`✅ Quality validation passed on iteration ${iteration}`);
          break;
        }
        
        // Conduct research if needed
        if (qualityScore.researchNeeded && qualityScore.researchTopics) {
          console.log(`🔬 Conducting research on: ${qualityScore.researchTopics.join(', ')}`);
          const researchResults = await this.conductResearch(qualityScore.researchTopics, toolType, industry);
          currentBrainstorm = await this.improveBrainstormWithResearch(
            currentBrainstorm, qualityScore.suggestions, researchResults
          );
        } else {
          // Improve without research
          currentBrainstorm = await this.improveBrainstorm(currentBrainstorm, qualityScore.suggestions);
        }
      }
      
      console.log('✅ Enhanced Logic Architect brainstorming complete:', currentBrainstorm.coreConcept);
      
      // Return in requested format (maintaining compatibility)
      if (outputFormat === 'v1') {
        return this.formatAsV1(currentBrainstorm, toolType, targetAudience, industry, businessContext);
      } else {
        return this.formatAsV2(currentBrainstorm, toolType, targetAudience, industry, businessContext);
      }

    } catch (error) {
      console.error('❌ Enhanced Logic brainstorming failed:', error);
      const fallbackResult = this.getFallbackBrainstormingResult(toolType, targetAudience, industry);
      
      if (outputFormat === 'v1') {
        return this.formatAsV1(fallbackResult, toolType, targetAudience, industry, businessContext);
      } else {
        return this.formatAsV2(fallbackResult, toolType, targetAudience, industry, businessContext);
      }
    }
  }

  /**
   * Generate initial brainstorm using thinking mode
   */
  private async generateInitialBrainstorm(
    toolType: string,
    targetAudience: string,
    industry: string,
    businessContext: string,
    availableData: any
  ): Promise<any> {
    const prompt = generateLogicBrainstorming(
      toolType,
      targetAudience,
      industry,
      businessContext,
      availableData
    );

    // Use thinking mode for deep reasoning
    const { text, reasoning } = await generateText({
      model: this.model,
      prompt: `${prompt}\n\nThink deeply about this tool concept and return a JSON object matching the required schema.`,
      providerOptions: {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: 12000 },
        } satisfies AnthropicProviderOptions,
      },
    });

    console.log('🤔 Thinking process length:', reasoning?.length || 0);
    
    // Parse the JSON response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }
    
    const brainstormData = JSON.parse(jsonMatch[0].replace(/```json\s*|\s*```/g, ''));
    return this.postProcessBrainstormingResult(brainstormData);
  }

  /**
   * Validate brainstorm against quality checklist
   */
  private async validateQuality(brainstorm: any, toolType: string, targetAudience: string): Promise<any> {
    const checklistPrompt = `
Evaluate this tool brainstorm against the quality checklist:

TOOL BRAINSTORM:
${JSON.stringify(brainstorm, null, 2)}

QUALITY CHECKLIST:
${this.qualityChecklist.checklistItems.map(item => `
${item.id}: ${item.title}
Description: ${item.description}
Weight: ${item.weight}
Criteria: ${item.evaluationCriteria.join(', ')}
`).join('\n')}

Rate each checklist item from 1-10 and provide overall assessment.
Determine if research is needed for niche topics or industry-specific insights.

Return a JSON object with:
- scores: {itemId: score} for each checklist item
- overallScore: weighted average
- improvementNeeded: boolean (true if overall < ${this.qualityChecklist.scoringSystem.passingThreshold})
- suggestions: array of specific improvement suggestions
- researchNeeded: boolean
- researchTopics: array of topics that need research (if researchNeeded is true)
`;

    const { object } = await generateObject({
      model: this.model,
      schema: qualityScoreSchema,
      prompt: checklistPrompt,
      temperature: 0.3
    });

    return object;
  }

  /**
   * Conduct research using web search
   */
  private async conductResearch(topics: string[], toolType: string, industry: string): Promise<any[]> {
    const researchResults = [];
    
    for (const topic of topics) {
      try {
        const searchTerm = `${industry} ${toolType} ${topic} best practices current trends 2024`;
        console.log(`🔬 Researching: ${searchTerm}`);
        
        const findings = await web_search({
          search_term: searchTerm,
          explanation: `Research for ${toolType} tool in ${industry} industry regarding ${topic}`,
          domain: this.mapIndustryToDomain(industry)
        });
        
        researchResults.push({
          topic,
          findings: findings || 'No research results available',
          insights: this.extractInsights(findings || '', topic)
        });
      } catch (error) {
        console.error(`❌ Research failed for topic ${topic}:`, error);
        researchResults.push({
          topic,
          findings: 'Research unavailable',
          insights: []
        });
      }
    }
    
    return researchResults;
  }

  /**
   * Map industry to domain for web search context
   */
  private mapIndustryToDomain(industry: string): string {
    const industryMapping: Record<string, string> = {
      'solar': 'solar',
      'renewable energy': 'solar',
      'energy': 'solar',
      'finance': 'finance',
      'financial': 'finance',
      'banking': 'finance',
      'investment': 'finance',
      'tax': 'tax',
      'taxation': 'tax',
      'accounting': 'tax',
      'real estate': 'real_estate',
      'property': 'real_estate',
      'housing': 'real_estate',
      'healthcare': 'healthcare',
      'medical': 'healthcare',
      'health': 'healthcare',
      'business': 'business',
      'corporate': 'business',
      'consulting': 'business'
    };
    
    const lowerIndustry = industry.toLowerCase();
    return industryMapping[lowerIndustry] || 'business';
  }

  /**
   * Extract key insights from research findings
   */
  private extractInsights(findings: string, topic: string): string[] {
    // Simple insight extraction (could be enhanced with AI)
    const insights = [];
    
    if (findings.toLowerCase().includes('trend')) {
      insights.push('Current industry trends identified');
    }
    if (findings.toLowerCase().includes('best practice')) {
      insights.push('Best practices discovered');
    }
    if (findings.toLowerCase().includes('data') || findings.toLowerCase().includes('metric')) {
      insights.push('Relevant data points found');
    }
    
    return insights.length > 0 ? insights : ['General industry information available'];
  }

  /**
   * Improve brainstorm with research insights
   */
  private async improveBrainstormWithResearch(
    brainstorm: any,
    suggestions: string[],
    researchResults: any[]
  ): Promise<any> {
    const improvementPrompt = `
Improve this tool brainstorm using the research insights and suggestions:

CURRENT BRAINSTORM:
${JSON.stringify(brainstorm, null, 2)}

IMPROVEMENT SUGGESTIONS:
${suggestions.join('\n- ')}

RESEARCH FINDINGS:
${researchResults.map(r => `
Topic: ${r.topic}
Findings: ${r.findings.substring(0, 500)}...
Insights: ${r.insights.join(', ')}
`).join('\n')}

Enhance the brainstorm by incorporating research insights while maintaining the exact same JSON structure.
Focus on making the tool more valuable, unique, and industry-relevant.
`;

    const { object } = await generateObject({
      model: this.model,
      schema: logicBrainstormingSchema,
      prompt: improvementPrompt,
      temperature: 0.4
    });

    return this.postProcessBrainstormingResult(object);
  }

  /**
   * Improve brainstorm without research
   */
  private async improveBrainstorm(brainstorm: any, suggestions: string[]): Promise<any> {
    const improvementPrompt = `
Improve this tool brainstorm based on the suggestions:

CURRENT BRAINSTORM:
${JSON.stringify(brainstorm, null, 2)}

IMPROVEMENT SUGGESTIONS:
${suggestions.join('\n- ')}

Enhance the brainstorm while maintaining the exact same JSON structure.
Focus on addressing the suggestions to improve quality and user value.
`;

    const { object } = await generateObject({
      model: this.model,
      schema: logicBrainstormingSchema,
      prompt: improvementPrompt,
      temperature: 0.4
    });

    return this.postProcessBrainstormingResult(object);
  }

  /**
   * Build comprehensive framework structure
   */
  async buildFramework(input: FrameworkInput): Promise<LogicStructure> {
    try {
      const prompt = `Create a comprehensive framework for a ${input.toolType} tool.

Input Details:
- Tool Type: ${input.toolType}
- Expertise Area: ${input.expertise}
- Target Audience: ${input.targetAudience}
- Goals: ${input.goals.join(', ')}
- Methodology: ${input.methodology || 'Best practices approach'}

Build a complete framework including:
1. Methodology and theoretical foundation
2. Step-by-step process (4-6 logical steps)
3. Scoring system appropriate for the tool type
4. 8-12 strategic questions aligned with the methodology
5. 3-5 meaningful result categories with score ranges
6. Validation rules and question flow

Ensure the framework is:
- Scientifically sound and practical
- Appropriate for the target audience
- Aligned with stated goals
- Implementable within 10-15 minutes completion time`;

      const { object } = await generateObject({
        model: this.model,
        schema: logicStructureSchema,
        prompt,
        temperature: 0.5,
        maxRetries: 3
      });

      return object as LogicStructure;

    } catch (error) {
      console.error('Error building framework:', error);
      throw new Error(`Failed to build framework: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate questions based on framework
   */
  async generateQuestions(
    framework: any,
    targetAudience: string,
    complexity: string
  ): Promise<Question[]> {
    try {
      const prompt = `Generate strategic questions for this framework:

Framework: ${JSON.stringify(framework, null, 2)}
Target Audience: ${targetAudience}
Complexity Level: ${complexity}

Create 8-12 questions that:
1. Cover all framework steps comprehensively
2. Are appropriate for ${complexity} complexity level
3. Use language suitable for ${targetAudience}
4. Include proper validation rules
5. Have clear scoring mechanisms
6. Flow logically from general to specific

Question types to include:
- Multiple choice (3-5 options)
- Scale questions (1-5 or 1-10)
- Text input where appropriate
- Boolean (yes/no) for key decisions

Return as a JSON array of question objects.`;

      const questionsSchema = z.object({
        questions: z.array(z.any())
      });

      const { object } = await generateObject({
        model: this.model,
        schema: questionsSchema,
        prompt,
        temperature: 0.6,
        maxRetries: 3
      });

      return object.questions as Question[];

    } catch (error) {
      console.error('Error generating questions:', error);
      throw new Error(`Failed to generate questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Design scoring system
   */
  async designScoringSystem(
    toolType: string,
    questions: Question[],
    methodology: string
  ): Promise<any> {
    try {
      const prompt = `Design a scoring system for a ${toolType} tool.

Questions to score: ${JSON.stringify(questions, null, 2)}
Methodology: ${methodology}

Create a scoring system that:
1. Matches the tool type and methodology
2. Provides meaningful differentiation
3. Is easy to understand and calculate
4. Aligns with user expectations
5. Enables clear result interpretation

Include:
- Scoring method (simple-sum, weighted-sum, average, custom)
- Weight assignments if applicable
- Score ranges and thresholds
- Clear explanation of the methodology`;

      const { object } = await generateObject({
        model: this.model,
        schema: scoringSystemSchema,
        prompt,
        temperature: 0.4,
        maxRetries: 3
      });

      return object;

    } catch (error) {
      console.error('Error designing scoring system:', error);
      throw new Error(`Failed to design scoring system: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create result categories
   */
  async createResultCategories(
    scoringSystem: any,
    targetAudience: string,
    goals: string[]
  ): Promise<ResultCategory[]> {
    try {
      const prompt = `Create result categories for this scoring system:

Scoring System: ${JSON.stringify(scoringSystem, null, 2)}
Target Audience: ${targetAudience}
Goals: ${goals.join(', ')}

Create 3-5 meaningful result categories that:
1. Cover the full score range logically
2. Are relevant to the target audience
3. Align with the stated goals
4. Provide actionable insights
5. Use appropriate language and tone

Each category should include:
- Name and description
- Score range
- Key characteristics
- Recommended actions
- Motivational messaging`;

      const categoriesSchema = z.object({
        categories: z.array(z.any())
      });

      const { object } = await generateObject({
        model: this.model,
        schema: categoriesSchema,
        prompt,
        temperature: 0.6,
        maxRetries: 3
      });

      return object.categories as ResultCategory[];

    } catch (error) {
      console.error('Error creating result categories:', error);
      throw new Error(`Failed to create result categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate framework
   */
  async validateFramework(framework: LogicStructure): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      const prompt = `Validate this framework for logical consistency and completeness:

Framework: ${JSON.stringify(framework, null, 2)}

Check for:
1. Logical flow and consistency
2. Complete coverage of the topic
3. Appropriate complexity and depth
4. Clear scoring methodology
5. Practical implementability
6. User experience considerations

Return validation results with specific issues found and improvement suggestions.`;

      const validationSchema = z.object({
        isValid: z.boolean(),
        issues: z.array(z.string()),
        suggestions: z.array(z.string())
      });

      const { object } = await generateObject({
        model: this.model,
        schema: validationSchema,
        prompt,
        temperature: 0.3,
        maxRetries: 3
      });

      return object;

    } catch (error) {
      console.error('Error validating framework:', error);
      return {
        isValid: false,
        issues: ['Validation failed due to system error'],
        suggestions: ['Review framework manually and retry validation']
      };
    }
  }

  /**
   * Optimize framework
   */
  async optimizeFramework(
    framework: LogicStructure,
    optimizationGoals: string[]
  ): Promise<LogicStructure> {
    try {
      const prompt = `Optimize this framework based on the specified goals:

Current Framework: ${JSON.stringify(framework, null, 2)}
Optimization Goals: ${optimizationGoals.join(', ')}

Enhance the framework to better achieve these goals while maintaining:
- Logical consistency
- Practical usability
- Scientific validity
- User engagement

Return the optimized framework with the same structure.`;

      const { object } = await generateObject({
        model: this.model,
        schema: logicStructureSchema,
        prompt,
        temperature: 0.5,
        maxRetries: 3
      });

      return object as LogicStructure;

    } catch (error) {
      console.error('Error optimizing framework:', error);
      throw new Error(`Failed to optimize framework: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate branching logic
   */
  async generateBranchingLogic(
    questions: Question[],
    complexity: string
  ): Promise<any[]> {
    try {
      const prompt = `Generate branching logic for these questions:

Questions: ${JSON.stringify(questions, null, 2)}
Complexity Level: ${complexity}

Create conditional flows that:
1. Guide users through relevant questions
2. Skip irrelevant sections based on answers
3. Provide personalized question paths
4. Maintain logical progression
5. Enhance user experience

Use AND/OR logic with appropriate conditions.`;

      const { object } = await generateObject({
        model: this.model,
        schema: branchingLogicSchema,
        prompt,
        temperature: 0.4,
        maxRetries: 3
      });

      return object.branches;

    } catch (error) {
      console.error('Error generating branching logic:', error);
      return [];
    }
  }

  /**
   * Create custom formulas
   */
  async createCustomFormulas(
    toolType: string,
    methodology: string,
    variables: string[]
  ): Promise<any[]> {
    try {
      const prompt = `Create custom formulas for a ${toolType} tool using ${methodology} methodology.

Available Variables: ${variables.join(', ')}

Create formulas that:
1. Are mathematically sound
2. Reflect the methodology principles
3. Use available variables appropriately
4. Provide meaningful calculations
5. Are implementable in code

Include formula explanation and implementation guidance.`;

      const formulasSchema = z.object({
        formulas: z.array(z.object({
          name: z.string(),
          formula: z.string(),
          variables: z.array(z.string()),
          explanation: z.string(),
          implementation: z.string()
        }))
      });

      const { object } = await generateObject({
        model: this.model,
        schema: formulasSchema,
        prompt,
        temperature: 0.4,
        maxRetries: 3
      });

      return object.formulas;

    } catch (error) {
      console.error('Error creating custom formulas:', error);
      return [];
    }
  }

  /**
   * Stream framework building (legacy compatibility)
   */
  async streamFrameworkBuilding(
    input: FrameworkInput,
    onPartialFramework?: (partial: any) => void,
    onComplete?: (framework: LogicStructure) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const framework = await this.buildFramework(input);
      onPartialFramework?.(framework);
      onComplete?.(framework);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Stream brainstorming (legacy compatibility)
   */
  async brainstormToolLogicStream(
    toolType: string,
    targetAudience: string, 
    industry: string,
    businessContext: string,
    availableData: any,
    onPartialLogic?: (partial: any) => void,
    onComplete?: (logic: any) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const result = await this.brainstormToolLogic(
        toolType, targetAudience, industry, businessContext, availableData
      );
      onPartialLogic?.(result);
      onComplete?.(result);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Format as V1 (legacy format) - UNCHANGED
   */
  private formatAsV1(
    brainstormData: any,
    toolType: string,
    targetAudience: string,
    industry: string,
    businessContext: string
  ): any {
    console.log('🔄 [V1-FORMAT] Creating legacy format result');
    
    const v1Result = {
      ...brainstormData,
      coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept || 'Business tool',
      valueProposition: brainstormData.valueProposition || 'Provides value to users',
      keyCalculations: brainstormData.keyCalculations || [],
      interactionFlow: brainstormData.interactionFlow || [],
      leadCaptureStrategy: brainstormData.leadCaptureStrategy || {
        timing: 'after_completion',
        method: 'email_signup',
        incentive: 'Save and share results'
      },
      creativeEnhancements: brainstormData.creativeEnhancements || [],
      suggestedInputs: brainstormData.suggestedInputs || [],
      calculationLogic: brainstormData.calculationLogic || [],
      promptOptions: brainstormData.promptOptions || {
        includeComprehensiveColors: true,
        includeGorgeousStyling: true,
        includeAdvancedLayouts: false,
        styleComplexity: 'enhanced',
        industryFocus: industry || undefined,
        toolComplexity: 'moderate'
      },
      
      _formatVersion: 'v1',
      _generatedAt: new Date().toISOString()
    };
    
    console.log('✅ [V1-FORMAT] Created legacy format with keys:', Object.keys(v1Result));
    return v1Result;
  }

  /**
   * Format as V2 (BrainstormDataSchema format) - UNCHANGED
   */
  private formatAsV2(
    brainstormData: any,
    toolType: string,
    targetAudience: string,
    industry: string,
    businessContext: string
  ): any {
    console.log('🔄 [V2-FORMAT] Creating structured V2 format result');
    
    const v2Result = {
      coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept || 'Business tool',
      valueProposition: brainstormData.valueProposition || 'Provides value to users',
      keyCalculations: brainstormData.keyCalculations || [],
      interactionFlow: brainstormData.interactionFlow || [],
      leadCaptureStrategy: brainstormData.leadCaptureStrategy || {
        timing: 'after_completion',
        method: 'email_signup',
        incentive: 'Save and share results'
      },
      creativeEnhancements: brainstormData.creativeEnhancements || [],
      suggestedInputs: brainstormData.suggestedInputs || [],
      calculationLogic: brainstormData.calculationLogic || [],
      promptOptions: brainstormData.promptOptions || {
        includeComprehensiveColors: true,
        includeGorgeousStyling: true,
        includeAdvancedLayouts: false,
        styleComplexity: 'enhanced',
        industryFocus: industry || undefined,
        toolComplexity: 'moderate'
      },
      
      _formatVersion: 'v2',
      _generatedAt: new Date().toISOString()
    };
    
    console.log('✅ [V2-FORMAT] Created V2 format with keys:', Object.keys(v2Result));
    return v2Result;
  }

  /**
   * Post-process brainstorming results - UNCHANGED
   */
  private postProcessBrainstormingResult(object: any): any {
    const result = { ...object };

    if (typeof result.creativeEnhancements === 'string') {
      try {
        const parsed = JSON.parse(result.creativeEnhancements);
        if (Array.isArray(parsed)) {
          result.creativeEnhancements = parsed;
          console.log('🔧 Fixed creativeEnhancements from string to array');
        }
      } catch (e) {
        const stringContent = result.creativeEnhancements;
        if (stringContent.includes('[') && stringContent.includes(']')) {
          try {
            const arrayContent = stringContent
              .replace(/^\s*\[\s*/, '')
              .replace(/\s*\]\s*$/, '')
              .split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line.length > 0)
              .map((line: string) => {
                return line
                  .replace(/^["'`]*/, '')
                  .replace(/["'`]*[,]*$/, '')
                  .trim();
              })
              .filter((item: string) => item.length > 0);
            
            if (arrayContent.length > 0) {
              result.creativeEnhancements = arrayContent;
              console.log('🔧 Extracted creativeEnhancements from string format');
            }
          } catch (e2) {
            console.log('⚠️ Could not parse creativeEnhancements, keeping as string');
          }
        }
      }
    }

    if (!Array.isArray(result.creativeEnhancements)) {
      result.creativeEnhancements = ['Interactive visual feedback', 'Real-time calculations', 'Professional result presentation'];
      console.log('🔧 Applied fallback creativeEnhancements array');
    }

    return result;
  }

  /**
   * Fallback brainstorming result - UNCHANGED
   */
  private getFallbackBrainstormingResult(toolType: string, targetAudience: string, industry: string): any {
    return {
      coreConcept: `${toolType} Assessment Tool`,
      valueProposition: `Helps ${targetAudience} make informed decisions about ${toolType.toLowerCase()} with personalized insights and recommendations.`,
      keyCalculations: [
        {
          name: 'Overall Score',
          formula: 'Sum of weighted responses',
          description: 'Comprehensive assessment score',
          variables: ['user_responses', 'weights']
        }
      ],
      interactionFlow: [
        {
          step: 1,
          title: 'Welcome',
          description: 'Introduction and purpose explanation',
          userAction: 'Read and proceed',
          engagementHook: 'Discover insights tailored to your needs'
        },
        {
          step: 2,
          title: 'Assessment',
          description: 'Answer questions about your situation',
          userAction: 'Complete questionnaire',
          engagementHook: 'Help us understand your unique context'
        },
        {
          step: 3,
          title: 'Results',
          description: 'View personalized recommendations',
          userAction: 'Review insights',
          engagementHook: 'Get your customized action plan'
        }
      ],
      leadCaptureStrategy: {
        timing: 'before_results',
        method: 'email_signup',
        incentive: 'detailed_report'
      },
      creativeEnhancements: [
        'Progressive disclosure of insights',
        'Interactive result visualization',
        'Personalized recommendations'
      ],
      suggestedInputs: [
        {
          id: 'primary_goal',
          label: 'Primary Goal',
          type: 'select',
          required: true,
          description: 'What is your main objective?'
        }
      ],
      calculationLogic: [
        {
          id: 'assessment_score',
          name: 'Assessment Score',
          formula: 'weighted_sum(responses)',
          dependencies: ['user_responses'],
          outputFormat: 'percentage',
          engagementMoment: 'Result reveal with explanation'
        }
      ],
      promptOptions: {
        includeComprehensiveColors: true,
        includeGorgeousStyling: true,
        includeAdvancedLayouts: false,
        styleComplexity: 'enhanced',
        industryFocus: industry || undefined,
        toolComplexity: 'moderate'
      }
    };
  }
}

// TODO: Add error handling and retry logic
// TODO: Implement streaming responses for real-time feedback
// TODO: Add framework templates for common use cases
// TODO: Implement framework versioning and rollback
// TODO: Add analytics for framework performance tracking 