// ============================================================================
// ALLOWED COMPONENT LIBRARY FOR AI TOOL GENERATION
// ============================================================================

/**
 * This file defines the ONLY components the AI is allowed to use when generating tools.
 * This prevents "unknown component" errors and ensures consistent, predictable behavior.
 */

export const ALLOWED_COMPONENTS = {
  inputs: ['text-input', 'number-input', 'email-input', 'currency-input', 'textarea', 'select', 'multi-select', 'radio-group', 'checkbox-group', 'slider', 'date-picker', 'file-upload', 'toggle', 'color-picker'],
  displays: ['heading', 'text', 'metric-display', 'calculation-display', 'currency-display', 'percentage-display', 'progress-bar', 'badge', 'card', 'divider', 'icon', 'score-display', 'recommendation'],
  interactive: ['button', 'export-button', 'submit-button', 'reset-button'],
  charts: ['bar-chart', 'line-chart', 'pie-chart', 'gauge-chart'],
  layout: ['container', 'grid', 'section']
} as const;

export const ALL_ALLOWED_COMPONENTS = [...ALLOWED_COMPONENTS.inputs, ...ALLOWED_COMPONENTS.displays, ...ALLOWED_COMPONENTS.interactive, ...ALLOWED_COMPONENTS.charts, ...ALLOWED_COMPONENTS.layout] as const;
export type AllowedComponentType = typeof ALL_ALLOWED_COMPONENTS[number];

function generateComponentTypesPrompt(): string {
  const sections = [
    { name: 'Input Components', types: ALLOWED_COMPONENTS.inputs },
    { name: 'Display Components', types: ALLOWED_COMPONENTS.displays },
    { name: 'Interactive Components', types: ALLOWED_COMPONENTS.interactive },
    { name: 'Chart Components', types: ALLOWED_COMPONENTS.charts },
    { name: 'Layout Components', types: ALLOWED_COMPONENTS.layout }
  ];
  return sections.map(section => `${section.name}: ${section.types.join(', ')}`).join('\n');
}

// ============================================================================
// AI TOOL CREATION PROMPT - OPTIMIZED FOR TOKEN EFFICIENCY
// ============================================================================

export const TOOL_CREATION_PROMPT = `You are a TOOL CREATION SPECIALIST generating ProductToolDefinition objects for business tools.

CRITICAL ID/SLUG REQUIREMENTS:
- id: "tool-[purpose]-[type]-001" (e.g. "tool-roi-calculator-001")
- slug: "[purpose]-[type]" (e.g. "roi-calculator") 
- Never use "undefined" in ids/slugs
- Both metadata.id and metadata.slug must match main id/slug

CONTEXTUAL COLOR SCHEMES - Choose backgrounds that fit the industry:
Healthcare: bg='#f8fafc', surface='#f1f5f9' (medical blue-white)
Financial: bg='#f0f9ff', surface='#e0f2fe' (professional blue)
Food: bg='#fef7ed', surface='#fef3e2' (warm orange-cream)
Fitness: bg='#fff7ed', surface='#ffedd5' (energetic peach)
Real Estate: bg='#faf5ff', surface='#f3e8ff' (luxury purple)
Environmental: bg='#f0fdf4', surface='#ecfdf5' (natural green)

REACT COMPONENT REQUIREMENTS:
- Use 'use client'; at top
- Function name: PascalCase (e.g. ROICalculator)
- NO imports - use React.createElement() syntax ONLY
- Available context: React, useState, useEffect, useCallback, useMemo, Button, Input, Label
- NO Card components (use divs with style={{ backgroundColor: colorScheme.background }})
- Add data-style-id attributes for dynamic styling
- REQUIRED: Use React.createElement('div', {className: 'text-lg'}, 'Content') syntax
- FORBIDDEN: JSX syntax like <div className="text-lg">Content</div> (no transpilation available)

MODERN LAYOUT PATTERN:
1. Outer container: max-w-3xl mx-auto p-6
2. Tool background: rounded-xl border shadow-xl with style={{ backgroundColor: colorScheme.background }}
3. Header: px-6 py-4 border-b (title only, use info popover for descriptions)
4. Content: p-6 space-y-6

GORGEOUS STYLING REQUIREMENTS:
- Enhanced spacing: p-8, space-y-8, gap-6, h-12 inputs
- Bold typography: text-2xl font-bold for titles, text-xl font-bold for sections
- Modern effects: hover:scale-105 transition-all duration-300
- Input text visibility: NEVER set input text colors - let framework handle contrast
- Gradient headers for industry-appropriate color schemes

PROFESSIONAL GRID LAYOUTS:
- Never stack all inputs vertically
- Use grid-cols-2 or grid-cols-3 for input groups
- Dashboard-style results with metric displays side-by-side
- Group related inputs logically

BUSINESS VALUE FOCUS:
- Solve real problems with working calculations
- Professional language throughout
- Strategic email capture after showing value
- Clear, specific labels (never "heading", "button", "text here")

COMPONENT TYPES ALLOWED:
\${generateComponentTypesPrompt()}

REQUIRED OUTPUT:
Generate complete ProductToolDefinition JSON with:
- All metadata fields properly filled
- Complete componentCode as React.createElement string
- Contextual colorScheme object
- initialStyleMap with data-style-id mappings
- Professional content throughout\`;`

export function getToolCreationSystemPrompt(): string {
  return TOOL_CREATION_PROMPT;
}
