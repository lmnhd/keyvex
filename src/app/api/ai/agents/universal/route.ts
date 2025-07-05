/**
 * Universal Agent Route (Phase 2.1 - Enhanced)
 * Single unified endpoint for all agent executions with retry logic
 * Integrates with the new unified agent architecture
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AgentType } from '../../../../../lib/types/tcc-unified';
import { ToolConstructionContext, OrchestrationStep } from '../../../../../lib/types/product-tool-creation-v2/tcc';
import { executeAgent } from '../../../../../lib/agents/unified/core/agent-executor';
import { runStateDesignLoop } from '../../../../../lib/agents/unified/loops/state-design-loop';
import { createAgentExecutionContext } from '../../../../../lib/agents/unified/core/model-manager';
import logger from '../../../../../lib/logger';

// Import WebSocket progress emitter
import { emitStepProgress } from '../../../../../lib/streaming/progress-emitter.server';

// Request schema for universal agent execution
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
  tcc: z.custom<ToolConstructionContext>(),
  selectedModel: z.string().optional(),
  isIsolatedTest: z.boolean().default(false),
  retryAttempt: z.number().default(0).optional(),
  editMode: z.object({
    isEditMode: z.boolean(),
    editMessage: z.string().optional(),
    targetField: z.string().optional()
  }).optional()
});

type UniversalAgentRequest = z.infer<typeof UniversalAgentRequestSchema>;

// Enhanced response interface with retry information
interface UniversalAgentResponse {
  success: boolean;
  agentType: AgentType;
  jobId: string;
  result?: {
    functionSignatures?: Array<{
      name: string;
      parameters: Array<{ name: string; type: string; description: string }>;
      description: string;
    }>;
    stateLogic?: {
      variables: Array<{ name: string; type: string; initialValue: string; description: string }>;
      functions: Array<{ name: string; parameters: string[]; body: string; description: string }>;
      imports: string[];
    };
    jsxLayout?: {
      componentStructure: string;
      elementMap: Array<{ elementId: string; type: string; purpose: string }>;
      accessibilityFeatures?: string[];
    };
    styling?: {
      styledComponentCode: string;
      styleMap: Record<string, string>;
      colorScheme: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        text: { primary: string; secondary: string; muted: string };
        border: string;
        success: string;
        warning: string;
        error: string;
      };
    };
    assembledCode?: string;
    validationResult?: {
      isValid: boolean;
      issues: string[];
      warnings: string[];
      suggestions: string[];
    };
    finalProduct?: {
      id: string;
      componentCode: string;
      metadata: Record<string, unknown>;
      colorScheme: Record<string, string>;
    };
    metadata?: Record<string, unknown>;
  };
  updatedTcc?: ToolConstructionContext;
  error?: string;
  executionTime?: number;
  modelUsed?: string;
  retryInfo?: {
    attemptNumber: number;
    maxAttempts: number;
    isRetry: boolean;
    retryReason?: string;
    totalRetryTime?: number;
  };
  validationScore?: number;
}

// Map agent types to WebSocket step names for progress updates
function getStepNameForAgent(agentType: AgentType): OrchestrationStep {
  const stepMapping: Record<AgentType, OrchestrationStep> = {
    'function-planner': 'planning_function_signatures',
    'state-design': 'designing_state_logic',
    'jsx-layout': 'designing_jsx_layout',
    'tailwind-styling': 'applying_tailwind_styling',
    'component-assembler': 'assembling_component',
    'code-validator': 'validating_code',
    'tool-finalizer': 'finalizing_tool'
  };
  return stepMapping[agentType] || 'initialization';
}

export async function POST(request: NextRequest): Promise<NextResponse<UniversalAgentResponse>> {
  const startTime = Date.now();
  let body: any;
  
  try {
    body = await request.json();
    const validatedRequest = UniversalAgentRequestSchema.parse(body);
    const { agentType, jobId, tcc, selectedModel, isIsolatedTest, retryAttempt, editMode } = validatedRequest;

    logger.info({
      jobId,
      agentType,
      selectedModel,
      isIsolatedTest,
      retryAttempt: retryAttempt || 0,
      isRetry: (retryAttempt || 0) > 0,
      userId: tcc.userId
    }, '🔄 Universal Agent Route: Processing request');

    // 🚀 EMIT START PROGRESS - Agent is beginning work
    const stepName = getStepNameForAgent(agentType);
    if (!isIsolatedTest) {
      try {
        await emitStepProgress(
          jobId,
          stepName,
          'started',
          `${agentType} is processing...`,
          { 
            userId: tcc.userId,
            agentType,
            modelUsed: selectedModel,
            isRetry: (retryAttempt || 0) > 0,
            startTime: new Date().toISOString()
          }
        );
        logger.info({ jobId, agentType, stepName }, '📡 Emitted start progress via WebSocket');
      } catch (wsError) {
        logger.warn({ jobId, agentType, error: wsError }, '⚠️ Failed to emit start progress via WebSocket');
      }
    }

    // Create execution context with retry information
    const executionContext = createAgentExecutionContext(
      agentType,
      jobId,
      tcc,
      selectedModel,
      isIsolatedTest
    );

    // Add edit mode context if provided
    if (editMode?.isEditMode) {
      executionContext.editMode = {
        isEditMode: true,
        totalEdits: 1,
        lastEditedAt: new Date().toISOString(),
        activeEditInstructions: editMode.editMessage ? [{
          targetAgent: agentType,
          editType: 'refine',
          instructions: editMode.editMessage,
          priority: 'medium',
          createdAt: new Date().toISOString()
        }] : undefined
      };
    }

    // Execute the agent. For state-design we run the iterative loop used in orchestration so isolation tests mirror production.
    let result: any;
    let updatedTcc: ToolConstructionContext;
    if (agentType === 'state-design') {
      const { updatedTcc: loopTcc } = await runStateDesignLoop(executionContext, tcc);
      updatedTcc = loopTcc;
      result = { stateLogic: loopTcc.stateLogic };
    } else {
      const execOut = await executeAgent(agentType, executionContext, tcc);
      result = execOut.result;
      updatedTcc = execOut.updatedTcc;
    }
    
    const executionTime = Date.now() - startTime;

    // Convert result to unified response format
    const response: UniversalAgentResponse = {
      success: true,
      agentType,
      jobId,
      result: convertAgentResultToResponse(agentType, result),
      updatedTcc,
      executionTime,
      modelUsed: executionContext.modelConfig.modelId,
      retryInfo: {
        attemptNumber: retryAttempt || 0,
        maxAttempts: executionContext.retryConfig.maxAttempts,
        isRetry: (retryAttempt || 0) > 0,
        totalRetryTime: executionTime
      },
      validationScore: (result as any).metadata?.validationScore || 100
    };

    // 🎉 EMIT COMPLETION PROGRESS - Agent has finished successfully
    if (!isIsolatedTest) {
      try {
        await emitStepProgress(
          jobId,
          stepName,
          'completed',
          `${agentType} completed successfully`,
          { 
            userId: tcc.userId,
            agentType,
            executionTime,
            modelUsed: executionContext.modelConfig.modelId,
            validationScore: response.validationScore,
            isRetry: (retryAttempt || 0) > 0,
            completedAt: new Date().toISOString(),
            tccUpdated: !!updatedTcc
          }
        );
        logger.info({ jobId, agentType, stepName, executionTime }, '✅ Emitted completion progress via WebSocket');
      } catch (wsError) {
        logger.warn({ jobId, agentType, error: wsError }, '⚠️ Failed to emit completion progress via WebSocket');
      }

      // 📊 EMIT TCC UPDATE - Send updated TCC to workbench
      if (updatedTcc) {
        try {
          const { emitTccUpdate } = await import('../../../../../lib/streaming/progress-emitter.server');
          await emitTccUpdate(jobId, updatedTcc, agentType);
          logger.info({ jobId, agentType, tccKeys: Object.keys(updatedTcc) }, '📊 Emitted TCC update via WebSocket');
        } catch (wsError) {
          logger.warn({ jobId, agentType, error: wsError }, '⚠️ Failed to emit TCC update via WebSocket');
        }
      }
    }

    logger.info({
      jobId,
      agentType,
      executionTime,
      modelUsed: executionContext.modelConfig.modelId,
      success: true,
      validationScore: response.validationScore,
      isRetry: (retryAttempt || 0) > 0
    }, '✅ Universal Agent Route: Request completed successfully');

    return NextResponse.json(response);

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Extract context from error for better logging
    const context = extractContextFromError(error);
    
    // 💥 EMIT FAILURE PROGRESS - Agent has failed
    const stepName = getStepNameForAgent(context.agentType || 'unknown' as AgentType);
    // Check if this is not an isolated test (validatedRequest may not be available in catch block)
    const isIsolatedTest = body?.isIsolatedTest || false;
    if (!isIsolatedTest) {
      try {
        await emitStepProgress(
          context.jobId || 'unknown',
          stepName,
          'failed',
          `${context.agentType || 'unknown'} failed: ${errorMessage}`,
          { 
            userId: body?.tcc?.userId || 'unknown-user',
            agentType: context.agentType,
            error: errorMessage,
            executionTime,
            isRetry: (context.retryAttempt || 0) > 0,
            failedAt: new Date().toISOString()
          }
        );
        logger.info({ jobId: context.jobId, agentType: context.agentType, stepName }, '❌ Emitted failure progress via WebSocket');
      } catch (wsError) {
        logger.warn({ jobId: context.jobId, agentType: context.agentType, error: wsError }, '⚠️ Failed to emit failure progress via WebSocket');
      }
    }
    
    logger.error({
      ...context,
      error: errorMessage,
      executionTime,
      retryAttempt: context.retryAttempt || 0
    }, '❌ Universal Agent Route: Request failed');

    // Determine if this is a retryable error
    const isRetryable = isRetryableError(error);
    const maxRetries = 3;
    const currentRetry = context.retryAttempt || 0;

    const errorResponse: UniversalAgentResponse = {
      success: false,
      agentType: context.agentType || 'unknown' as AgentType,
      jobId: context.jobId || 'unknown',
      error: errorMessage,
      executionTime,
      retryInfo: {
        attemptNumber: currentRetry,
        maxAttempts: maxRetries,
        isRetry: currentRetry > 0,
        retryReason: isRetryable ? getRetryReason(error) : undefined,
        totalRetryTime: executionTime
      }
    };

    // Return appropriate status code
    const statusCode = isRetryable && currentRetry < maxRetries ? 429 : 500;
    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

// Convert agent-specific results to unified response format
function convertAgentResultToResponse(agentType: AgentType, result: unknown): UniversalAgentResponse['result'] {
  // Type-safe conversion based on agent type
  switch (agentType) {
    case 'function-planner':
      const fpResult = result as { functionSignatures: Array<{ name: string; description: string }> };
      return {
        functionSignatures: fpResult.functionSignatures.map(sig => ({
          name: sig.name,
          parameters: [], // Simplified for response
          description: sig.description
        })),
        metadata: { agentType: 'function-planner' }
      };
      
    case 'state-design':
      const sdResult = result as { stateLogic: { variables: unknown[]; functions: unknown[]; imports: string[] } };
      return {
        stateLogic: {
          variables: sdResult.stateLogic.variables as Array<{ name: string; type: string; initialValue: string; description: string }>,
          functions: sdResult.stateLogic.functions as Array<{ name: string; parameters: string[]; body: string; description: string }>,
          imports: sdResult.stateLogic.imports
        },
        metadata: { agentType: 'state-design' }
      };
      
    case 'jsx-layout':
      const jlResult = result as { jsxLayout: { componentStructure: string; elementMap: unknown[] } };
      return {
        jsxLayout: {
          componentStructure: jlResult.jsxLayout.componentStructure,
          elementMap: jlResult.jsxLayout.elementMap as Array<{ elementId: string; type: string; purpose: string }>,
          accessibilityFeatures: []
        },
        metadata: { agentType: 'jsx-layout' }
      };
      
    case 'tailwind-styling':
      const tsResult = result as { styling: { styledComponentCode: string; styleMap: Record<string, string>; colorScheme: any } };
      return {
        styling: {
          styledComponentCode: tsResult.styling.styledComponentCode,
          styleMap: tsResult.styling.styleMap,
          colorScheme: tsResult.styling.colorScheme || {
            primary: 'blue',
            secondary: 'gray', 
            accent: 'indigo',
            background: 'white',
            surface: 'gray-50',
            text: { primary: 'gray-900', secondary: 'gray-600', muted: 'gray-400' },
            border: 'gray-200',
            success: 'green',
            warning: 'yellow',
            error: 'red'
          }
        },
        metadata: { agentType: 'tailwind-styling' }
      };
      
    case 'component-assembler':
      const caResult = result as { assembledCode: string };
      return {
        assembledCode: caResult.assembledCode,
        metadata: { agentType: 'component-assembler' }
      };
      
    case 'code-validator':
      const cvResult = result as { validationResult: { isValid: boolean; issues: string[]; warnings: string[] } };
      return {
        validationResult: {
          isValid: cvResult.validationResult.isValid,
          issues: cvResult.validationResult.issues,
          warnings: cvResult.validationResult.warnings,
          suggestions: []
        },
        metadata: { agentType: 'code-validator' }
      };
      
    case 'tool-finalizer':
      const tfResult = result as { finalProduct: { id: string; componentCode: string; metadata: Record<string, unknown> } };
      return {
        finalProduct: {
          id: tfResult.finalProduct.id,
          componentCode: tfResult.finalProduct.componentCode,
          metadata: tfResult.finalProduct.metadata,
          colorScheme: {}
        },
        metadata: { agentType: 'tool-finalizer' }
      };
      
    default:
      return { metadata: { agentType, rawResult: result } };
  }
}

// Helper functions for retry logic and error handling

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Retryable error patterns
    const retryablePatterns = [
      'timeout',
      'rate limit',
      'temporary',
      'network',
      'connection',
      'service unavailable',
      'internal server error',
      'model_error',
      'validation_failed'
    ];
    
    return retryablePatterns.some(pattern => message.includes(pattern));
  }
  
  return false;
}

/**
 * Get retry reason from error
 */
function getRetryReason(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('validation')) return 'validation_failed';
    if (message.includes('model')) return 'model_error';
    if (message.includes('network') || message.includes('connection')) return 'network_error';
  }
  
  return 'unknown_error';
}

// Extract context from error for better logging
function extractContextFromError(error: unknown): { agentType?: AgentType; jobId?: string; retryAttempt?: number } {
  if (error instanceof Error) {
    // Try to extract context from error message or stack
    const message = error.message;
    const stackTrace = error.stack || '';
    
    // Simple pattern matching for context extraction
    const agentTypeMatch = message.match(/agent[:\s]+([a-z-]+)/i);
    const jobIdMatch = message.match(/job[:\s]+([a-f0-9-]+)/i);
    
    return {
      agentType: agentTypeMatch?.[1] as AgentType,
      jobId: jobIdMatch?.[1],
      retryAttempt: parseInt(message.match(/retryAttempt[:\s]+(\d+)/i)?.[1] || '0')
    };
  }
  
  return {};
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
