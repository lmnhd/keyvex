import { z } from 'zod';
import {
  ToolConstructionContext,
  DefinedFunctionSignature,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC, updateTCC } from '@/lib/db/tcc-store';
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

// Zod schema for the element map
const elementMapSchema = z.object({
  elementId: z.string().describe('The unique ID of the HTML element.'),
  type: z
    .string()
    .describe('The HTML tag type (e.g., "div", "input", "button").'),
  purpose: z.string().describe("A brief description of the element's role."),
  placeholderClasses: z
    .array(z.string())
    .describe('An array of placeholder CSS class names.'),
});

// Zod schema for the entire JSX layout result
const jsxLayoutSchema = z.object({
  componentStructure: z
    .string()
    .describe(
      'The complete JSX component structure as a single string of semantic HTML.',
    ),
  elementMap: z
    .array(elementMapSchema)
    .describe('An array of objects mapping element IDs to their details.'),
  accessibilityFeatures: z
    .array(z.string())
    .describe('A list of key accessibility features implemented.'),
  responsiveBreakpoints: z
    .array(z.string())
    .describe('A list of responsive breakpoints considered (e.g., "mobile").'),
});

// Type definitions for JSX layout components, inferred from Zod schemas
export type ElementMap = z.infer<typeof elementMapSchema>;
export type JsxLayoutResult = z.infer<typeof jsxLayoutSchema>;

// Input schema
const JsxLayoutRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  mockTcc: z.custom<Partial<ToolConstructionContext>>().optional(),
});

export type JsxLayoutRequest = z.infer<typeof JsxLayoutRequestSchema>;

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    default:
      return openai('gpt-4o');
  }
}

/**
 * JSX Layout Agent - Generates React component structure from AI.
 * This function is a pure, testable unit of logic that takes a TCC,
 * performs JSX layout design, and returns an updated TCC without side effects.
 */
export async function designJsxLayout(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
}): Promise<{
  success: boolean;
  jsxLayout?: JsxLayoutResult;
  error?: string;
  updatedTcc?: ToolConstructionContext; // Return the updated TCC
}> {
  const { jobId, selectedModel } = request;
  const tcc = request.mockTcc || request.tcc;

  logger.info({ jobId }, '🏗️ JSXLayout: Starting JSX layout design');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    const jsxLayout = await generateJsxLayoutWithAI(tcc, selectedModel);

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      jsxLayout,
      steps: {
        ...tcc.steps,
        designingJsxLayout: {
          status: 'completed',
          startedAt:
            tcc.steps?.designingJsxLayout?.startedAt ||
            new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: jsxLayout,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    logger.info({ jobId }, '🏗️ JSXLayout: JSX layout designed successfully');
    return { success: true, jsxLayout, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { jobId, error: errorMessage },
      '🏗️ JSXLayout: Error designing JSX layout',
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function triggerNextOrchestrationStep(jobId: string): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';
  try {
    logger.info(
      { jobId, baseUrl },
      '🏗️ JSXLayout: Triggering next orchestration step...',
    );
    const response = await fetch(
      `${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }), // THIS IS NOW HANDLED BY THE ROUTE WITH THE FULL TCC
      },
    );
    if (!response.ok) {
      throw new Error(`Orchestrator responded with status ${response.status}`);
    }
    logger.info(
      { jobId },
      '🏗️ JSXLayout: Successfully triggered next orchestration step.',
    );
  } catch (error) {
    logger.error(
      { jobId, error },
      '🏗️ JSXLayout: Failed to trigger next orchestration step.',
    );
  }
}

/**
 * Generate JSX layout using AI
 */
async function generateJsxLayoutWithAI(
  tcc: ToolConstructionContext,
  selectedModel?: string,
): Promise<JsxLayoutResult> {
  let modelConfig: { provider: string; modelId: string };

  if (selectedModel && selectedModel !== 'default') {
    const provider = getModelProvider(selectedModel);
    modelConfig = {
      provider: provider !== 'unknown' ? provider : 'openai',
      modelId: selectedModel,
    };
  } else {
    const primaryModel = getPrimaryModel('toolCreator');
    modelConfig =
      primaryModel && 'modelInfo' in primaryModel
        ? {
            provider: primaryModel.provider,
            modelId: primaryModel.modelInfo.id,
          }
        : { provider: 'openai', modelId: 'gpt-4o' };
  }

  logger.info(
    { provider: modelConfig.provider, modelName: modelConfig.modelId },
    '🏗️ JSXLayout: Using model',
  );
  const modelInstance = createModelInstance(
    modelConfig.provider,
    modelConfig.modelId,
  );

  const systemPrompt = `You are a React JSX layout specialist. Create a semantic HTML component structure based on the user's request.

CRITICAL: You must generate a single JSON object that conforms to the provided schema.
- The 'componentStructure' must be a complete, valid JSX string.
- The 'elementMap' must identify all key elements with an 'id'.
- Focus on semantic HTML and accessibility features (ARIA labels, roles, proper form structure).
- Do NOT include any styling, colors, or Tailwind classes in the JSX. Use placeholder class names if necessary.`;

  const userPrompt = `Tool: ${
    tcc.userInput?.description || 'No description provided.'
  }
Target Audience: ${tcc.targetAudience || 'General users'}

Function Signatures:
${
  (tcc.definedFunctionSignatures || tcc.functionSignatures)
    ?.map(sig => `- ${sig.name}: ${sig.description}`)
    .join('\n') || 'None'
}

State Logic Available:
${
  tcc.stateLogic?.variables?.map(v => `- ${v.name}: ${v.type}`).join('\n') ||
  'None'
}

Please generate the complete JSON object for the JSX layout.`;

  logger.info({ modelId: modelConfig.modelId }, '🏗️ JSXLayout: Calling AI');

  try {
    const { object: jsxLayout } = await generateObject({
      model: modelInstance,
      schema: jsxLayoutSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
      maxTokens: 4096,
    });
    logger.info({}, '🏗️ JSXLayout: AI FIRST - Using AI generated object');
    return jsxLayout;
  } catch (error) {
    logger.warn({ error }, 'Primary model for JSX layout failed. Using fallback.');
    const fallbackJsx = generateFallbackJsx(
      tcc.definedFunctionSignatures || tcc.functionSignatures || [],
    );
    return {
      componentStructure: fallbackJsx,
      elementMap: extractElementMap(fallbackJsx),
      accessibilityFeatures: [
        'ARIA labels',
        'Semantic HTML',
        'Form accessibility',
      ],
      responsiveBreakpoints: ['mobile', 'tablet', 'desktop'],
    };
  }
}

/**
 * Extract element map from JSX structure
 */
function extractElementMap(jsx: string): ElementMap[] {
  const elementMap: any[] = [];
  const elementMatches = jsx.match(/id="([^"]+)"/g) || [];

  elementMatches.forEach(match => {
    const idMatch = match.match(/id="([^"]+)"/);
    if (idMatch) {
      const elementId = idMatch[1];
      let type = 'div';

      if (jsx.includes(`<input[^>]*id="${elementId}"`)) type = 'input';
      else if (jsx.includes(`<button[^>]*id="${elementId}"`)) type = 'button';
      else if (jsx.includes(`<section[^>]*id="${elementId}"`))
        type = 'section';
      else if (jsx.includes(`<header[^>]*id="${elementId}"`)) type = 'header';

      elementMap.push({
        elementId,
        type,
        purpose: `${type} element`,
        placeholderClasses: [`${elementId}-element`],
      });
    }
  });

  return elementMap;
}

/**
 * Simple fallback JSX when AI parsing fails
 */
function generateFallbackJsx(
  functionSignatures: DefinedFunctionSignature[],
): string {
  const hasSubmit = functionSignatures.some(sig =>
    sig.name.toLowerCase().includes('submit'),
  );
  const hasReset = functionSignatures.some(sig =>
    sig.name.toLowerCase().includes('reset'),
  );

  return `<div id="tool-container" className="tool-container">
  <header id="tool-header" className="tool-header">
    <h1 id="tool-title" className="tool-title">Tool</h1>
  </header>
  <main id="tool-main" className="tool-main">
    <section id="input-section" className="input-section">
      <input id="main-input" type="text" className="main-input" />
      ${
        hasSubmit
          ? '<button id="submit-btn" type="submit" className="submit-btn">Submit</button>'
          : ''
      }
      ${
        hasReset
          ? '<button id="reset-btn" type="button" className="reset-btn">Reset</button>'
          : ''
      }
    </section>
    <section id="results-section" className="results-section">
      <div id="results-display" className="results-display">Results</div>
    </section>
  </main>
</div>`;
}