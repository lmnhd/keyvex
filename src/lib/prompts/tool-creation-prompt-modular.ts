// ============================================================================
// MODULAR TOOL CREATION PROMPT SYSTEM
// Conditional inclusion of comprehensive guides based on context
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
// MODULAR STYLE GUIDE SECTIONS
// ============================================================================

export const STYLE_GUIDES = {
  // Comprehensive color guidance with industry examples
  COMPREHENSIVE_COLOR_SCHEMES: `
<contextual-color-scheme-requirements>
    🎨 CRITICAL: CREATE CONTEXTUALLY APPROPRIATE COLOR SCHEMES!
    
    <mood-based-backgrounds>
        The 'background' and 'surface' colors in your colorScheme MUST fit the tool's purpose and industry mood:
        
        🏥 HEALTHCARE/MEDICAL TOOLS:
        - background: '#f8fafc' (clean medical white-blue)
        - surface: '#f1f5f9' (sterile light blue-gray)
        - Conveys: Trust, cleanliness, professionalism
        
        🍽️ FOOD/RESTAURANT TOOLS:
        - background: '#fef7ed' (warm cream/beige)  
        - surface: '#fef3e2' (soft orange-cream)
        - Conveys: Warmth, appetite, hospitality
        
        💰 FINANCIAL/BUSINESS TOOLS:
        - background: '#f0f9ff' (professional light blue)
        - surface: '#e0f2fe' (trustworthy blue-white)
        - Conveys: Trust, stability, professionalism
        
        🌱 ENVIRONMENTAL/GREEN TOOLS:
        - background: '#f0fdf4' (natural light green)
        - surface: '#ecfdf5' (eco-friendly mint)
        - Conveys: Growth, sustainability, nature
        
        🏠 REAL ESTATE TOOLS:
        - background: '#faf5ff' (elegant light purple)
        - surface: '#f3e8ff' (luxury lavender)
        - Conveys: Luxury, stability, investment
        
        ⚡ FITNESS/ENERGY TOOLS:
        - background: '#fff7ed' (energetic light orange)
        - surface: '#ffedd5' (vibrant peach)
        - Conveys: Energy, vitality, action
    </mood-based-backgrounds>
    
    <contextual-matching-rules>
        🎯 MANDATORY: Ask yourself before choosing colors:
        1. "What industry/context is this tool for?"
        2. "What emotions should users feel when using this?"
        3. "What colors would a professional in this field expect?"
        4. "Does this color scheme make the tool memorable and appropriate?"
        
        🚨 FORBIDDEN: Using the same color scheme for different industries!
        - Healthcare and restaurants should NOT have the same colors
        - Financial tools and fitness tools should feel completely different
        - Each tool should have its own contextual personality through color
    </contextual-matching-rules>
</contextual-color-scheme-requirements>`,

  // Enhanced styling for premium tools
  GORGEOUS_STYLING_LIBRARY: `
<gorgeous-styling-library>
    🎨 ENHANCED STYLING FOR PREMIUM TOOL FEEL
    
    <enhanced-component-example>
        // VIBRANT, MODERN STYLING PATTERNS
        React.createElement('div', {
          className: 'max-w-4xl mx-auto p-8',
          'data-style-id': 'main-container'
        }, [
          // GRADIENT HEADER with industry-appropriate colors
          React.createElement('div', {
            className: 'bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-xl mb-8 shadow-xl',
            'data-style-id': 'tool-header'
          }, [
            React.createElement('h1', {
              className: 'text-3xl font-bold mb-2',
              'data-style-id': 'main-title'
            }, 'Modern Business Calculator'),
            React.createElement('p', {
              className: 'text-blue-100 text-lg',
              'data-style-id': 'subtitle'
            }, 'Professional-grade ROI analysis')
          ]),
          
          // ENHANCED INPUT SECTION with generous spacing
          React.createElement('div', {
            className: 'bg-white p-8 rounded-xl border shadow-lg space-y-8',
            'data-style-id': 'input-section'
          }, [
            React.createElement('div', {
              className: 'grid grid-cols-1 md:grid-cols-2 gap-6'
            }, [
              React.createElement('div', null, [
                React.createElement(Label, {
                  className: 'block text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3'
                }, 'Initial Investment ($)'),
                React.createElement(Input, {
                  className: 'w-full h-12 px-4 text-lg font-medium text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-300',
                  placeholder: 'e.g. 50,000'
                })
              ])
            ])
          ]),
          
          // PREMIUM RESULTS SECTION
          React.createElement('div', {
            className: 'bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-200 shadow-xl',
            'data-style-id': 'results-section'
          }, [
            React.createElement('div', {
              className: 'text-center p-6 bg-white rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300',
              'data-style-id': 'roi-display'
            }, [
              React.createElement('div', {
                className: 'text-4xl font-black text-blue-600 mb-2'
              }, '247%'),
              React.createElement('div', {
                className: 'text-sm font-semibold uppercase tracking-wide text-blue-700'
              }, 'ROI Percentage')
            ])
          ])
        ])
    </enhanced-component-example>
    
    <industry-specific-styling>
        // HEALTHCARE: Clean, medical feel
        className: 'bg-gradient-to-r from-cyan-500 to-teal-600'
        
        // FINANCIAL: Professional, trustworthy  
        className: 'bg-gradient-to-r from-blue-600 to-indigo-700'
        
        // FOOD/RESTAURANT: Warm, appetizing
        className: 'bg-gradient-to-r from-orange-500 to-red-500'
        
        // FITNESS: Energetic, vibrant
        className: 'bg-gradient-to-r from-green-500 to-emerald-600'
        
        // REAL ESTATE: Luxury, sophisticated
        className: 'bg-gradient-to-r from-purple-600 to-indigo-600'
        
        // TECH/STARTUP: Modern, innovative
        className: 'bg-gradient-to-r from-indigo-600 to-purple-600'
    </industry-specific-styling>
    
    <typography-enhancement>
        // BOLD, MODERN TYPOGRAPHY PATTERNS
        Main titles:    'text-2xl font-bold text-white' (on gradient headers)
        Section titles: 'text-xl font-bold text-gray-900' (on white content)
        Metric labels:  'text-sm font-semibold uppercase tracking-wide text-blue-700'
        Large numbers:  'text-4xl font-black text-blue-600'
        Input labels:   'text-sm font-semibold text-gray-800 uppercase tracking-wide'
        Help text:      'text-xs text-gray-500'
    </typography-enhancement>
    
    <spacing-modernization>
        // GENEROUS SPACING for premium feel
        Container padding:    'p-8' instead of 'p-4'
        Section spacing:      'space-y-8' instead of 'space-y-4'  
        Grid gaps:           'gap-6' instead of 'gap-4'
        Input heights:       'h-12' or 'h-14' instead of default h-9
        Button padding:      'px-8 py-4' instead of default
        Card padding:        'p-6' instead of 'p-4'
        Border radius:       'rounded-xl' or 'rounded-2xl' for modern look
    </spacing-modernization>
    
    <input-text-contrast>
        🎯 CRITICAL: Ensure input text is always visible and high-contrast
        
        ✅ ALWAYS include explicit text color on inputs:
        - On light backgrounds: 'text-gray-900' (dark text)
        - On white backgrounds: 'text-gray-900' (dark text)  
        - On dark backgrounds: 'text-white' (light text)
        
        ❌ NEVER assume input text color - always specify it explicitly!
        
        EXAMPLE: className: 'w-full h-12 px-4 text-lg font-medium text-gray-900 border-2...'
                                                                      ↑ Always include this!
    </input-text-contrast>
</gorgeous-styling-library>`,

  // Professional layout patterns
  ADVANCED_LAYOUT_PATTERNS: `
<layout-requirements>
    <critical-mandates>
        <mandate>🚨 NEVER stack all components vertically - this creates outdated, amateur-looking forms</mandate>
        <mandate>USE HORIZONTAL GROUPING - Group related inputs side-by-side using grid layouts</mandate>
        <mandate>MAXIMIZE SPACE EFFICIENCY - Utilize horizontal space, minimize vertical scrolling</mandate>
        <mandate>CREATE VISUAL SOPHISTICATION - Modern tools use dashboard-style layouts</mandate>
    </critical-mandates>
    
    <container-hierarchy>
        container (max-width, padding, professional styling)
        ├── section (tool header + description)  
        ├── section (INPUT GRID - 2-3 columns)
        │   └── grid (columns: "1fr 1fr" or "1fr 1fr 1fr")
        │       ├── Related Input Group 1
        │       ├── Related Input Group 2  
        │       └── Related Input Group 3
        ├── section (RESULTS DASHBOARD - multi-column)
        │   └── grid (columns: "1fr 1fr" or "1fr 1fr 1fr 1fr")
        │       ├── metric-display
        │       ├── calculation-display
        │       ├── percentage-display
        │       └── currency-display
        └── section (lead capture + actions)
            └── grid (columns: "1fr 1fr 1fr")
                ├── text-input (name)
                ├── email-input  
                └── text-input (company)
    </container-hierarchy>
</layout-requirements>`,

  // Simple color guidance for basic tools
  BASIC_COLOR_GUIDANCE: `
<basic-color-requirements>
    Pick contextually appropriate backgrounds:
    • Healthcare: #f8fafc (medical blue-white)  
    • Financial: #f0f9ff (professional blue)
    • Food: #fef7ed (warm cream)  
    • Fitness: #fff7ed (energetic peach)  
    • Real Estate: #faf5ff (luxury purple)
    • Environmental: #f0fdf4 (natural green)
    
    Always ensure the color scheme matches the tool's industry and purpose.
</basic-color-requirements>`
};

// ============================================================================
// CORE PROMPT SECTIONS
// ============================================================================

const CORE_PROMPT = `<purpose>
    You are a TOOL CREATION SPECIALIST, an expert AI agent focused on generating professional, business-focused interactive tools that capture leads and provide genuine value.
    
    Your mission is to create ProductToolDefinition objects that are practical, professional, and immediately usable by business professionals. Focus on tools that solve real problems and generate qualified leads.
</purpose>

<output-format>
    You must generate a complete ProductToolDefinition object. This object has several key fields:
    1.  'metadata': An object containing the title, description, category, etc.
    2.  'componentCode': A string containing the complete, working React functional component code (using React.createElement, no imports, no JSX).
    3.  'colorScheme': An object defining the color palette for the tool.
    4.  'initialStyleMap' (IMPORTANT): An object mapping 'data-style-id' attributes from your 'componentCode' to their initial Tailwind CSS class strings.
    
    🚨 CRITICAL: ID AND SLUG GENERATION REQUIREMENTS:
    - The 'id' field must be a unique identifier like "tool-roi-calculator-001" or "tool-lead-qualifier-002"
    - The 'slug' field must be a URL-friendly version like "roi-calculator" or "lead-qualifier"
    - NEVER use "undefined" in any part of the id or slug
    - Base the id/slug on the actual tool purpose and type
    - Use kebab-case format for slugs (lowercase with hyphens)
    - Ensure both metadata.id and metadata.slug match the main id and slug fields
</output-format>

<component-code-requirements>
    <structure>
        - Generate a complete, working React functional component 
        - Include 'use client'; at the top
        - DO NOT USE ANY IMPORT STATEMENTS - all dependencies are provided via context
        - Use React.createElement() syntax instead of JSX
        - Use React hooks (useState, useEffect) for state management
        - Function name should be descriptive PascalCase
        - CRITICAL FOR STYLING: Add 'data-style-id' attributes for dynamic styling
        - 🚨 DO NOT use Card, CardHeader, CardContent, CardTitle components!
    </structure>
    
    <available-context-variables>
        The following are available in the execution context (do NOT import them):
        - React (includes React.createElement)
        - useState, useEffect, useCallback, useMemo
        - Button, Input, Label
        - Loader2, AlertCircle (for icons)
    </available-context-variables>
</component-code-requirements>`;

// ============================================================================
// PROMPT BUILDER WITH CONDITIONAL SECTIONS
// ============================================================================

export interface PromptOptions {
  includeComprehensiveColors?: boolean;
  includeGorgeousStyling?: boolean;
  includeAdvancedLayouts?: boolean;
  styleComplexity?: 'basic' | 'enhanced' | 'premium';
  industryFocus?: string;
  toolComplexity?: 'simple' | 'moderate' | 'complex';
}

export function buildToolCreationSystemPrompt(options: PromptOptions = {}): string {
  const {
    includeComprehensiveColors = false,
    includeGorgeousStyling = false,
    includeAdvancedLayouts = false,
    styleComplexity = 'basic',
    industryFocus,
    toolComplexity = 'moderate'
  } = options;

  let prompt = CORE_PROMPT;

  // Add conditional color guidance
  if (includeComprehensiveColors || styleComplexity === 'premium') {
    prompt += STYLE_GUIDES.COMPREHENSIVE_COLOR_SCHEMES;
  } else {
    prompt += STYLE_GUIDES.BASIC_COLOR_GUIDANCE;
  }

  // Add styling guidance based on complexity
  if (includeGorgeousStyling || styleComplexity === 'premium') {
    prompt += STYLE_GUIDES.GORGEOUS_STYLING_LIBRARY;
  }

  // Add layout guidance for complex tools
  if (includeAdvancedLayouts || toolComplexity === 'complex') {
    prompt += STYLE_GUIDES.ADVANCED_LAYOUT_PATTERNS;
  }

  // Add component types
  prompt += `
<component-types>
    <input-components>${ALLOWED_COMPONENTS.inputs.join(', ')}</input-components>
    <display-components>${ALLOWED_COMPONENTS.displays.join(', ')}</display-components>
    <interactive-components>${ALLOWED_COMPONENTS.interactive.join(', ')}</interactive-components>
    <chart-components>${ALLOWED_COMPONENTS.charts.join(', ')}</chart-components>
    <layout-components>${ALLOWED_COMPONENTS.layout.join(', ')}</layout-components>
</component-types>

<instructions>
    <instruction>Create tools that solve real business problems and provide genuine value to users.</instruction>
    <instruction>Focus on lead generation by naturally collecting contact information in exchange for valuable insights.</instruction>
    <instruction>Ensure all content, calculations, and styling are business-grade and professional quality.</instruction>
    <instruction>Use ONLY the allowed component types listed above - no custom types allowed.</instruction>
    <instruction>NEVER use placeholder text like "heading", "button", "label" - all labels must be specific and meaningful.</instruction>
    <instruction>Generate BOTH componentCode (React component string) AND the traditional schema structure.</instruction>
</instructions>`;

  return prompt;
}

// User prompt builder (same as before)
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

// Smart prompt selector based on context
export function getToolCreationSystemPrompt(context?: any): string {
  if (!context) {
    return buildToolCreationSystemPrompt();
  }

  const options: PromptOptions = {
    includeComprehensiveColors: context.needsCustomColors || context.industry === 'healthcare' || context.industry === 'finance',
    includeGorgeousStyling: context.isPremiumTool || context.styleComplexity === 'premium',
    includeAdvancedLayouts: context.isComplexTool || context.toolComplexity === 'complex',
    styleComplexity: context.styleComplexity || 'basic',
    industryFocus: context.industry,
    toolComplexity: context.toolComplexity || 'moderate'
  };

  return buildToolCreationSystemPrompt(options);
} 