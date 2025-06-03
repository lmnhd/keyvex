import { ProductToolDefinition } from '@/lib/types/product-tool';
import { ValidationIssue } from '@/lib/types/validation';

// ============================================================================
// TOOL FIXER AGENT - SYSTEM PROMPT
// ============================================================================

export const TOOL_FIXER_SYSTEM_PROMPT = `
You are an expert React code correction AI, a meticulous "Code Doctor".
Your primary mission is to FIX a given React component and its associated metadata (a ProductToolDefinition JSON object) based on a list of specific validation errors provided.

CRITICAL DIRECTIVES:
1.  PRIORITIZE ERROR RESOLUTION: You MUST address ALL listed validation errors. This is your top priority.
2.  MINIMAL & TARGETED CHANGES: Modify the provided 'componentCode', 'initialStyleMap', and other fields of the ProductToolDefinition JSON minimally. Only make changes necessary to fix the identified errors. AVOID rewriting entire sections or introducing new features.
3.  PRESERVE INTENT & STRUCTURE: Maintain the original intent, core logic, and overall structure of the tool. Your goal is to repair, not to redesign.
4.  ADHERE TO SYNTAX CONSTRAINTS: The 'componentCode' you are working with and will output MUST strictly use React.createElement() syntax. NO JSX (< > brackets for HTML-like tags) is allowed.
5.  NO IMPORTS/EXPORTS: The 'componentCode' MUST NOT contain any import or export statements.
6.  STYLES & KEYS:
    - All styleable elements in 'componentCode' MUST have a 'data-style-id' attribute.
    - The 'initialStyleMap' IS REQUIRED, MUST NOT be empty, and MUST contain a valid Tailwind CSS class string for EVERY 'data-style-id' present in the 'componentCode'.
    - React keys are MANDATORY and must be unique for all elements generated in an array.
7.  INTERACTIVITY: Components are expected to be interactive. Ensure 'useState' is used for managing state and that event handlers (e.g., onClick, onChange) are present for user interaction.
8.  OUTPUT FORMAT: You MUST return the ENTIRE corrected ProductToolDefinition as a single, valid JSON object, matching the original schema precisely.

Your goal is to transform the faulty ProductToolDefinition into a perfectly valid one that passes all validation checks based on the errors provided.
Think of yourself as a surgeon: precise, focused, and intent on healing the code.
`;

// ============================================================================
// TOOL FIXER AGENT - USER PROMPT BUILDER
// ============================================================================

export function buildToolFixerUserPrompt(
  failedToolDefinition: ProductToolDefinition,
  validationIssues: ValidationIssue[],
  originalUserIntent: string,
  attemptNumber: number,
  maxAttempts: number
): string {
  // Helper to create a clean JSON string for the prompt
  const faultyToolJson = JSON.stringify(failedToolDefinition, null, 2);

  let prompt = `The following ProductToolDefinition (attempt ${attemptNumber}/${maxAttempts}) has FAILED validation. Please carefully review the errors and the provided JSON, then return the corrected ProductToolDefinition.\n\n`;

  prompt += `----------------------------------------------\n`;
  prompt += `ORIGINAL USER INTENT (Maintain this goal):\n`;
  prompt += `----------------------------------------------\n`;
  prompt += `${originalUserIntent}\n\n`;

  prompt += `-------------------------------------------------------------\n`;
  prompt += `FAULTY ProductToolDefinition (JSON to be meticulously corrected):\n`;
  prompt += `-------------------------------------------------------------\n`;
  // Using a placeholder for the JSON and then replacing it to avoid complex escapes in template literal
  prompt += `PLACEHOLDER_FOR_FAULTY_JSON\n\n`; 

  prompt += `--------------------------------------------------------------------\n`;
  prompt += `VALIDATION ERRORS TO FIX (Address ALL of these with precision):\n`;
  prompt += `--------------------------------------------------------------------\n`;
  if (validationIssues.length === 0) {
    prompt += `No specific validation errors were provided, but the tool still failed. Please review the entire ProductToolDefinition for adherence to general best practices and the system prompt rules (e.g., initialStyleMap completeness, interactivity, React.createElement syntax, no JSX, no imports/exports).\n`;
  } else {
    validationIssues.forEach((issue, index) => {
      prompt += `\nERROR ${index + 1}:\n`;
      prompt += `  - CATEGORY: ${issue.category}\n`;
      prompt += `  - SEVERITY: ${issue.severity}\n`;
      prompt += `  - ISSUE DESCRIPTION: ${issue.issue}\n`;
      if (issue.details) {
        prompt += `  - DETAILS: ${issue.details}\n`;
      }
      if (issue.codeSnippet) {
        const escapedSnippet = issue.codeSnippet.replace(/\`/g, '\\\`'); // Escape backticks for markdown
        prompt += `  - APPROXIMATE CODE CONTEXT (from validation): ${escapedSnippet}\n`;
      }
    });
  }
  prompt += `\n--------------------------------------------------------------------\n`;

  prompt += `INSTRUCTIONS FOR CORRECTION:\n`;
  prompt += `1.  Focus on the 'componentCode' and 'initialStyleMap' first, as these are common sources of errors.\n`;
  prompt += `2.  If errors relate to metadata, colorScheme, or other parts of the JSON, correct those fields as well.\n`;
  prompt += `3.  Ensure the entire response is a single, complete, and valid ProductToolDefinition JSON object.\n`;
  prompt += `4.  Double-check all constraints mentioned in the system prompt (React.createElement only, no JSX, no imports/exports, mandatory initialStyleMap, React keys, interactivity).\n`;

  if (attemptNumber === maxAttempts) {
    prompt += `\n🚨 THIS IS THE FINAL ATTEMPT (${attemptNumber}/${maxAttempts}). Please be extremely thorough and ensure all errors are resolved to produce a valid tool.\n`;
  }

  prompt += `\nReturn only the corrected ProductToolDefinition JSON object.\n`;

  // Replace placeholder with the actual JSON, wrapped in markdown code block
  return prompt.replace('PLACEHOLDER_FOR_FAULTY_JSON', '```json\n' + faultyToolJson + '\n```');
}

/*
// Ensure this interface matches your actual ValidationIssue type definition
// It might be imported from '@/lib/types/product-tool' or another shared types file.
export interface ValidationIssue {
  id: string;
  toolId: string;
  toolTitle: string;
  severity: 'warning' | 'error' | 'info';
  category: string;
  issue: string;
  details?: string;
  codeSnippet?: string;
  timestamp: number;
  resolved: boolean;
  autoFixable: boolean;
}
*/
