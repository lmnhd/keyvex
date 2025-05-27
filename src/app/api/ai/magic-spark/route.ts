// Magic Spark API Route - Initial tool suggestions

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MagicSparkAgent } from '@/lib/ai/agents/magic-spark';
import { useAISessionStore } from '@/lib/stores/ai-session';
import { requireAuth, debugLog } from '@/lib/auth/debug';

// Request validation schema
const magicSparkRequestSchema = z.object({
  expertise: z.string().min(1, 'Expertise is required'),
  targetAudience: z.string().optional(),
  industry: z.string().optional(),
  goals: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  action: z.enum(['generate', 'refine', 'validate', 'examples']).default('generate'),
  // For refinement
  originalSuggestion: z.any().optional(),
  userFeedback: z.string().optional(),
  // For validation
  userContext: z.object({
    expertiseLevel: z.string().optional(),
    timeAvailable: z.string().optional(),
    technicalSkills: z.string().optional(),
    targetComplexity: z.string().optional()
  }).optional(),
  // For streaming
  stream: z.boolean().default(false)
});

// Response schemas
const suggestionResponseSchema = z.object({
  suggestions: z.array(z.any()),
  sessionId: z.string(),
  metadata: z.object({
    totalSuggestions: z.number(),
    processingTime: z.number(),
    provider: z.string(),
    model: z.string()
  })
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user using centralized debug-aware auth
    const userId = await requireAuth();
    
    debugLog('Magic Spark POST request', { userId });

    // Parse and validate request
    const body = await request.json();
    const validatedData = magicSparkRequestSchema.parse(body);

    const {
      expertise,
      targetAudience,
      industry,
      goals,
      sessionId,
      action,
      originalSuggestion,
      userFeedback,
      userContext,
      stream
    } = validatedData;

    // Initialize Magic Spark Agent
    const agent = new MagicSparkAgent(); // Now uses centralized config
    const startTime = Date.now();

    // Handle streaming requests
    if (stream && action === 'generate') {
      return handleStreamingGeneration(
        agent,
        expertise,
        targetAudience,
        industry,
        goals,
        userId,
        sessionId
      );
    }

    // Handle different actions
    let result: any;
    let metadata: any = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20240620',
      processingTime: 0
    };

    switch (action) {
      case 'generate':
        result = await agent.generateInitialSpark(
          expertise,
          targetAudience,
          industry,
          goals
        );
        metadata.totalSuggestions = result.length;
        break;

      case 'refine':
        if (!originalSuggestion || !userFeedback) {
          return NextResponse.json(
            { error: 'Original suggestion and user feedback are required for refinement' },
            { status: 400 }
          );
        }
        result = await agent.refineSuggestion(originalSuggestion, userFeedback);
        metadata.totalSuggestions = 1;
        break;

      case 'validate':
        if (!originalSuggestion) {
          return NextResponse.json(
            { error: 'Original suggestion is required for validation' },
            { status: 400 }
          );
        }
        result = await agent.validateFeasibility(originalSuggestion, userContext);
        metadata.validationScore = result.score;
        break;

      case 'examples':
        if (!industry) {
          return NextResponse.json(
            { error: 'Industry is required for examples' },
            { status: 400 }
          );
        }
        result = await agent.getSimilarExamples(
          'assessment', // Default tool type
          industry,
          targetAudience
        );
        metadata.totalExamples = result.length;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    metadata.processingTime = Date.now() - startTime;

    // Create or update AI session
    const finalSessionId = sessionId || generateSessionId();
    await updateAISession(userId, finalSessionId, {
      action,
      expertise,
      targetAudience,
      industry,
      goals,
      result,
      metadata
    });

    // Return response
    return NextResponse.json({
      success: true,
      data: result,
      sessionId: finalSessionId,
      metadata
    });

  } catch (error) {
    console.error('Magic Spark API error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      );
    }

    // Handle AI provider errors
    if (error instanceof Error && error.message.includes('API')) {
      return NextResponse.json(
        {
          error: 'AI service temporarily unavailable',
          message: 'Please try again in a moment'
        },
        { status: 503 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user using centralized debug-aware auth
    const userId = await requireAuth();
    
    debugLog('Magic Spark GET request', { userId });

    // Get session ID from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Retrieve session data
    const sessionData = await getAISession(userId, sessionId);
    
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sessionData
    });

  } catch (error) {
    console.error('Magic Spark GET error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve session data'
      },
      { status: 500 }
    );
  }
}

// Streaming response handler
async function handleStreamingGeneration(
  agent: MagicSparkAgent,
  expertise: string,
  targetAudience?: string,
  industry?: string,
  goals?: string[],
  userId?: string,
  sessionId?: string
): Promise<Response> {
  const encoder = new TextEncoder();
  const finalSessionId = sessionId || generateSessionId();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let suggestions: any[] = [];
        
        await agent.streamInitialSpark(
          expertise,
          targetAudience,
          // On partial suggestion
          (partial) => {
            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'partial',
                data: partial,
                sessionId: finalSessionId
              })}\n\n`
            );
            controller.enqueue(chunk);
          },
          // On complete
          (completeSuggestions) => {
            suggestions = completeSuggestions;
            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                data: suggestions,
                sessionId: finalSessionId,
                metadata: {
                  totalSuggestions: suggestions.length,
                  provider: 'anthropic',
                  model: 'claude-3-5-sonnet-20240620'
                }
              })}\n\n`
            );
            controller.enqueue(chunk);
          },
          // On error
          (error) => {
            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error.message,
                sessionId: finalSessionId
              })}\n\n`
            );
            controller.enqueue(chunk);
          }
        );

        // Update session with final results
        if (suggestions.length > 0 && userId) {
          await updateAISession(userId, finalSessionId, {
            action: 'generate',
            expertise,
            targetAudience,
            industry,
            goals,
            result: suggestions,
            metadata: {
              totalSuggestions: suggestions.length,
              provider: 'anthropic',
              model: 'claude-3-5-sonnet-20240620',
              streaming: true
            }
          });
        }

        controller.close();

      } catch (error) {
        console.error('Streaming error:', error);
        const chunk = encoder.encode(
          `data: ${JSON.stringify({
            type: 'error',
            error: 'Streaming failed',
            sessionId: finalSessionId
          })}\n\n`
        );
        controller.enqueue(chunk);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Helper functions
function generateSessionId(): string {
  return `ms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function updateAISession(
  userId: string,
  sessionId: string,
  data: any
): Promise<void> {
  try {
    // In a real implementation, this would update the database
    // For now, we'll use the Zustand store
    const store = useAISessionStore.getState();
    await store.updateSession(sessionId, {
      currentStep: 'magic-spark',
      status: 'completed',
      sessionData: data,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Failed to update AI session:', error);
  }
}

async function getAISession(
  userId: string,
  sessionId: string
): Promise<any | null> {
  try {
    // In a real implementation, this would query the database
    // For now, we'll use the Zustand store
    const store = useAISessionStore.getState();
    return store.currentSession?.id === sessionId ? store.currentSession : null;
  } catch (error) {
    console.error('Failed to get AI session:', error);
    return null;
  }
}

// Rate limiting middleware (placeholder)
async function checkRateLimit(userId: string): Promise<boolean> {
  // TODO: Implement actual rate limiting
  // For now, always allow
  return true;
}

// Usage tracking (placeholder)
async function trackUsage(
  userId: string,
  action: string,
  metadata: any
): Promise<void> {
  // TODO: Implement usage tracking
  console.log('Usage tracked:', { userId, action, metadata });
} 