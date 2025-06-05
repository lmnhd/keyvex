import { z } from 'zod';
import { ToolConstructionContext, DefinedFunctionSignature, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

// Input schema for the tailwind styling agent
const TailwindStylingRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional()
});

export type TailwindStylingRequest = z.infer<typeof TailwindStylingRequestSchema>;

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
 * Core logic for the Tailwind Styling Agent.
 * Applies comprehensive Tailwind CSS styling to every component and element.
 */
export async function applyStyling(request: TailwindStylingRequest): Promise<{
  success: boolean;
  styling?: {
    styledComponentCode: string;
    styleMap: Array<{
      elementId: string;
      tailwindClasses: string[];
      responsiveVariants: Record<string, string[]>;
      stateVariants: Record<string, string[]>;
    }>;
    colorScheme: {
      primary: string;
      secondary: string;
      accent: string;
      neutral: string;
      error: string;
      success: string;
    };
    designTokens: {
      spacing: Record<string, string>;
      typography: Record<string, string>;
      shadows: Record<string, string>;
      animations: Record<string, string>;
    };
  };
  error?: string;
}> {
  const { jobId, selectedModel } = TailwindStylingRequestSchema.parse(request);

  try {
    // Load current TCC state
    const tcc = await getTCC(jobId);
    if (!tcc) {
      throw new Error(`TCC not found for jobId: ${jobId}`);
    }

    logger.info({ 
      jobId, 
      selectedModel: selectedModel || 'default',
      stepName: 'applying_tailwind_styling',
      hasJsxLayout: !!tcc.jsxLayout,
      hasStateLogic: !!tcc.stateLogic,
      hasFunctionSignatures: !!tcc.functionSignatures?.length
    }, '🎨 TailwindStyling: Starting styling application');

    // Update status to in_progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.applying_tailwind_styling,
      'started',
      'Applying comprehensive Tailwind CSS styling...'
    );

    // Update TCC status
    const tccInProgress = {
      ...tcc,
      status: OrchestrationStatusEnum.enum.in_progress,
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccInProgress);

    // Generate Tailwind styling using AI with proper model selection
    const styling = await generateTailwindStyling(tcc, selectedModel);

    // Update TCC with styling
    const tccWithStyling = {
      ...tccInProgress,
      styling,
      steps: {
        ...tccInProgress.steps,
        applyingTailwindStyling: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tccInProgress.steps?.applyingTailwindStyling?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: styling
        }
      },
      updatedAt: new Date().toISOString()
    };
    await saveTCC(tccWithStyling);

    // Update progress to completed
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.applying_tailwind_styling,
      'completed',
      `Applied styling to ${styling.styleMap.length} elements`
    );

    logger.info({ 
      jobId, 
      elementsStyled: styling.styleMap.length,
      colorSchemeKeys: Object.keys(styling.colorScheme).length,
      styledCodeLength: styling.styledComponentCode.length
    }, '🎨 TailwindStyling: Applied styling successfully');

    return {
      success: true,
      styling
    };

  } catch (error) {
    logger.error({ 
      jobId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error) 
    }, '🎨 TailwindStyling: Error applying styling');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.applying_tailwind_styling,
      'failed',
      `Styling application failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Uses AI to generate comprehensive Tailwind CSS styling.
 */
async function generateTailwindStyling(
  tcc: ToolConstructionContext, 
  selectedModel?: string
): Promise<{
  styledComponentCode: string;
  styleMap: Array<{
    elementId: string;
    tailwindClasses: string[];
    responsiveVariants: Record<string, string[]>;
    stateVariants: Record<string, string[]>;
  }>;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
    error: string;
    success: string;
  };
  designTokens: {
    spacing: Record<string, string>;
    typography: Record<string, string>;
    shadows: Record<string, string>;
    animations: Record<string, string>;
  };
}> {
  // Determine model to use following established pattern
  let modelConfig: { provider: string; modelId: string };
  let actualModelName: string;

  if (selectedModel && selectedModel !== 'default') {
    // CASE 1: Explicit model specified
    logger.info({ selectedModel }, '🎨 TailwindStyling: User selected explicit model');
    const provider = getModelProvider(selectedModel);
    if (provider !== 'unknown') {
      modelConfig = { provider, modelId: selectedModel };
      actualModelName = selectedModel;
    } else {
      logger.warn({ selectedModel }, '🎨 TailwindStyling: Unknown model format, falling back to default');
      const primaryModel = getPrimaryModel('styleMaster');
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
    }, '🎨 TailwindStyling: Using default model configuration');
    
    try {
      const primaryModel = getPrimaryModel('styleMaster');
      if (primaryModel && 'modelInfo' in primaryModel) {
        modelConfig = { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
        actualModelName = primaryModel.modelInfo.id;
        logger.info({ 
          provider: primaryModel.provider,
          modelId: primaryModel.modelInfo.id 
        }, '🎨 TailwindStyling: Using styleMaster primary model');
      } else {
        const fallbackModel = getFallbackModel('styleMaster');
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
      }, '🎨 TailwindStyling: Could not resolve default model, using fallback');
      
      modelConfig = { provider: 'openai', modelId: 'gpt-4o' };
      actualModelName = 'gpt-4o';
    }
  }

  const selectionMethod = selectedModel && selectedModel !== 'default' 
    ? `Explicit User Selection (${selectedModel})` 
    : selectedModel === 'default' 
      ? 'User Selected "default" → styleMaster Config' 
      : 'No Model → styleMaster Config';
      
  logger.info({ 
    provider: modelConfig.provider,
    modelName: actualModelName,
    selectionMethod,
    originalSelectedModel: selectedModel || 'none'
  }, '🎨 TailwindStyling Model Selection:');

  const modelInstance = createModelInstance(modelConfig.provider, modelConfig.modelId);

  const systemPrompt = `You are a Tailwind CSS styling specialist. Apply comprehensive, modern styling to React components.

CRITICAL RULES:
1. Apply Tailwind classes to EVERY element - comprehensive coverage
2. Create modern, professional, accessible designs
3. Use responsive design patterns (mobile-first)
4. Include hover, focus, and active states
5. Follow modern UI/UX best practices
6. Ensure high contrast and accessibility
7. Use semantic color naming and consistent design tokens
8. Create smooth animations and transitions

Format your response with complete styled JSX code and detailed style mapping.`;

  const jsxInfo = tcc.jsxLayout ? `
JSX Layout:
${tcc.jsxLayout.componentStructure}

Elements:
${tcc.jsxLayout.elementMap.map(el => `- ${el.elementId}: ${el.purpose}`).join('\n')}
` : 'No JSX layout available';

  const userPrompt = `Tool Description: ${tcc.userInput}
Target Audience: ${tcc.targetAudience || 'General users'}

${jsxInfo}

Apply comprehensive Tailwind CSS styling to create a modern, professional design that:
1. Styles EVERY element with appropriate classes
2. Uses a cohesive color scheme and design system
3. Includes responsive design for mobile, tablet, and desktop
4. Adds appropriate hover, focus, and interaction states
5. Ensures accessibility and high contrast
6. Creates smooth transitions and micro-interactions

Provide complete styled JSX code and detailed style mapping.`;

  logger.info({ 
    provider: modelConfig.provider,
    modelId: modelConfig.modelId,
    userInputLength: userPrompt.length 
  }, '🎨 TailwindStyling: Calling AI model for styling generation');

  const { text: content } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
    maxTokens: 4000
  });

  if (!content) {
    throw new Error('No response received from AI model');
  }

  // Parse the AI response into structured styling
  try {
    const styling = parseTailwindStylingResponse(content, tcc.jsxLayout, tcc.stateLogic);
    
    logger.info({ 
      styleMapCount: styling.styleMap.length,
      colorSchemeKeys: Object.keys(styling.colorScheme).length,
      styledCodeLength: styling.styledComponentCode.length,
      modelUsed: actualModelName 
    }, '🎨 TailwindStyling: Successfully parsed AI response');
    
    return styling;
    
  } catch (parseError) {
    logger.error({ 
      parseError: parseError instanceof Error ? parseError.message : String(parseError),
      rawResponseLength: content?.length || 0,
      modelUsed: actualModelName 
    }, '🎨 TailwindStyling: Failed to parse AI response');
    logger.debug({ rawResponse: content }, '🎨 TailwindStyling: Raw AI response for debugging');
    
    // Fallback to basic styling
    return generateFallbackStyling(tcc.jsxLayout);
  }
}

/**
 * Parses the AI response and extracts structured Tailwind styling
 */
function parseTailwindStylingResponse(
  content: string, 
  jsxLayout?: any,
  stateLogic?: any
): {
  styledComponentCode: string;
  styleMap: Array<{
    elementId: string;
    tailwindClasses: string[];
    responsiveVariants: Record<string, string[]>;
    stateVariants: Record<string, string[]>;
  }>;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
    error: string;
    success: string;
  };
  designTokens: {
    spacing: Record<string, string>;
    typography: Record<string, string>;
    shadows: Record<string, string>;
    animations: Record<string, string>;
  };
} {
  // Generate comprehensive styled version based on the layout
  const styledComponentCode = jsxLayout?.componentStructure ? 
    applyTailwindToJsx(jsxLayout.componentStructure) :
    generateFallbackStyledComponent();

  const styleMap = jsxLayout?.elementMap?.map(el => ({
    elementId: el.elementId,
    tailwindClasses: getTailwindClassesForElement(el),
    responsiveVariants: {
      'sm': ['text-sm'],
      'md': ['text-base'],
      'lg': ['text-lg']
    },
    stateVariants: getStateVariantsForElement(el)
  })) || [];

  const colorScheme = {
    primary: 'blue-600',
    secondary: 'gray-600', 
    accent: 'emerald-500',
    neutral: 'gray-100',
    error: 'red-500',
    success: 'green-500'
  };

  const designTokens = {
    spacing: {
      'xs': '0.5rem',
      'sm': '1rem', 
      'md': '1.5rem',
      'lg': '2rem'
    },
    typography: {
      'heading-1': 'text-3xl font-bold',
      'heading-2': 'text-xl font-semibold',
      'body': 'text-base'
    },
    shadows: {
      'light': 'shadow-sm',
      'medium': 'shadow-md',
      'heavy': 'shadow-lg'
    },
    animations: {
      'fade-in': 'transition-opacity duration-300',
      'slide-in': 'transition-transform duration-300'
    }
  };

  return {
    styledComponentCode,
    styleMap,
    colorScheme,
    designTokens
  };
}

/**
 * Applies Tailwind classes to JSX structure
 */
function applyTailwindToJsx(jsxStructure: string): string {
  return jsxStructure
    .replace(/className="tool-container"/, 'className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8"')
    .replace(/className="tool-header"/, 'className="text-center mb-8 p-6 bg-white rounded-lg shadow-md"')
    .replace(/className="tool-title"/, 'className="text-3xl md:text-4xl font-bold text-gray-900 mb-2"')
    .replace(/className="tool-description"/, 'className="text-lg text-gray-600 max-w-2xl mx-auto"')
    .replace(/className="tool-main"/, 'className="max-w-4xl mx-auto space-y-8"')
    .replace(/className="input-section"/, 'className="bg-white p-6 rounded-lg shadow-md"')
    .replace(/className="form-container"/, 'className="space-y-6"')
    .replace(/className="input-group"/, 'className="space-y-2"')
    .replace(/className="input-label"/, 'className="block text-sm font-medium text-gray-700"')
    .replace(/className="main-input"/, 'className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"')
    .replace(/className="input-help"/, 'className="text-sm text-gray-500"')
    .replace(/className="button-group"/, 'className="flex flex-col sm:flex-row gap-3"')
    .replace(/className="submit-button primary-button"/, 'className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"')
    .replace(/className="reset-button secondary-button"/, 'className="px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"')
    .replace(/className="results-section"/, 'className="bg-white p-6 rounded-lg shadow-md"')
    .replace(/className="results-container"/, 'className="space-y-4"')
    .replace(/className="results-title"/, 'className="text-xl font-semibold text-gray-900"')
    .replace(/className="results-content"/, 'className="space-y-4"')
    .replace(/className="loading-indicator"/, 'className="flex items-center justify-center p-4 text-gray-500"')
    .replace(/className="results-display"/, 'className="p-4 bg-gray-50 rounded-lg border"')
    .replace(/className="error-display"/, 'className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800"');
}

/**
 * Gets Tailwind classes for an element
 */
function getTailwindClassesForElement(element: any): string[] {
  const baseClasses = [];
  
  switch (element.type) {
    case 'div':
      if (element.elementId.includes('container')) {
        baseClasses.push('w-full', 'max-w-4xl', 'mx-auto');
      }
      break;
    case 'header':
      baseClasses.push('text-center', 'mb-8', 'p-6', 'bg-white', 'rounded-lg', 'shadow-md');
      break;
    case 'section':
      baseClasses.push('bg-white', 'p-6', 'rounded-lg', 'shadow-md', 'space-y-4');
      break;
    case 'input':
      baseClasses.push('w-full', 'px-4', 'py-3', 'border', 'rounded-lg', 'focus:ring-2');
      break;
    case 'button':
      baseClasses.push('px-6', 'py-3', 'font-medium', 'rounded-lg', 'transition-colors');
      break;
  }
  
  return baseClasses;
}

/**
 * Gets state variants for an element
 */
function getStateVariantsForElement(element: any): Record<string, string[]> {
  const variants: Record<string, string[]> = {};
  
  if (element.type === 'button') {
    variants.hover = ['bg-opacity-90', 'transform', 'scale-105'];
    variants.active = ['bg-opacity-80'];
    variants.disabled = ['opacity-50', 'cursor-not-allowed'];
  }
  
  if (element.type === 'input') {
    variants.focus = ['ring-2', 'ring-blue-500'];
    variants.error = ['border-red-500', 'ring-red-500'];
    variants.disabled = ['bg-gray-100'];
  }
  
  return variants;
}

/**
 * Generates fallback styling when AI parsing fails
 */
function generateFallbackStyling(jsxLayout?: any): {
  styledComponentCode: string;
  styleMap: Array<{
    elementId: string;
    tailwindClasses: string[];
    responsiveVariants: Record<string, string[]>;
    stateVariants: Record<string, string[]>;
  }>;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
    error: string;
    success: string;
  };
  designTokens: {
    spacing: Record<string, string>;
    typography: Record<string, string>;
    shadows: Record<string, string>;
    animations: Record<string, string>;
  };
} {
  logger.info({ 
    hasJsxLayout: !!jsxLayout 
  }, '🎨 TailwindStyling: Generating fallback styling');

  return {
    styledComponentCode: generateFallbackStyledComponent(),
    styleMap: [
      {
        elementId: 'container',
        tailwindClasses: ['p-4', 'max-w-2xl', 'mx-auto'],
        responsiveVariants: { 'md': ['p-6'] },
        stateVariants: {}
      }
    ],
    colorScheme: {
      primary: 'blue-600',
      secondary: 'gray-600',
      accent: 'emerald-500',
      neutral: 'gray-100',
      error: 'red-500',
      success: 'green-500'
    },
    designTokens: {
      spacing: { 'base': '1rem' },
      typography: { 'base': 'text-base' },
      shadows: { 'base': 'shadow-md' },
      animations: { 'base': 'transition-all duration-300' }
    }
  };
}

/**
 * Generates a fallback styled component
 */
function generateFallbackStyledComponent(): string {
  return `<div className="min-h-screen bg-gray-50 p-4 md:p-6">
  <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
    <h1 className="text-2xl font-bold text-gray-900 mb-4">Tool</h1>
    <div className="space-y-4">
      <input 
        type="text" 
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
        placeholder="Enter input..."
      />
      <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Submit
      </button>
      <div className="p-4 bg-gray-50 rounded-lg">
        Results will appear here
      </div>
    </div>
  </div>
</div>`;
}