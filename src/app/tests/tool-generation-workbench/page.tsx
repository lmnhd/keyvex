'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Download, Database } from 'lucide-react';
import BrainstormGenerator from './components/BrainstormGenerator';
import DataRequirementsResearch from './components/DataRequirementsResearch';
import ToolTester from './components/ToolTester';
import { BrainstormResult } from './types/unified-brainstorm-types';

const ToolGenerationWorkbenchPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("brainstorm");
  // Flag to trigger refresh in ToolTester when a new brainstorm is made
  const [newBrainstormFlag, setNewBrainstormFlag] = useState(0);
  
  // State for TCC snapshot availability (to avoid hydration mismatch)
  const [hasTccSnapshotState, setHasTccSnapshotState] = useState(false);

  // TCC Load functionality - constants and functions similar to ToolTester
  const TCC_SNAPSHOT_KEY = 'debug_tcc_snapshot';

  const handleLoadTccSnapshot = useCallback(() => {
    try {
      const savedTcc = localStorage.getItem(TCC_SNAPSHOT_KEY);
      if (savedTcc) {
        const parsedTcc = JSON.parse(savedTcc);
        console.log('✅ TCC snapshot loaded from localStorage:', parsedTcc);
        // Switch to the tester tab to show the loaded TCC
        setActiveTab("tester");
        // Show a success message
        alert('TCC snapshot loaded! Switched to Tool Tester tab to view the data.');
        // Note: The actual TCC data loading will be handled by the ToolTester component
        // when it detects the localStorage data
      } else {
        alert('No TCC snapshot found in localStorage. Run a tool generation process first to create TCC data.');
      }
    } catch (error) {
      console.error('Failed to load TCC snapshot:', error);
      alert('Failed to load TCC snapshot. Check console for details.');
    }
  }, []);

  // Check if TCC snapshot exists (client-side only)
  const checkTccSnapshot = useCallback(() => {
    try {
      const savedTcc = localStorage.getItem(TCC_SNAPSHOT_KEY);
      return !!savedTcc;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    // Basic dark mode detection, can be enhanced
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    // Check TCC snapshot availability after mounting (client-side only)
    setHasTccSnapshotState(checkTccSnapshot());
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Update TCC snapshot state when tab changes to ensure it's current
  useEffect(() => {
    if (activeTab === "tester") {
      setHasTccSnapshotState(checkTccSnapshot());
    }
  }, [activeTab, checkTccSnapshot]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleBrainstormGenerated = (result: BrainstormResult) => {
    console.log('New brainstorm generated in workbench:', result.id);
    setNewBrainstormFlag(prev => prev + 1); // Increment flag to trigger refresh
    // setActiveTab("tester"); // This line was causing the tab switch and is now removed/commented
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-background text-foreground' : ''}`}>
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Tool Generation Workbench</h1>
          <div className="flex items-center gap-3">
            {/* Persistent Load Last TCC Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLoadTccSnapshot}
              disabled={!hasTccSnapshotState}
              className="flex items-center gap-2"
              title={hasTccSnapshotState ? "Load saved TCC snapshot for agent testing" : "No TCC snapshot available - run a tool generation first"}
            >
              <Database className="h-4 w-4" />
              Load Last TCC
            </Button>
            
            {/* Dark Mode Toggle */}
            <Button variant="outline" size="icon" onClick={toggleDarkMode} aria-label="Toggle dark mode">
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" /> }
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-2/3 lg:w-1/2 mb-6">
            <TabsTrigger value="brainstorm">1. Generate Brainstorm</TabsTrigger>
            <TabsTrigger value="research">2. Research & Data</TabsTrigger>
            <TabsTrigger value="tester">3. Test Tool Creation</TabsTrigger>
          </TabsList>
          <TabsContent value="brainstorm">
            <BrainstormGenerator onBrainstormGenerated={handleBrainstormGenerated} />
          </TabsContent>
          <TabsContent value="research">
            <DataRequirementsResearch isDarkMode={isDarkMode} newBrainstormFlag={newBrainstormFlag} />
          </TabsContent>
          <TabsContent value="tester">
            <ToolTester isDarkMode={isDarkMode} newBrainstormFlag={newBrainstormFlag} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ToolGenerationWorkbenchPage;