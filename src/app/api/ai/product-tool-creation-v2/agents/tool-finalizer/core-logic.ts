import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
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
import { ProductToolDefinition } from '@/lib/types/product-tool';

const finalizerAIOutputSchema = z.object({
  title: z
    .string()
    .describe(
      'A concise, descriptive title for the tool, e.g., "Advanced Mortgage Calculator".',
    ),
  cleanedCode: z
    .string()
    .describe(
      'The final, production-ready, and cleaned-up React component code as a single string.',
    ),
  dependencies: z
    .array(z.string())
    .describe(
      'A list of NPM package dependencies required by the code, e.g., ["react-icons", "recharts"].',
    ),
  userInstructions: z
    .string()
    .describe(
      'Brief, friendly instructions for the end-user on how to use this tool.',
    ),
  developerNotes: z
    .string()
    .describe(
      'Technical notes for a developer, including any setup, integration points, or assumptions made.',
    ),
  description: z
    .string()
    .describe('A brief, one-sentence summary of what the tool does.'),
});

type FinalizerAIOutput = z.infer<typeof finalizerAIOutputSchema>;

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

export async function finalizeTool(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
}): Promise<{
  success: boolean;
  finalProduct?: ProductToolDefinition;
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
      'Assembling the final tool definition...',
    );

    const { provider, modelId } = getModelForAgent(
      'toolFinalizer',
      selectedModel,
    );
    logger.info(
      { provider, modelId, agent: 'toolFinalizer' },
      '✅ ToolFinalizer: Using model',
    );
    const model = createModelInstance(provider, modelId);

    const { object: aiResult } = await generateObject({
      model,
      schema: finalizerAIOutputSchema,
      system: getSystemPrompt(),
      prompt: createFinalizerUserPrompt(tcc),
      temperature: 0.1,
    });

    const finalProduct = createProductToolDefinition(aiResult, tcc);

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
      finalProduct,
    );

    logger.info({ jobId }, '✅ ToolFinalizer: Tool finalized successfully.');
    return { success: true, finalProduct };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : 'No stack available';
    logger.error(
      { jobId, error: errorMessage, stack },
      '✅ ToolFinalizer: Error finalizing tool',
    );

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.finalizing_tool,
      'failed',
      errorMessage,
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

function createProductToolDefinition(
  aiResult: FinalizerAIOutput,
  tcc: ToolConstructionContext,
): ProductToolDefinition {
  const newId = uuidv4();
  const slug = slugify(aiResult.title);
  const now = Date.now();

  return {
    id: newId,
    slug: slug,
    componentCode: aiResult.cleanedCode,
    metadata: {
      id: newId,
      slug: slug,
      title: aiResult.title,
      type: tcc.userInput.toolType || 'Unknown',
      description: aiResult.description,
      userInstructions: aiResult.userInstructions,
      developerNotes: aiResult.developerNotes,
      dependencies: aiResult.dependencies,
      source: 'v2-orchestration',
      version: '1.0.0',
    },
    initialStyleMap: tcc.styling?.styleMap || {},
    currentStyleMap: tcc.styling?.styleMap || {},
    createdAt: now,
    updatedAt: now,
  };
}

function getModelForAgent(
  agentName: string,
  selectedModel?: string,
): { provider: string; modelId: string } {
  if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      return { provider, modelId: selectedModel };
    }
  }
  const primaryModel = getPrimaryModel(agentName);
  if (primaryModel && 'modelInfo' in primaryModel) {
    return {
      provider: primaryModel.provider,
      modelId: primaryModel.modelInfo.id,
    };
  }
  // Final fallback if no config is found
  logger.warn(
    { agentName },
    'No specific model config found, using global fallback gpt-4o.',
  );
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
Your job is to review all inputs, clean up the provided component code, and then generate the metadata needed to create a final, production-ready tool definition.
Ensure all imports are correct, all functions are defined, and the code is well-formatted.
Provide the final object exactly as specified in the schema. Do not add any extra fields. Focus on providing high-quality, concise, and accurate content for each field.`;
}

function createFinalizerUserPrompt(tcc: ToolConstructionContext): string {
  return `
Please finalize the tool based on the following context.

**User's Original Request:**
- Tool Type: ${tcc.userInput.toolType}
- Description: ${tcc.userInput.description}
- Target Audience: ${tcc.userInput.targetAudience}

**Assembled Component Code (to be reviewed and cleaned):**
\`\`\`jsx
${tcc.assembledComponentCode}
\`\`\`

**Validation Results:**
${JSON.stringify(tcc.validationResult, null, 2)}

**Your Task:**
1.  **Review and Clean:** Review the assembled code and validation results. Make any minor corrections needed for syntax, imports, or logic to ensure it is production-ready.
2.  **Create Final Metadata:** Based on all the information, create the final metadata object with the following fields:
    - \`title\`: A great title for the tool.
    - \`cleanedCode\`: The final, corrected, and production-ready component code.
    - \`dependencies\`: A list of any NPM package dependencies required.
    - \`userInstructions\`: Brief instructions for the end-user.
    - \`developerNotes\`: Technical notes for a developer.
    - \`description\`: A short summary of the tool.

Produce the final JSON object now based on the schema.
`;
}