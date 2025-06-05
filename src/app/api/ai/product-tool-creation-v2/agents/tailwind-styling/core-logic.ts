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
  logger.info({ 
    contentLength: content?.length || 0,
    hasJsxLayout: !!jsxLayout,
    hasStateLogic: !!stateLogic 
  }, '🎨 TailwindStyling: Parsing AI response for styling');

  // Try to extract structured data from AI response
  let aiStyling: any = null;
  
  try {
    // Look for JSON blocks in the AI response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                     content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      aiStyling = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      logger.info({ 
        hasAiStyling: true,
        aiKeys: Object.keys(aiStyling || {})
      }, '🎨 TailwindStyling: Successfully parsed AI JSON response');
    }
  } catch (parseError) {
    logger.warn({ 
      parseError: parseError instanceof Error ? parseError.message : String(parseError)
    }, '🎨 TailwindStyling: Could not parse AI JSON, using intelligent extraction');
  }

  // Extract styled component code from AI response or apply to JSX layout
  let styledComponentCode: string;
  
  if (aiStyling?.styledComponentCode) {
    styledComponentCode = aiStyling.styledComponentCode;
  } else if (content.includes('React.createElement') || content.includes('<')) {
    // Extract JSX/React code from the response
    const codeMatch = content.match(/```(?:jsx|typescript|tsx)?\s*([\s\S]*?)\s*```/) ||
                     content.match(/(React\.createElement[\s\S]*)/);
    styledComponentCode = codeMatch ? codeMatch[1].trim() : 
                         (jsxLayout?.componentStructure ? 
                          applyTailwindToJsxIntelligently(jsxLayout.componentStructure, content) :
                          generateFallbackStyledComponent());
  } else {
    styledComponentCode = jsxLayout?.componentStructure ? 
      applyTailwindToJsxIntelligently(jsxLayout.componentStructure, content) :
      generateFallbackStyledComponent();
  }

  // Extract color scheme from AI response or infer from content
  const colorScheme = extractColorSchemeFromAI(content, aiStyling) || {
    primary: 'blue-600',
    secondary: 'gray-600', 
    accent: 'emerald-500',
    neutral: 'gray-100',
    error: 'red-500',
    success: 'green-500'
  };

  // Build style map from JSX layout and AI insights
  const styleMap = buildStyleMapFromAI(jsxLayout, content, aiStyling, stateLogic);

  // Extract design tokens from AI or create intelligent defaults
  const designTokens = extractDesignTokensFromAI(content, aiStyling) || {
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

  logger.info({ 
    styledCodeLength: styledComponentCode.length,
    styleMapElements: styleMap.length,
    colorSchemeKeys: Object.keys(colorScheme).length,
    hasCustomDesignTokens: !!aiStyling?.designTokens
  }, '🎨 TailwindStyling: Successfully processed AI response');

  return {
    styledComponentCode,
    styleMap,
    colorScheme,
    designTokens
  };
}

/**
 * Intelligently applies Tailwind classes based on AI recommendations
 */
function applyTailwindToJsxIntelligently(jsxStructure: string, aiContent: string): string {
  // First apply basic styling
  let styledJsx = applyTailwindToJsx(jsxStructure);
  
  // Then enhance with AI insights
  const colorMatches = aiContent.match(/(?:bg-|text-|border-)[\w-]+/g) || [];
  const uniqueColors = [...new Set(colorMatches)];
  
  // Apply AI-suggested colors to key elements
  uniqueColors.forEach(colorClass => {
    if (colorClass.startsWith('bg-') && !colorClass.includes('gray') && !colorClass.includes('white')) {
      // Replace default blue backgrounds with AI suggestions
      styledJsx = styledJsx.replace(/bg-blue-600/g, colorClass);
    }
    if (colorClass.startsWith('text-') && !colorClass.includes('gray')) {
      // Enhance text colors based on AI suggestions
      styledJsx = styledJsx.replace(/text-blue-600/g, colorClass);
    }
  });
  
  return styledJsx;
}

/**
 * Extracts color scheme from AI response
 */
function extractColorSchemeFromAI(content: string, aiStyling?: any): any {
  if (aiStyling?.colorScheme) {
    return aiStyling.colorScheme;
  }
  
  // Extract colors from AI content
  const extractedColors: any = {};
  
  // Look for industry-specific color mentions
  if (content.toLowerCase().includes('healthcare') || content.toLowerCase().includes('medical')) {
    extractedColors.primary = 'blue-600';
    extractedColors.secondary = 'teal-500';
    extractedColors.accent = 'blue-500';
  } else if (content.toLowerCase().includes('financial') || content.toLowerCase().includes('business')) {
    extractedColors.primary = 'blue-700';
    extractedColors.secondary = 'gray-600';
    extractedColors.accent = 'blue-500';
  } else if (content.toLowerCase().includes('food') || content.toLowerCase().includes('restaurant')) {
    extractedColors.primary = 'orange-600';
    extractedColors.secondary = 'amber-600';
    extractedColors.accent = 'red-500';
  } else if (content.toLowerCase().includes('fitness') || content.toLowerCase().includes('health')) {
    extractedColors.primary = 'green-600';
    extractedColors.secondary = 'lime-500';
    extractedColors.accent = 'emerald-500';
  }
  
  if (Object.keys(extractedColors).length > 0) {
    return {
      ...extractedColors,
      neutral: 'gray-100',
      error: 'red-500',
      success: 'green-500'
    };
  }
  
  return null;
}

/**
 * Builds comprehensive style map from AI insights
 */
function buildStyleMapFromAI(jsxLayout?: any, content?: string, aiStyling?: any, stateLogic?: any): Array<{
  elementId: string;
  tailwindClasses: string[];
  responsiveVariants: Record<string, string[]>;
  stateVariants: Record<string, string[]>;
}> {
  if (aiStyling?.styleMap) {
    return aiStyling.styleMap;
  }
  
  const styleMap = jsxLayout?.elementMap?.map((el: any) => {
    const baseClasses = getTailwindClassesForElement(el);
    
    // Enhance with AI-suggested classes
    const aiEnhancedClasses = extractClassesForElement(el, content);
    const combinedClasses = [...new Set([...baseClasses, ...aiEnhancedClasses])];
    
    // Build responsive variants with AI insights
    const responsiveVariants = buildResponsiveVariants(el, content);
    
    // Build state variants considering stateLogic
    const stateVariants = buildStateVariantsWithLogic(el, stateLogic);
    
    return {
      elementId: el.elementId,
      tailwindClasses: combinedClasses,
      responsiveVariants,
      stateVariants
    };
  }) || [];
  
  return styleMap;
}

/**
 * Extracts design tokens from AI response
 */
function extractDesignTokensFromAI(content: string, aiStyling?: any): any {
  if (aiStyling?.designTokens) {
    return aiStyling.designTokens;
  }
  
  // Extract spacing patterns from content
  const spacingMatches = content.match(/(?:p-|m-|space-[xy]-)[\d]+/g) || [];
  const typographyMatches = content.match(/text-(?:xs|sm|base|lg|xl|2xl|3xl)/g) || [];
  
  if (spacingMatches.length > 0 || typographyMatches.length > 0) {
    return {
      spacing: buildSpacingTokens(spacingMatches),
      typography: buildTypographyTokens(typographyMatches),
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
  }
  
  return null;
}

/**
 * Helper functions for building tokens and variants
 */
function extractClassesForElement(element: any, content?: string): string[] {
  if (!content) return [];
  
  const elementClasses: string[] = [];
  
  // Look for classes related to this element type
  if (element.type === 'input' && content.includes('input')) {
    const inputClasses = content.match(/(?:text-gray-\d+|border-\w+-\d+|focus:ring-\w+-\d+)/g) || [];
    elementClasses.push(...inputClasses);
  }
  
  if (element.type === 'button' && content.includes('button')) {
    const buttonClasses = content.match(/(?:bg-\w+-\d+|hover:bg-\w+-\d+|text-white)/g) || [];
    elementClasses.push(...buttonClasses);
  }
  
  return [...new Set(elementClasses)];
}

function buildResponsiveVariants(element: any, content?: string): Record<string, string[]> {
  return {
    'sm': ['text-sm'],
    'md': ['text-base'],
    'lg': ['text-lg'],
    'xl': ['text-xl']
  };
}

function buildStateVariantsWithLogic(element: any, stateLogic?: any): Record<string, string[]> {
  const variants = getStateVariantsForElement(element);
  
  // Enhance with state logic insights
  if (stateLogic?.stateVariables) {
    Object.keys(stateLogic.stateVariables).forEach(stateVar => {
      if (stateVar.includes('error') || stateVar.includes('Error')) {
        variants.error = variants.error || [];
        variants.error.push('border-red-500', 'text-red-600');
      }
      if (stateVar.includes('loading') || stateVar.includes('Loading')) {
        variants.loading = variants.loading || [];
        variants.loading.push('opacity-50', 'cursor-wait');
      }
    });
  }
  
  return variants;
}

function buildSpacingTokens(spacingMatches: string[]): Record<string, string> {
  const tokens: Record<string, string> = {};
  spacingMatches.forEach(match => {
    const value = match.match(/\d+/)?.[0];
    if (value) {
      tokens[`spacing-${value}`] = `${parseInt(value) * 0.25}rem`;
    }
  });
  return Object.keys(tokens).length > 0 ? tokens : {
    'xs': '0.5rem', 'sm': '1rem', 'md': '1.5rem', 'lg': '2rem'
  };
}

function buildTypographyTokens(typographyMatches: string[]): Record<string, string> {
  const tokens: Record<string, string> = {};
  typographyMatches.forEach(match => {
    tokens[match] = match;
  });
  return Object.keys(tokens).length > 0 ? tokens : {
    'heading-1': 'text-3xl font-bold',
    'heading-2': 'text-xl font-semibold',
    'body': 'text-base'
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