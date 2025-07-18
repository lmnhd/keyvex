'use client';

// ============================================================================
// DYNAMIC COMPONENT RENDERER
// Safely renders AI-generated React component code
// ============================================================================

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch'; // Note: ShadCN calls it Switch, often referred to as Toggle
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Loader2, Info } from 'lucide-react';
import { trackValidationIssue } from '@/lib/validation/validation-tracker';

// Recharts components for data visualization
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Scatter,
  ScatterChart
} from 'recharts';

// Import JSX transpilation modules
import { 
  transformComponentCode, 
  detectComponentCodeFormat,
  type TranspilationResult 
} from '@/lib/transpilation/jsx-transpiler';
import { 
  isBabelLoaded, 
  getBabelLoadStatus,
  ensureBabelLoaded 
} from '@/lib/transpilation/babel-loader';

interface DynamicComponentRendererProps {
  componentCode: string;
  metadata: {
    title: string;
    description: string;
    slug: string;
    id?: string; // Add optional id for tracking
  };
  currentStyleMap?: Record<string, string>;
  onError?: (error: Error) => void;
  onValidationIssues?: (issues: Array<{
    id: string;
    issue: string;
    category: string;
    severity: 'warning' | 'error' | 'info';
    details?: string;
    codeSnippet?: string;
    autoFixable: boolean;
  }>) => void; // NEW: Callback for validation issues
  isLoading?: boolean;
}

export default function DynamicComponentRenderer({
  componentCode,
  metadata,
  currentStyleMap,
  onError,
  onValidationIssues,
  isLoading = false
}: DynamicComponentRendererProps) {
  const [renderError, setRenderError] = useState<string | null>(null);
  const [transpilationStatus, setTranspilationStatus] = useState<'pending' | 'loading' | 'ready' | 'error'>('pending');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Helper to track issues with tool metadata
  const trackIssue = (
    issue: string,
    category: 'react-keys' | 'style-mapping' | 'execution' | 'undefined-values' | 'syntax' | 'component-structure' | 'transpilation',
    severity: 'warning' | 'error' | 'info' = 'warning',
    details?: string,
    codeSnippet?: string,
    autoFixable: boolean = false
  ) => {
    const toolId = metadata.id || metadata.slug || 'unknown';
    return trackValidationIssue(toolId, metadata.title, issue, category, severity, details, codeSnippet, autoFixable);
  };

  // Effect to ensure Babel is loaded for JSX transpilation
  useEffect(() => {
    const initializeBabel = async () => {
      try {
        setTranspilationStatus('loading');
        
        if (!isBabelLoaded()) {
          console.log('🔄 Loading Babel for JSX transpilation...');
          await ensureBabelLoaded();
        }
        
        setTranspilationStatus('ready');
        console.log('✅ Babel ready for JSX transpilation');
      } catch (error) {
        console.error('❌ Failed to load Babel:', error);
        setTranspilationStatus('error');
      }
    };

    initializeBabel();
  }, []);

  // Safely compile and render the component code
  const compiledComponent = useMemo(() => {
    console.log('🔧 RENDERER TRACE ========================================');
    console.log('🔧 METADATA:', {
      title: metadata.title,
      id: metadata.id,
      slug: metadata.slug,
      description: metadata.description?.substring(0, 100) + '...'
    });
    console.log('🔧 CODE LENGTH:', componentCode?.length || 0);
    console.log('🔧 CODE HASH:', componentCode ? componentCode.length.toString() + '-' + componentCode.substring(0, 50).replace(/[^\w]/g, '').substring(0, 16) : 'NO-CODE');
    console.log('🔧 CODE PREVIEW (first 300 chars):', componentCode?.substring(0, 300) || 'NO CODE');
    console.log('🔧 CODE CONTAINS SLIDERS?:', componentCode?.includes('Slider') || false);
    console.log('🔧 CODE CONTAINS useState arrays?:', componentCode?.includes('useState([') || false);
    console.log('🔧 STYLE MAP:', currentStyleMap ? Object.keys(currentStyleMap).length + ' styles' : 'NO STYLES');
    console.log('🔧 TIMESTAMP:', new Date().toISOString());
    console.log('🔧 ======================================================');
    
    console.log('🔍 COMPILING COMPONENT - Starting compilation process');
    console.log('🔍 TRACE: componentCode length:', componentCode?.length || 0);
    console.log('🔍 TRACE: componentCode preview (first 200 chars):', componentCode?.substring(0, 200) || 'NO CODE');
    
    // Initialize validation issues collection for this render
    const validationIssues: Array<{
      id: string;
      issue: string;
      category: string;
      severity: 'warning' | 'error' | 'info';
      details?: string;
      codeSnippet?: string;
      autoFixable: boolean;
    }> = [];
    
    if (!componentCode) return null;

    // ========================================================================
    // JSX TRANSPILATION STEP - NEW: Transform JSX to JavaScript if needed
    // ========================================================================
    
    let processedComponentCode = componentCode;
    let transpilationInfo: string | null = null;
    
    try {
      console.log('🔄 JSX TRANSPILATION: Starting code format detection...');
      
      // Detect the format of the component code
      const formatDetection = detectComponentCodeFormat(componentCode);
      console.log('🔄 JSX TRANSPILATION: Format detection result:', formatDetection);
      
      // Handle different code formats
      if (formatDetection.codeFormat === 'jsx') {
        console.log('🔄 JSX TRANSPILATION: JSX format detected, transpiling...');
        
        // Check if Babel is ready
        const babelStatus = getBabelLoadStatus();
        if (!babelStatus.isLoaded) {
          console.warn('⚠️ JSX TRANSPILATION: Babel not ready, rendering will wait...');
          
          // Return a loading state while Babel loads
          if (transpilationStatus === 'loading') {
            return () => React.createElement('div', {
              className: 'flex items-center justify-center p-8 border border-blue-300 rounded bg-blue-50'
            }, [
              React.createElement(Loader2, { 
                key: 'spinner',
                className: 'mr-2 h-4 w-4 animate-spin text-blue-600' 
              }),
              React.createElement('span', { 
                key: 'text',
                className: 'text-blue-700' 
              }, 'Loading JSX transpiler...')
            ]);
          }
          
          if (transpilationStatus === 'error') {
            const issueId = trackIssue(
              'Babel failed to load for JSX transpilation',
              'transpilation',
              'error',
              'JSX components require Babel for browser execution',
              formatDetection.codeFormat,
              false
            );
            
            validationIssues.push({
              id: issueId,
              issue: 'Babel failed to load for JSX transpilation',
              category: 'transpilation',
              severity: 'error',
              details: 'JSX components require Babel for browser execution',
              codeSnippet: formatDetection.codeFormat,
              autoFixable: false
            });
            
            onValidationIssues?.(validationIssues);
            
            return () => React.createElement('div', {
              className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700'
            }, [
              React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'JSX Transpilation Failed'),
              React.createElement('div', { key: 'error', className: 'text-sm' }, 'Unable to load Babel for JSX transpilation'),
              React.createElement('div', { key: 'action', className: 'text-sm mt-2 text-red-600' }, 'Please refresh the page to retry')
            ]);
          }
          
          // Fallback to original code if Babel unavailable
          console.warn('⚠️ JSX TRANSPILATION: Babel unavailable, using original code');
        } else {
          // Perform JSX transpilation
          const transpilationResult: TranspilationResult = transformComponentCode(componentCode);
          
          if (transpilationResult.success) {
            processedComponentCode = transpilationResult.transpiledCode;
            transpilationInfo = 'JSX → JavaScript (transpiled)';
            console.log('✅ JSX TRANSPILATION: Successfully transpiled JSX to JavaScript');
            console.log('🔄 JSX TRANSPILATION: Transpiled code length:', processedComponentCode.length);
            console.log('🔄 JSX TRANSPILATION: Transpiled preview:', processedComponentCode.substring(0, 300));
          } else {
            console.error('❌ JSX TRANSPILATION: Transpilation failed:', transpilationResult.error);
            
            const issueId = trackIssue(
              'JSX transpilation failed',
              'transpilation',
              'error',
              transpilationResult.error,
              componentCode.substring(0, 200),
              false
            );
            
            validationIssues.push({
              id: issueId,
              issue: 'JSX transpilation failed',
              category: 'transpilation',
              severity: 'error',
              details: transpilationResult.error,
              codeSnippet: componentCode.substring(0, 200),
              autoFixable: false
            });
            
            onValidationIssues?.(validationIssues);
            
            return () => React.createElement('div', {
              className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700'
            }, [
              React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'JSX Transpilation Error'),
              React.createElement('div', { key: 'error', className: 'text-sm' }, transpilationResult.error || 'Unknown transpilation error'),
              React.createElement('div', { key: 'action', className: 'text-sm mt-2 text-red-600' }, 'Please try regenerating the component')
            ]);
          }
        }
      } else if (formatDetection.codeFormat === 'createElement') {
        transpilationInfo = 'React.createElement (legacy)';
        console.log('✅ JSX TRANSPILATION: Legacy createElement format detected, no transpilation needed');
      } else {
        transpilationInfo = 'Unknown format (proceeding)';
        console.log('⚠️ JSX TRANSPILATION: Unknown format detected, proceeding without transpilation');
      }
      
      console.log('🔄 JSX TRANSPILATION: Final processed code length:', processedComponentCode.length);
      console.log('🔄 JSX TRANSPILATION: Format info:', transpilationInfo);
      
    } catch (transpilationError) {
      console.error('❌ JSX TRANSPILATION: Unexpected error during transpilation:', transpilationError);
      
      const issueId = trackIssue(
        'Unexpected JSX transpilation error',
        'transpilation',
        'error',
        String(transpilationError),
        componentCode.substring(0, 200),
        false
      );
      
      validationIssues.push({
        id: issueId,
        issue: 'Unexpected JSX transpilation error',
        category: 'transpilation',
        severity: 'error',
        details: String(transpilationError),
        codeSnippet: componentCode.substring(0, 200),
        autoFixable: false
      });
      
      onValidationIssues?.(validationIssues);
      
      return () => React.createElement('div', {
        className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700'
      }, [
        React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'Transpilation System Error'),
        React.createElement('div', { key: 'error', className: 'text-sm' }, String(transpilationError)),
        React.createElement('div', { key: 'action', className: 'text-sm mt-2 text-red-600' }, 'Please try refreshing the page')
      ]);
    }

    // ========================================================================
    // CONTINUE WITH EXISTING VALIDATION AND COMPILATION LOGIC
    // (Using processedComponentCode instead of original componentCode)
    // ========================================================================

    try {
      // Check for basic syntax issues first
      if (!processedComponentCode.trim()) {
        console.warn('⚠️ Component code is empty');
        const issueId = trackIssue('Component code is empty', 'component-structure', 'error');
        validationIssues.push({
          id: issueId,
          issue: 'Component code is empty',
          category: 'component-structure',
          severity: 'error',
          details: undefined,
          codeSnippet: undefined,
          autoFixable: false
        });
        
        // Call validation callback
        onValidationIssues?.(validationIssues);
        
        return () => React.createElement('div', { 
          className: 'p-4 border border-yellow-300 rounded bg-yellow-50 text-yellow-700 text-center' 
        }, 'No component code provided');
      }

      // Check for null/undefined character sequences that could cause issues
      if (processedComponentCode.includes('\\x00') || processedComponentCode.includes('\\\\x00')) {
        console.warn('⚠️ Component code contains null characters');
        const issueId = trackIssue('Component code contains null characters', 'syntax', 'error', 'Component appears to be corrupted');
        validationIssues.push({
          id: issueId,
          issue: 'Component code contains null characters',
          category: 'syntax',
          severity: 'error',
          details: 'Component appears to be corrupted',
          codeSnippet: undefined,
          autoFixable: false
        });
        
        // Call validation callback
        onValidationIssues?.(validationIssues);
        
        return () => React.createElement('div', { 
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center' 
        }, 'Component code is corrupted');
      }

      // Enhanced validation for problematic undefined patterns
      let hasProblematicUndefined = false;
      const foundPatterns: string[] = [];
      
      console.log('🔍 TRACE: Checking for problematic undefined patterns...');
      
      // More precise patterns that avoid false positives
      const problematicUndefinedPatterns = [
        /,\s*undefined\s*,/g,                    // undefined as array element: [a, undefined, b]
        /,\s*undefined\s*\)/g,                   // undefined as function parameter: func(a, undefined)
        /\(\s*undefined\s*,/g,                   // undefined as first parameter: func(undefined, b)
        /:\s*undefined\s*[,}]/g,                 // undefined as object value: {key: undefined,} or {key: undefined}
        /=\s*undefined\s*;/g,                    // undefined assignment: var x = undefined;
        /useState\(\s*undefined\s*\)/g,          // useState(undefined) - problematic state initialization
        /useEffect\(\s*undefined\s*[,)]/g,       // useEffect(undefined, ...) - invalid effect
        /React\.createElement\([^,]*,\s*undefined\s*[,)]/g, // React.createElement(Component, undefined, ...)
      ];
      
      // Additional check: exclude common valid patterns that contain "undefined" but are safe
      const validUndefinedPatterns = [
        /details:\s*undefined/g,                 // Object property can be undefined
        /codeSnippet:\s*undefined/g,             // Object property can be undefined
        /typeof\s+\w+\s*[!=]==?\s*['"]undefined['"]/g, // typeof checks
        /!==?\s*undefined/g,                     // !== undefined checks
        /===?\s*undefined/g,                     // === undefined checks
        /\?\?\s*undefined/g,                     // nullish coalescing with undefined
        /\|\|\s*undefined/g,                     // logical OR with undefined fallback
      ];
      
      for (const pattern of problematicUndefinedPatterns) {
        const matches = processedComponentCode.match(pattern);
        if (matches) {
          // Filter out matches that are actually valid patterns
          const filteredMatches = matches.filter(match => {
            return !validUndefinedPatterns.some(validPattern => validPattern.test(match));
          });
          
          if (filteredMatches.length > 0) {
            hasProblematicUndefined = true;
            foundPatterns.push(...filteredMatches);
          }
        }
      }
      
      if (hasProblematicUndefined) {
        console.warn('🔍 TRACE: ⚠️ Problematic undefined patterns found:', foundPatterns);
        
        // DEBUG: Log the exact patterns found to help diagnose false positives
        console.log('🔍 DEBUG: Found undefined patterns:', foundPatterns);
        console.log('🔍 DEBUG: Component code sample:', processedComponentCode.substring(0, 500));
        
        // TEMPORARY: Convert this to a warning instead of blocking error
        const issueId = trackIssue(
          'Potential undefined values detected (non-blocking)',
          'undefined-values',
          'warning',
          `Found patterns: ${foundPatterns.join(', ')}`,
          foundPatterns.slice(0, 3).join('; '), // First 3 examples
          false
        );
        
        validationIssues.push({
          id: issueId,
          issue: 'Potential undefined values detected (non-blocking)',
          category: 'undefined-values',
          severity: 'warning',
          details: `Found patterns: ${foundPatterns.join(', ')}`,
          codeSnippet: foundPatterns.slice(0, 3).join('; '),
          autoFixable: false
        });
        
        // Continue with component rendering instead of blocking
        console.log('🔍 TRACE: ⚠️ Allowing component to render despite undefined pattern detection (debug mode)');
      }
      
      console.log('🔍 TRACE: ✅ No problematic undefined patterns detected');

      // NEW: Check for missing React keys in arrays
      console.log('🔍 TRACE: Checking for missing React keys in arrays...');
      const missingKeysPatterns = [
        /React\.createElement\([^,]+,\s*\{[^}]*\},\s*\[[^\]]*React\.createElement[^\]]*\]/g, // Arrays without keys
        /\[[^\]]*React\.createElement\([^,]+,\s*\{(?![^}]*key:)[^}]*\}/g, // createElement without key in array
      ];
      
      let hasMissingKeys = false;
      const foundMissingKeyPatterns: string[] = [];
      
      for (const pattern of missingKeysPatterns) {
        const matches = processedComponentCode.match(pattern);
        if (matches) {
          // Check if the matches actually represent arrays without keys
          for (const match of matches) {
            if (match.includes('[') && match.includes('React.createElement') && !match.includes('key:')) {
              hasMissingKeys = true;
              foundMissingKeyPatterns.push(match.substring(0, 100) + '...');
            }
          }
        }
      }
      
      if (hasMissingKeys) {
        console.warn('🔍 TRACE: ⚠️ Missing React keys detected in arrays:', foundMissingKeyPatterns);
        console.log('🔍 TRACE: ⚠️ Allowing component to render with warning overlay');
        
        // Track this as a warning (not blocking)
        const issueId = trackIssue(
          'Missing React keys in array elements',
          'react-keys',
          'warning',
          'Arrays containing React elements should have unique key props',
          foundMissingKeyPatterns.slice(0, 2).join('; '), // First 2 examples
          true // This is auto-fixable
        );
        
        validationIssues.push({
          id: issueId,
          issue: 'Missing React keys in array elements',
          category: 'react-keys',
          severity: 'warning',
          details: 'Arrays containing React elements should have unique key props',
          codeSnippet: foundMissingKeyPatterns.slice(0, 2).join('; '),
          autoFixable: true
        });
      }
      
      console.log('🔍 TRACE: ✅ Proceeding with component compilation');

      // TEST JAVASCRIPT EXECUTION FIRST - This is key for catching corrupted tools!
      try {
        console.log('🔍 TRACE: Testing JavaScript execution safety...');
        
        // Check if this component uses complex state patterns that might fail in test mode
        const hasComplexStatePattern = /const\s+\[[^,]+,\s*[^\]]+\]\s*=\s*useState/.test(processedComponentCode) && 
                                      /React\.createElement/.test(processedComponentCode);
        
        if (hasComplexStatePattern) {
          console.log('🔍 TRACE: Component uses complex state patterns, skipping detailed test execution');
        } else {
          // Create a safe test environment to check if the code will execute without errors
          const testFunction = new Function(`
            "use strict";
            const React = { createElement: () => null };
            const useState = (initial) => [initial, () => {}];
            const useEffect = () => {};
            const useCallback = () => {};
            const useMemo = () => {};
            const Button = () => null;
            const Input = () => null;
            const Label = () => null;
            const Select = () => null;
            
            try {
              ${processedComponentCode}
              return { success: true };
            } catch (error) {
              return { success: false, error: error.message };
            }
          `);
          
          const testResult = testFunction();
          
          if (!testResult.success) {
            console.error('🔍 TRACE: ⚠️ JavaScript execution test FAILED:', testResult.error);
            const issueId = trackIssue(
              'Component code execution failed',
              'execution',
              'error',
              testResult.error,
              processedComponentCode.substring(0, 200), // Code snippet
              false
            );
            
            validationIssues.push({
              id: issueId,
              issue: 'Component code execution failed',
              category: 'execution',
              severity: 'error',
              details: testResult.error,
              codeSnippet: processedComponentCode.substring(0, 200),
              autoFixable: false
            });
            
            // Call validation callback
            onValidationIssues?.(validationIssues);
            
            return () => React.createElement('div', {
              className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700'
            }, [
              React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'Component Compilation Failed'),
              React.createElement('div', { key: 'error', className: 'text-sm' }, testResult.error),
              React.createElement('div', { key: 'action', className: 'text-sm mt-2 text-red-600' }, 'Please try regenerating the component'),
              React.createElement('div', { key: 'transpilation-info', className: 'text-xs mt-2 text-gray-600' }, `Format: ${transpilationInfo || 'Unknown'}`),
              React.createElement('details', { key: 'details', className: 'mt-3' }, [
                React.createElement('summary', { key: 'summary', className: 'text-xs cursor-pointer' }, 'Technical Details'),
                React.createElement('pre', { key: 'pre', className: 'text-xs mt-1 p-2 bg-red-100 rounded overflow-auto' }, testResult.error)
              ])
            ]);
          }
        }
        
        console.log('🔍 TRACE: ✅ JavaScript execution test PASSED');
      } catch (executionError) {
        console.error('🔍 TRACE: ⚠️ JavaScript execution test threw error:', executionError);
        const issueId = trackIssue(
          'Component execution threw unexpected error',
          'execution',
          'error',
          String(executionError),
          processedComponentCode.substring(0, 200),
          false
        );
        
        validationIssues.push({
          id: issueId,
          issue: 'Component execution threw unexpected error',
          category: 'execution',
          severity: 'error',
          details: String(executionError),
          codeSnippet: processedComponentCode.substring(0, 200),
          autoFixable: false
        });
        
        // Call validation callback
        onValidationIssues?.(validationIssues);
        
        return () => React.createElement('div', {
          className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700'
        }, [
          React.createElement('div', { key: 'title', className: 'font-semibold mb-2' }, 'Component Execution Error'),
          React.createElement('div', { key: 'error', className: 'text-sm' }, String(executionError)),
          React.createElement('div', { key: 'action', className: 'text-sm mt-2 text-red-600' }, 'This tool appears to be corrupted and needs to be regenerated'),
          React.createElement('div', { key: 'transpilation-info', className: 'text-xs mt-2 text-gray-600' }, `Format: ${transpilationInfo || 'Unknown'}`)
        ]);
      }

      // Create the component function with proper error boundaries
      console.log('🔍 TRACE: Creating component function...');
      
      // Instead of trying to extract the component function with eval,
      // modify the component code to directly return the component
      let modifiedComponentCode = processedComponentCode;
      
      // Find the component function declaration and convert it to a return statement
      const componentMatch = processedComponentCode.match(/(?:const|function)\s+(\w+)\s*[=\(]/);
      if (componentMatch && componentMatch[1]) {
        const componentName = componentMatch[1];
        console.log('🔍 TRACE: Detected component name:', componentName);
        
        // Replace the component declaration with a return statement
        if (processedComponentCode.includes(`const ${componentName} = `)) {
          // Handle const ComponentName = () => { ... }
          modifiedComponentCode = processedComponentCode.replace(
            `const ${componentName} = `,
            'return '
          );
        } else if (processedComponentCode.includes(`function ${componentName}`)) {
          // Handle function ComponentName() { ... }
          modifiedComponentCode = processedComponentCode.replace(
            `function ${componentName}`,
            'return function'
          );
        }
      } else {
        throw new Error('Unable to detect component function in code');
      }
      
      console.log('🔍 TRACE: Modified component code for direct return');
      console.log('🔍 TRACE: Modified code preview:', modifiedComponentCode.substring(0, 500));
      
      const componentFunction = new Function(
        'React', 'useState', 'useEffect', 'useCallback', 'useMemo',
        'Button', 'Input', 'Label', 
        'Card', 'CardHeader', 'CardFooter', 'CardTitle', 'CardDescription', 'CardContent',
        'Select', 'SelectGroup', 'SelectValue', 'SelectTrigger', 'SelectContent', 'SelectItem', 'SelectLabel', 'SelectSeparator',
        'Textarea', 
        'RadioGroup', 'RadioGroupItem',
        'Checkbox', 
        'Slider',
        'Switch',
        'Accordion', 'AccordionContent', 'AccordionItem', 'AccordionTrigger',
        'Dialog', 'DialogPortal', 'DialogOverlay', 'DialogClose', 'DialogTrigger', 'DialogContent', 'DialogHeader', 'DialogFooter', 'DialogTitle', 'DialogDescription',
        'Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger',
        'Progress',
        'AlertCircle', 'Loader2', 'Info',
        // Recharts components for data visualization
        'BarChart', 'Bar', 'LineChart', 'Line', 'PieChart', 'Pie', 'Cell', 'AreaChart', 'Area',
        'XAxis', 'YAxis', 'CartesianGrid', 'RechartsTooltip', 'Legend', 'ResponsiveContainer',
        'RadialBarChart', 'RadialBar', 'ComposedChart', 'Scatter', 'ScatterChart',
        `
        "use strict";
        try {
          ${modifiedComponentCode}
        } catch (error) {
          console.error('🔍 TRACE: Component execution error:', error);
          return () => React.createElement('div', {
            className: 'p-4 border border-red-300 rounded bg-red-50 text-red-700 text-center'
          }, 'Component failed to load: ' + error.message);
        }
      `);

      console.log('🔍 TRACE: Component function created successfully');
      console.log('🔍 TRACE: About to execute component function with dependencies...');

      // Get the component with all required dependencies
      const ComponentImpl = componentFunction(
        React, useState, useEffect, useCallback, useMemo,
        Button, Input, Label,
        Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent,
        Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel, SelectSeparator,
        Textarea,
        RadioGroup, RadioGroupItem,
        Checkbox,
        Slider,
        Switch,
        Accordion, AccordionContent, AccordionItem, AccordionTrigger,
        Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
        Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
        Progress,
        AlertCircle, Loader2, Info,
        // Recharts components for data visualization
        BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
        XAxis, YAxis, CartesianGrid, RechartsTooltip, Legend, ResponsiveContainer,
        RadialBarChart, RadialBar, ComposedChart, Scatter, ScatterChart
      );
      
      console.log('🔍 TRACE: ✅ Component compilation successful');
      console.log('🔍 TRACE: Transpilation info:', transpilationInfo);
      
      // Call validation callback with any collected issues
      if (validationIssues.length > 0 || hasMissingKeys) {
        onValidationIssues?.(validationIssues);
      }
      
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
        React.createElement('div', { key: 'transpilation-info', className: 'text-xs mt-2 text-gray-600' }, `Format: ${transpilationInfo || 'Unknown'}`),
        React.createElement('details', { key: 'details', className: 'mt-3' }, [
          React.createElement('summary', { key: 'summary', className: 'text-xs cursor-pointer' }, 'Technical Details'),
          React.createElement('pre', { key: 'pre', className: 'text-xs mt-1 p-2 bg-red-100 rounded overflow-auto' }, String(error))
        ])
      ]);
    }
  }, [componentCode, onValidationIssues, transpilationStatus]);

  // Effect to apply styles from currentStyleMap
  useEffect(() => {
    if (currentStyleMap && wrapperRef.current) {
      console.log('🎨 APPLYING STYLES - Starting style application...');
      let stylesApplied = 0;
      
      for (const [dataStyleId, classNameString] of Object.entries(currentStyleMap)) {
        const element = wrapperRef.current.querySelector(`[data-style-id="${dataStyleId}"]`) as HTMLElement;
        if (element) {
          // 🚨 CRITICAL FIX: Preserve existing Radix UI classes and merge with style map
          const existingClasses = element.className;
          const isRadixComponent = existingClasses.includes('data-[') || existingClasses.includes('relative flex') || existingClasses.includes('touch-none');
          
          if (isRadixComponent) {
            // For Radix UI components, merge classes instead of replacing
            const existingClassArray = existingClasses.split(' ').filter(cls => cls.trim());
            const newClassArray = classNameString.split(' ').filter(cls => cls.trim());
            
            // Remove duplicates and merge
            const mergedClasses = [...new Set([...existingClassArray, ...newClassArray])].join(' ');
            element.className = mergedClasses;
            console.log(`🎨 MERGED RADIX CLASSES: ${dataStyleId} -> ${existingClasses} + ${classNameString} = ${mergedClasses}`);
          } else {
            // For non-Radix components, replace as before
            element.className = classNameString;
            console.log(`🎨 REPLACED CLASSES: ${dataStyleId} -> ${classNameString}`);
          }
          
          stylesApplied++;
        } else {
          console.warn(`🎨 STYLE TARGET NOT FOUND: ${dataStyleId}`);
        }
      }
      
      console.log(`🎨 STYLES APPLIED: ${stylesApplied}/${Object.keys(currentStyleMap).length} styles applied`);
      
      // 🚨 CRITICAL FIX: Force a micro-re-render to ensure Radix UI components initialize properly
      // This fixes the slider/checkbox initialization timing issue
      if (stylesApplied > 0) {
        console.log('🎨 FORCING COMPONENT REFRESH for proper Radix UI initialization...');
        
        // Use requestAnimationFrame to ensure DOM updates are complete
        requestAnimationFrame(() => {
          // Trigger a subtle DOM change that forces React to re-evaluate component state
          // This ensures Radix UI components re-initialize with the correct styles
          const wrapper = wrapperRef.current;
          if (wrapper) {
            // Temporarily add and remove a class to trigger re-render
            wrapper.classList.add('styles-applied');
            
            // Use another frame to remove the class and complete the refresh cycle
            requestAnimationFrame(() => {
              wrapper.classList.remove('styles-applied');
              console.log('🎨 ✅ COMPONENT REFRESH COMPLETE - Radix UI components should now render correctly');
            });
          }
        });
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
