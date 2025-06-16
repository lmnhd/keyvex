'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, List, Settings, BarChart3 } from 'lucide-react';

import { useToolDebugger } from './hooks/useToolDebugger';
import EventLogger from './components/EventLogger';
import StateInspector from './components/StateInspector';
import DebugControlPanel from './components/DebugControlPanel';
import { ToolDebugPanelProps, DebugStats } from './types/debug-types';

export default function ToolDebugPanel({
  toolId,
  componentCode,
  metadata,
  onDebugEvent,
  className = '',
}: ToolDebugPanelProps) {
  const [activeTab, setActiveTab] = useState('events');
  
  const {
    events,
    currentState,
    config,
    clearEvents,
    exportSession,
    updateConfig,
    isEnabled,
  } = useToolDebugger(toolId as string);

  // Calculate statistics
  const calculateStats = (): DebugStats => {
    const now = Date.now();
    const sessionDuration = now - (events[0]?.timestamp || now);
    
    const eventsByType = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsBySeverity = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorCount = events.filter(e => e.severity === 'error').length;
    const averageEventInterval = events.length > 1 
      ? sessionDuration / (events.length - 1) 
      : 0;

    return {
      totalEvents: events.length,
      eventsByType: eventsByType as any,
      eventsBySeverity: eventsBySeverity as any,
      averageEventInterval,
      sessionDuration,
      errorRate: events.length > 0 ? errorCount / events.length : 0,
    };
  };

  const stats = calculateStats();

  // Handle export
  const handleExport = () => {
    const session = exportSession();
    const dataStr = JSON.stringify(session, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `debug-session-${toolId}-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Forward debug events to parent if callback provided
  React.useEffect(() => {
    if (onDebugEvent && events.length > 0) {
      const latestEvent = events[events.length - 1];
      onDebugEvent(latestEvent);
    }
  }, [events, onDebugEvent]);

  return (
    <div className={`w-full h-full ${className}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="font-medium text-sm">Tool Debug</span>
            {metadata && (
              <Badge variant="outline" className="text-xs">
                {metadata.title}
              </Badge>
            )}
          </div>
          
          <TabsList className="grid grid-cols-4 w-auto">
            <TabsTrigger value="events" className="text-xs px-2">
              <List className="h-3 w-3 mr-1" />
              Events
              {events.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                  {events.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="state" className="text-xs px-2">
              <BarChart3 className="h-3 w-3 mr-1" />
              State
              {Object.keys(currentState.variables).length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs h-4 px-1">
                  {Object.keys(currentState.variables).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="controls" className="text-xs px-2">
              <Settings className="h-3 w-3 mr-1" />
              Controls
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs px-2">
              <Activity className="h-3 w-3 mr-1" />
              Performance
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="events" className="h-full m-0 p-3">
            <EventLogger
              events={events}
              onClear={clearEvents}
              onExport={config.exportEnabled ? handleExport : undefined}
              maxHeight="calc(100vh - 200px)"
              showFilters={true}
            />
          </TabsContent>

          <TabsContent value="state" className="h-full m-0 p-3">
            <StateInspector
              currentState={currentState}
              readOnly={true}
            />
          </TabsContent>

          <TabsContent value="controls" className="h-full m-0 p-3">
            <DebugControlPanel
              config={config}
              onConfigChange={updateConfig}
              onClearAll={clearEvents}
              onExport={config.exportEnabled ? handleExport : undefined}
              stats={stats}
            />
          </TabsContent>

          <TabsContent value="performance" className="h-full m-0 p-3">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Render Count:</span>
                      <span className="ml-2 font-mono">{currentState.performance.renderCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Event Count:</span>
                      <span className="ml-2 font-mono">{currentState.performance.eventCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Error Count:</span>
                      <span className="ml-2 font-mono text-red-600">{currentState.performance.errorCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Warning Count:</span>
                      <span className="ml-2 font-mono text-yellow-600">{currentState.performance.warningCount}</span>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Event Distribution</h4>
                    <div className="space-y-2">
                      {Object.entries(stats.eventsByType).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-xs">
                          <span className="capitalize">{type.replace('_', ' ')}</span>
                          <span className="font-mono">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}