import { ToolConstructionContext } from "@/lib/types/tcc-unified";

export interface MockTccScenario {
  id: string;
  name: string;
  description: string;
  suitableFor: string[]; // Agent IDs this mock is suitable for
  complexity: 'simple' | 'medium' | 'complex';
  tcc: any; // Using any for now to avoid type issues - will be Partial<ToolConstructionContext>
}

export const mockTccScenarios: MockTccScenario[] = [
  // Scenario 1: Simple Calculator - For Function Planner
  {
    id: 'simple-calculator-function-planner',
    name: 'Simple Calculator (Function Planner Stage)',
    description: 'Basic calculator tool with minimal features - ready for function planning',
    complexity: 'simple',
    suitableFor: ['function-planner'],
    tcc: {
      jobId: 'mock-calc-001',
      userInput: {
        toolType: 'Simple Calculator',
        targetAudience: 'General Users',
        businessContext: 'A basic calculator for simple arithmetic operations',
        selectedModel: 'gpt-4o'
      },
      brainstormResult: {
        description: 'A simple calculator tool for basic arithmetic operations',
        targetAudience: 'General Users',
        toolType: 'Simple Calculator',
        features: [
          'Addition and subtraction',
          'Multiplication and division',
          'Clear button',
          'Display current calculation'
        ],
        designConsiderations: [
          'Clean, minimal interface',
          'Large, easy-to-click buttons',
          'Clear display of current operation'
        ]
      },
      agentModelMapping: {
        'function-planner': 'gpt-4o',
        'state-design': 'gpt-4-turbo',
        'jsx-layout': 'gpt-4-turbo',
        'tailwind-styling': 'claude-3-5-sonnet-20240620',
        'component-assembler': 'gpt-4-turbo',
        'validator': 'claude-3-5-sonnet-20240620',
        'tool-finalizer': 'gpt-4o'
      }
    }
  },

  // Scenario 2: ROI Calculator - For State Design (after Function Planner)
  {
    id: 'roi-calculator-state-design',
    name: 'ROI Calculator (State Design Stage)',
    description: 'Marketing ROI calculator with function signatures ready for state design',
    complexity: 'medium',
    suitableFor: ['state-design'],
    tcc: {
      jobId: 'mock-roi-001',
      userInput: {
        toolType: 'Marketing ROI Calculator',
        targetAudience: 'Marketing Managers',
        businessContext: 'Calculate return on investment for marketing campaigns',
        selectedModel: 'gpt-4o'
      },
      brainstormResult: {
        description: 'A comprehensive tool for calculating marketing campaign ROI',
        targetAudience: 'Marketing Managers at Small and Medium Businesses',
        toolType: 'Marketing ROI Calculator',
        features: [
          'Campaign cost input',
          'Revenue attribution tracking',
          'Time period selection',
          'ROI percentage calculation',
          'Profit/loss breakdown',
          'Historical comparison'
        ],
        designConsiderations: [
          'Professional business interface',
          'Clear data visualization',
          'Export functionality for reports'
        ]
      },
      functionSignatures: {
        calculateROI: {
          name: 'calculateROI',
          description: 'Calculate ROI based on investment and returns',
          parameters: [
            { name: 'investment', type: 'number', description: 'Total marketing investment' },
            { name: 'revenue', type: 'number', description: 'Revenue generated' },
            { name: 'timeframe', type: 'string', description: 'Campaign duration' }
          ],
          returnType: 'ROIResult'
        },
        formatCurrency: {
          name: 'formatCurrency',
          description: 'Format numbers as currency',
          parameters: [
            { name: 'amount', type: 'number', description: 'Amount to format' }
          ],
          returnType: 'string'
        }
      },
      agentModelMapping: {
        'function-planner': 'gpt-4o',
        'state-design': 'gpt-4-turbo',
        'jsx-layout': 'gpt-4-turbo',
        'tailwind-styling': 'claude-3-5-sonnet-20240620',
        'component-assembler': 'gpt-4-turbo',
        'validator': 'claude-3-5-sonnet-20240620',
        'tool-finalizer': 'gpt-4o'
      }
    }
  },

  // Scenario 3: Complex Dashboard - For JSX Layout (after State Design)
  {
    id: 'analytics-dashboard-jsx-layout',
    name: 'Analytics Dashboard (JSX Layout Stage)',
    description: 'Complex analytics dashboard ready for layout design',
    complexity: 'complex',
    suitableFor: ['jsx-layout'],
    tcc: {
      jobId: 'mock-dashboard-001',
      userInput: {
        toolType: 'Analytics Dashboard',
        targetAudience: 'Business Analysts',
        businessContext: 'Comprehensive analytics dashboard with multiple data visualizations',
        selectedModel: 'gpt-4o'
      },
      brainstormResult: {
        description: 'A comprehensive analytics dashboard with multiple chart types and data sources',
        targetAudience: 'Business Analysts and Data Scientists',
        toolType: 'Analytics Dashboard',
        features: [
          'Multiple chart types (bar, line, pie)',
          'Real-time data updates',
          'Filtering and date range selection',
          'Export to PDF/Excel',
          'Custom metric creation',
          'Alert system for thresholds'
        ],
        designConsiderations: [
          'Professional, data-focused interface',
          'Responsive grid layout',
          'Intuitive navigation between views'
        ]
      },
      functionSignatures: {
        fetchAnalyticsData: {
          name: 'fetchAnalyticsData',
          description: 'Fetch analytics data from API',
          parameters: [
            { name: 'dateRange', type: 'DateRange', description: 'Date range for analytics' },
            { name: 'metrics', type: 'string[]', description: 'Metrics to fetch' }
          ],
          returnType: 'AnalyticsData'
        },
        processChartData: {
          name: 'processChartData',
          description: 'Process raw data for chart visualization',
          parameters: [
            { name: 'rawData', type: 'any[]', description: 'Raw analytics data' },
            { name: 'chartType', type: 'ChartType', description: 'Type of chart to create' }
          ],
          returnType: 'ChartData'
        }
      },
      stateLogic: {
        stateVariables: [
          {
            name: 'analyticsData',
            type: 'AnalyticsData | null',
            initialValue: 'null',
            description: 'Current analytics dataset'
          },
          {
            name: 'selectedDateRange',
            type: 'DateRange',
            initialValue: "{ start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() }",
            description: 'Currently selected date range'
          },
          {
            name: 'selectedMetrics',
            type: 'string[]',
            initialValue: "['revenue', 'users', 'conversions']",
            description: 'Currently selected metrics to display'
          },
          {
            name: 'isLoading',
            type: 'boolean',
            initialValue: 'false',
            description: 'Loading state for data fetching'
          }
        ],
        functions: [
          {
            name: 'handleDateRangeChange',
            parameters: ['newRange: DateRange'],
            implementation: 'setSelectedDateRange(newRange); fetchData();'
          },
          {
            name: 'handleMetricToggle',
            parameters: ['metric: string'],
            implementation: 'setSelectedMetrics(prev => prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]);'
          }
        ]
      },
      agentModelMapping: {
        'function-planner': 'gpt-4o',
        'state-design': 'gpt-4-turbo',
        'jsx-layout': 'gpt-4-turbo',
        'tailwind-styling': 'claude-3-5-sonnet-20240620',
        'component-assembler': 'gpt-4-turbo',
        'validator': 'claude-3-5-sonnet-20240620',
        'tool-finalizer': 'gpt-4o'
      }
    }
  },

  // Scenario 4: Contact Form - For Tailwind Styling (after JSX Layout)
  {
    id: 'contact-form-tailwind-styling',
    name: 'Contact Form (Tailwind Styling Stage)',
    description: 'Contact form with JSX layout ready for styling',
    complexity: 'simple',
    suitableFor: ['tailwind-styling'],
    tcc: {
      jobId: 'mock-contact-001',
      userInput: {
        toolType: 'Contact Form',
        targetAudience: 'Website Visitors',
        businessContext: 'Professional contact form for business website',
        selectedModel: 'claude-3-5-sonnet-20240620'
      },
      brainstormResult: {
        description: 'A professional contact form with validation and submission handling',
        targetAudience: 'Website Visitors and Potential Customers',
        toolType: 'Contact Form',
        features: [
          'Name, email, and message fields',
          'Real-time validation',
          'Success/error messaging',
          'Professional styling'
        ],
        designConsiderations: [
          'Clean, professional appearance',
          'Clear error messaging',
          'Mobile-responsive design'
        ]
      },
      jsxLayout: `import React from 'react';

export default function ContactForm() {
  return (
    <div className="contact-form-container">
      <div className="form-header">
        <h2>Contact Us</h2>
        <p>We'd love to hear from you. Send us a message!</p>
      </div>
      
      <form className="contact-form">
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="Enter your full name"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email address"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            name="message"
            rows={5}
            placeholder="Enter your message"
          />
        </div>
        
        <div className="form-actions">
          <button type="submit" className="submit-button">
            Send Message
          </button>
        </div>
      </form>
      
      <div className="status-message">
        {/* Status messages will appear here */}
      </div>
    </div>
  );
}`,
      stateLogic: {
        stateVariables: [
          {
            name: 'formData',
            type: 'ContactFormData',
            initialValue: "{ name: '', email: '', message: '' }",
            description: 'Form input data'
          },
          {
            name: 'isSubmitting',
            type: 'boolean',
            initialValue: 'false',
            description: 'Form submission state'
          }
        ],
        functions: [
          {
            name: 'handleSubmit',
            parameters: ['e: FormEvent'],
            implementation: 'e.preventDefault(); setIsSubmitting(true); // Submit logic here'
          }
        ]
      },
      agentModelMapping: {
        'function-planner': 'gpt-4o',
        'state-design': 'gpt-4-turbo',
        'jsx-layout': 'gpt-4-turbo',
        'tailwind-styling': 'claude-3-5-sonnet-20240620',
        'component-assembler': 'gpt-4-turbo',
        'validator': 'claude-3-5-sonnet-20240620',
        'tool-finalizer': 'gpt-4o'
      }
    }
  },

  // Scenario 5: Budget Tracker - For Component Assembler (after Tailwind Styling)
  {
    id: 'budget-tracker-component-assembler',
    name: 'Budget Tracker (Component Assembler Stage)',
    description: 'Budget tracking tool ready for final component assembly',
    complexity: 'medium',
    suitableFor: ['component-assembler'],
    tcc: {
      jobId: 'mock-budget-001',
      userInput: {
        toolType: 'Personal Budget Tracker',
        targetAudience: 'Individuals managing personal finances',
        businessContext: 'Track income, expenses, and savings goals',
        selectedModel: 'gpt-4-turbo'
      },
      brainstormResult: {
        description: 'A comprehensive personal budget tracking tool with categorization and goal setting',
        targetAudience: 'Individuals and families managing personal finances',
        toolType: 'Personal Budget Tracker',
        features: [
          'Income and expense tracking',
          'Category-based organization',
          'Monthly/yearly views',
          'Savings goals tracking',
          'Visual charts and graphs'
        ]
      },
      styledJsxComponent: `import React from 'react';

export default function BudgetTracker() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Budget Tracker</h1>
          <p className="text-gray-600">Track your income, expenses, and savings goals</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-2">Total Income</h3>
            <p className="text-2xl font-bold text-green-600">$0.00</p>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Total Expenses</h3>
            <p className="text-2xl font-bold text-red-600">$0.00</p>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Net Savings</h3>
            <p className="text-2xl font-bold text-blue-600">$0.00</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Add Transaction</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter description"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200"
              >
                Add Transaction
              </button>
            </form>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Transactions</h2>
            <div className="text-gray-500 text-center py-8">
              No transactions yet. Add your first transaction to get started!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}`,
      agentModelMapping: {
        'function-planner': 'gpt-4o',
        'state-design': 'gpt-4-turbo',
        'jsx-layout': 'gpt-4-turbo',
        'tailwind-styling': 'claude-3-5-sonnet-20240620',
        'component-assembler': 'gpt-4-turbo',
        'validator': 'claude-3-5-sonnet-20240620',
        'tool-finalizer': 'gpt-4o'
      }
    }
  }
];

// Helper function to get scenarios suitable for a specific agent
export function getScenariosForAgent(agentId: string): MockTccScenario[] {
  return mockTccScenarios.filter(scenario => 
    scenario.suitableFor.includes(agentId)
  );
}

// Helper function to get a scenario by ID
export function getScenarioById(id: string): MockTccScenario | undefined {
  return mockTccScenarios.find(scenario => scenario.id === id);
}

// Helper function to get scenarios by complexity level
export function getScenariosByComplexity(complexity: 'simple' | 'medium' | 'complex'): MockTccScenario[] {
  return mockTccScenarios.filter(scenario => scenario.complexity === complexity);
} 
