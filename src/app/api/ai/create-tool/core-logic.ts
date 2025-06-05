// Create Tool Core Logic - Reusable business logic for Lambda compatibility

import { z } from 'zod';
import { generateObject, GenerateObjectResult, LanguageModelV1 } from 'ai'; // Added GenerateObjectResult and LanguageModelV1
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { getPrimaryModel, getFallbackModel, getModelProvider, getProcessConfig } from '@/lib/ai/models/model-config'; // Added getProcessConfig
import { aiOrchestrator, ToolCreationRequest as OrchestratorToolCreationRequest, StreamingCallbacks } from '@/lib/ai/orchestrator'; // Renamed to avoid conflict
import * as babel from '@babel/core';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { getToolCreationSystemPrompt, buildToolCreationUserPrompt, PromptOptions } from '@/lib/prompts/tool-creation-prompt-modular';
import { trackValidationIssue } from '@/lib/validation/validation-tracker';
import { ValidationIssue } from '@/lib/types/validation';
import { TOOL_FIXER_SYSTEM_PROMPT, buildToolFixerUserPrompt } from '@/lib/prompts/tool-fixer-prompt';
import { extractAndEnhanceStyles, validateStyleExtraction, previewStyleExtraction } from '@/lib/utils/style-extractor';
import logger from '@/lib/logger';

// Local schema definition (since it's not exported from types)
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
  
  componentCode: z.string(),
  initialStyleMap: z.record(z.string()),
  currentStyleMap: z.record(z.string()).optional(),
  
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
  
  analytics: z.object({
    enabled: z.boolean(),
    completions: z.number(),
    averageTime: z.number()
  }).optional()
});

// Local color schemes (since module doesn't exist)
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

// Local createModelInstance function (since module doesn't exist)
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

// Strongly typed interface for generateObject parameters
interface GenerateObjectParams {
  model: LanguageModelV1; // Strongly typed model instance from AI SDK
  schema: z.ZodSchema<any>; // Strongly typed Zod schema for structured output validation
  prompt: string; // Combined system + user prompt
  temperature?: number; // Optional temperature setting (0.0 to 1.0)
  maxRetries?: number; // Optional max retry attempts
  mode?: 'auto' | 'tool' | 'json'; // Optional generation mode
  schemaName?: string; // Optional schema name for provider guidance
  schemaDescription?: string; // Optional schema description
  experimental_repairText?: (params: { text: string; error: any }) => Promise<string>; // Optional text repair function
}


// Helper function to handle OpenAI TPM rate limits with specific retry-after logic
async function generateObjectWithRateLimitHandling(
  params: GenerateObjectParams,
  maxRateLimitRetries: number = 2 // Number of times to retry specifically for rate limits
): Promise<GenerateObjectResult<any>> { // Explicitly type the promise resolution
  let attempts = 0;
  // Ensure params.maxRetries is 0 by default, to let this helper manage rate limit retries primarily
  const robustParams: GenerateObjectParams = { 
    ...params, 
    maxRetries: params.maxRetries !== undefined ? params.maxRetries : 0 
  };

  while (true) {
    try {
      const result = await generateObject(robustParams);
      return result;
    } catch (error: any) {
      attempts++;
      const errorMessage = error.message || (error.cause?.message) || '';
      
      const rateLimitMatch = errorMessage.match(/Rate limit reached.*Please try again in (\d+(\.\d+)?)s/i);

      if (rateLimitMatch && rateLimitMatch[1]) {
        if (attempts > maxRateLimitRetries) {
          logger.error(`🔧 RATE LIMITER: Max rate limit retries (${maxRateLimitRetries}) reached. Failing. Last error: ${errorMessage}`);
          throw error;
        }

        const delaySeconds = parseFloat(rateLimitMatch[1]);
        const delayMs = Math.ceil(delaySeconds * 1000) + 500; // Add a small buffer

        logger.warn(`🔧 RATE LIMITER: OpenAI TPM rate limit hit. Attempt ${attempts}/${maxRateLimitRetries +1 }. Retrying in ${delayMs}ms. Error: ${errorMessage.substring(0,200)}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        // Continue to next iteration of the while loop to retry
      } else {
        logger.warn(`🔧 RATE LIMITER: Non-OpenAI-TPM rate limit error or unparsable. Error: ${errorMessage.substring(0,200)}... Re-throwing.`);
        throw error;
      }
    }
  }
}

// Missing type definitions (since validation types are limited)
export interface ToolValidationResult {
  isValid: boolean;
  issues: any[];
  blockers: any[];
  sessionPhase?: string;
  attempt?: number;
}

export interface ToolCreationResult {
  tool: ProductToolDefinition;
  validation: ToolValidationResult;
}

// Simple validation function (since performFullValidation doesn't exist)
function performFullValidation(tool: ProductToolDefinition, context?: any): ToolValidationResult {
  const issues: any[] = [];
  const blockers: any[] = [];
  
  // Basic validation checks
  if (!tool.componentCode || !tool.componentCode.trim()) {
    blockers.push({ issue: 'Component code is missing or empty' });
  }
  
  if (!tool.metadata?.title || tool.metadata.title.includes('undefined')) {
    blockers.push({ issue: 'Tool title is missing or contains undefined' });
  }
  
  if (!tool.id || tool.id.includes('undefined')) {
    blockers.push({ issue: 'Tool ID is missing or contains undefined' });
  }
  
  return {
    isValid: blockers.length === 0,
    issues,
    blockers,
    sessionPhase: context?.sessionPhase || 'unknown',
    attempt: context?.attemptNumber || 1
  };
}

// Core request interface (example, assuming OrchestratorToolCreationRequest is the primary one)
export interface CreateToolRequest extends OrchestratorToolCreationRequest {
  // Add any specific fields for this core logic if different from orchestrator's
}

// Core response interface
export interface CreateToolResponse {
  success: boolean;
  data: any; // Consider making this ProductToolDefinition | ToolCreationResult
  metadata: {
    processingTime: number;
    sessionId?: string; // Make sessionId optional as it might not always be present
    provider: string;
    quality?: any; // Consider defining a quality schema
  };
}

// Streaming callback interface (if used directly by core logic)
export interface CreateToolStreamingCallbacks extends StreamingCallbacks {
  // Add any specific callbacks for this core logic
}

// Core processing context (example)
export interface CreateToolContext {
  request: CreateToolRequest;
  startTime: number;
  selectedModel?: string;
  userId?: string; // Added userId to context
}

// Enhanced return type to include validation (already defined in your file)
// export interface ToolCreationResult {
//   tool: ProductToolDefinition;
//   validation: ToolValidationResult;
// }

// Main processing function
export async function processToolCreation(
  userIntent: string,
  context: any, // This context comes from the API route, not CreateToolContext above
  existingTool?: ProductToolDefinition | null,
  userId?: string // userId passed directly
): Promise<ToolCreationResult> {
  logger.info('🏭 TRACE [processToolCreation]: Starting tool processing...');
  const startTime = Date.now();

  let modelConfig;
  let actualModelId: string;
  let actualModelName: string;
  let selectedModel = context.selectedModel; 

  const currentComponentSet = context.componentSet || 'shadcn';

  if (selectedModel && selectedModel !== 'default') {
    // CASE 1: Explicit model specified (e.g., 'gpt-4o', 'gpt-4.1-mini', etc.)
    logger.info(`🤖 TRACE [processToolCreation]: User selected explicit model: ${selectedModel}`);
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      modelConfig = { provider, modelId: selectedModel };
      actualModelId = selectedModel;
      actualModelName = selectedModel; 
    } else {
      logger.warn(`🤖 TRACE [processToolCreation]: Unknown provider for selected model ${selectedModel}. Falling back to default "toolCreator" config.`);
      const primaryDefault = getPrimaryModel('toolCreator');
      if (primaryDefault && 'modelInfo' in primaryDefault) {
        modelConfig = { provider: primaryDefault.provider, modelId: primaryDefault.modelInfo.id };
        actualModelId = primaryDefault.modelInfo.id;
        actualModelName = primaryDefault.modelInfo.id;
      } else {
        logger.error('CRITICAL: Default "toolCreator" model configuration not found! Using hard fallback.');
        modelConfig = { provider: 'openai', modelId: 'gpt-4o' }; 
        actualModelId = 'gpt-4o';
        actualModelName = 'gpt-4o';
      }
    }
  } else {
    // CASE 2: selectedModel is 'default' (from tests/ui page) OR no model specified
    if (selectedModel === 'default') {
      logger.info('🤖 TRACE [processToolCreation]: User selected "default" - using configured toolCreator primary model.');
    } else {
      logger.info('🤖 TRACE [processToolCreation]: No model specified - using default configured model from "toolCreator" process.');
    }
    
    const primaryDefault = getPrimaryModel('toolCreator'); 
    if (primaryDefault && 'modelInfo' in primaryDefault) {
      modelConfig = { provider: primaryDefault.provider, modelId: primaryDefault.modelInfo.id };
      actualModelId = primaryDefault.modelInfo.id;
      actualModelName = primaryDefault.modelInfo.id;
      logger.info('🤖 TRACE [processToolCreation]: Using toolCreator primary model:', primaryDefault.modelInfo);
    } else {
      logger.warn('🤖 TRACE [processToolCreation]: No default model info for "toolCreator", using hardcoded fallback gpt-4o');
      modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
      actualModelId = 'gpt-4o';
      actualModelName = 'gpt-4o';
    }
  }
  
  const selectionMethod = selectedModel && selectedModel !== 'default' 
    ? `Explicit User Selection (${selectedModel})` 
    : selectedModel === 'default' 
      ? 'User Selected "default" → toolCreator Config' 
      : 'No Model → toolCreator Config';
      
  logger.info({ 
    provider: modelConfig?.provider,
    modelName: actualModelName,
    selectionMethod,
    modelId: actualModelId,
    originalSelectedModel: selectedModel || 'none'
  }, '🚀 Create Tool Agent Model Selection:');

  const modelInstance = createModelInstance(modelConfig.provider, actualModelId);

  // 🔧 CRITICAL FIX: Clean brainstorm data to prevent AI confusion
  function cleanBrainstormContextData(brainstormData: any): any {
    if (!brainstormData) return null;
    
    console.log('🧹 CLEANING: Original brainstorm data keys:', Object.keys(brainstormData));
    
    // Create a clean copy without potentially problematic fields
    const cleaned = { ...brainstormData };
    
    // Remove prompt options that might conflict with tool creation
    const hasPromptOptions = !!cleaned.promptOptions;
    delete cleaned.promptOptions;
    
    // Remove overly complex metadata that might confuse the AI
    if (cleaned.suggestedInputs && Array.isArray(cleaned.suggestedInputs)) {
      cleaned.suggestedInputs = cleaned.suggestedInputs.map((input: any) => ({
        id: input.id,
        label: input.label,
        type: input.type,
        required: input.required
      }));
    }
    
    // Simplify calculation logic to prevent AI confusion
    if (cleaned.calculationLogic && Array.isArray(cleaned.calculationLogic)) {
      cleaned.calculationLogic = cleaned.calculationLogic.map((calc: any) => ({
        id: calc.id,
        name: calc.name,
        formula: calc.formula,
        outputFormat: calc.outputFormat
      }));
    }
    
    // Keep core concepts simple
    const simplifiedData = {
      coreConcept: cleaned.coreConcept || cleaned.coreWConcept,
      valueProposition: cleaned.valueProposition,
      keyCalculations: cleaned.keyCalculations || [],
      suggestedInputs: cleaned.suggestedInputs || [],
      calculationLogic: cleaned.calculationLogic || [],
      interactionFlow: cleaned.interactionFlow || [],
      creativeEnhancements: cleaned.creativeEnhancements || []
    };
    
    logger.info({ 
      hadPromptOptions: hasPromptOptions,
      originalKeys: Object.keys(brainstormData).length,
      cleanedKeys: Object.keys(simplifiedData).length
    }, '🧹 BRAINSTORM CLEANER: Simplified brainstorm data to prevent AI confusion');
    
    return simplifiedData;
  }

  let brainstormingContext = null;
  if (context.brainstormingResult || context.logicArchitectInsights) {
    const rawBrainstormingData = context.brainstormingResult || context.logicArchitectInsights;
    brainstormingContext = cleanBrainstormContextData(rawBrainstormingData);
    logger.info({ hasBrainstorming: true, source: context.brainstormingResult ? 'brainstormingResult' : 'logicArchitectInsights', wasCleaned: true }, '🏭 TRACE [processToolCreation]: External brainstorming loaded and cleaned.');
  } else {
    logger.info({ hasBrainstorming: false }, '🏭 TRACE [processToolCreation]: No external brainstorming context available');
  }

  const isUpdate = !!existingTool;
  const updateType = context.updateType || 'general';
  logger.info({ isUpdate, updateType }, '🏭 TRACE [processToolCreation]: Tool mode (update/create) determined.');

  let promptOptions: PromptOptions;
  if (brainstormingContext && brainstormingContext.promptOptions) {
    promptOptions = brainstormingContext.promptOptions;
    if (!promptOptions.componentSet) {
      promptOptions.componentSet = currentComponentSet;
    }
    logger.info('🏭 TRACE [processToolCreation]: Using promptOptions from brainstormingContext:', promptOptions);
  } else {
    logger.info('🏭 TRACE [processToolCreation]: No promptOptions in brainstormingContext, analyzing context manually.');
    promptOptions = {
      includeComprehensiveColors: true,
      includeGorgeousStyling: true,
      includeAdvancedLayouts: context.isComplexTool || context.toolComplexity === 'complex' || context.features?.includes('charts'),
      styleComplexity: context.styleComplexity || 'premium',
      industryFocus: context.industry,
      toolComplexity: context.toolType?.includes('Calculator') ? 'complex' : 'moderate',
      componentSet: currentComponentSet 
    };
    logger.info('🎨 ENHANCED: Using premium styling defaults for better visual quality and ensuring componentSet.');
  }
  
  const systemPrompt = getToolCreationSystemPrompt(promptOptions);
  const userPrompt = buildToolCreationUserPrompt(
    userIntent,
    context,
    existingTool,
    updateType
  );

  logger.info({ systemPromptLength: systemPrompt.length, userPromptLength: userPrompt.length }, '🏭 TRACE [processToolCreation]: Prompt lengths calculated.');
    
  let parsedToolDefinition: any;

  try {
    logger.info(`🏭 TRACE [processToolCreation]: Calling generateObjectWithRateLimitHandling with model: ${actualModelName}`);
    
    // Combine system and user prompts according to AI SDK format
    const combinedPrompt = `${systemPrompt}\n\nUser Request: ${userPrompt}`;
    
    const result = await generateObjectWithRateLimitHandling({
      model: modelInstance,
      schema: productToolDefinitionSchema,
      prompt: combinedPrompt,
      temperature: getProcessConfig('toolCreator')?.temperature || 0.7,
      maxRetries: 0, // Let wrapper handle rate limit retries
    });
    
    parsedToolDefinition = result.object;
  } catch (error: any) {
    logger.warn(`🏭 TRACE [processToolCreation]: AI call failed: ${error.message}.`);
    if (error.message.includes('response did not match schema') || error.message.includes('Type validation failed')) {
      logger.info('🔧 SCHEMA FIX: Schema validation failed - attempting to create minimal tool for iterator.');
      if (error.text || (error.cause && error.cause.value)) {
        const partialResponseData = error.cause ? error.cause.value : (typeof error.text === 'string' ? JSON.parse(error.text) : error.text || {});
        logger.debug({ partialResponseData }, '🔧 SCHEMA FIX: Partial response data:');
        parsedToolDefinition = {
          id: partialResponseData.id || `tool-${Date.now()}`,
          slug: partialResponseData.slug || `tool-slug-${Date.now()}`,
          version: partialResponseData.version || '1.0',
          status: partialResponseData.status || 'draft',
          createdAt: partialResponseData.createdAt || Date.now(),
          updatedAt: Date.now(),
          createdBy: partialResponseData.createdBy || 'system',
          metadata: partialResponseData.metadata || {
            id: partialResponseData.id || `meta-${Date.now()}`,
            slug: partialResponseData.slug || `meta-slug-${Date.now()}`,
            title: 'Generated Tool (Needs Fixing - Schema Mismatch)',
            description: 'Tool generated by AI but needs iterator fixing due to schema mismatch.',
            shortDescription: 'Needs fixing (schema)',
            type: 'tool', category: 'general', targetAudience: 'general users', industry: 'various', tags: [],
            estimatedCompletionTime: 5, difficultyLevel: 'beginner' as const, features: [],
            icon: { type: 'lucide' as const, value: 'Package' }
          },
          componentSet: partialResponseData.componentSet || currentComponentSet,
          componentCode: `'use client';\nfunction SafePlaceholderComponent() { return React.createElement('div', { className: 'p-4 border-2 border-yellow-400 bg-yellow-50 text-yellow-800 rounded-lg text-center', 'data-style-id': 'safe-placeholder' }, ['Schema validation failed. The AI-generated component contained syntax errors.', React.createElement('br', { key: 'br1' }), 'Click regenerate to create a new tool.']); }`,
          colorScheme: partialResponseData.colorScheme || DEFAULT_COLOR_SCHEMES.professional,
          initialStyleMap: partialResponseData.initialStyleMap || {},
          currentStyleMap: partialResponseData.currentStyleMap || {},
          analytics: partialResponseData.analytics || { enabled: true, completions: 0, averageTime: 0 }
        };
      } else {
        logger.error('🔧 SCHEMA FIX: Schema validation failed, but no partial response found. Creating generic placeholder.');
        parsedToolDefinition = {
          id: `tool-${Date.now()}`, slug: `tool-slug-${Date.now()}`, version: '1.0', status: 'draft' as const,
          createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'system_schema_fix',
          metadata: {
            id: `meta-${Date.now()}`, slug: `meta-slug-${Date.now()}`, title: 'Schema Fix Required',
            description: 'Tool generation failed schema validation with no partial response.', shortDescription: 'Schema validation failed',
            type: 'tool', category: 'general', targetAudience: 'general users', industry: 'various', tags: [],
            estimatedCompletionTime: 5, difficultyLevel: 'beginner' as const, features: [],
            icon: { type: 'lucide' as const, value: 'AlertTriangle' }
          },
          componentSet: currentComponentSet,
          componentCode: `'use client';\nfunction SchemaErrorComponent() { return React.createElement('div', { className: 'p-4 border-2 border-orange-400 bg-orange-50 text-orange-800 rounded-lg text-center', 'data-style-id': 'schema-error' }, ['Schema validation failed with no recoverable data.', React.createElement('br', { key: 'br1' }), 'Please try regenerating the tool.']); }`,
          colorScheme: DEFAULT_COLOR_SCHEMES.professional,
          initialStyleMap: {}, currentStyleMap: {},
          analytics: { enabled: true, completions: 0, averageTime: 0 }
        };
      }
    } else {
      logger.error('🏭 TRACE [processToolCreation]: Unhandled AI call error (not schema validation). Creating generic placeholder.');
      parsedToolDefinition = {
        id: `tool-${Date.now()}`, slug: `tool-slug-${Date.now()}`, version: '1.0', status: 'draft' as const,
        createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'system_unhandled_error',
        metadata: {
          id: `meta-${Date.now()}`, slug: `meta-slug-${Date.now()}`, title: 'Unhandled AI Error',
          description: 'Tool generation failed due to an unhandled error during AI call.', shortDescription: 'Unhandled error',
          type: 'tool', category: 'general', targetAudience: 'general users', industry: 'various', tags: [],
          estimatedCompletionTime: 5, difficultyLevel: 'beginner' as const, features: [],
          icon: { type: 'lucide' as const, value: 'XCircle' }
        },
        componentSet: currentComponentSet,
        componentCode: `'use client';\nfunction UnhandledErrorComponent() { return React.createElement('div', { className: 'p-4 border-2 border-red-400 bg-red-50 text-red-800 rounded-lg text-center', 'data-style-id': 'unhandled-error' }, ['An unhandled error occurred during tool generation.', React.createElement('br', { key: 'br1' }), 'Please try again or contact support.']); }`,
        colorScheme: DEFAULT_COLOR_SCHEMES.professional,
        initialStyleMap: {}, currentStyleMap: {},
        analytics: { enabled: true, completions: 0, averageTime: 0 }
      };
    }
    // Fallback generic placeholder if all else fails within catch
    if (!parsedToolDefinition) {
        parsedToolDefinition = {
            id: `tool-${Date.now()}`, slug: `tool-slug-${Date.now()}`, version: '1.0', status: 'draft' as const,
            createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'system_error_handler',
            metadata: {
              id: `meta-${Date.now()}`, slug: `meta-slug-${Date.now()}`, title: 'Tool Creation Failed (Critical Error)',
              description: 'Tool generation failed due to an unhandled error during AI call.', shortDescription: 'Needs regeneration (critical error)',
              type: 'tool', category: 'general', targetAudience: 'general users', industry: 'various', tags: [],
              estimatedCompletionTime: 5, difficultyLevel: 'beginner' as const, features: [],
              icon: { type: 'lucide' as const, value: 'AlertTriangle' }
            },
            componentSet: currentComponentSet,
            componentCode: `'use client';\nfunction CriticalErrorComponent() { return React.createElement('div', {className: 'p-4 text-red-500 font-bold'}, 'Critical error: Tool generation failed to produce content.'); }`,
            colorScheme: DEFAULT_COLOR_SCHEMES.professional,
            initialStyleMap: {}, currentStyleMap: {},
            analytics: { enabled: true, completions: 0, averageTime: 0 }
        };
    }
  }

  if (!parsedToolDefinition) {
    logger.error("CRITICAL: parsedToolDefinition is null/undefined after AI call and error handling. This should not happen. Creating final fallback.");
    parsedToolDefinition = {
        id: `tool-${Date.now()}`, slug: `tool-slug-${Date.now()}`, version: '1.0', status: 'draft' as const,
        createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'system_critical_fallback',
        metadata: {
          id: `meta-${Date.now()}`, slug: `meta-slug-${Date.now()}`, title: 'Critical Fallback Tool',
          description: 'Critical error in tool processing, fallback created.', shortDescription: 'Critical Fallback',
          type: 'tool', category: 'general', targetAudience: 'general users', industry: 'various', tags: [],
          estimatedCompletionTime: 5, difficultyLevel: 'beginner' as const, features: [],
          icon: { type: 'lucide' as const, value: 'AlertTriangle' }
        },
        componentSet: currentComponentSet,
        componentCode: `'use client';\nfunction CriticalErrorComponent() { return React.createElement('div', {className: 'p-4 text-red-500 font-bold'}, 'Critical error during tool generation. Unable to recover.'); }`,
        colorScheme: DEFAULT_COLOR_SCHEMES.professional,
        initialStyleMap: {}, currentStyleMap: {},
        analytics: { enabled: true, completions: 0, averageTime: 0 }
    };
  }

  let rawComponentCode = parsedToolDefinition.componentCode || "";
  if (rawComponentCode) {
    const trimmedCode = rawComponentCode.trimStart();
    if (!trimmedCode.startsWith("'use client'") && !trimmedCode.startsWith('"use client"')) {
      rawComponentCode = "'use client';\n" + rawComponentCode;
    }
  } else {
    logger.warn("🏭 TRACE [processToolCreation]: componentCode is empty/undefined in parsedToolDefinition. Using placeholder.");
    rawComponentCode = `'use client';\nfunction EmptyComponent() { return React.createElement('div', {}, 'Error: Component code was empty.'); }`;
  }

  if (parsedToolDefinition) {
    logger.debug({ keys: Object.keys(parsedToolDefinition) }, '🏭 TRACE [processToolCreation]: Raw AI response object keys:');
  }

  const finalToolDefinition: ProductToolDefinition = {
    id: parsedToolDefinition.id || `tool-${Date.now()}`,
    slug: parsedToolDefinition.slug || `tool-slug-${Date.now()}`,
    version: parsedToolDefinition.version || '1.0',
    status: parsedToolDefinition.status || 'draft',
    createdAt: parsedToolDefinition.createdAt || Date.now(),
    updatedAt: Date.now(),
    createdBy: userId || parsedToolDefinition.createdBy || 'lem1', 
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
    componentSet: parsedToolDefinition.componentSet || currentComponentSet,
    componentCode: rawComponentCode,
    colorScheme: parsedToolDefinition.colorScheme || DEFAULT_COLOR_SCHEMES.professional,
    initialStyleMap: parsedToolDefinition.initialStyleMap || {},
    currentStyleMap: parsedToolDefinition.currentStyleMap || parsedToolDefinition.initialStyleMap || {},
    analytics: parsedToolDefinition.analytics || {
      enabled: true,
      completions: 0,
      averageTime: 0
    }
  };

  logger.info('🎨 POST-PROCESSING: Starting automatic style extraction...');
  let enhancedToolDefinition = finalToolDefinition;
  try {
    const styleExtractionResult = extractAndEnhanceStyles(
      finalToolDefinition.componentCode,
      { preserveExistingDataStyleIds: true, generateDescriptiveIds: true, includeBasicElements: true, idPrefix: '' }
    );
    
    if (styleExtractionResult.totalStylesExtracted > 0) {
      enhancedToolDefinition = {
        ...finalToolDefinition,
        componentCode: styleExtractionResult.modifiedComponentCode,
        initialStyleMap: { ...finalToolDefinition.initialStyleMap, ...styleExtractionResult.initialStyleMap },
        currentStyleMap: { ...finalToolDefinition.currentStyleMap, ...styleExtractionResult.initialStyleMap }
      };
      logger.info('🎨 POST-PROCESSING: ✅ Style extraction successful!');
      previewStyleExtraction(styleExtractionResult);
    } else {
      logger.warn('🎨 POST-PROCESSING: ⚠️ Style extraction made no changes');
    }
  } catch (styleError: any) {
    logger.error('🎨 POST-PROCESSING: ❌ Error during style extraction:', styleError.message);
  }

  const finalUndefinedFields: string[] = [];
  // Add comprehensive undefined checks for enhancedToolDefinition
  if (!enhancedToolDefinition.id || String(enhancedToolDefinition.id).includes('undefined')) finalUndefinedFields.push('id');
  if (!enhancedToolDefinition.slug || String(enhancedToolDefinition.slug).includes('undefined')) finalUndefinedFields.push('slug');
  if (!enhancedToolDefinition.metadata?.id || String(enhancedToolDefinition.metadata.id).includes('undefined')) finalUndefinedFields.push('metadata.id');
  if (!enhancedToolDefinition.metadata?.slug || String(enhancedToolDefinition.metadata.slug).includes('undefined')) finalUndefinedFields.push('metadata.slug');
  if (!enhancedToolDefinition.metadata?.title || String(enhancedToolDefinition.metadata.title).includes('undefined')) finalUndefinedFields.push('metadata.title');


  if (finalUndefinedFields.length > 0) {
    logger.error('🏭 TRACE [processToolCreation]: ⚠️ UNDEFINED VALUES in final tool definition before validation:', finalUndefinedFields);
    throw new Error(`Tool definition contains undefined values before validation: ${finalUndefinedFields.join(', ')}`);
  }

  logger.info('🛡️ VALIDATION: Running comprehensive tool validation...');
  let currentTool = enhancedToolDefinition;
  let validationResult = performFullValidation(currentTool, {
    toolId: currentTool.id,
    toolTitle: currentTool.metadata.title,
    attemptNumber: 1,
    sessionPhase: 'initial_creation',
    selectedModel: actualModelName,
    hasExternalBrainstorming: !!brainstormingContext,
    toolComplexity: promptOptions.toolComplexity || 'unknown'
  });

  if (!validationResult.isValid && validationResult.blockers.length > 0) {
    logger.info('🔧 ITERATOR: Initial validation failed - attempting AI corrections...');
    const validationIssuesForFixer: ValidationIssue[] = validationResult.issues.map((issue: any) => ({
      ...issue, // Spread existing issue properties
      id: issue.id || `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Ensure ID
      toolId: currentTool.id,
      toolTitle: currentTool.metadata.title,
      category: issue.category as any, 
      timestamp: issue.timestamp || Date.now(), // Ensure timestamp
      resolved: issue.resolved || false, // Ensure resolved
      autoFixable: issue.autoFixable || false
    }));

    const iteratorConfig: Partial<ToolFixerConfig> = {
      maxAttempts: 3,
      temperature: getProcessConfig('toolFixer')?.temperature || 0.3,
      enableLogging: true,
    };

    try {
      const fixResult = await fixToolWithAI(
        currentTool,
        validationIssuesForFixer,
        userIntent,
        iteratorConfig
      );

      if (fixResult.success && fixResult.fixedTool) {
        logger.info('🔧 ITERATOR: ✅ Tool successfully fixed by AI!');
        currentTool = fixResult.fixedTool;
        validationResult = fixResult.validation!;
        validationResult.sessionPhase = 'iteration';
        validationResult.attempt = fixResult.attempts;
      } else {
        logger.error('🔧 ITERATOR: ❌ Tool fixing failed after maximum attempts');
        if (fixResult.fixedTool && fixResult.validation) { 
          currentTool = fixResult.fixedTool;
          validationResult = fixResult.validation;
        }
        if (validationResult.blockers.length > 0) {
            logger.error('🛡️ VALIDATION: ❌ Tool validation FAILED even after AI correction attempts');
            const modelNameForError = selectedModel || actualModelName || 'Unknown Model';
            throw new Error(`Tool validation failed for model ${modelNameForError} after ${fixResult.attempts} correction attempts. ${validationResult.blockers.length} blocking error(s) remain: ${validationResult.blockers.map(b => b.issue).join('; ')}`);
        }
      }
    } catch (iteratorError: any) {
      logger.error('🔧 ITERATOR: ❌ Major error during AI fixing process:', iteratorError.message);
      const modelNameForError = selectedModel || actualModelName || 'Unknown Model';
      throw new Error(`Error during AI fixing process for model ${modelNameForError}: ${iteratorError.message}`);
    }
  }
  
  const duration = Date.now() - startTime;
  logger.info(`✅ Tool ${validationResult.isValid ? 'created and validated' : 'processed with validation issues'} in ${duration}ms: ${currentTool.metadata.title}`);
  
  return {
    tool: currentTool,
    validation: validationResult,
  };
}

export interface ToolFixerConfig {
  maxAttempts: number;
  temperature: number;
  modelOverride?: string; 
  enableLogging: boolean;
}

export const DEFAULT_TOOL_FIXER_CONFIG: ToolFixerConfig = {
  maxAttempts: 3,
  temperature: 0.3, 
  enableLogging: true
};

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

export async function fixToolWithAI(
  failedToolDefinition: ProductToolDefinition,
  validationIssues: ValidationIssue[],
  originalUserIntent: string,
  config: Partial<ToolFixerConfig> = {}
): Promise<ToolFixResult> {
  const fixerConfig = { ...DEFAULT_TOOL_FIXER_CONFIG, ...config };
  
  logger.info('🔧 TOOL FIXER: Starting AI-powered tool correction...');
  // ... (existing logging for config, failed tool preview, issues) ...

  let currentTool = JSON.parse(JSON.stringify(failedToolDefinition)); 
  let currentValidation: ToolValidationResult | undefined = undefined; // Initialize
  let attempts = 0;
  
  const initialBlockerCount = validationIssues.filter(issue => issue.severity === 'error').length;
  let issuesForThisAttempt = [...validationIssues]; 

  for (attempts = 1; attempts <= fixerConfig.maxAttempts; attempts++) {
    logger.info(`🔧 TOOL FIXER: ATTEMPT ${attempts}/${fixerConfig.maxAttempts}`);
    try {
      let modelToUse;
      let modelIdForFixing: string;

      if (fixerConfig.modelOverride) {
        const provider = getModelProvider(fixerConfig.modelOverride);
        if (provider !== 'unknown') {
          modelToUse = createModelInstance(provider, fixerConfig.modelOverride);
          modelIdForFixing = fixerConfig.modelOverride;
          logger.info(`🔧 TOOL FIXER: Using override model: ${modelIdForFixing}`);
        } else {
          logger.warn(`🔧 TOOL FIXER: Unknown provider for override model ${fixerConfig.modelOverride}. Using 'toolFixer' fallback.`);
          const fallbackFixerModel = getFallbackModel('toolFixer');
          modelIdForFixing = fallbackFixerModel?.model || 'gpt-4.1-mini'; 
          modelToUse = createModelInstance(fallbackFixerModel?.provider || 'openai', modelIdForFixing);
        }
      } else {
        const primaryFixerModel = getPrimaryModel('toolFixer');
        if (primaryFixerModel && 'modelInfo' in primaryFixerModel) {
          modelIdForFixing = primaryFixerModel.modelInfo.id;
          modelToUse = createModelInstance(primaryFixerModel.provider, modelIdForFixing);
          logger.info(`🔧 TOOL FIXER: Using configured 'toolFixer' primary model: ${modelIdForFixing}`);
        } else {
          logger.warn("🔧 TOOL FIXER: 'toolFixer' primary model not found, using hardcoded gpt-4o.");
          modelIdForFixing = 'gpt-4o'; 
          modelToUse = createModelInstance('openai', modelIdForFixing);
        }
      }
      
      const fixerUserPrompt = buildToolFixerUserPrompt(
        currentTool, 
        issuesForThisAttempt, 
        originalUserIntent,
        attempts,
        fixerConfig.maxAttempts
      );
      
      logger.info(`🔧 TOOL FIXER: Calling generateObjectWithRateLimitHandling with model for fixing: ${modelIdForFixing}`);
      // @ts-ignore - AI SDK compatibility issue with schema parameter
      const result = await generateObjectWithRateLimitHandling({ 
        model: modelToUse,
        schema: productToolDefinitionSchema,
        prompt: `${TOOL_FIXER_SYSTEM_PROMPT}\n\nUser Request: ${fixerUserPrompt}`,
        temperature: fixerConfig.temperature,
        maxRetries: 0, // Let wrapper handle rate limit retries
      }, 2); // Max 2 rate limit retries within each fixer attempt
      
      const aiFixedTool = result.object as ProductToolDefinition;
      
      currentTool = { 
        ...currentTool, 
        ...aiFixedTool, 
        id: aiFixedTool.id || currentTool.id, 
        updatedAt: Date.now(), 
        metadata: {
            ...(currentTool.metadata || {}),
            ...(aiFixedTool.metadata || {}),
            id: aiFixedTool.metadata?.id || currentTool.metadata?.id || aiFixedTool.id || currentTool.id,
            slug: aiFixedTool.metadata?.slug || currentTool.metadata?.slug || aiFixedTool.slug || currentTool.slug,
            title: aiFixedTool.metadata?.title || currentTool.metadata?.title || 'Fixed Tool',
        },
        initialStyleMap: aiFixedTool.initialStyleMap || {}, 
        currentStyleMap: aiFixedTool.currentStyleMap || aiFixedTool.initialStyleMap || {},
      };

      if (currentTool.componentCode) {
        const trimmedCode = currentTool.componentCode.trimStart();
        if (!trimmedCode.startsWith("'use client'") && !trimmedCode.startsWith('"use client"')) {
          currentTool.componentCode = "'use client';\n" + currentTool.componentCode;
        }
      } else {
         currentTool.componentCode = `'use client';\nfunction MissingCodeComponent() { return React.createElement('div', {}, 'Error: Component code was missing after fix attempt.'); }`;
      }
      
      currentValidation = performFullValidation(currentTool, {
         toolId: currentTool.id, toolTitle: currentTool.metadata.title,
         attemptNumber: attempts, sessionPhase: 'iteration_fix_attempt'
      });
      
      const newBlockerCount = currentValidation.blockers.length;
      logger.info(`🔧 TOOL FIXER: Attempt ${attempts} validation - ${newBlockerCount} blockers remain.`);

      if (currentValidation.isValid) {
        logger.info('🔧 TOOL FIXER: ✅ Tool successfully fixed and validated!');
        return { success: true, fixedTool: currentTool, validation: currentValidation, attempts, improvements: { issuesFixed: initialBlockerCount - newBlockerCount, blockersResolved: initialBlockerCount - newBlockerCount, newIssues: 0 } };
      }

      issuesForThisAttempt = currentValidation.issues.map(issue => ({
        id: issue.id || `issue-attempt-${attempts}-${Date.now()}`, toolId: currentTool.id, toolTitle: currentTool.metadata.title,
        severity: issue.severity, category: issue.category as any, issue: issue.issue, details: issue.details,
        codeSnippet: issue.codeSnippet, timestamp: Date.now(), resolved: false, autoFixable: issue.autoFixable || false
      }));
      
      if (attempts === fixerConfig.maxAttempts) {
        logger.info('🔧 TOOL FIXER: ⚠️ Reached maximum attempts - returning best effort.');
        return { success: false, fixedTool: currentTool, validation: currentValidation, attempts, error: `Could not fully fix tool after ${fixerConfig.maxAttempts} attempts. ${newBlockerCount} blockers remain.`, improvements: { issuesFixed: initialBlockerCount - newBlockerCount, blockersResolved: initialBlockerCount - newBlockerCount, newIssues: 0 } };
      }
      if (newBlockerCount === 0 && !currentValidation.isValid) { // All blockers gone, but other issues remain
          logger.info('🔧 TOOL FIXER: ✅ All blockers resolved, but tool still has non-blocking issues. Returning as successful fix for blocking issues.');
          return { success: true, fixedTool: currentTool, validation: currentValidation, attempts, improvements: {issuesFixed: initialBlockerCount, blockersResolved: initialBlockerCount, newIssues: currentValidation.issues.length } };
      }

    } catch (error: any) {
      logger.error(`🔧 TOOL FIXER: Error on attempt ${attempts}: ${error.message}`);
      if (attempts === fixerConfig.maxAttempts) {
        return { success: false, attempts, error: `Tool fixing failed after ${attempts} attempts: ${error.message}`, fixedTool: currentTool, validation: currentValidation, improvements: {issuesFixed: 0, blockersResolved: 0, newIssues: validationIssues.length } };
      }
    }
  }
  // Fallback if loop finishes unexpectedly
  return { success: false, attempts, error: 'Unexpected exit from fixer loop.', fixedTool: currentTool, validation: currentValidation, improvements: {issuesFixed:0, blockersResolved:0, newIssues:0} };
}


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
  logger.info('🛡️ VALIDATION (with Iterator): Starting for tool -', tool.metadata.title);
  let currentTool = tool;
  let validationResult = performFullValidation(currentTool, {
    toolId: currentTool.id,
    toolTitle: currentTool.metadata.title,
    attemptNumber: 1, // Initial validation attempt for this function call
    sessionPhase: 'initial_creation', // Or determine phase based on context
    selectedModel: context.selectedModel,
    hasExternalBrainstorming: context.hasExternalBrainstorming,
    toolComplexity: context.toolComplexity
  });

  if (!validationResult.isValid && validationResult.blockers.length > 0) {
    logger.info('🔧 ITERATOR (validateToolWithIterator): Initial validation failed - attempting AI corrections...');
    logger.info(`🔧 ITERATOR: ${validationResult.blockers.length} blocking errors to resolve`);
    
    const validationIssuesForFixer: ValidationIssue[] = validationResult.issues.map(issue => ({
      id: issue.id || `issue-validator-${Date.now()}`,
      toolId: currentTool.id,
      toolTitle: currentTool.metadata.title,
      severity: issue.severity,
      category: issue.category as any, // Cast to any temporarily
      issue: issue.issue,
      details: issue.details,
      codeSnippet: issue.codeSnippet,
      timestamp: Date.now(),
      resolved: false,
      autoFixable: issue.autoFixable || false
    }));

    const iteratorConfig: Partial<ToolFixerConfig> = {
      maxAttempts: 3, 
      temperature: getProcessConfig('toolFixer')?.temperature || 0.3,
      enableLogging: true,
    };

    try {
      const fixResult = await fixToolWithAI(
        currentTool,
        validationIssuesForFixer,
        userIntent, 
        iteratorConfig
      );

      if (fixResult.success && fixResult.fixedTool) {
        logger.info('🔧 ITERATOR (validateToolWithIterator): ✅ Tool successfully fixed by AI!');
        currentTool = fixResult.fixedTool;
        validationResult = fixResult.validation!;
        validationResult.sessionPhase = 'iteration';
        validationResult.attempt = (validationResult.attempt || 0) + fixResult.attempts; // Accumulate attempts
      } else {
        logger.error('🔧 ITERATOR (validateToolWithIterator): ❌ Tool fixing failed.');
        if (fixResult.fixedTool && fixResult.validation) { // Still use best effort
          currentTool = fixResult.fixedTool;
          validationResult = fixResult.validation;
        }
         // If still has blockers, the overall validation for this function call is considered failed for practical purposes.
        if (validationResult.blockers.length > 0) {
             logger.warn('🛡️ VALIDATION (with Iterator): Tool still has blocking errors after AI correction attempts.');
        }
      }
    } catch (iteratorError: any) {
      logger.error('🔧 ITERATOR (validateToolWithIterator): ❌ Major error during AI fixing process:', iteratorError.message);
      // Tool remains as it was before fix attempt, validationResult is from before fix attempt
    }
  }
  
  logger.info(`✅ VALIDATION (with Iterator) complete for: ${currentTool.metadata.title}. Valid: ${validationResult.isValid}`);
  return {
    tool: currentTool,
    validation: validationResult,
  };
}