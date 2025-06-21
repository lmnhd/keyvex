// File Path: keyvex_app/src/lib/agents/unified/modules/component-assembler.ts
import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
  StateVariable,
  StateFunction,
} from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import logger from '@/lib/logger';

// Define our own schema since it doesn't exist in TCC
const ComponentAssemblerOutputSchema = z.object({
  finalComponentCode: z.string().describe('The complete React component code'),
  componentName: z.string().describe('The name of the component'),
  hooks: z.array(z.string()).optional().describe('React hooks used'),
  functions: z.array(z.string()).optional().describe('Function names defined'),
  estimatedLines: z.number().optional().describe('Estimated lines of code')
});

export type ComponentAssemblerOutput = z.infer<typeof ComponentAssemblerOutputSchema>;

// Edit mode context type
type EditModeContext = {
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

// Module interface for the unified agent system
export interface ComponentAssemblerRequest {
  jobId: string;
  selectedModel?: string;
  tcc: ToolConstructionContext;
  isIsolatedTest?: boolean;
  editMode?: EditModeContext;
}

export interface ComponentAssemblerResult {
  success: boolean;
  assembledComponent?: ComponentAssemblerOutput;
  error?: string;
  updatedTcc: ToolConstructionContext;
}

/**
 * Component Assembler Module - PROGRAMMATIC ASSEMBLY (NO AI NEEDED)
 * Combines JSX layout, state logic, and styling into final React component
 */
export async function executeComponentAssembler(request: ComponentAssemblerRequest): Promise<ComponentAssemblerResult> {
  const { jobId, tcc, isIsolatedTest = false } = request;

  logger.info({ jobId, isIsolatedTest }, '🔧 ComponentAssembler Module: Starting programmatic component assembly');

  try {
    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Emit progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.assembling_component,
        'in_progress',
        'Assembling final React component programmatically...',
        tcc
      );
    }

    logger.info({ jobId }, '🔧 ComponentAssembler Module: Programmatically assembling component...');
    const assembledComponent = assembleComponentFromTCC(tcc);
    logger.info({ jobId }, '🔧 ComponentAssembler Module: Component assembled successfully');

    // Comprehensive TCC update logging
    logger.info({
      jobId,
      agentName: 'ComponentAssembler',
      tccUpdateDetail: {
        beforeSteps: Object.keys(tcc.steps || {}),
        beforeLastUpdated: tcc.updatedAt
      }
    }, '🔧 ComponentAssembler Module: TCC STATE BEFORE UPDATE');

    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      steps: {
        ...tcc.steps,
        assemblingComponent: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: tcc.steps?.assemblingComponent?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: assembledComponent,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // Store result in finalProduct for now (since assembledComponent field doesn't exist)
    updatedTcc.finalProduct = {
      ...(updatedTcc.finalProduct || {}),
      assembledComponent
    };

    // Comprehensive TCC update logging - detailed output
    logger.info({
      jobId,
      agentName: 'ComponentAssembler',
      tccUpdateDetail: {
        afterSteps: Object.keys(updatedTcc.steps || {}),
        afterLastUpdated: updatedTcc.updatedAt,
        componentDetails: {
          finalComponentCodeLength: assembledComponent?.finalComponentCode?.length || 0,
          componentName: assembledComponent?.componentName,
          hooksCount: assembledComponent?.hooks?.length || 0,
          functionsCount: assembledComponent?.functions?.length || 0,
          estimatedLines: assembledComponent?.estimatedLines || 0
        },
        stepStatusUpdate: updatedTcc.steps?.assemblingComponent?.status,
        stepResult: !!updatedTcc.steps?.assemblingComponent?.result
      }
    }, '🔧 ComponentAssembler Module: TCC STATE AFTER UPDATE - COMPREHENSIVE DETAILS');

    // Emit completion progress for orchestration mode
    if (!isIsolatedTest) {
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.assembling_component,
        'completed',
        `Successfully assembled ${assembledComponent.componentName} component with ${assembledComponent.hooks?.length || 0} hooks and ${assembledComponent.functions?.length || 0} functions.`,
        updatedTcc
      );
    }

    return { success: true, assembledComponent, updatedTcc };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🔧 ComponentAssembler Module: Error');
    
    // Emit failure progress
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'failed',
      errorMessage,
      tcc
    );
    
    return { success: false, error: errorMessage, updatedTcc: tcc };
  }
}

/**
 * PROGRAMMATIC ASSEMBLY - Extract and combine all TCC parts into final component
 */
function assembleComponentFromTCC(tcc: ToolConstructionContext): ComponentAssemblerOutput {
  const componentName = 'BusinessTool'; // Default name
  
  // Extract imports from state logic
  const imports = tcc.stateLogic?.imports || ['React', 'useState'];
  
  // Extract state variables
  const stateVariables = tcc.stateLogic?.variables || [];
  
  // Extract functions
  const functions = tcc.stateLogic?.functions || [];
  
  // Get styled JSX from styling agent
  const styledJSX = tcc.styling?.styledComponentCode || tcc.jsxLayout?.componentStructure || '<div>Loading...</div>';
  
  // Build final component code
  const finalComponentCode = buildFinalComponent({
    componentName,
    imports,
    stateVariables,
    functions,
    styledJSX
  });
  
  return {
    finalComponentCode,
    componentName,
    hooks: imports.filter(imp => imp.startsWith('use')),
    functions: functions.map(f => f.name),
    estimatedLines: finalComponentCode.split('\n').length
  };
}

/**
 * Build the final React component code from all parts
 */
function buildFinalComponent(parts: {
  componentName: string;
  imports: string[];
  stateVariables: StateVariable[];
  functions: StateFunction[];
  styledJSX: string;
}): string {
  const { componentName, imports, stateVariables, functions, styledJSX } = parts;
  
  // Build import statements
  const importStatements = `import React, { ${imports.filter(imp => imp !== 'React').join(', ')} } from 'react';`;
  
  // Build state declarations
  const stateDeclarations = stateVariables.map(variable => 
    `  const [${variable.name}, set${capitalize(variable.name)}] = useState(${variable.initialValue || 'null'});`
  ).join('\n');
  
  // Build function declarations
  const functionDeclarations = functions.map(func => 
    `  const ${func.name} = () => {\n    ${func.body}\n  };`
  ).join('\n\n');
  
  // Clean up JSX (remove any wrapper return statements)
  const cleanJSX = styledJSX.replace(/^return\s*\(/m, '').replace(/\);?\s*$/, '').trim();
  
  return `${importStatements}

export default function ${componentName}() {
${stateDeclarations}

${functionDeclarations}

  return (
    ${cleanJSX}
  );
}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
} 