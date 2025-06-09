import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { createTCC, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/auth/debug';

// Input validation schema
const StartOrchestrationSchema = z.object({
  userInput: z.object({
    description: z.string().min(1, 'Description is required'),
    targetAudience: z.string().optional(),
    industry: z.string().optional(),
    toolType: z.string().optional(),
    features: z.array(z.string()).optional(),
  }),
  selectedModel: z.string().optional(),
  agentModelMapping: z.record(z.string()).optional(),
  testingOptions: z.object({
    enableWebSocketStreaming: z.boolean().optional(),
    enableTccOperations: z.boolean().optional(), 
    enableOrchestrationTriggers: z.boolean().optional(),
    skipFunctionPlanner: z.boolean().optional(),
    skipStateDesign: z.boolean().optional(),
    skipJsxLayout: z.boolean().optional(),
    skipTailwindStyling: z.boolean().optional(),
    skipComponentAssembler: z.boolean().optional(),
    skipValidator: z.boolean().optional(),
    skipToolFinalizer: z.boolean().optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  
  try {
    const body = await request.json();
    const { userInput, selectedModel, agentModelMapping, testingOptions } = StartOrchestrationSchema.parse(body);

    // Generate a new job ID
    const jobId = uuidv4();
    
    logger.info({ 
      jobId, 
      userId,
      userInputDescription: userInput.description,
      selectedModel: selectedModel || 'default',
      testingOptions: testingOptions || 'none'
    }, '🚀 ORCHESTRATION START: Creating new TCC');

    // Create initial TCC with userId
    const tcc = createTCC(jobId, userInput, userId);
    
    // Add agent model mapping if provided
    if (agentModelMapping) {
      tcc.agentModelMapping = agentModelMapping;
    }
    
    logger.info({ jobId, tccId: tcc.jobId, userId }, '🚀 ORCHESTRATION START: TCC created (will be passed as props)');

    // Emit initial progress
    const shouldStream = testingOptions?.enableWebSocketStreaming !== false; // default true
    if (shouldStream) {
      await emitStepProgress(
        jobId, 
        OrchestrationStepEnum.enum.planning_function_signatures, 
        'started', 
        'Orchestration started. Beginning function signature planning...', 
        tcc // Pass TCC directly as details
      );
      
      logger.info({ jobId }, '🚀 ORCHESTRATION START: Initial progress emitted');
    }

    // Trigger first agent (Function Planner) unless testing options skip it
    if (!testingOptions?.skipFunctionPlanner) {
      logger.info({ jobId }, '🚀 ORCHESTRATION START: Triggering Function Planner');
      
      const functionPlannerUrl = new URL('/api/ai/product-tool-creation-v2/agents/function-planner', request.url);
      const functionPlannerResponse = await fetch(functionPlannerUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          selectedModel: selectedModel || 'gpt-4o',
          tcc: tcc,
        })
      });

      if (!functionPlannerResponse.ok) {
        throw new Error(`Function Planner failed: ${functionPlannerResponse.status}`);
      }

      logger.info({ jobId, status: functionPlannerResponse.status }, '🚀 ORCHESTRATION START: Function Planner triggered');
    } else {
      logger.info({ jobId }, '🚀 ORCHESTRATION START: Skipping Function Planner (testing mode)');
    }

    return NextResponse.json({
      success: true,
      jobId,
      tccId: tcc.jobId,
      currentStep: OrchestrationStepEnum.enum.planning_function_signatures,
      status: OrchestrationStatusEnum.enum.pending,
      message: 'Orchestration started successfully',
      webSocketConnected: shouldStream,
      testingMode: !!testingOptions
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, '🚀 ORCHESTRATION START: Error');
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid input',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}