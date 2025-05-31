# AWS CDK TypeScript Project - TenantArmor Infrastructure

This is a project for TenantArmor backend infrastructure, defined using AWS CDK v2 with TypeScript.

## 🚀 Quick Start

```bash
# Deploy infrastructure
npm run deploy

# Initialize AI prompts
npm run prompts:init

# List all prompts
npm run prompts:list
```

## 📋 Available Commands

### Build & Deploy
* `npm run build` - Compile TypeScript to JavaScript
* `npm run watch` - Watch for changes and compile
* `npm run test` - Perform Jest unit tests
* `npm run lambda:build` - Build Lambda TypeScript functions
* `npm run deploy` - Full deployment (build Lambda + CDK deploy)
* `npm run deploy:hotswap` - Fast deployment using CDK hotswap

### Traditional CDK Commands
* `npx cdk deploy` - Deploy stack to AWS account/region
* `npx cdk diff` - Compare deployed stack with current state
* `npx cdk synth` - Emit synthesized CloudFormation template
* `npx cdk destroy` - Remove the stack

### 🤖 AI Prompt Management
* `npm run prompts:list` - List all AI prompts
* `npm run prompts:init` - Initialize default prompts
* `npm run prompts:get <type> <version>` - Get specific prompt
* `npm run prompts:update <type> <version> "<text>"` - Update prompt
* `npm run prompts:set <type> <version> "<text>"` - Create new prompt

## 🏗️ Infrastructure Components

### Core Resources
- **DynamoDB Tables**: LeaseAnalyses, AIPrompts
- **S3 Buckets**: Lease uploads, AI prompts storage
- **Lambda Functions**: AI lease processing (TypeScript)
- **SQS Queue**: AI processing queue
- **Secrets Manager**: OpenAI API key storage

### Lambda Function
The main AI processing Lambda is written in TypeScript and handles:
- PDF text extraction using PyMuPDF
- Dynamic prompt loading from DynamoDB
- OpenAI API integration for lease analysis
- Results storage in DynamoDB

## 🤖 Dynamic Prompt System

The AI prompt system allows **zero-downtime updates** to AI behavior:

```bash
# Quick Example: Update AI instructions
npm run prompts:update lease-analysis-system active "You are an expert legal assistant specializing in tenant rights..."

# No redeployment needed - changes are live immediately!
```

### Prompt Types
- `lease-analysis-system` - System instructions for AI
- `lease-analysis-user` - User prompt template with variables

### Template Variables
- `{leaseText}` - Extracted PDF content
- `{userSelectedState}` - User's selected state

📚 **Full Documentation**: See [scripts/README.md](scripts/README.md) for comprehensive prompt management guide.

## 🔧 Development Workflow

### 1. Make Code Changes
```bash
# Edit Lambda TypeScript files
code lambda-fns/ai-lease-processing/index.ts
```

### 2. Build & Deploy
```bash
npm run deploy
```

### 3. Update AI Prompts (No Redeployment!)
```bash
npm run prompts:update lease-analysis-system active "Improved prompt..."
```

### 4. Test & Monitor
- Upload test lease files
- Check CloudWatch logs: `/aws/lambda/TenantArmorStack-AILeaseProcessing`

## 🛡️ Security

- **IAM Roles**: Least privilege access for all resources
- **Secrets Manager**: Secure OpenAI API key storage
- **VPC**: Optional VPC configuration for enhanced security
- **Encryption**: At-rest encryption for all data stores

## 📊 Monitoring

- **CloudWatch Logs**: All Lambda execution logs
- **DynamoDB Metrics**: Read/write capacity monitoring
- **S3 Metrics**: Upload patterns and storage usage
- **Lambda Metrics**: Duration, errors, invocation patterns

## 🔍 Troubleshooting

### Common Issues
1. **Build Errors**: Ensure TypeScript compiles - `npm run lambda:build`
2. **Deployment Fails**: Check AWS credentials and permissions
3. **Prompts Not Loading**: Initialize prompts - `npm run prompts:init`
4. **Lambda Timeouts**: Check CloudWatch logs for performance issues

### Debug Steps
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify infrastructure
npm run prompts:list

# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/TenantArmorStack"
```

## 📚 Project Structure

```
aws-infra/
├── lib/
│   └── tenant-armor-stack.ts      # Main CDK stack
├── lambda-fns/
│   └── ai-lease-processing/       # TypeScript Lambda function
│       ├── index.ts               # Main handler
│       ├── prompt-manager.ts      # Dynamic prompt loading
│       └── build/                 # Compiled JavaScript
├── scripts/
│   ├── manage-prompts.js          # Prompt management tool
│   └── README.md                  # Prompt system documentation
└── bin/
    └── tenant-armor-infra.ts      # CDK app entry point
```

---

**💡 Pro Tip**: Use `npm run deploy:hotswap` for faster Lambda updates during development, and `npm run prompts:update` for instant AI behavior changes! 