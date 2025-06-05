import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Input schema for the state design agent
const StateDesignRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional()
});

export type StateDesignRequest = z.infer<typeof StateDesignRequestSchema>;

// Helper function to create model instance
function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    default:
      return openai('gpt-4o');
  }
}

/**
 * Core logic for the State Design Agent.
 * Generates React state variables, functions, and logic (no JSX) based on
 * the function signatures planned by the Function Planner.
 */
export async function designStateLogic(request: StateDesignRequest): Promise<{
  success: boolean;
  stateLogic?: {
    stateVariables: Array<{
      name: string;
      type: string;
      initialValue: string;
      description: string;
    }>;
    functions: Array<{
      name: string;
      parameters: string[];
      logic: string;
      description: string;
    }>;
    imports: string[];
    hooks: string[];
  };
  error?: string;
}> {
  const { jobId, selectedModel } = StateDesignRequestSchema.parse(request);

  try {
    // Load current TCC state
    const tcc = await getTCC(jobId);
    if (!tcc) {
      throw new Error(`TCC not found for jobId: ${jobId}`);
    }

    logger.info({ 
      jobId, 
      selectedModel: selectedModel || 'default',
      stepName: 'designing_state_logic',
      hasFunctionSignatures: !!tcc.functionSignatures?.length
    }, '🎯 StateDesign: Starting state logic design');

    // Update status to in_progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'started',
      'Designing React state variables and function logic...'
    );

    // Update TCC status
    const tccInProgress = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccInProgress);

    // Generate state logic using AI with proper model selection
    const stateLogic = await generateStateLogic(tcc, selectedModel);

    // Convert to TCC-compatible format
    const tccCompatibleStateLogic = {
      variables: stateLogic.stateVariables.map(v => ({
        name: v.name,
        type: v.type,
        initialValue: v.initialValue,
        description: v.description,
      })),
      functions: stateLogic.functions.map(f => ({
        name: f.name,
        body: f.logic,
        description: f.description,
        dependencies: f.parameters,
      })),
      imports: stateLogic.imports,
      // Backward compatibility
      stateVariables: stateLogic.stateVariables,
    };

    // Update TCC with state logic
    const tccWithStateLogic = {
      ...tccInProgress,
      stateLogic: tccCompatibleStateLogic,
      steps: {
        ...tccInProgress.steps,
        designingStateLogic: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tccInProgress.steps?.designingStateLogic?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: stateLogic
        }
      },
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccWithStateLogic);

    // Update progress to completed
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'completed',
      `Generated ${stateLogic.stateVariables.length} state variables and ${stateLogic.functions.length} functions`
    );

    logger.info({ 
      jobId, 
      stateVariablesGenerated: stateLogic.stateVariables.length,
      functionsGenerated: stateLogic.functions.length,
      importsGenerated: stateLogic.imports.length,
      hooksGenerated: stateLogic.hooks.length 
    }, '🎯 StateDesign: Generated state logic successfully');

    return {
      success: true,
      stateLogic
    };

  } catch (error) {
    logger.error({ 
      jobId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error) 
    }, '🎯 StateDesign: Error designing state logic');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_state_logic,
      'failed',
      `State design failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Uses AI to generate React state variables and functions based on the
 * planned function signatures and user requirements.
 */
async function generateStateLogic(
  tcc: ToolConstructionContext, 
  selectedModel?: string
): Promise<{
  stateVariables: Array<{
    name: string;
    type: string;
    initialValue: string;
    description: string;
  }>;
  functions: Array<{
    name: string;
    parameters: string[];
    logic: string;
    description: string;
  }>;
  imports: string[];
  hooks: string[];
}> {
  // Determine model to use following established pattern
  let modelConfig: { provider: string; modelId: string };
  let actualModelName: string;

  if (selectedModel && selectedModel !== 'default') {
    // CASE 1: Explicit model specified
    logger.info({ selectedModel }, '🎯 StateDesign: User selected explicit model');
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      modelConfig = { provider, modelId: selectedModel };
      actualModelName = selectedModel;
    } else {
      logger.warn({ selectedModel }, '🎯 StateDesign: Unknown model format, falling back to default');
      const primaryModel = getPrimaryModel('toolCreator');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
      } else {
        modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
        actualModelName = 'gpt-4o';
      }
    }
  } else {
    // CASE 2: selectedModel is 'default' or no model specified
    logger.info({ 
      selectedModel: selectedModel || 'none' 
    }, '🎯 StateDesign: Using default model configuration');
    
    try {
      const primaryModel = getPrimaryModel('toolCreator');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
        logger.info({ 
          provider: primaryModel.provider,
          modelId: primaryModel.modelInfo.id 
        }, '🎯 StateDesign: Using toolCreator primary model');
      } else {
        const fallbackModel = getFallbackModel('toolCreator');
        if (fallbackModel && 'modelInfo' in fallbackModel) {
          modelConfig = { provider: fallbackModel.provider, modelId: fallbackModel.modelInfo.id };
          actualModelName = fallbackModel.modelInfo.id;
        } else {
          modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
          actualModelName = 'gpt-4o';
        }
      }
    } catch (error) {
      logger.warn({ 
        error: error instanceof Error ? error.message : String(error),
        fallbackProvider: 'openai',
        fallbackModel: 'gpt-4o'
      }, '🎯 StateDesign: Could not resolve default model, using fallback');
      
      modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = 'gpt-4o';
    }
  }

  const selectionMethod = selectedModel && selectedModel !== 'default' 
    ? `Explicit User Selection (${selectedModel})` 
    : selectedModel === 'default' 
      ? 'User Selected "default" → toolCreator Config' 
      : 'No Model → toolCreator Config';
      
  logger.info({ 
    provider: modelConfig.provider,
    modelName: actualModelName,
    selectionMethod,
    originalSelectedModel: selectedModel || 'none'
  }, '🎯 StateDesign Model Selection:');

  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = `You are a React state design specialist. Your job is to design the state variables and functions for a React component.

CRITICAL RULES:
1. DO NOT generate any JSX or HTML - only state logic
2. Generate TypeScript interfaces and function implementations
3. Use modern React patterns (useState, useEffect, etc.)
4. Follow React best practices for state management
5. All functions should be properly typed
6. Include proper error handling in functions
7. Generate realistic initial values for state variables

You will be provided with:
- User's tool description
- Function signatures that were planned
- Target audience and requirements

Generate ONLY the state logic - the JSX will be handled by another agent.

Your response should include:
- State variables with types and initial values
- Function implementations that match the planned signatures
- Required imports
- React hooks to be used

Format your response as a structured analysis.`;

  const userPrompt = `Tool Description: ${tcc.userInput}
Target Audience: ${tcc.targetAudience || 'General users'}

Function Signatures to Implement:
${tcc.functionSignatures?.map(sig => `- ${sig.name}: ${sig.description}`).join('\n') || 'No function signatures available'}

Additional Context:
${tcc.additionalContext ? JSON.stringify(tcc.additionalContext, null, 2) : 'No additional context'}

Please design the React state variables and function implementations for this tool. Include:

1. State Variables (name, type, initial value, description)
2. Function Implementations (name, parameters, logic, description)  
3. Required Imports
4. React Hooks to use

Focus on creating a clean, functional state management system that supports the planned interactions.`;

  logger.info({ 
    provider: modelConfig.provider,
    modelId: modelConfig.modelId,
    userInputLength: userPrompt.length 
  }, '🎯 StateDesign: Calling AI model for state logic generation');

  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
    maxTokens: 2000
  });

  if (!content) {
    throw new Error('No response received from AI model');
  }

  // Parse the AI response into structured state logic
  try {
    const stateLogic = parseStateLogicResponse(content, tcc.functionSignatures || []);
    
    logger.info({ 
      stateVariablesCount: stateLogic.stateVariables.length,
      functionsCount: stateLogic.functions.length,
      importsCount: stateLogic.imports.length,
      hooksCount: stateLogic.hooks.length,
      modelUsed: actualModelName 
    }, '🎯 StateDesign: Successfully parsed AI response');
    
    return stateLogic;
    
  } catch (parseError) {
    logger.error({ 
      parseError: parseError instanceof Error ? parseError.message : String(parseError),
      rawResponseLength: content?.length || 0,
      modelUsed: actualModelName 
    }, '🎯 StateDesign: Failed to parse AI response');
    logger.debug({ rawResponse: content }, '🎯 StateDesign: Raw AI response for debugging');
    
    // Fallback to basic state structure
    return generateFallbackStateLogic(tcc.functionSignatures || []);
  }
}

/**
 * Parses the AI response and extracts structured state logic
 */
function parseStateLogicResponse(
  content: string, 
  functionSignatures: DefinedFunctionSignature[]
): {
  stateVariables: Array<{
    name: string;
    type: string;
    initialValue: string;
    description: string;
  }>;
  functions: Array<{
    name: string;
    parameters: string[];
    logic: string;
    description: string;
  }>;
  imports: string[];
  hooks: string[];
} {
  logger.info({ 
    contentLength: content?.length || 0,
    signatureCount: functionSignatures.length
  }, '🎯 StateDesign: AI FIRST - Parsing intelligent AI response for state logic');

  // Try to extract structured state logic from AI response
  let aiStateVariables: any[] = [];
  let aiFunctions: any[] = [];
  let aiImports: string[] = [];
  let aiHooks: string[] = [];
  
  try {
    // Look for JSON structure in AI response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                     content.match(/\{[\s\S]*"stateVariables"[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (parsed.stateVariables) aiStateVariables = parsed.stateVariables;
      if (parsed.functions) aiFunctions = parsed.functions;
      if (parsed.imports) aiImports = parsed.imports;
      if (parsed.hooks) aiHooks = parsed.hooks;
      
      logger.info({ 
        hasAiStateVariables: aiStateVariables.length > 0,
        hasAiFunctions: aiFunctions.length > 0
      }, '🎯 StateDesign: Successfully parsed AI JSON response');
    }
  } catch (parseError) {
    logger.warn({ 
      parseError: parseError instanceof Error ? parseError.message : String(parseError)
    }, '🎯 StateDesign: Could not parse AI JSON, using intelligent extraction');
  }

  // Extract state variables from AI content if not in JSON
  if (aiStateVariables.length === 0) {
    aiStateVariables = extractStateVariablesFromContent(content);
  }

  // Extract function implementations from AI content if not in JSON
  if (aiFunctions.length === 0) {
    aiFunctions = extractFunctionImplementationsFromContent(content, functionSignatures);
  }

  // Extract imports and hooks from content
  if (aiImports.length === 0) {
    aiImports = extractImportsFromContent(content);
  }
  
  if (aiHooks.length === 0) {
    aiHooks = extractHooksFromContent(content);
  }

  // Use AI-extracted data or generate intelligent defaults
  const stateVariables = aiStateVariables.length > 0 ? 
    aiStateVariables : 
    generateIntelligentStateVariables(functionSignatures, content);

  const functions = aiFunctions.length > 0 ?
    aiFunctions :
    generateIntelligentFunctions(functionSignatures, content);

  const imports = aiImports.length > 0 ?
    aiImports :
    generateIntelligentImports(functionSignatures, content);

  const hooks = aiHooks.length > 0 ?
    aiHooks :
    generateIntelligentHooks(functionSignatures, content);

  logger.info({ 
    stateVariablesCount: stateVariables.length,
    functionsCount: functions.length,
    importsCount: imports.length,
    hooksCount: hooks.length,
    usedAiContent: aiStateVariables.length > 0 || aiFunctions.length > 0
  }, '🎯 StateDesign: Successfully processed state logic');

  return {
    stateVariables,
    functions,
    imports,
    hooks
  };
}

/**
 * Helper functions for parsing AI response
 */
function extractStateVariablesFromContent(content: string): any[] {
  const stateVariables: any[] = [];
  
  // Look for useState patterns in content
  const useStateMatches = content.match(/useState<(\w+)>\(([^)]+)\)/g) || [];
  
  useStateMatches.forEach(match => {
    const typeMatch = match.match(/useState<(\w+)>/);
    const valueMatch = match.match(/\(([^)]+)\)/);
    
    if (typeMatch && valueMatch) {
      const variableName = `${typeMatch[1].toLowerCase()}State`;
      stateVariables.push({
        name: variableName,
        type: typeMatch[1],
        initialValue: valueMatch[1],
        description: `AI-identified ${typeMatch[1]} state variable`
      });
    }
  });

  // Look for explicit state variable mentions
  if (content.toLowerCase().includes('loading') || content.toLowerCase().includes('isloading')) {
    stateVariables.push({
      name: 'isLoading',
      type: 'boolean',
      initialValue: 'false',
      description: 'Loading state indicator'
    });
  }

  if (content.toLowerCase().includes('error') || content.toLowerCase().includes('errors')) {
    stateVariables.push({
      name: 'errors',
      type: 'Record<string, string>',
      initialValue: '{}',
      description: 'Validation errors'
    });
  }

  if (content.toLowerCase().includes('result') || content.toLowerCase().includes('calculation')) {
    stateVariables.push({
      name: 'result',
      type: 'any',
      initialValue: 'null',
      description: 'Calculation or processing result'
    });
  }

  return stateVariables;
}

function extractFunctionImplementationsFromContent(content: string, functionSignatures: DefinedFunctionSignature[]): any[] {
  const functions: any[] = [];
  
  // Look for function implementations in content
  functionSignatures.forEach(sig => {
    const functionMatch = content.match(new RegExp(`${sig.name}[\\s\\S]*?\\{[\\s\\S]*?\\}`, 'i'));
    
    if (functionMatch) {
      functions.push({
        name: sig.name,
        parameters: extractParametersFromContent(functionMatch[0]),
        logic: extractLogicFromContent(functionMatch[0]),
        description: sig.description || `AI-implemented ${sig.name}`
      });
    } else {
      // Generate intelligent implementation based on function name and description
      functions.push({
        name: sig.name,
        parameters: generateParametersFromSignature(sig),
        logic: generateLogicFromSignature(sig, content),
        description: sig.description || `Handler for ${sig.name}`
      });
    }
  });
  
  return functions;
}

function extractImportsFromContent(content: string): string[] {
  const imports: string[] = [];
  
  // Extract import statements from content
  const importMatches = content.match(/import.*?from.*?['"][^'"]+['"];?/g) || [];
  imports.push(...importMatches);
  
  // Add default React import if not present
  if (!imports.some(imp => imp.includes('React'))) {
    imports.unshift("import React, { useState, useEffect, useCallback } from 'react';");
  }
  
  // Add common imports based on content
  if (content.includes('zod') || content.includes('schema')) {
    imports.push("import { z } from 'zod';");
  }
  
  return imports.length > 0 ? imports : [
    "import React, { useState, useEffect, useCallback } from 'react';",
    "import { z } from 'zod';"
  ];
}

function extractHooksFromContent(content: string): string[] {
  const hooks: string[] = [];
  
  if (content.includes('useState')) hooks.push('useState');
  if (content.includes('useEffect')) hooks.push('useEffect');
  if (content.includes('useCallback')) hooks.push('useCallback');
  if (content.includes('useMemo')) hooks.push('useMemo');
  if (content.includes('useRef')) hooks.push('useRef');
  
  return hooks.length > 0 ? hooks : ['useState', 'useEffect', 'useCallback'];
}

function generateIntelligentStateVariables(functionSignatures: DefinedFunctionSignature[], content: string): any[] {
  const stateVariables: any[] = [];
  
  // Always include loading state for async operations
  stateVariables.push({
    name: 'isLoading',
    type: 'boolean',
    initialValue: 'false',
    description: 'Loading state indicator'
  });
  
  // Add error handling state
  stateVariables.push({
    name: 'errors',
    type: 'Record<string, string>',
    initialValue: '{}',
    description: 'Validation errors'
  });
  
  // Add result state for output
  stateVariables.push({
    name: 'result',
    type: 'any',
    initialValue: 'null',
    description: 'Calculation or processing result'
  });
  
  // Add input state for form data
  if (functionSignatures.some(sig => sig.name.toLowerCase().includes('submit') || sig.name.toLowerCase().includes('process'))) {
    stateVariables.push({
      name: 'formData',
      type: 'Record<string, any>',
      initialValue: '{}',
      description: 'Form input data'
    });
  }
  
  // Add tool-specific state based on content
  if (content.toLowerCase().includes('calculator') || content.toLowerCase().includes('calculate')) {
    stateVariables.push({
      name: 'inputValue',
      type: 'string',
      initialValue: "''",
      description: 'Calculator input value'
    });
  }
  
  if (content.toLowerCase().includes('file') || content.toLowerCase().includes('upload')) {
    stateVariables.push({
      name: 'uploadedFile',
      type: 'File | null',
      initialValue: 'null',
      description: 'Uploaded file state'
    });
  }
  
  return stateVariables;
}

function generateIntelligentFunctions(functionSignatures: DefinedFunctionSignature[], content: string): any[] {
  return functionSignatures.map(sig => ({
    name: sig.name,
    parameters: generateParametersFromSignature(sig),
    logic: generateLogicFromSignature(sig, content),
    description: sig.description || `Handler for ${sig.name}`
  }));
}

function generateIntelligentImports(functionSignatures: DefinedFunctionSignature[], content: string): string[] {
  const imports = [
    "import React, { useState, useEffect, useCallback } from 'react';"
  ];
  
  if (content.includes('validation') || functionSignatures.some(sig => sig.name.includes('validate'))) {
    imports.push("import { z } from 'zod';");
  }
  
  return imports;
}

function generateIntelligentHooks(functionSignatures: DefinedFunctionSignature[], content: string): string[] {
  const hooks = ['useState'];
  
  if (functionSignatures.some(sig => sig.name.toLowerCase().includes('effect') || sig.name.toLowerCase().includes('async'))) {
    hooks.push('useEffect');
  }
  
  if (functionSignatures.length > 0) {
    hooks.push('useCallback');
  }
  
  return hooks;
}

function extractParametersFromContent(functionContent: string): string[] {
  const paramMatch = functionContent.match(/\(([^)]*)\)/);
  return paramMatch ? paramMatch[1].split(',').map(p => p.trim()).filter(p => p.length > 0) : [];
}

function extractLogicFromContent(functionContent: string): string {
  const logicMatch = functionContent.match(/\{([\s\S]*)\}/);
  return logicMatch ? logicMatch[1].trim() : 'console.log("Function implementation");';
}

function generateParametersFromSignature(sig: DefinedFunctionSignature): string[] {
  // Generate parameters based on function signature
  if (sig.name.toLowerCase().includes('submit') || sig.name.toLowerCase().includes('handle')) {
    return ['event?: React.FormEvent'];
  }
  if (sig.name.toLowerCase().includes('change') || sig.name.toLowerCase().includes('input')) {
    return ['value: string', 'field?: string'];
  }
  return ['...args: any[]'];
}

function generateLogicFromSignature(sig: DefinedFunctionSignature, content: string): string {
  const baseName = sig.name.toLowerCase();
  
  if (baseName.includes('submit') || baseName.includes('process')) {
    return `
  setIsLoading(true);
  setErrors({});
  try {
    // Process ${sig.description || 'form data'}
    const result = await processData(formData);
    setResult(result);
  } catch (error) {
    setErrors({ general: error instanceof Error ? error.message : 'An error occurred' });
  } finally {
    setIsLoading(false);
  }`;
  }
  
  if (baseName.includes('reset') || baseName.includes('clear')) {
    return `
  setFormData({});
  setResult(null);
  setErrors({});
  setIsLoading(false);`;
  }
  
  if (baseName.includes('validate')) {
    return `
  const validationErrors: Record<string, string> = {};
  // Add validation logic here based on: ${sig.description || 'input requirements'}
  setErrors(validationErrors);
  return Object.keys(validationErrors).length === 0;`;
  }
  
  return `
  // Implementation for ${sig.name}
  console.log('${sig.name} called with:', args);
  // TODO: Implement ${sig.description || 'function logic'}`;
}

/**
 * Generates fallback state logic when AI parsing fails
 */
function generateFallbackStateLogic(
  functionSignatures: DefinedFunctionSignature[]
): {
  stateVariables: Array<{
    name: string;
    type: string;
    initialValue: string;
    description: string;
  }>;
  functions: Array<{
    name: string;
    parameters: string[];
    logic: string;
    description: string;
  }>;
  imports: string[];
  hooks: string[];
} {
  logger.info({ 
    signatureCount: functionSignatures.length 
  }, '🎯 StateDesign: Generating fallback state logic');

  return {
    stateVariables: [
      {
        name: 'data',
        type: 'any',
        initialValue: 'null',
        description: 'Main data state'
      },
      {
        name: 'loading',
        type: 'boolean',
        initialValue: 'false',
        description: 'Loading indicator'
      }
    ],
    functions: functionSignatures.length > 0 ? functionSignatures.map(sig => ({
      name: sig.name,
      parameters: ['event?: any'],
      logic: `console.log('${sig.name} triggered');`,
      description: sig.description || `Handler for ${sig.name}`
    })) : [
      {
        name: 'handleSubmit',
        parameters: ['event?: any'],
        logic: 'console.log("Submit triggered");',
        description: 'Default submit handler'
      }
    ],
    imports: ["import React, { useState } from 'react';"],
    hooks: ['useState']
  };
}