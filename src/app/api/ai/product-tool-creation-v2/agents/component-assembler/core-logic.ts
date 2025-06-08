import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Type definitions for component assembly
export type AssembledComponent = {
  finalComponentCode: string;
  imports: string[];
  hooks: string[];
  functions: string[];
  metadata: {
    componentName: string;
    dependencies: string[];
    estimatedLines: number;
  };
};

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
export async function assembleComponent(request: ComponentAssemblerRequest): Promise<ComponentAssemblerResult> {
  const { jobId, selectedModel, mockTcc } = ComponentAssemblerRequestSchema.parse(request);

  try {
    let tcc: ToolConstructionContext;
    
    if (mockTcc) {
      console.log('🔧 ComponentAssembler: 🧪 MOCK MODE - Using provided mock TCC');
      tcc = mockTcc as ToolConstructionContext;
    } else {
      console.log('🔧 ComponentAssembler: Loading TCC state from store...');
      const loadedTcc = await getTCC(jobId);
      if (!loadedTcc) throw new Error(`TCC not found for jobId: ${jobId}`);
      tcc = loadedTcc;
    }

    logger.info({ 
      jobId, 
      selectedModel: selectedModel || 'default',
      isMockMode: !!mockTcc 
    }, '🔧 ComponentAssembler: Starting');

    if (!mockTcc) {
      await emitStepProgress(jobId, OrchestrationStepEnum.enum.assembling_component, 'started', 'Assembling final component...');
    }

    // Validate we have all required pieces
    if (!tcc.jsxLayout) throw new Error('JSX Layout not found in TCC');
    if (!tcc.stateLogic) throw new Error('State Logic not found in TCC');
    if (!(tcc as any).styling) throw new Error('Styling not found in TCC');

    if (!mockTcc) {
      // Update TCC status (skip in mock mode)
      const tccInProgress = { ...tcc, status: OrchestrationStatusEnum.enum.in_progress, updatedAt: new Date().toISOString() };
      await saveTCC(tccInProgress);
    }

    // Assemble the component with AI
    const assembledComponent = await generateAssembledComponent(tcc, selectedModel);

    if (!mockTcc) {
      // Update TCC with results (skip in mock mode)
      const updatedTCC = {
        ...tcc,
        assembledComponentCode: assembledComponent.finalComponentCode,
        steps: {
          ...tcc.steps,
          assemblingComponent: {
            status: OrchestrationStatusEnum.enum.completed,
            startedAt: tcc.steps?.assemblingComponent?.startedAt || new Date().toISOString(),
            completedAt: new Date().toISOString(),
            result: assembledComponent
          }
        },
        updatedAt: new Date().toISOString()
      };
      await saveTCC(updatedTCC);

      // Emit progress with assembled component code for frontend to enable Live Preview
      await emitStepProgress(jobId, OrchestrationStepEnum.enum.assembling_component, 'completed', 
        `Component assembled: ${assembledComponent.metadata.estimatedLines} lines, ${assembledComponent.metadata.dependencies.length} dependencies`,
        { 
          assembledComponent, 
          assembledComponentCode: assembledComponent.finalComponentCode,
          tcc: updatedTCC
        });

      // CRITICAL: Trigger the next step in the orchestration
      await triggerNextOrchestrationStep(jobId);
    }

    logger.info({ 
      jobId, 
      componentLines: assembledComponent.metadata.estimatedLines,
      dependencies: assembledComponent.metadata.dependencies.length 
    }, '🔧 ComponentAssembler: Completed successfully');

    return { success: true, assembledComponent };

  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, '🔧 ComponentAssembler: Error');
    
    if (!mockTcc) {
      await emitStepProgress(jobId, OrchestrationStepEnum.enum.assembling_component, 'failed', 
        `Component assembly failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
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
async function generateAssembledComponent(tcc: ToolConstructionContext, selectedModel?: string) {
  // Model selection logic (same as other agents)
  let modelConfig: { provider: string; modelId: string };
  let actualModelName: string;

  if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      modelConfig = { provider, modelId: selectedModel };
      actualModelName = selectedModel;
    } else {
      const primaryModel = getPrimaryModel('toolCreator');
      modelConfig = primaryModel && 'modelInfo' in primaryModel ? 
        { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } :
        { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = modelConfig.modelId;
    }
  } else {
    try {
      const primaryModel = getPrimaryModel('toolCreator');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
      } else {
        const fallbackModel = getFallbackModel('toolCreator');
        modelConfig = fallbackModel && 'modelInfo' in fallbackModel ?
          { provider: fallbackModel.provider, modelId: fallbackModel.modelInfo.id } :
          { provider: 'openai', modelId: 'gpt-4o' };
        actualModelName = modelConfig.modelId;
      }
    } catch (error) {
      modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = 'gpt-4o';
    }
  }

  logger.info({ provider: modelConfig.provider, modelName: actualModelName }, '🔧 ComponentAssembler: Using model');

  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = `You are a React component assembler. Combine JSX layout, state logic, and styling into a complete React component.

CRITICAL REQUIREMENTS:
1. Create a COMPLETE, FUNCTIONAL React component
2. Apply ALL styling from the styleMap to the correct elements
3. Integrate ALL state variables and functions
4. Ensure ALL function signatures are properly implemented
5. Use TypeScript with proper types
6. Include all necessary imports

Return your component wrapped in tsx code blocks.`;

  const userPrompt = `Component Name: ${generateComponentName(tcc.userInput.description)}

JSX LAYOUT:
${tcc.jsxLayout?.componentStructure}

STATE LOGIC:
Variables: ${JSON.stringify(tcc.stateLogic?.variables, null, 2)}
Functions: ${JSON.stringify(tcc.stateLogic?.functions, null, 2)}

STYLING (Apply to matching elements):
${JSON.stringify(tcc.styling?.styleMap, null, 2)}

FUNCTION SIGNATURES TO IMPLEMENT:
${tcc.definedFunctionSignatures?.map(sig => `${sig.name}() - ${sig.description || 'No description'}`).join('\n')}

Assemble these pieces into a complete, functional React component.`;

  logger.info({ modelId: modelConfig.modelId, promptLength: userPrompt.length }, '🔧 ComponentAssembler: Calling AI');

  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.2,
    maxTokens: 4000
  });

  if (!content) throw new Error('No response from AI model');

  // Parse the AI response
  return parseComponentResponse(content, tcc);
}

/**
 * Parse AI response for the assembled component
 */
function parseComponentResponse(content: string, tcc: ToolConstructionContext) {
  // Extract component code from AI response
  const componentMatch = content.match(/```(?:tsx|typescript|ts)?\s*([\s\S]*?)\s*```/);
  
  let finalComponentCode: string;
  if (componentMatch) {
    finalComponentCode = componentMatch[1];
    logger.info({ codeLength: finalComponentCode.length }, '🔧 ComponentAssembler: AI FIRST - Using AI component');
  } else {
    // Fallback assembly
    finalComponentCode = generateFallbackComponent(tcc);
    logger.warn('🔧 ComponentAssembler: No AI component found, using fallback');
  }

  // Extract metadata from the component
  const imports = extractImports(finalComponentCode);
  const hooks = extractHooks(finalComponentCode);
  const functions = extractFunctions(finalComponentCode);
  
  return {
    finalComponentCode,
    imports,
    hooks,
    functions,
    metadata: {
      componentName: generateComponentName(tcc.userInput.description),
      dependencies: [...new Set([...imports, 'react', '@types/react'])],
      estimatedLines: finalComponentCode.split('\n').length
    }
  };
}

/**
 * Generate component name from user input
 */
function generateComponentName(userInput: string): string {
  return userInput
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    .replace(/\s/g, '') + 'Tool';
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
function generateFallbackComponent(tcc: ToolConstructionContext): string {
  const componentName = generateComponentName(tcc.userInput.description);
  
  return `import React, { useState } from 'react';

interface ${componentName}Props {}

export const ${componentName}: React.FC<${componentName}Props> = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = () => {
    setResult('Processing: ' + input);
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">${componentName}</h1>
      <div className="space-y-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Enter input..."
        />
        <button
          onClick={handleSubmit}
          className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Submit
        </button>
        {result && (
          <div className="p-2 bg-gray-100 rounded">
            {result}
          </div>
        )}
      </div>
    </div>
  );
};

export default ${componentName};`;
} 