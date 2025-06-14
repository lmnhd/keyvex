import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
// TCC Store operations removed - using prop-based TCC passing
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
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
  // Model selection logic (same pattern as JSX agent)
  let modelConfig: { provider: string; modelId: string };
  let actualModelName: string;

  if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      modelConfig = { provider, modelId: selectedModel };
      actualModelName = selectedModel;
    } else {
      const primaryModel = getPrimaryModel('toolCreator');
      modelConfig = primaryModel && 'modelInfo' in primaryModel ? 
        { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } :
        { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = modelConfig.modelId;
    }
  } else {
    try {
      const primaryModel = getPrimaryModel('toolCreator');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
      } else {
        const fallbackModel = getFallbackModel('toolCreator');
        modelConfig = fallbackModel && 'modelInfo' in fallbackModel ?
          { provider: fallbackModel.provider, modelId: fallbackModel.modelInfo.id } :
          { provider: 'openai', modelId: 'gpt-4o' };
        actualModelName = modelConfig.modelId;
      }
    } catch (error) {
      modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = 'gpt-4o';
    }
  }

  console.log('🎯 StateDesign: ==================== MODEL SELECTION ====================');
  console.log('🎯 StateDesign: Model selection details:', {
    originalSelectedModel: selectedModel || 'none',
    finalProvider: modelConfig.provider,
    finalModelId: modelConfig.modelId,
    actualModelName,
    timestamp: new Date().toISOString()
  });

  logger.info({ provider: modelConfig.provider, modelName: actualModelName }, '🎯 StateDesign: Using model');

  console.log('🎯 StateDesign: Creating model instance...');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);
  console.log('🎯 StateDesign: ✅ Model instance created successfully');

  // 🚨 FIX: Import and use proper prompt from v2 directory
  const { getStateDesignSystemPrompt } = await import('@/lib/prompts/v2/state-design-prompt');
  const systemPrompt = getStateDesignSystemPrompt(!!editMode?.isEditMode);
  
  // 🚨 FIX: Use brainstorm data for tool description instead of fallback
  let toolDescription = tcc.userInput?.description;
  if (!toolDescription && tcc.brainstormData) {
    const brainstorm = tcc.brainstormData;
    toolDescription = `${brainstorm.coreConcept || brainstorm.coreWConcept || 'Business Tool'}: ${brainstorm.valueProposition || 'A tool to help users make informed decisions.'}`;
  }
  
  let userPrompt = `Tool: ${toolDescription || 'Business calculation tool'}
Target Audience: ${tcc.targetAudience || 'General users'}

Function Signatures to Implement:
${(tcc.definedFunctionSignatures || tcc.functionSignatures)?.map(sig => `- ${sig.name}: ${sig.description}`).join('\n') || 'None'}`;

  // Phase 1: Inject rich brainstorm context for enhanced state design
  if (tcc.brainstormData) {
    const brainstorm = tcc.brainstormData;
    
    // 🔍 DEBUG: Log brainstorm data structure for debugging
    logger.info({ 
      jobId: tcc.jobId,
      hasBrainstormData: !!tcc.brainstormData,
      brainstormDataKeys: tcc.brainstormData ? Object.keys(tcc.brainstormData) : [],
      brainstormDataSize: tcc.brainstormData ? JSON.stringify(tcc.brainstormData).length : 0
    }, '🎯 StateDesign: [BRAINSTORM DEBUG] Available brainstorm data structure');

    logger.info({ 
      jobId: tcc.jobId,
      coreConcept: brainstorm.coreConcept || brainstorm.coreWConcept || 'Not specified',
      valueProposition: brainstorm.valueProposition || 'Not specified',
      suggestedInputsCount: brainstorm.suggestedInputs?.length || 0,
      keyCalculationsCount: brainstorm.keyCalculations?.length || 0,
      calculationLogicCount: brainstorm.calculationLogic?.length || 0,
      interactionFlowCount: brainstorm.interactionFlow?.length || 0,
      hasLeadCaptureStrategy: !!brainstorm.leadCaptureStrategy
    }, '🎯 StateDesign: [BRAINSTORM DEBUG] Detailed brainstorm data analysis');

    // Log specific brainstorm fields for debugging
    if (brainstorm.suggestedInputs && brainstorm.suggestedInputs.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        suggestedInputs: brainstorm.suggestedInputs.map(input => ({
          label: input.label,
          type: input.type,
          description: input.description?.substring(0, 100) + (input.description?.length > 100 ? '...' : '')
        }))
      }, '🎯 StateDesign: [BRAINSTORM DEBUG] Suggested inputs detail');
    }

    if (brainstorm.keyCalculations && brainstorm.keyCalculations.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        keyCalculations: brainstorm.keyCalculations.map(calc => ({
          name: calc.name,
          formula: calc.formula?.substring(0, 100) + (calc.formula?.length > 100 ? '...' : ''),
          description: calc.description?.substring(0, 100) + (calc.description?.length > 100 ? '...' : '')
        }))
      }, '🎯 StateDesign: [BRAINSTORM DEBUG] Key calculations detail');
    }

    if (brainstorm.calculationLogic && brainstorm.calculationLogic.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        calculationLogic: brainstorm.calculationLogic.map(logic => ({
          name: logic.name,
          formula: logic.formula?.substring(0, 100) + (logic.formula?.length > 100 ? '...' : '')
        }))
      }, '🎯 StateDesign: [BRAINSTORM DEBUG] Calculation logic detail');
    }
    
    userPrompt += `

🚨 MANDATORY IMPLEMENTATION REQUIREMENTS:

CORE CONCEPT: ${brainstorm.coreConcept || brainstorm.coreWConcept || 'Not specified'}

VALUE PROPOSITION: ${brainstorm.valueProposition || 'Not specified'}`;

    // Add suggested inputs for state variable structure with ENFORCEMENT
    if (brainstorm.suggestedInputs && brainstorm.suggestedInputs.length > 0) {
      userPrompt += `

🚨 REQUIRED INPUT FIELDS - YOU MUST CREATE STATE VARIABLES FOR EACH:`;
      brainstorm.suggestedInputs.forEach((input, index) => {
        const stateVarName = input.id || input.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        userPrompt += `\n${index + 1}. const [${stateVarName}, set${stateVarName.charAt(0).toUpperCase() + stateVarName.slice(1)}] = useState('');`;
        userPrompt += `\n   Label: "${input.label}" | Type: ${input.type} | Description: ${input.description}`;
      });
      
      userPrompt += `\n\n🚨 CRITICAL: Create exactly ${brainstorm.suggestedInputs.length} input state variables as shown above. Do NOT create a single generic "input" field.`;
    }

    // Add key calculations with ENFORCEMENT
    if (brainstorm.keyCalculations && brainstorm.keyCalculations.length > 0) {
      userPrompt += `

🚨 REQUIRED CALCULATIONS - YOU MUST IMPLEMENT THESE EXACT FORMULAS:`;
      brainstorm.keyCalculations.forEach((calc, index) => {
        userPrompt += `\n${index + 1}. ${calc.name}`;
        userPrompt += `\n   Formula: ${calc.formula}`;
        userPrompt += `\n   Description: ${calc.description}`;
        userPrompt += `\n   Variables: ${calc.variables ? calc.variables.join(', ') : 'Not specified'}`;
      });
    }

    // Add calculation logic with SPECIFIC IMPLEMENTATION REQUIREMENTS
    if (brainstorm.calculationLogic && brainstorm.calculationLogic.length > 0) {
      userPrompt += `

🚨 EXACT FORMULAS TO IMPLEMENT - NO SUBSTITUTIONS ALLOWED:`;
      brainstorm.calculationLogic.forEach((logic, index) => {
        userPrompt += `\n${index + 1}. ${logic.name}: ${logic.formula}`;
        
        // Convert calculation logic to specific implementation instructions
        const formula = logic.formula.toLowerCase();
        if (formula.includes('/')) {
          userPrompt += `\n   🚨 DIVISION DETECTED: Check denominator is not zero before calculating`;
        }
        if (formula.includes('*') && formula.includes('100')) {
          userPrompt += `\n   🚨 PERCENTAGE DETECTED: Multiply by 100 to get percentage`;
        }
        if (formula.includes('current_assets') || formula.includes('currentassets')) {
          userPrompt += `\n   🚨 FINANCIAL RATIO: Use currentAssets state variable`;
        }
      });
      
      userPrompt += `\n\n🚨 CRITICAL: Implement these EXACT formulas. Do NOT use generic calculations like "numericValue * 2". Each function must implement its specific business logic.`;
    }

    logger.info({ 
      jobId: tcc.jobId,
      promptLength: userPrompt.length,
      brainstormContextAdded: true
    }, '🎯 StateDesign: [BRAINSTORM DEBUG] Brainstorm context successfully added to prompt');
  } else {
    logger.warn({ 
      jobId: tcc.jobId,
      userInputDescription: tcc.userInput?.description?.substring(0, 100) + '...',
      toolType: tcc.userInput?.toolType || 'Not specified',
      targetAudience: tcc.targetAudience || 'Not specified'
    }, '🎯 StateDesign: [BRAINSTORM DEBUG] ⚠️ NO BRAINSTORM DATA - Agent working with minimal context only');
  }

  // Phase 2: Add edit mode context if in edit mode
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    userPrompt += `

🔄 EDIT MODE INSTRUCTIONS:
You are EDITING existing state logic. Here is the current state:

CURRENT STATE VARIABLES:
${tcc.stateLogic?.variables?.map(v => `- ${v.name} (${v.type}): ${v.description}`).join('\n') || 'No existing state variables'}

CURRENT FUNCTIONS:
${tcc.stateLogic?.functions?.map(f => `- ${f.name}: ${f.description}`).join('\n') || 'No existing functions'}

EDIT INSTRUCTIONS TO FOLLOW:`;

    editMode.instructions.forEach((instruction, index) => {
      userPrompt += `

${index + 1}. ${instruction.editType.toUpperCase()} REQUEST (${instruction.priority} priority):
${instruction.instructions}

Created: ${instruction.createdAt}`;
    });

    userPrompt += `

Please apply these edit instructions to improve the state logic. Maintain existing functionality where appropriate but implement the requested changes.`;
  }

userPrompt += `

Design React state variables and function implementations for this tool.

🔧 TYPE SAFETY REQUIREMENTS:
- Keep all input states as strings (for form controls)
- Convert to numbers only during calculations/validation
- Never store NaN, undefined, or mixed types in state
- Use proper default values ('', null, 0, false)
- Validate inputs before any calculations

FUNCTION SIGNATURES TO IMPLEMENT:
${(tcc.definedFunctionSignatures || tcc.functionSignatures)?.map(sig => {
  const safeName = sig.name.toLowerCase();
  let guidance = '';
  
  // Add specific guidance based on function type
  if (safeName.includes('calculate') || safeName.includes('compute')) {
    guidance = ' [CALCULATION: Validate inputs, handle NaN, store safe results]';
  } else if (safeName.includes('input') || safeName.includes('change')) {
    guidance = ' [INPUT: Keep as string, validate format]';
  } else if (safeName.includes('reset') || safeName.includes('clear')) {
    guidance = ' [RESET: Return to safe initial values]';
  } else if (safeName.includes('format') || safeName.includes('display')) {
    guidance = ' [FORMAT: Handle null/undefined gracefully]';
  }
  
  return `- ${sig.name}: ${sig.description}${guidance}`;
}).join('\n') || 'None'}`;

  logger.info({ modelId: modelConfig.modelId, promptLength: userPrompt.length }, '🎯 StateDesign: Calling AI');

  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
    maxTokens: 2000
  });

  if (!content) throw new Error('No response from AI model');

  // AI FIRST: Parse the response
  return parseStateResponse(content, tcc.definedFunctionSignatures || tcc.functionSignatures || [], tcc.brainstormData);
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