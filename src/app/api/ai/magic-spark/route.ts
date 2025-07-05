// Magic Spark API Route - Initial tool suggestions

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, debugLog } from '@/lib/auth/debug';
import { 
  processMagicSparkRequest, 
  processMagicSparkStreaming,
  getMagicSparkSession,
  MagicSparkRequest,
  MagicSparkStreamingCallbacks
} from './core-logic';

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

    // Handle streaming requests
    if (stream && action === 'generate') {
      return handleStreamingGeneration(
        expertise,
        targetAudience,
        industry,
        goals,
        userId,
        sessionId
      );
    }

    // Create request for core logic
    const coreRequest: MagicSparkRequest = {
      expertise,
      targetAudience,
      industry,
      goals,
      action,
      originalSuggestion,
      userFeedback,
      userContext,
      sessionId,
      userId
    };

    // Process request using core logic
    const response = await processMagicSparkRequest(coreRequest);

    // Return response
    return NextResponse.json(response);

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
    const sessionData = await getMagicSparkSession(userId, sessionId);
    
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
        // Create request for core logic
        const coreRequest: MagicSparkRequest = {
          expertise,
          targetAudience,
          industry,
          goals,
          action: 'generate',
          sessionId: finalSessionId,
          userId: userId || 'unknown'
        };

        // Set up streaming callbacks
        const callbacks: MagicSparkStreamingCallbacks = {
          onPartial: (partial) => {
            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'partial',
                data: partial,
                sessionId: finalSessionId
              })}\n\n`
            );
            controller.enqueue(chunk);
          },
          onComplete: (suggestions) => {
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
            controller.close();
          },
          onError: (error) => {
            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error.message,
                sessionId: finalSessionId
              })}\n\n`
            );
            controller.enqueue(chunk);
            controller.close();
          }
        };

        // Process streaming request using core logic
        await processMagicSparkStreaming(coreRequest, callbacks);

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
