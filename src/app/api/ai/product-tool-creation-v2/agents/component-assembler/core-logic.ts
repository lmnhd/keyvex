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
    const brainstormData = tcc.brainstormData;
    logger.info({ 
      jobId: tcc.jobId,
      coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept || 'Not specified',
      valueProposition: brainstormData.valueProposition || 'Not specified',
      suggestedInputsCount: brainstormData.suggestedInputs?.length || 0,
      keyCalculationsCount: brainstormData.keyCalculations?.length || 0,
      interactionFlowCount: brainstormData.interactionFlow?.length || 0,
      hasLeadCaptureStrategy: !!brainstormData.leadCaptureStrategy,
      hasCalculationLogic: !!brainstormData.calculationLogic && brainstormData.calculationLogic.length > 0
    }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Detailed brainstorm data analysis');

    // Log specific brainstorm fields that could influence component assembly
    if (brainstormData.keyCalculations && brainstormData.keyCalculations.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        keyCalculations: brainstormData.keyCalculations.map(calc => ({
          name: calc.name,
          formula: calc.formula?.substring(0, 100) + (calc.formula?.length > 100 ? '...' : ''),
          description: calc.description?.substring(0, 100) + (calc.description?.length > 100 ? '...' : '')
        }))
      }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Key calculations that should be implemented');
    }

    if (brainstormData.calculationLogic && brainstormData.calculationLogic.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        calculationLogic: brainstormData.calculationLogic.map(logic => ({
          name: logic.name,
          formula: logic.formula?.substring(0, 100) + (logic.formula?.length > 100 ? '...' : '')
        }))
      }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Calculation logic for function implementation');
    }

    if (brainstormData.interactionFlow && brainstormData.interactionFlow.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        interactionFlow: brainstormData.interactionFlow.map(step => ({
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
  const { provider, modelId } = getModelForAgent('componentAssembler', selectedModel, tcc);
  logger.info({ provider, modelId }, '🔧 ComponentAssembler: Using model');
  const modelInstance = createModelInstance(provider, modelId);

  const systemPrompt = `You are a React component assembler. Convert JSX to React.createElement syntax and integrate state logic.

🚨 CRITICAL OUTPUT REQUIREMENTS:
- Return a JSON object with: finalComponentCode, componentName, hooks, functions, estimatedLines
- finalComponentCode: Complete JavaScript React component using React.createElement() ONLY
- componentName: Valid JavaScript identifier (e.g., "BusinessCalculator")
- hooks: Array of hook names used (e.g., ["useState", "useEffect"]) or empty array
- functions: Array of function names defined or empty array  
- estimatedLines: Number estimate of code lines

🚨 VARIABLE NAMING RULES - CRITICAL:
- NEVER use the same name for local variables as React state variables
- State variables: revenue, netIncome, currentAssets, etc.
- Local variables: rev, income, assets, etc. (use abbreviated forms)
- Example: const rev = Number(revenue); NOT const revenue = Number(revenue);

🚨 REACT KEY PROPS - MANDATORY:
- EVERY React.createElement() call that creates an array of children MUST include unique 'key' props
- Use descriptive keys: 'input-current-assets', 'result-liquidity-ratio', 'tooltip-revenue', etc.
- FAILURE TO ADD KEYS TO ARRAY ELEMENTS WILL CAUSE REACT ERRORS
- Example: React.createElement('div', { key: 'container' }, [
    React.createElement(Input, { key: 'input-revenue' }),
    React.createElement(Input, { key: 'input-income' })
  ])

❌ FORBIDDEN:
- NO import statements
- NO export statements  
- NO JSX syntax (<div>, <Button>)
- NO TypeScript (interface, React.FC, type annotations)
- NO variable name collisions (shadowing state variables)
- NO React.createElement calls without keys when children are arrays

✅ REQUIRED FORMAT:
\`\`\`javascript
'use client';

const ComponentName = () => {
  const [state, setState] = useState(initialValue);
  
  const handleFunction = () => {
    // Use abbreviated names: const val = Number(state);
    // NOT: const state = Number(state);
  };
  
  return React.createElement('main', { 
    className: 'styles',
    'data-style-id': 'main-container',
    'data-tool-container': 'true',  // ✅ CRITICAL - Required for debug system
    key: 'main-container'
  }, [
    React.createElement(Card, { key: 'card-main' }, 'content'),
    React.createElement(Input, { key: 'input-primary' })
  ]);
};
\`\`\`

🚨 CRITICAL DEBUG SYSTEM REQUIREMENT:
- The ROOT/MAIN container element MUST include 'data-tool-container': 'true'
- This attribute enables the debug system to monitor tool interactions
- Without this attribute, calculation events, button clicks, and state changes will NOT be logged
- Use 'main' or 'div' as the root element with this attribute

AVAILABLE COMPONENTS (use directly):
React, useState, useEffect, useCallback, useMemo, 
Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter,
Button, Input, Label, 
Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel, SelectSeparator,
Textarea, RadioGroup, RadioGroupItem, Checkbox, Slider, Switch,
Accordion, AccordionContent, AccordionItem, AccordionTrigger,
Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
Progress, AlertCircle, Info, Loader2,
BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
XAxis, YAxis, CartesianGrid, RechartsTooltip, Legend, ResponsiveContainer,
RadialBarChart, RadialBar, ComposedChart, Scatter, ScatterChart

🚨 CRITICAL CHART DATA PATTERNS:
// Charts need data arrays with proper structure:
React.createElement(RadialBarChart, {
  data: [{ name: 'Savings', value: annualSavings, fill: '#10B981' }], // ✅ CONNECT STATE TO DATA
  className: 'w-full h-64',
  key: 'savings-chart'
}, [
  React.createElement(RadialBar, {
    dataKey: 'value', // ✅ CORRECT - matches data structure
    fill: '#10B981',
    key: 'savings-bar'
  }),
  React.createElement(RechartsTooltip, { key: 'savings-tooltip' }),
  React.createElement(Legend, { key: 'savings-legend' })
])

// For multiple data points:
React.createElement(BarChart, {
  data: [
    { name: 'Current', value: currentValue },
    { name: 'Target', value: targetValue },
    { name: 'Best Case', value: bestCaseValue }
  ],
  key: 'comparison-chart'
}, [...children])

❌ WRONG CHART PATTERNS - CHARTS WITH NO DATA:
- RadialBarChart without data prop
- Charts with empty data arrays
- dataKey that doesn't match data structure

✅ CORRECT CHART PATTERNS:
- Always include data prop with state values
- dataKey must match object keys in data array
- Use state variables for dynamic values
- Include Tooltip and Legend components

🚨 CRITICAL SELECT COMPONENT PATTERN:
// CORRECT Select component with onValueChange (NOT onChange):
React.createElement(Select, {
  value: stateValue,
  onValueChange: setStateValue,  // ✅ CORRECT - onValueChange
  key: 'select-key'
}, [
  React.createElement(SelectTrigger, { 
    'data-style-id': 'select-trigger',
    key: 'trigger' 
  }, React.createElement(SelectValue, { 
    placeholder: 'Select option',
    key: 'value' 
  })),
  React.createElement(SelectContent, { key: 'content' }, [
    React.createElement(SelectItem, { 
      value: 'option1', 
      key: 'item1' 
    }, 'Option 1'),
    React.createElement(SelectItem, { 
      value: 'option2', 
      key: 'item2' 
    }, 'Option 2')
  ])
])

❌ WRONG PATTERNS TO AVOID:
- onChange: (e) => setState(e.target.value)  // HTML pattern - WRONG for Select components!
- onChange: setState  // Still wrong for Select components!

✅ CORRECT PATTERNS FOR SELECT:
- onValueChange: setState  // Direct setter function
- onValueChange: (value) => setState(value)  // With parameter

🚨 CRITICAL SLIDER COMPONENT PATTERN:
// CORRECT Slider component with value and onValueChange:
React.createElement(Slider, {
  value: [stateValue],  // ✅ CRITICAL - Must be array even for single value
  onValueChange: (values) => setStateValue(values[0]),  // ✅ CORRECT - receives array, extract first value
  min: 0,
  max: 10,
  step: 1,
  className: 'w-full',
  'data-style-id': 'slider-element',
  key: 'slider-key'
})

// For range sliders (two values):
React.createElement(Slider, {
  value: [minValue, maxValue],  // ✅ Array with two values
  onValueChange: (values) => {
    setMinValue(values[0]);
    setMaxValue(values[1]);
  },
  min: 0,
  max: 100,
  key: 'range-slider'
})

❌ WRONG SLIDER PATTERNS - WILL CAUSE INVISIBLE SLIDERS:
- value: stateValue  // WRONG - must be array!
- onChange: setState  // WRONG - use onValueChange!
- No value prop  // WRONG - slider will have no position!
- defaultValue without value  // WRONG - not reactive!

✅ CORRECT SLIDER PATTERNS:
- value: [stateValue]  // Always array, even for single value
- onValueChange: (values) => setState(values[0])  // Extract from array
- Include min, max, step props for proper range
- Connect to state variables for reactivity

🚨 CRITICAL BUTTON COMPONENT PATTERN WITH DEBUGGING:
// DEBUGGING PATTERN (use this to verify function scope):
React.createElement(Button, {
  onClick: () => {
    console.log('🎯 BUTTON CLICKED: Starting function execution...', typeof handleFunction);
    try {
      handleFunction();
      console.log('🎯 BUTTON SUCCESS: Function completed successfully');
    } catch (error) {
      console.error('🎯 BUTTON ERROR: Function failed:', error);
    }
  },
  className: 'button-styles',
  'data-style-id': 'button-element',
  key: 'button-key'
}, 'Button Text')

// STANDARD PATTERN (use after debugging):
React.createElement(Button, {
  onClick: handleFunction,  // ✅ CORRECT - Direct function reference
  className: 'button-styles',
  'data-style-id': 'button-element',
  key: 'button-key'
}, 'Button Text')

// For buttons with parameters:
React.createElement(Button, {
  onClick: () => handleFunctionWithParams(param1, param2),  // ✅ CORRECT - Arrow function wrapper
  className: 'button-styles',
  key: 'button-key'
}, 'Button Text')

❌ WRONG BUTTON PATTERNS - WILL CAUSE NON-FUNCTIONAL BUTTONS:
- onClick: 'handleFunction'  // WRONG - String instead of function!
- onclick: handleFunction  // WRONG - lowercase 'c'!
- onSubmit: handleFunction  // WRONG - onSubmit is for forms, not buttons!
- Missing onClick entirely  // WRONG - Button won't respond to clicks!

✅ CORRECT BUTTON PATTERNS:
- onClick: functionName  // Direct function reference
- onClick: () => functionName(params)  // Arrow function for parameters
- onClick: (e) => { /* logic */ }  // Inline function with event parameter
- Always include onClick prop for interactive buttons
- Use descriptive key props for button identification

🚨 CRITICAL BUTTON DEBUG LOGGING - MANDATORY FOR ALL BUTTONS:
Every Button component MUST include comprehensive debug logging to diagnose click handler issues.
Use this EXACT pattern for ALL buttons to enable proper debugging:

React.createElement(Button, {
  onClick: () => {
    console.log('🎯 BUTTON CLICKED: [ButtonName] - Starting function execution...', typeof functionName);
    try {
      functionName();
      console.log('✅ BUTTON SUCCESS: [ButtonName] - Function executed successfully');
    } catch (error) {
      console.error('❌ BUTTON ERROR: [ButtonName] - Function execution failed:', error);
    }
  },
  className: 'button-styles-here',
  'data-style-id': 'button-style-id',
  key: 'button-key'
}, 'Button Text'),

🚨 CRITICAL CALCULATION RESULT LOGGING - MANDATORY FOR ALL CALCULATIONS:
Every calculation function MUST include result logging to enable debug system detection.
Add these patterns to ALL calculation functions:

const calculateFunction = () => {
  // ... calculation logic ...
  const result = someCalculation;
  
  // MANDATORY: Log calculation results for debug system detection
  console.log('🔢 CALCULATION RESULT:', 'calculateFunction', 'calculated:', result);
  console.log('📊 CALCULATION SCORE:', result); // Debug system detects 'score' keyword
  console.log('💰 CALCULATION TOTAL:', result); // Debug system detects 'total' keyword
  
  // Set state
  setState(result);
  return result;
};

EXAMPLE - Neighborhood Score Calculation:
const calculateNeighborhoodScore = () => {
  const result = (schoolsWeight * 0.3) + (priceWeight * 0.4) + (commuteWeight * 0.3);
  
  // MANDATORY: Debug system detection logging
  console.log('🔢 CALCULATION RESULT: calculateNeighborhoodScore calculated:', result);
  console.log('📊 NEIGHBORHOOD SCORE:', result);
  
  setNeighborhoodScore(result);
  return result;
};

// This debug pattern helps the debug system detect:
// 1. When calculations are executed
// 2. What the calculated results are
// 3. Provides keywords (score, total, result) for automatic detection

🚨 CRITICAL REQUIREMENT - CALCULATION RESULTS MUST BE DISPLAYED:

❌ WRONG - Static descriptions (what you MUST NOT do):
React.createElement('p', {}, 'Calculates a comprehensive score for neighborhoods')

✅ CORRECT - Dynamic calculated values (what you MUST do):
React.createElement('div', {
  'data-style-id': 'neighborhood-score-result',
  className: 'text-2xl font-bold text-green-300',
  key: 'score-display'
}, \`Your Neighborhood Score: \${neighborhoodScore}\`)

🚨 MANDATORY PATTERN FOR ALL CALCULATION RESULTS:
Replace ANY static result descriptions with ACTUAL calculated values using template literals.

REQUIRED PATTERNS:
- \`Your Score: \${calculatedScore}\`
- \`Total Payment: $\${monthlyPayment}\`
- \`Result: \${calculationResult}\`
- \`Rating: \${finalRating}\`

❌ FORBIDDEN: "Calculates...", "Determines...", "Shows..."
✅ REQUIRED: "Your Score: 37.5", "Total: $1,250", "Result: 85%"

The debug system REQUIRES seeing actual calculated values in the DOM!

RULES:
1. Start with 'use client';
2. Use React.createElement() for ALL elements
3. Add 'data-style-id' and 'key' props to EVERY element
4. Apply className from provided styling
5. Integrate all state logic provided
6. Use abbreviated variable names in calculations (rev, income, assets, etc.)
7. When React.createElement has array children, EVERY child needs a unique key
8. End with just the function - NO exports`;

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

  // CRITICAL FIX: Include brainstorm data context for complete tool implementation
  let brainstormContext = '';
  if (tcc.brainstormData) {
    const brainstormData = tcc.brainstormData;
    brainstormContext = `

🚨 CRITICAL BRAINSTORM CONTEXT - IMPLEMENT ALL REQUIREMENTS:

TOOL CONCEPT & VALUE PROPOSITION:
Core Concept: ${brainstormData.coreConcept || 'Not specified'}
Value Proposition: ${brainstormData.valueProposition || 'Not specified'}

🚨 MANDATORY INPUT FIELDS CHECKLIST (MUST IMPLEMENT ALL ${brainstormData.suggestedInputs?.length || 0} INPUTS):
${brainstormData.suggestedInputs?.map((input, index) => 
  `✅ REQUIRED ${index + 1}/${brainstormData.suggestedInputs?.length}: ${input.label} (type: ${input.type})
     - State Variable: ${input.id || input.label.toLowerCase().replace(/\s+/g, '')}
     - Event Handler: set${input.id || input.label.replace(/\s+/g, '')}
     - UI Element: ${input.type === 'select' ? 'Select with SelectTrigger, SelectContent, SelectItem' : 
                   input.type === 'multiselect' ? 'Select with multiple="true" and array state' :
                   input.type === 'radio' ? 'RadioGroup with RadioGroupItem elements' :
                   input.type === 'slider' ? 'Slider with value={[stateVar]} and onValueChange' :
                   input.type === 'number' ? 'Input with type="number"' :
                   input.type === 'currency' ? 'Input with type="number" and $ formatting' :
                   input.type === 'percentage' ? 'Input with type="number" and % display' : 'Input element'}
     - Description: ${input.description}
     ${(input as any).researchOptions ? `- Options from Research: ${(input as any).researchOptions}` : ''}
     🚨 FAILURE TO IMPLEMENT THIS FIELD = INCOMPLETE TOOL`
).join('\n\n') || 'No inputs to implement'}

🚨 MANDATORY CALCULATION FUNCTIONS CHECKLIST (MUST IMPLEMENT ALL ${brainstormData.keyCalculations?.length || 0} CALCULATIONS):
${brainstormData.keyCalculations?.map((calc, index) => 
  `✅ REQUIRED ${index + 1}/${brainstormData.keyCalculations?.length}: ${calc.name}
     - Function Name: ${calc.name.toLowerCase().replace(/\s+/g, '').replace(/-/g, '')}
     - Purpose: ${calc.description}
     - Formula: ${calc.formula}
     - State Variable for Result: set${calc.name.replace(/\s+/g, '').replace(/-/g, '')}
     - Must be called by Calculate button
     - Must display result in Results section with dynamic value
     🚨 FAILURE TO IMPLEMENT THIS CALCULATION = INCOMPLETE TOOL`
).join('\n\n') || 'No calculations to implement'}

🚨 RESEARCH DATA FOR SELECT/MULTISELECT OPTIONS:
${brainstormData.researchData ? JSON.stringify(brainstormData.researchData, null, 2) : 'No research data available - use logical defaults'}

🚨 CRITICAL VALIDATION REQUIREMENTS:
1. TOTAL INPUT COUNT: Must render exactly ${brainstormData.suggestedInputs?.length || 0} input elements
2. TOTAL CALCULATION COUNT: Must implement exactly ${brainstormData.keyCalculations?.length || 0} calculation functions
3. Calculate button onClick: Must call ALL calculation functions in sequence
4. Results section: Must display ALL calculation results with dynamic values (calcName: $\{stateVariable\})
5. State variables: Must include ALL input states and ALL calculation result states
6. Event handlers: Must connect ALL inputs to their corresponding setState functions
7. Select/Multiselect: Must populate ALL options from research data or logical defaults

🚨 EXPLICIT FAILURE CONDITIONS - ANY OF THESE = REJECTED IMPLEMENTATION:
❌ Missing input fields (less than ${brainstormData.suggestedInputs?.length || 0} total)
❌ Missing calculation functions (less than ${brainstormData.keyCalculations?.length || 0} total)
❌ Calculate button only calls 1 function instead of ALL functions
❌ Results section shows static text instead of dynamic calculated values
❌ Select/Multiselect components with empty SelectContent
❌ Missing state variables for any input or calculation result
❌ Missing event handlers for any input element

🚨 COMPONENT STRUCTURE REQUIREMENTS:
- Input Section: MUST contain ALL ${brainstormData.suggestedInputs?.length || 0} input fields
- Calculate Button: MUST call ALL ${brainstormData.keyCalculations?.length || 0} calculation functions
- Results Section: MUST display ALL ${brainstormData.keyCalculations?.length || 0} results with dynamic values
- State Logic: MUST include variables for ALL inputs + ALL calculation results

The Component Assembler MUST implement the COMPLETE tool according to ALL brainstorm specifications above - partial implementations are REJECTED!`;
  } else {
    brainstormContext = '\n⚠️ WARNING: No brainstorm data available - implementing with minimal context only.';
  }

  const userPrompt = `Please assemble the React component using the following parts.

Component Name Suggestion: ${suggestedComponentName}
${brainstormContext}

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

🚨 ASSEMBLY INSTRUCTIONS:
1. Convert the styled JSX above to React.createElement() syntax
2. Integrate with the state logic provided
3. IMPLEMENT ALL input fields specified in the brainstorm context above
4. IMPLEMENT ALL calculation functions specified in the brainstorm context above
5. Connect Calculate button to call ALL calculation functions (not just one)
6. Display ALL calculation results in the results section with dynamic values
7. Follow all interaction flow steps for complete user experience
8. Include lead capture mechanism as specified in brainstorm
9. Use the available components from the execution context
10. Generate complete JSON object WITHOUT imports

The final component must be a COMPLETE implementation of ALL brainstorm requirements, not a partial demonstration.`;

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

    // ENHANCED FIX: Add retry logic and better error handling for generateObject
    let object!: AssembledComponent; // Definite assignment assertion - will be assigned in the loop
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        logger.info({
          jobId: tcc.jobId,
          attempt: attempts,
          maxAttempts,
          provider,
          modelId
        }, '🔧 ComponentAssembler: Attempting AI generation');

        const result = await generateObject({
          model: modelInstance,
          schema: assembledComponentSchema,
          prompt: userPrompt,
          system: systemPrompt,
          temperature: 0.1,
          maxTokens: 8192,
          // Add explicit request for JSON formatting
          mode: 'json'
        });
        
        // Validate that we got a proper object
        if (!result.object || !result.object.finalComponentCode) {
          throw new Error('Generated object is missing required finalComponentCode field');
        }
        
        object = result.object;
        break; // Success, exit retry loop
        
      } catch (generationError) {
        logger.warn({
          jobId: tcc.jobId,
          attempt: attempts,
          error: generationError instanceof Error ? generationError.message : String(generationError),
          willRetry: attempts < maxAttempts
        }, '🔧 ComponentAssembler: Generation attempt failed');
        
        if (attempts === maxAttempts) {
          // Final attempt failed - rethrow the error
          throw new Error(`AI generation failed after ${maxAttempts} attempts: ${generationError instanceof Error ? generationError.message : String(generationError)}`);
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
    
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
      modelId,
      attempts
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

    // CRITICAL VALIDATION: Check if all brainstorm requirements are implemented
    let validationErrors: string[] = [];
    if (tcc.brainstormData?.suggestedInputs) {
      const requiredInputCount = tcc.brainstormData.suggestedInputs.length;
      const codeText = object.finalComponentCode;
      
      // Count actual input elements in the generated code
      const inputElementCounts = {
        Select: (codeText.match(/React\.createElement\(Select,/g) || []).length,
        Input: (codeText.match(/React\.createElement\(Input,/g) || []).length,
        RadioGroup: (codeText.match(/React\.createElement\(RadioGroup,/g) || []).length,
        Slider: (codeText.match(/React\.createElement\(Slider,/g) || []).length
      };
      const totalInputElements = Object.values(inputElementCounts).reduce((sum, count) => sum + count, 0);
      
      logger.info({
        jobId: tcc.jobId,
        requiredInputCount,
        actualInputCount: totalInputElements,
        inputBreakdown: inputElementCounts,
        brainstormInputs: tcc.brainstormData.suggestedInputs.map(input => `${input.label} (${input.type})`).join(', ')
      }, '🔧 ComponentAssembler: 🔍 VALIDATION - Input field count analysis');
      
      if (totalInputElements < requiredInputCount) {
        validationErrors.push(`Missing input fields: Generated ${totalInputElements} inputs but brainstorm requires ${requiredInputCount} inputs`);
      }
      
      // Check if calculation functions are implemented
      if (tcc.brainstormData?.keyCalculations) {
        const requiredCalcCount = tcc.brainstormData.keyCalculations.length;
        const calcFunctionMatches = codeText.match(/const\s+\w*[Cc]alculat\w*\s*=/g) || [];
        const actualCalcCount = calcFunctionMatches.length;
        
        logger.info({
          jobId: tcc.jobId,
          requiredCalcCount,
          actualCalcCount,
          foundFunctions: calcFunctionMatches,
          brainstormCalculations: tcc.brainstormData.keyCalculations.map(calc => calc.name).join(', ')
        }, '🔧 ComponentAssembler: 🔍 VALIDATION - Calculation function analysis');
        
        if (actualCalcCount < requiredCalcCount) {
          validationErrors.push(`Missing calculation functions: Generated ${actualCalcCount} functions but brainstorm requires ${requiredCalcCount} calculations`);
        }
      }
    }
    
    // If validation fails, log the error but continue (don't regenerate for now to avoid infinite loops)
    if (validationErrors.length > 0) {
      logger.error({
        jobId: tcc.jobId,
        validationErrors,
        modelUsed: `${provider}:${modelId}`,
        brainstormInputCount: tcc.brainstormData?.suggestedInputs?.length || 0,
        brainstormCalcCount: tcc.brainstormData?.keyCalculations?.length || 0
      }, '🔧 ComponentAssembler: 🚨 VALIDATION FAILED - Generated component is incomplete!');
      
      console.log('\n' + '🚨'.repeat(40));
      console.log('🚨 COMPONENT VALIDATION FAILED:');
      console.log('🚨 ERRORS:');
      validationErrors.forEach(error => console.log(`🚨   - ${error}`));
      console.log('🚨 MODEL USED:', `${provider}:${modelId}`);
      console.log('🚨 This indicates the AI model is not following brainstorm requirements!');
      console.log('🚨'.repeat(40) + '\n');
    } else {
      logger.info({
        jobId: tcc.jobId,
        modelUsed: `${provider}:${modelId}`
      }, '🔧 ComponentAssembler: ✅ VALIDATION PASSED - Component implements all requirements');
    }

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
          
          // Replace the collision declaration and subsequent usage in the same function
          const functionPattern = new RegExp(
            `(const\\s+${varName}\\s*=\\s*Number\\(${varName}\\);[\\s\\S]*?)(\\b${varName}\\b)(?![a-zA-Z])([\\s\\S]*?)(?=\\n\\s*\\}|$)`,
            'g'
          );
          
          fixedCode = fixedCode.replace(
            new RegExp(`const\\s+${varName}\\s*=\\s*Number\\(${varName}\\)`, 'g'),
            `const ${safeVarName} = Number(${varName})`
          );
          
          // Replace usage within the calculation logic (but not in Number() calls)
          fixedCode = fixedCode.replace(
            new RegExp(`(const\\s+${safeVarName}\\s*=\\s*Number\\([^)]+\\);[\\s\\S]*?)(\\b${varName}\\b)(?!\\s*[),])`, 'g'),
            (match, prefix, varUsage) => {
              // Replace variable usage in calculations but preserve state variable references
              if (match.includes('/ ' + varName) || match.includes('* ' + varName) || match.includes('- ' + varName) || match.includes('+ ' + varName)) {
                return match.replace(varUsage, safeVarName);
              }
              return match;
            }
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