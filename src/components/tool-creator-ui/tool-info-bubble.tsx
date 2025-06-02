'use client';

import React, { useState } from 'react';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { Badge } from '@/components/ui/badge';
import { Type } from 'lucide-react';

interface ToolInfoBubbleProps {
  productToolDefinition: ProductToolDefinition | null;
  isDarkMode: boolean;
}

export function ToolInfoBubble({ productToolDefinition, isDarkMode }: ToolInfoBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Add additional safety checks
  if (!productToolDefinition || !productToolDefinition.metadata) return null;

  return (
    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
      {/* Hover trigger */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
          isDarkMode 
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-gray-100 border-gray-600' 
            : 'bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 border-gray-300'
        } border-2 shadow-lg hover:shadow-xl`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Type className="h-4 w-4" />
      </div>

      {/* Info bubble */}
      {isHovered && (
        <div
          className={`absolute left-12 top-1/2 transform -translate-y-1/2 w-80 p-4 rounded-lg shadow-xl border-2 z-30 animate-in fade-in slide-in-from-left-2 duration-200 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-600 text-gray-100' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Arrow pointing to trigger */}
          <div 
            className={`absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-2 w-0 h-0 ${
              isDarkMode 
                ? 'border-r-gray-600' 
                : 'border-r-gray-300'
            }`}
            style={{
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: '8px solid',
              borderRightColor: isDarkMode ? '#4B5563' : '#D1D5DB'
            }}
          />
          
          <div className="space-y-3">
            {/* Tool Title */}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold leading-tight">
                {productToolDefinition.metadata?.title || 'Untitled Tool'}
              </h3>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    isDarkMode ? 'border-gray-500 text-gray-300' : 'border-gray-400 text-gray-600'
                  }`}
                >
                  {productToolDefinition.metadata?.type || 'Tool'}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    isDarkMode ? 'border-gray-500 text-gray-300' : 'border-gray-400 text-gray-600'
                  }`}
                >
                  {productToolDefinition.metadata?.category || 'General'}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className={`text-sm leading-relaxed ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {productToolDefinition.metadata?.description || 'No description available'}
              </p>
              
              {productToolDefinition.metadata?.shortDescription && 
               productToolDefinition.metadata?.shortDescription !== productToolDefinition.metadata?.description && (
                <p className={`text-xs ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {productToolDefinition.metadata.shortDescription}
                </p>
              )}
            </div>

            {/* Additional metadata */}
            <div className={`space-y-2 pt-2 border-t ${
              isDarkMode ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  Target Audience:
                </span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {productToolDefinition.metadata?.targetAudience || 'General'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  Industry:
                </span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {productToolDefinition.metadata?.industry || 'General'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  Difficulty:
                </span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {productToolDefinition.metadata?.difficultyLevel || 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  Est. Time:
                </span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {productToolDefinition.metadata?.estimatedCompletionTime || 'N/A'} min
                </span>
              </div>
            </div>

            {/* Features tags */}
            {productToolDefinition.metadata?.features && productToolDefinition.metadata.features.length > 0 && (
              <div className="space-y-2">
                <p className={`text-xs font-medium ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Features:
                </p>
                <div className="flex flex-wrap gap-1">
                  {productToolDefinition.metadata.features.slice(0, 6).map((feature, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className={`text-xs px-2 py-0.5 ${
                        isDarkMode 
                          ? 'bg-gray-700 text-gray-300 border-gray-600' 
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      {feature}
                    </Badge>
                  ))}
                  {productToolDefinition.metadata.features.length > 6 && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs px-2 py-0.5 ${
                        isDarkMode 
                          ? 'bg-gray-700 text-gray-300 border-gray-600' 
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      +{productToolDefinition.metadata.features.length - 6}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 