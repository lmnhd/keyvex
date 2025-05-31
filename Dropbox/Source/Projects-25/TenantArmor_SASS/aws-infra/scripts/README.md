# 🤖 TenantArmor Dynamic Prompt Management System

## Overview

The Dynamic Prompt Management System allows you to update AI prompts for lease analysis **without redeploying Lambda functions**. This system separates AI behavior (prompts) from application logic (code), enabling rapid iteration and testing of AI responses.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   NPM Scripts   │───▶│ Management Script │───▶│   DynamoDB      │
│                 │    │ manage-prompts.js │    │  AIPrompts      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐             │
│ Lambda Function │───▶│  PromptManager   │◄────────────┘
│   (AI Process)  │    │     Class        │
└─────────────────┘    └──────────────────┘
```

### Components

1. **DynamoDB AIPrompts Table**: Stores prompt content and metadata
2. **PromptManager Class**: Loads prompts dynamically in Lambda
3. **Management Script**: CRUD operations for prompts
4. **NPM Scripts**: Convenient shortcuts for prompt management

## 🚀 Quick Start

### Using NPM Scripts (Recommended)

```bash
# List all prompts
npm run prompts:list

# Initialize default prompts
npm run prompts:init

# Get specific prompt
npm run prompts:get lease-analysis-system active

# Update existing prompt
npm run prompts:update lease-analysis-system active "Your new prompt text"

# Create new prompt
npm run prompts:set lease-analysis-system v2.0 "New version prompt"
```

### Using Direct Commands

```bash
# Alternative to NPM scripts
node scripts/manage-prompts.js list
node scripts/manage-prompts.js get lease-analysis-system active
node scripts/manage-prompts.js update lease-analysis-system active "New prompt"
```

## 📋 Available Commands

### `prompts:list`
Lists all prompts with metadata:
- Prompt type and version
- Active status (✅/❌)
- Creation and update timestamps
- Text preview (first 100 characters)

### `prompts:init`
Creates default prompts for the system:
- `lease-analysis-system` (active): System prompt for AI
- `lease-analysis-user` (active): User prompt template with variables

### `prompts:get <type> <version>`
Retrieves and displays full prompt content:
```bash
npm run prompts:get lease-analysis-system active
npm run prompts:get lease-analysis-user active
```

### `prompts:update <type> <version> "<text>"`
Updates existing prompt content:
```bash
npm run prompts:update lease-analysis-system active "Enhanced prompt with better instructions"
```

### `prompts:set <type> <version> "<text>"`
Creates new prompt or version:
```bash
npm run prompts:set lease-analysis-system v2.0 "Testing new approach"
```

## 🔧 Prompt Types

### Current Prompt Types

| Prompt Type | Purpose | Template Variables |
|-------------|---------|-------------------|
| `lease-analysis-system` | System instructions for AI | None |
| `lease-analysis-user` | User query with document context | `{leaseText}`, `{userSelectedState}` |

### Template Variables

User prompts support dynamic variable substitution:

```
Lease text: {leaseText}
State: {userSelectedState}
```

These are replaced at runtime with actual values:
- `{leaseText}` → Extracted PDF text
- `{userSelectedState}` → User's selected state (CA, NY, TX, etc.)

## 🎯 Workflow Examples

### Scenario 1: Improving Prompt Accuracy

```bash
# 1. Check current prompt
npm run prompts:get lease-analysis-system active

# 2. Update with improvements
npm run prompts:update lease-analysis-system active "You are an expert legal assistant with 20 years of experience in tenant rights law. Focus on identifying clauses that could be problematic for tenants and provide specific actionable advice based on state-specific regulations."

# 3. Verify update
npm run prompts:get lease-analysis-system active

# 4. Test with next lease upload (no redeployment needed!)
```

### Scenario 2: A/B Testing Prompts

```bash
# Create test version
npm run prompts:set lease-analysis-system testing "Alternative prompt approach..."

# Later: Switch to testing version (requires code change to use 'testing' instead of 'active')
# Or: Replace active version after testing
npm run prompts:update lease-analysis-system active "Tested and approved prompt"
```

### Scenario 3: State-Specific Customization

```bash
# Create California-specific prompts
npm run prompts:set lease-analysis-system-ca active "California-specific legal context and tenant protections..."
npm run prompts:set lease-analysis-user-ca active "Analyze this California lease with focus on CA Civil Code sections..."
```

## 📊 Data Structure

### DynamoDB AIPrompts Table Schema

```typescript
interface PromptItem {
  promptType: string;     // Primary key: "lease-analysis-system"
  version: string;        // Sort key: "active", "v1.0", "testing"
  promptText: string;     // The actual prompt content
  isActive: boolean;      // Whether this prompt is active
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
  isLargeFile?: boolean;  // Future: indicates content stored in S3
}
```

### Example Data

```json
{
  "promptType": "lease-analysis-system",
  "version": "active",
  "promptText": "You are a legal expert specializing in residential lease agreements...",
  "isActive": true,
  "createdAt": "2024-12-01T10:00:00.000Z",
  "updatedAt": "2024-12-01T15:30:00.000Z"
}
```

## 🛡️ Error Handling & Resilience

### Fallback Strategy

The system has multiple layers of protection:

1. **Primary**: Load from DynamoDB
2. **Cache**: Use in-memory Lambda cache
3. **Fallback**: Use hardcoded defaults in PromptManager
4. **Logging**: All failures logged to CloudWatch

### Example Fallback Flow

```typescript
try {
  // Try to load from DynamoDB
  promptConfig = await promptManager.getLeaseAnalysisConfig();
} catch (error) {
  // Fallback to hardcoded defaults
  console.warn('Using default prompts due to:', error);
  promptConfig = getDefaultConfig();
}
```

## 🔍 Monitoring & Debugging

### CloudWatch Logs

Look for these log messages in `/aws/lambda/TenantArmorStack-AILeaseProcessing`:

```
✅ "Successfully loaded dynamic prompts from external sources"
⚠️  "Failed to load dynamic prompts, using defaults"
❌ "Prompt metadata not found: lease-analysis-system:active"
```

### Performance Monitoring

- **Cache Hits**: Prompts cached within Lambda execution
- **DynamoDB Reads**: Monitor read capacity usage
- **Fallback Usage**: Track when defaults are used

## 🚀 Deployment Integration

### Full Deployment
```bash
npm run deploy
```
This runs:
1. `lambda:build` - Compiles TypeScript Lambda
2. `build` - Compiles CDK TypeScript
3. `cdk deploy` - Deploys infrastructure

### Hot Swap Deployment (Faster)
```bash
npm run deploy:hotswap
```
Uses CDK hotswap for faster Lambda updates.

### Prompt-Only Updates
```bash
# No deployment needed!
npm run prompts:update lease-analysis-system active "New prompt"
```

## ⚠️ Important Notes

### What Changes Immediately
- ✅ Prompt content updates
- ✅ Next Lambda execution uses new prompts
- ✅ All prompt CRUD operations

### What Requires Code Changes
- ❌ Adding new prompt types
- ❌ Changing template variable names
- ❌ Modifying prompt loading logic

### Best Practices

1. **Test prompts** before making them active
2. **Keep backups** of working prompts
3. **Use descriptive versions** (v1.0, testing, production)
4. **Monitor CloudWatch logs** for prompt loading issues
5. **Verify updates** with `prompts:get` after changes

## 🔄 Version Control Strategy

### Recommended Versioning

```bash
# Development
npm run prompts:set lease-analysis-system dev "Development version"

# Testing
npm run prompts:set lease-analysis-system testing "Ready for testing"

# Production
npm run prompts:update lease-analysis-system active "Tested and approved"

# Backup
npm run prompts:set lease-analysis-system backup-2024-12-01 "Backup before major changes"
```

## 🎯 Benefits

1. **🚀 Instant Updates**: No redeployment needed
2. **🛡️ Safe Testing**: Test without breaking production
3. **📊 Version Control**: Multiple prompt versions
4. **👥 Non-Developer Friendly**: Anyone can update prompts
5. **🔄 Easy Rollback**: Revert to previous versions instantly
6. **⚡ Performance**: Cached prompts for speed
7. **🔧 Flexible**: Support for template variables

## 📞 Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| "Table not found" | Run `npm run deploy` to create infrastructure |
| "Prompt not found" | Run `npm run prompts:init` to create defaults |
| "AWS credentials" | Ensure AWS CLI is configured |
| "Permission denied" | Check IAM permissions for DynamoDB |

### Debug Steps

1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify table exists: `npm run prompts:list`
3. Initialize if needed: `npm run prompts:init`
4. Check CloudWatch logs for Lambda errors

## 📚 Related Files

- **Management Script**: `scripts/manage-prompts.js`
- **PromptManager Class**: `lambda-fns/ai-lease-processing/prompt-manager.ts`
- **Lambda Handler**: `lambda-fns/ai-lease-processing/index.ts`
- **CDK Stack**: `lib/tenant-armor-stack.ts`
- **Package Scripts**: `package.json`

---

**💡 Pro Tip**: Always test prompt changes with a few lease uploads before wide deployment to ensure the AI responses meet your quality standards! 