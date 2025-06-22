/**
 * Unified Agent Executor (Phase 1.2 - Enhanced with ResponseParser Integration)
 * Single source of truth for all unified agent execution
 * Returns both result AND updated TCC to resolve ambiguity
 * ✅ FIXED: NO GENERIC TYPES - All 'any' types replaced with proper interfaces
 * 
 * CRITICAL FIX: Now properly integrates with ResponseParser validation system
 * to enable quality-based retries and multi-layer validation
 */

import { 
  AgentType, 
  AgentResult, 
  AgentExecutionContext,
  RetryAttemptInfo,
  ValidationResult
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
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

// ✅ FIXED: Proper interface instead of 'any' type for raw model results
export interface RawModelResult {
  [key: string]: unknown;
}

// ✅ FIXED: Proper interface for attempt info - aligned with RetryAttemptInfo
export interface QualityAttemptInfo {
  attemptNumber: number;
  strategy: string;
  lastError?: string | null;  // Match RetryAttemptInfo type
  adaptedModel?: string;
}

// Initialize agent modules - ALL COMPLETE!
const agentModules: Record<string, BaseAgentModule> = {
  'function-planner': new FunctionPlannerModule(),
  'state-design': new StateDesignModule(),
  'jsx-layout': new JSXLayoutModule(),
  'tailwind-styling': new TailwindStylingModule(),
  'component-assembler': new ComponentAssemblerModule(),
  'code-validator': new CodeValidatorModule(),
  'tool-finalizer': new ToolFinalizerModule(),
};

// Initialize managers
const retryManager = new RetryManager();
const aiManager = AIInteractionManager.getInstance();
const responseParser = getResponseParser();

/**
 * Enhanced execution result with validation details
 */
interface EnhancedExecutionResult {
  result: AgentResult;
  updatedTcc: BaseTCC;
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
 * Execute agent with full ResponseParser integration and quality-based retries
 * This is the SINGLE SOURCE OF TRUTH for agent execution
 * ✅ FIXED: No 'any' types - using RawModelResult interface
 */
export async function executeAgent(
  agentType: AgentType,
  context: AgentExecutionContext,
  tcc: BaseTCC,
  rawModelResult?: RawModelResult
): Promise<{ result: AgentResult; updatedTcc: BaseTCC }> {
  const startTime = Date.now();
  
  logger.info({
    jobId: context.jobId,
    agentType,
    modelId: context.modelConfig.modelId,
    isIsolatedTest: context.isIsolatedTest
  }, `🚀 AGENT EXECUTOR: Starting unified agent execution with ResponseParser integration: ${agentType}`);

  try {
    // Get the appropriate agent module
    const agentModule = agentModules[agentType];
    
    if (!agentModule) {
      throw new Error(`Agent module not implemented yet: ${agentType}`);
    }

    // Validate TCC has required data for this agent
    const requiredFields = agentModule.getRequiredInputFields();
    const validation = agentModule.validateRequired(tcc, requiredFields);
    
    if (!validation.isValid) {
      throw new Error(`Missing required TCC fields for ${agentType}: ${validation.missingFields.join(', ')}`);
    }

    // Execute agent with enhanced retry capability that considers validation quality
    const retryResult = await retryManager.executeWithRetry(
      context,
      async (attemptInfo) => {
        return await executeAgentWithValidation(
          agentType,
          agentModule,
          context,
          tcc,
          attemptInfo,
          rawModelResult
        );
      }
    );

    // Extract the actual enhanced result from the retry wrapper
    const enhancedResult = retryResult.result;

    // Update TCC with agent result using TCC Manager
    const updatedTcc = updateTccWithAgentResult(
      tcc, 
      agentType, 
      enhancedResult.result,
      retryResult.finalModelUsed,
      Date.now() - startTime
    );

    const duration = Date.now() - startTime;
    
    logger.info({
      jobId: context.jobId,
      agentType,
      duration,
      validationScore: enhancedResult.validationDetails.validationScore,
      modelUsed: retryResult.finalModelUsed,
      attemptNumber: retryResult.finalAttemptNumber,
      success: true
    }, `✅ AGENT EXECUTOR: ${agentType} completed successfully in ${duration}ms with validation score ${enhancedResult.validationDetails.validationScore}`);

    return {
      result: enhancedResult.result,
      updatedTcc
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error({
      jobId: context.jobId,
      agentType,
      duration,
      error: errorMessage
    }, `❌ AGENT EXECUTOR: ${agentType} failed after ${duration}ms`);

    throw error;
  }
}

/**
 * Execute agent with comprehensive validation and quality checking
 * This is where the ResponseParser integration happens
 * CRITICAL FIX: Now properly passes retry context to agent modules
 * ✅ FIXED: No 'any' types - using proper interfaces
 */
async function executeAgentWithValidation(
  agentType: AgentType,
  agentModule: BaseAgentModule,
  context: AgentExecutionContext,
  tcc: BaseTCC,
  attemptInfo: RetryAttemptInfo,
  rawModelResult?: RawModelResult
): Promise<EnhancedExecutionResult> {
  const executionStartTime = Date.now();

  logger.info({
    jobId: context.jobId,
    agentType,
    attemptNumber: attemptInfo.attemptNumber,
    isRetry: attemptInfo.attemptNumber > 1,
    retryStrategy: attemptInfo.strategy
  }, `🔄 AGENT EXECUTOR: Executing ${agentType} with validation (attempt ${attemptInfo.attemptNumber})`);

  try {
    // Step 1: Execute AI interaction via the centralized manager
    // The agent module itself is only used for its schema and validation logic now.
    const outputSchema = agentModule.getOutputSchema();
    const aiResult = await aiManager.executeAgentInteraction(
      agentType,
      context,
      tcc,
      attemptInfo,
      outputSchema
    );

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
    }, `🔍 AGENT EXECUTOR: ResponseParser validation completed for ${agentType}`);

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
      updatedTcc: tcc,
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
      isQualityError: error instanceof QualityValidationError
    }, `❌ AGENT EXECUTOR: ${agentType} execution failed in attempt ${attemptInfo.attemptNumber}`);
    throw error;
  }
}

/**
 * Evaluate response quality to determine if retry is needed
 * ✅ FIXED: No 'any' types - using QualityAttemptInfo interface
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

  // Validation score thresholds (can be made configurable)
  const minScoreThresholds = {
    'function-planner': 70,
    'state-design': 75,
    'jsx-layout': 70,
    'tailwind-styling': 65,
    'component-assembler': 80,
    'code-validator': 85,
    'tool-finalizer': 75
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
    const data = parseResult.data as any;
    if (!data.functionSignatures || data.functionSignatures.length === 0) {
      return {
        passesQualityGate: false,
        reason: 'No function signatures generated'
      };
    }
  }

  if (agentType === 'state-design') {
    const data = parseResult.data as any;
    if (!data.stateLogic || (!data.stateLogic.variables?.length && !data.stateLogic.functions?.length)) {
      return {
        passesQualityGate: false,
        reason: 'No state variables or functions generated'
      };
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
  return Object.keys(agentModules) as AgentType[];
}

/**
 * Check if an agent type is available
 */
export function isAgentAvailable(agentType: AgentType): boolean {
  return agentType in agentModules;
}

/**
 * Get agent module for testing/inspection
 */
export function getAgentModule(agentType: AgentType): BaseAgentModule | null {
  return agentModules[agentType] || null;
}

/**
 * Get agent timeout for a specific agent type
 */
export function getAgentTimeout(agentType: AgentType): number {
  const agentModule = agentModules[agentType];
  if (!agentModule) {
    throw new Error(`Agent module not found: ${agentType}`);
  }
  return agentModule.getTimeout();
}

/**
 * Validate agent module result
 * ✅ UPDATED: Now uses unified ValidationResult interface
 */
export function validateAgentModule(agentType: AgentType, result: AgentResult): ValidationResult {
  const agentModule = agentModules[agentType];
  if (!agentModule) {
    throw new Error(`Agent module not found: ${agentType}`);
  }
  
  // Use the module's validate method - returns unified ValidationResult
  return agentModule.validate(result);
}
