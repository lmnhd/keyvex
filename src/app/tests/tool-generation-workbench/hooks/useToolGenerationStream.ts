'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { subscribeToProgress } from '@/lib/streaming/progress-emitter';

// --- Types ---

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'fallback';

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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'started' | 'llm_call_pending' | 'llm_data_received' | 'initiated';
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
const TEST_USER_ID = process.env.NEXT_PUBLIC_DEBUG_USER_ID || 'debug-user-123'; // Use same environment variable as backend

// --- Hook ---

export const useToolGenerationStream = (options: UseToolGenerationStreamOptions = {}) => {
  const { onMessage, onProgress, onError } = options;
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<StepProgress[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdCounter = useRef(0);

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

  const connect = useCallback(async (jobId: string) => {
    if (!jobId) {
      console.error('[WebSocket] Connection failed: Job ID is required.');
      onError?.('Job ID is required to connect.');
      return;
    }

    // Get the actual userId from the backend to ensure consistency
    let actualUserId = TEST_USER_ID;
    try {
      const response = await fetch('/api/debug/get-user-id');
      if (response.ok) {
        const data = await response.json();
        actualUserId = data.userId || TEST_USER_ID;
        console.log('[WebSocket] Got actual userId from backend:', actualUserId);
      }
    } catch (error) {
      console.warn('[WebSocket] Failed to get userId from backend, using default:', TEST_USER_ID);
    }

    // If WebSocket URL is not configured, use in-memory progress emitter
    if (!WEBSOCKET_URL) {
      console.log('🔄 [FALLBACK MODE] No WebSocket URL configured, using in-memory progress emitter for job:', jobId);
      console.warn('⚠️ [FALLBACK MODE] This is NOT a real WebSocket connection - using in-memory simulation for development');
      
      setConnectionStatus('fallback');
      addMessage('system', { 
        action: 'fallback_mode_activated', 
        jobId, 
        method: 'in-memory', 
        warning: 'NOT REAL WEBSOCKET - Development fallback mode active',
        reason: 'NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT not configured'
      }, undefined, true);

      // Subscribe to progress updates using the in-memory emitter
      unsubscribeRef.current = subscribeToProgress(jobId, (progressEvent) => {
        console.log('📡 [FALLBACK MODE] Received progress from in-memory emitter:', progressEvent);
        
        const progress: StepProgress = {
          jobId: progressEvent.jobId,
          stepName: progressEvent.stepName,
          status: progressEvent.status as StepProgress['status'],
          message: progressEvent.message ? `[FALLBACK] ${progressEvent.message}` : '[FALLBACK] Progress update',
          data: progressEvent.details,
          timestamp: progressEvent.timestamp,
          isFallback: true
        };
        
        setProgressUpdates(prev => {
          const existingIndex = prev.findIndex(p => p.stepName === progress.stepName && p.status !== 'completed');
          if (existingIndex > -1) {
            const newProgress = [...prev];
            newProgress[existingIndex] = progress;
            return newProgress;
          }
          return [...prev, progress];
        });
        
        if (onProgress) {
          onProgress(progress);
        }
        
        // Add fallback indicator to message
        const fallbackEvent = {
          ...progressEvent,
          message: `[FALLBACK MODE] ${progressEvent.message || 'Progress update'}`
        };
        
        addMessage('received', fallbackEvent, JSON.stringify(fallbackEvent), true);
      });

      addMessage('system', { 
        action: 'fallback_connected', 
        jobId, 
        method: 'in-memory',
        status: 'Listening for progress via in-memory emitter (NOT WebSocket)',
        warning: 'This is development fallback mode - not production WebSocket'
      }, undefined, true);
      return;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.warn('[WebSocket] Already connected.');
      return;
    }

    setConnectionStatus('connecting');
    addMessage('system', { action: 'connecting', jobId, url: WEBSOCKET_URL });

    try {
      const url = new URL(WEBSOCKET_URL);
      url.searchParams.set('userId', actualUserId);
      url.searchParams.set('jobId', jobId);
      
      console.log('[WebSocket Debug] Connection parameters:', { 
        userId: actualUserId, 
        jobId, 
        finalUrl: url.toString() 
      });

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connection opened successfully for job:', jobId);
        setConnectionStatus('connected');
        addMessage('system', { action: 'connected', jobId });
      };

      ws.onmessage = (event) => {
        try {
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
            if (onProgress) {
              onProgress(progress);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
          addMessage('system', { error: 'Failed to parse message', raw: event.data });
        }
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', { code: event.code, reason: event.reason });
        setConnectionStatus('disconnected');
        addMessage('system', { action: 'disconnected', code: event.code, reason: event.reason });
        wsRef.current = null;
      };

      ws.onerror = (errorEvent) => {
        console.error('[WebSocket] Connection error:', errorEvent);
        setConnectionStatus('error');
        onError?.('WebSocket connection error.');
        addMessage('system', { action: 'error', error: 'WebSocket connection error' });
        wsRef.current = null;
      };

    } catch (error) {
      console.error('[WebSocket] Error creating connection:', error);
      setConnectionStatus('error');
      onError?.('Failed to create WebSocket connection.');
    }
  }, [addMessage, onError, onProgress]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    
    // Create message directly instead of using addMessage to avoid dependency loop
    const disconnectMessage: WebSocketMessage = {
      id: `${Date.now()}-${messageIdCounter.current++}`,
      timestamp: new Date().toISOString(),
      type: 'system',
      data: { action: 'manual_disconnect' }
    };
    setMessages(prev => [...prev, disconnectMessage]);
  }, []); // Remove addMessage dependency to prevent infinite loop
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    connectionStatus,
    messages,
    progressUpdates,
  };
}; 