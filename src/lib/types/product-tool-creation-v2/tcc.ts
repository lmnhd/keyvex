import { z } from 'zod';

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
});
export type StateVariable = z.infer<typeof StateVariableSchema>;

// Schema for functions defined by the StateDesignAgent
export const StateFunctionSchema = z.object({
  name: z.string().min(1), // Should match a name from DefinedFunctionSignatureSchema
  body: z.string().min(1), // The JavaScript function body as a string
  dependencies: z.array(z.string()).optional(), // Other state or props it depends on
});
export type StateFunction = z.infer<typeof StateFunctionSchema>;

// Schema for the stateLogic part of the TCC
export const StateLogicSchema = z.object({
  variables: z.array(StateVariableSchema),
  functions: z.array(StateFunctionSchema),
  imports: z.array(z.string()).optional(), // e.g., ['useState', 'useEffect']
});
export type StateLogic = z.infer<typeof StateLogicSchema>;

// Schema for the jsxLayout part of the TCC
// Using z.any() for structure initially, can be refined to a specific AST-like schema later
export const JsxLayoutSchema = z.object({
  structure: z.any(), // Could be a string template or a structured object/AST
  definedElements: z.array(z.string()), // Keys/IDs of elements that can be styled or interacted with
  elementToLogicMap: z.record(z.string(), z.string()), // Maps element keys to exact function names from DefinedFunctionSignatureSchema
});
export type JsxLayout = z.infer<typeof JsxLayoutSchema>;

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
  'generating_state_logic',
  'generating_jsx_layout',
  'waiting_for_parallel_completion',
  'generating_styles',
  'assembling_component',
  'validating_code',
  'finalizing_tool',
  'completed',
  'failed'
]);
export type OrchestrationStep = z.infer<typeof OrchestrationStepEnum>;

export const OrchestrationStatusEnum = z.enum([
  'pending',
  'in_progress',
  'success',
  'error',
  'retrying'
]);
export type OrchestrationStatus = z.infer<typeof OrchestrationStatusEnum>;

// The main ToolConstructionContext (TCC) schema
export const ToolConstructionContextSchema = z.object({
  jobId: z.string().uuid(),
  userId: z.string().optional(), // To associate with the user who initiated
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
  
  definedFunctionSignatures: z.array(DefinedFunctionSignatureSchema).optional(),
  stateLogic: StateLogicSchema.optional(),
  jsxLayout: JsxLayoutSchema.optional(),
  tailwindStyles: TailwindStylesSchema.optional(),
  
  assembledComponentCode: z.string().optional(), // The full .tsx code string
  validationResult: ValidationResultSchema.optional(),
  
  progressLog: z.array(ProgressEventSchema).default([]),
  
  // The final output, conforming to the existing ProductToolDefinition
  // This is populated at the 'finalizing_tool' step.
  finalProductToolDefinition: FinalProductToolDefinitionSchema.optional(),

  // For managing retries or specific error states
  errorDetails: z.object({
    message: z.string().optional(),
    stepFailed: OrchestrationStepEnum.optional(),
    attempts: z.number().optional(),
  }).optional(),

  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().default(() => new Date().toISOString()),
  
  // Versioning for the TCC itself, if we want to track schema changes of TCC
  tccVersion: z.string().default('1.0.0'), 
});

export type ToolConstructionContext = z.infer<typeof ToolConstructionContextSchema>;

// Placeholder for TCC schema
export const TCC_VERSION = '1.0.0'; 