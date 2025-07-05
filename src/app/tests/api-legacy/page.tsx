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
      
      // Add a small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunningAll(false);
  };

  const runCustomTest = async () => {
    if (!customEndpoint) return;

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
      const options: RequestInit = {
        method: customMethod,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (customBody && customMethod !== 'GET') {
        try {
          JSON.parse(customBody); // Validate JSON
          options.body = customBody;
        } catch {
          throw new Error('Invalid JSON in request body');
        }
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
        return 'secondary';
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">API Testing Dashboard</h1>
            <p className="text-muted-foreground">
              Test all Keyvex API routes before AWS integration
            </p>
            <div className="flex justify-center space-x-4">
              <Button 
                onClick={runAllTests} 
                disabled={isRunningAll}
                className="flex items-center space-x-2"
              >
                <Zap className="h-4 w-4" />
                <span>{isRunningAll ? 'Running Tests...' : 'Run All Tests'}</span>
              </Button>
            </div>
          </div>

          {/* Test Results Summary */}
          {Object.keys(results).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>Test Results Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {Object.values(results).filter(r => r.status === 'success').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {Object.values(results).filter(r => r.status === 'error').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-500">
                      {Object.values(results).filter(r => r.status === 'pending').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Running</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Predefined Tests */}
          <Card>
            <CardHeader>
              <CardTitle>Predefined API Tests</CardTitle>
              <CardDescription>
                Test all major API endpoints with sample data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {API_TESTS.map((test, index) => {
                const testKey = `test_${index}`;
                const result = results[testKey];

                return (
                  <div key={testKey} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(result?.status)}
                      <div>
                        <h4 className="font-medium">{test.name}</h4>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {test.method}
                          </Badge>
                          <span>{test.endpoint}</span>
                          {result?.duration && (
                            <span>({result.duration}ms)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {result?.statusCode && (
                        <Badge variant={getStatusColor(result.status)}>
                          {result.statusCode}
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runTest(test, testKey)}
                        disabled={result?.status === 'pending'}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Custom Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Code className="h-5 w-5" />
                <span>Custom API Test</span>
              </CardTitle>
              <CardDescription>
                Test any endpoint with custom parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endpoint">Endpoint</Label>
                  <Input
                    id="endpoint"
                    placeholder="/api/..."
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method">Method</Label>
                  <select
                    id="method"
                    value={customMethod}
                    onChange={(e) => setCustomMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    aria-label="HTTP Method"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Request Body (JSON)</Label>
                <Textarea
                  id="body"
                  placeholder='{"key": "value"}'
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={runCustomTest} disabled={!customEndpoint}>
                Run Custom Test
              </Button>
            </CardContent>
          </Card>

          {/* Test Results Details */}
          {Object.entries(results).map(([testKey, result]) => (
            <Card key={testKey}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(result.status)}
                    <span>{result.endpoint}</span>
                  </div>
                  <Badge variant={getStatusColor(result.status)}>
                    {result.method} {result.statusCode}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.error && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-destructive text-sm">{result.error}</p>
                  </div>
                )}
                {result.response && (
                  <div className="space-y-2">
                    <Label>Response</Label>
                    <pre className="p-3 bg-muted rounded-lg text-sm overflow-auto max-h-96">
                      {JSON.stringify(result.response, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
} 
