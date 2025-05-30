'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calculator } from 'lucide-react';
import { ToolDefinition } from '@/lib/types/tool-definition';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { UniversalToolRenderer, validateToolDefinition } from './universal-tool-renderer';
import ProductToolRenderer from '@/components/product-tools/product-tool-renderer';

// ============================================================================
// LEGACY INTERFACES (for backward compatibility)
// ============================================================================

interface ToolData {
  title?: string;
  description?: string;
  colorScheme?: string;
  customColors?: string[];
  inputs?: string[];
  outputFormat?: string[];
  type?: string;
  features?: string[];
  targetAudience?: string;
  industry?: string;
  keyMetrics?: string[];
  confidenceLevel?: string;
  businessDescription?: string;
  customizations?: string;
}

// ============================================================================
// ENHANCED PROPS (supporting legacy, tool-definition, and product-tool)
// ============================================================================

interface CanvasToolProps {
  // Legacy props (for backward compatibility)
  toolData?: ToolData;
  colorScheme?: string;
  
  // Dynamic tool props
  toolDefinition?: ToolDefinition;          // Legacy dynamic tools
  productToolDefinition?: ProductToolDefinition;  // New product tools
  
  // Common props
  isDarkMode?: boolean;
  className?: string;
  onToolUpdate?: (data: any) => void;
  onComplete?: (results: any) => void;
  
  // NEW: Transition props for smooth tool generation
  isGenerating?: boolean;
  generatingMessage?: string;
}

// ============================================================================
// MAIN CANVAS TOOL COMPONENT
// ============================================================================

export function CanvasTool({ 
  toolData, 
  colorScheme = 'professional-blue',
  toolDefinition,
  productToolDefinition,
  isDarkMode = false,
  className = '',
  onToolUpdate,
  onComplete,
  isGenerating,
  generatingMessage
}: CanvasToolProps) {
  
  // Priority: ProductToolDefinition > ToolDefinition > legacy toolData
  
  // ============================================================================
  // MAIN RENDER LOGIC
  // ============================================================================
  
  // Check if we have a ProductToolDefinition (prioritized)
  if (productToolDefinition) {
    console.log('🔧 Rendering ProductToolDefinition:', productToolDefinition.metadata.title);
    
    // Get colors from ProductToolDefinition for background
    const colors = productToolDefinition.styling.colors;
    
    // Enhanced background style - this will be passed to the tool, not applied to canvas
    const getToolBackgroundStyle = () => {
      const baseBackground = colors.background || '#ffffff';
      
      // Handle gradient backgrounds
      if (colors.backgroundType === 'gradient' && baseBackground.includes('gradient')) {
        return { background: baseBackground };
      }
      
      // Handle pattern backgrounds
      if (colors.backgroundPattern) {
        const patternColor = colors.patternColor || '#e2e8f0';
        const patternOpacity = colors.patternOpacity || 0.1;
        
        let patternSvg = '';
        switch (colors.backgroundPattern) {
          case 'dots':
            patternSvg = `data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='dots' x='0' y='0' width='20' height='20' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='10' cy='10' r='2' fill='${encodeURIComponent(patternColor)}' opacity='${patternOpacity}'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23dots)'/%3E%3C/svg%3E`;
            break;
          case 'grid':
            patternSvg = `data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='${encodeURIComponent(patternColor)}' stroke-width='1' opacity='${patternOpacity}'/%3E%3C/svg%3E`;
            break;
          case 'diagonal':
            patternSvg = `data:image/svg+xml,%3Csvg width='30' height='30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,30 l30,-30 M-5,5 l10,-10 M25,35 l10,-10' stroke='${encodeURIComponent(patternColor)}' stroke-width='1' opacity='${patternOpacity}'/%3E%3C/svg%3E`;
            break;
          case 'waves':
            patternSvg = `data:image/svg+xml,%3Csvg width='60' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,10 Q15,0 30,10 T60,10' fill='none' stroke='${encodeURIComponent(patternColor)}' stroke-width='1' opacity='${patternOpacity}'/%3E%3C/svg%3E`;
            break;
        }
        
        return {
          backgroundColor: baseBackground,
          backgroundImage: `url("${patternSvg}")`
        };
      }
      
      // Handle texture backgrounds
      if (colors.backgroundTexture) {
        const textureOpacity = colors.textureOpacity || 0.05;
        let textureSvg = '';
        
        switch (colors.backgroundTexture) {
          case 'paper':
            textureSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3CfeColorMatrix values='0 0 0 0 0.9 0 0 0 0 0.9 0 0 0 0 0.9 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paper)' opacity='${textureOpacity}'/%3E%3C/svg%3E`;
            break;
          case 'fabric':
            textureSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='fabric'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.6' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.8 0 0 0 0 0.8 0 0 0 0 0.8 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23fabric)' opacity='${textureOpacity}'/%3E%3C/svg%3E`;
            break;
          case 'concrete':
            textureSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='concrete'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0.7 0 0 0 0 0.7 0 0 0 0 0.7 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23concrete)' opacity='${textureOpacity}'/%3E%3C/svg%3E`;
            break;
          case 'wood':
            textureSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='wood'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.4' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.6 0 0 0 0 0.5 0 0 0 0 0.3 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23wood)' opacity='${textureOpacity}'/%3E%3C/svg%3E`;
            break;
        }
        
        return {
          backgroundColor: baseBackground,
          backgroundImage: `url("${textureSvg}")`
        };
      }
      
      // Default solid background
      return { backgroundColor: baseBackground };
    };
    
    // Canvas background - ALWAYS consistent ambient styling
    const canvasBackgroundStyle = isDarkMode 
      ? {
          background: `
            radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.04) 0%, transparent 40%),
            radial-gradient(circle at 20% 70%, rgba(255, 255, 255, 0.06) 0%, transparent 35%),
            radial-gradient(circle at 80% 30%, rgba(255, 255, 255, 0.03) 0%, transparent 45%)
          `
        }
      : {
          background: `
            radial-gradient(circle at 30% 20%, rgba(0, 0, 0, 0.06) 0%, transparent 50%),
            radial-gradient(circle at 70% 80%, rgba(0, 0, 0, 0.03) 0%, transparent 40%),
            radial-gradient(circle at 20% 70%, rgba(0, 0, 0, 0.04) 0%, transparent 35%),
            radial-gradient(circle at 80% 30%, rgba(0, 0, 0, 0.02) 0%, transparent 45%)
          `
        };

    const canvasNoiseStyle = {
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' fill='%23000000' opacity='${isDarkMode ? '0.3' : '0.6'}'/%3E%3C/svg%3E")`,
      backgroundSize: '150px 150px',
      mixBlendMode: (isDarkMode ? 'screen' : 'multiply') as React.CSSProperties['mixBlendMode']
    };
    
    return (
      <div className={`w-full min-h-full flex items-center justify-center py-8 px-8 relative ${className}`}>
        
        {/* Canvas background gradients - ALWAYS present */}
        <div 
          className={`absolute inset-0 pointer-events-none ${
            isDarkMode ? 'opacity-60' : 'opacity-40'
          }`}
          style={canvasBackgroundStyle}
        />
        
        {/* Canvas noise texture overlay - ALWAYS present */}
        <div 
          className={`absolute inset-0 pointer-events-none ${
            isDarkMode ? 'opacity-30' : 'opacity-20'
          }`}
          style={canvasNoiseStyle}
        />
        
        {/* Transition Wrapper for smooth tool generation */}
        <div className={`w-full transition-all duration-500 ease-in-out relative z-10 ${
          isGenerating 
            ? 'opacity-40 blur-sm scale-95 pointer-events-none' 
            : 'opacity-100 blur-none scale-100'
        }`}>
          <ProductToolRenderer 
            toolDefinition={productToolDefinition}
            className="max-w-4xl mx-auto"
            onComplete={onComplete}
          />
        </div>
        
        {/* Generating Overlay */}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm z-20">
            <div className={`rounded-xl shadow-lg border px-6 py-4 flex items-center gap-3 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600 text-gray-100' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
              <span className="font-medium">
                {generatingMessage || 'Generating your tool...'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Check if we have a ToolDefinition (legacy)
  if (toolDefinition) {
    console.log('🔧 Rendering legacy Tool from definition:', toolDefinition.metadata.title);
    
    // Validate the tool definition first
    const validation = validateToolDefinition(toolDefinition);
    
    if (!validation.valid) {
      return (
        <div className={`w-full min-h-full flex items-center justify-center py-8 px-8 relative ${className}`}>
          <Card className="w-full max-w-2xl mx-auto shadow-lg border-red-300">
            <CardContent className="p-8 text-center">
              <div className="text-red-600 mb-4">
                <h2 className="text-xl font-bold">Tool Definition Invalid</h2>
                <p className="text-sm">Please fix the following errors:</p>
                <ul className="list-disc list-inside text-sm mt-2 text-left">
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
                {validation.warnings.length > 0 && (
                  <>
                    <p className="font-medium mt-4">Warnings:</p>
                    <ul className="list-disc list-inside text-sm text-yellow-600">
                      {validation.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    // Render warnings if any (but still proceed)
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Tool definition warnings:', validation.warnings);
    }
    
    return (
      <div className={`w-full min-h-full flex items-center justify-center py-8 px-8 relative ${className}`}>
        {/* NEW: Transition Wrapper for smooth tool generation */}
        <div className={`w-full transition-all duration-500 ease-in-out ${
          isGenerating 
            ? 'opacity-40 blur-sm scale-95 pointer-events-none' 
            : 'opacity-100 blur-none scale-100'
        }`}>
          <UniversalToolRenderer
            definition={toolDefinition}
            isDarkMode={isDarkMode}
            className={className}
            onValuesChange={onToolUpdate}
            onComplete={onComplete}
          />
        </div>
        
        {/* NEW: Generating Overlay */}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <div className={`rounded-xl shadow-lg border px-6 py-4 flex items-center gap-3 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600 text-gray-100' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
              <span className="font-medium">
                {generatingMessage || 'Generating your tool...'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // ============================================================================
  // LEGACY STATIC RENDERING (for backward compatibility)
  // ============================================================================
  
  console.log('🔧 Rendering legacy static tool from toolData');
  
  if (!toolData) {
    return (
      <div className={`w-full min-h-full flex items-center justify-center py-8 px-8 relative ${className}`}>
        <Card className="w-full max-w-2xl mx-auto shadow-lg border-gray-300">
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Calculator className="h-12 w-12 mx-auto mb-2" />
              <h2 className="text-xl font-bold">No Tool Data</h2>
              <p className="text-sm">Please provide either toolData or toolDefinition</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const getColorScheme = (scheme: string) => {
    const schemes = {
      'professional-blue': { primary: '#2563eb', secondary: '#1e40af', bg: '#eff6ff' },
      'modern-green': { primary: '#059669', secondary: '#047857', bg: '#ecfdf5' },
      'growth-green': { primary: '#059669', secondary: '#047857', bg: '#ecfdf5' },
      'elegant-purple': { primary: '#7c3aed', secondary: '#5b21b6', bg: '#f3e8ff' },
      'creative-purple': { primary: '#7c3aed', secondary: '#5b21b6', bg: '#f3e8ff' },
      'warm-orange': { primary: '#ea580c', secondary: '#c2410c', bg: '#fff7ed' },
      'energy-orange': { primary: '#ea580c', secondary: '#c2410c', bg: '#fff7ed' },
      'bold-red': { primary: '#dc2626', secondary: '#b91c1c', bg: '#fef2f2' },
      'calm-teal': { primary: '#0891b2', secondary: '#0e7490', bg: '#f0fdfa' },
      'trust-teal': { primary: '#0891b2', secondary: '#0e7490', bg: '#f0fdfa' },
      'custom': toolData.customColors ? {
        primary: toolData.customColors[0],
        secondary: toolData.customColors[1],
        bg: `${toolData.customColors[0]}10`
      } : { primary: '#6b7280', secondary: '#4b5563', bg: '#f9fafb' },
      default: { primary: '#6b7280', secondary: '#4b5563', bg: '#f9fafb' }
    };
    return schemes[scheme as keyof typeof schemes] || schemes.default;
  };

  const colors = getColorScheme(colorScheme);

  // Background gradients and textures
  const backgroundStyle = isDarkMode 
    ? {
        background: `
          radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.04) 0%, transparent 40%),
          radial-gradient(circle at 20% 70%, rgba(255, 255, 255, 0.06) 0%, transparent 35%),
          radial-gradient(circle at 80% 30%, rgba(255, 255, 255, 0.03) 0%, transparent 45%)
        `
      }
    : {
        background: `
          radial-gradient(circle at 30% 20%, rgba(0, 0, 0, 0.06) 0%, transparent 50%),
          radial-gradient(circle at 70% 80%, rgba(0, 0, 0, 0.03) 0%, transparent 40%),
          radial-gradient(circle at 20% 70%, rgba(0, 0, 0, 0.04) 0%, transparent 35%),
          radial-gradient(circle at 80% 30%, rgba(0, 0, 0, 0.02) 0%, transparent 45%)
        `
      };

  const noiseStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' fill='%23000000' opacity='${isDarkMode ? '0.3' : '0.6'}'/%3E%3C/svg%3E")`,
    backgroundSize: '150px 150px',
    mixBlendMode: (isDarkMode ? 'screen' : 'multiply') as React.CSSProperties['mixBlendMode']
  };

  return (
    <div className={`w-full min-h-full flex items-center justify-center py-8 px-8 relative ${className}`}>
      {/* Background gradients */}
      <div 
        className={`absolute inset-0 pointer-events-none ${
          isDarkMode ? 'opacity-60' : 'opacity-40'
        }`}
        style={backgroundStyle}
      />
      
      {/* Fine noise texture overlay */}
      <div 
        className={`absolute inset-0 pointer-events-none ${
          isDarkMode ? 'opacity-30' : 'opacity-20'
        }`}
        style={noiseStyle}
      />

      {/* NEW: Transition Wrapper for smooth tool generation */}
      <div className={`w-full transition-all duration-500 ease-in-out relative z-10 ${
        isGenerating 
          ? 'opacity-40 blur-sm scale-95 pointer-events-none' 
          : 'opacity-100 blur-none scale-100'
      }`}>
        {/* Tool Card with Beautiful Styling */}
        <Card className="w-full max-w-2xl mx-auto shadow-lg" style={{ backgroundColor: colors.bg }}>
          <CardContent className="p-8">
            {/* Tool Header */}
            <div className="text-center mb-8">
              <div 
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                style={{ backgroundColor: colors.primary }}
              >
                <Calculator className="h-8 w-8 text-white" />
              </div>
              <h1 
                className="text-2xl font-bold mb-2"
                style={{ color: colors.secondary }}
              >
                {toolData.title || 'Your Calculator'}
              </h1>
              <p className="text-gray-600">
                {toolData.description || 'Calculate your business metrics instantly'}
              </p>
              
              {/* Feature badges */}
              {toolData.features && toolData.features.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {toolData.features.map((feature, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs rounded-full border"
                      style={{ 
                        borderColor: colors.primary,
                        color: colors.primary,
                        backgroundColor: `${colors.primary}10`
                      }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Mock Calculator Interface */}
            <div className="space-y-6">
              {toolData.inputs && toolData.inputs.length > 0 ? (
                toolData.inputs.map((input: string, index: number) => (
                  <div key={index} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {input}
                    </label>
                    <Input 
                      placeholder={`Enter ${input.toLowerCase()}`}
                      className="w-full text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                ))
              ) : (
                // Default inputs when none specified
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Monthly Revenue
                    </label>
                    <Input placeholder="Enter monthly revenue" className="w-full text-gray-900 placeholder:text-gray-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Marketing Budget
                    </label>
                    <Input placeholder="Enter marketing budget" className="w-full text-gray-900 placeholder:text-gray-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Conversion Rate (%)
                    </label>
                    <Input placeholder="Enter conversion rate" className="w-full text-gray-900 placeholder:text-gray-500" />
                  </div>
                </>
              )}

              <Button 
                className="w-full py-3 text-lg font-semibold"
                style={{ backgroundColor: colors.primary }}
              >
                Calculate Results
              </Button>

              {/* Mock Results */}
              <div 
                className="mt-6 p-4 rounded-lg border-2"
                style={{ borderColor: colors.primary, backgroundColor: 'white' }}
              >
                <h3 className="font-semibold mb-2" style={{ color: colors.secondary }}>
                  Your Results:
                </h3>
                <div className="text-3xl font-bold" style={{ color: colors.primary }}>
                  {toolData.outputFormat?.includes('percentage') ? '24.5%' : 
                   toolData.outputFormat?.includes('currency') ? '$12,450' : 
                   '8.7/10'}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Based on your inputs
                </p>
                
                {/* Key metrics display */}
                {toolData.keyMetrics && toolData.keyMetrics.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    {toolData.keyMetrics.slice(0, 4).map((metric, index) => (
                      <div key={index} className="text-center">
                        <div className="text-lg font-semibold" style={{ color: colors.primary }}>
                          {index === 0 ? '156%' : index === 1 ? '$8,240' : index === 2 ? '2.3h' : '95%'}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {metric.replace('-', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tool Metadata */}
            {(toolData.targetAudience || toolData.industry) && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-center gap-6 text-xs text-gray-500">
                  {toolData.targetAudience && (
                    <span>Target: {toolData.targetAudience}</span>
                  )}
                  {toolData.industry && (
                    <span>Industry: {toolData.industry}</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* NEW: Generating Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm z-20">
          <div className={`rounded-xl shadow-lg border px-6 py-4 flex items-center gap-3 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-600 text-gray-100' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
            <span className="font-medium">
              {generatingMessage || 'Generating your tool...'}
            </span>
          </div>
        </div>
      )}
      
      {/* Extra bottom padding to ensure smooth scrolling */}
      <div className="h-8" />
    </div>
  );
} 