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
      
      // Step 3: 🔄 PHASE 2: Process JSX with styling (keep as JSX)
      const processedJsx = this.processJsxWithStyling(
        jsxLayout.componentStructure,
        styling.styleMap || {}
      );
      
      // Step 4: 🔄 PHASE 2: Assemble final JSX component
      const assembledCode = this.assembleFinalComponent(
        stateDeclarations,
        functionDefinitions,
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
  private generateStateDeclarations(stateLogic: any): string {
    if (!stateLogic.variables || stateLogic.variables.length === 0) {
      return '';
    }

    return stateLogic.variables
      .map((variable: any) => {
        const initialValue = this.formatInitialValue(variable.initialValue, variable.type);
        // 🔄 PHASE 2: Use useState instead of React.useState (will be transpiled)
        return `  const [${variable.name}, set${this.capitalize(variable.name)}] = useState(${initialValue});`;
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
   * 🔄 PHASE 2: Process JSX syntax with styling (keep as JSX for client-side transpilation)
   */
  private processJsxWithStyling(jsxCode: string, styleMap: Record<string, string>): string {
    // Apply style mapping by replacing data-style-id with className
    let processed = jsxCode;
    
    Object.entries(styleMap).forEach(([id, classes]) => {
      const pattern = new RegExp(`data-style-id="${id}"`, 'g');
      processed = processed.replace(pattern, `className="${classes}"`);
    });

    // 🔄 PHASE 2: Keep JSX syntax - no conversion to React.createElement
    // The DynamicComponentRenderer will handle JSX transpilation using Babel
    
    return processed;
  }

  /**
   * 🔄 PHASE 2: Assemble the final JSX component with imports
   */
  private assembleFinalComponent(
    stateDeclarations: string,
    functionDefinitions: string,
    jsxContent: string,
    componentName: string
  ): string {
    const cleanComponentName = this.sanitizeComponentName(componentName);
    
    // 🔄 PHASE 2: Add React imports for JSX transpilation
    const imports = `import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

`;
    
    return `${imports}function ${cleanComponentName}() {
${stateDeclarations}

${functionDefinitions}

  return (
${jsxContent}
  );
}

export default ${cleanComponentName};`;
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
        // 🔄 PHASE 2: Import statements are now expected in JSX format
        if (output.metadata?.assemblyMethod === 'programmatic-jsx') {
          // JSX format expects imports - this is correct
        } else {
          errors.push('Component code contains import statements (should be removed for runtime execution)');
          score -= 25;
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