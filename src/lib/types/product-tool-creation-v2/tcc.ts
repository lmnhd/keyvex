import { z } from 'zod';

// --- Brainstorm Data Schema (Phase 1: Full Brainstorm Data Integration) ---
// This schema captures the complete brainstorm output structure for full agent integration
export const BrainstormDataSchema = z.object({
  // Core concept (handle both spellings for backward compatibility)
  coreConcept: z.string().optional(),
  coreWConcept: z.string().optional(), // Handle potential typo in legacy data
  
  // Value proposition
  valueProposition: z.string(),
  
  // Key calculations for the tool
  keyCalculations: z.array(z.object({
    name: z.string(),
    formula: z.string(),
    description: z.string(),
    variables: z.array(z.string()),
  })),
  
  // User interaction flow steps
  interactionFlow: z.array(z.object({
    step: z.number(),
    title: z.string(),
    description: z.string(),
    userAction: z.string(),
    engagementHook: z.string().optional(),
  })),
  
  // Lead capture strategy
  leadCaptureStrategy: z.object({
    timing: z.string(),
    method: z.string(),
    incentive: z.string(),
  }),
  
  // Creative enhancements suggested by AI
  creativeEnhancements: z.array(z.string()),
  
  // Suggested input fields for the tool
  suggestedInputs: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string(),
  })),
  
  // Detailed calculation logic for implementation
  calculationLogic: z.array(z.object({
    id: z.string(),
    name: z.string(),
    formula: z.string(),
    dependencies: z.array(z.string()),
    outputFormat: z.string(),
    engagementMoment: z.string().optional(),
  })),
  
  // Prompt options that guided the brainstorm generation
  promptOptions: z.object({
    includeComprehensiveColors: z.boolean(),
    includeGorgeousStyling: z.boolean(),
    includeAdvancedLayouts: z.boolean(),
    styleComplexity: z.string(),
    industryFocus: z.string().optional(),
    toolComplexity: z.string(),
  }),

  // 🆕 NEW: Research Agent Requirements from Logic Architect
  researchAgentRequirements: z.string().optional().describe('What data/research the Research Agent needs to populate for this tool to work'),

  // 🆕 NEW: Data Requirements & Research Agent fields (optional for backward compatibility)
  dataRequirements: z.object({
    hasExternalDataNeeds: z.boolean().describe('Whether this tool requires external data'),
    requiredDataTypes: z.array(z.string()).describe('Types of external data needed'),
    researchQueries: z.array(z.object({
      query: z.string(),
      domain: z.string(),
      dataType: z.enum(['regulatory', 'market_pricing', 'geographic', 'industry_standards', 'tax_rates', 'statistical', 'other']),
      priority: z.enum(['high', 'medium', 'low']),
      locationDependent: z.boolean(),
      expectedDataStructure: z.string()
    }))
  }).optional().describe('Analysis of external data requirements'),

  mockData: z.record(z.any()).optional().describe('Generated mock data organized by category'),
  researchData: z.record(z.any()).optional().describe('Generated research data organized by category'),
  
  userDataInstructions: z.object({
    summary: z.string().describe('Summary of what data the app user (tool creator) needs to provide to make this tool work'),
    dataNeeded: z.array(z.string()).describe('List of specific data the app user needs to provide (e.g., "Current tax rates for your state", "Industry-specific pricing data")'),
    format: z.string().describe('Instructions on how the app user should format or obtain the required data')
  }).optional().describe('Instructions for the app user (tool creator) about what data they need to provide to make the tool functional'),

}).passthrough(); // Allow additional fields for future brainstorm enhancements

export type BrainstormData = z.infer<typeof BrainstormDataSchema>;

// --- Phase 2: Edit Mode Infrastructure ---
// Schema for tracking edit history of agent outputs
export const AgentEditHistorySchema = z.object({
  agentName: z.string(), // e.g., 'function-planner', 'jsx-layout', 'tailwind-styling'
  versions: z.array(z.object({
    versionNumber: z.number(),
    output: z.any(), // The actual agent output (function signatures, jsx layout, etc.)
    createdAt: z.string().datetime(),
    isCurrentVersion: z.boolean(),
    editInstructions: z.string().optional(), // User feedback that triggered this edit
    editReason: z.string().optional(), // Reason for the edit (e.g., 'user_feedback', 'validation_error')
  })),
});
export type AgentEditHistory = z.infer<typeof AgentEditHistorySchema>;

// Schema for edit mode instructions
export const EditModeInstructionsSchema = z.object({
  targetAgent: z.string(), // Which agent to edit (e.g., 'jsx-layout', 'tailwind-styling')
  editType: z.enum(['refine', 'replace', 'enhance']), // Type of edit requested
  instructions: z.string(), // Specific instructions from user
  previousVersion: z.number().optional(), // Which version to edit from
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  createdAt: z.string().datetime(),
});
export type EditModeInstructions = z.infer<typeof EditModeInstructionsSchema>;

// Schema for edit mode context
export const EditModeContextSchema = z.object({
  isEditMode: z.boolean(),
  activeEditInstructions: z.array(EditModeInstructionsSchema).optional(),
  editHistory: z.array(AgentEditHistorySchema).optional(),
  totalEdits: z.number(),
  lastEditedAt: z.string().datetime().optional(),
});
export type EditModeContext = z.infer<typeof EditModeContextSchema>;

// --- Start: Schemas based on product-tool.ts interfaces ---
// Duplicating/Adapting Zod schema definitions here to avoid circular dependencies
// or for cases where product-tool.ts only exports types and not Zod schemas.
// Long-term, product-tool.ts should export these Zod schemas if they are canonical.

export const ProductToolMetadataSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  shortDescription: z.string(),
  type: z.string(),
  category: z.string(),
  targetAudience: z.string(),
  industry: z.string(),
  tags: z.array(z.string()),
  estimatedCompletionTime: z.number(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  features: z.array(z.string()),
  icon: z.object({
    type: z.enum(['lucide', 'emoji']),
    value: z.string(),
  }),
});
export type ProductToolMetadata = z.infer<typeof ProductToolMetadataSchema>;

export const ToolColorSchemeSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  surface: z.string(),
  text: z.object({
    primary: z.string(),
    secondary: z.string(),
    muted: z.string(),
  }),
  border: z.string(),
  success: z.string(),
  warning: z.string(),
  error: z.string(),
});
export type ToolColorScheme = z.infer<typeof ToolColorSchemeSchema>;

// This is the Zod schema for the final ProductToolDefinition output
export const FinalProductToolDefinitionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  version: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  createdAt: z.number(),
  updatedAt: z.number(),
  createdBy: z.string(),
  metadata: ProductToolMetadataSchema,
  componentSet: z.enum(['shadcn', 'legacy']),
  componentCode: z.string(),
  colorScheme: ToolColorSchemeSchema,
  initialStyleMap: z.record(z.string()).optional(),
  currentStyleMap: z.record(z.string()).optional(),
  analytics: z.object({
    enabled: z.boolean(),
    completions: z.number(),
    averageTime: z.number(),
  }),
});
export type FinalProductToolDefinition = z.infer<typeof FinalProductToolDefinitionSchema>;
// --- End: Schemas based on product-tool.ts interfaces ---

// Progress event schema for the progressLog
export const ProgressEventSchema = z.object({
  timestamp: z.string().datetime(),
  stepName: z.string(),
  status: z.enum(['initiated', 'started', 'in_progress', 'llm_call_pending', 'llm_data_received', 'completed', 'failed', 'skipped']),
  message: z.string(),
  details: z.any().optional(), // For any specific data related to the event
});
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;

// Schema for function signatures planned by the FunctionSignaturePlannerAgent
export const DefinedFunctionSignatureSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(), // For AI context, how the function should behave
  // parameters: z.array(z.object({ name: z.string(), type: z.string() })).optional(), // Future enhancement
  // returnType: z.string().optional(), // Future enhancement
});
export type DefinedFunctionSignature = z.infer<typeof DefinedFunctionSignatureSchema>;

// Schema for state variables
export const StateVariableSchema = z.object({
  name: z.string().min(1),
  initialValue: z.any().optional(), // Can be a string representation like "'default text'" or "0" or "true"
  type: z.string().optional(), // e.g., 'string', 'number', 'boolean', 'array', 'object'
  description: z.string().optional(), // Description for AI context
});
export type StateVariable = z.infer<typeof StateVariableSchema>;

// Schema for functions defined by the StateDesignAgent
export const StateFunctionSchema = z.object({
  name: z.string().min(1), // Should match a name from DefinedFunctionSignatureSchema
  body: z.string().min(1), // The JavaScript function body as a string
  dependencies: z.array(z.string()).optional(), // Other state or props it depends on
  description: z.string().optional(), // Description for AI context
});
export type StateFunction = z.infer<typeof StateFunctionSchema>;

// Schema for the stateLogic part of the TCC
export const StateLogicSchema = z.object({
  variables: z.array(StateVariableSchema),
  functions: z.array(StateFunctionSchema),
  imports: z.array(z.string()).optional(), // e.g., ['useState', 'useEffect']
  // Backward compatibility aliases
  stateVariables: z.array(StateVariableSchema).optional(),
});
export type StateLogic = z.infer<typeof StateLogicSchema>;

// Schema for the jsxLayout part of the TCC
export const JsxLayoutSchema = z.object({
  componentStructure: z.string(), // The actual JSX structure as string
  elementMap: z.array(z.object({
    elementId: z.string(),
    type: z.string(),
    purpose: z.string(),
    placeholderClasses: z.array(z.string()),
  })),
  accessibilityFeatures: z.array(z.string()),
  responsiveBreakpoints: z.array(z.string()),
  // Keep original fields for backward compatibility
  structure: z.any().optional(), 
  definedElements: z.array(z.string()).optional(),
  elementToLogicMap: z.record(z.string(), z.string()).optional(),
});
export type JsxLayout = z.infer<typeof JsxLayoutSchema>;

// Schema for the styling object from the TailwindStylingAgent
export const StylingSchema = z.object({
  styledComponentCode: z.string(),
  styleMap: z.record(z.string(), z.string()), // Maps data-style-id to a Tailwind class string
  colorScheme: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    surface: z.string(),
    text: z.object({
      primary: z.string(),
      secondary: z.string(),
      muted: z.string(),
    }),
    border: z.string(),
    success: z.string(),
    warning: z.string(),
    error: z.string(),
  }),
  designTokens: z.object({
    spacing: z.record(z.string(), z.string()),
    typography: z.record(z.string(), z.string()),
    shadows: z.record(z.string(), z.string()),
    animations: z.record(z.string(), z.string()),
  }),
});
export type Styling = z.infer<typeof StylingSchema>;

// Schema for tailwindStyles part of the TCC
export const TailwindStylesSchema = z.record(z.string(), z.string()); // Maps element keys to Tailwind class strings
export type TailwindStyles = z.infer<typeof TailwindStylesSchema>;

// Schema for the validationResult from the Validation Service
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  error: z.string().optional(),
  details: z.any().optional(), // E.g., Babel codeFrame
  // We might want to include the transpiled code if the validation service provides it and it's useful
  // transpiledCode: z.string().optional(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Orchestration steps enum
export const OrchestrationStepEnum = z.enum([
  'initialization',
  'planning_function_signatures',
  'designing_state_logic', // Added for State Design Agent
  'designing_jsx_layout', // Added for JSX Layout Agent
  'waiting_for_parallel_completion',
  'applying_tailwind_styling', // Added for Tailwind Styling Agent
  'generating_styles', // Keep for backward compatibility
  'assembling_component',
  'validating_code',
  'finalizing_tool',
  'completed',
  'failed',
  // Backward compatibility
  'generating_state_logic'
]);
export type OrchestrationStep = z.infer<typeof OrchestrationStepEnum>;

export const OrchestrationStatusEnum = z.enum([
  'pending',
  'in_progress',
  'success',
  'completed', // Added for step completion
  'error',
  'retrying'
]);
export type OrchestrationStatus = z.infer<typeof OrchestrationStatusEnum>;

// The main ToolConstructionContext (TCC) schema
export const ToolConstructionContextSchema = z.object({
  jobId: z.string().uuid(),
  userId: z.string().optional(), // To associate with the user who initiated
  selectedModel: z.string().optional(), // Model ID chosen for generation
  agentModelMapping: z.record(z.string(), z.string()).optional(), // Agent-specific model assignments
  currentOrchestrationStep: OrchestrationStepEnum,
  status: OrchestrationStatusEnum, // Overall status of this job
  userInput: z.object({ // Original user input that started the process
    description: z.string(),
    // Potentially other fields from the initial user request form
    targetAudience: z.string().optional(),
    industry: z.string().optional(),
    toolType: z.string().optional(),
    features: z.array(z.string()).optional(),
    // ... any other fields that define the tool request
  }),
  
  // Phase 1: Rich brainstorm data integration
  brainstormData: BrainstormDataSchema.optional(), // Complete brainstorm output for enhanced agent context
  
  // Phase 2: Edit mode infrastructure
  editModeContext: EditModeContextSchema.optional(), // Edit mode tracking and instructions
  
  // Main properties
  definedFunctionSignatures: z.array(DefinedFunctionSignatureSchema).optional(),
  stateLogic: StateLogicSchema.optional(),
  jsxLayout: JsxLayoutSchema.optional(),
  styling: StylingSchema.optional(),
  tailwindStyles: TailwindStylesSchema.optional(),
  
  // Raw assembled component code produced by the ComponentAssemblerAgent (used for preview fallback)
  assembledComponentCode: z.string().optional(),
  
  // Backward compatibility aliases
  functionSignatures: z.array(DefinedFunctionSignatureSchema).optional(),
  targetAudience: z.string().optional(), // Top-level for backward compatibility
  additionalContext: z.any().optional(), // Additional context data
  
  // Steps tracking for orchestration
  steps: z.object({
    dataRequirementsResearch: z.object({
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      status: OrchestrationStatusEnum.optional(),
      result: z.any().optional(),
    }).optional(),
    designingStateLogic: z.object({
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      status: OrchestrationStatusEnum.optional(),
      result: z.any().optional(),
    }).optional(),
    designingJsxLayout: z.object({
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      status: OrchestrationStatusEnum.optional(),
      result: z.any().optional(),
    }).optional(),
    applyingTailwindStyling: z.object({
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      status: OrchestrationStatusEnum.optional(),
      result: z.any().optional(),
    }).optional(),
    assemblingComponent: z.object({
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      status: OrchestrationStatusEnum.optional(),
      result: z.any().optional(),
    }).optional(),
    validatingCode: z.object({
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      status: OrchestrationStatusEnum.optional(),
      result: z.any().optional(),
    }).optional(),
  }).optional(),
  
  validationResult: z.any().optional(),
  
  // ✅ SINGLE SOURCE OF TRUTH: All component code lives here after Tool Finalizer completes
  finalProduct: z.any().optional(),

  // Timestamps and versioning
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  
  // Versioning for the TCC itself, if we want to track schema changes of TCC
  tccVersion: z.string().default('1.0.0'), 
});

export type ToolConstructionContext = z.infer<typeof ToolConstructionContextSchema>;

// Placeholder for TCC schema
export const TCC_VERSION = '1.0.0';

// --- Phase 2: Edit Mode Helper Functions ---

/**
 * Adds edit instructions to a TCC and switches it to edit mode
 */
export function addEditInstructions(
  tcc: ToolConstructionContext,
  targetAgent: string,
  instructions: string,
  editType: 'refine' | 'replace' | 'enhance' = 'refine',
  priority: 'low' | 'medium' | 'high' = 'medium'
): ToolConstructionContext {
  const editInstruction: EditModeInstructions = {
    targetAgent,
    editType,
    instructions,
    priority,
    createdAt: new Date().toISOString(),
  };

  const updatedTcc: ToolConstructionContext = {
    ...tcc,
    editModeContext: {
      isEditMode: true,
      activeEditInstructions: [
        ...(tcc.editModeContext?.activeEditInstructions || []),
        editInstruction
      ],
      editHistory: tcc.editModeContext?.editHistory,
      totalEdits: tcc.editModeContext?.totalEdits || 0,
      lastEditedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  return updatedTcc;
}

/**
 * Records a new version of an agent's output in the edit history
 */
export function recordAgentOutputVersion(
  tcc: ToolConstructionContext,
  agentName: string,
  output: any,
  editInstructions?: string,
  editReason?: string
): ToolConstructionContext {
  const existingHistory = tcc.editModeContext?.editHistory?.find(h => h.agentName === agentName);
  const newVersionNumber = existingHistory ? Math.max(...existingHistory.versions.map(v => v.versionNumber)) + 1 : 1;

  const newVersion = {
    versionNumber: newVersionNumber,
    output,
    createdAt: new Date().toISOString(),
    isCurrentVersion: true,
    editInstructions,
    editReason,
  };

  let updatedEditHistory: AgentEditHistory[];

  if (existingHistory) {
    // Mark previous versions as not current
    const updatedVersions = existingHistory.versions.map(v => ({ ...v, isCurrentVersion: false }));
    updatedVersions.push(newVersion);
    
    updatedEditHistory = (tcc.editModeContext?.editHistory || []).map(h => 
      h.agentName === agentName 
        ? { ...h, versions: updatedVersions }
        : h
    );
  } else {
    // Create new agent history entry
    const newAgentHistory: AgentEditHistory = {
      agentName,
      versions: [newVersion],
    };
    
    updatedEditHistory = [
      ...(tcc.editModeContext?.editHistory || []),
      newAgentHistory
    ];
  }

  const updatedTcc: ToolConstructionContext = {
    ...tcc,
    editModeContext: {
      isEditMode: tcc.editModeContext?.isEditMode || false,
      activeEditInstructions: tcc.editModeContext?.activeEditInstructions,
      editHistory: updatedEditHistory,
      totalEdits: (tcc.editModeContext?.totalEdits || 0) + 1,
      lastEditedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  return updatedTcc;
}

/**
 * Gets the current version of an agent's output from edit history
 */
export function getCurrentAgentOutput(tcc: ToolConstructionContext, agentName: string): any | null {
  const agentHistory = tcc.editModeContext?.editHistory?.find(h => h.agentName === agentName);
  if (!agentHistory) return null;
  
  const currentVersion = agentHistory.versions.find(v => v.isCurrentVersion);
  return currentVersion?.output || null;
}

/**
 * Gets a specific version of an agent's output from edit history
 */
export function getAgentOutputVersion(tcc: ToolConstructionContext, agentName: string, versionNumber: number): any | null {
  const agentHistory = tcc.editModeContext?.editHistory?.find(h => h.agentName === agentName);
  if (!agentHistory) return null;
  
  const version = agentHistory.versions.find(v => v.versionNumber === versionNumber);
  return version?.output || null;
}

/**
 * Clears active edit instructions after they've been processed
 */
export function clearActiveEditInstructions(tcc: ToolConstructionContext, targetAgent?: string): ToolConstructionContext {
  let filteredInstructions = tcc.editModeContext?.activeEditInstructions || [];
  
  if (targetAgent) {
    // Clear only instructions for specific agent
    filteredInstructions = filteredInstructions.filter(inst => inst.targetAgent !== targetAgent);
  } else {
    // Clear all instructions
    filteredInstructions = [];
  }

  const updatedTcc: ToolConstructionContext = {
    ...tcc,
    editModeContext: {
      isEditMode: filteredInstructions.length > 0, // Exit edit mode if no active instructions
      activeEditInstructions: filteredInstructions.length > 0 ? filteredInstructions : undefined,
      editHistory: tcc.editModeContext?.editHistory,
      totalEdits: tcc.editModeContext?.totalEdits || 0,
      lastEditedAt: tcc.editModeContext?.lastEditedAt,
    },
    updatedAt: new Date().toISOString(),
  };

  return updatedTcc;
}

/**
 * Checks if TCC is in edit mode for a specific agent
 */
export function isAgentInEditMode(tcc: ToolConstructionContext, agentName: string): boolean {
  if (!tcc.editModeContext?.isEditMode) return false;
  
  return tcc.editModeContext.activeEditInstructions?.some(inst => inst.targetAgent === agentName) || false;
}

/**
 * Gets active edit instructions for a specific agent
 */
export function getActiveEditInstructions(tcc: ToolConstructionContext, agentName: string): EditModeInstructions[] {
  if (!tcc.editModeContext?.activeEditInstructions) return [];
  
  return tcc.editModeContext.activeEditInstructions.filter(inst => inst.targetAgent === agentName);
}

/**
 * Gets the full edit history for an agent
 */
export function getAgentEditHistory(tcc: ToolConstructionContext, agentName: string): AgentEditHistory | null {
  return tcc.editModeContext?.editHistory?.find(h => h.agentName === agentName) || null;
}

// Helper function to create a new TCC
export function createTCC(
  jobId: string, 
  userInput: any, 
  userId?: string,
  brainstormData?: BrainstormData // Phase 1: Accept brainstorm data
): ToolConstructionContext {
  return {
    jobId,
    userId: userId || undefined,
    selectedModel: undefined,
    agentModelMapping: undefined,
    currentOrchestrationStep: 'initialization',
    status: 'pending',
    userInput,
    brainstormData: brainstormData || undefined, // Phase 1: Include brainstorm data
    editModeContext: { // Phase 2: Initialize edit mode context
      isEditMode: false,
      activeEditInstructions: undefined,
      editHistory: undefined,
      totalEdits: 0,
      lastEditedAt: undefined,
    },
    definedFunctionSignatures: undefined,
    stateLogic: undefined,
    jsxLayout: undefined,
    styling: undefined,
    tailwindStyles: undefined,
    functionSignatures: undefined,
    targetAudience: userInput.targetAudience,
    additionalContext: undefined,
    steps: undefined,
    validationResult: undefined,
    finalProduct: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tccVersion: TCC_VERSION,
  };
}
