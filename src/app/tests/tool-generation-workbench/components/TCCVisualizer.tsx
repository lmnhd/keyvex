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
  EyeOff,
  Save,
  Download
} from 'lucide-react';

interface TCCVisualizerProps {
  tccData: any;
  currentStep: string;
  jobId: string;
  onRefreshTCC: () => void;
  isLoading?: boolean;
  handleSaveTccSnapshot: () => void;
  handleLoadTccSnapshot: () => void;
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
    case 'validator':
    case 'validating':
    case 'validating_code':
      return <CheckCircle className="h-4 w-4" />;
    case 'tool-finalizer':
    case 'toolfinalizer':
    case 'finalizing_tool':
      return <RefreshCw className="h-4 w-4" />;
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
    'component-assembler': ['assembledComponentCode', 'componentCode', 'code'],
    'validator': ['validationResult'],
    'tool-finalizer': ['finalProduct']
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
  isLoading = false,
  handleSaveTccSnapshot,
  handleLoadTccSnapshot
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
    { id: 'component-assembler', name: 'Component Assembler', field: 'assembledComponentCode' },
    { id: 'validator', name: 'Validator', field: 'validationResult' },
    { id: 'tool-finalizer', name: 'Tool Finalizer', field: 'finalProduct' }
  ];

  // Get validation status and display info
  const getValidationDisplay = () => {
    if (!tccData?.validationResult) return null;
    
    const validation = tccData.validationResult;
    const errorCount = (validation.syntaxErrors?.length || 0) + (validation.typeErrors?.length || 0);
    const warningCount = validation.warnings?.length || 0;
    
    return (
      <div className="mt-4 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className={`h-4 w-4 ${validation.isValid ? 'text-green-500' : 'text-red-500'}`} />
          <span className="font-medium text-sm">
            Validation Status: {validation.isValid ? 'Valid' : 'Has Issues'}
          </span>
        </div>
        
        {errorCount > 0 && (
          <div className="mb-2">
            <Badge variant="destructive" className="text-xs mr-2">
              {errorCount} Error{errorCount !== 1 ? 's' : ''}
            </Badge>
            <div className="mt-1 text-xs space-y-1">
              {validation.syntaxErrors?.map((error: string, index: number) => (
                <div key={`syntax-${index}`} className="text-red-600 dark:text-red-400">
                  • Syntax: {error}
                </div>
              ))}
              {validation.typeErrors?.map((error: string, index: number) => (
                <div key={`type-${index}`} className="text-red-600 dark:text-red-400">
                  • Type: {error}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {warningCount > 0 && (
          <div className="mb-2">
            <Badge variant="outline" className="text-xs mr-2 border-yellow-500 text-yellow-600">
              {warningCount} Warning{warningCount !== 1 ? 's' : ''}
            </Badge>
            <div className="mt-1 text-xs space-y-1">
              {validation.warnings?.map((warning: string, index: number) => (
                <div key={`warning-${index}`} className="text-yellow-600 dark:text-yellow-400">
                  • {warning}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {validation.isValid && errorCount === 0 && warningCount === 0 && (
          <div className="text-green-600 dark:text-green-400 text-xs">
            ✅ Code validation passed successfully
          </div>
        )}
      </div>
    );
  };

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
              Job: {jobId ? jobId.slice(-8) : 'N/A'}
            </Badge>
            <Button onClick={handleSaveTccSnapshot} size="sm" variant="outline" disabled={!tccData}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
            <Button onClick={handleLoadTccSnapshot} size="sm" variant="outline">
              <Download className="mr-2 h-4 w-4" /> Load
            </Button>
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
              
              {/* Validation Results Display */}
              {getValidationDisplay()}
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
                        {!!value && (
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
