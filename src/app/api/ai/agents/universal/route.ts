// Universal Agent Route - Phase 2.3 Implementation
// Single route handles all agents with dynamic module execution
// Integrates all 7 agent modules with unified interfaces

import { NextRequest, NextResponse } from 'next/server';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

// Import all agent modules
import { 
  executeFunctionPlanner, 
  type FunctionPlannerRequest, 
  type FunctionPlannerResult 
} from '@/lib/agents/unified/modules/function-planner';
import { 
  executeStateDesign, 
  type StateDesignRequest, 
  type StateDesignResult 
} from '@/lib/agents/unified/modules/state-design';
import { 
  executeJSXLayout, 
  type JSXLayoutRequest, 
  type JSXLayoutResult 
} from '@/lib/agents/unified/modules/jsx-layout';
import { 
  executeTailwindStyling, 
  type TailwindStylingRequest, 
  type TailwindStylingResult 
} from '@/lib/agents/unified/modules/tailwind-styling';
import { 
  executeComponentAssembler, 
  type ComponentAssemblerRequest, 
  type ComponentAssemblerResult 
} from '@/lib/agents/unified/modules/component-assembler';
import { 
  executeValidator, 
  type ValidatorRequest, 
  type ValidatorResult 
} from '@/lib/agents/unified/modules/validator';
import { 
  executeToolFinalizer, 
  type ToolFinalizerRequest, 
  type ToolFinalizerResult 
} from '@/lib/agents/unified/modules/tool-finalizer';

// Agent type definitions
export type AgentType = 
  | 'function-planner'
  | 'state-design'
  | 'jsx-layout'
  | 'tailwind-styling'
  | 'component-assembler'
  | 'validator'
  | 'tool-finalizer'
  | 'data-requirements-research';

interface UniversalAgentRequest {
  agent: AgentType;
  jobId: string;
  tcc: ToolConstructionContext;
  selectedModel?: string;
  isIsolatedTest?: boolean;
  editMode?: {
    isEditMode: boolean;
    instructions: Array<{
      targetAgent: string;
      editType: 'refine' | 'replace' | 'enhance';
      instructions: string;
      priority: 'low' | 'medium' | 'high';
      createdAt: string;
    }>;
    context: string;
  };
  retryAttempt?: number;
  previousErrors?: string[];
}

interface UniversalAgentResponse {
  success: boolean;
  result?: any;
  updatedTcc?: ToolConstructionContext;
  error?: string;
  validationErrors?: string[];
  retryRecommended?: boolean;
}

// Agent execution mapping
type AgentExecutor = (request: any) => Promise<any>;

const AGENT_EXECUTORS: Record<AgentType, AgentExecutor> = {
  'function-planner': executeFunctionPlanner,
  'state-design': executeStateDesign,
  'jsx-layout': executeJSXLayout,
  'tailwind-styling': executeTailwindStyling,
  'component-assembler': executeComponentAssembler,
  'validator': executeValidator,
  'tool-finalizer': executeToolFinalizer,
  'data-requirements-research': async (request: any) => {
    // TODO: Implement data-requirements-research module
    logger.warn({ agent: 'data-requirements-research' }, 'Data requirements research module not yet implemented');
    return {
      success: false,
      error: 'Data requirements research module not yet implemented',
      updatedTcc: request.tcc
    };
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: UniversalAgentRequest = await request.json();
    const { 
      agent, 
      jobId, 
      tcc, 
      selectedModel, 
      isIsolatedTest = false, 
      editMode, 
      retryAttempt = 0, 
      previousErrors = [] 
    } = body;

    logger.info({ 
      agent, 
      jobId, 
      retryAttempt, 
      isIsolatedTest,
      hasEditMode: !!editMode,
      previousErrorsCount: previousErrors.length
    }, `🔄 Universal Agent: Processing ${agent} (attempt ${retryAttempt + 1})`);

    // Validate required parameters
    if (!agent || !jobId || !tcc) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: agent, jobId, or tcc',
      } as UniversalAgentResponse);
    }

    // Validate agent type
    if (!AGENT_EXECUTORS[agent]) {
      return NextResponse.json({
        success: false,
        error: `Unknown agent type: ${agent}`,
      } as UniversalAgentResponse);
    }

    // Prepare agent request
    const agentRequest = {
      jobId,
      selectedModel,
      tcc,
      isIsolatedTest,
      editMode,
      retryAttempt,
      previousErrors
    };

    logger.info({ 
      agent, 
      jobId,
      tccKeys: Object.keys(tcc),
      tccStatus: tcc.status,
      modelSelected: selectedModel || 'default'
    }, `🔄 Universal Agent: Executing ${agent} module`);

    // Execute agent module
    const executor = AGENT_EXECUTORS[agent];
    const result = await executor(agentRequest);

    logger.info({ 
      agent, 
      jobId,
      success: result.success,
      hasError: !!result.error,
      hasUpdatedTcc: !!result.updatedTcc
    }, `🔄 Universal Agent: ${agent} execution completed`);

    // Handle execution failure
    if (!result.success) {
      logger.error({ 
        agent, 
        jobId, 
        error: result.error,
        retryAttempt
      }, `🔄 Universal Agent: ${agent} execution failed`);

      return NextResponse.json({
        success: false,
        error: result.error,
        retryRecommended: retryAttempt < 2,
      } as UniversalAgentResponse);
    }

    // Success response
    logger.info({ 
      agent, 
      jobId,
      resultKeys: Object.keys(result),
      updatedTccStatus: result.updatedTcc?.status
    }, `🔄 Universal Agent: ${agent} completed successfully`);

    return NextResponse.json({
      success: true,
      result: result.result || result[getResultKey(agent)],
      updatedTcc: result.updatedTcc,
    } as UniversalAgentResponse);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, '🔄 Universal Agent: Unexpected error');
    
    return NextResponse.json({
      success: false,
      error: `Unexpected error: ${errorMessage}`,
    } as UniversalAgentResponse);
  }
}

// Helper function to get the result key for each agent
function getResultKey(agent: AgentType): string {
  const resultKeys: Record<AgentType, string> = {
    'function-planner': 'functionSignatures',
    'state-design': 'stateLogic',
    'jsx-layout': 'jsxLayout',
    'tailwind-styling': 'styling',
    'component-assembler': 'assembledComponent',
    'validator': 'validationResult',
    'tool-finalizer': 'finalizedTool',
    'data-requirements-research': 'researchData'
  };
  
  return resultKeys[agent] || 'result';
}

// GET method for health check and agent status
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'health') {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      availableAgents: Object.keys(AGENT_EXECUTORS),
      version: '2.3'
    });
  }

  if (action === 'agents') {
    return NextResponse.json({
      agents: Object.keys(AGENT_EXECUTORS).map(agent => ({
        name: agent,
        implemented: agent !== 'data-requirements-research',
        module: `@/lib/agents/unified/modules/${agent}`
      }))
    });
  }

  return NextResponse.json({
    message: 'Universal Agent Route - Phase 2.3',
    usage: {
      POST: 'Execute agent with { agent, jobId, tcc, selectedModel?, isIsolatedTest?, editMode? }',
      'GET?action=health': 'Health check',
      'GET?action=agents': 'List available agents'
    }
  });
} 