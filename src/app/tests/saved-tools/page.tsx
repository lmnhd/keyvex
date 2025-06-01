'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Eye, RefreshCw, Download, Calendar, User, Brain, Calculator, ArrowLeft, X } from 'lucide-react';
import DynamicComponentRenderer from '@/components/tools/dynamic-component-renderer';
import Link from 'next/link';
import { ProductToolDefinition } from '@/lib/types/product-tool';

// Use the same localStorage keys as tests/ui page
const LOGIC_STORAGE_KEY = 'keyvex_logic_architect_results';
const TOOLS_STORAGE_KEY = 'keyvex_created_tools';

// Use the same data structures as tests/ui page
interface SavedLogicResult {
  id: string;
  timestamp: number;
  date: string;
  toolType: string;
  targetAudience: string;
  industry?: string;
  result: any;
}

interface SavedTool {
  id: string;
  timestamp: number;
  date: string;
  title: string;
  tool: ProductToolDefinition;
}

// Combined type for display purposes
type SavedItem = (SavedLogicResult & { source: 'brainstorm' }) | (SavedTool & { source: 'tool' });

export default function SavedToolsTestPage() {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [filter, setFilter] = useState<'all' | 'tools' | 'brainstorms'>('all');
  const [previewItem, setPreviewItem] = useState<SavedItem | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load saved items from localStorage
  const loadSavedItems = () => {
    if (typeof window === 'undefined') return;

    try {
      // Debug: Check what's actually in localStorage
      console.log('🔍 Checking localStorage keys:');
      console.log(`${LOGIC_STORAGE_KEY}:`, localStorage.getItem(LOGIC_STORAGE_KEY));
      console.log(`${TOOLS_STORAGE_KEY}:`, localStorage.getItem(TOOLS_STORAGE_KEY));
      
      // Also check for any other keyvex-related keys
      const allKeys = Object.keys(localStorage).filter(key => key.includes('keyvex'));
      console.log('🔍 All keyvex localStorage keys:', allKeys);
      allKeys.forEach(key => {
        const value = localStorage.getItem(key);
        console.log(`  ${key}: ${value ? `${value.length} chars` : 'null'}`);
      });

      // Load logic results (brainstorms)
      const logicResults = localStorage.getItem(LOGIC_STORAGE_KEY);
      const parsedLogicResults: SavedLogicResult[] = logicResults ? JSON.parse(logicResults) : [];
      
      // Load created tools
      const createdTools = localStorage.getItem(TOOLS_STORAGE_KEY);
      const parsedCreatedTools: SavedTool[] = createdTools ? JSON.parse(createdTools) : [];

      console.log('📊 Parsed data:', {
        logicResults: parsedLogicResults,
        createdTools: parsedCreatedTools
      });

      // Combine both arrays with source indicators
      const combinedItems: SavedItem[] = [
        ...parsedLogicResults.map(item => ({ ...item, source: 'brainstorm' as const })),
        ...parsedCreatedTools.map(item => ({ ...item, source: 'tool' as const }))
      ];

      // Sort by timestamp (newest first)
      combinedItems.sort((a, b) => b.timestamp - a.timestamp);

      setSavedItems(combinedItems);

      // Enhanced debug info
      const debugText = [
        `Logic Results (${LOGIC_STORAGE_KEY}): ${parsedLogicResults.length} items`,
        `Created Tools (${TOOLS_STORAGE_KEY}): ${parsedCreatedTools.length} items`,
        `Total: ${combinedItems.length} items`,
        `All localStorage keys: ${Object.keys(localStorage).length}`,
        `Keyvex keys: ${allKeys.join(', ') || 'none'}`,
        `Raw logic data: ${logicResults ? 'exists' : 'null'}`,
        `Raw tools data: ${createdTools ? 'exists' : 'null'}`
      ].join('\n');
      setDebugInfo(debugText);

      console.log('📋 Final loaded items:', {
        logicResults: parsedLogicResults.length,
        createdTools: parsedCreatedTools.length,
        total: combinedItems.length,
        items: combinedItems
      });

    } catch (error) {
      console.error('Failed to load saved items:', error);
      setDebugInfo(`Error loading items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Load items on client mount
  useEffect(() => {
    if (isClient) {
      loadSavedItems();
    }
  }, [isClient]);

  // Delete a saved item
  const deleteSavedItem = (id: string) => {
    if (typeof window === 'undefined') return;

    const item = savedItems.find(item => item.id === id);
    if (!item) return;

    try {
      if (item.source === 'brainstorm') {
        // Remove from logic results
        const existing = localStorage.getItem(LOGIC_STORAGE_KEY);
        const parsedResults: SavedLogicResult[] = existing ? JSON.parse(existing) : [];
        const filtered = parsedResults.filter(result => result.id !== id);
        localStorage.setItem(LOGIC_STORAGE_KEY, JSON.stringify(filtered));
      } else {
        // Remove from created tools
        const existing = localStorage.getItem(TOOLS_STORAGE_KEY);
        const parsedTools: SavedTool[] = existing ? JSON.parse(existing) : [];
        const filtered = parsedTools.filter(tool => tool.id !== id);
        localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(filtered));
      }

      // Reload items
      loadSavedItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  // Export a saved item
  const exportSavedItem = (item: SavedItem) => {
    try {
      const dataStr = JSON.stringify(item, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${item.source === 'tool' ? 'tool' : 'brainstorm'}_${item.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export item:', error);
    }
  };

  // Clear all items
  const clearAllItems = () => {
    if (typeof window === 'undefined') return;

    if (confirm('Are you sure you want to clear all saved items? This cannot be undone.')) {
      try {
        localStorage.removeItem(LOGIC_STORAGE_KEY);
        localStorage.removeItem(TOOLS_STORAGE_KEY);
        loadSavedItems();
      } catch (error) {
        console.error('Failed to clear items:', error);
      }
    }
  };

  // Get title for display
  const getItemTitle = (item: SavedItem): string => {
    if (item.source === 'tool') {
      return (item as SavedTool).title || (item as SavedTool).tool?.metadata?.title || 'Untitled Tool';
    } else {
      const logic = item as SavedLogicResult;
      return `${logic.toolType || 'Unknown'} for ${logic.targetAudience || 'Unknown Audience'}`;
    }
  };

  // Get description for display
  const getItemDescription = (item: SavedItem): string => {
    if (item.source === 'tool') {
      const tool = item as SavedTool;
      return tool.tool?.metadata?.description || tool.tool?.metadata?.shortDescription || 'No description available';
    } else {
      const logic = item as SavedLogicResult;
      return `${logic.industry ? `Industry: ${logic.industry}` : 'General business tool'} • Logic Architect Result`;
    }
  };

  // Filter items based on current filter
  const filteredItems = savedItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'tools') return item.source === 'tool';
    if (filter === 'brainstorms') return item.source === 'brainstorm';
    return true;
  });

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading saved tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/tests" className="text-blue-600 hover:text-blue-800 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Saved Tools & Brainstorms</h1>
              <p className="text-gray-600 mt-1">
                Manage your saved logic results and created tools from localStorage
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={loadSavedItems}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            
            <Button
              onClick={() => {
                console.log('🔍 Manual localStorage inspection:');
                console.log('All keys:', Object.keys(localStorage));
                console.log('Logic results:', localStorage.getItem(LOGIC_STORAGE_KEY));
                console.log('Created tools:', localStorage.getItem(TOOLS_STORAGE_KEY));
                alert('Check browser console for localStorage details');
              }}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              🔍 Inspect Storage
            </Button>
            
            <Button
              onClick={() => {
                // Create test data to verify localStorage is working
                const testLogicResult = {
                  id: `logic_test_${Date.now()}`,
                  timestamp: Date.now(),
                  date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                  toolType: 'Test Calculator',
                  targetAudience: 'Test Users',
                  industry: 'Testing',
                  result: { test: 'This is test brainstorming data' }
                };
                
                const testTool = {
                  id: `tool_test_${Date.now()}`,
                  timestamp: Date.now(),
                  date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                  title: 'Test Tool',
                  tool: {
                    metadata: {
                      title: 'Test Tool',
                      description: 'This is a test tool',
                      slug: 'test-tool'
                    },
                    componentCode: 'function TestTool() { return React.createElement("div", null, "Test Tool"); }'
                  }
                };
                
                // Save test data
                const existingLogic = localStorage.getItem(LOGIC_STORAGE_KEY);
                const logicArray = existingLogic ? JSON.parse(existingLogic) : [];
                logicArray.unshift(testLogicResult);
                localStorage.setItem(LOGIC_STORAGE_KEY, JSON.stringify(logicArray));
                
                const existingTools = localStorage.getItem(TOOLS_STORAGE_KEY);
                const toolsArray = existingTools ? JSON.parse(existingTools) : [];
                toolsArray.unshift(testTool);
                localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(toolsArray));
                
                console.log('✅ Created test data');
                loadSavedItems();
              }}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              🧪 Add Test Data
            </Button>
            
            {savedItems.length > 0 && (
              <Button
                onClick={clearAllItems}
                variant="destructive"
                size="sm"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Stats and Filters */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-6">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{filteredItems.length}</span> items
              {filter !== 'all' && (
                <span className="ml-1">
                  ({savedItems.filter(item => item.source === 'tool').length} tools, {' '}
                  {savedItems.filter(item => item.source === 'brainstorm').length} brainstorms)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setFilter('all')}
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
            >
              All
            </Button>
            <Button
              onClick={() => setFilter('tools')}
              variant={filter === 'tools' ? 'default' : 'outline'}
              size="sm"
              className="flex items-center gap-1"
            >
              <Calculator className="h-3 w-3" />
              Tools ({savedItems.filter(item => item.source === 'tool').length})
            </Button>
            <Button
              onClick={() => setFilter('brainstorms')}
              variant={filter === 'brainstorms' ? 'default' : 'outline'}
              size="sm"
              className="flex items-center gap-1"
            >
              <Brain className="h-3 w-3" />
              Brainstorms ({savedItems.filter(item => item.source === 'brainstorm').length})
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {filteredItems.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-gray-400 mb-4">
                {filter === 'all' ? (
                  <div className="flex items-center justify-center gap-2">
                    <Calculator className="h-8 w-8" />
                    <Brain className="h-8 w-8" />
                  </div>
                ) : filter === 'tools' ? (
                  <Calculator className="h-8 w-8 mx-auto" />
                ) : (
                  <Brain className="h-8 w-8 mx-auto" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No saved {filter === 'all' ? 'items' : filter} found
              </h3>
              <p className="text-gray-500 mb-4">
                {filter === 'all' 
                  ? 'Create tools or run brainstorming sessions to see them saved here.'
                  : filter === 'tools'
                    ? 'Create tools using the Tool Creator to see them here.'
                    : 'Run Logic Architect brainstorming sessions to see results here.'
                }
              </p>
              <div className="text-sm text-gray-600 mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">🔍 Debug Information</h4>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                  {debugInfo || 'No debug info available'}
                </pre>
                <p className="text-xs text-gray-500 mt-2">
                  If you expect to see saved items but don't, check the browser console for more details.
                  Use the "🔍 Inspect Storage" button above to manually check localStorage.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold text-gray-900 truncate">
                        {getItemTitle(item)}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant={item.source === 'tool' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {item.source === 'tool' ? (
                            <>
                              <Calculator className="h-3 w-3 mr-1" />
                              Tool
                            </>
                          ) : (
                            <>
                              <Brain className="h-3 w-3 mr-1" />
                              Brainstorm
                            </>
                          )}
                        </Badge>
                        
                        {item.source === 'tool' && (item as SavedTool).tool?.metadata?.type && (
                          <Badge variant="outline" className="text-xs">
                            {(item as SavedTool).tool.metadata.type}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {getItemDescription(item)}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>{item.date}</span>
                  </div>

                  {/* Additional info for tools */}
                  {item.source === 'tool' && (
                    <div className="space-y-1">
                      {(item as SavedTool).tool?.metadata?.targetAudience && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <User className="h-3 w-3" />
                          <span>{(item as SavedTool).tool.metadata.targetAudience}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional info for brainstorms */}
                  {item.source === 'brainstorm' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <User className="h-3 w-3" />
                        <span>{(item as SavedLogicResult).targetAudience}</span>
                      </div>
                      {(item as SavedLogicResult).industry && (
                        <div className="text-xs text-gray-500">
                          Industry: {(item as SavedLogicResult).industry}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      onClick={() => setPreviewItem(item)}
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {item.source === 'tool' ? 'Preview' : 'View'}
                    </Button>
                    
                    <Button
                      onClick={() => exportSavedItem(item)}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      onClick={() => deleteSavedItem(item.id)}
                      size="sm"
                      variant="destructive"
                      className="text-xs"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Close modal when clicking the backdrop
            if (e.target === e.currentTarget) {
              setPreviewItem(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden relative">
            {/* Prominent Close Button - Top Right Corner */}
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex items-center justify-between p-4 border-b pr-16">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {previewItem.source === 'tool' ? '🛠️ Tool Preview' : '🧠 Brainstorm Details'}
                </h3>
                <p className="text-sm text-gray-600">
                  {getItemTitle(previewItem)}
                </p>
              </div>
              
              {/* Secondary close button in header */}
              <Button
                onClick={() => setPreviewItem(null)}
                variant="destructive"
                size="sm"
                className="flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Close
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {previewItem.source === 'tool' ? (
                <div>
                  {(previewItem as SavedTool).tool?.componentCode ? (
                    <DynamicComponentRenderer
                      componentCode={(previewItem as SavedTool).tool.componentCode}
                      metadata={{
                        title: (previewItem as SavedTool).tool.metadata.title,
                        description: (previewItem as SavedTool).tool.metadata.description,
                        slug: (previewItem as SavedTool).tool.metadata.slug || 'preview'
                      }}
                      onError={(error) => console.error('Preview error:', error)}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No component code available for preview</p>
                      <details className="mt-4 text-left">
                        <summary className="cursor-pointer text-sm text-gray-600">
                          View tool data
                        </summary>
                        <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                          {JSON.stringify((previewItem as SavedTool).tool, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Tool Type</h4>
                      <p className="text-sm text-gray-600">{(previewItem as SavedLogicResult).toolType}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Target Audience</h4>
                      <p className="text-sm text-gray-600">{(previewItem as SavedLogicResult).targetAudience}</p>
                    </div>
                    {(previewItem as SavedLogicResult).industry && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Industry</h4>
                        <p className="text-sm text-gray-600">{(previewItem as SavedLogicResult).industry}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Created</h4>
                      <p className="text-sm text-gray-600">{previewItem.date}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Brainstorming Result</h4>
                    <div className="bg-gray-50 rounded p-4">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto">
                        {JSON.stringify((previewItem as SavedLogicResult).result, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer with close instruction */}
            <div className="px-6 py-3 bg-gray-50 border-t text-center">
              <p className="text-xs text-gray-500">
                Click the red ✕ button, the Close button, or click outside the modal to close
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 