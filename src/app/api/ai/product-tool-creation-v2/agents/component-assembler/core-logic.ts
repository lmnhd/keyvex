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
  finalComponentCode: z.string().describe('The complete, single string of final React component code.'),
  imports: z.array(z.string()).describe('An array of required import statements.'),
  hooks: z.array(z.string()).describe('An array of React hooks used in the component.'),
  functions: z.array(z.string()).describe('An array of functions defined within the component.'),
  metadata: z.object({
    componentName: z.string().describe('The name of the generated component.'),
    dependencies: z.array(z.string()).describe('An array of npm package dependencies.'),
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
 * Generate assembled component using AI
 */
async function generateAssembledComponent(tcc: ToolConstructionContext, selectedModel?: string): Promise<AssembledComponent> {
  // Model selection logic
  const { provider, modelId } = getModelForAgent('componentAssembler', selectedModel);
  logger.info({ provider, modelId }, '🔧 ComponentAssembler: Using model');
  const modelInstance = createModelInstance(provider, modelId);

  const systemPrompt = `You are an expert React component assembler. Combine the provided JSX layout, state logic, and styling into a single, complete, and functional React component.

CRITICAL REQUIREMENTS:
1. Create a COMPLETE, FUNCTIONAL React component file content as a single string.
2. Apply ALL styling from the styleMap to the correct elements using the 'className' prop.
3. Integrate ALL state variables and functions from the state logic.
4. Ensure ALL function signatures from the state logic are implemented correctly.
5. Use TypeScript with proper types for props, state, and event handlers.
6. Include all necessary imports (React, hooks, etc.).
7. Return a single JSON object that strictly conforms to the provided schema.

COMPONENT IMPORTS - AUTOMATICALLY INCLUDE THESE:
Always include these imports at the top of the component file:

\`\`\`typescript
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, AlertCircle, Loader2 } from 'lucide-react';
\`\`\`

COMPONENT USAGE RULES:
- Any reference to "Card" should use the imported Card component
- Any reference to "Button" should use the imported Button component  
- Any reference to "Input" should use the imported Input component
- Any reference to "Label" should use the imported Label component
- Any reference to "Tooltip", "TooltipProvider", etc. should use the imported components
- Icons like "Info", "AlertCircle" should use the imported Lucide React icons

CRITICAL: The final component must be export default and properly typed.`;

  const userPrompt = `Please assemble the React component using the following parts.

Component Name Suggestion: ${generateComponentName(tcc.userInput.description)}

JSX LAYOUT (the structural blueprint):
\`\`\`jsx
${tcc.jsxLayout?.componentStructure}
\`\`\`

STATE LOGIC (the brains and functionality):
\`\`\`json
${JSON.stringify(tcc.stateLogic, null, 2)}
\`\`\`

STYLING (the visual appearance - apply to matching element IDs):
\`\`\`json
${JSON.stringify((tcc as any).styling?.styleMap, null, 2)}
\`\`\`

Generate the complete JSON object containing the final component code with all necessary imports and proper component usage.`;

  try {
    const { object } = await generateObject({
      model: modelInstance,
      schema: assembledComponentSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.1,
      maxTokens: 8192,
    });
    return object;
  } catch (error) {
    logger.error({ error, provider, modelId }, '🔧 ComponentAssembler: AI call failed. Returning fallback component.');
    return generateFallbackComponent(tcc);
  }
}

function getModelForAgent(agentName: string, selectedModel?: string): { provider: string; modelId: string } {
    if (selectedModel && selectedModel !== 'default') {
        const provider = getModelProvider(selectedModel);
        if (provider !== 'unknown') {
            return { provider, modelId: selectedModel };
        }
    }
    const primaryModel = getPrimaryModel(agentName as any);
    if (primaryModel && 'modelInfo' in primaryModel) {
        return { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
    }
    const fallbackModel = getFallbackModel(agentName as any);
    if (fallbackModel && 'modelInfo' in fallbackModel) {
        return { provider: fallbackModel.provider, modelId: fallbackModel.modelInfo.id };
    }
    return { provider: 'openai', modelId: 'gpt-4o' }; // Final fallback
}

/**
 * Generate component name from user input
 */
function generateComponentName(userInput: string): string {
  const name = userInput || 'Tool';
  const cleanedName = name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '');
  return cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
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
  
  return {
    finalComponentCode: `import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ${componentName}Props {}

export const ${componentName}: React.FC<${componentName}Props> = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = () => {
    setResult('Processing: ' + input);
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>${componentName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="input-field">Enter Input</Label>
            <Input
              id="input-field"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter input..."
            />
          </div>
          <Button onClick={handleSubmit} className="w-full">
            Submit
          </Button>
          {result && (
            <div className="p-2 bg-gray-100 rounded">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ${componentName};`,
    imports: [...new Set(['react', '@types/react'])],
    hooks: [],
    functions: [],
    metadata: {
      componentName,
      dependencies: ['react', '@types/react'],
      estimatedLines: 10
    }
  };
} 