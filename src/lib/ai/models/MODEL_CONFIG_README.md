# Centralized AI Model Configuration System

This document explains the centralized AI model configuration system in Keyvex, which allows you to manage all AI models and their settings from a single location.

## Overview

The centralized model configuration system provides:

- **Single Source of Truth**: All AI model configurations in one JSON file
- **Environment-Specific Overrides**: Different models for development, staging, and production
- **Automatic Fallback**: Seamless fallback to secondary models when primary models fail
- **Cost Tracking**: Built-in cost calculation and monitoring
- **Type Safety**: Full TypeScript support with proper interfaces
- **Easy Switching**: Change models across the entire application by editing one file

## File Structure

```
src/lib/ai/models/
├── default-models.json          # Main configuration file
├── model-config.ts             # TypeScript utilities and functions
└── README.md                   # This documentation
```

## Configuration File (`default-models.json`)

### Structure

The configuration file contains several main sections:

#### 1. Providers
Defines available AI providers and their models:

```json
{
  "providers": {
    "openai": {
      "name": "OpenAI",
      "baseUrl": "https://api.openai.com/v1",
      "models": {
        "gpt-4": {
          "id": "gpt-4",
          "name": "GPT-4",
          "maxTokens": 8192,
          "costPer1kTokens": {
            "input": 0.03,
            "output": 0.06
          },
          "capabilities": ["text", "reasoning", "analysis"],
          "recommended": ["complex-logic", "validation", "review"]
        }
      }
    }
  }
}
```

#### 2. Process Models
Maps each AI process to specific models:

```json
{
  "processModels": {
    "magicSpark": {
      "description": "Initial tool suggestions and idea generation",
      "primary": {
        "provider": "anthropic",
        "model": "claude-3-5-sonnet",
        "reason": "Excellent creativity and reasoning"
      },
      "fallback": {
        "provider": "openai",
        "model": "gpt-4-turbo",
        "reason": "Strong alternative for creative suggestions"
      },
      "streaming": true,
      "temperature": 0.8,
      "maxTokens": 4000
    }
  }
}
```

#### 3. Environment Overrides
Different configurations for different environments:

```json
{
  "environments": {
    "development": {
      "costOptimized": true,
      "modelOverrides": {
        "magicSpark": {
          "provider": "anthropic",
          "model": "claude-3-haiku",
          "reason": "Cost optimization for development"
        }
      }
    }
  }
}
```

## Usage

### Basic Usage

```typescript
import modelConfig from '@/lib/ai/models/model-config';

// Get primary model for a process
const primaryModel = modelConfig.getPrimaryModel('magicSpark');
console.log(primaryModel.provider); // "anthropic"
console.log(primaryModel.model); // "claude-3-5-sonnet"

// Get fallback model
const fallbackModel = modelConfig.getFallbackModel('magicSpark');

// Calculate costs
const cost = modelConfig.calculateCost('anthropic', 'claude-3-5-sonnet', 1000, 500);
console.log(`Estimated cost: $${cost.toFixed(4)}`);
```

### Using with AI Agents

```typescript
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';

export class MagicSparkAgent {
  private model: any;
  private fallbackModel: any;
  
  constructor() {
    const primaryModel = getPrimaryModel('magicSpark');
    const fallbackModel = getFallbackModel('magicSpark');
    
    this.model = this.createModelInstance(primaryModel.provider, primaryModel.modelInfo.id);
    this.fallbackModel = fallbackModel ? 
      this.createModelInstance(fallbackModel.provider, fallbackModel.modelInfo.id) : null;
  }
}
```

### Using the Provider Factory

```typescript
import { aiProviderFactory } from '@/lib/ai/providers/ai-provider-factory';

// Generate text with automatic fallback
const response = await aiProviderFactory.generateText(
  'magicSpark',
  'Generate tool suggestions for a marketing consultant',
  { temperature: 0.8 }
);

// Generate streaming response
for await (const chunk of aiProviderFactory.generateStream('contentCrafter', prompt)) {
  console.log(chunk);
}
```

## Available Processes

The system currently supports these AI processes:

| Process | Description | Primary Model | Use Case |
|---------|-------------|---------------|----------|
| `magicSpark` | Initial tool suggestions | Claude 3.5 Sonnet | Creative ideation |
| `logicArchitect` | Framework building | GPT-4 | Logical structure |
| `contentCrafter` | Content generation | Claude 3.5 Sonnet | Writing & copy |
| `styleMaster` | Visual design | Claude 3.5 Sonnet | Design decisions |
| `validation` | Quality validation | GPT-4 | Analysis & review |
| `optimization` | Performance optimization | GPT-4 Turbo | System optimization |
| `quickTasks` | Fast operations | Claude 3 Haiku | Simple tasks |

## Environment Configuration

### Development Environment

In development, the system automatically uses cost-optimized models:

- Magic Spark: Claude 3 Haiku (instead of Claude 3.5 Sonnet)
- Content Crafter: Claude 3 Haiku (instead of Claude 3.5 Sonnet)

### Production Environment

Production uses the full-power models as defined in the primary configuration.

## Features

### Auto Fallback

When enabled, the system automatically falls back to secondary models if the primary model fails:

```typescript
// This is handled automatically
const response = await aiProviderFactory.generateText('magicSpark', prompt);
// If Claude 3.5 Sonnet fails, automatically tries GPT-4 Turbo
```

### Cost Tracking

Calculate estimated costs before making API calls:

```typescript
const cost = modelConfig.calculateCost('openai', 'gpt-4', 1500, 800);
console.log(`This request will cost approximately $${cost.toFixed(4)}`);
```

### Capability Checking

Verify if a model supports specific capabilities:

```typescript
const supportsStreaming = modelConfig.supportsCapability('anthropic', 'claude-3-5-sonnet', 'text');
const supportsReasoning = modelConfig.supportsCapability('openai', 'gpt-4', 'reasoning');
```

## Configuration Management

### Changing Models

To change the model for a specific process:

1. Edit `default-models.json`
2. Update the `processModels` section
3. Change the `primary` or `fallback` model configuration
4. Restart the application

Example - Switch Magic Spark to use GPT-4:

```json
{
  "processModels": {
    "magicSpark": {
      "primary": {
        "provider": "openai",
        "model": "gpt-4",
        "reason": "Testing GPT-4 for creative suggestions"
      }
    }
  }
}
```

### Adding New Models

1. Add the model to the appropriate provider in the `providers` section
2. Include cost information, capabilities, and recommendations
3. Update any processes that should use the new model

### Environment-Specific Overrides

To use different models in different environments:

```json
{
  "environments": {
    "development": {
      "modelOverrides": {
        "processName": {
          "provider": "anthropic",
          "model": "claude-3-haiku",
          "reason": "Faster and cheaper for development"
        }
      }
    }
  }
}
```

## Testing

Visit `/model-config-test` to test the configuration system:

- View all configured processes
- Test model configurations
- Calculate costs
- Verify capabilities
- See environment-specific overrides

## Best Practices

1. **Always Test**: Use the test page to verify configurations before deploying
2. **Monitor Costs**: Regularly check cost calculations, especially for high-volume processes
3. **Use Fallbacks**: Always configure fallback models for critical processes
4. **Environment Optimization**: Use cheaper models in development, full models in production
5. **Document Changes**: Update the `reason` field when changing model configurations
6. **Version Control**: Track changes to the configuration file in git

## Troubleshooting

### Common Issues

1. **Model Not Found**: Check that the model exists in the provider configuration
2. **API Key Missing**: Ensure environment variables are set for the providers you're using
3. **Cost Calculation Errors**: Verify the cost information in the model configuration
4. **Fallback Not Working**: Check that `autoFallback` is enabled in features

### Debug Information

Use the configuration summary to debug issues:

```typescript
const summary = modelConfig.getConfigSummary();
console.log('Configuration Summary:', summary);
```

### Environment Variables Required

```bash
# For OpenAI models
OPENAI_API_KEY=your_openai_key

# For Anthropic models  
ANTHROPIC_API_KEY=your_anthropic_key

# For debug mode (optional)
DISABLE_AUTH_FOR_DEBUG=true
DEBUG_USER_ID=test-user-123
```

## Future Enhancements

- **Load Balancing**: Distribute requests across multiple models
- **Performance Monitoring**: Track response times and quality metrics
- **Dynamic Model Selection**: Choose models based on request complexity
- **Cost Budgets**: Set spending limits per process
- **A/B Testing**: Compare different models for the same process 