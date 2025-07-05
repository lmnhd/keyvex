'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Edit3, RotateCcw } from 'lucide-react';
import { ToolState } from '../types/debug-types';

interface StateInspectorProps {
  currentState: ToolState;
  onStateEdit?: (variable: string, newValue: any) => void;
  readOnly?: boolean;
  className?: string;
}

export default function StateInspector({
  currentState,
  onStateEdit,
  readOnly = true,
  className = '',
}: StateInspectorProps) {
  const [editingVariable, setEditingVariable] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showSystemVars, setShowSystemVars] = useState(false);

  // Format time elapsed since last change
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Get type color for badges
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'bg-green-100 text-green-800';
      case 'number': return 'bg-blue-100 text-blue-800';
      case 'boolean': return 'bg-purple-100 text-purple-800';
      case 'object': return 'bg-orange-100 text-orange-800';
      case 'function': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format value for display
  const formatValue = (value: any, type: string) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    switch (type) {
      case 'string':
        return `"${value}"`;
      case 'object':
        if (Array.isArray(value)) {
          return `[${value.length} items]`;
        }
        return `{${Object.keys(value).length} props}`;
      case 'function':
        return 'ƒ()';
      default:
        return String(value);
    }
  };

  // Start editing a variable
  const startEdit = (variableName: string, currentValue: any) => {
    setEditingVariable(variableName);
    setEditValue(typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue));
  };

  // Save edited value
  const saveEdit = () => {
    if (editingVariable && onStateEdit) {
      try {
        // Try to parse as JSON for complex types
        let newValue;
        try {
          newValue = JSON.parse(editValue);
        } catch {
          // If JSON parsing fails, treat as string
          newValue = editValue;
        }
        
        onStateEdit(editingVariable, newValue);
        setEditingVariable(null);
        setEditValue('');
      } catch (error) {
        console.error('Failed to update state:', error);
      }
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingVariable(null);
    setEditValue('');
  };

  // Filter variables (hide system/internal variables by default)
  const isSystemVariable = (name: string) => {
    return name.startsWith('_') || name.startsWith('$') || name.includes('Symbol');
  };

  const filteredVariables = Object.entries(currentState.variables).filter(([name]) => 
    showSystemVars || !isSystemVariable(name)
  );

  const systemVariableCount = Object.keys(currentState.variables).length - filteredVariables.length;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">State Inspector</h3>
          <Badge variant="outline" className="text-xs">
            {filteredVariables.length} variables
          </Badge>
          {systemVariableCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{systemVariableCount} system
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {systemVariableCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSystemVars(!showSystemVars)}
              className="text-xs h-7"
            >
              {showSystemVars ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showSystemVars ? 'Hide' : 'Show'} System
            </Button>
          )}
        </div>
      </div>

      {/* Performance Summary */}
      <Card className="bg-gray-50 dark:bg-gray-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium">Performance Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Events:</span>
              <span className="ml-2 font-mono">{currentState.performance.eventCount}</span>
            </div>
            <div>
              <span className="text-gray-500">Renders:</span>
              <span className="ml-2 font-mono">{currentState.performance.renderCount}</span>
            </div>
            <div>
              <span className="text-gray-500">Errors:</span>
              <span className="ml-2 font-mono text-red-600">{currentState.performance.errorCount}</span>
            </div>
            <div>
              <span className="text-gray-500">Warnings:</span>
              <span className="ml-2 font-mono text-yellow-600">{currentState.performance.warningCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variables List */}
      <div className="space-y-2">
        {filteredVariables.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {Object.keys(currentState.variables).length === 0 
              ? 'No state variables detected yet.' 
              : 'No user variables. Toggle "Show System" to see internal variables.'
            }
          </div>
        ) : (
          filteredVariables.map(([variableName, variableInfo]) => (
            <Card key={variableName} className="bg-white dark:bg-gray-800 border">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Variable name and type */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium text-blue-600">
                        {variableName}
                      </span>
                      <Badge className={`text-xs ${getTypeColor(variableInfo.type)}`}>
                        {variableInfo.type}
                      </Badge>
                      {variableInfo.changeCount > 1 && (
                        <Badge variant="outline" className="text-xs">
                          {variableInfo.changeCount} changes
                        </Badge>
                      )}
                    </div>
                    
                    {/* Value display/editing */}
                    {editingVariable === variableName ? (
                      <div className="space-y-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="font-mono text-sm"
                          placeholder="Enter new value..."
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} className="text-xs h-6">
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} className="text-xs h-6">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="font-mono text-sm bg-gray-50 dark:bg-gray-900 p-2 rounded border">
                        <span className="break-all">
                          {formatValue(variableInfo.value, variableInfo.type)}
                        </span>
                      </div>
                    )}
                    
                    {/* Metadata */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Last changed: {formatTimeAgo(variableInfo.lastChanged)}</span>
                      {variableInfo.changeCount > 1 && (
                        <span>{variableInfo.changeCount} total changes</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  {!readOnly && onStateEdit && editingVariable !== variableName && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(variableName, variableInfo.value)}
                      className="text-xs h-6 w-6 p-0"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                {/* Detailed object/array view */}
                {variableInfo.type === 'object' && variableInfo.value && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      View object details
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto border">
                      {JSON.stringify(variableInfo.value, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Errors */}
      {currentState.errors.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-red-800 dark:text-red-200">
              Recent Errors ({currentState.errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {currentState.errors.slice(-3).map((error, index) => (
                <div key={error.id} className="text-xs p-2 bg-red-100 dark:bg-red-900/30 rounded border border-red-200">
                  <div className="font-medium text-red-800 dark:text-red-200">
                    {error.message}
                  </div>
                  <div className="text-red-600 dark:text-red-300 mt-1">
                    {formatTimeAgo(error.timestamp)}
                  </div>
                </div>
              ))}
              {currentState.errors.length > 3 && (
                <div className="text-xs text-red-600 dark:text-red-300">
                  +{currentState.errors.length - 3} more errors in event log
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
