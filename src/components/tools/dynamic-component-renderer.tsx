'use client';

// ============================================================================
// DYNAMIC COMPONENT RENDERER
// Safely renders AI-generated React component code
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';

interface DynamicComponentRendererProps {
  componentCode: string;
  metadata: {
    title: string;
    description: string;
    slug: string;
  };
  onError?: (error: Error) => void;
  isLoading?: boolean;
}

export default function DynamicComponentRenderer({
  componentCode,
  metadata,
  onError,
  isLoading = false
}: DynamicComponentRendererProps) {
  const [renderError, setRenderError] = useState<string | null>(null);
  const [componentInstance, setComponentInstance] = useState<React.ComponentType | null>(null);

  // Safely compile and render the component code
  const compiledComponent = useMemo(() => {
    if (!componentCode) return null;

    try {
      console.log('[Dynamic Component] Executing pre-compiled component...');
      
      // The componentCode is now pre-compiled JavaScript (not JSX)
      // We just need to execute it safely with proper context
      
      // Step 1: Pre-validate the code for common syntax errors
      console.log('[Dynamic Component] 🔍 Pre-validating component code...');
      
      // Check for malformed regex patterns
      const regexPatterns = componentCode.match(/\/[^\/\n]*\/?/g);
      if (regexPatterns) {
        regexPatterns.forEach((pattern, index) => {
          try {
            // Try to validate each potential regex pattern
            if (pattern.startsWith('/') && !pattern.endsWith('/')) {
              console.warn(`[Dynamic Component] ⚠️ Potential malformed regex found: ${pattern}`);
            }
          } catch (e) {
            console.warn(`[Dynamic Component] ⚠️ Regex validation warning for pattern ${index}:`, e);
          }
        });
      }
      
      // Check for other common syntax issues
      const syntaxChecks = [
        { pattern: /\/\*([^*]|\*(?!\/))*$/g, name: 'unclosed block comment' },
        { pattern: /\/\/.*[\r\n].*\/\//g, name: 'potential comment issues' },
        { pattern: /['""][^'"]*$/g, name: 'unclosed string literal' },
        { pattern: /\{[^}]*$/g, name: 'unclosed brace' }
      ];
      
      syntaxChecks.forEach(check => {
        const matches = componentCode.match(check.pattern);
        if (matches && matches.length > 0) {
          console.warn(`[Dynamic Component] ⚠️ Potential ${check.name} detected:`, matches);
        }
      });
      
      // Step 2: Extract component name from the compiled code
      let componentName = 'GeneratedComponent';
      const functionMatch = componentCode.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
      if (functionMatch) {
        componentName = functionMatch[1];
      }

      console.log('[Dynamic Component] 🎯 Component name:', componentName);

      // Step 3: Create execution context with all React dependencies
      const contextVars = {
        React,
        useState,
        useEffect,
        useCallback,
        useMemo,
        Card,
        CardHeader, 
        CardTitle,
        CardContent,
        Input,
        Label,
        Button,
        Loader2,
        AlertCircle,
      };

      // Step 4: Execute the pre-compiled JavaScript with enhanced error handling
      const executableCode = `
        // Destructure all context variables
        const { ${Object.keys(contextVars).join(', ')} } = contextVars;
        
        // Execute the pre-compiled component code
        ${componentCode}
        
        // Return the component function
        return ${componentName};
      `;

      console.log('[Dynamic Component] 🔧 Executing pre-compiled code...');
      console.log('[Dynamic Component] 📄 Code preview (first 200 chars):', componentCode.substring(0, 200) + '...');

      // Step 5: Execute and get the component with try-catch for better error reporting
      let Component;
      try {
        const componentFunction = new Function('contextVars', executableCode);
        Component = componentFunction(contextVars);
      } catch (executionError) {
        // Enhanced error reporting for specific error types
        const errorMessage = executionError instanceof Error ? executionError.message : String(executionError);
        
        if (errorMessage.includes('Invalid regular expression')) {
          console.error('[Dynamic Component] 🚨 REGEX ERROR: The AI generated malformed regular expression code');
          console.error('[Dynamic Component] 📋 Code causing regex error:', componentCode);
          throw new Error(`Malformed regular expression in generated code: ${errorMessage}`);
        } else if (errorMessage.includes('Unexpected token')) {
          console.error('[Dynamic Component] 🚨 SYNTAX ERROR: Invalid JavaScript syntax in generated code');
          console.error('[Dynamic Component] 📋 Code with syntax error:', componentCode);
          throw new Error(`JavaScript syntax error in generated code: ${errorMessage}`);
        } else {
          console.error('[Dynamic Component] 🚨 EXECUTION ERROR:', errorMessage);
          console.error('[Dynamic Component] 📋 Full component code:', componentCode);
          throw executionError;
        }
      }

      // Step 6: Validate the result
      if (typeof Component !== 'function') {
        throw new Error(`Expected function, got ${typeof Component}. Component name: ${componentName}`);
      }

      console.log('[Dynamic Component] ✅ Successfully executed pre-compiled component:', componentName);
      setRenderError(null);
      return Component;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Dynamic Component] ❌ Execution failed:', errorMsg);
      
      setRenderError(`Component execution failed: ${errorMsg}`);
      
      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMsg));
      }
      
      return null;
    }
  }, [componentCode, onError]);

  // Error boundary for runtime errors
  const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      const handleError = (event: ErrorEvent) => {
        setHasError(true);
        setError(new Error(event.message));
        console.error('Runtime error in dynamic component:', event.error);
      };

      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }, []);

    if (hasError && error) {
      return (
        <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-medium">Component Runtime Error</h3>
          </div>
          <p className="text-sm text-red-600">{error.message}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setHasError(false); setError(null); }}
            className="mt-3"
          >
            Retry
          </Button>
        </div>
      );
    }

    return <>{children}</>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-500" />
          <p className="text-sm text-gray-600">Generating component...</p>
        </div>
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-medium">Component Execution Error</h3>
        </div>
        <p className="text-sm text-red-600 mb-3">{renderError}</p>
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-medium">View Component Code</summary>
          <pre className="mt-2 p-3 bg-gray-100 rounded overflow-x-auto whitespace-pre-wrap">
            {componentCode}
          </pre>
        </details>
      </div>
    );
  }

  if (!compiledComponent) {
    return (
      <div className="p-6 border border-gray-200 bg-gray-50 rounded-lg text-center">
        <p className="text-gray-600">No component code provided</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Dynamic Component - Removed metadata banner to save space */}
      <ErrorBoundary>
        <div className="dynamic-component-wrapper">
          {React.createElement(compiledComponent)}
        </div>
      </ErrorBoundary>
    </div>
  );
} 