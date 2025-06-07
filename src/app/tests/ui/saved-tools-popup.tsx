'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Package, Trash2, Calendar, Clock, AlertTriangle, Cloud, Check, Download, RefreshCw } from 'lucide-react';
import { SavedTool } from './types';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { Button } from '@/components/ui/button';
import { useAuth } from '@clerk/nextjs';

interface SavedToolsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  savedTools: SavedTool[];
  onLoadTool: (tool: ProductToolDefinition) => void;
  onDeleteTool: (toolId: string) => void;
  isDarkMode: boolean;
}

export const SavedToolsPopup: React.FC<SavedToolsPopupProps> = ({
  isOpen,
  onClose,
  savedTools,
  onLoadTool,
  onDeleteTool,
  isDarkMode
}) => {
  const { isLoaded, isSignedIn } = useAuth();
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [cloudSavingToolId, setCloudSavingToolId] = useState<string | null>(null);
  const [cloudSavedTools, setCloudSavedTools] = useState<Set<string>>(new Set());
  
  // Cloud loading state
  const [cloudTools, setCloudTools] = useState<ProductToolDefinition[]>([]);
  const [loadingCloudTools, setLoadingCloudTools] = useState(false);
  const [cloudLoadError, setCloudLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local');
  const [hasLoadedCloudTools, setHasLoadedCloudTools] = useState(false);



  const loadCloudTools = useCallback(async () => {
    // Don't load if auth isn't ready or user isn't signed in
    if (!isLoaded || !isSignedIn) {
      console.log('[0] Auth not ready or user not signed in, skipping cloud tools load');
      return;
    }
    
    console.log('[1] Starting to load cloud tools...');
    setLoadingCloudTools(true);
    setCloudLoadError(null);
    
    try {
      console.log('[2] Calling fetch for /api/product-tools/list...');
      
      // Add a small delay to ensure auth is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch('/api/product-tools/list', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add credentials to ensure cookies are sent
        credentials: 'same-origin',
      });
      console.log('[3] Fetch response received:', response.status, response.statusText);

      if (!response.ok) {
        console.error('[4a] Response was not OK. Reading error data...');
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('[4a-1] Failed to parse error response as JSON:', parseError);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        throw new Error(errorData.error || `Failed to load tools from cloud (${response.status})`);
      }

      console.log('[4b] Response was OK. Reading data...');
      const data = await response.json();
      console.log('[5] Data received:', data);
      setCloudTools(data.tools || []);
      setHasLoadedCloudTools(true);
    } catch (error) {
      console.error('[6] Error caught in loadCloudTools:', error);
      setCloudLoadError(error instanceof Error ? error.message : 'Failed to load cloud tools');
    } finally {
      console.log('[7] Finally block reached. Stopping spinner.');
      setLoadingCloudTools(false);
    }
  }, [isLoaded, isSignedIn]);

    // Load cloud tools when popup opens or when switching to cloud tab
  useEffect(() => {
    if (isOpen && activeTab === 'cloud' && !hasLoadedCloudTools) {
      loadCloudTools();
    }
  }, [isOpen, activeTab, hasLoadedCloudTools, loadCloudTools]);

  const refreshCloudTools = () => {
    setHasLoadedCloudTools(false);
  };

  if (!isOpen) return null;

  const handleLoadTool = (tool: ProductToolDefinition) => {
    onLoadTool(tool);
    // Don't close the popup - let user load multiple tools or manually close
  };

  const handleDeleteConfirm = async (toolId: string) => {
    setDeletingToolId(toolId);
    try {
      await onDeleteTool(toolId);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete tool:', error);
    } finally {
      setDeletingToolId(null);
    }
  };

  const handleSaveToCloud = async (tool: ProductToolDefinition) => {
    setCloudSavingToolId(tool.id);
    try {
      const response = await fetch('/api/product-tools/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: tool
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save to cloud');
      }

      const result = await response.json();
      console.log('Tool saved to cloud:', result);
      
      // Mark this tool as saved to cloud
      setCloudSavedTools(prev => new Set([...prev, tool.id]));
      
      // If we're on cloud tab, refresh the list
      if (activeTab === 'cloud') {
        refreshCloudTools();
      }
      
    } catch (error) {
      console.error('Error saving tool to cloud:', error);
      alert('Failed to save tool to cloud. Please try again.');
    } finally {
      setCloudSavingToolId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderToolCard = (tool: ProductToolDefinition, source: 'local' | 'cloud', savedTool?: SavedTool) => {
    const isLocalTool = source === 'local' && savedTool;
    
    return (
      <div
        key={tool.id}
        className={`
          ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-650' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}
          border rounded-lg p-4 transition-colors
        `}
      >
        {/* Tool Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">
                {tool.metadata?.title || 'Untitled Tool'}
              </h3>
              {source === 'cloud' && (
                <Cloud className="h-4 w-4 text-blue-500 flex-shrink-0" />
              )}
            </div>
            <div className={`
              ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}
              text-sm flex items-center gap-4
            `}>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(isLocalTool ? savedTool.timestamp : (tool.updatedAt || tool.createdAt || Date.now()))}
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {tool.metadata?.type || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Tool Description */}
        <p className={`
          ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}
          text-sm mb-4 line-clamp-2
        `}>
          {tool.metadata?.shortDescription || tool.metadata?.description || 'No description available.'}
        </p>

        {/* Tool Details */}
        <div className="mb-4">
          <div className={`
            ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}
            text-xs flex items-center gap-4
          `}>
            <span>Industry: {tool.metadata?.industry || 'N/A'}</span>
            <span>Audience: {tool.metadata?.targetAudience || 'N/A'}</span>
          </div>
          {(tool.metadata?.features?.length || 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tool.metadata.features.slice(0, 3).map((feature, index) => (
                <span
                  key={index}
                  className={`
                    ${isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'}
                    px-2 py-1 rounded text-xs
                  `}
                >
                  {feature}
                </span>
              ))}
              {tool.metadata.features.length > 3 && (
                <span className={`
                  ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}
                  text-xs px-2 py-1
                `}>
                  +{tool.metadata.features.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLoadTool(tool)}
            className={`
              ${isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }
              flex-1 px-3 py-2 rounded text-sm font-medium transition-colors
              flex items-center justify-center gap-2
            `}
          >
            {source === 'cloud' ? (
              <Download className="h-4 w-4" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            Load Tool
          </button>
          
          {/* Show save to cloud button only for local tools */}
          {source === 'local' && (
            <button
              onClick={() => handleSaveToCloud(tool)}
              disabled={cloudSavingToolId === tool.id}
              className={`
                ${cloudSavedTools.has(tool.id)
                  ? isDarkMode 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                  : isDarkMode 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }
                px-3 py-2 rounded text-sm font-medium transition-colors
                flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {cloudSavingToolId === tool.id ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : cloudSavedTools.has(tool.id) ? (
                <Check className="h-4 w-4" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
            </button>
          )}
          
          {/* Show delete button only for local tools */}
          {source === 'local' && savedTool && (
            <button
              onClick={() => setShowDeleteConfirm(savedTool.id)}
              disabled={deletingToolId === savedTool.id}
              className={`
                ${isDarkMode 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
                }
                px-3 py-2 rounded text-sm font-medium transition-colors
                flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {deletingToolId === savedTool.id ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Delete Confirmation */}
        {source === 'local' && savedTool && showDeleteConfirm === savedTool.id && (
          <div className={`
            ${isDarkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200'}
            border rounded-lg mt-3 p-3
          `}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className={`
                ${isDarkMode ? 'text-red-200' : 'text-red-800'}
                text-sm font-medium
              `}>
                Delete this tool?
              </span>
            </div>
            <p className={`
              ${isDarkMode ? 'text-red-300' : 'text-red-700'}
              text-xs mb-3
            `}>
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteConfirm(savedTool.id)}
                disabled={deletingToolId === savedTool.id}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className={`
                  ${isDarkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}
                  px-3 py-1 rounded text-xs font-medium
                `}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed right-4 top-4 bottom-4 w-96 z-50">
      <div className={`
        ${isDarkMode ? 'bg-gray-800 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-200'}
        border rounded-lg shadow-xl h-full overflow-hidden flex flex-col
      `}>
        {/* Header */}
        <div className={`
          ${isDarkMode ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200'}
          border-b px-6 py-4 flex items-center justify-between
        `}>
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Saved Tools</h2>
            <span className={`
              ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}
              px-2 py-1 rounded-full text-sm
            `}>
              {activeTab === 'local' ? savedTools.length : cloudTools.length} tools
            </span>
          </div>
          <Button
            onClick={onClose}
            className={`
              ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}
              p-2 rounded-lg transition-colors
            `}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className={`
          ${isDarkMode ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200'}
          border-b px-6 py-2 flex gap-2
        `}>
          <Button
            onClick={() => setActiveTab('local')}
            className={`
              ${activeTab === 'local'
                ? isDarkMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-500 text-white'
                : isDarkMode 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }
              px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2
            `}
          >
            <Package className="h-4 w-4" />
            Local Tools ({savedTools.length})
          </Button>
          <Button
            onClick={() => setActiveTab('cloud')}
            className={`
              ${activeTab === 'cloud'
                ? isDarkMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-500 text-white'
                : isDarkMode 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }
              px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2
            `}
          >
            <Cloud className="h-4 w-4" />
            Cloud Tools ({cloudTools.length})
          </Button>
          {activeTab === 'cloud' && (
            <Button
              onClick={refreshCloudTools}
              disabled={loadingCloudTools}
              className={`
                ${isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }
                px-3 py-2 rounded text-sm font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <RefreshCw className={`h-4 w-4 ${loadingCloudTools ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'local' ? (
            // Local Tools Tab
            savedTools.length === 0 ? (
              <div className={`
                ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}
                text-center py-12
              `}>
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No saved tools yet</p>
                <p className="text-sm">Create and save tools to see them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {savedTools.map((savedTool) => 
                  renderToolCard(savedTool.tool, 'local', savedTool)
                )}
              </div>
            )
          ) : (
            // Cloud Tools Tab
            loadingCloudTools ? (
              <div className={`
                ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}
                text-center py-12
              `}>
                <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin opacity-50" />
                <p className="text-lg mb-2">Loading cloud tools...</p>
                <p className="text-sm">Fetching tools from database</p>
              </div>
            ) : cloudLoadError ? (
              <div className={`
                ${isDarkMode ? 'text-red-400' : 'text-red-500'}
                text-center py-12
              `}>
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Failed to load cloud tools</p>
                <p className="text-sm mb-4">{cloudLoadError}</p>
                <Button
                  onClick={refreshCloudTools}
                  className={`
                    ${isDarkMode 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }
                    px-4 py-2 rounded text-sm font-medium transition-colors
                  `}
                >
                  Try Again
                </Button>
              </div>
            ) : cloudTools.length === 0 ? (
              <div className={`
                ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}
                text-center py-12
              `}>
                <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No cloud tools found</p>
                <p className="text-sm">Save tools to the cloud to see them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {cloudTools.map((tool) => 
                  renderToolCard(tool, 'cloud')
                )}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className={`
          ${isDarkMode ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200'}
          border-t px-6 py-4 flex items-center justify-between
        `}>
          <div className={`
            ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}
            text-sm
          `}>
            {activeTab === 'local' 
              ? 'Load tools to preview, save to cloud database, or delete.'
              : 'Load tools from cloud database. Tools are synced across devices.'
            }
          </div>
          <button
            onClick={onClose}
            className={`
              ${isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }
              px-4 py-2 rounded text-sm font-medium transition-colors
            `}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}; 