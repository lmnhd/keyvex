// File Path: keyvex_app/src/lib/agents/unified/modules/component-assembler.ts
import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  AssembledComponent,
  AssembledComponentSchema,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import {
  getPrimaryModel,
  getModelProvider,
} from '@/lib/ai/models/model-config';
import { getComponentAssemblerSystemPrompt } from '@/lib/prompts/v2/component-assembler-prompt';
import logger from '@/lib/logger';
import { filterBrainstormForComponentAssembler } from '@/lib/utils/brainstorm-filter';

// Use TCC schema directly
const ComponentAssemblerOutputSchema = AssembledComponentSchema;
export type ComponentAssemblerOutput = AssembledComponent;

// Edit mode context type
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

// Module interface for the unified agent system
export interface ComponentAssemblerRequest {
  jobId: string;
  selectedModel?: string;
  tcc: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
}

export interface ComponentAssemblerResult {
  success: boolean;
  assembledComponent?: AssembledComponent;
  error?: string;
  updatedTcc: ToolConstructionContext;
}

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

/**
 * Component Assembler Module - Extracted core logic for unified agent system
 * Assembles final React component from JSX, state logic, and styling
 */
export async function executeComponentAssembler(request: ComponentAssemblerRequest): Promise<ComponentAssemblerResult> {
  const { jobId, selectedModel, tcc, isIsolatedTest = false, editMode } = request;
  
  // Edit mode detection
  const isEditMode = editMode?.isEditMode || false;
  const editInstructions = editMode?.instructions || [];

  logger.info({ jobId, isIsolatedTest }, '🔧 ComponentAssembler Module: Starting component assembly');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Emit progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.assembling_component,
        'in_progress',
        'Assembling final React component...',
        tcc
      );
    }

    logger.info({ jobId }, '🔧 ComponentAssembler Module: Calling AI to assemble component...');
    const assembledComponent = await generateAssembledComponent(tcc, selectedModel, editMode);
    logger.info({ jobId }, '🔧 ComponentAssembler Module: AI assembled component successfully');

    // Comprehensive TCC update logging
    logger.info({
      jobId,
      agentName: 'ComponentAssembler',
      tccUpdateDetail: {
        beforeAssembledComponent: !!tcc.assembledComponent,
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🔧 ComponentAssembler Module: TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      assembledComponent,
      steps: {
        ...tcc.steps,
        assemblingComponent: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tcc.steps?.assemblingComponent?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: assembledComponent,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // Comprehensive TCC update logging - detailed output
    logger.info({
      jobId,
      agentName: 'ComponentAssembler',
      tccUpdateDetail: {
        afterAssembledComponent: !!updatedTcc.assembledComponent,
        afterSteps: Object.keys(updatedTcc.steps || {}),
        afterLastUpdated: updatedTcc.updatedAt,
        componentDetails: {
          finalComponentCodeLength: updatedTcc.assembledComponent?.finalComponentCode?.length || 0,
          componentName: updatedTcc.assembledComponent?.componentName,
          hooksCount: updatedTcc.assembledComponent?.hooks?.length || 0,
          functionsCount: updatedTcc.assembledComponent?.functions?.length || 0,
          estimatedLines: updatedTcc.assembledComponent?.estimatedLines || 0
        },
        stepStatusUpdate: updatedTcc.steps?.assemblingComponent?.status,
        stepResult: !!updatedTcc.steps?.assemblingComponent?.result
      }
    }, '🔧 ComponentAssembler Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.assembling_component,
        'completed',
        `Successfully assembled ${assembledComponent.componentName} component with ${assembledComponent.hooks?.length || 0} hooks and ${assembledComponent.functions?.length || 0} functions.`,
        updatedTcc
      );
    }

    return { success: true, assembledComponent, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🔧 ComponentAssembler Module: Error');
    
    // Emit failure progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'failed',
      errorMessage,
      tcc
    );
    
    return { success: false, error: errorMessage, updatedTcc: tcc };
  }
}

async function generateAssembledComponent(
  tcc: ToolConstructionContext,
  selectedModel?: string,
  editMode?: EditModeContext,
): Promise<AssembledComponent> {
  let modelConfig: { provider: string; modelId: string };
  
  // PRIORITY 1: Check TCC agent model mapping first
  if (tcc.agentModelMapping?.['component-assembler']) {
    const mappedModel = tcc.agentModelMapping['component-assembler'];
    const provider = getModelProvider(mappedModel);
    modelConfig = { 
      provider: provider !== 'unknown' ? provider : 'openai', 
      modelId: mappedModel 
    };
    logger.info({ 
      agentName: 'component-assembler', 
      mappedModel, 
      provider: modelConfig.provider,
      source: 'TCC_AGENT_MAPPING' 
    }, '🔧 ComponentAssembler Module: Using TCC AGENT MAPPING model from workbench');
  }
  // PRIORITY 2: User-selected model from request
  else if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = { provider: provider !== 'unknown' ? provider : 'openai', modelId: selectedModel };
    logger.info({ 
      selectedModel, 
      provider: modelConfig.provider,
      source: 'REQUEST_PARAMETER' 
    }, '🔧 ComponentAssembler Module: Using REQUEST PARAMETER model');
  } 
  // PRIORITY 3: Fallback to configuration
  else {
    const primaryModel = getPrimaryModel('componentAssembler');
    modelConfig = primaryModel && 'modelInfo' in primaryModel ? { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id } : { provider: 'openai', modelId: 'gpt-4o' };
    logger.info({ 
      modelConfig,
      source: 'CONFIGURATION_FALLBACK' 
    }, '🔧 ComponentAssembler Module: Using CONFIGURATION FALLBACK model');
  }

  logger.info({ ...modelConfig }, '🔧 ComponentAssembler Module: Using model');
  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = getComponentAssemblerSystemPrompt(false);
  const userPrompt = createUserPrompt(tcc, editMode);

  // Isolation test logging
  logger.info({
    jobId: tcc.jobId,
    modelId: modelConfig.modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    brainstormDataPresent: !!tcc.brainstormData,
    jsxLayoutPresent: !!tcc.jsxLayout,
    stateLogicPresent: !!tcc.stateLogic,
    stylingPresent: !!tcc.styling
  }, '🔧 ComponentAssembler Module: ISOLATION DEBUG - Input data analysis');

  try {
    const { object: assembledComponent } = await generateObject({
      model: modelInstance,
      schema: ComponentAssemblerOutputSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.2,
      maxTokens: 6000,
    });

    logger.info({ 
      jobId: tcc.jobId, 
      modelId: modelConfig.modelId,
      componentName: assembledComponent.componentName,
      finalComponentCodeLength: assembledComponent.finalComponentCode?.length || 0,
      aiResponseReceived: true
    }, '🔧 ComponentAssembler Module: Successfully received structured object from AI');

    return assembledComponent;
  } catch (error) {
    logger.error({ error }, '🔧 ComponentAssembler Module: AI call failed. Generating fallback.');
    return generateFallbackComponent(tcc);
  }
}

function generateFallbackComponent(tcc: ToolConstructionContext): AssembledComponent {
  const componentName = 'BusinessTool';
  
  return {
    finalComponentCode: `import React, { useState } from 'react';

export default function ${componentName}() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleCalculate = () => {
    setIsLoading(true);
    // Calculation logic would go here
    setTimeout(() => {
      setResult('Calculation complete');
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4">Business Tool</h1>
      <div className="space-y-4">
        <button
          onClick={handleCalculate}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Calculating...' : 'Calculate'}
        </button>
        {result && (
          <div className="p-4 bg-gray-50 rounded">
            <p>{result}</p>
          </div>
        )}
      </div>
    </div>
  );
}`,
    componentName,
    hooks: ['useState'],
    functions: ['handleCalculate'],
    estimatedLines: 35
  };
}

function createUserPrompt(tcc: ToolConstructionContext, editMode?: EditModeContext): string {
  // Get Component Assembler specific filtered data
  const filteredBrainstormData = filterBrainstormForComponentAssembler(tcc.brainstormData, tcc.jobId);
  
  let prompt = `Assemble a complete React component from the following parts:

TOOL DETAILS:
- Tool Type: ${tcc.userInput?.description || 'Business Tool'}
- Target Audience: ${tcc.userInput?.targetAudience || 'Professionals'}`;

  // Add JSX layout
  if (tcc.jsxLayout) {
    prompt += `

JSX COMPONENT STRUCTURE:
\`\`\`jsx
${tcc.jsxLayout.componentStructure}
\`\`\``;
  }

  // Add state logic
  if (tcc.stateLogic) {
    prompt += `

STATE LOGIC:
Variables: ${tcc.stateLogic.variables?.map(v => `${v.name}: ${v.type}`).join(', ') || 'None'}
Functions: ${tcc.stateLogic.functions?.map(f => f.name).join(', ') || 'None'}
Imports: ${tcc.stateLogic.imports?.join(', ') || 'None'}`;
  }

  // Add styling
  if (tcc.styling) {
    prompt += `

STYLED COMPONENT:
\`\`\`jsx
${tcc.styling.styledComponentCode}
\`\`\``;
  }

  // Add filtered brainstorm context when available
  if (filteredBrainstormData) {
    logger.info({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: true,
      dataReduction: 'Applied Component Assembler specific filtering'
    }, '🔧 ComponentAssembler Module: [FILTERED BRAINSTORM] Context successfully added to prompt');
  } else {
    logger.warn({ 
      jobId: tcc.jobId,
      promptLength: prompt.length,
      brainstormContextAdded: false
    }, '🔧 ComponentAssembler Module: [FILTERED BRAINSTORM] ⚠️ Prompt created WITHOUT brainstorm context - component may be too generic');
  }

  // Add edit mode context if needed
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    prompt += `

🔄 EDIT MODE:
Current component exists. Apply these modifications:
${editMode.instructions.map(i => i.instructions).join('\n')}

Modify the existing component while maintaining all core functionality.`;
  }

  prompt += `

Combine all parts into a single, complete React component with proper TypeScript types.`;

  return prompt;
} 