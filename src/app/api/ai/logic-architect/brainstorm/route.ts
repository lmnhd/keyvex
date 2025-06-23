// Logic Architect Brainstorming API - Creative tool logic brainstorming

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Request schema for brainstorming
const brainstormRequestSchema = z.object({
  toolType: z.string(),
  targetAudience: z.string(),
  industry: z.string().optional(),
  businessContext: z.string().optional(),
  selectedModel: z.string().optional(),
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
  const requestStartTime = Date.now();
  logger.info({ endpoint: '/api/ai/logic-architect/brainstorm', method: 'POST' }, '🧠 API [logic-architect/brainstorm]: Request received');
  
  try {
    const body = await request.json();
    logger.debug({ 
      bodyKeys: Object.keys(body || {}),
      toolType: body.toolType,
      targetAudience: body.targetAudience,
      industry: body.industry,
      selectedModel: body.selectedModel,
      hasAvailableData: !!body.availableData
    }, '🧠 API [logic-architect/brainstorm]: Request body parsed');
    
    const validatedRequest = brainstormRequestSchema.parse(body);
    logger.info({ 
      toolType: validatedRequest.toolType,
      targetAudience: validatedRequest.targetAudience,
      industry: validatedRequest.industry || 'not specified',
      selectedModel: validatedRequest.selectedModel || 'default',
      businessContextLength: validatedRequest.businessContext?.length || 0,
      availableDataKeys: validatedRequest.availableData ? Object.keys(validatedRequest.availableData) : []
    }, '🧠 API [logic-architect/brainstorm]: Request validation successful');
    
    const { 
      toolType, 
      targetAudience, 
      industry, 
      businessContext, 
      selectedModel, 
      availableData 
    } = validatedRequest;

    logger.info({ 
      streamingMode: true,
      toolType,
      targetAudience 
    }, '🧠 API [logic-architect/brainstorm]: Starting Logic Architect brainstorming stream');

    // Create streaming response with better thought progression
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Determine provider from selectedModel using same logic as create-tool
          let provider: 'openai' | 'anthropic' = 'anthropic';
          let actualModelName = 'unknown';
          
          if (selectedModel && selectedModel !== 'default') {
            // CASE 1: Explicit model specified (e.g., 'gpt-4o', 'claude-3-5-sonnet', etc.)
            logger.info(`🧠 Logic Architect: User selected explicit model: ${selectedModel}`);
            if (selectedModel.startsWith('gpt-') || selectedModel.startsWith('o1') || selectedModel.startsWith('chatgpt-')) {
              provider = 'openai';
              actualModelName = selectedModel;
            } else if (selectedModel.startsWith('claude-')) {
              provider = 'anthropic';
              actualModelName = selectedModel;
            } else {
              logger.warn(`🧠 Logic Architect: Unknown model format ${selectedModel}. Falling back to default logicArchitect config.`);
              // Fall through to default logic below
            }
          }
          
          if (selectedModel === 'default' || !selectedModel || (selectedModel && selectedModel !== 'default' && actualModelName === 'unknown')) {
            // CASE 2: selectedModel is 'default' (from tests/ui page) OR no model specified OR unknown model format
            if (selectedModel === 'default') {
              logger.info('🧠 Logic Architect: User selected "default" - using configured logicArchitect primary model.');
            } else if (!selectedModel) {
              logger.info('🧠 Logic Architect: No model specified - using default configured model from "logicArchitect" process.');
            } else {
              logger.info('🧠 Logic Architect: Unknown model format, falling back to configured logicArchitect primary model.');
            }
            
            try {
              const primaryModel = getPrimaryModel('logicArchitect');
              if (primaryModel && 'modelInfo' in primaryModel) {
                provider = primaryModel.provider as 'openai' | 'anthropic';
                actualModelName = primaryModel.modelInfo.id;
                logger.info('🧠 Logic Architect: Using logicArchitect primary model:', primaryModel.modelInfo);
              } else {
                logger.warn('🧠 Logic Architect: No default model info for "logicArchitect", using hardcoded fallback');
                // Fallback case
                const fallbackModel = getFallbackModel('logicArchitect');
                if (fallbackModel && 'modelInfo' in fallbackModel) {
                  provider = fallbackModel.provider as 'openai' | 'anthropic';
                  actualModelName = fallbackModel.modelInfo.id;
                } else {
                  provider = 'anthropic';
                  actualModelName = 'claude-3-5-sonnet-20240620'; // Safe fallback
                }
              }
            } catch (error) {
              logger.warn({ 
                error: error instanceof Error ? error.message : String(error),
                fallbackProvider: 'anthropic',
                fallbackModel: 'claude-3-5-sonnet-20240620'
              }, '🧠 Logic Architect: Could not resolve default model, using anthropic fallback');
              
              provider = 'anthropic';
              actualModelName = 'claude-3-5-sonnet-20240620'; // Safe fallback
            }
          }
          
          const selectionMethod = selectedModel && selectedModel !== 'default' 
            ? `Explicit User Selection (${selectedModel})` 
            : selectedModel === 'default' 
              ? 'User Selected "default" → logicArchitect Config' 
              : 'No Model → logicArchitect Config';
              
          logger.info({ 
            provider,
            modelName: actualModelName,
            selectionMethod,
            originalSelectedModel: selectedModel || 'none',
            streamController: 'initialized'
          }, '🧠 Logic Architect Model Selection:');
          
          // Send progressive thinking thoughts instead of character-by-character
          const thoughts = [
            "Analyzing your business context and target audience...",
            "Exploring creative tool concepts and value propositions...",
            "Designing engaging calculations and logic flows...",
            "Optimizing for lead generation and user engagement...",
            "Finalizing the complete tool architecture..."
          ];
          
          logger.debug({ 
            thoughtsCount: thoughts.length,
            streamingPhase: 'progressive-thoughts' 
          }, '🧠 API [logic-architect/brainstorm]: Starting progressive thought streaming');
          
          // Send thoughts with delays
          for (let i = 0; i < thoughts.length; i++) {
            const progress = Math.round(((i + 1) / thoughts.length) * 80);
            const data = JSON.stringify({
              type: 'partial',
              data: { thought: thoughts[i], progress },
              timestamp: Date.now()
            });
            
            logger.debug({ 
              thoughtIndex: i + 1,
              totalThoughts: thoughts.length,
              progress,
              thought: thoughts[i]
            }, '🧠 API [logic-architect/brainstorm]: Streaming thought');
            
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            
            // Small delay between thoughts
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          
          logger.info({ 
            phase: 'placeholder-implementation',
            provider,
            modelName: actualModelName
          }, '🧠 API [logic-architect/brainstorm]: Creating placeholder brainstorming result');
          
          // TODO: Implement actual brainstorming logic or use existing core-logic.ts
          const finalResult = {
            success: true,
            message: 'Logic Architect brainstorming completed (placeholder implementation)',
            toolType,
            targetAudience,
            industry: industry || 'General',
            businessContext: businessContext || '',
            provider,
            modelName: actualModelName,
            timestamp: Date.now(),
            // Placeholder brainstorming data
            brainstormData: {
              coreConcept: `${toolType} for ${targetAudience}`,
              keyCalculations: [
                { name: 'Primary Calculation', formula: 'input * multiplier', description: 'Main calculation logic' }
              ],
              suggestedInputs: [
                { type: 'number', label: 'Input Value', placeholder: 'Enter value' }
              ],
              leadGeneration: {
                capturePoint: 'After calculation results',
                valueProposition: 'Get personalized recommendations'
              }
            }
          };
          
          logger.info({ 
            success: true,
            resultKeys: finalResult ? Object.keys(finalResult) : [],
            hasResult: !!finalResult
          }, '🧠 API [logic-architect/brainstorm]: Placeholder result created');

          // STRICT MODE: No fallbacks - if Logic Architect fails, we need to know immediately
          if (!finalResult) {
            const errorMsg = 'Logic Architect returned null/undefined result - this indicates a critical failure in brainstorm generation';
            logger.error({ 
              toolType,
              targetAudience,
              industry,
              businessContext: businessContext?.substring(0, 100)
            }, `🧠 API [logic-architect/brainstorm]: ${errorMsg}`);
            
            const errorData = JSON.stringify({
              type: 'error',
              message: errorMsg,
              timestamp: Date.now()
            });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            return;
          }

          // Send completion with actual result only
          const completionData = JSON.stringify({
            type: 'complete',
            data: finalResult,
            timestamp: Date.now()
          });

          logger.info({ 
            eventType: 'complete',
            resultSize: completionData.length,
            streamCompletion: true
          }, '🧠 API [logic-architect/brainstorm]: Sending completion event');

          controller.enqueue(encoder.encode(`data: ${completionData}\n\n`));

        } catch (error) {
          logger.error({ 
            error: error instanceof Error ? {
              name: error.name,
              message: error.message,
              stack: error.stack
            } : String(error),
            phase: 'stream-processing'
          }, '🧠 API [logic-architect/brainstorm]: Logic Architect brainstorming failed within stream');

          const data = JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Brainstorming failed within stream',
            timestamp: Date.now()
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } finally {
          const totalStreamTime = Date.now() - requestStartTime;
          logger.info({ 
            streamCompleted: true,
            totalStreamTimeMs: totalStreamTime
          }, '🧠 API [logic-architect/brainstorm]: Closing Logic Architect brainstorming stream');
          
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
    const totalRequestTime = Date.now() - requestStartTime;
    logger.error({ 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error),
      totalRequestTimeMs: totalRequestTime,
      endpoint: '/api/ai/logic-architect/brainstorm'
    }, '🧠 API [logic-architect/brainstorm]: Outer API error');
    
    // Ensure that even ZodErrors are properly stringified for the response
    let errorMessage = 'Unknown error';
    if (error instanceof z.ZodError) {
        errorMessage = JSON.stringify(error.errors);
        logger.debug({ zodErrors: error.errors }, '🧠 API [logic-architect/brainstorm]: Zod validation error details');
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    
    return NextResponse.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  logger.info({ endpoint: '/api/ai/logic-architect/brainstorm', method: 'GET' }, '🧠 API [logic-architect/brainstorm]: GET request received');
  
  try {
    // Get the primary model for logicArchitect process
    const primaryModel = getPrimaryModel('logicArchitect');
    const fallbackModel = getFallbackModel('logicArchitect');
    
    const agentInfo = {
      success: true,
      agent: 'Logic Architect',
      defaultModel: {
        primary: primaryModel ? {
          id: primaryModel.modelInfo.id,
          name: primaryModel.modelInfo.name,
          provider: primaryModel.provider
        } : null,
        fallback: fallbackModel ? {
          id: fallbackModel.modelInfo.id,
          name: fallbackModel.modelInfo.name,
          provider: fallbackModel.provider
        } : null
      },
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
    };

    logger.info({ 
      agentInfo: {
        capabilities: agentInfo.capabilities.length,
        responseTypes: agentInfo.responseTypes.length,
        streamingSupported: agentInfo.streamingSupported,
        defaultPrimaryModel: agentInfo.defaultModel.primary?.id
      }
    }, '🧠 API [logic-architect/brainstorm]: Agent info retrieved successfully');

    return NextResponse.json(agentInfo);

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message
      } : String(error),
      endpoint: '/api/ai/logic-architect/brainstorm',
      method: 'GET'
    }, '🧠 API [logic-architect/brainstorm]: GET request failed');

    return NextResponse.json(
      { success: false, error: 'Failed to get agent info' },
      { status: 500 }
    );
  }
} 