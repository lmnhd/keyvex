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
  selectedModel: z.string().optional(),
  agentModelMapping: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: NextRequest) {
  let jobId: string | undefined = undefined;
  
  console.log('🎬 Orchestrate/Start: ==================== STARTING TOOL CREATION ORCHESTRATION ====================');
  console.log('🎬 Orchestrate/Start: Request received at:', new Date().toISOString());
  console.log('🎬 Orchestrate/Start: Request URL:', request.url);
  console.log('🎬 Orchestrate/Start: Request method:', request.method);

  try {
    console.log('🎬 Orchestrate/Start: Parsing request body...');
    const body = await request.json();
    console.log('🎬 Orchestrate/Start: ✅ Request body parsed successfully');
    console.log('🎬 Orchestrate/Start: Request analysis:', {
      hasDescription: !!body.description,
      descriptionLength: body.description?.length || 0,
      selectedModel: body.selectedModel || 'default',
      hasAgentMapping: !!body.agentModelMapping,
      agentMappingKeys: body.agentModelMapping ? Object.keys(body.agentModelMapping) : [],
      agentMappingCount: body.agentModelMapping ? Object.keys(body.agentModelMapping).length : 0,
      targetAudience: body.targetAudience || 'not specified',
      industry: body.industry || 'not specified',
      toolType: body.toolType || 'not specified',
      featuresCount: body.features?.length || 0
    });
    
    const parsedInput = StartRequestSchema.safeParse(body);

    if (!parsedInput.success) {
      console.error('🎬 [Orchestrate/Start] Input validation failed:', parsedInput.error.flatten());
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid input', 
        details: parsedInput.error.flatten() 
      }, { status: 400 });
    }

    jobId = uuidv4();
    console.log('🎬 [Orchestrate/Start] Generated jobId:', jobId);
    
    const userId = await getUserId(request);
    console.log('🎬 [Orchestrate/Start] Retrieved userId:', userId || 'anonymous');

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
      selectedModel: parsedInput.data.selectedModel,
      agentModelMapping: parsedInput.data.agentModelMapping || {},
      progressLog: [],
      createdAt: now,
      updatedAt: now,
      tccVersion: '1.0.0',
    };
    
    console.log('🎬 [Orchestrate/Start] Created initial TCC:', {
      jobId,
      selectedModel: initialTCC.selectedModel,
      agentModelMapping: initialTCC.agentModelMapping,
      currentStep: initialTCC.currentOrchestrationStep,
      status: initialTCC.status
    });
    
    ToolConstructionContextSchema.parse(initialTCC);
    console.log('🎬 [Orchestrate/Start] TCC schema validation passed');
    
    // WebSocket: Notify initialization started
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.initialization,
      'started',
      'Initializing tool creation workflow...'
    );

    await saveTCC(initialTCC);
    console.log('🎬 [Orchestrate/Start] Initial TCC saved for jobID:', jobId);

    // WebSocket: Notify TCC created and configuration details
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.initialization,
      'in_progress',
      `Configuration ready: ${initialTCC.selectedModel || 'default'} model selected, ${Object.keys(initialTCC.agentModelMapping || {}).length} specialized agents configured.`
    );

    console.log('🎬 [Orchestrate/Start] Emitting initialization completed step progress');
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.initialization,
      'completed',
      'Tool creation process initiated successfully.'
    );
    console.log('🎬 [Orchestrate/Start] Step progress emitted successfully');
    
    const tccAfterInit: Partial<ToolConstructionContext> = {
        currentOrchestrationStep: OrchestrationStepEnum.enum.planning_function_signatures,
        status: OrchestrationStatusEnum.enum.pending,
        updatedAt: new Date().toISOString()
    };
    const updatedTCCForNextStep = { ...initialTCC, ...tccAfterInit };
    console.log('🎬 [Orchestrate/Start] Updating TCC for next step:', {
      jobId,
      newStep: tccAfterInit.currentOrchestrationStep,
      newStatus: tccAfterInit.status
    });
    
    await saveTCC(updatedTCCForNextStep);
    console.log('🎬 [Orchestrate/Start] Updated TCC saved for next step');

    // WebSocket: Notify about to start function planning
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'initiated',
      'Preparing to analyze tool requirements and plan function signatures...'
    );

    const plannerUrl = new URL(
      '/api/ai/product-tool-creation-v2/agents/function-planner',
      request.nextUrl.origin
    );

    // Determine which model the function-planner should use
    const functionPlannerModel = initialTCC.agentModelMapping?.['function-planner'] || initialTCC.selectedModel;

    // WebSocket: Notify which model is being used for function planning
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'started',
      `Starting function signature planning with ${functionPlannerModel || 'default'} model...`
    );

    // Trigger the function planner and wait to ensure it starts successfully
    try {
      const plannerResponse = await fetch(plannerUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          jobId,
          selectedModel: functionPlannerModel 
        }),
      });

      if (!plannerResponse.ok) {
        const errorText = await plannerResponse.text();
        throw new Error(`Function planner responded with status ${plannerResponse.status}: ${errorText}`);
      }
      
      console.log(`[Orchestrate/Start] Function Signature Planner triggered successfully for jobID: ${jobId}`);
    } catch (fetchError) {
      console.error(`[Orchestrate/Start] Failed to trigger Function Signature Planner for jobID ${jobId}:`, fetchError);
      // WebSocket: Notify failure to trigger
      if (jobId) {
        await emitStepProgress(
          jobId,
          OrchestrationStepEnum.enum.planning_function_signatures,
          'failed',
          `Failed to trigger Function Signature Planner: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
        );
      }
      throw fetchError; // Re-throw to be caught by the outer try-catch
    }

    console.log(`[Orchestrate/Start] Function Signature Planner triggered for jobID: ${jobId}`);

    // WebSocket: Notify that planning is now in progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.planning_function_signatures,
      'in_progress',
      'Function Signature Planner agent has been notified. Processing tool requirements...'
    );

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

