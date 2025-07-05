'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Trash2,
  Activity,
  Clock,
  AlertTriangle 
} from 'lucide-react';
import { DebugConfig, DebugEventType, DebugStats } from '../types/debug-types';

interface DebugControlPanelProps {
  config: DebugConfig;
  onConfigChange: (newConfig: Partial<DebugConfig>) => void;
  onClearAll: () => void;
  onExport?: () => void;
  stats?: DebugStats;
  className?: string;
}

export default function DebugControlPanel({
  config,
  onConfigChange,
  onClearAll,
  onExport,
  stats,
  className = '',
}: DebugControlPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Toggle debug system on/off
  const toggleEnabled = () => {
    onConfigChange({ enabled: !config.enabled });
  };

  // Toggle event type tracking
  const toggleEventType = (eventType: DebugEventType) => {
    const newEventTypes = config.eventTypes.includes(eventType)
      ? config.eventTypes.filter(type => type !== eventType)
      : [...config.eventTypes, eventType];
    
    onConfigChange({ eventTypes: newEventTypes });
  };

  // Update max events limit
  const updateMaxEvents = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0) {
      onConfigChange({ maxEvents: numValue });
    }
  };

  // Event type icons
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

  // Format event type name
  const formatEventTypeName = (type: DebugEventType) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Debug Controls
            <Badge variant={config.enabled ? "default" : "secondary"} className="text-xs">
              {config.enabled ? "Active" : "Inactive"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/Disable Debug */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Debug System</Label>
              <p className="text-xs text-gray-500">
                {config.enabled ? 'Currently monitoring tool interactions' : 'Debug monitoring is disabled'}
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={toggleEnabled}
            />
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleEnabled}
              className="text-xs"
            >
              {config.enabled ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
              {config.enabled ? 'Pause' : 'Resume'}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={onClearAll}
              className="text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>

            {onExport && (
              <Button
                size="sm"
                variant="outline"
                onClick={onExport}
                className="text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Export Session
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs"
            >
              <Settings className="h-3 w-3 mr-1" />
              {showAdvanced ? 'Hide' : 'Show'} Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Summary */}
      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Session Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Events:</span>
                  <span className="font-mono font-medium">{stats.totalEvents}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Session Duration:</span>
                  <span className="font-mono font-medium">
                    {Math.floor(stats.sessionDuration / 60000)}m {Math.floor((stats.sessionDuration % 60000) / 1000)}s
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Error Rate:</span>
                  <span className={`font-mono font-medium ${stats.errorRate > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                    {(stats.errorRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg Interval:</span>
                  <span className="font-mono font-medium">
                    {stats.averageEventInterval.toFixed(0)}ms
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Type Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Event Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {(['click', 'input_change', 'state_change', 'function_call', 'error', 'render', 'calculation'] as DebugEventType[]).map(eventType => (
              <div key={eventType} className="flex items-center space-x-2">
                <Switch
                  id={eventType}
                  checked={config.eventTypes.includes(eventType)}
                  onCheckedChange={() => toggleEventType(eventType)}
                  disabled={!config.enabled}
                />
                <Label htmlFor={eventType} className="text-xs flex items-center gap-1">
                  <span>{getEventTypeIcon(eventType)}</span>
                  {formatEventTypeName(eventType)}
                </Label>
                {stats && stats.eventsByType[eventType] > 0 && (
                  <Badge variant="outline" className="text-xs h-4 px-1">
                    {stats.eventsByType[eventType]}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      {showAdvanced && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Advanced Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Max Events */}
            <div className="space-y-2">
              <Label className="text-xs">Maximum Events</Label>
              <Input
                type="number"
                value={config.maxEvents}
                onChange={(e) => updateMaxEvents(e.target.value)}
                className="h-7 text-xs"
                min="100"
                max="10000"
                step="100"
              />
              <p className="text-xs text-gray-500">
                Events beyond this limit will be automatically removed
              </p>
            </div>

            <Separator />

            {/* Feature Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Auto Scroll</Label>
                <Switch
                  checked={config.autoScroll}
                  onCheckedChange={(checked) => onConfigChange({ autoScroll: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Timestamps</Label>
                <Switch
                  checked={config.showTimestamps}
                  onCheckedChange={(checked) => onConfigChange({ showTimestamps: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Highlight Errors</Label>
                <Switch
                  checked={config.highlightErrors}
                  onCheckedChange={(checked) => onConfigChange({ highlightErrors: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Collect Performance</Label>
                <Switch
                  checked={config.collectPerformance}
                  onCheckedChange={(checked) => onConfigChange({ collectPerformance: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Export Enabled</Label>
                <Switch
                  checked={config.exportEnabled}
                  onCheckedChange={(checked) => onConfigChange({ exportEnabled: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning Messages */}
      {stats && stats.errorRate > 0.2 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">
                High error rate detected ({(stats.errorRate * 100).toFixed(1)}%). 
                Check the Event Logger for details.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
