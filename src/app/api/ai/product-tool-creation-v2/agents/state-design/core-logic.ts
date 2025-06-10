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

  const systemPrompt = `You are a React state design specialist. Create state variables and functions for a React component.

CRITICAL: Generate ONLY state logic - NO JSX or HTML.
Design TypeScript interfaces, useState hooks, and function implementations.
Use modern React patterns and proper error handling.

🚨 CRITICAL TYPE CONSISTENCY RULES:
1. INPUT STATE: Always keep input fields as strings for form control
2. CALCULATIONS: Convert strings to numbers ONLY when doing calculations
3. VALIDATION: Check for NaN and invalid values BEFORE calculations
4. RESULTS: Never store NaN values - use null or proper defaults instead
5. MIXED TYPES: Avoid states that mix string/number types

EXAMPLE CORRECT PATTERN:
const [input, setInput] = useState(''); // Always string for input
const handleCalculate = () => {
  const numericValue = Number(input);
  if (isNaN(numericValue) || numericValue < 0) {
    setError('Invalid input');
    return;
  }
  const result = numericValue * factor; // Safe calculation
  setResult(result); // Never stores NaN
};

Return structured JSON with:
{
  "stateVariables": [{"name": "...", "type": "...", "initialValue": "...", "description": "..."}],
  "functions": [{"name": "...", "parameters": ["..."], "logic": "...", "description": "..."}],
  "imports": ["..."],
  "hooks": ["..."]
}`;

  let userPrompt = `Tool: ${tcc.userInput?.description || 'No description provided.'}
Target Audience: ${tcc.targetAudience || 'General users'}

Function Signatures to Implement:
${(tcc.definedFunctionSignatures || tcc.functionSignatures)?.map(sig => `- ${sig.name}: ${sig.description}`).join('\n') || 'None'}`;

  // Phase 1: Inject rich brainstorm context for enhanced state design
  if (tcc.brainstormData) {
    const brainstorm = tcc.brainstormData;
    
    userPrompt += `

DETAILED BRAINSTORM CONTEXT (Use this to design appropriate state management):

CORE CONCEPT: ${brainstorm.coreConcept || brainstorm.coreWConcept || 'Not specified'}

VALUE PROPOSITION: ${brainstorm.valueProposition || 'Not specified'}`;

    // Add suggested inputs for state variable structure
    if (brainstorm.suggestedInputs && brainstorm.suggestedInputs.length > 0) {
      userPrompt += `

SUGGESTED INPUT FIELDS (Design state variables to capture these inputs):`;
      brainstorm.suggestedInputs.forEach(input => {
        userPrompt += `\n- ${input.label} (${input.type}): ${input.description}`;
      });
    }

    // Add key calculations for state and function design
    if (brainstorm.keyCalculations && brainstorm.keyCalculations.length > 0) {
      userPrompt += `

KEY CALCULATIONS (Design state management to support these calculations):`;
      brainstorm.keyCalculations.forEach(calc => {
        userPrompt += `\n- ${calc.name}: ${calc.description}`;
      });
    }

    // Add calculation logic for implementation guidance
    if (brainstorm.calculationLogic && brainstorm.calculationLogic.length > 0) {
      userPrompt += `

CALCULATION LOGIC (Implement these specific formulas in state functions):`;
      brainstorm.calculationLogic.forEach(logic => {
        userPrompt += `\n- ${logic.name}: ${logic.formula}`;
      });
    }
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
  return parseStateResponse(content, tcc.definedFunctionSignatures || tcc.functionSignatures || []);
}

/**
 * AI FIRST: Parse AI response for state logic
 */
function parseStateResponse(content: string, functionSignatures: DefinedFunctionSignature[]) {
  // Try to extract JSON from AI response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                   content.match(/\{[\s\S]*"stateVariables"[\s\S]*\}/);
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      logger.info({ hasStateVariables: !!parsed.stateVariables, hasFunctions: !!parsed.functions }, '🎯 StateDesign: AI FIRST - Using AI JSON');
      
      return {
        stateVariables: parsed.stateVariables || generateDefaultStateVariables(functionSignatures),
        functions: parsed.functions || generateDefaultFunctions(functionSignatures),
        imports: parsed.imports || ["import React, { useState, useEffect } from 'react';"],
        hooks: parsed.hooks || ['useState', 'useEffect']
      };
    } catch (parseError) {
      logger.warn({ parseError: parseError instanceof Error ? parseError.message : String(parseError) }, '🎯 StateDesign: Failed to parse AI JSON');
    }
  }

  // Fallback: Generate basic structure
  logger.warn('🎯 StateDesign: No AI JSON found, using fallback');
  return {
    stateVariables: generateDefaultStateVariables(functionSignatures),
    functions: generateDefaultFunctions(functionSignatures),
    imports: ["import React, { useState, useEffect } from 'react';"],
    hooks: ['useState', 'useEffect']
  };
}

/**
 * Generate default state variables when AI parsing fails
 * Updated to follow safe typing patterns that prevent NaN and mixed-type issues
 */
function generateDefaultStateVariables(functionSignatures: DefinedFunctionSignature[]) {
  return [
    { name: 'input', type: 'string', initialValue: "''", description: 'Primary input field (always string for form control)' },
    { name: 'result', type: 'number | null', initialValue: 'null', description: 'Calculation result (null when no calculation)' },
    { name: 'error', type: 'string | null', initialValue: 'null', description: 'Current error message' },
    { name: 'isLoading', type: 'boolean', initialValue: 'false', description: 'Loading state indicator' }
  ];
}

/**
 * Generate default functions when AI parsing fails
 * Updated to follow safe type handling patterns
 */
function generateDefaultFunctions(functionSignatures: DefinedFunctionSignature[]) {
  return functionSignatures.map(sig => {
    const safeName = sig.name.toLowerCase();
    let logic = '';
    
    if (safeName.includes('calculate') || safeName.includes('compute')) {
      logic = `
  // Safe calculation pattern
  const numericValue = Number(input);
  if (input === '' || isNaN(numericValue) || numericValue < 0) {
    setError('Please enter a valid positive number');
    setResult(null);
    return;
  }
  
  setError(null);
  setIsLoading(true);
  try {
    // TODO: Implement ${sig.description || sig.name}
    const calculationResult = numericValue * 2; // Example calculation
    setResult(calculationResult); // Safe - never NaN
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Calculation failed');
    setResult(null);
  } finally {
    setIsLoading(false);
  }`;
    } else if (safeName.includes('input') || safeName.includes('change')) {
      logic = `
  // Safe input handling - always store as string
  const value = event.target.value;
  setInput(value); // Keep as string for form control
  setError(null); // Clear previous errors`;
    } else if (safeName.includes('reset') || safeName.includes('clear')) {
      logic = `
  // Safe reset - return to initial safe values
  setInput('');
  setResult(null);
  setError(null);
  setIsLoading(false);`;
    } else if (safeName.includes('format') || safeName.includes('display')) {
      logic = `
  // Safe formatting - handle null/undefined gracefully
  if (result === null || result === undefined) return '';
  if (typeof result !== 'number' || isNaN(result)) return '';
  return result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });`;
    } else {
      logic = `
  setIsLoading(true);
  try {
    // TODO: Implement ${sig.description || sig.name}
    console.log('${sig.name} called');
    // Add safe implementation here
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Error occurred');
  } finally {
    setIsLoading(false);
  }`;
    }

    return {
      name: sig.name,
      parameters: safeName.includes('input') || safeName.includes('change') ? ['event: React.ChangeEvent<HTMLInputElement>'] : ['...args: any[]'],
      logic,
      description: sig.description || `Handler for ${sig.name}`
    };
  });
} 