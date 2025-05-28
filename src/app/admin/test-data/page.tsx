'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Trash2, 
  Database, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

import modelConfig from '@/lib/ai/models/model-config';

export default function AdminTestDataPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const generateSampleData = async () => {
    setIsGenerating(true);
    setStatus('idle');
    
    try {
      const processes = Object.keys(modelConfig.getProcesses());
      const providers = Object.keys(modelConfig.getProviders());
      
      // Generate 50 sample requests
      const requests = [];
      for (let i = 0; i < 50; i++) {
        const process = processes[Math.floor(Math.random() * processes.length)];
        const primaryModel = modelConfig.getPrimaryModel(process);
        
        if (primaryModel) {
          const inputTokens = Math.floor(Math.random() * 3000 + 500);
          const outputTokens = Math.floor(Math.random() * 1500 + 200);
          const latency = Math.floor(Math.random() * 3000 + 300);
          const success = Math.random() > 0.05; // 95% success rate
          
          const requestData = {
            action: 'track_request',
            process,
            provider: primaryModel.provider,
            model: primaryModel.model,
            inputTokens,
            outputTokens,
            latency,
            success,
            error: success ? undefined : getRandomError()
          };
          
          requests.push(requestData);
        }
      }
      
      // Send requests to API
      let successCount = 0;
      for (const request of requests) {
        try {
          const response = await fetch('/api/admin/metrics', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request)
          });
          
          if (response.ok) {
            successCount++;
          }
          
          // Add small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          console.error('Failed to send request:', error);
        }
      }
      
      // Generate some alerts
      const alerts = [
        {
          action: 'create_alert',
          type: 'cost',
          severity: 'high',
          message: 'Daily cost budget exceeded for Magic Spark process'
        },
        {
          action: 'create_alert',
          type: 'performance',
          severity: 'medium',
          message: 'Average response time increased by 30% in the last hour'
        },
        {
          action: 'create_alert',
          type: 'error',
          severity: 'high',
          message: 'Rate limiting detected on Anthropic API'
        }
      ];
      
      for (const alert of alerts) {
        try {
          await fetch('/api/admin/metrics', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(alert)
          });
        } catch (error) {
          console.error('Failed to create alert:', error);
        }
      }
      
      setLastAction(`Generated ${successCount}/${requests.length} sample requests and ${alerts.length} alerts`);
      setStatus('success');
      
    } catch (error) {
      console.error('Failed to generate sample data:', error);
      setLastAction('Failed to generate sample data');
      setStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const clearAllData = async () => {
    setIsClearing(true);
    setStatus('idle');
    
    try {
      const response = await fetch('/api/admin/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear_metrics',
          type: 'all'
        })
      });
      
      if (response.ok) {
        setLastAction('All metrics data cleared successfully');
        setStatus('success');
      } else {
        throw new Error('Failed to clear data');
      }
      
    } catch (error) {
      console.error('Failed to clear data:', error);
      setLastAction('Failed to clear metrics data');
      setStatus('error');
    } finally {
      setIsClearing(false);
    }
  };

  const getRandomError = (): string => {
    const errors = [
      'timeout',
      'rate_limit',
      'api_error',
      'validation',
      'network_error'
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Admin Test Data Generator</h1>
            <p className="text-muted-foreground">
              Generate sample metrics data for testing the admin dashboard
            </p>
          </div>

          {/* Configuration Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Current Configuration</span>
              </CardTitle>
              <CardDescription>
                Sample data will be generated based on your current model configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{Object.keys(modelConfig.getProcesses()).length}</div>
                  <div className="text-sm text-muted-foreground">AI Processes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{Object.keys(modelConfig.getProviders()).length}</div>
                  <div className="text-sm text-muted-foreground">Providers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {Object.values(modelConfig.getProviders()).reduce((sum, provider) => 
                      sum + Object.keys(provider.models).length, 0
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">Models</div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div>
                <h4 className="font-semibold mb-2">Available Processes</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(modelConfig.getProcesses()).map((process) => (
                    <Badge key={process} variant="secondary" className="capitalize">
                      {process}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Test Data Actions</CardTitle>
              <CardDescription>
                Generate sample data or clear existing metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={generateSampleData} 
                  disabled={isGenerating || isClearing}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Generate Sample Data
                </Button>
                
                <Button 
                  variant="destructive" 
                  onClick={clearAllData} 
                  disabled={isGenerating || isClearing}
                  className="flex-1"
                >
                  {isClearing ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear All Data
                </Button>
              </div>

              {lastAction && (
                <div className={`p-3 border rounded-lg ${getStatusColor()}`}>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon()}
                    <span className="text-sm font-medium">{lastAction}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sample Data Description */}
          <Card>
            <CardHeader>
              <CardTitle>What Gets Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Sample Requests (50 total)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Random distribution across all configured AI processes</li>
                    <li>• Realistic token counts (500-3500 input, 200-1700 output)</li>
                    <li>• Variable latency (300-3300ms)</li>
                    <li>• 95% success rate with realistic error types</li>
                    <li>• Automatic cost calculation based on model configuration</li>
                  </ul>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Sample Alerts (3 total)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• High cost alert for budget exceeded</li>
                    <li>• Performance alert for increased response time</li>
                    <li>• Error alert for API rate limiting</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  After generating sample data, visit the admin dashboard to see the metrics
                </p>
                <Button variant="outline" asChild>
                  <a href="/admin">
                    View Admin Dashboard
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 