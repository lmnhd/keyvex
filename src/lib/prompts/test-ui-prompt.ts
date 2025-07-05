// Test UI Assistant Prompt - For conversation flow testing and UI component generation
/*
================================================================================
MODEL-PROMPT-NOTES: Input Component Selection Guidelines
================================================================================

When generating dynamic questions for users, the AI model should select the 
appropriate input component based on these guidelines:

1. CHECKBOX COMPONENT (multiSelect):
   - Use when: Finite set of options (typically 3-8 choices)
   - Use when: Multiple values can be selected simultaneously
   - Use when: No custom values needed (closed set)
   - Example: "Which features do you want?" → Charts, Export, Sharing, etc.
   - Layout: Horizontal inline chips with checkboxes
   - Max selections: Usually 3-4 to maintain simplicity

2. SELECT COMPONENT (select):
   - Use when: Endless possible options but providing top 5-8 common choices
   - Use when: Only ONE value can be selected
   - Use when: Custom value input is needed as fallback
   - Example: "What's your industry?" → Technology, Healthcare, + Custom option
   - Layout: Dropdown with "Enter Custom Value" button
   - Always include custom value option for flexibility

3. RADIO COMPONENT (yesNoMaybe):
   - Use when: Simple binary or ternary choices
   - Use when: Finite set of 2-4 mutually exclusive options
   - Use when: Options are simple single words or short phrases
   - Example: "How confident are you?" → Very Confident, Need Help, Somewhat Sure
   - Layout: Horizontal inline buttons with radio circles
   - Keep labels short and clear
   - MAX 3 OPTIONS: This component is for very mundane, simplistic responses
   - For more complex single choices, use SELECT component instead

4. COLOR COMPONENT (colorSelect):
   - Use when: Selecting brand colors or visual themes
   - Use when: Visual representation helps decision making
   - Example: "Choose your color scheme" → Professional Blue, Modern Green, etc.
   - Layout: Horizontal chips with color dots + labels
   - Always include custom color option

5. TEXT INPUT COMPONENT (text):
   - Use when: Open-ended single-line responses needed
   - Use when: Providing suggestion chips helps but custom input required
   - Example: "What should we call your tool?" → with suggestions like "ROI Calculator"
   - Layout: Input field with optional suggestion chips above
   - Keep suggestions to 4-6 options max

6. TEXTAREA COMPONENT (textarea):
   - Use when: Multi-line descriptive text needed
   - Use when: Detailed explanations or descriptions required
   - Example: "Describe your business and target audience"
   - Layout: Fixed 2-row textarea (no scrolling)
   - Keep compact - avoid long-form content

7. MULTI-PART COMPONENT (multiPart):
   - Use when: Need to collect 3-5 related pieces of information
   - Use when: Each sub-question uses different input types
   - Example: Collecting audience + industry + metrics in sequence
   - Flow: One question at a time, auto-advance through sequence
   - Keep total sub-questions to 3-5 max

DESIGN PRINCIPLES:
- All components must fit in uniform container (no size changes)
- No scrolling required - everything visible at once
- Horizontal layouts preferred for space efficiency
- Simple, short labels (avoid long descriptions)
- Always provide escape hatch (custom options) when possible
- Maintain consistent visual hierarchy and spacing

COMPONENT SIZING:
- Checkboxes/radios: 3x3px indicators
- Color dots: 3x3px circles
- Button padding: px-3 py-2 for consistency
- Textarea: Fixed 2 rows maximum
- Container: Uniform height regardless of content

================================================================================
*/
export const TEST_UI_ASSISTANT_PROMPT = `<purpose>
    You are a TEST UI ASSISTANT specialized in conversation flow testing and UI component generation for business tool creation.
    
    Your mission is to analyze user input and generate appropriate questions using various input components, while knowing when to skip questions and create tools directly, OR when to update the style of an existing tool.
</purpose>

<tool-creation-rules>
    <immediate-triggers>
        If the user's input contains ANY of these patterns, CREATE THE TOOL IMMEDIATELY:
        - "Create a [tool name]"
        - "Build a [tool name]" 
        - "Make a [tool name]"
        - "Generate a [tool name]"
        - "I need a [tool name]"
        - "Design a [tool name]"
        - "[Tool name] calculator"
        - "[Tool name] tool"
    </immediate-triggers>
    
    <creation-examples>
        - "Create a Solar Panel Savings Calculator" → CREATE IMMEDIATELY
        - "Build an ROI calculator for marketing" → CREATE IMMEDIATELY  
        - "I need a wedding budget tool" → CREATE IMMEDIATELY
        - "Make a carbon footprint calculator" → CREATE IMMEDIATELY
    </creation-examples>
    
    <core-rules>
        <rule>If user is asking to CREATE/BUILD/MAKE something, do it IMMEDIATELY - NO QUESTIONS!</rule>
        <rule>If you've already asked 3 questions, create the tool on the next response</rule>
        <rule>Don't overthink it - use your judgment</rule>
    </core-rules>
    
    <creation-response-format>
        When creating a tool, respond like this:
        {
          "id": "tool-creation-request",
          "message": "Perfect! Creating your [tool name] now...",
          "inputType": "textarea", 
          "shouldCreateTool": true,
          "toolCreationContext": {
            "userIntent": "[user's exact request]",
            "targetAudience": "[extract from request or use 'Business professionals']",
            "industry": "[extract from context or use 'General business']",
            "toolType": "[what kind of tool they want]", 
            "features": ["[relevant features based on request]"]
          }
        }
    </creation-response-format>
</tool-creation-rules>

<style-update-rules>
    <info>
        This section guides you on how to respond when the user wants to update the visual style of an element in the currently displayed tool.
        The user might say things like: "make the title bigger", "change the button color to green", "I want the background of the results section to be light gray".
        You need to identify the target element (often by a descriptive name like 'main-title', 'submit-button', 'results-background') and the new Tailwind CSS classes.
    </info>

    <immediate-triggers>
        If the user's input clearly indicates a style change for a specific element, and you have a 'productToolDefinition' in the current context, INITIATE A STYLE UPDATE.
        - "Change the [element description] to [style description]"
        - "Make the [element description] [tailwind classes]"
        - "I want the [element description] to have [style description]"
        - "Update the style of [element description]"
    </immediate-triggers>

    <style-update-examples>
        - User: "Make the main title text larger and bold" (Current tool ID: tool-123, Target element data-style-id: main-title)
          AI Response should set 'shouldUpdateStyle: true' and 'styleUpdateContext: { toolDefinitionId: "tool-123", dataStyleId: "main-title", newTailwindClasses: "text-2xl font-bold" }'
        - User: "Change the primary button background to blue-600" (Current tool ID: tool-xyz, Target element data-style-id: primary-action-button)
          AI Response should set 'shouldUpdateStyle: true' and 'styleUpdateContext: { toolDefinitionId: "tool-xyz", dataStyleId: "primary-action-button", newTailwindClasses: "bg-blue-600 hover:bg-blue-700 text-white" }' (ensure you provide complete and sensible class sets)
    </style-update-examples>

    <reasoning-for-style-update>
        - You must infer the 'dataStyleId' of the element the user is referring to. Assume the 'componentCode' for the current tool has 'data-style-id' attributes on stylable elements (e.g., 'main-title', 'submit-button', 'input-label-name', 'results-card').
        - You must translate the user's style request into valid Tailwind CSS classes.
        - If the user is vague (e.g., "make it prettier"), ask for clarification about WHICH element and WHAT style.
        - If no 'productToolDefinition' is present in the context, you cannot update styles. Ask the user to create or load a tool first.
    </reasoning-for-style-update>

    <style-update-response-format>
        When initiating a style update, respond with 'shouldUpdateStyle: true' and populate 'styleUpdateContext':
        {
          "id": "style-update-request",
          "message": "Got it! I'll update the style for the [element description]...",
          "inputType": "textarea", // Or an appropriate input type if follow-up is needed, but typically style updates are direct actions.
          "shouldUpdateStyle": true,
          "styleUpdateContext": {
            "toolDefinitionId": "[ID of the current productToolDefinition in context]",
            "dataStyleId": "[inferred-data-style-id-of-element]",
            "newTailwindClasses": "[complete-new-tailwind-class-string]"
          },
          "reasoning": "User requested a style change for [element description]. Translating to Tailwind: [newTailwindClasses] for data-style-id: [inferred-data-style-id-of-element]."
        }
    </style-update-response-format>
</style-update-rules>

<conversation-behavior>
    <core-principles>
        - Ask good questions to understand what they need
        - Use different input components appropriately
        - Don't ask endless questions - max 3 rounds before creating the tool
        - Be helpful and natural
        - Create tools when it makes sense
    </core-principles>
</conversation-behavior>

<input-components>
    <component name="multiPart" symbol="🔄">
        Multiple related questions in sequence
    </component>
    <component name="multiSelect" symbol="📋">
        Choose multiple features/options (max 3-4 selections)
    </component>
    <component name="select" symbol="🎯">
        Pick one option from a list
    </component>
    <component name="colorSelect" symbol="🎨">
        Choose brand colors (each option needs different color arrays)
    </component>
    <component name="yesNoMaybe" symbol="✅">
        Simple 2-3 choice decisions
    </component>
    <component name="textarea" symbol="📝">
        Longer descriptions
    </component>
    <component name="text" symbol="✏️">
        Short text like names/titles
    </component>
    <component name="fileUpload" symbol="📁">
        Upload files/logos
    </component>
</input-components>

<color-select-format>
    For colorSelect, use different hex colors for each option:
    {
      "inputType": "colorSelect",
      "options": [
        { "value": "blue", "label": "Professional Blue", "colors": ["#3b82f6", "#2563eb"] },
        { "value": "green", "label": "Growth Green", "colors": ["#16a34a", "#047857"] },
        { "value": "orange", "label": "Energy Orange", "colors": ["#f97316", "#ea580c"] }
      ]
    }
</color-select-format>

<guidelines>
    Keep it natural and helpful. Create tools when it makes sense.
</guidelines>`;

// Test command definitions for structured testing
export const TEST_COMMANDS = {
  'send-multi-input': () => ({
    message: "Let's gather some key information about your business. I'll ask you a few quick questions:",
    inputType: 'multiPart' as const,
    id: 'test-multi-sequence',
    questions: [
      {
        id: 'business-name',
        question: "What's your business name?",
        inputType: 'textarea',
        placeholder: 'Enter your business name...',
        suggestions: ['Acme Corp', 'Digital Solutions Inc', 'Consulting Pro']
      },
      {
        id: 'industry-type',
        question: "What industry are you in?",
        inputType: 'select',
        options: [
          { value: 'tech', label: 'Technology' },
          { value: 'healthcare', label: 'Healthcare' },
          { value: 'finance', label: 'Finance' },
          { value: 'consulting', label: 'Consulting' },
          { value: 'ecommerce', label: 'E-commerce' }
        ],
        allowCustom: true
      },
      {
        id: 'team-size',
        question: "How large is your team?",
        inputType: 'yesNoMaybe',
        options: [
          { value: 'small', label: 'Small (1-10)' },
          { value: 'medium', label: 'Medium (11-50)' },
          { value: 'large', label: 'Large (50+)' }
        ]
      },
      {
        id: 'main-goals',
        question: "What are your main business goals? (Select up to 3)",
        inputType: 'multiSelect',
        options: [
          { value: 'growth', label: 'Business Growth' },
          { value: 'efficiency', label: 'Operational Efficiency' },
          { value: 'customer', label: 'Customer Satisfaction' },
          { value: 'revenue', label: 'Revenue Increase' },
          { value: 'automation', label: 'Process Automation' }
        ],
        maxSelections: 3
      }
    ],
    reasoning: 'Testing multi-part question sequence with different input types'
  }),

  'send-image-upload': () => ({
    message: "Perfect! Let's analyze your brand assets. Please upload your logo, website screenshot, or any brand materials you have:",
    inputType: 'fileUpload' as const,
    id: 'test-brand-upload',
    acceptedFileTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
    maxFileSize: '5MB',
    placeholder: 'Upload your logo, website screenshot, or brand materials',
    reasoning: 'Testing file upload component for brand analysis'
  }),

  'send-color-picker': () => ({
    message: "Great! Now let's choose colors that represent your brand perfectly:",
    inputType: 'colorSelect' as const,
    id: 'test-color-selection',
    options: [
      { value: 'professional-blue', label: 'Professional Blue', colors: ['#2563eb', '#1e40af'] },
      { value: 'growth-green', label: 'Growth Green', colors: ['#059669', '#047857'] },
      { value: 'creative-purple', label: 'Creative Purple', colors: ['#7c3aed', '#5b21b6'] },
      { value: 'energy-orange', label: 'Energy Orange', colors: ['#ea580c', '#c2410c'] },
      { value: 'trust-teal', label: 'Trust Teal', colors: ['#0891b2', '#0e7490'] }
    ],
    allowCustom: true,
    reasoning: 'Testing color selection with custom color picker integration'
  }),

  'send-feature-selection': () => ({
    message: "Excellent! Which features would make your tool most valuable? (Choose up to 4)",
    inputType: 'multiSelect' as const,
    id: 'test-feature-selection',
    options: [
      { value: 'analytics', label: 'Advanced Analytics' },
      { value: 'export', label: 'PDF Export' },
      { value: 'integration', label: 'CRM Integration' },
      { value: 'sharing', label: 'Social Sharing' },
      { value: 'automation', label: 'Email Automation' },
      { value: 'customization', label: 'Custom Branding' }
    ],
    maxSelections: 4,
    reasoning: 'Testing multi-select with reasonable limits'
  }),

  'send-text-input': () => ({
    message: "What should we call your new business tool?",
    inputType: 'text' as const,
    id: 'test-tool-naming',
    placeholder: 'e.g., "ROI Calculator for Marketing Campaigns"',
    suggestions: [
      'Business ROI Calculator',
      'Marketing Effectiveness Tool',
      'Cost-Benefit Analyzer',
      'Investment Calculator'
    ],
    reasoning: 'Testing text input with helpful suggestions'
  }),

  'send-description-input': () => ({
    message: "Tell me more about what this tool should help your customers achieve:",
    inputType: 'textarea' as const,
    id: 'test-tool-description',
    placeholder: 'Describe the main problem this tool solves, who will use it, and what results they should get...',
    reasoning: 'Testing textarea for detailed descriptions'
  })
};

// Helper function to create adaptive prompts
export function createAdaptivePrompt(
  userInput: string,
  userProfile: any,
  conversationHistory: any[],
  collectedAnswers: any,
  productToolDefinition?: any
): string {
  // Count AI messages in conversation history
  const aiMessageCount = conversationHistory.filter((msg: any) => 
    msg.role === 'assistant' || msg.type === 'ai_response'
  ).length;
  
  let basePrompt = TEST_UI_ASSISTANT_PROMPT;
  
  // Check for explicit tool creation patterns
  const creationPatterns = [
    /create\s+a\s+/i,
    /build\s+a\s+/i, 
    /make\s+a\s+/i,
    /generate\s+a\s+/i,
    /i\s+need\s+a\s+/i,
    /design\s+a\s+/i,
    /calculator\s*$/i,
    /tool\s*$/i
  ];
  
  const isCreationRequest = creationPatterns.some(pattern => pattern.test(userInput));

  if (isCreationRequest) {
    // If it's an explicit creation request, prioritize that part of the prompt
    // (This logic might need refinement based on how prompts are structured and combined)
    // For now, we assume TEST_UI_ASSISTANT_PROMPT contains everything and the model will prioritize.
  }

  // Add current product tool context if available (CRITICAL for style updates)
  if (productToolDefinition) {
    basePrompt += `

<current-product-tool-context>
    <tool-id>${productToolDefinition.id}</tool-id>
    <tool-title>${productToolDefinition.metadata?.title || 'Untitled'}</tool-title>
    <tool-description>${productToolDefinition.metadata?.description || 'No description'}</tool-description>
    <current-color-scheme>
        <primary>${productToolDefinition.colorScheme?.primary || '#3b82f6'}</primary>
        <secondary>${productToolDefinition.colorScheme?.secondary || '#1e40af'}</secondary>
        <background>${productToolDefinition.colorScheme?.background || '#ffffff'}</background>
    </current-color-scheme>
    <component-code-preview>${(productToolDefinition.componentCode || '').substring(0, 300)}${(productToolDefinition.componentCode || '').length > 300 ? '...' : ''}</component-code-preview>
    <current-style-map>${JSON.stringify(productToolDefinition.currentStyleMap || {}, null, 2)}</current-style-map>
    <available-style-ids>
        Common data-style-id values include: main-container, main-title, main-description, submit-button, primary-button, input-field, results-section, results-card, background
    </available-style-ids>
</current-product-tool-context>`;
  }

  // Add user profile context if available
  if (userProfile) {
    basePrompt += `

<user-profile-context>
    <total-interactions>${userProfile.totalInteractions}</total-interactions>
    <average-response-time>${userProfile.averageResponseTime?.toFixed(0) || 'N/A'}</average-response-time>
    <exploration-tendency>${userProfile.explorationTendency?.toFixed(2) || 'N/A'}</exploration-tendency>
    <prefers-structured>${userProfile.prefersStructuredQuestions}</prefers-structured>
    <likely-to-edit>${userProfile.likelyToEditAnswers}</likely-to-edit>
    <preferred-complexity>${userProfile.preferredComplexity || 'medium'}</preferred-complexity>
    <suggested-workflow>${userProfile.suggestedWorkflow || 'flexible'}</suggested-workflow>
    <adaptive-suggestions>
        <prefer-quick-mode>${userProfile.averageResponseTime < 5000 && !userProfile.likelyToEditAnswers}</prefer-quick-mode>
        <show-advanced-options>${userProfile.explorationTendency > 0.5}</show-advanced-options>
    </adaptive-suggestions>
</user-profile-context>`;
  }

  // Add conversation history context
  if (conversationHistory && conversationHistory.length > 0) {
    basePrompt += `

<conversation-history>`;
    conversationHistory.slice(-5).forEach(msg => { // Last 5 messages
      const role = msg.role || (msg.type === 'user_input' ? 'user' : 'assistant');
      const content = msg.content || msg.message || (typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data));
      basePrompt += `
  <message role="${role}">${content.substring(0, 200)}${content.length > 200 ? '...' : ''}</message>`;
    });
    basePrompt += `
</conversation-history>`;
  }

  // Add collected answers context
  if (collectedAnswers && Object.keys(collectedAnswers).length > 0) {
    basePrompt += `

<collected-answers>`;
    for (const [key, value] of Object.entries(collectedAnswers)) {
      basePrompt += `
  <answer question-id="${key}">${String(value).substring(0, 100)}${String(value).length > 100 ? '...' : ''}</answer>`;
    }
    basePrompt += `
</collected-answers>`;
  }
  
  // Final instruction to the AI
  basePrompt += `

<current-user-input>
${userInput}
</current-user-input>

<final-instruction>
Based on ALL the provided context (purpose, rules, user profile, history, collected answers, current tool definition, and current input), generate the most appropriate JSON response according to the defined schemas.

IMPORTANT STYLE UPDATE LOGIC:
- If the user is asking to change colors, styles, or appearance AND there is a current-product-tool-context available, you MUST use the <style-update-rules> and set "shouldUpdateStyle": true with proper "styleUpdateContext".
- For style updates, use the tool-id from current-product-tool-context and infer the appropriate data-style-id based on what the user is asking to change (background, title, button, etc.).
- For tool creation requests, use the <tool-creation-rules>.
- Otherwise, ask a relevant question to guide the user.
</final-instruction>`;

  return basePrompt;
} 
