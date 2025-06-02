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
  currentStyleMap?: Record<string, string>;
  onError?: (error: Error) => void;
  isLoading?: boolean;
}

export default function DynamicComponentRenderer({
  componentCode,
  metadata,
  currentStyleMap,
  onError,
  isLoading = false
}: DynamicComponentRendererProps) {
  const [renderError, setRenderError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Safely compile and render the component code
  const compiledComponent = useMemo(() => {
    if (!componentCode) return null;

    // Log the raw component code for debugging
    console.log('🔍 RAW COMPONENT CODE:', componentCode);
    console.log('🔍 COMPONENT CODE LENGTH:', componentCode.length);
    console.log('🔍 COMPONENT CODE TYPE:', typeof componentCode);

    try {
      // Check for basic syntax issues first
      if (!componentCode.trim()) {
        throw new Error('Component code is empty');
      }

      // Check for null/undefined character sequences that could cause issues
      if (componentCode.includes('\x00') || componentCode.includes('\\x00')) {
        throw new Error('Component code contains null characters');
      }

      // Extract component name from the compiled code
      let componentName = 'GeneratedComponent';
      const functionMatch = componentCode.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
      if (functionMatch) {
        componentName = functionMatch[1];
      }

      console.log('🔍 EXTRACTED COMPONENT NAME:', componentName);

      // Create execution context with all React dependencies
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

      // Validate the component code doesn't contain obvious syntax errors
      if (componentCode.includes('undefined') || componentCode.includes('null,') || componentCode.includes(',,')) {
        console.warn('🔍 DETECTED POTENTIAL SYNTAX ISSUES IN CODE');
        throw new Error('Component code contains syntax errors (undefined values or double commas)');
      }

      // Execute the pre-compiled JavaScript with better error wrapping
      const executableCode = `
        try {
          // Destructure all context variables
          const { ${Object.keys(contextVars).join(', ')} } = contextVars;

          // Execute the pre-compiled component code
          ${componentCode}
          
          // Return the component function
          return ${componentName};
        } catch (syntaxError) {
          throw new Error('Syntax error in component code: ' + syntaxError.message);
        }
      `;

      console.log('🔍 FINAL EXECUTABLE CODE:', executableCode);

      const componentFunction = new Function('contextVars', executableCode);
      const Component = componentFunction(contextVars);

      if (typeof Component !== 'function') {
        throw new Error(`Expected function, got ${typeof Component}. Component name: ${componentName}`);
      }

      console.log('✅ COMPONENT COMPILED SUCCESSFULLY');
      setRenderError(null);
      return Component;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Component compilation error:', errorMsg);
      console.error('❌ Component code that failed:', componentCode);
      console.error('❌ Full error object:', error);
      
      // Also try to identify specific problematic characters
      const problematicChars = componentCode.match(/[^\x20-\x7E\s]/g);
      if (problematicChars) {
        console.error('❌ Found problematic characters:', problematicChars);
      }
      
      setRenderError(`Component execution failed: ${errorMsg}`);

      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMsg));
      }

      return null;
    }
  }, [componentCode, onError]);

  // Effect to apply styles from currentStyleMap
  useEffect(() => {
    if (currentStyleMap && wrapperRef.current) {
      for (const [dataStyleId, classNameString] of Object.entries(currentStyleMap)) {
        const element = wrapperRef.current.querySelector(`[data-style-id="${dataStyleId}"]`) as HTMLElement;
        if (element) {
          element.className = classNameString;
        }
      }
    }
  }, [currentStyleMap, compiledComponent]);

  // Error boundary for runtime errors
  const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      const handleError = (event: ErrorEvent) => {
        setHasError(true);
        setError(new Error(event.message));
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
      <ErrorBoundary>
        <div className="dynamic-component-wrapper" ref={wrapperRef}>
          {React.createElement(compiledComponent)}
        </div>
      </ErrorBoundary>
    </div>
  );
} 