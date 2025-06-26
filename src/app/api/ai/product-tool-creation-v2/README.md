# Product Tool Creation V2 - Multi-Agent Orchestration System

## Overview

The Product Tool Creation V2 system represents a revolutionary advancement in AI-powered tool generation for the Keyvex platform. This multi-agent orchestration system replaces monolithic AI generation with specialized, collaborative agents working together through a sophisticated frontend-controlled orchestration framework.

## 🎯 Key Benefits

- **🚀 VERCEL FIRST**: All agents designed to complete within Vercel timeout limits (10-20 seconds each)
- **🎨 Specialized Expertise**: Each agent focuses on one specific aspect of tool creation
- **📊 Real-time Progress**: Step-by-step progress tracking with timestamps and status visualization
- **🔄 Error Recovery**: Agent-specific retry and recovery capabilities
- **🎛️ Advanced Controls**: Pause/resume functionality and isolation testing
- **📈 Higher Quality**: Multi-stage validation and specialized agent expertise

## 🏗️ Architecture Overview

```
Frontend (React Hook)
    ↓ (Initialize)
┌─────────────────────────────────────────────────────────────┐
│                    V2 Orchestration Flow                    │
├─────────────────────────────────────────────────────────────┤
│  1. Function Planner Agent  →  2. State Design Agent      │
│     ↓ (TCC Update)              ↓ (TCC Update)             │
│  3. JSX Layout Agent      →  4. Tailwind Styling Agent    │
│     ↓ (TCC Update)              ↓ (TCC Update)             │
│  5. Component Assembly   →  6. Validation & Finalization  │
└─────────────────────────────────────────────────────────────┘
    ↓ (Poll for completion)
Frontend (Final ProductToolDefinition)
```

## 🤖 Specialized Agents

### 1. Function Signature Planner Agent
**Endpoint**: `/agents/function-planner/route.ts`

- **Purpose**: Analyze user requirements and plan the tool's functional architecture
- **Input**: User description, target audience, industry context
- **Output**: Defined function signatures and architectural blueprint
- **Timeout**: 10-15 seconds
- **TCC Field**: `definedFunctionSignatures`

**Example Output**:
```typescript
[
  {
    name: "calculateROI",
    description: "Calculate return on investment percentage"
  },
  {
    name: "formatCurrency", 
    description: "Format number as currency display"
  }
]
```

### 2. State Design Agent
**Endpoint**: `/agents/state-design/route.ts`

- **Purpose**: Design React state management and business logic
- **Input**: Function signatures from previous agent, user requirements
- **Output**: State variables, useState hooks, and calculation functions
- **Timeout**: 15-20 seconds (complex state logic design)
- **TCC Field**: `stateLogic`

**Example Output**:
```typescript
{
  variables: [
    { name: "investment", initialValue: "0", type: "number" },
    { name: "revenue", initialValue: "0", type: "number" }
  ],
  functions: [
    {
      name: "calculateROI",
      body: "return ((revenue - investment) / investment) * 100;",
      dependencies: ["investment", "revenue"]
    }
  ]
}
```

### 3. JSX Layout Agent
**Endpoint**: `/agents/jsx-layout/route.ts`

- **Purpose**: Create sophisticated component structure and accessibility
- **Input**: State design and function signatures
- **Output**: Professional JSX layouts with grid-based organization
- **Timeout**: 15-20 seconds
- **TCC Field**: `jsxLayout`

**Example Output**:
```typescript
{
  componentStructure: `
    <Card data-style-id="main-card">
      <CardHeader>
        <CardTitle>ROI Calculator</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <Input data-style-id="investment-input" />
          <Input data-style-id="revenue-input" />
        </div>
        <div data-style-id="results-display">
          <h3>ROI: {roi}%</h3>
        </div>
      </CardContent>
    </Card>
  `,
  elementMap: [
    { elementId: "main-card", type: "Card", purpose: "Container" },
    { elementId: "investment-input", type: "Input", purpose: "Investment input" }
  ]
}
```

### 4. Tailwind Styling Agent
**Endpoint**: `/agents/tailwind-styling/route.ts`

- **Purpose**: Apply professional Tailwind CSS styling to components
- **Input**: JSX layout structure and element mapping
- **Output**: Complete styling system with responsive design
- **Timeout**: 10-15 seconds
- **TCC Field**: `tailwindStyles`

**Example Output**:
```typescript
{
  "main-card": "max-w-2xl mx-auto border-green-200 bg-green-50",
  "investment-input": "border-green-300 focus:border-green-500",
  "revenue-input": "border-green-300 focus:border-green-500",
  "results-display": "mt-6 p-4 bg-green-100 rounded-lg text-center"
}
```

## 🗄️ Tool Construction Context (TCC)

The TCC serves as the shared memory between all agents, enabling seamless collaboration and state persistence.

### Core Schema

```typescript
interface ToolConstructionContext {
  // Identification
  jobId: string;                                    // Unique UUID for this job
  userId?: string;                                  // User who initiated the job
  
  // Orchestration State
  currentOrchestrationStep: OrchestrationStep;      // Current processing step
  status: OrchestrationStatus;                      // Overall job status
  
  // Agent Outputs (populated sequentially)
  definedFunctionSignatures?: DefinedFunctionSignature[];  // Function Planner output
  stateLogic?: StateLogic;                                 // State Design output
  jsxLayout?: JsxLayout;                                   // JSX Layout output
  tailwindStyles?: TailwindStyles;                         // Tailwind Styling output
  
  // Final Assembly
  assembledComponentCode?: string;                  // Combined component code
  validationResult?: ValidationResult;             // Code validation results
  finalProductToolDefinition?: ProductToolDefinition;     // Final output
  
  // Progress Tracking
  progressLog: ProgressEvent[];                    // Detailed audit trail
  steps: {                                         // Agent-specific tracking
    designingStateLogic?: StepStatus;
    designingJsxLayout?: StepStatus;
    applyingTailwindStyling?: StepStatus;
  };
  
  // User Context
  userInput: {                                     // Original requirements
    description: string;
    targetAudience?: string;
    industry?: string;
    toolType?: string;
    features?: string[];
  };
  
  // Metadata
  createdAt: string;                               // ISO timestamp
  updatedAt: string;                               // ISO timestamp
  tccVersion: string;                              // Schema version
}
```

### TCC Persistence

- **Storage**: DynamoDB with automatic TTL (24 hours)
- **Access Pattern**: Job ID based retrieval
- **Updates**: Atomic updates after each agent completion
- **Cleanup**: Automatic cleanup of completed/failed jobs

## 🔄 Orchestration Endpoints

### Start Orchestration
**Endpoint**: `POST /orchestrate/start`

**Purpose**: Initialize new tool creation job and start the first agent

**Request**:
```typescript
{
  userIntent: string;
  context: {
    targetAudience?: string;
    industry?: string;
    toolType?: string;
    features?: string[];
    brainstormingResult?: any;
  }
}
```

**Response**:
```typescript
{
  success: boolean;
  jobId: string;
  currentStep: string;
  message: string;
}
```

### Check Parallel Completion
**Endpoint**: `POST /orchestrate/check-parallel-completion`

**Purpose**: Monitor agent completion and coordinate handoffs

**Request**:
```typescript
{
  jobId: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  isComplete: boolean;
  canProceed: boolean;
  currentStep: string;
  nextStep?: string;
  progress: ProgressEvent[];
}
```

### Trigger Next Step
**Endpoint**: `POST /orchestrate/trigger-next-step`

**Purpose**: Advance orchestration to the next stage

**Request**:
```typescript
{
  jobId: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  jobId: string;
  currentStep: string;
  message: string;
  isComplete?: boolean;
  tool?: ProductToolDefinition;  // If final step
}
```

## ⚛️ Frontend Integration

### React Hook Usage

```typescript
import { useProductToolCreationV2 } from '@/lib/hooks/useProductToolCreationV2';

function ToolCreator() {
  const {
    createTool,
    isCreating,
    progress,
    currentStep,
    error,
    resetState
  } = useProductToolCreationV2();

  const handleCreateTool = async () => {
    try {
      const result = await createTool({
        userIntent: "Create an ROI calculator",
        context: {
          targetAudience: "business professionals",
          industry: "consulting",
          toolType: "calculator"
        }
      });
      
      if (result.success) {
        console.log("Tool created:", result.tool);
      }
    } catch (error) {
      console.error("Creation failed:", error);
    }
  };

  return (
    <div>
      <button onClick={handleCreateTool} disabled={isCreating}>
        {isCreating ? 'Creating...' : 'Create Tool'}
      </button>
      
      {/* Progress Display */}
      {progress.map((step, index) => (
        <div key={index}>
          {step.stepDisplayName}: {step.status}
        </div>
      ))}
    </div>
  );
}
```

### Key Hook Features

- **Timeout Management**: 1-second polling with 5-minute total timeout
- **Progress Tracking**: Real-time step-by-step progress updates
- **Error Handling**: Comprehensive error recovery and user feedback
- **Abort Control**: AbortController for cancellation support
- **State Management**: Clean state transitions and reset capabilities

## 🧪 Testing & Development

### Running Individual Agents

Each agent can be tested independently:

```bash
# Test Function Planner Agent
curl -X POST http://localhost:3000/api/ai/product-tool-creation-v2/agents/function-planner \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": {
      "description": "Create an ROI calculator",
      "targetAudience": "business professionals"
    }
  }'

# Test State Design Agent
curl -X POST http://localhost:3000/api/ai/product-tool-creation-v2/agents/state-design \
  -H "Content-Type: application/json" \
  -d '{
    "tcc": { /* TCC with function signatures */ }
  }'
```

### Tool Generation Workbench Integration

The V2 system is fully integrated into the existing Tool Generation Workbench:

1. **Navigate to**: `/tests/tool-generation-workbench`
2. **Select Brainstorm**: Choose existing brainstorm result
3. **Run V2 Creation**: Monitor real-time progress
4. **Advanced Controls**: Pause/resume and isolation testing

## 🔧 Configuration

### Environment Variables

```bash
# Required for V2 system
DYNAMODB_TABLE_NAME=keyvex-main-table-development
AWS_REGION=us-east-1

# AI Model Configuration
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Debug Configuration
DISABLE_AUTH_FOR_DEBUG=true  # Development only
DEBUG_USER_ID=debug-user-123 # Development only
```

### Agent Timeouts

Each agent is configured with specific timeout limits:

```typescript
const AGENT_TIMEOUTS = {
  functionPlanner: 15000,   // 15 seconds
  stateDesign: 20000,       // 20 seconds  
  jsxLayout: 20000,         // 20 seconds
  tailwindStyling: 15000    // 15 seconds
};
```

## 🚨 Error Handling

### Agent-Specific Error Recovery

- **Retry Logic**: Each agent supports up to 3 retry attempts
- **Fallback Models**: Automatic fallback to secondary AI models
- **Isolation Testing**: Test individual agents with controlled inputs
- **Error Propagation**: Clear error messages with agent context

### Common Error Scenarios

1. **Agent Timeout**: Individual agent exceeds time limit
2. **TCC Corruption**: Invalid state in Tool Construction Context
3. **Validation Failure**: Generated code fails syntax/logic validation
4. **Assembly Error**: Component assembly from agent outputs fails

## 📊 Monitoring & Analytics

### Progress Tracking

```typescript
interface ProgressEvent {
  timestamp: string;
  stepName: string;
  status: 'initiated' | 'started' | 'in_progress' | 'completed' | 'failed';
  message: string;
  details?: any;
}
```

### Performance Metrics

- **Agent Execution Time**: Individual agent performance tracking
- **Success Rates**: Agent-specific success/failure ratios
- **Quality Metrics**: Tool validation and user satisfaction scores
- **Error Analytics**: Detailed error classification and resolution tracking

## 🔮 Future Enhancements

### Planned Features

1. **Parallel Agent Execution**: Multiple agents working simultaneously
2. **Dynamic Agent Selection**: AI-driven optimal agent selection
3. **Agent Collaboration**: Inter-agent communication for complex decisions
4. **Template-Based Orchestration**: Pre-configured workflows for common tools
5. **Learning System**: Agents learn from successful patterns
6. **Quality Scoring**: Automatic quality assessment and optimization

### Extensibility

The V2 system is designed for easy extension:

1. **Add New Agent**: Create new specialized agent following existing patterns
2. **Extend TCC Schema**: Add new fields for additional agent outputs
3. **Custom Orchestration**: Define custom workflows for specific use cases
4. **Integration Points**: Hook into existing validation and assembly systems

## 📝 Development Guidelines

### Adding a New Agent

1. **Create Agent Directory**: `/agents/new-agent/route.ts`
2. **Define Agent Schema**: Input/output Zod schemas
3. **Implement Agent Logic**: Core AI processing with timeout management
4. **Update TCC Schema**: Add new fields for agent outputs
5. **Update Orchestration**: Add agent to workflow logic
6. **Add Tests**: Unit tests and integration tests
7. **Update Documentation**: README and inline documentation

### Code Standards

- **TypeScript**: Strict mode with comprehensive type definitions
- **Error Handling**: Comprehensive try/catch with proper error propagation
- **Logging**: Structured logging with correlation IDs
- **Validation**: Zod schemas for all inputs and outputs
- **Testing**: Unit tests for all agent logic and orchestration flows

## 🤝 Contributing

When contributing to the V2 system:

1. **Follow Patterns**: Use existing agent patterns for consistency
2. **Test Thoroughly**: Test both individual agents and full orchestration
3. **Document Changes**: Update README and inline documentation
4. **Monitor Performance**: Ensure agents stay within timeout limits
5. **Validate Quality**: Ensure outputs meet quality standards

---

**The V2 Multi-Agent Orchestration System represents the future of AI-powered tool creation at Keyvex, enabling unprecedented quality, reliability, and scalability through specialized agent collaboration.** 