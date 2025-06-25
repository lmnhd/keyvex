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
  ValidationResult
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
      
      // Step 3: Convert JSX to React.createElement
      const reactElementCode = this.convertJsxToReactCreateElement(
        jsxLayout.componentStructure,
        styling.styleMap || {}
      );
      
      // Step 4: Assemble final component
      const assembledCode = this.assembleFinalComponent(
        stateDeclarations,
        functionDefinitions,
        reactElementCode,
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
          assemblyMethod: 'programmatic' as const,
          componentsAssembled: [
            'state-logic',
            'jsx-layout', 
            'tailwind-styling'
          ]
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
  private generateStateDeclarations(stateLogic: any): string {
    if (!stateLogic.variables || stateLogic.variables.length === 0) {
      return '';
    }

    return stateLogic.variables
      .map((variable: any) => {
        const initialValue = this.formatInitialValue(variable.initialValue, variable.type);
        return `  const [${variable.name}, set${this.capitalize(variable.name)}] = React.useState(${initialValue});`;
      })
      .join('\n');
  }

  /**
   * Generate function definitions from state logic
   */
  private generateFunctionDefinitions(stateLogic: any): string {
    if (!stateLogic.functions || stateLogic.functions.length === 0) {
      return '';
    }

    return stateLogic.functions
      .map((func: any) => {
        return `  const ${func.name} = ${func.body}`;
      })
      .join('\n\n');
  }

  /**
   * Convert JSX syntax to React.createElement calls
   */
  private convertJsxToReactCreateElement(jsxCode: string, styleMap: Record<string, string>): string {
    // This is a simplified conversion - in production, you'd use a proper JSX transformer
    let converted = jsxCode;
    
    // Apply style mapping
    Object.entries(styleMap).forEach(([id, classes]) => {
      const pattern = new RegExp(`data-style-id="${id}"`, 'g');
      converted = converted.replace(pattern, `className="${classes}"`);
    });

    // Basic JSX to React.createElement conversion
    // This is a simplified implementation - production would use Babel transformer
    converted = this.performBasicJsxConversion(converted);
    
    return converted;
  }

  /**
   * Assemble the final React component
   */
  private assembleFinalComponent(
    stateDeclarations: string,
    functionDefinitions: string,
    reactElementCode: string,
    componentName: string
  ): string {
    const cleanComponentName = this.sanitizeComponentName(componentName);
    
    return `function ${cleanComponentName}() {
${stateDeclarations}

${functionDefinitions}

  return (
${reactElementCode}
  );
}`;
  }

  /**
   * Utility functions for code generation
   */
  private formatInitialValue(value: string, type: string): string {
    if (type === 'string') return `"${value}"`;
    if (type === 'number') return value;
    if (type === 'boolean') return value;
    if (type === 'array') return Array.isArray(value) ? JSON.stringify(value) : '[]';
    if (type === 'object') return typeof value === 'object' ? JSON.stringify(value) : '{}';
    return `"${value}"`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private sanitizeComponentName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d/, 'Tool');
  }

  private performBasicJsxConversion(jsxCode: string): string {
    // Basic JSX to React.createElement conversion
    // This is simplified - production would use proper AST transformation
    return jsxCode
      .replace(/<(\w+)/g, 'React.createElement("$1"')
      .replace(/\/>/g, ')')
      .replace(/<\/\w+>/g, ')');
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
        errors.push('Component code contains import statements (should be removed for runtime execution)');
        score -= 25;
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
      if (output.metadata.assemblyMethod !== 'programmatic') {
        errors.push('Assembly method should be programmatic');
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
    return 'Programmatically combines JSX layout, state logic, and styling into final executable React component with React.createElement syntax.';
  }
} 