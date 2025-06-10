import { z } from 'zod';
import {
  ToolConstructionContext,
  DefinedFunctionSignature,
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
import { getJsxLayoutSystemPrompt } from '@/lib/prompts/v2/jsx-layout-prompt';
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
// Phase 2: Edit mode context type
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

export async function designJsxLayout(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
  isIsolatedTest?: boolean;
  // Phase 2: Edit mode context
  editMode?: EditModeContext;
}): Promise<{
  success: boolean;
  jsxLayout?: JsxLayoutResult;
  error?: string;
  updatedTcc?: ToolConstructionContext; // Return the updated TCC
}> {
  const { jobId, selectedModel, isIsolatedTest = false, editMode } = request;
  const tcc = request.mockTcc || request.tcc;
  
  // Phase 2: Edit mode detection
  const isEditMode = editMode?.isEditMode || false;
  const editInstructions = editMode?.instructions || [];

  logger.info({ 
    jobId, 
    isIsolatedTest,
    hasTcc: !!tcc,
    tccKeys: tcc ? Object.keys(tcc) : [],
    tccUserId: tcc?.userId,
    tccStatus: tcc?.status
  }, '🏗️ JSXLayout: Starting JSX layout design');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Additional TCC validation
    if (!tcc.jobId) {
      throw new Error(`TCC missing jobId for jobId: ${jobId}`);
    }

    if (!tcc.userId) {
      logger.warn({ 
        jobId, 
        tccKeys: Object.keys(tcc),
        tccJobId: tcc.jobId 
      }, '🏗️ JSXLayout: WARNING - TCC missing userId, this will cause WebSocket emission to fail');
    }

    // Skip progress emission during isolated testing to prevent orchestration
    if (!isIsolatedTest) {
      logger.info({ jobId }, '🏗️ JSXLayout: About to emit progress...');
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.designing_jsx_layout,
        'in_progress',
        'Designing JSX component structure...',
        tcc // Pass TCC with userId
      );
      logger.info({ jobId }, '🏗️ JSXLayout: Progress emitted successfully');
    }

    logger.info({ 
      jobId, 
      isEditMode, 
      editInstructionsCount: editInstructions.length 
    }, '🏗️ JSXLayout: About to call generateJsxLayoutWithAI...');
    
    const jsxLayout = await generateJsxLayoutWithAI(tcc, selectedModel, isIsolatedTest, editMode);
    logger.info({ jobId }, '🏗️ JSXLayout: generateJsxLayoutWithAI completed successfully');

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

    // Skip progress emission during isolated testing to prevent orchestration
    if (!isIsolatedTest) {
      logger.info({ jobId }, '🏗️ JSXLayout: About to emit completion progress...');
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.designing_jsx_layout,
        'completed',
        'JSX layout designed successfully!',
        updatedTcc // Pass updated TCC with userId
      );
      logger.info({ jobId }, '🏗️ JSXLayout: Completion progress emitted successfully');
    } else {
      logger.info({ jobId }, '🏗️ JSXLayout: Isolated test mode - skipping progress emission');
    }

    logger.info({ jobId }, '🏗️ JSXLayout: JSX layout designed successfully');
    return { success: true, jsxLayout, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack available';
    
    logger.error(
      { 
        jobId, 
        error: errorMessage,
        errorStack,
        errorType: error?.constructor?.name,
        tccPresent: !!tcc,
        tccUserId: tcc?.userId
      },
      '🏗️ JSXLayout: Error designing JSX layout',
    );
    
    // Skip progress emission during isolated testing
    if (!isIsolatedTest) {
      try {
        await emitStepProgress(
          jobId,
          OrchestrationStepEnum.enum.designing_jsx_layout,
          'failed',
          errorMessage,
          tcc // Pass TCC with userId even on failure
        );
        logger.info({ jobId }, '🏗️ JSXLayout: Failure progress emitted successfully');
      } catch (emitError) {
        logger.error({ 
          jobId, 
          emitError: emitError instanceof Error ? emitError.message : String(emitError) 
        }, '🏗️ JSXLayout: Failed to emit failure progress');
      }
    }
    
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
  isIsolatedTest?: boolean,
  editMode?: EditModeContext,
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

  // Use comprehensive JSX layout prompt with dynamic editing support
  const systemPrompt = getJsxLayoutSystemPrompt(false);

  // Phase 1: Enhanced user prompt with brainstorm data integration
  let userPrompt = `Tool: ${
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
}`;

  // Phase 1: Inject rich brainstorm context for enhanced layout design
  if (tcc.brainstormData) {
    const brainstorm = tcc.brainstormData;
    
    userPrompt += `

DETAILED BRAINSTORM CONTEXT (Use this to design a more specific and engaging layout):

CORE CONCEPT: ${brainstorm.coreConcept || brainstorm.coreWConcept || 'Not specified'}

VALUE PROPOSITION: ${brainstorm.valueProposition || 'Not specified'}`;

    // Add suggested inputs for layout structure
    if (brainstorm.suggestedInputs && brainstorm.suggestedInputs.length > 0) {
      userPrompt += `

SUGGESTED INPUT FIELDS (Design layout to accommodate these specific inputs):`;
      brainstorm.suggestedInputs.forEach(input => {
        userPrompt += `\n- ${input.label} (${input.type}): ${input.description}`;
      });
    }

    // Add interaction flow for layout structure
    if (brainstorm.interactionFlow && brainstorm.interactionFlow.length > 0) {
      userPrompt += `

INTERACTION FLOW (Design layout to support this specific user journey):`;
      brainstorm.interactionFlow.forEach(step => {
        userPrompt += `\n${step.step}. ${step.title}: ${step.description} - ${step.userAction}`;
      });
    }

    // Add key calculations for results display areas
    if (brainstorm.keyCalculations && brainstorm.keyCalculations.length > 0) {
      userPrompt += `

KEY CALCULATIONS (Design layout sections to display these results prominently):`;
      brainstorm.keyCalculations.forEach(calc => {
        userPrompt += `\n- ${calc.name}: ${calc.description}`;
      });
    }

    // Add lead capture strategy for layout optimization
    if (brainstorm.leadCaptureStrategy) {
      userPrompt += `

LEAD CAPTURE STRATEGY (Incorporate this into the layout design):
- Timing: ${brainstorm.leadCaptureStrategy.timing}
- Method: ${brainstorm.leadCaptureStrategy.method}
- Incentive: ${brainstorm.leadCaptureStrategy.incentive}`;
    }
  }

  // Phase 2: Add edit mode context if in edit mode
  if (editMode?.isEditMode && editMode.instructions.length > 0) {
    userPrompt += `

🔄 EDIT MODE INSTRUCTIONS:
You are EDITING an existing JSX layout. Here is the current layout:

CURRENT LAYOUT:
\`\`\`jsx
${tcc.jsxLayout?.componentStructure || 'No existing layout found'}
\`\`\`

EDIT INSTRUCTIONS TO FOLLOW:`;

    editMode.instructions.forEach((instruction, index) => {
      userPrompt += `

${index + 1}. ${instruction.editType.toUpperCase()} REQUEST (${instruction.priority} priority):
${instruction.instructions}

Created: ${instruction.createdAt}`;
    });

    userPrompt += `

Please apply these edit instructions to create an improved version of the JSX layout. Maintain the structure where appropriate but implement the requested changes.`;
  }

  userPrompt += `

Please generate the complete JSON object for the JSX layout.`;

  logger.info({ modelId: modelConfig.modelId }, '🏗️ JSXLayout: Calling AI');

  // Log prompts when in isolated test mode for debugging
  if (isIsolatedTest) {
    logger.info({ 
      jobId: tcc.jobId,
      modelId: modelConfig.modelId,
      systemPrompt: systemPrompt.substring(0, 500) + (systemPrompt.length > 500 ? '...' : ''),
      userPrompt: userPrompt.substring(0, 1000) + (userPrompt.length > 1000 ? '...' : '')
    }, '🏗️ JSXLayout: [ISOLATED TEST] Prompt Preview');
    
    logger.info({ 
      jobId: tcc.jobId,
      fullSystemPrompt: systemPrompt 
    }, '🏗️ JSXLayout: [ISOLATED TEST] Full System Prompt');
    
    logger.info({ 
      jobId: tcc.jobId,
      fullUserPrompt: userPrompt 
    }, '🏗️ JSXLayout: [ISOLATED TEST] Full User Prompt');
  }

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
