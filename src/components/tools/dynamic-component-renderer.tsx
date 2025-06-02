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
    console.log('🔍 COMPILING COMPONENT - Starting compilation process');
    if (!componentCode) return null;

    try {
      // Check for basic syntax issues first
      if (!componentCode.trim()) {
        console.warn('⚠️ Component code is empty');
        return () => React.createElement('div', { 
          className: 'p-4 border border-yellow-300 rounded bg-yellow-50 text-yellow-700 text-center' 
        }, 'No component code provided');
      }

      // Check for null/undefined character sequences that could cause issues
      if (componentCode.includes('\\x00') || componentCode.includes('\\\\x00')) {
        console.warn('⚠️ Component code contains null characters');
        return () => React.createElement('div', { 
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center' 
        }, 'Component contains invalid characters');
      }

      // Check for obvious syntax issues like double commas
      if (componentCode.includes(',,')) {
        console.warn('⚠️ Component code contains syntax errors (double commas)');
        return () => React.createElement('div', { 
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center' 
        }, 'Component has syntax errors');
      }

      // Check for undefined values that might cause issues
      if (componentCode.includes('undefined,') || componentCode.includes(', undefined')) {
        console.warn('⚠️ Component code contains undefined values');
        return () => React.createElement('div', { 
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center' 
        }, 'Component contains undefined values');
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
        Button,
        Input,
        Label,
        AlertCircle,
        Loader2
      };

      // Create context string for Function constructor
      const contextKeys = Object.keys(contextVars);
      const contextValues = Object.values(contextVars);
      
      console.log('🔍 ABOUT TO EXECUTE FUNCTION CONSTRUCTOR');
      console.log('🔍 Context keys:', contextKeys);
      console.log('🔍 Component code preview:', componentCode.substring(0, 200));
      
      // Try to create the Function with detailed error handling
      let componentFunction;
      try {
        console.log('🔍 Step 1: Creating Function constructor...');
        componentFunction = new Function(...contextKeys, `return (${componentCode})`);
        console.log('🔍 FUNCTION CONSTRUCTOR SUCCESS - function created');
      } catch (functionError) {
        console.warn('⚠️ FUNCTION CONSTRUCTOR FAILED:', functionError instanceof Error ? functionError.message : 'Unknown error');
        console.warn('⚠️ Component code length:', componentCode.length);
        console.warn('⚠️ Component code preview (first 500 chars):', componentCode.substring(0, 500));
        
        // Call onError callback if provided
        onError?.(new Error(`Function constructor failed: ${functionError instanceof Error ? functionError.message : 'Unknown error'}`));
        
        return () => React.createElement('div', { 
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center' 
        }, [
          React.createElement('div', { key: 'icon', className: 'flex items-center justify-center mb-2' }, 
            React.createElement(AlertCircle, { className: 'h-5 w-5' })
          ),
          React.createElement('div', { key: 'title', className: 'font-medium mb-1' }, 'Component Compilation Failed'),
          React.createElement('div', { key: 'message', className: 'text-sm' }, 'The component code could not be compiled'),
          React.createElement('details', { key: 'details', className: 'mt-2 text-xs' }, [
            React.createElement('summary', { key: 'summary', className: 'cursor-pointer' }, 'Error Details'),
            React.createElement('div', { key: 'error', className: 'mt-1 p-2 bg-red-100 rounded' }, 
              functionError instanceof Error ? functionError.message : 'Unknown compilation error'
            )
          ])
        ]);
      }
      
      // Try to execute the function
      let GeneratedComponent;
      try {
        console.log('🔍 Step 2: Executing function with context values...');
        GeneratedComponent = componentFunction(...contextValues);
        console.log('🔍 COMPONENT EXECUTION SUCCESS - checking type...');
      } catch (executionError) {
        console.warn('⚠️ FUNCTION EXECUTION FAILED:', executionError instanceof Error ? executionError.message : 'Unknown error');
        
        // Call onError callback if provided
        onError?.(new Error(`Function execution failed: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`));
        
        return () => React.createElement('div', { 
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center' 
        }, [
          React.createElement('div', { key: 'icon', className: 'flex items-center justify-center mb-2' }, 
            React.createElement(AlertCircle, { className: 'h-5 w-5' })
          ),
          React.createElement('div', { key: 'title', className: 'font-medium mb-1' }, 'Component Execution Failed'),
          React.createElement('div', { key: 'message', className: 'text-sm' }, 'The component code could not be executed'),
          React.createElement('details', { key: 'details', className: 'mt-2 text-xs' }, [
            React.createElement('summary', { key: 'summary', className: 'cursor-pointer' }, 'Error Details'),
            React.createElement('div', { key: 'error', className: 'mt-1 p-2 bg-red-100 rounded' }, 
              executionError instanceof Error ? executionError.message : 'Unknown execution error'
            )
          ])
        ]);
      }

      // Validate the result
      if (typeof GeneratedComponent !== 'function') {
        console.warn('⚠️ INVALID COMPONENT TYPE:', typeof GeneratedComponent);
        console.warn('⚠️ Component value:', GeneratedComponent);
        
        // Call onError callback if provided
        onError?.(new Error('Generated code did not return a valid React component'));
        
        return () => React.createElement('div', { 
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center' 
        }, [
          React.createElement('div', { key: 'icon', className: 'flex items-center justify-center mb-2' }, 
            React.createElement(AlertCircle, { className: 'h-5 w-5' })
          ),
          React.createElement('div', { key: 'title', className: 'font-medium mb-1' }, 'Invalid Component'),
          React.createElement('div', { key: 'message', className: 'text-sm' }, 'Generated code did not return a valid React component')
        ]);
      }

      console.log('✅ COMPONENT COMPILATION COMPLETELY SUCCESSFUL');
      return GeneratedComponent;

    } catch (error) {
      console.warn('⚠️ COMPONENT COMPILATION FAILED:', error instanceof Error ? error.message : 'Unknown error');
      
      // Call onError callback if provided
      onError?.(error instanceof Error ? error : new Error('Component compilation failed'));
      
      // Return a simple error component without throwing
      return () => React.createElement('div', { 
        className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center' 
      }, [
        React.createElement('div', { key: 'icon', className: 'flex items-center justify-center mb-2' }, 
          React.createElement(AlertCircle, { className: 'h-5 w-5' })
        ),
        React.createElement('div', { key: 'title', className: 'font-medium mb-1' }, 'Component Load Error'),
        React.createElement('div', { key: 'message', className: 'text-sm' }, 'This component could not be loaded safely'),
        React.createElement('div', { key: 'suggestion', className: 'text-xs mt-2 text-red-600' }, 
          'Try creating a new tool or check the browser console for details'
        )
      ]);
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