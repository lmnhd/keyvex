// TODO: Implement Logic Architect Agent for framework definition (15-20 seconds)

import { generateObject, streamObject } from 'ai';
import { z } from 'zod';
import { FrameworkInput, LogicStructure, Question, ResultCategory } from '@/lib/types/ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateLogicBrainstorming } from '@/lib/prompts/logic-architect-prompt';
import { PromptOptions } from '@/lib/prompts/tool-creation-prompt-modular';

// Schema for brainstorming output with PromptOptions
const logicBrainstormingSchema = z.object({
  coreWConcept: z.string(),
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
  
  constructor(provider: 'openai' | 'anthropic' = 'anthropic') {
    this.provider = provider;
    this.model = provider === 'openai' 
      ? openai('gpt-4-turbo-preview')
      : anthropic('claude-3-5-sonnet-20240620');
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
        maxRetries: 2
      });

      return object.questions as Question[];

    } catch (error) {
      console.error('Error generating questions:', error);
      throw new Error(`Failed to generate questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Design scoring system for the tool
   */
  async designScoringSystem(
    toolType: string,
    questions: Question[],
    methodology: string
  ): Promise<any> {
    try {
      const prompt = `Design an optimal scoring system for this tool:

Tool Type: ${toolType}
Methodology: ${methodology}
Number of Questions: ${questions.length}

Create a scoring system that:
1. Aligns with the ${methodology} methodology
2. Provides meaningful differentiation between results
3. Is appropriate for a ${toolType} tool
4. Accounts for question types and importance
5. Produces actionable score ranges

Return a JSON object with the scoring configuration.`;

      const scoringSchema = z.object({
        type: z.string(),
        maxScore: z.number().optional(),
        methodology: z.string(),
        categories: z.array(z.string()),
        weights: z.record(z.number()).optional(),
        formula: z.string().optional()
      });

      const { object } = await generateObject({
        model: this.model,
        schema: scoringSchema,
        prompt,
        temperature: 0.4,
        maxRetries: 2
      });

      return object;

    } catch (error) {
      console.error('Error designing scoring system:', error);
      throw new Error(`Failed to design scoring system: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create result categories and descriptions
   */
  async createResultCategories(
    scoringSystem: any,
    targetAudience: string,
    goals: string[]
  ): Promise<ResultCategory[]> {
    try {
      const prompt = `Create meaningful result categories for this scoring system:

Scoring System: ${JSON.stringify(scoringSystem, null, 2)}
Target Audience: ${targetAudience}
Goals: ${goals.join(', ')}

Create 3-5 result categories that provide actionable insights.
Return as a JSON array of category objects.`;

      const categoriesSchema = z.object({
        categories: z.array(z.any())
      });

      const { object } = await generateObject({
        model: this.model,
        schema: categoriesSchema,
        prompt,
        temperature: 0.6,
        maxRetries: 2
      });

      return object.categories as ResultCategory[];

    } catch (error) {
      console.error('Error creating result categories:', error);
      throw new Error(`Failed to create result categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate framework logic and consistency
   */
  async validateFramework(framework: LogicStructure): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      const prompt = `Validate this framework for logical consistency:

Framework: ${JSON.stringify(framework, null, 2)}

Check for issues and provide suggestions for improvement.
Return a JSON object with validation results.`;

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
        maxRetries: 2
      });

      return object;

    } catch (error) {
      console.error('Error validating framework:', error);
      throw new Error(`Failed to validate framework: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimize framework for better user experience
   */
  async optimizeFramework(
    framework: LogicStructure,
    optimizationGoals: string[]
  ): Promise<LogicStructure> {
    try {
      const prompt = `Optimize this framework based on goals: ${optimizationGoals.join(', ')}

Current Framework: ${JSON.stringify(framework, null, 2)}

Return an optimized version of the framework.`;

      const { object } = await generateObject({
        model: this.model,
        schema: logicStructureSchema,
        prompt,
        temperature: 0.5,
        maxRetries: 2
      });

      return object as LogicStructure;

    } catch (error) {
      console.error('Error optimizing framework:', error);
      throw new Error(`Failed to optimize framework: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate branching logic for complex tools
   */
  async generateBranchingLogic(
    questions: Question[],
    complexity: string
  ): Promise<any[]> {
    try {
      const prompt = `Create branching logic for these questions based on ${complexity} complexity.
      
Questions: ${JSON.stringify(questions, null, 2)}

Return a JSON array of branching rules.`;

      const branchingSchema = z.object({
        branches: z.array(z.any())
      });

      const { object } = await generateObject({
        model: this.model,
        schema: branchingSchema,
        prompt,
        temperature: 0.6,
        maxRetries: 2
      });

      return object.branches;

    } catch (error) {
      console.error('Error generating branching logic:', error);
      throw new Error(`Failed to generate branching logic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create custom formulas for advanced calculations
   */
  async createCustomFormulas(
    toolType: string,
    methodology: string,
    variables: string[]
  ): Promise<any[]> {
    try {
      const prompt = `Create custom calculation formulas for a ${toolType} tool using ${methodology} methodology.

Available Variables: ${variables.join(', ')}

Return a JSON array of formula objects.`;

      const formulaSchema = z.object({
        formulas: z.array(z.any())
      });

      const { object } = await generateObject({
        model: this.model,
        schema: formulaSchema,
        prompt,
        temperature: 0.4,
        maxRetries: 2
      });

      return object.formulas;

    } catch (error) {
      console.error('Error creating custom formulas:', error);
      throw new Error(`Failed to create custom formulas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream framework building for real-time updates
   */
  async streamFrameworkBuilding(
    input: FrameworkInput,
    onPartialFramework?: (partial: any) => void,
    onComplete?: (framework: LogicStructure) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const prompt = `Create a comprehensive framework for a ${input.toolType} tool...`;

      const { partialObjectStream } = streamObject({
        model: this.model,
        schema: logicStructureSchema,
        prompt,
        temperature: 0.5,
        onError: onError ? (event) => onError(new Error(String(event.error))) : undefined
      });

      for await (const partialObject of partialObjectStream) {
        onPartialFramework?.(partialObject);
      }

    } catch (error) {
      const err = new Error(`Framework streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onError?.(err);
    }
  }

  /**
   * Brainstorm creative tool logic with high temperature for maximum creativity
   */
  async brainstormToolLogic(
    toolType: string,
    targetAudience: string,
    industry: string,
    businessContext: string,
    availableData: any
  ): Promise<any> {
    try {
      const prompt = generateLogicBrainstorming(
        toolType,
        targetAudience,
        industry,
        businessContext,
        availableData
      );

      console.log('🧠 Logic Architect brainstorming with prompt:', prompt.slice(0, 1200) + '...');

      const { object } = await generateObject({
        model: this.model,
        schema: logicBrainstormingSchema,
        prompt,
        temperature: 0.6,
        maxRetries: 3,
        maxTokens: 4000,
      });

      // POST-PROCESSING: Fix any string arrays that should be actual arrays
      const processedObject = this.postProcessBrainstormingResult(object);

      console.log('✅ Logic Architect brainstorming complete:', processedObject.coreWConcept);
      return processedObject;

    } catch (error) {
      console.error('❌ Logic brainstorming failed:', error);
      
      if (error instanceof Error && error.message.includes('JSON')) {
        console.log('🔧 JSON parsing failed, providing fallback brainstorming result');
        return this.getFallbackBrainstormingResult(toolType, targetAudience, industry);
      }
      
      throw new Error(`Logic brainstorming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Post-process brainstorming results to handle schema validation issues
   */
  private postProcessBrainstormingResult(object: any): any {
    const result = { ...object };

    // Fix creativeEnhancements if it's a string representation of an array
    if (typeof result.creativeEnhancements === 'string') {
      try {
        const parsed = JSON.parse(result.creativeEnhancements);
        if (Array.isArray(parsed)) {
          result.creativeEnhancements = parsed;
          console.log('🔧 Fixed creativeEnhancements from string to array');
        }
      } catch (e) {
        // If parsing fails, try to extract array-like content from string
        const stringContent = result.creativeEnhancements;
        if (stringContent.includes('[') && stringContent.includes(']')) {
          try {
            // Extract content between brackets and split by lines
            const arrayContent = stringContent
              .replace(/^\s*\[\s*/, '')  // Remove opening bracket
              .replace(/\s*\]\s*$/, '')  // Remove closing bracket
              .split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line.length > 0)
              .map((line: string) => {
                // Remove quotes and leading/trailing punctuation
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
            console.warn('⚠️ Could not parse creativeEnhancements, using fallback');
            result.creativeEnhancements = ['Creative enhancement ideas will be added'];
          }
        } else {
          // Fallback: convert single string to array
          result.creativeEnhancements = [result.creativeEnhancements];
          console.log('🔧 Converted single creativeEnhancements string to array');
        }
      }
    }

    // Ensure all required arrays are arrays
    if (!Array.isArray(result.creativeEnhancements)) {
      result.creativeEnhancements = [];
    }

    if (!Array.isArray(result.keyCalculations)) {
      result.keyCalculations = [];
    }

    if (!Array.isArray(result.interactionFlow)) {
      result.interactionFlow = [];
    }

    if (!Array.isArray(result.suggestedInputs)) {
      result.suggestedInputs = [];
    }

    if (!Array.isArray(result.calculationLogic)) {
      result.calculationLogic = [];
    }

    // 🎯 NEW: Ensure promptOptions has proper defaults if missing or incomplete
    if (!result.promptOptions || typeof result.promptOptions !== 'object') {
      console.log('🔧 Adding default promptOptions to brainstorming result');
      result.promptOptions = {
        includeComprehensiveColors: false,
        includeGorgeousStyling: false,
        includeAdvancedLayouts: false,
        styleComplexity: 'basic',
        toolComplexity: 'moderate'
      };
    } else {
      // Fill in any missing promptOptions fields with defaults
      const defaults = {
        includeComprehensiveColors: false,
        includeGorgeousStyling: false,
        includeAdvancedLayouts: false,
        styleComplexity: 'basic',
        toolComplexity: 'moderate'
      };
      
      for (const [key, defaultValue] of Object.entries(defaults)) {
        if (result.promptOptions[key] === undefined || result.promptOptions[key] === null) {
          result.promptOptions[key] = defaultValue;
          console.log(`🔧 Added default value for promptOptions.${key}: ${defaultValue}`);
        }
      }
    }

    return result;
  }

  /**
   * Stream brainstorming for real-time feedback
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
      const prompt = generateLogicBrainstorming(
        toolType,
        targetAudience,
        industry, 
        businessContext,
        availableData
      );

      const { partialObjectStream } = streamObject({
        model: this.model,
        schema: logicBrainstormingSchema,
        prompt,
        temperature: 0.6, // ✅ REDUCED from 0.9 to prevent massive responses
        onError: onError ? (event) => onError(new Error(String(event.error))) : undefined
      });

      for await (const partialObject of partialObjectStream) {
        onPartialLogic?.(partialObject);
      }

    } catch (error) {
      const err = new Error(`Logic brainstorming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onError?.(err);
    }
  }

  /**
   * ✅ NEW: Fallback brainstorming result when JSON parsing fails
   */
  private getFallbackBrainstormingResult(toolType: string, targetAudience: string, industry: string): any {
    console.log('🔧 Generating fallback brainstorming result');
    
    return {
      coreWConcept: `${toolType} for ${targetAudience}`,
      keyCalculations: [
        {
          name: "Primary Calculation",
          formula: "Input1 * Factor + Input2",
          description: "Main calculation logic for the tool",
          variables: ["Input1", "Input2", "Factor"]
        }
      ],
      interactionFlow: [
        {
          step: 1,
          title: "Data Collection",
          description: "Gather user inputs",
          userAction: "Enter values",
          engagementHook: "Discover your results"
        },
        {
          step: 2,
          title: "Processing",
          description: "Calculate results",
          userAction: "Review calculations",
          engagementHook: "See insights"
        },
        {
          step: 3,
          title: "Results",
          description: "Show recommendations",
          userAction: "Download report",
          engagementHook: "Get personalized advice"
        }
      ],
      valueProposition: `Professional ${toolType.toLowerCase()} designed for ${targetAudience}`,
      leadCaptureStrategy: {
        timing: "After calculation",
        method: "Email for detailed report",
        incentive: "Free detailed analysis"
      },
      creativeEnhancements: [
        "Professional reporting",
        "Comparative analysis",
        "Industry benchmarks"
      ],
      suggestedInputs: [
        {
          id: "primary-input",
          label: "Primary Value",
          type: "number",
          required: true,
          description: "Main input for calculation"
        },
        {
          id: "secondary-input", 
          label: "Secondary Value",
          type: "number",
          required: false,
          description: "Additional parameter"
        }
      ],
      calculationLogic: [
        {
          id: "main-calc",
          name: "Primary Calculation",
          formula: "primaryInput * 1.2 + secondaryInput",
          dependencies: ["primary-input", "secondary-input"],
          outputFormat: "number",
          engagementMoment: "Result revelation"
        }
      ],
      promptOptions: {
        includeComprehensiveColors: industry === 'healthcare' || industry === 'finance',
        includeGorgeousStyling: false,
        includeAdvancedLayouts: false,
        styleComplexity: 'basic' as const,
        industryFocus: industry,
        toolComplexity: 'moderate' as const
      }
    };
  }
}

// TODO: Add error handling and retry logic
// TODO: Implement streaming responses for real-time feedback
// TODO: Add framework templates for common use cases
// TODO: Implement framework versioning and rollback
// TODO: Add analytics for framework performance tracking 