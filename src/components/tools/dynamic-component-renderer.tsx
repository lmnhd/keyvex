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
          className: 'p-4 border border-yellow-300 rounded bg-yellow-50 text-yellow-700 text-center' 
        }, 'Component code contains invalid characters');
      }

      // Enhanced undefined value detection - only flag actual execution problems
      const problematicUndefinedPatterns = [
        /,\s*undefined\s*,/g,           // undefined as array element: [a, undefined, b]
        /,\s*undefined\s*\)/g,          // undefined as function parameter: func(a, undefined)
        /\(\s*undefined\s*,/g,          // undefined as first parameter: func(undefined, b)
        /:\s*undefined\s*,/g,           // undefined as object value: {key: undefined,}
        /=\s*undefined\s*;/g,           // undefined assignment: var x = undefined;
      ];

      let hasProblematicUndefined = false;
      const foundPatterns = [];
      
      console.log('🔍 TRACE: Checking for problematic undefined patterns...');
      for (const pattern of problematicUndefinedPatterns) {
        const matches = componentCode.match(pattern);
        if (matches) {
          hasProblematicUndefined = true;
          foundPatterns.push(`Pattern: ${pattern.source}, Matches: ${matches.length}`);
          console.error('🔍 TRACE: Found problematic undefined pattern:', pattern.source, 'Matches:', matches);
        }
      }

      if (hasProblematicUndefined) {
        console.error('🔍 TRACE: ⚠️ PROBLEMATIC UNDEFINED VALUES detected!');
        console.error('🔍 TRACE: Found patterns:', foundPatterns);
        console.error('🔍 TRACE: Component code with issues:', componentCode);
        return () => React.createElement('div', { 
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700' 
        }, [
          React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'Component Data Issue'),
          React.createElement('div', { key: 'message', className: 'mb-2' }, 'Component contains undefined values in data structures'),
          React.createElement('div', { key: 'advice', className: 'text-sm' }, 'Try regenerating the tool or contact support if this persists'),
          React.createElement('details', { key: 'details', className: 'mt-2 text-xs' }, [
            React.createElement('summary', { key: 'summary', className: 'cursor-pointer font-medium' }, 'Technical Details'),
            React.createElement('div', { key: 'patterns', className: 'mt-1 font-mono bg-red-100 p-2 rounded' }, foundPatterns.join(', '))
          ])
        ]);
      } else {
        console.log('🔍 TRACE: ✅ No problematic undefined patterns detected');
      }

      // Continue with component compilation...
      console.log('🔍 TRACE: Proceeding with component compilation');
      
      // Transform into executable function
      const componentFunction = new Function('React', 'useState', 'useEffect', 'useMemo', 'useCallback', `
        ${componentCode}
        if (typeof exports !== 'undefined' && exports.default) return exports.default;
        if (typeof module !== 'undefined' && module.exports && module.exports.default) return module.exports.default;
        // Look for the last function declaration or assignment
        const lines = \`${componentCode.replace(/`/g, '\\`')}\`.split('\\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('function ') || line.includes('= function') || line.includes('=> {') || line.includes('() => ')) {
            const match = line.match(/(?:function\\s+([a-zA-Z][a-zA-Z0-9]*)|([a-zA-Z][a-zA-Z0-9]*)\\s*=\\s*function|([a-zA-Z][a-zA-Z0-9]*)\\s*=\\s*(?:\\([^)]*\\)|[a-zA-Z][a-zA-Z0-9]*)\\s*=>)/);
            if (match) {
              const funcName = match[1] || match[2] || match[3];
              if (typeof eval(funcName) === 'function') return eval(funcName);
            }
          }
        }
        throw new Error('No valid React component found in code');
      `);

      console.log('🔍 TRACE: Component function created successfully');
      
      const CompiledComponent = componentFunction(React, React.useState, React.useEffect, React.useMemo, React.useCallback);
      
      if (typeof CompiledComponent !== 'function') {
        console.error('🔍 TRACE: Component compilation failed - not a function');
        throw new Error('Generated component is not a valid React component function');
      }

      console.log('🔍 TRACE: ✅ Component compilation successful');
      return CompiledComponent;

    } catch (error) {
      console.error('🔍 TRACE: ❌ Component compilation failed:', error);
      return () => React.createElement('div', { 
        className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700' 
      }, [
        React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'Component Compilation Failed'),
        React.createElement('div', { key: 'message', className: 'mb-2' }, error instanceof Error ? error.message : 'Unknown compilation error'),
        React.createElement('div', { key: 'advice', className: 'text-sm' }, 'Please try regenerating the component'),
        React.createElement('details', { key: 'details', className: 'mt-2 text-xs' }, [
          React.createElement('summary', { key: 'summary', className: 'cursor-pointer font-medium' }, 'Technical Details'),
          React.createElement('pre', { key: 'error', className: 'mt-1 bg-red-100 p-2 rounded overflow-auto' }, String(error))
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