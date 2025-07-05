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
    // Step 1: Detect code format (JSX vs legacy)
    const detection = detectComponentCodeFormat(componentCode);

    // Step 2: Short-circuit for legacy (React.createElement) format – no transpile needed
    if (detection.codeFormat === 'createElement') {
      return { success: true, transpiledCode: componentCode };
    }

    // Step 3: Sanitize the source by removing ES module syntax (import / export)
    // We replace `export default <Comp>;` with `return <Comp>;` so that the evaluated
    // function returns the component instance instead of relying on ESM.
    let sanitizedCode = componentCode
      // Strip all import statements (single & multi-line)
      .replace(/^\s*import[^;]+;?/gm, '')
      // Handle "export default <Identifier>;" by capturing the identifier
      .replace(/export\s+default\s+([A-Za-z0-9_]+)\s*;?/gm, 'return $1;')
      // Remove any other `export` statements
      .replace(/^\s*export\s+\{[^}]*\};?/gm, '');

    // If we didn’t capture an explicit return, ensure the component is returned.
    // Look for a component declaration and auto-return it.
    if (!/return\s+/.test(sanitizedCode)) {
      const match = sanitizedCode.match(/function\s+([A-Za-z0-9_]+)/) || sanitizedCode.match(/const\s+([A-Za-z0-9_]+)\s*=\s*\(/);
      if (match) {
        sanitizedCode += `\nreturn ${match[1]};`;
      }
    }

    // Step 4: Transpile JSX → JS via Babel Standalone (if available)
    if (detection.codeFormat === 'jsx') {
      if (typeof window === 'undefined' || !window.Babel) {
        return { success: false, transpiledCode: '', error: 'Babel Standalone is not available' };
      }

      try {
        const result = window.Babel.transform(sanitizedCode, { presets: ['react'] });
        return { success: true, transpiledCode: result.code };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Auto–repair for common "Adjacent JSX elements" error by wrapping with Fragment
        if (/Adjacent JSX elements/i.test(errorMessage)) {
          try {
            const wrapped = sanitizedCode.replace(/return\s*\(([\s\S]*?)\);?/m, (match, inner) => {
              return `return (<>${inner}</>);`;
            });
            const retryResult = window.Babel.transform(wrapped, { presets: ['react'] });
            return { success: true, transpiledCode: retryResult.code };
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            return { success: false, transpiledCode: '', error: `Babel transpilation failed (after auto-wrap): ${retryMsg}` };
          }
        }
        return { success: false, transpiledCode: '', error: `Babel transpilation failed: ${errorMessage}` };
      }
    }

    // Step 5: Unknown format – just return sanitized code
    return { success: true, transpiledCode: sanitizedCode };
  }
