/**
 * Universal Agent Route (Phase 2.1)
 * Single unified endpoint for all agent executions
 * Replaces individual agent routes with centralized orchestration
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AgentType } from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { executeAgent } from '@/lib/agents/unified/core/agent-executor';
import { createAgentExecutionContext } from '@/lib/agents/unified/core/model-manager';
import logger from '@/lib/logger';

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
  jobId: z.string().uuid(),
  tcc: z.custom<ToolConstructionContext>(),
  selectedModel: z.string().optional(),
  isIsolatedTest: z.boolean().default(false)
});

type UniversalAgentRequest = z.infer<typeof UniversalAgentRequestSchema>;

// Unified response interface (no 'any' types!)
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
  error?: string;
  executionTime?: number;
  modelUsed?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<UniversalAgentResponse>> {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const validatedRequest = UniversalAgentRequestSchema.parse(body);
    const { agentType, jobId, tcc, selectedModel, isIsolatedTest } = validatedRequest;

    logger.info({
      jobId,
      agentType,
      selectedModel,
      isIsolatedTest,
      userId: tcc.userId
    }, '🔄 Universal Agent Route: Processing request');

    // Create execution context
    const executionContext = createAgentExecutionContext(
      agentType,
      jobId,
      tcc,
      selectedModel,
      isIsolatedTest
    );

    // Execute the agent
    const result = await executeAgent(agentType, executionContext, tcc);
    
    const executionTime = Date.now() - startTime;

    // Convert result to unified response format
    const response: UniversalAgentResponse = {
      success: true,
      agentType,
      jobId,
      result: convertAgentResultToResponse(agentType, result),
      executionTime,
      modelUsed: executionContext.modelConfig.modelId
    };

    logger.info({
      jobId,
      agentType,
      executionTime,
      modelUsed: executionContext.modelConfig.modelId,
      success: true
    }, '✅ Universal Agent Route: Request completed successfully');

    return NextResponse.json(response);

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Extract context from error for better logging
    const context = extractContextFromError(error);
    
    logger.error({
      ...context,
      error: errorMessage,
      executionTime
    }, '❌ Universal Agent Route: Request failed');

    const errorResponse: UniversalAgentResponse = {
      success: false,
      agentType: context.agentType || 'unknown' as AgentType,
      jobId: context.jobId || 'unknown',
      error: errorMessage,
      executionTime
    };

    return NextResponse.json(errorResponse, { status: 500 });
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
      const tsResult = result as { styling: { styledComponentCode: string; styleMap: Record<string, string>; colorScheme: unknown } };
      return {
        styling: {
          styledComponentCode: tsResult.styling.styledComponentCode,
          styleMap: tsResult.styling.styleMap,
          colorScheme: tsResult.styling.colorScheme as NonNullable<UniversalAgentResponse['result']>['styling']['colorScheme']
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

// Extract context from error for better logging
function extractContextFromError(error: unknown): { agentType?: AgentType; jobId?: string } {
  if (error instanceof Error) {
    // Try to extract context from error message or stack
    const message = error.message;
    const stackTrace = error.stack || '';
    
    // Simple pattern matching for context extraction
    const agentTypeMatch = message.match(/agent[:\s]+([a-z-]+)/i);
    const jobIdMatch = message.match(/job[:\s]+([a-f0-9-]+)/i);
    
    return {
      agentType: agentTypeMatch?.[1] as AgentType,
      jobId: jobIdMatch?.[1]
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