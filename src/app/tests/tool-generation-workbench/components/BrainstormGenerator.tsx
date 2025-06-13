'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Wand2, AlertCircle, CheckCircle, Sparkles, HelpCircle } from 'lucide-react';
import { generateBrainstorm, BrainstormRequest, BrainstormStreamData } from './brainstorm-generator-core-logic';
import { SavedLogicResult } from '../../ui/types';
import DEFAULT_MODELS from '@/lib/ai/models/default-models.json';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DetailedBrainstormView } from './DetailedBrainstormView';

interface ModelOption {
  id: string;
  name: string;
  provider?: string;
}

interface ExtractedDetailsResponse {
    success: boolean;
    data?: {
        toolType: string;
        targetAudience: string;
    };
    message?: string;
    errors?: any;
}

const BrainstormGenerator: React.FC<{ onBrainstormGenerated?: (result: SavedLogicResult) => void }> = ({ onBrainstormGenerated }) => {
  // State for the new feature
  const [masterDescription, setMasterDescription] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Existing state for brainstorm generation
  const [toolType, setToolType] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [industry, setIndustry] = useState('');
  const [businessContext, setBusinessContext] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [defaultPrimaryModel, setDefaultPrimaryModel] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false); // For brainstorm generation
  const [streamingThoughts, setStreamingThoughts] = useState<string[]>([]);
  const [finalResult, setFinalResult] = useState<SavedLogicResult | null>(null);
  const [error, setError] = useState<string | null>(null); // For brainstorm generation
  const [detailedBrainstormData, setDetailedBrainstormData] = useState<any | null>(null);

  // Fetch the configured default model from the logicArchitect API
  const fetchDefaultModel = async () => {
    try {
      const response = await fetch('/api/ai/logic-architect/brainstorm');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.defaultModel?.primary?.id) {
          setDefaultPrimaryModel(data.defaultModel.primary.id);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch default model, using fallback:', error);
    }
  };

  useEffect(() => {
    fetchDefaultModel();
    
    try {
      const parsedModels: ModelOption[] = [];
      for (const providerKey in DEFAULT_MODELS.providers) {
        const provider = (DEFAULT_MODELS.providers as any)[providerKey];
        for (const modelKey in provider.models) {
          if ((provider.models as any)[modelKey].deprecated) continue;
          parsedModels.push({ 
            id: (provider.models as any)[modelKey].id, 
            name: `${(provider.models as any)[modelKey].name} (${provider.name})`,
            provider: provider.name
          });
        }
      }
      setAvailableModels(parsedModels);
      
      if (parsedModels.length > 0) {
        // Use the dynamically fetched default model, or fallback to known defaults
        const targetDefaultId = defaultPrimaryModel || 'claude-3-5-sonnet-20240620';
        const defaultModel = parsedModels.find(m => m.id === targetDefaultId) || 
                           parsedModels.find(m => m.id === 'gpt-4o') || 
                           parsedModels[0];
        setSelectedModel(defaultModel.id);
      }
    } catch (err) {
      console.error('Failed to parse models:', err);
      setError('Failed to load AI models from default-models.json. Check console.');
    }
  }, [defaultPrimaryModel]);

  const handleExtractAndPopulate = async () => {
    if (!masterDescription.trim()) {
      setExtractionError('Please enter a master tool description first.');
      return;
    }
    setIsExtracting(true);
    setExtractionError(null);
    try {
      const response = await fetch('/api/ai/extract-tool-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: masterDescription }),
      });
      const result = await response.json() as ExtractedDetailsResponse;

      if (!response.ok || !result.success) {
        const message = result.message || (result.errors ? JSON.stringify(result.errors) : 'Failed to extract details.');
        throw new Error(message);
      }

      if (result.data) {
        setToolType(result.data.toolType);
        setTargetAudience(result.data.targetAudience);
        setBusinessContext(masterDescription); // Populate the main description field
      }

    } catch (err) {
      const typedError = err as Error;
      setExtractionError(typedError.message || 'An unknown error occurred during extraction.');
      console.error('Extraction error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleProgress = (streamData: BrainstormStreamData) => {
    if (streamData.type === 'partial' && streamData.data?.thought) {
      setStreamingThoughts(prev => [...prev, streamData.data.thought]);
    }
    if (streamData.type === 'error') {
      setError(streamData.message || 'An unknown error occurred during brainstorming.');
      setIsLoading(false);
    }
    if (streamData.type === 'complete') {
      setIsLoading(false);
    }
  };

  const handleBrainstormSubmit = async () => {
    if (!toolType || !targetAudience || !businessContext) {
      setError('Tool Type, Target Audience, and Tool Description (for brainstorming) are required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setFinalResult(null);
    setDetailedBrainstormData(null);
    setStreamingThoughts([]);

    const request: BrainstormRequest = {
      toolType,
      targetAudience,
      industry: industry || undefined,
      businessContext,
      selectedModel,
    };

    const result = await generateBrainstorm(request, handleProgress);
    if (result) {
      setFinalResult(result);
      if (result.result && typeof result.result.brainstormOutput === 'object' && result.result.brainstormOutput !== null) {
        setDetailedBrainstormData(result.result.brainstormOutput);
      } else {
        console.warn('Brainstorm output was not in the expected format or was missing.', result.result);
      }
      if (onBrainstormGenerated) {
        onBrainstormGenerated(result);
      }
    } 
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center"><Wand2 className="mr-2 h-6 w-6 text-purple-500" /> Generate Brainstorm Result</CardTitle>
        <CardDescription>Define a tool concept to generate a structured brainstorm object for testing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* --- New Feature: Extract Tool Details --- */}
        <Card className="bg-slate-50 dark:bg-slate-800/30 p-0">
            <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-md flex items-center">
                    <Sparkles className="mr-2 h-5 w-5 text-amber-500" /> AI-Assisted Detail Extraction
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <HelpCircle className="ml-2 h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Enter a general description of your tool idea. The AI will attempt to extract the 'Tool Type' and 'Target Audience' and populate the fields below for you. You can then refine these before generating the full brainstorm.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardTitle>
                 <CardDescription className="text-xs pt-1">Input your overall tool idea here, and let AI suggest the core details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
                {extractionError && (
                    <Alert variant="destructive" className="text-xs">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-sm">Extraction Error</AlertTitle>
                        <AlertDescription>{extractionError}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-1.5">
                    <Label htmlFor="masterDescription">Master Tool Description</Label>
                    <Textarea 
                        id="masterDescription" 
                        value={masterDescription} 
                        onChange={(e) => setMasterDescription(e.target.value)} 
                        placeholder="e.g., A calculator to help SaaS companies estimate customer lifetime value based on their churn rate, average revenue per user, and customer acquisition cost."
                        rows={4}
                        className="resize-none"
                        disabled={isExtracting}
                    />
                </div>
                <Button onClick={handleExtractAndPopulate} disabled={isExtracting || !masterDescription.trim()} className="w-full">
                    {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Extract & Populate Details
                </Button>
            </CardContent>
        </Card>

        <Separator />

        {/* --- Existing Brainstorm Generation Form --- */}
        <h3 className="text-lg font-semibold flex items-center pt-2">
            Brainstorm Generation Inputs
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <HelpCircle className="ml-2 h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                        <p>These fields will be used to generate the full brainstorm result. Use the section above to get AI suggestions for 'Tool Type' and 'Target Audience', or fill them manually.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </h3>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Brainstorm Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="toolType">Tool Type <span className="text-red-500">*</span></Label>
            <Input id="toolType" value={toolType} onChange={(e) => setToolType(e.target.value)} placeholder="e.g., ROI Calculator" disabled={isLoading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="targetAudience">Target Audience <span className="text-red-500">*</span></Label>
            <Input id="targetAudience" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g., Marketing Agencies" disabled={isLoading} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="industry">Industry (Optional)</Label>
          <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g., Digital Marketing" disabled={isLoading} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="businessContext">Detailed Tool Description / Requirements <span className="text-red-500">*</span></Label>
          <Textarea 
            id="businessContext" 
            value={businessContext} 
            onChange={(e) => setBusinessContext(e.target.value)} 
            placeholder="Describe the tool's specific purpose, key features, calculations, user flow, what problem it solves, etc. This will be used for the full brainstorm."
            rows={5}
            className="resize-none"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="selectedModel">AI Model for Brainstorm
            {defaultPrimaryModel && (
              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                Default: {defaultPrimaryModel}
              </span>
            )}
          </Label>
          {availableModels.length > 0 ? (
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isLoading}>
              <SelectTrigger id="selectedModel">
                <SelectValue placeholder="Choose an AI model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center">
                      {model.name}
                      {model.id === defaultPrimaryModel && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md">
                          Default
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-gray-500">{(error && error.includes('AI models')) ? 'Error loading models.' : 'Loading models...'}</p>
          )}
        </div>
        <Button onClick={handleBrainstormSubmit} disabled={isLoading || availableModels.length === 0} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Generate Full Brainstorm
        </Button>

        {isLoading && streamingThoughts.length > 0 && (
          <Card className="mt-4 bg-gray-50 dark:bg-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Thinking Process (Brainstorm):</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto">
                {streamingThoughts.map((thought, index) => (
                  <li key={index}>{thought}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {finalResult && !isLoading && (
          <Alert variant="default" className="mt-6">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Full Brainstorm Generated Successfully!</AlertTitle>
            <AlertDescription>
              <p className="mb-2 text-xs">ID: {finalResult.id}</p>
              <p className="mb-2">This brainstorm result has been saved and is available in the 'Test Tool Creation' tab.</p>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer font-semibold">View Raw Output (from SavedLogicResult)</summary>
                <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md overflow-x-auto max-h-80">
                  {JSON.stringify(finalResult.result, null, 2)}
                </pre>
              </details>
            </AlertDescription>
          </Alert>
        )}

        {detailedBrainstormData && (
          <DetailedBrainstormView data={detailedBrainstormData} />
        )}
      </CardContent>
    </Card>
  );
};

export default BrainstormGenerator;