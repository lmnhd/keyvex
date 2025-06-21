import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  createTCC,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  BrainstormDataSchema,
  ToolConstructionContext,
  ValidationResult,
} from "@/lib/types/product-tool-creation-v2/tcc";
import { emitStepProgress } from "@/lib/streaming/progress-emitter.server";
import logger from "@/lib/logger";
import { requireAuth } from "@/lib/auth/debug";
import { V2ToolCreationJobService } from "@/lib/db/dynamodb/v2-tool-creation-jobs";
import { V2ToolCreationJob } from "@/lib/types/v2-tool-creation-job";

// Universal Agent Response Interface - Used by all agents
interface UniversalAgentResponse {
  success: boolean;
  error?: string;
  updatedTcc: ToolConstructionContext;
  validationResult?: ValidationResult; // For validator agent
  [key: string]: unknown; // Allow specific agent result fields
}

// Input validation schema
const StartOrchestrationSchema = z.object({
  jobId: z.string().uuid().optional(),
  userInput: z.object({
    description: z.string().min(1, "Description is required"),
    targetAudience: z.string().optional(),
    industry: z.string().optional(),
    toolType: z.string().optional(),
    features: z.array(z.string()).optional(),
  }),
  selectedModel: z.string().optional(),
  agentModelMapping: z.record(z.string()).optional(),
  brainstormData: BrainstormDataSchema.optional(),
  testingOptions: z
    .object({
      enableWebSocketStreaming: z.boolean().optional(),
      enableTccOperations: z.boolean().optional(),
      enableOrchestrationTriggers: z.boolean().optional(),
      skipFunctionPlanner: z.boolean().optional(),
      skipStateDesign: z.boolean().optional(),
      skipJsxLayout: z.boolean().optional(),
      skipTailwindStyling: z.boolean().optional(),
      skipComponentAssembler: z.boolean().optional(),
      skipValidator: z.boolean().optional(),
      skipToolFinalizer: z.boolean().optional(),
    })
    .optional(),
});

// Agent execution sequence with validation requirements
const AGENT_SEQUENCE = [
  {
    name: "function-planner",
    step: OrchestrationStepEnum.enum.planning_function_signatures,
    message: "Planning function signatures...",
    requiredField: "definedFunctionSignatures",
    skipOption: "skipFunctionPlanner"
  },
  {
    name: "state-design",
    step: OrchestrationStepEnum.enum.designing_state_logic,
    message: "Designing state management...",
    requiredField: "stateLogic",
    skipOption: "skipStateDesign"
  },
  {
    name: "jsx-layout",
    step: OrchestrationStepEnum.enum.designing_jsx_layout,
    message: "Creating JSX layout...",
    requiredField: "jsxLayout",
    skipOption: "skipJsxLayout"
  },
  {
    name: "tailwind-styling",
    step: OrchestrationStepEnum.enum.applying_tailwind_styling,
    message: "Applying Tailwind styles...",
    requiredField: "styling",
    skipOption: "skipTailwindStyling"
  },
  {
    name: "component-assembler",
    step: OrchestrationStepEnum.enum.assembling_component,
    message: "Assembling final component...",
    requiredField: "finalComponentCode",
    skipOption: "skipComponentAssembler"
  },
  {
    name: "validator",
    step: OrchestrationStepEnum.enum.validating_code,
    message: "Validating code...",
    requiredField: "validationResult",
    skipOption: "skipValidator"
  },
  {
    name: "tool-finalizer",
    step: OrchestrationStepEnum.enum.finalizing_tool,
    message: "Finalizing tool...",
    requiredField: "finalProduct",
    skipOption: "skipToolFinalizer"
  }
] as const;

/**
 * Execute a single agent via Universal Agent Route
 */
async function executeAgent(
  jobId: string,
  agentName: string,
  tcc: ToolConstructionContext,
  selectedModel: string,
  agentModelMapping: Record<string, string> | undefined,
  request: NextRequest
) {
  const agentModel = agentModelMapping?.[agentName] || selectedModel || "gpt-4o";
  
  logger.info(
    { 
      jobId, 
      agentName,
      agentModel,
      modelSource: agentModelMapping?.[agentName] ? 'agentModelMapping' : (selectedModel ? 'selectedModel' : 'default')
    },
    `🚀 ORCHESTRATOR: Executing ${agentName} with model ${agentModel}`
  );

  const agentUrl = new URL("/api/ai/agents/universal", request.url);
  const response = await fetch(agentUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId,
      agentType: agentName,
      selectedModel: agentModel,
      tcc: tcc,
      isSequentialMode: true
    }),
  });

  if (!response.ok) {
    throw new Error(`${agentName} failed: ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(`${agentName} failed: ${result.error}`);
  }

  return result;
}

/**
 * Validate agent result and updated TCC
 */
function validateAgentResult(
  jobId: string,
  agentName: string,
  result: UniversalAgentResponse,
  requiredField: string
): ToolConstructionContext {
  // Check if agent returned updated TCC
  if (!result.updatedTcc) {
    logger.error({
      jobId,
      agentName,
      resultKeys: Object.keys(result),
      hasUpdatedTcc: !!result.updatedTcc
    }, `🚀 ORCHESTRATOR: ❌ CRITICAL FAILURE - ${agentName} did not return updatedTcc`);
    throw new Error(`CRITICAL FAILURE: ${agentName} did not return updatedTcc in sequential mode`);
  }

  // Check if required field exists using type-safe property access
  const updatedTcc = result.updatedTcc as ToolConstructionContext & Record<string, unknown>;
  const hasRequiredField = Boolean(updatedTcc[requiredField]);
  
  if (!hasRequiredField) {
    logger.error({
      jobId,
      agentName,
      updatedTccKeys: Object.keys(result.updatedTcc),
      requiredField,
      hasRequiredField
    }, `🚀 ORCHESTRATOR: ❌ CRITICAL FAILURE - ${agentName} updatedTcc missing ${requiredField}`);
    throw new Error(`CRITICAL FAILURE: ${agentName} updatedTcc missing required ${requiredField}`);
  }

  // Special validation for validator
  if (agentName === "validator" && result.validationResult && !result.validationResult.isValid) {
    const validationResult = result.validationResult;
    const errorDetails = validationResult.error || 'Unknown validation errors';
    const errorCount = validationResult.details?.errorCount || 0;
    
    logger.error({
      jobId,
      errorCount,
      errorDetails,
      validationDetails: validationResult.details
    }, "🚀 ORCHESTRATOR: ❌ VALIDATION FAILED - STOPPING TOOL GENERATION");
    
    throw new Error(`Validation failed with ${errorCount} errors: ${errorDetails}. Auto-correction attempted but failed to resolve all issues.`);
  }

  logger.info(
    { 
      jobId, 
      agentName,
      requiredField,
      hasRequiredField
    },
    `🚀 ORCHESTRATOR: ✅ ${agentName} Result - TCC VALIDATION PASSED`
  );

  return result.updatedTcc;
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();

  try {
    const body = await request.json();
    const parsedInput = StartOrchestrationSchema.parse(body);
    const {
      jobId: providedJobId,
      userInput,
      selectedModel,
      agentModelMapping,
      brainstormData,
      testingOptions,
    } = parsedInput;

    // Generate a new job ID only if one isn't provided
    const jobId = providedJobId || uuidv4();

    logger.info(
      {
        jobId,
        jobIdSource: providedJobId ? 'client-provided' : 'server-generated',
        userId,
        userInputDescription: userInput.description,
        selectedModel: selectedModel || "default",
        hasBrainstormData: !!brainstormData,
        testingOptions: testingOptions || "none",
      },
      "🚀 ORCHESTRATOR: Starting simplified sequential flow"
    );

    // Create initial TCC with userId and brainstorm data
    let currentTcc = createTCC(jobId, userInput, userId, brainstormData);

    // Add agent model mapping if provided
    if (agentModelMapping) {
      currentTcc.agentModelMapping = agentModelMapping;
    }

    logger.info(
      { jobId, tccId: currentTcc.jobId, userId },
      "🚀 ORCHESTRATOR: TCC created - beginning sequential agent execution"
    );

    // Emit initial progress
    const shouldStream = testingOptions?.enableWebSocketStreaming !== false;
    if (shouldStream) {
      await emitStepProgress(
        currentTcc.jobId,
        OrchestrationStepEnum.enum.planning_function_signatures,
        "started",
        "Orchestration started. Beginning sequential agent execution...",
        currentTcc
      );
    }

    // Save initial job state
    const jobService = new V2ToolCreationJobService();
    const initialJob: V2ToolCreationJob = {
      id: currentTcc.jobId,
      userId,
      status: "running",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      toolConstructionContext: currentTcc,
    };

    try {
      await jobService.saveJob(initialJob);
      logger.info({ jobId }, "✅ Successfully saved initial job state");
    } catch (error) {
      logger.error({ jobId, error }, "❌ Failed to save initial job state");
      throw new Error("Failed to save initial job state");
    }

    // Execute agents sequentially
    for (const agent of AGENT_SEQUENCE) {
      // Check if agent should be skipped
      if (testingOptions?.[agent.skipOption as keyof typeof testingOptions]) {
        logger.info(
          { jobId, agentName: agent.name },
          `🚀 ORCHESTRATOR: Skipping ${agent.name} (testing mode)`
        );
        continue;
      }

      // Emit progress
      if (shouldStream) {
        await emitStepProgress(
          jobId,
          agent.step,
          "started",
          agent.message,
          currentTcc
        );
      }

      // Execute agent
      const result = await executeAgent(
        jobId,
        agent.name,
        currentTcc,
        selectedModel || "gpt-4o",
        agentModelMapping,
        request
      );

      // Validate result and update TCC
      currentTcc = validateAgentResult(
        jobId,
        agent.name,
        result,
        agent.requiredField
      );

      // Emit completion
      if (shouldStream) {
        await emitStepProgress(
          jobId,
          agent.step,
          "completed",
          `✅ ${agent.name} completed successfully`,
          currentTcc
        );
      }

      logger.info(
        { jobId, agentName: agent.name },
        `🚀 ORCHESTRATOR: ✅ ${agent.name} completed - continuing to next agent`
      );
    }

    // Emit final completion
    if (shouldStream) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.finalizing_tool,
        'completed',
        'Tool generation completed successfully! 🎉',
        currentTcc
      );
    }

    logger.info(
      { jobId },
      "🚀 ORCHESTRATOR: ✅ COMPLETE SEQUENTIAL FLOW FINISHED - All agents executed successfully!"
    );

    return NextResponse.json({
      success: true,
      jobId,
      tccId: currentTcc.jobId,
      currentStep: OrchestrationStepEnum.enum.finalizing_tool,
      status: OrchestrationStatusEnum.enum.completed,
      message: "Orchestration completed successfully",
      webSocketConnected: shouldStream,
      testingMode: !!testingOptions,
    });

  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "🚀 ORCHESTRATOR: Error in simplified flow"
    );

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
