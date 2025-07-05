// ============================================================================
// OPTIMIZED TOOL CREATION PROMPT - REDUCED FROM ~15K TO ~3K TOKENS
// ============================================================================

export const ALLOWED_COMPONENTS = {
  inputs: ['text-input', 'number-input', 'email-input', 'currency-input', 'textarea', 'select', 'multi-select', 'radio-group', 'checkbox-group', 'slider', 'date-picker', 'file-upload', 'toggle', 'color-picker'],
  displays: ['heading', 'text', 'metric-display', 'calculation-display', 'currency-display', 'percentage-display', 'progress-bar', 'badge', 'card', 'divider', 'icon', 'score-display', 'recommendation'],
  interactive: ['button', 'export-button', 'submit-button', 'reset-button'],
  charts: ['bar-chart', 'line-chart', 'pie-chart', 'gauge-chart'],
  layout: ['container', 'grid', 'section']
} as const;

export const ALL_ALLOWED_COMPONENTS = [...ALLOWED_COMPONENTS.inputs, ...ALLOWED_COMPONENTS.displays, ...ALLOWED_COMPONENTS.interactive, ...ALLOWED_COMPONENTS.charts, ...ALLOWED_COMPONENTS.layout] as const;
export type AllowedComponentType = typeof ALL_ALLOWED_COMPONENTS[number];

// ============================================================================
// OPTIMIZED PROMPT - 80% TOKEN REDUCTION
// ============================================================================

export const TOOL_CREATION_PROMPT = `You are a TOOL CREATION SPECIALIST generating ProductToolDefinition objects for business tools.

CRITICAL REQUIREMENTS:
• ID Format: "tool-[purpose]-001" (e.g. "tool-roi-calculator-001") - NEVER use "undefined"
• Slug Format: "[purpose]" (e.g. "roi-calculator") kebab-case
• Both metadata.id/slug must match main id/slug fields

CONTEXTUAL COLORS - Pick background colors that fit the industry:
Healthcare: #f8fafc (medical blue-white)  |  Financial: #f0f9ff (professional blue)
Food: #fef7ed (warm cream)  |  Fitness: #fff7ed (energetic peach)  |  Real Estate: #faf5ff (luxury purple)
Environmental: #f0fdf4 (natural green)  |  Corporate: #f8fafc (clean gray-blue)

REACT COMPONENT CODE:
• Start with 'use client';
• Function: PascalCase (e.g. ROICalculator)
• NO imports - use React.createElement() only
• Available: React, useState, useEffect, useCallback, useMemo, Button, Input, Label
• NO Card components - use divs with style={{ backgroundColor: colorScheme.background }}
• Add data-style-id for styling: 'data-style-id': 'unique-element-name'

MODERN LAYOUT:
1. Container: max-w-3xl mx-auto p-6
2. Background: rounded-xl border shadow-xl + style={{ backgroundColor: colorScheme.background }}
3. Header: px-6 py-4 border-b (brief title + info popover)
4. Content: p-6 space-y-6

ENHANCED STYLING:
• Spacing: p-8, space-y-8, gap-6, h-12 inputs
• Typography: text-2xl font-bold (titles), text-xl font-bold (sections)
• Effects: hover:scale-105 transition-all duration-300
• Input Safety: NEVER set input text colors - framework handles contrast
• Industry gradients for headers

PROFESSIONAL LAYOUTS:
• Use grid-cols-2/3 for input groups (never stack vertically)
• Dashboard results with side-by-side metrics
• Group related inputs logically

BUSINESS FOCUS:
• Working calculations with real value
• Professional language (never "heading", "button", "text here")
• Strategic email capture after showing value
• Clear, specific labels with units/context

COMPONENT TYPES:
Inputs: ${ALLOWED_COMPONENTS.inputs.join(', ')}
Displays: ${ALLOWED_COMPONENTS.displays.join(', ')}
Interactive: ${ALLOWED_COMPONENTS.interactive.join(', ')}
Charts: ${ALLOWED_COMPONENTS.charts.join(', ')}
Layout: ${ALLOWED_COMPONENTS.layout.join(', ')}

OUTPUT: Complete ProductToolDefinition JSON with metadata, componentCode, colorScheme, initialStyleMap.`;

export function getToolCreationSystemPrompt(): string {
  return TOOL_CREATION_PROMPT;
}

// ============================================================================
// USER PROMPT BUILDER FUNCTION
// ============================================================================

export function buildToolCreationUserPrompt(
  userIntent: string,
  context: any = {},
  existingTool?: any,
  updateType?: string
): string {
  const { 
    targetAudience, 
    industry, 
    toolType, 
    features, 
    businessDescription,
    colors,
    collectedAnswers,
    brandAnalysis,
    conversationHistory,
    selectedWorkflow,
    uploadedFiles,
    brainstormingResult,
    logicArchitectInsights
  } = context;

  let prompt = `Create a ${toolType || 'business tool'} with the following requirements:\n\n`;
  
  prompt += `USER INTENT: ${userIntent}\n\n`;
  
  if (targetAudience) prompt += `TARGET AUDIENCE: ${targetAudience}\n`;
  if (industry) prompt += `INDUSTRY: ${industry}\n`;
  if (businessDescription) prompt += `BUSINESS CONTEXT: ${businessDescription}\n`;
  if (features?.length) prompt += `REQUIRED FEATURES: ${features.join(', ')}\n`;
  if (colors?.length) prompt += `PREFERRED COLORS: ${colors.join(', ')}\n`;
  
  if (brainstormingResult) {
    prompt += `\nBRAINSTORMING INSIGHTS:\n${JSON.stringify(brainstormingResult, null, 2)}\n`;
  }
  
  if (logicArchitectInsights) {
    prompt += `\nLOGIC ARCHITECT INSIGHTS:\n${JSON.stringify(logicArchitectInsights, null, 2)}\n`;
  }
  
  if (collectedAnswers && Object.keys(collectedAnswers).length > 0) {
    prompt += `\nUSER ANSWERS:\n`;
    Object.entries(collectedAnswers).forEach(([key, value]) => {
      prompt += `${key}: ${value}\n`;
    });
  }
  
  if (existingTool && updateType) {
    prompt += `\nUPDATE EXISTING TOOL:\nUpdate Type: ${updateType}\n`;
    prompt += `Current Tool Title: ${existingTool.metadata?.title}\n`;
  }
  
  prompt += `\nGenerate a complete ProductToolDefinition that solves this business need professionally.`;
  
  return prompt;
} 
