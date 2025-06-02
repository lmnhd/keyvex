// Create Tool Core Logic - Reusable business logic for Lambda compatibility

import { z } from 'zod';
import { aiOrchestrator, ToolCreationRequest, StreamingCallbacks } from '@/lib/ai/orchestrator';
import * as babel from '@babel/core';
import { ProductToolDefinition } from '@/lib/types/product-tool';

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
  productTool: ProductToolDefinition,
  context: any,
  compiledComponentCode: string
): Promise<ProductToolDefinition> {
  // The initialStyleMap should now be directly available on productTool from the AI output
  // Ensure currentStyleMap is initialized as a copy of initialStyleMap
  const initialStyleMapToUse = productTool.initialStyleMap || {};

  // Create a new object to avoid mutating the input directly if it's from a cache or state
  const processedTool: ProductToolDefinition = {
    ...productTool,
    // componentCode is already part of productTool from AI
    // compiledComponentCode might be the same as productTool.componentCode if AI gives JS directly
    // For now, let's assume productTool.componentCode is the definitive one.
    initialStyleMap: initialStyleMapToUse,
    currentStyleMap: { ...initialStyleMapToUse }, // Initialize currentStyleMap as a copy
    updatedAt: Date.now(),
    // Ensure analytics field is present with defaults if not provided
    analytics: productTool.analytics || {
      enabled: true,
      completions: 0,
      averageTime: 0
    }
  };

  // TODO: Implement actual database saving logic here for the processedTool
  // For now, just log and return
  console.log('[core-logic] Processed tool definition:', processedTool.metadata.title);
  console.log('[core-logic] Initial Style Map:', processedTool.initialStyleMap);

  // No Babel compilation step here if componentCode is already JS
  // If componentCode were JSX, Babel would be needed as previously envisioned.
  // The current prompt instructs AI to give React.createElement() directly.

  return processedTool;
} 