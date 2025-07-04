declare global {
    interface Window {
      Babel: {
        transform: (code: string, options: BabelTransformOptions) => BabelTransformResult;
      };
    }
  }
  
  interface BabelTransformOptions {
    presets: string[];
    plugins?: (string | [string, Record<string, unknown>])[];
  }
  
  interface BabelTransformResult {
    code: string;
  }
  
  export interface TranspilationResult {
    success: boolean;
    transpiledCode: string;
    error?: string;
  }
  
  export interface ComponentCodeDetection {
    isJsxFormat: boolean;
    isLegacyFormat: boolean;
    codeFormat: 'jsx' | 'createElement' | 'unknown';
  }
  
  export function detectComponentCodeFormat(componentCode: string): ComponentCodeDetection {
    if (!componentCode || typeof componentCode !== 'string') {
      return {
        isJsxFormat: false,
        isLegacyFormat: false,
        codeFormat: 'unknown'
      };
    }
  
    const trimmedCode = componentCode.trim();
    
    const hasJsxElements = /<[A-Z][a-zA-Z0-9]*[\s\S]*?>/.test(trimmedCode) || 
                          /<[a-z]+[\s\S]*?>/.test(trimmedCode);
    
    const hasCreateElement = trimmedCode.includes('React.createElement');
    
    if (hasJsxElements && !hasCreateElement) {
      return {
        isJsxFormat: true,
        isLegacyFormat: false,
        codeFormat: 'jsx'
      };
    }
    
    if (hasCreateElement && !hasJsxElements) {
      return {
        isJsxFormat: false,
        isLegacyFormat: true,
        codeFormat: 'createElement'
      };
    }
    
    return {
      isJsxFormat: false,
      isLegacyFormat: false,
      codeFormat: 'unknown'
    };
  }
  
  export function transformComponentCode(componentCode: string): TranspilationResult {
    const detection = detectComponentCodeFormat(componentCode);
    
    if (detection.codeFormat === 'createElement') {
      return {
        success: true,
        transpiledCode: componentCode,
        error: undefined
      };
    }
    
    if (detection.codeFormat === 'jsx') {
      if (typeof window === 'undefined' || !window.Babel) {
        return {
          success: false,
          transpiledCode: '',
          error: 'Babel Standalone is not available'
        };
      }
  
      try {
        const result = window.Babel.transform(componentCode, {
          presets: ['react']
        });
  
        return {
          success: true,
          transpiledCode: result.code,
          error: undefined
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        return {
          success: false,
          transpiledCode: '',
          error: `Babel transpilation failed: ${errorMessage}`
        };
      }
    }
    
    return {
      success: true,
      transpiledCode: componentCode,
      error: undefined
    };
  }