// File Path: keyvex_app/src/app/api/ai/product-tool-creation-v2/agents/tool-finalizer/core-logic.ts
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
// TCC Store operations removed - using prop-based TCC passing
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
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
      tcc // Pass TCC with userId
    );

    const { provider, modelId } = getModelForAgent(
      'toolFinalizer',
      selectedModel,
      tcc,
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

    // Post-process to automatically remove import statements if AI ignored instructions
    let finalCleanedCode = aiResult.cleanedCode;
    const hasImports = finalCleanedCode.includes('import ');
    
    if (hasImports) {
      logger.warn({
        jobId,
        provider,
        modelId
      }, '📦 ToolFinalizer: ⚠️ AI generated imports despite instructions! Auto-removing...');
      
      // Remove import lines
      const lines = finalCleanedCode.split('\n');
      const filteredLines = lines.filter(line => !line.trim().startsWith('import '));
      finalCleanedCode = filteredLines.join('\n');
      
      console.log('\n' + '⚠️'.repeat(40));
      console.log('📦 ToolFinalizer: FIXED - Removed import statements:');
      console.log('⚠️'.repeat(40));
      console.log('CLEANED CODE:');
      console.log(finalCleanedCode);
      console.log('⚠️'.repeat(40) + '\n');
      
      // Update the aiResult
      aiResult.cleanedCode = finalCleanedCode;
    }

    // Post-process to automatically remove export statements if AI ignored instructions
    const hasExports = finalCleanedCode.includes('export ');
    
    if (hasExports) {
      logger.warn({
        jobId,
        provider,
        modelId
      }, '📦 ToolFinalizer: ⚠️ AI generated export statements despite instructions! Auto-removing...');
      
      // Strip export statements
      let cleanedCode = finalCleanedCode;
      
      // Remove export default statements
      cleanedCode = cleanedCode.replace(/export\s+default\s+\w+\s*;?\s*$/gm, '');
      
      // Remove export const/let/var statements
      cleanedCode = cleanedCode.replace(/export\s+(const|let|var)\s+/g, '$1 ');
      
      // Remove standalone export statements
      cleanedCode = cleanedCode.replace(/export\s*\{[^}]*\}\s*;?\s*$/gm, '');
      
      // Clean up any trailing empty lines
      cleanedCode = cleanedCode.replace(/\n\s*\n\s*$/g, '\n').trim();
      
      finalCleanedCode = cleanedCode;
      
      console.log('\n' + '🚫'.repeat(40));
      console.log('📦 ToolFinalizer: FIXED - Removed export statements:');
      console.log('🚫'.repeat(40));
      console.log('CLEANED CODE:');
      console.log(finalCleanedCode);
      console.log('🚫'.repeat(40) + '\n');
      
      // Update the aiResult
      aiResult.cleanedCode = finalCleanedCode;
    }

    logger.info({ 
      jobId, 
      hasImports: hasImports,
      hasExports: hasExports,
      finalCodeLength: finalCleanedCode.length,
      provider, 
      modelId 
    }, '📦 ToolFinalizer: ✅ AI generation completed');

    const finalProduct = createProductToolDefinition(aiResult, tcc);

    // TCC Store operation removed - the route handler will manage TCC persistence
    // The finalProduct is returned in the response for the orchestrator to handle

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.finalizing_tool,
      'completed',
      'Tool has been finalized successfully!',
      { 
        userId: tcc.userId,    // Include userId for progress emission
        finalProduct          // Include finalProduct for frontend access
      }
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
      tcc // Pass TCC with userId even on failure
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
  tcc?: ToolConstructionContext,
): { provider: string; modelId: string } {
  // PRIORITY 1: Check TCC agent model mapping first (user's workbench selection)
  if (tcc?.agentModelMapping?.['tool-finalizer']) {
    const mappedModel = tcc.agentModelMapping['tool-finalizer'];
    const provider = getModelProvider(mappedModel);
    const modelConfig = { 
      provider: provider !== 'unknown' ? provider : 'openai', 
      modelId: mappedModel 
    };
    logger.info({ 
      agentName, 
      mappedModel, 
      provider: modelConfig.provider,
      source: 'TCC_AGENT_MAPPING' 
    }, '📦 ToolFinalizer: Using TCC AGENT MAPPING model from workbench');
    return modelConfig;
  }
  
  // PRIORITY 2: User-selected model from request
  if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      logger.info({ 
        agentName, 
        selectedModel, 
        provider,
        source: 'REQUEST_PARAMETER' 
      }, '📦 ToolFinalizer: Using REQUEST PARAMETER model');
      return { provider, modelId: selectedModel };
    }
  }
  
  // PRIORITY 3: Configuration fallback
  const primaryModel = getPrimaryModel(agentName);
  if (primaryModel && 'modelInfo' in primaryModel) {
    const modelConfig = {
      provider: primaryModel.provider,
      modelId: primaryModel.modelInfo.id,
    };
    logger.info({ 
      agentName,
      modelConfig,
      source: 'CONFIGURATION_PRIMARY' 
    }, '📦 ToolFinalizer: Using CONFIGURATION PRIMARY model');
    return modelConfig;
  }
  
  // PRIORITY 4: Final fallback if no config is found
  logger.warn(
    { agentName },
    '📦 ToolFinalizer: No specific model config found, using global fallback gpt-4o.',
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

CRITICAL: The component code should NOT include any import statements OR export statements. All dependencies are injected at runtime.
- DO NOT add import statements (import React, import Button, etc.)
- DO NOT add export statements (export default, export const, etc.)
- The component will be accessed directly by name in the execution context
- Only clean up syntax, formatting, and logic issues - DO NOT add import/export statements

Provide the final object exactly as specified in the schema. Do not add any extra fields. Focus on providing high-quality, concise, and accurate content for each field.`;
}

function createFinalizerUserPrompt(tcc: ToolConstructionContext): string {
  // Extract key information from TCC for better context awareness
  const brainstormTitle = tcc.brainstormData?.coreConcept || 'Tool';
  const brainstormDescription = tcc.brainstormData?.valueProposition || tcc.userInput.description;
  const hasJsxLayout = !!tcc.jsxLayout?.componentStructure;
  const hasStyling = !!tcc.styling?.styleMap;
  
  return `
Please finalize the tool based on the following comprehensive context.

**User's Original Request:**
- Tool Type: ${tcc.userInput.toolType || 'Custom Tool'}
- Description: ${tcc.userInput.description || 'No description provided'}
- Target Audience: ${tcc.userInput.targetAudience || 'General users'}

**Brainstorm Context:**
- Core Concept: ${brainstormTitle}
- Value Proposition: ${brainstormDescription}
- Suggested Inputs: ${tcc.brainstormData?.suggestedInputs?.length || 0} input fields defined
- Key Calculations: ${tcc.brainstormData?.keyCalculations?.length || 0} calculations defined

**Design Structure:**
- JSX Layout Available: ${hasJsxLayout ? 'Yes - sophisticated layout with Cards, Tooltips, and responsive grids' : 'No'}
- Styling Applied: ${hasStyling ? 'Yes - Tailwind CSS styling configured' : 'No'}
- State Logic: ${tcc.stateLogic?.variables?.length || 0} state variables and ${tcc.stateLogic?.functions?.length || 0} functions defined

**Assembled Component Code (to be reviewed and cleaned):**
\`\`\`jsx
${tcc.finalProduct?.componentCode || '// No component code available in finalProduct'}
\`\`\`

**Validation Results:**
${JSON.stringify(tcc.validationResult, null, 2)}

**Your Task:**
1.  **Review and Clean:** Review the assembled code and validation results. Make any minor corrections needed for syntax, formatting, and logic issues to ensure it is production-ready. DO NOT add import statements or export statements - all dependencies are injected at runtime and the component is accessed directly by name.

2.  **Quality Check:** Ensure the code properly implements:
    - All brainstormed input fields and calculations
    - The sophisticated JSX layout structure (if available)
    - Proper state management and function implementations
    - Good user experience with clear labels and instructions

3.  **Create Final Metadata:** Based on all the information, create the final metadata object with the following fields:
    - \`title\`: Use the brainstorm concept "${brainstormTitle}" as the base for a great title
    - \`cleanedCode\`: The final, corrected, and production-ready component code WITHOUT import statements or export statements
    - \`dependencies\`: A list of any NPM package dependencies required (likely includes ShadCN/UI components if sophisticated layout is used)
    - \`userInstructions\`: Brief instructions for the end-user based on the value proposition and input fields
    - \`developerNotes\`: Technical notes for a developer, including any setup, integration points, or assumptions made
    - \`description\`: Use the value proposition "${brainstormDescription}" as the base for a concise summary

Produce the final JSON object now based on the schema.
`;
}