'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw, Database, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { loadLogicResultsFromDB, deleteLogicResultFromDB } from '../ui/db-utils';
import { type BrainstormResult } from '../tool-generation-workbench/types/unified-brainstorm-types';

export default function IndexedDBDiagnosticsPage() {
  const [savedResults, setSavedResults] = useState<BrainstormResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<BrainstormResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSavedResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await loadLogicResultsFromDB();
      setSavedResults(results);
      console.log('📊 Loaded saved results:', results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
      console.error('❌ Error loading results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedResults();
  }, []);

  const analyzeResult = (result: any) => {
    // Detect format type
    const isLegacyFormat = !!(result as any).result?.brainstormOutput;
    const isUnifiedFormat = !!(result as any).userInput && !!(result as any).brainstormData;
    
    let userInput, brainstormData, toolType, targetAudience, industry, businessContext;
    
    if (isUnifiedFormat) {
      // Unified format: data at root level
      userInput = (result as any).userInput;
      brainstormData = (result as any).brainstormData;
      toolType = userInput?.toolType;
      targetAudience = userInput?.targetAudience;
      industry = userInput?.industry;
      businessContext = userInput?.businessContext;
    } else if (isLegacyFormat) {
      // Legacy format: data nested under result
      userInput = (result as any).result?.userInput;
      brainstormData = (result as any).result?.brainstormOutput;
      toolType = (result as any).toolType || userInput?.toolType;
      targetAudience = (result as any).targetAudience || userInput?.targetAudience;
      industry = (result as any).industry || userInput?.industry;
      businessContext = userInput?.businessContext;
    } else {
      // Unknown format
      userInput = null;
      brainstormData = null;
      toolType = (result as any).toolType;
      targetAudience = (result as any).targetAudience;
      industry = (result as any).industry;
      businessContext = null;
    }

    const analysis = {
      id: result.id,
      timestamp: result.timestamp,
      date: result.date,
      format: isUnifiedFormat ? 'unified_brainstorm_result' : isLegacyFormat ? 'legacy_format' : 'unknown_format',
      hasUserInput: !!userInput,
      userInputKeys: userInput ? Object.keys(userInput) : [],
      toolType: toolType || 'Unknown',
      targetAudience: targetAudience || 'Unknown',
      industry: industry || 'Not specified',
      businessContext: businessContext || 'Not provided',
      hasBrainstormData: !!brainstormData,
      brainstormDataKeys: brainstormData ? Object.keys(brainstormData) : [],
      requiredFieldsPresent: {
        coreConcept: !!(brainstormData as any)?.coreConcept,
        keyCalculations: !!(brainstormData as any)?.keyCalculations,
        interactionFlow: !!(brainstormData as any)?.interactionFlow,
        valueProposition: !!(brainstormData as any)?.valueProposition,
        leadCaptureStrategy: !!(brainstormData as any)?.leadCaptureStrategy,
        creativeEnhancements: !!(brainstormData as any)?.creativeEnhancements,
        suggestedInputs: !!(brainstormData as any)?.suggestedInputs,
        calculationLogic: !!(brainstormData as any)?.calculationLogic,
        promptOptions: !!(brainstormData as any)?.promptOptions
      }
    };
    return analysis;
  };

  const isV2Compatible = (result: BrainstormResult) => {
    const analysis = analyzeResult(result);
    const requiredFields = Object.values(analysis.requiredFieldsPresent);
    return requiredFields.every(field => field === true);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === savedResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(savedResults.map(r => r.id)));
    }
  };

  const handleSelectResult = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const deleteSelectedResults = async () => {
    if (selectedIds.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedIds.size} selected brainstorm result(s)? This cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setDeleting(true);
    setError(null);
    
    try {
      const deletePromises = Array.from(selectedIds).map(id => deleteLogicResultFromDB(id));
      await Promise.all(deletePromises);
      
      console.log(`🗑️ Deleted ${selectedIds.size} brainstorm results`);
      setSelectedIds(new Set());
      setSelectedResult(null);
      await loadSavedResults(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete selected results');
      console.error('❌ Error deleting results:', err);
    } finally {
      setDeleting(false);
    }
  };

  const clearAllData = async () => {
    if (confirm('Are you sure you want to clear ALL brainstorm data? This cannot be undone.')) {
      setDeleting(true);
      setError(null);
      
      try {
        const deletePromises = savedResults.map(result => deleteLogicResultFromDB(result.id));
        await Promise.all(deletePromises);
        
        console.log('🗑️ Cleared all brainstorm data');
        setSelectedIds(new Set());
        setSelectedResult(null);
        await loadSavedResults(); // Refresh the list
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clear all data');
        console.error('❌ Error clearing data:', err);
      } finally {
        setDeleting(false);
      }
    }
  };

  const formatCount = savedResults.length;
  const legacyCount = savedResults.filter(r => !isV2Compatible(r)).length;
  const unifiedCount = savedResults.filter(r => isV2Compatible(r)).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            IndexedDB Diagnostics - Unified BrainstormResult Format
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded border">
                <div className="text-sm text-blue-600 font-medium">Total Results</div>
                <div className="text-2xl font-bold text-blue-800">{formatCount}</div>
              </div>
              <div className="bg-green-50 p-3 rounded border">
                <div className="text-sm text-green-600 font-medium">V2 Compatible</div>
                <div className="text-2xl font-bold text-green-800">{unifiedCount}</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded border">
                <div className="text-sm text-yellow-600 font-medium">Legacy/Incomplete</div>
                <div className="text-2xl font-bold text-yellow-800">{legacyCount}</div>
              </div>
              <div className="bg-purple-50 p-3 rounded border">
                <div className="text-sm text-purple-600 font-medium">Selected</div>
                <div className="text-2xl font-bold text-purple-800">{selectedIds.size}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={loadSavedResults} disabled={loading} className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh Results'}
              </Button>
              
              <Button 
                onClick={handleSelectAll} 
                variant="outline"
                disabled={savedResults.length === 0}
              >
                {selectedIds.size === savedResults.length ? 'Deselect All' : 'Select All'}
              </Button>
              
              <Button 
                onClick={deleteSelectedResults} 
                variant="destructive"
                disabled={selectedIds.size === 0 || deleting}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
              </Button>
              
              <Button 
                onClick={clearAllData} 
                variant="destructive"
                disabled={savedResults.length === 0 || deleting}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear All Data
              </Button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Error: {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Results List */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900">Saved Brainstorm Results</h3>
                <div className="space-y-2 overflow-y-auto">
                  {savedResults.map((result) => {
                    const compatible = isV2Compatible(result);
                    return (
                      <div
                        key={result.id}
                        className={`p-3 border rounded transition-colors ${
                          selectedResult?.id === result.id
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedIds.has(result.id)}
                            onCheckedChange={() => handleSelectResult(result.id)}
                            className="mt-1"
                          />
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => setSelectedResult(result)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-sm font-medium text-gray-900">
                                {result.userInput?.toolType || 'Unknown Tool'}
                              </div>
                              {compatible ? (
                                <Badge variant="outline" className="text-green-600 border-green-300">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  V2 Ready
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Incomplete
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-600">
                              Target: {result.userInput?.targetAudience || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-600">
                              {new Date(result.timestamp).toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {result.id.substring(0, 20)}...
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {savedResults.length === 0 && !loading && (
                    <div className="text-gray-500 text-center py-8">
                      No saved brainstorm results found
                    </div>
                  )}
                </div>
              </div>

              {/* Analysis Panel */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900">Data Structure Analysis</h3>
                {selectedResult ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded">
                      <h4 className="font-medium mb-2 text-gray-900">Unified Format Analysis</h4>
                      <pre className="text-xs bg-white p-2 rounded border overflow-auto text-gray-800">
                        {JSON.stringify(analyzeResult(selectedResult), null, 2)}
                      </pre>
                    </div>

                    <div className="bg-gray-50 p-4 rounded">
                      <h4 className="font-medium mb-2 text-gray-900">Raw Data Structure</h4>
                      <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-64 text-gray-800">
                        {JSON.stringify(selectedResult, null, 2)}
                      </pre>
                    </div>

                    <div className={`p-4 rounded border ${
                      isV2Compatible(selectedResult) 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <h4 className={`font-medium mb-2 ${
                        isV2Compatible(selectedResult) ? 'text-green-800' : 'text-yellow-800'
                      }`}>
                        V2 Tool Creation Compatibility
                      </h4>
                      <div className="text-sm space-y-1">
                        {Object.entries(analyzeResult(selectedResult).requiredFieldsPresent).map(([field, present]) => (
                          <div key={field} className={present ? 'text-green-600' : 'text-red-600'}>
                            {present ? '✓' : '✗'} {field}: {present ? 'Present' : 'Missing'}
                          </div>
                        ))}
                      </div>
                      
                      {isV2Compatible(selectedResult) && (
                        <div className="mt-3">
                          <Button 
                            size="sm" 
                            onClick={() => {
                              const params = new URLSearchParams({
                                selectedBrainstorm: selectedResult.id
                              });
                              window.open(`/tests/tool-generation-workbench?${params}`, '_blank');
                            }}
                            className="flex items-center gap-2"
                          >
                            <Database className="h-4 w-4" />
                            Test in V2 Workbench
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    Select a result to analyze its structure
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 