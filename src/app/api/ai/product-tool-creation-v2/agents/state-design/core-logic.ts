import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
// TCC Store operations removed - using prop-based TCC passing
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';
import { getModelForAgent } from '@/lib/ai/model-mapping-helper';
import { getStateDesignSystemPrompt } from '@/lib/prompts/v2';

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

    // ✅ COMPREHENSIVE TCC UPDATE LOGGING 📋
    logger.info({
      jobId,
      agentName: 'StateDesign',
      tccUpdateDetail: {
        beforeStateLogic: !!tcc.stateLogic,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🎯 StateDesign: 📋 TCC STATE BEFORE UPDATE');

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

    // ✅ COMPREHENSIVE TCC UPDATE LOGGING 📋 - DETAILED OUTPUT
    logger.info({
      jobId,
      agentName: 'StateDesign',
      tccUpdateDetail: {
        afterStateLogic: !!updatedTcc.stateLogic,
        afterSteps: Object.keys(updatedTcc.steps || {}),
        afterLastUpdated: updatedTcc.updatedAt,
        stateVariablesCreated: updatedTcc.stateLogic?.variables?.map(v => ({
          name: v.name,
          type: v.type,
          initialValue: v.initialValue,
          description: v.description?.substring(0, 100) + (v.description?.length > 100 ? '...' : '')
        })) || [],
        functionsCreated: updatedTcc.stateLogic?.functions?.map(f => ({
          name: f.name,
          dependencies: f.dependencies,
          description: f.description?.substring(0, 100) + (f.description?.length > 100 ? '...' : ''),
          bodyLength: f.body?.length || 0,
          bodyPreview: f.body?.substring(0, 200) + (f.body?.length > 200 ? '...' : '') || ''
        })) || [],
        importsCreated: updatedTcc.stateLogic?.imports || [],
        stepStatusUpdate: updatedTcc.steps?.designingStateLogic?.status,
        stepResult: !!updatedTcc.steps?.designingStateLogic?.result
      }
    }, '🎯 StateDesign: 📋 TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

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
  // ✅ FIXED: Get model info properly
  const modelId = selectedModel || 'gpt-4o';
  const provider = getModelProvider(modelId);
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
  const systemPrompt = getStateDesignSystemPrompt(false); // false = creation mode (not edit)

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
 * ✅ ADDED: Generate user prompt for AI
 */
function getUserPrompt(tcc: ToolConstructionContext, functionSignatures: DefinedFunctionSignature[], editMode?: EditModeContext): string {
  const brainstormData = tcc.brainstormData;
  const isEditMode = editMode?.isEditMode || false;
  
  if (isEditMode) {
    const editInstructions = editMode?.instructions?.filter(i => i.targetAgent === 'state-design') || [];
    const editContext = editMode?.context || '';
    
    return `EDIT MODE: Modify existing state logic based on these instructions:

EDIT INSTRUCTIONS:
${editInstructions.map(inst => `- ${inst.editType.toUpperCase()}: ${inst.instructions}`).join('\n')}

EDIT CONTEXT:
${editContext}

CURRENT TOOL DATA:
Tool Type: ${brainstormData?.toolType || 'Unknown'}
Core Concept: ${brainstormData?.coreConcept || 'N/A'}

FUNCTION SIGNATURES TO IMPLEMENT:
${functionSignatures.map(f => `- ${f.name}(): ${f.description || 'No description'}`).join('\n')}

SPECIFIC REQUIREMENTS:
${brainstormData?.suggestedInputs?.map((input: any) => `- ${input.label}: ${input.type}`).join('\n') || 'No specific inputs defined'}

🚨 CRITICAL: KEY CALCULATIONS TO MAINTAIN (ALL REQUIRED):
${brainstormData?.keyCalculations?.map((calc: any) => `
- ${calc.name}: ${calc.description}
  Formula: ${calc.formula}
  Variables: ${calc.variables ? calc.variables.join(', ') : 'See formula'}
`).join('\n') || 'No key calculations defined'}

Please modify the existing state logic according to the edit instructions above.`;
  }

  return `Generate React state logic for this tool:

TOOL DETAILS:
- Tool Type: ${brainstormData?.toolType || 'Unknown'}
- Core Concept: ${brainstormData?.coreConcept || 'N/A'}
- Target Audience: ${brainstormData?.targetAudience || 'General'}

FUNCTION SIGNATURES TO IMPLEMENT:
${functionSignatures.map(f => `- ${f.name}(): ${f.description || 'No description'}`).join('\n')}

SUGGESTED INPUTS:
${brainstormData?.suggestedInputs?.map((input: any) => `- ${input.label} (${input.type}): ${input.placeholder || input.description || ''}`).join('\n') || 'No specific inputs defined'}

🚨 CRITICAL: KEY CALCULATIONS TO IMPLEMENT (ALL REQUIRED):
${brainstormData?.keyCalculations?.map((calc: any) => `
- ${calc.name}: ${calc.description}
  Formula: ${calc.formula}
  Variables: ${calc.variables ? calc.variables.join(', ') : 'See formula'}
`).join('\n') || 'No key calculations defined'}

CALCULATION LOGIC (additional context):
${brainstormData?.calculationLogic?.map((logic: any) => `- ${logic.name}: ${logic.formula}`).join('\n') || 'No additional calculation logic provided'}

🔥 ABSOLUTE REQUIREMENTS:
1. Create state variables for EVERY input field listed in suggestedInputs
2. Create state variables for EVERY calculation result listed in keyCalculations  
3. Implement COMPLETE business logic for ALL keyCalculations (NOT empty stubs)
4. Use the EXACT formulas provided in keyCalculations
5. Include proper error handling and validation
6. Follow React hooks patterns (useState, useEffect)
7. ENSURE ALL keyCalculations have corresponding state variables and functions

🚨 FAILURE TO IMPLEMENT ANY keyCalculation = INCOMPLETE TOOL!

Generate complete, working state logic that implements ALL business requirements of this ${brainstormData?.toolType || 'tool'}.`;
} 