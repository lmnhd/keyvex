// UI Flow Testing API Route - Connects to test-ui page for real workflow testing

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText, streamObject, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { requireAuth, debugLog } from '@/lib/auth/debug';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import { getBehaviorTracker } from '@/lib/ai/behavior-tracker';
import { ProductToolDefinition, ToolColorScheme } from '@/lib/types/product-tool';
import { TEST_UI_ASSISTANT_PROMPT, TEST_COMMANDS, createAdaptivePrompt } from '@/lib/prompts/test-ui-prompt';

// Request schema for UI flow testing
const uiTestRequestSchema = z.object({
  userInput: z.string(),
  conversationHistory: z.array(z.any()).optional(),
  collectedAnswers: z.record(z.string()).optional(),
  currentStep: z.number().optional(),
  command: z.string().optional(), // For testing specific commands
  provider: z.enum(['openai', 'anthropic']).optional(),
  model: z.string().optional(),
  productToolDefinition: z.any().optional() // Current tool definition for context
});

// Response schema for UI components
const uiComponentResponseSchema = z.object({
  message: z.string(),
  inputType: z.enum([
    'select', 
    'multiSelect', 
    'colorSelect', 
    'yesNoMaybe', 
    'text', 
    'textarea', 
    'multiPart',
    'fileUpload'
  ]),
  id: z.string().optional(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    colors: z.array(z.string()).optional()
  })).optional(),
  placeholder: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
  maxSelections: z.number().optional(),
  allowCustom: z.boolean().optional(),
  acceptedFileTypes: z.array(z.string()).optional(),
  maxFileSize: z.string().optional(),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    inputType: z.string(),
    options: z.array(z.object({
      value: z.string(),
      label: z.string(),
      colors: z.array(z.string()).optional()
    })).optional(),
    placeholder: z.string().optional(),
    suggestions: z.array(z.string()).optional(),
    allowCustom: z.boolean().optional()
  })).optional(),
  reasoning: z.string().optional(),
  shouldCreateTool: z.boolean().optional(), // Signal to call tool creation agent
  toolCreationContext: z.object({
    userIntent: z.string(),
    targetAudience: z.string().optional(),
    industry: z.string().optional(),
    toolType: z.string().optional(),
    features: z.array(z.string()).optional(),
    businessDescription: z.string().optional(),
    updateType: z.enum(['color', 'title', 'description', 'features', 'components', 'general']).optional()
  }).optional(),
  shouldUpdateStyle: z.boolean().optional(), // NEW: Signal to call style update API
  styleUpdateContext: z.object({          // NEW: Context for style update
    toolDefinitionId: z.string(),         // ID of the ProductToolDefinition to update
    dataStyleId: z.string(),              // The 'data-style-id' of the element to update
    newTailwindClasses: z.string()        // The new Tailwind classes to apply
  }).optional()
});

// ============================================================================
// PRODUCT TOOL GENERATION & UPDATE FUNCTIONS
// ============================================================================

// Generate a new ProductToolDefinition or update an existing one
async function generateOrUpdateProductTool(
  userInput: string,
  context: any,
  existingDefinition?: ProductToolDefinition | null,
  updateType: string = 'general'
): Promise<ProductToolDefinition | null> {
  try {
    console.log('🤖 Generating/updating ProductTool:', { 
      userInput, 
      updateType, 
      hasExisting: !!existingDefinition 
    });

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Use existing definition as base or create new
    const baseDefinition = existingDefinition || createBaseToolDefinition();

    // Generate updated tool definition based on input and update type
    const updatedDefinition: ProductToolDefinition = {
      ...baseDefinition,
      version: existingDefinition ? `${parseFloat(existingDefinition.version) + 0.1}` : '1.0.0',
      updatedAt: Date.now(),
      
      metadata: {
        ...baseDefinition.metadata,
        title: determineTitle(userInput, context, existingDefinition),
        description: determineDescription(userInput, context, existingDefinition),
        targetAudience: context.targetAudience || existingDefinition?.metadata?.targetAudience || 'Business professionals',
        industry: context.industry || existingDefinition?.metadata?.industry || 'General',
        features: determineFeatures(userInput, context, existingDefinition)
      },
      
      colorScheme: determineColors(userInput, context, existingDefinition, updateType)
    };

    console.log('✅ Generated/updated ProductTool:', updatedDefinition.metadata.title);
    return updatedDefinition;

  } catch (error) {
    console.error('❌ Error generating/updating ProductTool:', error);
    return null;
  }
}

// Helper functions for tool generation
function createBaseToolDefinition(): ProductToolDefinition {
  const toolId = `tool_${Date.now()}`;
  return {
    id: toolId,
    slug: 'ai-generated-tool',
    version: '1.0.0',
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'ai-agent',
    
    metadata: {
      id: toolId,
      slug: 'ai-generated-tool',
      title: 'Business Calculator',
      description: 'AI-generated business tool',
      shortDescription: 'AI-generated business tool',
      type: 'calculator',
      category: 'ai-generated',
      targetAudience: 'Business professionals',
      industry: 'General',
      tags: ['ai-generated', 'dynamic', 'calculator'],
      estimatedCompletionTime: 3,
      difficultyLevel: 'beginner',
      features: ['Real-time calculations'],
      icon: { type: 'lucide', value: 'Calculator' }
    },
    
    componentCode: `
      export default function BusinessCalculator() {
        return <div className="p-6"><h1>Business Calculator</h1></div>;
      }
    `,
    
    colorScheme: {
      primary: '#3b82f6',
      secondary: '#1e40af',
      background: '#ffffff',
      surface: '#f9fafb',
      text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
      border: '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444'
    },
    
    analytics: { enabled: true, completions: 0, averageTime: 0 }
  };
}

function determineTitle(userInput: string, context: any, existing?: ProductToolDefinition | null): string {
  if (existing?.metadata?.title) return existing.metadata.title;
  
  if (userInput.toLowerCase().includes('roi')) return 'ROI Calculator';
  if (userInput.toLowerCase().includes('savings')) return 'Cost Savings Calculator';
  if (userInput.toLowerCase().includes('pricing')) return 'Pricing Calculator';
  if (userInput.toLowerCase().includes('lead')) return 'Lead Qualifier Calculator';
  
  return context.toolName || 'Business Calculator';
}

function determineDescription(userInput: string, context: any, existing?: ProductToolDefinition | null): string {
  if (existing?.metadata?.description) return existing.metadata.description;
  return context.description || `AI-generated calculator based on: "${userInput}"`;
}

function determineFeatures(userInput: string, context: any, existing?: ProductToolDefinition | null): string[] {
  if (existing?.metadata?.features) return existing.metadata.features;
  
  const features = ['Real-time calculations', 'Professional results'];
  if (context.features) features.push(...context.features);
  return features;
}

function determineColors(userInput: string, context: any, existing?: ProductToolDefinition | null, updateType?: string): ToolColorScheme {
  const defaultColors: ToolColorScheme = {
    primary: '#3b82f6',
    secondary: '#1e40af',
    background: '#ffffff',
    surface: '#f9fafb',
    text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
    border: '#e5e7eb',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  };

  // If we have existing colors and this isn't a color update, preserve them
  if (existing?.colorScheme && updateType !== 'color') {
    return existing.colorScheme;
  }

  // Handle context colors (from user selection)
  if (context.customColors && context.customColors.length >= 2) {
    return {
      ...defaultColors,
      primary: context.customColors[0],
      secondary: context.customColors[1]
    };
  }

  // Handle existing colors
  if (existing?.colorScheme) {
    return existing.colorScheme;
  }

  return defaultColors;
}

// Helper functions to extract data from collected answers
function extractColorsFromAnswers(answers: Record<string, string>): string[] | undefined {
  // Look for color-related answers
  for (const [key, value] of Object.entries(answers)) {
    if (key.toLowerCase().includes('color') || key.toLowerCase().includes('scheme')) {
      // If it's a custom color value, try to extract the colors
      if (value.includes(',')) {
        return value.split(',').map(c => c.trim());
      }
    }
  }
  return undefined;
}

function extractFeaturesFromAnswers(answers: Record<string, string>): string[] | undefined {
  // Look for feature-related answers
  for (const [key, value] of Object.entries(answers)) {
    if (key.toLowerCase().includes('feature') || key.toLowerCase().includes('capability')) {
      if (value.includes(',')) {
        return value.split(',').map(f => f.trim()).filter(Boolean);
      }
    }
  }
  return undefined;
}

// Mock AI response generator that adapts based on user behavior profile
function generateAdaptiveAIResponse(
  userInput: string, 
  userProfile: any,
  conversationHistory: any[],
  collectedAnswers: any
) {
  // Get adaptive suggestions from profile
  const suggestions = userProfile ? {
    preferQuickMode: userProfile.averageResponseTime < 5000 && !userProfile.likelyToEditAnswers,
    showAdvancedOptions: userProfile.explorationTendency > 0.5,
    suggestedQuestionTypes: userProfile.recommendedQuestionTypes || ['select', 'textarea'],
    recommendedComplexity: userProfile.preferredComplexity || 'medium',
    optimalStepCount: userProfile.optimalStepCount || 6
  } : {
    preferQuickMode: false,
    showAdvancedOptions: false,
    suggestedQuestionTypes: ['select', 'textarea'],
    recommendedComplexity: 'medium',
    optimalStepCount: 6
  };

  console.log('🧠 Generating adaptive response with profile:', userProfile ? 'Found' : 'Default');
  console.log('🔧 Adaptive suggestions:', suggestions);

  // Check for specific test commands first
  const lowerInput = userInput.toLowerCase();
  
  // Enhanced test commands with adaptive behavior
  if (lowerInput.includes('send a test multi-input') || 
      lowerInput.includes('test multi-input') ||
      lowerInput.includes('multi-question') ||
      lowerInput.includes('multiple questions') ||
      lowerInput.includes('several questions') ||
      lowerInput.includes('ask me questions')) {
    const questionTypes = suggestions.preferQuickMode 
      ? ['select', 'yesNoMaybe'] // Quick input types for fast users
      : ['textarea', 'select']; // More detailed inputs for deliberate users
      
    return {
      id: 'adaptive-multi-input-test',
      message: suggestions.preferQuickMode 
        ? "Quick multi-question test! I'll keep these short and snappy since you prefer efficient workflows." 
        : "Let's dive deep with this multi-question sequence. I'll give you detailed options since you like to explore.",
      inputType: 'multiPart',
      questions: [
        {
          id: 'adaptive-tool-type',
          question: "What type of tool interests you most?",
          inputType: questionTypes[0] === 'select' ? 'select' : 'textarea',
          ...(questionTypes[0] === 'select' ? {
            options: suggestions.showAdvancedOptions ? [
              { value: 'calculator', label: 'Advanced Calculator' },
              { value: 'assessment', label: 'Diagnostic Assessment' },
              { value: 'analyzer', label: 'Data Analyzer' },
              { value: 'generator', label: 'Content Generator' },
              { value: 'optimizer', label: 'Process Optimizer' }
            ] : [
              { value: 'calculator', label: 'Calculator' },
              { value: 'quiz', label: 'Quiz' },
              { value: 'form', label: 'Form' }
            ],
            allowCustom: suggestions.showAdvancedOptions
          } : {
            placeholder: 'Describe the type of tool you want to create...',
            suggestions: suggestions.showAdvancedOptions ? [
              'AI-powered calculator',
              'Interactive assessment',
              'Data visualization tool'
            ] : [
              'Simple calculator',
              'Quick quiz',
              'Contact form'
            ]
          })
        },
        {
          id: 'adaptive-audience',
          question: suggestions.preferQuickMode 
            ? "Who's your target audience?" 
            : "Let's get specific about your target audience. Who exactly will use this tool?",
          inputType: 'select',
          options: suggestions.showAdvancedOptions ? [
            { value: 'c-suite', label: 'C-Suite Executives' },
            { value: 'managers', label: 'Department Managers' },
            { value: 'consultants', label: 'Consultants & Advisors' },
            { value: 'entrepreneurs', label: 'Entrepreneurs' },
            { value: 'specialists', label: 'Technical Specialists' },
            { value: 'analysts', label: 'Business Analysts' }
          ] : [
            { value: 'business', label: 'Business Owners' },
            { value: 'managers', label: 'Managers' },
            { value: 'consultants', label: 'Consultants' }
          ],
          allowCustom: true
        },
        ...(suggestions.recommendedComplexity !== 'simple' ? [{
          id: 'adaptive-complexity',
          question: "What level of detail should this tool provide?",
          inputType: 'yesNoMaybe',
          options: [
            { value: 'simple', label: 'Simple & Quick' },
            { value: 'detailed', label: 'Comprehensive' },
            { value: 'expert', label: 'Expert-Level' }
          ]
        }] : [])
      ],
      reasoning: `Adaptive multi-part test based on user profile: ${suggestions.preferQuickMode ? 'quick mode' : 'detailed mode'}`
    };
  }

  if (lowerInput.includes('send a test color-picker') || lowerInput.includes('test color-picker')) {
    return {
      id: 'adaptive-color-test',
      message: suggestions.showAdvancedOptions 
        ? "Let's explore color schemes! I'll show you advanced options including custom palettes."
        : "Let's pick some colors for your tool. Here are some great options to choose from.",
      inputType: 'colorSelect',
      options: suggestions.showAdvancedOptions ? [
        { value: 'gradient-blue', label: 'Ocean Gradient', colors: ['#0ea5e9', '#0369a1'] },
        { value: 'sunset-orange', label: 'Sunset Glow', colors: ['#f97316', '#ea580c'] },
        { value: 'forest-green', label: 'Forest Depths', colors: ['#059669', '#047857'] },
        { value: 'royal-purple', label: 'Royal Purple', colors: ['#8b5cf6', '#7c3aed'] },
        { value: 'warm-coral', label: 'Warm Coral', colors: ['#f472b6', '#ec4899'] },
        { value: 'steel-gray', label: 'Steel Professional', colors: ['#64748b', '#475569'] }
      ] : [
        { value: 'blue', label: 'Professional Blue', colors: ['#3b82f6', '#2563eb'] },
        { value: 'green', label: 'Fresh Green', colors: ['#10b981', '#059669'] },
        { value: 'purple', label: 'Creative Purple', colors: ['#8b5cf6', '#7c3aed'] }
      ],
      allowCustom: suggestions.showAdvancedOptions,
      reasoning: `Adaptive color picker with ${suggestions.showAdvancedOptions ? 'advanced' : 'simple'} options`
    };
  }

  if (lowerInput.includes('send a test image-upload') || lowerInput.includes('test image-upload')) {
    return {
      id: 'adaptive-upload-test',
      message: suggestions.preferQuickMode 
        ? "Quick file upload test. Drag and drop or click to upload."
        : "Let's test file upload functionality. You can upload images, logos, or reference materials to help customize your tool.",
      inputType: 'fileUpload',
      placeholder: suggestions.showAdvancedOptions 
        ? 'Upload logos, screenshots, design references, or brand assets (PNG, JPG, PDF up to 10MB)'
        : 'Upload your logo or brand image',
      acceptedFileTypes: suggestions.showAdvancedOptions 
        ? ['image/*', '.pdf', '.sketch', '.fig']
        : ['image/*'],
      maxFileSize: suggestions.showAdvancedOptions ? '10MB' : '5MB',
      reasoning: `Adaptive file upload with ${suggestions.showAdvancedOptions ? 'multiple formats' : 'image only'}`
    };
  }

  // Default adaptive responses based on user input analysis
  const isQuestionAboutFeatures = lowerInput.includes('feature') || 
                                 lowerInput.includes('function') ||
                                 lowerInput.includes('capability');

  if (isQuestionAboutFeatures) {
    return {
      id: 'adaptive-features-response',
      message: suggestions.preferQuickMode 
        ? "Great question! Let me show you the key features to choose from."
        : "Excellent question about features! Let's explore the full range of capabilities we can add to your tool.",
      inputType: 'multiSelect',
      options: suggestions.showAdvancedOptions ? [
        { value: 'ai-insights', label: 'AI-Powered Insights' },
        { value: 'real-time-calc', label: 'Real-time Calculations' },
        { value: 'data-visualization', label: 'Advanced Charts & Graphs' },
        { value: 'export-options', label: 'Multiple Export Formats' },
        { value: 'integrations', label: 'API Integrations' },
        { value: 'collaboration', label: 'Team Collaboration' },
        { value: 'white-label', label: 'White-label Branding' },
        { value: 'analytics', label: 'Usage Analytics' }
      ] : [
        { value: 'calculations', label: 'Smart Calculations' },
        { value: 'charts', label: 'Charts & Graphs' },
        { value: 'export', label: 'PDF Export' },
        { value: 'sharing', label: 'Easy Sharing' },
        { value: 'branding', label: 'Custom Branding' }
      ],
      maxSelections: suggestions.preferQuickMode ? 3 : 5,
      reasoning: `Adaptive feature selection based on user exploration tendency: ${userProfile?.explorationTendency || 'default'}`
    };
  }

  // Check if user is asking about colors/design
  const isAboutDesign = lowerInput.includes('color') || lowerInput.includes('design') || 
                       lowerInput.includes('style') || lowerInput.includes('brand');

  if (isAboutDesign) {
    return {
      id: 'adaptive-design-response',
      message: suggestions.showAdvancedOptions
        ? "Perfect! Let's dive deep into your design preferences. I'll show you comprehensive branding options."
        : "Great! Let's talk design. I'll show you some solid color and style options.",
      inputType: 'colorSelect',
      options: suggestions.showAdvancedOptions ? [
        { value: 'modern-gradient', label: 'Modern Gradient', colors: ['#667eea', '#764ba2'] },
        { value: 'corporate-blue', label: 'Corporate Blue', colors: ['#1e3a8a', '#3b82f6'] },
        { value: 'eco-green', label: 'Eco Green', colors: ['#166534', '#22c55e'] },
        { value: 'innovation-purple', label: 'Innovation Purple', colors: ['#581c87', '#a855f7'] },
        { value: 'energy-orange', label: 'Energy Orange', colors: ['#c2410c', '#f97316'] },
        { value: 'minimalist-gray', label: 'Minimalist Gray', colors: ['#374151', '#6b7280'] }
      ] : [
        { value: 'blue', label: 'Professional Blue', colors: ['#2563eb', '#1e40af'] },
        { value: 'green', label: 'Growth Green', colors: ['#059669', '#047857'] },
        { value: 'purple', label: 'Creative Purple', colors: ['#7c3aed', '#5b21b6'] }
      ],
      allowCustom: true,
      reasoning: `Design-focused response adapted to user's complexity preference: ${suggestions.recommendedComplexity}`
    };
  }

  // Default fallback - adapt based on user's preferred input types
  const preferredInputType = userProfile?.preferredInputTypes?.[0] || 
                            (suggestions.preferQuickMode ? 'select' : 'textarea');

  return {
    id: 'adaptive-freeform-response',
    message: suggestions.preferQuickMode 
      ? `Got it! Let me help you quickly. Based on your preferences, I'll keep this efficient and focused.`
      : `I understand what you're looking for. Since you like to explore options, let me give you some detailed choices to consider.`,
    inputType: preferredInputType === 'textarea' ? 'textarea' : 'select',
    ...(preferredInputType === 'textarea' ? {
      placeholder: 'Tell me more about what you\'d like to create or modify...',
      suggestions: suggestions.showAdvancedOptions ? [
        'Add advanced calculations',
        'Integrate with external APIs',
        'Create custom workflows',
        'Add machine learning features'
      ] : [
        'Add more questions',
        'Change the design',
        'Add export features'
      ]
    } : {
      options: suggestions.showAdvancedOptions ? [
        { value: 'continue-advanced', label: 'Continue with advanced options' },
        { value: 'customize-detailed', label: 'Customize with detailed settings' },
        { value: 'explore-integrations', label: 'Explore integrations & APIs' },
        { value: 'restart-expert', label: 'Start over with expert mode' }
      ] : [
        { value: 'continue', label: 'Continue with current approach' },
        { value: 'customize', label: 'Customize further' },
        { value: 'restart', label: 'Start over with different approach' }
      ],
      placeholder: 'Choose your next step...'
    }),
    reasoning: `Fallback response using preferred input type: ${preferredInputType}, complexity: ${suggestions.recommendedComplexity}`
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = uiTestRequestSchema.parse(body);
    const { 
      userInput, 
      conversationHistory, 
      collectedAnswers, 
      currentStep,
      productToolDefinition
    } = validatedData;

    console.log('🔧 Test UI API called with input:', userInput);
    console.log('🔧 Conversation history length:', conversationHistory?.length || 0);

    // Get behavior tracker and user profile
    const tracker = getBehaviorTracker();
    const userProfile = tracker?.getUserProfile();
    
    console.log('🧠 User profile available:', !!userProfile);
    if (userProfile) {
      console.log('📊 Profile stats:', {
        totalInteractions: userProfile.totalInteractions,
        avgResponseTime: userProfile.averageResponseTime || 0,
        explorationTendency: userProfile.explorationTendency || 0,
        preferredComplexity: userProfile.preferredComplexity || 'medium',
        confidenceScore: userProfile.confidenceScore || 0
      });
    }

    // Check for test commands
    const lowerInput = userInput.toLowerCase();
    const isTestCommand = lowerInput.includes('test ') || 
                         lowerInput.includes('send a test') ||
                         lowerInput.includes('demo ');

    let response;

    if (isTestCommand) {
      // Handle test commands with adaptive behavior
      console.log('🔧 Processing test command');
      response = generateAdaptiveAIResponse(userInput, userProfile, conversationHistory || [], collectedAnswers || {});
    } else {
      // Get model configuration
      const primaryModel = getPrimaryModel('testUI');
      const model = primaryModel ? createModelInstance(primaryModel.provider, primaryModel.modelInfo.id) : openai('gpt-4o');

      // Create adaptive prompt based on user profile
      const adaptivePrompt = createAdaptivePrompt(userInput, userProfile, conversationHistory || [], collectedAnswers || {}, productToolDefinition);

      console.log('🔧 Generating AI response with adaptive prompt');

      try {
        const result = await generateObject({
          model,
          schema: uiComponentResponseSchema,
          prompt: adaptivePrompt,
          temperature: 0.7,
          maxRetries: 2
        });

        response = result.object;
        
        // Debug: Log what the AI generated
        console.log('🤖 AI generated response object:', JSON.stringify(response, null, 2));
        console.log('🤖 shouldUpdateStyle:', response.shouldUpdateStyle);
        console.log('🤖 styleUpdateContext:', response.styleUpdateContext);
      } catch (aiError) {
        console.error('❌ AI generation failed:', aiError);
        
        // Simple fallback
        response = {
          id: 'fallback-response',
          message: "I encountered an issue, but let's continue. What would you like to work on?",
          inputType: 'textarea' as const,
          placeholder: 'Tell me what you\'d like to focus on...'
        };
      }
    }

    // Simulate processing time based on user profile (shorter for users who prefer quick mode)
    const processingTime = userProfile && userProfile.averageResponseTime < 5000 ? 500 : 1200;
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // VALIDATION: Fix colorSelect options that don't have colors array
    if (response.inputType === 'colorSelect' && response.options) {
      response.options = response.options.map((option: any) => {
        if (!option.colors || !Array.isArray(option.colors) || option.colors.length !== 2) {
          console.log('🔧 Fixing colorSelect option missing colors array:', option.value);
          
          // Map common color names to hex values
          const colorMap: Record<string, string[]> = {
            'blue': ['#3b82f6', '#2563eb'],
            'professional-blue': ['#2563eb', '#1e40af'],
            'green': ['#10b981', '#059669'],
            'modern-green': ['#059669', '#047857'],
            'red': ['#ef4444', '#dc2626'],
            'vibrant-red': ['#dc2626', '#b91c1c'],
            'orange': ['#f97316', '#ea580c'],
            'warm-orange': ['#ea580c', '#c2410c'],
            'purple': ['#8b5cf6', '#7c3aed'],
            'elegant-purple': ['#7c3aed', '#5b21b6'],
            'yellow': ['#eab308', '#ca8a04'],
            'pink': ['#ec4899', '#db2777'],
            'gray': ['#6b7280', '#4b5563'],
            'teal': ['#14b8a6', '#0d9488'],
            'indigo': ['#6366f1', '#4f46e5']
          };
          
          // Try to match color name
          const colorKey = option.value.toLowerCase();
          if (colorMap[colorKey]) {
            option.colors = colorMap[colorKey];
          } else {
            // Default fallback colors
            option.colors = ['#3b82f6', '#2563eb'];
          }
          
          console.log('🔧 Fixed colorSelect option:', option);
        }
        return option;
      });
    }

    const result = {
      success: true,
      response,
      isTestCommand,
      detectedCommand: isTestCommand ? lowerInput.match(/test [\w-]+/)?.[0] : null,
      userProfile: userProfile ? {
        totalInteractions: userProfile.totalInteractions,
        preferredComplexity: userProfile.preferredComplexity,
        suggestedWorkflow: userProfile.suggestedWorkflow,
        confidenceScore: userProfile.confidenceScore,
        adaptiveSuggestions: tracker?.getAdaptiveSuggestions()
      } : null,
      meta: {
        processingTime,
        profileAdapted: !!userProfile,
        behaviorConfidence: userProfile?.confidenceScore || 0
      }
    };

    console.log('✅ Adaptive response generated:', {
      responseType: response.inputType,
      hasProfile: !!userProfile,
      processingTime,
      adapted: !!userProfile
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Test UI API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error',
        response: {
          id: 'error-fallback',
          message: "I encountered an issue, but let's continue. What would you like to work on?",
          inputType: 'textarea',
          placeholder: 'Tell me what you\'d like to focus on...'
        }
      }, 
      { status: 500 }
    );
  }
}

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

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    
    return NextResponse.json({
      success: true,
      availableCommands: Object.keys(TEST_COMMANDS),
      supportedComponents: [
        'select',
        'multiSelect', 
        'colorSelect',
        'yesNoMaybe',
        'text',
        'textarea',
        'multiPart',
        'fileUpload'
      ],
      testExamples: [
        { input: 'send a test multi-input', description: 'Test multi-part question sequence' },
        { input: 'send a test image-upload', description: 'Test file upload component' },
        { input: 'send a test color-picker', description: 'Test color selection component (hardcoded 5 colors)' },
        { input: 'send a test feature-selection', description: 'Test multi-select component' },
        { input: 'send a test text-input', description: 'Test text input with suggestions' },
        { input: 'send a test description-input', description: 'Test textarea component' }
      ],
      naturalColorExamples: [
        { input: 'show me 12 colors for my business', description: 'Generate 12 contextual colors' },
        { input: 'what colors work for healthcare?', description: 'Generate healthcare-specific colors' },
        { input: 'I need color options for my tech startup', description: 'Generate tech-focused color palette' },
        { input: 'give me professional business colors', description: 'Generate professional color scheme' }
      ]
    });

  } catch (error) {
    console.error('UI Test API GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get test info' },
      { status: 500 }
    );
  }
} 