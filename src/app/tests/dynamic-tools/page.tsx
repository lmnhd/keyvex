'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CanvasTool } from '@/components/tool-creator/canvas-tool';
import { roiCalculatorDefinition, leadQualifierQuizDefinition } from '@/lib/sample-tools/roi-calculator-definition';
import { 
  Calculator, 
  ClipboardCheck, 
  Code, 
  Eye, 
  Sparkles,
  TrendingUp,
  Settings,
  FileText,
  Play
} from 'lucide-react';

export default function DynamicToolsTestPage() {
  const [selectedTool, setSelectedTool] = useState<'roi' | 'quiz' | null>('roi');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [toolValues, setToolValues] = useState<Record<string, any>>({});
  const [showDefinition, setShowDefinition] = useState(false);

  const tools = [
    {
      id: 'roi',
      name: 'ROI Calculator',
      description: 'Dynamic marketing ROI calculator with real-time calculations',
      icon: TrendingUp,
      definition: roiCalculatorDefinition,
      category: 'Calculator',
      features: ['Real-time calculations', 'Currency formatting', 'Conditional styling', 'Validation']
    },
    {
      id: 'quiz',
      name: 'Lead Qualifier Quiz',
      description: 'Multi-step assessment with personalized results',
      icon: ClipboardCheck,
      definition: leadQualifierQuizDefinition,
      category: 'Assessment',
      features: ['Multi-step flow', 'Progress tracking', 'Scoring system', 'Conditional logic']
    }
  ];

  const currentTool = tools.find(t => t.id === selectedTool);
  const currentDefinition = currentTool?.definition;

  const handleToolUpdate = (values: Record<string, any>) => {
    setToolValues(values);
    console.log('🔄 Tool values updated:', values);
  };

  const handleToolComplete = (results: any) => {
    console.log('✅ Tool completed with results:', results);
    alert(`Tool completed! Check console for results.`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-blue-500" />
            <h1 className="text-4xl font-bold text-gray-900">Dynamic Tool System</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Real-time tool generation from JSON schemas with live calculations, 
            conditional logic, and interactive components.
          </p>
          
          {/* Controls */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              variant={isDarkMode ? "default" : "outline"}
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </Button>
            <Button
              variant={showDefinition ? "default" : "outline"}
              onClick={() => setShowDefinition(!showDefinition)}
            >
              <Code className="h-4 w-4 mr-2" />
              {showDefinition ? "Hide" : "Show"} Definition
            </Button>
          </div>
        </div>

        {/* Tool Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((tool) => {
            const IconComponent = tool.icon;
            const isSelected = selectedTool === tool.id;
            
            return (
              <Card 
                key={tool.id}
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected 
                    ? 'ring-2 ring-blue-500 shadow-lg' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedTool(tool.id as 'roi' | 'quiz')}
              >
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center mb-3">
                    <div className={`p-3 rounded-full ${
                      isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                  </div>
                  <CardTitle className="text-xl">{tool.name}</CardTitle>
                  <Badge variant="secondary">{tool.category}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600 text-center">{tool.description}</p>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Features:</p>
                    <div className="flex flex-wrap gap-1">
                      {tool.features.map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                        <Play className="h-4 w-4" />
                        <span className="font-medium">Currently Active</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tool Display */}
        {currentDefinition && (
          <div className="space-y-6">
            {/* Tool Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Live Tool Preview
                    </CardTitle>
                    <p className="text-gray-600 mt-1">
                      {currentDefinition.metadata.description}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge className="bg-green-100 text-green-800">
                      {currentDefinition.components.length} Components
                    </Badge>
                    <br />
                    <Badge variant="outline">
                      {currentDefinition.layout.type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Main Content */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Tool Preview (Main) */}
              <div className="xl:col-span-2">
                <Card className="h-fit">
                  <CardContent className="p-0">
                    <CanvasTool
                      toolDefinition={currentDefinition}
                      isDarkMode={isDarkMode}
                      onToolUpdate={handleToolUpdate}
                      onComplete={handleToolComplete}
                      className="min-h-[600px]"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Side Panel */}
              <div className="space-y-6">
                {/* Current Values */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Settings className="h-5 w-5" />
                      Current Values
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(toolValues).length === 0 ? (
                      <p className="text-gray-500 text-sm">
                        Start filling out the tool to see values here
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(toolValues).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="font-medium text-gray-600">
                              {key.replace(/[-_]/g, ' ')}:
                            </span>
                            <span className="text-gray-900">
                              {typeof value === 'object' 
                                ? JSON.stringify(value)
                                : String(value)
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tool Metadata */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5" />
                      Tool Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Type:</span>
                      <p className="text-sm capitalize">{currentDefinition.metadata.type}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Target Audience:</span>
                      <p className="text-sm">{currentDefinition.metadata.targetAudience}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Estimated Time:</span>
                      <p className="text-sm">{currentDefinition.metadata.estimatedCompletionTime} minutes</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Features:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {currentDefinition.metadata.features.map((feature, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* JSON Definition View */}
            {showDefinition && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Tool Definition JSON
                  </CardTitle>
                  <p className="text-gray-600">
                    This is the JSON schema that generates the tool above
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                    <pre className="text-xs">
                      {JSON.stringify(currentDefinition, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Benefits Section */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-blue-900">
              🎨 Dynamic Tool Generation Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="p-3 bg-blue-100 rounded-full w-fit mx-auto">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-blue-900">AI-Generated Tools</h3>
                <p className="text-sm text-blue-700">
                  AI can generate complete tool definitions with components, logic, and styling
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="p-3 bg-green-100 rounded-full w-fit mx-auto">
                  <Calculator className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-green-900">Real-time Calculations</h3>
                <p className="text-sm text-green-700">
                  JavaScript formulas execute instantly as users input data
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="p-3 bg-purple-100 rounded-full w-fit mx-auto">
                  <Settings className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-purple-900">Infinite Customization</h3>
                <p className="text-sm text-purple-700">
                  Every aspect can be modified: layout, styling, logic, and components
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 