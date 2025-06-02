// Dedicated Tool Creation Agent - Handles ONLY tool generation with proper validation

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getPrimaryModel, getFallbackModel, getProcessConfig, getProviders } from '@/lib/ai/models/model-config';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { 
  TOOL_CREATION_PROMPT, 
  buildCompleteSystemPrompt,
  buildToolCreationUserPrompt
} from '@/lib/prompts/tool-creation-prompt';
import { LogicArchitectAgent } from '@/lib/ai/agents/logic-architect';
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
  
  // Style information
  initialStyleMap: z.record(z.string()).optional(), // Generated once by AI
  currentStyleMap: z.record(z.string()).optional(),  // Active, editable style map

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
  }).optional()
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

// POST handler - Tool Creation Agent
export async function POST(request: NextRequest) {
  console.log('🔧 TRACE: create-tool API route START');
  
  try {
    const userId = await requireAuth();
    const body = await request.json();
    
    console.log('🔧 TRACE: Received request body:', JSON.stringify(body, null, 2));
    console.log('🔧 TRACE: userIntent:', body.userIntent);
    console.log('🔧 TRACE: context keys:', Object.keys(body.context || {}));
    console.log('🔧 TRACE: context.brainstormingResult:', body.context?.brainstormingResult);
    console.log('🔧 TRACE: context.logicArchitectInsights:', body.context?.logicArchitectInsights);
    
    const validatedData = toolCreationRequestSchema.parse(body);
    console.log('🔧 TRACE: Schema validation passed');

    const { userIntent, context, existingTool } = validatedData;
    console.log('🔧 TRACE: Validated userIntent:', userIntent);
    console.log('🔧 TRACE: Validated context keys:', Object.keys(context || {}));

    // Track the creation request
    const tracker = getBehaviorTracker();
    const startTime = Date.now();

    console.log('🔧 TRACE: About to call processToolCreation core logic');
    
    const toolDefinition = await processToolCreation(
      userIntent,
      context,
      existingTool,
      userId
    );

    console.log('🔧 TRACE: processToolCreation returned');
    console.log('🔧 TRACE: Tool definition ID:', toolDefinition?.id);
    console.log('🔧 TRACE: Tool definition slug:', toolDefinition?.slug);
    console.log('🔧 TRACE: Tool definition title:', toolDefinition?.metadata?.title);
    
    // Check for undefined values in the returned tool
    if (toolDefinition) {
      const undefinedFields = [];
      if (!toolDefinition.id || toolDefinition.id.includes('undefined')) {
        undefinedFields.push('id: ' + toolDefinition.id);
      }
      if (!toolDefinition.slug || toolDefinition.slug.includes('undefined')) {
        undefinedFields.push('slug: ' + toolDefinition.slug);
      }
      if (!toolDefinition.metadata?.id || toolDefinition.metadata.id.includes('undefined')) {
        undefinedFields.push('metadata.id: ' + toolDefinition.metadata?.id);
      }
      if (!toolDefinition.metadata?.slug || toolDefinition.metadata.slug.includes('undefined')) {
        undefinedFields.push('metadata.slug: ' + toolDefinition.metadata?.slug);
      }
      
      if (undefinedFields.length > 0) {
        console.error('🔧 TRACE: ⚠️ UNDEFINED VALUES in API response:', undefinedFields);
      } else {
        console.log('🔧 TRACE: ✅ No undefined values in API response');
      }
    }

    // Track successful creation
    if (tracker && toolDefinition) {
      tracker.trackToolGeneration({
        toolDefinitionId: toolDefinition.id,
        toolName: toolDefinition.metadata.title,
        toolType: toolDefinition.metadata.type,
        context: context,
        success: true,
        processingTime: Date.now() - startTime
      });
    }

    console.log('🔧 TRACE: Returning successful response');
    return NextResponse.json({
      success: true,
      tool: toolDefinition,
      message: `Created ${toolDefinition?.metadata?.title || 'tool'} successfully`
    });

  } catch (error) {
    console.error('🔧 TRACE: create-tool API ERROR:', error);
    
    // Track failed creation
    const tracker = getBehaviorTracker();
    if (tracker) {
      tracker.trackToolGeneration({
        toolDefinitionId: 'creation-failed',
        toolName: 'unknown',
        toolType: 'unknown',
        context: {},
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
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