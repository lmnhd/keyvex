// UI Flow Testing API Route - Connects to test-ui page for real workflow testing

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText, streamObject, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { requireAuth, debugLog } from '@/lib/auth/debug';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import { getBehaviorTracker } from '@/lib/ai/behavior-tracker';

// Request schema for UI flow testing
const uiTestRequestSchema = z.object({
  userInput: z.string(),
  conversationHistory: z.array(z.any()).optional(),
  collectedAnswers: z.record(z.string()).optional(),
  currentStep: z.number().optional(),
  command: z.string().optional(), // For testing specific commands
  provider: z.enum(['openai', 'anthropic']).optional(),
  model: z.string().optional()
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
  id: z.string(),
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
  reasoning: z.string().optional()
});

// Test command handlers
const TEST_COMMANDS = {
  'send-multi-input': () => ({
    message: "Let's gather some key information about your business. I'll ask you a few quick questions:",
    inputType: 'multiPart' as const,
    id: 'test-multi-sequence',
    questions: [
      {
        id: 'business-name',
        question: "What's your business name?",
        inputType: 'textarea',
        placeholder: 'Enter your business name...',
        suggestions: ['Acme Corp', 'Digital Solutions Inc', 'Consulting Pro']
      },
      {
        id: 'industry-type',
        question: "What industry are you in?",
        inputType: 'select',
        options: [
          { value: 'tech', label: 'Technology' },
          { value: 'healthcare', label: 'Healthcare' },
          { value: 'finance', label: 'Finance' },
          { value: 'consulting', label: 'Consulting' },
          { value: 'ecommerce', label: 'E-commerce' }
        ],
        allowCustom: true
      },
      {
        id: 'team-size',
        question: "How large is your team?",
        inputType: 'yesNoMaybe',
        options: [
          { value: 'small', label: 'Small (1-10)' },
          { value: 'medium', label: 'Medium (11-50)' },
          { value: 'large', label: 'Large (50+)' }
        ]
      },
      {
        id: 'main-goals',
        question: "What are your main business goals? (Select up to 3)",
        inputType: 'multiSelect',
        options: [
          { value: 'growth', label: 'Business Growth' },
          { value: 'efficiency', label: 'Operational Efficiency' },
          { value: 'customer', label: 'Customer Satisfaction' },
          { value: 'revenue', label: 'Revenue Increase' },
          { value: 'automation', label: 'Process Automation' }
        ],
        maxSelections: 3
      }
    ],
    reasoning: 'Testing multi-part question sequence with different input types'
  }),

  'send-image-upload': () => ({
    message: "Perfect! Let's analyze your brand assets. Please upload your logo, website screenshot, or any brand materials you have:",
    inputType: 'fileUpload' as const,
    id: 'test-brand-upload',
    acceptedFileTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
    maxFileSize: '5MB',
    placeholder: 'Upload your logo, website screenshot, or brand materials',
    reasoning: 'Testing file upload component for brand analysis'
  }),

  'send-color-picker': () => ({
    message: "Great! Now let's choose colors that represent your brand perfectly:",
    inputType: 'colorSelect' as const,
    id: 'test-color-selection',
    options: [
      { value: 'professional-blue', label: 'Professional Blue', colors: ['#2563eb', '#1e40af'] },
      { value: 'growth-green', label: 'Growth Green', colors: ['#059669', '#047857'] },
      { value: 'creative-purple', label: 'Creative Purple', colors: ['#7c3aed', '#5b21b6'] },
      { value: 'energy-orange', label: 'Energy Orange', colors: ['#ea580c', '#c2410c'] },
      { value: 'trust-teal', label: 'Trust Teal', colors: ['#0891b2', '#0e7490'] }
    ],
    allowCustom: true,
    reasoning: 'Testing color selection with custom color picker integration'
  }),

  'send-feature-selection': () => ({
    message: "Excellent! Which features would make your tool most valuable? (Choose up to 4)",
    inputType: 'multiSelect' as const,
    id: 'test-feature-selection',
    options: [
      { value: 'analytics', label: 'Advanced Analytics' },
      { value: 'export', label: 'PDF Export' },
      { value: 'integration', label: 'CRM Integration' },
      { value: 'sharing', label: 'Social Sharing' },
      { value: 'automation', label: 'Email Automation' },
      { value: 'customization', label: 'Custom Branding' }
    ],
    maxSelections: 4,
    reasoning: 'Testing multi-select with reasonable limits'
  }),

  'send-text-input': () => ({
    message: "What should we call your new business tool?",
    inputType: 'text' as const,
    id: 'test-tool-naming',
    placeholder: 'e.g., "ROI Calculator for Marketing Campaigns"',
    suggestions: [
      'Business ROI Calculator',
      'Marketing Effectiveness Tool',
      'Cost-Benefit Analyzer',
      'Investment Calculator'
    ],
    reasoning: 'Testing text input with helpful suggestions'
  }),

  'send-description-input': () => ({
    message: "Tell me more about what this tool should help your customers achieve:",
    inputType: 'textarea' as const,
    id: 'test-tool-description',
    placeholder: 'Describe the main problem this tool solves, who will use it, and what results they should get...',
    reasoning: 'Testing textarea for detailed descriptions'
  })
};

// AI assistant prompt for natural responses
const UI_TEST_ASSISTANT_PROMPT = `You are a UI/UX Testing Assistant for a business tool creation platform. Your job is to:

1. Analyze user input and conversation context
2. Generate realistic, helpful responses that test different UI components
3. Provide natural conversation flow that feels like working with a real AI assistant
4. Test various input types and component combinations
5. Maintain enthusiasm and guide users through tool creation

Available input components to test:
- select: Dropdown with options (single choice)
- multiSelect: Multiple checkboxes (for features, capabilities)
- colorSelect: Color palette selection with custom picker
- yesNoMaybe: Simple radio buttons (2-3 options max)
- text: Single-line input with suggestion chips
- textarea: Multi-line text for descriptions
- multiPart: Sequential question flow (3-5 questions)
- fileUpload: File/image upload for brand assets

Special test commands you should recognize (only these exact phrases):
- "send a test multi-input" → Use multiPart component
- "send a test image-upload" → Use fileUpload component  
- "send a test color-picker" → Use colorSelect component
- "send a test feature-selection" → Use multiSelect component

IMPORTANT: For any other requests (like "12 colors", "show me colors", "color options"), generate NATURAL responses, not test commands!

COLOR SELECTION GUIDELINES:
When users ask for colors (e.g., "12 colors", "show me color options", "what colors work for my business"):
- Generate a colorSelect component with the requested number of colors (or 6-8 if not specified)
- Create contextually relevant color names based on their business/industry
- Use meaningful labels like "Healthcare Blue", "Tech Innovation Purple", "Financial Trust Navy"
- Provide proper hex color pairs [primary, secondary] for each option
- Always set allowCustom: true

Example color generation for healthcare business:
{
  "inputType": "colorSelect",
  "options": [
    { "value": "medical-blue", "label": "Medical Blue", "colors": ["#0ea5e9", "#0284c7"] },
    { "value": "healing-green", "label": "Healing Green", "colors": ["#22c55e", "#16a34a"] },
    { "value": "trust-navy", "label": "Trust Navy", "colors": ["#1e40af", "#1d4ed8"] },
    { "value": "care-teal", "label": "Care Teal", "colors": ["#14b8a6", "#0d9488"] },
    { "value": "wellness-purple", "label": "Wellness Purple", "colors": ["#8b5cf6", "#7c3aed"] },
    { "value": "calm-gray", "label": "Calm Gray", "colors": ["#64748b", "#475569"] }
  ],
  "allowCustom": true
}

For each response, provide:
1. Natural, engaging message text
2. Appropriate input component type
3. Realistic options/suggestions
4. Clear reasoning for component choice

Always maintain a helpful, enthusiastic tone and make the interaction feel smooth and professional.`;

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
  if (lowerInput.includes('send a test multi-input') || lowerInput.includes('test multi-input')) {
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
    const { userInput, conversationHistory, collectedAnswers, currentStep } = validatedData;

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
      const model = primaryModel ? createModelInstance(primaryModel.provider, primaryModel.modelInfo.id) : openai('gpt-4');

      // Create adaptive prompt based on user profile
      const adaptivePrompt = createAdaptivePrompt(userInput, userProfile, conversationHistory || [], collectedAnswers || {});

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
      } catch (aiError) {
        console.error('❌ AI generation failed:', aiError);
        
        // Fallback to adaptive mock response
        response = generateAdaptiveAIResponse(
          userInput, 
          userProfile,
          conversationHistory || [], 
          collectedAnswers || {}
        );
      }
    }

    // Simulate processing time based on user profile (shorter for users who prefer quick mode)
    const processingTime = userProfile && userProfile.averageResponseTime < 5000 ? 500 : 1200;
    await new Promise(resolve => setTimeout(resolve, processingTime));

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
      return openai('gpt-4');
  }
}

// Helper function to create adaptive prompts
function createAdaptivePrompt(
  userInput: string,
  userProfile: any,
  conversationHistory: any[],
  collectedAnswers: any
): string {
  const suggestions = userProfile ? {
    preferQuickMode: (userProfile.averageResponseTime || 10000) < 5000 && !userProfile.likelyToEditAnswers,
    showAdvancedOptions: (userProfile.explorationTendency || 0) > 0.5,
    recommendedComplexity: userProfile.preferredComplexity || 'medium',
    preferredInputTypes: userProfile.preferredInputTypes || ['select', 'textarea']
  } : {
    preferQuickMode: false,
    showAdvancedOptions: false,
    recommendedComplexity: 'medium',
    preferredInputTypes: ['select', 'textarea']
  };

  const basePrompt = `${UI_TEST_ASSISTANT_PROMPT}

ADAPTIVE BEHAVIOR INSTRUCTIONS:
Based on user's interaction patterns, adapt your responses:

User Profile Summary:
- Quick Mode Preference: ${suggestions.preferQuickMode ? 'YES - Keep responses concise and efficient' : 'NO - Detailed explanations welcome'}
- Advanced Options: ${suggestions.showAdvancedOptions ? 'YES - Show comprehensive options' : 'NO - Keep options simple'}
- Complexity Level: ${suggestions.recommendedComplexity.toUpperCase()} - adjust question depth accordingly
- Preferred Input Types: ${suggestions.preferredInputTypes.join(', ')} - favor these when possible

Response Guidelines:
1. If user prefers quick mode: Use simple language, fewer options, streamlined flows
2. If user likes advanced options: Show comprehensive choices, detailed explanations
3. Choose input components that match their preferred interaction style
4. Adjust complexity level based on their historical preferences

Current Context:
- User Input: "${userInput}"
- Conversation History: ${conversationHistory.length} previous exchanges
- Collected Data: ${Object.keys(collectedAnswers).length} answers so far

Generate an appropriate UI component response that matches this user's behavior patterns.`;

  return basePrompt;
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