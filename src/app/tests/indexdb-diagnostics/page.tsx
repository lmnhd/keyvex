'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAllLogicResults, SavedLogicResult } from '@/lib/db/indexeddb/logic-results';

export default function IndexedDBDiagnosticsPage() {
  const [savedResults, setSavedResults] = useState<SavedLogicResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SavedLogicResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSavedResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await getAllLogicResults();
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

  const analyzeResult = (result: SavedLogicResult) => {
    const analysis = {
      id: result.id,
      timestamp: result.timestamp,
      date: result.date,
      toolType: result.toolType,
      targetAudience: result.targetAudience,
      industry: result.industry,
      hasResult: !!result.result,
      resultKeys: result.result ? Object.keys(result.result) : [],
      hasUserInput: !!result.result?.userInput,
      userInputKeys: result.result?.userInput ? Object.keys(result.result.userInput) : [],
      hasBrainstormOutput: !!result.result?.brainstormOutput,
      brainstormOutputType: result.result?.brainstormOutput ? typeof result.result.brainstormOutput : 'undefined',
      brainstormOutputKeys: result.result?.brainstormOutput && typeof result.result.brainstormOutput === 'object' 
        ? Object.keys(result.result.brainstormOutput) : [],
      rawResultStructure: result.result ? JSON.stringify(result.result, null, 2) : 'No result'
    };
    return analysis;
  };

  const clearAllData = async () => {
    if (confirm('Are you sure you want to clear ALL IndexedDB data? This cannot be undone.')) {
      try {
        // Clear the logic results
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('KeyvexUIDevDB', 4);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        const transaction = db.transaction(['logicArchitectResults'], 'readwrite');
        const store = transaction.objectStore('logicArchitectResults');
        await new Promise<void>((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        
        console.log('🗑️ Cleared all IndexedDB data');
        await loadSavedResults(); // Refresh the list
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clear data');
        console.error('❌ Error clearing data:', err);
      }
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>IndexedDB Diagnostics - Brainstorm Data Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={loadSavedResults} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh Results'}
              </Button>
              <Button onClick={clearAllData} variant="destructive">
                Clear All Data
              </Button>
              <span className="text-sm text-gray-600 self-center">
                Found {savedResults.length} saved results
              </span>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800">
                Error: {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Results List */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-900">Saved Results</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {savedResults.map((result) => (
                    <div
                      key={result.id}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedResult?.id === result.id
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedResult(result)}
                    >
                      <div className="text-sm font-medium text-gray-900">{result.toolType}</div>
                      <div className="text-xs text-gray-600">
                        {new Date(result.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {result.id.substring(0, 20)}...
                      </div>
                      <div className="text-xs text-gray-700">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                          result.result?.brainstormOutput ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                        {result.result?.brainstormOutput ? 'Has brainstormOutput' : 'Missing brainstormOutput'}
                      </div>
                    </div>
                  ))}
                  {savedResults.length === 0 && !loading && (
                    <div className="text-gray-500 text-center py-8">
                      No saved results found
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
                      <h4 className="font-medium mb-2 text-gray-900">Quick Analysis</h4>
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

                    <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                      <h4 className="font-medium mb-2 text-yellow-800">V2 Compatibility Check</h4>
                      <div className="text-sm space-y-1">
                        <div className={`${selectedResult.result?.brainstormOutput ? 'text-green-600' : 'text-red-600'}`}>
                          ✓ Has brainstormOutput: {selectedResult.result?.brainstormOutput ? 'YES' : 'NO'}
                        </div>
                        <div className={`${selectedResult.result?.userInput ? 'text-green-600' : 'text-red-600'}`}>
                          ✓ Has userInput: {selectedResult.result?.userInput ? 'YES' : 'NO'}
                        </div>
                        <div className={`${selectedResult.result?.userInput?.businessContext ? 'text-green-600' : 'text-red-600'}`}>
                          ✓ Has businessContext: {selectedResult.result?.userInput?.businessContext ? 'YES' : 'NO'}
                        </div>
                        {selectedResult.result?.brainstormOutput && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-700">brainstormOutput keys:</div>
                            <div className="text-xs font-mono bg-white p-1 rounded text-gray-800">
                              {Object.keys(selectedResult.result.brainstormOutput).join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Test V2 Compatibility */}
                    <div className="bg-blue-50 p-4 rounded border border-blue-200">
                      <h4 className="font-medium mb-2 text-blue-800">Test V2 Tool Creation</h4>
                      <div className="text-sm text-blue-700 mb-2">
                        This will attempt to start V2 tool creation with this brainstorm data to test compatibility.
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          // Navigate to tool generation workbench with this result
                          const params = new URLSearchParams({
                            selectedBrainstorm: selectedResult.id
                          });
                          window.open(`/tests/tool-generation-workbench?${params}`, '_blank');
                        }}
                        disabled={!selectedResult.result?.brainstormOutput}
                      >
                        Test in Workbench
                      </Button>
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