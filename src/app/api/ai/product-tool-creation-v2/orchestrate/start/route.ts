import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ToolConstructionContextSchema, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import type { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { getUserId } from '@/lib/auth/get-user-id';

// Input schema for the start request
const StartRequestSchema = z.object({
  description: z.string().min(10, { message: 'Tool description must be at least 10 characters long' }),
  targetAudience: z.string().optional(),
  industry: z.string().optional(),
  toolType: z.string().optional(),
  features: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  let jobId: string | undefined = undefined;
  try {
    const body = await request.json();
    const parsedInput = StartRequestSchema.safeParse(body);

    if (!parsedInput.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid input', 
        details: parsedInput.error.flatten() 
      }, { status: 400 });
    }

    jobId = uuidv4();
    const userId = await getUserId(request);

    const now = new Date().toISOString();

    const initialTCC: ToolConstructionContext = {
      jobId,
      userId: userId || 'anonymous',
      currentOrchestrationStep: OrchestrationStepEnum.enum.initialization,
      status: OrchestrationStatusEnum.enum.pending,
      userInput: {
        description: parsedInput.data.description,
        targetAudience: parsedInput.data.targetAudience,
        industry: parsedInput.data.industry,
        toolType: parsedInput.data.toolType,
        features: parsedInput.data.features || [],
      },
      progressLog: [],
      createdAt: now,
      updatedAt: now,
      tccVersion: '1.0.0',
    };
    
    ToolConstructionContextSchema.parse(initialTCC);
    await saveTCC(initialTCC);
    console.log(`[Orchestrate/Start] Initial TCC saved for jobID: ${jobId}`);

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.initialization,
      'completed',
      'Tool creation process initiated.'
    );
    
    const tccAfterInit: Partial<ToolConstructionContext> = {
        currentOrchestrationStep: OrchestrationStepEnum.enum.planning_function_signatures,
        status: OrchestrationStatusEnum.enum.pending,
        updatedAt: new Date().toISOString()
    };
    const updatedTCCForNextStep = { ...initialTCC, ...tccAfterInit };
    await saveTCC(updatedTCCForNextStep);

    const plannerUrl = new URL(
      '/api/ai/product-tool-creation-v2/agents/function-planner',
      request.nextUrl.origin
    );

    fetch(plannerUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    }).catch(fetchError => {
      console.error(`[Orchestrate/Start] Failed to trigger Function Signature Planner for jobID ${jobId}:`, fetchError);
    });

    console.log(`[Orchestrate/Start] Function Signature Planner triggered for jobID: ${jobId}`);

    return NextResponse.json(
      { 
        jobId, 
        success: true, 
        message: 'Tool creation process started. Track progress via WebSocket.' 
      }, 
      { status: 202 }
    );

  } catch (error) {
    console.error('[Orchestrate/Start] Error in POST handler:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (jobId) {
        emitStepProgress(
          jobId, 
          OrchestrationStepEnum.enum.initialization, 
          'failed', 
          `Failed to start process: ${message}`, 
          { errorDetails: { message: String(error) } }
        ).catch(console.error);
    }
    return NextResponse.json({ 
      success: false, 
      error: message, 
      details: error instanceof z.ZodError ? error.flatten() : undefined 
    }, { status: 500 });
  }
}

