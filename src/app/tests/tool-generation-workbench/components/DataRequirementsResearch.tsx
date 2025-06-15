'use client';

import React, { useState, useEffect } from 'react';
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
import { BrainstormResult } from '../types/unified-brainstorm-types';
import { loadLogicResultsFromDB } from '@/app/tests/ui/db-utils';
import { toast } from 'sonner';

interface DataRequirementsResearchProps {
  isDarkMode: boolean;
  newBrainstormFlag: number;
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
  mockData: Record<string, any>;
  userInstructions: {
    summary: string;
    dataNeeded: string[];
    format: string;
  };
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
  const [selectedModel, setSelectedModel] = useState('gpt-4o');

  useEffect(() => {
    loadSavedBrainstorms();
  }, [newBrainstormFlag]);

  useEffect(() => {
    // When brainstorm changes, check if it already has research results
    if (selectedBrainstorm?.brainstormData?.dataRequirements) {
      setResearchResults({
        hasExternalDataNeeds: selectedBrainstorm.brainstormData.dataRequirements.hasExternalDataNeeds,
        requiredDataTypes: selectedBrainstorm.brainstormData.dataRequirements.requiredDataTypes || [],
        researchQueries: selectedBrainstorm.brainstormData.dataRequirements.researchQueries || [],
        mockData: selectedBrainstorm.brainstormData.mockData || {},
        userInstructions: selectedBrainstorm.brainstormData.userDataInstructions || {
          summary: 'No user instructions available',
          dataNeeded: [],
          format: 'Not specified'
        }
      });
      setShowResults(true);
    } else {
      setResearchResults(null);
      setShowResults(false);
    }
  }, [selectedBrainstorm]);

  const loadSavedBrainstorms = async () => {
    try {
      const brainstorms = await loadLogicResultsFromDB();
      setSavedBrainstorms(brainstorms);
    } catch (error) {
      console.error('Error loading brainstorms:', error);
      toast.error('Failed to load saved brainstorms');
    }
  };

  const getResearchStatus = () => {
    if (!selectedBrainstorm) return 'no-selection';
    if (selectedBrainstorm.brainstormData?.dataRequirements) return 'completed';
    return 'needs-research';
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
      setResearchResults(data.dataRequirementsResearch);
      setShowResults(true);

      if (data.wasPersistedToDB) {
        toast.success('✅ Research complete and saved to database!');
        
        // Update the brainstorm in IndexedDB with research data
        if (selectedBrainstorm) {
          const updatedBrainstorm = {
            ...selectedBrainstorm,
            brainstormData: {
              ...selectedBrainstorm.brainstormData,
              dataRequirements: {
                hasExternalDataNeeds: data.dataRequirementsResearch.hasExternalDataNeeds,
                requiredDataTypes: data.dataRequirementsResearch.requiredDataTypes,
                researchQueries: data.dataRequirementsResearch.researchQueries
              },
              mockData: data.dataRequirementsResearch.mockData,
              userDataInstructions: data.dataRequirementsResearch.userInstructions
            }
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
          } catch (dbError) {
            console.error('❌ Failed to save research data to IndexedDB:', dbError);
            toast.error('Research completed but failed to save to local database');
          }
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

  const handleRerunResearch = async () => {
    if (!selectedBrainstorm) return;

    const confirmed = window.confirm(
      '⚠️ This will run a new Perplexity search and cost money. Are you sure you want to re-run the research for this brainstorm?'
    );
    
    if (!confirmed) return;

    try {
      setIsLoading(true);
      
      // Clear existing results first
      setResearchResults(null);
      setShowResults(false);
      
      // Create a temporary brainstorm without research data to force fresh research
      const brainstormForRerun = {
        ...selectedBrainstorm,
        brainstormData: {
          ...selectedBrainstorm.brainstormData,
          // Remove existing research data to force fresh analysis
          dataRequirements: undefined,
          mockData: undefined,
          userDataInstructions: undefined
        }
      };
      
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

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Research analysis failed');
      }

      // Update local state with new results
      setResearchResults(data.dataRequirementsResearch);
      setShowResults(true);

      if (data.wasPersistedToDB) {
        // Update the brainstorm in IndexedDB with new research data
        const updatedBrainstorm = {
          ...selectedBrainstorm,
          brainstormData: {
            ...selectedBrainstorm.brainstormData,
            dataRequirements: {
              hasExternalDataNeeds: data.dataRequirementsResearch.hasExternalDataNeeds,
              requiredDataTypes: data.dataRequirementsResearch.requiredDataTypes,
              researchQueries: data.dataRequirementsResearch.researchQueries
            },
            mockData: data.dataRequirementsResearch.mockData,
            userDataInstructions: data.dataRequirementsResearch.userInstructions
          }
        };
        
        try {
          const { saveLogicResultToDB } = await import('../../ui/db-utils');
          await saveLogicResultToDB(updatedBrainstorm);
          setSelectedBrainstorm(updatedBrainstorm);
          await loadSavedBrainstorms();
          
          toast.success('✅ Research re-run complete and saved!');
        } catch (dbError) {
          console.error('❌ Failed to save re-run research data to IndexedDB:', dbError);
          toast.error('Research completed but failed to save to local database');
        }
      } else {
        toast.success('✅ Research re-run complete!');
      }

    } catch (error) {
      console.error('Research re-run error:', error);
      toast.error(error instanceof Error ? error.message : 'Research re-run failed');
    } finally {
      setIsLoading(false);
    }
  };

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
                {savedBrainstorms.map((brainstorm) => (
                  <SelectItem key={brainstorm.id} value={brainstorm.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{brainstorm.brainstormData.coreConcept || brainstorm.brainstormData.coreWConcept || 'Unnamed Tool'}</span>
                      <div className="flex items-center gap-2 ml-2">
                        {brainstorm.brainstormData.dataRequirements ? (
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
                          {new Date(brainstorm.timestamp).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Brainstorm Info */}
          {selectedBrainstorm && (
            <Card className="border-muted">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      {selectedBrainstorm.brainstormData.coreConcept || selectedBrainstorm.brainstormData.coreWConcept}
                    </h4>
                    {getStatusBadge()}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedBrainstorm.brainstormData.valueProposition?.substring(0, 150)}...
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Tool Type: {selectedBrainstorm.brainstormData.promptOptions?.toolComplexity || 'Unknown'}</span>
                    <span>Calculations: {selectedBrainstorm.brainstormData.keyCalculations?.length || 0}</span>
                    <span>Inputs: {selectedBrainstorm.brainstormData.suggestedInputs?.length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
            <Label>AI Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4O (Recommended)</SelectItem>
                <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4O Mini</SelectItem>
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
                    <RefreshCw className="h-4 w-4" />
                    Re-run Research
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
                <Badge variant={researchResults.hasExternalDataNeeds ? "destructive" : "secondary"}>
                  {researchResults.hasExternalDataNeeds ? 'Requires External Data' : 'Self-Contained Tool'}
                </Badge>
                {researchResults.requiredDataTypes.length > 0 && (
                  <Badge variant="outline">
                    {researchResults.requiredDataTypes.length} Data Types
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {researchResults.userInstructions.summary}
              </p>
            </div>

            <Separator />

            {/* Research Queries */}
            {researchResults.researchQueries.length > 0 && (
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
                            {query.domain}
                          </Badge>
                          <Badge variant={query.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                            {query.priority}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-100">{query.query}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs bg-slate-700 text-slate-200 border-slate-500">
                            {query.dataType}
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

            {/* Generated Research Data */}
            {Object.keys(researchResults.mockData).length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Generated Research Data ({Object.keys(researchResults.mockData).length} categories)
                </h4>
                <ScrollArea className="h-40">
                  <div className="space-y-3">
                    {Object.entries(researchResults.mockData).map(([category, data]) => (
                      <div key={category} className="p-3 bg-slate-800 text-slate-100 rounded border border-slate-600">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-200 border-slate-500">
                            {category}
                          </Badge>
                          <span className="text-xs text-slate-300">
                            {typeof data === 'object' ? Object.keys(data).length : 1} items
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
              {researchResults.userInstructions.dataNeeded.length > 0 && (
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
                <p className="text-sm text-muted-foreground">{researchResults.userInstructions.format}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DataRequirementsResearch;
