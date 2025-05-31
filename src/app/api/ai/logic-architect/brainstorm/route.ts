// Logic Architect Brainstorming API - Creative tool logic brainstorming

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LogicArchitectAgent } from '@/lib/ai/agents/logic-architect';

// Request schema for brainstorming
const brainstormRequestSchema = z.object({
  toolType: z.string(),
  targetAudience: z.string(),
  industry: z.string().optional(),
  businessContext: z.string().optional(),
  availableData: z.object({
    collectedAnswers: z.record(z.string()).optional(),
    features: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),
    brandAnalysis: z.any().optional(),
    uploadedFiles: z.array(z.any()).optional(),
    conversationHistory: z.array(z.any()).optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedRequest = brainstormRequestSchema.parse(body);
    const { 
      toolType, 
      targetAudience, 
      industry, 
      businessContext, 
      availableData 
    } = validatedRequest;

    console.log('🧠 Starting Logic Architect brainstorming stream...');

    // Create streaming response with better thought progression
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const logicArchitect = new LogicArchitectAgent('anthropic');
          
          // Send progressive thinking thoughts instead of character-by-character
          const thoughts = [
            "Analyzing your business context and target audience...",
            "Exploring creative tool concepts and value propositions...",
            "Designing engaging calculations and logic flows...",
            "Optimizing for lead generation and user engagement...",
            "Finalizing the complete tool architecture..."
          ];
          
          // Send thoughts with delays
          for (let i = 0; i < thoughts.length; i++) {
            const data = JSON.stringify({
              type: 'partial',
              data: { thought: thoughts[i], progress: Math.round(((i + 1) / thoughts.length) * 80) },
              timestamp: Date.now()
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            
            // Small delay between thoughts
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          
          // Get the actual brainstorming result
          console.log('📝 Streaming failed, falling back to regular brainstorming...');
          const finalResult = await logicArchitect.brainstormToolLogic(
            toolType,
            targetAudience,
            industry || '',
            businessContext || '',
            availableData || {}
          );
          
          // Send completion
          const completionData = JSON.stringify({
            type: 'complete',
            data: finalResult,
            timestamp: Date.now()
          });
          controller.enqueue(encoder.encode(`data: ${completionData}\n\n`));
          
        } catch (error) {
          console.error('❌ Logic Architect brainstorming failed:', error);
          const data = JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Brainstorming failed',
            timestamp: Date.now()
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } finally {
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
      },
    });

  } catch (error) {
    console.error('❌ Logic Architect API error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    agent: 'Logic Architect',
    capabilities: [
      'Creative tool logic brainstorming',
      'Interactive calculation design',
      'Lead generation optimization',
      'Engagement flow creation',
      'Business value proposition development'
    ],
    streamingSupported: true,
    responseTypes: [
      'partial - Progressive brainstorming thoughts',
      'complete - Final brainstorming results',
      'error - Error messages'
    ]
  });
} 