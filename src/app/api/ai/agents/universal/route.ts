// Universal Agent Route - Phase 2.1 Implementation
// Single route handles all 7 agents with dynamic switching
// Preserves model selection, WebSocket feedback, and isolation testing

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';

// Import existing working agent modules
import { executeFunctionPlanner } from '@/lib/agents/unified/modules/function-planner';
import { executeStateDesign } from '@/lib/agents/unified/modules/state-design';
import { executeJSXLayout } from '@/lib/agents/unified/modules/jsx-layout';
import { executeTailwindStyling } from '@/lib/agents/unified/modules/tailwind-styling';
import { executeComponentAssembler } from '@/lib/agents/unified/modules/component-assembler';
import { executeValidator } from '@/lib/agents/unified/modules/validator';
import { executeToolFinalizer } from '@/lib/agents/unified/modules/tool-finalizer';

// Agent type from the plan
export type AgentType = 
  | 'function-planner'
  | 'state-design'
  | 'jsx-layout'
  | 'tailwind-styling'
  | 'component-assembler'
  | 'code-validator'
  | 'tool-finalizer';

// Request schema for universal agent route
const UniversalAgentRequestSchema = z.object({
  agentType: z.enum([
    'function-planner',
    'state-design', 
    'jsx-layout',
    'tailwind-styling',
    'component-assembler',
    'code-validator',
    'tool-finalizer'
  ]),
  jobId: z.string(),
  selectedModel: z.string().optional(),
  tcc: z.any(), // ToolConstructionContext - using any temporarily for migration
  isIsolatedTest: z.boolean().optional().default(false),
  editMode: z.object({
    isEditMode: z.boolean(),
    instructions: z.array(z.object({
      targetAgent: z.string(),
      editType: z.enum(['refine', 'replace', 'enhance']),
      instructions: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
      createdAt: z.string(),
    })),
    context: z.string(),
  }).optional(),
});

type UniversalAgentRequest = z.infer<typeof UniversalAgentRequestSchema>;

export async function POST(request: NextRequest) {
  logger.info('🚀 Universal Agent Route: Processing request');

  try {
    // Parse and validate request
    const body = await request.json();
    const validatedRequest = UniversalAgentRequestSchema.parse(body);
    
    const { agentType, jobId, selectedModel, tcc, isIsolatedTest, editMode } = validatedRequest;

    logger.info({
      agentType,
      jobId,
      selectedModel,
      isIsolatedTest,
      hasEditMode: !!editMode
    }, '🎯 Universal Agent Route: Validated request parameters');

    // Dynamic agent execution based on type
    const result = await executeAgent({
      agentType,
      jobId,
      selectedModel,
      tcc,
      isIsolatedTest,
      editMode,
    });

    logger.info({
      agentType,
      jobId,
      success: result.success,
      hasError: !!result.error
    }, '✅ Universal Agent Route: Agent execution completed');

    return NextResponse.json(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, '❌ Universal Agent Route: Request failed');

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Universal agent execution failed'
      },
      { status: 500 }
    );
  }
}

// Dynamic agent execution function
async function executeAgent(params: {
  agentType: AgentType;
  jobId: string;
  selectedModel?: string;
  tcc: any; // ToolConstructionContext
  isIsolatedTest?: boolean;
  editMode?: any;
}) {
  const { agentType, jobId, selectedModel, tcc, isIsolatedTest = false, editMode } = params;

  logger.info({
    agentType,
    jobId,
    modelSelection: selectedModel || 'default',
    mode: isIsolatedTest ? 'ISOLATION_TEST' : 'PRODUCTION'
  }, '🔄 Universal Agent Route: Starting agent execution');

  // Agent execution mapping
  const agentExecutors = {
    'function-planner': executeFunctionPlanner,
    'state-design': executeStateDesign,
    'jsx-layout': executeJSXLayout,
    'tailwind-styling': executeTailwindStyling,
    'component-assembler': executeComponentAssembler,
    'code-validator': executeValidator,
    'tool-finalizer': executeToolFinalizer,
  };

  const executor = agentExecutors[agentType];
  if (!executor) {
    throw new Error(`No executor found for agent type: ${agentType}`);
  }

  try {
    // Execute the specific agent with standardized interface
    const result = await executor({
      jobId,
      selectedModel,
      tcc,
      isIsolatedTest,
      editMode,
    });

    logger.info({
      agentType,
      jobId,
      success: result.success,
      resultKeys: Object.keys(result),
    }, '✅ Universal Agent Route: Agent execution successful');

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      agentType,
      jobId,
      error: errorMessage
    }, '❌ Universal Agent Route: Agent execution failed');

    return {
      success: false,
      error: errorMessage,
      updatedTcc: tcc, // Return original TCC on failure
    };
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    message: 'Universal Agent Route is operational',
    supportedAgents: [
      'function-planner',
      'state-design',
      'jsx-layout', 
      'tailwind-styling',
      'component-assembler',
      'code-validator',
      'tool-finalizer'
    ],
    timestamp: new Date().toISOString(),
  });
} 