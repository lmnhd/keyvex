'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  Code, 
  Palette, 
  Settings, 
  FileText, 
  CheckCircle, 
  Clock,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface TCCVisualizerProps {
  tccData: any;
  currentStep: string;
  jobId: string;
  onRefreshTCC: () => void;
  isLoading?: boolean;
}

const getStepIcon = (stepName: string) => {
  switch (stepName.toLowerCase()) {
    case 'function-planner':
    case 'functionplanner':
      return <Settings className="h-4 w-4" />;
    case 'state-design':
    case 'statedesign':
      return <Database className="h-4 w-4" />;
    case 'jsx-layout':
    case 'jsxlayout':
      return <Code className="h-4 w-4" />;
    case 'tailwind-styling':
    case 'tailwindstyling':
      return <Palette className="h-4 w-4" />;
    case 'component-assembler':
    case 'componentassembler':
      return <FileText className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getStepStatus = (tccData: any, stepName: string) => {
  if (!tccData) return 'pending';
  
  // Check various possible field names for each step
  const stepFields: Record<string, string[]> = {
    'function-planner': ['definedFunctionSignatures', 'functionSignatures', 'functions'],
    'state-design': ['stateLogic', 'stateDesign', 'state'],
    'jsx-layout': ['jsxLayout', 'layout', 'jsx'],
    'tailwind-styling': ['styling', 'tailwindStyling', 'styles'],
    'component-assembler': ['assembledComponentCode', 'componentCode', 'code']
  };
  
  const fields = stepFields[stepName.toLowerCase()] || [];
  const hasData = fields.some(field => tccData[field] && tccData[field] !== null);
  
  return hasData ? 'completed' : 'pending';
};

const TCCVisualizer: React.FC<TCCVisualizerProps> = ({ 
  tccData, 
  currentStep, 
  jobId, 
  onRefreshTCC, 
  isLoading = false 
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [showRawData, setShowRawData] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const steps = [
    { id: 'function-planner', name: 'Function Planner', field: 'definedFunctionSignatures' },
    { id: 'state-design', name: 'State Design', field: 'stateLogic' },
    { id: 'jsx-layout', name: 'JSX Layout', field: 'jsxLayout' },
    { id: 'tailwind-styling', name: 'Tailwind Styling', field: 'styling' },
    { id: 'component-assembler', name: 'Component Assembler', field: 'assembledComponentCode' }
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <Database className="mr-2 h-5 w-5 text-blue-500" />
            TCC State Monitor
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Job: {jobId.slice(-8)}
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefreshTCC}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRawData(!showRawData)}
            >
              {showRawData ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showRawData ? 'Hide Raw' : 'Show Raw'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="progress" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="data">Data Fields</TabsTrigger>
            <TabsTrigger value="raw">Raw TCC</TabsTrigger>
          </TabsList>
          
          <TabsContent value="progress" className="mt-4">
            <div className="space-y-3">
              {steps.map((step) => {
                const status = getStepStatus(tccData, step.id);
                const isActive = currentStep.toLowerCase().includes(step.id.toLowerCase());
                
                return (
                  <div 
                    key={step.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isActive ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20' : 
                      status === 'completed' ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 
                      'border-gray-200 bg-gray-50 dark:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {getStepIcon(step.id)}
                      <div>
                        <p className="font-medium text-sm">{step.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Field: {step.field}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <Badge variant="default" className="text-xs">
                          Active
                        </Badge>
                      )}
                      {status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="data" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {tccData ? Object.entries(tccData).map(([key, value]) => (
                  <div key={key} className="border rounded-lg p-3">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleSection(key)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{key}</span>
                        <Badge variant="outline" className="text-xs">
                          {Array.isArray(value) ? 'Array' : typeof value}
                        </Badge>
                      </div>
                      <div className="flex items-center">
                        {value && value !== null && (
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        )}
                        <span className="text-xs">
                          {expandedSections.has(key) ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                    
                    {expandedSections.has(key) && (
                      <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                        <pre className="whitespace-pre-wrap overflow-x-auto">
                          {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="text-center text-muted-foreground py-8">
                    No TCC data available yet
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="raw" className="mt-4">
            <ScrollArea className="h-96">
              <pre className="text-xs p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto">
                {tccData ? JSON.stringify(tccData, null, 2) : 'No TCC data available'}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TCCVisualizer; 