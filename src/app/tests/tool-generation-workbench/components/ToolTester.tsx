'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TestTube2, AlertCircle, CheckCircle, Code, Eye, Info, RefreshCw, Save, Wand2 } from 'lucide-react';
import {
  loadLogicResultsFromDB,
  runToolCreationProcess,
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

const ToolTester: React.FC<{ isDarkMode: boolean, newBrainstormFlag?: number }> = ({ isDarkMode, newBrainstormFlag }) => {
  const [savedBrainstorms, setSavedBrainstorms] = useState<SavedLogicResult[]>([]);
  const [selectedBrainstormId, setSelectedBrainstormId] = useState<string | undefined>(undefined);
  
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(''); // Single model selection

  const [isLoading, setIsLoading] = useState(false);
  const [testJob, setTestJob] = useState<ToolCreationJob | null>(null); // Single job state
  const [error, setError] = useState<string | null>(null);
  const [savedToolIds, setSavedToolIds] = useState<Set<string>>(new Set());
  const [defaultPrimaryModel, setDefaultPrimaryModel] = useState<string | null>(null);

  // Fetch the configured default model from the toolCreator API
  const fetchDefaultModel = useCallback(async () => {
    try {
      // This should point to the new V2 config endpoint if available, but create-tool is fine for now
      const response = await fetch('/api/ai/create-tool'); 
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.defaultModel?.primary?.id) {
          setDefaultPrimaryModel(data.defaultModel.primary.id);
          if (!selectedModelId) {
            setSelectedModelId(data.defaultModel.primary.id);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch default model, using fallback:', error);
    }
  }, [selectedModelId]);

  const fetchModels = useCallback(() => {
    try {
      const parsedModels: ModelOption[] = [];
      for (const providerKey in DEFAULT_MODELS.providers) {
        const provider = (DEFAULT_MODELS.providers as any)[providerKey];
        for (const modelKey in provider.models) {
          if ((provider.models as any)[modelKey].deprecated) continue;
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
      if (parsedModels.length > 0 && !selectedModelId) {
        const targetDefaultId = defaultPrimaryModel || 'gpt-4.1-mini';
        const defaultModel = parsedModels.find(m => m.id === targetDefaultId) || 
                            parsedModels.find(m => m.id === 'gpt-4.1-mini') || 
                            parsedModels.find(m => m.id === 'gpt-4o');
        if (defaultModel) setSelectedModelId(defaultModel.id);
      }
    } catch (err) {
      console.error('Failed to parse models:', err);
      setError('Failed to load AI models from default-models.json. Check console.');
    }
  }, [selectedModelId, defaultPrimaryModel]);

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
  }, [fetchDefaultModel, fetchModels, fetchBrainstorms, newBrainstormFlag]);

  const handleJobUpdate = (updatedJob: ToolCreationJob) => {
    setTestJob(updatedJob);
  };

  const handleSubmit = async () => {
    if (!selectedBrainstormId) {
      setError('Please select a brainstorm result to test.');
      return;
    }
    if (!selectedModelId) {
      setError(`Please select an AI model.`);
      return;
    }

    const selectedBrainstorm = savedBrainstorms.find(bs => bs.id === selectedBrainstormId);
    if (!selectedBrainstorm) {
      setError('Selected brainstorm result not found.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTestJob({ modelId: selectedModelId, status: 'pending' });

    // Call the new V2 process
    const resultJob = await runToolCreationProcess(selectedBrainstorm, selectedModelId, handleJobUpdate);
    setTestJob(resultJob); 
    
    if (resultJob.status !== 'error') {
      // TODO: Implement WebSocket listener here based on resultJob.jobId
      console.log(`Tool creation started with Job ID: ${resultJob.jobId}. Now listening for updates...`);
      // For now, we'll just stop the loading spinner. The UI will show "loading" based on job status.
      // In a real scenario, we might not set isLoading to false until the WebSocket signals 'completed' or 'failed'.
    }
    setIsLoading(false);
  };

  const getSelectedBrainstormDetails = () => {
    return savedBrainstorms.find(b => b.id === selectedBrainstormId);
  }

  const handleSaveTool = async (tool: ProductToolDefinition) => {
    try {
      await saveToolToDBList(tool);
      setSavedToolIds(prev => new Set([...prev, tool.id]));
      console.log(`✅ Tool saved to IndexedDB: ${tool.metadata.title}`);
    } catch (error) {
      console.error('❌ Error saving tool to IndexedDB:', error);
      setError('Failed to save tool to IndexedDB. Check console for details.');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center"><Wand2 className="mr-2 h-6 w-6 text-purple-500" /> Create & Refine Tool</CardTitle>
        <CardDescription>Select a brainstorm, choose a model, and generate your tool using the V2 Orchestrator.</CardDescription>
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
              <Label htmlFor="selectedBrainstorm">1. Select Saved Brainstorm</Label>
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
                 <Button variant="outline" size="icon" onClick={fetchBrainstorms} disabled={isLoading} title="Refresh Brainstorms">
                    <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedBrainstormId && getSelectedBrainstormDetails() && (
              <Card className="bg-gray-50 dark:bg-gray-800/50">
                <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center"><Info className="mr-2 h-4 w-4 text-blue-500"/>Selected Brainstorm Details</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                    <p><strong>Tool Type:</strong> {getSelectedBrainstormDetails()?.toolType}</p>
                    <p><strong>Target:</strong> {getSelectedBrainstormDetails()?.targetAudience}</p>
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
              <Label>2. Select AI Model</Label>
            </div>
            {availableModels.length > 0 ? (
              <ScrollArea className="h-48 rounded-md border p-3">
                <RadioGroup value={selectedModelId} onValueChange={setSelectedModelId} disabled={isLoading}>
                  <div className="space-y-2">
                    {availableModels.map(model => (
                      <div key={model.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={model.id} id={`model-${model.id}`} />
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
                </RadioGroup>
              </ScrollArea>
            ) : (
              <p className="text-sm text-gray-500">{(error && error.includes('AI models')) ? 'Error loading models.' : 'Loading models...'}</p>
            )}
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={isLoading || !selectedBrainstormId || !selectedModelId} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Generate Tool
        </Button>

        {testJob && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Generation Status</h3>
            <Card className="w-full mt-2">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base truncate" title={availableModels.find(m=>m.id === testJob.modelId)?.name || testJob.modelId}>
                    {availableModels.find(m=>m.id === testJob.modelId)?.name || testJob.modelId}
                    </CardTitle>
                    <CardDescription className="text-xs">
                    Job ID: {testJob.jobId || 'N/A'} | Status: <span className={`font-semibold \
                        ${testJob.status === 'loading' || testJob.status === 'pending' ? 'text-yellow-500' : ''}\
                        ${testJob.status === 'success' ? 'text-green-500' : ''}\
                        ${testJob.status === 'error' ? 'text-red-500' : ''}`}>\
                        {testJob.status} {testJob.status === 'loading' && <Loader2 className="inline-block ml-1 h-3 w-3 animate-spin" />}\
                                                {testJob.status === 'success' && <CheckCircle className="inline-block ml-1 h-3 w-3" />}\
                                                {testJob.status === 'error' && <AlertCircle className="inline-block ml-1 h-3 w-3" />}
                    </span>
                    {testJob.startTime && testJob.endTime && (
                        <span className="ml-2 text-gray-500 dark:text-gray-400">
                        (Took {((testJob.endTime - testJob.startTime) / 1000).toFixed(2)}s)
                        </span>
                    )}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                {(testJob.status === 'loading' || testJob.status === 'pending') && (
                    <div className="flex flex-col items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="mt-2 text-sm text-gray-500">Orchestrator is working... Waiting for progress updates.</p>
                        {/* TODO: This is where the live progress log from WebSocket will go */}
                    </div>
                    )}
                    {testJob.status === 'error' && testJob.error && (
                    <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Generation Failed</AlertTitle>
                        <AlertDescription className="text-xs break-all">{testJob.error}</AlertDescription>
                    </Alert>
                    )}
                    {testJob.status === 'success' && testJob.result && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            ✅ Tool "{testJob.result.metadata.title}" generated successfully
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSaveTool(testJob.result!)}
                            disabled={savedToolIds.has(testJob.result.id)}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {savedToolIds.has(testJob.result.id) ? 'Saved' : 'Save Tool'}
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
                            productToolDefinition={testJob.result}
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
                            {testJob.result.componentCode}
                            </pre>
                            <ScrollBar />
                        </ScrollArea>
                        </TabsContent>
                    </Tabs>
                    </div>
                    )}
                </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ToolTester;
