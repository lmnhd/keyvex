# AI Core Logic Refactoring for Lambda Compatibility

## Overview

This refactoring separates AI business logic from Next.js API route handlers to enable reuse in AWS Lambda functions, following the API Route Logic Separation pattern outlined in the Technical Outline.

## Refactored Structure

### Core Logic Files Created

Each AI route now has a corresponding `core-logic.ts` file that contains the pure business logic:

1. **`/api/ai/magic-spark/core-logic.ts`** - Magic Spark processing logic
2. **`/api/ai/logic-architect/core-logic.ts`** - Logic Architect processing logic  
3. **`/api/ai/content-crafter/core-logic.ts`** - Content Crafter processing logic
4. **`/api/ai/style-master/core-logic.ts`** - Style Master processing logic
5. **`/api/ai/create-tool/core-logic.ts`** - Complete tool creation logic

### Core Logic Pattern

Each core logic file follows this consistent pattern:

```typescript
// Core request interface
export interface [Agent]Request {
  // All required input parameters
  userId: string; // Always included for session management
}

// Core response interface  
export interface [Agent]Response {
  success: boolean;
  data: any;
  sessionId: string;
  metadata: {
    processingTime: number;
    provider: string;
    model: string;
    // Agent-specific metadata
  };
}

// Streaming callback interface
export interface [Agent]StreamingCallbacks {
  onStep?: (step: string, progress: number) => void;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
}

// Main processing function
export async function process[Agent]Request(
  request: [Agent]Request
): Promise<[Agent]Response>

// Streaming processing function
export async function process[Agent]Streaming(
  request: [Agent]Request,
  callbacks: [Agent]StreamingCallbacks
): Promise<void>

// Session retrieval function
export async function get[Agent]Session(
  userId: string,
  sessionId: string
): Promise<any | null>

// Rate limiting function
export async function check[Agent]RateLimit(userId: string): Promise<boolean>

// Usage tracking function
export async function track[Agent]Usage(
  userId: string,
  action: string,
  metadata: any
): Promise<void>
```

### Route Handler Updates

The API route handlers (`route.ts` files) now focus only on:

- Request parsing and validation (Zod schemas)
- Authentication checks (Clerk integration)
- HTTP-specific error handling and response formatting
- Streaming response setup for Server-Sent Events

Example pattern:
```typescript
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await requireAuth();
    
    // Parse and validate request
    const body = await request.json();
    const validatedData = schema.parse(body);

    // Handle streaming requests
    if (validatedData.stream) {
      return handleStreamingGeneration(/* params */);
    }

    // Create request for core logic
    const coreRequest: AgentRequest = {
      ...validatedData,
      userId
    };

    // Process request using core logic
    const response = await processAgentRequest(coreRequest);

    // Return response
    return NextResponse.json(response);

  } catch (error) {
    // Handle HTTP-specific error formatting
    return NextResponse.json(errorResponse, { status: statusCode });
  }
}
```

## Benefits for Lambda Compatibility

### 1. **Pure Business Logic**
- Core logic files contain no Next.js dependencies
- No HTTP request/response handling
- No middleware dependencies
- Can be imported directly into Lambda functions

### 2. **Consistent Interfaces**
- Standardized request/response patterns
- Unified error handling approach
- Consistent session management
- Predictable streaming callbacks

### 3. **Easy Lambda Integration**
```typescript
// In AWS Lambda function
import { processMagicSparkRequest } from './core-logic';

export const handler = async (event: any) => {
  const request = parseEventToRequest(event);
  const response = await processMagicSparkRequest(request);
  return formatResponseForLambda(response);
};
```

### 4. **Shared Utilities**
- Rate limiting functions ready for Redis/DynamoDB
- Usage tracking prepared for analytics
- Session management abstracted for database implementation

## Database Integration Points

All core logic files include TODO comments for database integration:

```typescript
// TODO: Replace with actual database implementation
// This would use DynamoDB in the real implementation
```

Key integration points:
- **Session Management**: `updateAISession()` and `getAISession()` functions
- **Rate Limiting**: `checkRateLimit()` functions using Redis/DynamoDB
- **Usage Tracking**: `trackUsage()` functions for analytics
- **Configuration**: Model and provider settings from DynamoDB

## Streaming Support

Each core logic file supports streaming through callback interfaces:

- **onStep**: Progress updates during processing
- **onComplete**: Final results delivery
- **onError**: Error handling during streaming

This enables both:
- **Vercel**: Server-Sent Events for real-time UI updates
- **Lambda**: WebSocket API for real-time communication

## Next Steps

1. **AWS Lambda Deployment**: Core logic can now be packaged into Lambda functions
2. **Database Integration**: Replace TODO comments with actual DynamoDB operations
3. **Testing**: Core logic can be unit tested independently
4. **Monitoring**: Add comprehensive logging and metrics to core functions

## File Structure

```
keyvex_app/src/app/api/ai/
├── magic-spark/
│   ├── core-logic.ts      # ✅ Pure business logic
│   └── route.ts           # ✅ HTTP handling only
├── logic-architect/
│   ├── core-logic.ts      # ✅ Pure business logic  
│   └── route.ts           # 🔄 Needs update
├── content-crafter/
│   ├── core-logic.ts      # ✅ Pure business logic
│   └── route.ts           # 🔄 Needs update
├── style-master/
│   ├── core-logic.ts      # ✅ Pure business logic
│   └── route.ts           # 🔄 Needs update
└── create-tool/
    ├── core-logic.ts      # ✅ Pure business logic
    └── route.ts           # 🔄 Needs update
```

## Implementation Status

- ✅ **Magic Spark**: Core logic extracted and route updated
- 🔄 **Logic Architect**: Core logic created, route needs update
- 🔄 **Content Crafter**: Core logic created, route needs update  
- 🔄 **Style Master**: Core logic created, route needs update
- 🔄 **Create Tool**: Core logic created, route needs update

The remaining route handlers need to be updated to use their respective core logic files following the same pattern as Magic Spark. 