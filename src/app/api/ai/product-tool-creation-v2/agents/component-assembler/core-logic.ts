import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
// TCC Store operations removed - using prop-based TCC passing
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

const assembledComponentSchema = z.object({
  finalComponentCode: z.string()
    .min(10)
    .describe('The complete, functional React component code using React.createElement syntax. Must be executable JavaScript without imports or exports.'),
  componentName: z.string()
    .min(1)
    .describe('The name of the generated component (e.g., "BusinessHealthCalculator")'),
  hooks: z.array(z.string())
    .optional()
    .default([])
    .describe('Array of React hooks used (e.g., ["useState", "useEffect"]). Can be empty.'),
  functions: z.array(z.string())
    .optional()
    .default([])
    .describe('Array of function names defined in the component. Can be empty.'),
  estimatedLines: z.number()
    .int()
    .min(1)
    .optional()
    .default(50)
    .describe('Estimated number of lines in the component code'),
});

// Type definitions for component assembly
export type AssembledComponent = z.infer<typeof assembledComponentSchema>;

export type ComponentAssemblerResult = {
  success: boolean;
  assembledComponent?: AssembledComponent;
  error?: string;
};

// Input schema
const ComponentAssemblerRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  mockTcc: z.custom<Partial<ToolConstructionContext>>().optional()
});

export type ComponentAssemblerRequest = z.infer<typeof ComponentAssemblerRequestSchema>;

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

/**
 * Component Assembler Agent - Combines JSX, state, and styling into final React component
 */
export async function assembleComponent(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
}): Promise<{
  success: boolean;
  assembledComponent?: AssembledComponent;
  error?: string;
  updatedTcc?: ToolConstructionContext;
}> {
  const { jobId, selectedModel } = request;
  const tcc = request.mockTcc || request.tcc;

  try {
    logger.info({ jobId }, '🔧 ComponentAssembler: Starting component assembly');

    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Validate we have all required pieces
    if (!tcc.jsxLayout || !tcc.stateLogic || !tcc.styling) {
      const missing = [
        !tcc.jsxLayout && 'jsxLayout',
        !tcc.stateLogic && 'stateLogic',
        !tcc.styling && 'styling',
      ].filter(Boolean).join(', ');
      throw new Error(`Prerequisites missing in TCC: ${missing}`);
    }

    // ✅ COMPREHENSIVE TCC INPUT LOGGING 📋 - WHAT WE RECEIVED FROM PREVIOUS AGENTS
    logger.info({
      jobId,
      agentName: 'ComponentAssembler',
      tccInputAnalysis: {
        hasUserId: !!tcc.userId,
        hasJobId: !!tcc.jobId,
        hasBrainstormData: !!tcc.brainstormData,
        hasUserInput: !!tcc.userInput,
        hasStateLogic: !!tcc.stateLogic,
        hasJsxLayout: !!tcc.jsxLayout,
        hasStyling: !!tcc.styling,
        hasResearchData: !!(tcc as any).researchData,
        currentStep: tcc.currentOrchestrationStep,
        completedSteps: Object.keys(tcc.steps || {}),
        updatedAt: tcc.updatedAt,
        // DETAILED BREAKDOWN OF WHAT EACH AGENT PROVIDED
        stateLogicDetails: tcc.stateLogic ? {
          variableCount: tcc.stateLogic.variables?.length || 0,
          variableNames: tcc.stateLogic.variables?.map(v => v.name) || [],
          functionCount: tcc.stateLogic.functions?.length || 0,
          functionNames: tcc.stateLogic.functions?.map(f => f.name) || [],
          hasUseStateHooks: !!(tcc.stateLogic as any).useStateHooks,
          hookCount: (tcc.stateLogic as any).useStateHooks?.length || 0,
          hookNames: (tcc.stateLogic as any).useStateHooks?.map((h: any) => h.variableName) || []
        } : null,
        jsxLayoutDetails: tcc.jsxLayout ? {
          componentStructureLength: tcc.jsxLayout.componentStructure?.length || 0,
          componentStructurePreview: tcc.jsxLayout.componentStructure?.substring(0, 200) + '...' || '',
          elementMapCount: tcc.jsxLayout.elementMap?.length || 0,
          elementTypes: tcc.jsxLayout.elementMap?.map(el => el.type) || [],
          hasAccessibilityFeatures: !!tcc.jsxLayout.accessibilityFeatures,
          hasResponsiveBreakpoints: !!tcc.jsxLayout.responsiveBreakpoints
        } : null,
        stylingDetails: tcc.styling ? {
          styledComponentCodeLength: tcc.styling.styledComponentCode?.length || 0,
          styledComponentCodePreview: tcc.styling.styledComponentCode?.substring(0, 200) + '...' || '',
          hasColorScheme: !!tcc.styling.colorScheme,
          colorSchemePrimary: tcc.styling.colorScheme?.primary || 'Not set',
          hasResponsiveFeatures: !!(tcc.styling as any).responsiveFeatures,
          hasAccessibilityFeatures: !!(tcc.styling as any).accessibilityFeatures,
          hasDarkModeSupport: !!(tcc.styling as any).darkModeSupport
        } : null,
        brainstormDetails: tcc.brainstormData ? {
          hasCoreConcept: !!tcc.brainstormData.coreConcept,
          hasValueProposition: !!tcc.brainstormData.valueProposition,
          suggestedInputCount: tcc.brainstormData.suggestedInputs?.length || 0,
          keyCalculationCount: tcc.brainstormData.keyCalculations?.length || 0,
          hasResearchOptions: !!tcc.brainstormData.researchOptions,
          researchOptionCount: Array.isArray(tcc.brainstormData.researchOptions) ? tcc.brainstormData.researchOptions.length : 0
        } : null
      }
    }, '🔧 ComponentAssembler: 📋 COMPREHENSIVE TCC INPUT ANALYSIS - WHAT PREVIOUS AGENTS PROVIDED');

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
      'Assembling final React component...',
      tcc // Pass TCC with userId
    );

    // CRITICAL FIX: Add progress updates during long-running assembly
    // Break down the assembly process with intermediate progress reports
    
    // Step 1: Prepare assembly context
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
      'Preparing component assembly context...',
      tcc
    );
    
    // Add a small delay to allow progress to be sent
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assemble the component with AI
    const assembledComponent = await generateAssembledComponent(
      tcc,
      jobId,
      selectedModel
    );

    // Update TCC with results
    const updatedTCC: ToolConstructionContext = {
      ...tcc,
      assembledComponentCode: assembledComponent.finalComponentCode,
      currentOrchestrationStep: OrchestrationStepEnum.enum.validating_code, // Set next step
      steps: {
        ...tcc.steps,
        assemblingComponent: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt:
            tcc.steps?.assemblingComponent?.startedAt ||
            new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: assembledComponent,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // Debug: Log what we're storing in TCC
    logger.info({
      jobId,
      assembledCodeLength: assembledComponent.finalComponentCode.length,
      hasImportsInFinalCode: assembledComponent.finalComponentCode.includes('import ')
    }, '🔧 ComponentAssembler: 🔍 TCC Update Debug - storing assembled component code');

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'completed',
      'Component assembled successfully!',
      updatedTCC // Pass updated TCC with userId
    );

    logger.info({ jobId }, '🔧 ComponentAssembler: Completed successfully');
    return { success: true, assembledComponent, updatedTcc: updatedTCC };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { jobId, error: errorMessage },
      '🔧 ComponentAssembler: Error in main execution block',
    );
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'failed',
      errorMessage,
      tcc // Pass TCC with userId even on failure
    );
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Triggers the check-parallel-completion endpoint to move the orchestration forward.
 * @param jobId The ID of the current tool creation job.
 */
async function triggerNextOrchestrationStep(jobId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  
  try {
    logger.info({ jobId, baseUrl }, '🔧 ComponentAssembler: Triggering next orchestration step...');
    
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Orchestrator responded with status ${response.status}: ${errorBody}`);
    }

    logger.info({ jobId }, '🔧 ComponentAssembler: Successfully triggered next orchestration step.');

  } catch (error) {
    logger.error({ 
      jobId, 
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error) 
    }, '🔧 ComponentAssembler: Failed to trigger next orchestration step.');
  }
}

/**
 * Use AI to generate the assembled component using ITERATIVE PARALLEL APPROACH
 * Multiple specialized AI calls focusing on different aspects, then merge results
 */
async function generateAssembledComponent(tcc: ToolConstructionContext, jobId: string, selectedModel?: string): Promise<AssembledComponent> {
  // Get model configuration
  const { provider, modelId } = getModelForAgent('componentAssembler', selectedModel, tcc);
  logger.info({ provider, modelId }, '🔧 ComponentAssembler: Using model');
  const modelInstance = createModelInstance(provider, modelId);

  // Extract essential data for parallel generation
  const stateVariables = tcc.stateLogic?.variables || [];
  const stateFunctions = tcc.stateLogic?.functions || [];
  const suggestedInputs = tcc.brainstormData?.suggestedInputs || [];
  const keyCalculations = tcc.brainstormData?.keyCalculations || [];
  const jsxCode = tcc.styling?.styledComponentCode || tcc.jsxLayout?.componentStructure || '';

  // Truncate JSX for manageable prompt size
  const truncatedJsx = jsxCode.length > 5000 ? jsxCode.substring(0, 5000) + '...' : jsxCode;

  // Log parallel approach
  logger.info({
    tccJobId: tcc.jobId,
    provider,
    modelId,
    stateVariableCount: stateVariables.length,
    functionCount: stateFunctions.length,
    suggestedInputCount: suggestedInputs.length,
    jsxCodeLength: truncatedJsx.length,
    approachType: 'iterative_parallel'
  }, '🔧 ComponentAssembler: 📝 ITERATIVE PARALLEL APPROACH - Specialized AI calls');

  try {
    // 🚀 PARALLEL SPECIALIZED AI CALLS
    const [importsResult, stateResult, functionsResult, jsxResult] = await Promise.all([
      
      // 1️⃣ IMPORTS & SETUP SPECIALIST
      generateObject({
        model: modelInstance,
        schema: z.object({
          imports: z.array(z.string()).describe("Required import statements"),
          componentName: z.string().describe("Component function name")
        }),
        system: `Generate ONLY the imports and component name. Focus on imports needed for the component.`,
        prompt: `Based on this tool: "${tcc.userInput}"
        
Required imports for React component with these UI elements:
${suggestedInputs.map(input => `- ${input.type} input: ${input.label}`).join('\n')}

Generate imports and component name.`
      }),

      // 2️⃣ STATE MANAGEMENT SPECIALIST  
      generateObject({
        model: modelInstance,
        schema: z.object({
          useStateHooks: z.array(z.string()).describe("useState hook declarations"),
          stateInitializers: z.array(z.string()).describe("State initialization code")
        }),
        system: `Generate ONLY useState hooks and state initialization. One hook per input field.`,
        prompt: `Create useState hooks for these inputs:
${suggestedInputs.map(input => `- ${input.label} (${input.type})`).join('\n')}

Generate useState declarations with proper initial values.`
      }),

      // 3️⃣ CALCULATION FUNCTIONS SPECIALIST
      generateObject({
        model: modelInstance,
        schema: z.object({
          calculationFunctions: z.array(z.string()).describe("Calculation function implementations"),
          eventHandlers: z.array(z.string()).describe("Event handler functions")
        }),
        system: `Generate ONLY calculation functions and event handlers. Implement the actual calculation logic.`,
        prompt: `Implement these calculations:
${keyCalculations.map(calc => `- ${calc.name}: ${calc.description}`).join('\n')}

State variables available:
${stateVariables.map(v => `- ${v.name}: ${v.type}`).join('\n')}

Generate working calculation functions.`
      }),

      // 4️⃣ JSX CONVERSION SPECIALIST
      generateObject({
        model: modelInstance,
        schema: z.object({
          reactElementCode: z.string().describe("Complete JSX converted to React.createElement"),
          componentStructure: z.string().describe("Component structure summary")
        }),
        system: `Convert JSX to React.createElement syntax. Connect state variables to inputs and displays.`,
        prompt: `Convert this JSX to React.createElement:

${truncatedJsx}

Connect state variables: ${stateVariables.map(v => v.name).join(', ')}
Add onClick handlers for buttons and onChange for inputs.`
      })
    ]);

    // 🔧 MERGE RESULTS INTO COMPLETE COMPONENT
    const mergedComponent = mergeParallelResults({
      imports: importsResult.imports,
      componentName: importsResult.componentName,
      useStateHooks: stateResult.useStateHooks,
      stateInitializers: stateResult.stateInitializers,
      calculationFunctions: functionsResult.calculationFunctions,
      eventHandlers: functionsResult.eventHandlers,
      reactElementCode: jsxResult.reactElementCode,
      stateVariables,
      stateFunctions
    });

    logger.info({
      tccJobId: tcc.jobId,
      approachType: 'iterative_parallel_success',
      mergedComponentLength: mergedComponent.finalComponentCode.length,
      hooksCount: mergedComponent.hooks?.length || 0,
      functionsCount: mergedComponent.functions?.length || 0
    }, '🔧 ComponentAssembler: ✅ PARALLEL GENERATION SUCCESS - Merged specialized results');

    return mergedComponent;

  } catch (error) {
    logger.error({
      tccJobId: tcc.jobId,
      error: error instanceof Error ? error.message : String(error),
      approachType: 'iterative_parallel_failed'
    }, '🔧 ComponentAssembler: 🚨 PARALLEL generation failed');

    // Fallback to simple approach
    return generateSimpleFallbackComponent(tcc, truncatedJsx);
  }
}

/**
 * Merge results from parallel specialized AI calls into complete component
 */
function mergeParallelResults(results: {
  imports: string[];
  componentName: string;
  useStateHooks: string[];
  stateInitializers: string[];
  calculationFunctions: string[];
  eventHandlers: string[];
  reactElementCode: string;
  stateVariables: any[];
  stateFunctions: any[];
}): AssembledComponent {
  
  const finalCode = `${results.imports.join('\n')}

function ${results.componentName}() {
  // State Management
  ${results.useStateHooks.join('\n  ')}
  
  // State Initializers
  ${results.stateInitializers.join('\n  ')}
  
  // Calculation Functions
  ${results.calculationFunctions.join('\n  ')}
  
  // Event Handlers  
  ${results.eventHandlers.join('\n  ')}
  
  // Component Render
  return ${results.reactElementCode};
}

export default ${results.componentName};`;

  return {
    finalComponentCode: finalCode,
    componentName: results.componentName,
    hooks: results.useStateHooks.map(hook => hook.match(/useState/)?.[0] || 'useState'),
    functions: [...results.calculationFunctions, ...results.eventHandlers].map(func => 
      func.match(/(?:const|function)\s+(\w+)/)?.[1] || 'unknownFunction'
    ),
    estimatedLines: finalCode.split('\n').length
  };
}

/**
 * Simple fallback when parallel approach fails
 */
function generateSimpleFallbackComponent(tcc: ToolConstructionContext, jsxCode: string): AssembledComponent {
  const componentName = generateComponentName(tcc.userInput || 'Tool');
  
  const fallbackCode = `import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

function ${componentName}() {
  return React.createElement('div', { 
    className: 'p-4',
    'data-style-id': 'main-container'
  }, 'Component generation in progress...');
}

export default ${componentName};`;

  return {
    finalComponentCode: fallbackCode,
    componentName: componentName,
    hooks: [],
    functions: [],
    estimatedLines: 10
  };
}

function getModelForAgent(agentName: string, selectedModel?: string, tcc?: ToolConstructionContext): { provider: string; modelId: string } {
    // CRITICAL FIX: GPT-4o consistently fails with "could not parse the response" for complex structured generation
    // Force Claude 3.7 Sonnet for Component Assembler to ensure reliable JSON generation
    if (agentName === 'componentAssembler') {
        logger.info({ 
            agentName, 
            reason: 'GPT-4o JSON parsing failures',
            selectedModel,
            source: 'STRUCTURED_GENERATION_FIX' 
        }, '🔧 ComponentAssembler: 🚨 FORCING Claude 3.7 Sonnet due to GPT-4o JSON parsing failures');
        return { provider: 'anthropic', modelId: 'claude-3-7-sonnet-20250219' };
    }
    
    // PRIORITY 1: User-selected model from UI (highest priority) - but only for non-ComponentAssembler
    if (selectedModel && selectedModel !== 'default') {
        const provider = getModelProvider(selectedModel);
        if (provider !== 'unknown') {
            logger.info({ 
                agentName, 
                selectedModel, 
                provider, 
                source: 'USER_SELECTED' 
            }, '🔧 ComponentAssembler: Using USER-SELECTED model from UI');
            return { provider, modelId: selectedModel };
        } else {
            logger.warn({ 
                agentName, 
                selectedModel 
            }, '🔧 ComponentAssembler: User-selected model has unknown provider, falling back to TCC mapping');
        }
    }

    // PRIORITY 2: Agent model mapping from TCC (from workbench agent-specific configuration)
    if (tcc?.agentModelMapping && tcc.agentModelMapping['component-assembler']) {
        const mappedModel = tcc.agentModelMapping['component-assembler'];
        const provider = getModelProvider(mappedModel);
        if (provider !== 'unknown') {
            logger.info({ 
                agentName, 
                mappedModel, 
                provider, 
                source: 'TCC_AGENT_MAPPING' 
            }, '🔧 ComponentAssembler: Using TCC AGENT MAPPING model from workbench');
            return { provider, modelId: mappedModel };
        } else {
            logger.warn({ 
                agentName, 
                mappedModel 
            }, '🔧 ComponentAssembler: TCC mapped model has unknown provider, falling back to config');
        }
    } else if (tcc) {
        logger.warn({ 
            agentName,
            hasAgentModelMapping: !!tcc.agentModelMapping,
            agentMappingKeys: tcc.agentModelMapping ? Object.keys(tcc.agentModelMapping) : [],
            source: 'TCC_AGENT_MAPPING_MISSING'
        }, '🔧 ComponentAssembler: ⚠️ No TCC agent mapping found for component-assembler');
    }

    // PRIORITY 3: Primary model from configuration
    const primaryModel = getPrimaryModel(agentName as any);
    if (primaryModel && 'modelInfo' in primaryModel) {
        logger.info({ 
            agentName, 
            provider: primaryModel.provider, 
            modelId: primaryModel.modelInfo.id,
            source: 'PRIMARY_CONFIG' 
        }, '🔧 ComponentAssembler: Using PRIMARY model from configuration');
        return { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
    }

    // PRIORITY 4: Fallback model from configuration
    const fallbackModel = getFallbackModel(agentName as any);
    if (fallbackModel && 'modelInfo' in fallbackModel) {
        logger.warn({ 
            agentName, 
            provider: fallbackModel.provider, 
            modelId: fallbackModel.modelInfo.id,
            source: 'FALLBACK_CONFIG' 
        }, '🔧 ComponentAssembler: ⚠️ Using FALLBACK model from configuration');
        return { provider: fallbackModel.provider, modelId: fallbackModel.modelInfo.id };
    }

    // PRIORITY 5: Final hardcoded fallback - use Claude instead of GPT-4o for structured generation reliability
    logger.error({ 
        agentName, 
        selectedModel,
        tccAgentMapping: tcc?.agentModelMapping ? Object.keys(tcc.agentModelMapping) : 'No TCC provided',
        source: 'HARDCODED_FALLBACK' 
    }, '🔧 ComponentAssembler: 🚨 CRITICAL: No model configuration found! Using Claude 3.7 Sonnet fallback for reliable structured generation');
    return { provider: 'anthropic', modelId: 'claude-3-7-sonnet-20250219' }; // Claude fallback for reliability
}

/**
 * Generate component name from user input
 */
function generateComponentName(userInput: string): string {
  const name = userInput || 'Tool';
  
  // Handle specific case of "No description provided"
  if (name.toLowerCase().includes('no description provided') || name.toLowerCase().includes('nodescriptionprovided')) {
    return 'GeneratedTool';
  }
  
  // Clean the name: remove special chars, handle spaces properly
  const cleanedName = name
    .replace(/[^a-zA-Z0-9 ]/g, '') // Remove special characters
    .split(/\s+/) // Split on whitespace
    .filter(Boolean) // Remove empty strings
    .map((word, index) => {
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(''); // Join without spaces for camelCase
  
  // Handle empty/corrupted names
  if (!cleanedName || cleanedName.length === 0) {
    return 'GeneratedTool';
  }
  
  // Ensure name starts with a letter (not number)
  let finalName = cleanedName;
  if (/^[0-9]/.test(finalName)) {
    finalName = 'Tool' + finalName;
  }
  
  // Additional safety check - ensure it's a valid JavaScript identifier
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(finalName)) {
    logger.warn({ 
      originalUserInput: userInput,
      cleanedName,
      finalName,
      reason: 'Invalid JavaScript identifier, using fallback'
    }, '🔧 ComponentAssembler: Component name validation failed');
    return 'GeneratedTool';
  }
  
  return finalName;
}

/**
 * Extract imports from component code
 */
function extractImports(code: string): string[] {
  const importMatches = code.match(/import\s+.*?\s+from\s+['"][^'"]+['"]/g) || [];
  return importMatches.map(imp => imp.match(/from\s+['"]([^'"]+)['"]/)?.[1] || '').filter(Boolean);
}

/**
 * Extract React hooks from component code
 */
function extractHooks(code: string): string[] {
  const hookMatches = code.match(/use[A-Z][a-zA-Z]*\(/g) || [];
  return [...new Set(hookMatches.map(hook => hook.replace('(', '')))];
}

/**
 * Extract function definitions from component code
 */
function extractFunctions(code: string): string[] {
  const functionMatches = code.match(/(?:const|function)\s+([a-zA-Z][a-zA-Z0-9]*)\s*[=\(]/g) || [];
  return functionMatches.map(func => func.match(/(?:const|function)\s+([a-zA-Z][a-zA-Z0-9]*)/)?.[1] || '').filter(Boolean);
} 