# Keyvex Product Tool Creation System Documentation (V2)

## Overview

The Keyvex Product Tool Creation System is a sophisticated, AI-powered platform that dynamically generates React-based business tools. The system transforms natural language requirements into fully functional, interactive components using a **V2 multi-agent orchestration architecture** with comprehensive validation and quality assurance. This document outlines the V2 process.

---

## Architecture Overview

The V2 system is built around a series of specialized, independent AI agents that collaborate through a shared data object called the Tool Construction Context (TCC). An orchestrator manages the flow, triggering agents sequentially or in parallel as needed.

### Core Components

1.  **Orchestration Endpoints** - A set of APIs to start, monitor, and manage the tool creation lifecycle.
2.  **AI Agents** - Specialized agents for each phase of tool creation.
3.  **Tool Construction Context (TCC)** - A persistent state object (stored in DynamoDB) that acts as the shared memory for the entire process.
4.  **Frontend Workbench** - A testing UI to trigger and monitor the creation process.

### Technology Stack

-   **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
-   **Backend**: Next.js API Routes
-   **AI Models**: OpenAI GPT-4 series, Anthropic Claude 3.5 Sonnet
-   **State Management**: DynamoDB for TCC persistence
-   **Real-time Updates**: WebSockets for progress streaming to the frontend.

### V2 Orchestration Flow

The process is managed by orchestrator endpoints that trigger the agents in a specific sequence. The frontend initiates the process and then listens for real-time progress updates via a WebSocket connection.

```mermaid
graph TD
    subgraph Frontend
        A[Workbench UI]
    end

    subgraph "Orchestration API (/orchestrate)"
        B(start)
        C(check-parallel-completion)
        D(tcc/[jobId])
        E(pause/resume/step)
    end
    
    subgraph "Specialized AI Agents (/agents)"
        F[1. Function Planner]
        G[2. State Design]
        H[3. JSX Layout]
        I[4. Tailwind Styling]
        J[5. Component Assembler]
        K[6. Validator]
        L[7. Tool Finalizer]
    end

    subgraph "Data Store"
        M[(DynamoDB TCC)]
    end

    A --"POST /start"--> B
    B --> F
    F --"Updates"--> M
    
    F --"Triggers"--> G
    F --"Triggers"--> H
    
    G --"Updates"--> M
    H --"Updates"--> M

    G --"POST /check-parallel-completion"--> C
    H --"POST /check-parallel-completion"--> C

    C --"Reads"--> M
    C --"Triggers"--> I
    
    I --"Updates"--> M
    I --"POST /check-parallel-completion"--> C
    
    C --"Triggers"--> J
    J --"Updates"--> M
    J --"POST /check-parallel-completion"--> C
    
    C --"Triggers"--> K
    K --"Updates"--> M
    K --"POST /check-parallel-completion"--> C
    
    C --"Triggers"--> L
    L --"Updates"--> M
    L --"Completes Process"--> M
    
    A --"WebSocket Connection"--> B
    B --"Progress Stream"--> A
    A --"GET /tcc/[jobId]"--> D
```

---

## The Tool Construction Context (TCC)

The TCC is the single source of truth for a tool creation job. It's a JSON object stored in DynamoDB, identified by a unique `jobId`. Each agent reads the TCC to get its required inputs and writes its output back to the TCC upon completion.

### Core TCC Schema (`/lib/types/product-tool-creation-v2/tcc.ts`)

```typescript
interface ToolConstructionContext {
  // Identification
  jobId: string;
  userId?: string;
  
  // Orchestration State
  currentOrchestrationStep: OrchestrationStepEnum;
  status: OrchestrationStatusEnum;
  
  // User Input
  userInput: {
    description: string;
    targetAudience?: string;
    industry?: string;
    toolType?: string;
    features?: string[];
  };

  // Agent-specific model mapping
  agentModelMapping?: Record<string, string>;
  
  // Agent Outputs (populated sequentially)
  definedFunctionSignatures?: DefinedFunctionSignature[];
  stateLogic?: StateLogic;
  jsxLayout?: JsxLayout;
  styling?: any; // Represents Tailwind styling output
  assembledComponentCode?: string;
  validationResult?: any; // Validation output
  finalProductToolDefinition?: ProductToolDefinition; // Final tool
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}
```

---

## V2 Agent Pipeline

### 1. Function Planner Agent (`/agents/function-planner`)
- **Purpose**: Analyzes the initial user request to define the functional architecture of the tool. It determines all the necessary JavaScript functions required for the tool's interactivity.
- **Input**: `userInput` from TCC.
- **Output**: An array of `DefinedFunctionSignature` objects (name and description for each function).
- **TCC Update**: Populates `tcc.definedFunctionSignatures`.
- **Next Step**: Triggers the State Design and JSX Layout agents to run in parallel.

### 2. State Design Agent (`/agents/state-design`)
- **Purpose**: Designs the component's state management logic based on the function plan. It defines `useState` hooks and writes the logic for each function.
- **Input**: `definedFunctionSignatures` and `userInput` from TCC.
- **Output**: A `StateLogic` object containing state variables and function implementations.
- **TCC Update**: Populates `tcc.stateLogic`.
- **Next Step**: Calls the `/check-parallel-completion` endpoint.

### 3. JSX Layout Agent (`/agents/jsx-layout`)
- **Purpose**: Creates the React component structure using `React.createElement` syntax. It focuses on semantic HTML, accessibility, and placeholder IDs for styling, without applying any actual styles.
- **Input**: `definedFunctionSignatures` and `userInput` from TCC.
- **Output**: A `JsxLayoutResult` object containing the component structure string and a map of elements.
- **TCC Update**: Populates `tcc.jsxLayout`.
- **Next Step**: Calls the `/check-parallel-completion` endpoint.

### Orchestration Point: `check-parallel-completion`
This endpoint is called by both the State Design and JSX Layout agents. It checks the TCC to see if both agents have completed their work. Once both are done, it triggers the next sequential agent.

### 4. Tailwind Styling Agent (`/agents/tailwind-styling`)
- **Purpose**: Applies a complete, modern, and responsive design system to the unstyled JSX layout using Tailwind CSS.
- **Input**: `jsxLayout` from TCC.
- **Output**: The styled component code and a map of styles.
- **TCC Update**: Populates `tcc.styling`.
- **Next Step**: Calls `check-parallel-completion` to trigger the Component Assembler.

### 5. Component Assembler Agent (`/agents/component-assembler`)
- **Purpose**: The final assembly stage. This agent combines the JSX structure, the state logic, and the Tailwind styling into a single, complete, and functional React component code string.
- **Input**: `jsxLayout`, `stateLogic`, and `styling` from TCC.
- **Output**: The final, complete React component code as a string.
- **TCC Update**: Populates `tcc.assembledComponentCode`.
- **Next Step**: Calls `check-parallel-completion` to trigger the Validator.

### 6. Validator Agent (`/agents/validator`)
- **Purpose**: Performs static analysis on the final component code to catch syntax errors, type errors, and other common issues before the tool is finalized.
- **Input**: `assembledComponentCode` from TCC.
- **Output**: A validation report including errors, warnings, and code metrics.
- **TCC Update**: Populates `tcc.validationResult`.
- **Next Step**: Calls `check-parallel-completion` to trigger the Tool Finalizer.

### 7. Tool Finalizer Agent (`/agents/tool-finalizer`)
- **Purpose**: Creates the final `ProductToolDefinition` object. It packages the component code with all necessary metadata, such as name, description, category, and default color schemes.
- **Input**: The complete TCC, especially `assembledComponentCode` and `validationResult`.
- **Output**: The final `ProductToolDefinition`.
- **TCC Update**: Populates `tcc.finalProductToolDefinition` and sets the overall status to `completed`.
- **Next Step**: The process is complete.

---

## Frontend Integration: The Workbench

The `/tests/tool-generation-workbench` page serves as the control panel for initiating and monitoring the V2 tool creation process.

- **`BrainstormGenerator.tsx`**: Allows users to input a tool idea. It calls an extraction API (`/api/ai/extract-tool-details`) to suggest `toolType` and `targetAudience`, and then generates a full "brainstorm" object.
- **`ToolTester.tsx`**: The main component for running the V2 pipeline.
    - It takes the selected brainstorm result.
    - It allows configuration of which AI model each agent should use.
    - It calls `/api/ai/product-tool-creation-v2/orchestrate/start` to begin the process.
    - It uses the `useToolGenerationStream` hook to connect to a WebSocket and receive real-time `StepProgress` updates.
    - **`ProgressLog.tsx`**: Displays the live stream of progress updates from the backend.
    - **`TCCVisualizer.tsx`**: Fetches and displays the current state of the TCC object, providing a real-time look into the "shared memory" of the agents.
- **`tool-tester-core-logic.ts`**: Contains the client-side logic for making the API call to start the orchestration.

This setup allows for complete observability into the complex, asynchronous, multi-agent workflow, making debugging and testing much more effective.