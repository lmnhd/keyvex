'use client';

// ============================================================================
// DYNAMIC COMPONENT RENDERER
// Safely renders AI-generated React component code
// ============================================================================

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

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
    console.log('🔍 TRACE: componentCode length:', componentCode?.length || 0);
    console.log('🔍 TRACE: componentCode preview (first 200 chars):', componentCode?.substring(0, 200) || 'NO CODE');
    
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
        }, 'Component code is corrupted');
      }

      // Enhanced validation for problematic undefined patterns
      let hasProblematicUndefined = false;
      const foundPatterns: string[] = [];
      
      console.log('🔍 TRACE: Checking for problematic undefined patterns...');
      
      const problematicUndefinedPatterns = [
        /,\s*undefined\s*,/g,           // undefined as array element: [a, undefined, b]
        /,\s*undefined\s*\)/g,          // undefined as function parameter: func(a, undefined)
        /\(\s*undefined\s*,/g,          // undefined as first parameter: func(undefined, b)
        /:\s*undefined\s*,/g,           // undefined as object value: {key: undefined,}
        /=\s*undefined\s*;/g,           // undefined assignment: var x = undefined;
      ];
      
      for (const pattern of problematicUndefinedPatterns) {
        const matches = componentCode.match(pattern);
        if (matches) {
          hasProblematicUndefined = true;
          foundPatterns.push(...matches);
        }
      }
      
      if (hasProblematicUndefined) {
        console.warn('🔍 TRACE: ⚠️ Problematic undefined patterns found:', foundPatterns);
        return () => React.createElement('div', {
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700'
        }, [
          React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'Component Data Issue'),
          React.createElement('div', { key: 'desc', className: 'text-sm' }, 'Component contains undefined values in data structures'),
          React.createElement('div', { key: 'action', className: 'text-sm mt-2 text-red-600' }, 'Try regenerating the tool or contact support if this persists')
        ]);
      }
      
      console.log('🔍 TRACE: ✅ No problematic undefined patterns detected');

      console.log('🔍 TRACE: Proceeding with component compilation');

      // TEST JAVASCRIPT EXECUTION FIRST - This is key for catching corrupted tools!
      try {
        console.log('🔍 TRACE: Testing JavaScript execution safety...');
        
        // Create a safe test environment to check if the code will execute without errors
        const testFunction = new Function(`
          "use strict";
          const React = { createElement: () => null };
          const useState = () => [null, () => {}];
          const useEffect = () => {};
          const useCallback = () => {};
          const useMemo = () => {};
          const Button = () => null;
          const Input = () => null;
          const Label = () => null;
          
          try {
            ${componentCode}
            return { success: true };
          } catch (error) {
            return { success: false, error: error.message };
          }
        `);
        
        const testResult = testFunction();
        
        if (!testResult.success) {
          console.error('🔍 TRACE: ⚠️ JavaScript execution test FAILED:', testResult.error);
          return () => React.createElement('div', {
            className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700'
          }, [
            React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'Component Compilation Failed'),
            React.createElement('div', { key: 'error', className: 'text-sm' }, testResult.error),
            React.createElement('div', { key: 'action', className: 'text-sm mt-2 text-red-600' }, 'Please try regenerating the component'),
            React.createElement('details', { key: 'details', className: 'mt-3' }, [
              React.createElement('summary', { key: 'summary', className: 'text-xs cursor-pointer' }, 'Technical Details'),
              React.createElement('pre', { key: 'pre', className: 'text-xs mt-1 p-2 bg-red-100 rounded overflow-auto' }, testResult.error)
            ])
          ]);
        }
        
        console.log('🔍 TRACE: ✅ JavaScript execution test PASSED');
      } catch (executionError) {
        console.error('🔍 TRACE: ⚠️ JavaScript execution test threw error:', executionError);
        return () => React.createElement('div', {
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700'
        }, [
          React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'Component Execution Error'),
          React.createElement('div', { key: 'error', className: 'text-sm' }, String(executionError)),
          React.createElement('div', { key: 'action', className: 'text-sm mt-2 text-red-600' }, 'This tool appears to be corrupted and needs to be regenerated')
        ]);
      }

      // Create the component function with proper error boundaries
      console.log('🔍 TRACE: Creating component function...');
      const componentFunction = new Function(
        'React', 'useState', 'useEffect', 'useCallback', 'useMemo',
        'Button', 'Input', 'Label', 
        `
        "use strict";
        try {
          ${componentCode}
          
          // Find the main component function using regex
          const functionPattern = /function\\s+(\\w+)\\s*\\([^)]*\\)\\s*\\{/;
          const match = \`${componentCode.replace(/`/g, '\\`')}\`.match(functionPattern);
          
          if (!match || !match[1]) {
            throw new Error('No valid React component function found - no function declaration detected');
          }
          
          const componentName = match[1];
          console.log('🔍 TRACE: Found component function name:', componentName);
          
          // Try to get the component function
          let componentFunc;
          try {
            componentFunc = eval(componentName);
          } catch (evalError) {
            throw new Error('No valid React component function found - function "' + componentName + '" is not accessible: ' + evalError.message);
          }
          
          if (typeof componentFunc !== 'function') {
            throw new Error('No valid React component function found - "' + componentName + '" is not a function');
          }
          
          console.log('🔍 TRACE: Successfully extracted component function:', componentName);
          return componentFunc;
        } catch (error) {
          console.error('🔍 TRACE: Component extraction error:', error);
          return () => React.createElement('div', {
            className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center'
          }, 'Component failed to load: ' + error.message);
        }
      `);

      console.log('🔍 TRACE: Component function created successfully');

      // Get the component with all required dependencies
      const ComponentImpl = componentFunction(
        React, useState, useEffect, useCallback, useMemo,
        Button, Input, Label
      );
      
      console.log('🔍 TRACE: ✅ Component compilation successful');
      return ComponentImpl;

    } catch (error) {
      console.error('🔍 TRACE: ⚠️ Component compilation error:', error);
      
      // Return a safe error component instead of throwing
      return () => React.createElement('div', {
        className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700'
      }, [
        React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'Component Compilation Failed'),
        React.createElement('div', { key: 'error', className: 'text-sm' }, String(error)),
        React.createElement('div', { key: 'action', className: 'text-sm mt-2 text-red-600' }, 'Please try regenerating the component'),
        React.createElement('details', { key: 'details', className: 'mt-3' }, [
          React.createElement('summary', { key: 'summary', className: 'text-xs cursor-pointer' }, 'Technical Details'),
          React.createElement('pre', { key: 'pre', className: 'text-xs mt-1 p-2 bg-red-100 rounded overflow-auto' }, String(error))
        ])
      ]);
    }
  }, [componentCode]);

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