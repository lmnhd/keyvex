import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ToolConstructionContextSchema, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import type { ToolConstructionContext, OrchestrationStep } from '@/lib/types/product-tool-creation-v2/tcc';
import { saveTCC, getTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { getUserId } from '@/lib/auth/get-user-id';
import { requireAuth } from '@/lib/auth/debug';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import logger from '@/lib/logger';

// Input schema matching create-tool pattern
const ToolCreationV2RequestSchema = z.object({
  userIntent: z.string().min(10, { message: 'Tool description must be at least 10 characters long' }),
  context: z.object({
    targetAudience: z.string().optional(),
    industry: z.string().optional(),
    toolType: z.string().optional(),
    features: z.array(z.string()).optional(),
    businessDescription: z.string().optional(),
    brainstormingResult: z.any().optional(),
    logicArchitectInsights: z.any().optional(),
  }).optional(),
  selectedModel: z.string().optional(),
  existingTool: z.any().optional(),
  updateType: z.enum(['color', 'title', 'description', 'features', 'components', 'general']).optional()
});

// Helper function to call individual agents
async function callAgent(
  agentPath: string, 
  jobId: string, 
  request: NextRequest
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const agentUrl = new URL(`/api/ai/product-tool-creation-v2/agents/${agentPath}`, request.nextUrl.origin);
    
    const response = await fetch(agentUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: `Agent ${agentPath} failed: ${response.status} - ${errorData.error || 'Unknown error'}` 
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: `Agent ${agentPath} error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Helper function to wait for agent completion and check TCC status
async function waitForAgentCompletion(
  jobId: string, 
  expectedStep: OrchestrationStep,
  timeoutMs: number = 45000 // 45 seconds max per agent
): Promise<{ success: boolean; tcc?: ToolConstructionContext; error?: string }> {
  const startTime = Date.now();
  const pollInterval = 500; // Check every 500ms
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const tcc = await getTCC(jobId);
      if (!tcc) {
        return { success: false, error: 'TCC not found during polling' };
      }

      // Check if we've moved past the expected step (completed)
      const currentStepIndex = Object.values(OrchestrationStepEnum.enum).indexOf(tcc.currentOrchestrationStep as any);
      const expectedStepIndex = Object.values(OrchestrationStepEnum.enum).indexOf(expectedStep as any);
      
      if (currentStepIndex > expectedStepIndex || tcc.status === OrchestrationStatusEnum.enum.completed) {
        return { success: true, tcc };
      }
      
      if (tcc.status === OrchestrationStatusEnum.enum.error) {
        return { success: false, error: 'Agent marked TCC as failed' };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      logger.warn(`Error polling TCC for jobId ${jobId}: ${error}`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  return { success: false, error: `Timeout waiting for agent to complete step ${expectedStep}` };
}

// Main orchestration function following create-tool pattern
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  logger.info({ endpoint: '/api/ai/product-tool-creation-v2', method: 'POST' }, '🏭 API [product-tool-creation-v2]: Request received');
  
  let jobId: string | undefined = undefined;
  
  try {
    const userId = await requireAuth();
    logger.info({ userId }, '🏭 API [product-tool-creation-v2]: User authenticated successfully');
    
    const body = await request.json();
    const validatedData = ToolCreationV2RequestSchema.parse(body);
    logger.info({ 
      userIntentLength: validatedData.userIntent.length,
      contextKeys: Object.keys(validatedData.context || {}),
      selectedModel: validatedData.selectedModel,
      validationSuccess: true 
    }, '🏭 API [product-tool-creation-v2]: Schema validation passed');

    // Step 1: Initialize TCC (similar to orchestrate/start)
    jobId = uuidv4();
    const now = new Date().toISOString();

    const initialTCC: ToolConstructionContext = {
      jobId,
      userId: userId || 'anonymous',
      currentOrchestrationStep: OrchestrationStepEnum.enum.initialization,
      status: OrchestrationStatusEnum.enum.pending,
      userInput: {
        description: validatedData.userIntent,
        targetAudience: validatedData.context?.targetAudience,
        industry: validatedData.context?.industry,
        toolType: validatedData.context?.toolType,
        features: validatedData.context?.features || [],
      },
      progressLog: [],
      createdAt: now,
      updatedAt: now,
      tccVersion: '1.0.0',
      additionalContext: validatedData.context || {},
    };
    
    await saveTCC(initialTCC);
    logger.info({ jobId }, '🏭 INIT: TCC created and saved');

    // Step 2: Function Signature Planner
    logger.info({ jobId }, '🏭 STEP 1: Starting Function Signature Planner');
    const plannerResult = await callAgent('function-planner', jobId, request);
    if (!plannerResult.success) {
      throw new Error(`Function Planner failed: ${plannerResult.error}`);
    }

    const plannerWait = await waitForAgentCompletion(jobId, OrchestrationStepEnum.enum.planning_function_signatures);
    if (!plannerWait.success) {
      throw new Error(`Function Planner timeout: ${plannerWait.error}`);
    }
    logger.info({ jobId }, '🏭 STEP 1: ✅ Function Signature Planner completed');

    // Step 3: State Design Agent  
    logger.info({ jobId }, '🏭 STEP 2: Starting State Design Agent');
    const stateResult = await callAgent('state-design', jobId, request);
    if (!stateResult.success) {
      throw new Error(`State Design failed: ${stateResult.error}`);
    }

    const stateWait = await waitForAgentCompletion(jobId, OrchestrationStepEnum.enum.designing_state_logic);
    if (!stateWait.success) {
      throw new Error(`State Design timeout: ${stateWait.error}`);
    }
    logger.info({ jobId }, '🏭 STEP 2: ✅ State Design Agent completed');

    // Step 4: JSX Layout Agent
    logger.info({ jobId }, '🏭 STEP 3: Starting JSX Layout Agent');
    const jsxResult = await callAgent('jsx-layout', jobId, request);
    if (!jsxResult.success) {
      throw new Error(`JSX Layout failed: ${jsxResult.error}`);
    }

    const jsxWait = await waitForAgentCompletion(jobId, OrchestrationStepEnum.enum.designing_jsx_layout);
    if (!jsxWait.success) {
      throw new Error(`JSX Layout timeout: ${jsxWait.error}`);
    }
    logger.info({ jobId }, '🏭 STEP 3: ✅ JSX Layout Agent completed');

    // Step 5: Tailwind Styling Agent
    logger.info({ jobId }, '🏭 STEP 4: Starting Tailwind Styling Agent');
    const stylingResult = await callAgent('tailwind-styling', jobId, request);
    if (!stylingResult.success) {
      throw new Error(`Tailwind Styling failed: ${stylingResult.error}`);
    }

    const stylingWait = await waitForAgentCompletion(jobId, OrchestrationStepEnum.enum.applying_tailwind_styling);
    if (!stylingWait.success) {
      throw new Error(`Tailwind Styling timeout: ${stylingWait.error}`);
    }
    logger.info({ jobId }, '🏭 STEP 4: ✅ Tailwind Styling Agent completed');

    // Step 6: Assembly and Finalization
    logger.info({ jobId }, '🏭 FINALIZATION: Assembling final tool');
    const finalTCC = await getTCC(jobId);
    if (!finalTCC) {
      throw new Error('TCC not found during finalization');
    }

    // TODO: Add assembly logic here to combine all parts into ProductToolDefinition
    // For now, create a placeholder response similar to create-tool
    const finalTool: ProductToolDefinition = {
      id: `tool-v2-${Date.now()}`,
      slug: `tool-v2-slug-${Date.now()}`,
      version: '1.0',
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: userId,
      metadata: {
        id: `meta-v2-${Date.now()}`,
        slug: `meta-v2-slug-${Date.now()}`,
        title: 'V2 Generated Tool (Needs Assembly)',
        description: 'Tool generated using product-tool-creation-v2 orchestration',
        shortDescription: 'V2 Generated Tool',
        type: 'tool',
        category: 'general', 
        targetAudience: finalTCC.userInput.targetAudience || 'general users',
        industry: finalTCC.userInput.industry || 'various',
        tags: [],
        estimatedCompletionTime: 5,
        difficultyLevel: 'beginner',
        features: finalTCC.userInput.features || [],
        icon: { type: 'lucide', value: 'Package' }
      },
      componentSet: 'shadcn',
      componentCode: finalTCC.jsxLayout?.componentStructure || "'use client';\nfunction V2PlaceholderComponent() { return React.createElement('div', { className: 'p-4' }, 'V2 Tool Created - Assembly Needed'); }",
      colorScheme: {
        primary: '#3b82f6',
        secondary: '#6b7280', 
        background: '#ffffff',
        surface: '#f9fafb',
        text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
        border: '#e5e7eb',
        success: '#10b981',
        warning: '#f59e0b', 
        error: '#ef4444'
      },
      initialStyleMap: {},
      currentStyleMap: {},
      analytics: { enabled: true, completions: 0, averageTime: 0 }
    };

    const totalRequestTime = Date.now() - requestStartTime;
    logger.info({ 
      success: true,
      jobId,
      toolTitle: finalTool.metadata.title,
      totalRequestTimeMs: totalRequestTime
    }, '🏭 API [product-tool-creation-v2]: Request completed successfully');

    return NextResponse.json({
      success: true,
      tool: finalTool,
      jobId,
      tcc: finalTCC,
      message: `Created tool using V2 orchestration successfully`
    });

  } catch (error) {
    const totalRequestTime = Date.now() - requestStartTime;
    logger.error({ 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error),
      jobId,
      totalRequestTimeMs: totalRequestTime,
      endpoint: '/api/ai/product-tool-creation-v2'
    }, '🏭 API [product-tool-creation-v2]: Request failed with error');
    
    if (jobId) {
      try {
        await emitStepProgress(jobId, OrchestrationStepEnum.enum.failed, 'failed', `Orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } catch (emitError) {
        logger.error({ emitError }, 'Failed to emit failure progress');
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : String(error),
        jobId
      },
      { status: 500 }
    );
  }
}

// GET handler for agent info (following create-tool pattern)
export async function GET(request: NextRequest) {
  logger.info({ endpoint: '/api/ai/product-tool-creation-v2', method: 'GET' }, '🏭 API [product-tool-creation-v2]: GET request received');
  
  try {
    const agentInfo = {
      success: true,
      agent: 'Product Tool Creation V2 Orchestrator',
      version: '2.0',
      architecture: 'VERCEL FIRST - Sequential Agent Orchestration',
      agents: [
        'Function Signature Planner',
        'State Design Agent', 
        'JSX Layout Agent',
        'Tailwind Styling Agent'
      ],
      capabilities: [
        'Multi-agent specialized tool creation',
        'Sequential agent orchestration',
        'TCC state persistence',
        'WebSocket progress streaming',
        'Advanced component assembly'
      ],
      supportedToolTypes: [
        'ROI Calculator',
        'Assessment Tool', 
        'Pricing Calculator',
        'Lead Qualifier',
        'Survey Builder',
        'Cost Analyzer',
        'Investment Calculator'
      ]
    };

    logger.info({ 
      agentInfo: {
        capabilities: agentInfo.capabilities.length,
        agents: agentInfo.agents.length,
        supportedToolTypes: agentInfo.supportedToolTypes.length
      }
    }, '🏭 API [product-tool-creation-v2]: Agent info retrieved successfully');

    return NextResponse.json(agentInfo);

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message
      } : String(error),
      endpoint: '/api/ai/product-tool-creation-v2',
      method: 'GET'
    }, '🏭 API [product-tool-creation-v2]: GET request failed');

    return NextResponse.json(
      { success: false, error: 'Failed to get agent info' },
      { status: 500 }
    );
  }
} 