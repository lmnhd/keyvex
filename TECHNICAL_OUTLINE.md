# Keyvex Technical Outline & Implementation Strategy

## Executive Summary

Keyvex is an AI-powered platform that enables independent consultants, coaches, and B2B service providers to create interactive lead magnets (calculators, quizzes, assessments) through AI co-creation. The platform emphasizes real-time streaming AI interactions while managing Vercel timeout constraints through a hybrid architecture approach, enhanced with comprehensive user behavior learning for personalized AI experiences and advanced tool data integration capabilities.

## Recent Architectural Enhancements

The platform has undergone significant architectural improvements, focusing on modularity, maintainability, and professional-grade output.

### AI and Prompt Architecture
- **Complete Prompt Separation**: All AI prompts have been moved from API routes to dedicated `/lib/prompts/` files. This improves organization, reusability, and maintainability.
- **XML-Structured Prompts**: Prompts now use a structured XML format, enhancing AI processing, compliance, and validation.
- **Dynamic Prompt Builders**: Sophisticated builder functions generate contextual prompts, keeping API routes clean and focused on logic.
- **Grid Layout Mandates**: Prompts enforce sophisticated grid-based layouts, moving away from simple vertical forms to modern, dashboard-style UIs.

### Quality Assurance and Auto-Fix Systems
- **React Keys Validation Fix**: Improved validation now correctly checks for missing `key` props only within actual array contexts, eliminating false positives.
- **AI Tool Fixer Enhanced**: The auto-fix system can now detect and convert arrow functions to standard function declarations, resolving compatibility issues with the dynamic renderer.
- **Saved Brainstorm Dropdown Fix**: The "Choose a saved brainstorm" dropdown is now correctly refreshed after tool creation, ensuring the latest data is always available.
- **Enhanced Debugging**: All `TRACE` logs now include function name identifiers for clearer, more precise debugging.

### UI and Component Quality
- **Mandatory Main Card Wrapper**: All tools are required to be wrapped in a primary ShadCN Card component, ensuring a consistent and professional look.
- **Mandatory Info Popup System**: All tool headers must include a comprehensive info tooltip using ShadCN Tooltip components, improving user guidance.
- **ShadCN Component Emphasis**: Development guidelines now place a strong emphasis on using ShadCN components to ensure a high-quality, consistent UI.

### Component Architecture Refactoring
- **Test File Optimization**: A massive 4,600+ line test file was refactored for better maintainability.
- **Reusable UI Components**: Production-ready components were extracted from test implementations into a modular `/components/tool-creator-ui/` hierarchy.
- **Clean Import Separation**: Inline component definitions have been eliminated in favor of proper module imports, resolving conflicts and improving code structure.

---

## Core Architecture Strategy

### 1. Hybrid Vercel + AWS Architecture

**Primary Stack (Vercel-First with AWS Backend):**
- **Frontend**: Next.js 14 with App Router (Vercel)
- **Backend**: Vercel Serverless Functions for AI orchestration
- **AI Streaming**: Vercel AI SDK for real-time user experience
- **Database**: AWS DynamoDB (single-table design for all data)
- **Behavior Analytics**: AWS DynamoDB (dedicated table for user behavior tracking)
- **Caching**: AWS ElastiCache Redis
- **Background Jobs**: AWS SQS + Lambda
- **Authentication**: Clerk with centralized debug system
- **Payments**: Stripe
- **State Management**: Zustand + React Query
- **Infrastructure**: AWS CDK for all AWS resources

**AWS Infrastructure Layer:**
- **DynamoDB**: Primary database for users, tools, leads, AI sessions, analytics, metrics
- **DynamoDB (Behavior)**: Dedicated table for user behavior tracking, evolution history, and analysis
- **ElastiCache Redis**: Application caching and session storage
- **SQS**: Background job queues for long-running AI operations
- **Lambda Functions**: Complex AI chains, background processing, and behavior analysis
- **API Gateway**: WebSocket support for real-time updates
- **Secrets Manager**: Secure configuration management
- **CloudWatch**: Monitoring, logging, and alerting

### 2. AI Timeout Management Strategy

**Agent Separation Architecture:**
```typescript
// Primary Agents (Vercel-compatible):
POST /api/ai/test-ui        # Conversation Agent (10-15 seconds)
POST /api/ai/create-tool    # Tool Creation Agent (15-25 seconds)

// Future Specialized Agents:
POST /api/ai/content-crafter    # Content Generation (15-20 seconds)
POST /api/ai/style-master       # Style Customization (15-20 seconds)
POST /api/ai/analytics-processor # Analytics Agent (20-25 seconds)

// Complex Operations (Lambda offload):
Lambda: complex-ai-processor    # Multi-step AI chains (60+ seconds)
Lambda: bulk-content-generator  # Large-scale content generation
Lambda: advanced-analytics      # Deep data analysis and insights
```

**Agent Communication Pattern:**
- **Conversation Agent**: Handles UI flow, signals when specialized work is needed.
- **Specialized Agents**: Handle specific tasks (e.g., tool creation, styling) with structured, validated outputs.
- **Lambda Workers**: Execute long-running jobs queued via SQS.
- **Frontend Integration**: Manages seamless handoffs between agents with real-time UI updates.

**State Management Between Agent Calls:**
- Client-side state with Zustand for immediate UI updates.
- DynamoDB for server-side session persistence and conversation history.
- ElastiCache Redis for high-performance caching.
- SQS for queuing complex operations that require Lambda processing.

### 3. Project Structure
KEYVEX_PROJECT/
├── aws_infra/ # AWS CDK Infrastructure
│ ├── lib/
│ │ ├── database-stack.ts # DynamoDB + ElastiCache + SQS
│ │ ├── user-behavior-dynamodb-stack.ts # DynamoDB for behavior tracking
│ │ └── ...
│ ├── lambda/
│ │ ├── ai-processor/ # Long-running AI chains
│ │ ├── behavior-processor/ # User behavior analysis
│ │ └── ...
│ └── cdk.json
│
├── keyvex_app/ # Next.js Application
│ ├── src/
│ │ ├── app/
│ │ │ ├── api/
│ │ │ │ ├── ai/
│ │ │ │ │ ├── create-tool/ # V1 Tool Creation Agent
│ │ │ │ │ ├── product-tool-creation-v2/ # V2 Multi-Agent Orchestration System
│ │ │ │ │ │ ├── agents/ # Specialized V2 Agents (planner, state, jsx, styling)
│ │ │ │ │ │ └── orchestrate/ # Orchestration Control Endpoints
│ │ │ │ │ └── ...
│ │ │ │ ├── data-sources/ # Data source integration APIs
│ │ │ │ └── ...
│ │ │ └── ...
│ │ ├── components/
│ │ │ ├── product-tools/
│ │ │ │ ├── product-tool-renderer.tsx # Main dynamic renderer
│ │ │ │ └── ...
│ │ │ ├── tool-creator-ui/
│ │ │ │ ├── inputs/
│ │ │ │ │ ├── DynamicInput.tsx # Universal input handler
│ │ │ │ │ ├── ColorPickerPopup.tsx # Dual color picker with preview
│ │ │ │ │ └── FullFormPopup.tsx # Multi-question form handler
│ │ │ │ └── ...
│ │ │ └── ...
│ │ ├── lib/
│ │ │ ├── ai/
│ │ │ │ ├── agents/
│ │ │ │ ├── models/ # Centralized Model Configuration
│ │ │ │ └── ...
│ │ │ ├── data/ # Data Integration Layer
│ │ │ │ ├── connectors/ # Data source connectors (SQL, files, cloud, API)
│ │ │ │ ├── processors/ # Data processing utilities (CSV, Excel, etc.)
│ │ │ │ ├── ai/ # AI-powered data intelligence
│ │ │ │ └── ...
│ │ │ ├── prompts/ # All AI Prompts (separated by agent)
│ │ │ ├── types/
│ │ │ │ ├── product-tool-creation-v2/
│ │ │ │ │ └── tcc.ts # Tool Construction Context (TCC) schema
│ │ │ │ ├── data-sources.ts # Data integration type definitions
│ │ │ │ └── ...
│ │ │ ├── db/
│ │ │ │ ├── dynamodb/
│ │ │ │ │ ├── product-tools.ts
│ │ │ │ │ ├── data-sources.ts
│ │ │ │ │ └── ...
│ │ │ │ └── ...
│ │ │ ├── hooks/
│ │ │ │ └── useProductToolCreationV2.ts # V2 Multi-Agent Orchestration Hook
│ │ │ └── ...
│ │ └── ...
│ └── ...
└── ...

---
## Core AI Agent Architecture

### Agent Separation Strategy
The architecture is built on the philosophy of single responsibility per agent with a clean separation of concerns. All prompting logic is centralized in dedicated files, not mixed with server code.

**Key Principles**:
- **Complete Prompt Separation**: All AI prompts are in `/lib/prompts/` with dynamic builder functions.
- **XML-Structured Prompts**: Enhanced prompt organization for better AI processing.
- **AI Intelligence First**: Let AI models make decisions without programmatic intervention.
- **Structured Validation**: Use Zod schema validation for complex outputs.
- **Scalable Pattern**: Easily add new specialized agents.
- **Grid Layout Enforcement**: All tools use sophisticated dashboard-style layouts.

### Primary Agent Types

#### 1. Conversation Agent (`/api/ai/test-ui/`)
- **Purpose**: Handle conversation flow and UI interactions.
- **Responsibility**: Manages the user experience, asks clarifying questions, and determines when to hand off to a specialized agent.
- **Timeout Risk**: Low (typically a single, fast LLM call).

#### 2. Tool Creation Agent (`/api/ai/create-tool/`)
- **Purpose**: Generate and modify `ProductToolDefinition` objects.
- **Responsibility**: Tool architecture and code generation with professional, grid-based layouts.
- **Timeout Risk**: Medium (requires structured output and validation).
- **Implementation**: Uses `generateObject` from the Vercel AI SDK with a comprehensive Zod schema.

---
## Product Tool Creation V2: Multi-Agent System

This is a cutting-edge V2 multi-agent orchestration system that replaces monolithic AI generation with specialized, collaborative agents.

#### V2 System Overview

- **Architecture Philosophy**: Vercel-first with frontend-controlled orchestration.
- **Frontend Orchestration**: A React hook (`useProductToolCreationV2`) manages the entire multi-agent workflow.
- **Specialized Agents**: Each agent handles one specific aspect of tool creation (planning, state, JSX, styling).
- **Tool Construction Context (TCC)**: A shared state object, persisted in DynamoDB, for communication between agents.
- **Polling-Based Coordination**: The frontend polls for progress, avoiding Vercel function timeouts.

#### V2 Specialized Agent Architecture

1.  **Function Signature Planner**: Analyzes requirements and plans the tool's functional architecture.
2.  **State Design Agent**: Designs React state management (`useState` hooks) and business logic.
3.  **JSX Layout Agent**: Creates the component structure using professional, grid-based layouts.
4.  **Tailwind Styling Agent**: Applies a complete, responsive Tailwind CSS styling system.

#### Frontend Orchestration (`useProductToolCreationV2`)
The hook encapsulates the logic to:
1.  Initialize the orchestration job.
2.  Poll for agent completion status.
3.  Trigger the next steps in the sequence.
4.  Handle progress tracking, errors, and state management.

---

## Architectural Pivot: From JSON Definitions to Direct React Component Generation

A fundamental architectural decision was made to shift from generating complex JSON definitions to generating React component code directly.

### Previous Architecture: JSON-Based Definitions
The original approach used a verbose JSON schema to define a tool's layout, components, and logic.
**Problems included:**
- A complex and brittle "component factory" was needed to map JSON to React components.
- Limited flexibility to express complex React patterns, state, or custom logic.
- Poor performance due to multiple layers of abstraction.
- Difficult for the AI to generate and for developers to debug.

### New Architecture: Direct React Component Generation
The AI now generates a string of clean, familiar React JSX code for the entire tool.
```typescript
// The AI generates this directly as a string
function ROICalculator() {
  const [investment, setInvestment] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const roi = revenue > 0 ? ((revenue - investment) / investment) * 100 : 0;
  
  return (
    <Card>
      <CardHeader>...</CardHeader>
      <CardContent>
        {/* Inputs and results display */}
      </CardContent>
    </Card>
  );
}
```

**Benefits of the Pivot:**
- **AI Simplicity & Quality**: LLMs excel at generating code. The output is higher quality and more flexible.
- **Unlimited Flexibility**: The full React ecosystem is available (hooks, state, third-party libraries).
- **Performance**: Fewer layers of abstraction lead to faster rendering.
- **Developer Experience**: Debugging standard React code is far simpler than debugging JSON mappings and factory logic.

This pivot to a **generative-first architecture** is the foundation of Keyvex's competitive advantage.

---

## Data Integration Architecture

A sophisticated data integration system allows users to connect their tools to real data sources, turning them from demos into production-ready business applications.

### Key Features
- **Multi-Format Support**: Connect to CSV, Excel, and Access files, SQL databases, cloud services (Google Sheets, Salesforce, Airtable), and external APIs.
- **Smart Data Detection**: AI-powered analysis of data structure and automatic field mapping suggestions.
- **Real-time Sync Monitoring**: Connection health tracking and automatic error detection.
- **Mock-to-Real Migration**: A seamless workflow to transition tools from demonstration data to live, production data.

### Data Source Management
The system provides a full suite of tools for managing data connections.
- **Dashboard Integration**: A "Tool Data" section in the user dashboard provides an overview of sources, a "Quick Connect" wizard, and tools to manage existing connections.
- **AI-Powered Integration**: AI assists with data analysis, schema mapping, and even recommends what kind of tool to build based on the connected data.

### Data Source & Analysis Types
```typescript
interface DataSource {
  id: string;
  name: string;
  type: 'file' | 'database' | 'cloud' | 'api';
  status: 'active' | 'error' | 'pending';
  config: {
    // Source-specific connection details
    fileName?: string;
    host?: string;
    provider?: 'googlesheets' | 'salesforce' | 'airtable';
    endpoint?: string;
  };
  mapping: Record<string, string>; // Field mappings
  syncSettings: {
    frequency: 'realtime' | 'hourly' | 'daily' | 'manual';
    lastSync: number;
  };
  healthStatus: {
    isConnected: boolean;
    lastError?: string;
  };
  metadata: {
    recordCount: number;
    dataTypes: Record<string, string>;
    sampleData: any[];
    aiAnalysis?: DataAnalysisResult;
  };
}

interface DataAnalysisResult {
  dataStructure: {
    columns: Array<{
      name: string;
      type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
    }>;
    rowCount: number;
  };
  suggestedToolTypes: Array<{
    type: 'calculator' | 'quiz' | 'assessment';
    confidence: number;
    reasoning: string;
  }>;
  fieldMappings: Array<{
    sourceField: string;
    suggestedTarget: string;
    confidence: number;
  }>;
}
```

---

## Database Architecture Design

### Single-Database Strategy with DynamoDB
- **Primary Database**: A single DynamoDB table houses ALL application data (users, tools, leads, sessions, etc.) using a single-table design pattern.
- **Behavior Tracking**: A separate, dedicated DynamoDB table is used for user behavior analytics, allowing for specialized query patterns and data lifecycle management (e.g., TTL for interaction data).
- **Caching Layer**: ElastiCache Redis is used for application-level caching, session storage, and rate limiting.
- **Background Processing**: SQS queues are used to decouple long-running AI operations and background tasks (like data source syncing), which are then processed by Lambda functions.

### DynamoDB Single-Table Design
The primary table uses a flexible structure with generic keys and specific entity types to enable diverse query patterns.
```typescript
// Primary table structure using single-table design
interface KeyvexTableItem {
  PK: string;           // Partition Key
  SK: string;           // Sort Key
  GSI1PK?: string;      // Global Secondary Index 1 PK
  GSI1SK?: string;      // Global Secondary Index 1 SK
  GSI2PK?: string;      // Global Secondary Index 2 PK
  GSI2SK?: string;      // Global Secondary Index 2 SK
  entityType: string;   // 'USER' | 'TOOL' | 'SESSION' | 'LEAD' | 'DATA_SOURCE' | ...
  createdAt: number;
  updatedAt: number;
  [key: string]: any;   // Entity-specific fields
}

// User entity
interface UserItem extends KeyvexTableItem {
  PK: `USER#${string}`; // USER#{clerkId}
  SK: 'PROFILE';
  entityType: 'USER';
  // ...
}

// Tool entity
interface ToolItem extends KeyvexTableItem {
  PK: `USER#${string}`;
  SK: `TOOL#${string}`; // TOOL#{toolId}
  entityType: 'TOOL';
  // ...
}

// Data Source entity
interface DataSourceItem extends KeyvexTableItem {
  PK: `USER#${string}`;
  SK: `DATA_SOURCE#${string}`; // DATA_SOURCE#{sourceId}
  GSI1PK: `DATA_SOURCE#${string}`;
  GSI1SK: `STATUS#${string}`;
  GSI2PK: `TYPE#${string}`;
  GSI2SK: `CREATED#${number}`;
  entityType: 'DATA_SOURCE';
  sourceId: string;
  userId: string;
  name: string;
  type: 'file' | 'database' | 'cloud' | 'api';
  status: 'active' | 'error' | 'pending' | 'archived';
  config: { [key: string]: any };
  mapping: Record<string, string>;
  syncSettings: { /* ... */ };
  healthStatus: { /* ... */ };
  metadata: { /* ... */ };
}

// Data Source Activity entity (for monitoring)
interface DataSourceActivityItem extends KeyvexTableItem {
  PK: `DATA_SOURCE#${string}`;
  SK: `ACTIVITY#${number}#${string}`; // ACTIVITY#{timestamp}#{activityId}
  GSI1PK: `ACTIVITY#${string}`;
  GSI1SK: `${number}`;
  entityType: 'DATA_ACTIVITY';
  activityType: 'sync' | 'test' | 'error' | 'connection' | 'configuration';
  status: 'success' | 'error' | 'pending';
  ttl: number; // Auto-expire after 30 days
}

// Tool-Data Source Relationship entity
interface ToolDataSourceItem extends KeyvexTableItem {
  PK: `TOOL#${string}`;
  SK: `DATA_SOURCE#${string}`;
  GSI1PK: `DATA_SOURCE#${string}`; // For reverse lookups
  GSI1SK: `TOOL#${string}`;
  entityType: 'TOOL_DATA_LINK';
  toolId: string;
  sourceId: string;
  mapping: Record<string, string>;
  isActive: boolean;
}
```

### Query Patterns and GSI Usage
- **GSI1**: Used for querying by user, email, tool analytics, data source status, and more.
- **GSI2**: Used for querying tools by type, status, or creation date, and data sources by type.

---

## User Behavior Learning System

The platform includes a sophisticated user behavior learning system that tracks interactions, analyzes patterns, and adapts AI responses for a personalized experience.

**Key Features**:
- **Real-time Interaction Tracking**: Captures response times, input preferences, editing patterns, and workflow choices.
- **Evolution Detection**: Automatically detects behavioral shifts, such as a user transitioning from a beginner to an expert.
- **Adaptive AI Responses**: Dynamically adjusts question complexity, input types, and suggestions based on the user's learned profile.
- **Admin Dashboard Integration**: Provides centralized insights into user behavior.

---
## Development & Deployment
The project follows a multi-environment strategy (development and production) with complete resource isolation managed via the AWS CDK. Deployment scripts (`deploy-dev`, `deploy-prod`) handle the deployment of environment-specific stacks.

### Environment Variables
Separate environment variables are configured in Vercel for development and production, pointing to the respective AWS resources (DynamoDB tables, SQS queues, API Gateway endpoints, etc.).

### Secrets Management
Secrets (API keys, database credentials) are stored in AWS Secrets Manager, with separate secrets for each environment.

---
## Conclusion

This technical outline provides a comprehensive roadmap for the Keyvex platform. The architecture prioritizes AI intelligence, developer experience, and professional-quality output. The shift to a generative-first, multi-agent system, combined with robust data integration and user behavior learning, positions Keyvex as a highly advanced and scalable solution in its market.