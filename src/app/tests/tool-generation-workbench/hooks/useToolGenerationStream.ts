'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { subscribeToProgress } from '@/lib/streaming/progress-emitter';

// --- Types ---

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'fallback' | 'polling';

export interface WebSocketMessage {
  id: string;
  timestamp: string;
  type: 'sent' | 'received' | 'system';
  data: any;
  raw?: string;
  isFallback?: boolean; // Flag to indicate this is from fallback mode
}

export interface StepProgress {
  jobId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'started' | 'llm_call_pending' | 'llm_data_received' | 'initiated' | 'skipped';
  message?: string;
  data?: any;
  timestamp: string;
  isFallback?: boolean; // Flag to indicate this is from fallback mode
}

export interface UseToolGenerationStreamOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onProgress?: (progress: StepProgress) => void;
  onError?: (error: string) => void;
  onTccUpdate?: (updatedTcc: any, agentType?: string) => void;
}

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT || '';

// --- Hook ---

export const useToolGenerationStream = (options: UseToolGenerationStreamOptions = {}) => {
  const { onMessage, onProgress, onError } = options;
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<StepProgress[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null); // To store userId for polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const messageIdCounter = useRef(0);
  const lastMessageTimeRef = useRef<number>(Date.now()); // Track last message time
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Heartbeat timeout

  const addMessage = useCallback((type: WebSocketMessage['type'], data: any, raw?: string, isFallback = false) => {
    const message: WebSocketMessage = {
      id: `${Date.now()}-${messageIdCounter.current++}`,
      timestamp: new Date().toISOString(),
      type,
      data,
      raw,
      isFallback
    };
    setMessages(prev => [...prev, message]);
    if (onMessage) {
      onMessage(message);
    }
  }, [onMessage]);

  const stopPolling = useCallback(() => {
    // Polling is disabled - nothing to stop
    console.log('🚫 [POLLING] Polling is disabled - nothing to stop');
  }, []);

  const startPolling = useCallback(() => {
    console.error('🚨 [POLLING] POLLING FALLBACK DISABLED - NO FALLBACKS ALLOWED!');
    console.error('🚨 [POLLING] WebSocket failed and polling is disabled to expose real issues');
    setConnectionStatus('error');
    onError?.('WebSocket failed and polling fallback is disabled. Fix the WebSocket connection.');
  }, [onError]);

  const startHeartbeatMonitoring = useCallback(() => {
    console.error('🚨 [HEARTBEAT] HEARTBEAT MONITORING DISABLED - NO FALLBACKS!');
    // Heartbeat monitoring disabled to prevent fallback to polling
  }, []);

  const stopHeartbeatMonitoring = useCallback(() => {
    // Heartbeat monitoring disabled - nothing to stop
    console.log('🚫 [HEARTBEAT] Heartbeat monitoring is disabled - nothing to stop');
  }, []);

  const disconnect = useCallback(() => {
    stopPolling();
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (wsRef.current) {
      // If the socket is trying to connect, we can't close it, but we can
      // prevent its event handlers from firing if it eventually succeeds.
      // This effectively orphans the connection attempt, preventing the error.
      if (wsRef.current.readyState !== WebSocket.OPEN) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
      } else {
        // If the connection is open, close it normally.
        wsRef.current.close(1000, 'User disconnected');
      }
      wsRef.current = null;
    }
    
    setConnectionStatus('disconnected');
    activeJobIdRef.current = null;
    activeUserIdRef.current = null;
    
    const disconnectMessage: WebSocketMessage = {
      id: `${Date.now()}-${messageIdCounter.current++}`,
      timestamp: new Date().toISOString(),
      type: 'system',
      data: { action: 'manual_disconnect' }
    };
    setMessages(prev => [...prev, disconnectMessage]);
  }, [stopPolling, setMessages]);

  const connect = useCallback(async (jobId: string, userId: string) => {
    if (!userId) {
      console.error('[WebSocket] Connection attempt failed: userId is missing.');
      onError?.('Connection failed: User ID is required.');
      setConnectionStatus('error');
      return;
    }
    
    disconnect();
    activeJobIdRef.current = jobId;
    activeUserIdRef.current = userId; // Store for polling

    if (!WEBSOCKET_URL) {
      console.error('🚨 [FALLBACK MODE] NO WEBSOCKET URL - FALLBACK MODE DISABLED!');
      console.error('🚨 [FALLBACK MODE] Fix the WebSocket configuration instead of using fallback');
      setConnectionStatus('error');
      addMessage('system', { action: 'no_websocket_url', error: 'WebSocket URL not configured and fallback disabled' }, undefined, true);
      onError?.('WebSocket URL not configured. No fallback available.');
      return;
    }

    if (wsRef.current) {
      console.warn('[WebSocket] Already connected.');
      return;
    }

    setConnectionStatus('connecting');
    addMessage('system', { action: 'connecting', jobId, userId, url: WEBSOCKET_URL });

    try {
      const url = new URL(WEBSOCKET_URL);
      url.searchParams.set('userId', userId);
      url.searchParams.set('jobId', jobId);
      
      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connection opened successfully for job:', jobId);
        setConnectionStatus('connected');
        addMessage('system', { action: 'connected', jobId });
      };

      ws.onmessage = (event) => {
        try {
          // CRITICAL FIX: Update last message time when messages are received
          lastMessageTimeRef.current = Date.now();
          
          const data = JSON.parse(event.data);
          addMessage('received', data, event.data);

          // 📊 HANDLE TCC UPDATES - Real-time TCC state updates
          if (data.type === 'tcc_update') {
            console.log('📊 [WebSocket] TCC Update received:', {
              jobId: data.jobId,
              agentType: data.agentType,
              tccKeys: Object.keys(data.updatedTcc || {})
            });
            
            // Call onTccUpdate callback if provided
            if (options.onTccUpdate) {
              options.onTccUpdate(data.updatedTcc, data.agentType);
            }
          }

          // 📡 HANDLE STEP PROGRESS - Real-time progress updates
          if (data.type === 'step_progress' || data.stepName) {
            const progress: StepProgress = {
              jobId: data.jobId,
              stepName: data.stepName,
              status: data.status,
              message: data.message,
              data: data.data,
              timestamp: data.timestamp || new Date().toISOString()
            };
            setProgressUpdates(prev => {
                const existingIndex = prev.findIndex(p => p.stepName === progress.stepName);
                if (existingIndex > -1) {
                    const newProgress = [...prev];
                    newProgress[existingIndex] = progress;
                    return newProgress;
                }
                return [...prev, progress];
            });
            if (onProgress) onProgress(progress);
            
            // 🏁 WORKFLOW COMPLETION DETECTION
            if (progress.stepName === 'workflow_completed' && progress.status === 'completed') {
              console.log('🏁 [WebSocket] V2 Workflow completed - stopping and clearing active job');
              stopPolling();
              activeJobIdRef.current = null;
              activeUserIdRef.current = null;
              
              // Automatically disconnect WebSocket after workflow completion
              setTimeout(() => {
                console.log('🔌 [WebSocket] Auto-disconnecting after workflow completion');
                disconnect();
              }, 2000); // Give time to ensure all final messages are received
            }
            
            // Legacy completion detection for backward compatibility
            if (progress.stepName === 'finalizing_tool' && progress.status === 'completed') {
              console.log('🛑 [WebSocket] Tool completed (legacy) - stopping polling and clearing active job');
              stopPolling();
              activeJobIdRef.current = null;
              activeUserIdRef.current = null;
              
              // Automatically disconnect WebSocket after tool completion to ensure clean state
              setTimeout(() => {
                console.log('🔌 [WebSocket] Auto-disconnecting after tool completion');
                disconnect();
              }, 1000); // Give a small delay to ensure all final messages are received
            }
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
          addMessage('system', { error: 'Failed to parse message', raw: event.data });
        }
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', { code: event.code, reason: event.reason });
        wsRef.current = null;
        
        // Check if this is a normal closure (code 1000) or an error closure
        if (event.code === 1000 || event.reason === 'User disconnected') {
          // Normal closure - job completed or user disconnected
          console.log('✅ [WebSocket] Connection closed normally (job completed or user disconnected)');
          setConnectionStatus('disconnected');
          addMessage('system', { action: 'connection_closed_normal', code: event.code, reason: event.reason });
        } else {
          // Abnormal closure - likely an error
          console.error('❌ [WebSocket] Connection closed abnormally, starting fallback.', { code: event.code, reason: event.reason });
          setConnectionStatus('error');
          addMessage('system', { action: 'connection_closed_abnormal', code: event.code, reason: event.reason });
          startPolling();
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] A connection error occurred. This is often due to the server being unavailable or an issue with the WebSocket URL. Check the browser\'s Network tab for more details on the failed WebSocket handshake.', event);
        setConnectionStatus('error');
        const errorMessage = 'A WebSocket connection error occurred. Check the browser\'s developer console (Network tab) for more details.';
        addMessage('system', { action: 'error', error: errorMessage });
        onError?.(errorMessage);
        // Don't start polling immediately, let onclose handle it to avoid duplicate logic
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      setConnectionStatus('error');
      addMessage('system', { action: 'connection_failed', error });
      onError?.('Failed to establish WebSocket connection.');
      startPolling(); // If connection fails to even start, begin polling
    }
  }, [disconnect, addMessage, onError, onProgress, startPolling, options.onTccUpdate]);

  return { connect, disconnect, connectionStatus, messages, progressUpdates, setProgressUpdates };
};