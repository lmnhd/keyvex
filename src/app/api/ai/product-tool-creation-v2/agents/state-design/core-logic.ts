import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
// TCC Store operations removed - using prop-based TCC passing
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Enhanced testing options for granular control
export type TestingOptions = {
  enableWebSocketStreaming?: boolean;    // Test progress emissions
  enableTccOperations?: boolean;         // Test TCC store operations  
  enableOrchestrationTriggers?: boolean; // Test agent coordination
};

// Input schema
const StateDesignRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  mockTcc: z.custom<Partial<ToolConstructionContext>>().optional(), // For testing purposes - properly typed
  testingOptions: z.object({
    enableWebSocketStreaming: z.boolean().optional(),
    enableTccOperations: z.boolean().optional(),
    enableOrchestrationTriggers: z.boolean().optional()
  }).optional()
});

export type StateDesignRequest = z.infer<typeof StateDesignRequestSchema>;

// Proper type definitions for state logic components
export type StateVariable = {
  name: string;
  type: string;
  initialValue: string;
  description: string;
};

export type StateFunction = {
  name: string;
  parameters: string[];
  logic: string;
  description: string;
};

export type TccStateVariable = {
  name: string;
  type: string;
  initialValue: string;
  description: string;
};

export type TccStateFunction = {
  name: string;
  body: string;
  description: string;
  dependencies: string[];
};

export type StateLogicResult = {
  stateVariables: StateVariable[];
  functions: StateFunction[];
  imports: string[];
  hooks: string[];
};

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

// 🚨 FIX: Added proper Zod schema for AI output (like Component Assembler)
const StateVariableSchema = z.object({
  name: z.string().describe('Variable name in camelCase'),
  type: z.string().describe('TypeScript type (string, number, boolean, etc.)'),
  defaultValue: z.any().describe('Initial value for useState'),
  description: z.string().describe('Purpose of this variable')
});

const StateFunctionSchema = z.object({
  name: z.string().describe('Function name in camelCase'),
  logic: z.array(z.string()).describe('Array of JavaScript code lines for the function body')
});

const StateDesignOutputSchema = z.object({
  variables: z.array(StateVariableSchema).describe('React state variables with useState'),
  functions: z.array(StateFunctionSchema).describe('Business logic functions with actual implementation')
});

export type StateDesignOutput = z.infer<typeof StateDesignOutputSchema>;

/**
 * State Design Agent - Generates React state logic from AI.
 * This function is a pure, testable unit of logic that takes a TCC,
 * performs state design, and returns an updated TCC without side effects.
 */
// Phase 2: Edit mode context type
type EditModeContext = {
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

export async function designStateLogic(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
  editMode?: EditModeContext;
}): Promise<{
  success: boolean;
  stateLogic?: StateLogicResult;
  error?: string;
  updatedTcc?: ToolConstructionContext; // Return the updated TCC
  }> {
  const { jobId, selectedModel, editMode } = request;
  const tcc = request.mockTcc || request.tcc;
  
  // Phase 2: Edit mode detection
  const isEditMode = editMode?.isEditMode || false;
  const editInstructions = editMode?.instructions || [];

  logger.info({ jobId }, '🎯 StateDesign: Starting state logic design');

  try {
    if (!tcc) {
      throw new Error(
        `A valid TCC object was not provided for jobId: ${jobId}`,
      );
    }

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'in_progress',
      'Designing state logic and functions...',
      tcc // Pass TCC with userId
    );

    logger.info({ jobId }, '🎯 StateDesign: Calling AI to generate state logic...');
    const stateLogic = await generateStateLogic(tcc, selectedModel, editMode);
    logger.info({ jobId }, '🎯 StateDesign: AI generated state logic successfully');

    // Convert to TCC-compatible format
    const tccCompatibleStateLogic = {
      variables: stateLogic.stateVariables.map(
        (v: StateVariable): TccStateVariable => ({
          name: v.name,
          type: v.type,
          initialValue: v.initialValue,
          description: v.description,
        }),
      ),
      functions: stateLogic.functions.map(
        (f: StateFunction): TccStateFunction => ({
          name: f.name,
          body: f.logic,
          description: f.description,
          dependencies: f.parameters,
        }),
      ),
      imports: stateLogic.imports,
    };

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      stateLogic: tccCompatibleStateLogic,
      steps: {
        ...tcc.steps,
        designingStateLogic: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt:
            tcc.steps?.designingStateLogic?.startedAt ||
            new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: stateLogic,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    logger.info(
      {
        jobId,
        updateData: {
          stateVariableCount: updatedTcc.stateLogic?.variables?.length,
          functionCount: updatedTcc.stateLogic?.functions?.length,
        },
      },
      '🎯 StateDesign: TCC update prepared',
    );

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'completed',
      `Successfully designed ${updatedTcc.stateLogic?.variables?.length || 0} state variables and ${updatedTcc.stateLogic?.functions?.length || 0} functions.`,
      updatedTcc // Pass updated TCC with userId
    );

    return { success: true, stateLogic, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🎯 StateDesign: Error');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'failed',
      errorMessage,
      tcc // Pass TCC with userId even on failure
    );
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate state logic using AI
 */
async function generateStateLogic(tcc: ToolConstructionContext, selectedModel?: string, editMode?: EditModeContext): Promise<StateLogicResult> {
  const { provider, modelId } = getModelForAgent('state-design', selectedModel, tcc);
  const functionSignatures = tcc.functionSignatures || [];

  logger.info({ 
    jobId: tcc.jobId, 
    functionSignatureCount: functionSignatures.length,
    provider, 
    modelId 
  }, '🎯 StateDesign: Generating state logic with AI');

  // ✅ AI FIRST APPROACH: Generate state logic from AI (no fallbacks!)
  const modelInstance = createModelInstance(provider, modelId);
  
  const userPrompt = getUserPrompt(tcc, functionSignatures, editMode);

  // Get the enhanced system prompt from the v2 prompts directory  
  const systemPrompt = getStateDesignSystemPrompt();

  // ✅ FIXED: Using generateObject with proper schema validation! 🎯
  const { object } = await generateObject({
    model: modelInstance,
    schema: StateDesignOutputSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
    maxTokens: 2000
  });

  // ✅ AI FIRST: Direct object access - NO PARSING NEEDED!
  logger.info({ 
    jobId: tcc.jobId, 
    provider, 
    modelId,
    variableCount: object.variables.length,
    functionCount: object.functions.length
  }, '🎯 StateDesign: ✅ Successfully received structured object from AI');

  // Convert to expected format
  const stateVariables = object.variables.map(v => ({
    name: v.name,
    type: v.type,
    initialValue: String(v.defaultValue),
    description: v.description
  }));

  const functions = object.functions.map(f => ({
    name: f.name,
    parameters: [], // Can be extracted from logic if needed
    logic: f.logic.join('\n'),
    description: `Function: ${f.name}`
  }));

  return {
    stateVariables,
    functions,
    imports: ["import React, { useState, useEffect } from 'react';"],
    hooks: ['useState', 'useEffect']
  };
}

/**
 * AI FIRST: Parse AI response for state logic
 */
function parseStateResponse(content: string, functionSignatures: DefinedFunctionSignature[], brainstormData?: any) {
  // Debug: Log the actual AI response for troubleshooting
  logger.info({ 
    contentLength: content.length,
    contentPreview: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
    hasJsonBlock: content.includes('```json'),
    hasVariables: content.includes('"variables"') || content.includes('"stateVariables"')
  }, '🎯 StateDesign: [DEBUG] Raw AI response analysis');

  // 🚨 FIXED: Corrected regex patterns (removed double escaping)
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                   content.match(/\{[\s\S]*"variables"[\s\S]*\}/) ||
                   content.match(/\{[\s\S]*"stateVariables"[\s\S]*\}/);
  
  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      
      // Debug: Log the extracted JSON string
      logger.info({ 
        jsonStrLength: jsonStr.length,
        jsonStrPreview: jsonStr.substring(0, 300) + (jsonStr.length > 300 ? '...' : '')
      }, '🎯 StateDesign: [DEBUG] Extracted JSON string');
      
      const parsed = JSON.parse(jsonStr);
      
      // ✅ AI SUCCESS: Use the AI-generated JSON
      logger.info({ 
        hasVariables: !!(parsed.variables || parsed.stateVariables), 
        hasFunctions: !!parsed.functions,
        variableCount: (parsed.variables || parsed.stateVariables || []).length,
        functionCount: (parsed.functions || []).length
      }, '🎯 StateDesign: ✅ AI SUCCESS - Using AI-generated JSON');
      
      return {
        stateVariables: parsed.variables || parsed.stateVariables || [],
        functions: parsed.functions || [],
        imports: parsed.imports || ["import React, { useState, useEffect } from 'react';"],
        hooks: parsed.hooks || ['useState', 'useEffect']
      };
    } catch (parseError) {
      logger.error({ 
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        jsonPreview: (jsonMatch[1] || jsonMatch[0])?.substring(0, 200) + '...'
      }, '🚨 StateDesign: JSON parsing failed - AI generated invalid JSON');
    }
  } else {
    // Log when no JSON pattern is found
    logger.error({ 
      contentHasJson: content.includes('json'),
      contentHasBraces: content.includes('{') && content.includes('}'),
      firstBraceIndex: content.indexOf('{'),
      lastBraceIndex: content.lastIndexOf('}')
    }, '🚨 StateDesign: No JSON pattern matched in AI response');
  }

  // 🚨 NO FALLBACKS! - Fail cleanly if AI doesn't generate proper JSON
  logger.error('🚨 StateDesign: CRITICAL - AI failed to generate proper JSON response. NO FALLBACKS ALLOWED!');
  throw new Error('State Design Agent failed to generate proper JSON response. AI must provide valid state logic - no fallbacks allowed.');
} 