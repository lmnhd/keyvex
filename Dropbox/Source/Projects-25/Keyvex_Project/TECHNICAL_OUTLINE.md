# Keyvex Technical Outline & Implementation Strategy

## Executive Summary

Keyvex is an AI-powered platform that enables independent consultants, coaches, and B2B service providers to create interactive lead magnets (calculators, quizzes, assessments) through AI co-creation. The platform emphasizes real-time streaming AI interactions while managing Vercel timeout constraints through a hybrid architecture approach, enhanced with comprehensive user behavior learning for personalized AI experiences and advanced tool data integration capabilities.

## Project Structure

```
KEYVEX_PROJECT/
├── aws_infra/                          # AWS CDK Infrastructure
│   ├── lib/
│   │   ├── database-stack.ts          # DynamoDB + ElastiCache + SQS
│   │   ├── user-behavior-dynamodb-stack.ts  # DynamoDB for behavior tracking
│   │   ├── compute-stack.ts           # Lambda functions for AI processing
│   │   ├── api-stack.ts               # API Gateway + WebSocket
│   │   ├── security-stack.ts          # IAM roles + Secrets Manager
│   │   ├── monitoring-stack.ts        # CloudWatch + Alarms + X-Ray
│   │   └── networking-stack.ts        # VPC + Security Groups (if needed)
│   ├── lambda/
│   │   ├── ai-processor/              # Long-running AI chains
│   │   ├── behavior-processor/        # User behavior analysis
│   │   ├── data-processor/            # Data source integration and processing
│   │   ├── image-generator/           # AI image generation
│   │   ├── websocket-handler/         # WebSocket connection management
│   │   ├── queue-processor/           # SQS message processing
│   │   └── shared/                    # Shared utilities and layers
│   └── cdk.json
│
├── keyvex_app/                         # Next.js Application
│   ├── src/
│   │   ├── app/                       # App Router
│   │   │   ├── (auth)/               # Authentication routes
│   │   │   ├── dashboard/            # User dashboard with Tool Data integration
│   │   │   ├── create/               # Tool creation flow
│   │   │   ├── product-tools/        # Product tool public pages
│   │   │   │   └── [slug]/           # Individual tool pages
│   │   │   ├── tests/                # Testing Suite (Centralized)
│   │   │   │   ├── page.tsx          # Main test navigation dashboard
│   │   │   │   ├── api/              # API routes testing
│   │   │   │   ├── api-legacy/       # Legacy API testing (backup)
│   │   │   │   ├── ui/               # UI components & workflow testing
│   │   │   │   ├── brand-intelligence/ # Brand analysis testing
│   │   │   │   ├── model-config/     # AI model configuration testing
│   │   │   │   ├── multi-iterator/   # Multi-question iterator testing
│   │   │   │   ├── dynamic-tools/    # Dynamic tool generation testing
│   │   │   │   ├── product-tools/    # Product tools infrastructure testing
│   │   │   │   └── admin/            # Admin testing utilities
│   │   │   │       └── test-data/    # Test data generation
│   │   │   ├── admin/                # Admin dashboard & monitoring
│   │   │   │   └── page.tsx          # Main admin dashboard
│   │   │   ├── api/                  # API routes
│   │   │   │   ├── ai/              # AI orchestration endpoints
│   │   │   │   │   ├── test-ui/     # Conversation Agent (UI/UX flow)
│   │   │   │   │   ├── create-tool/ # Tool Creation Agent (ProductToolDefinition generation)
│   │   │   │   │   ├── brand-analyzer/   # Legacy brand analysis
│   │   │   │   │   ├── content-crafter/  # Future Content Generation Agent
│   │   │   │   │   ├── logic-architect/  # Legacy logic processing
│   │   │   │   │   ├── magic-spark/      # Legacy initial spark generation
│   │   │   │   │   ├── style-master/     # Future Style Customization Agent
│   │   │   │   │   └── test-model/       # Model testing utilities
│   │   │   │   ├── admin/           # Admin metrics & monitoring
│   │   │   │   │   └── metrics/     # Metrics tracking API
│   │   │   │   ├── analytics/       # Tool analytics API
│   │   │   │   ├── data-sources/    # Data source integration APIs
│   │   │   │   │   ├── upload/      # File upload handling
│   │   │   │   │   ├── database/    # Database connection management
│   │   │   │   │   ├── cloud/       # Cloud service integrations
│   │   │   │   │   ├── test/        # Connection testing
│   │   │   │   │   └── templates/   # Data template management
│   │   │   │   ├── product-tools/   # Product tools CRUD API
│   │   │   │   │   ├── [toolId]/    # Individual tool operations
│   │   │   │   │   └── search/      # Search functionality
│   │   │   │   ├── auth/            # Clerk webhooks
│   │   │   │   ├── stripe/          # Payment webhooks
│   │   │   │   └── integrations/    # Third-party APIs
│   │   │   └── globals.css
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                   # ShadCN components
│   │   │   ├── ai/                   # AI interaction components
│   │   │   │   ├── magic-spark.tsx
│   │   │   │   ├── logic-architect.tsx
│   │   │   │   ├── content-crafter.tsx
│   │   │   │   ├── style-master.tsx
│   │   │   │   └── behavior-dashboard.tsx     # User behavior insights dashboard
│   │   │   ├── product-tools/        # Product tool components
│   │   │   │   ├── product-tool-renderer.tsx        # Main dynamic renderer
│   │   │   │   └── product-tool-component-factory.tsx  # Dynamic component factory
│   │   │   ├── tool-creator/         # Tool Creation UI Components  
│   │   │   │   ├── input-history.tsx          # History panel with edit functionality
│   │   │   │   ├── canvas-tool.tsx            # Real-time tool preview
│   │   │   │   ├── dynamic-component-factory.tsx  # Dynamic component factory (legacy)
│   │   │   │   ├── inputs/                    # Dynamic input components
│   │   │   │   │   ├── color-picker-popup.tsx # Custom color selection modal
│   │   │   │   │   └── dynamic-input.tsx      # Context-aware input routing
│   │   │   │   └── conversation-flow.tsx      # AI conversation state management
│   │   │   ├── dashboard/            # Dashboard components
│   │   │   │   ├── tool-data/        # Tool Data integration components
│   │   │   │   │   ├── data-source-overview.tsx    # Status overview cards
│   │   │   │   │   ├── quick-connect.tsx           # Connection wizard
│   │   │   │   │   ├── source-management.tsx      # Manage existing sources
│   │   │   │   │   ├── smart-integration.tsx      # AI-powered integration
│   │   │   │   │   └── data-templates.tsx         # Template library
│   │   │   │   └── analytics-dashboard.tsx   # Analytics visualization
│   │   │   └── shared/               # Reusable components
│   │   │
│   │   ├── lib/
│   │   │   ├── ai/                   # AI Agent Modules
│   │   │   │   ├── agents/
│   │   │   │   │   ├── magic-spark.ts
│   │   │   │   │   ├── logic-architect.ts
│   │   │   │   │   ├── content-crafter.ts
│   │   │   │   │   └── style-master.ts
│   │   │   │   ├── behavior-tracker.ts        # User behavior learning system
│   │   │   │   ├── models/           # Centralized Model Configuration
│   │   │   │   │   ├── default-models.json    # Model definitions & pricing
│   │   │   │   │   ├── model-config.ts        # Configuration utilities
│   │   │   │   │   └── ai-provider-factory.ts # Provider abstraction
│   │   │   │   ├── providers/
│   │   │   │   │   ├── openai.ts
│   │   │   │   │   └── anthropic.ts
│   │   │   │   └── utils/
│   │   │   │       ├── streaming.ts
│   │   │   │       ├── validation.ts
│   │   │   │       └── metrics-tracker.ts    # Automatic metrics tracking
│   │   │   │
│   │   │   ├── auth/                 # Authentication & Debug System
│   │   │   │   └── debug.ts          # Centralized debug authentication
│   │   │   │
│   │   │   ├── data/                 # Data Integration Layer ✨ NEW
│   │   │   │   ├── connectors/       # Data source connectors
│   │   │   │   │   ├── sql.ts        # SQL database connector
│   │   │   │   │   ├── files.ts      # File processing utilities
│   │   │   │   │   ├── cloud.ts      # Cloud service integrations
│   │   │   │   │   └── api.ts        # API endpoint connectors
│   │   │   │   ├── templates/        # Data templates and schemas
│   │   │   │   │   ├── real-estate.ts
│   │   │   │   │   ├── crm.ts
│   │   │   │   │   ├── products.ts
│   │   │   │   │   └── index.ts      # Template registry
│   │   │   │   ├── processors/       # Data processing utilities
│   │   │   │   │   ├── csv-parser.ts
│   │   │   │   │   ├── excel-parser.ts
│   │   │   │   │   ├── access-parser.ts
│   │   │   │   │   └── data-validator.ts
│   │   │   │   ├── ai/               # AI-powered data intelligence
│   │   │   │   │   ├── data-analyzer.ts      # Smart data detection
│   │   │   │   │   ├── mapping-suggester.ts  # Field mapping AI
│   │   │   │   │   └── tool-recommender.ts   # Tool type suggestions
│   │   │   │   └── managers/         # Data source management
│   │   │   │       ├── connection-manager.ts
│   │   │   │       ├── sync-manager.ts
│   │   │   │       └── health-monitor.ts
│   │   │   │
│   │   │   ├── prompts/              # All AI Prompts
│   │   │   │   ├── magic-spark.ts
│   │   │   │   ├── logic-architect.ts
│   │   │   │   ├── content-crafter.ts
│   │   │   │   ├── style-master.ts
│   │   │   │   └── data-integration.ts       # Data analysis prompts
│   │   │   │
│   │   │   ├── orchestration/        # AI Orchestration Logic
│   │   │   │   ├── session-manager.ts
│   │   │   │   ├── state-machine.ts
│   │   │   │   └── timeout-handler.ts
│   │   │   │
│   │   │   ├── types/                # TypeScript Definitions
│   │   │   │   ├── ai.ts
│   │   │   │   ├── product-tool.ts   # Product tool type definitions
│   │   │   │   ├── tool-definition.ts # Legacy tool definition types
│   │   │   │   ├── data-sources.ts   # Data integration type definitions
│   │   │   │   ├── user.ts
│   │   │   │   └── database.ts
│   │   │   │
│   │   │   ├── db/                   # Database Layer
│   │   │   │   ├── dynamodb/        # DynamoDB utilities
│   │   │   │   │   ├── client.ts
│   │   │   │   │   ├── users.ts
│   │   │   │   │   ├── product-tools.ts      # Product tools CRUD operations
│   │   │   │   │   ├── data-sources.ts       # Data source management
│   │   │   │   │   ├── sessions.ts
│   │   │   │   │   ├── conversations.ts
│   │   │   │   │   ├── leads.ts
│   │   │   │   │   ├── analytics.ts
│   │   │   │   │   ├── metrics.ts    # Admin metrics storage
│   │   │   │   │   └── behavior.ts   # User behavior tracking storage
│   │   │   │   ├── redis/           # ElastiCache Redis utilities
│   │   │   │   │   ├── cache.ts
│   │   │   │   │   └── client.ts
│   │   │   │   └── sqs/             # SQS utilities
│   │   │   │       ├── queues.ts
│   │   │   │       └── client.ts
│   │   │   │
│   │   │   ├── integrations/         # Third-party Integrations
│   │   │   │   ├── clerk.ts
│   │   │   │   ├── stripe.ts
│   │   │   │   ├── unsplash.ts
│   │   │   │   ├── google-sheets.ts  # Google Sheets integration
│   │   │   │   ├── salesforce.ts     # Salesforce connector
│   │   │   │   ├── airtable.ts       # Airtable integration
│   │   │   │   └── email-providers/
│   │   │   │
│   │   │   ├── utils/                # Utility Functions
│   │   │   │   ├── logger.ts
│   │   │   │   ├── websocket.ts
│   │   │   │   └── validation.ts
│   │   │   │
│   │   │   └── stores/               # Zustand Stores
│   │   │       ├── ai-session.ts
│   │   │       ├── tool-builder.ts
│   │   │       ├── data-sources.ts   # Data source state management
│   │   │       └── user-preferences.ts
│   │   │
│   │   └── styles/                   # Global Styles
│   │       ├── globals.css
│   │       └── components.css
│   │
│   ├── public/                       # Static Assets
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── REFERENCE_CODE/                     # Reference Implementation Patterns
│   ├── hooks/
│   ├── security/
│   ├── prompts/
│   ├── voice-message/
│   └── [existing files...]
│
├── .cursor/
│   └── PRIMARY_RULES                          # Development Rules
│
├── ADMIN_DASHBOARD_README.md          # Admin dashboard documentation
├── DEBUG_AUTH_README.md               # Debug authentication guide
└── README.md
```

### Database Architecture Design

### Tool Data Integration System ✨ NEW

**Comprehensive Data Source Management:**
The platform now includes a sophisticated data integration system that allows users to connect their tools to real data sources, transitioning from demo data to production-ready business tools.

**Key Features:**
- **Multi-Format Support**: CSV, Excel, Access files, SQL databases, cloud services, APIs
- **Smart Data Detection**: AI-powered analysis of data structure and automatic field mapping
- **Real-time Sync Monitoring**: Connection health tracking and automatic error detection
- **Mock-to-Real Migration**: Seamless transition from demonstration to production data
- **Pre-built Connectors**: Ready-to-use integrations for popular business platforms

**Data Source Types:**
```typescript
interface DataSource {
  id: string;
  name: string;
  type: 'file' | 'database' | 'cloud' | 'api';
  status: 'active' | 'error' | 'pending' | 'archived';
  config: {
    // File sources
    fileName?: string;
    fileType?: 'csv' | 'excel' | 'access';
    
    // Database sources
    host?: string;
    database?: string;
    credentials?: string; // Encrypted reference
    
    // Cloud sources
    provider?: 'googlesheets' | 'salesforce' | 'airtable';
    resourceId?: string;
    
    // API sources
    endpoint?: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
  };
  mapping: Record<string, string>; // Field mappings
  syncSettings: {
    frequency: 'realtime' | 'hourly' | 'daily' | 'manual';
    lastSync: number;
    nextSync?: number;
  };
  healthStatus: {
    isConnected: boolean;
    lastError?: string;
    errorCount: number;
    responseTime: number;
  };
  metadata: {
    recordCount: number;
    dataTypes: Record<string, string>;
    sampleData: any[];
    aiAnalysis?: {
      suggestedToolTypes: string[];
      fieldMappings: Record<string, string>;
      dataQuality: number; // 0-1 score
    };
  };
}
```

**Smart Data Detection:**
```typescript
interface DataAnalysisResult {
  dataStructure: {
    columns: Array<{
      name: string;
      type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
      samples: any[];
      nullPercentage: number;
    }>;
    rowCount: number;
    dataQuality: number;
  };
  suggestedToolTypes: Array<{
    type: 'calculator' | 'quiz' | 'assessment';
    confidence: number;
    reasoning: string;
    suggestedInputs: string[];
    suggestedOutputs: string[];
  }>;
  fieldMappings: Array<{
    sourceField: string;
    suggestedTarget: string;
    confidence: number;
    reasoning: string;
  }>;
  optimizationSuggestions: string[];
}
```

**Dashboard Integration:**
The Tool Data section is integrated directly into the main user dashboard with four key areas:

1. **Data Source Overview**: Real-time status of connected sources
2. **Quick Connect**: One-click setup for different data source types
3. **Source Management**: Monitor and configure existing connections
4. **Smart Integration**: AI-powered data analysis and recommendations

**User Experience Flow:**
```typescript
// 1. User uploads file or connects data source
const dataSource = await connectDataSource({
  type: 'csv',
  file: uploadedFile
});

// 2. AI analyzes data structure
const analysis = await analyzeDataStructure(dataSource);

// 3. AI suggests optimal tool configuration
const toolSuggestion = await suggestToolConfiguration(analysis);

// 4. User confirms and creates tool with real data
const tool = await createToolWithDataSource({
  toolConfig: toolSuggestion,
  dataSource: dataSource,
  mapping: analysis.fieldMappings
});

// 5. Tool automatically uses real data instead of mock data
const renderWithRealData = () => {
  const data = useDataSource(dataSource.id);
  // Tool renders with live data
};
```

### Dynamic Input Component System

**Context-Aware Input Routing:**
The system dynamically renders appropriate input components based on question type and configuration:

```typescript
// Input component selection logic
function DynamicInput({ currentQuestion, value, onChange, onSubmit }) {
  switch (currentQuestion.inputType) {
    case 'select':        // Dropdown with custom option
    case 'multiSelect':   // Horizontal chips with checkboxes  
    case 'colorSelect':   // Color swatches with custom picker
    case 'yesNoMaybe':    // Radio buttons for simple choices
    case 'textarea':      // Multi-line text input
    case 'text':          // Single-line with suggestion chips
    case 'multiPart':     // Sequential question flow
    case 'dataSelect':    // ✨ NEW: Data source field selector
  }
}
```

**Enhanced UI/UX Features:**
- **Pagination Controls**: Navigate through option sets with chevron buttons
- **Custom Color Picker**: Full-featured color selection modal with live preview
- **Suggestion Chips**: Smart suggestions for text inputs
- **Visual Feedback**: Hover states, selection indicators, and smooth animations
- **Responsive Design**: Consistent container sizing across all input types
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Data Integration**: Special input types for data source configuration

**Question History Integration:**
- **Real-time Tracking**: All questions (mock and AI) stored for editing
- **Type Icon System**: Visual indicators for different input types (Palette, Type, List, etc.)
- **Compact Display**: Truncated question text with expandable details
- **Edit Button Visibility**: Hover-only edit controls for clean interface

### Single-Database Strategy with DynamoDB

**DynamoDB (Primary Database):**
- ALL application data using single-table design
- Users, tools, leads, analytics, AI sessions, conversations, metrics, alerts, **data sources**
- High-performance read/write operations with auto-scaling
- Built-in backup and point-in-time recovery
- Global Secondary Indexes (GSIs) for different query patterns
- Managed via CDK with proper IAM permissions

**DynamoDB (User Behavior Tracking):**
- Dedicated table for user behavior analytics using single-table design
- User interactions, profiles, evolution history, analysis records
- Automatic TTL cleanup for interaction data (90 days)
- Cross-user analytics via Global Secondary Indexes
- Real-time behavior insights and adaptation recommendations
- Managed via separate CDK stack for modular deployment

**ElastiCache Redis (Caching Layer):**
- Application-level caching for frequently accessed data
- Session caching for performance optimization
- **Data source connection caching** for improved response times
- Rate limiting counters and temporary computation results
- Cache invalidation strategies for data consistency

**SQS (Background Processing):**
- Queue long-running AI operations that exceed Vercel timeouts
- Background behavior analysis and pattern detection
- **Data source sync operations** and health monitoring
- Dead letter queues for failed operations
- Integration with Lambda for async processing
- Decoupling of AI processing from API responses

### DynamoDB Single-Table Design

```typescript
// Primary table structure using single-table design
interface KeyvexTableItem {
  PK: string;           // Partition Key
  SK: string;           // Sort Key
  GSI1PK?: string;      // Global Secondary Index 1 PK
  GSI1SK?: string;      // Global Secondary Index 1 SK
  GSI2PK?: string;      // Global Secondary Index 2 PK
  GSI2SK?: string;      // Global Secondary Index 2 SK
  entityType: string;   // 'USER' | 'TOOL' | 'SESSION' | 'LEAD' | 'INTERACTION' | 'METRIC' | 'ALERT' | 'DATA_SOURCE'
  createdAt: number;    // Unix timestamp
  updatedAt: number;    // Unix timestamp
  ttl?: number;         // Auto-expire for temporary data
  metadata: Record<string, any>; // Extensible metadata
  version: number;      // For optimistic locking
  [key: string]: any;   // Entity-specific fields
}

// ... existing entities ...

// Data Source entity ✨ NEW
interface DataSourceItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: `DATA_SOURCE#${string}`;    // DATA_SOURCE#{sourceId}
  GSI1PK: `DATA_SOURCE#${string}`; // For source-specific queries
  GSI1SK: `STATUS#${string}`;     // For filtering by status
  GSI2PK: `TYPE#${string}`;       // For filtering by source type
  GSI2SK: `CREATED#${number}`;    // For sorting by creation date
  entityType: 'DATA_SOURCE';
  sourceId: string;
  userId: string;
  name: string;
  type: 'file' | 'database' | 'cloud' | 'api';
  status: 'active' | 'error' | 'pending' | 'archived';
  config: {
    // Source-specific configuration
    [key: string]: any;
  };
  mapping: Record<string, string>;
  syncSettings: {
    frequency: 'realtime' | 'hourly' | 'daily' | 'manual';
    lastSync: number;
    nextSync?: number;
  };
  healthStatus: {
    isConnected: boolean;
    lastError?: string;
    errorCount: number;
    responseTime: number;
  };
  metadata: {
    recordCount: number;
    dataTypes: Record<string, string>;
    sampleData: any[];
    aiAnalysis?: any;
  };
}

// Data Source Activity entity (for monitoring)
interface DataSourceActivityItem extends KeyvexTableItem {
  PK: `DATA_SOURCE#${string}`;     // DATA_SOURCE#{sourceId}
  SK: `ACTIVITY#${number}#${string}`; // ACTIVITY#{timestamp}#{activityId}
  GSI1PK: `ACTIVITY#${string}`;    // For activity type queries
  GSI1SK: `${number}`;             // Timestamp for sorting
  entityType: 'DATA_ACTIVITY';
  sourceId: string;
  activityId: string;
  activityType: 'sync' | 'test' | 'error' | 'connection' | 'configuration';
  status: 'success' | 'error' | 'pending';
  details: {
    duration?: number;
    recordsProcessed?: number;
    errorMessage?: string;
    performance?: Record<string, any>;
  };
  timestamp: number;
  ttl: number; // Auto-expire after 30 days
}

// Tool-Data Source Relationship entity
interface ToolDataSourceItem extends KeyvexTableItem {
  PK: `TOOL#${string}`;           // TOOL#{toolId}
  SK: `DATA_SOURCE#${string}`;    // DATA_SOURCE#{sourceId}
  GSI1PK: `DATA_SOURCE#${string}`; // For reverse lookups
  GSI1SK: `TOOL#${string}`;       // Which tools use this source
  entityType: 'TOOL_DATA_LINK';
  toolId: string;
  sourceId: string;
  mapping: Record<string, string>; // Field mappings specific to this tool
  isActive: boolean;
  configuration: {
    refreshBehavior: 'automatic' | 'manual';
    cacheSettings: Record<string, any>;
    transformations: any[];
  };
}
```

### Query Patterns and GSI Usage

**GSI1 (GSI1PK, GSI1SK):**
- User's tools: `GSI1PK = USER#{clerkId}`, `SK begins_with TOOL#`
- User's sessions: `GSI1PK = USER#{clerkId}`, `SK begins_with SESSION#`
- User's data sources: `GSI1PK = USER#{clerkId}`, `SK begins_with DATA_SOURCE#`
- Email lookups: `GSI1PK = EMAIL#{email}`
- Tool analytics: `GSI1PK = ANALYTICS#{toolId}`
- Process metrics: `GSI1PK = PROCESS#{processName}`
- Alert types: `GSI1PK = ALERT_TYPE#{type}`
- Data source status: `GSI1PK = DATA_SOURCE#{sourceId}`, `GSI1SK = STATUS#{status}`
- Data source activities: `GSI1PK = ACTIVITY#{activityType}`

**GSI2 (GSI2PK, GSI2SK):**
- Tools by type: `GSI2PK = TYPE#{toolType}`
- Tools by creation date: Sort by `GSI2SK = CREATED#{timestamp}`
- Published tools: `GSI2PK = STATUS#published`
- Provider metrics: `GSI2PK = PROVIDER#{providerName}`
- Data sources by type: `GSI2PK = TYPE#{sourceType}`
- Data sources by creation: Sort by `GSI2SK = CREATED#{timestamp}`

### Phase 2: User Experience & Refinement (Weeks 4-6) ✅ IN PROGRESS
**Enhanced User Experience:**
- ✅ Complete conversation history panel with edit-in-place functionality
- ✅ Implement multi-part question iterator component
- ✅ Add real-time tool preview updates
- ✅ Complete adaptive color picker and custom color management
- ✅ **Tool Data Integration Dashboard** - Comprehensive data source management
- Enhanced User Behavior Learning with evolution tracking

**Tool Data Integration:**
- ✅ **Data Source Overview Dashboard** - Real-time status monitoring
- ✅ **Quick Connect Wizard** - One-click setup for files, databases, cloud services
- ✅ **Smart Integration Features** - AI-powered data detection and recommendations
- ✅ **Data Templates Library** - Pre-built templates for common business use cases
- 🔄 **Backend API Development** - Data source connectors and processing
- 🔄 **Mock-to-Real Migration** - Seamless transition system

**AI Agent Development:**
- Develop Content Crafter and Logic Architect agents
- Implement conversation state management
- Add brand intelligence and visual analysis capabilities
- Complete Style Master agent with comprehensive styling
- **Data Integration Agent** - AI-powered data analysis and mapping

**Behavior Intelligence:**
- Implement production DynamoDB behavior tracking
- Add real-time behavior analysis and adaptation
- Complete admin behavior dashboard with evolution timeline
- Deploy behavior analysis Lambda functions

### Phase 3: Production Polish & Launch (Weeks 7-8)
**Production Readiness:**
- Complete error handling and fallback systems
- Implement comprehensive monitoring and alerting
- Add rate limiting and security measures
- Complete payment integration with Stripe
- Finalize behavior data export and privacy controls
- **Production Data Source Management** - Enterprise-grade data connectors

**Advanced Features:**
- Launch webhook system for third-party integrations
- Complete lead capture and management system
- Add advanced analytics with cross-user behavior insights
- Implement tool sharing and collaboration features
- Deploy behavior-driven AI personalization
- **Advanced Data Intelligence** - Predictive data insights and optimization

**Quality Assurance:**
- Comprehensive testing across all user flows
- Performance optimization and load testing
- Security audit and penetration testing
- User acceptance testing with behavior tracking validation
- **Data Integration Testing** - Comprehensive testing of all data source types

## Key Technical Decisions

### 1. Hybrid Architecture Strategy
**Decision**: Vercel-first with AWS backend for complex operations
**Rationale**: Maximizes developer experience while solving timeout limitations
**Implementation**: AI orchestration on Vercel, complex processing on Lambda

### 2. Single-Table DynamoDB Design
**Decision**: Use single-table design for main application data, separate table for behavior tracking
**Rationale**: Optimal performance and cost efficiency with specialized analytics
**Implementation**: Careful entity design with proper GSI patterns for behavior queries

### 3. Tool Data Integration Architecture ✨ NEW
**Decision**: Comprehensive data integration system with AI-powered analysis
**Rationale**: Enables transition from demo tools to production business applications
**Implementation**:
- Multi-format data source support (files, databases, cloud services, APIs)
- Smart data detection and field mapping using AI
- Real-time sync monitoring and health tracking
- Seamless mock-to-real data migration
- Pre-built connectors for popular business platforms

### 4. User Behavior Learning Architecture
**Decision**: Comprehensive behavior tracking with evolution detection and adaptive AI responses
**Rationale**: Personalized user experiences improve engagement and tool creation success
**Implementation**: 
- Development: localStorage with rolling buffers for rapid iteration
- Production: Dedicated DynamoDB table with TTL and privacy controls
- Analytics: Real-time admin dashboard with cross-user insights
- Adaptation: Dynamic AI responses based on behavioral patterns

### 5. Agent Separation with Signal-Based Communication
**Decision**: Specialized agents with single responsibilities instead of monolithic AI system
**Rationale**: Better maintainability, structured validation, and optimal user experience
**Implementation**: 
- Conversation Agent handles UI flow and signals when specialized work needed
- Tool Creation Agent uses structured output with complete schema validation
- Frontend seamlessly handles agent handoffs with real-time canvas updates
- Scalable pattern for future specialized agents (content, style, analytics, **data integration**)

### 6. Structured Output with Schema Validation
**Decision**: Use Zod schemas and structured output for complex AI generation tasks
**Rationale**: Prevents malformed outputs, ensures type safety, and enables better error handling
**Implementation**: Tool Creation Agent generates validated ProductToolDefinitions using Vercel AI SDK's generateObject with comprehensive schemas

### 7. Component-Based Dynamic UI
**Decision**: Context-aware input components with edit-in-place functionality  
**Rationale**: Flexible conversation flows with seamless editing experience
**Implementation**: Type-safe component routing with state restoration

### 8. Data-First Tool Architecture ✨ NEW
**Decision**: Tools designed for real data from the beginning, with mock data as fallback
**Rationale**: Ensures business tools can scale from demo to production seamlessly
**Implementation**:
- Data source abstraction layer for consistent tool behavior
- AI-powered data analysis for optimal tool configuration
- Progressive enhancement from mock to real data
- Built-in data validation and error handling

### 9. Comprehensive Monitoring Strategy
**Decision**: Multi-layered monitoring with behavior analytics integration
**Rationale**: Proactive issue detection and continuous user experience optimization
**Implementation**: 
- Cost tracking across all AI operations
- Performance monitoring with behavioral correlation
- User behavior evolution tracking with trend analysis
- Adaptive recommendation system based on behavioral patterns
- **Data source health monitoring** with real-time alerts
``` 
</rewritten_file>