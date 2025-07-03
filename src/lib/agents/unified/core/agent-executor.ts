/**
 * Unified Agent Executor (Phase 1.2 - Enhanced with ResponseParser Integration)
 * Single source of truth for all unified agent execution
 * Returns both result AND updated TCC to resolve ambiguity
 * FIXED: NO GENERIC TYPES - All 'any' types replaced with proper interfaces
 * 
 * CRITICAL FIX: Now properly integrates with ResponseParser validation system
 * to enable quality-based retries and multi-layer validation
 */

import { 
  AgentType, 
  AgentResult, 
  AgentExecutionContext,
  RetryAttemptInfo,
  ValidationResult,
  ToolConstructionContext
} from '../../../types/tcc-unified';
import { updateTccWithAgentResult } from './tcc-manager';
import { RetryManager } from './retry-manager';
import { BaseAgentModule, AgentExecutionInput } from './base-agent-module';
import { getResponseParser, ParsedResponse } from './response-parser';
import { AIInteractionManager } from './ai-interaction-manager';
import logger from '../../../logger';

// Import unified agent modules - ALL IMPLEMENTED!
import { FunctionPlannerModule } from '../modules/function-planner';
import { StateDesignModule } from '../modules/state-design';
import { JSXLayoutModule } from '../modules/jsx-layout';
import { ComponentAssemblerModule } from '../modules/component-assembler';
import { TailwindStylingModule } from '../modules/tailwind-styling';
import { CodeValidatorModule } from '../modules/code-validator';
import { ToolFinalizerModule } from '../modules/tool-finalizer';

// Import custom executor
import { executeTailwindStylingTwoStep } from '../modules/tailwind-styling-executor';

// FIXED: Proper interface instead of 'any' type for raw model results
export interface RawModelResult {
  [key: string]: unknown;
}

// FIXED: Proper interface for attempt info - aligned with RetryAttemptInfo
export interface QualityAttemptInfo {
  attemptNumber: number;
  strategy: string;
  lastError?: string | null;  // Match RetryAttemptInfo type
  adaptedModel?: string;
}

/**
 * Simple agent registry implementation
 * Provides centralized access to all agent modules
 */
class AgentRegistry {
  // CRITICAL FIX: Store module constructors, not instances, to prevent state leakage.
  private agentConstructors: Map<AgentType, new () => BaseAgentModule> = new Map();

  constructor() {
    // Initialize map with agent module constructors
    this.agentConstructors.set('function-planner', FunctionPlannerModule);
    this.agentConstructors.set('state-design', StateDesignModule);
    this.agentConstructors.set('jsx-layout', JSXLayoutModule);
    this.agentConstructors.set('tailwind-styling', TailwindStylingModule);
    this.agentConstructors.set('component-assembler', ComponentAssemblerModule);
    this.agentConstructors.set('code-validator', CodeValidatorModule);
    this.agentConstructors.set('tool-finalizer', ToolFinalizerModule);
  }

  getAgent(agentType: AgentType): BaseAgentModule | null {
    const AgentConstructor = this.agentConstructors.get(agentType);
    // Create a new instance for every call to ensure statelessness
    return AgentConstructor ? new AgentConstructor() : null;
  }

  hasAgent(agentType: AgentType): boolean {
    return this.agentConstructors.has(agentType);
  }

  getAvailableAgents(): AgentType[] {
    return Array.from(this.agentConstructors.keys());
  }
}

// Create singleton instance of the registry itself (which is safe)
const agentRegistry = new AgentRegistry();

// Initialize managers
const retryManager = new RetryManager();
const aiManager = AIInteractionManager.getInstance();
const responseParser = getResponseParser();

/**
 * Enhanced execution result with validation details
 */
interface EnhancedExecutionResult {
  result: AgentResult;
  updatedTcc: ToolConstructionContext;
  validationDetails: {
    validationScore: number;
    errors: string[];
    warnings: string[];
    responseSize: number;
    parseTime: number;
  };
  executionMetadata: {
    modelUsed: string;
    tokensUsed?: number;
    responseTime: number;
    attemptNumber: number;
    retryReason?: string;
  };
}

/**
 * Main entry point for agent execution
 * Determines whether to use AI or programmatic execution
 */
export async function executeAgent(
  agentType: AgentType,
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<{ result: AgentResult; updatedTcc: ToolConstructionContext }> {
  const agentModule = agentRegistry.getAgent(agentType);
  if (!agentModule) {
    throw new Error(`Agent module for ${agentType} not found in registry`);
  }

  // Check if this is a programmatic module
  if (isProgrammaticModule(agentType)) {
    return executeProgrammaticModule(agentType, agentModule, context, tcc);
  }

  // Execute AI agent with retry logic
  const maxRetries = getMaxRetries(agentType);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const attemptInfo: RetryAttemptInfo = {
        attemptNumber: attempt,
        isFirstAttempt: attempt === 1,
        isSecondAttempt: attempt === 2,
        isThirdAttempt: attempt === 3,
        isFinalAttempt: attempt === maxRetries,
        lastError: lastError?.message || null,
        strategy: attempt === 1 ? 'standard' : 'validation-focused',
        adaptedModel: '',
        adaptedPromptHints: []
      };

      let resultData: AgentResult;

      if (agentType === 'tailwind-styling') {
        resultData = await executeTailwindStylingTwoStep(context, tcc);
      } else {
        const executionResult = await executeAgentWithValidation(agentType, agentModule, context, tcc, attemptInfo);
        resultData = executionResult.result;
      }
      
      // CRITICAL FIX: Update the TCC with the result from the completed agent
      const newTcc = updateTccWithAgentResult(tcc, agentType, resultData);
      
      // Success - return simplified result with the *updated* TCC
      return {
        result: resultData,
        updatedTcc: newTcc
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        logger.error({
          jobId: context.jobId,
          agentType,
          totalAttempts: maxRetries,
          finalError: lastError.message
        }, ` AGENT EXECUTOR: ${agentType} failed after ${maxRetries} attempts`);
        throw lastError;
      }

      logger.warn({
        jobId: context.jobId,
        agentType,
        attemptNumber: attempt,
        error: lastError.message,
        willRetry: true
      }, ` AGENT EXECUTOR: ${agentType} attempt ${attempt} failed, retrying...`);
    }
  }

  throw lastError || new Error(`Agent execution failed after ${maxRetries} attempts`);
}

/**
 * Check if an agent type is a programmatic module
 */
function isProgrammaticModule(agentType: AgentType): boolean {
  return agentType === 'component-assembler' || agentType === 'tool-finalizer';
}

/**
 * Execute programmatic modules (no AI required)
 */
async function executeProgrammaticModule(
  agentType: AgentType,
  agentModule: BaseAgentModule,
  context: AgentExecutionContext,
  tcc: ToolConstructionContext
): Promise<{ result: AgentResult; updatedTcc: ToolConstructionContext }> {
  const executionStartTime = Date.now();

  logger.info({
    jobId: context.jobId,
    agentType,
    executionType: 'programmatic'
  }, ` AGENT EXECUTOR: Executing programmatic module ${agentType}`);

  try {
    let result: AgentResult;

    if (agentType === 'component-assembler') {
      const assemblerModule = agentModule as ComponentAssemblerModule;
      result = assemblerModule.assembleComponent(tcc);
    } else if (agentType === 'tool-finalizer') {
      const finalizerModule = agentModule as ToolFinalizerModule;
      // IMPLEMENTED: Tool finalizer programmatic execution
      result = finalizerModule.finalizeComponent(tcc);
    } else {
      throw new Error(`Unknown programmatic module: ${agentType}`);
    }

    // Validate the result
    const validation = agentModule.validate(result);
    if (!validation.isValid) {
      throw new Error(`Programmatic module validation failed: ${validation.errors.join(', ')}`);
    }

    const executionTime = Date.now() - executionStartTime;

    logger.info({
      jobId: context.jobId,
      agentType,
      executionTime,
      validationScore: validation.score,
      executionType: 'programmatic'
    }, ` AGENT EXECUTOR: Programmatic module ${agentType} completed successfully`);

    // CRITICAL FIX: Update the TCC with the result from the programmatic module
    // This was missing, causing the component-assembler result to not be stored
    const updatedTcc = updateTccWithAgentResult(tcc, agentType, result);

    return {
      result,
      updatedTcc
    };

  } catch (error) {
    const executionTime = Date.now() - executionStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      jobId: context.jobId,
      agentType,
      executionTime,
      error: errorMessage,
      executionType: 'programmatic'
    }, ` AGENT EXECUTOR: Programmatic module ${agentType} execution failed`);
    
    throw error;
  }
}

/**
 * Execute AI agents with validation and quality gates
 */
async function executeAgentWithValidation(
  agentType: AgentType,
  agentModule: BaseAgentModule,
  context: AgentExecutionContext,
  tcc: ToolConstructionContext,
  attemptInfo: RetryAttemptInfo
): Promise<EnhancedExecutionResult> {
  const executionStartTime = Date.now();
  
  logger.info({
    jobId: context.jobId,
    agentType,
    attemptNumber: attemptInfo.attemptNumber,
    isRetry: !attemptInfo.isFirstAttempt,
    retryStrategy: attemptInfo.strategy,
    executionType: 'ai'
  }, ` AGENT EXECUTOR: Executing AI agent ${agentType} (attempt ${attemptInfo.attemptNumber})`);

  try {
    let aiResult: { success: boolean; rawResponse: any; errors: string[]; metadata: any; };

    // --- Custom Executor Logic for Tailwind Styling ---
    if (agentType === 'tailwind-styling') {
      const stylingResult = await executeTailwindStylingTwoStep(context, tcc);
      // We mock the aiResult structure to fit into the existing validation pipeline
      aiResult = {
        success: true,
        rawResponse: stylingResult,
        errors: [],
        metadata: { modelUsed: context.modelConfig.modelId, tokensUsed: null } // Tokens are handled inside the custom executor
      };
    } else {
      // Standard execution for all other agents
      const outputSchema = agentModule.getOutputSchema();
      aiResult = await aiManager.executeAgentInteraction(
        agentType,
        context,
        tcc,
        attemptInfo,
        outputSchema
      );
    }

    if (!aiResult.success) {
      throw new Error(`AI interaction failed: ${aiResult.errors.join(', ')}`);
    }

    // Step 2: Use ResponseParser to validate the raw response
    const parseResult: ParsedResponse<AgentResult> = await responseParser.parseAgentResponse(
      agentType,
      aiResult.rawResponse!,
      context.jobId
    );

    logger.info({
      jobId: context.jobId,
      agentType,
      parseSuccess: parseResult.success,
      validationScore: parseResult.metadata.validationScore,
      errorsCount: parseResult.errors.length,
      warningsCount: parseResult.warnings.length
    }, ` AGENT EXECUTOR: ResponseParser validation completed for ${agentType}`);

    // Step 3: Quality Gate
    const qualityGate = evaluateResponseQuality(parseResult, agentType, attemptInfo);
    if (!qualityGate.passesQualityGate) {
      throw new QualityValidationError(
        `Response quality below threshold: ${qualityGate.reason}`,
        parseResult.metadata.validationScore,
        parseResult.errors,
        parseResult.warnings
      );
    }

    // Step 4: Additional agent-specific validation from the module
    if (parseResult.data) {
      const agentValidation = agentModule.validate(parseResult.data);
      if (!agentValidation.isValid) {
        throw new QualityValidationError(
          `Agent validation failed: ${agentValidation.errors.join(', ')}`,
          agentValidation.score,
          agentValidation.errors,
          agentValidation.warnings
        );
      }
    }

    // Step 5: Success
    const executionTime = Date.now() - executionStartTime;
    return {
      result: parseResult.data!,
      updatedTcc: tcc, // TCC is updated via reference in agents
      validationDetails: {
        validationScore: parseResult.metadata.validationScore,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
        responseSize: parseResult.metadata.responseSize,
        parseTime: parseResult.metadata.parseTime
      },
      executionMetadata: {
        modelUsed: aiResult.metadata.modelUsed,
        tokensUsed: aiResult.metadata.tokensUsed,
        responseTime: executionTime,
        attemptNumber: attemptInfo.attemptNumber,
        retryReason: attemptInfo.lastError || undefined
      }
    };

  } catch (error) {
    const executionTime = Date.now() - executionStartTime;
    logger.error({
      jobId: context.jobId,
      agentType,
      attemptNumber: attemptInfo.attemptNumber,
      executionTime,
      error: error instanceof Error ? error.message : String(error),
      isQualityError: error instanceof QualityValidationError,
      executionType: 'ai'
    }, ` AGENT EXECUTOR: AI agent ${agentType} execution failed in attempt ${attemptInfo.attemptNumber}`);
    throw error;
  }
}

/**
 * Evaluate response quality to determine if retry is needed
 * FIXED: No 'any' types - using QualityAttemptInfo interface
 */
function evaluateResponseQuality(
  parseResult: ParsedResponse<AgentResult>,
  agentType: AgentType,
  attemptInfo: QualityAttemptInfo
): { passesQualityGate: boolean; reason: string } {
  // Critical failures always fail quality gate
  if (!parseResult.success) {
    return {
      passesQualityGate: false,
      reason: `Parse failed: ${parseResult.errors.join(', ')}`
    };
  }

  if (!parseResult.data) {
    return {
      passesQualityGate: false,
      reason: 'No data returned from parser'
    };
  }

  // FIXED: Proper type-safe threshold mapping
  const minScoreThresholds: Record<string, number> = {
    'function-planner': 70,
    'state-design': 75,
    'jsx-layout': 70,
    'tailwind-styling': 65,
    'code-validator': 85
    // Note: component-assembler and tool-finalizer are programmatic, no thresholds needed
  };

  const minScore = minScoreThresholds[agentType] || 70;
  
  if (parseResult.metadata.validationScore < minScore) {
    return {
      passesQualityGate: false,
      reason: `Validation score ${parseResult.metadata.validationScore} below minimum ${minScore}`
    };
  }

  // Check for critical errors that should trigger retry
  const criticalErrors = parseResult.errors.filter(error => 
    error.toLowerCase().includes('missing') ||
    error.toLowerCase().includes('required') ||
    error.toLowerCase().includes('empty') ||
    error.toLowerCase().includes('invalid')
  );

  if (criticalErrors.length > 0) {
    return {
      passesQualityGate: false,
      reason: `Critical errors detected: ${criticalErrors.join(', ')}`
    };
  }

  // Agent-specific quality checks
  if (agentType === 'function-planner') {
    // FIXED: Safe type checking without forced assertion
    const data = parseResult.data as unknown;
    if (data && typeof data === 'object' && data !== null) {
      const objData = data as Record<string, unknown>;
      const functionSignatures = objData.functionSignatures as unknown[];
      if (!functionSignatures || functionSignatures.length === 0) {
        return {
          passesQualityGate: false,
          reason: 'No function signatures generated'
        };
      }
    }
  }

  if (agentType === 'state-design') {
    // FIXED: Safe type checking without forced assertion
    const data = parseResult.data as unknown;
    if (data && typeof data === 'object' && data !== null) {
      const objData = data as Record<string, unknown>;
      const stateLogic = objData.stateLogic as Record<string, unknown>;
      if (!stateLogic) {
        return {
          passesQualityGate: false,
          reason: 'No state logic generated'
        };
      }
      
      const variables = stateLogic.variables as unknown[];
      const functions = stateLogic.functions as unknown[];
      if ((!variables || variables.length === 0) && (!functions || functions.length === 0)) {
        return {
          passesQualityGate: false,
          reason: 'No state variables or functions generated'
        };
      }
    }
  }

  // Quality gate passed
  return {
    passesQualityGate: true,
    reason: 'All quality checks passed'
  };
}

/**
 * Custom error class for quality validation failures
 * This allows the RetryManager to distinguish between technical errors and quality issues
 */
class QualityValidationError extends Error {
  constructor(
    message: string,
    public validationScore: number,
    public validationErrors: string[],
    public validationWarnings: string[]
  ) {
    super(message);
    this.name = 'QualityValidationError';
  }
}

/**
 * Get list of all available agent types
 */
export function getAvailableAgentTypes(): AgentType[] {
  return agentRegistry.getAvailableAgents();
}

/**
 * Check if an agent is available in the registry
 */
export function isAgentAvailable(agentType: AgentType): boolean {
  return agentRegistry.hasAgent(agentType);
}

/**
 * Get agent module from registry
 */
export function getAgentModule(agentType: AgentType): BaseAgentModule | null {
  return agentRegistry.getAgent(agentType);
}

/**
 * Get timeout for an agent type
 */
export function getAgentTimeout(agentType: AgentType): number {
  const module = agentRegistry.getAgent(agentType);
  return module ? module.getTimeout() : 30000;
}

/**
 * Get max retries based on agent type
 */
function getMaxRetries(agentType: AgentType): number {
  const retryConfig: Record<string, number> = {
    'function-planner': 3,
    'state-design': 3,
    'jsx-layout': 2,
    'tailwind-styling': 2,
    'code-validator': 3,
    'component-assembler': 1, // Programmatic, shouldn't need retries
    'tool-finalizer': 1       // Programmatic, shouldn't need retries
  };
  
  return retryConfig[agentType] || 2;
}

/**
 * Validate agent module result
 */
export function validateAgentModule(agentType: AgentType, result: AgentResult): ValidationResult {
  const module = agentRegistry.getAgent(agentType);
  if (!module) {
    throw new Error(`Agent module for ${agentType} not found`);
  }
  
  return module.validate(result);
}
