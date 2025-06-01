'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import DynamicComponentRenderer from '@/components/tools/dynamic-component-renderer';
import { AlertCircle, CheckCircle, Code, Play, Loader2 } from 'lucide-react';

export default function DynamicToolsTestPage() {
  const [testMode, setTestMode] = useState<'sample' | 'custom'>('sample');
  const [customJSX, setCustomJSX] = useState('');
  const [compilationResult, setCompilationResult] = useState<{
    success: boolean;
    compiledCode?: string;
    error?: string;
  } | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  // Sample JSX components for testing
  const sampleComponents = [
    {
      name: 'Solar Panel Calculator',
      description: 'A calculator for solar panel savings',
      jsx: `function SolarPanelCalculator() {
  const [homeSize, setHomeSize] = useState('');
  const [monthlyBill, setMonthlyBill] = useState('');
  const [sunHours, setSunHours] = useState('');
  const [savings, setSavings] = useState(null);

  const calculateSavings = () => {
    const size = parseFloat(homeSize);
    const bill = parseFloat(monthlyBill);
    const hours = parseFloat(sunHours);
    
    if (size && bill && hours) {
      const panelsNeeded = Math.ceil(size / 400);
      const systemCost = panelsNeeded * 3000;
      const annualSavings = bill * 12 * 0.8;
      const paybackYears = systemCost / annualSavings;
      
      setSavings({
        panelsNeeded,
        systemCost,
        annualSavings,
        paybackYears: paybackYears.toFixed(1)
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ☀️ Solar Panel Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="homeSize">Home Size (sq ft)</Label>
          <Input
            id="homeSize"
            type="number"
            placeholder="e.g., 2000"
            value={homeSize}
            onChange={(e) => setHomeSize(e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="monthlyBill">Monthly Electric Bill ($)</Label>
          <Input
            id="monthlyBill"
            type="number"
            placeholder="e.g., 150"
            value={monthlyBill}
            onChange={(e) => setMonthlyBill(e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="sunHours">Daily Sun Hours</Label>
          <Input
            id="sunHours"
            type="number"
            placeholder="e.g., 6"
            value={sunHours}
            onChange={(e) => setSunHours(e.target.value)}
          />
        </div>
        
        <Button onClick={calculateSavings} className="w-full">
          Calculate Savings
        </Button>
        
        {savings && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">Your Solar Savings</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Panels Needed:</span>
                  <p className="font-medium">{savings.panelsNeeded}</p>
                </div>
                <div>
                  <span className="text-gray-600">System Cost:</span>
                  <p className="font-medium">\${savings.systemCost.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Annual Savings:</span>
                  <p className="font-medium">\${savings.annualSavings.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Payback Period:</span>
                  <p className="font-medium">{savings.paybackYears} years</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}`,
      metadata: {
        title: 'Solar Panel Calculator',
        description: 'Calculate solar panel savings for your home',
        slug: 'solar-calculator'
      }
    },
    {
      name: 'ROI Calculator', 
      description: 'Simple ROI calculation tool',
      jsx: `function ROICalculator() {
  const [initialInvestment, setInitialInvestment] = useState('');
  const [finalValue, setFinalValue] = useState('');
  const [roi, setROI] = useState(null);

  const calculateROI = () => {
    const initial = parseFloat(initialInvestment);
    const final = parseFloat(finalValue);
    
    if (initial && final) {
      const roiPercentage = ((final - initial) / initial) * 100;
      setROI(roiPercentage.toFixed(2));
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>💰 ROI Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="initial">Initial Investment ($)</Label>
          <Input
            id="initial"
            type="number"
            placeholder="10000"
            value={initialInvestment}
            onChange={(e) => setInitialInvestment(e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="final">Final Value ($)</Label>
          <Input
            id="final"
            type="number"
            placeholder="15000"
            value={finalValue}
            onChange={(e) => setFinalValue(e.target.value)}
          />
        </div>
        
        <Button onClick={calculateROI} className="w-full">
          Calculate ROI
        </Button>
        
        {roi && (
          <div className={\`p-4 rounded-lg \${roi >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}\`}>
            <p className="font-semibold">ROI: {roi}%</p>
            <p className="text-sm">
              {roi >= 0 ? 'Positive return on investment' : 'Negative return on investment'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}`,
      metadata: {
        title: 'ROI Calculator',
        description: 'Calculate return on investment',
        slug: 'roi-calculator'
      }
    }
  ];

  const [selectedSample, setSelectedSample] = useState(sampleComponents[0]);

  // Test JSX compilation via API
  const testJSXCompilation = async (jsxCode: string) => {
    setIsCompiling(true);
    setCompilationResult(null);

    try {
      const response = await fetch('/api/ai/create-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIntent: 'Test JSX compilation',
          context: {
            targetAudience: 'test',
            industry: 'test',
            toolType: 'calculator'
          },
          // We'll create a mock tool structure for testing
          existingTool: {
            componentCode: jsxCode,
            metadata: {
              title: 'Test Component',
              description: 'Testing JSX compilation'
            }
          },
          updateType: 'components'
        }),
      });

      const result = await response.json();

      if (result.success && result.tool?.componentCode) {
        setCompilationResult({
          success: true,
          compiledCode: result.tool.componentCode
        });
      } else {
        setCompilationResult({
          success: false,
          error: result.message || 'Compilation failed'
        });
      }
    } catch (error) {
      setCompilationResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      });
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dynamic Component Renderer Tests</h1>
        <p className="text-gray-600">
          Test JSX compilation and dynamic component rendering functionality
        </p>
      </div>

      {/* Test Mode Toggle */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={testMode === 'sample' ? 'default' : 'outline'}
              onClick={() => setTestMode('sample')}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Sample Components
            </Button>
            <Button
              variant={testMode === 'custom' ? 'default' : 'outline'}
              onClick={() => setTestMode('custom')}
            >
              <Code className="h-4 w-4 mr-2" />
              Custom JSX
            </Button>
          </div>
        </CardContent>
      </Card>

      {testMode === 'sample' ? (
        <>
          {/* Sample Component Selector */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Sample Component</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sampleComponents.map((component, index) => (
                  <Card
                    key={index}
                    className={`cursor-pointer transition-colors ${
                      selectedSample === component ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedSample(component)}
                  >
                    <CardContent className="pt-4">
                      <h3 className="font-semibold">{component.name}</h3>
                      <p className="text-sm text-gray-600">{component.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* JSX Compilation Test */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>JSX Compilation Test</CardTitle>
              <p className="text-sm text-gray-600">
                Test server-side JSX compilation for: {selectedSample.name}
              </p>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => testJSXCompilation(selectedSample.jsx)}
                disabled={isCompiling}
                className="mb-4"
              >
                {isCompiling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Compiling JSX...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Test JSX Compilation
                  </>
                )}
              </Button>

              {compilationResult && (
                <div className={`p-4 rounded-lg ${
                  compilationResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {compilationResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">
                      {compilationResult.success ? 'Compilation Successful!' : 'Compilation Failed'}
                    </span>
                  </div>
                  
                  {compilationResult.error && (
                    <p className="text-sm text-red-600">{compilationResult.error}</p>
                  )}
                  
                  {compilationResult.compiledCode && (
                    <details className="mt-3">
                      <summary className="cursor-pointer font-medium text-sm">
                        View Compiled JavaScript
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                        {compilationResult.compiledCode}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dynamic Component Renderer Test */}
          <Card>
            <CardHeader>
              <CardTitle>Dynamic Component Renderer</CardTitle>
              <p className="text-sm text-gray-600">
                Testing dynamic rendering with compiled JavaScript
              </p>
            </CardHeader>
            <CardContent>
              {compilationResult?.success && compilationResult.compiledCode ? (
                <DynamicComponentRenderer
                  componentCode={compilationResult.compiledCode}
                  metadata={selectedSample.metadata}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Run JSX compilation test first to see dynamic rendering</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Custom JSX Input */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Custom JSX Input</CardTitle>
              <p className="text-sm text-gray-600">
                Enter your own JSX code to test compilation and rendering
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customJsx">JSX Component Code</Label>
                  <Textarea
                    id="customJsx"
                    placeholder="function MyComponent() { return <div>Hello World</div>; }"
                    value={customJSX}
                    onChange={(e) => setCustomJSX(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                
                <Button 
                  onClick={() => testJSXCompilation(customJSX)}
                  disabled={isCompiling || !customJSX.trim()}
                >
                  {isCompiling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Compiling...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Test Compilation
                    </>
                  )}
                </Button>
              </div>

              {compilationResult && (
                <div className={`mt-4 p-4 rounded-lg ${
                  compilationResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {compilationResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">
                      {compilationResult.success ? 'Compilation Successful!' : 'Compilation Failed'}
                    </span>
                  </div>
                  
                  {compilationResult.error && (
                    <p className="text-sm text-red-600">{compilationResult.error}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Component Renderer */}
          {compilationResult?.success && compilationResult.compiledCode && (
            <Card>
              <CardHeader>
                <CardTitle>Custom Component Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <DynamicComponentRenderer
                  componentCode={compilationResult.compiledCode}
                  metadata={{
                    title: 'Custom Component',
                    description: 'User-defined JSX component',
                    slug: 'custom-component'
                  }}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
} 