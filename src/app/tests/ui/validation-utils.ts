import { ProductToolDefinition } from '@/lib/types/product-tool';
import { clearLastActiveToolFromDB } from './db-utils';

// Enhanced validation function to check if a ProductToolDefinition is valid
export const isValidProductToolDefinition = (tool: any): tool is ProductToolDefinition => {
  console.log('🔧 TRACE: Validating tool definition...');
  console.log('🔧 TRACE: Tool ID:', tool?.id);
  console.log('🔧 TRACE: Tool metadata title:', tool?.metadata?.title);
  console.log('🔧 TRACE: ComponentCode length:', tool?.componentCode?.length || 0);
  
  if (!tool || typeof tool !== 'object') {
    console.warn('⚠️ Tool validation failed: Not an object');
    return false;
  }
  
  // Check for required fields
  if (!tool.id || !tool.metadata || !tool.componentCode) {
    console.warn('⚠️ Tool validation failed: Missing required fields', {
      hasId: !!tool.id,
      hasMetadata: !!tool.metadata, 
      hasComponentCode: !!tool.componentCode
    });
    return false;
  }
  
  // Check for undefined values in critical fields
  if (String(tool.id).includes('undefined') || 
      String(tool.slug || '').includes('undefined') ||
      String(tool.metadata?.id || '').includes('undefined') ||
      String(tool.metadata?.title || '').includes('undefined')) {
    console.warn('⚠️ Tool validation failed: Contains undefined values in critical fields');
    return false;
  }

  // ENHANCED: Check if componentCode actually contains a React component
  const componentCode = String(tool.componentCode || '');
  
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
  
  // Must contain React hooks (useState is required for our components)
  if (!componentCode.includes('useState')) {
    console.warn('⚠️ Tool validation failed: componentCode does not contain React hooks (useState)');
    return false;
  }

  // 🛡️ Check for forbidden patterns that cause runtime errors
  if (componentCode.includes('Card') || 
      componentCode.includes('CardHeader') ||
      componentCode.includes('CardContent') ||
      componentCode.includes('CardTitle')) {
    console.warn('⚠️ Tool validation failed: Component uses forbidden Card components');
    return false;
  }

  // Check for forbidden import/export statements
  if (componentCode.includes('import ') || componentCode.includes('export ')) {
    console.warn('⚠️ Tool validation failed: Component contains forbidden import/export statements');
    return false;
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