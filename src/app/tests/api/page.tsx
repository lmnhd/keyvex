// API Testing Page - Test all API routes before AWS integration

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock,
  Code,
  Database,
  Zap
} from 'lucide-react';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'pending' | 'success' | 'error';
  statusCode?: number;
  response?: any;
  error?: string;
  duration?: number;
}

const API_TESTS = [
  {
    name: 'Magic Spark - Generate Suggestions',
    endpoint: '/api/ai/magic-spark',
    method: 'POST',
    body: {
      expertise: 'Business Consulting',
      targetAudience: 'Small business owners',
      industry: 'Professional Services',
      goals: ['Lead generation', 'Client assessment'],
      action: 'generate'
    }
  },
  {
    name: 'Magic Spark - Get Status',
    endpoint: '/api/ai/magic-spark?action=status',
    method: 'GET'
  },
  {
    name: 'Logic Architect - Generate Framework',
    endpoint: '/api/ai/logic-architect',
    method: 'POST',
    body: {
      selectedSuggestion: {
        type: 'assessment',
        title: 'Business Readiness Assessment',
        description: 'Evaluate business readiness for growth'
      },
      expertise: 'Business Consulting',
      targetAudience: 'Small business owners',
      action: 'generate'
    }
  },
  {
    name: 'Logic Architect - Get Templates',
    endpoint: '/api/ai/logic-architect?action=templates',
    method: 'GET'
  },
  {
    name: 'Content Crafter - Generate Content',
    endpoint: '/api/ai/content-crafter',
    method: 'POST',
    body: {
      framework: {
        type: 'assessment',
        title: 'Business Readiness Assessment',
        structure: {
          steps: [
            { id: 1, title: 'Introduction', type: 'intro' },
            { id: 2, title: 'Assessment Questions', type: 'input' },
            { id: 3, title: 'Results', type: 'output' }
          ]
        }
      },
      branding: {
        companyName: 'Test Company',
        tone: 'professional',
        colors: { primary: '#3b82f6' }
      },
      targetAudience: 'Small business owners',
      action: 'generate'
    }
  },
  {
    name: 'Content Crafter - Get Templates',
    endpoint: '/api/ai/content-crafter?action=templates',
    method: 'GET'
  },
  {
    name: 'Style Master - Generate Styles',
    endpoint: '/api/ai/style-master',
    method: 'POST',
    body: {
      framework: {
        type: 'assessment',
        title: 'Business Readiness Assessment',
        structure: { steps: [] }
      },
      content: {
        sections: {
          introduction: { headline: 'Test Assessment' }
        }
      },
      branding: {
        companyName: 'Test Company',
        tone: 'professional',
        colors: { primary: '#3b82f6' }
      },
      action: 'generate'
    }
  },
  {
    name: 'Style Master - Get Themes',
    endpoint: '/api/ai/style-master?action=themes',
    method: 'GET'
  },
  {
    name: 'Tools - Get User Tools',
    endpoint: '/api/tools',
    method: 'GET'
  },
  {
    name: 'Tools - Create Tool',
    endpoint: '/api/tools',
    method: 'POST',
    body: {
      title: 'Test Assessment Tool',
      description: 'A test assessment for API testing',
      type: 'assessment',
      framework: { test: true },
      content: { test: true },
      styles: { test: true },
      branding: { test: true }
    }
  },
  {
    name: 'Analytics - Get User Analytics',
    endpoint: '/api/analytics',
    method: 'GET'
  },
  {
    name: 'Analytics - Track Event',
    endpoint: '/api/analytics',
    method: 'POST',
    body: {
      toolId: 'test_tool_123',
      eventType: 'view',
      eventData: {
        sessionId: 'test_session_123'
      }
    }
  }
];

export default function APITestPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customMethod, setCustomMethod] = useState('GET');
  const [customBody, setCustomBody] = useState('{}');

  const runTest = async (test: typeof API_TESTS[0], testKey: string) => {
    setResults(prev => ({
      ...prev,
      [testKey]: {
        endpoint: test.endpoint,
        method: test.method,
        status: 'pending'
      }
    }));

    const startTime = Date.now();

    try {
      const options: RequestInit = {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (test.body && test.method !== 'GET') {
        options.body = JSON.stringify(test.body);
      }

      const response = await fetch(test.endpoint, options);
      const data = await response.json();
      const duration = Date.now() - startTime;

      setResults(prev => ({
        ...prev,
        [testKey]: {
          endpoint: test.endpoint,
          method: test.method,
          status: response.ok ? 'success' : 'error',
          statusCode: response.status,
          response: data,
          duration
        }
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      setResults(prev => ({
        ...prev,
        [testKey]: {
          endpoint: test.endpoint,
          method: test.method,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration
        }
      }));
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    setResults({});
    
    for (let i = 0; i < API_TESTS.length; i++) {
      const test = API_TESTS[i];
      const testKey = `test_${i}`;
      await runTest(test, testKey);
      // Add small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsRunningAll(false);
  };

  const runCustomTest = async () => {
    const testKey = 'custom_test';
    
    setResults(prev => ({
      ...prev,
      [testKey]: {
        endpoint: customEndpoint,
        method: customMethod,
        status: 'pending'
      }
    }));

    const startTime = Date.now();

    try {
      let body;
      try {
        body = customBody.trim() ? JSON.parse(customBody) : undefined;
      } catch (e) {
        throw new Error('Invalid JSON in request body');
      }

      const options: RequestInit = {
        method: customMethod,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (body && customMethod !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(customEndpoint, options);
      const data = await response.json();
      const duration = Date.now() - startTime;

      setResults(prev => ({
        ...prev,
        [testKey]: {
          endpoint: customEndpoint,
          method: customMethod,
          status: response.ok ? 'success' : 'error',
          statusCode: response.status,
          response: data,
          duration
        }
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      setResults(prev => ({
        ...prev,
        [testKey]: {
          endpoint: customEndpoint,
          method: customMethod,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration
        }
      }));
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">API Testing Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Test all API routes and endpoints before AWS integration
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Test Controls
            </CardTitle>
            <CardDescription>
              Run predefined tests or create custom API calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button 
                onClick={runAllTests} 
                disabled={isRunningAll}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                {isRunningAll ? 'Running Tests...' : 'Run All Tests'}
              </Button>
              <Badge variant="outline" className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                {API_TESTS.length} Tests
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Predefined Tests */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Code className="h-5 w-5" />
              Predefined API Tests
            </h2>
            <div className="space-y-4">
              {API_TESTS.map((test, index) => {
                const testKey = `test_${index}`;
                const result = results[testKey];
                
                return (
                  <Card key={testKey} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {test.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {result && getStatusIcon(result.status)}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runTest(test, testKey)}
                            disabled={result?.status === 'pending' || isRunningAll}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={getStatusColor(result?.status || 'pending')}>
                          {test.method}
                        </Badge>
                        <code className="bg-muted px-1 rounded">{test.endpoint}</code>
                      </div>
                    </CardHeader>
                    
                    {result && (
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {result.statusCode && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium">Status:</span>
                              <Badge variant={result.statusCode < 400 ? "default" : "destructive"}>
                                {result.statusCode}
                              </Badge>
                              {result.duration && (
                                <span className="text-muted-foreground">
                                  {result.duration}ms
                                </span>
                              )}
                            </div>
                          )}
                          
                          {result.error && (
                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                              {result.error}
                            </div>
                          )}
                          
                          {result.response && (
                            <details className="text-xs">
                              <summary className="cursor-pointer font-medium text-muted-foreground">
                                Response Data
                              </summary>
                              <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-40">
                                {JSON.stringify(result.response, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Custom Test */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Custom API Test</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Custom Request</CardTitle>
                <CardDescription>
                  Test any endpoint with custom parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint">Endpoint</Label>
                  <Input
                    id="endpoint"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="/api/..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="method">Method</Label>
                  <select 
                    id="method"
                    value={customMethod}
                    onChange={(e) => setCustomMethod(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    aria-label="HTTP method selection"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="body">Request Body (JSON)</Label>
                  <Textarea
                    id="body"
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={4}
                  />
                </div>
                
                <Button 
                  onClick={runCustomTest}
                  disabled={!customEndpoint || results.custom_test?.status === 'pending'}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Run Custom Test
                </Button>
                
                {results.custom_test && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(results.custom_test.status)}
                      <span className="text-sm font-medium">
                        {results.custom_test.status.toUpperCase()}
                      </span>
                      {results.custom_test.statusCode && (
                        <Badge variant={results.custom_test.statusCode < 400 ? "default" : "destructive"}>
                          {results.custom_test.statusCode}
                        </Badge>
                      )}
                    </div>
                    
                    {results.custom_test.error && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        {results.custom_test.error}
                      </div>
                    )}
                    
                    {results.custom_test.response && (
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium">Response</summary>
                        <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-40">
                          {JSON.stringify(results.custom_test.response, null, 2)}
                        </pre>
                      </details>
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