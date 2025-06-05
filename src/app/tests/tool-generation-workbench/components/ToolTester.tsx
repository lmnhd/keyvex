'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TestTube2, AlertCircle, CheckCircle, Code, Eye, Info, History, RefreshCw, Save } from 'lucide-react';
import {
  loadLogicResultsFromDB,
  runToolCreationTests,
  ToolCreationJob,
  SavedLogicResult
} from './tool-tester-core-logic';
import { saveToolToDBList } from '../../ui/db-utils';
import { CanvasTool } from '@/components/tool-creator-ui/canvas-tool';
import DEFAULT_MODELS from '@/lib/ai/models/default-models.json';
import { ProductToolDefinition } from '@/lib/types/product-tool';

interface ModelOption {
  id: string;
  name: string;
  provider?: string;
}

const MAX_MODELS_SELECTABLE = 5;

const ToolTester: React.FC<{ isDarkMode: boolean, newBrainstormFlag?: number }> = ({ isDarkMode, newBrainstormFlag }) => {
  const [savedBrainstorms, setSavedBrainstorms] = useState<SavedLogicResult[]>([]);
  const [selectedBrainstormId, setSelectedBrainstormId] = useState<string | undefined>(undefined);
  
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [testJobs, setTestJobs] = useState<ToolCreationJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedToolIds, setSavedToolIds] = useState<Set<string>>(new Set());
  const [defaultPrimaryModel, setDefaultPrimaryModel] = useState<string | null>(null);

  // Fetch the configured default model from the toolCreator API
  const fetchDefaultModel = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/create-tool');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.defaultModel?.primary?.id) {
          setDefaultPrimaryModel(data.defaultModel.primary.id);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch default model, using fallback:', error);
    }
  }, []);

  const fetchModels = useCallback(() => {
    try {
      const parsedModels: ModelOption[] = [];
      for (const providerKey in DEFAULT_MODELS.providers) {
        const provider = (DEFAULT_MODELS.providers as any)[providerKey];
        for (const modelKey in provider.models) {
          if ((provider.models as any)[modelKey].deprecated) continue;
          // Only include models relevant for tool creation (e.g., text, reasoning)
          const capabilities = (provider.models as any)[modelKey].capabilities;
          if (capabilities && (capabilities.includes('text') || capabilities.includes('reasoning'))) {
             parsedModels.push({ 
              id: (provider.models as any)[modelKey].id, 
              name: `${(provider.models as any)[modelKey].name} (${provider.name})`,
              provider: provider.name
            });
          }
        }
      }
      setAvailableModels(parsedModels);
      // Auto-select the toolCreator configured default if available and none are selected
      if (parsedModels.length > 0 && selectedModelIds.length === 0) {
        // Use the dynamically fetched default model, or fallback to known defaults
        const targetDefaultId = defaultPrimaryModel || 'gpt-4.1-mini';
        const defaultModel = parsedModels.find(m => m.id === targetDefaultId) || 
                            parsedModels.find(m => m.id === 'gpt-4.1-mini') || 
                            parsedModels.find(m => m.id === 'gpt-4o');
        if (defaultModel) setSelectedModelIds([defaultModel.id]);
      }
    } catch (err) {
      console.error('Failed to parse models:', err);
      setError('Failed to load AI models from default-models.json. Check console.');
    }
  }, [selectedModelIds.length, defaultPrimaryModel]); // Rerun if selected models are cleared or default model changes

  const fetchBrainstorms = useCallback(async () => {
    try {
      setIsLoading(true);
      const results = await loadLogicResultsFromDB();
      setSavedBrainstorms(results);
      if (results.length > 0 && !selectedBrainstormId) {
        setSelectedBrainstormId(results[0].id);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load saved brainstorms:', err);
      setError('Failed to load saved brainstorms. Check console.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBrainstormId]);

  useEffect(() => {
    fetchDefaultModel();
    fetchModels();
    fetchBrainstorms();
  }, [fetchDefaultModel, fetchModels, fetchBrainstorms, newBrainstormFlag]); // newBrainstormFlag is a signal to refresh

  const handleModelSelection = (modelId: string) => {
    setSelectedModelIds(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId);
      }
      if (prev.length < MAX_MODELS_SELECTABLE) {
        return [...prev, modelId];
      }
      // Optional: Provide feedback that limit is reached
      alert(`You can select up to ${MAX_MODELS_SELECTABLE} models.`);
      return prev;
    });
  };

  const handleJobUpdate = (updatedJob: ToolCreationJob) => {
    setTestJobs(prevJobs => 
      prevJobs.map(job => job.modelId === updatedJob.modelId ? updatedJob : job)
    );
  };

  const handleSubmit = async () => {
    if (!selectedBrainstormId) {
      setError('Please select a brainstorm result to test.');
      return;
    }
    if (selectedModelIds.length === 0) {
      setError(`Please select at least one AI model (up to ${MAX_MODELS_SELECTABLE}).`);
      return;
    }

    const selectedBrainstorm = savedBrainstorms.find(bs => bs.id === selectedBrainstormId);
    if (!selectedBrainstorm) {
      setError('Selected brainstorm result not found.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTestJobs(selectedModelIds.map(id => ({ modelId: id, status: 'pending' })));

    const results = await runToolCreationTests(selectedBrainstorm, selectedModelIds, handleJobUpdate);
    setTestJobs(results); // final update with all settled states
    setIsLoading(false);
  };

  const getSelectedBrainstormDetails = () => {
    return savedBrainstorms.find(b => b.id === selectedBrainstormId);
  }

  const handleSaveTool = async (tool: ProductToolDefinition, modelId: string) => {
    try {
      await saveToolToDBList(tool);
      setSavedToolIds(prev => new Set([...prev, tool.id]));
      console.log(`✅ Tool saved to IndexedDB: ${tool.metadata.title} (generated by ${modelId})`);
    } catch (error) {
      console.error('❌ Error saving tool to IndexedDB:', error);
      setError('Failed to save tool to IndexedDB. Check console for details.');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center"><TestTube2 className="mr-2 h-6 w-6 text-blue-500" /> Test Tool Creation</CardTitle>
        <CardDescription>Select a saved brainstorm result and AI models to generate and compare tools.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="selectedBrainstorm">Select Saved Brainstorm</Label>
              <div className="flex items-center gap-2">
                <Select 
                  value={selectedBrainstormId}
                  onValueChange={setSelectedBrainstormId} 
                  disabled={isLoading || savedBrainstorms.length === 0}
                >
                  <SelectTrigger id="selectedBrainstorm">
                    <SelectValue placeholder={savedBrainstorms.length === 0 ? "No brainstorms saved" : "Choose a brainstorm"} />
                  </SelectTrigger>
                  <SelectContent>
                    {savedBrainstorms.map(bs => (
                      <SelectItem key={bs.id} value={bs.id}>
                        {bs.toolType} for {bs.targetAudience} (Saved: {new Date(bs.timestamp).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedBrainstormId && getSelectedBrainstormDetails() && (
              <Card className="bg-gray-50 dark:bg-gray-800/50">
                <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center"><Info className="mr-2 h-4 w-4 text-blue-500"/>Selected Brainstorm Details</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                    <p><strong>ID:</strong> {getSelectedBrainstormDetails()?.id}</p>
                    <p><strong>Tool Type:</strong> {getSelectedBrainstormDetails()?.toolType}</p>
                    <p><strong>Target:</strong> {getSelectedBrainstormDetails()?.targetAudience}</p>
                    {getSelectedBrainstormDetails()?.industry && <p><strong>Industry:</strong> {getSelectedBrainstormDetails()?.industry}</p>}
                    <details className="mt-1">
                        <summary className="cursor-pointer font-medium">View Full Input Data</summary>
                        <pre className="mt-1 p-1.5 bg-white dark:bg-gray-700/50 rounded-md overflow-x-auto max-h-32 text-[10px]">
                        {JSON.stringify(getSelectedBrainstormDetails()?.result?.userInput || getSelectedBrainstormDetails()?.result, null, 2)}
                        </pre>
                    </details>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
              <Label>Select AI Models (up to {MAX_MODELS_SELECTABLE})
                {defaultPrimaryModel && (
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                    Default: {defaultPrimaryModel}
                  </span>
                )}
              </Label>
              <Button variant="outline" size="icon" onClick={fetchBrainstorms} disabled={isLoading} title="Refresh Brainstorms">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {availableModels.length > 0 ? (
              <ScrollArea className="h-48 rounded-md border p-3">
                <div className="space-y-2">
                  {availableModels.map(model => (
                    <div key={model.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`model-${model.id}`}
                        checked={selectedModelIds.includes(model.id)}
                        onCheckedChange={() => handleModelSelection(model.id)}
                        disabled={isLoading || (selectedModelIds.length >= MAX_MODELS_SELECTABLE && !selectedModelIds.includes(model.id))}
                      />
                      <Label htmlFor={`model-${model.id}`} className="text-sm font-normal cursor-pointer flex items-center">
                        {model.name}
                        {model.id === defaultPrimaryModel && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md">
                            Default
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-gray-500">{(error && error.includes('AI models')) ? 'Error loading models.' : 'Loading models...'}</p>
            )}
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isLoading || !selectedBrainstormId || selectedModelIds.length === 0} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}
          Run Tool Generation Tests
        </Button>

        {testJobs.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Tool Generation Results</h3>
            <Tabs defaultValue={testJobs[0]?.modelId} className="w-full">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {testJobs.map((job) => (
                  <TabsTrigger key={`trigger-${job.modelId}`} value={job.modelId} className="truncate flex items-center">
                    <span className="truncate">{availableModels.find(m=>m.id === job.modelId)?.name || job.modelId}</span>
                    {job.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500 ml-2 flex-shrink-0" />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {testJobs.map((job) => (
                <TabsContent key={`content-${job.modelId}`} value={job.modelId}>
                  <Card className="w-full mt-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base truncate" title={availableModels.find(m=>m.id === job.modelId)?.name || job.modelId}>
                        {availableModels.find(m=>m.id === job.modelId)?.name || job.modelId}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Status: <span className={`font-semibold \
                          ${job.status === 'loading' ? 'text-yellow-500' : ''}\
                          ${job.status === 'success' ? 'text-green-500' : ''}\
                          ${job.status === 'error' ? 'text-red-500' : ''}\
                          ${job.status === 'pending' ? 'text-gray-400' : ''}`}>\
                          {job.status} {job.status === 'loading' && <Loader2 className="inline-block ml-1 h-3 w-3 animate-spin" />}\
                                                  {job.status === 'success' && <CheckCircle className="inline-block ml-1 h-3 w-3" />}\
                                                  {job.status === 'error' && <AlertCircle className="inline-block ml-1 h-3 w-3" />}
                        </span>
                        {job.startTime && job.endTime && (
                          <span className="ml-2 text-gray-500 dark:text-gray-400">
                            (Took {((job.endTime - job.startTime) / 1000).toFixed(2)}s)
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                    {job.status === 'loading' && (
                        <div className="flex flex-col items-center justify-center h-40">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                          <p className="mt-2 text-sm text-gray-500">Generating tool...</p>
                        </div>
                      )}
                      {job.status === 'error' && job.error && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Generation Failed</AlertTitle>
                          <AlertDescription className="text-xs break-all">{job.error}</AlertDescription>
                        </Alert>
                      )}
                      {job.status === 'success' && job.result && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              ✅ Tool "{job.result.metadata.title}" generated successfully
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSaveTool(job.result!, job.modelId)}
                              disabled={savedToolIds.has(job.result.id)}
                              className="flex items-center gap-2"
                            >
                              <Save className="h-4 w-4" />
                              {savedToolIds.has(job.result.id) ? 'Saved' : 'Save Tool'}
                            </Button>
                          </div>
                          <Tabs defaultValue="preview" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="preview"><Eye className="mr-1 h-4 w-4" />Preview</TabsTrigger>
                              <TabsTrigger value="code"><Code className="mr-1 h-4 w-4" />Code</TabsTrigger>
                            </TabsList>
                          <TabsContent value="preview">
                            <div className="mt-2 p-2 border rounded-md min-h-[300px] bg-white dark:bg-black">
                              <CanvasTool
                                productToolDefinition={job.result}
                                isDarkMode={isDarkMode}
                                isGenerating={false}
                                generatingMessage={undefined}
                                onValidationIssues={() => {}}
                              />
                            </div>
                          </TabsContent>
                          <TabsContent value="code">
                            <ScrollArea className="mt-2 h-[400px] rounded-md border bg-gray-900 p-1">
                              <pre className="text-xs text-white p-2 break-all whitespace-pre-wrap">
                                {job.result.componentCode}
                              </pre>
                              <ScrollBar />
                            </ScrollArea>
                          </TabsContent>
                        </Tabs>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ToolTester;
