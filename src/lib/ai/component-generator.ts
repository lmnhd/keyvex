// ============================================================================
// REACT COMPONENT GENERATOR
// AI generates actual React JSX code instead of JSON schemas
// ============================================================================

export interface ReactComponentRequest {
  toolType: 'calculator' | 'assessment' | 'survey' | 'analyzer';
  title: string;
  description: string;
  inputs: Array<{
    name: string;
    type: 'number' | 'text' | 'select' | 'checkbox';
    label: string;
    placeholder?: string;
    options?: string[];
  }>;
  calculations: Array<{
    name: string;
    formula: string;
    format: 'currency' | 'percentage' | 'number';
  }>;
  styling: {
    primaryColor: string;
    secondaryColor: string;
    theme: 'modern' | 'professional' | 'minimal';
  };
}

export interface GeneratedReactComponent {
  componentCode: string;
  imports: string[];
  metadata: {
    title: string;
    description: string;
    slug: string;
    estimatedTime: number;
  };
}

export async function generateReactComponent(
  request: ReactComponentRequest
): Promise<GeneratedReactComponent> {
  // This will be called by the AI to generate actual React component code
  
  const componentName = toPascalCase(request.title);
  
  // Generate input elements
  const inputElements = request.inputs.map(input => {
    if (input.type === 'select') {
      return `            <div className="space-y-2">
              <Label htmlFor="${input.name}" className="text-sm font-medium">
                ${input.label}
              </Label>
              <select 
                id="${input.name}"
                value={${input.name}}
                onChange={(e) => set${toPascalCase(input.name)}(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                ${input.options?.map(opt => `<option value="${opt}">${opt}</option>`).join('\n                ') || ''}
              </select>
            </div>`;
    } else {
      return `            <div className="space-y-2">
              <Label htmlFor="${input.name}" className="text-sm font-medium">
                ${input.label}
              </Label>
              <Input
                id="${input.name}"
                type="${input.type}"
                value={${input.name}}
                onChange={(e) => set${toPascalCase(input.name)}(${input.type === 'number' ? 'Number(e.target.value)' : 'e.target.value'})}
                placeholder="${input.placeholder || ''}"
                className="w-full"
              />
            </div>`;
    }
  }).join('\n\n');

  // Generate result elements
  const resultElements = request.calculations.map(calc => {
    let formatExpression;
    if (calc.format === 'currency') {
      formatExpression = `$\{${calc.name}.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (calc.format === 'percentage') {
      formatExpression = `\{${calc.name}.toFixed(1)}%`;
    } else {
      formatExpression = `\{${calc.name}.toLocaleString()}`;
    }
    
    return `              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">${calc.name}</p>
                <p className="text-2xl font-bold" style={{ color: '${request.styling.primaryColor}' }}>
                  ${formatExpression}
                </p>
              </div>`;
  }).join('\n\n');
  
  const componentCode = `'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ${componentName}() {
  // State management for all inputs
  ${request.inputs.map(input => 
    `const [${input.name}, set${toPascalCase(input.name)}] = useState(${input.type === 'number' ? '0' : "''"});`
  ).join('\n  ')}

  // Calculations
  ${request.calculations.map(calc => {
    const processedFormula = calc.formula
      .replace(/\b(\w+)\b/g, (match) => {
        const input = request.inputs.find(i => i.name === match);
        return input ? match : match;
      });
    
    return `const ${calc.name} = ${processedFormula};`;
  }).join('\n  ')}

  const handleReset = () => {
    ${request.inputs.map(input => 
      `set${toPascalCase(input.name)}(${input.type === 'number' ? '0' : "''"});`
    ).join('\n    ')}
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="shadow-lg" style={{ borderColor: '${request.styling.primaryColor}' }}>
        <CardHeader style={{ backgroundColor: '${request.styling.primaryColor}', color: 'white' }}>
          <CardTitle className="text-2xl">${request.title}</CardTitle>
          <p className="text-sm opacity-90">${request.description}</p>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          {/* Input Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
${inputElements}
          </div>

          {/* Results Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-${Math.min(request.calculations.length, 3)} gap-4">
${resultElements}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleReset}
              variant="outline"
              className="flex-1"
            >
              Reset
            </Button>
            <Button 
              style={{ backgroundColor: '${request.styling.primaryColor}' }}
              className="flex-1 text-white hover:opacity-90"
            >
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}`;

  return {
    componentCode,
    imports: [
      '@/components/ui/card',
      '@/components/ui/button', 
      '@/components/ui/input',
      '@/components/ui/label'
    ],
    metadata: {
      title: request.title,
      description: request.description,
      slug: toKebabCase(request.title),
      estimatedTime: 5
    }
  };
}

// Helper functions
function toPascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => word.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, ''); // Remove any non-alphanumeric characters
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
} 