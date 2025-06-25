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
    transpilationInfo,
    clearEvents,
    exportSession,
    updateConfig,
    isEnabled,
  } = useToolDebugger(toolId as string, componentCode);

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
          
          <TabsList className="grid grid-cols-5 w-auto">
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
            <TabsTrigger value="format" className="text-xs px-2">
              <Activity className="h-3 w-3 mr-1" />
              Format
              {transpilationInfo && (
                <Badge 
                  variant={transpilationInfo.format.isTranspiled ? "default" : "secondary"} 
                  className="ml-1 text-xs h-4 px-1"
                >
                  {transpilationInfo.format.format}
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

          <TabsContent value="format" className="h-full m-0 p-3">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Transpilation Format Analysis</h4>
                    
                    {transpilationInfo ? (
                      <div className="space-y-4">
                        {/* Format Information */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Format Type:</span>
                            <Badge 
                              variant={transpilationInfo.format.isTranspiled ? "default" : "secondary"} 
                              className="ml-2"
                            >
                              {transpilationInfo.format.format}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-gray-500">Original Format:</span>
                            <span className="ml-2 font-mono text-xs">{transpilationInfo.format.estimatedOriginalFormat}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Has Imports:</span>
                            <Badge variant={transpilationInfo.format.hasImports ? "default" : "secondary"} className="ml-2">
                              {transpilationInfo.format.hasImports ? "Yes" : "No"}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-gray-500">React.createElement:</span>
                            <Badge variant={transpilationInfo.format.hasReactCreateElement ? "default" : "secondary"} className="ml-2">
                              {transpilationInfo.format.hasReactCreateElement ? "Yes" : "No"}
                            </Badge>
                          </div>
                        </div>

                        {/* Calculation Functions */}
                        <div className="pt-4 border-t">
                          <h5 className="text-sm font-medium mb-2">Detected Calculation Functions</h5>
                          <div className="space-y-3">
                            {transpilationInfo.calculations.arrowFunctions.length > 0 && (
                              <div>
                                <span className="text-xs text-gray-500 block mb-1">Arrow Functions:</span>
                                <div className="flex flex-wrap gap-1">
                                  {transpilationInfo.calculations.arrowFunctions.map(func => (
                                    <Badge key={func} variant="outline" className="text-xs">
                                      {func}()
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {transpilationInfo.calculations.functionDeclarations.length > 0 && (
                              <div>
                                <span className="text-xs text-gray-500 block mb-1">Function Declarations:</span>
                                <div className="flex flex-wrap gap-1">
                                  {transpilationInfo.calculations.functionDeclarations.map(func => (
                                    <Badge key={func} variant="outline" className="text-xs">
                                      {func}()
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {transpilationInfo.calculations.calculationVars.length > 0 && (
                              <div>
                                <span className="text-xs text-gray-500 block mb-1">Calculation Variables:</span>
                                <div className="flex flex-wrap gap-1">
                                  {transpilationInfo.calculations.calculationVars.map(variable => (
                                    <Badge key={variable} variant="secondary" className="text-xs">
                                      {variable}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {transpilationInfo.calculations.totalCount === 0 && (
                              <div className="text-xs text-gray-500 italic">
                                No calculation functions detected in component code
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Debug Enhancement Status */}
                        <div className="pt-4 border-t">
                          <h5 className="text-sm font-medium mb-2">Debug Enhancement Status</h5>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span>Transpilation-aware detection:</span>
                              <Badge variant="default">✅ Enabled</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Arrow function monitoring:</span>
                              <Badge variant={transpilationInfo.calculations.arrowFunctions.length > 0 ? "default" : "secondary"}>
                                {transpilationInfo.calculations.arrowFunctions.length > 0 ? "✅ Active" : "⚪ Waiting"}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>JSX transpiler compatibility:</span>
                              <Badge variant={transpilationInfo.format.format === 'jsx-transpiled' ? "default" : "secondary"}>
                                {transpilationInfo.format.format === 'jsx-transpiled' ? "✅ Compatible" : "⚪ Legacy"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        No component code provided for analysis
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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