'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Database, Search, MapPin, Save } from 'lucide-react';
import { BrainstormResult } from '../types/unified-brainstorm-types';
import { loadLogicResultsFromDB } from '@/app/tests/ui/db-utils';
import { toast } from 'sonner';

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
  const [userLocation, setUserLocation] = useState({
    state: 'California',
    country: 'United States',
    zipCode: ''
  });
  const [selectedModel, setSelectedModel] = useState('gpt-4o');

  useEffect(() => {
    loadSavedBrainstorms();
  }, [newBrainstormFlag]);

  const loadSavedBrainstorms = async () => {
    try {
      const brainstorms = await loadLogicResultsFromDB();
      setSavedBrainstorms(brainstorms);
    } catch (error) {
      console.error('Error loading brainstorms:', error);
      toast.error('Failed to load saved brainstorms');
    }
  };

  const handleRunResearch = async (persistToDatabase: boolean = false) => {
    if (!selectedBrainstorm) {
      toast.error('Please select a brainstorm first');
      return;
    }

    setIsLoading(true);
    toast.success(`${persistToDatabase ? 'Running research and saving to database...' : 'Running research preview...'}`);
    
    try {
      const response = await fetch('/api/ai/data-requirements-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brainstormData: selectedBrainstorm.brainstormData,
          brainstormId: persistToDatabase ? selectedBrainstorm.id : undefined,
          selectedModel,
          userLocation,
          persistToBrainstorm: persistToDatabase,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Research analysis failed');
      }

      if (persistToDatabase && data.wasPersistedToDB) {
        toast.success('✅ Research results saved to brainstorm database!');
        await loadSavedBrainstorms();
      } else {
        toast.success('✅ Research analysis complete!');
      }

      console.log('Research Results:', data.dataRequirementsResearch);

    } catch (error) {
      console.error('Research analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Research analysis failed');
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
            Analyze brainstorm data to identify external data needs, conduct research, and generate mock data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
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
                        {brainstorm.brainstormData.dataRequirements && (
                          <Badge variant="secondary" className="text-xs">
                            <Database className="h-3 w-3 mr-1" />
                            Has Research
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

          {selectedBrainstorm && (
            <Card className="border-muted">
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <h4 className="font-medium">
                    {selectedBrainstorm.brainstormData.coreConcept || selectedBrainstorm.brainstormData.coreWConcept}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedBrainstorm.brainstormData.valueProposition?.substring(0, 100)}...
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

          <div className="flex gap-3">
            <Button 
              onClick={() => handleRunResearch(false)}
              disabled={!selectedBrainstorm || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {isLoading ? 'Analyzing...' : 'Preview Research'}
            </Button>
            <Button 
              onClick={() => handleRunResearch(true)}
              disabled={!selectedBrainstorm || isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Research & Save to Database
            </Button>
          </div>
          
          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-sm">Running AI research analysis... This may take 30-60 seconds.</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataRequirementsResearch;
