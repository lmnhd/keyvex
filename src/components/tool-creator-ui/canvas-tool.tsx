'use client';

import React from 'react';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import DynamicComponentRenderer from '@/components/tools/dynamic-component-renderer';
import { Calculator, Loader2 } from 'lucide-react';

// ============================================================================
// SIMPLIFIED CANVAS TOOL FOR REACT COMPONENTS
// ============================================================================

interface CanvasToolProps {
  isDarkMode: boolean;
  className?: string;
  productToolDefinition?: ProductToolDefinition | null;
  isGenerating?: boolean;
  generatingMessage?: string;
  onValidationIssues?: (issues: Array<{
    id: string;
    issue: string;
    category: string;
    severity: 'warning' | 'error' | 'info';
    details?: string;
    codeSnippet?: string;
    autoFixable: boolean;
  }>) => void;
}

export function CanvasTool({ 
  isDarkMode, 
  className = '', 
  productToolDefinition, 
  isGenerating, 
  generatingMessage, 
  onValidationIssues 
}: CanvasToolProps) {
  if (isGenerating && generatingMessage) {
    return (
      <div className={`relative p-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${className} min-h-[400px]`}>
        {/* Show current tool heavily blurred in background */}
        {productToolDefinition && productToolDefinition.componentCode && (
          <div className="absolute inset-0 filter blur-md opacity-30 pointer-events-none overflow-hidden">
            <div className="p-6">
              <DynamicComponentRenderer
                componentCode={productToolDefinition.componentCode}
                metadata={{
                  title: productToolDefinition.metadata.title,
                  description: productToolDefinition.metadata.description,
                  slug: productToolDefinition.metadata.slug,
                  id: productToolDefinition.id
                }}
                currentStyleMap={productToolDefinition.currentStyleMap}
                onValidationIssues={onValidationIssues}
                isLoading={isGenerating}
                onError={(error: Error) => console.error('Canvas render error:', error)}
              />
            </div>
          </div>
        )}
        
        {/* Loading overlay - centered and properly positioned */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className={`border-2 border-dashed rounded-lg p-8 text-center bg-white/95 dark:bg-gray-800/95 shadow-xl backdrop-blur-sm ${
            isDarkMode ? 'border-gray-600' : 'border-gray-300'
          }`}>
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
            <h3 className="text-lg font-medium mb-2">Now Building</h3>
            <p className="text-sm opacity-70">
              {generatingMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (productToolDefinition && productToolDefinition.componentCode) {
    return (
      <div className={`p-6 ${className}`}>
        <DynamicComponentRenderer
          componentCode={productToolDefinition.componentCode}
          metadata={{
            title: productToolDefinition.metadata.title,
            description: productToolDefinition.metadata.description,
            slug: productToolDefinition.metadata.slug,
            id: productToolDefinition.id
          }}
          currentStyleMap={productToolDefinition.currentStyleMap}
          onValidationIssues={onValidationIssues}
          isLoading={isGenerating}
          onError={(error: Error) => console.error('Canvas render error:', error)}
        />
      </div>
    );
  }

  // Default placeholder when no tool is generated yet
  return (
    <div className={`p-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${className}`}>
      <div className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDarkMode ? 'border-gray-600' : 'border-gray-300'
      }`}>
        <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">Canvas Ready</h3>
        <p className="text-sm opacity-70">
          Your generated tool will appear here. Use the options menu to test tool creation!
        </p>
      </div>
    </div>
  );
}

export default CanvasTool; 