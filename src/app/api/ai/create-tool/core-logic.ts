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
import { ValidationIssue } from '@/lib/types/validation';
import { TOOL_FIXER_SYSTEM_PROMPT, buildToolFixerUserPrompt } from '@/lib/prompts/tool-fixer-prompt';
import { extractAndEnhanceStyles, validateStyleExtraction, previewStyleExtraction } from '@/lib/utils/style-extractor';

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
  
  // Component set used
  componentSet: z.enum(['shadcn', 'legacy']),
  
  // React component code as string
  componentCode: z.string(),
  
  // Style information - STRICT: initialStyleMap is REQUIRED - iterator will fix if missing
  initialStyleMap: z.record(z.string()), // REQUIRED - let validation fail and iterator fix it
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
    console.log('🏭 TRACE: User prompt preview (first 500 chars):', userPrompt.substring(0, 5500));

    // Use PromptOptions from logic architect if available, otherwise analyze context manually
    let promptOptions: PromptOptions;
    let currentComponentSet: 'shadcn' | 'legacy' = 'shadcn'; // Default to shadcn
    
    if (brainstormingContext && brainstormingContext.promptOptions) {
      console.log('🏭 TRACE: Using PromptOptions from logic architect brainstorming');
      promptOptions = brainstormingContext.promptOptions;
      if (brainstormingContext.promptOptions.componentSet) {
        currentComponentSet = brainstormingContext.promptOptions.componentSet;
      }
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
        toolComplexity: context.toolType?.includes('Calculator') ? 'complex' : 'moderate',
        componentSet: currentComponentSet // Ensure componentSet is part of options if built manually
      };
      
      console.log('🎨 ENHANCED: Using premium styling defaults for better visual quality');
    }
    
    // Ensure componentSet is in promptOptions if it was missed
    if (!promptOptions.componentSet) {
      promptOptions.componentSet = currentComponentSet;
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
    
    let parsedToolDefinition;
    try {
      const result = await generateObject({
        model: modelInstance,
        schema: productToolDefinitionSchema,
        prompt: userPrompt,
        system: systemPrompt,
        temperature: 0.7,
        maxRetries: 3
      });
      
      parsedToolDefinition = result.object;
    } catch (error: any) {
      // ENHANCED: Handle both model failures AND schema validation failures
      console.warn(`🏭 TRACE: AI call failed: ${error.message}.`);
      
      // Check if this is a schema validation error that could be fixed by iterator
      if (error.message.includes('response did not match schema') || error.message.includes('Type validation failed')) {
        console.log('🔧 SCHEMA FIX: Schema validation failed - this is a perfect case for our iterator system!');
        console.log('🔧 SCHEMA FIX: Attempting to extract partial result and trigger fixer...');
        
        // Try to extract the raw response if available for iterator fixing
        if (error.text || (error.cause && error.cause.value)) {
          console.log('🔧 SCHEMA FIX: Found partial AI response - attempting to create minimal tool for iterator');
          
          // Create a minimal tool definition that can be fixed by iterator
          const partialResponse = error.cause ? error.cause.value : {};
          console.log('🔧 SCHEMA FIX: Partial response:', JSON.stringify(partialResponse, null, 2));
          
          // Build a minimal but valid tool definition for iterator to fix
          parsedToolDefinition = {
            id: partialResponse.id || `tool-${Date.now()}`,
            slug: partialResponse.slug || `tool-slug-${Date.now()}`,
            version: partialResponse.version || '1.0',
            status: partialResponse.status || 'draft',
            createdAt: partialResponse.createdAt || Date.now(),
            updatedAt: Date.now(),
            createdBy: partialResponse.createdBy || 'system',
            metadata: partialResponse.metadata || {
              id: partialResponse.id || `meta-${Date.now()}`,
              slug: partialResponse.slug || `meta-slug-${Date.now()}`,
              title: 'Generated Tool (Needs Fixing)',
              description: 'Tool generated by AI but needs iterator fixing',
              shortDescription: 'Needs fixing',
              type: 'tool',
              category: 'general',
              targetAudience: 'general users',
              industry: 'various',
              tags: [],
              estimatedCompletionTime: 5,
              difficultyLevel: 'beginner' as const,
              features: [],
              icon: { type: 'lucide' as const, value: 'Package' }
            },
            componentSet: partialResponse.componentSet || 'shadcn' as const,
            componentCode: partialResponse.componentCode || "'use client';\nfunction ErrorComponent() { return React.createElement('div', null, 'Component needs fixing'); }",
            colorScheme: partialResponse.colorScheme || DEFAULT_COLOR_SCHEMES.professional,
            initialStyleMap: partialResponse.initialStyleMap, // This might be undefined - iterator will fix
            currentStyleMap: partialResponse.currentStyleMap || partialResponse.initialStyleMap || {},
            analytics: partialResponse.analytics || {
              enabled: true,
              completions: 0,
              averageTime: 0
            }
          };
          
          console.log('🔧 SCHEMA FIX: Created minimal tool definition for iterator fixing');
        } else {
          // No partial response available - create completely minimal tool
          console.log('🔧 SCHEMA FIX: No partial response - creating minimal tool for complete regeneration');
          parsedToolDefinition = {
            id: `tool-${Date.now()}`,
            slug: `tool-slug-${Date.now()}`,
            version: '1.0',
            status: 'draft' as const,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: 'system',
            metadata: {
              id: `meta-${Date.now()}`,
              slug: `meta-slug-${Date.now()}`,
              title: 'Tool Creation Failed (Needs Complete Regeneration)',
              description: 'Tool generation failed - iterator will regenerate',
              shortDescription: 'Needs regeneration',
              type: 'tool',
              category: 'general',
              targetAudience: 'general users',
              industry: 'various',
              tags: [],
              estimatedCompletionTime: 5,
              difficultyLevel: 'beginner' as const,
              features: [],
              icon: { type: 'lucide' as const, value: 'Package' }
            },
            componentSet: 'shadcn' as const,
            componentCode: "'use client';\nfunction PlaceholderComponent() { return React.createElement('div', { className: 'p-4', 'data-style-id': 'placeholder' }, 'Tool needs complete regeneration'); }",
            colorScheme: DEFAULT_COLOR_SCHEMES.professional,
            initialStyleMap: undefined, // Iterator will create this
            currentStyleMap: {},
            analytics: {
              enabled: true,
              completions: 0,
              averageTime: 0
            }
          };
        }
      } else {
        // For non-schema errors, try fallback model
        console.warn(`🏭 TRACE: Trying fallback model for non-schema error.`);
        const fallbackModelConfig = getFallbackModel('toolCreation');
        if (!fallbackModelConfig) {
          console.error("🏭 TRACE: CRITICAL - No fallback model configured for 'toolCreation'. Using hardcoded default.");
          modelInstance = createModelInstance('openai', 'gpt-4o');
        } else {
          modelInstance = createModelInstance(fallbackModelConfig.provider, fallbackModelConfig.model);
        }
        
        ({ object: parsedToolDefinition } = await generateObject({
          model: modelInstance,
          schema: productToolDefinitionSchema,
          prompt: userPrompt,
          system: systemPrompt,
        }));
      }
    }

    console.log("🏭 TRACE: Raw AI response object keys:", Object.keys(parsedToolDefinition));
    console.log("🏭 TRACE: AI response ID:", parsedToolDefinition.id);
    console.log("🏭 TRACE: AI response slug:", parsedToolDefinition.slug);
    console.log("🏭 TRACE: AI response metadata.title:", parsedToolDefinition.metadata?.title);

    // Ensure 'use client'; directive is present at the top of componentCode
    let rawComponentCode = parsedToolDefinition.componentCode;
    if (rawComponentCode) {
      const trimmedCode = rawComponentCode.trimStart();
      if (!trimmedCode.startsWith("'use client'") && !trimmedCode.startsWith('"use client"')) {
        console.log("🏭 TRACE: Prepending 'use client'; to componentCode.");
        rawComponentCode = "'use client';\n" + rawComponentCode; // Prepend and ensure it's on its own line
      }
    } else {
      // Handle case where componentCode might be null or undefined, though schema should prevent this
      console.warn("🏭 TRACE: AI returned empty or missing componentCode.");
      rawComponentCode = "'use client';\nfunction ErrorComponent() { return React.createElement('div', null, 'Error: Component code was not generated.'); }"; // Default fallback
    }
    // Note: rawComponentCode is now the potentially modified code.

    // Validate for undefined values in critical fields of the AI's direct response
    const aiUndefinedFields = [];
    if (!parsedToolDefinition.id || String(parsedToolDefinition.id).includes('undefined')) {
      aiUndefinedFields.push('id: ' + parsedToolDefinition.id);
    }
    if (!parsedToolDefinition.slug || String(parsedToolDefinition.slug).includes('undefined')) {
      aiUndefinedFields.push('slug: ' + parsedToolDefinition.slug);
    }
    if (!parsedToolDefinition.metadata?.id || String(parsedToolDefinition.metadata.id).includes('undefined')) {
      aiUndefinedFields.push('metadata.id: ' + parsedToolDefinition.metadata?.id);
    }
    if (!parsedToolDefinition.metadata?.slug || String(parsedToolDefinition.metadata.slug).includes('undefined')) {
      aiUndefinedFields.push('metadata.slug: ' + parsedToolDefinition.metadata?.slug);
    }
    
    if (aiUndefinedFields.length > 0) {
      console.error('🏭 TRACE: ⚠️ UNDEFINED VALUES in AI response:', aiUndefinedFields);
      console.error('🏭 TRACE: Raw AI response with undefined values:', JSON.stringify(parsedToolDefinition, null, 2));
    } else {
      console.log('🏭 TRACE: ✅ No undefined values in AI response');
    }

    // Transform AI response to ProductToolDefinition
    console.log('🏭 TRACE: Transforming AI response to ProductToolDefinition...');
    const finalToolDefinition: ProductToolDefinition = {
      id: parsedToolDefinition.id || `tool-${Date.now()}`,
      slug: parsedToolDefinition.slug || `tool-slug-${Date.now()}`,
      version: parsedToolDefinition.version || '1.0',
      status: parsedToolDefinition.status || 'draft',
      createdAt: parsedToolDefinition.createdAt || Date.now(),
      updatedAt: Date.now(),
      createdBy: userId || 'lem1', // TODO: Replace with actual user ID
      metadata: {
        id: parsedToolDefinition.metadata?.id || parsedToolDefinition.id || `meta-${Date.now()}`,
        slug: parsedToolDefinition.metadata?.slug || parsedToolDefinition.slug || `meta-slug-${Date.now()}`,
        title: parsedToolDefinition.metadata?.title || 'Untitled Tool',
        description: parsedToolDefinition.metadata?.description || 'No description provided.',
        shortDescription: parsedToolDefinition.metadata?.shortDescription || 'No short description.',
        type: parsedToolDefinition.metadata?.type || 'tool',
        category: parsedToolDefinition.metadata?.category || 'general',
        targetAudience: parsedToolDefinition.metadata?.targetAudience || 'general users',
        industry: parsedToolDefinition.metadata?.industry || 'various',
        tags: parsedToolDefinition.metadata?.tags || [],
        estimatedCompletionTime: parsedToolDefinition.metadata?.estimatedCompletionTime || 5,
        difficultyLevel: parsedToolDefinition.metadata?.difficultyLevel || 'beginner',
        features: parsedToolDefinition.metadata?.features || [],
        icon: parsedToolDefinition.metadata?.icon || { type: 'lucide', value: 'Package' }
      },
      componentSet: parsedToolDefinition.componentSet || currentComponentSet, // Use currentComponentSet from prompt options
      componentCode: rawComponentCode, // USE THE MODIFIED CODE
      colorScheme: parsedToolDefinition.colorScheme || DEFAULT_COLOR_SCHEMES.professional,
      // HANDLE UNDEFINED initialStyleMap - Iterator will fix this if missing
      initialStyleMap: parsedToolDefinition.initialStyleMap || {}, // Default to empty object if undefined
      currentStyleMap: parsedToolDefinition.currentStyleMap || parsedToolDefinition.initialStyleMap || {},
      analytics: parsedToolDefinition.analytics || {
        enabled: true,
        completions: 0,
        averageTime: 0
      }
    };

    console.log('🏭 TRACE: Final tool definition created');
    console.log('🏭 TRACE: Final ID:', finalToolDefinition.id);
    console.log('🏭 TRACE: Final slug:', finalToolDefinition.slug);
    console.log('🏭 TRACE: Final metadata.id:', finalToolDefinition.metadata.id);
    console.log('🏭 TRACE: Final metadata.slug:', finalToolDefinition.metadata.slug);
    console.log('🏭 TRACE: Final metadata.title:', finalToolDefinition.metadata.title);
    console.log('🏭 TRACE: ComponentCode length:', finalToolDefinition.componentCode?.length || 0);
    console.log('🏭 TRACE: InitialStyleMap keys:', Object.keys(finalToolDefinition.initialStyleMap || {}));

    // ✨ POST-PROCESSING: Automatic Style Extraction and Enhancement
    console.log('🎨 POST-PROCESSING: Starting automatic style extraction...');
    console.log('🎨 POST-PROCESSING: Component code before style extraction (first 500 chars):');
    console.log(finalToolDefinition.componentCode.substring(0, 500));
    
    const styleExtractionResult = extractAndEnhanceStyles(finalToolDefinition.componentCode, {
      preserveExistingDataStyleIds: true,
      generateDescriptiveIds: true,
      includeBasicElements: true,
      idPrefix: '' // No prefix for cleaner IDs
    });
    
    // Validate the style extraction
    const extractionValidation = validateStyleExtraction(styleExtractionResult);
    
    if (!extractionValidation.isValid) {
      console.error('🎨 POST-PROCESSING: ⚠️ Style extraction had issues:', extractionValidation.issues);
      extractionValidation.warnings.forEach(warning => 
        console.warn('🎨 POST-PROCESSING: Warning:', warning)
      );
    } else {
      console.log('🎨 POST-PROCESSING: ✅ Style extraction successful!');
    }
    
    // Log the extraction preview
    console.log('🎨 POST-PROCESSING: Extraction preview:');
    console.log(previewStyleExtraction(styleExtractionResult));
    
    // Apply the style extraction results to the final tool definition
    const enhancedToolDefinition: ProductToolDefinition = {
      ...finalToolDefinition,
      componentCode: styleExtractionResult.modifiedComponentCode,
      initialStyleMap: {
        // Merge any existing style map with extracted styles
        ...finalToolDefinition.initialStyleMap,
        ...styleExtractionResult.initialStyleMap
      },
      currentStyleMap: {
        // Update current style map as well
        ...finalToolDefinition.currentStyleMap,
        ...styleExtractionResult.initialStyleMap
      }
    };
    
    console.log('🎨 POST-PROCESSING: Enhanced tool definition created');
    console.log('🎨 POST-PROCESSING: Enhanced component code length:', enhancedToolDefinition.componentCode.length);
    console.log('🎨 POST-PROCESSING: Enhanced style map keys:', Object.keys(enhancedToolDefinition.initialStyleMap || {}));
    console.log('🎨 POST-PROCESSING: Component code after enhancement (first 500 chars):');
    console.log(enhancedToolDefinition.componentCode.substring(0, 500));

    // Final check for undefined values in the final tool definition
    const finalUndefinedFields = [];
    if (!finalToolDefinition.id || String(finalToolDefinition.id).includes('undefined')) {
      finalUndefinedFields.push('id: ' + finalToolDefinition.id);
    }
    if (!finalToolDefinition.slug || String(finalToolDefinition.slug).includes('undefined')) {
      finalUndefinedFields.push('slug: ' + finalToolDefinition.slug);
    }
    if (!finalToolDefinition.metadata?.id || String(finalToolDefinition.metadata.id).includes('undefined')) {
      finalUndefinedFields.push('metadata.id: ' + finalToolDefinition.metadata?.id);
    }
    if (!finalToolDefinition.metadata?.slug || String(finalToolDefinition.metadata.slug).includes('undefined')) {
      finalUndefinedFields.push('metadata.slug: ' + finalToolDefinition.metadata?.slug);
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
    
    // Use the extracted validation function instead of inline validation
    let currentTool = enhancedToolDefinition;
    let validationResult = performFullValidation(currentTool, {
      toolId: currentTool.id,
      toolTitle: currentTool.metadata.title,
      attemptNumber: 1,
      sessionPhase: 'initial_creation',
      selectedModel: selectedModel,
      hasExternalBrainstorming: !!brainstormingContext,
      toolComplexity: context.toolComplexity || 'unknown'
    });

    // 🔧 ITERATOR SYSTEM: If validation fails with blocking errors, try to fix with AI
    if (!validationResult.isValid) {
      console.log('🔧 ITERATOR: Initial validation failed - attempting AI corrections...');
      console.log(`🔧 ITERATOR: ${validationResult.blockers.length} blocking errors to resolve`);
      
      // Convert validation result issues to ValidationIssue format for fixer
      const validationIssuesForFixer: ValidationIssue[] = validationResult.issues.map(issue => ({
        id: issue.id,
        toolId: currentTool.id,
        toolTitle: currentTool.metadata.title,
        severity: issue.severity,
        category: issue.category as 'react-keys' | 'style-mapping' | 'execution' | 'undefined-values' | 'syntax' | 'component-structure',
        issue: issue.issue,
        details: issue.details,
        codeSnippet: issue.codeSnippet,
        timestamp: Date.now(),
        resolved: false,
        autoFixable: issue.autoFixable
      }));

      // Configure iterator behavior 
      const iteratorConfig: Partial<ToolFixerConfig> = {
        maxAttempts: 3, // Configurable max attempts
        temperature: 0.3, // Lower temperature for more focused corrections
        enableLogging: true,
        // Optional: Use different model for fixing if needed
        // modelOverride: 'gpt-4o-mini' // Could use cheaper model for fixes
      };

      try {
        // Attempt to fix the tool using AI iterator
        const fixResult = await fixToolWithAI(
          currentTool,
          validationIssuesForFixer,
          userIntent, // Pass original user intent for context
          iteratorConfig
        );

        if (fixResult.success && fixResult.fixedTool) {
          console.log('🔧 ITERATOR: ✅ Tool successfully fixed by AI!');
          console.log(`🔧 ITERATOR: Fixed in ${fixResult.attempts} attempts`);
          console.log(`🔧 ITERATOR: ${fixResult.improvements?.issuesFixed || 0} issues fixed, ${fixResult.improvements?.blockersResolved || 0} blockers resolved`);
          
          // Use the fixed tool and its validation result
          currentTool = fixResult.fixedTool;
          validationResult = fixResult.validation!;
          
          // Update validation metadata to reflect iteration success
          validationResult.sessionPhase = 'iteration';
          validationResult.attempt = fixResult.attempts;
          
        } else {
          // Iterator failed - log details but continue with original tool
          console.error('🔧 ITERATOR: ❌ Tool fixing failed after maximum attempts');
          console.error(`🔧 ITERATOR: Error: ${fixResult.error}`);
          console.error(`🔧 ITERATOR: Attempts: ${fixResult.attempts}`);
          
          if (fixResult.improvements) {
            console.log(`🔧 ITERATOR: Partial improvements: ${fixResult.improvements.issuesFixed} issues fixed, ${fixResult.improvements.blockersResolved} blockers resolved`);
          }
          
          // Use the best partial result if available, otherwise original
          if (fixResult.fixedTool && fixResult.validation) {
            console.log('🔧 ITERATOR: Using best partial fix result');
            currentTool = fixResult.fixedTool;
            validationResult = fixResult.validation;
            validationResult.sessionPhase = 'iteration';
            validationResult.attempt = fixResult.attempts;
          }
          
          // If we still have blocking errors, throw error to prevent saving bad tool
          if (validationResult.blockers.length > 0) {
            console.error('🛡️ VALIDATION: ❌ Tool validation FAILED even after AI correction attempts');
            throw new Error(`Tool validation failed after ${fixResult.attempts} correction attempts. ${validationResult.blockers.length} blocking error(s) remain: ${validationResult.blockers.map(b => b.issue).join('; ')}`);
          }
        }
        
      } catch (iteratorError) {
        console.error('🔧 ITERATOR: Iterator system error:', iteratorError);
        
        // If iterator system itself fails, fall back to original validation behavior
        if (validationResult.blockers.length > 0) {
          console.error('🛡️ VALIDATION: ❌ Tool validation FAILED and iterator system failed');
          throw new Error(`Tool validation failed with ${validationResult.blockers.length} blocking error(s) and iterator system error: ${iteratorError instanceof Error ? iteratorError.message : String(iteratorError)}`);
        }
      }
    }
    
    // Final validation check - ensure we have a valid tool
    if (!validationResult.isValid) {
      console.error('🛡️ VALIDATION: ❌ Tool validation still invalid after all attempts');
      throw new Error(`Tool validation failed with ${validationResult.blockers.length} blocking error(s): ${validationResult.blockers.map(b => b.issue).join('; ')}`);
    }
    
    // Success! Tool is valid (either initially or after AI fixes)
    console.log('🛡️ VALIDATION: ✅ Tool validation PASSED - safe to save');
    if (validationResult.issues.length > 0) {
      console.log('🛡️ VALIDATION: ⚠️ Found', validationResult.issues.length, 'non-blocking issues');
    }
    
    // Log final tool status
    console.log('🏭 TRACE: processToolCreation SUCCESS - returning tool with validation results');
    return {
      tool: currentTool, // Use currentTool (may be original or fixed version)
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
  
  // Calculate improvement rate
  let improvementRate = 0;
  if (validationResults.length > 1) {
    const firstTotal = validationResults[0].issues.length + validationResults[0].blockers.length;
    if (firstTotal > 0) {
      improvementRate = Math.max(0, (firstTotal - totalIssues) / firstTotal);
    }
  }
  
  // Determine final quality
  let finalQuality: 'excellent' | 'good' | 'needs_work' | 'poor' = 'poor';
  if (latestResult.blockers.length === 0) {
    if (totalIssues === 0) finalQuality = 'excellent';
    else if (totalIssues <= 2) finalQuality = 'good';
    else finalQuality = 'needs_work';
  }
  
  // Find common issue categories
  const categoryCount = new Map<string, number>();
  validationResults.forEach(result => {
    [...result.issues, ...result.blockers].forEach(issue => {
      const count = categoryCount.get(issue.category) || 0;
      categoryCount.set(issue.category, count + 1);
    });
  });
  
  const commonIssueCategories = Array.from(categoryCount.entries())
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

/**
 * EXTRACTED VALIDATION LOGIC - Perform comprehensive validation on a ProductToolDefinition
 * This function extracts all validation logic from processToolCreation for reuse in iterator system
 */
export function performFullValidation(
  toolDefinition: ProductToolDefinition,
  context: {
    toolId?: string;
    toolTitle?: string;
    attemptNumber?: number;
    sessionPhase?: 'initial_creation' | 'iteration' | 'final_polish' | 'ai_processing_creation';
    selectedModel?: string;
    hasExternalBrainstorming?: boolean;
    toolComplexity?: string;
  } = {}
): ToolValidationResult {
  console.log('🛡️ VALIDATION: Running comprehensive tool validation...');
  
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
    const toolId = context.toolId || toolDefinition.id || 'validating';
    const toolTitle = context.toolTitle || toolDefinition.metadata?.title || 'Tool Validation';
    
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
    // 1. Check for forbidden ShadCN component usage IF componentSet is 'legacy'
    if (toolDefinition.componentSet === 'legacy') {
      const shadcnKeywords = [
        'Card', 'CardHeader', 'CardContent', 'CardTitle', 'CardDescription', 'CardFooter',
        'Input', 'Button', 'Select', 'Label', 'Textarea', 'RadioGroup', 'Checkbox', 'Slider', 'Toggle',
        'Accordion', 'Dialog', 'Tooltip', 'Progress' // Add other ShadCN component names if they have distinct capitalized names
      ];
      let foundForbiddenLegacy = ''
      for (const keyword of shadcnKeywords) {
        if (toolDefinition.componentCode.includes(keyword)) {
          // Check if it's a standalone keyword, e.g. `React.createElement(Input, ...)` vs. `someInputVariable`
          // This regex looks for the keyword followed by a non-alphanumeric char (like comma, paren, space) or end of line.
          const regex = new RegExp(`\\b${keyword}\\b`);
          if (regex.test(toolDefinition.componentCode)){
            foundForbiddenLegacy = keyword;
            break;
          }
        }
      }
      if (foundForbiddenLegacy) {
        trackIssue(
          `Tool uses forbidden ShadCN component '${foundForbiddenLegacy}' while in legacy mode`,
          'component-structure',
          'error',
          `ShadCN components (e.g., ${foundForbiddenLegacy}) are not allowed when componentSet is 'legacy'. Use basic HTML elements only.`,
          foundForbiddenLegacy,
          false
        );
      }
    } else {
      // If componentSet is 'shadcn', we might want to add checks to ensure they are used *correctly* in the future,
      // but for now, we won't flag their mere presence as an error.
      console.log('🛡️ VALIDATION: componentSet is \'shadcn\'. Skipping check for forbidden ShadCN components (as they are allowed).');
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
    // FIXED: Use better detection logic consistent with step 12
    const arrayElementPattern1 = /React\.createElement\([^,]+,\s*\{[^}]*\}/g;
    const keyedArrayElementPattern1 = /React\.createElement\([^,]+,\s*\{[^}]*key\s*:[^}]*\}/g;
    
    const allElements = (toolDefinition.componentCode.match(arrayElementPattern1) || []).length;
    const keyedElements = (toolDefinition.componentCode.match(keyedArrayElementPattern1) || []).length;
    
    // Check if there are array contexts for warning-level detection
    const hasArrays = /\[[^\]]*React\.createElement/g.test(toolDefinition.componentCode);
    
    if (hasArrays && keyedElements < allElements) {
      const missingKeys = allElements - keyedElements;
      console.warn('🛡️ VALIDATION: ⚠️ Component has arrays without React keys (may cause console warnings)');
      trackIssue(
        'Missing React keys in array elements',
        'react-keys',
        'warning',
        `${missingKeys} React elements in arrays may be missing unique key props`,
        `${missingKeys} elements without keys`,
        true // This is auto-fixable
      );
    } else if (hasArrays) {
      console.log(`🛡️ VALIDATION: ✅ All ${keyedElements} array elements have keys (warning check)`);
    }
    
    // 8. Validate required data-style-id attributes - RELAXED: Not all tools need dynamic styling
    // FIXED: Use the same improved regex pattern
    const dataStyleIdCountCheck = (toolDefinition.componentCode.match(/'data-style-id'\s*:\s*['"][^'"]*['"]/g) || []).length;
    if (dataStyleIdCountCheck === 0) {
      console.log('🛡️ VALIDATION: ⚠️ Component missing data-style-id attributes (dynamic styling disabled)');
      trackIssue(
        'Component missing data-style-id attributes',
        'style-mapping',
        'info',
        'Dynamic styling will be disabled for this component',
        'data-style-id not found',
        true
      );
    } else {
      console.log(`🛡️ VALIDATION: ✅ Found ${dataStyleIdCountCheck} data-style-id attributes (info check)`);
    }
    
    // 9. STRICT: Validate initialStyleMap completeness and quality
    if (!toolDefinition.initialStyleMap || Object.keys(toolDefinition.initialStyleMap).length === 0) {
      trackIssue(
        'Component missing initialStyleMap or has empty style mapping',
        'style-mapping',
        'error',
        'AI must generate initialStyleMap with data-style-id to CSS class mappings for dynamic styling',
        'Empty or missing initialStyleMap',
        false
      );
    } else {
      // Validate that initialStyleMap entries are meaningful
      const styleMapEntries = Object.entries(toolDefinition.initialStyleMap);
      const invalidEntries = styleMapEntries.filter(([key, value]) => {
        return !key.trim() || !value.trim() || value === 'undefined' || value === 'null';
      });
      
      if (invalidEntries.length > 0) {
        trackIssue(
          'initialStyleMap contains invalid or empty entries',
          'style-mapping',
          'error',
          `Found ${invalidEntries.length} invalid style map entries: ${invalidEntries.map(([k, v]) => `"${k}": "${v}"`).join(', ')}`,
          invalidEntries.slice(0, 3).map(([k, v]) => `"${k}": "${v}"`).join('; '),
          false
        );
      }
      
      // Check for data-style-id attributes in componentCode that don't have corresponding initialStyleMap entries
      // FIXED: Use the correct regex pattern to match 'data-style-id': 'value' format
      const dataStyleIdPattern = /'data-style-id'\s*:\s*['"]([^'"]+)['"]/g;
      const foundDataStyleIds = new Set<string>();
      let match;
      while ((match = dataStyleIdPattern.exec(toolDefinition.componentCode)) !== null) {
        foundDataStyleIds.add(match[1]);
      }
      
      const styleMapKeys = new Set(Object.keys(toolDefinition.initialStyleMap));
      const missingMappings = Array.from(foundDataStyleIds).filter(id => !styleMapKeys.has(id));
      
      if (missingMappings.length > 0) {
        trackIssue(
          'Component has data-style-id attributes without corresponding initialStyleMap entries',
          'style-mapping',
          'error',
          `Missing style mappings for: ${missingMappings.join(', ')}`,
          missingMappings.slice(0, 5).join(', '),
          true // This could potentially be auto-fixable
        );
      }
    }
    
    // 10. STRICT: Ensure React hooks for interactivity
    if (!toolDefinition.componentCode.includes('useState')) {
      trackIssue(
        'Component does not contain React hooks (useState)',
        'component-structure',
        'error',
        'Business tools must be interactive and use React state hooks',
        'No useState detected',
        false
      );
    }
    
    // 10.5. STRICT: Ensure meaningful interactivity
    const hasEventHandlers = /on\w+\s*:\s*\([^)]*\)\s*=>/.test(toolDefinition.componentCode) || 
                             /on\w+\s*:\s*handle\w+/.test(toolDefinition.componentCode);
    if (!hasEventHandlers) {
      trackIssue(
        'Component lacks event handlers for user interaction',
        'component-structure',
        'error',
        'Business tools must have onClick, onChange, or other event handlers for meaningful interactivity',
        'No event handlers detected',
        false
      );
    }
    
    // 11. STRICT: Validate data-style-id attributes are present
    // FIXED: Updated regex to match the actual format: 'data-style-id': 'value'
    const dataStyleIdCount = (toolDefinition.componentCode.match(/'data-style-id'\s*:\s*['"][^'"]*['"]/g) || []).length;
    if (dataStyleIdCount === 0) {
      trackIssue(
        'Component does not contain any data-style-id attributes',
        'style-mapping',
        'error',
        'Components must include data-style-id attributes for dynamic styling support',
        'No data-style-id attributes found',
        false
      );
    } else {
      console.log(`🛡️ VALIDATION: ✅ Found ${dataStyleIdCount} data-style-id attributes`);
    }
    
    // 12. STRICT: Check for proper React keys in arrays (now required, not just blocking)
    // FIXED: Better detection of React arrays without keys
    const arrayElementPattern = /React\.createElement\([^,]+,\s*\{[^}]*\}/g;
    const keyedArrayElementPattern = /React\.createElement\([^,]+,\s*\{[^}]*key\s*:[^}]*\}/g;
    
    const allArrayElements = (toolDefinition.componentCode.match(arrayElementPattern) || []).length;
    const keyedArrayElements = (toolDefinition.componentCode.match(keyedArrayElementPattern) || []).length;
    
    // Check if there are array contexts (indicated by square brackets containing React.createElement)
    const hasArrayContext = /\[[^\]]*React\.createElement/g.test(toolDefinition.componentCode);
    
    if (hasArrayContext && keyedArrayElements < allArrayElements) {
      const missingKeyCount = allArrayElements - keyedArrayElements;
      trackIssue(
        'Component has React arrays without proper keys',
        'react-keys',
        'error',
        `${missingKeyCount} React elements in arrays are missing key props`,
        'Missing keys in React arrays',
        true // Auto-fixable
      );
    } else if (hasArrayContext) {
      console.log(`🛡️ VALIDATION: ✅ All ${keyedArrayElements} React array elements have keys`);
    } else {
      console.log('🛡️ VALIDATION: ✅ No React arrays detected - key validation skipped');
    }
    
    // 13. Check for common syntax errors that cause crashes
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
    
    // 14. Check for template strings with variable interpolation (causes ReferenceError in dynamic execution)
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
    
    console.log(`🛡️ VALIDATION: Completed with ${validationIssues.length} issues and ${validationBlockers.length} blockers`);
    if (hasBlockingErrors) {
      console.error('🛡️ VALIDATION: ❌ Tool validation FAILED with blocking errors:', validationBlockers);
    } else {
      console.log('🛡️ VALIDATION: ✅ Tool validation PASSED - safe to save');
      if (validationIssues.length > 0) {
        console.log('🛡️ VALIDATION: ⚠️ Found', validationIssues.length, 'non-blocking issues');
      }
    }

    return {
      isValid: !hasBlockingErrors,
      issues: validationIssues,
      blockers: validationBlockers,
      timestamp: Date.now(),
      attempt: context.attemptNumber || 1,
      sessionPhase: context.sessionPhase || 'initial_creation',
      userContext: {
        selectedModel: context.selectedModel,
        hasExternalBrainstorming: context.hasExternalBrainstorming || false,
        toolComplexity: context.toolComplexity || 'unknown'
      }
    };

  } catch (error) {
    console.error('🛡️ VALIDATION: Error during validation:', error);
    
    // Return error state
    return {
      isValid: false,
      issues: [{
        id: `validation-error-${Date.now()}`,
        issue: 'Validation process failed',
        category: 'execution',
        severity: 'error',
        details: error instanceof Error ? error.message : String(error),
        codeSnippet: 'Validation system error',
        autoFixable: false
      }],
      blockers: [{
        issue: 'Validation process failed',
        category: 'execution',
        details: error instanceof Error ? error.message : String(error)
      }],
      timestamp: Date.now(),
      attempt: context.attemptNumber || 1,
      sessionPhase: context.sessionPhase || 'initial_creation',
      userContext: {
        selectedModel: context.selectedModel,
        hasExternalBrainstorming: context.hasExternalBrainstorming || false,
        toolComplexity: context.toolComplexity || 'unknown'
      }
    };
  }
}

// ============================================================================
// TOOL FIXER SYSTEM - AI-Powered Error Correction
// ============================================================================

/**
 * Configuration for tool fixing behavior
 */
export interface ToolFixerConfig {
  maxAttempts: number;
  temperature: number;
  modelOverride?: string; // Optional model override for fixing
  enableLogging: boolean;
}

/**
 * Default configuration for tool fixing
 */
export const DEFAULT_TOOL_FIXER_CONFIG: ToolFixerConfig = {
  maxAttempts: 3,
  temperature: 0.3, // Lower temperature for more focused fixes
  enableLogging: true
};

/**
 * Result of a tool fixing attempt
 */
export interface ToolFixResult {
  success: boolean;
  fixedTool?: ProductToolDefinition;
  validation?: ToolValidationResult;
  attempts: number;
  error?: string;
  improvements?: {
    issuesFixed: number;
    blockersResolved: number;
    newIssues: number;
  };
}

/**
 * Fix a failed ProductToolDefinition using AI with validation errors as feedback
 * This is the core function for the iterative correction system
 */
export async function fixToolWithAI(
  failedToolDefinition: ProductToolDefinition,
  validationIssues: ValidationIssue[],
  originalUserIntent: string,
  config: Partial<ToolFixerConfig> = {}
): Promise<ToolFixResult> {
  const fixerConfig = { ...DEFAULT_TOOL_FIXER_CONFIG, ...config };
  
  console.log('🔧 TOOL FIXER: Starting AI-powered tool correction...');
  console.log(`🔧 TOOL FIXER: ${validationIssues.length} validation issues to address`);
  console.log('🔧 TOOL FIXER: Config:', fixerConfig);
  console.log('🔧 TOOL FIXER: Failed tool preview:', {
    id: failedToolDefinition.id,
    title: failedToolDefinition.metadata?.title,
    componentSet: failedToolDefinition.componentSet,
    hasComponentCode: !!failedToolDefinition.componentCode,
    componentCodeLength: failedToolDefinition.componentCode?.length || 0,
    hasInitialStyleMap: !!failedToolDefinition.initialStyleMap,
    initialStyleMapKeys: Object.keys(failedToolDefinition.initialStyleMap || {}),
    componentCodePreview: failedToolDefinition.componentCode?.substring(0, 300) || 'NO CODE'
  });

  // Log validation issues in detail
  console.log('🔧 TOOL FIXER: Detailed validation issues to fix:');
  validationIssues.forEach((issue, index) => {
    console.log(`🔧 TOOL FIXER:   ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.issue}`);
    if (issue.details) console.log(`🔧 TOOL FIXER:      Details: ${issue.details}`);
    if (issue.codeSnippet) console.log(`🔧 TOOL FIXER:      Code: ${issue.codeSnippet.substring(0, 100)}...`);
  });

  let currentTool = failedToolDefinition;
  let currentValidation: ToolValidationResult | undefined;
  let attempts = 0;
  
  // Track improvements across attempts
  const initialIssueCount = validationIssues.length;
  const initialBlockerCount = validationIssues.filter(issue => issue.severity === 'error').length;
  
  for (attempts = 1; attempts <= fixerConfig.maxAttempts; attempts++) {
    try {
      console.log(`🔧 TOOL FIXER: ===============================================`);
      console.log(`🔧 TOOL FIXER: ATTEMPT ${attempts}/${fixerConfig.maxAttempts}`);
      console.log(`🔧 TOOL FIXER: ===============================================`);
      
      // Determine which model to use for fixing
      let modelConfig;
      let modelInstance;
      
      if (fixerConfig.modelOverride) {
        // Use override model if specified
        const detectedProvider = getModelProvider(fixerConfig.modelOverride);
        if (detectedProvider !== 'unknown') {
          modelConfig = { provider: detectedProvider, modelId: fixerConfig.modelOverride };
          modelInstance = createModelInstance(detectedProvider, fixerConfig.modelOverride);
          console.log(`🔧 TOOL FIXER: Using override model: ${fixerConfig.modelOverride}`);
        } else {
          console.warn(`🔧 TOOL FIXER: Could not detect provider for override model: ${fixerConfig.modelOverride}, using default`);
          modelConfig = getFallbackModel('toolCreation');
          modelInstance = createModelInstance(modelConfig?.provider || 'openai', modelConfig?.model || 'gpt-4o');
        }
      } else {
        // Use configured model with preference for more precise models for fixing
        modelConfig = getPrimaryModel('toolCreation');
        if (modelConfig && 'modelInfo' in modelConfig) {
          modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelInfo.id);
          console.log(`🔧 TOOL FIXER: Using configured model: ${modelConfig.modelInfo.id}`);
        } else {
          modelInstance = createModelInstance('openai', 'gpt-4o');
          console.log('🔧 TOOL FIXER: Using fallback model: gpt-4o');
        }
      }
      
      // Build the fixer prompt
      console.log('🔧 TOOL FIXER: Building fixer prompt...');
      const fixerPrompt = buildToolFixerUserPrompt(
        currentTool,
        validationIssues,
        originalUserIntent,
        attempts,
        fixerConfig.maxAttempts
      );
      
      if (fixerConfig.enableLogging) {
        console.log(`🔧 TOOL FIXER: Fixer prompt length: ${fixerPrompt.length}`);
        console.log(`🔧 TOOL FIXER: Fixer prompt preview (first 1000 chars):`);
        console.log(fixerPrompt.substring(0, 1000));
        console.log('🔧 TOOL FIXER: [...prompt continues...]');
        
        console.log(`🔧 TOOL FIXER: System prompt length: ${TOOL_FIXER_SYSTEM_PROMPT.length}`);
        console.log(`🔧 TOOL FIXER: Temperature: ${fixerConfig.temperature}`);
      }
      
      // Call AI to fix the tool
      console.log('🔧 TOOL FIXER: Calling AI model for corrections...');
      const aiStartTime = Date.now();
      
      const result = await generateObject({
        model: modelInstance,
        schema: productToolDefinitionSchema,
        prompt: fixerPrompt,
        system: TOOL_FIXER_SYSTEM_PROMPT,
        temperature: fixerConfig.temperature,
        maxRetries: 2
      });
      
      const aiDuration = Date.now() - aiStartTime;
      console.log(`🔧 TOOL FIXER: AI correction completed in ${aiDuration}ms`);
      
      const fixedToolDefinition = result.object;
      console.log('🔧 TOOL FIXER: AI response received, analyzing changes...');
      
      // Log what changed
      const changes = {
        componentCodeChanged: fixedToolDefinition.componentCode !== currentTool.componentCode,
        initialStyleMapChanged: JSON.stringify(fixedToolDefinition.initialStyleMap) !== JSON.stringify(currentTool.initialStyleMap),
        metadataChanged: JSON.stringify(fixedToolDefinition.metadata) !== JSON.stringify(currentTool.metadata),
        colorSchemeChanged: JSON.stringify(fixedToolDefinition.colorScheme) !== JSON.stringify(currentTool.colorScheme)
      };
      
      console.log('🔧 TOOL FIXER: Changes detected:', changes);
      
      if (changes.componentCodeChanged) {
        console.log('🔧 TOOL FIXER: Component code was modified');
        console.log('🔧 TOOL FIXER: New component code preview (first 500 chars):');
        console.log(fixedToolDefinition.componentCode?.substring(0, 500) || 'NO CODE');
      }
      
      if (changes.initialStyleMapChanged) {
        console.log('🔧 TOOL FIXER: initialStyleMap was modified');
        console.log('🔧 TOOL FIXER: New style map keys:', Object.keys(fixedToolDefinition.initialStyleMap || {}));
        console.log('🔧 TOOL FIXER: New style map:', fixedToolDefinition.initialStyleMap);
      }
      
      // Transform to proper ProductToolDefinition (similar to processToolCreation)
      const transformedTool: ProductToolDefinition = {
        id: fixedToolDefinition.id || currentTool.id,
        slug: fixedToolDefinition.slug || currentTool.slug,
        version: fixedToolDefinition.version || currentTool.version,
        status: fixedToolDefinition.status || currentTool.status,
        createdAt: fixedToolDefinition.createdAt || currentTool.createdAt,
        updatedAt: Date.now(),
        createdBy: fixedToolDefinition.createdBy || currentTool.createdBy,
        metadata: {
          id: fixedToolDefinition.metadata?.id || currentTool.metadata.id,
          slug: fixedToolDefinition.metadata?.slug || currentTool.metadata.slug,
          title: fixedToolDefinition.metadata?.title || currentTool.metadata.title,
          description: fixedToolDefinition.metadata?.description || currentTool.metadata.description,
          shortDescription: fixedToolDefinition.metadata?.shortDescription || currentTool.metadata.shortDescription,
          type: fixedToolDefinition.metadata?.type || currentTool.metadata.type,
          category: fixedToolDefinition.metadata?.category || currentTool.metadata.category,
          targetAudience: fixedToolDefinition.metadata?.targetAudience || currentTool.metadata.targetAudience,
          industry: fixedToolDefinition.metadata?.industry || currentTool.metadata.industry,
          tags: fixedToolDefinition.metadata?.tags || currentTool.metadata.tags,
          estimatedCompletionTime: fixedToolDefinition.metadata?.estimatedCompletionTime || currentTool.metadata.estimatedCompletionTime,
          difficultyLevel: fixedToolDefinition.metadata?.difficultyLevel || currentTool.metadata.difficultyLevel,
          features: fixedToolDefinition.metadata?.features || currentTool.metadata.features,
          icon: fixedToolDefinition.metadata?.icon || currentTool.metadata.icon
        },
        componentSet: fixedToolDefinition.componentSet || currentTool.componentSet,
        componentCode: fixedToolDefinition.componentCode || currentTool.componentCode,
        colorScheme: fixedToolDefinition.colorScheme || currentTool.colorScheme,
        initialStyleMap: fixedToolDefinition.initialStyleMap || {},
        currentStyleMap: fixedToolDefinition.currentStyleMap || fixedToolDefinition.initialStyleMap || {},
        analytics: fixedToolDefinition.analytics || currentTool.analytics
      };
      
      // Ensure 'use client'; directive is present
      if (transformedTool.componentCode) {
        const trimmedCode = transformedTool.componentCode.trimStart();
        if (!trimmedCode.startsWith("'use client'") && !trimmedCode.startsWith('"use client"')) {
          transformedTool.componentCode = "'use client';\n" + transformedTool.componentCode;
          console.log("🔧 TOOL FIXER: Added 'use client' directive to fixed component");
        }
      }
      
      console.log('🔧 TOOL FIXER: Tool transformation complete, validating fixed tool...');
      
      // Validate the fixed tool
      currentValidation = performFullValidation(transformedTool, {
        toolId: transformedTool.id,
        toolTitle: transformedTool.metadata.title,
        attemptNumber: attempts,
        sessionPhase: 'iteration'
      });
      
      const newIssueCount = currentValidation.issues.length;
      const newBlockerCount = currentValidation.blockers.length;
      
      console.log(`🔧 TOOL FIXER: Validation results - ${newIssueCount} issues (${newBlockerCount} blockers)`);
      
      // Log remaining validation issues
      if (newBlockerCount > 0) {
        console.log('🔧 TOOL FIXER: Remaining blockers:');
        currentValidation.blockers.forEach((blocker, index) => {
          console.log(`🔧 TOOL FIXER:   ${index + 1}. [${blocker.category}] ${blocker.issue}`);
          if (blocker.details) console.log(`🔧 TOOL FIXER:      Details: ${blocker.details}`);
        });
      }
      
      if (currentValidation.issues.length > 0) {
        console.log('🔧 TOOL FIXER: All remaining issues:');
        currentValidation.issues.forEach((issue, index) => {
          console.log(`🔧 TOOL FIXER:   ${index + 1}. [${issue.severity}] ${issue.category}: ${issue.issue}`);
        });
      }
      
      // Check if we've successfully fixed the tool
      if (currentValidation.isValid) {
        console.log('🔧 TOOL FIXER: ✅ Tool successfully fixed and validated!');
        return {
          success: true,
          fixedTool: transformedTool,
          validation: currentValidation,
          attempts,
          improvements: {
            issuesFixed: initialIssueCount - newIssueCount,
            blockersResolved: initialBlockerCount - newBlockerCount,
            newIssues: Math.max(0, newIssueCount - initialIssueCount)
          }
        };
      }
      
      // Update current tool for next iteration
      currentTool = transformedTool;
      
      // Update validation issues for next attempt
      validationIssues = currentValidation.issues.map(issue => ({
        id: issue.id,
        toolId: transformedTool.id, // Use the actual tool ID
        toolTitle: transformedTool.metadata.title,
        severity: issue.severity,
        category: issue.category as 'react-keys' | 'style-mapping' | 'execution' | 'undefined-values' | 'syntax' | 'component-structure',
        issue: issue.issue,
        details: issue.details,
        codeSnippet: issue.codeSnippet,
        timestamp: Date.now(),
        resolved: false,
        autoFixable: issue.autoFixable
      }));
      
      // Log progress
      const issuesFixed = initialIssueCount - newIssueCount;
      const blockersResolved = initialBlockerCount - newBlockerCount;
      console.log(`🔧 TOOL FIXER: Attempt ${attempts} results: ${issuesFixed} issues fixed, ${blockersResolved} blockers resolved`);
      
      // If we're on the last attempt, we'll return whatever we have
      if (attempts === fixerConfig.maxAttempts) {
        console.log('🔧 TOOL FIXER: ⚠️ Reached maximum attempts - returning partial fix');
        console.log('🔧 TOOL FIXER: Final tool state analysis:');
        console.log('🔧 TOOL FIXER:   Component code length:', transformedTool.componentCode?.length || 0);
        console.log('🔧 TOOL FIXER:   Has initialStyleMap:', !!transformedTool.initialStyleMap);
        console.log('🔧 TOOL FIXER:   Style map keys:', Object.keys(transformedTool.initialStyleMap || {}));
        console.log('🔧 TOOL FIXER:   Component set:', transformedTool.componentSet);
        
        return {
          success: false,
          fixedTool: transformedTool,
          validation: currentValidation,
          attempts,
          error: `Could not fully fix tool after ${fixerConfig.maxAttempts} attempts. ${newBlockerCount} blockers remain.`,
          improvements: {
            issuesFixed: initialIssueCount - newIssueCount,
            blockersResolved: initialBlockerCount - newBlockerCount,
            newIssues: Math.max(0, newIssueCount - initialIssueCount)
          }
        };
      }
      
      console.log(`🔧 TOOL FIXER: ${newBlockerCount} blockers remain - preparing next attempt...`);
      console.log('🔧 TOOL FIXER: Issues to fix in next attempt:');
      validationIssues.slice(0, 3).forEach((issue, index) => {
        console.log(`🔧 TOOL FIXER:   ${index + 1}. [${issue.severity}] ${issue.issue}`);
      });
      
    } catch (error) {
      console.error(`🔧 TOOL FIXER: Error on attempt ${attempts}:`, error);
      console.error('🔧 TOOL FIXER: Error details:', {
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack?.substring(0, 500) : 'No stack'
      });
      
      // If this is the last attempt, return the error
      if (attempts === fixerConfig.maxAttempts) {
        return {
          success: false,
          attempts,
          error: `Tool fixing failed after ${attempts} attempts: ${error instanceof Error ? error.message : String(error)}`,
          improvements: {
            issuesFixed: 0,
            blockersResolved: 0,
            newIssues: 0
          }
        };
      }
      
      // Otherwise, continue to next attempt
      console.log(`🔧 TOOL FIXER: Retrying... (${attempts}/${fixerConfig.maxAttempts})`);
    }
  }
  
  // This should not be reached, but included for completeness
  return {
    success: false,
    attempts,
    error: 'Unexpected error in tool fixer loop',
    improvements: {
      issuesFixed: 0,
      blockersResolved: 0,
      newIssues: 0
    }
  };
}

/**
 * VALIDATION WITH ITERATOR INTEGRATION
 * Validates a tool and attempts AI corrections if validation fails
 * This integrates the iterator system with the main validation flow
 */
export async function validateToolWithIterator(
  tool: ProductToolDefinition,
  userIntent: string,
  context: {
    selectedModel?: string;
    hasExternalBrainstorming?: boolean;
    toolComplexity?: string;
  } = {}
): Promise<{
  tool: ProductToolDefinition;
  validation: ToolValidationResult;
}> {
  console.log('🛡️ VALIDATION WITH ITERATOR: Starting validation with auto-correction...');
  
  // Use the extracted validation function
  let currentTool = tool;
  let validationResult = performFullValidation(currentTool, {
    toolId: currentTool.id,
    toolTitle: currentTool.metadata.title,
    attemptNumber: 1,
    sessionPhase: 'initial_creation',
    selectedModel: context.selectedModel,
    hasExternalBrainstorming: context.hasExternalBrainstorming,
    toolComplexity: context.toolComplexity || 'unknown'
  });

  // 🔧 ITERATOR SYSTEM: If validation fails with blocking errors, try to fix with AI
  if (!validationResult.isValid) {
    console.log('🔧 ITERATOR: Initial validation failed - attempting AI corrections...');
    console.log(`🔧 ITERATOR: ${validationResult.blockers.length} blocking errors to resolve`);
    
    // Convert validation result issues to ValidationIssue format for fixer
    const validationIssuesForFixer: ValidationIssue[] = validationResult.issues.map(issue => ({
      id: issue.id,
      toolId: currentTool.id,
      toolTitle: currentTool.metadata.title,
      severity: issue.severity,
      category: issue.category as 'react-keys' | 'style-mapping' | 'execution' | 'undefined-values' | 'syntax' | 'component-structure',
      issue: issue.issue,
      details: issue.details,
      codeSnippet: issue.codeSnippet,
      timestamp: Date.now(),
      resolved: false,
      autoFixable: issue.autoFixable
    }));

    // Configure iterator behavior 
    const iteratorConfig: Partial<ToolFixerConfig> = {
      maxAttempts: 3, // Configurable max attempts
      temperature: 0.3, // Lower temperature for more focused corrections
      enableLogging: true,
      // Optional: Use different model for fixing if needed
      // modelOverride: 'gpt-4o-mini' // Could use cheaper model for fixes
    };

    try {
      // Attempt to fix the tool using AI iterator
      const fixResult = await fixToolWithAI(
        currentTool,
        validationIssuesForFixer,
        userIntent, // Pass original user intent for context
        iteratorConfig
      );

      if (fixResult.success && fixResult.fixedTool) {
        console.log('🔧 ITERATOR: ✅ Tool successfully fixed by AI!');
        console.log(`🔧 ITERATOR: Fixed in ${fixResult.attempts} attempts`);
        console.log(`🔧 ITERATOR: ${fixResult.improvements?.issuesFixed || 0} issues fixed, ${fixResult.improvements?.blockersResolved || 0} blockers resolved`);
        
        // Use the fixed tool and its validation result
        currentTool = fixResult.fixedTool;
        validationResult = fixResult.validation!;
        
        // Update validation metadata to reflect iteration success
        validationResult.sessionPhase = 'iteration';
        validationResult.attempt = fixResult.attempts;
        
      } else {
        // Iterator failed - log details but continue with original tool
        console.error('🔧 ITERATOR: ❌ Tool fixing failed after maximum attempts');
        console.error(`🔧 ITERATOR: Error: ${fixResult.error}`);
        console.error(`🔧 ITERATOR: Attempts: ${fixResult.attempts}`);
        
        if (fixResult.improvements) {
          console.log(`🔧 ITERATOR: Partial improvements: ${fixResult.improvements.issuesFixed} issues fixed, ${fixResult.improvements.blockersResolved} blockers resolved`);
        }
        
        // Use the best partial result if available, otherwise original
        if (fixResult.fixedTool && fixResult.validation) {
          console.log('🔧 ITERATOR: Using best partial fix result');
          currentTool = fixResult.fixedTool;
          validationResult = fixResult.validation;
          validationResult.sessionPhase = 'iteration';
          validationResult.attempt = fixResult.attempts;
        }
        
        // If we still have blocking errors, throw error to prevent saving bad tool
        if (validationResult.blockers.length > 0) {
          console.error('🛡️ VALIDATION: ❌ Tool validation FAILED even after AI correction attempts');
          throw new Error(`Tool validation failed after ${fixResult.attempts} correction attempts. ${validationResult.blockers.length} blocking error(s) remain: ${validationResult.blockers.map(b => b.issue).join('; ')}`);
        }
      }
      
    } catch (iteratorError) {
      console.error('🔧 ITERATOR: Iterator system error:', iteratorError);
      
      // If iterator system itself fails, fall back to original validation behavior
      if (validationResult.blockers.length > 0) {
        console.error('🛡️ VALIDATION: ❌ Tool validation FAILED and iterator system failed');
        throw new Error(`Tool validation failed with ${validationResult.blockers.length} blocking error(s) and iterator system error: ${iteratorError instanceof Error ? iteratorError.message : String(iteratorError)}`);
      }
    }
  }
  
  // Final validation check - ensure we have a valid tool
  if (!validationResult.isValid) {
    console.error('🛡️ VALIDATION: ❌ Tool validation still invalid after all attempts');
    throw new Error(`Tool validation failed with ${validationResult.blockers.length} blocking error(s): ${validationResult.blockers.map(b => b.issue).join('; ')}`);
  }
  
  // Success! Tool is valid (either initially or after AI fixes)
  console.log('🛡️ VALIDATION: ✅ Tool validation PASSED - safe to save');
  if (validationResult.issues.length > 0) {
    console.log('🛡️ VALIDATION: ⚠️ Found', validationResult.issues.length, 'non-blocking issues');
  }
  
  return {
    tool: currentTool, // Use currentTool (may be original or fixed version)
    validation: validationResult
  };
} 