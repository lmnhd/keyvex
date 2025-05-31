# TenantArmor Batch Processing Guide

## Overview

The TenantArmor Lambda function now supports **efficient batch processing** for eviction notice analysis, designed specifically for data acquisition phases where hundreds of eviction notices need to be processed simultaneously.

## Key Features

### 🚀 **Performance Optimizations**
- **Template Pre-warming**: Pre-loads commonly used templates to reduce DynamoDB calls
- **Intelligent Caching**: Reuses templates across batch items for same state/reason combinations
- **Parallel Processing**: Processes multiple eviction notices concurrently with configurable limits
- **Memory Efficiency**: Optimized for Lambda memory usage during batch operations

### 📊 **Batch Processing Metrics**
- Processing time tracking
- Cache hit/miss ratios
- Success/failure counts
- Template loading efficiency

### 🛡️ **Error Handling**
- Individual item failures don't stop the entire batch
- Fallback templates when primary templates fail
- Comprehensive error logging and status tracking
- DynamoDB updates for both successful and failed items

## Architecture

### Enhanced PromptManager
```typescript
interface EvictionTemplate {
  state: string;
  reason: string;
  templateType: 'response' | 'meta';
  content: string;
  metadata?: EvictionTemplateMetadata;
}

interface BatchTemplateRequest {
  state: string;
  reason: string;
  templateTypes: ('response' | 'meta')[];
}
```

### Batch Processing Flow
1. **Pre-warm Cache**: Load templates for all states/reasons in the batch
2. **Parallel Processing**: Process eviction notices with concurrency controls
3. **Template Reuse**: Leverage cached templates across similar requests
4. **Result Aggregation**: Collect success/failure results with metrics
5. **DynamoDB Updates**: Update status for all processed items

## Usage Examples

### Single Batch Processing Request

```json
{
  "Records": [
    {
      "body": {
        "batchProcessing": true,
        "batchId": "batch_20241201_001",
        "batchRequests": [
          {
            "analysisId": "analysis_001",
            "extractedText": "Notice to Quit and Pay Rent or Quit...",
            "userSelectedState": "CA",
            "userFormData": {
              "tenantName": "John Doe",
              "landlordName": "ABC Properties"
            },
            "isImageUpload": false,
            "userId": "user_123"
          },
          {
            "analysisId": "analysis_002",
            "extractedText": "3-Day Notice to Pay Rent or Quit...",
            "userSelectedState": "CA",
            "userFormData": {
              "tenantName": "Jane Smith",
              "landlordName": "XYZ Rentals"
            },
            "isImageUpload": true,
            "userId": "user_456"
          }
        ]
      }
    }
  ]
}
```

### Template Pre-warming Configuration

```typescript
// Pre-warm common templates (called automatically during batch processing)
await promptManager.preWarmTemplateCache(
  ['CA', 'NY', 'TX'], // States
  ['non-payment', 'lease-violation', 'no-cause'] // Reasons
);
```

### Batch Metrics Example

```json
{
  "batchMetrics": {
    "totalProcessed": 100,
    "successCount": 95,
    "failureCount": 5,
    "processingTimeMs": 45000,
    "templateCacheHits": 180,
    "templateCacheMisses": 20
  }
}
```

## Implementation Details

### Template Caching Strategy

```typescript
// Template cache key format
const cacheKey = `template:${state}:${reason}:${templateType}`;

// Batch loading with DynamoDB BatchGetItem
const batchResults = await this.batchFetchTemplatesFromDB(dbRequests);
```

### Concurrency Management

```typescript
const concurrencyLimit = 5; // Adjust based on Lambda memory and OpenAI rate limits
const chunks = chunkArray(requests, concurrencyLimit);

for (const chunk of chunks) {
  const chunkPromises = chunk.map(async (request) => {
    // Process individual request
  });
  await Promise.all(chunkPromises);
}
```

### DynamoDB Batch Updates

```typescript
// Successful batch items
const updateParams = {
  TableName: DYNAMODB_TABLE,
  Key: { analysisId: success.analysisId },
  UpdateExpression: "set #status = :status, #analysisResults = :analysisResults, #batchId = :batchId",
  ExpressionAttributeValues: {
    ":status": "ANALYSIS_COMPLETE",
    ":analysisResults": success.results,
    ":batchId": batchId
  }
};
```

## Data Acquisition Scenarios

### Large Dataset Processing
- **Use Case**: Processing 1000+ eviction notices from court records
- **Optimization**: Pre-warm cache with all relevant states
- **Monitoring**: Track template cache efficiency for performance tuning

### Multi-State Analysis
- **Use Case**: Analyzing eviction notices across multiple jurisdictions
- **Benefit**: Template caching prevents redundant DynamoDB calls
- **Scaling**: Configurable concurrency based on OpenAI rate limits

### Historical Data Processing
- **Use Case**: Batch processing historical eviction data for training/research
- **Efficiency**: High cache hit ratios for similar notice types
- **Reliability**: Individual failure handling prevents batch interruption

## Performance Considerations

### Memory Management
- Template cache automatically managed
- Cache clearing utilities for testing: `promptManager.clearTemplateCache()`
- Memory-efficient chunking for large batches

### Rate Limiting
- OpenAI API rate limit management through concurrency controls
- DynamoDB optimization through BatchGetItem operations
- Template reuse minimizes external API calls

### Monitoring
```typescript
// Get cache statistics
const stats = promptManager.getCacheStats();
console.log('Cache efficiency:', {
  promptCacheSize: stats.promptCacheSize,
  templateCacheSize: stats.templateCacheSize,
  preloadedStates: stats.preloadedStates
});
```

## Error Handling

### Individual Item Failures
```typescript
{
  "failed": [
    {
      "analysisId": "analysis_005",
      "error": "Template not found for state: XX"
    }
  ]
}
```

### Fallback Mechanisms
- **Template Fallbacks**: Generic templates when specific ones aren't available
- **Partial Processing**: Continue batch even if some items fail
- **Error Classification**: Detailed error reporting for debugging

### Recovery Strategies
- **Retry Logic**: For transient DynamoDB/OpenAI errors
- **Graceful Degradation**: Fallback to basic templates
- **Status Tracking**: All items get proper status updates

## Best Practices

### 1. Batch Size Optimization
- **Recommended**: 50-100 items per batch for optimal performance
- **Maximum**: 500 items (adjust based on Lambda timeout)
- **Consideration**: Balance between efficiency and error isolation

### 2. State/Reason Distribution
- **Pre-warm Strategy**: Include all states/reasons in the batch
- **Cache Efficiency**: Group similar eviction types together
- **Template Coverage**: Ensure templates exist for all combinations

### 3. Monitoring and Alerting
- **Success Rate**: Monitor batch success rates > 95%
- **Performance**: Track processing time per item
- **Cache Efficiency**: Aim for >80% cache hit rate

### 4. Error Management
- **Graceful Failures**: Individual item failures don't stop batch
- **Error Categorization**: Classify errors for better debugging
- **Recovery Plans**: Implement retry mechanisms for transient errors

## Future Enhancements

### Planned Features
- **Auto-scaling**: Dynamic concurrency based on load
- **Smart Caching**: Machine learning for template pre-loading
- **Performance Analytics**: Advanced metrics and optimization suggestions
- **Template Versioning**: Support for template updates during batch processing

### Integration Opportunities
- **SQS Dead Letter Queues**: For failed batch processing
- **CloudWatch Metrics**: Real-time batch processing monitoring
- **Lambda Layers**: Shared template caching across functions 