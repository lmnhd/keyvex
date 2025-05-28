# Admin Dashboard System

The Admin Dashboard provides comprehensive monitoring and analytics for AI model usage, costs, and performance metrics during development and production.

## Overview

The admin dashboard system consists of several components that work together to provide real-time insights into your AI model usage:

- **Cost Tracking**: Monitor spending across models, processes, and providers
- **Usage Analytics**: Track request volumes, success rates, and patterns
- **Performance Monitoring**: Analyze response times, error rates, and throughput
- **Alert System**: Get notified about cost overruns, performance issues, and errors
- **Real-time Updates**: Auto-refreshing dashboard with live metrics

## Features

### 📊 Cost Analysis
- **Total Cost Tracking**: 7-day rolling cost summary
- **Cost by Process**: See which AI processes are most expensive
- **Cost by Provider**: Compare spending across OpenAI, Anthropic, etc.
- **Cost by Model**: Identify the most expensive models
- **Top Expensive Requests**: Find individual high-cost API calls
- **Daily Cost Trends**: Track spending patterns over time

### 📈 Usage Metrics
- **Request Volume**: Total requests across all processes
- **Success Rate**: Overall API success percentage
- **Requests by Process**: Usage distribution across AI processes
- **Requests by Provider**: Provider usage patterns
- **Hourly Usage**: 24-hour request volume trends
- **Fallback Usage**: How often fallback models are used

### ⚡ Performance Monitoring
- **Average Latency**: Overall response time metrics
- **Latency by Process**: Performance breakdown by AI process
- **Error Rate**: Percentage of failed requests
- **Error Analysis**: Categorized error types and counts
- **Throughput**: Requests per minute
- **Cache Hit Rate**: Efficiency of caching systems

### 🚨 Alert System
- **Cost Alerts**: Budget overruns and unusual spending
- **Performance Alerts**: Latency spikes and degradation
- **Error Alerts**: API failures and rate limiting
- **Severity Levels**: Low, medium, and high priority alerts
- **Real-time Notifications**: Immediate alert generation

## File Structure

```
src/
├── app/
│   ├── admin/                          # Admin dashboard page
│   │   ├── page.tsx                    # Main dashboard UI
│   │   └── test-data/
│   │       └── page.tsx                # Test data generator
│   └── api/
│       └── admin/
│           └── metrics/
│               └── route.ts            # Metrics API endpoint
└── lib/
    └── ai/
        └── utils/
            └── metrics-tracker.ts      # Automatic metrics tracking
```

## Usage

### Accessing the Dashboard

Visit `/admin` to access the main admin dashboard:

```
http://localhost:3000/admin
```

### Generating Test Data

For development and testing, visit `/admin/test-data` to generate sample metrics:

```
http://localhost:3000/admin/test-data
```

This will create:
- 50 sample AI requests with realistic data
- 3 sample alerts (cost, performance, error)
- Data distributed across all configured AI processes

### API Endpoints

#### GET `/api/admin/metrics`

Fetch metrics data with optional filtering:

```typescript
// Get all metrics for the last 24 hours
const response = await fetch('/api/admin/metrics?timeRange=24h');

// Get only cost and usage metrics
const response = await fetch('/api/admin/metrics?metrics=costs,usage');

// Filter by specific processes
const response = await fetch('/api/admin/metrics?processes=magicSpark,contentCrafter');
```

**Query Parameters:**
- `timeRange`: `1h`, `24h`, `7d`, `30d` (default: `24h`)
- `metrics`: Comma-separated list of `costs`, `usage`, `performance`, `alerts`
- `processes`: Comma-separated list of process names
- `providers`: Comma-separated list of provider names

#### POST `/api/admin/metrics`

Track requests and manage alerts:

```typescript
// Track a completed AI request
await fetch('/api/admin/metrics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'track_request',
    process: 'magicSpark',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    inputTokens: 1500,
    outputTokens: 800,
    latency: 1200,
    success: true
  })
});

// Create a custom alert
await fetch('/api/admin/metrics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'create_alert',
    type: 'cost',
    severity: 'high',
    message: 'Daily budget exceeded'
  })
});

// Clear all metrics data
await fetch('/api/admin/metrics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'clear_metrics',
    type: 'all'
  })
});
```

### Automatic Metrics Tracking

The system includes automatic tracking for AI requests:

```typescript
import { trackAIRequest } from '@/lib/ai/utils/metrics-tracker';

// Start tracking a request
const tracker = trackAIRequest('magicSpark', 'anthropic', 'claude-3-5-sonnet');

try {
  // Make your AI API call
  const result = await makeAICall();
  
  // Mark as successful
  tracker.success(inputTokens, outputTokens);
} catch (error) {
  // Mark as failed
  tracker.error(error.message, inputTokens, 0);
}
```

## Configuration

### Environment Variables

```bash
# Enable metrics tracking (optional, defaults to true in development)
ENABLE_METRICS_TRACKING=true

# Metrics batch size (optional, defaults to 10)
METRICS_BATCH_SIZE=10

# Metrics flush interval in milliseconds (optional, defaults to 30000)
METRICS_FLUSH_INTERVAL=30000
```

### Alert Thresholds

The system automatically creates alerts based on these thresholds:

- **High Cost Alert**: Requests costing more than $1.00
- **High Latency Alert**: Requests taking more than 5 seconds
- **Error Alert**: Any failed request

You can customize these thresholds in `src/app/api/admin/metrics/route.ts`.

## Dashboard Tabs

### 1. Cost Analysis
- **Cost by Process**: Pie chart showing spending distribution
- **Cost by Provider**: Bar chart comparing provider costs
- **Most Expensive Requests**: List of highest-cost individual requests
- **Daily Cost Trends**: Line chart showing 7-day cost history

### 2. Usage Metrics
- **Requests by Process**: Volume distribution across AI processes
- **Usage Statistics**: Fallback usage, cache hit rate, throughput
- **Hourly Usage**: 24-hour request volume chart
- **Provider Distribution**: Request counts by provider

### 3. Performance
- **Latency by Process**: Average response times per process
- **Error Analysis**: Overall error rate and error type breakdown
- **Throughput Metrics**: Requests per minute and performance trends
- **Cache Performance**: Hit rates and efficiency metrics

### 4. Alerts
- **Cost Alerts**: Budget overruns and spending anomalies
- **Performance Alerts**: Latency spikes and degradation
- **Error Alerts**: API failures and rate limiting
- **Alert Management**: Resolve and dismiss alerts

## Data Storage

### Development
In development, metrics are stored in memory for simplicity. Data is lost when the server restarts.

### Production
For production deployment, you should:

1. **Replace In-Memory Storage**: Update the metrics API to use DynamoDB or another persistent store
2. **Add Authentication**: Restrict admin dashboard access to authorized users
3. **Implement Data Retention**: Set up automatic cleanup of old metrics data
4. **Add Backup**: Ensure metrics data is backed up regularly

### Sample DynamoDB Schema

```typescript
// Metrics table
{
  PK: 'METRIC#${requestId}',
  SK: 'REQUEST',
  userId: string,
  process: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  latency: number,
  success: boolean,
  error?: string,
  timestamp: string,
  TTL: number // Auto-expire after 30 days
}

// Alerts table
{
  PK: 'ALERT#${alertId}',
  SK: 'ALERT',
  type: 'cost' | 'performance' | 'error',
  severity: 'low' | 'medium' | 'high',
  message: string,
  timestamp: string,
  resolved: boolean,
  TTL: number // Auto-expire after 90 days
}
```

## Integration with Model Configuration

The admin dashboard automatically integrates with your centralized model configuration:

- **Cost Calculations**: Uses actual model pricing from `default-models.json`
- **Process Mapping**: Displays metrics for all configured AI processes
- **Provider Tracking**: Monitors usage across all configured providers
- **Model Analysis**: Breaks down costs and usage by specific models

## Best Practices

### 1. Regular Monitoring
- Check the dashboard daily during development
- Set up alerts for cost thresholds
- Monitor performance trends weekly

### 2. Cost Optimization
- Use the cost analysis to identify expensive processes
- Consider switching to cheaper models for development
- Monitor fallback usage to optimize primary model selection

### 3. Performance Tuning
- Track latency trends to identify performance issues
- Use error analysis to improve reliability
- Monitor cache hit rates to optimize caching strategies

### 4. Alert Management
- Resolve alerts promptly to maintain dashboard clarity
- Adjust alert thresholds based on your usage patterns
- Use alerts to proactively address issues

## Troubleshooting

### Dashboard Shows No Data
1. Check if metrics tracking is enabled
2. Generate test data using `/admin/test-data`
3. Verify API endpoints are working
4. Check browser console for errors

### High Memory Usage
1. Clear old metrics data regularly
2. Reduce batch size for metrics tracking
3. Implement data retention policies
4. Consider moving to persistent storage

### Inaccurate Cost Calculations
1. Verify model pricing in `default-models.json`
2. Check token counting accuracy
3. Ensure all requests are being tracked
4. Validate cost calculation logic

### Missing Alerts
1. Check alert threshold configuration
2. Verify alert creation logic
3. Ensure alerts aren't being auto-resolved
4. Check alert filtering in the UI

## Future Enhancements

- **Real-time Charts**: Live updating charts with WebSocket connections
- **Export Functionality**: CSV/PDF export of metrics data
- **Custom Dashboards**: User-configurable dashboard layouts
- **Predictive Analytics**: Cost and usage forecasting
- **Integration APIs**: Webhook notifications for alerts
- **Multi-tenant Support**: Separate metrics by user/organization
- **Advanced Filtering**: Complex query capabilities
- **Performance Benchmarking**: Compare against historical baselines 