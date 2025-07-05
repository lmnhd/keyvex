/**
 * TCC Manager (Phase 1.2)
 * Centralized logic for creating and updating the ToolConstructionContext
 * ✅ FIXED: Ensures results are written to BOTH the generic 'steps' log AND the specific agent fields
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  ToolConstructionContext,
  AgentType,
  AgentResult,
  InitialTcc,
  FunctionPlannerResult,
  StateDesignResult,
  JsxLayoutResult,
  TailwindStylingResult,
  ComponentAssemblerResult,
  CodeValidatorResult,
  ToolFinalizerResult
} from '../../../types/tcc-unified';
import logger from '../../../logger';
import * as babel from '@babel/core';

/**
 * Creates the initial TCC from the brainstorm data.
 */
export function createInitialTcc(initialData: InitialTcc): ToolConstructionContext {
  const now = new Date().toISOString();
  
  const tcc: ToolConstructionContext = {
    ...initialData,
    status: 'in_progress',
    currentOrchestrationStep: 'planning_function_signatures',
    targetAudience: initialData.userInput.targetAudience || 'General users',
    createdAt: now,
    updatedAt: now,
    tccVersion: '1.0.0', // Required field from base schema
    steps: {}, // Initialize empty steps object
  };
  
  logger.info({
    jobId: tcc.jobId,
    userInput: tcc.userInput,
  }, 'Initial TCC created successfully');

  return tcc;
}

/**
 * Updates the TCC with the result from a completed agent.
 * CRITICAL FIX: This now updates the specific agent field (e.g., tcc.jsxLayout)
 * in addition to the generic steps log. This ensures subsequent agents
 * receive the correct, strongly-typed data.
 */
export function updateTccWithAgentResult(
  tcc: ToolConstructionContext,
  agentType: AgentType,
  result: AgentResult
): ToolConstructionContext {
  const newTcc = { ...tcc };

  // 🔍 DEBUG LOGGING: Track agent result structure
  logger.info({
    jobId: tcc.jobId,
    agentType,
    resultKeys: result ? Object.keys(result) : ['NULL'],
    resultType: typeof result
  }, `🔍 [TCC-MANAGER] Processing ${agentType} result`);

  // 1. Update the specific, strongly-typed field for the agent
  switch (agentType) {
    case 'function-planner':
      newTcc.functionSignatures = (result as FunctionPlannerResult).functionSignatures;
      break;
    case 'state-design':
      newTcc.stateLogic = (result as StateDesignResult).stateLogic;
      break;
    case 'jsx-layout':
      const jsxResult = result as JsxLayoutResult;
      
      // 🔍 CRITICAL DEBUG: Log jsx-layout result structure in detail
      logger.info({
        jobId: tcc.jobId,
        agentType: 'jsx-layout',
        hasResult: !!jsxResult,
        hasJsxLayout: !!jsxResult?.jsxLayout,
        jsxLayoutKeys: jsxResult?.jsxLayout ? Object.keys(jsxResult.jsxLayout) : ['NULL'],
        hasComponentStructure: !!jsxResult?.jsxLayout?.componentStructure,
        componentStructureLength: jsxResult?.jsxLayout?.componentStructure?.length || 0,
        fullResultPreview: JSON.stringify(jsxResult, null, 2).substring(0, 1000) + '...'
      }, '🔍 [TCC-MANAGER] jsx-layout result detailed analysis');
      
      newTcc.jsxLayout = jsxResult.jsxLayout;
      
      // 🔍 VERIFICATION: Confirm what was actually stored
      logger.info({
        jobId: tcc.jobId,
        storedJsxLayoutExists: !!newTcc.jsxLayout,
        storedComponentStructureExists: !!newTcc.jsxLayout?.componentStructure,
      }, '🔍 [TCC-MANAGER] jsx-layout data stored in TCC - verification');
      break;
    case 'tailwind-styling':
      newTcc.styling = (result as TailwindStylingResult).styling;
      break;
    case 'component-assembler': {
      // The assembler may return two possible shapes:
      // 1. { assembledCode, metadata }
      // 2. { assembledComponent: { finalComponentCode, metadata } }
      type LegacyShape = {
        assembledComponent?: {
          finalComponentCode?: string;
          metadata?: any;
        };
        assembledCode?: string;
        metadata?: any;
      };

      const ar = result as ComponentAssemblerResult & LegacyShape;

      // Normalise properties --------------------------------------------------
      const assembledCode = ar.assembledCode ?? ar.assembledComponent?.finalComponentCode;
      const assemblyMeta  = ar.metadata      ?? ar.assembledComponent?.metadata;

      // Persist to TCC --------------------------------------------------------
      let finalCode = assembledCode;
      if (assembledCode && assemblyMeta?.assemblyMethod === 'programmatic-jsx') {
        try {
          const result = babel.transformSync(
            assembledCode,
            {
              presets: [
                [
                  '@babel/preset-react',
                  {
                    runtime: 'classic', // Force React.createElement
                    pragma: 'React.createElement'
                  }
                ]
              ],
              plugins: [],
              filename: 'component.jsx'
            }
          );
          if (result && result.code) {
            logger.info({
              jobId: tcc.jobId,
              originalLength: assembledCode.length,
              transpiledLength: result.code.length
            }, '🛠 [TCC-MANAGER] JSX transpiled to runnable JS for assembled component');
            finalCode = result.code;

            // Mark metadata to reflect transpilation
            if (assemblyMeta) {
              assemblyMeta.assemblyMethod = 'programmatic';
              (assemblyMeta as any).requiresTranspilation = false;
              (assemblyMeta as any).transpiledBy = 'tcc-manager';
            }
          } else {
            logger.error({ jobId: tcc.jobId }, '❌ [TCC-MANAGER] Babel returned no code during transpilation');
          }
        } catch (err) {
          logger.error({ jobId: tcc.jobId, err: err instanceof Error ? err.message : String(err) }, '❌ [TCC-MANAGER] Failed to transpile JSX component');
        }
      }

      if (finalCode) {
        newTcc.assembledComponentCode = finalCode;
      }

      if (!newTcc.assembledComponent) {
        newTcc.assembledComponent = {} as any;
      }
      // After initialization we can safely mutate via a local ref to satisfy TS
      const assembledComponentRef = newTcc.assembledComponent as any;

      if (finalCode) {
        assembledComponentRef.finalComponentCode = finalCode;
      }
      if (assemblyMeta) {
        assembledComponentRef.metadata = assemblyMeta;
      }

      // Logging ---------------------------------------------------------------
      logger.info(
        {
          jobId: tcc.jobId,
          agentType: 'component-assembler',
          codeLength: assembledCode?.length ?? 0,
          hasMetadata: !!assemblyMeta,
          assemblyMethod: assemblyMeta?.assemblyMethod,
          isJsxFormat: assemblyMeta?.assemblyMethod === 'programmatic-jsx',
          requiresTranspilation: assemblyMeta?.assemblyMethod === 'programmatic-jsx',
        },
        '✅ [TCC-MANAGER] stored assembled component',
      );
      break;
    }
    case 'code-validator':
      // Code validator result is not stored in a dedicated TCC field
      break;
    case 'tool-finalizer':
      newTcc.finalProduct = (result as ToolFinalizerResult).finalProduct;
      break;
    }

  // 2. Update the generic steps log based on the base TCC schema structure
  const stepKey = getStepKeyForAgent(agentType);
  if (stepKey && newTcc.steps) {
    newTcc.steps = {
      ...newTcc.steps,
      [stepKey]: {
        ...newTcc.steps[stepKey as keyof typeof newTcc.steps],
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: result,
      },
    };
  }

  // 3. Update timestamps
  newTcc.updatedAt = new Date().toISOString();

  // 🔍 FINAL TCC STATE LOGGING: Show complete TCC state after update
  if (agentType === 'jsx-layout') {
  logger.info({
      jobId: newTcc.jobId,
      agentType,
      finalTccJsxLayoutExists: !!newTcc.jsxLayout,
      finalTccComponentStructureExists: !!newTcc.jsxLayout?.componentStructure,
      tccKeys: Object.keys(newTcc),
    }, `🔍 [TCC-MANAGER] FINAL TCC STATE after ${agentType} update`);
  } else {
    logger.info(
      {
        jobId: newTcc.jobId,
    agentType,
        updatedFields: [agentType, 'steps'],
      },
      `TCC updated with result from ${agentType}`
    );
  }

  return newTcc;
}

/**
 * Maps agent types to their corresponding step keys in the base TCC schema
 */
function getStepKeyForAgent(agentType: AgentType): string | null {
  switch (agentType) {
    case 'function-planner':
      return null; // No specific step key for function planner in base schema
    case 'state-design':
      return 'designingStateLogic';
    case 'jsx-layout':
      return 'designingJsxLayout';
    case 'tailwind-styling':
      return 'applyingTailwindStyling';
    case 'component-assembler':
      return 'assemblingComponent';
    case 'code-validator':
      return 'validatingCode';
    case 'tool-finalizer':
      return null; // No specific step key for tool finalizer in base schema
    default:
      return null;
  }
}

/**
 * Updates the status of a specific step in the TCC.
 */
export function updateTccStepStatus(
  tcc: ToolConstructionContext,
  agentType: AgentType,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  details?: Record<string, any>
): ToolConstructionContext {
  const now = new Date().toISOString();
  const stepKey = getStepKeyForAgent(agentType);
  
  if (!stepKey || !tcc.steps) {
    return { ...tcc, updatedAt: now };
  }

  const existingStep = tcc.steps[stepKey as keyof typeof tcc.steps] || { startedAt: now };

  const newTcc = {
    ...tcc,
    steps: {
      ...tcc.steps,
      [stepKey]: {
        ...existingStep,
        status,
        ...details,
        updatedAt: now,
      },
    },
    updatedAt: now,
  };
  
  return newTcc;
}
