'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { X, Calculator } from 'lucide-react';
import { ProductToolDefinition } from '@/lib/types/product-tool';

interface SavedTool {
  id: string;
  timestamp: number;
  date: string;
  title: string;
  tool: ProductToolDefinition;
}

interface SavedToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  savedTools: SavedTool[];
  onLoadTool: (savedTool: SavedTool) => void;
  isDarkMode?: boolean;
}

export function SavedToolsPanel({
  isOpen,
  onClose,
  savedTools,
  onLoadTool,
  isDarkMode = false
}: SavedToolsPanelProps) {
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
          🛠️ Saved Tools
        </h3>
        <button
          onClick={onClose}
          className={`p-1 rounded hover:bg-gray-100 ${
            isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
          }`}
          aria-label="Close saved tools panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto max-h-80">
        {savedTools.length === 0 ? (
          <div className={`text-center ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No saved tools yet</p>
            <p className="text-xs mt-1">Create tools to see them saved here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedTools.map((savedTool) => (
              <div
                key={savedTool.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  isDarkMode 
                    ? 'border-gray-600 bg-gray-700/30 hover:bg-gray-700/50' 
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => onLoadTool(savedTool)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      {savedTool.title}
                    </h4>
                    <p className={`text-xs ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {savedTool.tool.metadata.description?.slice(0, 60)}...
                    </p>
                    <p className={`text-xs ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {savedTool.date}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Load
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 