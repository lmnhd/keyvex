'use client';

import React, { RefObject } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertCircle,
  Database,
  Zap
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ConnectionStatus, StepProgress } from '../../hooks/useToolGenerationStream';

interface WebSocketDebugInfo {
  hasEnvVar: boolean;
  isPlaceholder: boolean;
  finalUrl: string;
  connectionAttempts: number;
  lastConnectionTime?: string;
  lastMessageTime?: string;
}

interface Props {
  connectionStatus?: ConnectionStatus;
  wsDebugInfo?: WebSocketDebugInfo;
  wsLogs?: string[];
  progressUpdates?: StepProgress[];
  wsLogsEndRef?: RefObject<HTMLDivElement>;
  progressSummaryEndRef?: RefObject<HTMLDivElement>;
  getConnectionStatusIcon?: () => React.ReactNode;
  getConnectionStatusBadge?: () => React.ReactNode;
}

/**
 * Encapsulated WebSocket diagnostics panel.
 * All UI-only; no business logic here.
 */
export default function WebSocketDebugConsole({
  connectionStatus = 'disconnected',
  wsDebugInfo = { hasEnvVar: false, isPlaceholder: true, finalUrl: '', connectionAttempts: 0, lastConnectionTime: undefined, lastMessageTime: undefined },
  wsLogs = [],
  progressUpdates = [],
  wsLogsEndRef,
  progressSummaryEndRef,
  getConnectionStatusIcon,
  getConnectionStatusBadge
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            {getConnectionStatusIcon?.()}
            <span className="ml-2">WebSocket Debug Console</span>
          </div>
          <div className="flex items-center gap-2">
            {getConnectionStatusBadge?.()}
            {connectionStatus === 'connected' && (
              <>
                <Badge variant="outline" className="text-green-600">🟢 Live</Badge>
                <span className="ml-1 font-mono">{wsDebugInfo?.connectionAttempts}</span>
              </>
            )}
          </div>
          <div>
            <span className="font-medium">Last Connected:</span>
            <div className="font-mono text-gray-600 text-xs mt-1">
              {wsDebugInfo?.lastConnectionTime || 'Never'}
            </div>
          </div>
          <div>
            <span className="font-medium">Last Message:</span>
            <div className="font-mono text-gray-600 text-xs mt-1">
              {wsDebugInfo?.lastMessageTime || 'None'}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fallback Mode Warning */}
        {connectionStatus === 'fallback' && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-800 dark:text-orange-200">⚠️ FALLBACK MODE ACTIVE</AlertTitle>
            <AlertDescription className="text-orange-700 dark:text-orange-300 text-sm">
              <strong>NOT using real WebSocket!</strong> This is in-memory simulation for development.
              <br />• Set <code className="bg-orange-100 dark:bg-orange-800 px-1 rounded">NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT</code> for production WebSocket
              <br />• Messages below are simulated, not from a real WebSocket server
            </AlertDescription>
          </Alert>
        )}

        {/* Real-time Message Log */}
        <div>
          <Label className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Real-time Activity Log
            {connectionStatus === 'fallback' && (
              <span className="text-xs text-orange-600 font-normal">(Fallback Mode)</span>
            )}
          </Label>
          <ScrollArea className="h-64 mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md border">
            <div className="space-y-1">
              {wsLogs?.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  {connectionStatus === 'fallback'
                    ? '🔄 Fallback mode active - waiting for job progress...'
                    : '🔄 Waiting for WebSocket activity...'
                  }
                  <br />
                  <span className="text-xs">Start a V2 orchestration to see real-time logs</span>
                </p>
              ) : (
                wsLogs?.map((log, index) => (
                  <p key={index} className={`text-xs font-mono ${log.includes('[FALLBACK') ? 'text-orange-700 dark:text-orange-300' :
                      log.includes('[ERROR]') ? 'text-red-700 dark:text-red-300' :
                        log.includes('[CONNECTION]') ? 'text-blue-700 dark:text-blue-300' :
                          log.includes('[MESSAGE]') ? 'text-green-700 dark:text-green-300' :
                            ''
                  }`}>
                    {log}
                  </p>
                ))
              )}
              <div ref={wsLogsEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Progress Updates Summary */}
        {progressUpdates?.length > 0 && (
          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Step Progress Summary ({progressUpdates?.length} steps)
            </Label>
            <ScrollArea className="h-32 mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200">
              <div className="space-y-2">
                {progressUpdates?.map((progress, index) => (
                  <div key={index} className="flex items-center gap-3 text-xs">
                    <div className={`w-2 h-2 rounded-full ${progress.status === 'completed' ? 'bg-green-500' :
                        progress.status === 'running' ? 'bg-blue-500' :
                          progress.status === 'failed' ? 'bg-red-500' :
                            'bg-yellow-500'
                      }`} />
                    <span className="font-mono">{progress.stepName}</span>
                    <span className="text-gray-500">→</span>
                    <span className={`font-medium ${progress.status === 'completed' ? 'text-green-600' :
                        progress.status === 'running' ? 'text-blue-600' :
                          progress.status === 'failed' ? 'text-red-600' :
                            'text-yellow-600'
                      }`}>
                      {progress.status}
                    </span>
                    {progress.isFallback && (
                      <Badge variant="outline" className="text-xs text-orange-600">
                        Fallback
                      </Badge>
                    )}
                  </div>
                ))}
                <div ref={progressSummaryEndRef} />
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}