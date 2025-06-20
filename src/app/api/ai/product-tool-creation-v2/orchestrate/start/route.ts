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

      // 🚨 STRICT TCC VALIDATION: Fail outright if Function Planner doesn't return updated TCC
      if (!functionPlannerResult.updatedTcc) {
        logger.error({
          jobId,
          functionPlannerResultKeys: Object.keys(functionPlannerResult),
          hasUpdatedTcc: !!functionPlannerResult.updatedTcc
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - Function Planner Agent did not return updatedTcc");
        throw new Error("CRITICAL FAILURE: Function Planner Agent did not return updatedTcc in sequential mode");
      }

      // 🚨 STRICT TCC FIELD VALIDATION: Ensure function signatures were created
      if (!functionPlannerResult.updatedTcc.definedFunctionSignatures || functionPlannerResult.updatedTcc.definedFunctionSignatures.length === 0) {
        logger.error({
          jobId,
          updatedTccKeys: Object.keys(functionPlannerResult.updatedTcc),
          hasFunctionSignatures: !!functionPlannerResult.updatedTcc.definedFunctionSignatures,
          functionSignatureCount: functionPlannerResult.updatedTcc.definedFunctionSignatures?.length || 0
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - Function Planner Agent updatedTcc missing definedFunctionSignatures");
        throw new Error("CRITICAL FAILURE: Function Planner Agent updatedTcc missing required definedFunctionSignatures");
      }

      logger.info(
        { 
          jobId, 
          status: functionPlannerResponse.status,
          functionSignaturesCreated: functionPlannerResult.updatedTcc.definedFunctionSignatures.length,
          updatedTccKeys: Object.keys(functionPlannerResult.updatedTcc)
        },
        "🚀 ORCHESTRATION START: ✅ Function Planner Result - TCC VALIDATION PASSED"
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
            tcc: functionPlannerResult.updatedTcc, // ✅ STRICT: Only use validated TCC
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

      // 🚨 STRICT TCC VALIDATION: Fail outright if State Design doesn't return updated TCC
      if (!stateDesignResult.updatedTcc) {
        logger.error({
          jobId,
          stateDesignResultKeys: Object.keys(stateDesignResult),
          hasUpdatedTcc: !!stateDesignResult.updatedTcc
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - State Design Agent did not return updatedTcc");
        throw new Error("CRITICAL FAILURE: State Design Agent did not return updatedTcc in sequential mode");
      }

      // 🚨 STRICT TCC FIELD VALIDATION: Ensure stateLogic was created
      if (!stateDesignResult.updatedTcc.stateLogic) {
        logger.error({
          jobId,
          updatedTccKeys: Object.keys(stateDesignResult.updatedTcc),
          hasStateLogic: !!stateDesignResult.updatedTcc.stateLogic
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - State Design Agent updatedTcc missing stateLogic field");
        throw new Error("CRITICAL FAILURE: State Design Agent updatedTcc missing required stateLogic field");
      }

      // 🔍 DEBUG: Log what orchestrator received from State Design Agent
      logger.info(
        { 
          jobId, 
          stateDesignResultKeys: Object.keys(stateDesignResult),
          hasUpdatedTcc: !!stateDesignResult.updatedTcc,
          updatedTccKeys: Object.keys(stateDesignResult.updatedTcc),
          hasStateLogicInResult: !!stateDesignResult.updatedTcc.stateLogic,
          stateLogicVariableCount: stateDesignResult.updatedTcc.stateLogic?.variables?.length || 0,
          stateLogicFunctionCount: stateDesignResult.updatedTcc.stateLogic?.functions?.length || 0
        },
        "🚀 ORCHESTRATION START: ✅ State Design Result - TCC VALIDATION PASSED"
      );

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
            tcc: stateDesignResult.updatedTcc, // ✅ STRICT: Only use validated TCC
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

      // 🚨 STRICT TCC VALIDATION: Fail outright if JSX Layout doesn't return updated TCC
      if (!jsxLayoutResult.updatedTcc) {
        logger.error({
          jobId,
          jsxLayoutResultKeys: Object.keys(jsxLayoutResult),
          hasUpdatedTcc: !!jsxLayoutResult.updatedTcc
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - JSX Layout Agent did not return updatedTcc");
        throw new Error("CRITICAL FAILURE: JSX Layout Agent did not return updatedTcc in sequential mode");
      }

      // 🚨 STRICT TCC FIELD VALIDATION: Ensure all previous fields are preserved
      if (!jsxLayoutResult.updatedTcc.stateLogic) {
        logger.error({
          jobId,
          updatedTccKeys: Object.keys(jsxLayoutResult.updatedTcc),
          hasStateLogic: !!jsxLayoutResult.updatedTcc.stateLogic
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - JSX Layout Agent lost stateLogic field from TCC");
        throw new Error("CRITICAL FAILURE: JSX Layout Agent lost required stateLogic field from TCC");
      }

      if (!jsxLayoutResult.updatedTcc.jsxLayout) {
        logger.error({
          jobId,
          updatedTccKeys: Object.keys(jsxLayoutResult.updatedTcc),
          hasJsxLayout: !!jsxLayoutResult.updatedTcc.jsxLayout
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - JSX Layout Agent updatedTcc missing jsxLayout field");
        throw new Error("CRITICAL FAILURE: JSX Layout Agent updatedTcc missing required jsxLayout field");
      }

      // 🔍 DEBUG: Log JSX Layout TCC result
      logger.info(
        { 
          jobId, 
          jsxLayoutTccKeys: Object.keys(jsxLayoutResult.updatedTcc),
          hasStateLogic: !!jsxLayoutResult.updatedTcc.stateLogic,
          hasJsxLayout: !!jsxLayoutResult.updatedTcc.jsxLayout,
          stateLogicVariableCount: jsxLayoutResult.updatedTcc.stateLogic?.variables?.length || 0,
          stateLogicFunctionCount: jsxLayoutResult.updatedTcc.stateLogic?.functions?.length || 0
        },
        "🚀 ORCHESTRATION START: ✅ JSX Layout Result - TCC VALIDATION PASSED"
      );

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
            tcc: jsxLayoutResult.updatedTcc, // ✅ STRICT: Only use validated TCC
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

      // 🚨 STRICT TCC VALIDATION: Fail outright if Tailwind Styling doesn't return updated TCC
      if (!tailwindStylingResult.updatedTcc) {
        logger.error({
          jobId,
          tailwindStylingResultKeys: Object.keys(tailwindStylingResult),
          hasUpdatedTcc: !!tailwindStylingResult.updatedTcc
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - Tailwind Styling Agent did not return updatedTcc");
        throw new Error("CRITICAL FAILURE: Tailwind Styling Agent did not return updatedTcc in sequential mode");
      }

      // 🚨 STRICT TCC FIELD VALIDATION: Ensure all previous fields are preserved
      if (!tailwindStylingResult.updatedTcc.stateLogic) {
        logger.error({
          jobId,
          updatedTccKeys: Object.keys(tailwindStylingResult.updatedTcc),
          hasStateLogic: !!tailwindStylingResult.updatedTcc.stateLogic
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - Tailwind Styling Agent lost stateLogic field from TCC");
        throw new Error("CRITICAL FAILURE: Tailwind Styling Agent lost required stateLogic field from TCC");
      }

      if (!tailwindStylingResult.updatedTcc.jsxLayout) {
        logger.error({
          jobId,
          updatedTccKeys: Object.keys(tailwindStylingResult.updatedTcc),
          hasJsxLayout: !!tailwindStylingResult.updatedTcc.jsxLayout
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - Tailwind Styling Agent lost jsxLayout field from TCC");
        throw new Error("CRITICAL FAILURE: Tailwind Styling Agent lost required jsxLayout field from TCC");
      }

      if (!tailwindStylingResult.updatedTcc.styling) {
        logger.error({
          jobId,
          updatedTccKeys: Object.keys(tailwindStylingResult.updatedTcc),
          hasStyling: !!tailwindStylingResult.updatedTcc.styling
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - Tailwind Styling Agent updatedTcc missing styling field");
        throw new Error("CRITICAL FAILURE: Tailwind Styling Agent updatedTcc missing required styling field");
      }

      // 🔍 DEBUG: Log Tailwind Styling TCC result
      logger.info(
        { 
          jobId, 
          tailwindStylingTccKeys: Object.keys(tailwindStylingResult.updatedTcc),
          hasStateLogic: !!tailwindStylingResult.updatedTcc.stateLogic,
          hasJsxLayout: !!tailwindStylingResult.updatedTcc.jsxLayout,
          hasStyling: !!tailwindStylingResult.updatedTcc.styling,
          stateLogicVariableCount: tailwindStylingResult.updatedTcc.stateLogic?.variables?.length || 0,
          stateLogicFunctionCount: tailwindStylingResult.updatedTcc.stateLogic?.functions?.length || 0
        },
        "🚀 ORCHESTRATION START: ✅ Tailwind Styling Result - TCC VALIDATION PASSED"
      );

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
            tcc: tailwindStylingResult.updatedTcc, // ✅ STRICT: Only use validated TCC
            isSequentialMode: true
          }),
        }
      );

      if (!componentAssemblerResponse.ok) {
        throw new Error(
          `Component Assembler failed: ${componentAssemblerResponse.status}`
        );
      }

      // ✅ CRITICAL FIX: Process Component Assembler result and save final tool
      const componentAssemblerResult = await componentAssemblerResponse.json();
      if (!componentAssemblerResult.success) {
        throw new Error(`Component Assembler failed: ${componentAssemblerResult.error}`);
      }

      // 🚨 STRICT TCC VALIDATION: Ensure Component Assembler returned the final code
      if (!componentAssemblerResult.finalComponentCode) {
        logger.error({
          jobId,
          componentAssemblerResultKeys: Object.keys(componentAssemblerResult),
          hasFinalComponentCode: !!componentAssemblerResult.finalComponentCode
        }, "🚀 ORCHESTRATION START: ❌ CRITICAL FAILURE - Component Assembler did not return finalComponentCode");
        throw new Error("CRITICAL FAILURE: Component Assembler did not return finalComponentCode");
      }

      // ✅ CRITICAL FIX: Use Component Assembler's updated TCC (contains finalProduct.componentCode)
      const componentAssemblerTcc = componentAssemblerResult.updatedTcc || {
        ...tailwindStylingResult.updatedTcc,
        componentName: componentAssemblerResult.componentName
      };

      logger.info(
        { 
          jobId, 
          status: componentAssemblerResponse.status,
          finalComponentCodeLength: componentAssemblerResult.finalComponentCode.length,
          componentName: componentAssemblerResult.componentName || 'Unknown'
        },
        "🚀 ORCHESTRATION START: ✅ Component Assembler Result - CONTINUING TO VALIDATOR"
      );

      // ✅ SEQUENTIAL FLOW: Continue with Validator 
      if (!testingOptions?.skipValidator) {
        logger.info(
          { jobId },
          "🚀 ORCHESTRATION START: Triggering Validator"
        );

        const validatorModel = agentModelMapping?.['validator'] || selectedModel || "gpt-4o";
        
        logger.info(
          { 
            jobId, 
            validatorModel,
            modelSource: agentModelMapping?.['validator'] ? 'agentModelMapping' : (selectedModel ? 'selectedModel' : 'default')
          },
          "🚀 ORCHESTRATION START: Validator model selection"
        );

        const validatorUrl = new URL(
          "/api/ai/product-tool-creation-v2/agents/validator",
          request.url
        );
        const validatorResponse = await fetch(
          validatorUrl.toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId,
              selectedModel: validatorModel,
              tcc: componentAssemblerTcc,
              isSequentialMode: true
            }),
          }
        );

        if (!validatorResponse.ok) {
          throw new Error(
            `Validator failed: ${validatorResponse.status}`
          );
        }

        const validatorResult = await validatorResponse.json();
        if (!validatorResult.success) {
          throw new Error(`Validator failed: ${validatorResult.error}`);
        }

        // ✅ CRITICAL FIX: Check actual validation results, not just route success
        if (validatorResult.validationResult && !validatorResult.validationResult.isValid) {
          const errorDetails = validatorResult.validationResult.errors?.join('; ') || 'Unknown validation errors';
          const errorCount = validatorResult.validationResult.errorCount || 0;
          
          logger.error({
            jobId,
            errorCount,
            errorDetails,
            autoCorrectionApplied: validatorResult.validationResult.autoCorrectionApplied
          }, "🚀 ORCHESTRATION START: ❌ VALIDATION FAILED - STOPPING TOOL GENERATION");
          
          throw new Error(`Validation failed with ${errorCount} errors: ${errorDetails}. Auto-correction attempted but failed to resolve all issues.`);
        }

        logger.info(
          { jobId, status: validatorResponse.status },
          "🚀 ORCHESTRATION START: Validator completed, continuing with Tool Finalizer"
        );

        // ✅ SEQUENTIAL FLOW: Finally, trigger Tool Finalizer
        if (!testingOptions?.skipToolFinalizer) {
          logger.info(
            { jobId },
            "🚀 ORCHESTRATION START: Triggering Tool Finalizer"
          );

          const toolFinalizerModel = agentModelMapping?.['tool-finalizer'] || selectedModel || "gpt-4o";
          
          logger.info(
            { 
              jobId, 
              toolFinalizerModel,
              modelSource: agentModelMapping?.['tool-finalizer'] ? 'agentModelMapping' : (selectedModel ? 'selectedModel' : 'default')
            },
            "🚀 ORCHESTRATION START: Tool Finalizer model selection"
          );

          const toolFinalizerUrl = new URL(
            "/api/ai/product-tool-creation-v2/agents/tool-finalizer",
            request.url
          );
          const toolFinalizerResponse = await fetch(
            toolFinalizerUrl.toString(),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jobId,
                selectedModel: toolFinalizerModel,
                tcc: componentAssemblerTcc,
                isSequentialMode: true
              }),
            }
          );

          if (!toolFinalizerResponse.ok) {
            throw new Error(
              `Tool Finalizer failed: ${toolFinalizerResponse.status}`
            );
          }

          const toolFinalizerResult = await toolFinalizerResponse.json();
          if (!toolFinalizerResult.success) {
            throw new Error(`Tool Finalizer failed: ${toolFinalizerResult.error}`);
          }

          logger.info(
            { 
              jobId, 
              status: toolFinalizerResponse.status,
              finalProductCreated: !!toolFinalizerResult.finalProduct
            },
            "🚀 ORCHESTRATION START: ✅ Tool Finalizer Result - TOOL GENERATION COMPLETE!"
          );

          // ✅ FINAL STEP: Emit final completion status
          await emitStepProgress(
            jobId,
            OrchestrationStepEnum.enum.finalizing_tool,
            'completed',
            'Tool generation completed successfully! 🎉',
            tcc // Pass original TCC structure for userId
          );

          logger.info(
            { jobId },
            "🚀 ORCHESTRATION START: COMPLETE SEQUENTIAL FLOW FINISHED - All 6 agents executed successfully!"
          );
        } else {
          logger.info(
            { jobId },
            "🚀 ORCHESTRATION START: Skipping Tool Finalizer (testing mode)"
          );
        }
      } else {
        logger.info(
          { jobId },
          "🚀 ORCHESTRATION START: Skipping Validator (testing mode)"
        );
      }

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
