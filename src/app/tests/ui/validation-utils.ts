import { ProductToolDefinition } from '@/lib/types/product-tool';
import { clearLastActiveToolFromDB } from './db-utils';

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  details?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface ComponentValidationResult extends ValidationResult {
  componentErrors: Array<{
    component: string;
    error: string;
    line?: number;
  }>;
}

// Enhanced validation function to check if a ProductToolDefinition is valid
export const isValidProductToolDefinition = (tool: unknown): tool is ProductToolDefinition => {
  console.log('🔧 TRACE: Validating tool definition...');
  
  // Type guard to ensure tool is an object with the properties we need to check
  const toolObj = tool as Record<string, unknown>;
  console.log('🔧 TRACE: Tool ID:', toolObj?.id);
  console.log('🔧 TRACE: Tool metadata title:', (toolObj?.metadata as Record<string, unknown>)?.title);
  console.log('🔧 TRACE: ComponentCode length:', (toolObj?.componentCode as string)?.length || 0);
  
  if (!tool || typeof tool !== 'object') {
    console.warn('⚠️ Tool validation failed: Not an object');
    return false;
  }
  
  // Check for required fields
  if (!toolObj.id || !toolObj.metadata || !toolObj.componentCode) {
    console.warn('⚠️ Tool validation failed: Missing required fields', {
      hasId: !!toolObj.id,
      hasMetadata: !!toolObj.metadata, 
      hasComponentCode: !!toolObj.componentCode
    });
    return false;
  }
  
  // Check for undefined values in critical fields
  const metadata = toolObj.metadata as Record<string, unknown>;
  if (String(toolObj.id).includes('undefined') || 
      String(toolObj.slug || '').includes('undefined') ||
      String(metadata?.id || '').includes('undefined') ||
      String(metadata?.title || '').includes('undefined')) {
    console.warn('⚠️ Tool validation failed: Contains undefined values in critical fields');
    return false;
  }

  // ENHANCED: Check if componentCode actually contains a React component
  const componentCode = String(toolObj.componentCode || '');
  
  // Must contain React.createElement (our required pattern)
  if (!componentCode.includes('React.createElement')) {
    console.warn('⚠️ Tool validation failed: componentCode does not contain React.createElement');
    return false;
  }
  
  // Must contain a function declaration that returns React elements
  const functionPattern = /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*return\s+React\.createElement/;
  if (!functionPattern.test(componentCode)) {
    console.warn('⚠️ Tool validation failed: componentCode does not contain a proper React component function');
    return false;
  }
  
  // STRICT: Components must contain React hooks for interactivity (useState is required)
  if (!componentCode.includes('useState')) {
    console.warn('⚠️ Tool validation failed: componentCode does not contain React hooks (useState) - business tools should be interactive');
    return false;
  }

  // 🛡️ Check for forbidden patterns that cause runtime errors
  // ONLY apply this check if the componentSet is 'legacy'
  if (toolObj.componentSet === 'legacy') {
    // Add other ShadCN component names here if they should also be forbidden in legacy mode
    const forbiddenLegacyKeywords = [
      'Card', 'CardHeader', 'CardContent', 'CardTitle', 'CardDescription', 'CardFooter',
      'Input', 'Button', 'Select', 'Label', 'Textarea' // Add more as identified
    ];
    for (const keyword of forbiddenLegacyKeywords) {
      // Use a regex to check for whole word instances to avoid partial matches in variable names
      const regex = new RegExp(`\\b${keyword}\\b`);
      if (regex.test(componentCode)) {
        console.warn(`⚠️ Tool validation failed: Component uses forbidden ShadCN component '${keyword}' in legacy mode`);
        return false;
      }
    }
  }
  // If componentSet is 'shadcn', using these components is allowed and expected.

  // ✅ UPDATED FOR NEW JSX DESIGN: Import statements are now REQUIRED for JSX transpilation
  // The JSX transpiler will handle import removal during browser execution
  // Only warn if NO imports are found in JSX components
  if (!componentCode.includes('import ') && componentCode.includes('React.createElement')) {
    console.warn('⚠️ Tool validation note: Legacy component detected (no imports). Consider regenerating for JSX format.');
    // This is not a failure - just informational
  }

  // Check for JSX syntax (forbidden in our environment)
  const jsxPattern = /<\s*[a-zA-Z][^>]*>/;
  if (jsxPattern.test(componentCode)) {
    console.warn('⚠️ Tool validation failed: Component contains forbidden JSX syntax');
    return false;
  }

  // NEW: Simplified validation - check basic structure without complex execution
  try {
    console.log('🔧 TRACE: Testing component code structure...');
    
    // Check for proper function structure
    const functionMatch = componentCode.match(/function\s+(\w+)\s*\([^)]*\)/);
    if (!functionMatch) {
      console.warn('⚠️ Tool validation failed: No valid function declaration found');
      return false;
    }
    
    const functionName = functionMatch[1];
    console.log('🔧 TRACE: Found function:', functionName);
    
    // Check for proper return statement with React.createElement
    const returnPattern = new RegExp(`return\\s+React\\.createElement`);
    if (!returnPattern.test(componentCode)) {
      console.warn('⚠️ Tool validation failed: Function does not return React.createElement');
      return false;
    }
    
    // Check for 'use client' directive
    if (!componentCode.includes("'use client'")) {
      console.warn('⚠️ Tool validation failed: Missing "use client" directive');
      return false;
    }
    
    console.log('🔧 TRACE: ✅ Component structure validation passed');
  } catch (structureError) {
    console.warn('⚠️ Tool validation failed: Component structure error:', structureError);
    return false;
  }
  
  console.log('🔧 TRACE: ✅ Tool validation passed');
  return true;
};

// NEW: Add automatic cleanup of corrupted tools from IndexedDB
export const clearCorruptedToolFromStorage = async (toolId: string) => {
  try {
    console.log('🧹 TRACE: Clearing corrupted tool from storage:', toolId);
    
    // Clear from IndexedDB using the correct imported function
    await clearLastActiveToolFromDB();
    
    // Clear from localStorage backup
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('tool_') || key === 'lastActiveToolId') {
        try {
          const toolData = JSON.parse(localStorage.getItem(key) || '{}');
          if (toolData.id === toolId) {
            localStorage.removeItem(key);
            console.log('🧹 TRACE: Removed corrupted tool from localStorage:', key);
          }
        } catch (e) {
          // If parsing fails, the localStorage item is also corrupted, remove it
          localStorage.removeItem(key);
          console.log('🧹 TRACE: Removed corrupted localStorage item:', key);
        }
      }
    });
    
    console.log('🧹 TRACE: ✅ Corrupted tool cleanup completed');
  } catch (error) {
    console.error('🧹 TRACE: ⚠️ Error during corrupted tool cleanup:', error);
  }
};

// Helper function to create a sample question for an existing tool
export const createSampleQuestion = (tool: ProductToolDefinition) => {
  return {
    id: `sample_${Date.now()}`,
    message: `Sample question for ${tool.metadata.title}`,
    inputType: 'text' as const,
    placeholder: 'Enter your input here...',
    isInMultiPart: false,
    multiPartQuestions: []
  };
};

// Helper function to create a mock question for initial state
export const createMockQuestion = () => {
  return {
    id: `mock_${Date.now()}`,
    message: 'What type of business tool would you like to create?',
    inputType: 'text' as const,
    placeholder: 'Describe your tool idea...',
    isInMultiPart: false,
    multiPartQuestions: []
  };
};

/**
 * Validates a product tool definition
 */
export function validateProductTool(tool: Partial<ProductToolDefinition>): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Check required fields
  if (!tool.metadata?.title) {
    issues.push({
      type: 'error',
      field: 'metadata.title',
      message: 'Tool title is required'
    });
  }

  if (!tool.metadata?.description) {
    issues.push({
      type: 'error',
      field: 'metadata.description',
      message: 'Tool description is required'
    });
  }

  if (!tool.metadata?.type) {
    issues.push({
      type: 'error',
      field: 'metadata.type',
      message: 'Tool type is required'
    });
  }

  if (!tool.componentCode) {
    issues.push({
      type: 'error',
      field: 'componentCode',
      message: 'Component code is required'
    });
  }

  // Validate metadata fields
  if (tool.metadata?.title && tool.metadata.title.length < 3) {
    issues.push({
      type: 'warning',
      field: 'metadata.title',
      message: 'Tool title should be at least 3 characters long'
    });
  }

  if (tool.metadata?.title && tool.metadata.title.length > 100) {
    issues.push({
      type: 'error',
      field: 'metadata.title',
      message: 'Tool title should not exceed 100 characters'
    });
  }

  if (tool.metadata?.description && tool.metadata.description.length < 10) {
    issues.push({
      type: 'warning',
      field: 'metadata.description',
      message: 'Tool description should be at least 10 characters long'
    });
  }

  if (tool.metadata?.description && tool.metadata.description.length > 500) {
    issues.push({
      type: 'warning',
      field: 'metadata.description',
      message: 'Tool description is quite long, consider shortening it'
    });
  }

  // Validate features array
  if (tool.metadata?.features) {
    if (tool.metadata.features.length === 0) {
      issues.push({
        type: 'warning',
        field: 'metadata.features',
        message: 'Consider adding at least one feature to highlight tool capabilities'
      });
    }

    if (tool.metadata.features.length > 10) {
      issues.push({
        type: 'warning',
        field: 'metadata.features',
        message: 'Too many features listed, consider keeping it concise'
      });
    }
  }

  // Validate color scheme
  if (tool.colorScheme) {
    const colorFields = ['primary', 'secondary', 'accent', 'background', 'text'];
    colorFields.forEach(field => {
      const color = tool.colorScheme?.[field as keyof typeof tool.colorScheme];
      if (color && typeof color === 'string' && !isValidColor(color)) {
        issues.push({
          type: 'error',
          field: `colorScheme.${field}`,
          message: `Invalid color format for ${field}`
        });
      }
    });
  }

  return {
    isValid: issues.filter(issue => issue.type === 'error').length === 0,
    issues
  };
}

/**
 * Validates component code syntax
 */
export function validateComponentCode(code: string): ComponentValidationResult {
  const issues: ValidationIssue[] = [];
  const componentErrors: Array<{ component: string; error: string; line?: number }> = [];

  if (!code || code.trim().length === 0) {
    issues.push({
      type: 'error',
      field: 'componentCode',
      message: 'Component code cannot be empty'
    });
    return { isValid: false, issues, componentErrors };
  }

  // Basic React component validation
  if (!code.includes('export default') && !code.includes('export const')) {
    issues.push({
      type: 'error',
      field: 'componentCode',
      message: 'Component must have a default export'
    });
  }

  // Check for basic React patterns
  if (!code.includes('React') && !code.includes('useState') && !code.includes('useEffect')) {
    issues.push({
      type: 'warning',
      field: 'componentCode',
      message: 'Component should import React or use React hooks'
    });
  }

  // Check for potential syntax errors (basic)
  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    issues.push({
      type: 'error',
      field: 'componentCode',
      message: 'Mismatched braces in component code'
    });
  }

  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    issues.push({
      type: 'error',
      field: 'componentCode',
      message: 'Mismatched parentheses in component code'
    });
  }

  // Try to parse as JavaScript (basic validation)
  try {
    // Remove JSX for basic parsing
    const jsCode = code
      .replace(/<[^>]*>/g, '') // Remove JSX tags
      .replace(/className=/g, 'className_=') // Handle className
      .replace(/return\s*\(/g, 'return ""') // Replace JSX return
      .replace(/return\s*</g, 'return ""'); // Replace JSX return
    
    // This is a very basic check - in a real implementation you'd use a proper parser
    if (jsCode.includes('function') || jsCode.includes('=>') || jsCode.includes('const')) {
      // Looks like valid JavaScript structure
    }
  } catch (error) {
    componentErrors.push({
      component: 'main',
      error: 'Syntax error in component code'
    });
  }

  return {
    isValid: issues.filter(issue => issue.type === 'error').length === 0 && componentErrors.length === 0,
    issues,
    componentErrors
  };
}

/**
 * Validates color format (hex, rgb, rgba, hsl, hsla, named colors)
 */
function isValidColor(color: string): boolean {
  // Hex colors
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
    return true;
  }
  
  // RGB/RGBA
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/.test(color)) {
    return true;
  }
  
  // HSL/HSLA
  if (/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*[\d.]+)?\s*\)$/.test(color)) {
    return true;
  }
  
  // Named colors (basic list)
  const namedColors = [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'gray', 'grey', 'transparent', 'inherit', 'currentColor'
  ];
  
  return namedColors.includes(color.toLowerCase());
}

/**
 * Validates form input values
 */
export function validateInput(value: string | number | boolean, type: string, required: boolean = false): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    issues.push({
      type: 'error',
      field: 'value',
      message: 'This field is required'
    });
  }

  if (value && typeof value === 'string') {
    switch (type) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          issues.push({
            type: 'error',
            field: 'value',
            message: 'Please enter a valid email address'
          });
        }
        break;
      
      case 'url':
        try {
          new URL(value);
        } catch {
          issues.push({
            type: 'error',
            field: 'value',
            message: 'Please enter a valid URL'
          });
        }
        break;
      
      case 'phone':
        if (!/^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-\(\)]/g, ''))) {
          issues.push({
            type: 'error',
            field: 'value',
            message: 'Please enter a valid phone number'
          });
        }
        break;
    }
  }

  return {
    isValid: issues.filter(issue => issue.type === 'error').length === 0,
    issues
  };
} 