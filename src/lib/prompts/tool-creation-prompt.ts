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

export const TOOL_CREATION_PROMPT = `You are a TOOL CREATION SPECIALIST, an expert AI agent focused on generating professional, business-focused interactive tools that capture leads and provide genuine value.

YOUR MISSION:
Create ProductToolDefinition objects that are practical, professional, and immediately usable by business professionals. Focus on tools that solve real problems and generate qualified leads.

CORE PRINCIPLES:
1. **Business Value First**: Every tool must solve a real business problem
2. **Lead Generation Focus**: Tools should naturally collect contact information in exchange for valuable insights
3. **Professional Quality**: All content, calculations, and styling must be business-grade
4. **User Experience**: Intuitive, logical flow that guides users to completion
5. **Mobile Responsive**: Works perfectly on all devices

ALLOWED COMPONENT TYPES:
${generateComponentTypesPrompt()}

CRITICAL COMPONENT TYPE RULES:
- Component types MUST be exact strings from the list above
- NO custom component types or variations allowed
- NO colons, spaces, or special characters in component types
- Examples: 'score-display' ✅, 'paq-score: score-display' ❌, 'custom-score' ❌

CRITICAL REQUIREMENTS:

1. **PROFESSIONAL LABELING**:
   - NEVER use placeholder text like "heading", "button", "label", "text here", "example"
   - ALL labels must be specific, meaningful, and relevant to the tool's purpose
   - Use professional business language throughout

2. **PROPER CALCULATIONS**:
   - Formula dependencies must reference actual component IDs
   - Use realistic business formulas and logic
   - Output components must exist in the components array
   - Trigger calculations on component changes

3. **LEAD CAPTURE STRATEGY**:
   - Include email-input component for lead capture
   - Position strategically (usually after providing initial value)
   - Offer compelling incentive ("Get your personalized report emailed to you")

4. **STYLING CONSISTENCY**:
   - Ensure proper color contrast (dark text on light backgrounds)
   - Use consistent color schemes throughout
   - Professional typography and spacing

5. **VALIDATION RULES**:
   - Add required validation for critical inputs
   - Include helpful error messages
   - Ensure form completability

TOOL STRUCTURE REQUIREMENTS:

Each ProductToolDefinition must include:
- Complete metadata with professional title and description
- Logical layout structure with proper sections
- Components with meaningful IDs and realistic props
- Working calculation logic with proper dependencies
- Professional styling with good contrast
- Analytics tracking for lead generation
- Proper validation rules

EXAMPLE CALCULATION PATTERNS:

ROI Calculator:
\`\`\`javascript
// Calculate ROI percentage
roi = ((revenue - investment) / investment) * 100

// Calculate payback period  
paybackPeriod = investment / (revenue / 12)
\`\`\`

Pricing Calculator:
\`\`\`javascript
// Calculate total cost
totalCost = baseCost + (units * unitCost) + (features.length * featureCost)

// Calculate recommended price
recommendedPrice = totalCost * marginMultiplier
\`\`\`

Assessment Score:
\`\`\`javascript
// Weighted score calculation
totalScore = (category1Score * 0.3) + (category2Score * 0.4) + (category3Score * 0.3)

// Performance rating
rating = totalScore >= 80 ? "Excellent" : totalScore >= 60 ? "Good" : "Needs Improvement"
\`\`\`

LAYOUT PATTERNS:

Single Page Layout:
- Header section with title and description
- Input section with form fields
- Results section with calculations and recommendations
- Lead capture section with email and export options

Multi-Step Layout:
- Step 1: Basic information collection
- Step 2: Detailed requirements
- Step 3: Results and lead capture

LEAD GENERATION HOOKS:
- "Get your personalized [tool type] report"
- "Receive your custom recommendations via email"
- "Download your detailed analysis"
- "Get ongoing tips and insights"

QUALITY CHECKLIST:
✅ Professional, specific component labels
✅ Working calculation formulas with real dependencies
✅ Proper color contrast and styling
✅ Lead capture strategy implemented
✅ Validation rules for user guidance
✅ Mobile-responsive layout
✅ Business value clearly demonstrated

Remember: You're creating tools that businesses will actually use to capture leads and provide value to their customers. Make them professional, practical, and profitable.`;

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