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
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('🛑 [POLLING] Polling stopped.');
      // If we were polling, it means the connection was down.
      // We don't change the status here, as it might be 'error' or 'fallback'.
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling(); // Ensure no multiple polls are running

    const jobId = activeJobIdRef.current;
    if (!jobId) {
      console.error('🚨 [POLLING] Cannot start polling without an active job ID.');
      return;
    }

    console.log(`🚀 [POLLING] Starting polling for job: ${jobId}`);
    setConnectionStatus('polling');
    addMessage('system', { action: 'polling_started', jobId }, undefined, true);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/ai/product-tool-creation-v2/orchestrate/tcc/${jobId}`);
        if (response.ok) {
          const { tcc } = await response.json();
          if (tcc) {
            addMessage('received', { type: 'tcc_update', ...tcc }, JSON.stringify(tcc), true);
            
            // Manually trigger the onTccUpdate and onProgress callbacks
            if (options.onTccUpdate) {
              options.onTccUpdate(tcc, 'polling-update');
            }
            if (options.onProgress) {
              const latestStep = Object.values(tcc.steps || {}).sort((a: any, b: any) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              )[0] as any;

              if (latestStep) {
                options.onProgress({
                  jobId: tcc.jobId,
                  stepName: latestStep.stepName || 'polling',
                  status: latestStep.status,
                  message: `[POLL] ${latestStep.status}`,
                  data: tcc,
                  timestamp: new Date().toISOString(),
                  isFallback: true,
                });
              }
            }

            if (tcc.status === 'completed' || tcc.status === 'failed') {
              console.log(`🏁 [POLLING] Job ${tcc.status}, stopping polling.`);
              stopPolling();
            }
          }
        } else {
          console.error(`🚨 [POLLING] Error fetching TCC: ${response.statusText}`);
          // Stop polling on persistent error to avoid spamming
          if (response.status === 404) {
            stopPolling();
          }
        }
      } catch (error) {
        console.error('🚨 [POLLING] Polling fetch failed:', error);
        stopPolling();
      }
    }, 5000); // Poll every 5 seconds
  }, [stopPolling, addMessage, options]);

  const startHeartbeatMonitoring = useCallback(() => {
    console.error('🚨 [HEARTBEAT] HEARTBEAT MONITORING DISABLED - NO FALLBACKS!');
    // Heartbeat monitoring disabled to prevent fallback to polling
  }, []);

  const stopHeartbeatMonitoring = useCallback(() => {
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
            
            // Legacy completion handling. If we see the final step, stop everything.
            // This is a potential source of issues if the backend has a different idea of "done".
            /*
            if (
              data.type === 'progress' &&
              (data.stepName === 'finalizing_tool' || data.stepName === 'tool_completed') &&
              data.status === 'completed'
            ) {
              console.log('🛑 [WebSocket] Tool completed (legacy) - stopping polling and clearing active job');
              stopPolling();
              activeJobIdRef.current = null;
              // Don't auto-disconnect here, let the user see the final state
            }
            */
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
          addMessage('system', { error: 'Failed to parse message', raw: event.data });
        }
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', { code: event.code, reason: event.reason });
        
        // Don't start polling if it was a clean, intentional close
        if (event.code === 1000) {
          setConnectionStatus('disconnected');
          addMessage('system', { action: 'disconnected', reason: 'clean_close' });
          return;
        }

        // For abnormal closures, start the polling fallback
        console.error('❌ [WebSocket] Connection closed abnormally, starting fallback.', { code: event.code, reason: event.reason });
        setConnectionStatus('fallback');
        addMessage('system', { action: 'fallback_activated', code: event.code, reason: event.reason }, undefined, true);
        onError?.(`WebSocket connection lost. Activating polling fallback.`);
        startPolling();
      };

      ws.onerror = (event) => {
        console.error('❌ [WebSocket] An error occurred', event);
        setConnectionStatus('error');
        addMessage('system', { action: 'error', error: 'WebSocket error occurred' });
        onError?.('A WebSocket error occurred. Check the console.');
        // The onclose event will fire after onerror, which will trigger polling
      };
    } catch (e) {
      console.error('❌ [WebSocket] Connection failed to initialize', e);
      setConnectionStatus('error');
      addMessage('system', { action: 'connection_failed', error: (e as Error).message });
      onError?.(`Failed to establish WebSocket connection: ${(e as Error).message}`);
    }
  }, [disconnect, addMessage, onError, startPolling, options.onTccUpdate, options.onProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect, connectionStatus, messages, progressUpdates, setProgressUpdates };
};