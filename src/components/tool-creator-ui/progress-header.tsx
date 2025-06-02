'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Settings, 
  ChevronDown, 
  Sun, 
  Moon, 
  RotateCcw 
} from 'lucide-react';

interface ProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
  useMockData: boolean;
  isDarkMode: boolean;
  onToggleMockData: () => void;
  onToggleDarkMode: () => void;
  onReset: () => void;
  className?: string;
}

export function ProgressHeader({
  currentStep,
  totalSteps,
  useMockData,
  isDarkMode,
  onToggleMockData,
  onToggleDarkMode,
  onReset,
  className = ''
}: ProgressHeaderProps) {
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className={`border-b px-6 py-3 flex-shrink-0 ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    } ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-blue-600" />
          <span className={`font-medium ${isDarkMode ? 'text-gray-50' : 'text-gray-900'}`}>
            Tool Creator
          </span>
          <Badge variant="outline" className={`text-xs ${
            isDarkMode ? 'border-gray-600 text-gray-300' : ''
          }`}>
            {useMockData ? 'Mock Mode' : 'AI Mode'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className={`text-xs border-2 rounded-lg ${
                isDarkMode 
                  ? 'border-gray-600 bg-gray-700 text-gray-50 hover:bg-gray-600 shadow-sm' 
                  : 'border-gray-400 bg-gray-100 text-gray-800 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <Settings className="h-3 w-3 mr-1" />
              Options
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
            
            {showOptionsMenu && (
              <div className={`absolute right-0 top-full mt-2 w-52 rounded-xl shadow-xl border z-50 ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-600 shadow-black/20' 
                  : 'bg-white border-gray-300 shadow-lg'
              }`}>
                <div className="py-2">
                  <button
                    onClick={() => {
                      onToggleDarkMode();
                      setShowOptionsMenu(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                      isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                    }`}
                  >
                    {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  </button>
                  <button
                    onClick={() => {
                      onToggleMockData();
                      setShowOptionsMenu(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                      isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                    }`}
                  >
                    <Brain className="h-4 w-4" />
                    {useMockData ? 'Switch to Real AI' : 'Switch to Mock Mode'}
                  </button>
                  <div className={`border-t my-2 mx-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
                  <button
                    onClick={() => {
                      onReset();
                      setShowOptionsMenu(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                      isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                    }`}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Workflow
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Progress value={progressPercentage} className="flex-1 h-2" />
        <span className={`text-xs font-medium min-w-fit ${
          isDarkMode ? 'text-gray-50' : 'text-gray-500'
        }`}>
          Step {currentStep}/{totalSteps}
        </span>
      </div>
    </div>
  );
} 