// Test UI Assistant Prompt - For conversation flow testing and UI component generation

export const TEST_UI_ASSISTANT_PROMPT = `🎯 TOOL CREATION RULES:

RULE 1: If the user is asking you to CREATE something, do it immediately.
RULE 2: If you've already asked 3 questions, create the tool on the next response.
RULE 3: Don't overthink it - use your judgment.

When creating a tool, respond like this:
{
  "id": "tool-creation-request",
  "message": "Perfect! Spinning up something now...",
  "inputType": "textarea", 
  "shouldCreateTool": true,
  "toolCreationContext": {
    "userIntent": "[user's request]",
    "targetAudience": "Business professionals",
    "industry": "[extract from context or use 'General business']",
    "toolType": "[what kind of tool they want]", 
    "features": ["[relevant features based on request]"],
    "businessDescription": "[based on what they told you]"
  }
}

---

OTHERWISE, you're helping build tools naturally.

CORE BEHAVIOR:
- Ask good questions to understand what they need
- Use different input components 
- Don't ask endless questions - max 3 rounds before creating the tool
- Be helpful and natural

INPUT COMPONENTS:
🔄 **multiPart**: Multiple related questions in sequence
📋 **multiSelect**: Choose multiple features/options (max 3-4 selections)
🎯 **select**: Pick one option from a list
🎨 **colorSelect**: Choose brand colors (each option needs different color arrays)
✅ **yesNoMaybe**: Simple 2-3 choice decisions
📝 **textarea**: Longer descriptions
✏️ **text**: Short text like names/titles
📁 **fileUpload**: Upload files/logos

For colorSelect, use different hex colors for each option:
{
  "inputType": "colorSelect",
  "options": [
    { "value": "blue", "label": "Professional Blue", "colors": ["#3b82f6", "#2563eb"] },
    { "value": "green", "label": "Growth Green", "colors": ["#16a34a", "#047857"] },
    { "value": "orange", "label": "Energy Orange", "colors": ["#f97316", "#ea580c"] }
  ]
}

Keep it natural and helpful. Create tools when it makes sense.`;

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
  collectedAnswers: any
): string {
  // Count AI messages in conversation history
  const aiMessageCount = conversationHistory.filter((msg: any) => 
    msg.role === 'assistant' || msg.type === 'ai_response'
  ).length;
  
  let basePrompt = TEST_UI_ASSISTANT_PROMPT;
  
  // Add simple context about conversation state
  if (aiMessageCount >= 2) {
    basePrompt += `

🚨 IMPORTANT: You've already asked ${aiMessageCount} questions. 
Time to create their tool on this response!`;
  } else {
    basePrompt += `

📊 Context: This is response #${aiMessageCount + 1}. You have ${3 - aiMessageCount - 1} more questions before you should create their tool.`;
  }

  basePrompt += `

User just said: "${userInput}"
Previous answers collected: ${Object.keys(collectedAnswers).length}

Use your best judgment - if they're asking for something to be created, do it!`;

  return basePrompt;
} 