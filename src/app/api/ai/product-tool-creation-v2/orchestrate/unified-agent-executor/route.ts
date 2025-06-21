/**
 * UNIFIED AGENT EXECUTOR (Phase 1.2)
 * THE SINGLE EXECUTION POINT for ALL agent calls
 * 
 * 🎯 DEBUGGING LOCATIONS:
 * 1. Request validation (line ~45)
 * 2. Model configuration (line ~65) 
 * 3. AI model call execution (line ~85)
 * 4. Agent module processing (line ~105)
 * 5. Validation logic (line ~125)
 * 6. Retry logic (line ~145)
 * 7. TCC updates (line ~165)
 * 8. Response formatting (line ~185)
 * 9. Error handling (line ~205)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  AgentType, 
  AgentExecutionContext,
  ModelConfiguration,
  ToolConstructionContext as UnifiedTCC
} from '@/lib/types/tcc-unified';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { executeAgent, getAgentTimeout, validateAgentModule } from '@/lib/agents/unified/core/agent-executor';
import { callModelForObject } from '@/lib/ai/model-caller';
import { getPromptForAgent } from '@/lib/agents/unified/core/prompt-manager';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Request schema
const UnifiedAgentExecutorRequestSchema = z.object({
  agentType: z.enum(['function-planner', 'state-design', 'jsx-layout', 'tailwind-styling', 'component-assembler', 'code-validator', 'tool-finalizer']),
  jobId: z.string(),
  tcc: z.any(), // ToolConstructionContext
  selectedModel: z.string().optional(),
  isIsolatedTest: z.boolean().default(false),
  editMode: z.object({
    isEditMode: z.boolean(),
    instructions: z.array(z.any()),
    context: z.string()
  }).optional()
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let jobId = 'unknown';
  let agentType: AgentType = 'function-planner';

  try {
    // 🎯 BREAKPOINT 1: Request validation
    const body = await request.json();
    const validatedRequest = UnifiedAgentExecutorRequestSchema.parse(body);
    
    jobId = validatedRequest.jobId;
    agentType = validatedRequest.agentType;
    const tcc = validatedRequest.tcc as ToolConstructionContext;
    const selectedModel = validatedRequest.selectedModel;
    const isIsolatedTest = validatedRequest.isIsolatedTest;
    const editMode = validatedRequest.editMode;

    logger.info({
      jobId,
      agentType,
      selectedModel,
      isIsolatedTest,
      hasEditMode: !!editMode
    }, `🚀 UNIFIED EXECUTOR: Starting ${agentType} execution`);

    // 🎯 BREAKPOINT 2: Model configuration
    const primaryModelInfo = getPrimaryModel(agentType === 'function-planner' ? 'functionPlanner' : 'logicArchitect');
    if (!primaryModelInfo) {
      throw new Error(`No primary model configured for ${agentType}`);
    }

    const modelId = selectedModel || primaryModelInfo.modelInfo.id;
    const timeout = getAgentTimeout(agentType);

    const modelConfig: ModelConfiguration = {
      modelId,
      provider: primaryModelInfo.provider as 'openai' | 'anthropic',
      maxTokens: 4000,
      temperature: 0.2
    };

    logger.info({
      jobId,
      agentType,
      modelId,
      timeout,
      provider: primaryModelInfo.provider
    }, `🎯 UNIFIED EXECUTOR: Model configuration set`);

    // Create execution context
    const executionContext: AgentExecutionContext = {
      jobId,
      agentType,
      modelConfig,
      isIsolatedTest,
      timeout,
      retryConfig: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        baseDelay: 1000
      },
      editMode: editMode ? {
        isEditMode: editMode.isEditMode,
        totalEdits: editMode.instructions?.length || 0,
        activeEditInstructions: editMode.instructions || [],
        editHistory: [],
        lastEditedAt: new Date().toISOString()
      } : undefined
    };

    // 🎯 BREAKPOINT 3: AI model call execution
    let rawModelResult;
    try {
      const { systemPrompt, userPrompt } = await getPromptForAgent(agentType, tcc, editMode);
      
      logger.info({
        jobId,
        agentType,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length
      }, `🎯 UNIFIED EXECUTOR: Prompts loaded`);

      // Get the appropriate schema for the agent
      const schema = getSchemaForAgent(agentType);
      
      const modelResponse = await callModelForObject(modelId, {
        schema,
        prompt: userPrompt,
        systemPrompt,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
        maxRetries: 3
      });

      rawModelResult = modelResponse.object;
      
      logger.info({
        jobId,
        agentType,
        modelId,
        responseKeys: Object.keys(rawModelResult || {})
      }, `✅ UNIFIED EXECUTOR: AI model call successful`);

    } catch (modelError) {
      logger.error({
        jobId,
        agentType,
        modelId,
        error: modelError instanceof Error ? modelError.message : String(modelError)
      }, `❌ UNIFIED EXECUTOR: AI model call failed`);

      // 🎯 BREAKPOINT 6: Retry logic - Try fallback model
      const fallbackModelInfo = getFallbackModel(agentType === 'function-planner' ? 'functionPlanner' : 'logicArchitect');
      if (fallbackModelInfo) {
        logger.info({
          jobId,
          agentType,
          fallbackModelId: fallbackModelInfo.modelInfo.id
        }, `🔄 UNIFIED EXECUTOR: Attempting fallback model`);

        try {
          const { systemPrompt, userPrompt } = await getPromptForAgent(agentType, tcc, editMode);
          const schema = getSchemaForAgent(agentType);
          
          const fallbackResponse = await callModelForObject(fallbackModelInfo.modelInfo.id, {
            schema,
            prompt: userPrompt,
            systemPrompt,
            temperature: modelConfig.temperature,
            maxTokens: modelConfig.maxTokens,
            maxRetries: 2
          });

          rawModelResult = fallbackResponse.object;
          
          logger.info({
            jobId,
            agentType,
            fallbackModelId: fallbackModelInfo.modelInfo.id
          }, `✅ UNIFIED EXECUTOR: Fallback model successful`);

        } catch (fallbackError) {
          throw new Error(`Both primary and fallback models failed: ${modelError instanceof Error ? modelError.message : String(modelError)}`);
        }
      } else {
        throw modelError;
      }
    }

    // 🎯 BREAKPOINT 4: Agent module processing
    const agentResult = await executeAgent(agentType, executionContext, tcc, rawModelResult);
    
    logger.info({
      jobId,
      agentType,
      resultKeys: Object.keys(agentResult || {})
    }, `✅ UNIFIED EXECUTOR: Agent module processing completed`);

    // 🎯 BREAKPOINT 5: Validation logic
    const validationResult = validateAgentModule(agentType, agentResult.result);
    
    logger.info({
      jobId,
      agentType,
      isValid: validationResult.isValid,
      errorCount: validationResult.errors?.length || 0,
      warningCount: validationResult.warnings?.length || 0,
      overallScore: validationResult.overallScore
    }, `🔍 UNIFIED EXECUTOR: Validation completed`);

    // 🎯 BREAKPOINT 7: TCC updates (if needed)
    // Note: TCC updates would be handled by the orchestrator, not individual agent calls

    // 🎯 BREAKPOINT 8: Response formatting
    const duration = Date.now() - startTime;
    const response = {
      success: true,
      agentType,
      result: agentResult,
      validation: validationResult,
      metadata: {
        duration,
        modelId,
        provider: primaryModelInfo.provider,
        executionTime: new Date().toISOString()
      }
    };

    logger.info({
      jobId,
      agentType,
      duration,
      success: true
    }, `🎉 UNIFIED EXECUTOR: Execution completed successfully`);

    return NextResponse.json(response);

  } catch (error) {
    // 🎯 BREAKPOINT 9: Error handling
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      jobId,
      agentType,
      duration,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, `💥 UNIFIED EXECUTOR: Execution failed`);

    return NextResponse.json({
      success: false,
      agentType,
      error: errorMessage,
      metadata: {
        duration,
        executionTime: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

/**
 * Get the appropriate Zod schema for each agent type
 */
function getSchemaForAgent(agentType: AgentType): z.ZodSchema<any> {
  switch (agentType) {
    case 'function-planner':
      return z.object({
        signatures: z.array(
          z.object({
            name: z.string(),
            description: z.string()
          })
        )
      });
    
    // TODO: Add schemas for other agents when implemented
    case 'state-design':
    case 'jsx-layout':
    case 'tailwind-styling':
    case 'component-assembler':
    case 'code-validator':
    case 'tool-finalizer':
      throw new Error(`Schema not implemented yet for agent: ${agentType}`);
    
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
} 