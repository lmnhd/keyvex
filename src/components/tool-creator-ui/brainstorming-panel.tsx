'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Loader2, 
  Brain, 
  CheckCircle 
} from 'lucide-react';

interface BrainstormingThought {
  type: 'partial' | 'complete' | 'error';
  data: any;
  timestamp: number;
  message?: string;
}

interface BrainstormingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isBrainstorming: boolean;
  brainstormingThoughts: BrainstormingThought[];
  isDarkMode?: boolean;
}

export function BrainstormingPanel({
  isOpen,
  onClose,
  isBrainstorming,
  brainstormingThoughts,
  isDarkMode = false
}: BrainstormingPanelProps) {
  if (!isOpen) return null;

  return (
    <div className={`fixed top-4 right-4 w-80 max-h-96 rounded-xl shadow-2xl border z-50 ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-600' 
        : 'bg-white border-gray-300'
    }`}>
      <div className={`flex items-center justify-between p-4 border-b ${
        isDarkMode ? 'border-gray-600' : 'border-gray-200'
      }`}>
        <h3 className={`text-lg font-semibold ${
          isDarkMode ? 'text-gray-50' : 'text-gray-900'
        }`}>
          🧠 Logic Architect
        </h3>
        <button
          onClick={onClose}
          className={`p-1 rounded hover:bg-gray-100 ${
            isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
          }`}
          aria-label="Close brainstorming panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto max-h-80">
        {isBrainstorming && (
          <div className={`mb-4 text-center ${
            isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
          }`}>
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm font-medium">Brainstorming ideas...</p>
          </div>
        )}
        
        {brainstormingThoughts.length === 0 && !isBrainstorming ? (
          <div className={`text-center ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No brainstorming session yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {brainstormingThoughts.map((thought, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  thought.type === 'error' 
                    ? isDarkMode 
                      ? 'border-red-600 bg-red-900/20' 
                      : 'border-red-300 bg-red-50'
                    : thought.type === 'complete'
                    ? isDarkMode 
                      ? 'border-green-600 bg-green-900/20' 
                      : 'border-green-300 bg-green-50'
                    : isDarkMode 
                      ? 'border-gray-600 bg-gray-700/30' 
                      : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-1">
                    {thought.type === 'error' ? (
                      <X className="h-4 w-4 text-red-500" />
                    ) : thought.type === 'complete' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      {thought.type === 'error' && thought.message 
                        ? thought.message 
                        : typeof thought.data === 'string' 
                          ? thought.data 
                          : JSON.stringify(thought.data, null, 2)
                      }
                    </p>
                    <p className={`text-xs mt-1 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {new Date(thought.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
