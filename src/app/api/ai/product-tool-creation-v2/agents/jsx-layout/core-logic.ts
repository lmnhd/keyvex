import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC, updateTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Input schema
const JsxLayoutRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional()
});

export type JsxLayoutRequest = z.infer<typeof JsxLayoutRequestSchema>;

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

/**
 * JSX Layout Agent - Generates React component structure from AI
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

  console.log('🏗️ JSXLayout: ==================== STARTING JSX LAYOUT DESIGN ====================');
  console.log('🏗️ JSXLayout: Request parameters:', { 
    jobId, 
    selectedModel: selectedModel || 'default',
    timestamp: new Date().toISOString()
  });

  try {
    const tcc = await getTCC(jobId);
    if (!tcc) throw new Error(`TCC not found for jobId: ${jobId}`);

    console.log('🏗️ JSXLayout: ✅ TCC loaded successfully');
    console.log('🏗️ JSXLayout: TCC Analysis:', {
      currentStep: tcc.currentOrchestrationStep,
      status: tcc.status,
      hasUserInput: !!tcc.userInput,
      userInputKeys: Object.keys(tcc.userInput || {}),
      targetAudience: tcc.targetAudience || 'not specified',
      hasFunctionSignatures: !!(tcc.definedFunctionSignatures || tcc.functionSignatures)?.length,
      functionSignatureCount: (tcc.definedFunctionSignatures || tcc.functionSignatures)?.length || 0,
      functionNames: (tcc.definedFunctionSignatures || tcc.functionSignatures)?.map(f => f.name) || [],
      hasStateLogic: !!tcc.stateLogic,
      stateVariableCount: tcc.stateLogic?.variables?.length || 0
    });

    logger.info({ 
      jobId, 
      selectedModel: selectedModel || 'default',
      stepName: 'designing_jsx_layout',
      hasUserInput: !!tcc.userInput,
      hasFunctionSignatures: !!(tcc.definedFunctionSignatures || tcc.functionSignatures)?.length,
      hasStateLogic: !!tcc.stateLogic 
    }, '🏗️ JSXLayout: Starting JSX layout design');

    await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_jsx_layout, 'started', 'Designing JSX layout...');

    // Update TCC status
    console.log('🏗️ JSXLayout: Updating TCC status to IN_PROGRESS...');
    const tccInProgress = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccInProgress);
    console.log('🏗️ JSXLayout: ✅ TCC status updated to IN_PROGRESS');

    // Generate JSX layout with AI
    console.log('🏗️ JSXLayout: Calling AI to generate JSX layout...');
    console.log('🏗️ JSXLayout: AI Input parameters:', {
      selectedModel: selectedModel || 'default',
      userInputDescription: tcc.userInput?.description?.substring(0, 100) + '...' || 'No description',
      targetAudience: tcc.targetAudience || 'not specified',
      functionSignatureCount: (tcc.definedFunctionSignatures || tcc.functionSignatures)?.length || 0,
      hasStateLogic: !!tcc.stateLogic
    });
    const jsxLayout = await generateJsxLayout(tcc, selectedModel);
    console.log('🏗️ JSXLayout: ✅ AI generated JSX layout successfully');
    console.log('🏗️ JSXLayout: Generated layout summary:', {
      componentStructureLength: jsxLayout.componentStructure.length,
      elementMapCount: jsxLayout.elementMap.length,
      elementTypes: jsxLayout.elementMap.map(el => el.type)
    });

    // Update TCC with results using updateTCC to avoid race conditions
    console.log('🏗️ JSXLayout: Updating TCC with jsxLayout using updateTCC...');
    await updateTCC(jobId, {
      jsxLayout,
      steps: {
        ...tccInProgress.steps,
        designingJsxLayout: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tccInProgress.steps?.designingJsxLayout?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: jsxLayout
        }
      }
    });
    console.log('🏗️ JSXLayout: ✅ TCC updated successfully with jsxLayout data');

    await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_jsx_layout, 'completed', `Generated JSX layout with ${jsxLayout.elementMap.length} elements`);

    logger.info({ 
      jobId, 
      elementsCreated: jsxLayout.elementMap.length,
      componentStructureLength: jsxLayout.componentStructure.length 
    }, '🏗️ JSXLayout: JSX layout designed successfully');

    console.log('🏗️ JSXLayout: ==================== JSX LAYOUT DESIGN COMPLETED SUCCESSFULLY ====================');
    console.log('🏗️ JSXLayout: Final result summary:', {
      success: true,
      elementCount: jsxLayout.elementMap.length,
      componentStructureLength: jsxLayout.componentStructure.length,
      elementIds: jsxLayout.elementMap.map(el => el.elementId)
    });

    return {
      success: true,
      jsxLayout
    };

  } catch (error) {
    console.error('🏗️ JSXLayout: ==================== ERROR OCCURRED ====================');
    console.error('🏗️ JSXLayout: ❌ Error details:', {
      jobId,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    if (error instanceof Error && error.stack) {
      console.error('🏗️ JSXLayout: ❌ Error stack:', error.stack);
    }

    logger.error({ 
      jobId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error) 
    }, '🏗️ JSXLayout: Error designing JSX layout');
    
    await emitStepProgress(jobId, OrchestrationStepEnum.enum.designing_jsx_layout, 'failed', `JSX layout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

    console.error('🏗️ JSXLayout: ==================== JSX LAYOUT DESIGN FAILED ====================');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Generate JSX layout using AI
 */
async function generateJsxLayout(tcc: ToolConstructionContext, selectedModel?: string) {
  // Model selection logic
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

  logger.info({ provider: modelConfig.provider, modelName: actualModelName }, '🏗️ JSXLayout: Using model');

  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = `You are a React JSX layout specialist. Create semantic HTML component structure.

CRITICAL: Generate ONLY JSX structure - NO STYLING, NO COLORS, NO TAILWIND CLASSES.
Use semantic HTML elements and placeholder CSS classes.
Include accessibility features (ARIA labels, roles, proper form structure).

Return your JSX wrapped in jsx code blocks.`;

  const userPrompt = `Tool: ${tcc.userInput}
Target Audience: ${tcc.targetAudience || 'General users'}

Function Signatures:
${(tcc.definedFunctionSignatures || tcc.functionSignatures)?.map(sig => `- ${sig.name}: ${sig.description}`).join('\n') || 'None'}

State Logic Available:
${tcc.stateLogic?.stateVariables?.map(v => `- ${v.name}: ${v.type}`).join('\n') || 'None'}

Create JSX layout structure for this tool focusing on semantic HTML and accessibility.`;

  logger.info({ modelId: modelConfig.modelId, promptLength: userPrompt.length }, '🏗️ JSXLayout: Calling AI');

  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
    maxTokens: 2500
  });

  if (!content) throw new Error('No response from AI model');

  // AI FIRST: Parse the response
  return parseJsxResponse(content, tcc.definedFunctionSignatures || tcc.functionSignatures || []);
}

/**
 * AI FIRST: Parse AI response for JSX
 */
function parseJsxResponse(content: string, functionSignatures: DefinedFunctionSignature[]) {
  // Extract JSX from AI response
  const jsxMatch = content.match(/```(?:jsx|tsx|html)?\s*([\s\S]*?)\s*```/) || 
                   content.match(/(<div[\s\S]*?<\/div>)/);
  
  let componentStructure: string;
  if (jsxMatch) {
    componentStructure = jsxMatch[1] || jsxMatch[0];
    logger.info({ jsxLength: componentStructure.length }, '🏗️ JSXLayout: AI FIRST - Using AI JSX');
  } else {
    // Simple fallback
    componentStructure = generateFallbackJsx(functionSignatures);
    logger.warn('🏗️ JSXLayout: No AI JSX found, using fallback');
  }

  // Extract element map from the JSX
  const elementMap = extractElementMap(componentStructure);
  
  return {
    componentStructure,
    elementMap,
    accessibilityFeatures: ['ARIA labels', 'Semantic HTML', 'Form accessibility'],
    responsiveBreakpoints: ['mobile', 'tablet', 'desktop']
  };
}

/**
 * Extract element map from JSX structure
 */
function extractElementMap(jsx: string) {
  const elementMap: any[] = [];
  const elementMatches = jsx.match(/id="([^"]+)"/g) || [];
  
  elementMatches.forEach(match => {
    const idMatch = match.match(/id="([^"]+)"/);
    if (idMatch) {
      const elementId = idMatch[1];
      let type = 'div';
      
      if (jsx.includes(`<input[^>]*id="${elementId}"`)) type = 'input';
      else if (jsx.includes(`<button[^>]*id="${elementId}"`)) type = 'button';
      else if (jsx.includes(`<section[^>]*id="${elementId}"`)) type = 'section';
      else if (jsx.includes(`<header[^>]*id="${elementId}"`)) type = 'header';
      
      elementMap.push({
        elementId,
        type,
        purpose: `${type} element`,
        placeholderClasses: [`${elementId}-element`]
      });
    }
  });
  
  return elementMap;
}

/**
 * Simple fallback JSX when AI parsing fails
 */
function generateFallbackJsx(functionSignatures: DefinedFunctionSignature[]): string {
  const hasSubmit = functionSignatures.some(sig => sig.name.toLowerCase().includes('submit'));
  const hasReset = functionSignatures.some(sig => sig.name.toLowerCase().includes('reset'));

  return `<div id="tool-container" className="tool-container">
  <header id="tool-header" className="tool-header">
    <h1 id="tool-title" className="tool-title">Tool</h1>
  </header>
  <main id="tool-main" className="tool-main">
    <section id="input-section" className="input-section">
      <input id="main-input" type="text" className="main-input" />
      ${hasSubmit ? '<button id="submit-btn" type="submit" className="submit-btn">Submit</button>' : ''}
      ${hasReset ? '<button id="reset-btn" type="button" className="reset-btn">Reset</button>' : ''}
    </section>
    <section id="results-section" className="results-section">
      <div id="results-display" className="results-display">Results</div>
    </section>
  </main>
</div>`;
} 