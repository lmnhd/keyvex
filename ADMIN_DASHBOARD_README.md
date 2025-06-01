# Admin Dashboard System

The Admin Dashboard provides comprehensive monitoring and analytics for AI model usage, costs, and performance metrics during development and production, along with advanced tool data integration capabilities.

## Overview

The admin dashboard system consists of several components that work together to provide real-time insights into your AI model usage and comprehensive data management:

- **Cost Tracking**: Monitor spending across models, processes, and providers
- **Usage Analytics**: Track request volumes, success rates, and patterns
- **Performance Monitoring**: Analyze response times, error rates, and throughput
- **Tool Data Integration**: Connect tools to real data sources for dynamic experiences
- **Smart Data Management**: AI-powered data source detection and integration
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

### 🗄️ Tool Data Integration
- **Data Source Management**: Connect and monitor multiple data sources
- **Smart Data Detection**: AI-powered analysis of uploaded files and data structures
- **Multi-Format Support**: CSV, Excel, Access, SQL databases, cloud services, APIs
- **Real-time Sync Monitoring**: Track connection health and sync status
- **Mock-to-Real Migration**: Seamless transition from demo to production data
- **Data Templates**: Pre-built templates for common business use cases
- **Integration Wizard**: User-friendly setup for database connections and file uploads

#### Data Source Types
- **File Uploads**: Drag-and-drop CSV, Excel, and Access files
- **SQL Databases**: MySQL, PostgreSQL, SQL Server with WiFi-like connection wizard
- **Cloud Services**: Google Sheets, Salesforce, Airtable, and other popular platforms
- **API Endpoints**: REST APIs, GraphQL, and webhook integrations
- **Real-time Sources**: Live database connections with automatic sync

#### Smart Integration Features
- **Automatic Field Detection**: AI analyzes data structure and suggests optimal tool configurations
- **Data Health Monitoring**: Track connection status, sync times, and data quality
- **Progressive Enhancement**: Start with mock data, upgrade to real sources without rebuilding tools
- **Template Library**: Industry-specific data templates (Real Estate, CRM, Product Catalogs)
- **Connection Templates**: Pre-configured setups for popular data sources

### 🚨 Alert System
- **Cost Alerts**: Budget overruns and unusual spending
- **Performance Alerts**: Latency spikes and degradation
- **Error Alerts**: API failures and rate limiting
- **Data Source Alerts**: Connection failures, sync issues, and data quality problems
- **Severity Levels**: Low, medium, and high priority alerts
- **Real-time Notifications**: Immediate alert generation

## Dashboard Tabs

### 1. Overview
- **Quick Stats**: User engagement, tool creation, and system health
- **Recent Activity**: Latest tool interactions and system events
- **Quick Actions**: Fast access to create tools, manage data, and view analytics

### 2. My Tools
- **Tool Management**: View, edit, and organize your created tools
- **Performance Metrics**: Individual tool analytics and engagement data
- **Publishing Controls**: Manage tool visibility and sharing settings

### 3. Tool Data ✨ NEW
- **Data Source Overview**: Connected sources, tools using data, and health status
- **Quick Connect**: One-click setup for files, databases, cloud services, and APIs
- **Source Management**: Monitor active connections, sync status, and resolve issues
- **Smart Integration**: AI-powered data detection and mapping recommendations
- **Templates & Examples**: Download sample data formats and pre-configured datasets

#### Tool Data Features
- **Connection Status Monitoring**: Real-time health checks for all data sources
- **Integration Health Dashboard**: Visual indicators for Active, Live, and Error states
- **Popular Integrations**: Quick access to Google Sheets, MySQL, Salesforce, PostgreSQL
- **Data Templates**: Ready-to-use templates for Real Estate, Customer CRM, Product Catalogs
- **Smart Upload Wizard**: AI analyzes files and recommends optimal tool configurations

### 4. Analytics
- **Detailed Metrics**: Comprehensive performance and usage analytics
- **Cost Analysis**: Spending breakdown and optimization recommendations
- **Performance Trends**: Historical data and pattern analysis

### 5. Admin (Development) 
- **System Monitoring**: AI model usage, costs, and performance metrics
- **Alert Management**: Configure thresholds and resolve system alerts
- **Debug Tools**: Development utilities and system diagnostics

## File Structure

```
src/
├── app/
│   ├── admin/                          # Admin dashboard page
│   │   ├── page.tsx                    # Main dashboard UI
│   │   └── test-data/
│   │       └── page.tsx                # Test data generator
│   ├── dashboard/                      # User dashboard with Tool Data
│   │   └── page.tsx                    # Main dashboard with Tool Data tab
│   └── api/
│       ├── admin/
│       │   └── metrics/
│       │       └── route.ts            # Metrics API endpoint
│       └── data-sources/               # Data integration APIs
│           ├── upload/
│           │   └── route.ts            # File upload handling
│           ├── database/
│           │   └── route.ts            # Database connection management
│           └── cloud/
│               └── route.ts            # Cloud service integrations
└── lib/
    ├── ai/
    │   └── utils/
    │       └── metrics-tracker.ts      # Automatic metrics tracking
    └── data/
        ├── connectors/                 # Data source connectors
        │   ├── sql.ts                  # SQL database connector
        │   ├── files.ts                # File processing utilities
        │   └── cloud.ts                # Cloud service integrations
        └── templates/                  # Data templates and schemas
            ├── real-estate.ts
            ├── crm.ts
            └── products.ts
```

## Tool Data Integration Usage

### Connecting Data Sources

#### File Upload
```typescript
// Upload CSV, Excel, or Access files
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'csv');

const response = await fetch('/api/data-sources/upload', {
  method: 'POST',
  body: formData
});
```

#### Database Connection
```typescript
// Connect to SQL database
const connection = await fetch('/api/data-sources/database', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'mysql',
    host: 'localhost',
    database: 'myapp',
    username: 'user',
    password: 'password'
  })
});
```

#### Cloud Service Integration
```typescript
// Connect to Google Sheets
const integration = await fetch('/api/data-sources/cloud', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'googlesheets',
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    range: 'Sheet1!A1:Z1000'
  })
});
```

### Smart Data Detection

The AI-powered data detection system automatically:
- Analyzes uploaded files and data structures
- Suggests appropriate tool types (calculators, quizzes, assessments)
- Recommends field mappings and data transformations
- Provides optimization suggestions for better performance

### Mock-to-Real Migration

Tools can seamlessly transition from demo data to real sources:

```typescript
// Start with mock data
const tool = createTool({
  type: 'neighborhood-quiz',
  data: mockNeighborhoodData
});

// Later, connect real data source
await tool.connectDataSource({
  type: 'csv',
  sourceId: 'neighborhood-data-csv',
  mapping: {
    'neighborhood_name': 'name',
    'school_rating': 'schools',
    'median_price': 'price'
  }
});
```

## Usage

### Accessing the Dashboard

Visit `/dashboard` to access the main user dashboard with Tool Data integration:

```
http://localhost:3000/dashboard
```

### Accessing Admin Dashboard

Visit `/admin` to access the system admin dashboard:

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
- Sample data source connections
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

#### Data Source Management APIs

```typescript
// Get all connected data sources
const sources = await fetch('/api/data-sources');

// Test data source connection
const test = await fetch('/api/data-sources/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sourceId: 'csv-neighborhoods' })
});

// Update data source configuration
await fetch('/api/data-sources/update', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sourceId: 'mysql-crm',
    config: { refreshInterval: 3600 }
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

# Data source connection limits
MAX_FILE_SIZE=50MB
MAX_CONCURRENT_CONNECTIONS=10
DATA_RETENTION_DAYS=90
```

### Alert Thresholds

The system automatically creates alerts based on these thresholds:

- **High Cost Alert**: Requests costing more than $1.00
- **High Latency Alert**: Requests taking more than 5 seconds
- **Error Alert**: Any failed request
- **Data Source Alert**: Connection failures or sync issues

You can customize these thresholds in `src/app/api/admin/metrics/route.ts`.

## Best Practices

### 1. Regular Monitoring
- Check the dashboard daily during development
- Set up alerts for cost thresholds
- Monitor performance trends weekly
- Review data source health regularly

### 2. Cost Optimization
- Use the cost analysis to identify expensive processes
- Consider switching to cheaper models for development
- Monitor fallback usage to optimize primary model selection
- Optimize data source connections to reduce API calls

### 3. Performance Tuning
- Track latency trends to identify performance issues
- Use error analysis to improve reliability
- Monitor cache hit rates to optimize caching strategies
- Balance data freshness with performance

### 4. Data Management
- Regularly validate data source connections
- Monitor data quality and sync frequency
- Use templates for consistent data structure
- Plan for data source failover scenarios

### 5. Alert Management
- Resolve alerts promptly to maintain dashboard clarity
- Adjust alert thresholds based on your usage patterns
- Use alerts to proactively address issues
- Set up notification channels for critical alerts

## Troubleshooting

### Dashboard Shows No Data
1. Check if metrics tracking is enabled
2. Generate test data using `/admin/test-data`
3. Verify API endpoints are working
4. Check browser console for errors

### Data Source Connection Issues
1. Verify connection credentials and permissions
2. Check network connectivity and firewall settings
3. Validate data source format and structure
4. Review connection logs and error messages

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
- **Advanced Data Connectors**: Additional cloud services and databases
- **AI-Powered Data Insights**: Intelligent recommendations for data optimization
- **Automated Data Migration**: Smart tools for upgrading from mock to real data
- **Data Quality Monitoring**: Automated validation and quality scoring
- **Cross-Tool Data Sharing**: Unified data sources across multiple tools 