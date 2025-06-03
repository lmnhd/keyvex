// Create Tool Core Logic - Reusable business logic for Lambda compatibility

import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import { aiOrchestrator, ToolCreationRequest, StreamingCallbacks } from '@/lib/ai/orchestrator';
import * as babel from '@babel/core';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { buildToolCreationUserPrompt, TOOL_CREATION_PROMPT } from '@/lib/prompts/tool-creation-prompt';

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

// Helper function to get system prompt
function getToolCreationSystemPrompt(): string {
  console.log('🏭 TRACE: TOOL_CREATION_PROMPT length:', TOOL_CREATION_PROMPT.length);
  console.log('🏭 TRACE: TOOL_CREATION_PROMPT first 1000 chars:', TOOL_CREATION_PROMPT.substring(0, 1000));
  return TOOL_CREATION_PROMPT;
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
): Promise<ProductToolDefinition> {
  console.log('🏭 TRACE: processToolCreation START');
  console.log('🏭 TRACE: userIntent:', userIntent);
  console.log('🏭 TRACE: context received:', JSON.stringify(context, null, 2));
  console.log('🏭 TRACE: existingTool:', existingTool?.id || 'none');
  
  try {
    // Get model configuration
    const modelConfig = getPrimaryModel('toolCreation');
    const model = modelConfig ? createModelInstance(modelConfig.provider, modelConfig.modelInfo.id) : openai('gpt-4o');
    
    console.log('🏭 TRACE: Using model:', modelConfig?.modelInfo?.id || 'gpt-4o');
    
    // FORCE gpt-4o for debugging
    const debugModel = openai('gpt-4o');
    console.log('🏭 TRACE: ⚠️ FORCING gpt-4o for debugging purposes');

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

    // Get the system prompt
    const systemPrompt = getToolCreationSystemPrompt();
    console.log('🏭 TRACE: System prompt length:', systemPrompt.length);
    console.log('🏭 TRACE: System prompt preview (first 500 chars):', systemPrompt.substring(0, 500));

    // Generate tool definition using AI
    console.log('🏭 TRACE: Calling AI model...');
    const result = await generateObject({
      model: debugModel,
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

    // 🛡️ COMPREHENSIVE TOOL VALIDATION - Prevent saving bad tools
    console.log('🛡️ VALIDATION: Running comprehensive tool validation...');
    
    const validationErrors: string[] = [];
    
    // 1. Check for Card component usage (will cause ReferenceError since removed from renderer)
    if (toolDefinition.componentCode.includes('Card') || 
        toolDefinition.componentCode.includes('CardHeader') ||
        toolDefinition.componentCode.includes('CardContent') ||
        toolDefinition.componentCode.includes('CardTitle')) {
      validationErrors.push('Tool uses forbidden Card components that are no longer available in execution context');
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
        validationErrors.push(`Component code execution failed: ${testResult.error}`);
      } else {
        console.log('🛡️ VALIDATION: ✅ JavaScript execution test passed');
      }
    } catch (error) {
      validationErrors.push(`Component code validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 3. Check for React component function pattern
    const functionPattern = /function\s+\w+\s*\([^)]*\)\s*\{/;
    if (!functionPattern.test(toolDefinition.componentCode)) {
      validationErrors.push('Component code does not contain a valid React component function declaration');
    }
    
    // 4. Check for required React patterns
    if (!toolDefinition.componentCode.includes('React.createElement')) {
      validationErrors.push('Component code does not use React.createElement (required pattern)');
    }
    
    if (!toolDefinition.componentCode.includes('useState')) {
      validationErrors.push('Component code does not contain React state hooks (required for interactive tools)');
    }
    
    // 5. Check for problematic undefined patterns
    const problematicPatterns = [
      /,\s*undefined\s*,/g,     // undefined in arrays/function calls
      /,\s*undefined\s*\)/g,    // undefined as last parameter
      /\(\s*undefined\s*,/g,    // undefined as first parameter
      /:\s*undefined\s*,/g,     // undefined as object value
      /=\s*undefined\s*;/g      // undefined assignment
    ];
    
    for (const pattern of problematicPatterns) {
      if (pattern.test(toolDefinition.componentCode)) {
        validationErrors.push('Component code contains problematic undefined patterns that cause runtime errors');
        break;
      }
    }
    
    // 6. Validate required data-style-id attributes - RELAXED: Not all tools need dynamic styling
    if (!toolDefinition.componentCode.includes('data-style-id')) {
      console.log('🛡️ VALIDATION: ⚠️ Component missing data-style-id attributes (dynamic styling disabled)');
      // This is a warning, not an error - tools can function without dynamic styling
    }
    
    // 7. Validate initialStyleMap completeness - RELAXED: Allow empty style maps
    // Note: initialStyleMap can be empty for simple tools that don't require custom styling
    if (toolDefinition.initialStyleMap === null || toolDefinition.initialStyleMap === undefined) {
      console.log('🛡️ VALIDATION: ⚠️ initialStyleMap is null/undefined, setting to empty object');
      toolDefinition.initialStyleMap = {};
    }
    
    // 8. Check for common syntax errors that cause crashes
    if (toolDefinition.componentCode.includes('import ') || toolDefinition.componentCode.includes('export ')) {
      validationErrors.push('Component code contains import/export statements (forbidden in dynamic execution)');
    }
    
    // If validation failed, throw error to prevent saving bad tool
    if (validationErrors.length > 0) {
      console.error('🛡️ VALIDATION: ❌ Tool validation FAILED:', validationErrors);
      throw new Error(`Tool validation failed: ${validationErrors.join('; ')}`);
    }
    
    console.log('🛡️ VALIDATION: ✅ Tool validation PASSED - safe to save');

    console.log('🏭 TRACE: processToolCreation SUCCESS - returning clean tool definition');
    return toolDefinition;

  } catch (error) {
    console.error('🏭 TRACE: processToolCreation ERROR:', error);
    console.error('🏭 TRACE: Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('🏭 TRACE: Error message:', error instanceof Error ? error.message : String(error));
    console.error('🏭 TRACE: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    throw new Error(`Tool creation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 