'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ProductToolDefinition } from '@/lib/types/product-tool';

// ============================================================================
// SIMPLIFIED CANVAS TOOL FOR REACT COMPONENTS
// ============================================================================

interface CanvasToolProps {
  // For React component-based tools
  productToolDefinition?: ProductToolDefinition;
  
  // Common props
  isDarkMode?: boolean;
  className?: string;
  onComplete?: (results: any) => void;
  
  // Generation state
  isGenerating?: boolean;
  generatingMessage?: string;
}

export function CanvasTool({ 
  productToolDefinition,
  isDarkMode = false,
  className = '',
  onComplete,
  isGenerating,
  generatingMessage
}: CanvasToolProps) {
  
  // Show generation state
  if (isGenerating) {
    return (
      <div className={`w-full min-h-full flex items-center justify-center py-8 px-8 ${className}`}>
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Creating Your Tool</h3>
            <p className="text-gray-600">{generatingMessage || 'Generating React component...'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show React component if available
  if (productToolDefinition?.componentCode) {
    // TODO: Implement safe React component execution
    return (
      <div className={`w-full min-h-full flex items-center justify-center py-8 px-8 ${className}`}>
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">{productToolDefinition.metadata.title}</h3>
            <p className="text-gray-600 mb-4">{productToolDefinition.metadata.description}</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                🚧 React component execution coming soon!
              </p>
              <p className="text-sm text-yellow-700 mt-2">
                Generated component code is ready, implementing safe execution environment...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Default empty state
  return (
    <div className={`w-full min-h-full flex items-center justify-center py-8 px-8 ${className}`}>
      <Card className="w-full max-w-2xl">
        <CardContent className="p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-500 mb-2">No Tool Generated</h3>
          <p className="text-gray-400">Start a conversation to create your business tool</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default CanvasTool; 