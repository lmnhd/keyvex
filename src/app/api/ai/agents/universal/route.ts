// Universal Agent Route - Phase 2.3 Implementation
// Single route handles all agents with dynamic module execution
// Integrates all 7 agent modules with unified interfaces and validation & retry logic

import { NextRequest, NextResponse } from 'next/server';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

// Import all agent modules
import { 
  executeFunctionPlanner, 
  type FunctionPlannerRequest, 
  type FunctionPlannerResult 
} from '@/lib/agents/unified/modules/function-planner';
import { 
  executeStateDesign, 
  type StateDesignRequest, 
  type StateDesignResult 
} from '@/lib/agents/unified/modules/state-design';
import { 
  executeJSXLayout, 
  type JSXLayoutRequest, 
  type JSXLayoutResult 
} from '@/lib/agents/unified/modules/jsx-layout';
import { 
  executeTailwindStyling, 
  type TailwindStylingRequest, 
  type TailwindStylingResult 
} from '@/lib/agents/unified/modules/tailwind-styling';
import { 
  executeComponentAssembler, 
  type ComponentAssemblerRequest, 
  type ComponentAssemblerResult 
} from '@/lib/agents/unified/modules/component-assembler';
import { 
  executeValidator, 
  type ValidatorRequest, 
  type ValidatorResult 
} from '@/lib/agents/unified/modules/validator';
import { 
  executeToolFinalizer, 
  type ToolFinalizerRequest, 
  type ToolFinalizerResult 
} from '@/lib/agents/unified/modules/tool-finalizer';

// Agent type definitions
export type AgentType = 
  | 'function-planner'
  | 'state-design'
  | 'jsx-layout'
  | 'tailwind-styling'
  | 'component-assembler'
  | 'validator'
  | 'tool-finalizer'
  | 'data-requirements-research';

interface UniversalAgentRequest {
  agent: AgentType;
  jobId: string;
  tcc: ToolConstructionContext;
  selectedModel?: string;
  isIsolatedTest?: boolean;
  editMode?: {
    isEditMode: boolean;
    instructions: Array<{
      targetAgent: string;
      editType: 'refine' | 'replace' | 'enhance';
      instructions: string;
      priority: 'low' | 'medium' | 'high';
      createdAt: string;
    }>;
    context: string;
  };
  retryAttempt?: number;
  previousErrors?: string[];
}

interface UniversalAgentResponse {
  success: boolean;
  result?: any;
  updatedTcc?: ToolConstructionContext;
  error?: string;
  validationErrors?: string[];
  retryRecommended?: boolean;
  validationResult?: {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
    correctedData?: any;
    autoCorrections?: string[];
  };
}

// Validation result interface
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedData?: any;
  autoCorrections: string[];
  retryRecommended: boolean;
}

// Agent execution mapping
type AgentExecutor = (request: any) => Promise<any>;

const AGENT_EXECUTORS: Record<AgentType, AgentExecutor> = {
  'function-planner': executeFunctionPlanner,
  'state-design': executeStateDesign,
  'jsx-layout': executeJSXLayout,
  'tailwind-styling': executeTailwindStyling,
  'component-assembler': executeComponentAssembler,
  'validator': executeValidator,
  'tool-finalizer': executeToolFinalizer,
  'data-requirements-research': async (request: any) => {
    // TODO: Implement data-requirements-research module
    logger.warn({ agent: 'data-requirements-research' }, 'Data requirements research module not yet implemented');
    return {
      success: false,
      error: 'Data requirements research module not yet implemented',
      updatedTcc: request.tcc
    };
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    const body: UniversalAgentRequest = await request.json();
    const { 
      agent, 
      jobId, 
      tcc, 
      selectedModel, 
      isIsolatedTest = false, 
      editMode, 
      retryAttempt = 0, 
      previousErrors = [] 
    } = body;

    logger.info({ 
      agent, 
      jobId, 
      retryAttempt, 
      isIsolatedTest,
      hasEditMode: !!editMode,
      previousErrorsCount: previousErrors.length
    }, `🔄 Universal Agent: Processing ${agent} (attempt ${retryAttempt + 1})`);

    // 1. PARAMETER VALIDATION
    const paramValidation = validateParameters(agent, jobId, tcc);
    if (!paramValidation.isValid) {
      return NextResponse.json({
        success: false,
        error: paramValidation.errors.join(', '),
        validationErrors: paramValidation.errors
      } as UniversalAgentResponse);
    }

    // 2. AGENT EXECUTOR VALIDATION
    if (!AGENT_EXECUTORS[agent]) {
      return NextResponse.json({
        success: false,
        error: `Unknown agent type: ${agent}`,
      } as UniversalAgentResponse);
    }

    // 3. PREPARE AGENT REQUEST with retry context
    const agentRequest = {
      jobId,
      selectedModel,
      tcc,
      isIsolatedTest,
      editMode: enhanceEditModeWithRetryContext(editMode, previousErrors, retryAttempt),
      retryAttempt,
      previousErrors
    };

    logger.info({ 
      agent, 
      jobId,
      tccKeys: Object.keys(tcc),
      tccStatus: tcc.status,
      modelSelected: selectedModel || 'default',
      enhancedEditMode: !!agentRequest.editMode?.isEditMode
    }, `🔄 Universal Agent: Executing ${agent} module with enhanced context`);

    // 4. EXECUTE AGENT MODULE
    const executor = AGENT_EXECUTORS[agent];
    const result = await executor(agentRequest);

    const executionTime = Date.now() - startTime;

    logger.info({ 
      agent, 
      jobId,
      success: result.success,
      hasError: !!result.error,
      hasUpdatedTcc: !!result.updatedTcc,
      executionTime
    }, `🔄 Universal Agent: ${agent} execution completed`);

    // 5. RESULT VALIDATION & RETRY LOGIC
    if (!result.success) {
      logger.error({ 
        agent, 
        jobId, 
        error: result.error,
        retryAttempt,
        executionTime
      }, `🔄 Universal Agent: ${agent} execution failed`);

      return NextResponse.json({
        success: false,
        error: result.error,
        retryRecommended: retryAttempt < 2,
        validationResult: {
          isValid: false,
          errors: [result.error],
          warnings: [],
          autoCorrections: [],
          retryRecommended: retryAttempt < 2
        }
      } as UniversalAgentResponse);
    }

    // 6. COMPREHENSIVE VALIDATION of successful results
    const validationResult = await validateAgentResult(agent, result, tcc, retryAttempt);
    
    // 7. RETRY LOGIC - If validation fails and retry is recommended
    if (!validationResult.isValid && validationResult.retryRecommended && retryAttempt < 2) {
      logger.warn({ 
        agent, 
        jobId, 
        validationErrors: validationResult.errors,
        warnings: validationResult.warnings,
        retryAttempt,
        autoCorrections: validationResult.autoCorrections
      }, `🔄 Universal Agent: ${agent} validation failed, recommending retry`);

      return NextResponse.json({
        success: false,
        error: `Validation failed: ${validationResult.errors.join(', ')}`,
        validationErrors: validationResult.errors,
        retryRecommended: true,
        validationResult
      } as UniversalAgentResponse);
    }

    // 8. USE CORRECTED DATA if auto-correction was applied
    const finalResult = validationResult.correctedData || result;
    const finalResultData = finalResult.result || finalResult[getResultKey(agent)];

    // 9. SUCCESS RESPONSE with validation details
    logger.info({ 
      agent, 
      jobId,
      resultKeys: Object.keys(finalResult),
      updatedTccStatus: finalResult.updatedTcc?.status,
      validationPassed: validationResult.isValid,
      autoCorrectionApplied: !!validationResult.correctedData,
      warningsCount: validationResult.warnings.length,
      executionTime
    }, `🔄 Universal Agent: ${agent} completed successfully with validation`);

    return NextResponse.json({
      success: true,
      result: finalResultData,
      updatedTcc: finalResult.updatedTcc,
      validationResult: {
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        autoCorrections: validationResult.autoCorrections
      }
    } as UniversalAgentResponse);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const executionTime = Date.now() - startTime;
    
    logger.error({ 
      error: errorMessage, 
      executionTime,
      retryAttempt: body?.retryAttempt || 0
    }, '🔄 Universal Agent: Unexpected error');
    
    return NextResponse.json({
      success: false,
      error: `Unexpected error: ${errorMessage}`,
      retryRecommended: (body?.retryAttempt || 0) < 2,
    } as UniversalAgentResponse);
  }
}

// VALIDATION FUNCTIONS

function validateParameters(agent: AgentType, jobId: string, tcc: ToolConstructionContext): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!agent) errors.push('Missing required parameter: agent');
  if (!jobId) errors.push('Missing required parameter: jobId');
  if (!tcc) errors.push('Missing required parameter: tcc');
  
  // TCC structure validation
  if (tcc) {
    if (!tcc.jobId) errors.push('TCC missing required field: jobId');
    if (!tcc.userId) errors.push('TCC missing required field: userId (WebSocket emission will fail)');
    if (jobId !== tcc.jobId) errors.push('Request jobId does not match TCC jobId');
  }

  return { isValid: errors.length === 0, errors };
}

function enhanceEditModeWithRetryContext(
  editMode: any, 
  previousErrors: string[], 
  retryAttempt: number
): any {
  if (previousErrors.length === 0) return editMode;

  // Enhance edit mode with retry context for AI to understand what failed
  const retryInstructions = {
    targetAgent: 'current',
    editType: 'refine' as const,
    instructions: `RETRY CONTEXT (Attempt ${retryAttempt + 1}): Previous attempt failed with errors: ${previousErrors.join('; ')}. Please address these specific issues while maintaining all core functionality.`,
    priority: 'high' as const,
    createdAt: new Date().toISOString()
  };

  if (!editMode) {
    return {
      isEditMode: true,
      instructions: [retryInstructions],
      context: 'Retry with error correction'
    };
  }

  return {
    ...editMode,
    isEditMode: true,
    instructions: [...(editMode.instructions || []), retryInstructions],
    context: `${editMode.context || ''} | Retry Context: ${previousErrors.length} errors to fix`
  };
}

async function validateAgentResult(
  agent: AgentType,
  result: any,
  tcc: ToolConstructionContext,
  retryAttempt: number
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const autoCorrections: string[] = [];
  let correctedData = null;

  try {
    // 1. SCHEMA VALIDATION - Check if result has expected structure
    const schemaValidation = validateResultSchema(agent, result);
    errors.push(...schemaValidation.errors);
    warnings.push(...schemaValidation.warnings);

    // 2. CONTENT VALIDATION - Check if result content is meaningful
    const contentValidation = validateResultContent(agent, result, tcc);
    errors.push(...contentValidation.errors);
    warnings.push(...contentValidation.warnings);

    // 3. AUTO-CORRECTION ATTEMPTS - Try to fix common issues
    if (errors.length > 0) {
      const correctionResult = attemptAutoCorrection(agent, result, errors);
      if (correctionResult.success) {
        correctedData = correctionResult.correctedData;
        autoCorrections.push(...correctionResult.corrections);
        
        // Re-validate corrected data
        const revalidation = validateResultSchema(agent, correctedData);
        if (revalidation.errors.length === 0) {
          errors.length = 0; // Clear errors if correction worked
        }
      }
    }

    // 4. RETRY RECOMMENDATION LOGIC
    const retryRecommended = errors.length > 0 && retryAttempt < 2 && canRetryForAgent(agent, errors);

    logger.info({
      agent,
      validationSummary: {
        errorsCount: errors.length,
        warningsCount: warnings.length,
        autoCorrectionsCount: autoCorrections.length,
        retryRecommended,
        retryAttempt
      }
    }, `🔄 Universal Agent: Validation completed for ${agent}`);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      correctedData,
      autoCorrections,
      retryRecommended
    };

  } catch (validationError) {
    logger.error({ agent, validationError }, `🔄 Universal Agent: Validation error for ${agent}`);
    return {
      isValid: false,
      errors: [`Validation error: ${validationError}`],
      warnings: [],
      autoCorrections: [],
      retryRecommended: retryAttempt < 2
    };
  }
}

function validateResultSchema(agent: AgentType, result: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!result) {
    errors.push('Result is null or undefined');
    return { errors, warnings };
  }

  if (!result.success) {
    errors.push('Result indicates failure');
  }

  if (!result.updatedTcc) {
    errors.push('Missing updatedTcc in result');
  }

  // Agent-specific schema validation
  const expectedKey = getResultKey(agent);
  if (!result[expectedKey] && !result.result) {
    errors.push(`Missing expected result key: ${expectedKey}`);
  }

  // Check for common schema issues
  if (result.updatedTcc && typeof result.updatedTcc !== 'object') {
    errors.push('updatedTcc is not an object');
  }

  return { errors, warnings };
}

function validateResultContent(agent: AgentType, result: any, tcc: ToolConstructionContext): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Agent-specific content validation
  switch (agent) {
    case 'function-planner':
      if (result.functionSignatures && result.functionSignatures.length === 0) {
        warnings.push('No function signatures generated');
      }
      break;
    
    case 'state-design':
      if (result.stateLogic) {
        if (!result.stateLogic.variables || result.stateLogic.variables.length === 0) {
          warnings.push('No state variables defined');
        }
        if (!result.stateLogic.functions || result.stateLogic.functions.length === 0) {
          warnings.push('No state functions defined');
        }
      }
      break;
    
    case 'component-assembler':
      if (result.assembledComponent) {
        if (!result.assembledComponent.finalComponentCode) {
          errors.push('Missing final component code');
        } else if (result.assembledComponent.finalComponentCode.length < 100) {
          warnings.push('Component code seems too short');
        }
      }
      break;
    
    case 'validator':
      if (result.validationResult && !result.validationResult.hasOwnProperty('isValid')) {
        errors.push('Validation result missing isValid field');
      }
      break;
  }

  return { errors, warnings };
}

function attemptAutoCorrection(agent: AgentType, result: any, errors: string[]): { success: boolean; correctedData?: any; corrections: string[] } {
  const corrections: string[] = [];
  let correctedData = { ...result };

  try {
    // Common auto-corrections
    if (errors.includes('Missing updatedTcc in result') && result.tcc) {
      correctedData.updatedTcc = result.tcc;
      corrections.push('Added missing updatedTcc field');
    }

    if (errors.includes('Result indicates failure') && result.error) {
      // If there's useful data despite the error, try to salvage it
      if (result[getResultKey(agent)]) {
        correctedData.success = true;
        corrections.push('Overrode success flag due to valid result data');
      }
    }

    // Agent-specific auto-corrections
    switch (agent) {
      case 'component-assembler':
        if (errors.includes('Missing final component code') && result.assembledComponent) {
          if (result.assembledComponent.componentCode) {
            correctedData.assembledComponent.finalComponentCode = result.assembledComponent.componentCode;
            corrections.push('Mapped componentCode to finalComponentCode');
          }
        }
        break;
    }

    return {
      success: corrections.length > 0,
      correctedData: corrections.length > 0 ? correctedData : undefined,
      corrections
    };

  } catch (error) {
    return { success: false, corrections: [] };
  }
}

function canRetryForAgent(agent: AgentType, errors: string[]): boolean {
  // Don't retry for certain types of errors
  const nonRetryableErrors = [
    'Missing required parameter',
    'Unknown agent type',
    'TCC missing required field'
  ];

  return !errors.some(error => 
    nonRetryableErrors.some(nonRetryable => error.includes(nonRetryable))
  );
}

// Helper function to get the result key for each agent
function getResultKey(agent: AgentType): string {
  const resultKeys: Record<AgentType, string> = {
    'function-planner': 'functionSignatures',
    'state-design': 'stateLogic',
    'jsx-layout': 'jsxLayout',
    'tailwind-styling': 'styling',
    'component-assembler': 'assembledComponent',
    'validator': 'validationResult',
    'tool-finalizer': 'finalizedTool',
    'data-requirements-research': 'researchData'
  };
  
  return resultKeys[agent] || 'result';
}

// GET method for health check and agent status
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'health') {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      availableAgents: Object.keys(AGENT_EXECUTORS),
      version: '2.3-enhanced',
      features: ['validation', 'retry', 'auto-correction', 'comprehensive-logging']
    });
  }

  if (action === 'agents') {
    return NextResponse.json({
      agents: Object.keys(AGENT_EXECUTORS).map(agent => ({
        name: agent,
        implemented: agent !== 'data-requirements-research',
        module: `@/lib/agents/unified/modules/${agent}`,
        validation: 'enabled',
        retry: 'enabled',
        autoCorrection: 'enabled'
      }))
    });
  }

  return NextResponse.json({
    message: 'Universal Agent Route - Phase 2.3 Enhanced',
    features: [
      'Multi-layer validation (schema + content + auto-correction)',
      'Intelligent retry logic with error context',
      'Auto-correction for common issues',
      'Comprehensive logging and metrics'
    ],
    usage: {
      POST: 'Execute agent with { agent, jobId, tcc, selectedModel?, isIsolatedTest?, editMode?, retryAttempt?, previousErrors? }',
      'GET?action=health': 'Health check with feature status',
      'GET?action=agents': 'List available agents with capabilities'
    }
  });
} 