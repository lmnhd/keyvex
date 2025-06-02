// Mock data for workflow testing
export const mockWorkflow = [
  {
    id: 'target-audience',
    question: 'Who is your target audience?',
    inputType: 'multiSelect',
    allowCustom: true,
    maxSelections: 2,
    options: [
      { value: 'small-business-owners', label: 'Small Business Owners' },
      { value: 'entrepreneurs', label: 'Entrepreneurs' },
      { value: 'marketing-professionals', label: 'Marketing Professionals' },
      { value: 'sales-teams', label: 'Sales Teams' },
      { value: 'consultants', label: 'Consultants' },
      { value: 'freelancers', label: 'Freelancers' },
      { value: 'agencies', label: 'Agencies' }
    ]
  },
  {
    id: 'features-wanted',
    message: "Great choice! Which features would you like to include in your calculator? (Select all that apply)",
    inputType: 'multiSelect',
    options: [
      { value: 'charts', label: 'Charts' },
      { value: 'export', label: 'PDF Export' },
      { value: 'email', label: 'Email Results' },
      { value: 'comparison', label: 'Comparison' },
      { value: 'sharing', label: 'Sharing' },
      { value: 'branding', label: 'Branding' }
    ],
    maxSelections: 4
  },
  {
    id: 'color-scheme',
    message: "Perfect! Now let's choose colors that represent your brand. Pick your primary color scheme:",
    inputType: 'colorSelect',
    options: [
      { value: 'professional-blue', label: 'Professional Blue', colors: ['#2563eb', '#1e40af'] },
      { value: 'modern-green', label: 'Modern Green', colors: ['#059669', '#047857'] },
      { value: 'elegant-purple', label: 'Elegant Purple', colors: ['#7c3aed', '#5b21b6'] },
      { value: 'warm-orange', label: 'Warm Orange', colors: ['#ea580c', '#c2410c'] },
      { value: 'bold-red', label: 'Bold Red', colors: ['#dc2626', '#b91c1c'] },
      { value: 'calm-teal', label: 'Calm Teal', colors: ['#0891b2', '#0e7490'] }
    ],
    allowCustom: true
  },
  {
    id: 'confidence-level',
    message: "How confident are you about your calculator's target audience and value proposition?",
    inputType: 'yesNoMaybe',
    options: [
      { value: 'yes', label: 'Very Confident' },
      { value: 'no', label: 'Need Help' },
      { value: 'maybe', label: 'Somewhat Sure' }
    ]
  },
  {
    id: 'business-description',
    message: "Excellent! Now tell me about your business and the specific problem this calculator will solve for your customers.",
    inputType: 'textarea',
    placeholder: 'Describe your business, target audience, the problem you solve, and how this calculator fits into your customer journey...',
    rows: 5
  },
  {
    id: 'multi-part-setup',
    message: "Perfect! Now I'll ask you a series of quick questions to fine-tune your calculator. Let's go through them one by one:",
    inputType: 'multiPart',
    questions: [
      {
        id: 'target-audience',
        question: "Who is your primary target audience?",
        inputType: 'select',
        options: [
          { value: 'small-business', label: 'Small Business Owners (1-50 employees)' },
          { value: 'mid-market', label: 'Mid-Market Companies (51-500 employees)' },
          { value: 'enterprise', label: 'Enterprise Organizations (500+ employees)' },
          { value: 'consultants', label: 'Consultants & Agencies' },
          { value: 'individuals', label: 'Individual Professionals' },
          { value: 'startups', label: 'Startups & Entrepreneurs' }
        ],
        allowCustom: true
      },
      {
        id: 'industry-focus',
        question: "What industry or sector do you primarily serve?",
        inputType: 'textarea',
        placeholder: 'e.g., Healthcare, Technology, Manufacturing, Professional Services...',
        rows: 2,
        suggestions: [
          'Technology',
          'Healthcare', 
          'Financial Services',
          'Manufacturing',
          'Professional Services',
          'E-commerce',
          'Education',
          'Real Estate'
        ]
      },
      {
        id: 'calculator-name',
        question: "What should we call your calculator?",
        inputType: 'textarea',
        placeholder: 'e.g., "ROI Calculator for Marketing Campaigns"',
        rows: 2,
        suggestions: [
          'ROI Calculator',
          'Cost Savings Calculator', 
          'Business Value Calculator',
          'Investment Calculator',
          'Pricing Calculator'
        ]
      },
      {
        id: 'key-metrics',
        question: "What are the main metrics or outputs your users want to see?",
        inputType: 'multiSelect',
        options: [
          { value: 'roi-percentage', label: 'ROI Percentage' },
          { value: 'dollar-savings', label: 'Dollar Savings' },
          { value: 'time-saved', label: 'Time Saved' },
          { value: 'efficiency-gain', label: 'Efficiency Gains' },
          { value: 'cost-reduction', label: 'Cost Reduction' },
          { value: 'revenue-increase', label: 'Revenue Increase' }
        ],
        maxSelections: 3
      }
    ]
  },
  {
    id: 'final-customization',
    message: "Almost done! Any final customizations, special requirements, or additional features you'd like to add?",
    inputType: 'textarea',
    placeholder: 'Describe any special calculations, integrations, design preferences, or unique features you need...',
    rows: 4
  }
];

// New mock workflow specifically for testing the multi-question iterator
export const iteratorTestWorkflow = [
  {
    id: 'welcome-iterator',
    message: "Welcome to the Multi-Question Iterator Test! This flow will demonstrate how the iterator component works with various question types.",
    inputType: 'textarea',
    placeholder: 'Tell me what you\'d like to test about the iterator component...',
    rows: 3
  },
  {
    id: 'basic-info-collection',
    message: "Let's collect some basic information about you. I'll ask you 5 questions in sequence:",
    inputType: 'multiPart',
    questions: [
      {
        id: 'full-name',
        question: "What's your full name?",
        inputType: 'textarea',
        placeholder: 'Enter your first and last name...',
        rows: 2,
        suggestions: ['John Smith', 'Jane Doe', 'Alex Johnson']
      },
      {
        id: 'company-role',
        question: "What's your role at your company?",
        inputType: 'select',
        options: [
          { value: 'ceo', label: 'CEO/Founder' },
          { value: 'marketing', label: 'Marketing Manager' },
          { value: 'sales', label: 'Sales Manager' },
          { value: 'operations', label: 'Operations Manager' },
          { value: 'consultant', label: 'Consultant' },
          { value: 'other', label: 'Other' }
        ],
        allowCustom: true
      },
      {
        id: 'experience-level',
        question: "How many years of experience do you have in your field?",
        inputType: 'select',
        options: [
          { value: '0-2', label: '0-2 years' },
          { value: '3-5', label: '3-5 years' },
          { value: '6-10', label: '6-10 years' },
          { value: '11-15', label: '11-15 years' },
          { value: '15+', label: '15+ years' }
        ]
      },
      {
        id: 'primary-goals',
        question: "What are your primary business goals this year? (Select up to 3)",
        inputType: 'multiSelect',
        options: [
          { value: 'increase-revenue', label: 'Increase Revenue' },
          { value: 'reduce-costs', label: 'Reduce Costs' },
          { value: 'improve-efficiency', label: 'Improve Efficiency' },
          { value: 'expand-market', label: 'Expand Market Share' },
          { value: 'launch-products', label: 'Launch New Products' },
          { value: 'improve-customer-satisfaction', label: 'Improve Customer Satisfaction' }
        ],
        maxSelections: 3
      },
      {
        id: 'biggest-challenge',
        question: "What's your biggest business challenge right now?",
        inputType: 'textarea',
        placeholder: 'Describe the most pressing challenge your business is facing...',
        rows: 3,
        suggestions: [
          'Finding new customers',
          'Improving operational efficiency', 
          'Managing cash flow',
          'Scaling the team',
          'Competitive pressure'
        ]
      }
    ]
  },
  {
    id: 'preferences-testing',
    message: "Great! Now let's test different input types with your preferences:",
    inputType: 'multiPart',
    questions: [
      {
        id: 'communication-style',
        question: "How do you prefer to communicate with clients?",
        inputType: 'yesNoMaybe',
        options: [
          { value: 'formal', label: 'Formal' },
          { value: 'casual', label: 'Casual' },
          { value: 'mixed', label: 'Mixed' }
        ]
      },
      {
        id: 'work-schedule',
        question: "What's your typical work schedule?",
        inputType: 'select',
        options: [
          { value: 'traditional', label: 'Traditional 9-5' },
          { value: 'flexible', label: 'Flexible Hours' },
          { value: 'remote', label: 'Remote/Distributed' },
          { value: 'freelance', label: 'Freelance/Project-based' }
        ]
      },
      {
        id: 'favorite-tools',
        question: "Which business tools do you use regularly? (Select all that apply)",
        inputType: 'multiSelect',
        options: [
          { value: 'slack', label: 'Slack' },
          { value: 'zoom', label: 'Zoom' },
          { value: 'notion', label: 'Notion' },
          { value: 'google-workspace', label: 'Google Workspace' },
          { value: 'microsoft-365', label: 'Microsoft 365' },
          { value: 'salesforce', label: 'Salesforce' },
          { value: 'hubspot', label: 'HubSpot' },
          { value: 'asana', label: 'Asana' },
          { value: 'trello', label: 'Trello' }
        ],
        maxSelections: 5
      }
    ]
  },
  {
    id: 'final-feedback',
    message: "Perfect! Finally, please share any feedback about this multi-question experience:",
    inputType: 'textarea',
    placeholder: 'How was the experience? Any suggestions for improvement?',
    rows: 4
  }
];

// 🎲 10 Creative Calculator Types for Random Testing
export const calculatorTypes = [
  {
    userIntent: 'Create a carbon footprint calculator for eco-conscious businesses',
    toolType: 'environmental-calculator',
    targetAudience: 'sustainability managers',
    industry: 'environmental consulting',
    features: ['emissions tracking', 'offset recommendations', 'reporting'],
    businessDescription: 'Calculate and reduce your organization\'s carbon footprint with actionable insights'
  },
  {
    userIntent: 'Build a wedding budget calculator with vendor comparisons',
    toolType: 'budget-calculator',
    targetAudience: 'engaged couples',
    industry: 'wedding planning',
    features: ['vendor tracking', 'payment scheduling', 'guest count impact'],
    businessDescription: 'Plan your dream wedding while staying within budget with smart vendor recommendations'
  },
  {
    userIntent: 'Design a freelancer rate calculator with market analysis',
    toolType: 'pricing-calculator',
    targetAudience: 'freelancers and consultants',
    industry: 'professional services',
    features: ['market rates', 'experience weighting', 'project complexity'],
    businessDescription: 'Determine competitive freelance rates based on skills, experience, and market demand'
  },
  {
    userIntent: 'Create a solar panel savings calculator for homeowners',
    toolType: 'savings-calculator',
    targetAudience: 'homeowners',
    industry: 'renewable energy',
    features: ['energy savings', 'tax incentives', 'payback period'],
    businessDescription: 'Calculate potential savings from solar panel installation with incentive analysis'
  },
  {
    userIntent: 'Build a restaurant profitability calculator with menu optimization',
    toolType: 'profit-calculator',
    targetAudience: 'restaurant owners',
    industry: 'food service',
    features: ['ingredient costs', 'labor analysis', 'menu pricing'],
    businessDescription: 'Optimize menu pricing and track restaurant profitability with cost analysis'
  },
  {
    userIntent: 'Design a crypto portfolio diversification calculator',
    toolType: 'investment-calculator',
    targetAudience: 'cryptocurrency investors',
    industry: 'financial services',
    features: ['risk assessment', 'allocation recommendations', 'rebalancing alerts'],
    businessDescription: 'Build a balanced crypto portfolio with risk-adjusted diversification strategies'
  },
  {
    userIntent: 'Create a pet care cost calculator for new pet owners',
    toolType: 'cost-calculator',
    targetAudience: 'prospective pet owners',
    industry: 'pet care',
    features: ['lifetime costs', 'breed comparisons', 'healthcare planning'],
    businessDescription: 'Understand the true cost of pet ownership with comprehensive care planning'
  },
  {
    userIntent: 'Build a productivity score calculator for remote teams',
    toolType: 'assessment-calculator',
    targetAudience: 'remote team managers',
    industry: 'human resources',
    features: ['team metrics', 'improvement suggestions', 'benchmark comparisons'],
    businessDescription: 'Measure and improve remote team productivity with data-driven insights'
  },
  {
    userIntent: 'Design a real estate investment analyzer with market trends',
    toolType: 'investment-analyzer',
    targetAudience: 'real estate investors',
    industry: 'real estate',
    features: ['cash flow analysis', 'market comparisons', 'financing options'],
    businessDescription: 'Analyze real estate investment opportunities with comprehensive market data'
  },
  {
    userIntent: 'Create a fitness goal calculator with personalized workout plans',
    toolType: 'fitness-calculator',
    targetAudience: 'fitness enthusiasts',
    industry: 'health and wellness',
    features: ['goal tracking', 'calorie calculations', 'progress milestones'],
    businessDescription: 'Set and achieve fitness goals with personalized workout and nutrition planning'
  }
];

// Random calculator selection helper
export const getRandomCalculatorType = () => {
  const randomIndex = Math.floor(Math.random() * calculatorTypes.length);
  return calculatorTypes[randomIndex];
}; 