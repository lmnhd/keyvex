'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from 'lucide-react';
import BrainstormGenerator from './components/BrainstormGenerator';
import ToolTester from './components/ToolTester';
import { SavedLogicResult } from '@/app/tests/ui/types'; // Corrected import path using @ alias

const ToolGenerationWorkbenchPage = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("brainstorm");
  // Flag to trigger refresh in ToolTester when a new brainstorm is made
  const [newBrainstormFlag, setNewBrainstormFlag] = useState(0);

  useEffect(() => {
    // Basic dark mode detection, can be enhanced
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleBrainstormGenerated = (result: SavedLogicResult) => {
    console.log('New brainstorm generated in workbench:', result.id);
    setNewBrainstormFlag(prev => prev + 1); // Increment flag to trigger refresh
    // setActiveTab("tester"); // This line was causing the tab switch and is now removed/commented
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-background text-foreground' : ''}`}>
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Tool Generation Workbench</h1>
          <Button variant="outline" size="icon" onClick={toggleDarkMode} aria-label="Toggle dark mode">
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" /> }
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-1/2 lg:w-1/3 mb-6">
            <TabsTrigger value="brainstorm">1. Generate Brainstorm</TabsTrigger>
            <TabsTrigger value="tester">2. Test Tool Creation</TabsTrigger>
          </TabsList>
          <TabsContent value="brainstorm">
            <BrainstormGenerator onBrainstormGenerated={handleBrainstormGenerated} />
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