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
${(tcc.stateLogic.stateVariables || tcc.stateLogic.variables || []).map(v => `- ${v.name}: ${v.type} (${v.description || 'No description'})`).join('\n')}

Functions Available:
${tcc.stateLogic.functions.map(f => `- ${f.name}: ${f.description || 'No description'}`).join('\n')}
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
  logger.info({ 
    contentLength: content?.length || 0,
    signatureCount: functionSignatures.length,
    hasStateLogic: !!stateLogic 
  }, '🏗️ JSXLayout: Parsing AI response for component structure');

  // Try to extract structured JSX from AI response
  let aiGeneratedJsx: string | null = null;
  let aiElementMap: any[] = [];
  let aiAccessibilityFeatures: string[] = [];
  
  try {
    // Look for JSX code blocks in the AI response
    const jsxMatch = content.match(/```(?:jsx|tsx|html)?\s*([\s\S]*?)\s*```/) ||
                    content.match(/(<div[\s\S]*<\/div>)/);
    
    if (jsxMatch) {
      aiGeneratedJsx = jsxMatch[1] || jsxMatch[0];
      logger.info({ 
        hasAiJsx: true,
        jsxLength: aiGeneratedJsx.length
      }, '🏗️ JSXLayout: Successfully extracted JSX from AI response');
    }

    // Look for element mapping in AI response
    const elementMapMatch = content.match(/element.*map|elements?.*list/i);
    if (elementMapMatch) {
      // Extract element information from content
      aiElementMap = extractElementMapFromContent(content);
    }

    // Extract accessibility features mentioned by AI
    if (content.toLowerCase().includes('aria') || content.toLowerCase().includes('accessibility')) {
      aiAccessibilityFeatures = extractAccessibilityFeaturesFromContent(content);
    }
    
  } catch (parseError) {
    logger.warn({ 
      parseError: parseError instanceof Error ? parseError.message : String(parseError)
    }, '🏗️ JSXLayout: Could not parse AI JSX, using intelligent enhancement');
  }

  // Analyze function signatures and state logic for layout decisions
  const hasSubmitFunction = functionSignatures.some(sig => 
    sig.name.toLowerCase().includes('submit') || 
    sig.name.toLowerCase().includes('calculate') ||
    sig.name.toLowerCase().includes('process')
  );

  const hasResetFunction = functionSignatures.some(sig => 
    sig.name.toLowerCase().includes('reset') || 
    sig.name.toLowerCase().includes('clear')
  );

  // Use AI-generated JSX if available, otherwise create intelligent structure
  const componentStructure = aiGeneratedJsx ? 
    enhanceAiJsxWithFunctionSignatures(aiGeneratedJsx, functionSignatures, stateLogic) :
    generateIntelligentJsxStructure(functionSignatures, stateLogic, content);

  // Build element map from AI response or generate from structure
  const elementMap = aiElementMap.length > 0 ? 
    aiElementMap :
    buildElementMapFromStructure(componentStructure, functionSignatures, stateLogic);

  // Use AI-extracted accessibility features or generate defaults
  const accessibilityFeatures = aiAccessibilityFeatures.length > 0 ?
    aiAccessibilityFeatures :
    generateAccessibilityFeatures(functionSignatures, stateLogic);

  // Extract responsive considerations from AI content
  const responsiveBreakpoints = extractResponsiveBreakpointsFromContent(content);

  return {
    componentStructure,
    elementMap,
    accessibilityFeatures,
    responsiveBreakpoints
  };
}

/**
 * Helper functions for parsing AI response
 */
function extractElementMapFromContent(content: string): any[] {
  const elementMap: any[] = [];
  
  // Look for element descriptions in content
  const elementMatches = content.match(/(?:element|component).*?id.*?(?:purpose|description)/gi) || [];
  
  elementMatches.forEach(match => {
    const idMatch = match.match(/id[^\w]*([a-zA-Z-]+)/);
    const typeMatch = match.match(/(div|input|button|section|header|main)/i);
    
    if (idMatch && typeMatch) {
      elementMap.push({
        elementId: idMatch[1],
        type: typeMatch[1].toLowerCase(),
        purpose: `AI-identified element for ${idMatch[1]}`,
        placeholderClasses: [`${idMatch[1]}-element`]
      });
    }
  });
  
  return elementMap;
}

function extractAccessibilityFeaturesFromContent(content: string): string[] {
  const features: string[] = [];
  
  if (content.includes('aria-label')) features.push('ARIA labels for screen readers');
  if (content.includes('aria-describedby')) features.push('Associated descriptions for inputs');
  if (content.includes('role=')) features.push('Semantic roles for elements');
  if (content.includes('semantic') || content.includes('<header>') || content.includes('<main>')) {
    features.push('Semantic HTML structure');
  }
  
  return features.length > 0 ? features : ['Basic accessibility structure'];
}

function extractResponsiveBreakpointsFromContent(content: string): string[] {
  const breakpoints: string[] = [];
  
  if (content.includes('mobile')) breakpoints.push('mobile (320px+)');
  if (content.includes('tablet')) breakpoints.push('tablet (768px+)');
  if (content.includes('desktop')) breakpoints.push('desktop (1024px+)');
  if (content.includes('responsive')) breakpoints.push('responsive design ready');
  
  return breakpoints.length > 0 ? breakpoints : ['mobile', 'tablet', 'desktop'];
}

function enhanceAiJsxWithFunctionSignatures(aiJsx: string, functionSignatures: DefinedFunctionSignature[], stateLogic?: any): string {
  let enhancedJsx = aiJsx;
  
  // Add function-specific elements
  functionSignatures.forEach(sig => {
    if (sig.name.toLowerCase().includes('submit') && !enhancedJsx.includes('type="submit"')) {
      enhancedJsx = enhancedJsx.replace(/<\/div>\s*$/, '  <button type="submit" id="submit-btn">Submit</button>\n</div>');
    }
    if (sig.name.toLowerCase().includes('reset') && !enhancedJsx.includes('reset')) {
      enhancedJsx = enhancedJsx.replace(/<\/div>\s*$/, '  <button type="button" id="reset-btn">Reset</button>\n</div>');
    }
  });
  
  // Add state-aware elements
  if (stateLogic?.stateVariables) {
    const hasErrorState = stateLogic.stateVariables.some((v: any) => v.name.includes('error'));
    const hasLoadingState = stateLogic.stateVariables.some((v: any) => v.name.includes('loading'));
    
    if (hasErrorState && !enhancedJsx.includes('error')) {
      enhancedJsx = enhancedJsx.replace(/<\/div>\s*$/, '  <div id="error-display" role="alert"></div>\n</div>');
    }
    if (hasLoadingState && !enhancedJsx.includes('loading')) {
      enhancedJsx = enhancedJsx.replace(/<\/div>\s*$/, '  <div id="loading-indicator" aria-hidden="true"></div>\n</div>');
    }
  }
  
  return enhancedJsx;
}

function generateIntelligentJsxStructure(functionSignatures: DefinedFunctionSignature[], stateLogic?: any, aiContent?: string): string {
  const hasSubmitFunction = functionSignatures.some(sig => 
    sig.name.toLowerCase().includes('submit') || 
    sig.name.toLowerCase().includes('calculate')
  );
  
  const hasResetFunction = functionSignatures.some(sig => 
    sig.name.toLowerCase().includes('reset') || 
    sig.name.toLowerCase().includes('clear')
  );
  
  // Extract tool type from AI content
  let toolType = 'general';
  if (aiContent?.toLowerCase().includes('calculator')) toolType = 'calculator';
  if (aiContent?.toLowerCase().includes('form')) toolType = 'form';
  if (aiContent?.toLowerCase().includes('analysis')) toolType = 'analysis';
  
  return `<div id="tool-container" className="tool-container">
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
            type="${toolType === 'calculator' ? 'number' : 'text'}"
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
}

function buildElementMapFromStructure(structure: string, functionSignatures: DefinedFunctionSignature[], stateLogic?: any): any[] {
  const elementMap: any[] = [];
  
  // Extract elements from structure
  const elementMatches = structure.match(/id="([^"]+)"/g) || [];
  
  elementMatches.forEach(match => {
    const idMatch = match.match(/id="([^"]+)"/);
    if (idMatch) {
      const elementId = idMatch[1];
      let type = 'div';
      let purpose = `Element for ${elementId}`;
      
      // Determine type from context
      if (structure.includes(`<input[^>]*id="${elementId}"`)) type = 'input';
      if (structure.includes(`<button[^>]*id="${elementId}"`)) type = 'button';
      if (structure.includes(`<section[^>]*id="${elementId}"`)) type = 'section';
      if (structure.includes(`<header[^>]*id="${elementId}"`)) type = 'header';
      
      elementMap.push({
        elementId,
        type,
        purpose,
        placeholderClasses: [`${elementId}-element`, 'ai-generated']
      });
    }
  });
  
  return elementMap;
}

function generateAccessibilityFeatures(functionSignatures: DefinedFunctionSignature[], stateLogic?: any): string[] {
  const features = [
    'ARIA labels on interactive elements',
    'Semantic HTML structure (header, main, section)',
    'Proper heading hierarchy (h1, h2)',
    'Form labels associated with inputs'
  ];
  
  if (stateLogic?.stateVariables?.some((v: any) => v.name.includes('error'))) {
    features.push('Role="alert" for error messages');
  }
  
  if (functionSignatures.some(sig => sig.name.toLowerCase().includes('submit'))) {
    features.push('aria-describedby for input helpers');
  }
  
  return features;
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