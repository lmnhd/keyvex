'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wifi, 
  WifiOff, 
  Send, 
  Trash2, 
  ArrowLeft,
  Circle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  MessageSquare,
  Settings,
  RefreshCw,
  Bug
} from 'lucide-react';

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT || 'wss://your-websocket-api.execute-api.us-east-1.amazonaws.com/dev';
const TEST_USER_ID = 'test-user-123';
const TEST_JOB_ID = 'test-job-456';

// Debug info
const DEBUG_INFO = {
  envVar: process.env.NEXT_PUBLIC_AWS_WEBSOCKET_URL,
  hasEnvVar: !!process.env.NEXT_PUBLIC_AWS_WEBSOCKET_URL,
  finalUrl: WEBSOCKET_URL,
  isPlaceholder: WEBSOCKET_URL.includes('your-websocket-api')
};


interface WebSocketMessage {
  id: string;
  timestamp: string;
  type: 'sent' | 'received' | 'system';
  data: any;
  raw?: string;
}

interface StepProgress {
  jobId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  data?: any;
  timestamp: string;
}

export default function WebSocketTestPage() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [wsReadyState, setWsReadyState] = useState<number | null>(null);
  
  // Message state
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [customMessage, setCustomMessage] = useState('{"type": "test", "message": "Hello WebSocket!"}');
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Progress tracking
  const [stepProgresses, setStepProgresses] = useState<StepProgress[]>([]);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdCounter = useRef(0);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const addMessage = (type: WebSocketMessage['type'], data: any, raw?: string) => {
    const message: WebSocketMessage = {
      id: `${Date.now()}-${messageIdCounter.current++}`,
      timestamp: new Date().toISOString(),
      type,
      data,
      raw
    };
    setMessages(prev => [...prev, message]);
    
    // Log to console for debugging
    console.log(`[WebSocket ${type.toUpperCase()}]`, data);
  };

  // Update WebSocket ready state periodically for debugging
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current) {
        setWsReadyState(wsRef.current.readyState);
      } else {
        setWsReadyState(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('[WebSocket Debug] Starting connection attempt...');
    console.log('[WebSocket Debug] Environment variable:', process.env.NEXT_PUBLIC_AWS_WEBSOCKET_URL);
    console.log('[WebSocket Debug] Final URL:', WEBSOCKET_URL);
    console.log('[WebSocket Debug] User ID:', TEST_USER_ID);
    console.log('[WebSocket Debug] Job ID:', TEST_JOB_ID);

    setConnectionStatus('connecting');
    setConnectionError(null);
    addMessage('system', { 
      action: 'connecting', 
      url: WEBSOCKET_URL,
      debug: {
        envVarSet: !!process.env.NEXT_PUBLIC_AWS_WEBSOCKET_URL,
        isPlaceholder: WEBSOCKET_URL.includes('your-websocket-api'),
        timestamp: new Date().toISOString()
      }
    });

    try {
      const url = new URL(WEBSOCKET_URL);
      url.searchParams.set('userId', TEST_USER_ID);
      url.searchParams.set('jobId', TEST_JOB_ID);

      const finalUrl = url.toString();
      console.log('[WebSocket Debug] Final connection URL:', finalUrl);

      const ws = new WebSocket(finalUrl);
      wsRef.current = ws;

      // Log initial state
      console.log('[WebSocket Debug] WebSocket created, readyState:', ws.readyState);
      setWsReadyState(ws.readyState);

      ws.onopen = () => {
        console.log('[WebSocket Debug] Connection opened successfully');
        setIsConnected(true);
        setConnectionStatus('connected');
        setConnectionError(null);
        setWsReadyState(ws.readyState);
        addMessage('system', { 
          action: 'connected', 
          url: WEBSOCKET_URL,
          readyState: ws.readyState,
          timestamp: new Date().toISOString()
        });
      };

      ws.onmessage = (event) => {
        console.log('[WebSocket Debug] Message received:', event.data);
        try {
          const data = JSON.parse(event.data);
          addMessage('received', data, event.data);
          
          if (data.type === 'step_progress') {
            const progress: StepProgress = {
              jobId: data.jobId,
              stepName: data.stepName,
              status: data.status,
              data: data.data,
              timestamp: data.timestamp
            };
            
            setStepProgresses(prev => {
              const existing = prev.findIndex(p => p.jobId === progress.jobId && p.stepName === progress.stepName);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = progress;
                return updated;
              } else {
                return [...prev, progress];
              }
            });
          }
        } catch (error) {
          console.error('[WebSocket Debug] Failed to parse message:', error);
          addMessage('received', { raw: event.data, parseError: true }, event.data);
        }
      };

      ws.onclose = (event) => {
        console.log('[WebSocket Debug] Connection closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setWsReadyState(ws.readyState);
        
        const errorMsg = event.code !== 1000 ? `Connection closed unexpectedly (Code: ${event.code}, Reason: ${event.reason || 'None'})` : null;
        setConnectionError(errorMsg);
        
        addMessage('system', { 
          action: 'disconnected', 
          code: event.code, 
          reason: event.reason,
          wasClean: event.wasClean,
          timestamp: new Date().toISOString()
        });

        if (!event.wasClean && connectionStatus === 'connected') {
          console.log('[WebSocket Debug] Scheduling reconnection in 3 seconds...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket Debug] Connection error:', error);
        setConnectionStatus('error');
        setConnectionError('WebSocket connection failed');
        setWsReadyState(ws.readyState);
        addMessage('system', { 
          action: 'error', 
          error: 'WebSocket error occurred',
          readyState: ws.readyState,
          timestamp: new Date().toISOString()
        });
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[WebSocket Debug] Failed to create WebSocket:', errorMessage);
      setConnectionStatus('error');
      setConnectionError(`Failed to create WebSocket: ${errorMessage}`);
      addMessage('system', { 
        action: 'connection_failed', 
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const sendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addMessage('system', { action: 'send_failed', reason: 'Not connected' });
      return;
    }

    try {
      const data = JSON.parse(customMessage);
      wsRef.current.send(JSON.stringify(data));
      addMessage('sent', data, customMessage);
    } catch (error) {
      addMessage('system', { action: 'send_failed', reason: 'Invalid JSON', error: error instanceof Error ? error.message : 'Parse error' });
    }
  };

  const sendTestMessage = (testType: string) => {
    const testMessages = {
      ping: { type: 'ping', timestamp: Date.now() },
      echo: { type: 'echo', message: 'Test echo message', timestamp: Date.now() },
      progress_request: { type: 'request_progress', jobId: TEST_JOB_ID }
    };

    const message = testMessages[testType as keyof typeof testMessages];
    if (message && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      addMessage('sent', message);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setStepProgresses([]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getReadyStateText = (state: number): string => {
    switch (state) {
      case 0: return 'CONNECTING';
      case 1: return 'OPEN';
      case 2: return 'CLOSING';
      case 3: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/tests">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tests
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wifi className="h-8 w-8 text-blue-600" />
            WebSocket Testing Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Test WebSocket connections, real-time messaging, and V2 orchestration progress updates
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Connection Configuration
              </CardTitle>
              <CardDescription>
                Connection parameters for the WebSocket test client.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(connectionStatus)}
                  <span className="font-medium">Status</span>
                </div>
                <Badge className={getStatusColor(connectionStatus)}>
                  {connectionStatus}
                </Badge>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={connect} 
                  disabled={isConnected || connectionStatus === 'connecting'}
                  className="flex items-center gap-2"
                >
                  <Wifi className="h-4 w-4" />
                  Connect
                </Button>
                <Button 
                  onClick={disconnect} 
                  disabled={!isConnected}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <WifiOff className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                V2 Orchestration Progress
              </CardTitle>
              <CardDescription>
                Real-time step progress from tool generation workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stepProgresses.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No step progress received yet</p>
                  <p className="text-sm">Connect and trigger a V2 orchestration to see progress</p>
                </div>
              ) : (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {stepProgresses.map((progress, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        {getProgressStatusIcon(progress.status)}
                        <div className="flex-1">
                          <div className="font-medium">{progress.stepName}</div>
                          <div className="text-sm text-muted-foreground">
                            Job: {progress.jobId} • {new Date(progress.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {progress.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Messages
              </CardTitle>
              <CardDescription>
                Send custom messages or test predefined message types
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Quick Tests</Label>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => sendTestMessage('ping')}
                    disabled={!isConnected}
                  >
                    Ping
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => sendTestMessage('echo')}
                    disabled={!isConnected}
                  >
                    Echo Test
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => sendTestMessage('progress_request')}
                    disabled={!isConnected}
                  >
                    Request Progress
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="customMessage">Custom JSON Message</Label>
                <Textarea
                  id="customMessage"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder='{"type": "test", "message": "Hello WebSocket!"}'
                  rows={4}
                />
              </div>

              <Button 
                onClick={sendMessage} 
                disabled={!isConnected}
                className="w-full flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                Send Message
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Message Log
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAutoScroll(!autoScroll)}
                  >
                    Auto-scroll: {autoScroll ? 'On' : 'Off'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearMessages}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Real-time message log with sent, received, and system messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Connect and send messages to see them here</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant={
                            message.type === 'sent' ? 'default' : 
                            message.type === 'received' ? 'secondary' : 
                            'outline'
                          }>
                            {message.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <pre className="text-sm bg-gray-50 text-gray-900 p-2 rounded overflow-x-auto">
                          {JSON.stringify(message.data, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Debug Information
              </CardTitle>
              <CardDescription>
                Debug details for WebSocket connection troubleshooting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium mb-2">Environment Configuration</div>
                  <div className="text-xs space-y-1">
                    <div>ENV Variable Set: <span className={DEBUG_INFO.hasEnvVar ? 'text-green-600' : 'text-red-600'}>{DEBUG_INFO.hasEnvVar ? 'Yes' : 'No'}</span></div>
                    <div>ENV Value: <span className="font-mono text-gray-600">{DEBUG_INFO.envVar || 'Not Set'}</span></div>
                    <div>Final URL: <span className="font-mono text-gray-600 break-all">{DEBUG_INFO.finalUrl}</span></div>
                    <div>Is Placeholder: <span className={DEBUG_INFO.isPlaceholder ? 'text-amber-600' : 'text-green-600'}>{DEBUG_INFO.isPlaceholder ? 'Yes' : 'No'}</span></div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium mb-2">Connection State</div>
                  <div className="text-xs space-y-1">
                    <div>Status: <span className="font-mono">{connectionStatus}</span></div>
                    <div>Connected: <span className={isConnected ? 'text-green-600' : 'text-red-600'}>{isConnected ? 'Yes' : 'No'}</span></div>
                    <div>WebSocket ReadyState: <span className="font-mono">{wsReadyState !== null ? `${wsReadyState} (${getReadyStateText(wsReadyState)})` : 'None'}</span></div>
                    {connectionError && <div className="text-red-600">Error: {connectionError}</div>}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium mb-2">Connection Parameters</div>
                  <div className="text-xs space-y-1">
                    <div>User ID: <span className="font-mono">{TEST_USER_ID}</span></div>
                    <div>Job ID: <span className="font-mono">{TEST_JOB_ID}</span></div>
                    <div>Browser: <span className="font-mono text-gray-600">Client-side only</span></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}