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
 * Use AI to generate the assembled component based on existing TCC parts
 */
async function generateAssembledComponent(tcc: ToolConstructionContext, jobId: string, selectedModel?: string): Promise<AssembledComponent> {
  // Get model configuration
  const { provider, modelId } = getModelForAgent('componentAssembler', selectedModel, tcc);
  logger.info({ provider, modelId }, '🔧 ComponentAssembler: Using model');
  const modelInstance = createModelInstance(provider, modelId);

  // ✅ ENHANCED SIMPLIFIED PROMPT - BALANCE BETWEEN FUNCTIONALITY AND COMPLIANCE
  const systemPrompt = `You are a React component assembler. Convert provided JSX to React.createElement syntax AND implement full functionality.

🚨 CRITICAL: Your response MUST be valid JSON matching this EXACT schema:
{
  "finalComponentCode": "string - complete React component using React.createElement syntax",
  "componentName": "string - component name like 'TripPlanner'", 
  "hooks": ["array of hook names like useState, useEffect"],
  "functions": ["array of function names defined in component"],
  "estimatedLines": 50
}

ESSENTIAL REQUIREMENTS:
1. Add 'use client'; at the start
2. Use React.createElement() for ALL elements  
3. Implement ALL state variables from State Logic Agent
4. Implement ALL calculation functions from State Logic Agent
5. Connect ALL buttons to actual event handlers (onClick: handleFunction)
6. Add useState hooks for ALL input fields
7. Include ALL suggested inputs from brainstorm data
8. NO import/export statements
9. Return ONLY valid JSON, nothing else

CRITICAL: This is a FUNCTIONAL tool, not a static display. Users must be able to interact with inputs and see calculated results.`;

  // ✅ ENHANCED USER PROMPT - INCLUDE STATE LOGIC AND BRAINSTORM CONTEXT
  const componentName = generateComponentName(tcc.userInput.description);
  const styledCode = (tcc as any).styling?.styledComponentCode || tcc.jsxLayout?.componentStructure || 'No code available';
  
  // Get state logic details for implementation guidance
  const stateVariables = tcc.stateLogic?.variables || [];
  const stateFunctions = tcc.stateLogic?.functions || [];
  const suggestedInputs = tcc.brainstormData?.suggestedInputs || [];
  
  const userPrompt = `Convert this JSX to React.createElement format AND implement full functionality:

Component Name: ${componentName}

MUST IMPLEMENT - State Variables (${stateVariables.length}):
${stateVariables.map(v => `- ${v.name}: ${v.type} (${v.description})`).join('\n')}

MUST IMPLEMENT - Calculation Functions (${stateFunctions.length}):
${stateFunctions.map(f => `- ${f.name}(): ${f.description}`).join('\n')}

MUST IMPLEMENT - ALL Input Fields (${suggestedInputs.length}):
${suggestedInputs.map(input => `- ${input.label} (${input.type}): ${input.description}`).join('\n')}

JSX Code to Convert:
\`\`\`jsx
${styledCode.substring(0, 4000)}${styledCode.length > 4000 ? '\n...(truncated)' : ''}
\`\`\`

CRITICAL: Implement useState for EVERY input, onClick handlers for ALL buttons, and calculation functions that update state.
Return valid JSON only.`;

  // Log enhanced prompts
  logger.info({
    tccJobId: tcc.jobId,
    provider,
    modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    totalPromptSize: systemPrompt.length + userPrompt.length,
    stateVariableCount: stateVariables.length,
    functionCount: stateFunctions.length,
    suggestedInputCount: suggestedInputs.length
  }, '🔧 ComponentAssembler: 📝 ENHANCED PROMPTS - Balanced functionality + JSON compliance');

  try {
    // CRITICAL FIX: Send progress update before starting AI generation
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
      'Generating component with AI - using simplified prompts...',
      tcc
    );

    // SIMPLIFIED GENERATION: Single attempt with clear JSON schema focus
    logger.info({
      jobId: tcc.jobId,
      provider,
      modelId,
      approach: 'simplified_single_attempt'
    }, '🔧 ComponentAssembler: Attempting simplified AI generation');

    const result = await generateObject({
      model: modelInstance,
      schema: assembledComponentSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.1,
      maxTokens: 4096  // Reduced token limit to force concise responses
    });
    
    if (!result.object || !result.object.finalComponentCode) {
      throw new Error('Generated object is missing required finalComponentCode field');
    }
    
    const object = result.object;
    
    logger.info({ 
      tccJobId: tcc.jobId, 
      provider, 
      modelId,
      codeLength: object.finalComponentCode.length,
      approach: 'simplified_generation_success'
    }, '🔧 ComponentAssembler: ✅ SIMPLIFIED generation successful');

    // Basic cleanup if needed
    let finalCode = object.finalComponentCode;
    
    // Remove imports if present
    if (finalCode.includes('import ')) {
      const lines = finalCode.split('\n');
      finalCode = lines.filter(line => !line.trim().startsWith('import ')).join('\n');
      object.finalComponentCode = finalCode;
    }

    // Log final result
    logger.info({
      jobId: tcc.jobId,
      componentName: object.componentName,
      codeLength: finalCode.length,
      hooksCount: object.hooks?.length || 0,
      functionsCount: object.functions?.length || 0
    }, '🔧 ComponentAssembler: 🔍 Final component assembled');

    return object;
    
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error), 
      provider, 
      modelId,
      tccJobId: tcc.jobId,
      approach: 'simplified_generation_failed'
    }, '🔧 ComponentAssembler: 🚨 SIMPLIFIED generation failed - using fallback');
    
    // Emit a warning about fallback usage
    await emitStepProgress(
      tcc.jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
      '⚠️ AI generation failed, using error fallback component...',
      tcc
    );
    
    return generateFallbackComponent(tcc);
  }
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

/**
 * Generate fallback component when AI parsing fails
 */
function generateFallbackComponent(tcc: ToolConstructionContext): AssembledComponent {
  const componentName = generateComponentName(tcc.userInput.description);
  const timestamp = new Date().toISOString();
  
  return {
    finalComponentCode: `'use client';

const ${componentName} = () => {
  return React.createElement('div', { 
    className: 'p-8 max-w-2xl mx-auto',
    'data-style-id': 'error-container'
  }, [
    React.createElement(Card, { 
      className: 'border-red-500 bg-red-50',
      'data-style-id': 'error-card',
      key: 'error-card'
    }, [
      React.createElement(CardHeader, { 
        className: 'bg-red-100 border-b border-red-200',
        'data-style-id': 'error-header',
        key: 'header'
      }, [
        React.createElement('div', { 
          className: 'flex items-center space-x-2',
          key: 'header-content'
        }, [
          React.createElement(AlertCircle, { 
            className: 'h-6 w-6 text-red-600',
            key: 'icon'
          }),
          React.createElement(CardTitle, { 
            className: 'text-red-800',
            key: 'title'
          }, '🚨 COMPONENT GENERATION FAILED')
        ])
      ]),
      React.createElement(CardContent, { 
        className: 'p-6 space-y-4',
        'data-style-id': 'error-content',
        key: 'content'
      }, [
        React.createElement('div', { 
          className: 'bg-red-100 border border-red-300 rounded-lg p-4',
          key: 'error-details'
        }, [
          React.createElement('h3', { 
            className: 'font-semibold text-red-800 mb-2',
            key: 'error-title'
          }, 'ERROR: AI Component Assembly Failed'),
          React.createElement('p', { 
            className: 'text-red-700 text-sm mb-2',
            key: 'error-description'
          }, 'The AI model failed to generate the component code. This is a fallback error component.'),
          React.createElement('p', { 
            className: 'text-red-600 text-xs',
            key: 'timestamp'
          }, 'Timestamp: ${timestamp}')
        ]),
        React.createElement('div', { 
          className: 'space-y-2',
          key: 'tool-info'
        }, [
          React.createElement('h4', { 
            className: 'font-medium text-red-800',
            key: 'tool-title'
          }, 'Requested Tool:'),
          React.createElement('p', { 
            className: 'text-sm text-red-700',
            key: 'tool-description'
          }, '${tcc.userInput.description}')
        ]),
        React.createElement('div', { 
          className: 'mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded',
          key: 'warning'
        }, [
          React.createElement('p', { 
            className: 'text-yellow-800 text-xs font-medium',
            key: 'warning-text'
          }, '⚠️ This is a system-generated fallback component indicating an error in the AI generation process.')
        ])
      ])
    ])
  ]);
};`,
    componentName: `${componentName}_ERROR_FALLBACK`,
    hooks: [],
    functions: [],
    estimatedLines: 45
  };
} 