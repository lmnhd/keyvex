// Minimal component assembler prompt
export function getComponentAssemblerSystemPrompt(debug: boolean = false): string {
  return `You are a Component Assembler Agent. Combine JSX layout, state logic, and styling into a complete React component.

Generate a JSON response with this structure:
{
  "finalComponentCode": "complete React component code",
  "componentName": "ComponentName", 
  "hooks": ["useState", "useEffect"],
  "functions": ["handleClick", "calculateResult"],
  "estimatedLines": 150
}

Make sure the component is functional and follows React best practices.`;
} 
