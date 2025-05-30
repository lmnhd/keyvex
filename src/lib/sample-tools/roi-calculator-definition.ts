import { ToolDefinition } from '@/lib/types/tool-definition';

// ============================================================================
// SAMPLE ROI CALCULATOR TOOL DEFINITION
// ============================================================================

export const roiCalculatorDefinition: ToolDefinition = {
  id: 'roi-calculator-v1',
  version: '1.0.0',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  
  // ============================================================================
  // METADATA
  // ============================================================================
  metadata: {
    title: 'Marketing ROI Calculator',
    description: 'Calculate your marketing return on investment with precision and discover optimization opportunities.',
    type: 'calculator',
    category: 'roi-calculator',
    targetAudience: 'Marketing managers, business owners, and consultants',
    industry: 'Marketing & Business',
    tags: ['roi', 'marketing', 'calculator', 'business-metrics'],
    estimatedCompletionTime: 3,
    difficultyLevel: 'beginner',
    features: ['Real-time calculations', 'Visual results', 'Detailed breakdown', 'Export ready'],
    icon: {
      type: 'lucide',
      value: 'TrendingUp'
    }
  },
  
  // ============================================================================
  // LAYOUT STRUCTURE
  // ============================================================================
  layout: {
    type: 'single-page',
    structure: {
      container: {
        maxWidth: '2xl',
        padding: 'p-8',
        alignment: 'center'
      },
      sections: [
        {
          id: 'header',
          type: 'header',
          layout: 'vertical',
          order: 1
        },
        {
          id: 'inputs',
          type: 'content',
          layout: 'vertical',
          order: 2
        },
        {
          id: 'results',
          type: 'results',
          layout: 'grid',
          order: 3,
          span: {
            columns: 2
          }
        }
      ],
      flow: {
        type: 'linear'
      }
    },
    responsive: {
      breakpoints: {
        sm: 'grid-cols-1',
        md: 'grid-cols-2',
        lg: 'grid-cols-2',
        xl: 'grid-cols-2'
      }
    },
    animation: {
      enabled: true,
      duration: 300,
      easing: 'ease-in-out'
    }
  },
  
  // ============================================================================
  // COMPONENTS
  // ============================================================================
  components: [
    // Input Components
    {
      id: 'revenue',
      type: 'currency-input',
      sectionId: 'inputs',
      order: 1,
      props: {
        label: 'Monthly Revenue Generated',
        placeholder: 'Enter your monthly revenue',
        helperText: 'Total revenue attributed to your marketing efforts',
        required: true,
        min: 0,
        step: 100
      }
    },
    {
      id: 'marketing-spend',
      type: 'currency-input',
      sectionId: 'inputs',
      order: 2,
      props: {
        label: 'Marketing Investment',
        placeholder: 'Enter your marketing spend',
        helperText: 'Total amount invested in marketing campaigns',
        required: true,
        min: 0,
        step: 50
      }
    },
    {
      id: 'time-period',
      type: 'select',
      sectionId: 'inputs',
      order: 3,
      props: {
        label: 'Time Period',
        placeholder: 'Select time period',
        helperText: 'Period for which you want to calculate ROI',
        required: true,
        options: [
          { value: '1', label: '1 Month' },
          { value: '3', label: '3 Months' },
          { value: '6', label: '6 Months' },
          { value: '12', label: '1 Year' }
        ]
      }
    },
    {
      id: 'customer-lifetime-value',
      type: 'currency-input',
      sectionId: 'inputs',
      order: 4,
      props: {
        label: 'Average Customer Lifetime Value (Optional)',
        placeholder: 'Enter CLV if known',
        helperText: 'Average value a customer brings over their lifetime',
        min: 0,
        step: 50
      }
    },
    
    // Action Button
    {
      id: 'calculate-button',
      type: 'button',
      sectionId: 'inputs',
      order: 5,
      props: {
        text: 'Calculate ROI',
        variant: 'default',
        size: 'lg',
        className: 'w-full mt-4'
      }
    },
    
    // Results Components
    {
      id: 'roi-percentage',
      type: 'calculation-display',
      sectionId: 'results',
      order: 1,
      props: {
        label: 'Return on Investment',
        formula: '((revenue - marketing_spend) / marketing_spend) * 100',
        dependencies: ['revenue', 'marketing-spend'],
        format: {
          type: 'percentage',
          decimals: 1
        },
        className: 'text-center'
      }
    },
    {
      id: 'profit-amount',
      type: 'calculation-display',
      sectionId: 'results',
      order: 2,
      props: {
        label: 'Net Profit',
        formula: 'revenue - marketing_spend',
        dependencies: ['revenue', 'marketing-spend'],
        format: {
          type: 'currency',
          currency: 'USD',
          decimals: 0
        },
        className: 'text-center'
      }
    },
    {
      id: 'revenue-multiple',
      type: 'calculation-display',
      sectionId: 'results',
      order: 3,
      props: {
        label: 'Revenue Multiple',
        formula: 'marketing_spend > 0 ? revenue / marketing_spend : 0',
        dependencies: ['revenue', 'marketing-spend'],
        format: {
          type: 'decimal',
          decimals: 2,
          suffix: 'x'
        },
        className: 'text-center'
      }
    },
    {
      id: 'break-even-point',
      type: 'calculation-display',
      sectionId: 'results',
      order: 4,
      props: {
        label: 'Break-even Revenue',
        formula: 'marketing_spend',
        dependencies: ['marketing-spend'],
        format: {
          type: 'currency',
          currency: 'USD',
          decimals: 0
        },
        className: 'text-center'
      }
    },
    
    // Result Interpretation
    {
      id: 'interpretation',
      type: 'card',
      sectionId: 'results',
      order: 5,
      props: {
        title: 'ROI Interpretation',
        text: 'Your marketing ROI will be calculated above. A positive ROI means your marketing is profitable.',
        className: 'col-span-2 mt-4'
      }
    }
  ],
  
  // ============================================================================
  // STYLING
  // ============================================================================
  styling: {
    theme: {
      name: 'professional',
      mode: 'light',
      borderRadius: 'md',
      shadows: 'md',
      effects: {
        blur: false,
        gradient: true,
        noise: true
      }
    },
    colors: {
      primary: '#2563eb',
      secondary: '#1e40af',
      accent: '#3b82f6',
      background: '#ffffff',
      surface: '#f8fafc',
      text: {
        primary: '#1e293b',
        secondary: '#475569',
        muted: '#64748b'
      },
      border: '#e2e8f0',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    },
    typography: {
      fontFamily: {
        primary: 'Inter, sans-serif',
        secondary: 'Inter, sans-serif'
      },
      scale: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem'
      },
      weights: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700
      }
    },
    spacing: {
      scale: {
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem'
      }
    }
  },
  
  // ============================================================================
  // LOGIC & CALCULATIONS
  // ============================================================================
  logic: {
    calculations: [
      {
        id: 'roi-calculation',
        name: 'ROI Percentage',
        description: 'Calculate return on investment as a percentage',
        formula: '((revenue - marketing_spend) / marketing_spend) * 100',
        dependencies: ['revenue', 'marketing-spend'],
        outputComponentId: 'roi-percentage',
        triggers: [
          { event: 'change', debounce: 500 }
        ],
        format: {
          type: 'percentage',
          decimals: 1
        }
      },
      {
        id: 'profit-calculation',
        name: 'Net Profit',
        description: 'Calculate net profit from marketing',
        formula: 'revenue - marketing_spend',
        dependencies: ['revenue', 'marketing-spend'],
        outputComponentId: 'profit-amount',
        triggers: [
          { event: 'change', debounce: 500 }
        ],
        format: {
          type: 'currency',
          currency: 'USD'
        }
      },
      {
        id: 'revenue-multiple-calculation',
        name: 'Revenue Multiple',
        description: 'Calculate how many times revenue exceeds spend',
        formula: 'marketing_spend > 0 ? revenue / marketing_spend : 0',
        dependencies: ['revenue', 'marketing-spend'],
        outputComponentId: 'revenue-multiple',
        triggers: [
          { event: 'change', debounce: 500 }
        ],
        format: {
          type: 'decimal',
          decimals: 2,
          suffix: 'x'
        }
      }
    ],
    
    conditions: [
      {
        id: 'positive-roi-condition',
        condition: 'revenue > marketing_spend',
        dependencies: ['revenue', 'marketing-spend'],
        actions: [
          {
            type: 'addClass',
            target: '#roi-percentage',
            value: 'text-green-600'
          }
        ]
      },
      {
        id: 'negative-roi-condition',
        condition: 'revenue <= marketing_spend',
        dependencies: ['revenue', 'marketing-spend'],
        actions: [
          {
            type: 'addClass',
            target: '#roi-percentage',
            value: 'text-red-600'
          }
        ]
      }
    ],
    
    actions: [],
    formulas: []
  },
  
  // ============================================================================
  // VALIDATION
  // ============================================================================
  validation: {
    components: [
      {
        componentId: 'revenue',
        rules: [
          { type: 'required', message: 'Revenue is required' },
          { type: 'min', value: 0, message: 'Revenue must be positive' }
        ]
      },
      {
        componentId: 'marketing-spend',
        rules: [
          { type: 'required', message: 'Marketing spend is required' },
          { type: 'min', value: 0, message: 'Marketing spend must be positive' }
        ]
      },
      {
        componentId: 'time-period',
        rules: [
          { type: 'required', message: 'Please select a time period' }
        ]
      }
    ],
    global: []
  }
};

// ============================================================================
// SAMPLE QUIZ TOOL DEFINITION
// ============================================================================

export const leadQualifierQuizDefinition: ToolDefinition = {
  id: 'lead-qualifier-quiz-v1',
  version: '1.0.0',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  
  metadata: {
    title: 'Business Readiness Assessment',
    description: 'Discover if your business is ready for digital transformation with our comprehensive assessment.',
    type: 'quiz',
    category: 'lead-qualifier',
    targetAudience: 'Business owners and decision makers',
    industry: 'Business Consulting',
    tags: ['assessment', 'digital-transformation', 'business-readiness'],
    estimatedCompletionTime: 5,
    difficultyLevel: 'intermediate',
    features: ['Personalized results', 'Instant scoring', 'Action recommendations'],
    icon: {
      type: 'lucide',
      value: 'ClipboardCheck'
    }
  },
  
  layout: {
    type: 'multi-step',
    structure: {
      container: {
        maxWidth: '2xl',
        padding: 'p-8',
        alignment: 'center'
      },
      sections: [
        {
          id: 'header',
          type: 'header',
          layout: 'vertical',
          order: 1
        },
        {
          id: 'questions',
          type: 'content',
          layout: 'vertical',
          order: 2
        },
        {
          id: 'results',
          type: 'results',
          layout: 'vertical',
          order: 3
        }
      ],
      flow: {
        type: 'linear',
        steps: [
          {
            id: 'step-1',
            title: 'Current State',
            description: 'Tell us about your current business situation',
            componentIds: ['current-revenue', 'team-size', 'tech-adoption']
          },
          {
            id: 'step-2',
            title: 'Goals & Challenges',
            description: 'What are your primary objectives?',
            componentIds: ['primary-goals', 'biggest-challenges']
          },
          {
            id: 'step-3',
            title: 'Results',
            description: 'Your personalized assessment results',
            componentIds: ['readiness-score', 'recommendations']
          }
        ],
        navigation: {
          showSteps: true,
          showProgress: true,
          allowSkip: false,
          allowBack: true,
          buttons: {
            next: 'Continue',
            previous: 'Back',
            finish: 'Get My Results'
          }
        }
      }
    },
    responsive: {
      breakpoints: {
        sm: 'max-w-sm',
        md: 'max-w-2xl',
        lg: 'max-w-2xl',
        xl: 'max-w-2xl'
      }
    }
  },
  
  components: [
    // Step 1 Components
    {
      id: 'current-revenue',
      type: 'select',
      sectionId: 'questions',
      order: 1,
      props: {
        label: 'What is your current annual revenue?',
        required: true,
        options: [
          { value: '1', label: 'Under $100k' },
          { value: '2', label: '$100k - $500k' },
          { value: '3', label: '$500k - $1M' },
          { value: '4', label: '$1M - $5M' },
          { value: '5', label: 'Over $5M' }
        ]
      }
    },
    {
      id: 'team-size',
      type: 'select',
      sectionId: 'questions',
      order: 2,
      props: {
        label: 'How many people are in your team?',
        required: true,
        options: [
          { value: '1', label: 'Just me (1)' },
          { value: '2', label: 'Small team (2-10)' },
          { value: '3', label: 'Medium team (11-50)' },
          { value: '4', label: 'Large team (50+)' }
        ]
      }
    },
    {
      id: 'tech-adoption',
      type: 'radio-group',
      sectionId: 'questions',
      order: 3,
      props: {
        label: 'How would you rate your current technology adoption?',
        required: true,
        options: [
          { value: '1', label: 'Basic (Email, basic software)' },
          { value: '2', label: 'Moderate (Some digital tools)' },
          { value: '3', label: 'Advanced (Comprehensive tech stack)' }
        ]
      }
    },
    
    // Step 2 Components
    {
      id: 'primary-goals',
      type: 'checkbox-group',
      sectionId: 'questions',
      order: 4,
      props: {
        label: 'What are your primary business goals? (Select all that apply)',
        required: true,
        options: [
          { value: 'growth', label: 'Increase revenue and growth' },
          { value: 'efficiency', label: 'Improve operational efficiency' },
          { value: 'customer', label: 'Enhance customer experience' },
          { value: 'competition', label: 'Stay competitive in market' },
          { value: 'automation', label: 'Automate manual processes' }
        ]
      }
    },
    {
      id: 'biggest-challenges',
      type: 'select',
      sectionId: 'questions',
      order: 5,
      props: {
        label: 'What is your biggest challenge right now?',
        required: true,
        options: [
          { value: 'time', label: 'Not enough time' },
          { value: 'budget', label: 'Limited budget' },
          { value: 'knowledge', label: 'Lack of technical knowledge' },
          { value: 'team', label: 'Team resistance to change' },
          { value: 'strategy', label: 'Unclear digital strategy' }
        ]
      }
    },
    
    // Results Components
    {
      id: 'readiness-score',
      type: 'score-display',
      sectionId: 'results',
      order: 6,
      props: {
        label: 'Your Digital Readiness Score',
        formula: 'parseInt(current_revenue || "0") + parseInt(team_size || "0") + parseInt(tech_adoption || "0")',
        dependencies: ['current-revenue', 'team-size', 'tech-adoption'],
        format: {
          type: 'number',
          suffix: '/15'
        }
      }
    },
    {
      id: 'recommendations',
      type: 'recommendation',
      sectionId: 'results',
      order: 7,
      props: {
        title: 'Personalized Recommendations',
        text: 'Based on your responses, here are your next steps...'
      }
    }
  ],
  
  styling: {
    theme: {
      name: 'modern',
      mode: 'light',
      borderRadius: 'lg',
      shadows: 'lg',
      effects: {
        blur: true,
        gradient: true,
        noise: false
      }
    },
    colors: {
      primary: '#059669',
      secondary: '#047857',
      accent: '#10b981',
      background: '#ffffff',
      surface: '#ecfdf5',
      text: {
        primary: '#1e293b',
        secondary: '#475569',
        muted: '#64748b'
      },
      border: '#d1fae5',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    },
    typography: {
      fontFamily: {
        primary: 'Inter, sans-serif'
      },
      scale: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem'
      },
      weights: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700
      }
    },
    spacing: {
      scale: {
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem'
      }
    }
  },
  
  logic: {
    calculations: [
      {
        id: 'readiness-score-calc',
        name: 'Digital Readiness Score',
        formula: 'parseInt(current_revenue || "0") + parseInt(team_size || "0") + parseInt(tech_adoption || "0")',
        dependencies: ['current-revenue', 'team-size', 'tech-adoption'],
        outputComponentId: 'readiness-score',
        triggers: [{ event: 'change' }]
      }
    ],
    conditions: [],
    actions: [],
    formulas: []
  },
  
  validation: {
    components: [
      {
        componentId: 'current-revenue',
        rules: [{ type: 'required', message: 'Please select your revenue range' }]
      },
      {
        componentId: 'team-size',
        rules: [{ type: 'required', message: 'Please select your team size' }]
      },
      {
        componentId: 'tech-adoption',
        rules: [{ type: 'required', message: 'Please rate your tech adoption' }]
      }
    ],
    global: []
  }
}; 