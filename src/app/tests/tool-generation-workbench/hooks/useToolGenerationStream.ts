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
}

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT || '';
const TEST_USER_ID = process.env.NEXT_PUBLIC_DEBUG_USER_ID || 'debug-user-123';

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
    }
  }, []);
  const startPolling = useCallback(() => {
    const jobId = activeJobIdRef.current;
    const userId = activeUserIdRef.current;

    if (!jobId || !userId) {
      console.error('[Polling] Cannot start polling without a job ID and user ID.');
      addMessage('system', { error: 'Polling failed: Missing job or user ID.' });
      return;
    }
    stopPolling();
    setConnectionStatus('polling');
    addMessage('system', { action: 'polling_started', jobId, message: 'Connection lost, falling back to polling.' }, undefined, true);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        console.log(`[Polling] Checking status for job: ${jobId} for user: ${userId}`);
        
        const response = await fetch(`/api/tool-generation/status/${jobId}?userId=${encodeURIComponent(userId)}`);
        
        if (!response.ok) {
          throw new Error(`Polling request failed with status ${response.status}`);
        }

        const result = await response.json();
        console.log('[Polling] Received status:', result);

        if (result.status === 'completed' && result.productToolDefinition) {
          const finalData = {
            jobId: result.id,
            finalProduct: result.productToolDefinition,
            toolConstructionContext: result.toolConstructionContext,
          };

          addMessage('received', { ...finalData, isFallback: true }, JSON.stringify(finalData), true);
          
          const finalProgress: StepProgress = {
            jobId: result.id,
            stepName: 'Finalization',
            status: 'completed',
            message: 'Tool generation completed via polling fallback.',
            data: finalData,
            timestamp: new Date(result.updatedAt).toISOString(),
            isFallback: true,
          };
          setProgressUpdates(prev => [...prev, finalProgress]);
          if (onProgress) {
            onProgress(finalProgress);
          }

          setConnectionStatus('disconnected');
          activeJobIdRef.current = null;
          activeUserIdRef.current = null;
          stopPolling();
        } else if (result.status === 'failed') {
          addMessage('system', { error: 'Job failed according to polling.', details: result }, undefined, true);
          setConnectionStatus('error');
          onError?.('Tool generation failed.');
          activeJobIdRef.current = null;
          activeUserIdRef.current = null;
          stopPolling();
        }
      } catch (error) {
        console.error('[Polling] Error during polling:', error);
        addMessage('system', { error: 'Polling failed.', details: (error as Error).message }, undefined, true);
        // Optional: stop polling after a few errors
      }
    }, 2000); // CRITICAL FIX: Reduced from 5000ms to 2000ms for faster polling feedback
  }, [addMessage, onError, onProgress, stopPolling]);

  // CRITICAL FIX: Add heartbeat monitoring to detect WebSocket silence
  const startHeartbeatMonitoring = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    // Check for silence every 30 seconds during active jobs
    heartbeatTimeoutRef.current = setTimeout(() => {
      const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
      const SILENCE_THRESHOLD = 3 * 60 * 1000; // 3 minutes of silence
      
      if (activeJobIdRef.current && timeSinceLastMessage > SILENCE_THRESHOLD) {
        console.log(`[WebSocket] Detected ${Math.round(timeSinceLastMessage/1000)}s of silence for job ${activeJobIdRef.current}. Starting polling fallback.`);
        setConnectionStatus('polling');
        addMessage('system', { 
          action: 'polling_fallback_started', 
          jobId: activeJobIdRef.current,
          reason: `WebSocket silent for ${Math.round(timeSinceLastMessage/1000)} seconds` 
        }, undefined, true);
        startPolling();
      } else if (activeJobIdRef.current) {
        // Continue monitoring if job is still active
        startHeartbeatMonitoring();
      }
    }, 30000); // Check every 30 seconds
  }, [addMessage, startPolling]);

  const stopHeartbeatMonitoring = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);



  const disconnect = useCallback(() => {
    stopPolling();
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
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
  }, [stopPolling]);

  const connect = useCallback(async (jobId: string, userId?: string) => {
    disconnect();
    activeJobIdRef.current = jobId;
    let actualUserId = userId || TEST_USER_ID;
    activeUserIdRef.current = actualUserId; // Store for polling
    try {
      const response = await fetch('/api/debug/get-user-id');
      if (response.ok) {
        const data = await response.json();
        actualUserId = data.userId || TEST_USER_ID;
      }
    } catch (error) {
      console.warn('[WebSocket] Failed to get userId from backend, using default.');
    }

    if (!WEBSOCKET_URL) {
      console.log('🔄 [FALLBACK MODE] No WebSocket URL, using in-memory emitter for job:', jobId);
      setConnectionStatus('fallback');
      addMessage('system', { action: 'fallback_mode_activated', jobId }, undefined, true);
      unsubscribeRef.current = subscribeToProgress(jobId, (progressEvent) => {
        const progress: StepProgress = { 
          ...progressEvent, 
          status: progressEvent.status === 'in_progress' ? 'running' : progressEvent.status,
          isFallback: true 
        };
        setProgressUpdates(prev => [...prev, progress]);
        if (onProgress) {
          onProgress(progress);
        }
      });
      return;
    }

    if (wsRef.current) {
      console.warn('[WebSocket] Already connected.');
      return;
    }

    setConnectionStatus('connecting');
    addMessage('system', { action: 'connecting', jobId, url: WEBSOCKET_URL });

    try {
      const url = new URL(WEBSOCKET_URL);
      url.searchParams.set('userId', actualUserId);
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
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
          addMessage('system', { error: 'Failed to parse message', raw: event.data });
        }
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', { code: event.code, reason: event.reason });
        wsRef.current = null;
        
        // CRITICAL FIX: Start polling if there's an active job, regardless of close code
        // The connection can timeout during long operations even with code 1000
        if (activeJobIdRef.current) {
          console.log(`[WebSocket] Connection closed for active job ${activeJobIdRef.current}. Starting polling fallback.`);
          setConnectionStatus('polling');
          addMessage('system', { 
            action: 'polling_fallback_started', 
            jobId: activeJobIdRef.current,
            reason: `WebSocket closed (code: ${event.code}) during active job` 
          }, undefined, true);
          startPolling();
        } else {
          setConnectionStatus('disconnected');
          addMessage('system', { action: 'disconnected', code: event.code, reason: event.reason });
          activeUserIdRef.current = null;
        }
      };

      ws.onerror = (errorEvent) => {
        console.error('[WebSocket] Connection error:', errorEvent);
        if (activeJobIdRef.current) {
          console.log(`[WebSocket] Connection error for job ${activeJobIdRef.current}. Starting polling fallback.`);
          startPolling();
        } else {
          setConnectionStatus('error');
          onError?.('WebSocket connection error.');
          addMessage('system', { action: 'error', error: 'WebSocket connection error' });
        }
        wsRef.current = null;
      };

    } catch (error) {
      console.error('[WebSocket] Error creating connection:', error);
      setConnectionStatus('error');
      onError?.('Failed to create WebSocket connection.');
    }
  }, [disconnect, setConnectionStatus, addMessage, onProgress, stopPolling]);

 
  
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connect,
    disconnect,
    connectionStatus,
    messages,
    progressUpdates,
  };
};