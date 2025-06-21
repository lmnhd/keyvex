// ============================================================================
// STATE DESIGN AGENT PROMPT  
// ✅ ENHANCED: Now handles brainstorm data and demands SPECIFIC business logic
// ============================================================================

import { ToolConstructionContext, DefinedFunctionSignature } from '@/lib/types/product-tool-creation-v2/tcc';
import { filterBrainstormForStateDesign } from '@/lib/utils/brainstorm-filter';
import logger from '@/lib/logger';

const commonGuidelines = `
<output-format>
    🚨 CRITICAL: You MUST return ONLY a JSON code block in this exact format:

    \`\`\`json
    {
      "variables": [
        {
          "name": "string (camelCase)",
          "type": "string (e.g., 'string', 'number', 'boolean', 'number[]')",
          "initialValue": "any (e.g., '', 0, false, [7])",
          "description": "string"
        }
      ],
      "functions": [
        {
          "name": "string (e.g., 'handleCalculate', from the function plan)",
          "body": "string (JavaScript function body as SINGLE concatenated string)",
          "dependencies": ["string (optional array of state dependencies)"],
          "description": "string (optional description)"
        }
      ],
      "imports": ["string (optional React imports like 'useState', 'useEffect')"]
    }
    \`\`\`

    🚨 ABSOLUTELY REQUIRED:
    - Start with \`\`\`json
    - End with \`\`\`
    - Use "variables" key (not "stateVariables")
    - No text before or after the JSON block
    - Valid JSON syntax only
</output-format>

<critical-requirements>
    🚨 ABSOLUTELY NO GENERIC PLACEHOLDERS!
    
    ❌ NEVER DO THIS:
    - "const result = numericValue * 2;" 
    - "// Logic to calculate result"
    - "// Placeholder calculation logic"
    - "const value = inputValue * someConstant;"
    
    ✅ ALWAYS DO THIS:
    - "const liquidityRatio = currentAssets / currentLiabilities;"
    - "const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);"
    - "const solarSavings = monthlyBill * (1 - (systemCost / (monthlyBill * 12 * 25)));"
    - "const paybackPeriod = systemCost / (monthlyBill * 12);"
    
    🔥 IMPLEMENT EXACT BUSINESS FORMULAS based on the tool's specific domain!
</critical-requirements>

<select-field-handling>
    🚨 CRITICAL: When dealing with SELECT fields that have text values, you MUST map them to numeric values:
    
    ❌ WRONG:
    - "const systemCost = parseFloat(statePreferredSystemSize) * 1000;" // 'small' * 1000 = NaN!
    
    ✅ CORRECT:
    - "const systemSizeKW = statePreferredSystemSize === 'small' ? 4 : statePreferredSystemSize === 'medium' ? 7 : statePreferredSystemSize === 'large' ? 10 : 0;"
    - "const systemCost = systemSizeKW * 3000;" // $3000 per kW
    
    🔥 ALWAYS convert text selections to meaningful numeric values for calculations!
</select-field-handling>

<slider-field-handling>
    🚨 CRITICAL SLIDER PATTERN - PREVENTS INVISIBLE SLIDERS:
    
    When an input is a SLIDER component, its state MUST be a number array, never a single number.
    
    ✅ CORRECT STATE FOR SLIDERS (ALWAYS ARRAYS):
    - "name": "loanTerm", "type": "number[]", "defaultValue": [30]
    - "name": "investmentAmount", "type": "number[]", "defaultValue": [10000]  
    - "name": "riskTolerance", "type": "number[]", "defaultValue": [5]
    - "name": "interestRate", "type": "number[]", "defaultValue": [3.5]

    ❌ WRONG STATE FOR SLIDERS (CAUSES INVISIBLE SLIDERS):
    - "name": "loanTerm", "type": "number", "defaultValue": 30
    - "name": "investmentAmount", "type": "number", "defaultValue": 10000

    🔥 SLIDER DETECTION RULES - Use number[] if input represents:
    - Years, months, terms, periods (e.g., "loanTerm", "investmentPeriod")
    - Amounts, values with ranges (e.g., "loanAmount", "investmentAmount")  
    - Percentages, rates (e.g., "interestRate", "riskTolerance")
    - Ratings, scores, scales (e.g., "creditScore", "satisfactionRating")
    - Any input with min/max constraints or step values
    - Duration, time periods (e.g., "tripDuration", "sessionDuration")
    - Quantities, counts with ranges (e.g., "numberOfGuests", "teamSize")
    
    ✅ CORRECT SLIDER VALUE USAGE IN CALCULATIONS:
    - "const termYears = loanTerm[0];"
    - "const principal = investmentAmount[0];"
    - "const rate = interestRate[0] / 100;"
    - "const risk = riskTolerance[0];"
    - "const duration = tripDuration[0];" // For travel planning tools
    - "const days = stateTripDuration[0];" // Common pattern for duration sliders
    
    ❌ WRONG SLIDER VALUE USAGE (CAUSES NaN IN CALCULATIONS):
    - "const termYears = loanTerm;" // This is an array [30], not number 30!
    - "const principal = investmentAmount;" // This is an array [10000], not number 10000!
    - "const duration = tripDuration;" // This is an array [7], not number 7!
    
    🚨 REMEMBER: Radix UI Slider components become INVISIBLE if value prop is not an array!
    🚨 ANY variable with "Duration", "Term", "Period", "Age", "Score", "Rating", "Size", "Count" should be number[] for sliders!
</slider-field-handling>

<state-management-best-practices>
    ✅ Keep input state as strings for form control
    ✅ Convert to numbers ONLY during calculations
    ✅ Validate inputs before calculations (check for NaN, negative values)
    ✅ Use 'state' prefix for input variables to avoid naming collisions
    ✅ Store calculation results in separate state variables
    ✅ Handle division by zero and edge cases
    ✅ Use TypeScript for better error catching
    ✅ Map select field text to numeric values for calculations
</state-management-best-practices>

<example-patterns>
    For SOLAR PANEL tools:
    - System size mapping: small=4kW, medium=7kW, large=10kW
    - Annual savings = monthlyBill * 12 * 0.9 (90% grid offset)
    - System cost = systemSizeKW * 3000 (per kW installed)
    - Payback period = systemCost / annualSavings
    - Tax incentive = systemCost * 0.30 (federal tax credit)
    
    For FINANCIAL tools:
    - ROI = (gain - cost) / cost * 100
    - Profit margin = (revenue - costs) / revenue * 100
    - Debt ratio = totalDebt / totalAssets
    
    For BUSINESS tools:
    - Break-even = fixedCosts / (pricePerUnit - variableCostPerUnit)
    - Customer LTV = avgMonthlyValue * avgLifespanMonths
    - Conversion rate = conversions / totalVisitors * 100
</example-patterns>

<comprehensive-examples>
    🚨 **CRITICAL EXAMPLES - WHAT TO DO vs WHAT NOT TO DO**

    **EXAMPLE 1: TRIP DURATION SLIDER (CORRECT vs WRONG)**
    
    ✅ **CORRECT STATE DESIGN:**
    \`\`\`json
    {
      "variables": [
        {
          "name": "stateTripDuration",
          "type": "number[]",
          "defaultValue": [7],
          "description": "Duration of the trip in days"
        }
      ],
      "functions": [
        {
          "name": "calculateTotalCost",
          "body": "const days = stateTripDuration[0]; const dailyBudget = parseFloat(stateTotalVacationBudget) / days; setTotalCost(days * dailyBudget);",
          "dependencies": ["stateTripDuration", "stateTotalVacationBudget"],
          "description": "Calculate total trip cost based on duration and budget"
        }
      ]
    }
    \`\`\`
    
    ❌ **WRONG STATE DESIGN (CAUSES INVISIBLE SLIDER):**
    \`\`\`json
    {
      "variables": [
        {
          "name": "stateTripDuration", 
          "type": "number",
          "defaultValue": 7,
          "description": "Duration of the trip in days"
        }
      ],
      "functions": [
        {
          "name": "calculateTotalCost",
          "body": "const days = stateTripDuration; const dailyBudget = parseFloat(stateTotalVacationBudget) / days; setTotalCost(days * dailyBudget);",
          "dependencies": ["stateTripDuration", "stateTotalVacationBudget"],
          "description": "WRONG: Calculate total trip cost (this will cause invisible slider)"
        }
      ]
    }
    \`\`\`

    **EXAMPLE 2: LOAN AMOUNT SLIDER (CORRECT vs WRONG)**
    
    ✅ **CORRECT FOR FINANCIAL SLIDERS:**
    \`\`\`json
    {
      "variables": [
        {
          "name": "stateLoanAmount",
          "type": "number[]", 
          "defaultValue": [50000],
          "description": "Loan amount in dollars"
        },
        {
          "name": "stateInterestRate",
          "type": "number[]",
          "defaultValue": [3.5],
          "description": "Annual interest rate percentage"
        }
      ],
      "functions": [
        {
          "name": "calculateMonthlyPayment",
          "body": "const principal = stateLoanAmount[0]; const rate = stateInterestRate[0] / 100 / 12; const months = 360; const payment = principal * (rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1); setMonthlyPayment(payment);",
          "dependencies": ["stateLoanAmount", "stateInterestRate"],
          "description": "Calculate monthly loan payment using amortization formula"
        }
      ]
    }
    \`\`\`
    
    ❌ **WRONG (CREATES BROKEN SLIDERS):**
    \`\`\`json
    {
      "variables": [
        {
          "name": "stateLoanAmount",
          "type": "number",
          "defaultValue": 50000,
          "description": "Loan amount in dollars"
        }
      ],
      "functions": [
        {
          "name": "calculateMonthlyPayment", 
          "body": "const principal = stateLoanAmount; const payment = principal * 0.005; setMonthlyPayment(payment);",
          "dependencies": ["stateLoanAmount"],
          "description": "WRONG: Calculate payment (this will break sliders)"
        }
      ]
    }
    \`\`\`

    **EXAMPLE 3: SELECT DROPDOWN HANDLING (CORRECT vs WRONG)**
    
    ✅ **CORRECT SELECT VALUE MAPPING:**
    \`\`\`json
    {
      "variables": [
        {
          "name": "stateSystemSize",
          "type": "string",
          "defaultValue": "",
          "description": "Solar system size selection"
        },
        {
          "name": "systemCost",
          "type": "number",
          "defaultValue": 0,
          "description": "Calculated system cost"
        }
      ],
      "functions": [
        {
          "name": "calculateSystemCost",
          \"body\": [
            "const systemSizeKW = stateSystemSize === 'small' ? 4 : stateSystemSize === 'medium' ? 7 : stateSystemSize === 'large' ? 10 : 0;",
            "const costPerKW = 3000;",
            "const totalCost = systemSizeKW * costPerKW;",
            "setSystemCost(totalCost);"
          ]
        }
      ]
    }
    \`\`\`
    
    ❌ **WRONG (CAUSES NaN ERRORS):**
    \`\`\`json
    {
      "variables": [
        {
          "name": "stateSystemSize",
          "type": "string", 
          "defaultValue": "",
          "description": "Solar system size selection"
        }
      ],
      "functions": [
        {
          "name": "calculateSystemCost",
          \"body\": [
            "const systemCost = parseFloat(stateSystemSize) * 1000;",
            "setSystemCost(systemCost);"
          ]
        }
      ]
    }
    \`\`\`

    **EXAMPLE 4: HANDLE INPUT CHANGE FUNCTION (CORRECT vs WRONG)**
    
    ✅ **CORRECT EVENT HANDLER (WORKS WITH RADIX UI):**
    \`\`\`json
    {
      "functions": [
        {
          "name": "handleInputChange",
          \"body\": [
            "const { name, value } = event.target;",
            "switch (name) {",
            "  case 'family-composition':",
            "    setStateFamilyComposition(value);",
            "    break;",
            "  case 'trip-duration':",
            "    setStateTripDuration([parseInt(value) || 7]);",
            "    break;",
            "  case 'vacation-pace':",
            "    setStateVacationPace(value);",
            "    break;",
            "  default:",
            "    break;",
            "}"
          ]
        }
      ]
    }
    \`\`\`
    
    ❌ **WRONG (DOESN'T HANDLE RADIX UI PATTERNS):**
    \`\`\`json
    {
      "functions": [
        {
          "name": "handleInputChange",
          \"body\": [
            "const { name, value } = event.target;",
            "setState(prevState => ({ ...prevState, [name]: value }));"
          ]
        }
      ]
    }
    \`\`\`

    **EXAMPLE 5: MULTI-CALCULATION TOOL (COMPLETE IMPLEMENTATION)**
    
    ✅ **CORRECT FULL IMPLEMENTATION:**
    \`\`\`json
    {
      "variables": [
        {
          "name": "stateHomePrice",
          "type": "number[]",
          "defaultValue": [300000],
          "description": "Home price slider"
        },
        {
          "name": "stateDownPayment", 
          "type": "number[]",
          "defaultValue": [20],
          "description": "Down payment percentage slider"
        },
        {
          "name": "monthlyPayment",
          "type": "number",
          "defaultValue": 0,
          "description": "Calculated monthly payment"
        },
        {
          "name": "affordabilityIndex",
          "type": "number", 
          "defaultValue": 0,
          "description": "Calculated affordability score"
        }
      ],
      "functions": [
        {
          "name": "calculateMonthlyPayment",
          \"body\": [
            "const homePrice = stateHomePrice[0];",
            "const downPercent = stateDownPayment[0] / 100;", 
            "const loanAmount = homePrice * (1 - downPercent);",
            "const monthlyRate = 0.065 / 12;",
            "const months = 360;",
            "const payment = loanAmount * (monthlyRate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);",
            "setMonthlyPayment(payment);"
          ]
        },
        {
          "name": "calculateAffordabilityIndex",
          \"body\": [
            "const homePrice = stateHomePrice[0];",
            "const income = 75000;",
            "const affordability = (income * 0.28) / (homePrice / 100);",
            "setAffordabilityIndex(affordability);"
          ]
        }
      ]
    }
    \`\`\`

    🚨 **KEY PATTERNS TO REMEMBER:**
    1. **Sliders ALWAYS use number[] type with [defaultValue]**
    2. **Extract slider values with variable[0] in calculations**
    3. **Map select text values to numbers for calculations**
    4. **Create separate functions for each keyCalculation**
    5. **Use switch statements in handleInputChange for different field types**
    6. **Always validate inputs before calculations (check for NaN)**
</comprehensive-examples>
`;

const CREATION_PROMPT = `
You are a "State Logic Designer" agent. Your expertise is in translating function signatures and user requirements into clean, efficient state management logic for a React component using hooks.

🚨 CRITICAL MISSION: You MUST implement the EXACT calculations and business logic specified in the brainstorm data and function signatures. DO NOT create generic placeholders!

<role>
    Your task is to design the complete state logic from scratch based on a provided function plan and brainstorm data.
</role>

<responsibilities>
    1.  **Analyze Brainstorm Data**: Use the provided brainstorm data to understand the SPECIFIC business domain and required calculations
    2.  **Define State Variables**: Create state variables for each input field specified in the brainstorm data
    3.  **Implement EXACT Calculations**: Write the precise mathematical formulas for the business domain (solar, financial, etc.)
    4.  **Assign Types & Defaults**: Define TypeScript types and sensible default values
    5.  **Handle Edge Cases**: Validate inputs and handle division by zero, negative values, etc.
    6.  **Ensure Completeness**: Your output must include all necessary state variables and implemented functions for a fully working component
</responsibilities>

🚨 **CRITICAL REQUIREMENT - IMPLEMENT ALL KEY CALCULATIONS**:

**MANDATORY CALCULATION IMPLEMENTATION:**
- You MUST implement EVERY calculation listed in "KEY CALCULATIONS TO IMPLEMENT"
- Each keyCalculation requires its own state variable for the result
- Each keyCalculation requires its own calculation function
- Use the EXACT formulas provided in the keyCalculations data

**FORBIDDEN - Partial Implementation:**
❌ Implementing only 1 calculation when 2+ are specified
❌ Creating state variables without corresponding calculation functions
❌ Using generic placeholder formulas instead of exact business formulas
❌ Ignoring any keyCalculation from the brainstorm data

**REQUIRED - Complete Implementation:**
✅ State variable for EVERY keyCalculation result (e.g., neighborhoodScore, affordabilityIndex)
✅ Calculation function for EVERY keyCalculation (e.g., calculateNeighborhoodScore, calculateAffordabilityIndex)
✅ Use exact formulas from keyCalculations.formula field
✅ Include all variables mentioned in keyCalculations.variables field

**Example for Multiple Calculations:**
'''json'''
{
  "variables": [
    {"name": "neighborhoodScore", "type": "number", "defaultValue": 0},
    {"name": "affordabilityIndex", "type": "number", "defaultValue": 0}
  ],
  "functions": [
    {
      "name": "calculateNeighborhoodScore", 
      \"body\": ["const rankingScore = (weightSchools * 0.3) + (weightPrice * 0.5) + (weightCommute * 0.2);", "setNeighborhoodScore(rankingScore * 100);"]
    },
    {
      "name": "calculateAffordabilityIndex",
      \"body\": ["const budget = parseFloat(stateYourBudget);", "const affordability = 750000 / budget;", "setAffordabilityIndex(affordability);"]
    }
  ]
}
'''end json'''

**CRITICAL:** The debug system and UI require ALL calculations to be fully implemented with state variables!

<domain-specific-implementation>
    📊 **SOLAR PANEL TOOLS**: Implement solar savings calculations, payback periods, tax incentives
    💰 **FINANCIAL TOOLS**: Implement ROI, profit margins, debt ratios, liquidity ratios  
    🏢 **BUSINESS TOOLS**: Implement break-even analysis, customer metrics, conversion rates
    📈 **INVESTMENT TOOLS**: Implement compound interest, portfolio analysis, risk assessments
</domain-specific-implementation>

${commonGuidelines}
`;

const EDIT_PROMPT = `
You are a "State Logic Designer" agent, and you are in EDIT MODE.

🚨 CRITICAL MISSION: You MUST implement the EXACT calculations and business logic. NO GENERIC PLACEHOLDERS!

<role>
    Your task is to incrementally modify existing state logic based on a user's request and an updated function plan.
</role>

<responsibilities>
    1.  **Analyze the Modification Request**: Understand what the user wants to change in the tool's behavior or data handling
    2.  **Use the New Function Plan**: Your primary guide for changes is the 'updatedFunctionSignatures'
    3.  **Implement SPECIFIC Logic**: Write actual business calculations, not generic placeholders
    4.  **Incrementally Update**: Modify the 'existingStateLogic' by adding, removing, or changing state variables and function implementations
    5.  **Preserve Unchanged Logic**: Do not alter existing state or functions that are unaffected by the request
    6.  **Output Complete New Plan**: Your final output must be the complete, updated state logic object
</responsibilities>

<edit-example>
    - **Existing Logic**: Contains state for 'investment' and 'revenue'
    - **Modification Request**: "Add a field for 'operating costs'"
    - **Updated Function Plan**: Includes a new 'calculateNetProfit' function
    - **Action**: Add 'stateOperatingCosts' state variable and implement: netProfit = revenue - operatingCosts
    - **Output**: Complete state logic with the new variable and actual calculation formula
</edit-example>

${commonGuidelines}
`;

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

/**
 * Dynamically selects the appropriate system prompt for the State Design agent.
 * @param isEditing - Boolean flag, true if in edit mode.
 * @returns The system prompt string.
 */
export function getStateDesignSystemPrompt(isEditing: boolean): string {
    return isEditing ? EDIT_PROMPT : CREATION_PROMPT;
}

/**
 * Creates the user prompt for the state design agent based on TCC data
 * Enhanced with filtered brainstorm data integration and edit mode support
 */
export function getStateDesignUserPrompt(
  tcc: ToolConstructionContext, 
  functionSignatures: DefinedFunctionSignature[], 
  editMode?: EditModeContext,
  isEditMode?: boolean,
  editInstructions?: string
): string {
  // Get State Design specific filtered data
  const brainstormData = tcc.brainstormData ? filterBrainstormForStateDesign(tcc.brainstormData, tcc.jobId) : null;
  
  // FAIL HARD - No fallbacks that mask real issues!
  if (!brainstormData) {
    const errorMessage = `CRITICAL ERROR: StateDesign brainstorm filter returned null for jobId ${tcc.jobId}. This indicates a fundamental issue with the brainstorm data filtering system that must be fixed, not worked around with fallbacks.`;
    logger.error({ 
      jobId: tcc.jobId,
      originalBrainstormKeys: Object.keys(tcc.brainstormData || {}),
      filterFunction: 'filterBrainstormForStateDesign',
      tccBrainstormData: !!tcc.brainstormData
    }, errorMessage);
    throw new Error(errorMessage);
  }

  let prompt = `Generate React state logic for this tool:

TOOL DETAILS:
- Tool Type: ${brainstormData.toolType || tcc.userInput?.description || 'Business Tool'}
- Target Audience: ${tcc.userInput?.targetAudience || 'Professionals'}
- Description: ${tcc.userInput?.description || 'A business calculation tool'}

KEY CALCULATIONS TO IMPLEMENT:
${brainstormData.keyCalculations?.map(calc => `- ${calc.name}: ${calc.formula} (${calc.description})`).join('\n') || 'No calculations defined'}

SUGGESTED INPUTS:
${brainstormData.suggestedInputs?.map(input => `- ${input.label} (${input.type}): ${input.description}`).join('\n') || 'No inputs defined'}

FUNCTION SIGNATURES TO IMPLEMENT:
${functionSignatures.map(sig => `- ${sig.name}: ${sig.description || 'No description provided'}`).join('\n') || 'No specific functions defined'}

🚨 CRITICAL REQUIREMENTS:
- Generate state variables for ALL suggested inputs
- Implement ALL keyCalculations as functions
- Use proper TypeScript types
- Include validation functions
- 🚨 FAILURE TO IMPLEMENT ANY keyCalculation = INCOMPLETE TOOL!

Generate the complete state logic matching the StateLogic schema exactly.`;

  // Add edit mode context if needed
  if (isEditMode && editInstructions) {
    prompt += `

🔄 EDIT MODE:
Current state logic exists. Apply these modifications:
${editInstructions}

Modify the existing state logic while maintaining all core functionality.`;
  }

  return prompt;
}

// DEPRECATED: This will be removed once all consuming code uses the dynamic getter.
export const STATE_DESIGN_SYSTEM_PROMPT = CREATION_PROMPT; 
