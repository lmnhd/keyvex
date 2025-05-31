'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Code, Eye, Settings, BarChart3, Wrench, Calculator, TrendingUp, Zap, Database } from 'lucide-react';
import Link from 'next/link';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import DynamicComponentRenderer from '@/components/tools/dynamic-component-renderer';

// ============================================================================
// TYPES FOR THIS TEST PAGE
// ============================================================================

interface ProductToolSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  viewCount: number;
  completionCount: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

// ============================================================================
// SAMPLE PRODUCT TOOL DEFINITION
// ============================================================================

const sampleROICalculator: ProductToolDefinition = {
  id: 'roi_calculator_demo',
  slug: 'roi-calculator-demo',
  version: '1.0.0',
  status: 'published',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'demo_user',
  
  metadata: {
    id: 'roi_calculator_demo',
    slug: 'roi-calculator-demo',
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
  
  componentCode: `'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ROICalculator() {
  const [initialInvestment, setInitialInvestment] = useState(0);
  const [finalValue, setFinalValue] = useState(0);

  const roi = initialInvestment > 0 ? ((finalValue - initialInvestment) / initialInvestment) * 100 : 0;
  const profitLoss = finalValue - initialInvestment;

  const handleReset = () => {
    setInitialInvestment(0);
    setFinalValue(0);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="shadow-lg" style={{ borderColor: '#3b82f6' }}>
        <CardHeader style={{ backgroundColor: '#3b82f6', color: 'white' }}>
          <CardTitle className="text-2xl">ROI Calculator</CardTitle>
          <p className="text-sm opacity-90">Calculate your return on investment</p>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="initialInvestment" className="text-sm font-medium">
                Initial Investment ($)
              </Label>
              <Input
                id="initialInvestment"
                type="number"
                value={initialInvestment}
                onChange={(e) => setInitialInvestment(Number(e.target.value))}
                placeholder="10000"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="finalValue" className="text-sm font-medium">
                Final Value ($)
              </Label>
              <Input
                id="finalValue"
                type="number"
                value={finalValue}
                onChange={(e) => setFinalValue(Number(e.target.value))}
                placeholder="12000"
                className="w-full"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">ROI Percentage</p>
                <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                  {roi.toFixed(1)}%
                </p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Profit/Loss</p>
                <p className="text-2xl font-bold" style={{ color: profitLoss >= 0 ? '#10b981' : '#ef4444' }}>
                  $\{profitLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleReset}
              variant="outline"
              className="flex-1"
            >
              Reset
            </Button>
            <Button 
              style={{ backgroundColor: '#3b82f6' }}
              className="flex-1 text-white hover:opacity-90"
            >
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}`,
  
  colorScheme: {
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
    error: '#ef4444'
  },
  
  analytics: {
    enabled: true,
    completions: 0,
    averageTime: 0
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductToolsTestPage() {
  const [selectedTool, setSelectedTool] = useState<ProductToolDefinition | null>(null);
  const [showLiveRenderer, setShowLiveRenderer] = useState(false);
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
            <div className="flex items-center gap-4 mb-4">
              <Link href="/tests">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Tests
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Product Tools Infrastructure Test
            </h1>
            <p className="text-gray-600">
              Testing the React component-based tool system with dynamic code generation
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
                  <div className="text-sm font-medium">React Components</div>
                  <div className="text-xs text-gray-500">Dynamic Code Generation</div>
                </div>
                <div className="text-center">
                  <Badge variant="default" className="mb-2">Active</Badge>
                  <div className="text-sm font-medium">API Routes</div>
                  <div className="text-xs text-gray-500">/api/product-tools</div>
                </div>
                <div className="text-center">
                  <Badge variant="default" className="mb-2">Active</Badge>
                  <div className="text-sm font-medium">Dynamic Renderer</div>
                  <div className="text-xs text-gray-500">Live Component Execution</div>
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        View JSON
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToolSelect(tool.id);
                          setShowLiveRenderer(true);
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Test Live
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live Component Renderer */}
          {selectedTool && showLiveRenderer && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Live Component Renderer
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowLiveRenderer(false)}
                  >
                    Close
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DynamicComponentRenderer
                  componentCode={selectedTool.componentCode}
                  metadata={{
                    title: selectedTool.metadata.title,
                    description: selectedTool.metadata.description,
                    slug: selectedTool.slug
                  }}
                  isLoading={false}
                />
              </CardContent>
            </Card>
          )}

          {/* Tool Definition Viewer */}
          {selectedTool && !showLiveRenderer && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>React Component Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">
                  <pre>{selectedTool.componentCode}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tool Definition JSON Viewer */}
          {selectedTool && !showLiveRenderer && (
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
                    <div className="text-sm text-gray-600">Updated to use simplified ProductToolDefinition with React component code</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">✓</div>
                  <div>
                    <div className="font-medium">React Component System</div>
                    <div className="text-sm text-gray-600">AI generates actual React JSX code that renders dynamically</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">✓</div>
                  <div>
                    <div className="font-medium">Live Dynamic Rendering</div>
                    <div className="text-sm text-gray-600">Click "Test Live" above to see the component execute in real-time</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</div>
                  <div>
                    <div className="font-medium">Test AI Component Generation</div>
                    <div className="text-sm text-gray-600">Visit <Link href="/tests/react-components" className="text-blue-600 underline">/tests/react-components</Link> to test AI-generated components</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">2</div>
                  <div>
                    <div className="font-medium">Test Complete Workflow</div>
                    <div className="text-sm text-gray-600">Visit <Link href="/tests/ui" className="text-blue-600 underline">/tests/ui</Link> to test the full AI conversation to tool creation flow</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</div>
                  <div>
                    <div className="font-medium">Database Integration</div>
                    <div className="text-sm text-gray-600">Test storing and retrieving tools from DynamoDB</div>
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