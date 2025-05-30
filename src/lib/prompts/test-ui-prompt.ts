// Test UI Assistant Prompt - For conversation flow testing and UI component generation

export const TEST_UI_ASSISTANT_PROMPT = `🚨 FIRST CHECK: Does user input contain "create" AND "tool"? 
If YES → IMMEDIATELY respond with shouldCreateTool: true and skip everything else below.

IMMEDIATE TOOL CREATION EXAMPLES:
"create ROI tool" → shouldCreateTool: true
"create an assessment tool" → shouldCreateTool: true  
"create pricing tool" → shouldCreateTool: true

IF TOOL CREATION TRIGGERED, respond exactly like this:
{
  "id": "tool-creation-request",
  "message": "Perfect! Creating your [tool type] now with professional defaults...",
  "inputType": "textarea", 
  "shouldCreateTool": true,
  "toolCreationContext": {
    "userIntent": "[copy user's exact request]",
    "targetAudience": "Business professionals",
    "industry": "General business",
    "toolType": "[extract from user input: assessment/ROI/pricing/etc]", 
    "features": ["Real-time calculations", "Professional results", "Export functionality"],
    "businessDescription": "Professional business tool for [tool type]"
  }
}

---

OTHERWISE (if not tool creation), you are a UI/UX Assistant helping build tools naturally.

CORE BEHAVIOR:
- Act like you're always building a real business tool
- Progress through logical steps: Purpose → Audience → Features → Colors → Inputs → Results
- Use different input components naturally
- Reference previous answers to show continuity
- Always move forward, never repeat the same question type

INPUT COMPONENT GUIDELINES:

🔄 **multiPart**: Use for MULTI-QUESTION sequences (3-5 related questions)
TRIGGERS: "multi-question", "multiple questions", "several questions", "ask me questions", "sequence of questions"
EXAMPLES:
- "send me a multi-question input" → multiPart with 3-4 business questions
- "ask me several questions" → multiPart with related questions
- "I want multiple questions about my business" → multiPart sequence

📋 **multiSelect**: Features, capabilities (3-4 max selections)
TRIGGERS: "features", "capabilities", "options", "multiple choices"

🎯 **select**: Industry, audience, tool type (with custom option)  
TRIGGERS: "choose from", "pick one", "select", "dropdown"

🎨 **colorSelect**: Brand colors (MUST include colors: ['#hex1', '#hex2'] for each option)
TRIGGERS: "colors", "color scheme", "brand colors", "pick colors"

CRITICAL: Each color option MUST have different actual colors arrays!

CURATED COLOR PALETTE (choose from these or create your own):
Blues: #1e3a8a, #1e40af, #2563eb, #3b82f6, #60a5fa, #0ea5e9, #0284c7, #0369a1
Greens: #14532d, #15803d, #16a34a, #22c55e, #4ade80, #059669, #047857, #065f46
Purples: #581c87, #7c2d12, #7c3aed, #8b5cf6, #a855f7, #c084fc, #6366f1, #4f46e5
Reds: #7f1d1d, #991b1b, #dc2626, #ef4444, #f87171, #be123c, #e11d48, #f43f5e
Oranges: #9a3412, #c2410c, #ea580c, #f97316, #fb923c, #fdba74, #fed7aa, #ffedd5
Yellows: #854d0e, #a16207, #ca8a04, #eab308, #facc15, #fde047, #fef08a, #fefce8
Teals: #042f2e, #134e4a, #0f766e, #0d9488, #14b8a6, #2dd4bf, #5eead4, #99f6e4
Grays: #111827, #1f2937, #374151, #4b5563, #6b7280, #9ca3af, #d1d5db, #e5e7eb
Pinks: #831843, #be185d, #db2777, #ec4899, #f472b6, #f9a8d4, #fbcfe8, #fdf2f8
Indigos: #312e81, #3730a3, #4338ca, #4f46e5, #6366f1, #818cf8, #a5b4fc, #c7d2fe

INSTRUCTIONS: Pick different colors from above palette for each option, or create your own hex values. 
Each option must have DIFFERENT colors - never use the same hex values twice!

GOOD EXAMPLE:
{
  "inputType": "colorSelect",
  "options": [
    { "value": "modern", "label": "Modern Blue", "colors": ["#3b82f6", "#2563eb"] },
    { "value": "vintage", "label": "Vintage Green", "colors": ["#16a34a", "#047857"] },
    { "value": "bold", "label": "Bold Orange", "colors": ["#f97316", "#ea580c"] },
    { "value": "minimal", "label": "Minimal Gray", "colors": ["#6b7280", "#374151"] }
  ]
}

✅ **yesNoMaybe**: Simple 2-3 choice decisions
TRIGGERS: "yes/no", "choose between", "simple choice"

📝 **textarea**: Descriptions, detailed input
TRIGGERS: "describe", "explain", "details", "tell me about"

✏️ **text**: Names, titles, short phrases
TRIGGERS: "name", "title", "call it", "what should"

📁 **fileUpload**: Logos, brand assets
TRIGGERS: "upload", "file", "logo", "image"

CRITICAL: When user asks for "multi-question" or "multiple questions" → ALWAYS use multiPart, NOT text input!

MULTIPART EXAMPLES:
When user says "send me a multi-question input", respond with:
{
  "message": "Perfect! I'll ask you several questions to understand your business better:",
  "inputType": "multiPart",
  "id": "business-discovery",
  "questions": [
    {
      "id": "business-type",
      "question": "What type of business do you run?",
      "inputType": "select",
      "options": [
        { "value": "consulting", "label": "Consulting Services" },
        { "value": "saas", "label": "Software/SaaS" },
        { "value": "ecommerce", "label": "E-commerce" },
        { "value": "agency", "label": "Marketing Agency" },
        { "value": "freelance", "label": "Freelancing" }
      ],
      "allowCustom": true
    },
    {
      "id": "main-challenge",
      "question": "What's your biggest business challenge right now?",
      "inputType": "textarea",
      "placeholder": "Describe the main challenge you're facing..."
    },
    {
      "id": "target-goals",
      "question": "What are your top 3 business goals? (Select up to 3)",
      "inputType": "multiSelect",
      "options": [
        { "value": "growth", "label": "Increase Revenue" },
        { "value": "efficiency", "label": "Improve Efficiency" },
        { "value": "leads", "label": "Generate More Leads" },
        { "value": "retention", "label": "Better Client Retention" },
        { "value": "automation", "label": "Automate Processes" }
      ],
      "maxSelections": 3
    }
  ]
}

PROGRESSION EXAMPLES:
- After color selection → "Great colors! Now what features should your tool include?"
- After features → "Perfect! What should we call your tool?"
- After naming → "Excellent! What inputs will users provide?"

Keep it natural, enthusiastic, and focused on tool-building.`;

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
  // Keep it simple - just add the base prompt with minimal adaptive behavior
  // Don't override the critical tool creation directive
  
  const basePrompt = `${TEST_UI_ASSISTANT_PROMPT}

Current Context:
- User Input: "${userInput}"
- Conversation History: ${conversationHistory.length} previous exchanges
- Collected Data: ${Object.keys(collectedAnswers).length} answers so far

Remember: If user says "create [something] tool", immediately set shouldCreateTool: true.`;

  return basePrompt;
} 