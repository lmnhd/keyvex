// Complete Tool Creation API Route - Uses AI Orchestrator

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiOrchestrator, ToolCreationRequest, StreamingCallbacks } from '@/lib/ai/orchestrator';
import { useAISessionStore } from '@/lib/stores/ai-session';
import { requireAuth, debugLog } from '@/lib/auth/debug';

// Request validation schema
const toolCreationRequestSchema = z.object({
  // Required fields
  expertise: z.string().min(1, 'Expertise is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
  goals: z.array(z.string()).min(1, 'At least one goal is required'),
  branding: z.object({
    companyName: z.string().optional(),
    industry: z.string().optional(),
    colors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      accent: z.string().optional()
    }).optional(),
    fonts: z.object({
      heading: z.string().optional(),
      body: z.string().optional()
    }).optional(),
    tone: z.string(),
    logoUrl: z.string().optional(),
    existingBrandAssets: z.array(z.string()).optional()
  }),
  
  // Optional fields
  industry: z.string().optional(),
  selectedSuggestion: z.any().optional(),
  customFramework: z.object({
    methodology: z.string().optional(),
    existingContent: z.string().optional()
  }).optional(),
  contentPreferences: z.object({
    tone: z.string().optional(),
    style: z.string().optional(),
    language: z.string().optional()
  }).optional(),
  stylePreferences: z.object({
    theme: z.string().optional(),
    colorScheme: z.string().optional(),
    layout: z.string().optional()
  }).optional(),
  
  // Configuration
  provider: z.enum(['openai', 'anthropic']).default('anthropic'),
  streaming: z.boolean().default(false),
  sessionId: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user using centralized debug-aware auth
    const userId = await requireAuth();
    
    debugLog('Create Tool POST request', { userId });

    // Parse and validate request
    const body = await request.json();
    const validatedData = toolCreationRequestSchema.parse(body);

    const toolRequest: ToolCreationRequest = {
      expertise: validatedData.expertise,
      targetAudience: validatedData.targetAudience,
      industry: validatedData.industry,
      goals: validatedData.goals,
      branding: validatedData.branding,
      selectedSuggestion: validatedData.selectedSuggestion,
      customFramework: validatedData.customFramework,
      contentPreferences: validatedData.contentPreferences,
      stylePreferences: validatedData.stylePreferences,
      provider: validatedData.provider,
      streaming: validatedData.streaming,
      sessionId: validatedData.sessionId
    };

    // Handle streaming requests
    if (validatedData.streaming) {
      return handleStreamingToolCreation(toolRequest, userId);
    }

    // Handle non-streaming requests
    const startTime = Date.now();
    
    // Switch provider if needed
    if (validatedData.provider !== aiOrchestrator.getStatus().provider) {
      aiOrchestrator.switchProvider(validatedData.provider);
    }

    // Create tool with orchestrator
    const result = await aiOrchestrator.createTool(toolRequest);

    // Update session with results
    await updateAISession(userId, result.metadata.sessionId, {
      action: 'create-tool',
      request: toolRequest,
      result,
      metadata: {
        ...result.metadata,
        userId,
        completedAt: new Date()
      }
    });

    // Return complete tool
    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        processingTime: Date.now() - startTime,
        sessionId: result.metadata.sessionId,
        provider: result.metadata.provider,
        quality: result.metadata.quality
      }
    });

  } catch (error) {
    console.error('Tool creation API error:', error);

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
        message: 'Tool creation failed'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user using centralized debug-aware auth
    const userId = await requireAuth();
    
    debugLog('Create Tool GET request', { userId });

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        // Return orchestrator status
        const status = aiOrchestrator.getStatus();
        return NextResponse.json({
          success: true,
          data: status
        });

      case 'session':
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

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Tool creation GET error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve data'
      },
      { status: 500 }
    );
  }
}

// Streaming response handler
async function handleStreamingToolCreation(
  toolRequest: ToolCreationRequest,
  userId: string
): Promise<Response> {
  const encoder = new TextEncoder();
  const sessionId = toolRequest.sessionId || generateSessionId();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Switch provider if needed
        if (toolRequest.provider && toolRequest.provider !== aiOrchestrator.getStatus().provider) {
          aiOrchestrator.switchProvider(toolRequest.provider);
        }

        // Set up streaming callbacks
        const callbacks: StreamingCallbacks = {
          onStepStart: (step) => {
            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'step-start',
                step,
                sessionId,
                timestamp: new Date().toISOString()
              })}\n\n`
            );
            controller.enqueue(chunk);
          },

          onStepProgress: (step, progress) => {
            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'step-progress',
                step,
                progress,
                sessionId,
                timestamp: new Date().toISOString()
              })}\n\n`
            );
            controller.enqueue(chunk);
          },

          onStepComplete: (step, result) => {
            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'step-complete',
                step,
                result,
                sessionId,
                timestamp: new Date().toISOString()
              })}\n\n`
            );
            controller.enqueue(chunk);
          },

          onError: (step, error) => {
            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                step,
                error: error.message,
                sessionId,
                timestamp: new Date().toISOString()
              })}\n\n`
            );
            controller.enqueue(chunk);
          },

          onComplete: async (result) => {
            // Update session with final results
            await updateAISession(userId, sessionId, {
              action: 'create-tool-streaming',
              request: toolRequest,
              result,
              metadata: {
                ...result.metadata,
                userId,
                completedAt: new Date(),
                streaming: true
              }
            });

            const chunk = encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                result,
                sessionId,
                timestamp: new Date().toISOString()
              })}\n\n`
            );
            controller.enqueue(chunk);
            controller.close();
          }
        };

        // Start streaming tool creation
        await aiOrchestrator.streamToolCreation(
          { ...toolRequest, sessionId },
          callbacks
        );

      } catch (error) {
        console.error('Streaming tool creation error:', error);
        const chunk = encoder.encode(
          `data: ${JSON.stringify({
            type: 'error',
            error: 'Streaming failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            sessionId,
            timestamp: new Date().toISOString()
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Helper functions
function generateSessionId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      currentStep: 'review',
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

// Rate limiting and usage tracking
async function checkRateLimit(userId: string): Promise<boolean> {
  // TODO: Implement actual rate limiting
  // Check user's subscription tier and usage limits
  return true;
}

async function trackUsage(
  userId: string,
  action: string,
  metadata: any
): Promise<void> {
  // TODO: Implement usage tracking
  // Track tokens used, processing time, quality scores, etc.
  console.log('Usage tracked:', { userId, action, metadata });
}

// Quality assurance
async function validateToolQuality(result: any): Promise<{
  isValid: boolean;
  issues: string[];
  score: number;
}> {
  // TODO: Implement comprehensive quality validation
  // Check all components for completeness, consistency, and quality
  return {
    isValid: true,
    issues: [],
    score: result.metadata?.quality?.overall || 8.0
  };
} 