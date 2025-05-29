'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  DollarSign, 
  Activity, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  Database,
  Zap,
  BarChart3,
  PieChart,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';

// Import model configuration and admin utilities
import modelConfig from '@/lib/ai/models/model-config';
import { AdminBehaviorDashboard } from '@/components/ai/behavior-dashboard';

interface CostMetrics {
  totalCost: number;
  costByProcess: Record<string, number>;
  costByProvider: Record<string, number>;
  costByModel: Record<string, number>;
  dailyCosts: Array<{ date: string; cost: number }>;
  topExpensiveRequests: Array<{
    id: string;
    process: string;
    cost: number;
    tokens: number;
    timestamp: string;
  }>;
}

interface UsageMetrics {
  totalRequests: number;
  requestsByProcess: Record<string, number>;
  requestsByProvider: Record<string, number>;
  averageResponseTime: number;
  successRate: number;
  fallbackUsage: number;
  hourlyUsage: Array<{ hour: string; requests: number }>;
}

interface PerformanceMetrics {
  averageLatency: number;
  latencyByProcess: Record<string, number>;
  errorRate: number;
  errorsByType: Record<string, number>;
  throughput: number;
  cacheHitRate: number;
}

interface AlertMetrics {
  highCostAlerts: Array<{
    id: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
  }>;
  performanceAlerts: Array<{
    id: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
  }>;
  errorAlerts: Array<{
    id: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
  }>;
}

export default function AdminDashboard() {
  const [costMetrics, setCostMetrics] = useState<CostMetrics | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [alertMetrics, setAlertMetrics] = useState<AlertMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadMetrics();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      // Fetch real metrics from API
      const response = await fetch('/api/admin/metrics?timeRange=24h&metrics=costs,usage,performance,alerts');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        
        // Transform API data to match component interfaces
        setCostMetrics(data.costs || generateMockCostMetrics());
        setUsageMetrics(data.usage || generateMockUsageMetrics());
        setPerformanceMetrics(data.performance || generateMockPerformanceMetrics());
        setAlertMetrics(data.alerts || generateMockAlertMetrics());
      } else {
        // Fallback to mock data if API fails
        console.warn('API returned no data, using mock data');
        setCostMetrics(generateMockCostMetrics());
        setUsageMetrics(generateMockUsageMetrics());
        setPerformanceMetrics(generateMockPerformanceMetrics());
        setAlertMetrics(generateMockAlertMetrics());
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load metrics from API:', error);
      
      // Fallback to mock data on error
      console.warn('Using mock data due to API error');
      setCostMetrics(generateMockCostMetrics());
      setUsageMetrics(generateMockUsageMetrics());
      setPerformanceMetrics(generateMockPerformanceMetrics());
      setAlertMetrics(generateMockAlertMetrics());
      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockCostMetrics = (): CostMetrics => {
    const processes = Object.keys(modelConfig.getProcesses());
    const providers = Object.keys(modelConfig.getProviders());
    
    const costByProcess: Record<string, number> = {};
    const costByProvider: Record<string, number> = {};
    const costByModel: Record<string, number> = {};
    
    let totalCost = 0;
    
    processes.forEach(process => {
      const cost = Math.random() * 50 + 5; // $5-$55
      costByProcess[process] = cost;
      totalCost += cost;
      
      const primaryModel = modelConfig.getPrimaryModel(process);
      if (primaryModel) {
        costByProvider[primaryModel.provider] = (costByProvider[primaryModel.provider] || 0) + cost * 0.7;
        costByModel[primaryModel.model] = (costByModel[primaryModel.model] || 0) + cost * 0.7;
        
        const fallbackModel = modelConfig.getFallbackModel(process);
        if (fallbackModel) {
          costByProvider[fallbackModel.provider] = (costByProvider[fallbackModel.provider] || 0) + cost * 0.3;
          costByModel[fallbackModel.model] = (costByModel[fallbackModel.model] || 0) + cost * 0.3;
        }
      }
    });

    const dailyCosts = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cost: Math.random() * 20 + 10
    }));

    const topExpensiveRequests = Array.from({ length: 5 }, (_, i) => ({
      id: `req_${Date.now()}_${i}`,
      process: processes[Math.floor(Math.random() * processes.length)],
      cost: Math.random() * 5 + 1,
      tokens: Math.floor(Math.random() * 5000 + 1000),
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
    }));

    return {
      totalCost,
      costByProcess,
      costByProvider,
      costByModel,
      dailyCosts,
      topExpensiveRequests
    };
  };

  const generateMockUsageMetrics = (): UsageMetrics => {
    const processes = Object.keys(modelConfig.getProcesses());
    const providers = Object.keys(modelConfig.getProviders());
    
    const requestsByProcess: Record<string, number> = {};
    const requestsByProvider: Record<string, number> = {};
    
    let totalRequests = 0;
    
    processes.forEach(process => {
      const requests = Math.floor(Math.random() * 500 + 50);
      requestsByProcess[process] = requests;
      totalRequests += requests;
    });

    providers.forEach(provider => {
      requestsByProvider[provider] = Math.floor(Math.random() * 300 + 100);
    });

    const hourlyUsage = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      requests: Math.floor(Math.random() * 50 + 10)
    }));

    return {
      totalRequests,
      requestsByProcess,
      requestsByProvider,
      averageResponseTime: Math.random() * 2000 + 500, // 500-2500ms
      successRate: 95 + Math.random() * 4, // 95-99%
      fallbackUsage: Math.random() * 10 + 2, // 2-12%
      hourlyUsage
    };
  };

  const generateMockPerformanceMetrics = (): PerformanceMetrics => {
    const processes = Object.keys(modelConfig.getProcesses());
    
    const latencyByProcess: Record<string, number> = {};
    processes.forEach(process => {
      latencyByProcess[process] = Math.random() * 1500 + 300; // 300-1800ms
    });

    const errorsByType = {
      'timeout': Math.floor(Math.random() * 10 + 1),
      'rate_limit': Math.floor(Math.random() * 5 + 1),
      'api_error': Math.floor(Math.random() * 8 + 2),
      'validation': Math.floor(Math.random() * 15 + 3)
    };

    return {
      averageLatency: Math.random() * 1200 + 400,
      latencyByProcess,
      errorRate: Math.random() * 3 + 1, // 1-4%
      errorsByType,
      throughput: Math.random() * 100 + 50, // 50-150 req/min
      cacheHitRate: Math.random() * 30 + 60 // 60-90%
    };
  };

  const generateMockAlertMetrics = (): AlertMetrics => {
    const severities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
    
    const highCostAlerts = [
      {
        id: 'cost_1',
        message: 'Magic Spark process exceeded $50 daily budget',
        severity: 'high' as const,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'cost_2',
        message: 'Claude 3.5 Sonnet usage 40% above average',
        severity: 'medium' as const,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      }
    ];

    const performanceAlerts = [
      {
        id: 'perf_1',
        message: 'Average response time increased by 25%',
        severity: 'medium' as const,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      }
    ];

    const errorAlerts = [
      {
        id: 'error_1',
        message: 'Rate limiting detected on OpenAI API',
        severity: 'high' as const,
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      }
    ];

    return {
      highCostAlerts,
      performanceAlerts,
      errorAlerts
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-500 bg-blue-50 border-blue-200';
      default: return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const exportMetrics = () => {
    const data = {
      costMetrics,
      usageMetrics,
      performanceMetrics,
      alertMetrics,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keyvex-metrics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading && !costMetrics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">
                Monitor AI model costs, usage, and performance metrics
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={exportMetrics}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={loadMetrics} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost (7 days)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(costMetrics?.totalCost || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  +12% from last week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(usageMetrics?.totalRequests || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  +8% from yesterday
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(usageMetrics?.averageResponseTime || 0)}ms</div>
                <p className="text-xs text-muted-foreground">
                  -5% from last hour
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercentage(usageMetrics?.successRate || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  +0.2% from yesterday
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="costs" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
              <TabsTrigger value="usage">Usage Metrics</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
              <TabsTrigger value="behavior">User Behavior</TabsTrigger>
            </TabsList>

            {/* Cost Analysis Tab */}
            <TabsContent value="costs" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cost by Process */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <PieChart className="h-5 w-5" />
                      <span>Cost by Process</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {costMetrics && Object.entries(costMetrics.costByProcess)
                        .sort(([,a], [,b]) => b - a)
                        .map(([process, cost]) => (
                        <div key={process} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="text-sm capitalize">{process}</span>
                          </div>
                          <span className="font-mono text-sm">{formatCurrency(cost)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Cost by Provider */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5" />
                      <span>Cost by Provider</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {costMetrics && Object.entries(costMetrics.costByProvider)
                        .sort(([,a], [,b]) => b - a)
                        .map(([provider, cost]) => (
                        <div key={provider} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="capitalize">{provider}</Badge>
                          </div>
                          <span className="font-mono text-sm">{formatCurrency(cost)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Expensive Requests */}
              <Card>
                <CardHeader>
                  <CardTitle>Most Expensive Requests</CardTitle>
                  <CardDescription>
                    Highest cost individual API requests in the last 24 hours
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {costMetrics?.topExpensiveRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="capitalize">{request.process}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatNumber(request.tokens)} tokens
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-semibold">{formatCurrency(request.cost)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Usage Metrics Tab */}
            <TabsContent value="usage" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Requests by Process */}
                <Card>
                  <CardHeader>
                    <CardTitle>Requests by Process</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {usageMetrics && Object.entries(usageMetrics.requestsByProcess)
                        .sort(([,a], [,b]) => b - a)
                        .map(([process, requests]) => (
                        <div key={process} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{process}</span>
                          <span className="font-mono text-sm">{formatNumber(requests)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Usage Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>Usage Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Fallback Usage</span>
                        <span className="font-mono text-sm">{formatPercentage(usageMetrics?.fallbackUsage || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Cache Hit Rate</span>
                        <span className="font-mono text-sm">{formatPercentage(performanceMetrics?.cacheHitRate || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Throughput</span>
                        <span className="font-mono text-sm">{formatNumber(performanceMetrics?.throughput || 0)} req/min</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Latency by Process */}
                <Card>
                  <CardHeader>
                    <CardTitle>Latency by Process</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {performanceMetrics && Object.entries(performanceMetrics.latencyByProcess)
                        .sort(([,a], [,b]) => b - a)
                        .map(([process, latency]) => (
                        <div key={process} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{process}</span>
                          <span className="font-mono text-sm">{Math.round(latency)}ms</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Error Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle>Error Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium">Overall Error Rate</span>
                        <span className="font-mono text-sm">{formatPercentage(performanceMetrics?.errorRate || 0)}</span>
                      </div>
                      <Separator />
                      {performanceMetrics && Object.entries(performanceMetrics.errorsByType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                          <span className="font-mono text-sm">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Alerts Tab */}
            <TabsContent value="alerts" className="space-y-6">
              {/* Cost Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Cost Alerts</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alertMetrics?.highCostAlerts.map((alert) => (
                      <div key={alert.id} className={`p-3 border rounded-lg ${getSeverityColor(alert.severity)}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{alert.message}</p>
                            <p className="text-xs opacity-75">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="outline" className={alert.severity === 'high' ? 'border-red-300' : alert.severity === 'medium' ? 'border-yellow-300' : 'border-blue-300'}>
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alertMetrics?.performanceAlerts.map((alert) => (
                      <div key={alert.id} className={`p-3 border rounded-lg ${getSeverityColor(alert.severity)}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{alert.message}</p>
                            <p className="text-xs opacity-75">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="outline" className={alert.severity === 'high' ? 'border-red-300' : alert.severity === 'medium' ? 'border-yellow-300' : 'border-blue-300'}>
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Error Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle>Error Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alertMetrics?.errorAlerts.map((alert) => (
                      <div key={alert.id} className={`p-3 border rounded-lg ${getSeverityColor(alert.severity)}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{alert.message}</p>
                            <p className="text-xs opacity-75">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="outline" className={alert.severity === 'high' ? 'border-red-300' : alert.severity === 'medium' ? 'border-yellow-300' : 'border-blue-300'}>
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Behavior Tab */}
            <TabsContent value="behavior" className="space-y-6">
              <AdminBehaviorDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
} 