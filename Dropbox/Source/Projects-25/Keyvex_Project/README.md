# Keyvex AWS Infrastructure

This repository contains the AWS CDK infrastructure code for the Keyvex platform - an AI-powered tool for creating interactive lead magnets.

## Architecture Overview

The Keyvex platform uses a hybrid Vercel + AWS architecture:
- **Frontend & API**: Next.js 14 app deployed on Vercel
- **Backend Infrastructure**: AWS services managed by this CDK project

### AWS Services Used

- **DynamoDB**: Single-table design for all application data
- **ElastiCache Redis**: Application caching and session storage
- **Lambda Functions**: AI processing, analytics, WebSocket handling, email processing
- **API Gateway**: WebSocket API for real-time updates
- **SQS**: Background job queues with dead letter queues
- **S3**: Asset storage with CloudFront distribution
- **Secrets Manager**: Secure configuration management
- **CloudWatch**: Monitoring, logging, and alerting

## Project Structure

```
aws_infra/
├── lib/                          # CDK Stack Definitions
│   ├── security-stack.ts         # IAM roles, policies, Secrets Manager
│   ├── database-stack.ts         # DynamoDB, ElastiCache, SQS
│   ├── compute-stack.ts          # Lambda functions
│   ├── api-stack.ts              # API Gateway, WebSocket API
│   ├── storage-stack.ts          # S3 buckets, CloudFront
│   └── monitoring-stack.ts       # CloudWatch dashboards, alarms
├── lambda/                       # Lambda Function Code
│   ├── ai-processor/             # Long-running AI operations
│   ├── analytics-processor/      # Analytics and metrics processing
│   ├── websocket-handler/        # WebSocket connection management
│   ├── email-processor/          # Email notifications
│   └── shared/                   # Shared utilities and types
├── scripts/                      # Build and deployment scripts
│   └── build-lambdas.js          # Lambda compilation script
└── bin/keyvex-app.ts            # CDK app entry point
```

## Prerequisites

1. **Node.js 18+** and npm
2. **AWS CLI** configured with appropriate credentials
3. **AWS CDK CLI** installed globally:
   ```bash
   npm install -g aws-cdk
   ```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Bootstrap CDK (first time only):**
   ```bash
   cdk bootstrap
   ```

3. **Build Lambda functions:**
   ```bash
   npm run build-lambdas
   ```

## Deployment

### Development Environment

Deploy all stacks to development environment:
```bash
npm run deploy-dev
# Equivalent to: cdk deploy --all --context environment=development
```

### Production Environment

Deploy all stacks to production environment:
```bash
npm run deploy-prod
# Equivalent to: cdk deploy --all --context environment=production
```

### Individual Stack Deployment

Deploy specific stacks:
```bash
# Deploy only database stack
cdk deploy Keyvex-development-Database --context environment=development

# Deploy only compute stack
cdk deploy Keyvex-development-Compute --context environment=development
```

## Environment Configuration

### Development Resources
- Stack Names: `Keyvex-development-*`
- Resource Names: `*-development`
- DynamoDB: On-demand billing
- Lambda: Lower memory allocations

### Production Resources
- Stack Names: `Keyvex-production-*`
- Resource Names: `*-production`
- DynamoDB: Provisioned billing with auto-scaling
- Lambda: Optimized memory allocations

## Secrets Configuration

After deployment, configure secrets in AWS Secrets Manager:

### AI Secrets (`keyvex/ai/{environment}`)
```json
{
  "openai": {
    "apiKey": "sk-...",
    "organization": "org-..."
  },
  "anthropic": {
    "apiKey": "sk-ant-..."
  }
}
```

### Integration Secrets (`keyvex/integrations/{environment}`)
```json
{
  "unsplash": {
    "accessKey": "...",
    "secretKey": "..."
  },
  "sendgrid": {
    "apiKey": "SG...",
    "fromEmail": "noreply@keyvex.com"
  }
}
```

## Environment Variables for Next.js App

After deployment, use these environment variables in your Vercel deployment:

```bash
# AWS Configuration
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=keyvex-main-table-{environment}

# SQS Queue URLs (from CDK outputs)
SQS_AI_PROCESSING_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/.../keyvex-ai-processing-queue-{environment}
SQS_ANALYTICS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/.../keyvex-analytics-queue-{environment}
SQS_EMAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/.../keyvex-email-queue-{environment}

# API Gateway Endpoints (from CDK outputs)
WEBSOCKET_API_ENDPOINT=wss://[api-id].execute-api.us-east-1.amazonaws.com
REST_API_ENDPOINT=https://[api-id].execute-api.us-east-1.amazonaws.com/prod/

# Secrets Manager ARNs (from CDK outputs)
AI_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:...:secret:keyvex/ai/{environment}-...
INTEGRATION_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:...:secret:keyvex/integrations/{environment}-...
```

## Monitoring

### CloudWatch Dashboards
- **AI Operations**: Cost, latency, success rates
- **System Health**: Lambda performance, DynamoDB metrics
- **Business Metrics**: User activity, tool creation rates

### Alerts
- Cost monitoring (>$100/day)
- Performance monitoring (>5 seconds latency)
- Error rate monitoring (>5% error rate)
- System health monitoring

## Development Workflow

1. **Make infrastructure changes** in the CDK stacks
2. **Test locally** with `cdk synth`
3. **Deploy to development** with `npm run deploy-dev`
4. **Test the changes** with the development environment
5. **Deploy to production** with `npm run deploy-prod`

## Useful Commands

```bash
# Synthesize CloudFormation templates
cdk synth

# Compare deployed stack with current state
cdk diff

# View CDK outputs
cdk outputs

# Destroy stacks (be careful!)
cdk destroy --all --context environment=development

# Build Lambda functions
npm run build-lambdas

# Clean Lambda builds
npm run clean-lambdas
```

## Troubleshooting

### Lambda Build Issues
If Lambda functions fail to build:
```bash
npm run clean-lambdas
npm run build-lambdas
```

### CDK Bootstrap Issues
If you encounter bootstrap errors:
```bash
cdk bootstrap --force
```

### Permission Issues
Ensure your AWS credentials have the necessary permissions:
- CloudFormation full access
- IAM role creation
- Service-specific permissions (DynamoDB, Lambda, etc.)

## Cost Optimization

### Development Environment
- Uses on-demand DynamoDB billing
- Smaller Lambda memory allocations
- Shorter log retention periods

### Production Environment
- Provisioned DynamoDB with auto-scaling
- Optimized Lambda configurations
- Longer log retention for compliance

## Security

- All secrets stored in AWS Secrets Manager
- IAM roles follow least-privilege principle
- VPC isolation for sensitive resources
- Encryption at rest and in transit

## Support

For infrastructure issues:
1. Check CloudWatch logs
2. Review CDK deployment outputs
3. Verify AWS service quotas
4. Check IAM permissions

For application integration:
1. Verify environment variables
2. Test AWS SDK connections
3. Check Secrets Manager access
4. Validate queue permissions 