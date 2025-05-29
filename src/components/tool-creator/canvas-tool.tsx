'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calculator } from 'lucide-react';

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

interface CanvasToolProps {
  toolData: ToolData;
  colorScheme: string;
  isDarkMode?: boolean;
  className?: string;
}

export function CanvasTool({ 
  toolData, 
  colorScheme, 
  isDarkMode = false,
  className = '' 
}: CanvasToolProps) {
  
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

      {/* Tool Preview Card */}
      <Card className="w-full max-w-2xl mx-auto shadow-lg relative z-10" style={{ backgroundColor: colors.bg }}>
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
      
      {/* Extra bottom padding to ensure smooth scrolling */}
      <div className="h-8" />
    </div>
  );
} 