import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { filterBrainstormForFunctionPlanner, generateFilteredBrainstormContext } from '@/lib/utils/brainstorm-filter';
import logger from '@/lib/logger';

// Edit mode context type for user prompt
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

const commonGuidelines = `
<output-format>
    You MUST return a JSON array of function signatures in this exact format:
    [
        {
            "name": "handleCalculate",
            "description": "Processes user inputs and performs the main calculation logic"
        },
        {
            "name": "handleReset", 
            "description": "Resets all form inputs and calculations to initial state"
        }
    ]
</output-format>

<guidelines>
    - Use descriptive, camelCase function names (e.g., handleCalculate, validateInput).
    - Focus on USER ACTIONS that require a function (e.g., submitting a form, clicking a button, changing an input).
    - Include validation functions if forms are complex.
    - Consider data manipulation needs (add/remove/update items in a list).
    - Keep function names concise but clear.
    - Typical business tools require 3-8 functions in total.
</guidelines>
`;

const CREATION_PROMPT = `
You are a "Function Signature Planner" agent, a specialist in analyzing user requirements to define the functional architecture of a React component.

<role>
    Your task is to analyze a user's tool description and determine the complete set of JavaScript functions needed for the component's interactivity. You are building the initial blueprint from scratch.
</role>

<responsibilities>
    1. Analyze User Intent: Deeply understand the tool's purpose, features, and user interactions from the provided description.
    2. Identify Core Functions: Determine the primary functions for calculations, form submissions, and state resets.
    3. Identify UI Interaction Functions: Plan for functions that handle UI events like toggling visibility, clearing fields, or handling input changes.
    4. Consider Edge Cases: Add functions for validation, error handling, and data formatting if implied by the requirements.
    5. Structure the Output: Provide the function signatures in the specified JSON format.
</responsibilities>

<business-tool-patterns>
    - CALCULATOR TOOLS: Need mathematical computation functions (e.g., calculateLoanPayment, calculateROI) and data formatting functions (formatCurrency, formatPercentage).
    - GENERATOR TOOLS: Require functions to generate content (generateReport, createPassword) and often a copy-to-clipboard function (handleCopy).
    - CONVERTER TOOLS: Need a primary conversion function (convertUnits, transformData) and functions to handle different input/output formats.
    - VALIDATOR TOOLS: Need a validation function (validateSyntax, checkCompliance) and functions to display errors or success states.
</business-tool-patterns>

${commonGuidelines}
`;

const EDIT_PROMPT = `
You are a "Function Signature Planner" agent, and you are in EDIT MODE.

<role>
    Your task is to incrementally modify an existing set of function signatures based on a user's modification request. You are not starting from scratch.
</role>

<responsibilities>
    1. Analyze the Modification Request: Understand what the user wants to change (e.g., "add a field for email," "calculate shipping costs," "remove the assessment part").
    2. Compare to Existing Plan: Review the 'existingFunctionSignatures' provided.
    3. Perform the Edit: Add, remove, or modify function signatures to fulfill the user's request.
    4. Preserve Unchanged Functions: It is critical to not alter or remove existing functions that are unaffected by the request.
    5. Output a Complete New Plan: Your final output must be the complete, updated list of all function signatures for the tool, including both the changed and unchanged functions.
</responsibilities>

<edit-example>
    - Existing Signatures: [{"name": "calculateROI", "description": "Calculates the return on investment."}]
    - Modification Request: "I also need to calculate the net profit."
    - Action: Add a new function signature for calculateNetProfit.
    - Output: [{"name": "calculateROI", ...}, {"name": "calculateNetProfit", ...}]
</edit-example>

${commonGuidelines}
`;

export function getFunctionPlannerSystemPrompt(isEditing: boolean): string {
    return isEditing ? EDIT_PROMPT : CREATION_PROMPT;
}

/**
 * Creates the user prompt for the function planner based on TCC data
 * Enhanced with filtered brainstorm data integration and edit mode support
 */
export function getFunctionPlannerUserPrompt(tcc: ToolConstructionContext, editMode?: EditModeContext): string {
  // Get Function Planner specific filtered data
  const filteredBrainstormData = tcc.brainstormData ? filterBrainstormForFunctionPlanner(tcc.brainstormData, tcc.jobId) : null;
  
  // Use brainstorm data for tool description instead of fallback
  let toolDescription = tcc.userInput?.description;
  if (!toolDescription && filteredBrainstormData) {
    toolDescription = `${filteredBrainstormData.coreConcept || 'Business Tool'}: ${filteredBrainstormData.valueProposition || 'A tool to help users make informed decisions.'}`;
  }

  let prompt = `Please analyze this tool description and provide the function signatures needed:

TOOL DESCRIPTION: ${toolDescription || 'Business calculation tool'}
TOOL TYPE: ${tcc.userInput.toolType || 'Not specified'}

Additional Context:
- User Industry: ${tcc.userInput.targetAudience || 'General'}`;

  // Add filtered brainstorm context when available
  if (filteredBrainstormData) {
    const brainstormContext = generateFilteredBrainstormContext(filteredBrainstormData, 'FunctionPlanner');
    prompt += brainstormContext;

    logger.info({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: true,
      dataReduction: 'Applied Function Planner specific filtering'
    }, '🔧 FunctionPlanner Module: [FILTERED BRAINSTORM] Context successfully added to prompt');
  } else {
    logger.warn({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: false
    }, '🔧 FunctionPlanner Module: [FILTERED BRAINSTORM] ⚠️ Prompt created WITHOUT brainstorm context - tool may be too generic');
  }

  // Add edit mode context if in edit mode
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    prompt += `

🔄 EDIT MODE INSTRUCTIONS:
You are EDITING existing function signatures. Here are the current functions:

CURRENT FUNCTION SIGNATURES:`;

    if (tcc.definedFunctionSignatures && tcc.definedFunctionSignatures.length > 0) {
      tcc.definedFunctionSignatures.forEach(func => {
        prompt += `\n- ${func.name}: ${func.description}`;
      });
    } else {
      prompt += `\n- No existing function signatures found`;
    }

    prompt += `

EDIT INSTRUCTIONS TO FOLLOW:`;

    editMode.instructions.forEach((instruction, index) => {
      prompt += `

${index + 1}. ${instruction.editType.toUpperCase()} REQUEST (${instruction.priority} priority):
${instruction.instructions}

Created: ${instruction.createdAt}`;
    });

    prompt += `

Please apply these edit instructions to improve the function signatures. Maintain overall consistency while implementing the requested changes.`;
  }

  prompt += `

Please provide the JSON array of function signatures as specified in the guidelines.`;

  return prompt;
}

export const FUNCTION_PLANNER_SYSTEM_PROMPT = CREATION_PROMPT;