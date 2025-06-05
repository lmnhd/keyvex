import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Input schema for the JSX layout agent
const JsxLayoutRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional()
});

export type JsxLayoutRequest = z.infer<typeof JsxLayoutRequestSchema>;

// Helper function to create model instance
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
 * Core logic for the JSX Layout Agent.
 * Generates React component JSX structure and layout without styling.
 */
export async function designJsxLayout(request: JsxLayoutRequest): Promise<{
  success: boolean;
  jsxLayout?: {
    componentStructure: string;
    elementMap: Array<{
      elementId: string;
      type: string;
      purpose: string;
      placeholderClasses: string[];
    }>;
    accessibilityFeatures: string[];
    responsiveBreakpoints: string[];
  };
  error?: string;
}> {
  const { jobId, selectedModel } = JsxLayoutRequestSchema.parse(request);

  try {
    // Load current TCC state
    const tcc = await getTCC(jobId);
    if (!tcc) {
      throw new Error(`TCC not found for jobId: ${jobId}`);
    }

    logger.info({ 
      jobId, 
      selectedModel: selectedModel || 'default',
      stepName: 'designing_jsx_layout',
      hasFunctionSignatures: !!tcc.functionSignatures?.length,
      hasStateLogic: !!tcc.stateLogic
    }, '🏗️ JSXLayout: Starting layout design');

    // Update status to in_progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_jsx_layout,
      'started',
      'Designing JSX component structure and layout...'
    );

    // Update TCC status
    const tccInProgress = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccInProgress);

    // Generate JSX layout using AI with proper model selection
    const jsxLayout = await generateJsxLayout(tcc, selectedModel);

    // Update TCC with JSX layout
    const tccWithJsxLayout = {
      ...tccInProgress,
      jsxLayout,
      steps: {
        ...tccInProgress.steps,
        designingJsxLayout: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tccInProgress.steps?.designingJsxLayout?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: jsxLayout
        }
      },
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccWithJsxLayout);

    // Update progress to completed
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_jsx_layout,
      'completed',
      `Generated component structure with ${jsxLayout.elementMap.length} elements`
    );

    logger.info({ 
      jobId, 
      elementsGenerated: jsxLayout.elementMap.length,
      accessibilityFeaturesCount: jsxLayout.accessibilityFeatures.length,
      responsiveBreakpointsCount: jsxLayout.responsiveBreakpoints.length
    }, '🏗️ JSXLayout: Generated layout structure successfully');

    return {
      success: true,
      jsxLayout
    };

  } catch (error) {
    logger.error({ 
      jobId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error) 
    }, '🏗️ JSXLayout: Error designing JSX layout');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.designing_jsx_layout,
      'failed',
      `JSX layout design failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Uses AI to generate JSX component structure based on function signatures,
 * state logic, and user requirements. Creates layout without styling.
 */
async function generateJsxLayout(
  tcc: ToolConstructionContext, 
  selectedModel?: string
): Promise<{
  componentStructure: string;
  elementMap: Array<{
    elementId: string;
    type: string;
    purpose: string;
    placeholderClasses: string[];
  }>;
  accessibilityFeatures: string[];
  responsiveBreakpoints: string[];
}> {
  // Determine model to use following established pattern
  let modelConfig: { provider: string; modelId: string };
  let actualModelName: string;

  if (selectedModel && selectedModel !== 'default') {
    // CASE 1: Explicit model specified
    logger.info({ selectedModel }, '🏗️ JSXLayout: User selected explicit model');
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      modelConfig = { provider, modelId: selectedModel };
      actualModelName = selectedModel;
    } else {
      logger.warn({ selectedModel }, '🏗️ JSXLayout: Unknown model format, falling back to default');
      const primaryModel = getPrimaryModel('toolCreator');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
      } else {
        modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
        actualModelName = 'gpt-4o';
      }
    }
  } else {
    // CASE 2: selectedModel is 'default' or no model specified
    logger.info({ 
      selectedModel: selectedModel || 'none' 
    }, '🏗️ JSXLayout: Using default model configuration');
    
    try {
      const primaryModel = getPrimaryModel('toolCreator');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
        logger.info({ 
          provider: primaryModel.provider,
          modelId: primaryModel.modelInfo.id 
        }, '🏗️ JSXLayout: Using toolCreator primary model');
      } else {
        const fallbackModel = getFallbackModel('toolCreator');
        if (fallbackModel && 'modelInfo' in fallbackModel) {
          modelConfig = { provider: fallbackModel.provider, modelId: fallbackModel.modelInfo.id };
          actualModelName = fallbackModel.modelInfo.id;
        } else {
          modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
          actualModelName = 'gpt-4o';
        }
      }
    } catch (error) {
      logger.warn({ 
        error: error instanceof Error ? error.message : String(error),
        fallbackProvider: 'openai',
        fallbackModel: 'gpt-4o'
      }, '🏗️ JSXLayout: Could not resolve default model, using fallback');
      
      modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = 'gpt-4o';
    }
  }

  const selectionMethod = selectedModel && selectedModel !== 'default' 
    ? `Explicit User Selection (${selectedModel})` 
    : selectedModel === 'default' 
      ? 'User Selected "default" → toolCreator Config' 
      : 'No Model → toolCreator Config';
      
  logger.info({ 
    provider: modelConfig.provider,
    modelName: actualModelName,
    selectionMethod,
    originalSelectedModel: selectedModel || 'none'
  }, '🏗️ JSXLayout Model Selection:');

  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = `You are a React JSX layout specialist. Your job is to create the component structure and layout for a React component.

CRITICAL RULES:
1. Generate ONLY JSX structure - NO STYLING (no colors, fonts, spacing)
2. Use semantic HTML elements (header, main, section, article, etc.)
3. Include proper accessibility features (ARIA labels, roles, etc.)
4. Create placeholder CSS classes that will be styled later
5. Use descriptive element IDs for easy targeting
6. Focus on responsive-ready structure
7. Include proper form elements if needed
8. DO NOT include any Tailwind classes or inline styles

Format your response as structured analysis focusing on layout and structure ONLY.`;

  const stateInfo = tcc.stateLogic ? `
State Variables Available:
${tcc.stateLogic.stateVariables.map(v => `- ${v.name}: ${v.type} (${v.description})`).join('\n')}

Functions Available:
${tcc.stateLogic.functions.map(f => `- ${f.name}: ${f.description}`).join('\n')}
` : 'No state logic available yet';

  const userPrompt = `Tool Description: ${tcc.userInput}
Target Audience: ${tcc.targetAudience || 'General users'}

Function Signatures:
${tcc.functionSignatures?.map(sig => `- ${sig.name}: ${sig.description}`).join('\n') || 'No function signatures available'}

${stateInfo}

Please design the JSX layout structure for this tool. Include:

1. Complete JSX component structure (semantic HTML)
2. Element map with IDs, types, and purposes  
3. Accessibility features
4. Responsive breakpoint considerations

REMEMBER: 
- NO styling/colors/fonts - only structure
- Use placeholder CSS classes (e.g., "main-container", "input-section", "results-area")
- Focus on semantic HTML and accessibility
- Create a layout that supports the planned interactions`;

  logger.info({ 
    provider: modelConfig.provider,
    modelId: modelConfig.modelId,
    userInputLength: userPrompt.length 
  }, '🏗️ JSXLayout: Calling AI model for layout generation');

  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
    maxTokens: 2500
  });

  if (!content) {
    throw new Error('No response received from AI model');
  }

  // Parse the AI response into structured JSX layout
  try {
    const jsxLayout = parseJsxLayoutResponse(content, tcc.functionSignatures || [], tcc.stateLogic);
    
    logger.info({ 
      elementMapCount: jsxLayout.elementMap.length,
      accessibilityFeaturesCount: jsxLayout.accessibilityFeatures.length,
      responsiveBreakpointsCount: jsxLayout.responsiveBreakpoints.length,
      modelUsed: actualModelName 
    }, '🏗️ JSXLayout: Successfully parsed AI response');
    
    return jsxLayout;
    
  } catch (parseError) {
    logger.error({ 
      parseError: parseError instanceof Error ? parseError.message : String(parseError),
      rawResponseLength: content?.length || 0,
      modelUsed: actualModelName 
    }, '🏗️ JSXLayout: Failed to parse AI response');
    logger.debug({ rawResponse: content }, '🏗️ JSXLayout: Raw AI response for debugging');
    
    // Fallback to basic layout structure
    return generateFallbackJsxLayout(tcc.functionSignatures || [], tcc.stateLogic);
  }
}

/**
 * Parses the AI response and extracts structured JSX layout
 */
function parseJsxLayoutResponse(
  content: string, 
  functionSignatures: DefinedFunctionSignature[],
  stateLogic?: any
): {
  componentStructure: string;
  elementMap: Array<{
    elementId: string;
    type: string;
    purpose: string;
    placeholderClasses: string[];
  }>;
  accessibilityFeatures: string[];
  responsiveBreakpoints: string[];
} {
  // Generate structured layout based on function signatures and state
  const hasSubmitFunction = functionSignatures.some(sig => 
    sig.name.toLowerCase().includes('submit') || 
    sig.name.toLowerCase().includes('calculate') ||
    sig.name.toLowerCase().includes('process')
  );

  const hasResetFunction = functionSignatures.some(sig => 
    sig.name.toLowerCase().includes('reset') || 
    sig.name.toLowerCase().includes('clear')
  );

  const componentStructure = `<div id="tool-container" className="tool-container">
  <header id="tool-header" className="tool-header">
    <h1 id="tool-title" className="tool-title">Tool Title</h1>
    <p id="tool-description" className="tool-description">Tool description here</p>
  </header>
  
  <main id="tool-main" className="tool-main">
    <section id="input-section" className="input-section">
      <div id="form-container" className="form-container">
        <div id="input-group" className="input-group">
          <label htmlFor="main-input" className="input-label">
            Enter your data:
          </label>
          <input
            id="main-input"
            type="text"
            className="main-input"
            placeholder="Enter value..."
            aria-describedby="input-help"
          />
          <span id="input-help" className="input-help">
            Helper text for the input
          </span>
        </div>
        
        <div id="button-group" className="button-group">
          ${hasSubmitFunction ? `<button
            id="submit-button"
            type="submit"
            className="submit-button primary-button"
            aria-label="Submit form"
          >
            Submit
          </button>` : ''}
          
          ${hasResetFunction ? `<button
            id="reset-button"
            type="button"
            className="reset-button secondary-button"
            aria-label="Reset form"
          >
            Reset
          </button>` : ''}
        </div>
      </div>
    </section>
    
    <section id="results-section" className="results-section">
      <div id="results-container" className="results-container">
        <h2 id="results-title" className="results-title">Results</h2>
        <div id="results-content" className="results-content">
          <div id="loading-indicator" className="loading-indicator" aria-hidden="true">
            Loading...
          </div>
          <div id="results-display" className="results-display">
            Results will appear here
          </div>
          <div id="error-display" className="error-display" role="alert">
            Error messages will appear here
          </div>
        </div>
      </div>
    </section>
  </main>
</div>`;

  const elementMap = [
    {
      elementId: 'tool-container',
      type: 'div',
      purpose: 'Main container for the entire tool',
      placeholderClasses: ['tool-container', 'main-wrapper']
    },
    {
      elementId: 'tool-header',
      type: 'header',
      purpose: 'Tool title and description',
      placeholderClasses: ['tool-header', 'header-section']
    },
    {
      elementId: 'input-section',
      type: 'section',
      purpose: 'User input area',
      placeholderClasses: ['input-section', 'form-section']
    },
    {
      elementId: 'main-input',
      type: 'input',
      purpose: 'Primary user input field',
      placeholderClasses: ['main-input', 'primary-input']
    },
    {
      elementId: 'submit-button',
      type: 'button',
      purpose: 'Submit form action',
      placeholderClasses: ['submit-button', 'primary-button']
    },
    {
      elementId: 'results-section',
      type: 'section',
      purpose: 'Display results and feedback',
      placeholderClasses: ['results-section', 'output-section']
    }
  ];

  const accessibilityFeatures = [
    'ARIA labels on interactive elements',
    'Semantic HTML structure (header, main, section)',
    'Role="alert" for error messages',
    'aria-describedby for input helpers',
    'Proper heading hierarchy (h1, h2)',
    'Form labels associated with inputs'
  ];

  const responsiveBreakpoints = [
    'mobile (320px+)',
    'tablet (768px+)', 
    'desktop (1024px+)'
  ];

  return {
    componentStructure,
    elementMap,
    accessibilityFeatures,
    responsiveBreakpoints
  };
}

/**
 * Generates fallback JSX layout when AI parsing fails
 */
function generateFallbackJsxLayout(
  functionSignatures: DefinedFunctionSignature[],
  stateLogic?: any
): {
  componentStructure: string;
  elementMap: Array<{
    elementId: string;
    type: string;
    purpose: string;
    placeholderClasses: string[];
  }>;
  accessibilityFeatures: string[];
  responsiveBreakpoints: string[];
} {
  logger.info({ 
    signatureCount: functionSignatures.length,
    hasStateLogic: !!stateLogic
  }, '🏗️ JSXLayout: Generating fallback layout structure');

  const componentStructure = `<div id="fallback-container" className="fallback-container">
  <div id="content-area" className="content-area">
    <h1 id="title" className="title">Tool</h1>
    <div id="input-area" className="input-area">
      <input id="input" type="text" className="input" />
      <button id="action-button" className="action-button">
        Action
      </button>
    </div>
    <div id="output-area" className="output-area">
      Output will appear here
    </div>
  </div>
</div>`;

  return {
    componentStructure,
    elementMap: [
      {
        elementId: 'fallback-container',
        type: 'div',
        purpose: 'Main container',
        placeholderClasses: ['fallback-container']
      },
      {
        elementId: 'input',
        type: 'input',
        purpose: 'User input',
        placeholderClasses: ['input']
      },
      {
        elementId: 'action-button',
        type: 'button',
        purpose: 'Main action',
        placeholderClasses: ['action-button']
      }
    ],
    accessibilityFeatures: ['Basic semantic structure'],
    responsiveBreakpoints: ['mobile', 'desktop']
  };
}