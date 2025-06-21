import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

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

// Validator prompt for V2 system - handles programmatic validation with auto-correction
export function getValidatorSystemPrompt(): string {
  return `You are a Code Validator Agent specializing in React component validation and auto-correction.

Your role is to validate generated React component code and apply automatic corrections for common issues, particularly with Radix UI components.

Key responsibilities:
1. Validate TypeScript syntax and compilation
2. Check for React best practices compliance  
3. Auto-correct Radix UI event handler mismatches
4. Fix common state management issues
5. Ensure proper import statements

Auto-correction patterns you handle:
- Select components: onChange → onValueChange
- Slider components: onChange → onValueChange, number state → array state
- RadioGroup components: onChange → onValueChange  
- Button onClick: string handlers → function references
- Missing function declarations
- React import deduplication

Return validation results with specific error details and auto-correction status.`;
}

export const VALIDATOR_SYSTEM_PROMPT = getValidatorSystemPrompt();

/**
 * Creates the user prompt for the validator agent based on TCC data
 * Enhanced with component code validation and edit mode support
 */
export function getValidatorUserPrompt(tcc: ToolConstructionContext, editMode?: EditModeContext): string {
  let prompt = `Validate this React component for errors, warnings, and quality issues:

COMPONENT TO VALIDATE:`;

  // Add component code from finalProduct
  if (tcc.finalProduct?.componentCode) {
    prompt += `
\`\`\`typescript
${tcc.finalProduct.componentCode}
\`\`\`

COMPONENT METADATA:
- Code Length: ${tcc.finalProduct.componentCode.length} characters`;
  } else {
    prompt += `
⚠️ NO COMPONENT CODE FOUND - This is a critical error.`;
  }

  // Add context from other TCC parts
  if (tcc.stateLogic) {
    prompt += `

EXPECTED STATE LOGIC:
Variables: ${tcc.stateLogic.variables?.map(v => `${v.name}: ${v.type}`).join(', ') || 'None'}
Functions: ${tcc.stateLogic.functions?.map(f => f.name).join(', ') || 'None'}`;
  }

  if (tcc.jsxLayout) {
    prompt += `

EXPECTED ACCESSIBILITY FEATURES:
${tcc.jsxLayout.accessibilityFeatures?.join(', ') || 'None specified'}`;
  }

  // Add edit mode context if needed
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    prompt += `

🔄 EDIT MODE VALIDATION:
Recent modifications were made. Pay special attention to:
${editMode.instructions.map(i => i.instructions).join('\n')}`;
  }

  prompt += `

Perform comprehensive validation including:
- Syntax errors and TypeScript issues
- React best practices
- Performance considerations
- Accessibility compliance
- Code quality and readability

Provide detailed feedback with specific line references where possible.`;

  return prompt;
} 