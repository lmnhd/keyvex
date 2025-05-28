// Magic Spark Core Logic - Reusable business logic for Lambda compatibility

import { MagicSparkAgent } from '@/lib/ai/agents/magic-spark';
import { z } from 'zod';

// Core request interface
export interface MagicSparkRequest {
  expertise: string;
  targetAudience?: string;
  industry?: string;
  goals?: string[];
  action: 'generate' | 'refine' | 'validate' | 'examples';
  originalSuggestion?: any;
  userFeedback?: string;
  userContext?: {
    expertiseLevel?: string;
    timeAvailable?: string;
    technicalSkills?: string;
    targetComplexity?: string;
  };
  sessionId?: string;
  userId: string;
}

// Core response interface
export interface MagicSparkResponse {
  success: boolean;
  data: any;
  sessionId: string;
  metadata: {
    totalSuggestions?: number;
    validationScore?: number;
    totalExamples?: number;
    processingTime: number;
    provider: string;
    model: string;
  };
}

// Streaming callback interface
export interface MagicSparkStreamingCallbacks {
  onPartial?: (partial: any) => void;
  onComplete?: (suggestions: any[]) => void;
  onError?: (error: Error) => void;
}

// Core processing context
export interface MagicSparkContext {
  request: MagicSparkRequest;
  agent: MagicSparkAgent;
  startTime: number;
}

// Main processing function
export async function processMagicSparkRequest(
  request: MagicSparkRequest
): Promise<MagicSparkResponse> {
  const context = await initializeMagicSparkContext(request);
  
  try {
    let result: any;
    let metadata: any = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20240620',
      processingTime: 0
    };

    switch (request.action) {
      case 'generate':
        result = await context.agent.generateInitialSpark(
          request.expertise,
          request.targetAudience,
          request.industry,
          request.goals
        );
        metadata.totalSuggestions = result.length;
        break;

      case 'refine':
        if (!request.originalSuggestion || !request.userFeedback) {
          throw new Error('Original suggestion and user feedback are required for refinement');
        }
        result = await context.agent.refineSuggestion(
          request.originalSuggestion, 
          request.userFeedback
        );
        metadata.totalSuggestions = 1;
        break;

      case 'validate':
        if (!request.originalSuggestion) {
          throw new Error('Original suggestion is required for validation');
        }
        result = await context.agent.validateFeasibility(
          request.originalSuggestion, 
          request.userContext
        );
        metadata.validationScore = result.score;
        break;

      case 'examples':
        if (!request.industry) {
          throw new Error('Industry is required for examples');
        }
        result = await context.agent.getSimilarExamples(
          'assessment', // Default tool type
          request.industry,
          request.targetAudience
        );
        metadata.totalExamples = result.length;
        break;

      default:
        throw new Error('Invalid action');
    }

    metadata.processingTime = Date.now() - context.startTime;

    // Update AI session
    const finalSessionId = request.sessionId || generateSessionId();
    await updateAISession(request.userId, finalSessionId, {
      action: request.action,
      expertise: request.expertise,
      targetAudience: request.targetAudience,
      industry: request.industry,
      goals: request.goals,
      result,
      metadata
    });

    return {
      success: true,
      data: result,
      sessionId: finalSessionId,
      metadata
    };

  } catch (error) {
    throw error; // Let the route handler deal with error formatting
  }
}

// Streaming processing function
export async function processMagicSparkStreaming(
  request: MagicSparkRequest,
  callbacks: MagicSparkStreamingCallbacks
): Promise<void> {
  const context = await initializeMagicSparkContext(request);
  const finalSessionId = request.sessionId || generateSessionId();

  try {
    let suggestions: any[] = [];
    
    await context.agent.streamInitialSpark(
      request.expertise,
      request.targetAudience,
      // On partial suggestion
      (partial) => {
        callbacks.onPartial?.(partial);
      },
      // On complete
      (completeSuggestions) => {
        suggestions = completeSuggestions;
        callbacks.onComplete?.(suggestions);
      },
      // On error
      (error) => {
        callbacks.onError?.(error);
      }
    );

    // Update session with final results
    if (suggestions.length > 0) {
      await updateAISession(request.userId, finalSessionId, {
        action: request.action,
        expertise: request.expertise,
        targetAudience: request.targetAudience,
        industry: request.industry,
        goals: request.goals,
        result: suggestions,
        metadata: {
          totalSuggestions: suggestions.length,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20240620',
          streaming: true
        }
      });
    }

  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error('Unknown error'));
  }
}

// Session retrieval function
export async function getMagicSparkSession(
  userId: string,
  sessionId: string
): Promise<any | null> {
  try {
    // TODO: Replace with actual database implementation
    // For now, this is a placeholder that would be implemented with DynamoDB
    console.log('Getting Magic Spark session:', { userId, sessionId });
    return null;
  } catch (error) {
    console.error('Failed to get Magic Spark session:', error);
    return null;
  }
}

// Helper functions
async function initializeMagicSparkContext(
  request: MagicSparkRequest
): Promise<MagicSparkContext> {
  const agent = new MagicSparkAgent();
  const startTime = Date.now();

  return {
    request,
    agent,
    startTime
  };
}

function generateSessionId(): string {
  return `ms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function updateAISession(
  userId: string,
  sessionId: string,
  data: any
): Promise<void> {
  try {
    // TODO: Replace with actual database implementation
    // This would use DynamoDB in the real implementation
    console.log('Updating Magic Spark AI session:', { userId, sessionId, data });
  } catch (error) {
    console.error('Failed to update Magic Spark AI session:', error);
  }
}

// Rate limiting function
export async function checkMagicSparkRateLimit(userId: string): Promise<boolean> {
  // TODO: Implement actual rate limiting with Redis/DynamoDB
  return true;
}

// Usage tracking function
export async function trackMagicSparkUsage(
  userId: string,
  action: string,
  metadata: any
): Promise<void> {
  // TODO: Implement usage tracking with DynamoDB
  console.log('Magic Spark usage tracked:', { userId, action, metadata });
} 