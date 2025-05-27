// Admin Metrics API Route - Real-time monitoring data

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, debugLog } from '@/lib/auth/debug';
import modelConfig from '@/lib/ai/models/model-config';

// Request validation schema
const metricsRequestSchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  metrics: z.array(z.enum(['costs', 'usage', 'performance', 'alerts'])).default(['costs', 'usage', 'performance', 'alerts']),
  processes: z.array(z.string()).optional(),
  providers: z.array(z.string()).optional()
});

// In-memory storage for demo purposes
// In production, this would be stored in DynamoDB or another persistent store
let metricsStore: {
  requests: Array<{
    id: string;
    userId: string;
    process: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    latency: number;
    success: boolean;
    error?: string;
    timestamp: Date;
  }>;
  alerts: Array<{
    id: string;
    type: 'cost' | 'performance' | 'error';
    severity: 'low' | 'medium' | 'high';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>;
} = {
  requests: [],
  alerts: []
};

export async function GET(request: NextRequest) {
  try {
    // Authenticate user (admin only in production)
    const userId = await requireAuth();
    
    debugLog('Admin metrics GET request', { userId });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    const metricsParam = searchParams.get('metrics');
    const processesParam = searchParams.get('processes');
    const providersParam = searchParams.get('providers');

    const requestedMetrics = metricsParam ? metricsParam.split(',') : ['costs', 'usage', 'performance', 'alerts'];
    const requestedProcesses = processesParam ? processesParam.split(',') : undefined;
    const requestedProviders = providersParam ? providersParam.split(',') : undefined;

    // Calculate time range
    const now = new Date();
    const timeRangeMs = getTimeRangeMs(timeRange);
    const startTime = new Date(now.getTime() - timeRangeMs);

    // Filter requests by time range
    const filteredRequests = metricsStore.requests.filter(req => 
      req.timestamp >= startTime &&
      (!requestedProcesses || requestedProcesses.includes(req.process)) &&
      (!requestedProviders || requestedProviders.includes(req.provider))
    );

    const response: any = {
      timeRange,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      totalRequests: filteredRequests.length
    };

    // Generate requested metrics
    if (requestedMetrics.includes('costs')) {
      response.costs = generateCostMetrics(filteredRequests);
    }

    if (requestedMetrics.includes('usage')) {
      response.usage = generateUsageMetrics(filteredRequests);
    }

    if (requestedMetrics.includes('performance')) {
      response.performance = generatePerformanceMetrics(filteredRequests);
    }

    if (requestedMetrics.includes('alerts')) {
      response.alerts = generateAlertMetrics(startTime);
    }

    return NextResponse.json({
      success: true,
      data: response,
      metadata: {
        generatedAt: now.toISOString(),
        requestCount: filteredRequests.length,
        alertCount: metricsStore.alerts.filter(a => a.timestamp >= startTime && !a.resolved).length
      }
    });

  } catch (error) {
    console.error('Admin metrics API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await requireAuth();
    
    debugLog('Admin metrics POST request', { userId });

    // Parse request body
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'track_request':
        return handleTrackRequest(body, userId);
      
      case 'create_alert':
        return handleCreateAlert(body, userId);
      
      case 'resolve_alert':
        return handleResolveAlert(body, userId);
      
      case 'clear_metrics':
        return handleClearMetrics(body, userId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Admin metrics POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getTimeRangeMs(timeRange: string): number {
  switch (timeRange) {
    case '1h': return 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

function generateCostMetrics(requests: any[]) {
  const totalCost = requests.reduce((sum, req) => sum + req.cost, 0);
  
  const costByProcess: Record<string, number> = {};
  const costByProvider: Record<string, number> = {};
  const costByModel: Record<string, number> = {};
  
  requests.forEach(req => {
    costByProcess[req.process] = (costByProcess[req.process] || 0) + req.cost;
    costByProvider[req.provider] = (costByProvider[req.provider] || 0) + req.cost;
    costByModel[req.model] = (costByModel[req.model] || 0) + req.cost;
  });

  // Generate daily costs for the last 7 days
  const dailyCosts = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const dayCost = requests
      .filter(req => req.timestamp >= dayStart && req.timestamp < dayEnd)
      .reduce((sum, req) => sum + req.cost, 0);
    
    return {
      date: dayStart.toISOString().split('T')[0],
      cost: dayCost
    };
  });

  // Top expensive requests
  const topExpensiveRequests = requests
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10)
    .map(req => ({
      id: req.id,
      process: req.process,
      cost: req.cost,
      tokens: req.inputTokens + req.outputTokens,
      timestamp: req.timestamp.toISOString()
    }));

  return {
    totalCost,
    costByProcess,
    costByProvider,
    costByModel,
    dailyCosts,
    topExpensiveRequests,
    averageCostPerRequest: requests.length > 0 ? totalCost / requests.length : 0
  };
}

function generateUsageMetrics(requests: any[]) {
  const totalRequests = requests.length;
  const successfulRequests = requests.filter(req => req.success).length;
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
  
  const requestsByProcess: Record<string, number> = {};
  const requestsByProvider: Record<string, number> = {};
  
  requests.forEach(req => {
    requestsByProcess[req.process] = (requestsByProcess[req.process] || 0) + 1;
    requestsByProvider[req.provider] = (requestsByProvider[req.provider] || 0) + 1;
  });

  // Calculate average response time
  const totalLatency = requests.reduce((sum, req) => sum + req.latency, 0);
  const averageResponseTime = requests.length > 0 ? totalLatency / requests.length : 0;

  // Hourly usage for the last 24 hours
  const hourlyUsage = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
    hour.setMinutes(0, 0, 0);
    const nextHour = new Date(hour.getTime() + 60 * 60 * 1000);
    
    const hourRequests = requests.filter(req => 
      req.timestamp >= hour && req.timestamp < nextHour
    ).length;
    
    return {
      hour: hour.getHours().toString().padStart(2, '0') + ':00',
      requests: hourRequests
    };
  });

  // Calculate fallback usage (mock for now)
  const fallbackUsage = Math.random() * 10 + 2; // 2-12%

  return {
    totalRequests,
    requestsByProcess,
    requestsByProvider,
    averageResponseTime,
    successRate,
    fallbackUsage,
    hourlyUsage,
    totalTokens: requests.reduce((sum, req) => sum + req.inputTokens + req.outputTokens, 0)
  };
}

function generatePerformanceMetrics(requests: any[]) {
  const latencyByProcess: Record<string, number> = {};
  const processRequestCounts: Record<string, number> = {};
  
  requests.forEach(req => {
    if (!latencyByProcess[req.process]) {
      latencyByProcess[req.process] = 0;
      processRequestCounts[req.process] = 0;
    }
    latencyByProcess[req.process] += req.latency;
    processRequestCounts[req.process]++;
  });

  // Calculate average latency per process
  Object.keys(latencyByProcess).forEach(process => {
    latencyByProcess[process] = latencyByProcess[process] / processRequestCounts[process];
  });

  const totalLatency = requests.reduce((sum, req) => sum + req.latency, 0);
  const averageLatency = requests.length > 0 ? totalLatency / requests.length : 0;

  const errorRequests = requests.filter(req => !req.success);
  const errorRate = requests.length > 0 ? (errorRequests.length / requests.length) * 100 : 0;

  // Group errors by type
  const errorsByType: Record<string, number> = {};
  errorRequests.forEach(req => {
    const errorType = req.error || 'unknown';
    errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
  });

  // Calculate throughput (requests per minute)
  const timeSpan = requests.length > 0 ? 
    (Math.max(...requests.map(r => r.timestamp.getTime())) - Math.min(...requests.map(r => r.timestamp.getTime()))) / (1000 * 60) : 1;
  const throughput = requests.length / Math.max(timeSpan, 1);

  // Mock cache hit rate
  const cacheHitRate = Math.random() * 30 + 60; // 60-90%

  return {
    averageLatency,
    latencyByProcess,
    errorRate,
    errorsByType,
    throughput,
    cacheHitRate
  };
}

function generateAlertMetrics(startTime: Date) {
  const recentAlerts = metricsStore.alerts.filter(alert => 
    alert.timestamp >= startTime && !alert.resolved
  );

  const alertsByType = {
    highCostAlerts: recentAlerts.filter(a => a.type === 'cost'),
    performanceAlerts: recentAlerts.filter(a => a.type === 'performance'),
    errorAlerts: recentAlerts.filter(a => a.type === 'error')
  };

  return alertsByType;
}

async function handleTrackRequest(body: any, userId: string) {
  const {
    process,
    provider,
    model,
    inputTokens,
    outputTokens,
    latency,
    success,
    error
  } = body;

  // Calculate cost using model configuration
  const cost = modelConfig.calculateCost(provider, model, inputTokens, outputTokens);

  const requestRecord = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    process,
    provider,
    model,
    inputTokens,
    outputTokens,
    cost,
    latency,
    success,
    error,
    timestamp: new Date()
  };

  metricsStore.requests.push(requestRecord);

  // Check for alerts
  await checkAndCreateAlerts(requestRecord);

  debugLog('Request tracked', { id: requestRecord.id, cost, latency });

  return NextResponse.json({
    success: true,
    data: { id: requestRecord.id, cost }
  });
}

async function handleCreateAlert(body: any, userId: string) {
  const { type, severity, message } = body;

  const alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity,
    message,
    timestamp: new Date(),
    resolved: false
  };

  metricsStore.alerts.push(alert);

  return NextResponse.json({
    success: true,
    data: { id: alert.id }
  });
}

async function handleResolveAlert(body: any, userId: string) {
  const { alertId } = body;

  const alert = metricsStore.alerts.find(a => a.id === alertId);
  if (alert) {
    alert.resolved = true;
  }

  return NextResponse.json({
    success: true,
    data: { resolved: !!alert }
  });
}

async function handleClearMetrics(body: any, userId: string) {
  const { type } = body;

  if (type === 'requests') {
    metricsStore.requests = [];
  } else if (type === 'alerts') {
    metricsStore.alerts = [];
  } else if (type === 'all') {
    metricsStore.requests = [];
    metricsStore.alerts = [];
  }

  return NextResponse.json({
    success: true,
    data: { cleared: type }
  });
}

async function checkAndCreateAlerts(request: any) {
  // Check for high cost alert
  if (request.cost > 1.0) { // $1+ per request
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'cost' as const,
      severity: 'high' as const,
      message: `High cost request: $${request.cost.toFixed(4)} for ${request.process}`,
      timestamp: new Date(),
      resolved: false
    };
    metricsStore.alerts.push(alert);
  }

  // Check for high latency alert
  if (request.latency > 5000) { // 5+ seconds
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'performance' as const,
      severity: 'medium' as const,
      message: `High latency detected: ${request.latency}ms for ${request.process}`,
      timestamp: new Date(),
      resolved: false
    };
    metricsStore.alerts.push(alert);
  }

  // Check for error alert
  if (!request.success) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'error' as const,
      severity: 'high' as const,
      message: `Request failed: ${request.error || 'Unknown error'} in ${request.process}`,
      timestamp: new Date(),
      resolved: false
    };
    metricsStore.alerts.push(alert);
  }
}

// Export the metrics store for testing purposes
export { metricsStore }; 