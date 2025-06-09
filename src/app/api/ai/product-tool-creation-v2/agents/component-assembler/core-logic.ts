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

❌ ABSOLUTELY FORBIDDEN - DO NOT DO THESE THINGS:
- DO NOT include any import statements (import React, import { Button }, etc.)
- DO NOT import from 'some-ui-library' or any other library
- DO NOT import react-icons or any external packages
- DO NOT write: import React, { useState } from 'react';
- DO NOT write: import { Card, Button } from 'any-library';

✅ WHAT YOU MUST DO INSTEAD:
- Start the component code directly with interface definitions
- Use components directly as if they are globally available
- All React hooks and ShadCN components are already in scope

EXECUTION CONTEXT - THESE ARE AVAILABLE WITHOUT IMPORTS:
React: React (the React object itself)
Hooks: useState, useEffect, useCallback, useMemo
UI Components: Card, CardHeader, CardContent, CardTitle, CardDescription, Button, Input, Label, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Textarea, Progress, RadioGroup, RadioGroupItem, Checkbox, Slider, Switch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, Accordion, AccordionContent, AccordionItem, AccordionTrigger
Icons: Info, AlertCircle, Loader2

CORRECT COMPONENT STRUCTURE EXAMPLE:
\`\`\`typescript
interface CalculatorProps {}

const Calculator: React.FC<CalculatorProps> = () => {
  const [value, setValue] = useState(0);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculator</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setValue(v => v + 1)}>
          Increment
        </Button>
      </CardContent>
    </Card>
  );
};

export default Calculator;
\`\`\`

CRITICAL REQUIREMENTS:
1. Create COMPLETE, FUNCTIONAL React component code as a single string
2. Apply ALL styling from the styleMap to correct elements using 'className' prop
3. Integrate ALL state variables and functions from the state logic
4. Ensure ALL function signatures from state logic are implemented correctly
5. Use TypeScript with proper types for props, state, and event handlers
6. Return a single JSON object that strictly conforms to the provided schema
7. The finalComponentCode field must contain executable React component code

REMEMBER: No imports allowed - everything is available in execution context!`;

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

Generate the complete JSON object containing the final component code WITHOUT imports and using the available components from the execution context.`;

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