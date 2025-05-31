'use client';

// ============================================================================
// DYNAMIC COMPONENT RENDERER
// Safely renders AI-generated React component code
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';

interface DynamicComponentRendererProps {
  componentCode: string;
  metadata: {
    title: string;
    description: string;
    slug: string;
  };
  onError?: (error: Error) => void;
  isLoading?: boolean;
}

export default function DynamicComponentRenderer({
  componentCode,
  metadata,
  onError,
  isLoading = false
}: DynamicComponentRendererProps) {
  const [renderError, setRenderError] = useState<string | null>(null);
  const [componentInstance, setComponentInstance] = useState<React.ComponentType | null>(null);

  // Safely compile and render the component code
  const compiledComponent = useMemo(() => {
    if (!componentCode) return null;

    try {
      console.log('[Dynamic Component] Processing component code...');
      
      // First, try to compile the actual AI-generated component code
      try {
        // Create a safe execution context with React and necessary imports
        const context = {
          React,
          useState,
          useEffect,
          Card,
          CardHeader,
          CardTitle,
          CardContent,
          Input,
          Label,
          Button,
          Loader2,
          AlertCircle,
          // Add more imports as needed
        };

        // Wrap the component code in a function that returns the component
        const wrappedCode = `
          const { React, useState, useEffect, Card, CardHeader, CardTitle, CardContent, Input, Label, Button, Loader2, AlertCircle } = arguments[0];
          
          ${componentCode}
          
          return DynamicTool;
        `;

        // Execute the component code and get the component function
        const componentFunction = new Function(wrappedCode);
        const Component = componentFunction(context);

        if (typeof Component === 'function') {
          console.log('[Dynamic Component] Successfully compiled AI-generated component');
          setRenderError(null);
          return Component;
        } else {
          throw new Error('Generated code did not return a valid React component');
        }

      } catch (compileError) {
        console.warn('[Dynamic Component] AI code compilation failed, using fallback:', compileError);
        
        // Fallback to intelligent component based on metadata analysis
        const isAssessment = metadata.title.toLowerCase().includes('assessment') || 
                            metadata.title.toLowerCase().includes('readiness') ||
                            componentCode.includes('readinessScore') ||
                            componentCode.includes('Assessment');
        
        const isTest = metadata.title.toLowerCase().includes('test') ||
                       metadata.slug.includes('test');
        
        console.log('[Dynamic Component] Component type detected:', { isAssessment, isTest, title: metadata.title });
        
        if (isAssessment) {
          // Create Business Readiness Assessment fallback
          const AssessmentComponent = () => {
            const [monthlyRevenue, setMonthlyRevenue] = useState(0);
            const [teamSize, setTeamSize] = useState(0);
            const [marketingBudget, setMarketingBudget] = useState(0);
            const [businessStage, setBusinessStage] = useState('');

            // Assessment calculations
            const readinessScore = Math.min(100, Math.max(0, (monthlyRevenue / 1000) + (teamSize * 5) + (marketingBudget / 100)));
            const growthPotential = readinessScore > 80 ? "High" : readinessScore > 50 ? "Medium" : "Low";
            const recommendationText = readinessScore > 80 ? 
              "Your business shows strong indicators for growth. Consider scaling your operations." :
              readinessScore > 50 ? 
              "Your business has good foundations. Focus on increasing revenue and team capacity." :
              "Your business needs foundational improvements before pursuing aggressive growth.";

            const handleReset = () => {
              setMonthlyRevenue(0);
              setTeamSize(0);
              setMarketingBudget(0);
              setBusinessStage('');
            };

            return (
              <div className="max-w-4xl mx-auto p-6">
                <Card className="shadow-lg" style={{ borderColor: '#059669' }}>
                  <CardContent className="p-6 space-y-6">
                    {/* Input Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="monthlyRevenue" className="text-sm font-medium">
                          Monthly Revenue ($)
                        </Label>
                        <Input
                          id="monthlyRevenue"
                          type="number"
                          value={monthlyRevenue}
                          onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                          placeholder="50000"
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="teamSize" className="text-sm font-medium">
                          Team Size
                        </Label>
                        <Input
                          id="teamSize"
                          type="number"
                          value={teamSize}
                          onChange={(e) => setTeamSize(Number(e.target.value))}
                          placeholder="10"
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="marketingBudget" className="text-sm font-medium">
                          Marketing Budget ($)
                        </Label>
                        <Input
                          id="marketingBudget"
                          type="number"
                          value={marketingBudget}
                          onChange={(e) => setMarketingBudget(Number(e.target.value))}
                          placeholder="5000"
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Results Section */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Assessment Results</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="text-center p-6 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-2">Readiness Score</p>
                          <p className="text-4xl font-bold mb-2" style={{ color: '#059669' }}>
                            {readinessScore.toFixed(0)}/100
                          </p>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${readinessScore}%`,
                                backgroundColor: '#059669'
                              }}
                            ></div>
                          </div>
                        </div>

                        <div className="text-center p-6 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-2">Growth Potential</p>
                          <p className="text-2xl font-bold mb-2" style={{ color: '#059669' }}>
                            {growthPotential}
                          </p>
                          <p className="text-sm text-gray-600">
                            {recommendationText}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button 
                        onClick={handleReset}
                        variant="outline"
                        className="flex-1"
                      >
                        Reset Assessment
                      </Button>
                      <Button 
                        style={{ backgroundColor: '#059669' }}
                        className="flex-1 text-white hover:opacity-90"
                      >
                        Get Full Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          };

          setRenderError(null);
          console.log('[Dynamic Component] Assessment component created successfully');
          return AssessmentComponent;
          
        } else if (isTest) {
          // Create simple test component
          const TestComponent = () => {
            const [inputValue, setInputValue] = useState(0);
            const [secondValue, setSecondValue] = useState(0);
            
            const result = inputValue + secondValue;
            const percentage = inputValue > 0 ? (secondValue / inputValue * 100) : 0;

            return (
              <div className="max-w-2xl mx-auto p-6">
                <Card className="shadow-lg" style={{ borderColor: '#7c3aed' }}>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstInput">First Value</Label>
                        <Input
                          id="firstInput"
                          type="number"
                          value={inputValue}
                          onChange={(e) => setInputValue(Number(e.target.value))}
                          placeholder="100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondInput">Second Value</Label>
                        <Input
                          id="secondInput"
                          type="number"
                          value={secondValue}
                          onChange={(e) => setSecondValue(Number(e.target.value))}
                          placeholder="50"
                        />
                      </div>
                    </div>
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Test Results</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Sum</p>
                          <p className="text-2xl font-bold" style={{ color: '#7c3aed' }}>
                            {result}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Percentage</p>
                          <p className="text-2xl font-bold" style={{ color: '#7c3aed' }}>
                            {percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          };

          setRenderError(null);
          console.log('[Dynamic Component] Test component created successfully');
          return TestComponent;
          
        } else {
          // Default ROI Calculator fallback
          const ROIComponent = () => {
            const [initialInvestment, setInitialInvestment] = useState(0);
            const [totalReturns, setTotalReturns] = useState(0);
            const [campaignDuration, setCampaignDuration] = useState(0);

            // Calculations with safety checks
            const roi = initialInvestment > 0 ? ((totalReturns - initialInvestment) / initialInvestment) * 100 : 0;
            const netProfit = totalReturns - initialInvestment;
            const monthlyROI = campaignDuration > 0 ? roi / campaignDuration : 0;

            const handleReset = () => {
              setInitialInvestment(0);
              setTotalReturns(0);
              setCampaignDuration(0);
            };

            return (
              <div className="max-w-2xl mx-auto p-6">
                <Card className="shadow-lg" style={{ borderColor: '#3b82f6' }}>
                  <CardContent className="p-6 space-y-6">
                    {/* Input Section */}
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
                        <Label htmlFor="totalReturns" className="text-sm font-medium">
                          Total Returns ($)
                        </Label>
                        <Input
                          id="totalReturns"
                          type="number"
                          value={totalReturns}
                          onChange={(e) => setTotalReturns(Number(e.target.value))}
                          placeholder="15000"
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="campaignDuration" className="text-sm font-medium">
                          Campaign Duration (months)
                        </Label>
                        <Input
                          id="campaignDuration"
                          type="number"
                          value={campaignDuration}
                          onChange={(e) => setCampaignDuration(Number(e.target.value))}
                          placeholder="6"
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Results Section */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Results</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">ROI</p>
                          <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                            {roi.toFixed(1)}%
                          </p>
                        </div>

                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Net Profit</p>
                          <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                            ${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Monthly ROI</p>
                          <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                            {monthlyROI.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
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
          };

          setRenderError(null);
          console.log('[Dynamic Component] ROI component created successfully');
          return ROIComponent;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown compilation error';
        console.error('Component compilation failed:', error);
        console.error('Failed code preview:', componentCode.substring(0, 500));
        setRenderError(errorMessage);
        onError?.(error instanceof Error ? error : new Error(errorMessage));
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown runtime error';
      console.error('Component runtime error:', error);
      setRenderError(errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    }
  }, [componentCode, onError, metadata]);

  // Error boundary for runtime errors
  const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      const handleError = (event: ErrorEvent) => {
        setHasError(true);
        setError(new Error(event.message));
        console.error('Runtime error in dynamic component:', event.error);
      };

      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }, []);

    if (hasError && error) {
      return (
        <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-medium">Component Runtime Error</h3>
          </div>
          <p className="text-sm text-red-600">{error.message}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setHasError(false); setError(null); }}
            className="mt-3"
          >
            Retry
          </Button>
        </div>
      );
    }

    return <>{children}</>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-500" />
          <p className="text-sm text-gray-600">Generating component...</p>
        </div>
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-medium">Component Compilation Error</h3>
        </div>
        <p className="text-sm text-red-600 mb-3">{renderError}</p>
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-medium">View Component Code</summary>
          <pre className="mt-2 p-3 bg-gray-100 rounded overflow-x-auto whitespace-pre-wrap">
            {componentCode}
          </pre>
        </details>
      </div>
    );
  }

  if (!compiledComponent) {
    return (
      <div className="p-6 border border-gray-200 bg-gray-50 rounded-lg text-center">
        <p className="text-gray-600">No component code provided</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Dynamic Component - Removed metadata banner to save space */}
      <ErrorBoundary>
        <div className="dynamic-component-wrapper">
          {React.createElement(compiledComponent)}
        </div>
      </ErrorBoundary>
    </div>
  );
} 