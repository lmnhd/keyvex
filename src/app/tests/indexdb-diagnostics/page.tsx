'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, Database, CheckCircle, XCircle, Info } from 'lucide-react';

interface SavedLogicResult {
  id: string;
  timestamp: number;
  date: string;
  toolType: string;
  targetAudience: string;
  industry?: string;
  result: any;
}

interface DiagnosticResult {
  id: string;
  status: 'valid' | 'warning' | 'error';
  issues: string[];
  dataStructure: {
    hasResult: boolean;
    hasBrainstormOutput: boolean;
    hasUserInput: boolean;
    hasPromptOptions: boolean;
    resultKeys: string[];
    brainstormOutputKeys: string[];
  };
  rawData: SavedLogicResult;
}

export default function IndexedDBDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    total: 0,
    valid: 0,
    warnings: 0,
    errors: 0
  });

  const openDatabase = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('KeyvexUIDevDB', 4);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('logicArchitectResults')) {
          db.createObjectStore('logicArchitectResults', { keyPath: 'id' });
        }
      };
    });
  };

  const getAllSavedResults = async (): Promise<SavedLogicResult[]> => {
    const db = await openDatabase();
    const transaction = db.transaction(['logicArchitectResults'], 'readonly');
    const store = transaction.objectStore('logicArchitectResults');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  };

  const analyzeBrainstormData = (savedResult: SavedLogicResult): DiagnosticResult => {
    const issues: string[] = [];
    let status: 'valid' | 'warning' | 'error' = 'valid';

    // Check basic structure
    const hasResult = !!savedResult.result;
    const hasBrainstormOutput = !!(savedResult.result?.brainstormOutput);
    const hasUserInput = !!(savedResult.result?.userInput);
    
    if (!hasResult) {
      issues.push('Missing result field');
      status = 'error';
    }

    // Check for brainstormOutput structure
    let brainstormOutputKeys: string[] = [];
    let hasPromptOptions = false;
    
    if (hasBrainstormOutput) {
      brainstormOutputKeys = Object.keys(savedResult.result.brainstormOutput);
      hasPromptOptions = !!(savedResult.result.brainstormOutput.promptOptions);
      
      // Check for required fields in new schema
      const requiredFields = ['coreConcept', 'valueProposition', 'keyCalculations', 'suggestedInputs', 'promptOptions'];
      const missingFields = requiredFields.filter(field => 
        !savedResult.result.brainstormOutput.hasOwnProperty(field)
      );
      
      if (missingFields.length > 0) {
        issues.push(`Missing required fields in brainstormOutput: ${missingFields.join(', ')}`);
        if (missingFields.includes('promptOptions')) {
          status = 'error';
        } else {
          status = status === 'valid' ? 'warning' : status;
        }
      }

      // Check for legacy fields that might indicate old format
      const legacyFields = ['coreWConcept', 'calculations'];
      const foundLegacyFields = legacyFields.filter(field => 
        savedResult.result.brainstormOutput.hasOwnProperty(field)
      );
      
      if (foundLegacyFields.length > 0) {
        issues.push(`Contains legacy fields: ${foundLegacyFields.join(', ')}`);
        status = status === 'valid' ? 'warning' : status;
      }
    } else {
      // Check if data might be directly in result
      const resultKeys = Object.keys(savedResult.result || {});
      const hasDirectBrainstormData = resultKeys.some(key => 
        ['coreConcept', 'keyCalculations', 'suggestedInputs'].includes(key)
      );
      
      if (hasDirectBrainstormData) {
        issues.push('Brainstorm data appears to be directly in result field (not in brainstormOutput)');
        status = 'warning';
      } else {
        issues.push('No brainstormOutput found and no direct brainstorm data detected');
        status = 'error';
      }
    }

    // Check userInput structure
    if (hasUserInput) {
      const userInputKeys = Object.keys(savedResult.result.userInput);
      const requiredUserInputFields = ['businessContext', 'toolType', 'targetAudience'];
      const missingUserInputFields = requiredUserInputFields.filter(field => 
        !savedResult.result.userInput.hasOwnProperty(field)
      );
      
      if (missingUserInputFields.length > 0) {
        issues.push(`Missing userInput fields: ${missingUserInputFields.join(', ')}`);
        status = status === 'valid' ? 'warning' : status;
      }
    } else {
      issues.push('Missing userInput field');
      status = 'warning';
    }

    return {
      id: savedResult.id,
      status,
      issues,
      dataStructure: {
        hasResult,
        hasBrainstormOutput,
        hasUserInput,
        hasPromptOptions,
        resultKeys: Object.keys(savedResult.result || {}),
        brainstormOutputKeys
      },
      rawData: savedResult
    };
  };

  const runDiagnostics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Starting IndexedDB diagnostics...');
      const savedResults = await getAllSavedResults();
      console.log(`🔍 Found ${savedResults.length} saved results`);
      
      const diagnosticResults = savedResults.map(analyzeBrainstormData);
      setDiagnostics(diagnosticResults);
      
      // Calculate summary
      const newSummary = {
        total: diagnosticResults.length,
        valid: diagnosticResults.filter(d => d.status === 'valid').length,
        warnings: diagnosticResults.filter(d => d.status === 'warning').length,
        errors: diagnosticResults.filter(d => d.status === 'error').length
      };
      setSummary(newSummary);
      
      console.log('🔍 Diagnostics complete:', newSummary);
    } catch (err) {
      console.error('🚨 Diagnostics failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllData = async () => {
    if (!confirm('Are you sure you want to clear ALL IndexedDB data? This cannot be undone!')) {
      return;
    }
    
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['logicArchitectResults'], 'readwrite');
      const store = transaction.objectStore('logicArchitectResults');
      await store.clear();
      
      setDiagnostics([]);
      setSummary({ total: 0, valid: 0, warnings: 0, errors: 0 });
      alert('All IndexedDB data cleared successfully');
    } catch (err) {
      console.error('Failed to clear data:', err);
      alert('Failed to clear data: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Database className="h-8 w-8" />
          IndexedDB Diagnostics
        </h1>
        <p className="text-gray-600">
          Analyze saved brainstorm results for data structure consistency and compatibility with V2 tool creation.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Results</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
              <Database className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valid</p>
                <p className="text-2xl font-bold text-green-600">{summary.valid}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.warnings}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Errors</p>
                <p className="text-2xl font-bold text-red-600">{summary.errors}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <Button onClick={runDiagnostics} disabled={isLoading}>
          {isLoading ? 'Running Diagnostics...' : 'Refresh Diagnostics'}
        </Button>
        <Button variant="destructive" onClick={clearAllData}>
          Clear All Data
        </Button>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Diagnostic Results */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnostic Results</CardTitle>
        </CardHeader>
        <CardContent>
          {diagnostics.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {isLoading ? 'Loading diagnostics...' : 'No saved results found'}
            </p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {diagnostics.map((diagnostic, index) => (
                <AccordionItem key={diagnostic.id} value={`item-${index}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full mr-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(diagnostic.status)}
                        <div className="text-left">
                          <p className="font-medium">
                            {diagnostic.rawData.toolType} for {diagnostic.rawData.targetAudience}
                          </p>
                          <p className="text-sm text-gray-500">
                            ID: {diagnostic.id.substring(0, 8)}... | {diagnostic.rawData.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(diagnostic.status)}>
                          {diagnostic.status.toUpperCase()}
                        </Badge>
                        {diagnostic.issues.length > 0 && (
                          <Badge variant="outline">
                            {diagnostic.issues.length} issue{diagnostic.issues.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      {/* Issues */}
                      {diagnostic.issues.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Issues Found:</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                            {diagnostic.issues.map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Data Structure Summary */}
                      <div>
                        <h4 className="font-medium mb-2">Data Structure:</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>Has Result:</strong> {diagnostic.dataStructure.hasResult ? '✅' : '❌'}</p>
                            <p><strong>Has BrainstormOutput:</strong> {diagnostic.dataStructure.hasBrainstormOutput ? '✅' : '❌'}</p>
                            <p><strong>Has UserInput:</strong> {diagnostic.dataStructure.hasUserInput ? '✅' : '❌'}</p>
                            <p><strong>Has PromptOptions:</strong> {diagnostic.dataStructure.hasPromptOptions ? '✅' : '❌'}</p>
                          </div>
                          <div>
                            <p><strong>Result Keys:</strong> {diagnostic.dataStructure.resultKeys.join(', ')}</p>
                            <p><strong>BrainstormOutput Keys:</strong> {diagnostic.dataStructure.brainstormOutputKeys.join(', ')}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Raw Data */}
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium">View Raw Data</summary>
                        <pre className="mt-2 p-3 bg-gray-100 rounded-md overflow-x-auto max-h-96">
                          {JSON.stringify(diagnostic.rawData, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 