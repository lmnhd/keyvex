import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, updateTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import {
  getPrimaryModel,
  getFallbackModel,
  getModelProvider,
} from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

const finalProductSchema = z.object({
  componentName: z.string().describe('The PascalCase name of the final component, e.g., "MortgageCalculator".'),
  finalCode: z.string().describe('The complete, production-ready React component code as a single string.'),
  dependencies: z.array(z.string()).describe('A list of NPM package dependencies, e.g., ["react-icons", "recharts"].'),
  userInstructions: z.string().describe('Brief, friendly instructions for the user on how to use this tool.'),
  developerNotes: z.string().describe('Technical notes for a developer, including any setup or integration points.'),
});

type FinalProduct = z.infer<typeof finalProductSchema>;

export async function finalizeTool(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
}): Promise<{
  success: boolean;
  finalProduct?: FinalProduct;
  error?: string;
}> {
  const { jobId, selectedModel } = request;
  const tcc = request.mockTcc || request.tcc;

  try {
    logger.info({ jobId }, '✅ ToolFinalizer: Starting finalization');
    if (!tcc) {
      throw new Error(`TCC was not provided for jobId: ${jobId}`);
    }

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.finalizing_tool,
      'in_progress',
      'Assembling the final tool...'
    );

    const { provider, modelId } = getModelForAgent('toolFinalizer', selectedModel);
    logger.info({ provider, modelId, agent: 'toolFinalizer' }, '✅ ToolFinalizer: Using model');
    const model = createModelInstance(provider, modelId);

    const { object: finalProduct } = await generateObject({
      model,
      schema: finalProductSchema,
      system: getSystemPrompt(),
      prompt: createFinalizerUserPrompt(tcc),
      temperature: 0.1,
    });

    await updateTCC(jobId, {
      finalProduct,
      status: OrchestrationStatusEnum.enum.completed,
      currentOrchestrationStep: OrchestrationStepEnum.enum.completed,
    });

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.finalizing_tool,
      'completed',
      'Tool has been finalized successfully!',
      finalProduct
    );

    logger.info({ jobId }, '✅ ToolFinalizer: Tool finalized successfully.');
    return { success: true, finalProduct };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : 'No stack available';
    logger.error({ jobId, error: errorMessage, stack }, '✅ ToolFinalizer: Error finalizing tool');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.finalizing_tool,
      'failed',
      errorMessage
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

function getModelForAgent(agentName: string, selectedModel?: string): { provider: string; modelId: string } {
    if (selectedModel && selectedModel !== 'default') {
        const provider = getModelProvider(selectedModel);
        if (provider !== 'unknown') {
            return { provider, modelId: selectedModel };
        }
    }
    const primaryModel = getPrimaryModel(agentName);
    if (primaryModel && 'modelInfo' in primaryModel) {
        return { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
    }
    // Final fallback if no config is found
    logger.warn({ agentName }, 'No specific model config found, using global fallback gpt-4o.');
    return { provider: 'openai', modelId: 'gpt-4o' };
}

function createModelInstance(provider: string, modelId: string) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    default:
      throw new Error(`Unsupported model provider: ${provider}`);
  }
}

function getSystemPrompt(): string {
  return `You are an expert React developer tasked with assembling the final, production-ready code for a web-based tool.
You will be given the complete context, including the assembled component code, validation results, and user requirements.
Your job is to package everything into a single, clean, and robust component file.
Ensure all imports are correct, all functions are defined, and the code is well-formatted.
Provide the final object exactly as specified in the schema.`;
}

function createFinalizerUserPrompt(tcc: ToolConstructionContext): string {
  return `
Please finalize the tool based on the following context.

**User's Original Request:**
${tcc.userInput.description}

**Assembled Component Code:**
\`\`\`jsx
${tcc.assembledComponentCode}
\`\`\`

**Validation Results:**
${JSON.stringify(tcc.validationResult, null, 2)}

**Your Task:**
1.  **Review and Clean:** Review the assembled code and validation results. Make any minor corrections needed for syntax, imports, or logic.
2.  **Create Final Object:** Create the final product object containing:
    - The final, complete component code.
    - A list of any NPM dependencies required.
    - Brief instructions for the end-user.
    - Technical notes for a developer.

Produce the final JSON object now.
`;
}