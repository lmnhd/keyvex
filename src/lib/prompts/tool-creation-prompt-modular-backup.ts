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
    <critical-mandates>
        <mandate>🎨 VISUAL APPEAL IS PARAMOUNT - Tools MUST look professional, modern, and engaging</mandate>
        <mandate>✨ PREMIUM AESTHETICS - Aim for designs that reflect high quality and user trust</mandate>
        <mandate>📱 RESPONSIVE DESIGN - Ensure layouts adapt gracefully to all screen sizes (mobile, tablet, desktop)</mandate>
    </critical-mandates>
    
    <color-palette-guidelines>
        <option value="professional-blue">Professional Blue (Corporate, Finance, Tech)</option>
        <option value="vibrant-orange">Vibrant Orange (Marketing, Creative, Startups)</option>
        <option value="eco-green">Eco Green (Sustainability, Health, Nature)</option>
        <option value="luxury-purple">Luxury Purple (High-end, Premium, Sophisticated)</option>
        <option value="medical-blue-white">Medical Blue/White (Healthcare, Wellness, Cleanliness)</option>
        <option value="financial-blue-gold">Financial Blue/Gold (Banking, Investment, Wealth)</option>
        <option value="foodie-orange-brown">Foodie Orange/Brown (Restaurants, Culinary, Food Tech)</option>
        <option value="fitness-lime-gray">Fitness Lime/Gray (Fitness, Sports, Active Lifestyle)</option>
        <option value="realestate-teal-beige">Real Estate Teal/Beige (Property, Housing, Development)</option>
        <option value="environmental-green-brown">Environmental Green/Brown (Eco-friendly, Conservation, Outdoors)</option>
        
        Always provide a complete colorScheme object like:
        colorScheme: {
            primary: '#HEXVALUE', // e.g. #3b82f6 (blue-600)
            secondary: '#HEXVALUE', // e.g. #10b981 (emerald-500)
            accent: '#HEXVALUE', // e.g. #f97316 (orange-500)
            background: '#HEXVALUE', // e.g. #f3f4f6 (gray-100) - Page background
            textPrimary: '#HEXVALUE', // e.g. #1f2937 (gray-800) - Main text color
            textSecondary: '#HEXVALUE', // e.g. #6b7281 (gray-500) - Subdued text
            cardBackground: '#HEXVALUE', // e.g. #ffffff (white) - Card component background
            buttonText: '#HEXVALUE' // e.g. #ffffff (white) - Text on primary buttons
        }
    </color-palette-guidelines>
    
    <tailwind-css-mastery>
        Leverage Tailwind CSS for all styling. Use descriptive class names.
        - Spacing: m-2, p-4, space-x-2, space-y-4
        - Typography: text-lg, font-semibold, text-gray-700
        - Borders: border, border-blue-500, rounded-lg
        - Shadows: shadow-md, shadow-xl
        - Layout: flex, grid, items-center, justify-between
        - Gradients: bg-gradient-to-r from-blue-500 to-indigo-600
    </tailwind-css-mastery>
    
    <mandatory-style-rules>
        🚨 CRITICAL REQUIREMENT: initialStyleMap is MANDATORY and must contain ALL data-style-id mappings
        - Every data-style-id in your componentCode MUST have a corresponding entry in initialStyleMap
        - initialStyleMap cannot be empty {} - it must contain actual style mappings
        - For ShadCN Card Components: When using React.createElement(Card, ...), ensure its corresponding data-style-id in initialStyleMap includes at least 'bg-card text-card-foreground shadow-md rounded-lg p-4 md:p-6' (or similar). This provides a default background, text color, shadow, rounded corners, and padding for cards. Specific cards (like a header card) can then ADD to or override these defaults (e.g., a gradient background for a header card).
    </mandatory-style-rules>

    <enhanced-component-example>
        // VIBRANT, MODERN STYLING PATTERNS
        React.createElement('div', {
          className: 'max-w-4xl mx-auto p-8',
          'data-style-id': 'main-container',
          key: 'main-container-example'
        }, [
          // UPDATED GRADIENT HEADER with logo, title, subtitle, and info icon tooltip
          React.createElement('div', {
            className: 'bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-xl mb-8 shadow-xl flex items-center justify-between',
            'data-style-id': 'tool-header',
            key: 'tool-header-example'
          }, [
            // Logo and Title/Subtitle group
            React.createElement('div', { className: 'flex items-center space-x-4', key: 'header-left-group-example' }, [
              React.createElement('div', { 
                className: 'w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-xl font-bold text-white',
                'data-style-id': 'placeholder-logo',
                key: 'placeholder-logo-example' 
              }, 'L'), // Placeholder Logo (e.g., first letter of company or a generic symbol)
              React.createElement('div', { key: 'title-subtitle-group-example' }, [
                React.createElement('h1', {
                  className: 'text-2xl md:text-3xl font-bold',
                  'data-style-id': 'main-title',
                  key: 'main-title-example'
                }, 'Modern Business Calculator'),
                React.createElement('p', {
                  className: 'text-blue-100 text-md md:text-lg',
                  'data-style-id': 'subtitle',
                  key: 'subtitle-example'
                }, 'Professional-grade ROI analysis')
              ])
            ]),
            // INFO ICON WITH TOOLTIP (ShadCN Example)
            React.createElement(TooltipProvider, { key: 'tooltip-provider-info-example' }, [
              React.createElement(Tooltip, { key: 'tooltip-info-example' }, [
                React.createElement(TooltipTrigger, { asChild: true, key: 'tooltip-trigger-info-example' }, [
                  React.createElement(Button, { 
                    variant: 'ghost', 
                    size: 'icon', 
                    className: 'text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10 rounded-full',
                    'data-style-id': 'info-icon-button',
                    key: 'info-button-example'
                  }, [
                    React.createElement(Info, { className: 'h-6 w-6', key: 'info-icon-svg-example' }) // Info is an available icon
                  ])
                ]),
                React.createElement(TooltipContent, { side: 'bottom', align: 'end', className: 'bg-gray-800 text-white p-3 rounded-md shadow-lg max-w-xs text-sm', key: 'tooltip-content-info-example' }, [
                  React.createElement('p', { className: 'font-semibold mb-1', key: 'tooltip-title-about-example' }, 'About This Tool:'),
                  React.createElement('p', { className: 'mb-2', key: 'tooltip-description-example' }, 
                    'This tool helps you analyze Return on Investment. Populate the fields to see your potential ROI. (This is metadata.description)'
                  ),
                  React.createElement('p', { className: 'font-semibold mb-1', key: 'tooltip-title-how-to-example' }, 'How to Use:'),
                  React.createElement('p', { key: 'tooltip-instructions-example' }, 
                    '1. Enter your initial investment. 2. Input expected returns. 3. Specify the timeframe. (This is where tool usage instructions go.)'
                  )
                ])
              ])
            ])
          ]),
          
          // ENHANCED INPUT SECTION with generous spacing (ensure keys for array children)
          React.createElement('div', {
            className: 'bg-white p-8 rounded-xl border shadow-lg space-y-8',
            'data-style-id': 'input-section',
            key: 'input-section-example'
          }, [
            React.createElement('div', {
              className: 'grid grid-cols-1 md:grid-cols-2 gap-6',
              key: 'input-grid-example'
            }, [
              React.createElement('div', { key: 'input-group-1-example' }, [ // Added key
                React.createElement(Label, {
                  className: 'block text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3',
                  key: 'label-1-example'
                }, 'Initial Investment ($)'),
                React.createElement(Input, {
                  className: 'w-full h-12 px-4 text-lg font-medium text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-300',
                  placeholder: 'e.g. 50,000',
                  key: 'input-1-example'
                })
              ])
              // Add more input groups as needed, each with a unique key
            ])
          ]),
          
          // PREMIUM RESULTS SECTION (ensure keys for array children)
          React.createElement('div', {
            className: 'bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-200 shadow-xl',
            'data-style-id': 'results-section',
            key: 'results-section-example'
          }, [
            React.createElement('div', {
              className: 'text-center p-6 bg-white rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300',
              'data-style-id': 'roi-display',
              key: 'roi-display-example'
            }, [
              React.createElement('div', {
                className: 'text-4xl font-black text-blue-600 mb-2',
                key: 'roi-value-example'
              }, '247%'),
              React.createElement('div', {
                className: 'text-sm font-semibold uppercase tracking-wide text-blue-700',
                key: 'roi-label-example'
              }, 'ROI Percentage')
            ])
          ])
        ])
    </enhanced-component-example>

    <shadcn-card-with-gradient-example>
        // EXAMPLE: Professional Tool Layout Using ShadCN Cards
        // CRITICAL: When componentSet is 'shadcn', use Card components for main sections!
        
        React.createElement('div', {
          className: 'max-w-4xl mx-auto p-8',
          'data-style-id': 'main-container',
          key: 'main-container'
        }, [
          // HEADER CARD - Professional header with gradient
          React.createElement(Card, {
            className: 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white mb-8 shadow-xl border-0',
            'data-style-id': 'header-card',
            key: 'header-card'
          }, [
            React.createElement(CardContent, {
              className: 'p-6 flex items-center justify-between',
              'data-style-id': 'header-content',
              key: 'header-content'
            }, [
              React.createElement('div', { className: 'flex items-center space-x-4', key: 'header-left' }, [
                React.createElement('div', { 
                  className: 'w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-xl font-bold',
                  'data-style-id': 'logo-placeholder',
                  key: 'logo'
                }, 'B'),
                React.createElement('div', { key: 'title-group' }, [
                  React.createElement(CardTitle, {
                    className: 'text-2xl md:text-3xl font-bold text-white',
                    'data-style-id': 'main-title',
                    key: 'title'
                  }, 'Business Assessment Tool'),
                  React.createElement('p', {
                    className: 'text-blue-100 text-lg',
                    'data-style-id': 'subtitle',
                    key: 'subtitle'
                  }, 'Professional evaluation framework')
                ])
              ]),
              // Info tooltip with ShadCN components
              React.createElement(TooltipProvider, { key: 'tooltip-provider' }, [
                React.createElement(Tooltip, { key: 'tooltip' }, [
                  React.createElement(TooltipTrigger, { asChild: true, key: 'tooltip-trigger' }, [
                    React.createElement(Button, {
                      variant: 'ghost',
                      size: 'icon',
                      className: 'text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10',
                      'data-style-id': 'info-button',
                      key: 'info-btn'
                    }, [
                      React.createElement(Info, { className: 'h-6 w-6', key: 'info-icon' })
                    ])
                  ]),
                  React.createElement(TooltipContent, {
                    side: 'bottom',
                    className: 'bg-gray-800 text-white p-3 rounded-md max-w-xs',
                    key: 'tooltip-content'
                  }, [
                    React.createElement('p', { className: 'font-semibold mb-1', key: 'tooltip-title' }, 'About This Tool:'),
                    React.createElement('p', { className: 'mb-2', key: 'tooltip-desc' }, 'Comprehensive business assessment framework for strategic planning.'),
                    React.createElement('p', { className: 'font-semibold mb-1', key: 'usage-title' }, 'How to Use:'),
                    React.createElement('p', { key: 'usage-text' }, '1. Complete all assessment sections. 2. Review your scores. 3. Download your action plan.')
                  ])
                ])
              ])
            ])
          ]),
          
          // INPUT CARD - Use Card for input sections
          React.createElement(Card, {
            className: 'mb-8 shadow-lg',
            'data-style-id': 'input-card',
            key: 'input-card'
          }, [
            React.createElement(CardHeader, {
              'data-style-id': 'input-header',
              key: 'input-header'
            }, [
              React.createElement(CardTitle, {
                className: 'text-xl font-semibold text-gray-900',
                'data-style-id': 'input-title',
                key: 'input-title'
              }, 'Assessment Criteria')
            ]),
            React.createElement(CardContent, {
              className: 'space-y-6',
              'data-style-id': 'input-content',
              key: 'input-content'
            }, [
              React.createElement('div', {
                className: 'grid grid-cols-1 md:grid-cols-2 gap-6',
                key: 'input-grid'
              }, [
                React.createElement('div', { key: 'input-group-1' }, [
                  React.createElement(Label, {
                    className: 'block text-sm font-semibold text-gray-800 mb-3',
                    'data-style-id': 'label-1',
                    key: 'label-1'
                  }, 'Financial Readiness Score'),
                  React.createElement(Input, {
                    className: 'w-full h-12 text-lg',
                    placeholder: 'Enter score (1-100)',
                    'data-style-id': 'input-1',
                    key: 'input-1'
                  })
                ])
                // Add more input groups...
              ])
            ])
          ]),
          
          // RESULTS CARD - Use Card for results
          React.createElement(Card, {
            className: 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 shadow-xl',
            'data-style-id': 'results-card',
            key: 'results-card'
          }, [
            React.createElement(CardHeader, {
              'data-style-id': 'results-header',
              key: 'results-header'
            }, [
              React.createElement(CardTitle, {
                className: 'text-xl font-semibold text-gray-900',
                'data-style-id': 'results-title',
                key: 'results-title'
              }, 'Assessment Results')
            ]),
            React.createElement(CardContent, {
              'data-style-id': 'results-content',
              key: 'results-content'
            }, [
              React.createElement('div', {
                className: 'text-center p-6 bg-white rounded-lg shadow-lg',
                'data-style-id': 'score-display',
                key: 'score-display'
              }, [
                React.createElement('div', {
                  className: 'text-4xl font-black text-blue-600 mb-2',
                  key: 'score-value'
                }, '87%'),
                React.createElement('div', {
                  className: 'text-sm font-semibold uppercase tracking-wide text-blue-700',
                  key: 'score-label'
                }, 'Overall Readiness Score')
              ])
            ])
          ])
        ])
        
        // 🎯 KEY PATTERNS FOR SHADCN TOOLS:
        // 1. Use Card for major sections (header, inputs, results)
        // 2. Use CardHeader/CardTitle for section titles
        // 3. Use CardContent for section body content
        // 4. Still use divs for internal layout and grouping
        // 5. Apply 'data-style-id' to all components for dynamic styling
        // 6. Use ShadCN form components (Label, Input, Button) inside Cards
    </shadcn-card-with-gradient-example>
    
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
        
        EXAMPLE: className: 'w-full h-12 px-4 text-lg font-medium text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-300',
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

    ℹ️ SHADCN NOTE: When componentSet is 'shadcn', the 'sections' described in the hierarchy above (e.g., for header, input grid, results) should typically be implemented as ShadCN Card components, often nested within the main tool Card. Each Card would then contain its relevant CardHeader, CardTitle, CardContent, etc.
</layout-requirements>`,

  // Emphasis on proper ShadCN usage
  SHADCN_COMPONENT_EMPHASIS: `
<shadcn-usage-guidelines>
    🎯 CRITICAL: When componentSet is 'shadcn', you MUST prioritize ShadCN components over basic divs!
    
    <overall-tool-structure>
        ✅ WRAP THE ENTIRE TOOL: The main content of your tool (excluding perhaps only a top-level page padding div) SHOULD be wrapped in a primary ShadCN Card component. This Card acts as the main container, providing a consistent background and visual structure.
        - Example: React.createElement(Card, { 'data-style-id': 'main-tool-card', className: 'w-full max-w-2xl mx-auto p-0 md:p-0 shadow-xl' }, [ /* card header, content etc. */ ])
        - Ensure 'main-tool-card' in initialStyleMap has at least 'bg-card text-card-foreground p-6 md:p-8' (or similar for padding if not using CardContent exclusively for padding).
    </overall-tool-structure>

    <mandatory-shadcn-patterns>
        ✅ ALWAYS USE CARDS FOR MAJOR SECTIONS (within the main tool card):
        - Header section: Card with CardContent (not plain div)
        - Input section: Card with CardHeader + CardContent (not plain div)
        - Results section: Card with CardHeader + CardContent (not plain div)
        - Lead capture: Card with CardContent (not plain div)
        
        ✅ ALWAYS USE SHADCN FORM COMPONENTS:
        - Labels: Use Label component (not basic label)
        - Text inputs: Use Input component (not basic input)
        - Buttons: Use Button component (not basic button)
        - Selects: Use Select, SelectTrigger, SelectValue, SelectContent, SelectItem
        - Textareas: Use Textarea component (not basic textarea)
        
        ✅ ALWAYS USE SHADCN INTERACTIVE COMPONENTS:
        - Tooltips: Use TooltipProvider, Tooltip, TooltipTrigger, TooltipContent
        - Dialogs: Use Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle
        - Progress bars: Use Progress component
        - Toggles: Use Toggle component
    </mandatory-shadcn-patterns>
    
    <shadcn-vs-div-decision>
        🔸 USE SHADCN COMPONENTS FOR:
        - Any section that could be a Card (headers, inputs, results, etc.)
        - Form elements (inputs, labels, buttons, selects)
        - Interactive elements (tooltips, dialogs, accordions)
        - Data display (progress bars, toggles)
        
        🔸 USE BASIC DIVS FOR:
        - Internal layout containers (flex/grid containers)
        - Wrapper elements inside Cards
        - Simple spacing/grouping elements
        - Logo/icon containers
    </shadcn-vs-div-decision>
    
    <example-comparison>
        ❌ WRONG (Plain div approach):
        React.createElement('div', { className: 'bg-white p-6 rounded-lg shadow' }, [
          React.createElement('h2', {}, 'Input Section'),
          React.createElement('input', { type: 'text' })
        ])
        
        ✅ CORRECT (ShadCN approach):
        React.createElement(Card, { className: 'shadow-lg' }, [
          React.createElement(CardHeader, {}, [
            React.createElement(CardTitle, {}, 'Input Section')
          ]),
          React.createElement(CardContent, {}, [
            React.createElement(Label, {}, 'Field Label'),
            React.createElement(Input, { type: 'text' })
          ])
        ])
    </example-comparison>
</shadcn-usage-guidelines>`,

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
// CRITICAL PROHIBITIONS - MUST BE FIRST TO PREVENT AI DRIFT
// ============================================================================

const CRITICAL_PROHIBITIONS = `
🚨🚨🚨 ABSOLUTE PROHIBITIONS - THESE WILL CAUSE RUNTIME FAILURES 🚨🚨🚨

<critical-prohibitions>
    ❌ NEVER USE IMPORT OR EXPORT STATEMENTS:
    - NO "import React from 'react'"
    - NO "import { useState } from 'react'" 
    - NO "export default function"
    - NO "export const"
    - NO "export function"
    - ALL dependencies are provided in execution context
    - ANY import/export will cause immediate validation failure
    
    ❌ NEVER USE JSX SYNTAX:
    - NO <div>, <button>, <input> etc.
    - NO < > brackets anywhere in component code
    - ONLY React.createElement() syntax allowed
    - JSX will cause compilation failure in runtime
    
    ❌ NEVER USE TEMPLATE STRINGS WITH VARIABLES:
    - NO backticks with dollar-brace variable interpolation  
    - NO template literals like: backtick + dollar + brace + progress + brace + "% Complete" + backtick
    - ALWAYS use string concatenation: progress + '% Complete'
    - Template strings break variable scoping in the execution context
    
    ❌ NEVER CREATE UNDEFINED VALUES:
    - NO undefined in object values: {key: undefined}
    - NO undefined in function parameters: func(undefined, value)
    - NO undefined in arrays: [value, undefined, value]
    - Will cause validation errors and component failures
    
    🎯 VALIDATION CHECK: Before finalizing your componentCode, scan it for:
    1. Any "import" or "export" keywords → REPLACE WITH NOTHING
    2. Any < > brackets → REPLACE WITH React.createElement()
    3. Any template strings with backticks and variable interpolation → REPLACE WITH STRING CONCATENATION
    4. Any "undefined" values in data structures → REPLACE WITH PROPER VALUES
    5. Missing React keys in arrays → ADD UNIQUE KEYS
    
    If ANY of these exist, the tool will FAIL validation and be rejected.
    
    🚨 REMEMBER: You are generating code for DYNAMIC EXECUTION without transpilation.
    Think: "Can this code run directly in a JavaScript engine without any compilation step?"
    If the answer is NO, then rewrite it using only React.createElement() syntax and string concatenation.
</critical-prohibitions>
`;

// ============================================================================
// NEW HEADER REQUIREMENTS 
// ============================================================================
const HEADER_REQUIREMENTS = `
<header-requirements>
    MANDATORY HEADER ELEMENTS:
    1.  PLACEHOLDER LOGO: 
        - Include a simple placeholder logo in the top-left of the header area.
        - Example: React.createElement(\'div\', { className: \'w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white font-bold text-xl\', \'data-style-id\': \'placeholder-logo\', key: \'placeholder-logo\' }, \'L\').
        - Style it with \'data-style-id\': \'placeholder-logo\'.
    2.  INFO ICON & TOOLTIP:
        - Place an \'Info\' icon (e.g., React.createElement(Info, { className: \'h-5 w-5\', key: \'info-icon\' })) in the header, typically top-right or next to the title.
        - This icon MUST be interactive, using a tooltip mechanism.
        - TOOLTIP CONTENT (CRITICAL):
            - Part 1: Display the tool\'s full description. This will be dynamically populated by the rendering system using tool.metadata.description. Your generated code should simply allow for text content here.
            - Part 2: Include a section titled "How to Use:" followed by clear, concise instructions on how to use the tool. For example: "1. Fill in the loan amount. 2. Enter the interest rate. 3. Specify the loan term in years. 4. Click Calculate to see your monthly payment." This part you MUST generate.
        - SHADCN USAGE: If componentSet is \'shadcn\', you MUST use TooltipProvider, Tooltip, TooltipTrigger, and TooltipContent. The TooltipTrigger should typically wrap a Button component which in turn contains the Info icon. See example in GORGEOUS_STYLING_LIBRARY.
        - LEGACY USAGE: If componentSet is \'legacy\', you should still include the Info icon. A simple \'title\' attribute on the icon\'s element can serve as a basic tooltip (e.g., React.createElement(Info, { title: "Tool description [from metadata.description] and How to Use: [your instructions here]", key: \'info-icon\' })).
    3.  HEADER LAYOUT:
        - Use flexbox (e.g., className: \'flex items-center justify-between\') on the main header container (identified by \'data-style-id\': \'tool-header\') to arrange the logo, title/subtitle group, and info icon group.
        - The title and subtitle should be grouped together, typically to the right of the logo.
        - The info icon is typically on the far right.
</header-requirements>
`;

// ============================================================================
// CORE PROMPT SECTIONS - These are NOT directly used by buildToolCreationSystemPrompt
// but are kept for reference or potential future use. buildToolCreationSystemPrompt
// re-defines or pulls from constants like BASE_SYSTEM_INSTRUCTIONS, CRITICAL_PROHIBITIONS, STYLE_GUIDES etc.
// Any changes to general AI instructions should happen in buildToolCreationSystemPrompt or its constituent parts.
// ============================================================================

const CORE_PROMPT = `<purpose>
    You are a TOOL CREATION SPECIALIST, an expert AI agent focused on generating professional, business-focused interactive tools that capture leads and provide genuine value.
    
    Your mission is to create ProductToolDefinition objects that are practical, professional, and immediately usable by business professionals. Focus on tools that solve real problems and generate qualified leads.
    
    🚨🚨🚨 CRITICAL SYNTAX REQUIREMENT 🚨🚨🚨:
    ⚠️ YOU MUST USE React.createElement() SYNTAX ONLY - NO JSX ALLOWED
    ⚠️ ANY use of <> brackets will cause RUNTIME FAILURE
    ⚠️ Only React.createElement() calls are executable in our environment
    ⚠️ NO IMPORT OR EXPORT STATEMENTS ALLOWED ANYWHERE
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
    
    🚨🚨🚨 SYNTAX REMINDER 🚨🚨🚨:
    - componentCode MUST use React.createElement() ONLY
    - NO JSX syntax like <div> or <Button>
    - NO import or export statements
    - Every element MUST be React.createElement('div', props, children)
</output-format>

<component-code-requirements>
    <structure>
        - Generate a complete, working React functional component 
        - Include 'use client'; at the top
        - Function name should be descriptive PascalCase (e.g. ROICalculator, BusinessLeadQualifier)
        - 🚨 CRITICAL: MUST use function declaration syntax: function ComponentName() { ... }
        - ❌ FORBIDDEN: Arrow function syntax: const ComponentName = () => { ... }
        - The DynamicComponentRenderer requires function declarations for proper detection
        - DO NOT USE ANY IMPORT OR EXPORT STATEMENTS - all dependencies are provided via context
        - CRITICAL FOR STYLING: Add 'data-style-id' attributes for dynamic styling on all styleable elements
    </structure>
    
    <react-syntax-requirements>
        🚨🚨🚨 ABSOLUTE MANDATORY REACT SYNTAX RULES - NO EXCEPTIONS 🚨🚨🚨:
        
        ⚠️ CRITICAL: You MUST use React.createElement() syntax ONLY
        ⚠️ JSX syntax will cause RUNTIME ERRORS and is STRICTLY FORBIDDEN
        ⚠️ Any use of < > brackets for JSX will result in COMPILATION FAILURE
        
        ✅ REQUIRED SYNTAX: React.createElement('div', {className: 'text-lg'}, 'Content')
        ❌ FORBIDDEN SYNTAX: <div className="text-lg">Content</div>
        
        🔥 EXECUTION CONTEXT LIMITATION:
        - NO JSX transpiler available in runtime
        - NO Babel transformation available
        - NO < > syntax allowed anywhere in component code
        - ONLY React.createElement() calls are executable
        
        🚨 MANDATORY EXAMPLES OF CORRECT SYNTAX:
        
        // ✅ CORRECT - Simple div with text
        React.createElement('div', {
          className: 'p-6 rounded-lg border',
          style: { backgroundColor: colorScheme.background },
          'data-style-id': 'main-container'
        }, 'Text content')
        
        // ✅ CORRECT - Nested elements
        React.createElement('div', { className: 'container' }, [
          React.createElement('h1', { className: 'title' }, 'Title'),
          React.createElement('p', { className: 'text' }, 'Paragraph')
        ])
        
        // ✅ CORRECT - Arrays of elements WITH REQUIRED KEYS
        React.createElement('div', { className: 'list-container' }, [
          React.createElement('div', { 
            key: 'item-1', 
            className: 'list-item' 
          }, 'First Item'),
          React.createElement('div', { 
            key: 'item-2', 
            className: 'list-item' 
          }, 'Second Item'),
          React.createElement('div', { 
            key: 'item-3', 
            className: 'list-item' 
          }, 'Third Item')
        ])
        
        // ✅ CORRECT - Form fields in grid with keys
        React.createElement('div', { className: 'grid grid-cols-2 gap-4' }, [
          React.createElement('div', { key: 'field-1' }, [
            React.createElement(Label, { key: 'label-1' }, 'Field 1'),
            React.createElement(Input, { key: 'input-1', placeholder: 'Enter value' })
          ]),
          React.createElement('div', { key: 'field-2' }, [
            React.createElement(Label, { key: 'label-2' }, 'Field 2'),
            React.createElement(Input, { key: 'input-2', placeholder: 'Enter value' })
          ])
        ])
        
        📝 COMMON KEY PATTERNS:
        - Form fields: key: 'field-{fieldname}' or key: 'input-{fieldname}'
        - Sections: key: 'section-{name}' or key: 'header-{section}'
        - List items: key: 'item-{index}' or key: 'row-{index}'
        - Navigation: key: 'nav-{item}' or key: 'link-{page}'
        - Grid items / Columns: If a grid's children are an array of divs/components, each child needs a key like 'grid-col-{index}' or 'grid-item-{description}'.
         
         // ✅ CORRECT - Form fields in grid with keys
        React.createElement('div', { className: 'grid grid-cols-2 gap-4' }, [
          React.createElement('div', { key: 'field-1' }, [
            React.createElement(Label, { key: 'label-1' }, 'Field 1'),
            React.createElement(Input, { key: 'input-1', placeholder: 'Enter value' })
          ]),
          React.createElement('div', { key: 'field-2' }, [
            React.createElement(Label, { key: 'label-2' }, 'Field 2'),
            React.createElement(Input, { key: 'input-2', placeholder: 'Enter value' })
          ])
        ])
        
        // ❌ INCORRECT - Grid items in an array without keys
        // If the direct children of a grid (or any element) are passed as an array, EACH child in that array needs a key.
        React.createElement('div', { className: 'grid grid-cols-3' }, [
          React.createElement('div', null, [ /* Column 1 Content */ ]), // MISSING KEY!
          React.createElement('div', null, [ /* Column 2 Content */ ]), // MISSING KEY!
          React.createElement('div', null, [ /* Column 3 Content */ ])  // MISSING KEY!
        ])
        // ✅ CORRECT - Grid items in an array WITH keys
        React.createElement('div', { className: 'grid grid-cols-3' }, [
          React.createElement('div', { key: 'grid-col-1-summary' }, [ /* Column 1 Content */ ]),
          React.createElement('div', { key: 'grid-col-2-details' }, [ /* Column 2 Content */ ]),
          React.createElement('div', { key: 'grid-col-3-actions' }, [ /* Column 3 Content */ ])
        ])

        🚨🚨🚨 CRITICAL REACT KEYS REQUIREMENT 🚨🚨🚨
        
        MANDATORY: When creating arrays of React elements, EVERY element in the array MUST have a unique "key" prop:
        
        ✅ CORRECT - With keys:
        [
          React.createElement('div', { key: 'unique-1', className: 'item' }, 'Item 1'),
          React.createElement('div', { key: 'unique-2', className: 'item' }, 'Item 2')
        ]
        
        ❌ FORBIDDEN - Without keys (causes React warnings):
        [
          React.createElement('div', { className: 'item' }, 'Item 1'),
          React.createElement('div', { className: 'item' }, 'Item 2')
        ]
        
        🎯 KEYS MUST BE:
        - Unique within the array
        - Stable (same key for same logical element)
        - Descriptive (e.g., 'field-name', 'section-header', 'item-1')
        
        📝 COMMON KEY PATTERNS:
        - Form fields: key: 'field-{fieldname}' or key: 'input-{fieldname}'
        - Sections: key: 'section-{name}' or key: 'header-{section}'
        - List items: key: 'item-{index}' or key: 'row-{index}'
        - Navigation: key: 'nav-{item}' or key: 'link-{page}'
         
         // ✅ CORRECT - Component with props
         React.createElement(Input, {
           className: 'w-full h-12',
           placeholder: 'Enter value',
           value: inputValue,
           onChange: (e) => setInputValue(e.target.value)
         })
         
         // ✅ CORRECT - Button with click handler
         React.createElement(Button, {
           onClick: handleSubmit,
           className: 'bg-blue-500 text-white px-4 py-2 rounded'
         }, 'Submit')
         
         🚨 EXAMPLES OF FORBIDDEN JSX (DO NOT USE):
         ❌ <div className="container">Content</div>
         ❌ <h1>Title</h1>
         ❌ <Input placeholder="value" />
         ❌ <Button onClick={handler}>Submit</Button>
         ❌ ANY use of < and > for elements
         
         🎯 REMEMBER: Every single element MUST use React.createElement() syntax
         🎯 NO EXCEPTIONS - JSX will break the component at runtime
         🎯 Test your mental model: Can this run without JSX transformation? If no, rewrite it.
         
         🚨🚨🚨 FINAL VALIDATION CHECKLIST BEFORE SUBMITTING 🚨🚨🚨:
         
         Before you finalize your componentCode, scan it line by line for these FORBIDDEN patterns:
         
         ❌ SEARCH FOR: "import " → If found: DELETE the entire line
         ❌ SEARCH FOR: "export " → If found: DELETE the entire line  
         ❌ SEARCH FOR: "<" followed by letters → If found: REWRITE using React.createElement()
         ❌ SEARCH FOR: "Card" components → If found: REPLACE with React.createElement('div', ...)
         ❌ SEARCH FOR: ", undefined," → If found: REPLACE with proper values
         
         ✅ SEARCH FOR: "React.createElement" → This should appear multiple times
         ✅ SEARCH FOR: "key:" in arrays → All array elements should have keys
         ✅ SEARCH FOR: "'use client';" → Should be at the very top
         
         If your code contains ANY forbidden patterns, it will be REJECTED by validation.
         Take 30 seconds to scan your code before submitting.
    </react-syntax-requirements>
    
    <available-context-variables>
        The following are available in the execution context (do NOT import them):
        - React (includes React.createElement)
        - useState, useEffect, useCallback, useMemo
        // Basic HTML elements are always available.
        // Specific UI components (like ShadCN) will be listed if applicable based on current componentSet.
        // Icons
        - Loader2, AlertCircle, Info
    </available-context-variables>
    
    <data-style-id-requirements>
        MANDATORY: Add data-style-id attributes to ALL styleable elements for dynamic styling:
        - Containers: data-style-id="main-container", "input-section", "results-section"
        - Headers: data-style-id="main-title", "section-title", "tool-header"  
        - Inputs: data-style-id="input-[fieldname]" (e.g. "input-revenue", "input-costs")
        - Buttons: data-style-id="submit-button", "reset-button", "export-button"
        - Results: data-style-id="result-[metric]" (e.g. "result-roi", "result-profit")
        
        EXAMPLE with proper data-style-id usage:
        React.createElement('div', {
          className: 'max-w-3xl mx-auto p-6',
          'data-style-id': 'main-container'  ← REQUIRED for dynamic styling
        }, [...])
    </data-style-id-requirements>
</component-code-requirements>`;

// ============================================================================
// SYSTEM PROMPT CONSTRUCTION
// ============================================================================

export interface PromptOptions {
  includeComprehensiveColors?: boolean;
  includeGorgeousStyling?: boolean;
  includeAdvancedLayouts?: boolean;
  styleComplexity?: 'basic' | 'enhanced' | 'premium';
  industryFocus?: string;
  toolComplexity?: 'simple' | 'moderate' | 'complex';
  componentSet?: 'shadcn' | 'legacy'; 
}

// Define the base instructions that were previously part of CORE_PROMPT or implied.
const BASE_SYSTEM_INSTRUCTIONS = `You are an expert React developer specializing in creating dynamic, interactive business tools using ONLY React.createElement() syntax. NO JSX ALLOWED. Your primary goal is to generate a single, self-contained React functional component.`;

export function buildToolCreationSystemPrompt(options: PromptOptions = {}): string {
  let systemPrompt = `${BASE_SYSTEM_INSTRUCTIONS}\n${CRITICAL_PROHIBITIONS}`;

  // Component Set Instructions & Available Context Variables Update
  systemPrompt += `
<component-set-guidelines>
`;
  if (options.componentSet === 'legacy') {
    systemPrompt += `  <current-component-set>LEGACY HTML ELEMENTS</current-component-set>
  You MUST generate React component code using basic HTML elements (e.g., 'div', 'input', 'button', 'select', 'label', 'h1', 'p', 'span').
  Style these elements exclusively using Tailwind CSS classes provided in the 'className' prop.
  DO NOT use or import any custom React components (e.g., from '@/components/ui/...'). Focus on pure HTML structure with Tailwind styling.
  All interactivity MUST be handled with standard HTML attributes (e.g., 'onClick', 'onChange') and React state hooks.
  The following are available in the execution context: React, useState, useEffect, useCallback, useMemo, Loader2, AlertCircle, Info.
`;
  } else {
    // Default to ShadCN if componentSet is 'shadcn' or undefined
    const shadcnComponentList = `
  - Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter (from '@/components/ui/card')
  - Input (from '@/components/ui/input')
  - Button (from '@/components/ui/button')
  - Select, SelectTrigger, SelectValue, SelectContent, SelectItem (from '@/components/ui/select')
  - Label (from '@/components/ui/label')
  - Textarea (from '@/components/ui/textarea')
  - RadioGroup, RadioGroupItem (from '@/components/ui/radio-group')
  - Checkbox (from '@/components/ui/checkbox')
  - Slider (from '@/components/ui/slider')
  - Toggle (from '@/components/ui/toggle')
  - Accordion, AccordionItem, AccordionTrigger, AccordionContent (from '@/components/ui/accordion')
  - Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter (from '@/components/ui/dialog')
  - Tooltip, TooltipTrigger, TooltipContent, TooltipProvider (from '@/components/ui/tooltip')
  - Progress (from '@/components/ui/progress')
`;
    systemPrompt += `  <current-component-set>SHADCN UI COMPONENTS</current-component-set>
  You MUST generate React component code primarily using the following pre-built ShadCN UI components where appropriate:${shadcnComponentList}
  When using these components, pass them as the first argument to React.createElement (e.g., React.createElement(Input, {...})).
  You can still use basic HTML elements ('div', 'p', 'span', 'h1', etc.) for layout and simple text display if a ShadCN component is not suitable or available for a specific need.
  Continue to use 'data-style-id' for all elements that need dynamic styling and provide Tailwind classes in 'className'.

  <shadcn-components-availability>
  The following ShadCN UI components are available in the execution context (in addition to React, hooks, and basic icons like Loader2, AlertCircle, Info):${shadcnComponentList}  </shadcn-components-availability>
`;
  }
  systemPrompt += `</component-set-guidelines>\n`;

  // Add conditional color guidance
  if (options.includeComprehensiveColors || options.styleComplexity === 'premium') {
    systemPrompt += STYLE_GUIDES.COMPREHENSIVE_COLOR_SCHEMES;
  } else {
    systemPrompt += STYLE_GUIDES.BASIC_COLOR_GUIDANCE;
  }

  // Add styling guidance based on complexity
  if (options.includeGorgeousStyling || options.styleComplexity === 'premium') {
    systemPrompt += STYLE_GUIDES.GORGEOUS_STYLING_LIBRARY;
  }

  // Add ShadCN emphasis when using ShadCN components
  if (options.componentSet === 'shadcn' || !options.componentSet) {
    systemPrompt += STYLE_GUIDES.SHADCN_COMPONENT_EMPHASIS;
  }

  // Add layout guidance for complex tools
  if (options.includeAdvancedLayouts || options.toolComplexity === 'complex') {
    systemPrompt += STYLE_GUIDES.ADVANCED_LAYOUT_PATTERNS;
  }

  // Add new header requirements
  systemPrompt += HEADER_REQUIREMENTS;

  systemPrompt += `
<component-types>
    <input-components>${ALLOWED_COMPONENTS.inputs.join(', ')}</input-components>
    <display-components>${ALLOWED_COMPONENTS.displays.join(', ')}</display-components>
    <interactive-components>${ALLOWED_COMPONENTS.interactive.join(', ')}</interactive-components>
    <chart-components>${ALLOWED_COMPONENTS.charts.join(', ')}</chart-components>
    <layout-components>${ALLOWED_COMPONENTS.layout.join(', ')}</layout-components>
</component-types>

<json-response-format>
  You MUST return a valid JSON object with this EXACT structure:
  {
    "componentCode": "string (React.createElement code ONLY)",
    "initialStyleMap": { "data-style-id": "Tailwind CSS classes" },
    "colorScheme": {
      "primary": "#hexcode",
      "secondary": "#hexcode",
      "background": "#hexcode",
      "surface": "#hexcode",
      "text": { "primary": "#hexcode", "secondary": "#hexcode", "muted": "#hexcode" },
      "border": "#hexcode",
      "success": "#hexcode",
      "warning": "#hexcode",
      "error": "#hexcode"
    },
    "metadata": {
      "title": "string",
      "description": "string",
      "shortDescription": "string",
      "type": "string",
      "category": "string",
      "targetAudience": "string",
      "industry": "string",
      "tags": ["string"],
      "estimatedCompletionTime": number, // minutes
      "difficultyLevel": "beginner|intermediate|advanced",
      "features": ["string"],
      "icon": { "type": "lucide|emoji", "value": "string" }
    }
  }
  
  🚨 CRITICAL REQUIREMENT: initialStyleMap is MANDATORY and must contain ALL data-style-id mappings
  - Every data-style-id in your componentCode MUST have a corresponding entry in initialStyleMap
  - initialStyleMap cannot be empty {} - it must contain actual style mappings
  - Each mapping must be a valid Tailwind CSS class string
  - Example: "main-container": "max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-lg"
  - Minimum 3-5 style mappings required for any component
</json-response-format>

<final-instructions>
  Focus ONLY on generating the React.createElement() code, style map, color scheme, and metadata. No extra explanations or commentary.
  Ensure all data-style-id attributes in componentCode have corresponding entries in initialStyleMap.
  The componentCode MUST be a single self-contained React functional component.
  All Tailwind classes in initialStyleMap MUST be valid and functional.
  DO NOT use backticks or markdown formatting for the componentCode string in the JSON response.
  The ENTIRE response MUST be a single JSON object.
</final-instructions>`;

  return systemPrompt;
}

// User prompt builder (Restoring this function)
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
  
  // Prioritize insights if available
  if (brainstormingResult || logicArchitectInsights) {
    const insights = brainstormingResult || logicArchitectInsights;
    // Use a more specific tool type from insights if available
    prompt = `Create a ${insights.toolType || insights.title || toolType || 'business tool'} based on the following detailed insights and requirements:\n\n`;
    
    prompt += `USER INTENT: ${userIntent}\n\n`; // Keep user intent for context

    if (insights === brainstormingResult && brainstormingResult) {
      prompt += `BRAINSTORMING INSIGHTS (Primary Guide):\n${JSON.stringify(brainstormingResult, null, 2)}\n\n`;
    } else if (insights === logicArchitectInsights && logicArchitectInsights) {
      prompt += `LOGIC ARCHITECT INSIGHTS (Primary Guide):\n${JSON.stringify(logicArchitectInsights, null, 2)}\n\n`;
    }

    // Optionally, add any top-level context items not typically inside insights, if necessary
    // For example, if there was a very specific instruction from the user that might override something in insights:
    // if (context.specificOverride) prompt += `SPECIFIC OVERRIDE: ${context.specificOverride}\n`;

  } else {
    // Fallback to original detailed listing if no insights are present
    prompt += `USER INTENT: ${userIntent}\n\n`;
    if (targetAudience) prompt += `TARGET AUDIENCE: ${targetAudience}\n`;
    if (industry) prompt += `INDUSTRY: ${industry}\n`;
    if (businessDescription) prompt += `BUSINESS CONTEXT: ${businessDescription}\n`;
    if (features?.length) prompt += `REQUIRED FEATURES: ${features.join(', ')}\n`;
    if (colors?.length) prompt += `PREFERRED COLORS: ${colors.join(', ')}\n`;
  }
  
  // Add other context items if they are not typically part of brainstorming/logic insights
  // and are still relevant.
  if (collectedAnswers && Object.keys(collectedAnswers).length > 0) {
    prompt += `\nUSER ANSWERS (For additional context or refinement):\n`;
    Object.entries(collectedAnswers).forEach(([key, value]) => {
      prompt += `${key}: ${value}\n`;
    });
  }

  if (brandAnalysis) {
    prompt += `\nBRAND ANALYSIS (For styling and tone consideration):\n${JSON.stringify(brandAnalysis, null, 2)}\n`;
  }
  
  // conversationHistory, selectedWorkflow, uploadedFiles might be too verbose or handled differently.
  // Consider if they are essential raw data for the tool creator agent or if insights already distilled them.

  if (existingTool && updateType) {
    prompt += `\nUPDATE EXISTING TOOL:\nUpdate Type: ${updateType}\n`;
    prompt += `Current Tool Title: ${existingTool.metadata?.title}\n`;
  }
  
  prompt += `\nGenerate a complete ProductToolDefinition that solves this business need professionally.`;
  
  // console.log("User Prompt:",prompt); // Keep user-added log if intended
  return prompt;
}

// Smart prompt selector based on context (Restoring this function)
export function getToolCreationSystemPrompt(context?: any): string { // context is promptOptions from core-logic
  if (!context || Object.keys(context).length === 0) {
    // If context is null, undefined, or an empty object, build with default PromptOptions
    return buildToolCreationSystemPrompt({});
  }

  // Assuming context is a valid PromptOptions object or contains the necessary fields
  const options: PromptOptions = {
    includeComprehensiveColors: context.includeComprehensiveColors ?? (context.needsCustomColors || context.industry === 'healthcare' || context.industry === 'finance'),
    includeGorgeousStyling: context.includeGorgeousStyling ?? (context.isPremiumTool || context.styleComplexity === 'premium'),
    includeAdvancedLayouts: context.includeAdvancedLayouts ?? (context.isComplexTool || context.toolComplexity === 'complex'),
    styleComplexity: context.styleComplexity || 'basic',
    industryFocus: context.industryFocus ?? context.industry, 
    toolComplexity: context.toolComplexity || 'moderate',
    componentSet: context.componentSet || 'shadcn' // Ensure componentSet is passed through, default if missing
  };

  return buildToolCreationSystemPrompt(options);
}
