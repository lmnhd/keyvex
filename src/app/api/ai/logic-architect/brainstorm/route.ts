// Logic Architect Brainstorming API - Streaming creative tool logic brainstorming

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

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const logicArchitect = new LogicArchitectAgent('anthropic');
          let finalResult = null;
          
          // Stream brainstorming thoughts
          await logicArchitect.brainstormToolLogicStream(
            toolType,
            targetAudience,
            industry || '',
            businessContext || '',
            availableData || {},
            
            // onPartialLogic - stream partial thoughts
            (partial) => {
              const data = JSON.stringify({
                type: 'partial',
                data: partial,
                timestamp: Date.now()
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
            
            // onComplete - send final result
            (complete) => {
              finalResult = complete;
              const data = JSON.stringify({
                type: 'complete',
                data: complete,
                timestamp: Date.now()
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
            
            // onError - handle errors
            (error) => {
              const data = JSON.stringify({
                type: 'error',
                message: error.message,
                timestamp: Date.now()
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          );
          
          // If no streaming result, fall back to regular brainstorming
          if (!finalResult) {
            console.log('📝 Streaming failed, falling back to regular brainstorming...');
            finalResult = await logicArchitect.brainstormToolLogic(
              toolType,
              targetAudience,
              industry || '',
              businessContext || '',
              availableData || {}
            );
            
            const data = JSON.stringify({
              type: 'complete',
              data: finalResult,
              timestamp: Date.now()
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          
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
      'partial - Streaming brainstorming thoughts',
      'complete - Final brainstorming results',
      'error - Error messages'
    ]
  });
} 