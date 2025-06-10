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

🚨 CRITICAL MISSION: You MUST implement the EXACT calculations and inputs specified in the brainstorm data. 
DO NOT create generic placeholders. DO NOT use generic formulas like "numericValue * 2".

CRITICAL: Generate ONLY state logic - NO JSX or HTML.
Design TypeScript interfaces, useState hooks, and function implementations.
Use modern React patterns and proper error handling.

🚨 MANDATORY REQUIREMENTS:
1. IMPLEMENT EXACT FORMULAS: Use the precise mathematical formulas provided in CALCULATION LOGIC
2. MULTI-INPUT SUPPORT: Create separate state variables for each input field specified  
3. SPECIFIC VALIDATION: Validate each input according to its business context
4. ACTUAL BUSINESS LOGIC: No generic calculations - implement real business rules
5. DESCRIPTIVE RESULTS: Calculate and display meaningful business insights

🔢 FORMULA IMPLEMENTATION RULES:
- Liquidity Ratio = currentAssets / currentLiabilities
- Profit Margin = (netIncome / revenue) * 100  
- Debt to Equity = totalLiabilities / shareholdersEquity
- ROI = (gain - cost) / cost * 100
- Quick Ratio = (currentAssets - inventory) / currentLiabilities

🚨 TYPE SAFETY RULES:
1. INPUT STATE: Always keep input fields as strings for form control
2. CALCULATIONS: Convert strings to numbers ONLY when doing calculations
3. VALIDATION: Check for NaN and invalid values BEFORE calculations
4. RESULTS: Never store NaN values - use null or proper defaults instead
5. DIVISION BY ZERO: Always check denominators before dividing

EXAMPLE CORRECT FINANCIAL IMPLEMENTATION:
\`\`\`typescript
const [currentAssets, setCurrentAssets] = useState('');
const [currentLiabilities, setCurrentLiabilities] = useState('');
const [liquidityRatio, setLiquidityRatio] = useState<number | null>(null);

const handleCalculateLiquidityRatio = () => {
  const assets = Number(currentAssets);
  const liabilities = Number(currentLiabilities);
  
  if (isNaN(assets) || isNaN(liabilities) || assets < 0 || liabilities <= 0) {
    setError('Please enter valid positive numbers for assets and liabilities');
    setLiquidityRatio(null);
    return;
  }
  
  const ratio = assets / liabilities; // SPECIFIC FORMULA - NOT numericValue * 2
  setLiquidityRatio(ratio);
  setError(null);
};
\`\`\`

❌ WRONG - GENERIC PLACEHOLDER:
const result = numericValue * 2; // NEVER DO THIS

✅ RIGHT - SPECIFIC BUSINESS FORMULA:  
const liquidityRatio = currentAssets / currentLiabilities; // ALWAYS DO THIS

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
 * Updated to create specific financial input variables instead of generic ones
 */
function generateDefaultStateVariables(functionSignatures: DefinedFunctionSignature[]) {
  // Base financial state variables for a comprehensive business health calculator
  const baseVars = [
    { name: 'currentAssets', type: 'string', initialValue: "''", description: 'Current assets input (string for form control)' },
    { name: 'currentLiabilities', type: 'string', initialValue: "''", description: 'Current liabilities input (string for form control)' },
    { name: 'netIncome', type: 'string', initialValue: "''", description: 'Net income input (string for form control)' },
    { name: 'revenue', type: 'string', initialValue: "''", description: 'Revenue input (string for form control)' },
    { name: 'totalLiabilities', type: 'string', initialValue: "''", description: 'Total liabilities input (string for form control)' },
    { name: 'shareholdersEquity', type: 'string', initialValue: "''", description: 'Shareholders equity input (string for form control)' },
    
    // Result state variables
    { name: 'liquidityRatio', type: 'number | null', initialValue: 'null', description: 'Calculated liquidity ratio result' },
    { name: 'profitMargin', type: 'number | null', initialValue: 'null', description: 'Calculated profit margin result' },
    { name: 'debtToEquityRatio', type: 'number | null', initialValue: 'null', description: 'Calculated debt to equity ratio result' },
    
    // Control state variables
    { name: 'error', type: 'string | null', initialValue: 'null', description: 'Current error message' },
    { name: 'isLoading', type: 'boolean', initialValue: 'false', description: 'Loading state indicator' }
  ];

  // Add generic fallback if no specific financial functions are detected
  const functionNames = functionSignatures.map(sig => sig.name.toLowerCase()).join(' ');
  const hasFinancialFunctions = functionNames.includes('liquidity') || 
                                functionNames.includes('profit') || 
                                functionNames.includes('debt') ||
                                functionNames.includes('ratio') ||
                                functionNames.includes('margin');

  if (!hasFinancialFunctions) {
    // Fallback to simpler structure for non-financial tools
    return [
      { name: 'input', type: 'string', initialValue: "''", description: 'Primary input field (always string for form control)' },
      { name: 'result', type: 'number | null', initialValue: 'null', description: 'Calculation result (null when no calculation)' },
      { name: 'error', type: 'string | null', initialValue: 'null', description: 'Current error message' },
      { name: 'isLoading', type: 'boolean', initialValue: 'false', description: 'Loading state indicator' }
    ];
  }

  return baseVars;
}

/**
 * Generate default functions when AI parsing fails
 * Updated to create specific implementations based on function names and business context
 */
function generateDefaultFunctions(functionSignatures: DefinedFunctionSignature[]) {
  return functionSignatures.map(sig => {
    const safeName = sig.name.toLowerCase();
    let logic = '';
    
    // Financial calculation patterns
    if (safeName.includes('liquidity') && safeName.includes('ratio')) {
      logic = `
  // Liquidity Ratio = Current Assets / Current Liabilities
  const assets = Number(currentAssets);
  const liabilities = Number(currentLiabilities);
  if (currentAssets === '' || currentLiabilities === '' || isNaN(assets) || isNaN(liabilities) || assets < 0 || liabilities <= 0) {
    setError('Please enter valid positive numbers for current assets and current liabilities');
    setLiquidityRatio(null);
    return;
  }
  setError(null);
  setIsLoading(true);
  try {
    const ratio = assets / liabilities;
    setLiquidityRatio(ratio);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Calculation failed');
    setLiquidityRatio(null);
  } finally {
    setIsLoading(false);
  }`;
    } else if (safeName.includes('profit') && safeName.includes('margin')) {
      logic = `
  // Profit Margin = (Net Income / Revenue) * 100
  const income = Number(netIncome);
  const revenue = Number(revenue);
  if (netIncome === '' || revenue === '' || isNaN(income) || isNaN(revenue) || revenue <= 0) {
    setError('Please enter valid numbers for net income and revenue (revenue must be positive)');
    setProfitMargin(null);
    return;
  }
  setError(null);
  setIsLoading(true);
  try {
    const margin = (income / revenue) * 100;
    setProfitMargin(margin);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Calculation failed');
    setProfitMargin(null);
  } finally {
    setIsLoading(false);
  }`;
    } else if (safeName.includes('debt') && (safeName.includes('equity') || safeName.includes('ratio'))) {
      logic = `
  // Debt to Equity Ratio = Total Liabilities / Shareholders' Equity
  const liabilities = Number(totalLiabilities);
  const equity = Number(shareholdersEquity);
  if (totalLiabilities === '' || shareholdersEquity === '' || isNaN(liabilities) || isNaN(equity) || liabilities < 0 || equity <= 0) {
    setError('Please enter valid positive numbers for total liabilities and shareholders equity');
    setDebtToEquityRatio(null);
    return;
  }
  setError(null);
  setIsLoading(true);
  try {
    const ratio = liabilities / equity;
    setDebtToEquityRatio(ratio);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Calculation failed');
    setDebtToEquityRatio(null);
  } finally {
    setIsLoading(false);
  }`;
    } else if (safeName.includes('calculate') || safeName.includes('compute')) {
      // Generic calculation pattern for other calculations
      logic = `
  setError(null);
  setIsLoading(true);
  try {
    console.log('${sig.name} called');
    // TODO: Implement specific ${sig.description || sig.name} calculation
    // This should be replaced with actual business logic based on the tool requirements
    setError('This calculation is not yet implemented');
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Calculation failed');
  } finally {
    setIsLoading(false);
  }`;
    } else if (safeName.includes('input') || safeName.includes('change')) {
      // Determine which input field this handles based on the function name
      const inputFieldName = safeName.includes('assets') ? 'Assets' :
                            safeName.includes('liabilities') ? 'Liabilities' :
                            safeName.includes('income') ? 'Income' :
                            safeName.includes('revenue') ? 'Revenue' :
                            safeName.includes('equity') ? 'Equity' : 'Input';
                            
      logic = `
  // Safe input handling for ${inputFieldName} - always store as string
  const value = event.target.value;
  setInput(value); // Keep as string for form control
  setError(null); // Clear previous errors`;
    } else if (safeName.includes('reset') || safeName.includes('clear')) {
      logic = `
  // Safe reset - return to initial safe values for all financial inputs
  setCurrentAssets('');
  setCurrentLiabilities('');
  setNetIncome('');
  setRevenue('');
  setTotalLiabilities('');
  setShareholdersEquity('');
  setLiquidityRatio(null);
  setProfitMargin(null);
  setDebtToEquityRatio(null);
  setError(null);
  setIsLoading(false);`;
    } else if (safeName.includes('format') || safeName.includes('display')) {
      logic = `
  // Safe formatting for financial results - handle null/undefined gracefully
  if (result === null || result === undefined) return 'No calculation performed';
  if (typeof result !== 'number' || isNaN(result)) return 'Invalid result';
  
  // Format based on the type of financial metric
  if (Math.abs(result) < 1) {
    return result.toFixed(4); // High precision for ratios
  } else if (Math.abs(result) > 100) {
    return result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    return result.toFixed(2) + '%'; // Percentage format
  }`;
    } else {
      logic = `
  setIsLoading(true);
  try {
    console.log('${sig.name} called');
    // TODO: Implement ${sig.description || sig.name}
    // Add specific business logic implementation here
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Error occurred');
  } finally {
    setIsLoading(false);
  }`;
    }

    return {
      name: sig.name,
      parameters: safeName.includes('input') || safeName.includes('change') ? ['event: React.ChangeEvent<HTMLInputElement>'] : [],
      logic,
      description: sig.description || `Handler for ${sig.name}`
    };
  });
} 