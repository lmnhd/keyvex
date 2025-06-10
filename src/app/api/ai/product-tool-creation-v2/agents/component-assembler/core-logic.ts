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
  finalComponentCode: z.string().describe('The complete, single string of final React component code WITHOUT any import statements.'),
  imports: z.array(z.string()).describe('An empty array - no imports are used since all components are available in execution context.'),
  hooks: z.array(z.string()).describe('An array of React hooks used in the component (e.g., ["useState", "useEffect"]).'),
  functions: z.array(z.string()).describe('An array of functions defined within the component.'),
  metadata: z.object({
    componentName: z.string().describe('The name of the generated component.'),
    dependencies: z.array(z.string()).describe('An empty array - no external dependencies needed since components are injected.'),
    estimatedLines: z.number().describe('An estimate of the total lines of code.'),
  }),
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

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
      'Assembling final React component...',
      tcc // Pass TCC with userId
    );

    // Assemble the component with AI
    const assembledComponent = await generateAssembledComponent(
      tcc,
      selectedModel,
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
async function generateAssembledComponent(tcc: ToolConstructionContext, selectedModel?: string): Promise<AssembledComponent> {
  // 🔍 DEBUG: Log brainstorm data structure for debugging
  logger.info({ 
    jobId: tcc.jobId,
    hasBrainstormData: !!tcc.brainstormData,
    brainstormDataKeys: tcc.brainstormData ? Object.keys(tcc.brainstormData) : [],
    brainstormDataSize: tcc.brainstormData ? JSON.stringify(tcc.brainstormData).length : 0
  }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Available brainstorm data structure');

  if (tcc.brainstormData) {
    const brainstorm = tcc.brainstormData;
    logger.info({ 
      jobId: tcc.jobId,
      coreConcept: brainstorm.coreConcept || brainstorm.coreWConcept || 'Not specified',
      valueProposition: brainstorm.valueProposition || 'Not specified',
      suggestedInputsCount: brainstorm.suggestedInputs?.length || 0,
      keyCalculationsCount: brainstorm.keyCalculations?.length || 0,
      interactionFlowCount: brainstorm.interactionFlow?.length || 0,
      hasLeadCaptureStrategy: !!brainstorm.leadCaptureStrategy,
      hasCalculationLogic: !!brainstorm.calculationLogic && brainstorm.calculationLogic.length > 0
    }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Detailed brainstorm data analysis');

    // Log specific brainstorm fields that could influence component assembly
    if (brainstorm.keyCalculations && brainstorm.keyCalculations.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        keyCalculations: brainstorm.keyCalculations.map(calc => ({
          name: calc.name,
          formula: calc.formula?.substring(0, 100) + (calc.formula?.length > 100 ? '...' : ''),
          description: calc.description?.substring(0, 100) + (calc.description?.length > 100 ? '...' : '')
        }))
      }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Key calculations that should be implemented');
    }

    if (brainstorm.calculationLogic && brainstorm.calculationLogic.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        calculationLogic: brainstorm.calculationLogic.map(logic => ({
          name: logic.name,
          formula: logic.formula?.substring(0, 100) + (logic.formula?.length > 100 ? '...' : '')
        }))
      }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Calculation logic for function implementation');
    }

    if (brainstorm.interactionFlow && brainstorm.interactionFlow.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        interactionFlow: brainstorm.interactionFlow.map(step => ({
          step: step.step,
          title: step.title,
          userAction: step.userAction?.substring(0, 100) + (step.userAction?.length > 100 ? '...' : '')
        }))
      }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Interaction flow for user experience');
    }
  } else {
    logger.warn({ 
      jobId: tcc.jobId,
      userInputDescription: tcc.userInput?.description?.substring(0, 100) + '...',
      toolType: tcc.userInput?.toolType || 'Not specified',
      targetAudience: tcc.userInput?.targetAudience || 'Not specified'
    }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] ⚠️ NO BRAINSTORM DATA - Component assembly working with minimal context only');
  }

  // Get model configuration
  const { provider, modelId } = getModelForAgent('componentAssembler', selectedModel);
  logger.info({ provider, modelId }, '🔧 ComponentAssembler: Using model');
  const modelInstance = createModelInstance(provider, modelId);

  const systemPrompt = `You are an expert React component assembler. Combine the provided layout structure, state logic, and styling into a single, complete, and functional React component.

❌ ABSOLUTELY FORBIDDEN - DO NOT DO THESE THINGS:
- DO NOT include any import statements (import React, import { Button }, etc.)
- DO NOT include any export statements (export default, export const, etc.)
- DO NOT import from 'some-ui-library' or any other library
- DO NOT import react-icons or any external packages
- DO NOT write: import React, { useState } from 'react';
- DO NOT write: import { Card, Button } from 'any-library';
- DO NOT write: export default ComponentName;
- DO NOT write: export const ComponentName = ...;
- DO NOT use JSX syntax with < > brackets (e.g., <div>, <Card>, <Button>)
- DO NOT write JSX like: <Card><CardHeader><CardTitle>Title</CardTitle></CardHeader></Card>
- DO NOT use TypeScript interface declarations (interface MyProps {})
- DO NOT use TypeScript type annotations (React.FC<MyProps>, const x: string)
- DO NOT use generic type parameters (<number>, <string>, etc.)

✅ WHAT YOU MUST DO INSTEAD:
- Generate pure JavaScript code that can execute directly
- Use ONLY React.createElement() syntax - NO JSX allowed
- Start the component code directly with the function declaration
- End the component code with just the function definition - NO export statements
- Use components directly as if they are globally available
- All React hooks and ShadCN components are already in scope

EXECUTION CONTEXT - THESE ARE AVAILABLE WITHOUT IMPORTS:
React: React (the React object itself)
Hooks: useState, useEffect, useCallback, useMemo
UI Components: Card, CardHeader, CardContent, CardTitle, CardDescription, Button, Input, Label, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Textarea, Progress, RadioGroup, RadioGroupItem, Checkbox, Slider, Switch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, Accordion, AccordionContent, AccordionItem, AccordionTrigger
Icons: Info, AlertCircle, Loader2

CORRECT COMPONENT STRUCTURE EXAMPLE (Pure JavaScript with React.createElement):
\`\`\`javascript
'use client';

const Calculator = () => {
  const [value, setValue] = useState(0);

  return React.createElement(Card, { 'data-style-id': 'calculator-card' }, [
    React.createElement(CardHeader, { 'data-style-id': 'calculator-header', key: 'header' }, [
      React.createElement(CardTitle, { 'data-style-id': 'calculator-title', key: 'title' }, 'Calculator')
    ]),
    React.createElement(CardContent, { 'data-style-id': 'calculator-content', key: 'content' }, [
      React.createElement(Button, {
        onClick: () => setValue(v => v + 1),
        'data-style-id': 'increment-button',
        key: 'increment-btn'
      }, 'Increment')
    ])
  ]);
};

// NO EXPORT STATEMENTS - Component will be accessed directly by name
\`\`\`

CRITICAL REQUIREMENTS:
1. Create COMPLETE, FUNCTIONAL JavaScript React component code using ONLY React.createElement() calls
2. Apply ALL styling from the styleMap to correct elements using 'className' prop
3. Integrate ALL state variables and functions from the state logic
4. Ensure ALL function signatures from state logic are implemented correctly
5. Use pure JavaScript without TypeScript syntax
6. Add 'data-style-id' attributes to ALL React.createElement calls for styling
7. Add 'key' props to ALL array elements to prevent React warnings
8. Return a single JSON object that strictly conforms to the provided schema
9. The finalComponentCode field must contain executable JavaScript React component code
10. Start with 'use client'; directive for Next.js compatibility
11. END WITH JUST THE FUNCTION DEFINITION - NO export statements

CRITICAL FUNCTION ORDERING: Define ALL helper functions (like formatCurrency, validateInputs, etc.) 
BEFORE any JSX that uses them. JavaScript function declarations are hoisted, but const/arrow 
functions are NOT hoisted in execution contexts. Structure your component like this:

const ComponentName = () => {
  // 1. State variables first
  const [state, setState] = useState(initial);
  
  // 2. Helper functions next (before JSX that calls them)
  const helperFunction = (param) => {
    // function logic
  };
  
  // 3. Event handlers and main functions
  const handleEvent = () => {
    // can call helperFunction safely
  };
  
  // 4. JSX return statement last
  return React.createElement(...);
};

REMEMBER: 
- Generate PURE JAVASCRIPT - No TypeScript interfaces, types, or annotations!
- No imports allowed - everything is available in execution context!
- NO JSX SYNTAX - Use React.createElement() only!
- NO EXPORT STATEMENTS - Component accessed directly by name!
- Every element needs data-style-id for dynamic styling!`;

  // Generate component name with debugging
  const suggestedComponentName = generateComponentName(tcc.userInput.description);
  logger.info({
    tccJobId: tcc.jobId,
    originalDescription: tcc.userInput.description,
    suggestedComponentName,
    hasStyledCode: !!(tcc as any).styling?.styledComponentCode,
    hasJsxLayout: !!tcc.jsxLayout?.componentStructure,
    hasStateLogic: !!tcc.stateLogic
  }, '🔧 ComponentAssembler: 🔍 Input data analysis');

  const userPrompt = `Please assemble the React component using the following parts.

Component Name Suggestion: ${suggestedComponentName}

STYLED JSX CODE (complete JSX with Tailwind classes already applied):
\`\`\`jsx
${(tcc as any).styling?.styledComponentCode || tcc.jsxLayout?.componentStructure || 'No styled code available'}
\`\`\`

STATE LOGIC (the brains and functionality):
\`\`\`json
${JSON.stringify(tcc.stateLogic, null, 2)}
\`\`\`

STYLE MAP (for reference - element IDs to classes):
\`\`\`json
${JSON.stringify((tcc as any).styling?.styleMap, null, 2)}
\`\`\`

Convert the styled JSX above to React.createElement() syntax and integrate with the state logic. Generate the complete JSON object containing the final component code WITHOUT imports and using the available components from the execution context.`;

  // Log prompts with proper formatting for debugging
  logger.info({
    tccJobId: tcc.jobId,
    provider,
    modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length
  }, '🔧 ComponentAssembler: 📝 Sending prompts to AI (see formatted output below)');
  
  // Output formatted prompts to console for easy reading
  console.log('\n' + '='.repeat(80));
  console.log('🔧 ComponentAssembler SYSTEM PROMPT:');
  console.log('='.repeat(80));
  console.log(systemPrompt);
  console.log('='.repeat(80));
  console.log('🔧 ComponentAssembler USER PROMPT:'); 
  console.log('='.repeat(80));
  console.log(userPrompt);
  console.log('='.repeat(80) + '\n');

  try {
    const { object } = await generateObject({
      model: modelInstance,
      schema: assembledComponentSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.1,
      maxTokens: 8192,
    });
    logger.info({ 
      tccJobId: tcc.jobId, 
      provider, 
      modelId 
    }, '🔧 ComponentAssembler: ✅ AI generation successful');

    // Log the AI response for debugging
    console.log('\n' + '='.repeat(80));
    console.log('🔧 ComponentAssembler AI RESPONSE:');
    console.log('='.repeat(80));
    console.log('Component Code:');
    console.log(object.finalComponentCode);
    console.log('\nImports (should be empty):');
    console.log(JSON.stringify(object.imports, null, 2));
    console.log('='.repeat(80) + '\n');

    // Post-process to automatically remove import statements if AI ignored instructions
    let finalCode = object.finalComponentCode;
    const hasImports = finalCode.includes('import ');
    
    if (hasImports) {
      logger.warn({
        tccJobId: tcc.jobId,
        provider,
        modelId
      }, '🔧 ComponentAssembler: ⚠️ AI generated imports despite instructions! Auto-removing...');
      
      // Remove import lines
      const lines = finalCode.split('\n');
      const filteredLines = lines.filter(line => !line.trim().startsWith('import '));
      finalCode = filteredLines.join('\n');
      
      console.log('\n' + '⚠️'.repeat(40));
      console.log('🔧 ComponentAssembler: FIXED - Removed import statements:');
      console.log('⚠️'.repeat(40));
      console.log('CLEANED CODE:');
      console.log(finalCode);
      console.log('⚠️'.repeat(40) + '\n');
      
      // Update the object
      object.finalComponentCode = finalCode;
      object.imports = []; // Clear imports array
    }

    // Post-process to automatically remove TypeScript syntax if AI ignored instructions
    const hasTypeScriptSyntax = finalCode.includes('interface ') || finalCode.includes(': React.FC') || finalCode.includes('<string>') || finalCode.includes('<number>');
    
    if (hasTypeScriptSyntax) {
      logger.warn({
        tccJobId: tcc.jobId,
        provider,
        modelId
      }, '🔧 ComponentAssembler: ⚠️ AI generated TypeScript syntax despite instructions! Auto-removing...');
      
      // Strip TypeScript syntax
      let strippedCode = finalCode;
      
      // Remove interface declarations entirely
      strippedCode = strippedCode.replace(/interface\s+\w+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
      
      // Remove React.FC type annotations
      strippedCode = strippedCode.replace(/:\s*React\.FC\s*<[^>]*>/g, '');
      strippedCode = strippedCode.replace(/:\s*FC\s*<[^>]*>/g, '');
      
      // Remove type annotations from function parameters
      strippedCode = strippedCode.replace(/(\w+)\s*:\s*[^,)=]+/g, '$1');
      
      // Remove generic type parameters
      strippedCode = strippedCode.replace(/<[^<>]*(?:<[^<>]*>[^<>]*)*>/g, '');
      
      // Clean up any double spaces or empty lines
      strippedCode = strippedCode
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .replace(/  +/g, ' ')
        .trim();
      
      finalCode = strippedCode;
      
      console.log('\n' + '🔧'.repeat(40));
      console.log('🔧 ComponentAssembler: FIXED - Removed TypeScript syntax:');
      console.log('🔧'.repeat(40));
      console.log('JAVASCRIPT CODE:');
      console.log(finalCode);
      console.log('🔧'.repeat(40) + '\n');
      
      // Update the object
      object.finalComponentCode = finalCode;
    }

    // Post-process to automatically remove export statements if AI ignored instructions
    const hasExportStatements = finalCode.includes('export ');
    
    if (hasExportStatements) {
      logger.warn({
        tccJobId: tcc.jobId,
        provider,
        modelId
      }, '🔧 ComponentAssembler: ⚠️ AI generated export statements despite instructions! Auto-removing...');
      
      // Strip export statements
      let cleanedCode = finalCode;
      
      // Remove export default statements
      cleanedCode = cleanedCode.replace(/export\s+default\s+\w+\s*;?\s*$/gm, '');
      
      // Remove export const/let/var statements
      cleanedCode = cleanedCode.replace(/export\s+(const|let|var)\s+/g, '$1 ');
      
      // Remove standalone export statements
      cleanedCode = cleanedCode.replace(/export\s*\{[^}]*\}\s*;?\s*$/gm, '');
      
      // Clean up any trailing empty lines
      cleanedCode = cleanedCode.replace(/\n\s*\n\s*$/g, '\n').trim();
      
      finalCode = cleanedCode;
      
      console.log('\n' + '🚫'.repeat(40));
      console.log('🔧 ComponentAssembler: FIXED - Removed export statements:');
      console.log('🚫'.repeat(40));
      console.log('CLEANED CODE:');
      console.log(finalCode);
      console.log('🚫'.repeat(40) + '\n');
      
      // Update the object
      object.finalComponentCode = finalCode;
    }

    // Log final code length and imports check for debugging
    logger.info({
      jobId: tcc.jobId,
      assembledCodeLength: finalCode.length,
      hasImportsInFinalCode: finalCode.includes('import '),
      hasExportsInFinalCode: finalCode.includes('export '),
    }, '🔧 ComponentAssembler: 🔍 TCC Update Debug - storing assembled component code');

    return object;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error), 
      provider, 
      modelId,
      tccJobId: tcc.jobId,
      userDescription: tcc.userInput.description 
    }, '🔧 ComponentAssembler: 🚨 AI GENERATION FAILED - Returning ERROR FALLBACK component');
    
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

function getModelForAgent(agentName: string, selectedModel?: string): { provider: string; modelId: string } {
    // PRIORITY 1: User-selected model from UI (highest priority)
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
            }, '🔧 ComponentAssembler: User-selected model has unknown provider, falling back to config');
        }
    }

    // PRIORITY 2: Primary model from configuration
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

    // PRIORITY 3: Fallback model from configuration
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

    // PRIORITY 4: Final hardcoded fallback (indicates configuration problem)
    logger.error({ 
        agentName, 
        selectedModel,
        source: 'HARDCODED_FALLBACK' 
    }, '🔧 ComponentAssembler: 🚨 CRITICAL: No model configuration found! Using hardcoded fallback - check model configuration!');
    return { provider: 'openai', modelId: 'gpt-4o' }; // Final fallback
}

/**
 * Generate component name from user input
 */
function generateComponentName(userInput: string): string {
  const name = userInput || 'Tool';
  const cleanedName = name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '');
  
  // Handle empty/corrupted names
  if (!cleanedName || cleanedName.length === 0) {
    return 'GeneratedTool';
  }
  
  // Ensure name starts with a letter (not number)
  const finalName = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
  
  // Additional safety check - ensure it's a valid JavaScript identifier
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(finalName)) {
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
    finalComponentCode: `interface ${componentName}Props {}

const ${componentName}: React.FC<${componentName}Props> = () => {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Card className="border-red-500 bg-red-50">
        <CardHeader className="bg-red-100 border-b border-red-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <CardTitle className="text-red-800">🚨 COMPONENT GENERATION FAILED</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="bg-red-100 border border-red-300 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">ERROR: AI Component Assembly Failed</h3>
            <p className="text-red-700 text-sm mb-2">
              The AI model failed to generate the component code. This is a fallback error component.
            </p>
            <p className="text-red-600 text-xs">
              Timestamp: ${timestamp}
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-red-800">Requested Tool:</h4>
            <p className="text-sm text-red-700">${tcc.userInput.description}</p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-red-800">What to do:</h4>
            <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
              <li>Try regenerating the tool</li>
              <li>Check if the AI service is available</li>
              <li>Simplify your tool description</li>
              <li>Contact support if the issue persists</li>
            </ul>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 text-xs font-medium">
              ⚠️ This is a system-generated fallback component indicating an error in the AI generation process.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ${componentName};`,
    imports: [], // No imports - all components are available in execution context
    hooks: [],
    functions: [],
    metadata: {
      componentName: `${componentName}_ERROR_FALLBACK`,
      dependencies: [], // No external dependencies needed
      estimatedLines: 45
    }
  };
} 