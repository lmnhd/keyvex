// Create Tool Core Logic - Reusable business logic for Lambda compatibility

import { z } from 'zod';
import { aiOrchestrator, ToolCreationRequest, StreamingCallbacks } from '@/lib/ai/orchestrator';

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