import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStepEnum, OrchestrationStatusEnum, EditModeContext } from '@/lib/types/product-tool-creation-v2/tcc';
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

    // ✅ FIXED: Use correct function signature
    const assemblyResult = await generateAssembledComponent({
      jobId,
      selectedModel,
      tcc,
      isIsolatedTest: false
    });

    if (!assemblyResult.success || !assemblyResult.assembledComponent) {
      throw new Error(assemblyResult.error || 'Failed to assemble component');
    }

    const assembledComponent = assemblyResult.assembledComponent;

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
  
  // Generate simple calculation function implementations
  const simpleFunctions = results.calculationFunctions.map(funcName => 
    `const ${funcName} = () => { console.log('${funcName} called'); };`
  ).join('\n  ');
  
  const simpleHandlers = results.eventHandlers.map(handlerName => 
    `const ${handlerName} = () => { console.log('${handlerName} called'); };`
  ).join('\n  ');
  
  const finalCode = `${results.imports.join('\n')}

function ${results.componentName}() {
  // State Management
  ${results.useStateHooks.join('\n  ')}
  
  // Simple Functions
  ${simpleFunctions}
  
  // Simple Handlers  
  ${simpleHandlers}
  
  // Component Render
  return ${results.reactElementCode};
}

export default ${results.componentName};`;

  return {
    finalComponentCode: finalCode,
    componentName: results.componentName,
    hooks: results.useStateHooks.map(hook => hook.match(/useState/)?.[0] || 'useState'),
    functions: [...results.calculationFunctions, ...results.eventHandlers].map(func => 
      func.match(/(?:const|function)\s+(\w+)/)?.[1] || func
    ),
    estimatedLines: finalCode.split('\n').length
  };
}

/**
 * ✅ RESTORED: Original Elegant Component Assembly 
 * This function implements the INTENDED DESIGN where Component Assembler 
 * COMBINES the accumulated TCC sections instead of regenerating everything.
 */
export async function generateAssembledComponent(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
}): Promise<{
  success: boolean;
  assembledComponent?: AssembledComponent;
  error?: string;
  updatedTcc?: ToolConstructionContext;
}> {
  const { jobId, selectedModel, isIsolatedTest = false, editMode } = request;
  const tcc = request.mockTcc || request.tcc;

  logger.info({ jobId }, '🔧 ComponentAssembler: Starting component assembly');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // ✅ ORIGINAL DESIGN: Comprehensive TCC analysis of accumulated sections
    const tccAnalysis = analyzeTccSections(tcc);
  logger.info({
      jobId,
      agentName: 'ComponentAssembler',
      tccInputAnalysis: tccAnalysis
    }, '🔧 ComponentAssembler: 📋 COMPREHENSIVE TCC INPUT ANALYSIS - WHAT PREVIOUS AGENTS PROVIDED');

    if (!isIsolatedTest) {
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
        'Assembling final React component...',
      tcc
    );
    }

    // ✅ VALIDATE REQUIRED TCC SECTIONS - Ensure previous agents completed their work
    const validationResult = validateTccSections(tcc);
    if (!validationResult.isValid) {
      throw new Error(`Missing required TCC sections: ${validationResult.missingSection}`);
    }

    if (!isIsolatedTest) {
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
        'Preparing component assembly context...',
      tcc
    );
    }

    // ✅ ORIGINAL ELEGANT APPROACH: PROGRAMMATIC COMBINATION of TCC sections
    const assembledComponent = combineTccSections(tcc);

    // ✅ COMPREHENSIVE TCC UPDATE 
    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      assembledComponentCode: assembledComponent.finalComponentCode,
      currentOrchestrationStep: OrchestrationStepEnum.enum.validating_code,
      status: OrchestrationStatusEnum.enum.in_progress,
      steps: {
        ...tcc.steps,
        assemblingComponent: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tcc.steps?.assemblingComponent?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: assembledComponent,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    logger.info({
      jobId,
      assembledCodeLength: assembledComponent.finalComponentCode.length,
      hasImportsInFinalCode: assembledComponent.finalComponentCode.includes('import'),
    }, '🔧 ComponentAssembler: 🔍 TCC Update Debug - storing assembled component code');

    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.assembling_component,
        'completed',
        'Component assembled successfully!',
        updatedTcc
      );
    }

    logger.info({ jobId }, '🔧 ComponentAssembler: Completed successfully');
    return { success: true, assembledComponent, updatedTcc };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🔧 ComponentAssembler: Error');
    
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.assembling_component,
        'failed',
        errorMessage,
        tcc
      );
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * ✅ ORIGINAL DESIGN: Analyze TCC sections accumulated by previous agents
 */
function analyzeTccSections(tcc: ToolConstructionContext) {
  return {
    hasUserId: !!tcc.userId,
    hasJobId: !!tcc.jobId,
    hasBrainstormData: !!tcc.brainstormData,
    hasUserInput: !!tcc.userInput,
    hasStateLogic: !!tcc.stateLogic,
    hasJsxLayout: !!tcc.jsxLayout,
    hasStyling: !!tcc.styling,
    hasResearchData: !!tcc.brainstormData?.researchData,
    currentStep: tcc.currentOrchestrationStep,
    completedSteps: Object.keys(tcc.steps || {}),
    updatedAt: tcc.updatedAt,
    
    // State Logic Analysis
    stateLogicDetails: {
      variableCount: tcc.stateLogic?.variables?.length || 0,
      variableNames: tcc.stateLogic?.variables?.map(v => v.name) || [],
      functionCount: tcc.stateLogic?.functions?.length || 0,
      functionNames: tcc.stateLogic?.functions?.map(f => f.name) || [],
      hasUseStateHooks: !!tcc.stateLogic?.imports?.includes('useState'),
      hookCount: (tcc.stateLogic?.imports || []).filter(imp => imp.includes('use')).length,
      hookNames: (tcc.stateLogic?.imports || []).filter(imp => imp.includes('use'))
    },
    
    // JSX Layout Analysis  
    jsxLayoutDetails: {
      componentStructureLength: tcc.jsxLayout?.componentStructure?.length || 0,
      componentStructurePreview: tcc.jsxLayout?.componentStructure?.substring(0, 200) + '...',
      elementMapCount: tcc.jsxLayout?.elementMap?.length || 0,
      elementTypes: tcc.jsxLayout?.elementMap?.map(e => e.type) || [],
      hasAccessibilityFeatures: !!tcc.jsxLayout?.accessibilityFeatures?.length,
      hasResponsiveBreakpoints: !!tcc.jsxLayout?.responsiveBreakpoints?.length
    },
    
    // Styling Analysis
    stylingDetails: {
      styledComponentCodeLength: tcc.styling?.styledComponentCode?.length || 0,
      styledComponentCodePreview: tcc.styling?.styledComponentCode?.substring(0, 200) + '...',
      hasColorScheme: !!tcc.styling?.colorScheme,
      colorSchemePrimary: tcc.styling?.colorScheme?.primary,
      hasResponsiveFeatures: !!(tcc.styling as any).responsiveFeatures?.length,
      hasAccessibilityFeatures: !!(tcc.styling as any).accessibilityFeatures?.length,
      hasDarkModeSupport: !!(tcc.styling as any).darkModeSupport
    },
    
    // Brainstorm Analysis
    brainstormDetails: {
      hasCoreConcept: !!tcc.brainstormData?.coreConcept,
      hasValueProposition: !!tcc.brainstormData?.valueProposition,
      suggestedInputCount: tcc.brainstormData?.suggestedInputs?.length || 0,
      keyCalculationCount: tcc.brainstormData?.keyCalculations?.length || 0,
      hasResearchOptions: !!tcc.brainstormData?.researchData,
      researchOptionCount: Object.keys(tcc.brainstormData?.researchData || {}).length
    }
  };
}

/**
 * ✅ ORIGINAL DESIGN: Validate that required TCC sections exist
 */
function validateTccSections(tcc: ToolConstructionContext): { isValid: boolean; missingSection?: string } {
  if (!tcc.definedFunctionSignatures?.length) {
    return { isValid: false, missingSection: 'Function signatures (Function Planner output)' };
  }
  
  if (!tcc.stateLogic?.variables?.length) {
    return { isValid: false, missingSection: 'State logic (State Design output)' };
  }
  
  if (!tcc.jsxLayout?.componentStructure) {
    return { isValid: false, missingSection: 'JSX layout (JSX Layout output)' };
  }
  
  if (!tcc.styling?.styledComponentCode) {
    return { isValid: false, missingSection: 'Styling (Tailwind Styling output)' };
  }
  
  return { isValid: true };
}

/**
 * ✅ ORIGINAL ELEGANT DESIGN: Programmatically combine TCC sections into final component
 * This is the INTENDED APPROACH - no AI needed, just intelligent combination!
 */
function combineTccSections(tcc: ToolConstructionContext): AssembledComponent {
  const componentName = generateComponentName(tcc.userInput.description);
  
  // Extract all the accumulated sections
  const imports = extractTccImports(tcc);
  const stateDeclarations = extractStateDeclarations(tcc);
  const functionImplementations = extractFunctionImplementations(tcc);
  const styledJsxCode = extractStyledJsx(tcc);
  
  // ✅ PROGRAMMATIC COMBINATION: Assemble the final component
  const finalComponentCode = `${imports.join('\n')}

function ${componentName}() {
  // State Management (from State Design Agent)
${stateDeclarations.join('\n')}

  // Business Logic Functions (from State Design Agent)  
${functionImplementations.join('\n')}

  // Component Render (from JSX Layout + Tailwind Styling)
  return ${styledJsxCode};
}

export default ${componentName};`;

  return {
    finalComponentCode,
    componentName,
    hooks: extractTccHooks(tcc),
    functions: extractFunctionNames(tcc),
    estimatedLines: finalComponentCode.split('\n').length
  };
}

/**
 * ✅ Extract imports from TCC sections
 */
function extractTccImports(tcc: ToolConstructionContext): string[] {
  const imports = new Set<string>();
  
  // Base React imports
  imports.add("import React from 'react';");
  
  // State logic imports
  if (tcc.stateLogic?.imports) {
    tcc.stateLogic.imports.forEach(imp => imports.add(imp));
  }
  
  // UI component imports (detect from JSX layout)
  const jsxCode = tcc.jsxLayout?.componentStructure || '';
  if (jsxCode.includes('Card')) {
    imports.add("import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';");
  }
  if (jsxCode.includes('Button')) {
    imports.add("import { Button } from '@/components/ui/button';");
  }
  if (jsxCode.includes('Input')) {
    imports.add("import { Input } from '@/components/ui/input';");
  }
  if (jsxCode.includes('Select')) {
    imports.add("import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';");
  }
  if (jsxCode.includes('Slider')) {
    imports.add("import { Slider } from '@/components/ui/slider';");
  }
  
  return Array.from(imports);
}

/**
 * ✅ Extract state declarations from State Design output
 */
function extractStateDeclarations(tcc: ToolConstructionContext): string[] {
  if (!tcc.stateLogic?.variables) return [];
  
  return tcc.stateLogic.variables.map(variable => {
    const variableType = variable.type || 'string';
    const initialValue = variableType.includes('string') ? `"${variable.initialValue}"` : variable.initialValue;
    return `  const [${variable.name}, set${capitalize(variable.name)}] = useState(${initialValue}); // ${variable.description}`;
  });
}

/**
 * ✅ Extract function implementations from State Design output
 */
function extractFunctionImplementations(tcc: ToolConstructionContext): string[] {
  if (!tcc.stateLogic?.functions) return [];
  
  return tcc.stateLogic.functions.map(func => {
    return `  const ${func.name} = () => {
    ${func.body.split('\n').map(line => `    ${line}`).join('\n')}
  };`;
  });
}

/**
 * ✅ Extract styled JSX from JSX Layout + Tailwind Styling
 */
function extractStyledJsx(tcc: ToolConstructionContext): string {
  // Get the base JSX structure
  let jsxCode = tcc.jsxLayout?.componentStructure || '<div>Component structure not available</div>';
  
  // Apply styling from Tailwind Styling agent
  if (tcc.styling?.styledComponentCode) {
    // Extract the JSX from the styled component code
    const styledMatch = tcc.styling.styledComponentCode.match(/return\s+\(([\s\S]*)\);?\s*}?\s*$/);
    if (styledMatch) {
      jsxCode = styledMatch[1].trim();
    }
  }
  
  return jsxCode;
}

/**
 * ✅ Extract hooks used from state logic
 */
function extractTccHooks(tcc: ToolConstructionContext): string[] {
  const hooks = new Set<string>();
  
  if (tcc.stateLogic?.variables?.length) {
    hooks.add('useState');
  }
  
  if (tcc.stateLogic?.functions?.some(f => f.body.includes('useEffect'))) {
    hooks.add('useEffect');
  }
  
  return Array.from(hooks);
}

/**
 * ✅ Extract function names from state logic
 */
function extractFunctionNames(tcc: ToolConstructionContext): string[] {
  return tcc.stateLogic?.functions?.map(f => f.name) || [];
}

/**
 * ✅ Utility: Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Simple fallback when assembly fails
 */
function generateSimpleFallbackComponent(tcc: ToolConstructionContext, jsxCode: string): AssembledComponent {
  const componentName = generateComponentName(tcc.userInput.description);
  const fallbackCode = `import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function ${componentName}() {
  return (
    <Card className="p-4 max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Component Generation In Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <p>This tool is being assembled by our AI system.</p>
        <p>Full functionality will be available shortly.</p>
      </CardContent>
    </Card>
  );
}

export default ${componentName};`;

  return {
    finalComponentCode: fallbackCode,
    componentName,
    hooks: ['useState'],
    functions: [],
    estimatedLines: fallbackCode.split('\n').length
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
  
  // Clean the name: remove special chars, handle spaces properly, limit length
  const cleanedName = name
    .substring(0, 50) // Limit input length to prevent extremely long names
    .replace(/[^a-zA-Z0-9 ]/g, '') // Remove special characters
    .split(/\s+/) // Split on whitespace
    .filter(Boolean) // Remove empty strings
    .slice(0, 3) // Take only first 3 words to keep name reasonable
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