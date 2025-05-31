# Keyvex Development Plan of Action

## Current Implementation Status (Updated)

### ✅ Completed Systems

#### 1. Core Infrastructure
- **Next.js 14 Project**: Fully initialized with TypeScript, Tailwind CSS, and App Router
- **Authentication**: Clerk integration with centralized debug system
- **Project Structure**: Complete directory structure established
- **Environment Configuration**: All environment variables defined

#### 2. Centralized AI Model Configuration
- **Model Definitions**: `default-models.json` with OpenAI and Anthropic models
- **Configuration Utilities**: `model-config.ts` with cost calculation and model selection
- **Provider Factory**: `ai-provider-factory.ts` with unified provider interface
- **Automatic Fallback**: Primary/fallback model system with error handling
- **Cost Tracking**: Real-time cost calculation for all AI operations

#### 3. Admin Dashboard & Monitoring
- **Real-time Dashboard**: `/admin` with 4 comprehensive tabs (Cost, Usage, Performance, Alerts)
- **Metrics API**: `/api/admin/metrics` with GET/POST endpoints for tracking
- **Automatic Tracking**: `metrics-tracker.ts` with singleton pattern and batch processing
- **Test Data Generator**: `/admin/test-data` for development and testing
- **Alert System**: Automated alert generation based on thresholds

#### 4. Debug Authentication System
- **Centralized Debug**: `debug.ts` with environment-based debug mode detection
- **Route Protection**: Consistent authentication across all API routes
- **Debug Logging**: Comprehensive logging utilities
- **Environment Control**: Easy toggle between production and debug modes

#### 5. AI Agent Foundation
- **Magic Spark Agent**: Basic implementation with streaming support
- **Provider Integration**: OpenAI and Anthropic providers with mock responses
- **Prompt Management**: Centralized prompt system
- **Session Management**: Basic session state handling

### 🔄 In-Memory Systems (Need AWS Migration)

#### Current Limitations
- **Admin Metrics**: Stored in JavaScript objects, lost on server restart
- **AI Sessions**: No persistent storage for conversation history
- **Tool Configurations**: No database persistence
- **User Preferences**: Only stored in Clerk, no extended user data

#### Data Currently in Memory
```typescript
// Admin Dashboard Metrics
let metricsStore: {
  requests: Array<AIMetricItem>;
  alerts: Array<AlertItem>;
} = { requests: [], alerts: [] };

// AI Sessions (not yet implemented)
// Tool Configurations (not yet implemented)
// Analytics Data (not yet implemented)
```

## AWS Infrastructure Requirements

### 1. DynamoDB Tables

#### Primary Table: `keyvex-main-table`
**Table Configuration:**
- **Partition Key**: `PK` (String)
- **Sort Key**: `SK` (String)
- **Billing Mode**: On-Demand (recommended for development)
- **Point-in-Time Recovery**: Enabled
- **Encryption**: AWS Managed Keys

**Global Secondary Indexes:**

**GSI1:**
- **Partition Key**: `GSI1PK` (String)
- **Sort Key**: `GSI1SK` (String)
- **Projection**: All attributes

**GSI2:**
- **Partition Key**: `GSI2PK` (String)
- **Sort Key**: `GSI2SK` (String)
- **Projection**: All attributes

**TTL Configuration:**
- **TTL Attribute**: `ttl` (Number)
- **Purpose**: Auto-expire temporary data (metrics after 30 days, alerts after 90 days)

#### Entity Types and Access Patterns

**User Entities:**
```typescript
// User Profile
PK: "USER#{clerkId}", SK: "PROFILE"
GSI1PK: "EMAIL#{email}", GSI1SK: "USER"

// User Preferences
PK: "USER#{clerkId}", SK: "PREFERENCES"
```

**Tool Entities:**
```typescript
// Tool Definition
PK: "USER#{clerkId}", SK: "TOOL#{toolId}"
GSI1PK: "TOOL#{toolId}", GSI1SK: "STATUS#{status}"
GSI2PK: "TYPE#{toolType}", GSI2SK: "CREATED#{timestamp}"

// Tool Analytics Summary
PK: "TOOL#{toolId}", SK: "ANALYTICS_SUMMARY"
```

**AI Session Entities:**
```typescript
// Session Metadata
PK: "SESSION#{sessionId}", SK: "METADATA"
GSI1PK: "USER#{clerkId}", GSI1SK: "SESSION#{timestamp}"

// Conversation Messages
PK: "SESSION#{sessionId}", SK: "MESSAGE#{timestamp}#{messageId}"
```

**Lead Entities:**
```typescript
// Lead Data
PK: "TOOL#{toolId}", SK: "LEAD#{leadId}"
GSI1PK: "EMAIL#{email}", GSI1SK: "LEAD#{timestamp}"
```

**Analytics Entities:**
```typescript
// Tool Interactions
PK: "TOOL#{toolId}", SK: "INTERACTION#{timestamp}#{interactionId}"
GSI1PK: "ANALYTICS#{toolId}", GSI1SK: "{interactionType}#{timestamp}"
```

**Metrics Entities:**
```typescript
// AI Request Metrics
PK: "METRIC#{date}", SK: "REQUEST#{timestamp}#{requestId}"
GSI1PK: "PROCESS#{processName}", GSI1SK: "{timestamp}"
GSI2PK: "PROVIDER#{providerName}", GSI2SK: "{timestamp}"
TTL: {timestamp + 30 days}
```

**Alert Entities:**
```typescript
// System Alerts
PK: "ALERT#{alertId}", SK: "ALERT"
GSI1PK: "ALERT_TYPE#{type}", GSI1SK: "{severity}#{timestamp}"
TTL: {timestamp + 90 days}
```

**Configuration Entities:**
```typescript
// Model Configuration Versions
PK: "CONFIG", SK: "MODEL_CONFIG#{version}"
// Active configuration tracking
PK: "CONFIG", SK: "ACTIVE_MODEL_CONFIG"
```

### 2. ElastiCache Redis Cluster

#### Cluster Configuration
- **Node Type**: `cache.t3.micro` (development) / `cache.r6g.large` (production)
- **Engine**: Redis 7.x
- **Cluster Mode**: Enabled for production, Disabled for development
- **Encryption**: In-transit and at-rest
- **Backup**: Daily snapshots with 7-day retention

#### Cache Usage Patterns
```typescript
// Session Caching
"session:{sessionId}" -> SessionData (TTL: 1 hour)

// User Preferences Caching
"user:{userId}:preferences" -> UserPreferences (TTL: 24 hours)

// Model Configuration Caching
"model:config:active" -> ModelConfiguration (TTL: 1 hour)

// Rate Limiting
"rate_limit:{userId}:{endpoint}" -> RequestCount (TTL: 1 minute)

// Tool Configuration Caching
"tool:{toolId}:config" -> ToolConfiguration (TTL: 1 hour)

// Analytics Caching
"analytics:{toolId}:summary" -> AnalyticsSummary (TTL: 15 minutes)
```

### 3. SQS Queues

#### Queue Configuration

**AI Processing Queue:**
- **Name**: `keyvex-ai-processing-queue`
- **Type**: Standard Queue
- **Visibility Timeout**: 300 seconds (5 minutes)
- **Message Retention**: 14 days
- **Dead Letter Queue**: `keyvex-ai-processing-dlq` (max 3 retries)

**Analytics Processing Queue:**
- **Name**: `keyvex-analytics-queue`
- **Type**: Standard Queue
- **Visibility Timeout**: 60 seconds
- **Message Retention**: 7 days
- **Dead Letter Queue**: `keyvex-analytics-dlq` (max 5 retries)

**Email Notification Queue:**
- **Name**: `keyvex-email-queue`
- **Type**: Standard Queue
- **Visibility Timeout**: 30 seconds
- **Message Retention**: 3 days
- **Dead Letter Queue**: `keyvex-email-dlq` (max 3 retries)

#### Message Formats
```typescript
// AI Processing Message
{
  messageType: "AI_PROCESSING",
  sessionId: string,
  userId: string,
  process: "magicSpark" | "logicArchitect" | "contentCrafter" | "styleMaster",
  input: any,
  priority: "high" | "normal" | "low",
  timestamp: number
}

// Analytics Processing Message
{
  messageType: "ANALYTICS_PROCESSING",
  toolId: string,
  interactionType: string,
  data: any,
  timestamp: number
}

// Email Notification Message
{
  messageType: "EMAIL_NOTIFICATION",
  userId: string,
  templateId: string,
  data: any,
  priority: "high" | "normal",
  timestamp: number
}
```

### 4. Lambda Functions

#### AI Processing Lambda
- **Name**: `keyvex-ai-processor`
- **Runtime**: Node.js 18.x
- **Memory**: 1024 MB
- **Timeout**: 15 minutes
- **Environment Variables**: All AI API keys, DynamoDB table names
- **Triggers**: SQS (AI Processing Queue)
- **Permissions**: DynamoDB read/write, SQS receive/delete, Secrets Manager read

#### Analytics Processor Lambda
- **Name**: `keyvex-analytics-processor`
- **Runtime**: Node.js 18.x
- **Memory**: 512 MB
- **Timeout**: 5 minutes
- **Triggers**: SQS (Analytics Queue), DynamoDB Streams
- **Permissions**: DynamoDB read/write, SQS receive/delete

#### WebSocket Handler Lambda
- **Name**: `keyvex-websocket-handler`
- **Runtime**: Node.js 18.x
- **Memory**: 256 MB
- **Timeout**: 30 seconds
- **Triggers**: API Gateway WebSocket
- **Permissions**: DynamoDB read/write, API Gateway management

#### Email Processor Lambda
- **Name**: `keyvex-email-processor`
- **Runtime**: Node.js 18.x
- **Memory**: 256 MB
- **Timeout**: 2 minutes
- **Triggers**: SQS (Email Queue)
- **Permissions**: SES send email, DynamoDB read

### 5. API Gateway

#### WebSocket API
- **Name**: `keyvex-websocket-api`
- **Protocol**: WebSocket
- **Routes**: 
  - `$connect` -> WebSocket Handler Lambda
  - `$disconnect` -> WebSocket Handler Lambda
  - `$default` -> WebSocket Handler Lambda
- **Authorization**: Custom authorizer using Clerk tokens

#### REST API (Optional - for external integrations)
- **Name**: `keyvex-external-api`
- **Protocol**: REST
- **Authentication**: API Key + JWT
- **Rate Limiting**: 1000 requests/hour per API key

### 6. Secrets Manager

#### Required Secrets
```json
{
  "keyvex/ai/openai": {
    "apiKey": "sk-...",
    "organization": "org-..."
  },
  "keyvex/ai/anthropic": {
    "apiKey": "sk-ant-..."
  },
  "keyvex/integrations/unsplash": {
    "accessKey": "...",
    "secretKey": "..."
  },
  "keyvex/email/sendgrid": {
    "apiKey": "SG...",
    "fromEmail": "noreply@keyvex.com"
  },
  "keyvex/database/encryption": {
    "key": "base64-encoded-key"
  }
}
```

### 7. CloudWatch Configuration

#### Log Groups
- `/aws/lambda/keyvex-ai-processor`
- `/aws/lambda/keyvex-analytics-processor`
- `/aws/lambda/keyvex-websocket-handler`
- `/aws/lambda/keyvex-email-processor`
- `/aws/apigateway/keyvex-websocket-api`

#### Metrics and Alarms
```typescript
// Cost Monitoring
"AI/TotalCost" -> Alert if > $100/day
"AI/CostPerRequest" -> Alert if > $1.00

// Performance Monitoring
"AI/AverageLatency" -> Alert if > 5 seconds
"AI/ErrorRate" -> Alert if > 5%

// System Health
"DynamoDB/ThrottledRequests" -> Alert if > 0
"Lambda/Duration" -> Alert if > 80% of timeout
"SQS/ApproximateNumberOfVisibleMessages" -> Alert if > 100
```

#### Dashboards
- **AI Operations Dashboard**: Cost, latency, success rates
- **System Health Dashboard**: Lambda performance, DynamoDB metrics
- **Business Metrics Dashboard**: User activity, tool creation rates

### 8. IAM Roles and Policies

#### Lambda Execution Roles

**AI Processor Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/keyvex-main-table*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:*:*:keyvex-ai-processing-queue"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:keyvex/*"
    }
  ]
}
```

**Analytics Processor Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/keyvex-main-table*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage"
      ],
      "Resource": "arn:aws:sqs:*:*:keyvex-analytics-queue"
    }
  ]
}
```

#### Application Role (for Next.js app)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/keyvex-main-table*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "elasticache:*"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:*:*:keyvex-*"
    }
  ]
}
```

## Environment Variables for AWS Integration

### Required Environment Variables
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# DynamoDB
DYNAMODB_TABLE_NAME=keyvex-main-table
DYNAMODB_ENDPOINT=https://dynamodb.us-east-1.amazonaws.com

# ElastiCache Redis
REDIS_ENDPOINT=keyvex-redis.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=...

# SQS Queues
SQS_AI_PROCESSING_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/.../keyvex-ai-processing-queue
SQS_ANALYTICS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/.../keyvex-analytics-queue
SQS_EMAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/.../keyvex-email-queue

# API Gateway
WEBSOCKET_API_ENDPOINT=wss://....execute-api.us-east-1.amazonaws.com/prod

# Secrets Manager
SECRETS_MANAGER_REGION=us-east-1

# Existing Variables (keep current values)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
UNSPLASH_ACCESS_KEY=...

# Debug Configuration (development only)
DISABLE_AUTH_FOR_DEBUG=true
DEBUG_USER_ID=debug-user-123
ENABLE_METRICS_TRACKING=true
```

## Migration Strategy

### Phase 1: Database Migration (Week 1)
1. **Deploy DynamoDB Table**: Create table with all GSIs and TTL configuration
2. **Update Database Clients**: Replace in-memory storage with DynamoDB operations
3. **Migrate Admin Metrics**: Move metrics tracking to DynamoDB
4. **Test Data Persistence**: Verify all data survives server restarts

### Phase 2: Caching Layer (Week 2)
1. **Deploy ElastiCache**: Set up Redis cluster with proper security
2. **Implement Cache Layer**: Add caching to frequently accessed data
3. **Session Management**: Move session storage to Redis
4. **Performance Testing**: Verify improved response times

### Phase 3: Background Processing (Week 3)
1. **Deploy SQS Queues**: Create all required queues with DLQs
2. **Deploy Lambda Functions**: AI processor, analytics processor, email processor
3. **Queue Integration**: Update API routes to use queues for long-running tasks
4. **WebSocket Support**: Deploy WebSocket API for real-time updates

### Phase 4: Monitoring & Security (Week 4)
1. **CloudWatch Setup**: Deploy all alarms, dashboards, and log groups
2. **Secrets Migration**: Move all sensitive data to Secrets Manager
3. **IAM Hardening**: Implement least-privilege access policies
4. **Security Testing**: Penetration testing and vulnerability assessment

## Current File Structure for AWS Team

### Database Schema Files
- `TECHNICAL_OUTLINE.md` (lines 200-400): Complete DynamoDB schema definitions
- `keyvex_app/src/lib/types/database.ts`: TypeScript interfaces (needs creation)
- `keyvex_app/src/lib/db/dynamodb/`: Database client files (currently TODO comments)

### Configuration Files
- `keyvex_app/src/lib/ai/models/default-models.json`: Model definitions and pricing
- `keyvex_app/src/lib/ai/models/model-config.ts`: Configuration utilities
- `keyvex_app/.env.local`: Environment variables (needs AWS values)

### API Endpoints
- `keyvex_app/src/app/api/admin/metrics/route.ts`: Metrics tracking API
- `keyvex_app/src/app/api/analytics/route.ts`: Analytics API (basic structure)
- `keyvex_app/src/app/api/ai/`: AI processing endpoints

### Monitoring & Admin
- `keyvex_app/src/app/admin/page.tsx`: Admin dashboard UI
- `keyvex_app/src/lib/ai/utils/metrics-tracker.ts`: Automatic metrics tracking
- `ADMIN_DASHBOARD_README.md`: Complete admin system documentation

## Success Criteria for AWS Deployment

### Technical Requirements
- [ ] All data persists across server restarts
- [ ] Admin dashboard shows real data from DynamoDB
- [ ] AI operations complete successfully with queue processing
- [ ] WebSocket connections work for real-time updates
- [ ] All secrets stored securely in Secrets Manager
- [ ] Monitoring and alerting functional

### Performance Requirements
- [ ] API response times < 500ms for cached data
- [ ] AI processing queue latency < 30 seconds
- [ ] Database queries < 100ms for single-item operations
- [ ] Cache hit rate > 80% for frequently accessed data

### Security Requirements
- [ ] All IAM roles follow least-privilege principle
- [ ] No hardcoded secrets in application code
- [ ] All data encrypted in transit and at rest
- [ ] API endpoints properly authenticated and authorized

### Cost Requirements
- [ ] DynamoDB costs < $50/month for development
- [ ] ElastiCache costs < $30/month for development
- [ ] Lambda execution costs < $20/month for development
- [ ] Total AWS costs < $150/month for development environment

This comprehensive plan provides the AWS CDK team with all necessary information to deploy the complete infrastructure while maintaining the existing application functionality. 