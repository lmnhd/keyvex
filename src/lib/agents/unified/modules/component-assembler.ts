/**
 * Component Assembler Programmatic Module (Phase 1.2 - Programmatic Assembly)
 * 
 * CRITICAL ARCHITECTURAL CHANGE: This is NOT an AI agent - it's a programmatic module
 * that mechanically combines State Logic + JSX Layout + Tailwind Styling into a final
 * React component and converts JSX to React.createElement() structure.
 * 
 * NO AI INFERENCE - Pure code transformation and assembly.
 */

import { z } from 'zod';
import { 
  ComponentAssemblerResult,
  ToolConstructionContext,
  ValidationResult,
  StateLogic,
  StateVariable,
  StateFunction
} from '../../../types/tcc-unified';
import { 
  BaseAgentModule
} from '../core/base-agent-module';
import logger from '../../../logger';

/**
 * Zod schema for the Component Assembler's programmatic output.
 */
const ComponentAssemblerResultSchema = z.object({
  assembledCode: z.string(),
  metadata: z.object({
    codeLength: z.number(),
    estimatedRenderTime: z.string(),
    bundleSize: z.string(),
    assemblyMethod: z.literal('programmatic'),
    componentsAssembled: z.array(z.string())
  })
});

/**
 * ComponentAssemblerModule - Programmatic assembly of React components
 * 
 * This module performs DETERMINISTIC operations:
 * 1. Takes state variables from State Design Agent
 * 2. Takes JSX structure from JSX Layout Agent  
 * 3. Takes styling from Tailwind Styling Agent
 * 4. Mechanically combines them into final React component
 * 5. Converts JSX syntax to React.createElement() calls
 */
export class ComponentAssemblerModule extends BaseAgentModule {
  constructor() {
    super('component-assembler', 10000); // 10 second timeout for assembly operations
  }

  /**
   * Exposes the Zod schema for this module's output.
   */
  getOutputSchema(): z.ZodSchema<any> {
    return ComponentAssemblerResultSchema;
  }

  /**
   * Programmatically assemble the component from TCC data
   * NO AI CALLS - Pure code transformation
   */
  assembleComponent(tcc: ToolConstructionContext): ComponentAssemblerResult {
    const startTime = Date.now();
    
    logger.info({
      jobId: tcc.jobId,
      agentType: 'component-assembler',
      method: 'programmatic'
    }, '🔧 COMPONENT ASSEMBLER: Starting programmatic assembly');

    try {
      // Extract required components
      const stateLogic = tcc.stateLogic;
      const jsxLayout = tcc.jsxLayout;
      const styling = tcc.styling;

      if (!stateLogic || !jsxLayout || !styling) {
        throw new Error('Missing required components for assembly');
      }

      // Step 1: Generate state declarations
      const stateDeclarations = this.generateStateDeclarations(stateLogic);
      
      // Step 2: Generate function definitions
      const functionDefinitions = this.generateFunctionDefinitions(stateLogic);
      
      // Step 3: Generate missing event handlers
      const eventHandlerDefinitions = this.generateEventHandlers(
        jsxLayout.componentStructure,
        stateLogic.variables || [],
        stateLogic.functions || []
      );

      // Step 4: 🔄 PHASE 2: Process JSX with styling (keep as JSX)
      const processedJsx = this.processJsxWithStyling(
        jsxLayout.componentStructure,
        styling.styleMap || {}
      );
      
      // Step 5: 🔄 PHASE 2: Assemble final JSX component
      const assembledCode = this.assembleFinalComponent(
        stateDeclarations,
        functionDefinitions,
        eventHandlerDefinitions,
        processedJsx,
        tcc.brainstormData?.coreConcept || 'GeneratedTool'
      );

      const assemblyTime = Date.now() - startTime;
      
      logger.info({
        jobId: tcc.jobId,
        agentType: 'component-assembler',
        assemblyTime,
        codeLength: assembledCode.length,
        stateVariables: stateLogic.variables?.length || 0,
        functions: stateLogic.functions?.length || 0
      }, '✅ COMPONENT ASSEMBLER: Programmatic assembly completed');

      // 🔍 CRITICAL DEBUG: Log the actual assembled code for verification
      logger.info({
        jobId: tcc.jobId,
        agentType: 'component-assembler',
        assembledCodePreview: assembledCode.substring(0, 500) + '...',
        assembledCodeLength: assembledCode.length,
        assembledCodeHash: assembledCode ? require('crypto').createHash('md5').update(assembledCode).digest('hex').slice(0, 8) : 'none'
      }, '🔍 COMPONENT ASSEMBLER: Assembled code preview');

      return {
        assembledCode,
        metadata: {
          codeLength: assembledCode.length,
          estimatedRenderTime: `${Math.ceil(assembledCode.length / 1000)}ms`,
          bundleSize: `${Math.ceil(assembledCode.length / 1024)}KB`,
          assemblyMethod: 'programmatic-jsx' as const, // 🔄 PHASE 2: JSX assembly method
          componentsAssembled: [
            'state-logic',
            'jsx-layout', 
            'tailwind-styling'
          ],
          // 🔄 PHASE 2: JSX-specific metadata
          jsxFormat: 'jsx' as const,
          requiresTranspilation: true,
          hasStateVariables: (stateLogic.variables?.length || 0) > 0,
          hasFunctions: (stateLogic.functions?.length || 0) > 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        jobId: tcc.jobId,
        agentType: 'component-assembler',
        error: errorMessage
      }, '❌ COMPONENT ASSEMBLER: Programmatic assembly failed');
      
      throw error;
    }
  }

  /**
   * Generate React state declarations from state logic
   */
  private generateStateDeclarations(stateLogic: StateLogic): string {
    if (!stateLogic.variables || stateLogic.variables.length === 0) {
      return '';
    }

    return stateLogic.variables
      .map((variable: StateVariable) => {
        const initialValue = this.formatInitialValue(variable.initialValue, variable.type);
        return `  const [${variable.name}, set${this.capitalize(variable.name)}] = React.useState(${initialValue});`;
      })
      .join('\n');
  }

  /**
   * Generate function definitions from state logic
   */
  private generateFunctionDefinitions(stateLogic: StateLogic): string {
    if (!stateLogic.functions || stateLogic.functions.length === 0) {
      return '';
    }

    return stateLogic.functions
      .map((func: StateFunction) => {
        // ✅ CRITICAL FIX: Wrap function body in arrow function syntax
        // State Design Agent provides executable statements, not complete functions
        return `  const ${func.name} = () => { ${func.body} };`;
      })
      .join('\n\n');
  }

  /**
   * Generate event handlers for JSX events that are not defined in state logic
   */
  private generateEventHandlers(jsxCode: string, stateVars: StateVariable[], definedFuncs: StateFunction[]): string {
    const handlers = new Set<string>();
    const definedFuncNames = new Set(definedFuncs.map(f => f.name));
    
    const eventRegex = /(on[A-Z]\w+)=["{]([\w\d]+)["}]/g;
    let match;
    while ((match = eventRegex.exec(jsxCode)) !== null) {
      const handlerName = match[2];
      if (!definedFuncNames.has(handlerName) && !handlerName.startsWith('set')) {
        handlers.add(handlerName);
      }
    }

    const stateSetters = new Map(stateVars.map(v => [`set${this.capitalize(v.name)}`, v.type]));

    return Array.from(handlers).map(handlerName => {
      // Find a corresponding state variable to handle
      const matchingStateVar = stateVars.find(v => handlerName.toLowerCase().includes(v.name.toLowerCase()));
      
      if (matchingStateVar) {
          const setterName = `set${this.capitalize(matchingStateVar.name)}`;
          if (matchingStateVar.type.includes('[]') || matchingStateVar.type.toLowerCase().includes('array')) {
               return `  const ${handlerName} = (value: ${matchingStateVar.type}) => ${setterName}(value); // Array value handler`;
           }
           if (handlerName.toLowerCase().includes('change')) {
             return `  const ${handlerName} = (value: ${matchingStateVar.type}) => ${setterName}(value);`;
          }
          return `  const ${handlerName} = () => console.log('${handlerName} clicked');`;
      }
      
      // Generic fallback
      return `  const ${handlerName} = () => console.warn('Placeholder for ${handlerName}');`;
    }).join('\n\n');
  }

  /**
   * 🔄 PHASE 2: Process JSX syntax with styling (keep as JSX for client-side transpilation)
   */
  private processJsxWithStyling(jsxCode: string, styleMap: Record<string, string>): string {
    let processed = jsxCode;
    
    for (const [id, classes] of Object.entries(styleMap)) {
      const tagRegex = new RegExp(`(<[^>]*data-style-id="${id}"[^>]*>)`);
      const match = processed.match(tagRegex);
      
      if (match) {
        let tag = match[0];
        let updatedTag = tag;

        // Remove the data-style-id attribute
        updatedTag = updatedTag.replace(`data-style-id="${id}"`, '');

        if (updatedTag.includes('className="')) {
      // If className exists, append new classes
      updatedTag = updatedTag.replace('className="', `className="${classes} `);
    } else if (updatedTag.trim().endsWith('/>')) {
      // Self-closing tag – insert before '/>'
      updatedTag = updatedTag.replace('/>', ` className="${classes}" />`);
    } else {
      // Normal opening/closing tag – insert before '>'
      updatedTag = updatedTag.replace('>', ` className="${classes}">`);
    }        
        // Clean up extra whitespace
        updatedTag = updatedTag.replace(/\s\s+/g, ' ').replace(' >', '>');
        
        processed = processed.replace(tag, updatedTag);
      }
    }
    
    return processed;
  }

  /**
   * 🔄 PHASE 2: Assemble the final JSX component with imports
   */
  private assembleFinalComponent(
    stateDeclarations: string,
    functionDefinitions: string,
    eventHandlerDefinitions: string,
    jsxContent: string,
    componentName: string
  ): string {
    const cleanComponentName = this.sanitizeComponentName(componentName);
    
    // 🔄 PHASE 2: Add React imports for JSX transpilation
    const imports = ''; // runtime uses provided React & UI components; no static imports needed

    return `${imports}function ${cleanComponentName}() {
${stateDeclarations}

${functionDefinitions}

${eventHandlerDefinitions}

  return (
    <>
${jsxContent}
    </>
  );
}
`;
  }

  /**
   * Utility functions for code generation
   */
  private formatInitialValue(value: unknown, type: string): string {
    if (type.includes('[]') || type.toLowerCase().includes('array')) {
      // For array types, ensure the value is treated as an array literal.
      // If the value from the state agent is already in brackets (as a string), use it.
      if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        return value;
      }
      // If the value is already an array, stringify it.
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      // Otherwise, wrap the single value in an array. Stringify to handle all types.
      // e.g. 7 -> "[7]", "hello" -> "[\"hello\"]"
      return `[${JSON.stringify(value)}]`;
    }

    // For non-array types, stringify is the safest way to get a literal
    return JSON.stringify(value);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private sanitizeComponentName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d/, 'Tool');
  }

  private performBasicJsxConversion(jsxCode: string): string {
    // 🔄 PHASE 2: No longer needed - we keep JSX syntax for client-side transpilation
    return jsxCode;
  }

  /**
   * Validate the component assembler's structured output.
   */
  validate(output: ComponentAssemblerResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required assembled code
    if (!output.assembledCode) {
      errors.push('Missing assembled component code');
      score -= 50;
    } else {
      // Validate programmatic assembly
      if (!output.assembledCode.includes('function ')) {
        errors.push('Component code does not contain function declaration');
        score -= 30;
      }
      
      if (output.assembledCode.includes('import ')) {
        // ✅ Import statements are now REQUIRED in JSX format for proper transpilation
        if (output.metadata?.assemblyMethod === 'programmatic-jsx') {
          // JSX format expects imports - this is correct behavior
        } else {
          warnings.push('Component code contains import statements but assembly method is not JSX');
          score -= 10; // Reduced penalty - imports might be valid
        }
      }
      
      if (output.assembledCode.length < 50) {
        warnings.push('Component code seems too short');
        score -= 15;
      }
    }

    // Check metadata
    if (!output.metadata) {
      warnings.push('Missing component assembler metadata');
      score -= 5;
    } else {
      if (output.metadata.assemblyMethod !== 'programmatic-jsx' && output.metadata.assemblyMethod !== 'programmatic') {
        errors.push('Assembly method should be programmatic or programmatic-jsx');
        score -= 20;
      }
      
      if (output.metadata.codeLength === 0) {
        errors.push('Code length is zero');
        score -= 20;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score),
      missingFields: []
    };
  }

  /**
   * Define the required TCC fields for this module.
   */
  getRequiredInputFields(): string[] {
    return [
      'jsxLayout.componentStructure',
      'stateLogic.variables',
      'stateLogic.functions',
      'styling.styleMap'
    ];
  }

  /**
   * Support edit mode
   */
  supportsEditMode(): boolean {
    return true;
  }

  /**
   * Provide a description for logging.
   */
  protected getAgentDescription(): string {
    return 'Programmatically combines JSX layout, state logic, and styling into final executable React component with clean JSX syntax for client-side transpilation.';
  }
} 