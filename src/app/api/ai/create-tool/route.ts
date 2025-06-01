// Dedicated Tool Creation Agent - Handles ONLY tool generation with proper validation

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { 
  TOOL_CREATION_PROMPT, 
  buildCompleteSystemPrompt,
  buildToolCreationUserPrompt
} from '@/lib/prompts/tool-creation-prompt';
import { LogicArchitectAgent } from '@/lib/ai/agents/logic-architect';
import * as babel from '@babel/core';
import { processToolCreation } from './core-logic';

// Simple color scheme detection (inline replacement)
const DEFAULT_COLOR_SCHEMES = {
  professional: {
    primary: '#3b82f6',
    secondary: '#6b7280',
    background: '#ffffff',
    surface: '#f9fafb',
    text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
    border: '#e5e7eb',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  }
} as const;

type ColorSchemeKey = keyof typeof DEFAULT_COLOR_SCHEMES;

const detectColorScheme = (context: any): ColorSchemeKey => 'professional';

// Input schema for tool creation requests
const toolCreationRequestSchema = z.object({
  userIntent: z.string(),
  context: z.object({
    targetAudience: z.string().optional(),
    industry: z.string().optional(),
    toolType: z.string().optional(),
    features: z.array(z.string()).optional(),
    businessDescription: z.string().optional(),
    colors: z.array(z.string()).optional(),
    collectedAnswers: z.record(z.string()).optional(),
    brandAnalysis: z.object({
      colors: z.array(z.any()).optional(),
      style: z.string().optional(),
      personality: z.array(z.string()).optional(),
      recommendations: z.array(z.string()).optional()
    }).optional(),
    conversationHistory: z.array(z.any()).optional(),
    selectedWorkflow: z.array(z.any()).optional(),
    uploadedFiles: z.array(z.object({
      name: z.string(),
      type: z.string(),
      size: z.number(),
      hasLogo: z.boolean().optional(),
      description: z.string()
    })).optional(),
    brainstormingResult: z.any().optional(),
    logicArchitectInsights: z.object({
      coreWConcept: z.string().optional(),
      keyCalculations: z.array(z.any()).optional(),
      interactionFlow: z.array(z.any()).optional(),
      valueProposition: z.string().optional(),
      creativeEnhancements: z.array(z.string()).optional(),
      userExperienceFlow: z.array(z.any()).optional(),
      businessLogic: z.array(z.any()).optional()
    }).nullable().optional()
  }).optional(),
  selectedModel: z.string().optional(),
  existingTool: z.any().optional(),
  updateType: z.enum(['color', 'title', 'description', 'features', 'components', 'general']).optional()
});

// ProductToolDefinition schema for structured output
const productToolDefinitionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  version: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  createdAt: z.number(),
  updatedAt: z.number(),
  createdBy: z.string(),
  
  metadata: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    shortDescription: z.string(),
    type: z.string(),
    category: z.string(),
    targetAudience: z.string(),
    industry: z.string(),
    tags: z.array(z.string()),
    estimatedCompletionTime: z.number(),
    difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    features: z.array(z.string()),
    icon: z.object({
      type: z.enum(['lucide', 'emoji']),
      value: z.string()
    })
  }),
  
  // React component code as string
  componentCode: z.string(),
  
  // Simplified color scheme
  colorScheme: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    surface: z.string(),
    text: z.object({
      primary: z.string(),
      secondary: z.string(),
      muted: z.string()
    }),
    border: z.string(),
    success: z.string(),
    warning: z.string(),
    error: z.string()
  }),
  
  // Simple analytics
  analytics: z.object({
    enabled: z.boolean(),
    completions: z.number(),
    averageTime: z.number()
  })
});

// Helper function to create model instance
function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    default:
      return openai('gpt-4o');
  }
}

// JSX Compilation Function (server-side only)
async function compileJSXComponent(componentCode: string): Promise<string> {
  try {
    console.log('[JSX Compiler] Compiling component code...');
    
    // Clean the code first
    const cleanedCode = componentCode
      .replace(/^['"]use client['"];?\s*/gm, '') // Remove 'use client'
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*/gm, '') // Remove import statements
      .trim();

    // Transform JSX to JavaScript using Babel
    const result = babel.transformSync(cleanedCode, {
      presets: [
        ['@babel/preset-react', {
          runtime: 'classic', // Use React.createElement instead of automatic runtime
          pragma: 'React.createElement'
        }]
      ],
      plugins: [],
      filename: 'component.tsx'
    });

    if (!result || !result.code) {
      throw new Error('Babel compilation failed - no output generated');
    }

    console.log('[JSX Compiler] ✅ Successfully compiled JSX to JavaScript');
    return result.code;

  } catch (error) {
    console.error('[JSX Compiler] ❌ Compilation failed:', error);
    throw new Error(`JSX compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// POST handler - Tool Creation Agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedRequest = toolCreationRequestSchema.parse(body);
    const { userIntent, context, selectedModel, existingTool, updateType } = validatedRequest;

    // STEP 1: Logic Architect Brainstorming (for new tools only)
    let logicBrainstorming = null;
    
    // PRIORITY: Use external brainstorming results if provided (from streaming session)
    if (context?.brainstormingResult || context?.logicArchitectInsights) {
      console.log('🎯 Using external brainstorming results from streaming session');
      logicBrainstorming = context.brainstormingResult || context.logicArchitectInsights;
      console.log('✅ External brainstorming loaded:', logicBrainstorming?.coreWConcept);
    }
    // TEMPORARILY DISABLED: Skip internal Logic Architect due to Anthropic API overload
    // else if (!existingTool) {
    //   console.log('🧠 Starting internal Logic Architect brainstorming...');
    //   try {
    //     const logicArchitect = new LogicArchitectAgent('anthropic');
    //     // ... brainstorming logic
    //   } catch (logicError) {
    //     console.warn('⚠️ Logic Architect brainstorming failed, continuing with standard creation:', logicError);
    //   }
    // }

    // STEP 2: Get the primary model for tool creation
    const model = selectedModel ? { provider: 'openai', model: selectedModel } : getPrimaryModel('toolCreator');
    if (!model) {
      return NextResponse.json({ 
        success: false, 
        message: 'Tool creation model not available' 
      }, { status: 503 });
    }

    // STEP 3: Build prompts using consolidated builder functions
    const systemPrompt = buildCompleteSystemPrompt(logicBrainstorming);
    const userPrompt = buildToolCreationUserPrompt(userIntent, context, existingTool, updateType);

    console.log('🎯 Sending request to model:', model.model);

    // Create model instance and generate tool using AI SDK
    const modelInstance = createModelInstance(model.provider, model.model);

    const { object: productTool } = await generateObject({
      model: modelInstance,
      schema: productToolDefinitionSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 1.0,
      maxRetries: 1
    });

    // Ensure required fields
    if (!productTool.metadata?.title) {
      return NextResponse.json({ 
        success: false, 
        message: 'Generated tool missing required title' 
      }, { status: 400 });
    }

    // STEP 4 & 5: Process tool creation (JSX compilation + enhancements)
    try {
      // First compile JSX to JavaScript (server-side only)
      const compiledComponentCode = await compileJSXComponent(productTool.componentCode);
      console.log('🔧 JSX successfully compiled to JavaScript');

      // Then process the tool with compiled code
      const processedTool = await processToolCreation(productTool, context, compiledComponentCode);
      console.log('✅ Successfully processed tool:', processedTool.metadata.title);

      return NextResponse.json({
        success: true,
        tool: processedTool,
        message: `Created ${processedTool.metadata.title} successfully`
      });
    } catch (processingError) {
      console.error('❌ Tool processing failed:', processingError);
      return NextResponse.json({
        success: false,
        message: `Tool processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown processing error'}`
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Tool creation error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error during tool creation' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
        return NextResponse.json({
          success: true,
      agent: 'Tool Creation Specialist',
      capabilities: [
        'Generate new ProductToolDefinitions',
        'Update existing tools',
        'Validate tool schemas',
        'Handle complex business logic',
        'Create professional styling'
      ],
      supportedToolTypes: [
        'ROI Calculator',
        'Assessment Tool', 
        'Pricing Calculator',
        'Lead Qualifier',
        'Survey Builder',
        'Cost Analyzer',
        'Investment Calculator'
      ],
      updateTypes: [
        'color',
        'title', 
        'description',
        'features',
        'components',
        'general'
      ]
    });

  } catch (error) {
    console.error('Tool Creation Agent GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get agent info' },
      { status: 500 }
    );
  }
} 