import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/tcc-unified';
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
    .describe('The complete, functional React component code using JSX syntax. Must be executable JavaScript without imports or exports.'),
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

    // Validate we have all required pieces with detailed structure validation
    const missing = [];
    if (!tcc.jsxLayout || !tcc.jsxLayout.componentStructure) {
      missing.push('jsxLayout.componentStructure');
    }
    if (!tcc.stateLogic || !tcc.stateLogic.variables) {
      missing.push('stateLogic.variables');
    }
    if (!tcc.styling || !tcc.styling.styledComponentCode) {
      missing.push('styling.styledComponentCode');
    }
    
    if (missing.length > 0) {
      throw new Error(`Prerequisites missing in TCC: ${missing.join(', ')}`);
    }

    // Additional validation for data integrity
    if (typeof tcc.jsxLayout.componentStructure !== 'string') {
      throw new Error('jsxLayout.componentStructure must be a string');
    }
    if (!Array.isArray(tcc.stateLogic.variables)) {
      throw new Error('stateLogic.variables must be an array');
    }
    if (typeof tcc.styling.styledComponentCode !== 'string') {
      throw new Error('styling.styledComponentCode must be a string');
    }

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
      coreConcept: brainstorm.coreConcept || 'Not specified',
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
      userInputDescription: tcc.userInput.description?.substring(0, 100) + '...',
      toolType: tcc.userInput.toolType || 'Not specified',
      targetAudience: tcc.userInput.targetAudience || 'Not specified'
    }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] ⚠️ NO BRAINSTORM DATA - Component assembly working with minimal context only');
  }

  // Get model configuration
  const { provider, modelId } = getModelForAgent('componentAssembler', selectedModel, tcc);
  logger.info({ provider, modelId }, '🔧 ComponentAssembler: Using model');
  const modelInstance = createModelInstance(provider, modelId);

  const systemPrompt = `You are a React component assembler. Create a complete JSX component that works with the DynamicComponentRenderer.

🚨 CRITICAL OUTPUT REQUIREMENTS:
- Return a JSON object with: finalComponentCode, componentName, hooks, functions, estimatedLines
- finalComponentCode: Complete JSX React component (NOT React.createElement)
- componentName: Valid JavaScript identifier (e.g., "BusinessCalculator")
- hooks: Array of hook names used (e.g., ["useState", "useEffect"]) or empty array
- functions: Array of function names defined or empty array  
- estimatedLines: Number estimate of code lines

✅ REQUIRED FORMAT:
\`\`\`javascript
'use client';

function ComponentName() {
  const [state, setState] = useState(initialValue);
  
  const handleFunction = () => {
    // logic here
  };
  
  return (
    <div className="w-full">
      <Card className="styles" data-style-id="main-card">
        <CardHeader data-style-id="header">
          <CardTitle data-style-id="title">Title</CardTitle>
        </CardHeader>
        <CardContent data-style-id="content">
          {/* JSX content */}
        </CardContent>
      </Card>
    </div>
  );
}
\`\`\`

🚨 CRITICAL JSX RULE:
- The return statement MUST have exactly ONE root element
- If you need multiple elements, wrap them in a single div or React Fragment
- NEVER return adjacent JSX elements without a wrapper

🚨 CRITICAL REQUIREMENTS:
- Add data-style-id attribute to EVERY JSX element for dynamic styling
- Use descriptive IDs like "main-card", "input-revenue", "button-calculate"
- Avoid variable name collisions in calculations (use abbreviated names: rev, income, etc.)

❌ FORBIDDEN:
- NO import statements (dependencies auto-injected)
- NO export statements  
- NO React.createElement syntax
- NO TypeScript (interface, React.FC, type annotations)
- NO undefined component usage

✅ AVAILABLE COMPONENTS (use directly without imports):
React, useState, useEffect, useCallback, useMemo, 
Button, Input, Label, Textarea,
Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent,
Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel, SelectSeparator,
RadioGroup, RadioGroupItem, Checkbox, Slider, Switch,
Accordion, AccordionContent, AccordionItem, AccordionTrigger,
Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Progress,
AlertCircle, Loader2, Info,
BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, RechartsTooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar, ComposedChart, Scatter, ScatterChart

RULES:
1. Start with 'use client';
2. Use standard JSX syntax
3. Use function declarations (not arrow functions)
4. No import/export statements
5. End with just the function definition`;

  // Generate component name with debugging
  const suggestedComponentName = generateComponentName(tcc.userInput.description);
  logger.info({
    tccJobId: tcc.jobId,
    originalDescription: tcc.userInput.description,
    suggestedComponentName,
    hasStyledCode: !!tcc.styling?.styledComponentCode,
    hasJsxLayout: !!tcc.jsxLayout?.componentStructure,
    hasStateLogic: !!tcc.stateLogic,
    stateVariablesCount: tcc.stateLogic?.variables?.length || 0,
    stateFunctionsCount: tcc.stateLogic?.functions?.length || 0
  }, '🔧 ComponentAssembler: 🔍 Input data analysis');

  const userPrompt = `Create a complete working React component using the following specifications.

Component Name: ${suggestedComponentName}

STATE LOGIC (implement these variables and functions):
\`\`\`json
${JSON.stringify(tcc.stateLogic, null, 2)}
\`\`\`

STYLED JSX STRUCTURE (complete JSX with Tailwind classes applied):
\`\`\`jsx
${tcc.styling.styledComponentCode}
\`\`\`

ELEMENT MAPPING (for data-style-id attributes):
\`\`\`json
${JSON.stringify(tcc.styling.styleMap || {}, null, 2)}
\`\`\`

REQUIRED OUTPUT: Generate a complete, working React component that:
1. Starts with 'use client';
2. Uses function declaration: function ${suggestedComponentName}() {
3. Implements ALL state variables from STATE LOGIC using useState
4. Implements ALL functions from STATE LOGIC with proper logic
5. Uses the STYLED JSX STRUCTURE as the return JSX (modify as needed)
6. Applies data-style-id attributes from ELEMENT MAPPING
7. Define ALL referenced arrays/variables (businessSizes, etc.) with realistic data
8. Uses only AVAILABLE COMPONENTS listed above
9. Has proper event handlers connecting to state functions
10. No imports or exports - everything self-contained

CRITICAL REQUIREMENTS:
- The return statement MUST have exactly ONE root element (wrap in <div> if needed)
- Every state variable in STATE LOGIC must have corresponding useState hook
- Every function in STATE LOGIC must be implemented as a proper function
- All referenced data arrays must be defined with realistic values
- Use the STYLED JSX STRUCTURE but ensure single root element
- Apply data-style-id attributes for dynamic styling
- NEVER return adjacent JSX elements - always wrap in container

EXAMPLE OF CORRECT JSX WRAPPING:
If your styled JSX has multiple cards like:
<Card>...</Card>
<Card>...</Card>

You MUST wrap them:
return (
  <div className="space-y-6">
    <Card>...</Card>
    <Card>...</Card>
  </div>
);

The component should be fully functional and ready to run in the DynamicComponentRenderer.`;

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
    // CRITICAL FIX: Send progress update before starting AI generation
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
      'Generating component with AI - this may take 1-2 minutes...',
      tcc
    );

    const { object } = await generateObject({
      model: modelInstance,
      schema: assembledComponentSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.1,
      maxTokens: 8192,
    });
    
    // CRITICAL FIX: Send progress update after AI generation completes
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
      'AI generation complete, post-processing component...',
      tcc
    );
    
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
    console.log('\nComponent Name:');
    console.log(object.componentName);
    console.log('\nHooks:');
    console.log(JSON.stringify(object.hooks || [], null, 2));
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
      
      // Strip any lines that start with an export statement (simpler & more robust)
      const cleanedLines = finalCode.split('\n').filter(line => !line.trim().startsWith('export '));
      let cleanedCode = cleanedLines.join('\n');
      
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

    // Post-process to fix variable name collisions (e.g., using 'revenue' as both state and local variable)
    const hasVariableCollisions = finalCode.match(/const\s+(\w+)\s*=\s*Number\(\1\)/g);
    
    if (hasVariableCollisions) {
      logger.warn({
        tccJobId: tcc.jobId,
        provider,
        modelId,
        collisions: hasVariableCollisions
      }, '🔧 ComponentAssembler: ⚠️ AI generated variable name collisions! Auto-fixing...');
      
      // Fix variable collisions by using abbreviated variable names
      let fixedCode = finalCode;
      
      // Pattern: const revenue = Number(revenue) becomes const rev = Number(revenue)
      // Use abbreviated names to avoid conflicts
      const varMap: Record<string, string> = {
        'revenue': 'rev',
        'netIncome': 'income',
        'currentAssets': 'assets',
        'currentLiabilities': 'liabilities',
        'totalLiabilities': 'totalLiabs',
        'shareholdersEquity': 'equity'
      };
      
      // Replace each collision with a safe variable name
      hasVariableCollisions.forEach(collision => {
        const match = collision.match(/const\s+(\w+)\s*=\s*Number\(\1\)/);
        if (match) {
          const varName = match[1];
          const safeVarName = varMap[varName] || `${varName}Val`;
          
          // Replace the collision declaration
          fixedCode = fixedCode.replace(
            new RegExp(`const\\s+${varName}\\s*=\\s*Number\\(${varName}\\)`, 'g'),
            `const ${safeVarName} = Number(${varName})`
          );
          
          // Replace variable usage in calculations (within the same function block)
          // Look for arithmetic operations where the variable is used
          fixedCode = fixedCode.replace(
            new RegExp(`(\\b${varName}\\b)(?=\\s*[+\\-*/])`, 'g'),
            safeVarName
          );
          fixedCode = fixedCode.replace(
            new RegExp(`([+\\-*/]\\s*)(\\b${varName}\\b)`, 'g'),
            `$1${safeVarName}`
          );
        }
      });
      
      finalCode = fixedCode;
      
      console.log('\n' + '🔄'.repeat(40));
      console.log('🔧 ComponentAssembler: FIXED - Variable name collisions:');
      console.log('🔄'.repeat(40));
      console.log('FIXED CODE:');
      console.log(finalCode);
      console.log('🔄'.repeat(40) + '\n');
      
      // Update the object
      object.finalComponentCode = finalCode;
    }

    // Post-process to add missing data-style-id attributes for dynamic styling
    const missingDataStyleIds = !finalCode.includes('data-style-id');
    
    if (missingDataStyleIds) {
      logger.warn({
        tccJobId: tcc.jobId,
        provider,
        modelId
      }, '🔧 ComponentAssembler: ⚠️ AI generated JSX without data-style-id attributes! These are needed for dynamic styling.');
      
      // This is a warning only - the styling system should handle missing IDs gracefully
      // We don't auto-fix this as it would require complex JSX parsing
    }

    // Extract actual hooks and functions from the generated code for accuracy
    const actualHooks = extractHooks(finalCode);
    const actualFunctions = extractFunctions(finalCode);
    
    // Update the object with extracted data for accuracy
    object.hooks = actualHooks;
    object.functions = actualFunctions;
    object.estimatedLines = finalCode.split('\n').length;

    // Log final code length and imports check for debugging
    logger.info({
      jobId: tcc.jobId,
      assembledCodeLength: finalCode.length,
      hasImportsInFinalCode: finalCode.includes('import '),
      hasExportsInFinalCode: finalCode.includes('export '),
      extractedHooks: actualHooks,
      extractedFunctions: actualFunctions,
      actualLines: object.estimatedLines
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

function getModelForAgent(agentName: string, selectedModel?: string, tcc?: ToolConstructionContext): { provider: string; modelId: string } {
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

    // PRIORITY 5: Final hardcoded fallback (indicates configuration problem)
    logger.error({ 
        agentName, 
        selectedModel,
        tccAgentMapping: tcc?.agentModelMapping ? Object.keys(tcc.agentModelMapping) : 'No TCC provided',
        source: 'HARDCODED_FALLBACK' 
    }, '🔧 ComponentAssembler: 🚨 CRITICAL: No model configuration found! Using hardcoded fallback - check model configuration!');
    return { provider: 'openai', modelId: 'gpt-4o' }; // Final fallback
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

function ${componentName}() {
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
            <p className="text-red-700 text-sm mb-2">The AI model failed to generate the component code. This is a fallback error component.</p>
            <p className="text-red-600 text-xs">Timestamp: ${timestamp}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-red-800">Requested Tool:</h4>
            <p className="text-sm text-red-700">${tcc.userInput.description}</p>
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 text-xs font-medium">⚠️ This is a system-generated fallback component indicating an error in the AI generation process.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}`,
    componentName: `${componentName}_ERROR_FALLBACK`,
    hooks: [], // Fallback component doesn't use hooks
    functions: [componentName], // The main component function
    estimatedLines: 25
  };
} 
