/**
 * TCC Manager (Phase 1.1 - Core Infrastructure)
 * Centralized TCC state management with strongly typed updates
 * NO GENERIC TYPES - Only strongly typed interfaces
 */

import { 
  AgentType,
  FunctionPlannerResult,
  StateDesignResult,
  JsxLayoutResult,
  TailwindStylingResult,
  ComponentAssemblerResult,
  CodeValidatorResult,
  ToolFinalizerResult,
  ToolConstructionContext,
  OrchestrationStep
} from '../../../types/tcc-unified';
import { ToolConstructionContext as BaseTCC } from '../../../types/product-tool-creation-v2/tcc';
import logger from '../../../logger';

/**
 * Union type for all possible agent results - strongly typed
 */
type AgentResult = 
  | FunctionPlannerResult
  | StateDesignResult
  | JsxLayoutResult
  | TailwindStylingResult
  | ComponentAssemblerResult
  | CodeValidatorResult
  | ToolFinalizerResult;

// Enhanced TCC update tracking with detailed variable monitoring
interface TccUpdateDetails {
  agentType: AgentType;
  beforeState: Partial<ToolConstructionContext>;
  afterState: Partial<ToolConstructionContext>;
  fieldsAdded: string[];
  fieldsModified: string[];
  fieldsDeleted: string[];
  dataMetrics: {
    totalFields: number;
    newFieldCount: number;
    modifiedFieldCount: number;
    totalDataSize: number;
  };
  executionContext: {
    modelUsed: string;
    executionTime: number;
    jobId: string;
    userId?: string;
  };
}

/**
 * Update TCC with agent result - SINGLE SOURCE OF TRUTH for TCC mutations
 * Each agent type has its own specific update logic
 * Works with existing base TCC structure
 */
export function updateTccWithAgentResult(
  tcc: BaseTCC,
  agentType: AgentType,
  result: AgentResult,
  modelUsed: string,
  executionTime: number
): BaseTCC {
  const startTime = Date.now();
  
  // Capture BEFORE state for detailed comparison
  const beforeState = JSON.parse(JSON.stringify(tcc));
  
  logger.info({
    jobId: tcc.jobId,
    agentType,
    modelUsed,
    executionTime,
    tccFieldsBefore: Object.keys(tcc).length,
    currentStep: tcc.currentOrchestrationStep,
    userId: tcc.userId
  }, `🔍 TCC-MANAGER: Starting TCC update for ${agentType} with comprehensive variable tracking`);

  // Create updated TCC - shallow copy to avoid mutation
  const updatedTcc: BaseTCC = {
    ...tcc,
    updatedAt: new Date().toISOString()
  };

  // Agent-specific TCC updates using switch statement for type safety
  // Only update fields that exist in the base TCC schema
  switch (agentType) {
    case 'function-planner': {
      const functionPlannerResult = result as FunctionPlannerResult;
      updatedTcc.definedFunctionSignatures = functionPlannerResult.functionSignatures;
      updatedTcc.currentOrchestrationStep = 'designing_state_logic' as OrchestrationStep;
      
      // LOG DETAILED FUNCTION SIGNATURE VARIABLES
      logger.info({
        jobId: tcc.jobId,
        agentType,
        functionSignatureData: {
          functionCount: functionPlannerResult.functionSignatures.length,
          functionNames: functionPlannerResult.functionSignatures.map(f => f.name),
          totalParameters: functionPlannerResult.functionSignatures.reduce((sum, f) => sum + (f.parameters?.length || 0), 0),
          parameterDetails: functionPlannerResult.functionSignatures.map(f => ({
            name: f.name,
            paramCount: f.parameters?.length || 0,
            returnType: f.returnType,
            hasImplementation: !!f.implementation
          }))
        }
      }, `📝 TCC-VARIABLE-CHANGE: Function signatures defined - ${functionPlannerResult.functionSignatures.length} functions with detailed parameter tracking`);
      break;
    }

    case 'state-design': {
      const stateDesignResult = result as StateDesignResult;
      updatedTcc.stateLogic = stateDesignResult.stateLogic;
      updatedTcc.currentOrchestrationStep = 'designing_jsx_layout' as OrchestrationStep;
      
      // LOG DETAILED STATE VARIABLE CHANGES
      logger.info({
        jobId: tcc.jobId,
        agentType,
        stateVariableData: {
          variableCount: stateDesignResult.metadata.stateVariableCount,
          functionCount: stateDesignResult.metadata.functionCount,
          importCount: stateDesignResult.metadata.importCount,
          variableDetails: stateDesignResult.metadata.stateVariables.map(v => ({
            name: v.name,
            type: v.type,
            initialValue: v.initialValue,
            hasDescription: !!v.description
          })),
          functionDetails: stateDesignResult.metadata.functions.map(f => ({
            name: f.name,
            parameterCount: f.parameters?.length || 0,
            returnType: f.returnType,
            bodyLength: f.body?.length || 0,
            dependencyCount: f.dependencies?.length || 0
          })),
          importsUsed: stateDesignResult.metadata.imports
        }
      }, `📝 TCC-VARIABLE-CHANGE: State logic defined - ${stateDesignResult.metadata.stateVariables.length} variables, ${stateDesignResult.metadata.functions.length} functions`);
      break;
    }

    case 'jsx-layout': {
      const jsxLayoutResult = result as JsxLayoutResult;
      updatedTcc.jsxLayout = jsxLayoutResult.jsxLayout;
      updatedTcc.currentOrchestrationStep = 'applying_tailwind_styling' as OrchestrationStep;
      
      // LOG DETAILED JSX LAYOUT VARIABLES
      logger.info({
        jobId: tcc.jobId,
        agentType,
        jsxLayoutData: {
          componentStructureLength: jsxLayoutResult.metadata.componentStructure?.length || 0,
          elementCount: jsxLayoutResult.metadata.elementMap?.length || 0,
          accessibilityFeatureCount: jsxLayoutResult.metadata.accessibilityFeatures?.length || 0,
          elementTypes: jsxLayoutResult.metadata.elementMap?.map(e => e.type) || [],
          elementPurposes: jsxLayoutResult.metadata.elementMap?.map(e => e.purpose) || [],
          accessibilityFeatures: jsxLayoutResult.metadata.accessibilityFeatures || []
        }
      }, `📝 TCC-VARIABLE-CHANGE: JSX layout defined - ${jsxLayoutResult.metadata.elementMap?.length || 0} elements with accessibility features`);
      break;
    }

    case 'tailwind-styling': {
      const tailwindStylingResult = result as TailwindStylingResult;
      updatedTcc.styling = tailwindStylingResult.styling;
      updatedTcc.currentOrchestrationStep = 'assembling_component' as OrchestrationStep;
      
      // LOG DETAILED STYLING VARIABLES
      logger.info({
        jobId: tcc.jobId,
        agentType,
        stylingData: {
          styledComponentCodeLength: tailwindStylingResult.metadata.styledComponentCode?.length || 0,
          styleMapKeys: Object.keys(tailwindStylingResult.metadata.styleMap || {}).length,
          colorSchemeKeys: Object.keys(tailwindStylingResult.metadata.colorScheme || {}).length,
          primaryColor: tailwindStylingResult.metadata.colorScheme?.primary,
          secondaryColor: tailwindStylingResult.metadata.colorScheme?.secondary,
          accentColor: tailwindStylingResult.metadata.colorScheme?.accent,
          textColors: tailwindStylingResult.metadata.colorScheme?.text,
          hasResponsiveFeatures: tailwindStylingResult.metadata.styledComponentCode?.includes('responsive') || false,
          hasAnimations: tailwindStylingResult.metadata.styledComponentCode?.includes('animate') || false
        }
      }, `📝 TCC-VARIABLE-CHANGE: Styling defined - ${Object.keys(tailwindStylingResult.metadata.styleMap || {}).length} style mappings with color scheme`);
      break;
    }

    case 'component-assembler': {
      const componentAssemblerResult = result as ComponentAssemblerResult;
      updatedTcc.assembledComponentCode = componentAssemblerResult.assembledCode;
      updatedTcc.currentOrchestrationStep = 'validating_code' as OrchestrationStep;
      
      // LOG DETAILED ASSEMBLY VARIABLES
      logger.info({
        jobId: tcc.jobId,
        agentType,
        assemblyData: {
          assembledCodeLength: componentAssemblerResult.metadata.codeLength,
          hasImports: componentAssemblerResult.metadata.imports?.length > 0 || false,
          hasExports: componentAssemblerResult.metadata.exports?.length > 0 || false,
          hasUseState: componentAssemblerResult.metadata.useStateCount > 0 || false,
          hasUseEffect: componentAssemblerResult.metadata.useEffectCount > 0 || false,
          hasEventHandlers: componentAssemblerResult.metadata.eventHandlers?.length > 0 || false,
          componentName: extractComponentName(componentAssemblerResult.metadata.code),
          estimatedLineCount: componentAssemblerResult.metadata.code?.split('\n').length || 0
        }
      }, `📝 TCC-VARIABLE-CHANGE: Component assembled - ${componentAssemblerResult.metadata.codeLength} characters with React hooks integration`);
      break;
    }

    case 'code-validator': {
      const codeValidatorResult = result as CodeValidatorResult;
      updatedTcc.validationResult = codeValidatorResult.validationResult;
      updatedTcc.currentOrchestrationStep = 'finalizing_tool' as OrchestrationStep;
      
      // LOG DETAILED VALIDATION VARIABLES
      logger.info({
        jobId: tcc.jobId,
        agentType,
        validationData: {
          isValid: codeValidatorResult.validationResult?.isValid || false,
          errorCount: codeValidatorResult.validationResult?.issues?.length || 0,
          warningCount: codeValidatorResult.validationResult?.warnings?.length || 0,
          suggestionCount: codeValidatorResult.validationResult?.suggestions?.length || 0,
          specificIssues: codeValidatorResult.validationResult?.issues || [],
          specificWarnings: codeValidatorResult.validationResult?.warnings || [],
          validationScore: calculateValidationScore(codeValidatorResult.validationResult)
        }
      }, `📝 TCC-VARIABLE-CHANGE: Code validation completed - ${codeValidatorResult.validationResult?.issues?.length || 0} issues, ${codeValidatorResult.validationResult?.warnings?.length || 0} warnings`);
      break;
    }

    case 'tool-finalizer': {
      const toolFinalizerResult = result as ToolFinalizerResult;
      updatedTcc.finalProduct = toolFinalizerResult.finalProduct;
      updatedTcc.status = 'completed';
      updatedTcc.currentOrchestrationStep = 'completed' as OrchestrationStep;
      
      // LOG DETAILED FINAL PRODUCT VARIABLES
      logger.info({
        jobId: tcc.jobId,
        agentType,
        finalProductData: {
          productId: toolFinalizerResult.finalProduct?.id,
          componentCodeLength: toolFinalizerResult.finalProduct?.componentCode?.length || 0,
          metadataKeys: Object.keys(toolFinalizerResult.finalProduct?.metadata || {}).length,
          colorSchemeKeys: Object.keys(toolFinalizerResult.finalProduct?.colorScheme || {}).length,
          hasMetadata: !!toolFinalizerResult.finalProduct?.metadata,
          hasColorScheme: !!toolFinalizerResult.finalProduct?.colorScheme,
          toolName: toolFinalizerResult.finalProduct?.metadata?.toolName,
          toolDescription: toolFinalizerResult.finalProduct?.metadata?.description
        }
      }, `📝 TCC-VARIABLE-CHANGE: Final product created - Tool ${toolFinalizerResult.finalProduct?.id} with complete metadata`);
      break;
    }

    default: {
      // TypeScript exhaustiveness check - this should never happen
      const exhaustiveCheck: never = agentType;
      throw new Error(`Unknown agent type: ${exhaustiveCheck}`);
    }
  }

  // Capture AFTER state for detailed comparison
  const afterState = JSON.parse(JSON.stringify(updatedTcc));
  
  // Generate comprehensive change analysis
  const changeAnalysis = generateTccChangeAnalysis(beforeState, afterState, agentType);
  
  // LOG COMPREHENSIVE TCC CHANGE SUMMARY
  logger.info({
    jobId: tcc.jobId,
    agentType,
    modelUsed,
    executionTime,
    tccUpdateDetails: {
      fieldsAdded: changeAnalysis.fieldsAdded,
      fieldsModified: changeAnalysis.fieldsModified,
      fieldsDeleted: changeAnalysis.fieldsDeleted,
      totalFieldsBefore: changeAnalysis.totalFieldsBefore,
      totalFieldsAfter: changeAnalysis.totalFieldsAfter,
      dataGrowth: changeAnalysis.dataGrowth,
      significantChanges: changeAnalysis.significantChanges
    },
    processingTime: Date.now() - startTime
  }, `🎯 TCC-MANAGER: Comprehensive TCC update completed for ${agentType} - ${changeAnalysis.fieldsAdded.length} added, ${changeAnalysis.fieldsModified.length} modified`);

  return updatedTcc;
}

/**
 * Generate detailed TCC change analysis for comprehensive logging
 */
function generateTccChangeAnalysis(
  beforeState: ToolConstructionContext, 
  afterState: ToolConstructionContext,
  agentType: AgentType
): {
  fieldsAdded: string[];
  fieldsModified: string[];
  fieldsDeleted: string[];
  totalFieldsBefore: number;
  totalFieldsAfter: number;
  dataGrowth: number;
  significantChanges: string[];
} {
  const beforeKeys = new Set(Object.keys(beforeState));
  const afterKeys = new Set(Object.keys(afterState));
  
  const fieldsAdded = Array.from(afterKeys).filter(key => !beforeKeys.has(key));
  const fieldsDeleted = Array.from(beforeKeys).filter(key => !afterKeys.has(key));
  const fieldsModified: string[] = [];
  const significantChanges: string[] = [];
  
  // Check for modifications in existing fields
  for (const key of beforeKeys) {
    if (afterKeys.has(key)) {
      const beforeValue = JSON.stringify((beforeState as any)[key]);
      const afterValue = JSON.stringify((afterState as any)[key]);
      
      if (beforeValue !== afterValue) {
        fieldsModified.push(key);
        
        // Track significant changes
        if (key === 'definedFunctionSignatures' && afterValue !== 'undefined') {
          significantChanges.push('Function signatures defined');
        }
        if (key === 'stateLogic' && afterValue !== 'undefined') {
          significantChanges.push('State logic implemented');
        }
        if (key === 'jsxLayout' && afterValue !== 'undefined') {
          significantChanges.push('JSX layout designed');
        }
        if (key === 'styling' && afterValue !== 'undefined') {
          significantChanges.push('Styling applied');
        }
        if (key === 'assembledComponentCode' && afterValue !== 'undefined') {
          significantChanges.push('Component assembled');
        }
        if (key === 'validationResult' && afterValue !== 'undefined') {
          significantChanges.push('Code validation completed');
        }
        if (key === 'finalProduct' && afterValue !== 'undefined') {
          significantChanges.push('Final product created');
        }
      }
    }
  }
  
  const beforeSize = JSON.stringify(beforeState).length;
  const afterSize = JSON.stringify(afterState).length;
  const dataGrowth = afterSize - beforeSize;
  
  return {
    fieldsAdded,
    fieldsModified,
    fieldsDeleted,
    totalFieldsBefore: beforeKeys.size,
    totalFieldsAfter: afterKeys.size,
    dataGrowth,
    significantChanges
  };
}

/**
 * Extract component name from assembled code
 */
function extractComponentName(code?: string): string | null {
  if (!code) return null;
  
  const match = code.match(/(?:export\s+default\s+function\s+|function\s+|const\s+)(\w+)/);
  return match ? match[1] : null;
}

/**
 * Calculate validation score from validation result
 */
function calculateValidationScore(validationResult?: any): number {
  if (!validationResult) return 0;
  
  let score = 100;
  const errors = validationResult.issues?.length || 0;
  const warnings = validationResult.warnings?.length || 0;
  
  score -= errors * 15; // Deduct 15 points per error
  score -= warnings * 5; // Deduct 5 points per warning
  
  return Math.max(0, score);
}

/**
 * Validate TCC state for a specific agent execution
 * Ensures required dependencies are present
 */
export function validateTccForAgent(tcc: BaseTCC, agentType: AgentType): {
  isValid: boolean;
  missingDependencies: string[];
  errors: string[];
} {
  const missingDependencies: string[] = [];
  const errors: string[] = [];

  switch (agentType) {
    case 'function-planner':
      // Function planner needs brainstorm data
      if (!tcc.brainstormData) {
        missingDependencies.push('brainstormData');
        errors.push('Function planner requires brainstorm data');
      }
      break;

    case 'state-design':
      // State design needs function signatures
      if (!tcc.definedFunctionSignatures || tcc.definedFunctionSignatures.length === 0) {
        missingDependencies.push('definedFunctionSignatures');
        errors.push('State design requires function signatures from function planner');
      }
      break;

    case 'jsx-layout':
      // JSX layout needs state logic
      if (!tcc.stateLogic) {
        missingDependencies.push('stateLogic');
        errors.push('JSX layout requires state logic from state design');
      }
      break;

    case 'tailwind-styling':
      // Tailwind styling needs JSX layout
      if (!tcc.jsxLayout) {
        missingDependencies.push('jsxLayout');
        errors.push('Tailwind styling requires JSX layout');
      }
      break;

    case 'component-assembler':
      // Component assembler needs state logic, JSX layout, and styling
      if (!tcc.stateLogic) {
        missingDependencies.push('stateLogic');
        errors.push('Component assembler requires state logic');
      }
      if (!tcc.jsxLayout) {
        missingDependencies.push('jsxLayout');
        errors.push('Component assembler requires JSX layout');
      }
      if (!tcc.styling) {
        missingDependencies.push('styling');
        errors.push('Component assembler requires styling');
      }
      break;

    case 'code-validator':
      // Code validator needs assembled component code
      if (!tcc.finalProduct || !(tcc.finalProduct as any).componentCode) {
        missingDependencies.push('finalProduct.componentCode');
        errors.push('Code validator requires assembled component code');
      }
      break;

    case 'tool-finalizer':
      // Tool finalizer needs validation results
      if (!tcc.validationResult) {
        missingDependencies.push('validationResult');
        errors.push('Tool finalizer requires validation results');
      }
      break;

    default: {
      const exhaustiveCheck: never = agentType;
      errors.push(`Unknown agent type: ${exhaustiveCheck}`);
    }
  }

  const isValid = missingDependencies.length === 0 && errors.length === 0;

  logger.info({
    jobId: tcc.jobId,
    agentType,
    isValid,
    missingDependencies,
    errorCount: errors.length
  }, `🔍 TCC MANAGER: TCC validation for ${agentType} - ${isValid ? 'VALID' : 'INVALID'}`);

  return {
    isValid,
    missingDependencies,
    errors
  };
}

/**
 * Get TCC completion status
 * Shows which agents have completed successfully
 */
export function getTccCompletionStatus(tcc: BaseTCC): {
  completedAgents: AgentType[];
  remainingAgents: AgentType[];
  completionPercentage: number;
  isComplete: boolean;
} {
  const allAgents: AgentType[] = [
    'function-planner',
    'state-design',
    'jsx-layout',
    'tailwind-styling',
    'component-assembler',
    'code-validator',
    'tool-finalizer'
  ];

  const completedAgents: AgentType[] = [];
  
  // Check which agents have completed based on TCC state
  if (tcc.definedFunctionSignatures && tcc.definedFunctionSignatures.length > 0) {
    completedAgents.push('function-planner');
  }
  if (tcc.stateLogic) {
    completedAgents.push('state-design');
  }
  if (tcc.jsxLayout) {
    completedAgents.push('jsx-layout');
  }
  if (tcc.styling) {
    completedAgents.push('tailwind-styling');
  }
  if (tcc.finalProduct && (tcc.finalProduct as any).componentCode) {
    completedAgents.push('component-assembler');
  }
  if (tcc.validationResult) {
    completedAgents.push('code-validator');
  }
  if (tcc.finalProduct && tcc.validationResult) {
    completedAgents.push('tool-finalizer');
  }

  const remainingAgents = allAgents.filter(agent => !completedAgents.includes(agent));
  const completionPercentage = Math.round((completedAgents.length / allAgents.length) * 100);
  const isComplete = completedAgents.length === allAgents.length;

  return {
    completedAgents,
    remainingAgents,
    completionPercentage,
    isComplete
  };
}
