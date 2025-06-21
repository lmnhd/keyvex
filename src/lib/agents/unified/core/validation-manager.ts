// Validation Manager - Multi-layer validation with auto-correction
// Schema + Content + Integration + Quality validation

import { AgentType, ToolConstructionContext, ValidationError } from '@/lib/types/tcc-unified';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  correctedData?: any;
  retryRecommended: boolean;
}

export class ValidationManager {
  constructor() {}

  async validateAgentResult(
    agent: AgentType,
    result: any,
    tcc: ToolConstructionContext
  ): Promise<ValidationResult> {
    console.log([Validation Manager] Validating  result...);

    const validationResult: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      retryRecommended: false,
    };

    try {
      // 1. Schema Validation
      const schemaValidation = await this.validateSchema(agent, result);
      if (!schemaValidation.isValid) {
        validationResult.isValid = false;
        validationResult.errors.push(...schemaValidation.errors);
      }

      // 2. Content Validation
      const contentValidation = await this.validateContent(agent, result, tcc);
      if (!contentValidation.isValid) {
        validationResult.isValid = false;
        validationResult.errors.push(...contentValidation.errors);
      }

      // 3. Integration Validation (check compatibility with previous agents)
      const integrationValidation = await this.validateIntegration(agent, result, tcc);
      if (!integrationValidation.isValid) {
        validationResult.isValid = false;
        validationResult.errors.push(...integrationValidation.errors);
      }

      // 4. Quality Validation
      const qualityValidation = await this.validateQuality(agent, result);
      validationResult.warnings.push(...qualityValidation.warnings);

      // 5. Auto-correction attempts
      if (!validationResult.isValid) {
        const correctionResult = await this.attemptAutoCorrection(agent, result, validationResult.errors);
        if (correctionResult.success) {
          validationResult.correctedData = correctionResult.correctedData;
          validationResult.warnings.push(Auto-corrected  issues);
          console.log([Validation Manager] Auto-corrected  result);
        } else {
          validationResult.retryRecommended = true;
        }
      }

      console.log([Validation Manager]  validation complete:, {
        isValid: validationResult.isValid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        autoCorrected: !!validationResult.correctedData,
      });

    } catch (error) {
      console.error([Validation Manager] Validation failed for :, error);
      validationResult.isValid = false;
      validationResult.errors.push({
        type: 'validation_error',
        message: Validation process failed: An item with the specified name C:\Users\Administrator\Dropbox\Source\Projects-25\Keyvex_Project\keyvex_app\src\lib\agents\unified\core already exists. A parameter cannot be found that matches parameter name 'la'. System.Management.Automation.ParseException: At line:1 char:12
+ git add -A && git commit -m "checkpoint: before 6-20 Refactor - begin ...
+            ~~
The token '&&' is not a valid statement separator in this version.
   at System.Management.Automation.Runspaces.PipelineBase.Invoke(IEnumerable input)
   at Microsoft.PowerShell.Executor.ExecuteCommandHelper(Pipeline tempPipeline, Exception& exceptionThrown, ExecutionOptions options) System.Management.Automation.ParseException: At line:1 char:12
+ git add -A && git commit -m "checkpoint: fixed Function Planner isola ...
+            ~~
The token '&&' is not a valid statement separator in this version.
   at System.Management.Automation.Runspaces.PipelineBase.Invoke(IEnumerable input)
   at Microsoft.PowerShell.Executor.ExecuteCommandHelper(Pipeline tempPipeline, Exception& exceptionThrown, ExecutionOptions options) System.Management.Automation.ParseException: At line:1 char:12
+ git add -A && git commit -m "checkpoint: added debug logging to State ...
+            ~~
The token '&&' is not a valid statement separator in this version.
   at System.Management.Automation.Runspaces.PipelineBase.Invoke(IEnumerable input)
   at Microsoft.PowerShell.Executor.ExecuteCommandHelper(Pipeline tempPipeline, Exception& exceptionThrown, ExecutionOptions options) System.Management.Automation.ParseException: At line:1 char:12
+ git add -A && git commit -m "checkpoint: fixed State Design Agent pro ...
+            ~~
The token '&&' is not a valid statement separator in this version.
   at System.Management.Automation.Runspaces.PipelineBase.Invoke(IEnumerable input)
   at Microsoft.PowerShell.Executor.ExecuteCommandHelper(Pipeline tempPipeline, Exception& exceptionThrown, ExecutionOptions options) A parameter cannot be found that matches parameter name 'Chord'. A parameter cannot be found that matches parameter name 'Chord'. A parameter cannot be found that matches parameter name 'Chord'. A parameter cannot be found that matches parameter name 'Chord'.,
        agent,
        severity: 'error',
      });
    }

    return validationResult;
  }

  private async validateSchema(agent: AgentType, result: any): Promise<ValidationResult> {
    // Agent-specific schema validation
    const validators: Record<AgentType, (result: any) => ValidationResult> = {
      'function-planner': this.validateFunctionPlannerSchema,
      'state-design': this.validateStateDesignSchema,
      'jsx-layout': this.validateJSXLayoutSchema,
      'tailwind-styling': this.validateTailwindStylingSchema,
      'component-assembler': this.validateComponentAssemblerSchema,
      'code-validator': this.validateCodeValidatorSchema,
      'tool-finalizer': this.validateToolFinalizerSchema,
    };

    const validator = validators[agent];
    if (!validator) {
      return {
        isValid: false,
        errors: [{
          type: 'schema_error',
          message: No schema validator found for agent: ,
          agent,
          severity: 'error',
        }],
        warnings: [],
        retryRecommended: false,
      };
    }

    return validator.call(this, result);
  }

  private validateFunctionPlannerSchema(result: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!result.functions || !Array.isArray(result.functions)) {
      errors.push({
        type: 'schema_error',
        message: 'Functions array is required',
        agent: 'function-planner',
        severity: 'error',
      });
    }

    if (!result.stateVariables || !Array.isArray(result.stateVariables)) {
      errors.push({
        type: 'schema_error',
        message: 'State variables array is required',
        agent: 'function-planner',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      retryRecommended: errors.length > 0,
    };
  }

  private validateStateDesignSchema(result: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!result.stateLogic || typeof result.stateLogic !== 'string') {
      errors.push({
        type: 'schema_error',
        message: 'State logic string is required',
        agent: 'state-design',
        severity: 'error',
      });
    }

    if (!result.hooks || !Array.isArray(result.hooks)) {
      errors.push({
        type: 'schema_error',
        message: 'Hooks array is required',
        agent: 'state-design',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      retryRecommended: errors.length > 0,
    };
  }

  private validateJSXLayoutSchema(result: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!result.jsxLayout || typeof result.jsxLayout !== 'string') {
      errors.push({
        type: 'schema_error',
        message: 'JSX layout string is required',
        agent: 'jsx-layout',
        severity: 'error',
      });
    }

    if (!result.components || !Array.isArray(result.components)) {
      errors.push({
        type: 'schema_error',
        message: 'Components array is required',
        agent: 'jsx-layout',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      retryRecommended: errors.length > 0,
    };
  }

  private validateTailwindStylingSchema(result: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!result.styledComponent || typeof result.styledComponent !== 'string') {
      errors.push({
        type: 'schema_error',
        message: 'Styled component string is required',
        agent: 'tailwind-styling',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      retryRecommended: errors.length > 0,
    };
  }

  private validateComponentAssemblerSchema(result: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!result.finalComponentCode || typeof result.finalComponentCode !== 'string') {
      errors.push({
        type: 'schema_error',
        message: 'Final component code string is required',
        agent: 'component-assembler',
        severity: 'error',
      });
    }

    if (!result.componentName || typeof result.componentName !== 'string') {
      errors.push({
        type: 'schema_error',
        message: 'Component name string is required',
        agent: 'component-assembler',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      retryRecommended: errors.length > 0,
    };
  }

  private validateCodeValidatorSchema(result: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (typeof result.isValid !== 'boolean') {
      errors.push({
        type: 'schema_error',
        message: 'isValid boolean is required',
        agent: 'code-validator',
        severity: 'error',
      });
    }

    if (!result.validatedCode || typeof result.validatedCode !== 'string') {
      errors.push({
        type: 'schema_error',
        message: 'Validated code string is required',
        agent: 'code-validator',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      retryRecommended: errors.length > 0,
    };
  }

  private validateToolFinalizerSchema(result: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!result.finalTool || typeof result.finalTool !== 'object') {
      errors.push({
        type: 'schema_error',
        message: 'Final tool object is required',
        agent: 'tool-finalizer',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      retryRecommended: errors.length > 0,
    };
  }

  private async validateContent(
    agent: AgentType,
    result: any,
    tcc: ToolConstructionContext
  ): Promise<ValidationResult> {
    // Content validation logic - check for meaningful content
    const warnings: string[] = [];
    const errors: ValidationError[] = [];

    // Check for empty or placeholder content
    if (agent === 'component-assembler' && result.finalComponentCode) {
      if (result.finalComponentCode.includes('TODO') || 
          result.finalComponentCode.includes('PLACEHOLDER') ||
          result.finalComponentCode.length < 500) {
        warnings.push('Component code appears incomplete or contains placeholders');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      retryRecommended: false,
    };
  }

  private async validateIntegration(
    agent: AgentType,
    result: any,
    tcc: ToolConstructionContext
  ): Promise<ValidationResult> {
    // Integration validation - check compatibility with previous agents
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Example: Check if state variables from Function Planner match State Design
    if (agent === 'state-design') {
      const functionPlannerResult = tcc.definedFunctionSignatures;
      if (functionPlannerResult?.functionSignatures) {
        const declaredVariables = functionPlannerResult.functionSignatures.map((f: any) => f.name);
        const stateLogic = result.stateLogic || '';
        
        for (const variable of declaredVariables) {
          if (!stateLogic.includes(variable)) {
            warnings.push(Function "" not found in state logic);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      retryRecommended: false,
    };
  }

  private async validateQuality(agent: AgentType, result: any): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];

    // Quality checks - best practices, performance, etc.
    if (agent === 'component-assembler' && result.finalComponentCode) {
      const code = result.finalComponentCode;
      
      if (!code.includes('React.createElement')) {
        warnings.push('Component should use React.createElement format');
      }
      
      if (code.includes('any')) {
        warnings.push('Component contains "any" types - prefer specific types');
      }
    }

    return { warnings };
  }

  private async attemptAutoCorrection(
    agent: AgentType,
    result: any,
    errors: ValidationError[]
  ): Promise<{
    success: boolean;
    correctedData?: any;
    corrections: string[];
  }> {
    const corrections: string[] = [];
    let correctedData = { ...result };

    // Simple auto-corrections
    for (const error of errors) {
      if (error.type === 'schema_error') {
        // Add missing required fields with defaults
        if (error.message.includes('array is required')) {
          const fieldName = error.message.split(' ')[0].toLowerCase();
          if (!correctedData[fieldName]) {
            correctedData[fieldName] = [];
            corrections.push(Added missing  array);
          }
        }
      }
    }

    return {
      success: corrections.length > 0,
      correctedData: corrections.length > 0 ? correctedData : undefined,
      corrections,
    };
  }
}
