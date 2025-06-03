// Create Tool Core Logic - Reusable business logic for Lambda compatibility

import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import { aiOrchestrator, ToolCreationRequest, StreamingCallbacks } from '@/lib/ai/orchestrator';
import * as babel from '@babel/core';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { getToolCreationSystemPrompt, buildToolCreationUserPrompt, PromptOptions } from '@/lib/prompts/tool-creation-prompt-modular';
import { trackValidationIssue } from '@/lib/validation/validation-tracker';

// Core request interface
export interface CreateToolRequest {
  expertise: string;
  targetAudience: string;
  goals: string[];
  branding: {
    companyName?: string;
    industry?: string;
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
    fonts?: {
      heading?: string;
      body?: string;
    };
    tone: string;
    logoUrl?: string;
    existingBrandAssets?: string[];
  };
  industry?: string;
  selectedSuggestion?: any;
  customFramework?: {
    methodology?: string;
    existingContent?: string;
  };
  contentPreferences?: {
    tone?: string;
    style?: string;
    language?: string;
  };
  stylePreferences?: {
    theme?: string;
    colorScheme?: string;
    layout?: string;
  };
  provider?: 'openai' | 'anthropic';
  streaming?: boolean;
  sessionId?: string;
  userId: string;
}

// Core response interface
export interface CreateToolResponse {
  success: boolean;
  data: any;
  metadata: {
    processingTime: number;
    sessionId: string;
    provider: string;
    quality: any;
  };
}

// Streaming callback interface
export interface CreateToolStreamingCallbacks {
  onStepStart?: (step: string) => void;
  onStepProgress?: (step: string, progress: number) => void;
  onStepComplete?: (step: string, result: any) => void;
  onError?: (step: string, error: Error) => void;
  onComplete?: (result: any) => void;
}

// Core processing context
export interface CreateToolContext {
  request: CreateToolRequest;
  startTime: number;
  selectedModel?: string;
}

// Add validation result interface
export interface ToolValidationResult {
  isValid: boolean;
  issues: Array<{
    id: string;
    issue: string;
    category: string;
    severity: 'warning' | 'error' | 'info';
    details?: string;
    codeSnippet?: string;
    autoFixable: boolean;
  }>;
  blockers: Array<{
    issue: string;
    category: string;
    details?: string;
  }>;
  // NEW: Metadata for Final Polish stage tracking
  timestamp?: number;
  attempt?: number;
  sessionPhase?: 'initial_creation' | 'iteration' | 'final_polish' | 'ai_processing_creation';
  userContext?: {
    selectedModel?: string;
    hasExternalBrainstorming?: boolean;
    toolComplexity?: string;
  };
}

// Enhanced return type to include validation
export interface ToolCreationResult {
  tool: ProductToolDefinition;
  validation: ToolValidationResult;
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

// Main processing function
export async function processCreateToolRequest(
  request: CreateToolRequest
): Promise<CreateToolResponse> {
  const context = await initializeCreateToolContext(request);
  
  try {
    // Switch provider if needed
    if (request.provider && request.provider !== aiOrchestrator.getStatus().provider) {
      aiOrchestrator.switchProvider(request.provider);
    }

    // Create tool request for orchestrator
    const toolRequest: ToolCreationRequest = {
      expertise: request.expertise,
      targetAudience: request.targetAudience,
      industry: request.industry,
      goals: request.goals,
      branding: request.branding,
      selectedSuggestion: request.selectedSuggestion,
      customFramework: request.customFramework,
      contentPreferences: request.contentPreferences,
      stylePreferences: request.stylePreferences,
      provider: request.provider || 'anthropic',
      streaming: false,
      sessionId: request.sessionId
    };

    // Create tool with orchestrator
    const result = await aiOrchestrator.createTool(toolRequest);

    // Update session with results
    await updateAISession(request.userId, result.metadata.sessionId, {
      action: 'create-tool',
      request: toolRequest,
      result,
      metadata: {
        ...result.metadata,
        userId: request.userId,
        completedAt: new Date()
      }
    });

    return {
      success: true,
      data: result,
      metadata: {
        processingTime: Date.now() - context.startTime,
        sessionId: result.metadata.sessionId,
        provider: result.metadata.provider,
        quality: result.metadata.quality
      }
    };

  } catch (error) {
    throw error; // Let the route handler deal with error formatting
  }
}

// Streaming processing function
export async function processCreateToolStreaming(
  request: CreateToolRequest,
  callbacks: CreateToolStreamingCallbacks
): Promise<void> {
  const context = await initializeCreateToolContext(request);
  const sessionId = request.sessionId || generateSessionId();

  try {
    // Switch provider if needed
    if (request.provider && request.provider !== aiOrchestrator.getStatus().provider) {
      aiOrchestrator.switchProvider(request.provider);
    }

    // Create tool request for orchestrator
    const toolRequest: ToolCreationRequest = {
      expertise: request.expertise,
      targetAudience: request.targetAudience,
      industry: request.industry,
      goals: request.goals,
      branding: request.branding,
      selectedSuggestion: request.selectedSuggestion,
      customFramework: request.customFramework,
      contentPreferences: request.contentPreferences,
      stylePreferences: request.stylePreferences,
      provider: request.provider || 'anthropic',
      streaming: true,
      sessionId
    };

    // Set up streaming callbacks for orchestrator
    const orchestratorCallbacks: StreamingCallbacks = {
      onStepStart: (step) => {
        callbacks.onStepStart?.(step);
      },

      onStepProgress: (step, progress) => {
        callbacks.onStepProgress?.(step, progress);
      },

      onStepComplete: (step, result) => {
        callbacks.onStepComplete?.(step, result);
      },

      onError: (step, error) => {
        callbacks.onError?.(step, error);
      },

      onComplete: async (result) => {
        // Update session with final results
        await updateAISession(request.userId, sessionId, {
          action: 'create-tool-streaming',
          request: toolRequest,
          result,
          metadata: {
            ...result.metadata,
            userId: request.userId,
            completedAt: new Date(),
            streaming: true
          }
        });

        callbacks.onComplete?.(result);
      }
    };

    // Start streaming tool creation
    await aiOrchestrator.streamToolCreation(toolRequest, orchestratorCallbacks);

  } catch (error) {
    callbacks.onError?.('streaming', error instanceof Error ? error : new Error('Unknown error'));
  }
}

// Session retrieval function
export async function getCreateToolSession(
  userId: string,
  sessionId: string
): Promise<any | null> {
  try {
    // TODO: Replace with actual database implementation
    console.log('Getting Create Tool session:', { userId, sessionId });
    return null;
  } catch (error) {
    console.error('Failed to get Create Tool session:', error);
    return null;
  }
}

// Orchestrator status function
export function getCreateToolStatus(): any {
  return aiOrchestrator.getStatus();
}

// Helper functions
async function initializeCreateToolContext(
  request: CreateToolRequest
): Promise<CreateToolContext> {
  const startTime = Date.now();

  return {
    request,
    startTime
  };
}

function generateSessionId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function updateAISession(
  userId: string,
  sessionId: string,
  data: any
): Promise<void> {
  try {
    // TODO: Replace with actual database implementation
    console.log('Updating Create Tool AI session:', { userId, sessionId, data });
  } catch (error) {
    console.error('Failed to update Create Tool AI session:', error);
  }
}

// Rate limiting function
export async function checkCreateToolRateLimit(userId: string): Promise<boolean> {
  // TODO: Implement actual rate limiting with Redis/DynamoDB
  return true;
}

// Usage tracking function
export async function trackCreateToolUsage(
  userId: string,
  action: string,
  metadata: any
): Promise<void> {
  // TODO: Implement usage tracking with DynamoDB
  console.log('Create Tool usage tracked:', { userId, action, metadata });
}

// Quality validation function
export async function validateCreateToolQuality(result: any): Promise<{
  isValid: boolean;
  issues: string[];
  score: number;
}> {
  // TODO: Implement comprehensive quality validation
  return {
    isValid: true,
    issues: [],
    score: result.metadata?.quality?.overall || 8.0
  };
}

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

// Enhanced tool processing logic (without JSX compilation)
export async function processToolCreation(
  userIntent: string,
  context: any,
  existingTool?: ProductToolDefinition | null,
  userId?: string
): Promise<ToolCreationResult> {
  console.log('🏭 TRACE: processToolCreation START');
  console.log('🏭 TRACE: userIntent:', userIntent);
  console.log('🏭 TRACE: context received:', JSON.stringify(context, null, 2));
  console.log('🏭 TRACE: existingTool:', existingTool?.id || 'none');
  
  const validationIssues: ToolValidationResult['issues'] = [];
  const validationBlockers: ToolValidationResult['blockers'] = [];
  
  // Helper function to track issues and collect them for return
  const trackIssue = (
    issue: string,
    category: 'react-keys' | 'style-mapping' | 'execution' | 'undefined-values' | 'syntax' | 'component-structure',
    severity: 'warning' | 'error' | 'info' = 'warning',
    details?: string,
    codeSnippet?: string,
    autoFixable: boolean = false
  ) => {
    const toolId = context.toolId || 'creating';
    const toolTitle = context.toolTitle || 'New Tool';
    
    // Track in global system
    const issueId = trackValidationIssue(toolId, toolTitle, issue, category, severity, details, codeSnippet, autoFixable);
    
    // Also collect for immediate return
    validationIssues.push({
      id: issueId,
      issue,
      category,
      severity,
      details,
      codeSnippet,
      autoFixable
    });
    
    // Track blockers separately (errors that prevent tool completion)
    if (severity === 'error') {
      validationBlockers.push({
        issue,
        category,
        details
      });
    }
    
    return issueId;
  };
  
  try {
    // Get AI model configuration - UPDATED: Use selectedModel from context or fallback to configured model
    const selectedModel = context.selectedModel; // Get from context instead of validatedData
    let modelConfig;
    let actualModelId = 'gpt-4o'; // Default fallback
    let actualModelName = 'unknown';
    
    if (selectedModel) {
      // Use the user-selected model
      console.log('🤖 TRACE: Using user-selected model:', selectedModel);
      const detectedProvider = getModelProvider(selectedModel);
      
      if (detectedProvider !== 'unknown') {
        modelConfig = { provider: detectedProvider, modelId: selectedModel };
        actualModelId = selectedModel;
        actualModelName = selectedModel; // For user-selected, the ID is the name
        console.log('🤖 TRACE: Detected provider:', detectedProvider, 'for model:', selectedModel);
      } else {
        console.warn('🤖 TRACE: Could not detect provider for model:', selectedModel, 'using fallback');
        modelConfig = getFallbackModel('toolCreation');
        if (modelConfig && 'modelInfo' in modelConfig) {
          actualModelId = modelConfig.modelInfo.id;
          actualModelName = modelConfig.modelInfo.id;
        }
      }
    } else {
      // Use the configured primary model
      console.log('🤖 TRACE: Using default configured model');
      modelConfig = getPrimaryModel('toolCreation');
      
      if (modelConfig && 'modelInfo' in modelConfig) {
        actualModelId = modelConfig.modelInfo.id;
        actualModelName = modelConfig.modelInfo.id;
        console.log('🤖 TRACE: Default model info:', modelConfig.modelInfo);
      } else {
        console.warn('🤖 TRACE: No model info available, using fallback');
        actualModelId = 'gpt-4o';
        actualModelName = 'gpt-4o';
        modelConfig = { provider: 'openai', modelId: 'gpt-4o' }; // Ensure modelConfig is not null
      }
    }
    
    console.log('🚀 Create Tool Agent Model Selection:');
    console.log('   📡 Provider:', modelConfig?.provider);
    console.log('   🤖 Model Name:', actualModelName);
    console.log('   🎯 Selection Method:', selectedModel ? 'User Selected' : 'Default Config');
    
    // Load external brainstorming context if available
    let brainstormingContext = null;
    if (context.brainstormingResult || context.logicArchitectInsights) {
      brainstormingContext = context.brainstormingResult || context.logicArchitectInsights;
      console.log('🏭 TRACE: ✅ External brainstorming loaded:', JSON.stringify(brainstormingContext, null, 2));
    } else {
      console.log('🏭 TRACE: ⚠️ No external brainstorming context available');
    }

    // Determine if this is an update or new creation
    const isUpdate = !!existingTool;
    const updateType = context.updateType || 'general';
    
    console.log('🏭 TRACE: isUpdate:', isUpdate, 'updateType:', updateType);

    // Build the user prompt with all available context
    console.log('🏭 TRACE: Building user prompt...');
    const userPrompt = buildToolCreationUserPrompt(
      userIntent,
      {
        ...context,
        brainstormingResult: brainstormingContext,
        logicArchitectInsights: brainstormingContext
      },
      existingTool,
      updateType
    );
    
    console.log('🏭 TRACE: User prompt built, length:', userPrompt.length);
    console.log('🏭 TRACE: User prompt preview (first 500 chars):', userPrompt.substring(0, 500));

    // Get the system prompt with context-aware selection
    console.log('🏭 TRACE: Building context-aware system prompt...');
    
    // Use PromptOptions from logic architect if available, otherwise analyze context manually
    let promptOptions: PromptOptions;
    
    if (brainstormingContext && brainstormingContext.promptOptions) {
      console.log('🏭 TRACE: Using PromptOptions from logic architect brainstorming');
      promptOptions = brainstormingContext.promptOptions;
    } else {
      console.log('🏭 TRACE: No logic architect PromptOptions available, analyzing context manually');
      // 🎨 ENHANCED: Default to premium styling for better-looking tools
      // Previous logic was too conservative, resulting in basic-looking tools
      promptOptions = {
        includeComprehensiveColors: true, // Always include comprehensive color guidance
        includeGorgeousStyling: true, // Always include gorgeous styling library
        includeAdvancedLayouts: context.isComplexTool || context.toolComplexity === 'complex' || context.features?.includes('charts'),
        styleComplexity: context.styleComplexity || 'premium', // Default to premium instead of basic
        industryFocus: context.industry,
        toolComplexity: context.toolType?.includes('Calculator') ? 'complex' : 'moderate'
      };
      
      console.log('🎨 ENHANCED: Using premium styling defaults for better visual quality');
    }
    
    const systemPrompt = getToolCreationSystemPrompt(promptOptions);
    console.log('🏭 TRACE: System prompt built with options:', promptOptions);
    console.log('🏭 TRACE: System prompt length:', systemPrompt.length);

    // Generate tool definition using AI
    console.log('🏭 TRACE: Calling AI model...');
    console.log('🚀 🚀 🚀 ABOUT TO CALL AI MODEL:', actualModelId, '🚀 🚀 🚀');
    
    // Create the actual model instance
    let modelInstance;
    if (modelConfig && 'modelInfo' in modelConfig && modelConfig.modelInfo) {
      // Use configured model from getPrimaryModel
      modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelInfo.id);
      console.log('🚀 USING CONFIGURED MODEL:', modelConfig.modelInfo.id, 'via provider:', modelConfig.provider);
    } else if (modelConfig && 'modelId' in modelConfig && modelConfig.modelId) {
      // Use user-selected model  
      modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);
      console.log('🚀 USING USER-SELECTED MODEL:', modelConfig.modelId, 'via provider:', modelConfig.provider);
    } else {
      // Fallback to default
      modelInstance = openai('gpt-4o');
      console.log('🚀 USING FALLBACK MODEL: gpt-4o');
    }
    
    const result = await generateObject({
      model: modelInstance,
      schema: productToolDefinitionSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.7,
      maxRetries: 3
    });
    
    console.log('🏭 TRACE: ⚠️ ACTUAL PROMPT SENT TO AI:');
    console.log('🏭 TRACE: System prompt full text:', systemPrompt);
    console.log('🏭 TRACE: User prompt full text:', userPrompt);
    console.log('🏭 TRACE: ==========================================');

    console.log('🏭 TRACE: AI model response received');
    console.log('🏭 TRACE: Raw AI response object keys:', Object.keys(result.object));
    console.log('🏭 TRACE: AI response ID:', result.object.id);
    console.log('🏭 TRACE: AI response slug:', result.object.slug);
    console.log('🏭 TRACE: AI response metadata.title:', result.object.metadata?.title);
    
    // Check for undefined values in AI response
    const aiUndefinedFields = [];
    if (!result.object.id || String(result.object.id).includes('undefined')) {
      aiUndefinedFields.push('id: ' + result.object.id);
    }
    if (!result.object.slug || String(result.object.slug).includes('undefined')) {
      aiUndefinedFields.push('slug: ' + result.object.slug);
    }
    if (!result.object.metadata?.id || String(result.object.metadata.id).includes('undefined')) {
      aiUndefinedFields.push('metadata.id: ' + result.object.metadata?.id);
    }
    if (!result.object.metadata?.slug || String(result.object.metadata.slug).includes('undefined')) {
      aiUndefinedFields.push('metadata.slug: ' + result.object.metadata?.slug);
    }
    
    if (aiUndefinedFields.length > 0) {
      console.error('🏭 TRACE: ⚠️ UNDEFINED VALUES in AI response:', aiUndefinedFields);
      console.error('🏭 TRACE: Raw AI response with undefined values:', JSON.stringify(result.object, null, 2));
    } else {
      console.log('🏭 TRACE: ✅ No undefined values in AI response');
    }

    // Transform AI response to ProductToolDefinition
    console.log('🏭 TRACE: Transforming AI response to ProductToolDefinition...');
    const toolDefinition: ProductToolDefinition = {
      id: result.object.id,
      slug: result.object.slug,
      version: result.object.version || '1.0.0',
      status: result.object.status || 'draft',
      createdAt: result.object.createdAt || Date.now(),
      updatedAt: Date.now(),
      createdBy: userId || 'ai-agent',
      
      metadata: {
        ...result.object.metadata,
        // Ensure critical fields are properly set
        id: result.object.metadata.id || result.object.id,
        slug: result.object.metadata.slug || result.object.slug
      },
      
      componentCode: result.object.componentCode,
      initialStyleMap: result.object.initialStyleMap || {},
      currentStyleMap: result.object.currentStyleMap || result.object.initialStyleMap || {},
      colorScheme: result.object.colorScheme,
      analytics: result.object.analytics || {
        enabled: true,
        completions: 0,
        averageTime: 0
      }
    };

    console.log('🏭 TRACE: Final tool definition created');
    console.log('🏭 TRACE: Final ID:', toolDefinition.id);
    console.log('🏭 TRACE: Final slug:', toolDefinition.slug);
    console.log('🏭 TRACE: Final metadata.id:', toolDefinition.metadata.id);
    console.log('🏭 TRACE: Final metadata.slug:', toolDefinition.metadata.slug);
    console.log('🏭 TRACE: Final metadata.title:', toolDefinition.metadata.title);
    console.log('🏭 TRACE: ComponentCode length:', toolDefinition.componentCode?.length || 0);
    console.log('🏭 TRACE: InitialStyleMap keys:', Object.keys(toolDefinition.initialStyleMap || {}));

    // Final check for undefined values in the final tool definition
    const finalUndefinedFields = [];
    if (!toolDefinition.id || String(toolDefinition.id).includes('undefined')) {
      finalUndefinedFields.push('id: ' + toolDefinition.id);
    }
    if (!toolDefinition.slug || String(toolDefinition.slug).includes('undefined')) {
      finalUndefinedFields.push('slug: ' + toolDefinition.slug);
    }
    if (!toolDefinition.metadata?.id || String(toolDefinition.metadata.id).includes('undefined')) {
      finalUndefinedFields.push('metadata.id: ' + toolDefinition.metadata?.id);
    }
    if (!toolDefinition.metadata?.slug || String(toolDefinition.metadata.slug).includes('undefined')) {
      finalUndefinedFields.push('metadata.slug: ' + toolDefinition.metadata?.slug);
    }
    
    if (finalUndefinedFields.length > 0) {
      console.error('🏭 TRACE: ⚠️ UNDEFINED VALUES in final tool definition:', finalUndefinedFields);
      console.error('🏭 TRACE: This is the source of the Component contains undefined values error!');
      // Throw an error to prevent returning corrupted data
      throw new Error(`Tool definition contains undefined values: ${finalUndefinedFields.join(', ')}`);
    } else {
      console.log('🏭 TRACE: ✅ Final tool definition is clean - no undefined values');
    }

    // 🛡️ COMPREHENSIVE TOOL VALIDATION - Prevent saving bad tools AND collect issues for UI
    console.log('🛡️ VALIDATION: Running comprehensive tool validation...');
    
    // 1. Check for Card component usage (will cause ReferenceError since removed from renderer)
    if (toolDefinition.componentCode.includes('Card') || 
        toolDefinition.componentCode.includes('CardHeader') ||
        toolDefinition.componentCode.includes('CardContent') ||
        toolDefinition.componentCode.includes('CardTitle')) {
      trackIssue(
        'Tool uses forbidden Card components',
        'component-structure',
        'error',
        'Card components are no longer available in execution context and will cause runtime errors',
        'Card, CardHeader, CardContent, CardTitle',
        false
      );
    }
    
    // 2. Test JavaScript execution safety (same as DynamicComponentRenderer)
    try {
      console.log('🛡️ VALIDATION: Testing JavaScript execution safety...');
      const testFunction = new Function(`
        "use strict";
        const React = { createElement: () => null };
        const useState = () => [null, () => {}];
        const useEffect = () => {};
        const useCallback = () => {};
        const useMemo = () => {};
        const Button = () => null;
        const Input = () => null;
        const Label = () => null;
        
        try {
          ${toolDefinition.componentCode}
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      `);
      
      const testResult = testFunction();
      if (!testResult.success) {
        trackIssue(
          'Component code execution failed',
          'execution',
          'error',
          `JavaScript execution test failed: ${testResult.error}`,
          toolDefinition.componentCode.substring(0, 200),
          false
        );
      } else {
        console.log('🛡️ VALIDATION: ✅ JavaScript execution test passed');
      }
    } catch (error) {
      trackIssue(
        'Component code validation failed',
        'execution',
        'error',
        `Validation threw error: ${error instanceof Error ? error.message : String(error)}`,
        toolDefinition.componentCode.substring(0, 200),
        false
      );
    }
    
    // 3. Check for React component function pattern - ENHANCED: More robust detection
    const functionPatterns = [
      /function\s+\w+\s*\([^)]*\)\s*\{/,           // Traditional function declaration
      /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{/,    // Arrow function with const
      /const\s+\w+\s*=\s*function\s*\([^)]*\)\s*\{/, // Function expression with const
    ];
    
    let hasValidFunction = false;
    let foundFunctionName = '';
    
    for (const pattern of functionPatterns) {
      const match = toolDefinition.componentCode.match(pattern);
      if (match) {
        hasValidFunction = true;
        foundFunctionName = match[0];
        break;
      }
    }
    
    // DEBUG: Log component code details for troubleshooting
    console.log('🛡️ VALIDATION: Component code preview (first 500 chars):', toolDefinition.componentCode.substring(0, 500));
    console.log('🛡️ VALIDATION: Function pattern search result:', { hasValidFunction, foundFunctionName });
    
    if (!hasValidFunction) {
      // ENHANCED: Try more flexible pattern detection
      const flexiblePattern = /function\s+\w+|const\s+\w+\s*=/;
      const flexibleMatch = toolDefinition.componentCode.match(flexiblePattern);
      
      if (flexibleMatch) {
        console.log('🛡️ VALIDATION: Found function-like pattern with flexible search:', flexibleMatch[0]);
        hasValidFunction = true;
      } else {
        console.error('🛡️ VALIDATION: No function declarations found. Component code sample:');
        console.error(toolDefinition.componentCode.substring(0, 1000));
        trackIssue(
          'Component code does not contain a valid React component function declaration',
          'component-structure',
          'error',
          'No function declarations found in component code',
          toolDefinition.componentCode.substring(0, 300),
          false
        );
      }
    } else {
      console.log('🛡️ VALIDATION: ✅ Found valid React component function:', foundFunctionName.substring(0, 50) + '...');
    }
    
    // 4. Check for required React patterns - REVERTED: React.createElement() ONLY
    console.log('🛡️ VALIDATION: Checking for React.createElement requirement...');
    const hasReactCreateElement = toolDefinition.componentCode.includes('React.createElement');
    console.log('🛡️ VALIDATION: React.createElement check result:', hasReactCreateElement);
    
    if (!hasReactCreateElement) {
      console.error('🛡️ VALIDATION: ❌ CRITICAL - Component does NOT contain React.createElement!');
      console.error('🛡️ VALIDATION: Component code sample (first 1000 chars):');
      console.error(toolDefinition.componentCode.substring(0, 1000));
      trackIssue(
        'Component code does not use React.createElement (required pattern)',
        'component-structure',
        'error',
        'All components must use React.createElement syntax instead of JSX',
        toolDefinition.componentCode.substring(0, 500),
        false
      );
    } else {
      console.log('🛡️ VALIDATION: ✅ Component properly uses React.createElement syntax');
    }
    
    // 5. Check for React state hooks (required for interactive tools)
    if (!toolDefinition.componentCode.includes('useState')) {
      trackIssue(
        'Component code does not contain React state hooks',
        'component-structure',
        'warning',
        'Interactive tools should include useState for user interactions',
        'useState not found',
        false
      );
    }
    
    // 6. Check for problematic undefined patterns
    const problematicPatterns = [
      /,\s*undefined\s*,/g,     // undefined in arrays/function calls
      /,\s*undefined\s*\)/g,    // undefined as last parameter
      /\(\s*undefined\s*,/g,    // undefined as first parameter
      /:\s*undefined\s*,/g,     // undefined as object value
      /=\s*undefined\s*;/g      // undefined assignment
    ];
    
    for (const pattern of problematicPatterns) {
      const matches = toolDefinition.componentCode.match(pattern);
      if (matches) {
        trackIssue(
          'Component code contains problematic undefined patterns',
          'undefined-values',
          'error',
          'Undefined values in data structures cause runtime errors',
          matches.slice(0, 3).join('; '),
          false
        );
        break;
      }
    }
    
    // 7. Check for missing React keys - CHANGED: Warning only, not blocking
    const missingKeysPatterns = [
      /React\.createElement\([^,]+,\s*\{[^}]*\},\s*\[[^\]]*React\.createElement[^\]]*\]/g,
      /\[[^\]]*React\.createElement\([^,]+,\s*\{(?![^}]*key:)[^}]*\}/g,
    ];
    
    let hasMissingKeys = false;
    const foundMissingKeyPatterns: string[] = [];
    
    for (const pattern of missingKeysPatterns) {
      const matches = toolDefinition.componentCode.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (match.includes('[') && match.includes('React.createElement') && !match.includes('key:')) {
            hasMissingKeys = true;
            foundMissingKeyPatterns.push(match.substring(0, 100) + '...');
          }
        }
      }
      if (hasMissingKeys) break;
    }
    
    if (hasMissingKeys) {
      console.warn('🛡️ VALIDATION: ⚠️ Component has arrays without React keys (may cause console warnings)');
      trackIssue(
        'Missing React keys in array elements',
        'react-keys',
        'warning',
        'Arrays containing React elements should have unique key props',
        foundMissingKeyPatterns.slice(0, 2).join('; '),
        true // This is auto-fixable
      );
    }
    
    // 8. Validate required data-style-id attributes - RELAXED: Not all tools need dynamic styling
    if (!toolDefinition.componentCode.includes('data-style-id')) {
      console.log('🛡️ VALIDATION: ⚠️ Component missing data-style-id attributes (dynamic styling disabled)');
      trackIssue(
        'Component missing data-style-id attributes',
        'style-mapping',
        'info',
        'Dynamic styling will be disabled for this component',
        'data-style-id not found',
        true
      );
    }
    
    // 9. Validate initialStyleMap completeness - RELAXED: Allow empty style maps
    // Note: initialStyleMap can be empty for simple tools that don't require custom styling
    if (toolDefinition.initialStyleMap === null || toolDefinition.initialStyleMap === undefined) {
      console.log('🛡️ VALIDATION: ⚠️ initialStyleMap is null/undefined, setting to empty object');
      toolDefinition.initialStyleMap = {};
    }
    
    // 10. Check for common syntax errors that cause crashes
    if (toolDefinition.componentCode.includes('import ') || toolDefinition.componentCode.includes('export ')) {
      trackIssue(
        'Component code contains import/export statements',
        'syntax',
        'error',
        'Import/export statements are forbidden in dynamic execution',
        'import/export detected',
        false
      );
    }
    
    // 11. Check for template strings with variable interpolation (causes ReferenceError in dynamic execution)
    const templateStringPattern = /`[^`]*\$\{[^}]+\}[^`]*`/;
    if (templateStringPattern.test(toolDefinition.componentCode)) {
      trackIssue(
        'Component code contains template strings with variable interpolation',
        'syntax',
        'error',
        'Template strings with ${} cause ReferenceError in dynamic execution context - use string concatenation instead',
        'Template string detected',
        false
      );
    }
    
    // Determine if validation passes
    const hasBlockingErrors = validationBlockers.length > 0;
    
    // If validation failed with blocking errors, throw error to prevent saving bad tool
    if (hasBlockingErrors) {
      console.error('🛡️ VALIDATION: ❌ Tool validation FAILED with blocking errors:', validationBlockers);
      throw new Error(`Tool validation failed with ${validationBlockers.length} blocking error(s): ${validationBlockers.map(b => b.issue).join('; ')}`);
    }
    
    console.log('🛡️ VALIDATION: ✅ Tool validation PASSED - safe to save');
    if (validationIssues.length > 0) {
      console.log('🛡️ VALIDATION: ⚠️ Found', validationIssues.length, 'non-blocking issues');
    }

    const validationResult: ToolValidationResult = {
      isValid: !hasBlockingErrors,
      issues: validationIssues,
      blockers: validationBlockers,
      // NEW: Metadata for Final Polish stage tracking
      timestamp: Date.now(),
      attempt: 1,
      sessionPhase: 'initial_creation',
      userContext: {
        selectedModel: selectedModel,
        hasExternalBrainstorming: !!brainstormingContext,
        toolComplexity: context.toolComplexity || 'unknown'
      }
    };

    console.log('🏭 TRACE: processToolCreation SUCCESS - returning tool with validation results');
    return {
      tool: toolDefinition,
      validation: validationResult
    };

  } catch (error) {
    console.error('🏭 TRACE: processToolCreation ERROR:', error);
    console.error('🏭 TRACE: Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('🏭 TRACE: Error message:', error instanceof Error ? error.message : String(error));
    console.error('🏭 TRACE: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    throw new Error(`Tool creation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// NEW: Utility functions for Final Polish stage analysis
export interface FinalPolishAnalysis {
  needsPolish: boolean;
  persistentIssues: Array<{
    category: string;
    issue: string;
    frequency: number;
    autoFixable: boolean;
  }>;
  qualityTrend: 'improving' | 'stagnant' | 'degrading';
  recommendedActions: string[];
  polishPriority: 'low' | 'medium' | 'high';
}

/**
 * Analyze validation results across multiple attempts to determine Final Polish needs
 */
export function analyzeFinalPolishNeeds(
  validationResults: ToolValidationResult[]
): FinalPolishAnalysis {
  if (validationResults.length === 0) {
    return {
      needsPolish: false,
      persistentIssues: [],
      qualityTrend: 'improving',
      recommendedActions: ['No validation data available'],
      polishPriority: 'low'
    };
  }

  const latestResult = validationResults[validationResults.length - 1];
  
  // Identify persistent issues across attempts
  const issueFrequency = new Map<string, {
    category: string;
    issue: string;
    count: number;
    autoFixable: boolean;
  }>();
  
  validationResults.forEach(result => {
    result.issues.forEach(issue => {
      const key = `${issue.category}:${issue.issue}`;
      const existing = issueFrequency.get(key);
      if (existing) {
        existing.count++;
      } else {
        issueFrequency.set(key, {
          category: issue.category,
          issue: issue.issue,
          count: 1,
          autoFixable: issue.autoFixable
        });
      }
    });
  });
  
  const persistentIssues = Array.from(issueFrequency.values())
    .filter(item => item.count > validationResults.length * 0.5) // Appears in >50% of attempts
    .map(item => ({
      category: item.category,
      issue: item.issue,
      frequency: item.count / validationResults.length,
      autoFixable: item.autoFixable
    }));
  
  // Analyze quality trend
  let qualityTrend: 'improving' | 'stagnant' | 'degrading' = 'stagnant';
  if (validationResults.length > 1) {
    const firstTotal = validationResults[0].issues.length + validationResults[0].blockers.length;
    const lastTotal = latestResult.issues.length + latestResult.blockers.length;
    
    if (lastTotal < firstTotal) qualityTrend = 'improving';
    else if (lastTotal > firstTotal) qualityTrend = 'degrading';
  }
  
  // Generate recommendations
  const recommendedActions: string[] = [];
  const autoFixableIssues = persistentIssues.filter(i => i.autoFixable);
  const criticalIssues = latestResult.blockers.length;
  
  if (autoFixableIssues.length > 0) {
    recommendedActions.push(`Auto-fix ${autoFixableIssues.length} persistent issues: ${autoFixableIssues.map(i => i.category).join(', ')}`);
  }
  
  if (criticalIssues > 0) {
    recommendedActions.push(`Resolve ${criticalIssues} blocking errors before completion`);
  }
  
  if (persistentIssues.some(i => i.category === 'style-mapping')) {
    recommendedActions.push('Enhance dynamic styling support');
  }
  
  if (persistentIssues.some(i => i.category === 'react-keys')) {
    recommendedActions.push('Add missing React keys to array elements');
  }
  
  // Determine polish priority
  let polishPriority: 'low' | 'medium' | 'high' = 'low';
  if (criticalIssues > 0 || persistentIssues.length > 3) polishPriority = 'high';
  else if (persistentIssues.length > 1 || qualityTrend === 'degrading') polishPriority = 'medium';
  
  return {
    needsPolish: persistentIssues.length > 0 || criticalIssues > 0,
    persistentIssues,
    qualityTrend,
    recommendedActions,
    polishPriority
  };
}

/**
 * Extract validation summary for behavior tracking aggregation
 */
export function summarizeValidationResults(
  validationResults: ToolValidationResult[]
): {
  totalAttempts: number;
  finalQuality: 'excellent' | 'good' | 'needs_work' | 'poor';
  improvementRate: number;
  commonIssueCategories: string[];
} {
  if (validationResults.length === 0) {
    return {
      totalAttempts: 0,
      finalQuality: 'poor',
      improvementRate: 0,
      commonIssueCategories: []
    };
  }
  
  const latestResult = validationResults[validationResults.length - 1];
  const totalIssues = latestResult.issues.length + latestResult.blockers.length;
  
  // Determine final quality
  let finalQuality: 'excellent' | 'good' | 'needs_work' | 'poor';
  if (latestResult.blockers.length > 0) finalQuality = 'poor';
  else if (totalIssues === 0) finalQuality = 'excellent';
  else if (totalIssues <= 2) finalQuality = 'good';
  else finalQuality = 'needs_work';
  
  // Calculate improvement rate
  let improvementRate = 0;
  if (validationResults.length > 1) {
    const firstTotal = validationResults[0].issues.length + validationResults[0].blockers.length;
    const lastTotal = totalIssues;
    improvementRate = firstTotal > 0 ? Math.max(0, (firstTotal - lastTotal) / firstTotal) : 0;
  }
  
  // Find common issue categories
  const categoryFrequency = new Map<string, number>();
  validationResults.forEach(result => {
    [...result.issues, ...result.blockers].forEach(issue => {
      const category = issue.category;
      categoryFrequency.set(category, (categoryFrequency.get(category) || 0) + 1);
    });
  });
  
  const commonIssueCategories = Array.from(categoryFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);
  
  return {
    totalAttempts: validationResults.length,
    finalQuality,
    improvementRate,
    commonIssueCategories
  };
} 