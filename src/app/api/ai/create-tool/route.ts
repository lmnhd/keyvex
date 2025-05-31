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
  validateComponentTypes,
  buildCompleteSystemPrompt,
  buildToolCreationUserPrompt
} from '@/lib/prompts/tool-creation-prompt';
import { LogicArchitectAgent } from '@/lib/ai/agents/logic-architect';

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
      type: z.string(),
      value: z.string()
    })
  }),
  
  // NEW: Component code as React component string
  componentCode: z.string(),
  
  styling: z.object({
    theme: z.object({
      name: z.string(),
      mode: z.enum(['light', 'dark']),
      borderRadius: z.string().optional(),
      shadows: z.string().optional(),
      effects: z.record(z.any()).optional()
    }),
    colors: z.object({
      primary: z.string(),
      secondary: z.string(),
      background: z.string().optional(),
      surface: z.string().optional(),
      text: z.object({
        primary: z.string(),
      secondary: z.string().optional(),
        muted: z.string().optional()
      }),
      border: z.string().optional(),
      success: z.string().optional(),
      warning: z.string().optional(),
      error: z.string().optional(),
      info: z.string().optional()
    }),
    typography: z.object({
      fontFamily: z.object({
        primary: z.string()
      }),
      scale: z.record(z.string()).optional(),
      weights: z.record(z.number()).optional()
    }).optional(),
    spacing: z.object({
      scale: z.record(z.string()).optional()
    }).optional()
  }),
  
  // Keep existing schema structure but make optional for backward compatibility
  layout: z.object({
    type: z.string(),
    structure: z.object({
      container: z.object({
        maxWidth: z.string(),
        padding: z.string(),
        alignment: z.string()
      }),
      sections: z.array(z.object({
        id: z.string(),
        type: z.string(),
        layout: z.string(),
        order: z.number()
      })),
      flow: z.object({
        type: z.string()
      })
    }),
    responsive: z.object({
      breakpoints: z.record(z.object({
        container: z.object({
          maxWidth: z.string().optional(),
          padding: z.string().optional(),
          alignment: z.string().optional()
        }).optional(),
        sections: z.array(z.object({
          id: z.string(),
          changes: z.record(z.any())
        })).optional(),
        components: z.array(z.object({
          id: z.string(),
          changes: z.record(z.any())
        })).optional()
      })).optional()
    })
  }).optional(),
  
  components: z.array(z.object({
    id: z.string(),
    type: z.string(),
    sectionId: z.string(),
    order: z.number(),
    props: z.record(z.any()).optional(),
    validation: z.object({
      componentId: z.string(),
      rules: z.array(z.object({
        type: z.string(),
        message: z.string(),
        value: z.any().optional()
      }))
    }).optional()
  })).optional(),
  
  logic: z.object({
    calculations: z.array(z.object({
      id: z.string(),
      name: z.string(),
      formula: z.string(),
      dependencies: z.array(z.string()),
      outputComponentId: z.string(),
      triggers: z.array(z.object({
        event: z.string(),
        debounce: z.number().optional()
      })),
      format: z.object({
        type: z.string(),
        decimals: z.number().optional()
      })
    })).optional(),
    conditions: z.array(z.object({
      id: z.string(),
      type: z.string(),
      componentId: z.string(),
      operator: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
      action: z.string()
    })).optional(),
    actions: z.array(z.object({
      id: z.string(),
      type: z.string(),
      trigger: z.string(),
      targetComponentId: z.string(),
      parameters: z.record(z.any()).optional()
    })).optional(),
    formulas: z.array(z.object({
      id: z.string(),
      name: z.string(),
      expression: z.string(),
      dependencies: z.array(z.string())
    })).optional()
  }).optional(),
  
  validation: z.object({
    components: z.array(z.object({
      componentId: z.string(),
      rules: z.array(z.object({
        type: z.string(),
        message: z.string(),
        value: z.any().optional()
      }))
    })).optional(),
    global: z.array(z.object({
      type: z.string(),
      message: z.string(),
      condition: z.string()
    })).optional()
  }).optional(),
  
  analytics: z.object({
    enabled: z.boolean(),
    trackingEvents: z.array(z.object({
      id: z.string(),
      name: z.string(),
      trigger: z.enum(['component-interaction', 'calculation', 'completion', 'custom']),
      componentId: z.string().optional(),
      properties: z.record(z.any()).optional()
    })).optional()
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

    // NEW: Enhanced component validation with syntax error detection
    if (productTool.components) {
      const validation = validateComponentTypes(productTool.components);
      if (!validation.valid) {
        console.error('❌ Component validation failed:', {
          invalidComponents: validation.invalidComponents,
          syntaxErrors: validation.syntaxErrors,
          suggestions: validation.suggestions
        });
        
        const errorMessage = [
          'Tool contains invalid component types',
          validation.syntaxErrors.length > 0 ? `Syntax errors: ${validation.syntaxErrors.join('; ')}` : '',
          validation.invalidComponents.length > 0 ? `Invalid types: ${validation.invalidComponents.join('; ')}` : ''
        ].filter(Boolean).join('\n');
        
        return NextResponse.json({ 
          success: false, 
          message: errorMessage,
          invalidComponents: validation.invalidComponents,
          syntaxErrors: validation.syntaxErrors,
          suggestions: validation.suggestions
        }, { status: 400 });
      }
    }

    // Ensure required fields
    if (!productTool.metadata?.title) {
      return NextResponse.json({ 
        success: false, 
        message: 'Generated tool missing required title' 
      }, { status: 400 });
    }

    // STEP 4: Enrich with intelligent defaults
    // Detect appropriate color scheme from context
    const colorScheme = detectColorScheme(context);
    
    // Enhance styling with appropriate color scheme if not fully specified
    if (!productTool.styling?.colors || Object.keys(productTool.styling.colors).length < 3) {
      const selectedColorScheme = DEFAULT_COLOR_SCHEMES[colorScheme] || DEFAULT_COLOR_SCHEMES.professional;
      productTool.styling = {
        ...productTool.styling,
        colors: {
          ...selectedColorScheme,
          ...productTool.styling?.colors // Keep any AI-generated colors
        }
      };
    }
    
    // Add default layout if not specified
    if (!productTool.layout) {
      productTool.layout = {
        type: 'single-page',
        structure: {
          container: {
            maxWidth: '1200px',
            padding: '24px',
            alignment: 'center'
          },
          sections: [
            {
              id: 'header',
              type: 'header',
              layout: 'centered',
              order: 1
            },
            {
              id: 'main',
              type: 'content',
              layout: 'grid',
              order: 2
            },
            {
              id: 'results',
              type: 'results',
              layout: 'grid',
              order: 3
            }
          ],
          flow: {
            type: 'linear'
          }
        },
        responsive: {
          breakpoints: {}
        }
      };
    }
    
    // Add default components if not specified
    if (!productTool.components || productTool.components.length === 0) {
      productTool.components = [
        {
          id: 'title',
          type: 'heading',
          sectionId: 'header',
          order: 1,
          props: {
            level: 1,
            text: productTool.metadata.title
          }
        }
      ];
    }
    
    // Add default logic if not specified
    if (!productTool.logic) {
      productTool.logic = {
        calculations: []
      };
    }
    
    // Ensure analytics tracking is enabled for lead generation
    if (!productTool.analytics?.trackingEvents?.length) {
      productTool.analytics = {
        enabled: true,
        trackingEvents: [
          {
            id: 'tool-interaction',
            name: 'Tool Interaction',
            trigger: 'component-interaction',
            componentId: '',
            properties: {
              tool_type: productTool.metadata.type || 'calculator',
              industry: context?.industry || 'general'
            }
          }
        ],
        ...productTool.analytics
      };
    }
    
    // Add default validation if none exists
    if (!productTool.validation?.components?.length && productTool.components?.length) {
      productTool.validation = {
        components: productTool.components
          .filter(comp => comp.type === 'textInput' || comp.type === 'numberInput')
          .map(comp => ({
            componentId: comp.id,
            rules: [
              {
                type: 'required',
                message: 'This field is required'
              }
            ]
          })),
        global: [],
        ...productTool.validation
      };
    }

    console.log('✅ Successfully created tool:', productTool.metadata.title);

    return NextResponse.json({
      success: true,
      tool: productTool,
      message: `Created ${productTool.metadata.title} successfully`
    });

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