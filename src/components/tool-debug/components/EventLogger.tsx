'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Trash2, Download, Search, Filter, ArrowUpDown } from 'lucide-react';
import { DebugEvent, DebugEventType, DebugSeverity } from '../types/debug-types';

interface EventLoggerProps {
  events: DebugEvent[];
  onClear: () => void;
  onExport?: () => void;
  maxHeight?: string;
  showFilters?: boolean;
  className?: string;
}

export default function EventLogger({
  events,
  onClear,
  onExport,
  maxHeight = '400px',
  showFilters = true,
  className = '',
}: EventLoggerProps) {
  const [searchText, setSearchText] = useState('');
  const [filterTypes, setFilterTypes] = useState<Set<DebugEventType>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<Set<DebugSeverity>>(new Set());
  const [newestFirst, setNewestFirst] = useState(true); // Default to newest first

  // Filter and sort events based on search, filters, and sort order
  const filteredEvents = events.filter(event => {
    // Search text filter
    if (searchText && !event.message.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    
    // Event type filter
    if (filterTypes.size > 0 && !filterTypes.has(event.type)) {
      return false;
    }
    
    // Severity filter
    if (filterSeverity.size > 0 && !filterSeverity.has(event.severity)) {
      return false;
    }
    
    return true;
  }).sort((a, b) => {
    // Sort by timestamp based on newestFirst preference
    return newestFirst ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
  });

  // Get severity icon and color
  const getSeverityDisplay = (severity: DebugSeverity) => {
    switch (severity) {
      case 'error':
        return { icon: '❌', color: 'bg-red-800 text-white border-red-600' };
      case 'warning':
        return { icon: '⚠️', color: 'bg-yellow-800 text-white border-yellow-600' };
      case 'success':
        return { icon: '✅', color: 'bg-green-800 text-white border-green-600' };
      default:
        return { icon: 'ℹ️', color: 'bg-blue-800 text-white border-blue-600' };
    }
  };

  // Get event type icon
  const getEventTypeIcon = (type: DebugEventType) => {
    switch (type) {
      case 'click': return '🖱️';
      case 'input_change': return '📝';
      case 'state_change': return '🔄';
      case 'function_call': return '⚙️';
      case 'error': return '💥';
      case 'render': return '🎨';
      case 'calculation': return '🧮';
      default: return '📋';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });
  };

  // Toggle filter
  const toggleTypeFilter = (type: DebugEventType) => {
    setFilterTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const toggleSeverityFilter = (severity: DebugSeverity) => {
    setFilterSeverity(prev => {
      const newSet = new Set(prev);
      if (newSet.has(severity)) {
        newSet.delete(severity);
      } else {
        newSet.add(severity);
      }
      return newSet;
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Event Logger</h3>
          <Badge variant="outline" className="text-xs">
            {filteredEvents.length} / {events.length} events
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {onExport && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onExport}
              className="text-xs h-7"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setNewestFirst(!newestFirst)}
            className="text-xs h-7"
            title={newestFirst ? "Switch to oldest first" : "Switch to newest first"}
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            {newestFirst ? "Newest" : "Oldest"}
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onClear}
            className="text-xs h-7"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      {showFilters && (
        <div className="space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
            <Input
              placeholder="Search events..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>
          
          {/* Type Filters */}
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-gray-500 mr-2">Types:</span>
            {(['click', 'input_change', 'state_change', 'function_call', 'error', 'calculation'] as DebugEventType[]).map(type => (
              <Button
                key={type}
                size="sm"
                variant={filterTypes.has(type) ? "default" : "outline"}
                onClick={() => toggleTypeFilter(type)}
                className="text-xs h-6 px-2"
              >
                {getEventTypeIcon(type)} {type.replace('_', ' ')}
              </Button>
            ))}
          </div>
          
          {/* Severity Filters */}
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-gray-500 mr-2">Severity:</span>
            {(['info', 'success', 'warning', 'error'] as DebugSeverity[]).map(severity => (
              <Button
                key={severity}
                size="sm"
                variant={filterSeverity.has(severity) ? "default" : "outline"}
                onClick={() => toggleSeverityFilter(severity)}
                className="text-xs h-6 px-2"
              >
                {getSeverityDisplay(severity).icon} {severity}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Events List */}
      <ScrollArea 
        className="border rounded-md bg-gray-50 dark:bg-gray-900" 
        style={{ height: maxHeight }}
      >
        <div className="p-2 space-y-1">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {events.length === 0 
                ? 'No debug events yet. Interact with the tool to see events here.' 
                : 'No events match the current filters.'
              }
            </div>
          ) : (
            filteredEvents.map((event, index) => {
              const severity = getSeverityDisplay(event.severity);
              const typeIcon = getEventTypeIcon(event.type);
              
              return (
                <div
                  key={event.id}
                  className={`p-2 rounded text-xs border ${severity.color} hover:opacity-80 transition-opacity`}
                >
                  <div className="flex items-start gap-2">
                    {/* Timestamp */}
                    <span className="text-gray-300 font-mono text-xs shrink-0">
                      {formatTimestamp(event.timestamp)}
                    </span>
                    
                    {/* Event Type */}
                    <span className="shrink-0" title={event.type}>
                      {typeIcon}
                    </span>
                    
                    {/* Enhanced Message with Key Info */}
                    <span className="flex-1 break-words">
                      {(() => {
                        // Create enhanced message based on event type
                        let enhancedMessage = event.message || event.type.replace('_', ' ');
                        
                        // Add key info based on event type
                        if (event.type === 'click' && event.data) {
                          const target = event.data.elementType || 'element';
                          const text = event.data.elementText ? ` "${event.data.elementText.substring(0, 20)}"` : '';
                          enhancedMessage = `Click on ${target}${text}`;
                          if (event.data.elementId) enhancedMessage += ` #${event.data.elementId}`;
                        } else if (event.type === 'input_change' && event.data) {
                          const inputType = event.data.elementType || 'input';
                          const value = event.data.value !== undefined ? ` → "${event.data.value}"` : '';
                          const name = event.data.elementName ? ` (${event.data.elementName})` : '';
                          enhancedMessage = `${inputType.charAt(0).toUpperCase() + inputType.slice(1)} changed${name}${value}`;
                        } else if (event.type === 'state_change' && event.data) {
                          const varName = event.data.variableName || 'variable';
                          const newValue = event.data.newValue !== undefined ? ` → ${JSON.stringify(event.data.newValue)}` : '';
                          enhancedMessage = `State: ${varName}${newValue}`;
                        } else if (event.type === 'function_call' && event.data) {
                          const funcName = event.data.functionName || 'function';
                          const args = event.data.arguments ? ` (${Object.keys(event.data.arguments).length} args)` : '';
                          enhancedMessage = `Called: ${funcName}${args}`;
                        } else if (event.type === 'calculation' && event.data) {
                          const result = event.data.result !== undefined ? ` → ${event.data.result}` : '';
                          enhancedMessage = `Calculation${result}`;
                        } else if (event.type === 'error' && event.data) {
                          const errorMsg = event.data.message || event.data.error || 'Unknown error';
                          enhancedMessage = `Error: ${errorMsg.substring(0, 50)}${errorMsg.length > 50 ? '...' : ''}`;
                        }
                        
                        return enhancedMessage;
                      })()}
                    </span>
                    
                    {/* Severity */}
                    <span className="shrink-0" title={event.severity}>
                      {severity.icon}
                    </span>
                  </div>
                  
                  {/* Additional data (expandable for complex events) */}
                  {Object.keys(event.data).length > 0 && (
                    <details className="mt-1 ml-4">
                      <summary className="text-gray-200 cursor-pointer text-xs hover:text-white">
                        View details
                      </summary>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </details>
                  )}
                  
                  {/* Element info for UI events */}
                  {event.elementInfo && (
                    <div className="mt-1 ml-4 text-xs text-gray-200">
                      Element: {event.elementInfo.tagName.toLowerCase()}
                      {event.elementInfo.id && `#${event.elementInfo.id}`}
                      {event.elementInfo.className && ` .${event.elementInfo.className.split(' ').join('.')}`}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}