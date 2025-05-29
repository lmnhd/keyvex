'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, RefreshCw } from 'lucide-react';
import { AgentConnection } from '@/components/ai/agent-connection';

export default function BrandIntelligenceTestPage() {
  const [useMockData, setUseMockData] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [sessionState, setSessionState] = useState<any>({
    phase: 'discovery',
    canProceed: false,
    confidence: 0
  });

  const handleAnalysisComplete = (analysis: any) => {
    console.log('Analysis completed:', analysis);
    setAnalysisResults(analysis);
  };

  const handleToolSuggestion = (suggestion: any) => {
    console.log('Tool suggestion received:', suggestion);
    // TODO: Navigate to tool creation with this suggestion
  };

  const handleStateChange = (state: any) => {
    setSessionState(state);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Brain className="h-8 w-8 text-blue-600" />
                Brand Intelligence Test
              </h1>
              <p className="text-gray-600 mt-2">
                Testing visual AI creation flow with conversational UI generation
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant={useMockData ? 'secondary' : 'default'}>
                {useMockData ? 'Mock Mode' : 'AI Mode'}
              </Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setUseMockData(!useMockData)}
                className={useMockData ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "bg-green-50 border-green-200 text-green-700"}
              >
                {useMockData ? 'Mock AI' : 'Real AI'}
              </Button>
            </div>
          </div>
        </div>

        {/* Agent Connection Component */}
        <AgentConnection
          title="Brand Intelligence Assistant"
          description="Interactive conversation with dynamic forms and components"
          height="700px"
          showSessionState={true}
          useMockData={useMockData}
          onAnalysisComplete={handleAnalysisComplete}
          onToolSuggestion={handleToolSuggestion}
          onStateChange={handleStateChange}
          className="w-full"
        />

        {/* Debug Information */}
        {analysisResults && (
          <div className="mt-8 p-4 bg-white rounded-lg border">
            <h3 className="font-semibold mb-2">Latest Analysis Results:</h3>
            <pre className="text-xs text-gray-600 overflow-auto">
              {JSON.stringify(analysisResults, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
} 