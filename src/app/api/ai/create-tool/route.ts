// Dedicated Tool Creation Agent - Handles ONLY tool generation with proper validation

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { TOOL_CREATION_PROMPT, validateComponentTypes } from '@/lib/prompts/tool-creation-prompt';
import { LogicArchitectAgent } from '@/lib/ai/agents/logic-architect';
import { detectColorScheme, DEFAULT_COLOR_SCHEMES } from '@/lib/ai/utils/tool-defaults';

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
  }),
  
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
  })),
  
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
    })),
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
  }),
  
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
    const { userIntent, context, existingTool, updateType } = validatedRequest;

    // STEP 1: Logic Architect Brainstorming (for new tools only)
    let logicBrainstorming = null;
    
    // PRIORITY: Use external brainstorming results if provided (from streaming session)
    if (context?.brainstormingResult || context?.logicArchitectInsights) {
      console.log('🎯 Using external brainstorming results from streaming session');
      logicBrainstorming = context.brainstormingResult || context.logicArchitectInsights;
      console.log('✅ External brainstorming loaded:', logicBrainstorming?.coreWConcept);
    } else if (!existingTool) {
      console.log('🧠 Starting internal Logic Architect brainstorming...');
      try {
        const logicArchitect = new LogicArchitectAgent('anthropic');
        
        // Extract context for brainstorming
        const toolType = context?.toolType || 'calculator';
        const targetAudience = context?.targetAudience || 'business professionals';
        const industry = context?.industry || '';
        const businessDescription = context?.businessDescription || '';
        
        // Combine all available context for creative brainstorming
        const availableData = {
          collectedAnswers: context?.collectedAnswers || {},
          features: context?.features || [],
          colors: context?.colors || [],
          brandAnalysis: context?.brandAnalysis,
          uploadedFiles: context?.uploadedFiles,
          conversationHistory: context?.conversationHistory
        };
        
        logicBrainstorming = await logicArchitect.brainstormToolLogic(
          toolType,
          targetAudience,
          industry,
          businessDescription,
          availableData
        );
        
        console.log('✅ Internal Logic Architect brainstorming complete:', logicBrainstorming?.coreWConcept);
      } catch (logicError) {
        console.warn('⚠️ Logic Architect brainstorming failed, continuing with standard creation:', logicError);
      }
    }

    // STEP 2: Get the primary model for tool creation
    const model = getPrimaryModel('toolCreator');
    if (!model) {
      return NextResponse.json({ 
        success: false, 
        message: 'Tool creation model not available' 
      }, { status: 503 });
    }

    const systemPrompt = `${TOOL_CREATION_PROMPT}

    You MUST respond with a valid JSON object that exactly matches the ProductToolDefinition interface.
    The response must be pure JSON with no markdown formatting or explanations.
    
    Use ONLY the allowed component types listed above. Any unknown component types will cause errors.
    
    CRITICAL LABELING REQUIREMENTS:
    - NEVER use placeholder text like "heading", "button", "label", "text here", "example", etc.
    - ALL component labels must be specific, meaningful, and relevant to the tool's purpose
    - ALL text content must be professional business language
    - Component props.label MUST describe the actual function/content
    - helperText should provide genuine helpful guidance to users
    
    CRITICAL STYLING REQUIREMENTS:
    - ALWAYS ensure text has proper contrast against backgrounds
    - NEVER use white text on white/light backgrounds
    - Default text color should be dark (#1f2937 or similar) for light backgrounds
    - If using dark backgrounds, use light text (#ffffff or #f9fafb)
    - Test contrast ratios: dark text on light backgrounds, light text on dark backgrounds
    
    EXAMPLE OF GOOD vs BAD LABELING:
    ❌ BAD: {"label": "heading", "helperText": "enter text here"}
    ✅ GOOD: {"label": "Monthly Revenue", "helperText": "Enter your average monthly revenue in USD"}
    
    ❌ BAD: {"label": "button", "textColor": "#ffffff", "backgroundColor": "#ffffff"}
    ✅ GOOD: {"label": "Calculate ROI", "textColor": "#1f2937", "backgroundColor": "#f0f9ff"}
    
    ${logicBrainstorming ? `
    CREATIVE LOGIC BRAINSTORMING RESULTS:
    The Logic Architect has provided these creative suggestions for your tool:
    
    Core Concept: ${logicBrainstorming.coreWConcept}
    
    Suggested Calculations:
    ${logicBrainstorming.keyCalculations?.map((calc: any) => 
      `- ${calc.name}: ${calc.formula} (${calc.description})`
    ).join('\n    ') || 'No specific calculations provided'}
    
    Interaction Flow Ideas:
    ${logicBrainstorming.interactionFlow?.map((step: any) => 
      `${step.step}. ${step.title}: ${step.description}`
    ).join('\n    ') || 'No flow provided'}
    
    Value Proposition: ${logicBrainstorming.valueProposition}
    
    Creative Enhancements: ${logicBrainstorming.creativeEnhancements?.join(', ') || 'None'}
    
    IMPLEMENTATION FOCUS:
    Use these creative ideas as inspiration but focus on creating a practical, implementable tool.
    You don't need to implement every suggestion - choose the most valuable and feasible elements.
    ` : 'Focus on creating practical, business-focused calculators that solve real problems.'}`;

    const userPrompt = existingTool && updateType 
      ? `Update this existing tool based on the user's request: "${userIntent}"
         
         Current tool: ${JSON.stringify(existingTool)}
         Update type: ${updateType}
         Context: ${JSON.stringify(context)}`
      : `Create a new business tool for: "${userIntent}"
         
         RICH CONTEXT FROM CONVERSATION:
         ${context ? `
         • Target Audience: ${context.targetAudience || 'Not specified'}
         • Industry: ${context.industry || 'Not specified'}
         • Tool Type: ${context.toolType || 'Not specified'}
         • Features Requested: ${context.features?.join(', ') || 'Not specified'}
         • Business Description: ${context.businessDescription || 'Not specified'}
         • Brand Colors: ${context.colors?.join(', ') || 'Not specified'}
         
         COLLECTED ANSWERS FROM CONVERSATION:
         ${context.collectedAnswers ? Object.entries(context.collectedAnswers).map(([key, value]) => 
           `• ${key}: ${value}`
         ).join('\n         ') : 'No specific answers collected yet'}
         
         ${context.brandAnalysis ? `
         BRAND ANALYSIS RESULTS:
         • Style: ${context.brandAnalysis.style || 'Not analyzed'}
         • Personality: ${context.brandAnalysis.personality?.join(', ') || 'Not analyzed'}
         • Brand Colors: ${context.brandAnalysis.colors?.map((c: any) => `${c.name || c.hex || c}`).join(', ') || 'Not analyzed'}
         • Recommendations: ${context.brandAnalysis.recommendations?.join('; ') || 'None'}
         ` : ''}
         
         ${context.conversationHistory?.length ? `
         RECENT CONVERSATION CONTEXT:
         ${context.conversationHistory.slice(-3).map((msg: any, i: number) => 
           `• ${msg.role || 'Message'} ${i + 1}: ${msg.content || msg.message || JSON.stringify(msg).slice(0, 100)}`
         ).join('\n         ')}
         ` : ''}
         
         ${context.uploadedFiles?.length ? `
         UPLOADED FILES & BRANDING:
         ${context.uploadedFiles.map((file: any) => 
           `• ${file.description}${file.hasLogo ? ' (LOGO/BRAND ASSET)' : ''}`
         ).join('\n         ')}
         
         NOTE: Consider uploaded logo/brand assets for styling and branding consistency.
         ` : ''}
         ` : 'No additional context provided'}
         
         INSTRUCTIONS:
         Use ALL the information above to create a highly personalized, professional tool that:
         1. Solves a real problem for the specified target audience
         2. Incorporates the requested features and business context
         3. Uses the specified colors for professional branding
         4. Reflects the specific answers and preferences collected during conversation
         5. Creates meaningful component relationships and calculations
         6. Provides genuine business value, not just random components
         
         Make it professional, practical, and valuable for the target audience.`;

    console.log('🎯 Sending request to model:', model.model);

    // Create model instance and generate tool using AI SDK
    const modelInstance = createModelInstance(model.provider, model.model);

    const { object: productTool } = await generateObject({
      model: modelInstance,
      schema: productToolDefinitionSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
      maxRetries: 2
    });

    // NEW: Validate component types
    if (productTool.components) {
      const validation = validateComponentTypes(productTool.components);
      if (!validation.valid) {
        console.error('❌ Invalid component types:', validation.invalidComponents);
        return NextResponse.json({ 
          success: false, 
          message: 'Tool contains invalid component types',
          invalidComponents: validation.invalidComponents,
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

    // STEP 3: Enrich with intelligent defaults
    // Detect appropriate color scheme from context
    const colorScheme = detectColorScheme(context);
    
    // Enhance styling with appropriate color scheme if not fully specified
    if (!productTool.styling?.colors || Object.keys(productTool.styling.colors).length < 3) {
      productTool.styling = {
        ...productTool.styling,
        colors: {
          ...DEFAULT_COLOR_SCHEMES[colorScheme],
          ...productTool.styling?.colors // Keep any AI-generated colors
        }
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