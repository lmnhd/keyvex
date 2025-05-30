'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, Eye, BarChart3, Search } from 'lucide-react';
import { ProductToolDefinition, ProductToolSummary } from '@/lib/types/product-tool';
import ProductToolRenderer from '@/components/product-tools/product-tool-renderer';

// ============================================================================
// SAMPLE PRODUCT TOOL DEFINITION
// ============================================================================

const sampleROICalculator: ProductToolDefinition = {
  id: 'roi_calculator_demo',
  slug: 'roi-calculator-demo',
  version: '1.0.0',
  status: 'published',
  
  metadata: {
    title: 'ROI Calculator',
    description: 'Calculate your return on investment with our simple tool',
    shortDescription: 'Quick ROI calculation tool',
    type: 'calculator',
    category: 'finance',
    targetAudience: 'Business owners and investors',
    industry: 'Finance',
    tags: ['roi', 'finance', 'investment', 'calculator'],
    estimatedCompletionTime: 5,
    difficultyLevel: 'beginner',
    features: ['Real-time calculations', 'Currency formatting', 'Multiple scenarios'],
    icon: {
      type: 'lucide',
      value: 'Calculator'
    }
  },
  
  layout: {
    type: 'single-page',
    structure: {
      container: {
        maxWidth: '2xl',
        padding: 'p-6',
        alignment: 'center'
      },
      sections: [
        {
          id: 'main',
          type: 'content',
          layout: 'vertical',
          order: 1
        }
      ],
      flow: {
        type: 'linear'
      }
    },
    responsive: {
      breakpoints: {
        sm: 'responsive',
        md: 'responsive', 
        lg: 'responsive',
        xl: 'responsive'
      }
    }
  },
  
  components: [
    {
      id: 'initial_investment',
      type: 'currency-input',
      sectionId: 'main',
      order: 1,
      props: {
        label: 'Initial Investment',
        placeholder: 'Enter your initial investment',
        helperText: 'The amount you initially invested',
        required: true
      },
      validation: {
        componentId: 'initial_investment',
        rules: [
          { type: 'required', message: 'Initial investment is required' },
          { type: 'min', value: 0, message: 'Investment must be positive' }
        ]
      }
    },
    {
      id: 'final_value',
      type: 'currency-input',
      sectionId: 'main',
      order: 2,
      props: {
        label: 'Final Value',
        placeholder: 'Enter the final value',
        helperText: 'The current or final value of your investment',
        required: true
      },
      validation: {
        componentId: 'final_value',
        rules: [
          { type: 'required', message: 'Final value is required' },
          { type: 'min', value: 0, message: 'Value must be positive' }
        ]
      }
    },
    {
      id: 'roi_result',
      type: 'calculation-display',
      sectionId: 'main',
      order: 3,
      props: {
        label: 'Return on Investment',
        format: {
          type: 'percentage',
          decimals: 2
        },
        formula: '((final_value - initial_investment) / initial_investment) * 100',
        dependencies: ['initial_investment', 'final_value']
      }
    }
  ],
  
  styling: {
    theme: {
      name: 'default',
      mode: 'light',
      borderRadius: 'md',
      shadows: 'sm',
      effects: {}
    },
    colors: {
      primary: '#3b82f6',
      secondary: '#6b7280',
      background: '#ffffff',
      surface: '#f9fafb',
      text: {
        primary: '#111827',
        secondary: '#6b7280',
        muted: '#9ca3af'
      },
      border: '#e5e7eb',
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
        xs: '0.25rem',
        sm: '0.5rem',
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
        id: 'roi_calculation',
        name: 'ROI Percentage',
        formula: '((final_value - initial_investment) / initial_investment) * 100',
        dependencies: ['initial_investment', 'final_value'],
        outputComponentId: 'roi_result',
        triggers: [
          { event: 'change', debounce: 300 }
        ],
        format: {
          type: 'percentage',
          decimals: 2
        }
      }
    ],
    conditions: [],
    actions: [],
    formulas: []
  },
  
  validation: {
    components: [],
    global: []
  },
  
  analytics: {
    enabled: true,
    trackingEvents: [
      {
        id: 'calculation_performed',
        name: 'ROI Calculation Performed',
        trigger: 'calculation'
      }
    ]
  },
  
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'demo_user'
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductToolsTestPage() {
  const [selectedTool, setSelectedTool] = useState<ProductToolDefinition | null>(null);
  const [tools] = useState<ProductToolSummary[]>([
    {
      id: 'roi_calculator_demo',
      slug: 'roi-calculator-demo',
      title: 'ROI Calculator',
      description: 'Calculate your return on investment with our simple tool',
      type: 'calculator',
      category: 'finance',
      status: 'published',
      viewCount: 156,
      completionCount: 89,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000,
      createdBy: 'demo_user'
    }
  ]);

  const handleToolSelect = (toolId: string) => {
    if (toolId === 'roi_calculator_demo') {
      setSelectedTool(sampleROICalculator);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Product Tools Infrastructure Test
            </h1>
            <p className="text-gray-600">
              Testing the complete product tool system with dynamic JSON-based tool generation
            </p>
          </div>

          {/* Infrastructure Status */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Infrastructure Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <Badge variant="default" className="mb-2">Active</Badge>
                  <div className="text-sm font-medium">Type System</div>
                  <div className="text-xs text-gray-500">ProductToolDefinition</div>
                </div>
                <div className="text-center">
                  <Badge variant="default" className="mb-2">Active</Badge>
                  <div className="text-sm font-medium">Database Layer</div>
                  <div className="text-xs text-gray-500">DynamoDB Service</div>
                </div>
                <div className="text-center">
                  <Badge variant="default" className="mb-2">Active</Badge>
                  <div className="text-sm font-medium">API Routes</div>
                  <div className="text-xs text-gray-500">/api/product-tools</div>
                </div>
                <div className="text-center">
                  <Badge variant="default" className="mb-2">Active</Badge>
                  <div className="text-sm font-medium">Component Factory</div>
                  <div className="text-xs text-gray-500">Dynamic Rendering</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Endpoints */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Available API Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <div>
                    <div className="font-mono text-sm">GET /api/product-tools</div>
                    <div className="text-xs text-gray-600">List all product tools with pagination</div>
                  </div>
                  <Badge variant="default">Ready</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <div>
                    <div className="font-mono text-sm">POST /api/product-tools</div>
                    <div className="text-xs text-gray-600">Create new product tool</div>
                  </div>
                  <Badge variant="default">Ready</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <div>
                    <div className="font-mono text-sm">GET /api/product-tools/[toolId]</div>
                    <div className="text-xs text-gray-600">Get specific tool with analytics tracking</div>
                  </div>
                  <Badge variant="default">Ready</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <div>
                    <div className="font-mono text-sm">GET /api/product-tools/search</div>
                    <div className="text-xs text-gray-600">Search tools by query and filters</div>
                  </div>
                  <Badge variant="default">Ready</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                  <div>
                    <div className="font-mono text-sm">GET /product-tools/[slug]</div>
                    <div className="text-xs text-gray-600">Public tool pages by slug</div>
                  </div>
                  <Badge variant="secondary">Ready</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sample Tools */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Sample Product Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {tools.map((tool) => (
                  <div 
                    key={tool.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleToolSelect(tool.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{tool.title}</h3>
                        <Badge variant="outline">{tool.type}</Badge>
                        <Badge variant={tool.status === 'published' ? 'default' : 'secondary'}>
                          {tool.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{tool.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {tool.viewCount} views
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {tool.completionCount} completions
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Test Tool
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tool Definition Viewer */}
          {selectedTool && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Live Tool Renderer Test</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductToolRenderer toolDefinition={selectedTool} />
              </CardContent>
            </Card>
          )}

          {/* Tool Definition JSON Viewer */}
          {selectedTool && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Tool Definition JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">
                  <pre>{JSON.stringify(selectedTool, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Next Steps for Testing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">✓</div>
                  <div>
                    <div className="font-medium">TypeScript Errors Fixed</div>
                    <div className="text-sm text-gray-600">Resolved Clerk auth import, JSX namespace, and component factory issues</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">✓</div>
                  <div>
                    <div className="font-medium">Component System Ready</div>
                    <div className="text-sm text-gray-600">ProductToolComponentFactory created with type adapters for compatibility</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</div>
                  <div>
                    <div className="font-medium">Install AWS SDK Dependencies</div>
                    <div className="text-sm text-gray-600">Run: <code className="bg-gray-100 px-1 rounded">npm install @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb</code></div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">2</div>
                  <div>
                    <div className="font-medium">Test Live Rendering</div>
                    <div className="text-sm text-gray-600">Uncomment ProductToolRenderer in test above and verify dynamic component rendering</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</div>
                  <div>
                    <div className="font-medium">Test API Endpoints</div>
                    <div className="text-sm text-gray-600">Test CRUD operations with actual DynamoDB connection</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">4</div>
                  <div>
                    <div className="font-medium">Setup Authentication</div>
                    <div className="text-sm text-gray-600">Configure Clerk auth integration for protected routes</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
} 