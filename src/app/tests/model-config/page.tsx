'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Play,
  RefreshCw,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

interface TestInfo {
  availableTests: Array<{
    type: string;
    description: string;
    requiredParams: string[];
    optionalParams: string[];
  }>;
  availablePrompts: string[];
  availableProviders: string[];
  defaultModels: Record<string, string>;
}

interface TestResult {
  success: boolean;
  testType: string;
  data?: any;
  metrics?: {
    processingTime: number;
    timestamp: string;
    userId: string;
    testType: string;
  };
  error?: string;
  message?: string;
}

export default function ModelConfigTestPage() {
  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [selectedTest, setSelectedTest] = useState<string>('model-connection');
  const [selectedProvider, setSelectedProvider] = useState<string>('openai');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [userInput, setUserInput] = useState<string>('');
  const [promptVariables, setPromptVariables] = useState<string>('{}');
  const [inputHistory, setInputHistory] = useState<string>('[]');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(1000);
  
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);
  const [showFullResponse, setShowFullResponse] = useState(false);

  // Load test information on mount
  useEffect(() => {
    loadTestInfo();
  }, []);

  // Update model when provider changes
  useEffect(() => {
    if (testInfo && selectedProvider) {
      setSelectedModel(testInfo.defaultModels[selectedProvider] || '');
    }
  }, [selectedProvider, testInfo]);

  const loadTestInfo = async () => {
    try {
      const response = await fetch('/api/ai/test-model');
      const data = await response.json();
      
      if (data.success) {
        setTestInfo(data);
        setSelectedProvider(data.availableProviders[0] || 'openai');
        setSelectedPrompt(data.availablePrompts[0] || '');
      }
    } catch (error) {
      console.error('Failed to load test info:', error);
    }
  };

  const runTest = async () => {
    if (!testInfo) return;

    setIsLoading(true);
    setLastResult(null);

    try {
      // Parse JSON inputs
      let parsedVariables = {};
      let parsedHistory = [];
      
      try {
        parsedVariables = JSON.parse(promptVariables);
      } catch (e) {
        throw new Error('Invalid JSON in prompt variables');
      }
      
      try {
        parsedHistory = JSON.parse(inputHistory);
      } catch (e) {
        throw new Error('Invalid JSON in input history');
      }

      // Build request based on test type
      const requestBody: any = {
        testType: selectedTest,
        provider: selectedProvider,
        model: selectedModel,
        temperature,
        maxTokens,
        includeMetrics: true
      };

      // Add test-specific parameters
      switch (selectedTest) {
        case 'prompt-individual':
        case 'structured-output':
          if (!selectedPrompt) throw new Error('Prompt key is required');
          requestBody.promptKey = selectedPrompt;
          requestBody.promptVariables = parsedVariables;
          break;
          
        case 'ui-input-generation':
        case 'conversation-flow':
          if (!userInput.trim()) throw new Error('User input is required');
          requestBody.userInput = userInput;
          requestBody.inputHistory = parsedHistory;
          break;
      }

      const response = await fetch('/api/ai/test-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      setLastResult(result);

    } catch (error) {
      setLastResult({
        success: false,
        testType: selectedTest,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getTestTypeDescription = (testType: string) => {
    return testInfo?.availableTests.find(t => t.type === testType)?.description || '';
  };

  const getRequiredParams = (testType: string) => {
    return testInfo?.availableTests.find(t => t.type === testType)?.requiredParams || [];
  };

  if (!testInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading test configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Brain className="h-8 w-8 text-blue-600" />
                AI Model Testing
              </h1>
              <p className="text-gray-600 mt-2">
                Test individual prompts, model connections, and UI input generation
              </p>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={loadTestInfo}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Test Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Test Type Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Test Type</label>
                  <Select value={selectedTest} onValueChange={setSelectedTest}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {testInfo.availableTests.map((test) => (
                        <SelectItem key={test.type} value={test.type}>
                          {test.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {getTestTypeDescription(selectedTest)}
                  </p>
                </div>

                {/* Model Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Provider</label>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {testInfo.availableProviders.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {provider.charAt(0).toUpperCase() + provider.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Model</label>
                    <Input
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      placeholder="Model name"
                    />
                  </div>
                </div>

                {/* Model Parameters */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Temperature</label>
                    <Input
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      min="0"
                      max="2"
                      step="0.1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Tokens</label>
                    <Input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      min="1"
                      max="4000"
                    />
                  </div>
                </div>

                {/* Test-specific inputs */}
                {(selectedTest === 'prompt-individual' || selectedTest === 'structured-output') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Prompt Key</label>
                      <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a prompt" />
                        </SelectTrigger>
                        <SelectContent>
                          {testInfo.availablePrompts.map((prompt) => (
                            <SelectItem key={prompt} value={prompt}>
                              {prompt.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Prompt Variables (JSON)</label>
                      <Textarea
                        value={promptVariables}
                        onChange={(e) => setPromptVariables(e.target.value)}
                        placeholder='{"expertise": "digital marketing", "targetAudience": "small businesses"}'
                        className="font-mono text-sm"
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {(selectedTest === 'ui-input-generation' || selectedTest === 'conversation-flow') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">User Input</label>
                      <Textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="I want to create a calculator for my consulting business"
                        rows={2}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Input History (JSON)</label>
                      <Textarea
                        value={inputHistory}
                        onChange={(e) => setInputHistory(e.target.value)}
                        placeholder='[{"step": 1, "question": "What type of tool?", "answer": "calculator"}]'
                        className="font-mono text-sm"
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {/* Required Parameters Display */}
                <div>
                  <label className="block text-sm font-medium mb-2">Required Parameters</label>
                  <div className="flex flex-wrap gap-1">
                    {getRequiredParams(selectedTest).map((param) => (
                      <Badge key={param} variant="outline" className="text-xs">
                        {param}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Run Test Button */}
                <Button 
                  onClick={runTest} 
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running Test...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Test
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {lastResult?.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : lastResult?.success === false ? (
                    <XCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <Brain className="h-5 w-5 text-gray-400" />
                  )}
                  Test Results
                  {lastResult?.metrics && (
                    <Badge variant="outline" className="ml-auto">
                      {lastResult.metrics.processingTime}ms
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!lastResult ? (
                  <div className="text-center py-8 text-gray-500">
                    Configure your test parameters and click "Run Test" to see results
                  </div>
                ) : lastResult.success ? (
                  <div className="space-y-4">
                    {/* Success Result */}
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Test Passed</span>
                    </div>

                    {/* Test Type Specific Results */}
                    {selectedTest === 'model-connection' && lastResult.data && (
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Provider:</strong> {lastResult.data.provider}
                        </div>
                        <div className="text-sm">
                          <strong>Model:</strong> {lastResult.data.model}
                        </div>
                        <div className="text-sm">
                          <strong>Response:</strong>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-sm">
                          {lastResult.data.response}
                        </div>
                      </div>
                    )}

                    {selectedTest === 'ui-input-generation' && lastResult.data?.generatedQuestion && (
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Generated Question:</strong>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg text-sm">
                          {lastResult.data.generatedQuestion.question}
                        </div>
                        <div className="text-sm">
                          <strong>Input Type:</strong> 
                          <Badge variant="outline" className="ml-2">
                            {lastResult.data.generatedQuestion.inputType}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <strong>Reasoning:</strong>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-sm">
                          {lastResult.data.generatedQuestion.reasoning}
                        </div>
                      </div>
                    )}

                    {selectedTest === 'conversation-flow' && lastResult.data?.flowAnalysis && (
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>AI Response:</strong>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg text-sm">
                          {lastResult.data.flowAnalysis.response}
                        </div>
                        <div className="text-sm">
                          <strong>Suggested Next Step:</strong>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-sm">
                          {lastResult.data.flowAnalysis.suggestedNextStep}
                        </div>
                      </div>
                    )}

                    {/* Full Response Toggle */}
                    <div className="pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFullResponse(!showFullResponse)}
                        className="flex items-center gap-2"
                      >
                        {showFullResponse ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showFullResponse ? 'Hide' : 'Show'} Full Response
                      </Button>
                      
                      {showFullResponse && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Full JSON Response</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(JSON.stringify(lastResult.data, null, 2))}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-96">
                            {JSON.stringify(lastResult.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Error Result */}
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span className="font-medium">Test Failed</span>
                    </div>
                    
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                      <div className="text-sm text-red-800">
                        <strong>Error:</strong> {lastResult.error || lastResult.message}
                      </div>
                    </div>

                    {/* Full Error Response */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFullResponse(!showFullResponse)}
                      className="flex items-center gap-2"
                    >
                      {showFullResponse ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {showFullResponse ? 'Hide' : 'Show'} Full Error
                    </Button>
                    
                    {showFullResponse && (
                      <pre className="bg-gray-900 text-red-400 p-4 rounded-lg text-xs overflow-auto max-h-96">
                        {JSON.stringify(lastResult, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 