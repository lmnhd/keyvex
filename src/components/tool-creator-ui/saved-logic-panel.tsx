'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { X, History, Trash2 } from 'lucide-react';

interface SavedLogicResult {
  id: string;
  timestamp: number;
  date: string;
  toolType: string;
  targetAudience: string;
  industry?: string;
  result: any;
}

interface SavedLogicPanelProps {
  isOpen: boolean;
  onClose: () => void;
  savedLogicResults: SavedLogicResult[];
  onLoadResult: (result: SavedLogicResult) => void;
  onDeleteResult?: (resultId: string) => void;
  isDarkMode?: boolean;
}

export function SavedLogicPanel({
  isOpen,
  onClose,
  savedLogicResults,
  onLoadResult,
  onDeleteResult,
  isDarkMode = false
}: SavedLogicPanelProps) {
  if (!isOpen) return null;

  const handleDelete = (e: React.MouseEvent, resultId: string) => {
    e.stopPropagation(); // Prevent triggering the load action
    if (onDeleteResult && confirm('Are you sure you want to delete this brainstorm? This action cannot be undone.')) {
      onDeleteResult(resultId);
    }
  };

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
          💾 Saved Logic Results
        </h3>
        <button
          onClick={onClose}
          className={`p-1 rounded hover:bg-gray-100 ${
            isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
          }`}
          aria-label="Close saved logic results panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="p-4 max-h-80 overflow-y-auto">
        {savedLogicResults.length === 0 ? (
          <div className={`text-center ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No saved logic results yet</p>
            <p className="text-xs mt-1">Test the Logic Architect to see results here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedLogicResults.map((result) => (
              <div
                key={result.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  isDarkMode 
                    ? 'border-gray-600 bg-gray-700/30 hover:bg-gray-700/50' 
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => onLoadResult(result)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      {result.toolType} for {result.targetAudience}
                    </h4>
                    {result.industry && (
                      <p className={`text-xs ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Industry: {result.industry}
                      </p>
                    )}
                    <p className={`text-xs ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {result.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Load
                    </Badge>
                    {onDeleteResult && (
                      <button
                        onClick={(e) => handleDelete(e, result.id)}
                        className={`p-1 rounded-md transition-colors ${
                          isDarkMode 
                            ? 'hover:bg-red-600/20 text-red-400 hover:text-red-300' 
                            : 'hover:bg-red-50 text-red-500 hover:text-red-600'
                        }`}
                        title="Delete this brainstorm"
                        aria-label="Delete brainstorm"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
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
