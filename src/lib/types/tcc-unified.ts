/**
 * Unified Tool Construction Context (TCC) Interface
 * Phase 1.1: Enhanced Type System for Unified Agent Architecture
 * 
 * This extends the existing TCC with comprehensive typing for the unified system.
 * Eliminates ALL 'any' types and provides proper TypeScript interfaces.
 */

import { z } from 'zod';
import {
  ToolConstructionContext as BaseTCC,
  BrainstormData,
  DefinedFunctionSignature,
  StateLogic,
  JsxLayout,
  Styling,
  ValidationResult,
  FinalProductToolDefinition,
  OrchestrationStep,
  OrchestrationStatus,
  EditModeContext,
  StateVariable,
  StateFunction
} from './product-tool-creation-v2/tcc';

// Enhanced Agent Result Types (Phase 1.1)
export interface FunctionPlannerResult {
  functionSignatures: DefinedFunctionSignature[];
  metadata: {
    totalFunctions: number;
    complexityLevel: 'simple' | 'moderate' | 'complex';
    estimatedImplementationTime: string;
  };
}

export interface StateDesignResult {
  stateLogic: StateLogic;
  metadata: {
    stateVariableCount: number;
    functionCount: number;
    complexityScore: number;
  };
}

export interface JsxLayoutResult {
  jsxLayout: JsxLayout;
  metadata: {
    componentCount: number;
    nestingDepth: number;
    accessibilityScore: number;
  };
}

export interface TailwindStylingResult {
  styling: Styling;
  metadata: {
    classCount: number;
    responsiveBreakpoints: string[];
    colorSchemeType: string;
  };
}

export interface ComponentAssemblerResult {
  assembledCode: string;
  metadata: {
    codeLength: number;
    estimatedRenderTime: string;
    bundleSize: string;
  };
}

export interface CodeValidatorResult {
  validationResult: ValidationResult;
  metadata: {
    issuesFound: number;
    securityScore: number;
    performanceScore: number;
  };
}

export interface ToolFinalizerResult {
  finalProduct: FinalProductToolDefinition;
  metadata: {
    completionTime: string;
    qualityScore: number;
    readinessLevel: 'development' | 'staging' | 'production';
  };
}

// ✅ CRITICAL FIX: Add missing AgentResult union type
export type AgentResult = 
  | FunctionPlannerResult
  | StateDesignResult
  | JsxLayoutResult
  | TailwindStylingResult
  | ComponentAssemblerResult
  | CodeValidatorResult
  | ToolFinalizerResult;

// Agent Type Enumeration
export type AgentType = 
  | 'function-planner'
  | 'state-design' 
  | 'jsx-layout'
  | 'tailwind-styling'
  | 'component-assembler'
  | 'code-validator'
  | 'tool-finalizer';

// Validation Types (Phase 1.1)
export interface ValidationError {
  type: 'syntax' | 'type' | 'logic' | 'security' | 'performance';
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationResultEnhanced extends ValidationResult {
  errors: ValidationError[];
  warnings: ValidationError[];
  suggestions: ValidationError[];
  overallScore: number;
  passesValidation: boolean;
}



// Model Configuration (Phase 1.1)
export interface ModelConfiguration {
  provider: 'openai' | 'anthropic';
  modelId: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

// Agent Execution Context (Phase 1.1)
export interface AgentExecutionContext {
  agentType: AgentType;
  jobId: string;
  userId?: string;
  modelConfig: ModelConfiguration;
  isIsolatedTest: boolean;
  editMode?: EditModeContext;
  timeout: number;
  retryConfig: {
    maxAttempts: number;
    backoffMultiplier: number;
    baseDelay: number;
  };
}

// Unified Tool Construction Context (Phase 1.1)
export interface ToolConstructionContext extends BaseTCC {
  // Enhanced agent results with proper typing
  functionPlannerResult?: FunctionPlannerResult;
  stateDesignResult?: StateDesignResult;
  jsxLayoutResult?: JsxLayoutResult;
  tailwindStylingResult?: TailwindStylingResult;
  componentAssemblerResult?: ComponentAssemblerResult;
  codeValidatorResult?: CodeValidatorResult;
  toolFinalizerResult?: ToolFinalizerResult;

  // Agent execution metadata
  agentExecutionHistory: Array<{
    agentType: AgentType;
    startTime: string;
    endTime?: string;
    duration?: number;
    success: boolean;
    attemptNumber: number;
    modelUsed: string;
    tokensUsed?: number;
    error?: string;
  }>;

  // Enhanced retry tracking
  retryHistory: RetryContext[];
  
  // Model assignment tracking
  modelAssignments: Record<AgentType, string>;
}

// Utility Types (Phase 1.1)
export interface BrainstormFilterContext {
  agentType: AgentType;
  originalDataSize: number;
  filteredDataSize: number;
  reductionPercentage: number;
  fieldsIncluded: string[];
  fieldsExcluded: string[];
}

// Core Brainstorm Data (Phase 1.3 - Enhanced for filtering)
export interface CoreBrainstormData {
  coreConcept: string;
  valueProposition: string;
  toolType: string;
  targetAudience: string;
  keyCalculations: Array<{
    name: string;
    formula: string;
    variables: string[];
    description: string;
  }>;
  calculationLogic: Array<{
    id: string;
    name: string;
    formula: string;
    dependencies: string[];
    outputFormat: string;
    engagementMoment?: string;
  }>;
  suggestedInputs: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    description: string;
    placeholder?: string;
    validation?: string;
    options?: string[];
  }>;
  interactionFlow: Array<{
    step: number;
    title: string;
    description: string;
    userAction: string;
    engagementHook?: string;
  }>;
  leadCaptureStrategy: {
    timing: string;
    method: string;
    incentive: string;
  };
  creativeEnhancements: string[];
}

// Agent-specific filtered brainstorm data interfaces (Phase 1.3)
export interface FunctionPlannerBrainstormData extends CoreBrainstormData {
  // Function Planner needs: Core data + inputs + calculations + flow + enhancements
  // All core fields are included
}

export interface StateDesignBrainstormData extends CoreBrainstormData {
  // State Design needs: Core data + inputs + calculations + calculation logic
  // Excludes: interactionFlow, leadCaptureStrategy, creativeEnhancements
}

export interface JSXLayoutBrainstormData extends CoreBrainstormData {
  // JSX Layout needs: Core data + inputs + interaction flow + calculations + lead capture
  // Excludes: calculationLogic, creativeEnhancements
}

export interface TailwindStylingBrainstormData extends CoreBrainstormData {
  // Tailwind Styling needs: Core data + creative enhancements + lead capture (for styling themes)
  // Excludes: suggestedInputs, keyCalculations, calculationLogic, interactionFlow
}

export interface ComponentAssemblerBrainstormData extends CoreBrainstormData {
  // Component Assembler mainly needs core data for metadata
  // Uses all core fields for context
}

export interface RetryStrategy {
  maxAttempts: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  enablePromptAdaptation: boolean;
  enableModelSwitching: boolean;
  fallbackModels: string[];
}

export interface RetryAttemptInfo {
  attemptNumber: number;
  isFirstAttempt: boolean;
  isSecondAttempt: boolean;
  isThirdAttempt: boolean;
  isFinalAttempt: boolean;
  lastError: string | null;
  strategy: 'standard' | 'conservative' | 'aggressive' | 'structured';
  adaptedModel: string;
  adaptedPromptHints: string[];
}

export interface RetryContext {
  agentType: AgentType;
  jobId: string;
  totalAttempts: number;
  lastError: string | null;
  adaptationHistory: Array<{
    attempt: number;
    error: string;
    strategy: string;
    modelUsed: string;
  }>;
  startTime: number;
}

export interface AgentRetryCapabilities {
  maxAttempts: number;
  supportsPromptAdaptation: boolean;
  supportsModelSwitching: boolean;
  availableFallbackModels: string[];
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
}

// Export types for backward compatibility and module usage
export type {
  StateVariable,
  StateFunction,
  BrainstormData,
  DefinedFunctionSignature,
  StateLogic,
  JsxLayout,
  Styling,
  ValidationResult,
  FinalProductToolDefinition,
  OrchestrationStep,
  OrchestrationStatus,
  EditModeContext
} from './product-tool-creation-v2/tcc';
