'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Zap, 
  Database, 
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// Import model configuration functions
import modelConfig from '@/lib/ai/models/model-config';

interface ModelConfigData {
  version: string;
  environment: string;
  totalProviders: number;
  totalModels: number;
  totalProcesses: number;
  enabledFeatures: string[];
}

interface ProcessInfo {
  name: string;
  config: any;
  primaryModel: any;
  fallbackModel: any;
}

export default function ModelConfigTestPage() {
  const [configSummary, setConfigSummary] = useState<ModelConfigData | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<string>('magicSpark');
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = () => {
    try {
      // Get configuration summary
      const summary = modelConfig.getConfigSummary();
      setConfigSummary(summary);

      // Get all processes
      const allProcesses = modelConfig.getProcesses();
      const processInfo: ProcessInfo[] = Object.entries(allProcesses).map(([name, config]) => ({
        name,
        config,
        primaryModel: modelConfig.getPrimaryModel(name),
        fallbackModel: modelConfig.getFallbackModel(name)
      }));
      setProcesses(processInfo);

    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  };

  const testModelConfig = async (processName: string) => {
    try {
      setTestResults(prev => ({ ...prev, [processName]: { status: 'testing' } }));

      // Test getting model configuration
      const primaryModel = modelConfig.getPrimaryModel(processName);
      const fallbackModel = modelConfig.getFallbackModel(processName);
      
      // Test cost calculation
      const estimatedCost = primaryModel ? 
        modelConfig.calculateCost(primaryModel.provider, primaryModel.model, 1000, 500) : 0;

      // Test capability check
      const supportsStreaming = primaryModel ? 
        modelConfig.supportsCapability(primaryModel.provider, primaryModel.model, 'text') : false;

      setTestResults(prev => ({
        ...prev,
        [processName]: {
          status: 'success',
          primaryModel,
          fallbackModel,
          estimatedCost,
          supportsStreaming,
          timestamp: new Date().toISOString()
        }
      }));

    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [processName]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }));
    }
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'testing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">AI Model Configuration Test</h1>
            <p className="text-muted-foreground">
              Test and explore the centralized AI model configuration system
            </p>
          </div>

          {/* Configuration Summary */}
          {configSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Configuration Summary</span>
                </CardTitle>
                <CardDescription>
                  Overview of the current model configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{configSummary.version}</div>
                    <div className="text-sm text-muted-foreground">Version</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{configSummary.environment}</div>
                    <div className="text-sm text-muted-foreground">Environment</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{configSummary.totalProviders}</div>
                    <div className="text-sm text-muted-foreground">Providers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{configSummary.totalModels}</div>
                    <div className="text-sm text-muted-foreground">Models</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{configSummary.totalProcesses}</div>
                    <div className="text-sm text-muted-foreground">Processes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{configSummary.enabledFeatures.length}</div>
                    <div className="text-sm text-muted-foreground">Features</div>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div>
                  <h4 className="font-semibold mb-2">Enabled Features</h4>
                  <div className="flex flex-wrap gap-2">
                    {configSummary.enabledFeatures.map((feature) => (
                      <Badge key={feature} variant="secondary">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Process Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Process Configurations</span>
              </CardTitle>
              <CardDescription>
                AI model configurations for each process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {processes.map((process) => (
                <div key={process.name} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold capitalize">{process.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {process.config.description}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(testResults[process.name]?.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testModelConfig(process.name)}
                        disabled={testResults[process.name]?.status === 'testing'}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Test
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Primary Model */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">Primary Model</h5>
                      {process.primaryModel ? (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant="default">
                              {process.primaryModel.provider}
                            </Badge>
                            <span className="text-sm font-mono">
                              {process.primaryModel.model}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {process.primaryModel.modelInfo.name}
                          </div>
                          <div className="flex items-center space-x-4 text-xs">
                            <span>Max: {process.primaryModel.modelInfo.maxTokens.toLocaleString()} tokens</span>
                            <span className="flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {formatCost(process.primaryModel.modelInfo.costPer1kTokens.input)}/1k in
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Not configured</div>
                      )}
                    </div>

                    {/* Fallback Model */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">Fallback Model</h5>
                      {process.fallbackModel ? (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">
                              {process.fallbackModel.provider}
                            </Badge>
                            <span className="text-sm font-mono">
                              {process.fallbackModel.model}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {process.fallbackModel.modelInfo.name}
                          </div>
                          <div className="flex items-center space-x-4 text-xs">
                            <span>Max: {process.fallbackModel.modelInfo.maxTokens.toLocaleString()} tokens</span>
                            <span className="flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {formatCost(process.fallbackModel.modelInfo.costPer1kTokens.input)}/1k in
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Not configured</div>
                      )}
                    </div>
                  </div>

                  {/* Test Results */}
                  {testResults[process.name] && testResults[process.name].status === 'success' && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <h6 className="font-medium text-sm mb-2">Test Results</h6>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Estimated Cost (1k in, 500 out):</span>
                          <div className="font-mono">{formatCost(testResults[process.name].estimatedCost)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Supports Text:</span>
                          <div>{testResults[process.name].supportsStreaming ? 'Yes' : 'No'}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {testResults[process.name] && testResults[process.name].status === 'error' && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="text-sm text-destructive">
                        Error: {testResults[process.name].error}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 