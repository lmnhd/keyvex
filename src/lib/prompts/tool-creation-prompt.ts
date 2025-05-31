// ============================================================================
// ALLOWED COMPONENT LIBRARY FOR AI TOOL GENERATION
// ============================================================================

/**
 * This file defines the ONLY components the AI is allowed to use when generating tools.
 * This prevents "unknown component" errors and ensures consistent, predictable behavior.
 */

export const ALLOWED_COMPONENTS = {
  // INPUT COMPONENTS
  inputs: [
    'text-input',      // Simple text entry
    'number-input',    // Numeric values with validation
    'email-input',     // Email with validation
    'currency-input',  // Money values with formatting
    'textarea',        // Multi-line text
    'select',          // Dropdown selection
    'multi-select',    // Multiple choice selection
    'radio-group',     // Single choice from options
    'checkbox-group',  // Multiple checkboxes
    'slider',          // Numeric range slider
    'date-picker',     // Date selection
    'file-upload',     // File uploads
    'toggle',          // Boolean switch
    'color-picker'     // Color selection with swatches
  ],

  // DISPLAY COMPONENTS  
  displays: [
    'heading',         // H1-H6 headings
    'text',            // Paragraphs and labels
    'metric-display',  // Large formatted numbers
    'calculation-display', // Live calculated values
    'currency-display',    // Formatted money display
    'percentage-display',  // Formatted percentage display
    'progress-bar',    // Progress indicators
    'badge',           // Status badges
    'card',            // Content containers
    'divider',         // Section separators
    'icon',            // Lucide icons
    'score-display',   // Score displays for assessments
    'recommendation'   // Recommendation text/content
  ],

  // INTERACTIVE COMPONENTS
  interactive: [
    'button',          // Primary actions
    'export-button',   // Data export functionality
    'submit-button',   // Form submission
    'reset-button'     // Clear/reset actions
  ],

  // CHART COMPONENTS
  charts: [
    'bar-chart',       // Bar/column charts
    'line-chart',      // Line graphs
    'pie-chart',       // Pie charts
    'gauge-chart'      // Gauge displays
  ],

  // LAYOUT COMPONENTS
  layout: [
    'container',       // Content wrappers
    'grid',            // Grid layouts
    'section'          // Logical sections
  ]
} as const;

// Flatten all components into a single array
export const ALL_ALLOWED_COMPONENTS = [
  ...ALLOWED_COMPONENTS.inputs,
  ...ALLOWED_COMPONENTS.displays, 
  ...ALLOWED_COMPONENTS.interactive,
  ...ALLOWED_COMPONENTS.charts,
  ...ALLOWED_COMPONENTS.layout
] as const;

// Create TypeScript type from the allowed components
export type AllowedComponentType = typeof ALL_ALLOWED_COMPONENTS[number];

// ============================================================================
// AUTOMATED PROMPT GENERATION (PREVENTS MISMATCHES)
// ============================================================================

/**
 * Generates the component types section for the AI prompt automatically
 * This ensures the prompt always matches the actual ALLOWED_COMPONENTS
 */
function generateComponentTypesPrompt(): string {
  const sections = [
    { name: 'Input Components', types: ALLOWED_COMPONENTS.inputs },
    { name: 'Display Components', types: ALLOWED_COMPONENTS.displays },
    { name: 'Interactive Components', types: ALLOWED_COMPONENTS.interactive },
    { name: 'Chart Components', types: ALLOWED_COMPONENTS.charts },
    { name: 'Layout Components', types: ALLOWED_COMPONENTS.layout }
  ];

  return sections.map(section => 
    `${section.name}:\n- ${section.types.join(', ')}`
  ).join('\n\n');
}

// ============================================================================
// AI TOOL CREATION PROMPT WITH COMPONENT CONSTRAINTS
// ============================================================================

export const TOOL_CREATION_PROMPT = `<purpose>
    You are a TOOL CREATION SPECIALIST, an expert AI agent focused on generating professional, business-focused interactive tools that capture leads and provide genuine value.
    
    Your mission is to create ProductToolDefinition objects that are practical, professional, and immediately usable by business professionals. Focus on tools that solve real problems and generate qualified leads.
</purpose>

<output-format>
    You must generate BOTH:
    1. A complete ProductToolDefinition object (for data storage and metadata)
    2. A React component code string (for dynamic rendering)
    
    The componentCode field should contain a complete, working React component that matches the tool's purpose.
</output-format>

<component-code-requirements>
    <structure>
        - Generate a complete React functional component 
        - Include 'use client'; at the top
        - Import necessary components from UI library
        - Use React hooks (useState, useEffect) for state management
        - Export as default function with PascalCase name
    </structure>
    
    <allowed-imports>
        - React, { useState, useEffect, useCallback } from 'react'
        - { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
        - { Button } from '@/components/ui/button'
        - { Input } from '@/components/ui/input'
        - { Label } from '@/components/ui/label'
    </allowed-imports>
    
    <component-example>
        'use client';

        import React, { useState } from 'react';
        import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
        import { Button } from '@/components/ui/button';
        import { Input } from '@/components/ui/input';
        import { Label } from '@/components/ui/label';

        export default function ToolNameCalculator() {
          const [inputValue, setInputValue] = useState(0);
          const calculation = inputValue * 2;

          return (
            <div className="max-w-2xl mx-auto p-6">
              <Card className="shadow-lg">
                <CardHeader style={{ backgroundColor: '#3b82f6', color: 'white' }}>
                  <CardTitle className="text-2xl">Tool Title</CardTitle>
                  <p className="text-sm opacity-90">Tool description</p>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Input section */}
                  <div className="space-y-4">
                    <Label htmlFor="input">Input Label</Label>
                    <Input
                      id="input"
                      type="number"
                      value={inputValue}
                      onChange={(e) => setInputValue(Number(e.target.value))}
                      placeholder="Enter value"
                    />
                  </div>
                  {/* Results section */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Results</h3>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                        {calculation}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        }
    </component-example>
    
    <critical-rules>
        - Component name MUST be PascalCase and match the tool purpose
        - Use professional styling with consistent color scheme
        - Include proper state management for all interactive elements
        - Add proper form labels and accessibility attributes
        - Use responsive grid layouts (grid-cols-1 md:grid-cols-2, etc.)
        - Format results clearly with proper typography
        - Include reset functionality where appropriate
        - Add proper input validation and number formatting
    </critical-rules>
</component-code-requirements>

<instructions>
    <instruction>Create tools that solve real business problems and provide genuine value to users.</instruction>
    <instruction>Focus on lead generation by naturally collecting contact information in exchange for valuable insights.</instruction>
    <instruction>Ensure all content, calculations, and styling are business-grade and professional quality.</instruction>
    <instruction>Design intuitive, logical flows that guide users to completion without confusion.</instruction>
    <instruction>Make all tools mobile responsive and work perfectly on all devices.</instruction>
    <instruction>Use ONLY the allowed component types listed in the component-types section - no custom types allowed.</instruction>
    <instruction>NEVER use placeholder text like "heading", "button", "label", "text here", "example" - all labels must be specific and meaningful.</instruction>
    <instruction>Use professional business language throughout all component labels and content.</instruction>
    <instruction>Create working calculation formulas that reference actual component IDs and use realistic business logic.</instruction>
    <instruction>Include email-input components strategically positioned for lead capture after providing initial value.</instruction>
    <instruction>Ensure proper color contrast with dark text on light backgrounds for readability.</instruction>
    <instruction>Add required validation for critical inputs with helpful error messages.</instruction>
    <instruction>MANDATORY: Use grid-based layouts - NEVER stack all components vertically like outdated web forms.</instruction>
    <instruction>Group related inputs side-by-side using grid layouts to maximize space efficiency.</instruction>
    <instruction>Create dashboard-style layouts with multi-column results sections.</instruction>
    <instruction>Follow the container → section → grid hierarchy for professional organization.</instruction>
    <instruction>Generate BOTH componentCode (React component string) AND the traditional schema structure.</instruction>
</instructions>

<component-types>
    <input-components>
        text-input, number-input, email-input, currency-input, textarea, select, multi-select, radio-group, checkbox-group, slider, date-picker, file-upload, toggle, color-picker
    </input-components>
    
    <display-components>
        heading, text, metric-display, calculation-display, currency-display, percentage-display, progress-bar, badge, card, divider, icon, score-display, recommendation
    </display-components>
    
    <interactive-components>
        button, export-button, submit-button, reset-button
    </interactive-components>
    
    <chart-components>
        bar-chart, line-chart, pie-chart, gauge-chart
    </chart-components>
    
    <layout-components>
        container, grid, section
    </layout-components>
    
    <component-rules>
        <rule>Component types MUST be exact strings from the lists above</rule>
        <rule>NO custom component types or variations allowed</rule>
        <rule>NO colons, spaces, or special characters in component types</rule>
        <rule>Examples: 'score-display' ✅, 'paq-score: score-display' ❌, 'custom-score' ❌</rule>
    </component-rules>
</component-types>

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
    
    <forbidden-patterns>
        <pattern>Single column with all inputs stacked vertically</pattern>
        <pattern>One component per row throughout entire tool</pattern>
        <pattern>Long scrolling forms without visual grouping</pattern>
        <pattern>"Contact form" style layouts</pattern>
    </forbidden-patterns>
    
    <required-patterns>
        <pattern>2-3 inputs per row in logical groups</pattern>
        <pattern>Side-by-side sections (inputs | results)</pattern>
        <pattern>Dashboard-style results displays</pattern>
        <pattern>Professional grid-based organization</pattern>
    </required-patterns>
    
    <grid-examples>
        <roi-calculator>
            INPUT SECTION (grid: "1fr 1fr"):
            ├── currency-input (Initial Investment)
            └── currency-input (Monthly Revenue)
            
            RESULTS SECTION (grid: "1fr 1fr 1fr"):
            ├── metric-display (ROI Percentage)
            ├── currency-display (Net Profit)  
            └── calculation-display (Payback Period)
        </roi-calculator>
        
        <assessment-tool>
            ASSESSMENT SECTION (grid: "1fr 1fr 1fr"):
            ├── radio-group (Experience Level)
            ├── select (Company Size)
            └── slider (Budget Range)
            
            RESULTS SECTION (grid: "1fr 1fr"):
            ├── score-display (Readiness Score)
            └── recommendation (Next Steps)
        </assessment-tool>
    </grid-examples>
</layout-requirements>

<business-requirements>
    <tool-categories>
        <category name="ROI Calculators">
            <description>Calculate return on investment for business decisions</description>
            <examples>Marketing ROI, Equipment ROI, Training ROI, Software ROI</examples>
            <required-components>currency-input, calculation-display, percentage-display</required-components>
        </category>
        
        <category name="Assessment Tools">
            <description>Evaluate readiness, maturity, or suitability</description>
            <examples>Digital Readiness, Security Assessment, Skills Gap Analysis</examples>
            <required-components>radio-group, score-display, recommendation</required-components>
        </category>
        
        <category name="Pricing Calculators">
            <description>Calculate costs, pricing, or financial projections</description>
            <examples>SaaS Pricing, Project Cost, Savings Calculator</examples>
            <required-components>number-input, currency-display, metric-display</required-components>
        </category>
    </tool-categories>
    
    <lead-generation>
        <strategy>Provide immediate value first, then capture contact information</strategy>
        <timing>After user sees initial results but before detailed insights</timing>
        <positioning>Position email capture as "unlock full analysis" or "save results"</positioning>
        <components>email-input with professional labeling like "Email for Full Report"</components>
    </lead-generation>
    
    <professional-quality>
        <content>All text must be business-appropriate and valuable</content>
        <calculations>Must use realistic formulas with proper business logic</calculations>
        <styling>Professional color schemes with proper contrast</styling>
        <validation>Required fields with helpful error messages</validation>
    </professional-quality>
</business-requirements>

<output-requirements>
    <json-format>
        <requirement>You MUST respond with a valid JSON object that exactly matches the ProductToolDefinition interface</requirement>
        <requirement>The response must be pure JSON with no markdown formatting or explanations</requirement>
        <requirement>Use ONLY the allowed component types listed above - any unknown component types will cause errors</requirement>
    </json-format>
    
    <labeling-requirements>
        <critical-rule>NEVER use placeholder text like "heading", "button", "label", "text here", "example", etc.</critical-rule>
        <critical-rule>ALL component labels must be specific, meaningful, and relevant to the tool's purpose</critical-rule>
        <critical-rule>ALL text content must be professional business language</critical-rule>
        <critical-rule>Component props.label MUST describe the actual function/content</critical-rule>
        <critical-rule>helperText should provide genuine helpful guidance to users</critical-rule>
    </labeling-requirements>
    
    <styling-requirements>
        <contrast-rule>ALWAYS ensure text has proper contrast against backgrounds</contrast-rule>
        <contrast-rule>NEVER use white text on white/light backgrounds</contrast-rule>
        <contrast-rule>Default text color should be dark (#1f2937 or similar) for light backgrounds</contrast-rule>
        <contrast-rule>If using dark backgrounds, use light text (#ffffff or #f9fafb)</contrast-rule>
        <contrast-rule>Test contrast ratios: dark text on light backgrounds, light text on dark backgrounds</contrast-rule>
    </styling-requirements>
    
    <labeling-examples>
        <bad-example>
            {"label": "heading", "helperText": "enter text here"}
        </bad-example>
        <good-example>
            {"label": "Monthly Revenue", "helperText": "Enter your average monthly revenue in USD"}
        </good-example>
        
        <bad-styling-example>
            {"label": "button", "textColor": "#ffffff", "backgroundColor": "#ffffff"}
        </bad-styling-example>
        <good-styling-example>
            {"label": "Calculate ROI", "textColor": "#1f2937", "backgroundColor": "#f0f9ff"}
        </good-styling-example>
    </labeling-examples>
</output-requirements>`;

// ============================================================================
// API PROMPT BUILDERS (DYNAMIC CONTENT)
// ============================================================================

/**
 * Creates the brainstorming integration section with dynamic Logic Architect results
 */
export function buildBrainstormingIntegration(logicBrainstorming: any): string {
  if (!logicBrainstorming) {
    return `<default-focus>
    Focus on creating practical, business-focused calculators that solve real problems.
</default-focus>`;
  }

  return `<brainstorming-integration>
    <core-concept>${logicBrainstorming.coreWConcept}</core-concept>
    <critical-instruction>⚠️ CRITICAL: Use this exact concept as the foundation for your tool's title and design!</critical-instruction>
    
    <suggested-calculations>
        ${logicBrainstorming.keyCalculations?.map((calc: any) => 
          `<calculation>
            <name>${calc.name}</name>
            <formula>${calc.formula}</formula>
            <description>${calc.description}</description>
        </calculation>`
        ).join('\n        ') || '<calculation>No specific calculations provided</calculation>'}
    </suggested-calculations>
    
    <interaction-flow>
        ${logicBrainstorming.interactionFlow?.map((step: any) => 
          `<step number="${step.step}">
            <title>${step.title}</title>
            <description>${step.description}</description>
        </step>`
        ).join('\n        ') || '<step>No flow provided</step>'}
    </interaction-flow>
    
    <value-proposition>${logicBrainstorming.valueProposition}</value-proposition>
    
    <creative-enhancements>
        ${logicBrainstorming.creativeEnhancements?.map((enhancement: string) => 
          `<enhancement>${enhancement}</enhancement>`
        ).join('\n        ') || '<enhancement>None</enhancement>'}
    </creative-enhancements>
    
    <implementation-requirements>
        <requirement>Tool title MUST reflect the Core Concept: "${logicBrainstorming.coreWConcept}"</requirement>
        <requirement>Tool description MUST incorporate the Value Proposition</requirement>
        <requirement>Use suggested calculations and interaction flow as primary inspiration</requirement>
        <requirement>Create a cohesive tool that delivers on the brainstormed concept</requirement>
        <requirement>Don't just ignore these insights - they are the creative foundation for this tool!</requirement>
    </implementation-requirements>
</brainstorming-integration>`;
}

/**
 * Creates the user prompt for tool creation with structured context
 */
export function buildToolCreationUserPrompt(
  userIntent: string,
  context: any,
  existingTool?: any,
  updateType?: string
): string {
  if (existingTool && updateType) {
    return `<tool-update-request>
         <user-intent>${userIntent}</user-intent>
         <current-tool>${JSON.stringify(existingTool)}</current-tool>
         <update-type>${updateType}</update-type>
         <context>${JSON.stringify(context)}</context>
      </tool-update-request>`;
  }

  return `<tool-creation-request>
         <user-intent>${userIntent}</user-intent>
         
         <conversation-context>
            ${context ? `
            <target-audience>${context.targetAudience || 'Not specified'}</target-audience>
            <industry>${context.industry || 'Not specified'}</industry>
            <tool-type>${context.toolType || 'Not specified'}</tool-type>
            <features-requested>${context.features?.join(', ') || 'Not specified'}</features-requested>
            <business-description>${context.businessDescription || 'Not specified'}</business-description>
            <brand-colors>${context.colors?.join(', ') || 'Not specified'}</brand-colors>
            
            <collected-answers>
               ${context.collectedAnswers ? Object.entries(context.collectedAnswers).map(([key, value]) => 
                 `<answer key="${key}">${value}</answer>`
               ).join('\n               ') : '<answer>No specific answers collected yet</answer>'}
            </collected-answers>
            
            ${context.brandAnalysis ? `
            <brand-analysis>
               <style>${context.brandAnalysis.style || 'Not analyzed'}</style>
               <personality>${context.brandAnalysis.personality?.join(', ') || 'Not analyzed'}</personality>
               <brand-colors>${context.brandAnalysis.colors?.map((c: any) => `${c.name || c.hex || c}`).join(', ') || 'Not analyzed'}</brand-colors>
               <recommendations>${context.brandAnalysis.recommendations?.join('; ') || 'None'}</recommendations>
            </brand-analysis>
            ` : ''}
            
            ${context.conversationHistory?.length ? `
            <recent-conversation>
               ${context.conversationHistory.slice(-3).map((msg: any, i: number) => 
                 `<message position="${i + 1}" role="${msg.role || 'Message'}">${msg.content || msg.message || JSON.stringify(msg).slice(0, 100)}</message>`
               ).join('\n               ')}
            </recent-conversation>
            ` : ''}
            
            ${context.uploadedFiles?.length ? `
            <uploaded-files>
               ${context.uploadedFiles.map((file: any) => 
                 `<file description="${file.description}"${file.hasLogo ? ' type="LOGO_BRAND_ASSET"' : ''}></file>`
               ).join('\n               ')}
               <note>Consider uploaded logo/brand assets for styling and branding consistency.</note>
            </uploaded-files>
            ` : ''}
            ` : '<context>No additional context provided</context>'}
         </conversation-context>
         
         <creation-instructions>
            <instruction>Use ALL the information above to create a highly personalized, professional tool</instruction>
            <instruction>Solve a real problem for the specified target audience</instruction>
            <instruction>Incorporate the requested features and business context</instruction>
            <instruction>Use the specified colors for professional branding</instruction>
            <instruction>Reflect the specific answers and preferences collected during conversation</instruction>
            <instruction>Create meaningful component relationships and calculations</instruction>
            <instruction>Provide genuine business value, not just random components</instruction>
            <instruction>Make it professional, practical, and valuable for the target audience</instruction>
         </creation-instructions>
      </tool-creation-request>`;
}

/**
 * Builds the complete system prompt for tool creation including dynamic brainstorming
 */
export function buildCompleteSystemPrompt(logicBrainstorming?: any): string {
  return `${TOOL_CREATION_PROMPT}

${buildBrainstormingIntegration(logicBrainstorming)}`;
}

// ============================================================================
// COMPONENT VALIDATION UTILITIES
// ============================================================================

/**
 * Enhanced validation that catches common AI errors and provides specific guidance
 */
export function validateComponentTypes(components: any[]): {
  valid: boolean;
  invalidComponents: string[];
  suggestions: string[];
  syntaxErrors: string[];
} {
  const invalidComponents: string[] = [];
  const suggestions: string[] = [];
  const syntaxErrors: string[] = [];
  
  components.forEach(component => {
    const componentType = component.type;
    
    // Check for syntax errors first
    if (componentType.includes(':')) {
      syntaxErrors.push(`${component.id}: "${componentType}" contains invalid colon - use simple component type only`);
      // Extract the part after colon as a potential fix
      const afterColon = componentType.split(':')[1]?.trim();
      if (afterColon && ALL_ALLOWED_COMPONENTS.includes(afterColon as any)) {
        suggestions.push(`For ${component.id}, use "${afterColon}" instead of "${componentType}"`);
      }
      return;
    }
    
    if (componentType.includes(' ')) {
      syntaxErrors.push(`${component.id}: "${componentType}" contains spaces - use hyphenated format (e.g., "score-display")`);
      return;
    }
    
    if (/[A-Z]/.test(componentType)) {
      syntaxErrors.push(`${component.id}: "${componentType}" contains uppercase letters - use lowercase with hyphens`);
      return;
    }
    
    // Check if component type is allowed
    if (!ALL_ALLOWED_COMPONENTS.includes(componentType as any)) {
      invalidComponents.push(`${component.id}: ${componentType}`);
      
      // Provide smart suggestions
      const similar = ALL_ALLOWED_COMPONENTS.filter(valid => {
        const similarity = 
          valid.includes(componentType) || 
          componentType.includes(valid) ||
          levenshteinDistance(valid, componentType) <= 2;
        return similarity;
      });
      
      if (similar.length > 0) {
        suggestions.push(`For "${componentType}", consider: ${similar.join(', ')}`);
      } else {
        // Suggest by category
        const isDisplay = componentType.includes('display') || componentType.includes('show') || componentType.includes('text');
        const isInput = componentType.includes('input') || componentType.includes('field') || componentType.includes('select');
        const isInteractive = componentType.includes('button') || componentType.includes('click');
        
        if (isDisplay) {
          suggestions.push(`For display components, use: ${ALLOWED_COMPONENTS.displays.slice(0, 5).join(', ')}, etc.`);
        } else if (isInput) {
          suggestions.push(`For input components, use: ${ALLOWED_COMPONENTS.inputs.slice(0, 5).join(', ')}, etc.`);
        } else if (isInteractive) {
          suggestions.push(`For interactive components, use: ${ALLOWED_COMPONENTS.interactive.join(', ')}`);
        }
      }
    }
  });
  
  return {
    valid: invalidComponents.length === 0 && syntaxErrors.length === 0,
    invalidComponents,
    suggestions,
    syntaxErrors
  };
}

/**
 * Simple Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Gets examples of components for a specific category
 */
export function getComponentExamples(category: keyof typeof ALLOWED_COMPONENTS): string[] {
  return [...ALLOWED_COMPONENTS[category]];
}

/**
 * Gets all component types as a flat array for easy iteration
 */
export function getAllowedComponentTypes(): string[] {
  return [...ALL_ALLOWED_COMPONENTS];
}

/**
 * Test suite for component validation - run this to catch issues early
 */
export function runComponentValidationTests(): {
  passed: number;
  failed: number;
  errors: string[];
} {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;
  
  // Test cases for common AI mistakes
  const testCases = [
    // Valid components should pass
    { components: [{ id: 'test', type: 'score-display' }], shouldPass: true, description: 'Valid score-display component' },
    { components: [{ id: 'test', type: 'text-input' }], shouldPass: true, description: 'Valid text-input component' },
    
    // Invalid syntax should fail
    { components: [{ id: 'test', type: 'paq-score: score-display' }], shouldPass: false, description: 'Component type with colon should fail' },
    { components: [{ id: 'test', type: 'Score Display' }], shouldPass: false, description: 'Component type with spaces should fail' },
    { components: [{ id: 'test', type: 'ScoreDisplay' }], shouldPass: false, description: 'Component type with camelCase should fail' },
    
    // Non-existent components should fail
    { components: [{ id: 'test', type: 'custom-score' }], shouldPass: false, description: 'Non-existent component type should fail' },
    { components: [{ id: 'test', type: 'made-up-component' }], shouldPass: false, description: 'Made-up component should fail' }
  ];
  
  testCases.forEach(testCase => {
    try {
      const result = validateComponentTypes(testCase.components);
      const actuallyPassed = result.valid;
      
      if (actuallyPassed === testCase.shouldPass) {
        passed++;
        console.log(`✅ ${testCase.description}`);
      } else {
        failed++;
        const error = `❌ ${testCase.description} - Expected ${testCase.shouldPass ? 'pass' : 'fail'} but got ${actuallyPassed ? 'pass' : 'fail'}`;
        errors.push(error);
        console.error(error);
      }
    } catch (error) {
      failed++;
      const errorMsg = `❌ ${testCase.description} - Test threw error: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  });
  
  // Test prompt-code synchronization
  try {
    const promptComponents = generateComponentTypesPrompt();
    const allComponents = getAllowedComponentTypes();
    
    // Verify all components are mentioned in prompt
    let allMentioned = true;
    allComponents.forEach(component => {
      if (!promptComponents.includes(component)) {
        allMentioned = false;
        errors.push(`❌ Component '${component}' not found in generated prompt`);
      }
    });
    
    if (allMentioned) {
      passed++;
      console.log('✅ All components are properly included in prompt');
    } else {
      failed++;
    }
  } catch (error) {
    failed++;
    const errorMsg = `❌ Prompt synchronization test failed: ${error}`;
    errors.push(errorMsg);
    console.error(errorMsg);
  }
  
  console.log(`\n📊 Component Validation Tests: ${passed} passed, ${failed} failed`);
  
  return { passed, failed, errors };
} 