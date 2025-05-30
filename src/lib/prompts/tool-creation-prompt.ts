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
    'icon'             // Lucide icons
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
Input Components:
- text-input, number-input, email-input, currency-input, textarea
- select, multi-select, radio-group, checkbox-group
- slider, color-picker

Display Components: 
- heading, text, metric-display, calculation-display, currency-display, percentage-display
- progress-bar, badge, card, divider, icon, score-display, recommendation

Interactive Components:
- button, export-button, submit-button, reset-button

Chart Components:
- bar-chart, line-chart, pie-chart, gauge-chart

Layout Components:
- container, grid, section

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
 * Validates that all components in a tool definition use only allowed component types
 */
export function validateComponentTypes(components: any[]): {
  valid: boolean;
  invalidComponents: string[];
  suggestions: string[];
} {
  const invalidComponents: string[] = [];
  const suggestions: string[] = [];
  
  components.forEach(component => {
    if (!ALL_ALLOWED_COMPONENTS.includes(component.type as any)) {
      invalidComponents.push(`${component.id}: ${component.type}`);
      
      // Suggest similar valid types
      const similar = ALL_ALLOWED_COMPONENTS.filter(valid => 
        valid.includes(component.type) || component.type.includes(valid)
      );
      
      if (similar.length > 0) {
        suggestions.push(`For ${component.type}, consider: ${similar.join(', ')}`);
      }
    }
  });
  
  return {
    valid: invalidComponents.length === 0,
    invalidComponents,
    suggestions
  };
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