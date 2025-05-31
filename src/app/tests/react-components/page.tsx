'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DynamicComponentRenderer from '@/components/tools/dynamic-component-renderer';
import { generateReactComponent, ReactComponentRequest } from '@/lib/ai/component-generator';
import { ArrowLeft, Zap, Calculator, TrendingUp, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ReactComponentsTestPage() {
  const [generatedComponent, setGeneratedComponent] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSampleROICalculator = async () => {
    setIsGenerating(true);
    try {
      const request: ReactComponentRequest = {
        toolType: 'calculator',
        title: 'Marketing ROI Calculator',
        description: 'Calculate return on investment for your marketing campaigns',
        inputs: [
          {
            name: 'initialInvestment',
            type: 'number',
            label: 'Initial Investment ($)',
            placeholder: '10000'
          },
          {
            name: 'totalReturns',
            type: 'number', 
            label: 'Total Returns ($)',
            placeholder: '15000'
          },
          {
            name: 'campaignDuration',
            type: 'number',
            label: 'Campaign Duration (months)',
            placeholder: '6'
          }
        ],
        calculations: [
          {
            name: 'roi',
            formula: '((totalReturns - initialInvestment) / initialInvestment) * 100',
            format: 'percentage'
          },
          {
            name: 'netProfit',
            formula: 'totalReturns - initialInvestment',
            format: 'currency'
          },
          {
            name: 'monthlyROI',
            formula: 'roi / campaignDuration',
            format: 'percentage'
          }
        ],
        styling: {
          primaryColor: '#3b82f6',
          secondaryColor: '#1e40af',
          theme: 'professional'
        }
      };

      const result = await generateReactComponent(request);
      setGeneratedComponent(result);
      console.log('✅ Generated component:', result);
    } catch (error) {
      console.error('❌ Failed to generate component:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSampleAssessment = async () => {
    setIsGenerating(true);
    try {
      const request: ReactComponentRequest = {
        toolType: 'assessment',
        title: 'Business Readiness Assessment',
        description: 'Evaluate how ready your business is for growth',
        inputs: [
          {
            name: 'monthlyRevenue',
            type: 'number',
            label: 'Monthly Revenue ($)',
            placeholder: '50000'
          },
          {
            name: 'teamSize',
            type: 'number',
            label: 'Team Size',
            placeholder: '10'
          },
          {
            name: 'marketingBudget',
            type: 'number',
            label: 'Marketing Budget ($)',
            placeholder: '5000'
          },
          {
            name: 'businessStage',
            type: 'select',
            label: 'Business Stage',
            options: ['Startup', 'Growth', 'Mature', 'Enterprise']
          }
        ],
        calculations: [
          {
            name: 'readinessScore',
            formula: 'Math.min(100, (monthlyRevenue / 1000) + (teamSize * 5) + (marketingBudget / 100))',
            format: 'number'
          },
          {
            name: 'growthPotential',
            formula: 'readinessScore > 80 ? "High" : readinessScore > 50 ? "Medium" : "Low"',
            format: 'number'
          }
        ],
        styling: {
          primaryColor: '#059669',
          secondaryColor: '#047857',
          theme: 'modern'
        }
      };

      const result = await generateReactComponent(request);
      setGeneratedComponent(result);
      console.log('✅ Generated assessment component:', result);
    } catch (error) {
      console.error('❌ Failed to generate assessment:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/tests">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Tests
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">React Component Generator</h1>
                <p className="text-sm text-gray-600">Test the new React component-based tool system</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Controls Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Component Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Generate live React components from specifications. These components are fully functional
                  and ready for hosting.
                </p>
                
                <div className="space-y-3">
                  <Button 
                    onClick={generateSampleROICalculator}
                    disabled={isGenerating}
                    className="w-full justify-start"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Generate ROI Calculator
                  </Button>
                  
                  <Button 
                    onClick={generateSampleAssessment}
                    disabled={isGenerating}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Generate Business Assessment
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      // Test the fallback renderer directly
                      setGeneratedComponent({
                        componentCode: `'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TestROICalculator() {
  const [initialInvestment, setInitialInvestment] = useState(0);
  const [totalReturns, setTotalReturns] = useState(0);
  const [campaignDuration, setCampaignDuration] = useState(0);

  const roi = ((totalReturns - initialInvestment) / initialInvestment) * 100;
  const netProfit = totalReturns - initialInvestment;
  const monthlyROI = roi / campaignDuration;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="shadow-lg">
        <CardHeader style={{ backgroundColor: '#3b82f6', color: 'white' }}>
          <CardTitle className="text-2xl">Test ROI Calculator</CardTitle>
          <p className="text-sm opacity-90">Testing the fallback renderer</p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="investment">Initial Investment ($)</Label>
              <Input
                id="investment"
                type="number"
                value={initialInvestment}
                onChange={(e) => setInitialInvestment(Number(e.target.value))}
                placeholder="10000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="returns">Total Returns ($)</Label>
              <Input
                id="returns"
                type="number"
                value={totalReturns}
                onChange={(e) => setTotalReturns(Number(e.target.value))}
                placeholder="15000"
              />
            </div>
          </div>
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Results</h3>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                ROI: {roi.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}`,
                        metadata: {
                          title: 'Test ROI Calculator',
                          description: 'Testing fallback renderer',
                          slug: 'test-roi-calculator'
                        }
                      });
                    }}
                    variant="secondary"
                    className="w-full justify-start"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Test Fallback Renderer
                  </Button>
                </div>

                {generatedComponent && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="font-medium">Component Generated!</span>
                    </div>
                    <p className="text-sm text-green-600">
                      {generatedComponent.metadata.title} is ready and rendered live →
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Architecture</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>AI generates React JSX code</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Components render with full functionality</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Real-time state management included</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Ready for live hosting</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Live Component Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isGenerating ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                      <p className="text-sm text-gray-600">Generating React component...</p>
                    </div>
                  </div>
                ) : generatedComponent ? (
                  <div className="p-4">
                    <DynamicComponentRenderer
                      componentCode={generatedComponent.componentCode}
                      metadata={generatedComponent.metadata}
                      onError={(error) => console.error('Render error:', error)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-12 text-center">
                    <div>
                      <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium text-gray-500 mb-2">No Component Generated</h3>
                      <p className="text-sm text-gray-400">Click a generator button to create a live React component</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Code Preview */}
        {generatedComponent && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Generated React Code</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-4 rounded-lg overflow-x-auto max-h-96">
                  {generatedComponent.componentCode}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 