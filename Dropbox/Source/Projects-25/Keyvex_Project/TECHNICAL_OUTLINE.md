# Keyvex Technical Outline & Implementation Strategy

## Executive Summary

Keyvex is an AI-powered platform that enables independent consultants, coaches, and B2B service providers to create interactive lead magnets (calculators, quizzes, assessments) through AI co-creation. The platform emphasizes real-time streaming AI interactions while managing Vercel timeout constraints through a hybrid architecture approach, enhanced with comprehensive user behavior learning for personalized AI experiences.

## ✅ **MAJOR ACHIEVEMENTS: Complete Prompt Separation & XML Structuring**

**Recent Major Updates (January 2025):**

### **Complete AI Prompt Separation Architecture** ✅ COMPLETED
- **✅ CONSOLIDATED PROMPTS**: All AI prompts moved from API routes to dedicated `/lib/prompts/` files
- **✅ XML-STRUCTURED PROMPTS**: Enhanced prompts with structured XML format for better AI processing
- **✅ DYNAMIC BUILDERS**: Created sophisticated prompt builder functions for contextual prompt generation
- **✅ CLEAN API SEPARATION**: API routes now focus purely on request handling with zero inline prompt content
- **✅ GRID LAYOUT MANDATES**: Enforced sophisticated grid-based layouts eliminating outdated vertical form stacking

### **Prompt Architecture Achievements**

**Main Tool Creation Prompt** (`/lib/prompts/tool-creation-prompt.ts`):
```typescript
export const TOOL_CREATION_PROMPT = `...`; // Comprehensive XML-structured core prompt

// Dynamic prompt builders for API integration
export function buildCompleteSystemPrompt(logicBrainstorming?: any): string
export function buildBrainstormingIntegration(logicBrainstorming: any): string  
export function buildToolCreationUserPrompt(userIntent, context, existingTool?, updateType?): string
```

**Key Features:**
- **Grid Layout Enforcement**: Mandatory 2-3 column input sections, dashboard-style results displays
- **XML Structured Sections**: `<purpose>`, `<instructions>`, `<component-types>`, `<layout-requirements>`, `<output-requirements>`
- **Logic Architect Integration**: Dynamic brainstorming result processing with structured XML tags
- **Context Processing**: Sophisticated user conversation, brand analysis, and file upload handling
- **Component Validation**: Complete schema validation preventing malformed AI outputs

**API Route Transformation** (`/app/api/ai/create-tool/route.ts`):
```typescript
// BEFORE: Mixed prompt content with server logic (200+ lines of inline prompts)
const systemPrompt = `${TOOL_CREATION_PROMPT}...` // + 200 lines of inline XML

// AFTER: Clean separation with builder functions (3 lines)
const systemPrompt = buildCompleteSystemPrompt(logicBrainstorming);
const userPrompt = buildToolCreationUserPrompt(userIntent, context, existingTool, updateType);
```

### **Grid Layout Revolution**
**Problem Solved**: AI was generating "90's web forms" with vertical stacking
**Solution Implemented**: Comprehensive grid-based layout requirements

**Grid Layout Mandates:**
- 🚨 **FORBIDDEN**: Single column vertical stacking, contact form layouts
- ✅ **REQUIRED**: 2-3 column input grids, dashboard-style results, horizontal grouping
- ✅ **HIERARCHY**: container → section → grid organization
- ✅ **EXAMPLES**: ROI calculators with multi-column inputs and results dashboards

**Layout Examples Enforced:**
```xml
<roi-calculator>
    INPUT SECTION (grid: "1fr 1fr"):
    ├── currency-input (Initial Investment)
    └── currency-input (Monthly Revenue)
    
    RESULTS SECTION (grid: "1fr 1fr 1fr"):
    ├── metric-display (ROI Percentage)
    ├── currency-display (Net Profit)  
    └── calculation-display (Payback Period)
</roi-calculator>
```

### **XML Prompt Structuring Benefits**
- **Better AI Processing**: Structured sections improve AI comprehension and compliance
- **Systematic Validation**: XML tags enable better component and layout validation
- **Dynamic Integration**: Clean separation of static rules from dynamic context
- **Maintenance**: Changes to prompt logic happen in one dedicated file
- **Reusability**: Core prompts can be used by multiple agents

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

**Key UI Components:**
- **History Panel**: Sliding panel for viewing and editing previous responses
- **Dynamic Input System**: Context-aware input components (select, multiSelect, colorSelect, etc.)
- **Edit-in-Place Functionality**: Return to original question state for modifications
- **Canvas Tool Preview**: Real-time tool preview with live updates
- **Conversation State Management**: Track and restore editing contexts seamlessly
- **Behavior Dashboard**: Real-time user behavior insights and adaptation recommendations
- **Evolution Timeline**: Visual representation of behavioral changes over time

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
POST /api/ai/test-ui        # Conversation Agent (10-15 seconds) ✅
POST /api/ai/create-tool    # Tool Creation Agent (15-25 seconds) ✅

// Future Specialized Agents:
POST /api/ai/content-crafter    # Content Generation (15-20 seconds) ✅
POST /api/ai/style-master       # Style Customization (15-20 seconds) ✅
POST /api/ai/analytics-processor # Analytics Agent (20-25 seconds) ✅

// Complex Operations (Lambda offload):
Lambda: complex-ai-processor    # Multi-step AI chains (60+ seconds)
Lambda: bulk-content-generator  # Large-scale content generation
Lambda: advanced-analytics      # Deep data analysis and insights
```

**Agent Communication Pattern:**
- **Conversation Agent**: Handles UI flow, signals when specialized work needed
- **Specialized Agents**: Handle specific tasks with proper validation using clean prompt separation
- **Lambda Workers**: Background processing for complex multi-step operations
- **Frontend Integration**: Seamless handoffs between agents with real-time updates

**State Management Between Agent Calls:**
- Client-side state with Zustand for immediate UI updates
- DynamoDB for server-side session persistence and conversation history
- ElastiCache Redis for high-performance caching between agent calls
- SQS for queuing complex operations that require Lambda processing
- Agent-aware conversation history for context continuity across handoffs

**Agent Timeout Thresholds:**
- **Conversation Agent**: 10-15 seconds (single LLM call, streaming response)
- **Tool Creation Agent**: 15-25 seconds (structured output with validation)
- **Content/Style Agents**: 15-20 seconds (focused generation tasks)
- **Analytics Agent**: 20-25 seconds (data processing and insights)
- **Lambda Threshold**: >25 seconds (complex multi-agent workflows)

**Lambda Offload Triggers:**
- Complex multi-step AI chains requiring 3+ specialized agents
- Large-scale content generation (bulk tool creation, template libraries)
- Advanced data analysis requiring cross-user behavioral insights
- Image/video generation and processing workflows
- Complex business logic requiring multiple model calls and validation steps

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
│   │   │   ├── dashboard/            # User dashboard
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
│   │   │   ├── prompts/              # All AI Prompts
│   │   │   │   ├── magic-spark.ts
│   │   │   │   ├── logic-architect.ts
│   │   │   │   ├── content-crafter.ts
│   │   │   │   └── style-master.ts
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
│   │   │   │   ├── user.ts
│   │   │   │   └── database.ts
│   │   │   │
│   │   │   ├── db/                   # Database Layer
│   │   │   │   ├── dynamodb/        # DynamoDB utilities
│   │   │   │   │   ├── client.ts
│   │   │   │   │   ├── users.ts
│   │   │   │   │   ├── product-tools.ts      # Product tools CRUD operations
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

## Core AI Agent Architecture

### Agent Separation Strategy

**Philosophy**: Single responsibility per agent with clean separation of concerns and complete prompt separation. Each agent is optimized for specific tasks with all prompting logic centralized in dedicated files rather than mixed with server code.

**Key Principles**:
- **Complete Prompt Separation**: All AI prompts moved to `/lib/prompts/` with dynamic builder functions
- **XML-Structured Prompts**: Enhanced prompt organization for better AI processing
- **No Over-Engineering**: Removed all algorithmic helper functions and keyword detection
- **AI Intelligence First**: Let AI models make decisions without programmatic intervention
- **Structured Validation**: Use proper schema validation for complex outputs
- **Scalable Pattern**: Easily add new specialized agents following the same pattern
- **Grid Layout Enforcement**: All tools use sophisticated dashboard-style layouts

### Primary Agent Types

#### 1. Conversation Agent (`/api/ai/test-ui/`)
**Purpose**: Handle conversation flow and UI interactions
**Responsibility**: ONLY conversation management and user experience
**Timeout Risk**: Low (single LLM call for conversation)
**Implementation**: Vercel API Route with streaming
**Prompts**: Uses consolidated prompts from `/lib/prompts/conversation-prompt.ts`

```typescript
// Conversation Agent Response Schema
interface ConversationResponse {
  message: string;
  inputType?: string;
  options?: Array<{ value: string; label: string }>;
  shouldCreateTool?: boolean;          // Signal tool creation needed
  toolCreationContext?: {              // Context for tool creation
    userIntent: string;
    targetAudience?: string;
    industry?: string;
    toolType?: string;
    features?: string[];
    businessDescription?: string;
    updateType?: string;
  };
}
```

**Key Features**:
- Natural conversation flow without programmatic logic
- Dynamic question generation based on context
- Signals when tool creation/modification is needed
- Provides rich context for specialized agents
- Handles UI component selection (select, multiSelect, colorSelect, etc.)

#### 2. Tool Creation Agent (`/api/ai/create-tool/`) ✅ FULLY REFACTORED
**Purpose**: Generate and modify ProductToolDefinitions with proper validation
**Responsibility**: ONLY tool architecture and generation with grid-based layouts
**Timeout Risk**: Medium (structured output with validation)
**Implementation**: Vercel API Route with GPT-4o and structured output
**Prompts**: Uses consolidated prompts from `/lib/prompts/tool-creation-prompt.ts`

```typescript
// Clean API Route with Prompt Separation
export async function POST(request: NextRequest) {
  // STEP 1: Logic Architect Brainstorming
  let logicBrainstorming = await getOrCreateBrainstorming(context);
  
  // STEP 2: Get model configuration
  const model = getPrimaryModel('toolCreator');
  
  // STEP 3: Build prompts using consolidated builder functions ✅ NEW
  const systemPrompt = buildCompleteSystemPrompt(logicBrainstorming);
  const userPrompt = buildToolCreationUserPrompt(userIntent, context, existingTool, updateType);
  
  // STEP 4: Generate tool with structured output validation
  const { object: productTool } = await generateObject({
    model: modelInstance,
    schema: productToolDefinitionSchema,  // Full Zod validation
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
    maxRetries: 2
  });
  
  return { success: true, tool: productTool };
}
```

**Key Features**:
- ✅ **Complete Prompt Separation**: Zero inline prompt content in API route
- ✅ **XML-Structured Prompts**: Enhanced prompt organization and AI processing
- ✅ **Grid Layout Enforcement**: Mandatory 2-3 column layouts, dashboard-style results
- ✅ **Dynamic Context Integration**: Logic Architect results, user conversation, brand analysis
- ✅ **Component Validation**: Full schema validation preventing malformed outputs
- ✅ **Professional Quality**: Business-grade styling and realistic calculations

**Grid Layout Achievements**:
- 🚨 **Eliminated**: Vertical form stacking, amateur-looking layouts
- ✅ **Enforced**: Horizontal input grouping, multi-column results dashboards
- ✅ **Mandated**: container → section → grid hierarchy
- ✅ **Implemented**: ROI calculators, assessment tools with sophisticated layouts

#### 3. Future Specialized Agents (Following Same Pattern)

**Content Generation Agent** (`/api/ai/content-crafter/`):
- **Purpose**: Generate marketing copy, descriptions, and user-facing content
- **Signals**: `shouldGenerateContent: true` from conversation agent
- **Output**: Structured content objects with validation
- **Prompts**: Centralized in `/lib/prompts/content-crafter-prompt.ts`

**Style Customization Agent** (`/api/ai/style-master/`):
- **Purpose**: Advanced styling, theming, and brand customization
- **Signals**: `shouldCustomizeStyle: true` from conversation agent
- **Output**: Complete styling configurations with color theory
- **Prompts**: Centralized in `/lib/prompts/style-master-prompt.ts`

**Analytics Agent** (`/api/ai/analytics-processor/`):
- **Purpose**: Data analysis, insights, and performance recommendations
- **Signals**: `shouldAnalyzeData: true` from conversation agent
- **Output**: Actionable insights and optimization suggestions
- **Prompts**: Centralized in `/lib/prompts/analytics-prompt.ts`

### Agent Communication Flow

```typescript
// 1. User Input → Conversation Agent (using centralized prompts)
const conversationResult = await fetch('/api/ai/test-ui', {
  method: 'POST',
  body: JSON.stringify({ userInput: "create an ROI calculator" })
});

// 2. Conversation Agent Response
{
  message: "I'll create an ROI calculator for you...",
  shouldCreateTool: true,
  toolCreationContext: {
    userIntent: "create an ROI calculator",
    toolType: "calculator",
    targetAudience: "business professionals"
  }
}

// 3. Frontend Detects Signal → Calls Tool Creation Agent (with separated prompts)
const toolResult = await fetch('/api/ai/create-tool', {
  method: 'POST',
  body: JSON.stringify({
    userIntent: toolCreationContext.userIntent,
    context: toolCreationContext
  })
});

// 4. Tool Creation Agent Response (using buildCompleteSystemPrompt())
{
  success: true,
  tool: { /* Complete ProductToolDefinition with grid layouts */ },
  validationPassed: true
}

// 5. Frontend Updates Canvas in Real-Time
setProductToolDefinition(toolResult.tool);
```

### Benefits of Agent Separation with Prompt Consolidation

**Complete Prompt Separation**:
- ✅ **Maintainability**: All prompt changes happen in dedicated files
- ✅ **Reusability**: Core prompts can be used by multiple agents
- ✅ **Testing**: Prompt logic can be unit tested independently
- ✅ **Versioning**: Easy to track prompt evolution and A/B test
- ✅ **Clean Code**: API routes focus purely on request handling

**XML-Structured Prompts**:
- ✅ **Better AI Processing**: Structured sections improve AI comprehension
- ✅ **Systematic Validation**: XML tags enable better compliance checking
- ✅ **Dynamic Integration**: Clean separation of static rules from dynamic context
- ✅ **Component Validation**: Enhanced validation with structured error handling

**Grid Layout Revolution**:
- ✅ **Professional Tools**: Eliminated outdated vertical form stacking
- ✅ **Modern Layouts**: Dashboard-style organization with multi-column sections
- ✅ **Space Efficiency**: Horizontal grouping maximizes screen real estate
- ✅ **User Experience**: Sophisticated, business-grade tool presentation

**Single Responsibility**:
- Each agent optimized for specific tasks
- Easier debugging and maintenance
- Clear error boundaries and handling

**Structured Output with Validation**:
- Tool Creation Agent uses Zod schemas for validation
- Prevents malformed or incomplete tool definitions
- Type-safe outputs with proper error handling

**Scalable Architecture**:
- Easy to add new specialized agents
- Consistent patterns across all agents
- Independent deployment and optimization

**AI Intelligence Without Over-Engineering**:
- No keyword detection or algorithmic helpers
- AI models make all intelligence decisions
- Clean separation between AI logic and business logic

**Enhanced User Experience**:
- Real-time tool updates on canvas
- Seamless handoffs between agents
- Proper error handling and user feedback

### Agent Timeout Management

**Conversation Agent** (10-15 seconds):
- Single LLM call for conversation
- Streaming responses for immediate feedback
- Lightweight processing for UI decisions

**Tool Creation Agent** (15-25 seconds):
- Structured output generation with validation
- Complex tool architecture decisions using consolidated prompts
- Comprehensive schema validation with grid layout enforcement

**Future Complex Agents** (25+ seconds):
- Lambda offload for operations exceeding Vercel limits
- SQS queuing for background processing
- WebSocket updates for long-running operations

### Development Pattern for New Agents

```typescript
// 1. Create Dedicated Prompt File ✅ NEW PATTERN
// /lib/prompts/new-agent-prompt.ts
export const NEW_AGENT_PROMPT = `
<purpose>
  You are a specialized [AgentType] AI. Your ONLY job is to [specific responsibility].
</purpose>

<instructions>
  [XML-structured instructions]
</instructions>
`;

export function buildNewAgentSystemPrompt(context?: any): string {
  return `${NEW_AGENT_PROMPT}\n\n${buildContextSection(context)}`;
}

// 2. Define Agent Schema
const agentOutputSchema = z.object({
  // Define expected output structure
});

// 3. Implement Clean API Route
export async function POST(request: NextRequest) {
  // Validate input
  // Build prompts using centralized functions ✅
  const systemPrompt = buildNewAgentSystemPrompt(context);
  
  // Call AI model with structured output
  // Return validated result
}

// 4. Add Signal Detection to Conversation Agent
// shouldCallNewAgent: true
// newAgentContext: { /* context for specialized agent */ }

// 5. Update Frontend to Handle New Agent
// Detect signal and call specialized agent
// Update UI based on agent response
```

This architecture ensures each agent excels at its specific responsibility while maintaining clean separation of concerns, complete prompt separation, and optimal user experience with sophisticated grid-based tool generation.

### User Behavior Learning System

**Comprehensive Behavioral Intelligence:**
The platform includes a sophisticated user behavior learning system that tracks interactions, analyzes patterns, and adapts AI responses for personalized experiences.

**Key Features:**
- **Real-time Interaction Tracking**: Response times, input preferences, editing patterns, workflow choices
- **Evolution Detection**: Automatic detection of behavioral changes over time (becoming expert vs beginner)
- **Analysis History**: Versioned analysis storage with cross-comparison capabilities
- **Adaptive AI Responses**: Dynamic question complexity, input type selection, and suggestion customization
- **Admin Dashboard Integration**: Centralized behavior insights in admin interface

**Integration with Agent Architecture:**
- **Conversation Agent Adaptation**: Behavioral data influences question complexity and input type selection
- **Specialized Agent Optimization**: User patterns inform which agents to use for specific tasks
- **Cross-Agent Learning**: Behavioral insights shared across all specialized agents
- **Real-time Personalization**: Adaptive responses based on user evolution and preferences

**Data Architecture:**
```typescript
interface UserInteraction {
  id: string;
  userId: string;
  interactionType: 'question_response' | 'edit_previous' | 'workflow_choice' | 'agent_handoff';
  questionType: string; // 'select', 'multiSelect', 'colorSelect', etc.
  agentType?: string;   // Which agent handled the interaction
  responseTime: number; // milliseconds
  usedSuggestions: boolean;
  usedCustomInput: boolean;
  confidence: number;   // 0-1 based on response behavior
}

interface BehaviorEvolution {
  responseSpeedTrend: 'faster' | 'slower' | 'stable';
  explorationTrend: 'more_experimental' | 'more_conservative' | 'stable';
  overallTrend: 'becoming_expert' | 'becoming_beginner' | 'stable' | 'inconsistent';
  changeIntensity: Record<string, number>; // 0-1 magnitude of changes
  agentPreferences: Record<string, number>; // Preference for specific agents
}

interface UserProfile {
  preferredInputTypes: string[]; // Ranked by frequency
  averageResponseTime: number;
  explorationTendency: number; // 0-1 conservative to experimental
  suggestedWorkflow: 'guided' | 'flexible' | 'expert';
  preferredAgents: string[];   // Ranked by success rate
  evolutionHistory: UserEvolution[];
  confidenceScore: number; // Profile reliability 0-1
}
```

**Storage Strategy:**
- **Development**: localStorage with rolling buffers (last 100 interactions, 50 analyses)
- **Production**: Dedicated DynamoDB table with 90-day TTL for interactions
- **Analytics**: Real-time insights through admin dashboard with agent performance correlation
- **Privacy**: User-controlled data retention and export capabilities

### History Panel & Edit Functionality

**Advanced User Experience Features:**
- **Sliding History Panel**: Configurable left/right positioning with smooth animations
- **Edit-in-Place**: Click any previous answer to return to original question component
- **Question State Restoration**: Preserves component type (select, colorSelect, multiSelect, etc.)
- **Visual Feedback**: Floating overlay indicators during edit mode
- **Conversation Tracking**: Comprehensive state management for seamless editing flow
- **Agent-Aware Editing**: Tracks which agent generated each question for proper restoration

**Key Components:**
```typescript
// History Panel with edit capabilities
interface InputHistoryProps {
  isOpen: boolean;
  side: 'left' | 'right';
  answers: Record<string, string>;
  questionHistory: Array<QuestionDefinition>;
  onAnswerUpdate: (questionId: string, newValue: string) => void;
}

// Dynamic question tracking for AI and mock workflows
interface QuestionDefinition {
  id: string;
  message: string;
  inputType: 'select' | 'multiSelect' | 'colorSelect' | 'text' | 'textarea' | 'yesNoMaybe';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  allowCustom?: boolean;
  maxSelections?: number;
  agentSource?: string; // Which agent generated this question
}
```

**Universal Edit System:**
- Works with questions generated by any agent (conversation, tool creation, etc.)
- Dynamic question history tracking for all question sources
- Preserves component state and pre-populates values
- Seamless integration with conversation flow management
- Agent-aware restoration for complex multi-agent workflows

## Database Architecture Design

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

**Question History Integration:**
- **Real-time Tracking**: All questions (mock and AI) stored for editing
- **Type Icon System**: Visual indicators for different input types (Palette, Type, List, etc.)
- **Compact Display**: Truncated question text with expandable details
- **Edit Button Visibility**: Hover-only edit controls for clean interface

### Single-Database Strategy with DynamoDB

**DynamoDB (Primary Database):**
- ALL application data using single-table design
- Users, tools, leads, analytics, AI sessions, conversations, metrics, alerts
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
- Rate limiting counters and temporary computation results
- Cache invalidation strategies for data consistency

**SQS (Background Processing):**
- Queue long-running AI operations that exceed Vercel timeouts
- Background behavior analysis and pattern detection
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
  entityType: string;   // 'USER' | 'TOOL' | 'SESSION' | 'LEAD' | 'INTERACTION' | 'METRIC' | 'ALERT'
  createdAt: number;    // Unix timestamp
  updatedAt: number;    // Unix timestamp
  ttl?: number;         // Auto-expire for temporary data
  metadata: Record<string, any>; // Extensible metadata
  version: number;      // For optimistic locking
  [key: string]: any;   // Entity-specific fields
}

// User entity
interface UserItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: 'PROFILE';
  GSI1PK: `EMAIL#${string}`;      // For email lookups
  GSI1SK: 'USER';
  entityType: 'USER';
  clerkId: string;
  email: string;
  subscriptionTier: string;
  preferences: {
    defaultModels: Record<string, string>;
    debugMode: boolean;
    notifications: boolean;
  };
  // ... other user fields
}

// Tool entity
interface ToolItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: `TOOL#${string}`;           // TOOL#{toolId}
  GSI1PK: `TOOL#${string}`;       // For tool-specific queries
  GSI1SK: `STATUS#${string}`;     // For filtering by status
  GSI2PK: `TYPE#${string}`;       // For filtering by tool type
  GSI2SK: `CREATED#${number}`;    // For sorting by creation date
  entityType: 'TOOL';
  toolId: string;
  userId: string;
  name: string;
  type: 'calculator' | 'quiz' | 'assessment';
  status: 'draft' | 'published' | 'archived';
  configuration: any;
  styling: any;
  analytics: {
    totalViews: number;
    totalCompletions: number;
    totalLeads: number;
    conversionRate: number;
    lastActivity: number;
  };
  // ... other tool fields
}

// AI Session entity
interface AISessionItem extends KeyvexTableItem {
  PK: `SESSION#${string}`;        // SESSION#{sessionId}
  SK: 'METADATA';
  GSI1PK: `USER#${string}`;       // For user's sessions
  GSI1SK: `SESSION#${number}`;    // Sorted by creation time
  entityType: 'SESSION';
  sessionId: string;
  userId: string;
  toolId?: string;
  currentStep: string;
  status: 'active' | 'completed' | 'abandoned';
  sessionData: {
    currentAgent: string;
    progress: number;
    totalSteps: number;
    modelUsage: Record<string, number>;
    totalCost: number;
  };
  // ... other session fields
}

// Conversation Message entity
interface ConversationMessageItem extends KeyvexTableItem {
  PK: `SESSION#${string}`;        // SESSION#{sessionId}
  SK: `MESSAGE#${number}#${string}`; // MESSAGE#{timestamp}#{messageId}
  entityType: 'MESSAGE';
  sessionId: string;
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agent?: string;
  modelUsed?: string;
  tokenCount?: number;
  cost?: number;
  // ... other message fields
}

// Lead entity
interface LeadItem extends KeyvexTableItem {
  PK: `TOOL#${string}`;           // TOOL#{toolId}
  SK: `LEAD#${string}`;           // LEAD#{leadId}
  GSI1PK: `EMAIL#${string}`;      // For email lookups
  GSI1SK: `LEAD#${number}`;       // Sorted by creation time
  entityType: 'LEAD';
  leadId: string;
  toolId: string;
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  responses: any;
  score?: number;
  resultCategory?: string;
  source: {
    referrer?: string;
    utm?: Record<string, string>;
    userAgent?: string;
  };
  // ... other lead fields
}

// Tool Interaction entity (for analytics)
interface ToolInteractionItem extends KeyvexTableItem {
  PK: `TOOL#${string}`;           // TOOL#{toolId}
  SK: `INTERACTION#${number}#${string}`; // INTERACTION#{timestamp}#{interactionId}
  GSI1PK: `ANALYTICS#${string}`;  // For analytics queries
  GSI1SK: `${string}#${number}`;  // {interactionType}#{timestamp}
  entityType: 'INTERACTION';
  toolId: string;
  interactionId: string;
  sessionId?: string;
  interactionType: 'view' | 'start' | 'complete' | 'abandon' | 'lead_capture' | 'share';
  interactionData?: {
    stepCompleted?: number;
    totalSteps?: number;
    timeSpent?: number;
    userAgent?: string;
    referrer?: string;
  };
  // ... other interaction fields
}

// AI Metrics entity (for admin dashboard)
interface AIMetricItem extends KeyvexTableItem {
  PK: `METRIC#${string}`;         // METRIC#{date}
  SK: `REQUEST#${number}#${string}`; // REQUEST#{timestamp}#{requestId}
  GSI1PK: `PROCESS#${string}`;    // For process-specific queries
  GSI1SK: `${number}`;            // Timestamp for sorting
  GSI2PK: `PROVIDER#${string}`;   // For provider-specific queries
  GSI2SK: `${number}`;            // Timestamp for sorting
  entityType: 'METRIC';
  requestId: string;
  userId: string;
  process: string;                // magicSpark, logicArchitect, etc.
  provider: string;               // openai, anthropic
  model: string;                  // gpt-4, claude-3-5-sonnet, etc.
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latency: number;
  success: boolean;
  error?: string;
  timestamp: number;
  ttl: number;                    // Auto-expire after 30 days
}

// Alert entity (for admin dashboard)
interface AlertItem extends KeyvexTableItem {
  PK: `ALERT#${string}`;          // ALERT#{alertId}
  SK: 'ALERT';
  GSI1PK: `ALERT_TYPE#${string}`; // For type-specific queries
  GSI1SK: `${string}#${number}`;  // {severity}#{timestamp}
  entityType: 'ALERT';
  alertId: string;
  type: 'cost' | 'performance' | 'error';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  data?: Record<string, any>;     // Alert-specific data
  ttl: number;                    // Auto-expire after 90 days
}

// WebSocket Connection entity
interface WebSocketConnectionItem extends KeyvexTableItem {
  PK: `CONNECTION#${string}`;     // CONNECTION#{connectionId}
  SK: 'METADATA';
  GSI1PK: `USER#${string}`;       // For user's connections
  GSI1SK: `CONNECTION#${number}`; // Sorted by connection time
  entityType: 'CONNECTION';
  connectionId: string;
  userId: string;
  sessionId?: string;
  connectedAt: number;
  lastActivity: number;
  ttl: number; // Auto-cleanup stale connections
}

// Model Configuration entity (for centralized config)
interface ModelConfigItem extends KeyvexTableItem {
  PK: 'CONFIG';
  SK: `MODEL_CONFIG#${string}`;   // MODEL_CONFIG#{version}
  entityType: 'CONFIG';
  version: string;
  isActive: boolean;
  configuration: {
    providers: Record<string, any>;
    processModels: Record<string, any>;
    environment: Record<string, any>;
    features: Record<string, boolean>;
    rateLimits: Record<string, any>;
  };
  updatedBy: string;
  changeLog: string;
}
```

### Query Patterns and GSI Usage

**GSI1 (GSI1PK, GSI1SK):**
- User's tools: `GSI1PK = USER#{clerkId}`, `SK begins_with TOOL#`
- User's sessions: `GSI1PK = USER#{clerkId}`, `SK begins_with SESSION#`
- Email lookups: `GSI1PK = EMAIL#{email}`
- Tool analytics: `GSI1PK = ANALYTICS#{toolId}`
- Process metrics: `GSI1PK = PROCESS#{processName}`
- Alert types: `GSI1PK = ALERT_TYPE#{type}`

**GSI2 (GSI2PK, GSI2SK):**
- Tools by type: `GSI2PK = TYPE#{toolType}`
- Tools by creation date: Sort by `GSI2SK = CREATED#{timestamp}`
- Published tools: `GSI2PK = STATUS#published`
- Provider metrics: `GSI2PK = PROVIDER#{providerName}`

## Centralized AI Model Configuration

### Model Configuration System
- **Central Configuration**: `default-models.json` with all model definitions
- **Provider Abstraction**: Unified interface for OpenAI, Anthropic, and future providers
- **Process-Specific Models**: Optimized model selection per AI process
- **Cost Tracking**: Automatic cost calculation with real pricing
- **Fallback Support**: Automatic failover to secondary models
- **Environment Overrides**: Different models for dev/staging/production

### Key Features
- **Real-time Cost Monitoring**: Track spending across all AI operations
- **Performance Analytics**: Monitor latency, success rates, and throughput
- **Model Optimization**: Data-driven model selection based on performance
- **Budget Controls**: Automatic alerts and limits for cost management

## Admin Dashboard & Monitoring

### Comprehensive Monitoring System
- **Cost Analysis**: Real-time spending tracking across models and processes
- **Usage Metrics**: Request volumes, success rates, and usage patterns
- **Performance Monitoring**: Latency analysis, error tracking, and throughput
- **Alert System**: Proactive notifications for cost, performance, and errors
- **User Behavior Analytics**: Comprehensive behavioral insights and evolution tracking

### Key Components
- **Real-time Dashboard**: Auto-refreshing metrics with visual charts
- **Test Data Generation**: Sample data for development and testing
- **Metrics API**: RESTful endpoints for tracking and querying metrics
- **Automatic Tracking**: Seamless integration with all AI operations
- **Behavior Intelligence Dashboard**: Real-time user behavior insights with evolution timeline
- **Cross-User Analytics**: Aggregate behavior patterns across user base
- **Adaptive AI Recommendations**: Data-driven suggestions for improving AI interactions

### Behavior Analytics Features
- **Profile Confidence Scoring**: Track reliability of behavioral predictions
- **Evolution Detection**: Identify when users transition between skill levels
- **Pattern Recognition**: Discover common interaction sequences and preferences
- **Personalization Metrics**: Measure effectiveness of adaptive AI responses
- **Export Capabilities**: Download behavioral data for external analysis

## Authentication & Debug System

### Centralized Authentication
- **Production**: Full Clerk authentication with proper security
- **Development**: Optional debug mode with configurable test users
- **Environment-Based**: Automatic detection of debug vs production modes
- **Centralized Logging**: Comprehensive debug logging across all routes

### Debug Features
- **Bypass Authentication**: For development and testing
- **Debug Logging**: Detailed operation tracking
- **Test User Management**: Configurable debug user IDs
- **Route-Specific Control**: Enable/disable debug mode per route

## Development & Deployment Phases

### Phase 1: Foundation & AI Core (Weeks 1-3) ✅ COMPLETED
**Infrastructure Setup:**
- ✅ Set up AWS CDK infrastructure (DynamoDB, ElastiCache, SQS)
- ✅ Deploy User Behavior DynamoDB stack with proper TTL configuration
- ✅ Configure Vercel deployment with environment variables
- ✅ Set up Clerk authentication with debug system
- ✅ Create centralized model configuration system

**Core AI Development:**
- ✅ Implement Conversation Agent (`/api/ai/test-ui/`) with streaming
- ✅ Implement Tool Creation Agent (`/api/ai/create-tool/`) with structured output validation
- ✅ Create agent separation architecture with signal-based communication
- ✅ Build dynamic input component system with editing functionality
- ✅ Implement real-time tool creation and preview canvas
- ✅ Initialize User Behavior Learning System with localStorage

**Agent Architecture Achievements:**
- ✅ **Single Responsibility**: Each agent handles only its specific domain
- ✅ **Structured Validation**: Tool Creation Agent uses full Zod schema validation
- ✅ **Signal-Based Communication**: Conversation Agent signals when specialized work needed
- ✅ **Real-time Updates**: Frontend seamlessly handles agent handoffs and canvas updates
- ✅ **Scalable Pattern**: Established pattern for future specialized agents

**✅ MAJOR MILESTONE: Complete Prompt Separation & XML Structuring (January 2025)**
- ✅ **Consolidated All Prompts**: Moved all AI prompts from API routes to dedicated `/lib/prompts/` files
- ✅ **XML-Structured Prompts**: Enhanced prompts with structured XML format for better AI processing
- ✅ **Dynamic Prompt Builders**: Created sophisticated builder functions for contextual prompt generation
- ✅ **Clean API Separation**: API routes now focus purely on request handling with zero inline content
- ✅ **Grid Layout Revolution**: Eliminated vertical form stacking, enforced dashboard-style layouts
- ✅ **Enhanced Component Validation**: Improved schema validation with structured error handling

**Testing Infrastructure:**
- ✅ Set up admin dashboard with basic monitoring
- ✅ Create comprehensive test UI with mock and real AI modes
- ✅ Implement debug logging and error tracking
- ✅ Test agent separation with real tool generation workflows
- ✅ Validate grid layout enforcement and professional tool generation

### Phase 2: User Experience & Refinement (Weeks 4-6)
**Enhanced User Experience:**
- Complete conversation history panel with edit-in-place functionality
- Implement multi-part question iterator component
- Add real-time tool preview updates
- Complete adaptive color picker and custom color management
- Enhance User Behavior Learning with evolution tracking

**AI Agent Development:**
- Develop Content Crafter and Logic Architect agents
- Implement conversation state management
- Add brand intelligence and visual analysis capabilities
- Complete Style Master agent with comprehensive styling

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

**Advanced Features:**
- Launch webhook system for third-party integrations
- Complete lead capture and management system
- Add advanced analytics with cross-user behavior insights
- Implement tool sharing and collaboration features
- Deploy behavior-driven AI personalization

**Quality Assurance:**
- Comprehensive testing across all user flows
- Performance optimization and load testing
- Security audit and penetration testing
- User acceptance testing with behavior tracking validation

## Key Technical Decisions

### 1. Hybrid Architecture Strategy
**Decision**: Vercel-first with AWS backend for complex operations
**Rationale**: Maximizes developer experience while solving timeout limitations
**Implementation**: AI orchestration on Vercel, complex processing on Lambda

### 2. Single-Table DynamoDB Design
**Decision**: Use single-table design for main application data, separate table for behavior tracking
**Rationale**: Optimal performance and cost efficiency with specialized analytics
**Implementation**: Careful entity design with proper GSI patterns for behavior queries

### 3. User Behavior Learning Architecture
**Decision**: Comprehensive behavior tracking with evolution detection and adaptive AI responses
**Rationale**: Personalized user experiences improve engagement and tool creation success
**Implementation**: 
- Development: localStorage with rolling buffers for rapid iteration
- Production: Dedicated DynamoDB table with TTL and privacy controls
- Analytics: Real-time admin dashboard with cross-user insights
- Adaptation: Dynamic AI responses based on behavioral patterns

### 4. Agent Separation with Signal-Based Communication
**Decision**: Specialized agents with single responsibilities instead of monolithic AI system
**Rationale**: Better maintainability, structured validation, and optimal user experience
**Implementation**: 
- Conversation Agent handles UI flow and signals when specialized work needed
- Tool Creation Agent uses structured output with complete schema validation
- Frontend seamlessly handles agent handoffs with real-time canvas updates
- Scalable pattern for future specialized agents (content, style, analytics)

### 5. Structured Output with Schema Validation
**Decision**: Use Zod schemas and structured output for complex AI generation tasks
**Rationale**: Prevents malformed outputs, ensures type safety, and enables better error handling
**Implementation**: Tool Creation Agent generates validated ProductToolDefinitions using Vercel AI SDK's generateObject with comprehensive schemas

### 6. Component-Based Dynamic UI
**Decision**: Context-aware input components with edit-in-place functionality  
**Rationale**: Flexible conversation flows with seamless editing experience
**Implementation**: Type-safe component routing with state restoration

### 7. Comprehensive Monitoring Strategy
**Decision**: Multi-layered monitoring with behavior analytics integration
**Rationale**: Proactive issue detection and continuous user experience optimization
**Implementation**: 
- Cost tracking across all AI operations
- Performance monitoring with behavioral correlation
- User behavior evolution tracking with trend analysis
- Adaptive recommendation system based on behavioral patterns

## Monitoring & Observability

### CloudWatch Integration
- **Application Metrics**: Request rates, error rates, latency percentiles
- **AI Model Metrics**: Token usage, completion rates, model performance
- **Database Metrics**: DynamoDB read/write capacity, query performance
- **Behavior Analytics**: Interaction patterns, user evolution trends, adaptation effectiveness
- **Custom Dashboards**: Real-time monitoring with behavioral insights

### Alerting Strategy
- **Cost Alerts**: Spending thresholds with model-specific breakdowns
- **Performance Alerts**: Latency spikes, error rate increases
- **Business Metrics**: User drop-off points, tool completion rates
- **Behavior Anomalies**: Unusual interaction patterns, evolution trend alerts
- **AI Quality**: Response quality degradation, adaptation effectiveness

### User Experience Monitoring
- **Real User Monitoring (RUM)**: Frontend performance tracking
- **Conversion Funnel**: Tool creation completion rates with behavioral correlation
- **Error Tracking**: Frontend errors with user context and behavior patterns
- **Feature Usage**: Component utilization with user preference analysis
- **Behavioral Health**: Profile confidence scores, evolution detection accuracy

### Admin Dashboard Features
- **Real-time Metrics**: Live updating charts and graphs
- **Cost Analysis**: Detailed spending breakdown by model and operation
- **User Analytics**: Registration, usage patterns, and tool creation metrics
- **Behavior Intelligence**: User evolution timelines, adaptation success rates
- **Alert Management**: Configure thresholds and notification channels
- **Data Export**: Download metrics and behavioral data for external analysis

### Debug & Development
- **Comprehensive Logging**: Structured logging with correlation IDs
- **Request Tracing**: Full request lifecycle with behavioral context
- **Performance Profiling**: Identify bottlenecks with user behavior correlation
- **AI Operation Debugging**: Detailed AI request/response logging with behavioral adaptation tracking

## Risk Mitigation

### Technical Risks
1. **Vercel Timeouts**: Granular architecture + Lambda offload
2. **AI Reliability**: Multiple providers + retry logic + centralized config
3. **Cost Control**: Real-time monitoring + automated alerts + budget limits
4. **Performance**: Caching + optimization + comprehensive monitoring

### Business Risks
1. **User Adoption**: Comprehensive onboarding + templates
2. **Churn**: Analytics to identify drop-off points
3. **Competition**: Focus on unique AI co-creation experience
4. **Scalability**: Cloud-native architecture from day one

## Success Metrics

### Technical KPIs
- AI operation success rate (>95%)
- Average response time (<3 seconds for streaming start)
- System uptime (>99.9%)
- Error rate (<1%)
- Cost per successful operation (<$0.50)

### Business KPIs
- Trial to paid conversion (target: >15%)
- Monthly active users growth
- Tools created per user (target: >3)
- Lead capture rate for user tools (target: >25%)

## AWS Infrastructure Deployment

### Multi-Environment Strategy

The Keyvex project uses a multi-environment deployment strategy with complete resource isolation:

#### Development Environment
```bash
# Deploy development stacks
npm run deploy-dev
# Equivalent to: cdk deploy --all --context environment=development
```

**Creates resources with `-development` suffix:**
- Stack Names: `Keyvex-development-Security`, `Keyvex-development-Database`, etc.
- Resource Names: `keyvex-main-table-development`, `keyvex-ai-processor-development`

#### Production Environment
```bash
# Deploy production stacks
npm run deploy-prod
# Equivalent to: cdk deploy --all --context environment=production
```

**Creates resources with `-production` suffix:**
- Stack Names: `Keyvex-production-Security`, `Keyvex-production-Database`, etc.
- Resource Names: `keyvex-main-table-production`, `keyvex-ai-processor-production`

### Deployed AWS Resources (Development)

**Core Infrastructure:**
- **DynamoDB Table**: `keyvex-main-table-development` with GSI1 and GSI2
- **Lambda Functions**: AI processor, analytics processor, websocket handler, email processor
- **API Endpoints**: 
  - REST API: `https://y4omo4wsug.execute-api.us-east-1.amazonaws.com/prod/`
  - WebSocket: `wss://4pfmheijde.execute-api.us-east-1.amazonaws.com`
- **CloudWatch Dashboard**: `keyvex-dashboard-development`
- **S3 Buckets**: Public assets, tool assets, user uploads
- **CloudFront**: Asset delivery distribution

**Security & Secrets:**
- **Secrets Manager**: AI, integration, and database secrets
- **IAM Roles**: Least-privilege access for all services
- **SNS Alerts**: Email notifications for monitoring

## Environment Variables Configuration

### Development Environment Variables

For Vercel development/preview deployments, use these environment variables:

```bash
# AWS Configuration
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=keyvex-main-table-development

# SQS Queue URLs
SQS_AI_PROCESSING_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/622703699030/keyvex-ai-processing-queue-development
SQS_ANALYTICS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/622703699030/keyvex-analytics-queue-development
SQS_EMAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/622703699030/keyvex-email-queue-development

# API Gateway Endpoints
WEBSOCKET_API_ENDPOINT=wss://4pfmheijde.execute-api.us-east-1.amazonaws.com
REST_API_ENDPOINT=https://y4omo4wsug.execute-api.us-east-1.amazonaws.com/prod/

# Secrets Manager ARNs
AI_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:622703699030:secret:keyvex/ai/development-ZSw7gi
INTEGRATION_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:622703699030:secret:keyvex/integrations/development-J6TbaU
DATABASE_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:622703699030:secret:keyvex/database/development-Rz5198

# CloudFront Distribution
CLOUDFRONT_DOMAIN=d252oh2pudf1vi.cloudfront.net

# S3 Buckets
S3_PUBLIC_ASSETS_BUCKET=keyvex-public-assets-development-622703699030
S3_TOOL_ASSETS_BUCKET=keyvex-tool-assets-development-622703699030
S3_USER_UPLOADS_BUCKET=keyvex-user-uploads-development-622703699030

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

### Production Environment Variables

For Vercel production deployments, use these environment variables (after deploying production stacks):

```bash
# AWS Configuration
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=keyvex-main-table-production

# SQS Queue URLs
SQS_AI_PROCESSING_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/622703699030/keyvex-ai-processing-queue-production
SQS_ANALYTICS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/622703699030/keyvex-analytics-queue-production
SQS_EMAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/622703699030/keyvex-email-queue-production

# API Gateway Endpoints (will be different URLs)
WEBSOCKET_API_ENDPOINT=wss://[production-api-id].execute-api.us-east-1.amazonaws.com
REST_API_ENDPOINT=https://[production-api-id].execute-api.us-east-1.amazonaws.com/prod/

# Secrets Manager ARNs
AI_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:622703699030:secret:keyvex/ai/production-[suffix]
INTEGRATION_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:622703699030:secret:keyvex/integrations/production-[suffix]
DATABASE_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:622703699030:secret:keyvex/database/production-[suffix]

# CloudFront Distribution (will be different)
CLOUDFRONT_DOMAIN=[production-cloudfront-domain].cloudfront.net

# S3 Buckets
S3_PUBLIC_ASSETS_BUCKET=keyvex-public-assets-production-622703699030
S3_TOOL_ASSETS_BUCKET=keyvex-tool-assets-production-622703699030
S3_USER_UPLOADS_BUCKET=keyvex-user-uploads-production-622703699030

# Production Variables (use production keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
UNSPLASH_ACCESS_KEY=...

# Debug Configuration (production - disabled)
DISABLE_AUTH_FOR_DEBUG=false
ENABLE_METRICS_TRACKING=true
```

### Secrets Manager Configuration

Each environment requires these secrets to be configured in AWS Secrets Manager:

#### AI Secrets (`keyvex/ai/{environment}`)
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

#### Integration Secrets (`keyvex/integrations/{environment}`)
```json
{
  "unsplash": {
    "accessKey": "...",
    "secretKey": "..."
  },
  "sendgrid": {
    "apiKey": "SG...",
    "fromEmail": "noreply@keyvex.com"
  },
  "stripe": {
    "secretKey": "sk_test_... or sk_live_...",
    "publishableKey": "pk_test_... or pk_live_...",
    "webhookSecret": "whsec_..."
  }
}
```

#### Database Secrets (`keyvex/database/{environment}`)
```json
{
  "encryptionKey": "base64-encoded-key-for-sensitive-data",
  "jwtSecret": "your-jwt-secret-for-tokens"
}
```

### Deployment Protocol

1. **Development Deployment**:
   ```bash
   cd aws_infra
   npm run deploy-dev
   ```

2. **Configure Development Secrets** in AWS Secrets Manager

3. **Set Vercel Development Environment Variables** with `-development` suffixed resources

4. **Production Deployment**:
   ```bash
   cd aws_infra
   npm run deploy-prod
   ```

5. **Configure Production Secrets** in AWS Secrets Manager

6. **Set Vercel Production Environment Variables** with `-production` suffixed resources

## Conclusion

This technical outline provides a comprehensive roadmap for building Keyvex with the new specialized agent architecture. The system prioritizes AI intelligence over algorithmic complexity, ensuring each agent excels at its specific responsibility while maintaining clean separation of concerns and optimal user experience.

**Key Architectural Achievements:**
- **Agent Separation**: Conversation and Tool Creation agents with single responsibilities
- **Structured Validation**: Full schema validation for complex AI outputs
- **Real-time Experience**: Seamless agent handoffs with immediate canvas updates
- **Scalable Pattern**: Established foundation for future specialized agents
- **User Intelligence**: Comprehensive behavior learning integrated across all agents

The platform is built to scale efficiently while solving Vercel timeout challenges through intelligent agent design rather than infrastructure complexity.

## User Behavior Tracking Schema Reference

```typescript
// User Behavior Tracking Table Schema (Separate DynamoDB Table)
interface UserBehaviorTableItem {
  PK: string;           // USER#{userId} | ANALYSIS#{analysisId} | INTERACTION#{interactionType}
  SK: string;           // PROFILE#CURRENT | INTERACTION#{timestamp}#{id} | ANALYSIS#{timestamp}#{id}
  GSI1PK?: string;      // INTERACTION#{interactionType} | ANALYSIS#{version}
  GSI1SK?: string;      // {timestamp} for time-based queries
  entityType: 'USER_PROFILE' | 'USER_INTERACTION' | 'BEHAVIOR_ANALYSIS' | 'USER_EVOLUTION';
  createdAt: number;    // Unix timestamp
  updatedAt: number;    // Unix timestamp
  ttl?: number;         // Auto-expire for interaction data (90 days)
  userId: string;       // User identifier
  version: string;      // Analysis algorithm version
  agentType?: string;   // Which agent handled the interaction
  [key: string]: any;   // Entity-specific fields
}

// User Behavior Profile
interface UserBehaviorProfileItem extends UserBehaviorTableItem {
  PK: `USER#${string}`;           // USER#{userId}
  SK: 'PROFILE#CURRENT';
  entityType: 'USER_PROFILE';
  totalInteractions: number;
  preferredInputTypes: string[];
  averageResponseTime: number;
  explorationTendency: number;    // 0-1 conservative to experimental
  suggestedWorkflow: 'guided' | 'flexible' | 'expert';
  preferredAgents: string[];      // Ranked by success rate
  evolutionHistory: any[];        // Array of evolution records
  confidenceScore: number;        // Profile reliability 0-1
}

// User Interaction Record (with Agent Tracking)
interface UserInteractionItem extends UserBehaviorTableItem {
  PK: `USER#${string}`;           // USER#{userId}
  SK: `INTERACTION#${number}#${string}`; // INTERACTION#{timestamp}#{interactionId}
  GSI1PK: `INTERACTION#${string}`; // INTERACTION#{interactionType}
  GSI1SK: number;                 // timestamp for sorting
  entityType: 'USER_INTERACTION';
  interactionId: string;
  sessionId: string;
  interactionType: 'question_response' | 'edit_previous' | 'workflow_choice' | 'agent_handoff';
  questionType: string;           // 'select', 'multiSelect', 'colorSelect', etc.
  agentType: string;              // 'conversation' | 'tool_creation' | 'content_generation' | etc.
  responseTime: number;           // milliseconds
  usedSuggestions: boolean;
  usedCustomInput: boolean;
  confidence: number;             // 0-1 based on response behavior
  agentSuccess: boolean;          // Whether the agent interaction was successful
  ttl: number;                    // Auto-expire after 90 days
}

// Behavior Analysis Record (with Cross-Agent Analytics)
interface BehaviorAnalysisItem extends UserBehaviorTableItem {
  PK: `USER#${string}`;           // USER#{userId}
  SK: `ANALYSIS#${number}#${string}`; // ANALYSIS#{timestamp}#{analysisId}
  GSI1PK: `ANALYSIS#${string}`;   // ANALYSIS#{version}
  GSI1SK: number;                 // timestamp for sorting
  entityType: 'BEHAVIOR_ANALYSIS';
  analysisId: string;
  interactionCount: number;
  agentPerformance: Record<string, {
    successRate: number;
    averageResponseTime: number;
    userSatisfaction: number;
  }>;
  patterns: {
    responseSpeed: 'fast' | 'moderate' | 'deliberate';
    editingFrequency: 'low' | 'medium' | 'high';
    explorationLevel: 'conservative' | 'balanced' | 'experimental';
    workflowPreference: 'linear' | 'non-linear' | 'mixed';
    agentPreference: string[];  // Ranked preferred agents
  };
  evolution?: {
    overallTrend: 'becoming_expert' | 'becoming_beginner' | 'stable' | 'inconsistent';
    changeIntensity: Record<string, number>;
    confidenceInTrend: number;
    agentAdaptation: Record<string, number>; // How well user adapts to each agent
  };
}