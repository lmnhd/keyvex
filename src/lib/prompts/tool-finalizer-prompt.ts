import { ToolConstructionContext, BrainstormData } from '@/lib/types/tcc-unified';

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

// Minimal tool finalizer prompt
export function getToolFinalizerSystemPrompt(debug: boolean = false): string {
  return `You are a Tool Finalizer Agent. Package the component into a final tool definition.

Generate a JSON response matching the FinalProductToolDefinitionSchema with fields like:
{
  "id": "unique-tool-id",
  "slug": "tool-slug", 
  "version": "1.0.0",
  "status": "published",
  "createdAt": timestamp,
  "updatedAt": timestamp,
  "createdBy": "ai-generator",
  "metadata": {...},
  "componentSet": "shadcn",
  "componentCode": "React component code",
  "colorScheme": {...},
  "analytics": {...}
}

Create a complete, deployment-ready tool definition.`;
}

export function getToolFinalizerUserPrompt(tcc: ToolConstructionContext, editMode?: EditModeContext): string {
  let prompt = `Finalize this tool with comprehensive metadata and deployment configuration:

TOOL OVERVIEW:
- Description: ${tcc.userInput?.description || 'Business Tool'}
- Target Audience: ${tcc.userInput?.targetAudience || 'Professionals'}
- Job ID: ${tcc.jobId}`;

  // Add component information from finalProduct
  if (tcc.finalProduct?.componentCode) {
    prompt += `

COMPONENT DETAILS:
- Code Length: ${tcc.finalProduct.componentCode.length} characters
- Component Present: Yes`;
  }

  // Add validation results
  if (tcc.validationResult) {
    prompt += `

VALIDATION RESULTS:
- Valid: ${tcc.validationResult.isValid ? 'Yes' : 'No'}
- Error: ${tcc.validationResult.error || 'None'}
- Has Details: ${tcc.validationResult.details ? 'Yes' : 'No'}`;
  }

  // Add brainstorm context for categorization
  if (tcc.brainstormData) {
    const brainstormData: BrainstormData = tcc.brainstormData;
    prompt += `

TOOL CONTEXT:
- Core Concept: ${brainstormData.coreConcept || brainstormData.coreWConcept || 'Unknown'}
- Value Proposition: ${brainstormData.valueProposition || 'Unknown'}
- Key Calculations: ${brainstormData.keyCalculations?.map((calc) => calc.name).join(', ') || 'None'}
- Industry: ${brainstormData.promptOptions?.industryFocus || 'General'}`;
  }

  // Add edit mode context if needed
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    prompt += `

🔄 EDIT MODE FINALIZATION:
Recent modifications were made. Update metadata to reflect:
${editMode.instructions.map(i => i.instructions).join('\n')}`;
  }

  prompt += `

Generate comprehensive tool finalization including:
- Unique tool ID and versioning
- Proper categorization and metadata
- Complete component integration
- Production-ready configuration
- Deployment readiness assessment based on validation results

Ensure the tool is properly packaged for production deployment.`;

  return prompt;
} 
