'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, 
  Database, 
  Search, 
  MapPin, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  DollarSign,
  RefreshCw,
  ExternalLink,
  Info
} from 'lucide-react';
import { BrainstormResult, BrainstormData } from '../types/unified-brainstorm-types';
import { MockData } from '@/lib/types/tcc-unified';
import { loadLogicResultsFromDB } from '@/app/tests/ui/db-utils';
import { toast } from 'sonner';
import { extractToolTitle } from '@/lib/utils/utils';
import DEFAULT_MODELS from '@/lib/ai/models/default-models.json';

interface ModelOption {
  id: string;
  name: string;
  provider?: string;
}

interface ResearchResults {
  hasExternalDataNeeds: boolean;
  requiredDataTypes: string[];
  researchQueries: Array<{
    query: string;
    domain: string;
    dataType: string;
    priority: string;
    locationDependent: boolean;
  }>;
  mockData: MockData;
  userInstructions: {
    summary: string;
    dataNeeded: string[];
    format: string;
  };
}

interface DataRequirementsResearchProps {
  isDarkMode: boolean;
  newBrainstormFlag: number;
}

const DataRequirementsResearch: React.FC<DataRequirementsResearchProps> = ({ 
  isDarkMode, 
  newBrainstormFlag 
}) => {
  const [savedBrainstorms, setSavedBrainstorms] = useState<BrainstormResult[]>([]);
  const [selectedBrainstorm, setSelectedBrainstorm] = useState<BrainstormResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [researchResults, setResearchResults] = useState<ResearchResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [userLocation, setUserLocation] = useState({
    state: 'California',
    country: 'United States',
    zipCode: ''
  });
  const [selectedModel, setSelectedModel] = useState('claude-3-7-sonnet-20250219');
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [defaultPrimaryModel, setDefaultPrimaryModel] = useState<string | null>(null);
  const MODEL_STORAGE_KEY = 'preferredModelId';

  

  const fetchDefaultModel = async () => {
    try {
      console.log('🔍 DataRequirementsResearch: Fetching default model from API...');
      const response = await fetch('/api/ai/models/default');
      if (response.ok) {
        const data = await response.json();
        const defaultModel = data.primaryModel || 'claude-3-7-sonnet-20250219';
        console.log('✅ DataRequirementsResearch: API default model:', defaultModel);
        setDefaultPrimaryModel(defaultModel);
      } else {
        console.warn('⚠️ DataRequirementsResearch: Failed to fetch default model, using fallback');
        setDefaultPrimaryModel('claude-3-7-sonnet-20250219');
      }
    } catch (error) {
      console.error('❌ DataRequirementsResearch: Error fetching default model:', error);
      setDefaultPrimaryModel('claude-3-7-sonnet-20250219');
    }
  };

  useEffect(() => {
    fetchDefaultModel();
    
    // Load all available models from default-models.json  
    try {
      console.log('🔍 DataRequirementsResearch: Loading models from DEFAULT_MODELS...');
      const parsedModels: ModelOption[] = [];
      
      if (!DEFAULT_MODELS?.providers) {
        console.error('❌ DEFAULT_MODELS.providers not found, using fallback');
        const fallbackModels: ModelOption[] = [
          { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Anthropic)', provider: 'Anthropic' },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet v2 (Anthropic)', provider: 'Anthropic' },
          { id: 'gpt-4o', name: 'GPT-4o (OpenAI)', provider: 'OpenAI' },
        ];
        setAvailableModels(fallbackModels);
        return;
      }
      
      // Parse models from DEFAULT_MODELS
      for (const providerKey in DEFAULT_MODELS.providers) {
        const provider = (DEFAULT_MODELS.providers as Record<string, { name: string; models: Record<string, { id: string; name: string; deprecated?: boolean }> }>)[providerKey];
        if (!provider?.models) continue;
        
        for (const modelKey in provider.models) {
          const model = (provider.models as Record<string, { id: string; name: string; deprecated?: boolean }>)[modelKey];
          if (model.deprecated) continue;
          
          parsedModels.push({ 
            id: model.id, 
            name: `${model.name} (${provider.name})`,
            provider: provider.name
          });
        }
      }
      
      console.log('✅ DataRequirementsResearch: Parsed', parsedModels.length, 'models');
      setAvailableModels(parsedModels);
      
    } catch (err) {
      console.error('❌ DataRequirementsResearch: Failed to load models:', err);
    }
  }, []); // Add empty dependency array here

  // Initialize selected model from localStorage, then fall back to API default
  useEffect(() => {
    if (availableModels.length === 0) return;

    let stored: string | null = null;
    if (typeof window !== 'undefined') {
      stored = localStorage.getItem(MODEL_STORAGE_KEY);
    }

    if (stored && availableModels.some(m => m.id === stored)) {
      console.log('💾 Restoring preferred model from localStorage:', stored);
      setSelectedModel(stored);
      return;
    }

    if (defaultPrimaryModel) {
      const target = availableModels.find(m => m.id === defaultPrimaryModel);
      if (target) {
        console.log('🌐 No stored model, falling back to API default:', target.name);
        setSelectedModel(target.id);
      }
    }
  }, [availableModels, defaultPrimaryModel]);

  // Persist selected model to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedModel) {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel]);

  // Sync component state when the selected brainstorm changes
  useEffect(() => {
    const bsData = selectedBrainstorm?.brainstormData as BrainstormData | undefined;
    const dataReq = bsData?.dataRequirements;
    if (!selectedBrainstorm || !dataReq) {
      // No brainstorm selected or it lacks research – clear view
      setResearchResults(null);
      setShowResults(false);
      return;
    }

    const { mockData = {}, userDataInstructions } = bsData ?? {} as BrainstormData;

    setResearchResults({
      hasExternalDataNeeds: dataReq.hasExternalDataNeeds ?? false,
      requiredDataTypes: dataReq.requiredDataTypes ?? [],
      researchQueries: dataReq.researchQueries ?? [],
      mockData: mockData,
      userInstructions: userDataInstructions ?? {
        summary: 'No user instructions available',
        dataNeeded: [],
        format: 'Not specified'
      }
    });
    setShowResults(true);
  }, [selectedBrainstorm]);

  const loadSavedBrainstorms = useCallback(async () => {
    try {
      const brainstorms = await loadLogicResultsFromDB();
      setSavedBrainstorms(brainstorms);
    } catch (error) {
      console.error('Error loading brainstorms:', error);
      toast.error('Failed to load saved brainstorms');
    }
  }, []);

  useEffect(() => {
    loadSavedBrainstorms();
  }, [newBrainstormFlag, loadSavedBrainstorms]);

  const getResearchStatus = () => {
    if (!selectedBrainstorm) return 'no-selection';
    const bsData = selectedBrainstorm.brainstormData as BrainstormData;
    return bsData.dataRequirements ? 'completed' : 'needs-research';
  };

  const getStatusBadge = () => {
    const status = getResearchStatus();
    switch (status) {
      case 'completed':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Research Complete
          </Badge>
        );
      case 'needs-research':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Needs Research
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleRunResearch = async () => {
    if (!selectedBrainstorm) {
      toast.error('Please select a brainstorm first');
      return;
    }

    const status = getResearchStatus();
    if (status === 'completed') {
      toast.info('This brainstorm already has research data. Use "Re-run Research" if you want to update it.');
      return;
    }

    setIsLoading(true);
    toast.success('🔍 Running AI research analysis with Perplexity...');
    
    try {
      const response = await fetch('/api/ai/data-requirements-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brainstormData: selectedBrainstorm.brainstormData,
          brainstormId: selectedBrainstorm.id,
          selectedModel,
          userLocation,
          persistToBrainstorm: true, // Always save to prevent re-running
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Research analysis failed');
      }

      // Update local state with results
      const researchData = data.dataRequirementsResearch || {};
      setResearchResults({
        hasExternalDataNeeds: researchData.hasExternalDataNeeds || false,
        requiredDataTypes: researchData.requiredDataTypes || [],
        researchQueries: researchData.researchQueries || [],
        mockData: researchData.mockData || {},
        userInstructions: researchData.userInstructions || {
          summary: 'No user instructions available',
          dataNeeded: [],
          format: 'Not specified'
        }
      });
      setShowResults(true);

      // 🔧 CRITICAL FIX: Always save to IndexedDB since server cannot access browser IndexedDB
      // The server-side persistResearchToBrainstorm function cannot actually persist to IndexedDB
      // (IndexedDB is a browser-only API), so we must handle persistence client-side
        
        if (selectedBrainstorm) {
          const baseBrainstorm = selectedBrainstorm as BrainstormResult;
          const bsData = baseBrainstorm.brainstormData as BrainstormData;
          const updatedBrainstorm: BrainstormResult = {
            ...baseBrainstorm,
            brainstormData: {
              ...bsData,
              dataRequirements: {
                hasExternalDataNeeds: researchData.hasExternalDataNeeds,
                requiredDataTypes: researchData.requiredDataTypes,
                researchQueries: researchData.researchQueries,
              },
              mockData: researchData.mockData,
              userDataInstructions: researchData.userInstructions,
            },
          };
          
          try {
            // Import the save function dynamically to avoid import issues
            const { saveLogicResultToDB } = await import('../../ui/db-utils');
            await saveLogicResultToDB(updatedBrainstorm);
            
            // Update local state immediately
            setSelectedBrainstorm(updatedBrainstorm);
            
            // Refresh the brainstorms list
            await loadSavedBrainstorms();
            
            console.log('✅ Research data saved to IndexedDB for brainstorm:', selectedBrainstorm.id);
          toast.success('✅ Research complete and saved to database!');
          } catch (dbError) {
            console.error('❌ Failed to save research data to IndexedDB:', dbError);
            toast.error('Research completed but failed to save to local database');
        }
      } else {
        toast.success('✅ Research analysis complete!');
      }

    } catch (error) {
      console.error('Research analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Research analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRerunResearch = useCallback(() => {
    if (!selectedBrainstorm) return;

    console.log('🔵 handleRerunResearch: Initiating re-run for brainstorm:', selectedBrainstorm.id);
    console.log('🔵 handleRerunResearch: About to show confirmation toast...');

    toast('Re-run Research?', {
      description: 'This will run a new Perplexity search and may cost money. Are you sure?',
      action: {
        label: 'Confirm',
        onClick: async () => {
          console.log('🔵 handleRerunResearch: CONFIRM BUTTON CLICKED!');
          if (!selectedBrainstorm) {
            console.log('🔵 handleRerunResearch: No selected brainstorm, aborting');
            return;
          }

          console.log('🔵 handleRerunResearch: Confirmed re-run for brainstorm:', selectedBrainstorm.id);

          try {
            setIsLoading(true);
            
            // Clear existing results first
            setResearchResults(null);
            setShowResults(false);
            
            // Create a temporary brainstorm without research data to force fresh research
            const baseBrainstorm = selectedBrainstorm as BrainstormResult;
            const bsData = baseBrainstorm.brainstormData as BrainstormData;
            const brainstormForRerun: BrainstormResult = {
              ...baseBrainstorm,
              brainstormData: {
                ...bsData,
                // Remove existing research data to force fresh analysis
                dataRequirements: undefined,
                mockData: {} as MockData,
                userDataInstructions: undefined,
              },
            };

            console.log('🔵 handleRerunResearch: Sending brainstorm data for re-run (cleared):', brainstormForRerun.brainstormData);
            
            toast.info('🔄 Re-running research analysis...');
            
            const response = await fetch('/api/ai/data-requirements-research', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                brainstormData: brainstormForRerun.brainstormData,
                brainstormId: selectedBrainstorm.id,
                selectedModel,
                userLocation,
                persistToBrainstorm: true,
              }),
            });

            console.log('🔵 handleRerunResearch: Received API response status:', response.status);
            const data = await response.json();
            console.log('🔵 handleRerunResearch: Received API response data:', data);
            
            if (!data.success) {
              throw new Error(data.error || 'Research analysis failed');
            }

            // Update local state with new results
            const researchData = data.dataRequirementsResearch || {};
            setResearchResults({
              hasExternalDataNeeds: researchData.hasExternalDataNeeds || false,
              requiredDataTypes: researchData.requiredDataTypes || [],
              researchQueries: researchData.researchQueries || [],
              mockData: researchData.mockData || {},
              userInstructions: researchData.userInstructions || {
                summary: 'No user instructions available',
                dataNeeded: [],
                format: 'Not specified'
              }
            });
            setShowResults(true);

            // 🔧 CRITICAL FIX: Always save to IndexedDB since server cannot access browser IndexedDB
            // The server-side persistResearchToBrainstorm function cannot actually persist to IndexedDB
            // (IndexedDB is a browser-only API), so we must handle persistence client-side
            
            if (selectedBrainstorm) {
              const bsData = selectedBrainstorm.brainstormData as BrainstormData;
              const updatedBrainstorm: BrainstormResult = {
                ...selectedBrainstorm,
                brainstormData: {
                  ...bsData,
                  dataRequirements: {
                    hasExternalDataNeeds: researchData.hasExternalDataNeeds,
                    requiredDataTypes: researchData.requiredDataTypes,
                    researchQueries: researchData.researchQueries,
                  },
                  mockData: researchData.mockData,
                  userDataInstructions: researchData.userInstructions,
                },
              };


              console.log('🔵 handleRerunResearch: Preparing to save updated brainstorm to IndexedDB:', updatedBrainstorm);
              
              try {
                const { saveLogicResultToDB } = await import('../../ui/db-utils');
                await saveLogicResultToDB(updatedBrainstorm);
                setSelectedBrainstorm(updatedBrainstorm);
                await loadSavedBrainstorms();
                console.log('✅ handleRerunResearch: Successfully saved updated brainstorm to IndexedDB.');
                toast.success('✅ Re-run complete and saved to database!');
              } catch (dbError) {
                console.error('❌ handleRerunResearch: Failed to save updated brainstorm to IndexedDB:', dbError);
                toast.error('Re-run completed but failed to save to local database');
              }
            } else {
              toast.success('✅ Re-run analysis complete!');
            }

          } catch (error) {
            console.error('❌ handleRerunResearch: Error during re-run process:', error);
            toast.error(error instanceof Error ? error.message : 'Re-run analysis failed');
          } finally {
            setIsLoading(false);
          }
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {
          console.log('🔵 handleRerunResearch: CANCEL BUTTON CLICKED!');
          console.log('🔵 handleRerunResearch: Re-run cancelled by user.');
          toast.info('Re-run cancelled.');
        }
      }
    });
  }, [selectedBrainstorm, selectedModel, userLocation, loadSavedBrainstorms]);

  // const renderDummyData = (data: Record<string, unknown>, parentKey: string = ''): JSX.Element | null => {
  //   if (Object.keys(data).length === 0) {
  //     return null;
  //   }

  //   return (
  //     <div className="space-y-3">
  //       {Object.entries(data).map(([key, value]) => (
  //         <div key={key} className="p-3 bg-slate-800 text-slate-100 rounded border border-slate-600">
  //           <div className="flex items-center justify-between mb-2">
  //             <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-200 border-slate-500">
  //               {parentKey ? `${parentKey}.${key}` : key}
  //             </Badge>
  //             <span className="text-xs text-slate-300">
  //               {typeof value === 'object' && value ? Object.keys(value).length : 1} items
  //             </span>
  //           </div>
  //           <pre className="text-xs bg-slate-900 text-slate-200 p-2 rounded border border-slate-600 overflow-x-auto">
  //             {JSON.stringify(value, null, 2)}
  //           </pre>
  //         </div>
  //       ))}
  //     </div>
  //   );
  // };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Requirements & Research Analysis
          </CardTitle>
          <CardDescription>
            Analyze brainstorm data to identify external data needs, conduct research via Perplexity, and generate enhanced data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Brainstorm Selection */}
          <div className="space-y-4">
            <Label>Select Brainstorm</Label>
            <Select onValueChange={(value) => {
              const brainstorm = savedBrainstorms.find(b => b.id === value);
              setSelectedBrainstorm(brainstorm || null);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a saved brainstorm to analyze..." />
              </SelectTrigger>
              <SelectContent>
                {savedBrainstorms.map((brainstorm: BrainstormResult) => {
                  const bsData = brainstorm.brainstormData as BrainstormData;
                  const title = extractToolTitle(bsData.coreConcept ?? 'Untitled Tool');

                  let formattedDate = 'No date';
                  if (typeof brainstorm.timestamp === 'number' || typeof brainstorm.timestamp === 'string') {
                    try {
                      formattedDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(
                        new Date(brainstorm.timestamp)
                      );
                    } catch (e) {
                      console.error(`Invalid timestamp for brainstorm ${brainstorm.id}:`, brainstorm.timestamp);
                      formattedDate = 'Invalid Date';
                    }
                  }

                  return (
                    <SelectItem key={brainstorm.id as React.Key} value={String(brainstorm.id)}>
                      <div className="flex items-center justify-between w-full">
                        <span>{title}</span>
                        <div className="flex items-center gap-2 ml-2">
                          {bsData.dataRequirements ? (
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Researched
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Needs Research
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {formattedDate}
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Brainstorm Info */}
          {selectedBrainstorm && (() => {
            const bsData = selectedBrainstorm.brainstormData as BrainstormData;
            return (
              <Card className="border-muted">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">
                        {extractToolTitle(bsData.coreConcept ?? 'Untitled Tool')}
                      </h4>
                      {getStatusBadge()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {bsData.valueProposition?.substring(0, 150)}...
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Tool Type: {bsData.promptOptions?.toolComplexity || 'Unknown'}</span>
                      <span>Calculations: {bsData.keyCalculations?.length || 0}</span>
                      <span>Inputs: {bsData.suggestedInputs?.length || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Location Context */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location Context (Optional)
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  placeholder="e.g., California"
                  value={userLocation.state}
                  onChange={(e) => setUserLocation(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="e.g., United States"
                  value={userLocation.country}
                  onChange={(e) => setUserLocation(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="zipcode">Zip Code</Label>
                <Input
                  id="zipcode"
                  placeholder="e.g., 94102"
                  value={userLocation.zipCode}
                  onChange={(e) => setUserLocation(prev => ({ ...prev, zipCode: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* AI Model Selection */}
          <div className="space-y-4">
            <Label>AI Model for Research
              {defaultPrimaryModel && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                  Default: {availableModels.find(m => m.id === defaultPrimaryModel)?.name || defaultPrimaryModel}
                </span>
              )}
            </Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an AI model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.length > 0 ? (
                  availableModels.map(model => (
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
                  ))
                ) : (
                  <>
                    <SelectItem value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Recommended)</SelectItem>
                    <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet v2</SelectItem>
                    <SelectItem value="claude-4-sonnet-20250514">Claude 4 Sonnet</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {getResearchStatus() === 'needs-research' && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Ready to Research</p>
                  <p className="text-xs text-blue-700">Analyzing brainstorm → Calling Perplexity → Generating enhanced data</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <DollarSign className="h-3 w-3" />
                  <span>~$0.10-0.30</span>
                </div>
              </div>
            )}

            {getResearchStatus() === 'completed' && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Research Complete</p>
                  <p className="text-xs text-green-700">This brainstorm has research data. View results below or re-run if needed.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {getResearchStatus() === 'needs-research' ? (
                <Button 
                  onClick={handleRunResearch}
                  disabled={!selectedBrainstorm || isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {isLoading ? 'Researching...' : 'Run Research & Save'}
                </Button>
              ) : getResearchStatus() === 'completed' ? (
                <>
                  <Button 
                    onClick={() => setShowResults(!showResults)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    {showResults ? 'Hide Results' : 'View Results'}
                  </Button>
                  <Button
                    onClick={handleRerunResearch}
                    disabled={isLoading}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {isLoading ? 'Re-running...' : 'Re-run Research'}
                  </Button>
                </>
              ) : (
                <Button disabled variant="outline">
                  Select a brainstorm first
                </Button>
              )}
            </div>
          </div>
          
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center p-8 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 animate-spin text-blue-500" />
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-900">Running AI Research Analysis</p>
                  <p className="text-xs text-blue-700">Analyzing brainstorm → Calling Perplexity → Generating enhanced data</p>
                  <p className="text-xs text-blue-600 mt-1">This may take 30-60 seconds...</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Research Results Display */}
      {showResults && researchResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Research Results
            </CardTitle>
            <CardDescription>
              External data analysis and research findings for this tool.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Data Requirements Summary */}
            <div className="space-y-3">
              <h4 className="font-medium">Data Requirements Summary</h4>
              <div className="flex items-center gap-2">
                <Badge variant={researchResults?.hasExternalDataNeeds ? "destructive" : "secondary"}>
                  {researchResults?.hasExternalDataNeeds ? 'Requires External Data' : 'Self-Contained Tool'}
                </Badge>
                {researchResults?.requiredDataTypes && researchResults.requiredDataTypes.length > 0 && (
                  <Badge variant="outline">
                    {researchResults.requiredDataTypes.length} Data Types
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {researchResults?.userInstructions?.summary || 'No summary available'}
              </p>
            </div>

            <Separator />

            {/* Research Queries */}
            {researchResults.researchQueries && researchResults.researchQueries.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Research Queries Executed ({researchResults.researchQueries.length})
                </h4>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {researchResults.researchQueries.map((query, index) => (
                      <div key={index} className="p-3 bg-slate-800 text-slate-100 rounded border border-slate-600">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-xs bg-slate-700 text-slate-200 border-slate-500">
                            {query.domain || 'Unknown'}
                          </Badge>
                          <Badge variant={query.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                            {query.priority || 'medium'}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-100">{query.query || 'No query specified'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs bg-slate-700 text-slate-200 border-slate-500">
                            {query.dataType || 'unknown'}
                          </Badge>
                          {query.locationDependent && (
                            <Badge variant="outline" className="text-xs bg-slate-700 text-slate-200 border-slate-500">
                              <MapPin className="h-3 w-3 mr-1" />
                              Location-dependent
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator />

            {/* Generated Mock Data */}
            {researchResults.mockData && Object.keys(researchResults.mockData).length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Generated Mock Data ({researchResults.mockData ? Object.keys(researchResults.mockData).length : 0} categories)
                </h4>
                <ScrollArea className="h-40">
                  <div className="space-y-3">
                    {Object.entries(researchResults.mockData || {}).map(([category, data]) => (
                      <div key={category} className="p-3 bg-slate-800 text-slate-100 rounded border border-slate-600">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-200 border-slate-500">
                            {category}
                          </Badge>
                          <span className="text-xs text-slate-300">
                            {typeof data === 'object' && data ? Object.keys(data).length : 1} items
                          </span>
                        </div>
                        <pre className="text-xs bg-slate-900 text-slate-200 p-2 rounded border border-slate-600 overflow-x-auto">
                          {JSON.stringify(data, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator />

            {/* User Instructions */}
            <div className="space-y-3">
              <h4 className="font-medium">User Data Instructions</h4>
              {researchResults.userInstructions?.dataNeeded && researchResults.userInstructions.dataNeeded.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Required Data:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {researchResults.userInstructions.dataNeeded.map((item, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-1">Expected Format:</p>
                <p className="text-sm text-muted-foreground">{researchResults.userInstructions?.format || 'Not specified'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DataRequirementsResearch;
