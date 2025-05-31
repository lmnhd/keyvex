# Data Collection Batch Processing Examples

## Overview
The `processBatchDataCollection()` function provides a generalized, scalable approach for collecting data from various external sources. This system is designed to complement the eviction processing capabilities with robust data acquisition for templates, legal resources, and case data.

## Core Architecture

### Key Components
- **Data Source Handlers**: Specialized processors for HUD, Court Records, State Bar, Legal Aid, and Custom sources
- **Concurrency Control**: Rate-limited processing per source type to respect external APIs
- **AI Enhancement**: Optional OpenAI integration for content analysis and quality scoring
- **Validation Pipeline**: Configurable validation rules for data quality assurance

### Interfaces

```typescript
interface DataCollectionRequest {
  requestId: string;
  dataSource: 'HUD' | 'COURT_RECORDS' | 'STATE_BAR' | 'LEGAL_AID' | 'CUSTOM';
  sourceUrl?: string;
  sourceMetadata?: Record<string, any>;
  collectionType: 'LEGAL_TEMPLATES' | 'CASE_DATA' | 'RESOURCE_DIRECTORY' | 'FORMS' | 'STATUTES';
  targetParameters?: {
    states?: string[];
    categories?: string[];
    dateRange?: { start: string; end: string; };
    searchTerms?: string[];
  };
  processingInstructions?: {
    extractionMode: 'FULL_TEXT' | 'STRUCTURED_DATA' | 'METADATA_ONLY';
    outputFormat: 'JSON' | 'MARKDOWN' | 'RAW_TEXT';
    aiProcessing?: boolean;
    validationRules?: string[];
  };
}
```

## Usage Examples

### Example 1: HUD Fair Housing Templates Collection

```typescript
const hudRequests: DataCollectionRequest[] = [
  {
    requestId: "hud_fair_housing_2024",
    dataSource: "HUD",
    sourceUrl: "https://www.hud.gov/program_offices/fair_housing_equal_opp",
    collectionType: "LEGAL_TEMPLATES",
    targetParameters: {
      states: ["CA", "NY", "TX", "FL"],
      categories: ["fair_housing", "discrimination", "accessibility"],
      searchTerms: ["tenant rights", "housing discrimination", "reasonable accommodation"]
    },
    processingInstructions: {
      extractionMode: "FULL_TEXT",
      outputFormat: "MARKDOWN",
      aiProcessing: true,
      validationRules: ["federal_compliance", "template_completeness"]
    }
  }
];

// Process the batch
const results = await processBatchDataCollection(hudRequests, openaiClient, promptManager);
```

### Example 2: State Bar Legal Forms Scraping

```typescript
const stateBarRequests: DataCollectionRequest[] = [
  {
    requestId: "ca_state_bar_eviction_forms",
    dataSource: "STATE_BAR",
    sourceUrl: "https://www.calbar.ca.gov/Public/Free-Legal-Information",
    collectionType: "FORMS",
    targetParameters: {
      states: ["CA"],
      categories: ["landlord_tenant", "eviction", "unlawful_detainer"]
    },
    processingInstructions: {
      extractionMode: "STRUCTURED_DATA",
      outputFormat: "JSON",
      aiProcessing: true,
      validationRules: ["state_law_compliance", "form_validity"]
    }
  },
  {
    requestId: "ny_state_bar_housing_resources",
    dataSource: "STATE_BAR",
    sourceUrl: "https://www.nysba.org/public-resources/",
    collectionType: "RESOURCE_DIRECTORY",
    targetParameters: {
      states: ["NY"],
      categories: ["tenant_rights", "legal_aid", "housing_court"]
    },
    processingInstructions: {
      extractionMode: "METADATA_ONLY",
      outputFormat: "JSON",
      aiProcessing: false
    }
  }
];
```

### Example 3: Legal Aid Organization Templates

```typescript
const legalAidRequests: DataCollectionRequest[] = [
  {
    requestId: "legal_aid_foundation_la",
    dataSource: "LEGAL_AID",
    sourceUrl: "https://www.lafla.org/self-help/",
    collectionType: "LEGAL_TEMPLATES",
    targetParameters: {
      states: ["CA"],
      categories: ["eviction_response", "tenant_defenses"],
      searchTerms: ["answer to unlawful detainer", "tenant response"]
    },
    processingInstructions: {
      extractionMode: "FULL_TEXT",
      outputFormat: "MARKDOWN",
      aiProcessing: true,
      validationRules: ["template_accuracy", "legal_citation_validity"]
    }
  },
  {
    requestId: "texas_rio_grande_legal_aid",
    dataSource: "LEGAL_AID",
    sourceUrl: "https://www.trla.org/self-help-library",
    collectionType: "LEGAL_TEMPLATES",
    targetParameters: {
      states: ["TX"],
      categories: ["forcible_detainer", "habitability_issues"],
      searchTerms: ["answer to eviction", "warranty of habitability"]
    },
    processingInstructions: {
      extractionMode: "FULL_TEXT",
      outputFormat: "MARKDOWN",
      aiProcessing: true,
      validationRules: ["texas_property_code_compliance"]
    }
  }
];
```

### Example 4: Court Records Case Data

```typescript
const courtRecordRequests: DataCollectionRequest[] = [
  {
    requestId: "la_superior_court_cases",
    dataSource: "COURT_RECORDS",
    sourceUrl: "https://www.lacourt.org/",
    collectionType: "CASE_DATA",
    targetParameters: {
      states: ["CA"],
      categories: ["unlawful_detainer"],
      dateRange: {
        start: "2024-01-01",
        end: "2024-12-31"
      }
    },
    processingInstructions: {
      extractionMode: "STRUCTURED_DATA",
      outputFormat: "JSON",
      aiProcessing: true,
      validationRules: ["case_number_validity", "jurisdiction_accuracy"]
    }
  }
];
```

### Example 5: Custom Data Source Processing

```typescript
const customRequests: DataCollectionRequest[] = [
  {
    requestId: "nolo_legal_encyclopedia",
    dataSource: "CUSTOM",
    sourceUrl: "https://www.nolo.com/legal-encyclopedia/landlord-tenant-law",
    sourceMetadata: {
      siteType: "legal_publisher",
      credibilityScore: 0.95,
      lastVerified: "2024-01-15"
    },
    collectionType: "LEGAL_TEMPLATES",
    targetParameters: {
      states: ["ALL"],
      categories: ["general_tenant_rights", "lease_basics"],
      searchTerms: ["eviction process", "security deposit", "habitability"]
    },
    processingInstructions: {
      extractionMode: "FULL_TEXT",
      outputFormat: "MARKDOWN",
      aiProcessing: true,
      validationRules: ["content_freshness", "legal_accuracy"]
    }
  }
];
```

## Batch Processing Workflow

### 1. SQS Message Format for Data Collection Batch

```json
{
  "dataCollectionBatch": true,
  "batchId": "batch_data_collection_20241215_001",
  "dataCollectionRequests": [
    {
      "requestId": "hud_templates_batch_1",
      "dataSource": "HUD",
      "collectionType": "LEGAL_TEMPLATES",
      "targetParameters": {
        "states": ["CA", "NY", "TX"],
        "categories": ["fair_housing"]
      },
      "processingInstructions": {
        "extractionMode": "FULL_TEXT",
        "outputFormat": "MARKDOWN",
        "aiProcessing": true
      }
    }
  ]
}
```

### 2. Lambda Processing Flow

1. **Detection**: Lambda detects `dataCollectionBatch: true` in SQS message
2. **Routing**: Calls `handleDataCollectionBatch()` function
3. **Processing**: Executes `processBatchDataCollection()` with requests
4. **Storage**: Stores results summary in DynamoDB and detailed data in S3
5. **Metrics**: Logs completion metrics and quality scores

### 3. Results Structure

```typescript
interface DataCollectionResults {
  successful: Array<{
    requestId: string;
    collectedItems: CollectedDataItem[];
    sourceMetrics: {
      totalFound: number;
      extracted: number;
      filtered: number;
      validationPassed: number;
    };
  }>;
  failed: Array<{
    requestId: string;
    error: string;
    sourceUrl?: string;
  }>;
  batchMetrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalItemsCollected: number;
    processingTimeMs: number;
    sourceTypes: Record<string, number>;
    averageQualityScore?: number;
  };
}
```

## Concurrency & Rate Limiting

The system implements source-specific concurrency controls:

- **HUD**: 2 concurrent requests (respectful to government APIs)
- **COURT_RECORDS**: 1 concurrent request (very conservative)
- **STATE_BAR**: 3 concurrent requests (moderate for professional sites)
- **LEGAL_AID**: 3 concurrent requests (moderate for non-profits)
- **CUSTOM**: 2 concurrent requests (conservative default)

## AI Enhancement Features

When `aiProcessing: true` is enabled:

1. **Content Analysis**: Extracts key legal concepts and terminology
2. **Quality Scoring**: Assigns quality scores based on completeness and accuracy
3. **Categorization**: Automatically categorizes content by legal domain
4. **Cross-Reference**: Links related content across different sources
5. **Template Extraction**: Identifies reusable template patterns

## Integration with TenantArmor

The data collection system seamlessly integrates with existing eviction processing:

1. **Template Updates**: Collected templates automatically update the DynamoDB prompt store
2. **Quality Improvement**: AI-enhanced templates replace test/placeholder content
3. **Source Attribution**: All templates include source metadata for legal credibility
4. **Validation Pipeline**: Multi-stage validation ensures legal accuracy

## Production Deployment Considerations

1. **S3 Storage**: Configure dedicated bucket for large data collection results
2. **CloudWatch Monitoring**: Set up metrics for batch processing performance
3. **Error Handling**: Implement retry mechanisms for failed data source requests
4. **Legal Review**: Establish workflow for human review of AI-processed content
5. **Source Authentication**: Add API key management for authenticated data sources

## Example CLI Usage

```bash
# Trigger HUD data collection batch
aws sqs send-message \
  --queue-url "https://sqs.us-west-2.amazonaws.com/123456789/ai-processing-queue" \
  --message-body '{
    "dataCollectionBatch": true,
    "batchId": "hud_templates_2024",
    "dataCollectionRequests": [/* request array */]
  }'
```

This generalized batch processing system provides the foundation for comprehensive legal data acquisition while maintaining the performance and scalability requirements of the TenantArmor platform. 