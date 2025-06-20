import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  createTCC,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  BrainstormDataSchema,
} from "@/lib/types/product-tool-creation-v2/tcc";
import { emitStepProgress } from "@/lib/streaming/progress-emitter.server";
import logger from "@/lib/logger";
import { requireAuth } from "@/lib/auth/debug";
import { V2ToolCreationJobService } from "@/lib/db/dynamodb/v2-tool-creation-jobs";
import { V2ToolCreationJob } from "@/lib/types/v2-tool-creation-job";

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
  // Phase 1: Accept brainstorm data for enhanced agent context
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

export async function POST(request: NextRequest) {
  const userId = await requireAuth();

  try {
    const body = await request.json();
    const {
      jobId: providedJobId,
      userInput,
      selectedModel,
      agentModelMapping,
      brainstormData,
      testingOptions,
    } = StartOrchestrationSchema.parse(body);

    // Generate a new job ID only if one isn't provided
    const jobId = providedJobId || uuidv4();

    logger.info(
      {
        jobId,
        jobIdSource: providedJobId ? 'client-provided' : 'server-generated',
        userId,
        userInputDescription: userInput.description,
        selectedModel: selectedModel || "default",
        hasBrainstormData: !!brainstormData, // Log whether brainstorm data is present
        testingOptions: testingOptions || "none",
      },
      "🚀 ORCHESTRATION START: Creating new TCC"
    );

    // 🔍 DEBUG: Log comprehensive brainstorm data structure for debugging
    if (brainstormData) {
      logger.info(
        {
          jobId,
          brainstormDataKeys: Object.keys(brainstormData),
          brainstormDataSize: JSON.stringify(brainstormData).length,
          coreConcept:
            brainstormData.coreConcept ||
            brainstormData.coreWConcept ||
            "Not specified",
          valueProposition: brainstormData.valueProposition || "Not specified",
          suggestedInputsCount: brainstormData.suggestedInputs?.length || 0,
          keyCalculationsCount: brainstormData.keyCalculations?.length || 0,
          interactionFlowCount: brainstormData.interactionFlow?.length || 0,
          hasLeadCaptureStrategy: !!brainstormData.leadCaptureStrategy,
          hasCalculationLogic:
            !!brainstormData.calculationLogic &&
            brainstormData.calculationLogic.length > 0,
          hasCreativeEnhancements:
            !!brainstormData.creativeEnhancements &&
            brainstormData.creativeEnhancements.length > 0,
        },
        "🚀 ORCHESTRATION START: [BRAINSTORM DEBUG] Rich brainstorm data available for agents"
      );

      // Log specific brainstorm fields for debugging
      if (
        brainstormData.suggestedInputs &&
        brainstormData.suggestedInputs.length > 0
      ) {
        logger.info(
          {
            jobId,
            suggestedInputs: brainstormData.suggestedInputs.map((input) => ({
              label: input.label,
              type: input.type,
              description:
                input.description?.substring(0, 100) +
                (input.description?.length > 100 ? "..." : ""),
            })),
          },
          "🚀 ORCHESTRATION START: [BRAINSTORM DEBUG] Suggested inputs that agents will use"
        );
      }

      if (
        brainstormData.keyCalculations &&
        brainstormData.keyCalculations.length > 0
      ) {
        logger.info(
          {
            jobId,
            keyCalculations: brainstormData.keyCalculations.map((calc) => ({
              name: calc.name,
              formula:
                calc.formula?.substring(0, 100) +
                (calc.formula?.length > 100 ? "..." : ""),
              description:
                calc.description?.substring(0, 100) +
                (calc.description?.length > 100 ? "..." : ""),
            })),
          },
          "🚀 ORCHESTRATION START: [BRAINSTORM DEBUG] Key calculations that agents will implement"
        );
      }

      if (
        brainstormData.interactionFlow &&
        brainstormData.interactionFlow.length > 0
      ) {
        logger.info(
          {
            jobId,
            interactionFlow: brainstormData.interactionFlow.map((step) => ({
              step: step.step,
              title: step.title,
              description:
                step.description?.substring(0, 100) +
                (step.description?.length > 100 ? "..." : ""),
              userAction:
                step.userAction?.substring(0, 100) +
                (step.userAction?.length > 100 ? "..." : ""),
            })),
          },
          "🚀 ORCHESTRATION START: [BRAINSTORM DEBUG] Interaction flow that agents will design for"
        );
      }

      if (brainstormData.leadCaptureStrategy) {
        logger.info(
          {
            jobId,
            leadCaptureStrategy: {
              timing: brainstormData.leadCaptureStrategy.timing,
              method: brainstormData.leadCaptureStrategy.method,
              incentive:
                brainstormData.leadCaptureStrategy.incentive?.substring(
                  0,
                  100
                ) +
                (brainstormData.leadCaptureStrategy.incentive?.length > 100
                  ? "..."
                  : ""),
            },
          },
          "🚀 ORCHESTRATION START: [BRAINSTORM DEBUG] Lead capture strategy for agents"
        );
      }

      if (
        brainstormData.calculationLogic &&
        brainstormData.calculationLogic.length > 0
      ) {
        logger.info(
          {
            jobId,
            calculationLogic: brainstormData.calculationLogic.map((logic) => ({
              name: logic.name,
              formula:
                logic.formula?.substring(0, 100) +
                (logic.formula?.length > 100 ? "..." : ""),
            })),
          },
          "🚀 ORCHESTRATION START: [BRAINSTORM DEBUG] Calculation logic for agents to implement"
        );
      }
    } else {
      logger.warn(
        {
          jobId,
          userInputDescription: userInput.description,
          toolType: userInput.toolType || "Not specified",
          targetAudience: userInput.targetAudience || "Not specified",
        },
        "🚀 ORCHESTRATION START: [BRAINSTORM DEBUG] ⚠️ NO BRAINSTORM DATA - Agents will work with minimal context only"
      );
    }

    // Create initial TCC with userId and brainstorm data (Phase 1)
    const tcc = createTCC(jobId, userInput, userId, brainstormData);

    // Add agent model mapping if provided
    if (agentModelMapping) {
      tcc.agentModelMapping = agentModelMapping;
    }

    logger.info(
      { jobId, tccId: tcc.jobId, userId },
      "🚀 ORCHESTRATION START: TCC created (will be passed as props)"
    );

    // Emit initial progress
    const shouldStream = testingOptions?.enableWebSocketStreaming !== false; // default true
    if (shouldStream) {
      await emitStepProgress(
        tcc.jobId,
        OrchestrationStepEnum.enum.planning_function_signatures,
        "started",
        "Orchestration started. Beginning function signature planning...",
        tcc // Pass TCC directly as details
      );

      logger.info(
        { jobId: tcc.jobId },
        "🚀 ORCHESTRATION START: Initial progress emitted"
      );
    }

    // Save the initial job state
    const jobService = new V2ToolCreationJobService();
    const initialJob: V2ToolCreationJob = {
      id: tcc.jobId,
      userId,
      status: "running",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // Include any initial tool construction context if available
      toolConstructionContext: tcc,
    };

    try {
      await jobService.saveJob(initialJob);
      logger.info({ jobId }, "✅ Successfully saved initial job state");
    } catch (error) {
      logger.error({ jobId, error }, "❌ Failed to save initial job state");
      // Consider whether to continue or fail the orchestration
      throw new Error("Failed to save initial job state");
    }

    // Trigger first agent (Function Planner) unless testing options skip it
    if (!testingOptions?.skipFunctionPlanner) {
      logger.info(
        { jobId },
        "🚀 ORCHESTRATION START: Triggering Function Planner"
      );

      // ✅ FIXED: Use agent-specific model from agentModelMapping or fall back to selectedModel/default
      const functionPlannerModel = agentModelMapping?.['function-planner'] || selectedModel || "gpt-4o";
      
      logger.info(
        { 
          jobId, 
          functionPlannerModel,
          modelSource: agentModelMapping?.['function-planner'] ? 'agentModelMapping' : (selectedModel ? 'selectedModel' : 'default')
        },
        "🚀 ORCHESTRATION START: Function Planner model selection"
      );

      const functionPlannerUrl = new URL(
        "/api/ai/product-tool-creation-v2/agents/function-planner",
        request.url
      );
      const functionPlannerResponse = await fetch(
        functionPlannerUrl.toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            selectedModel: functionPlannerModel,
            tcc: tcc,
            isSequentialMode: true
          }),
        }
      );

      if (!functionPlannerResponse.ok) {
        throw new Error(
          `Function Planner failed: ${functionPlannerResponse.status}`
        );
      }

      // ✅ CRITICAL FIX: Get updated TCC from Function Planner 
      const functionPlannerResult = await functionPlannerResponse.json();
      if (!functionPlannerResult.success) {
        throw new Error(`Function Planner failed: ${functionPlannerResult.error}`);
      }

      logger.info(
        { 
          jobId, 
          status: functionPlannerResponse.status,
          functionSignaturesCreated: functionPlannerResult.functionSignatures?.length || 0
        },
        "🚀 ORCHESTRATION START: Function Planner completed, got updated TCC"
      );

      // ✅ RESTORATION: Now trigger State Design with the UPDATED TCC from Function Planner
      logger.info(
        { jobId },
        "🚀 ORCHESTRATION START: Triggering State Design with updated TCC"
      );

      // ✅ FIXED: Use agent-specific model for State Design
      const stateDesignModel = agentModelMapping?.['state-design'] || selectedModel || "gpt-4o";
      
      logger.info(
        { 
          jobId, 
          stateDesignModel,
          modelSource: agentModelMapping?.['state-design'] ? 'agentModelMapping' : (selectedModel ? 'selectedModel' : 'default')
        },
        "🚀 ORCHESTRATION START: State Design model selection"
      );

      const stateDesignUrl = new URL(
        "/api/ai/product-tool-creation-v2/agents/state-design",
        request.url
      );
      const stateDesignResponse = await fetch(
        stateDesignUrl.toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            selectedModel: stateDesignModel,
            tcc: functionPlannerResult.updatedTcc || tcc,
            isSequentialMode: true
          }),
        }
      );

      if (!stateDesignResponse.ok) {
        throw new Error(
          `State Design failed: ${stateDesignResponse.status}`
        );
      }

      // ✅ CRITICAL FIX: Get updated TCC from State Design and continue with JSX Layout
      const stateDesignResult = await stateDesignResponse.json();
      if (!stateDesignResult.success) {
        throw new Error(`State Design failed: ${stateDesignResult.error}`);
      }

      logger.info(
        { jobId, status: stateDesignResponse.status },
        "🚀 ORCHESTRATION START: State Design completed, continuing with JSX Layout"
      );

      // ✅ SEQUENTIAL FLOW: Now trigger JSX Layout with the UPDATED TCC from State Design
      const jsxLayoutModel = agentModelMapping?.['jsx-layout'] || selectedModel || "gpt-4o";
      
      logger.info(
        { 
          jobId, 
          jsxLayoutModel,
          modelSource: agentModelMapping?.['jsx-layout'] ? 'agentModelMapping' : (selectedModel ? 'selectedModel' : 'default')
        },
        "🚀 ORCHESTRATION START: JSX Layout model selection"
      );

      const jsxLayoutUrl = new URL(
        "/api/ai/product-tool-creation-v2/agents/jsx-layout",
        request.url
      );
      const jsxLayoutResponse = await fetch(
        jsxLayoutUrl.toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            selectedModel: jsxLayoutModel,
            tcc: stateDesignResult.updatedTcc || tcc,
            isSequentialMode: true
          }),
        }
      );

      if (!jsxLayoutResponse.ok) {
        throw new Error(
          `JSX Layout failed: ${jsxLayoutResponse.status}`
        );
      }

      // ✅ CRITICAL FIX: Get updated TCC from JSX Layout and continue with Tailwind Styling
      const jsxLayoutResult = await jsxLayoutResponse.json();
      if (!jsxLayoutResult.success) {
        throw new Error(`JSX Layout failed: ${jsxLayoutResult.error}`);
      }

      logger.info(
        { jobId, status: jsxLayoutResponse.status },
        "🚀 ORCHESTRATION START: JSX Layout completed, continuing with Tailwind Styling"
      );

      // ✅ SEQUENTIAL FLOW: Now trigger Tailwind Styling with the UPDATED TCC from JSX Layout
      const tailwindStylingModel = agentModelMapping?.['tailwind-styling'] || selectedModel || "gpt-4o";
      
      logger.info(
        { 
          jobId, 
          tailwindStylingModel,
          modelSource: agentModelMapping?.['tailwind-styling'] ? 'agentModelMapping' : (selectedModel ? 'selectedModel' : 'default')
        },
        "🚀 ORCHESTRATION START: Tailwind Styling model selection"
      );

      const tailwindStylingUrl = new URL(
        "/api/ai/product-tool-creation-v2/agents/tailwind-styling",
        request.url
      );
      const tailwindStylingResponse = await fetch(
        tailwindStylingUrl.toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            selectedModel: tailwindStylingModel,
            tcc: jsxLayoutResult.updatedTcc || tcc,
            isSequentialMode: true
          }),
        }
      );

      if (!tailwindStylingResponse.ok) {
        throw new Error(
          `Tailwind Styling failed: ${tailwindStylingResponse.status}`
        );
      }

      // ✅ CRITICAL FIX: Get updated TCC from Tailwind Styling and continue with Component Assembler
      const tailwindStylingResult = await tailwindStylingResponse.json();
      if (!tailwindStylingResult.success) {
        throw new Error(`Tailwind Styling failed: ${tailwindStylingResult.error}`);
      }

      logger.info(
        { jobId, status: tailwindStylingResponse.status },
        "🚀 ORCHESTRATION START: Tailwind Styling completed, continuing with Component Assembler"
      );

      // ✅ SEQUENTIAL FLOW: Now trigger Component Assembler with the UPDATED TCC from Tailwind Styling
      const componentAssemblerModel = agentModelMapping?.['component-assembler'] || selectedModel || "claude-3-7-sonnet-20250219";
      
      logger.info(
        { 
          jobId, 
          componentAssemblerModel,
          modelSource: agentModelMapping?.['component-assembler'] ? 'agentModelMapping' : (selectedModel ? 'selectedModel' : 'default')
        },
        "🚀 ORCHESTRATION START: Component Assembler model selection"
      );

      const componentAssemblerUrl = new URL(
        "/api/ai/product-tool-creation-v2/agents/component-assembler",
        request.url
      );
      const componentAssemblerResponse = await fetch(
        componentAssemblerUrl.toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            selectedModel: componentAssemblerModel,
            tcc: tailwindStylingResult.updatedTcc || tcc,
            isSequentialMode: true
          }),
        }
      );

      if (!componentAssemblerResponse.ok) {
        throw new Error(
          `Component Assembler failed: ${componentAssemblerResponse.status}`
        );
      }

      logger.info(
        { jobId, status: componentAssemblerResponse.status },
        "🚀 ORCHESTRATION START: Component Assembler triggered - SEQUENTIAL FLOW COMPLETE!"
      );

    } else {
      logger.info(
        { jobId },
        "🚀 ORCHESTRATION START: Skipping Function Planner (testing mode)"
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
      tccId: tcc.jobId,
      currentStep: OrchestrationStepEnum.enum.planning_function_signatures,
      status: OrchestrationStatusEnum.enum.pending,
      message: "Orchestration started successfully",
      webSocketConnected: shouldStream,
      testingMode: !!testingOptions,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "🚀 ORCHESTRATION START: Error"
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
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
