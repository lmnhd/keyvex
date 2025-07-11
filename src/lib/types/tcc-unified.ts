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
  MockData,
  DefinedFunctionSignature,
  StateLogic,
  OrchestrationStep,
  OrchestrationStatus,
  EditModeContext,
  StateVariable,
  StateFunction
} from './product-tool-creation-v2/tcc';
import { ProductToolDefinition } from './product-tool';

// ✅ NEW: Type for initializing the TCC
export interface InitialTcc {
  userId: string;
  jobId: string;
  userInput: {
    description: string; // Required by base TCC schema
    toolType?: string;
    targetAudience?: string;
    businessContext?: string;
    selectedModel?: string;
    industry?: string;
    features?: string[];
  };
  brainstormData: BrainstormData;
  agentModelMapping: Record<AgentType, string>;
  stepStatus?: Record<string, 'pending' | 'in_progress' | 'completed' | 'failed'>;
}

// ✅ UNIFIED VALIDATION RESULT - SINGLE SOURCE OF TRUTH
// Replaces BaseValidationResult, ValidationResult, ValidationResultEnhanced, ValidationResultDetail
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
  score: number; // 0-100 quality score
  overallScore?: number; // Alias for backward compatibility
  missingFields: string[];
  details?: any; // For additional validation context (e.g., Babel codeFrame)
  passesValidation?: boolean; // Alias for isValid for backward compatibility
}

// Validation Error Types (Enhanced)
export interface ValidationError {
  type: 'syntax' | 'type' | 'logic' | 'security' | 'performance';
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

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

// ✅ MISSING TYPE: Add JsxLayout interface referenced by JsxLayoutResult
export interface JsxLayout {
  componentStructure: string;
  elementMap: Array<{ elementId: string; type: string; purpose: string; placeholderClasses: string[]; }>;
  accessibilityFeatures: string[];
  responsiveBreakpoints: string[];
}

// ✅ MISSING TYPE: Add Styling interface referenced by TailwindStylingResult
export interface Styling {
  styledComponentCode: string;
  styleMap: Record<string, string>;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: { primary: string; secondary: string; muted: string };
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  designTokens: {
    spacing: Record<string, string>;
    typography: Record<string, string>;
    shadows: Record<string, string>;
    animations: Record<string, string>;
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
    assemblyMethod: 'programmatic' | 'programmatic-jsx';
    componentsAssembled: string[];
    // 🔄 PHASE 2: JSX-specific metadata fields (optional for backward compatibility)
    jsxFormat?: 'jsx';
    requiresTranspilation?: boolean;
    hasStateVariables?: boolean;
    hasFunctions?: boolean;
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

// Re-export BrainstormDataSchema for convenience across modules
export { BrainstormDataSchema } from './product-tool-creation-v2/tcc';

export interface ToolFinalizerResult {
  finalProduct: ProductToolDefinition;
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

// ✅ CENTRALIZED: Import ModelConfiguration from dedicated module
import { ModelConfiguration } from '../ai/model-configuration';

// Agent Execution Context (Phase 1.1)
export interface AgentExecutionContext {
  agentType: AgentType;
  jobId: string;
  userId?: string;
  modelConfig: ModelConfiguration;
  isIsolatedTest: boolean;
  editMode?: EditModeContext;
  timeout: number;
  /**
   * Optional container for ad-hoc parameters passed by orchestration wrappers
   * (e.g., state-design loop). Kept generic and strongly typed as Record<string, unknown>.
   */
  additionalInput?: Record<string, unknown>;

  retryConfig: {
    maxAttempts: number;
    backoffMultiplier: number;
    baseDelay: number;
  };
}

// Unified Tool Construction Context (Phase 1.1)
export interface ToolConstructionContext extends BaseTCC {
  // REMOVED UNUSED FIELDS: Individual agent result fields were never used in the codebase
  // The system actually uses the base TCC fields directly:
  // - tcc.functionSignatures (not tcc.functionPlannerResult)
  // - tcc.stateLogic (not tcc.stateDesignResult)
  // - tcc.jsxLayout (not tcc.jsxLayoutResult)
  // - tcc.styling (not tcc.tailwindStylingResult)
  // - tcc.finalProduct (not tcc.toolFinalizerResult)

  // 🔄 PHASE 2: Component assembler output fields (for UI display)
  assembledComponentCode?: string; // Raw assembled component code (JSX or React.createElement)
  assembledComponent?: {           // Structured component data
    finalComponentCode?: string;
    metadata?: ComponentAssemblerResult['metadata'];
  };

  // Agent execution metadata (optional for backward compatibility)
  agentExecutionHistory?: Array<{
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

  // Enhanced retry tracking (optional for backward compatibility)
  retryHistory?: RetryContext[];
  
  // Model assignment tracking (optional for backward compatibility)
  modelAssignments?: Record<AgentType, string>;
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
  
  // NEW: Add research and mock data fields to the core data type
  dataRequirements?: BrainstormData['dataRequirements'];
  mockData?: BrainstormData['mockData'];
  researchData?: BrainstormData['researchData'];
  userDataInstructions?: BrainstormData['userDataInstructions'];
}

// Agent-specific filtered brainstorm data interfaces (Phase 1.3)
// ✅ SIMPLIFIED: Removed redundant types that were identical to CoreBrainstormData

// Agents that need ALL brainstorm data use CoreBrainstormData directly:
// - Function Planner: Uses CoreBrainstormData (was FunctionPlannerBrainstormData)
// - Component Assembler: Uses CoreBrainstormData (was ComponentAssemblerBrainstormData)

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
  strategy: 'standard' | 'validation-focused' | 'conservative' | 'aggressive';
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
export {
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from './product-tool-creation-v2/tcc';

export type {
  StateVariable,
  StateFunction,
  BrainstormData,
  DefinedFunctionSignature,
  StateLogic,
  JsxLayout as JsxLayoutType,
  Styling as StylingType,
  OrchestrationStep,
  OrchestrationStatus,
  EditModeContext
} from './product-tool-creation-v2/tcc';

// Re-export centralized types for backward compatibility
export type { ModelConfiguration } from '../ai/model-configuration';

export type { MockData } from './product-tool-creation-v2/tcc';
