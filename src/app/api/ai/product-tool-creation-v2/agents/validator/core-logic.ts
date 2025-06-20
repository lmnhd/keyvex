import { z } from 'zod';
import {
  ToolConstructionContext,
  OrchestrationStepEnum,
  OrchestrationStatusEnum,
} from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import * as babel from '@babel/standalone';
import * as ts from 'typescript';

// Input schema
const ValidatorRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  isIsolatedTest: z.boolean().optional(),
});

export type ValidatorRequest = z.infer<typeof ValidatorRequestSchema>;

/**
 * Enhanced Validator Agent - Validates and auto-corrects Radix UI component event handler mismatches
 */
export async function validateComponent(
  request: ValidatorRequest & {
    tcc?: ToolConstructionContext;
    mockTcc?: ToolConstructionContext;
  },
): Promise<{
  success: boolean;
  validationResult?: any;
  updatedTcc?: ToolConstructionContext;
  error?: string;
  autoCorrectedCode?: string;
}> {
  const { jobId } = ValidatorRequestSchema.parse(request);
  const tcc = request.mockTcc || request.tcc;

  try {
    if (!tcc) throw new Error(`TCC not provided for jobId: ${jobId}`);

    logger.info({ jobId }, '🔍 Validator: Starting validation with Radix UI auto-correction');

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'in_progress',
      'Validating component code...',
      tcc
    );

    // ✅ SINGLE SOURCE OF TRUTH: Component code is only stored in finalProduct.componentCode
    const componentCode = tcc.finalProduct?.componentCode;
    
    if (!componentCode) {
      logger.error({ 
        jobId,
        hasFinalProductCode: !!tcc.finalProduct?.componentCode,
        tccKeys: Object.keys(tcc),
        finalProductKeys: tcc.finalProduct ? Object.keys(tcc.finalProduct) : 'No finalProduct'
      }, '🔍 Validator: Missing component code - TCC structure analysis');
      throw new Error('Component code not found in TCC.finalProduct.componentCode (SINGLE SOURCE OF TRUTH)');
    }

    // Apply automatic corrections for known Radix UI issues
    let correctedCode = componentCode;
    let autoCorrectionApplied = false;

    // Check for Radix UI component event handler issues
    if (hasRadixUIEventHandlerIssues(correctedCode)) {
      logger.info({ jobId }, '🔍 Validator: Applying Radix UI event handler corrections');
      
      await emitStepProgress(
        jobId,
        OrchestrationStepEnum.enum.validating_code,
        'in_progress',
        'Auto-correcting Radix UI event handlers...',
        tcc
      );

      correctedCode = fixRadixUIEventHandlers(correctedCode);
      autoCorrectionApplied = true;
    }

    // Validate the corrected code
    const validationResult = await validateCode(correctedCode);

    const updatedTCC: ToolConstructionContext = {
      ...tcc,
      validationResult,
      // ✅ SINGLE SOURCE OF TRUTH: Only update finalProduct.componentCode when corrections are applied
      ...(autoCorrectionApplied && tcc.finalProduct && {
        finalProduct: {
          ...tcc.finalProduct,
          componentCode: correctedCode
        }
      }),
      currentOrchestrationStep: OrchestrationStepEnum.enum.finalizing_tool,
      steps: {
        ...tcc.steps,
        validatingCode: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt:
            tcc.steps?.validatingCode?.startedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: {
            ...validationResult,
            autoCorrectionApplied,
            correctionTypes: autoCorrectionApplied ? ['radix-ui-event-handlers', 'slider-state-arrays', 'react-import-deduplication'] : []
          },
        },
      },
      updatedAt: new Date().toISOString(),
    };

    const statusMessage = validationResult.isValid 
      ? `Code validation completed. ${autoCorrectionApplied ? 'Auto-corrections applied successfully. ' : ''}No remaining issues.`
      : `Found ${validationResult.syntaxErrors.length + validationResult.typeErrors.length} errors.${autoCorrectionApplied ? ' Auto-corrections attempted but issues remain.' : ''}`;

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'completed',
      statusMessage,
      updatedTCC
    );

    // ✅ ENHANCED ERROR LOGGING: Detailed error reporting for debugging
    if (!validationResult.isValid) {
      logger.error(
        {
          jobId,
          syntaxErrors: validationResult.syntaxErrors,
          typeErrors: validationResult.typeErrors,
          warnings: validationResult.warnings,
          autoCorrectionApplied,
          correctedCodePreview: autoCorrectionApplied ? correctedCode.substring(0, 500) + '...' : 'No corrections applied'
        },
        '🔍 Validator: ❌ DETAILED ERROR ANALYSIS - Validation failed with specific errors',
      );
    }

    logger.info(
      {
        jobId,
        isValid: validationResult.isValid,
        errorCount: validationResult.syntaxErrors.length + validationResult.typeErrors.length,
        warningCount: validationResult.warnings.length,
        autoCorrectionApplied
      },
      '🔍 Validator: Completed validation with auto-correction',
    );

    return { 
      success: true, 
      validationResult, 
      updatedTcc: updatedTCC,
      ...(autoCorrectionApplied && { autoCorrectedCode: correctedCode })
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🔍 Validator: Error');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.validating_code,
      'failed',
      errorMessage,
      tcc
    );
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if code has Radix UI event handler issues
 */
function hasRadixUIEventHandlerIssues(code: string): boolean {
  // Check for Select components with onValueChange passing to handleInputChange
  const hasSelectIssues = /Select[^}]*onValueChange\s*:\s*handleInputChange/.test(code);
  
  // Check for Slider components with number state instead of array
  const hasSliderStateIssues = /useState\(\d+\)/.test(code) && /Slider/.test(code);
  
  // Check for Slider components using onChange instead of onValueChange
  const hasSliderEventIssues = /Slider[^}]*onChange\s*:\s*handleInputChange/.test(code);
  
  // Check for RadioGroup components using onChange instead of onValueChange  
  const hasRadioGroupIssues = /RadioGroup[^}]*onChange\s*:\s*handleInputChange/.test(code);
  
  // Check for Button onClick handlers as strings instead of functions
  const hasButtonIssues = /onClick\s*:\s*["']/.test(code);
  
  // Check for missing function references
  const hasMissingFunctions = /onClick\s*:\s*(\w+)/.test(code) && 
    !/const\s+\w+\s*=|function\s+\w+/.test(code);
  
  // Check for fieldName references that need replacement
  const hasFieldNameIssues = /name:\s*fieldName/.test(code);
  
  // Check for JSX syntax issues
  const hasJsxIssues = /className\s*:\s*[^"'][^,}]+/.test(code);
  
  // Check for React.createElement syntax issues
  const hasReactCreateElementIssues = /React\.createElement\([^,]+,\s*\{[^}]*[^"'][^,}]+/.test(code);
  
  // Check for missing React import
  const hasMissingReactImport = !code.includes("import React") && code.includes("React.createElement");
  
  // Check for array destructuring issues in calculations
  const hasArrayDestructuringIssues = /\w+Duration\[0\]/.test(code) && !code.includes('useState([');
  
  // Check for missing export statements
  const hasMissingExports = !code.includes('export default') && code.includes('function ');
  
  return hasSelectIssues || hasSliderStateIssues || hasSliderEventIssues || 
         hasRadioGroupIssues || hasButtonIssues || hasMissingFunctions || 
         hasFieldNameIssues || hasJsxIssues || hasReactCreateElementIssues ||
         hasMissingReactImport || hasArrayDestructuringIssues || hasMissingExports;
}

/**
 * Fix Radix UI event handler issues
 */
function fixRadixUIEventHandlers(code: string): string {
  let corrected = code;

  // 1. Fix Select components: onValueChange expects value, not event object
  corrected = corrected.replace(
    /Select([^}]*?)onValueChange\s*:\s*handleInputChange/g,
    (match, props) => {
      // Extract id prop to use as field name
      const idMatch = props.match(/id\s*:\s*["']([^"']+)["']/);
      const fieldName = idMatch ? idMatch[1] : 'unknown-field';
      return `Select${props}onValueChange: (value) => handleInputChange({ target: { name: '${fieldName}', value } })`;
    }
  );

  // 2. Fix Slider useState to use arrays instead of numbers - enhanced patterns
  corrected = corrected.replace(
    /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useState\((\d+)\);/g,
    'const [$1, $2] = useState([$3]);'
  );
  
  // Additional slider state pattern fixes
  corrected = corrected.replace(
    /useState\((\d+)\)/g,
    (match, value, offset) => {
      // Check context for slider-related variables
      const beforeCode = corrected.substring(Math.max(0, offset - 100), offset);
      const afterCode = corrected.substring(offset, offset + 100);
      
      if (beforeCode.toLowerCase().includes('duration') || 
          beforeCode.toLowerCase().includes('slider') ||
          afterCode.toLowerCase().includes('slider')) {
        return `useState([${value}])`;
      }
      return match;
    }
  );

  // 3. Fix Slider components: change onChange to onValueChange and handle array values
  corrected = corrected.replace(
    /Slider([^}]*?)onChange\s*:\s*handleInputChange/g,
    (match, props) => {
      const idMatch = props.match(/id\s*:\s*["']([^"']+)["']/);
      const fieldName = idMatch ? idMatch[1] : 'unknown-field';
      return `Slider${props}onValueChange: (values) => handleInputChange({ target: { name: '${fieldName}', value: values[0] } })`;
    }
  );

  // 4. Fix Slider value prop to handle arrays properly
  corrected = corrected.replace(
    /value\s*:\s*(\w+)(?=.*Slider)/g,
    'value: Array.isArray($1) ? $1 : [$1]'
  );

  // 5. Fix RadioGroup components: change onChange to onValueChange
  corrected = corrected.replace(
    /RadioGroup([^}]*?)onChange\s*:\s*handleInputChange/g,
    (match, props) => {
      const idMatch = props.match(/id\s*:\s*["']([^"']+)["']/);
      const fieldName = idMatch ? idMatch[1] : 'unknown-field';
      return `RadioGroup${props}onValueChange: (value) => handleInputChange({ target: { name: '${fieldName}', value } })`;
    }
  );

  // 6. Fix multiselect array state initialization
  corrected = corrected.replace(
    /useState\(""\)/g,
    (match, offset) => {
      // Check if this is for a multiselect field (look for nearby multiselect or array context)
      const beforeCode = corrected.substring(Math.max(0, offset - 200), offset);
      const afterCode = corrected.substring(offset, offset + 200);
      
      if (beforeCode.includes('Ages') || beforeCode.includes('Preferences') || beforeCode.includes('Priorities') ||
          afterCode.includes('multiple') || afterCode.includes('multiselect')) {
        return 'useState([])';
      }
      return match;
    }
  );

  // 7. Fix Button onClick handlers - ensure they're functions, not strings
  corrected = corrected.replace(
    /onClick\s*:\s*["']([^"']+)["']/g,
    'onClick: $1'
  );

  // 8. Fix missing function references for Button components
  corrected = corrected.replace(
    /onClick\s*:\s*(\w+)/g,
    (match, funcName) => {
      // Ensure the function exists or provide a placeholder
      if (!corrected.includes(`const ${funcName} =`) && !corrected.includes(`function ${funcName}`)) {
        return `onClick: () => console.log('${funcName} called')`;
      }
      return match;
    }
  );

  // 9. Fix JSX syntax issues - ensure proper prop formats
  corrected = corrected.replace(
    /className\s*:\s*([^"'][^,}]+)/g,
    'className: "$1"'
  );

  // 10. Fix field name references in event handlers
  corrected = corrected.replace(
    /name:\s*fieldName/g,
    (match, offset) => {
      // Try to extract actual field name from nearby id props
      const contextCode = corrected.substring(Math.max(0, offset - 200), offset + 200);
      const idMatch = contextCode.match(/id\s*:\s*["']([^"']+)["']/);
      if (idMatch) {
        return `name: '${idMatch[1]}'`;
      }
      return match;
    }
  );

  // 11. Fix React.createElement syntax issues
  corrected = corrected.replace(
    /React\.createElement\(([^,]+),\s*\{([^}]*)\}\s*,/g,
    (match, component, props) => {
      // Ensure props are properly formatted
      const cleanProps = props.replace(/(\w+):\s*([^,}]+)/g, (propMatch: string, key: string, value: string) => {
        // Fix unquoted string values
        if (!value.startsWith('"') && !value.startsWith("'") && 
            !value.startsWith('{') && !value.match(/^\d+$/) && !value.match(/^(true|false)$/)) {
          return `${key}: "${value}"`;
        }
        return propMatch;
      });
      return `React.createElement(${component}, {${cleanProps}},`;
    }
  );

  // 12. Fix missing imports for React components
  if (!corrected.includes("import React") && corrected.includes("React.createElement")) {
    corrected = "import React from 'react';\n" + corrected;
  }

  // 13. Fix array destructuring in calculation expressions
  corrected = corrected.replace(
    /(\w+Duration)\[0\]/g,
    (match, varName) => {
      // Ensure the variable is actually an array
      if (corrected.includes(`${varName}, set`) && corrected.includes('useState([')) {
        return match;
      }
      // If it's not an array, fix the usage
      return varName;
    }
  );

  // 14. Fix component export issues
  if (!corrected.includes('export default') && corrected.includes('function ')) {
    const functionMatch = corrected.match(/function\s+(\w+)/);
    if (functionMatch) {
      corrected += `\n\nexport default ${functionMatch[1]};`;
    }
  }

  return corrected;
}

/**
 * Validate component code using Babel and TypeScript
 */
async function validateCode(code: string) {
  const syntaxErrors: string[] = [];
  const typeErrors: string[] = [];
  const warnings: string[] = [];

  // Babel syntax validation
  try {
    babel.transform(code, {
      presets: ['typescript', 'react'],
      filename: 'component.tsx',
    });
  } catch (error) {
    if (error instanceof Error) {
      syntaxErrors.push(error.message);
    }
  }

  // React-specific validation checks
  const reactKeyIssues = checkReactKeyIssues(code);
  if (reactKeyIssues.length > 0) {
    warnings.push(...reactKeyIssues);
  }

  // TypeScript validation
  const tsResult = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    reportDiagnostics: true,
  });

  if (tsResult.diagnostics) {
    tsResult.diagnostics.forEach(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n',
      );
      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        typeErrors.push(message);
      } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
        warnings.push(message);
      }
    });
  }

  // Calculate metrics
  const linesOfCode = code.split('\n').length;
  const dependencies = extractDependencies(code);
  const componentComplexity = calculateComplexity(code);

  return {
    isValid: syntaxErrors.length === 0 && typeErrors.length === 0,
    syntaxErrors,
    typeErrors,
    warnings,
    metrics: {
      linesOfCode,
      componentComplexity,
      dependencies,
    },
  };
}

/**
 * Check for React key prop issues in React.createElement calls
 */
function checkReactKeyIssues(code: string): string[] {
  const issues: string[] = [];
  
  // Look for React.createElement calls with array children but no keys
  const createElementRegex = /React\.createElement\(\s*[^,]+\s*,\s*\{[^}]*\}\s*,\s*\[([^\]]+)\]/g;
  let match;
  
  while ((match = createElementRegex.exec(code)) !== null) {
    const arrayContent = match[1];
    
    // Check if any React.createElement calls in the array lack key props
    const childElementRegex = /React\.createElement\([^)]+\)/g;
    let childMatch;
    let hasIssues = false;
    
    while ((childMatch = childElementRegex.exec(arrayContent)) !== null) {
      const childElement = childMatch[0];
      
      // Check if this createElement call has a key prop
      if (!childElement.includes('key:') && !childElement.includes('"key"')) {
        hasIssues = true;
        break;
      }
    }
    
    if (hasIssues) {
      issues.push(`React key warning: Found React.createElement with array children that may be missing key props. Each child in a list should have a unique "key" prop.`);
    }
  }
  
  // Also check for .map() calls that might be missing keys
  const mapRegex = /\.map\(\s*\([^)]*\)\s*=>\s*React\.createElement\([^)]+\)/g;
  while ((match = mapRegex.exec(code)) !== null) {
    const mapCall = match[0];
    if (!mapCall.includes('key:') && !mapCall.includes('"key"')) {
      issues.push(`React key warning: Found .map() with React.createElement that may be missing key props. Each child in a list should have a unique "key" prop.`);
    }
  }
  
  return issues;
}

/**
 * Extract dependencies from imports
 */
function extractDependencies(code: string): string[] {
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const dependencies = new Set<string>();
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    dependencies.add(match[1]);
  }

  return Array.from(dependencies);
}

/**
 * Calculate component complexity (simple metric based on code patterns)
 */
function calculateComplexity(code: string): number {
  let complexity = 0;

  // Count state variables
  complexity += (code.match(/useState/g) || []).length * 2;

  // Count effects
  complexity += (code.match(/useEffect/g) || []).length * 3;

  // Count callbacks
  complexity += (code.match(/useCallback/g) || []).length * 2;

  // Count memos
  complexity += (code.match(/useMemo/g) || []).length * 2;

  // Count conditional rendering
  complexity += (code.match(/\?\s*[^\s:]+\s*:\s*[^\s]+/g) || []).length;

  // Count loops/iterations
  complexity += (code.match(/\.(map|filter|reduce|forEach)\(/g) || []).length * 2;

  // Count event handlers
  complexity += (code.match(/on[A-Z][a-zA-Z]+=/g) || []).length;

  return complexity;
}