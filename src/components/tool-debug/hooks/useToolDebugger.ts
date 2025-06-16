'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  DebugEvent, 
  DebugEventType, 
  ToolState, 
  DebugConfig, 
  DebugSession, 
  UseToolDebuggerReturn,
  PerformanceMetrics
} from '../types/debug-types';

// Default configuration
const DEFAULT_CONFIG: DebugConfig = {
  enabled: true,
  eventTypes: ['click', 'input_change', 'state_change', 'function_call', 'error', 'calculation'],
  maxEvents: 1000,
  autoScroll: true,
  showTimestamps: true,
  highlightErrors: true,
  collectPerformance: true,
  exportEnabled: true,
};

// Default state
const DEFAULT_STATE: ToolState = {
  variables: {},
  errors: [],
  performance: {
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    eventCount: 0,
    errorCount: 0,
    warningCount: 0,
  },
  lastActivity: Date.now(),
};

export function useToolDebugger(toolId: string): UseToolDebuggerReturn {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [currentState, setCurrentState] = useState<ToolState>(DEFAULT_STATE);
  const [config, setConfig] = useState<DebugConfig>(DEFAULT_CONFIG);
  const sessionStartTime = useRef<number>(Date.now());
  const eventCounter = useRef<number>(0);

  // Generate unique event ID
  const generateEventId = useCallback(() => {
    eventCounter.current += 1;
    return `${toolId}-event-${eventCounter.current}-${Date.now()}`;
  }, [toolId]);

  // Log a new debug event
  const logEvent = useCallback((eventData: Omit<DebugEvent, 'id' | 'timestamp'>) => {
    if (!config.enabled) return;
    if (!config.eventTypes.includes(eventData.type)) return;

    const event: DebugEvent = {
      ...eventData,
      id: generateEventId(),
      timestamp: Date.now(),
    };

    setEvents(prevEvents => {
      const newEvents = [...prevEvents, event];
      
      // Enforce max events limit
      if (newEvents.length > config.maxEvents) {
        return newEvents.slice(-config.maxEvents);
      }
      
      return newEvents;
    });

    // Update state based on event type
    setCurrentState(prevState => {
      const newState = { ...prevState };
      newState.lastActivity = event.timestamp;
      
      // Update performance metrics
      newState.performance = {
        ...prevState.performance,
        eventCount: prevState.performance.eventCount + 1,
      };

      switch (event.type) {
        case 'error':
          newState.errors = [...prevState.errors, event as any];
          newState.performance.errorCount += 1;
          break;
          
        case 'state_change':
          if (event.data?.variableName) {
            const varName = event.data.variableName;
            const existingVar = prevState.variables[varName];
            newState.variables = {
              ...prevState.variables,
              [varName]: {
                value: event.data.newValue,
                type: typeof event.data.newValue,
                lastChanged: event.timestamp,
                changeCount: (existingVar?.changeCount || 0) + 1,
              },
            };
          }
          break;
          
        case 'render':
          if (config.collectPerformance && event.data?.renderTime) {
            const renderCount = prevState.performance.renderCount + 1;
            const totalTime = (prevState.performance.averageRenderTime * prevState.performance.renderCount) + event.data.renderTime;
            newState.performance = {
              ...prevState.performance,
              renderCount,
              lastRenderTime: event.data.renderTime,
              averageRenderTime: totalTime / renderCount,
            };
          }
          break;
          
        default:
          if (event.severity === 'warning') {
            newState.performance.warningCount += 1;
          }
          break;
      }
      
      return newState;
    });

    // Auto-scroll if enabled (this would be handled by the UI components)
    if (config.autoScroll) {
      setTimeout(() => {
        const debugContainer = document.querySelector('[data-debug-events-container]');
        if (debugContainer) {
          debugContainer.scrollTop = debugContainer.scrollHeight;
        }
      }, 100);
    }
  }, [config, generateEventId]);

  // Clear all events and reset state
  const clearEvents = useCallback(() => {
    setEvents([]);
    setCurrentState({
      ...DEFAULT_STATE,
      lastActivity: Date.now(),
    });
    eventCounter.current = 0;
  }, []);

  // Export current session data
  const exportSession = useCallback((): DebugSession => {
    const now = Date.now();
    return {
      sessionId: `${toolId}-session-${sessionStartTime.current}`,
      toolId,
      toolMetadata: {
        title: toolId,
        type: 'generated-tool',
        generatedAt: sessionStartTime.current,
      },
      startTime: sessionStartTime.current,
      endTime: now,
      events,
      finalState: currentState,
      config,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      browserInfo: typeof window !== 'undefined' ? {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown',
        version: 'unknown',
      } : undefined,
    };
  }, [toolId, events, currentState, config]);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<DebugConfig>) => {
    setConfig(prevConfig => ({ ...prevConfig, ...newConfig }));
  }, []);

  // Cleanup old events periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      setEvents(prevEvents => 
        prevEvents.filter(event => now - event.timestamp < maxAge)
      );
    }, 60 * 60 * 1000); // Run every hour

    return () => clearInterval(cleanup);
  }, []);

  // Performance monitoring
  useEffect(() => {
    if (!config.collectPerformance) return;

    const startTime = performance.now();
    
    return () => {
      const renderTime = performance.now() - startTime;
      logEvent({
        type: 'render',
        severity: 'info',
        message: `Component render completed in ${renderTime.toFixed(2)}ms`,
        data: { renderTime },
      });
    };
  });

  return {
    events,
    currentState,
    config,
    logEvent,
    clearEvents,
    exportSession,
    updateConfig,
    isEnabled: config.enabled,
  };
}

// Helper hook for common event logging patterns
export function useEventLogger(logEvent: (event: Omit<DebugEvent, 'id' | 'timestamp'>) => void) {
  const logClick = useCallback((element: HTMLElement, additionalData?: Record<string, any>) => {
    logEvent({
      type: 'click',
      severity: 'info',
      message: `Clicked ${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`,
      data: {
        elementType: element.tagName.toLowerCase(),
        elementId: element.id,
        elementClass: element.className,
        textContent: element.textContent?.slice(0, 50),
        ...additionalData,
      },
      elementInfo: {
        id: element.id,
        className: element.className,
        tagName: element.tagName,
        textContent: element.textContent?.slice(0, 100),
      },
    });
  }, [logEvent]);

  const logInputChange = useCallback((element: HTMLInputElement, previousValue: any, newValue: any) => {
    logEvent({
      type: 'input_change',
      severity: 'info',
      message: `Input changed: ${element.name || element.id || 'unnamed'} = "${newValue}"`,
      data: {
        inputName: element.name,
        inputType: element.type,
        previousValue,
        newValue,
        elementId: element.id,
      },
      elementInfo: {
        id: element.id,
        className: element.className,
        tagName: element.tagName,
      },
    });
  }, [logEvent]);

  const logStateChange = useCallback((variableName: string, previousValue: any, newValue: any, trigger?: string) => {
    logEvent({
      type: 'state_change',
      severity: 'info',
      message: `State changed: ${variableName} = ${JSON.stringify(newValue)}`,
      data: {
        variableName,
        previousValue,
        newValue,
        changeType: 'update',
        trigger,
      },
    });
  }, [logEvent]);

  const logFunctionCall = useCallback((functionName: string, params: any[], result: any, executionTime: number) => {
    logEvent({
      type: 'function_call',
      severity: 'info',
      message: `Function called: ${functionName}() → ${JSON.stringify(result)}`,
      data: {
        functionName,
        parameters: params,
        returnValue: result,
        executionTime,
        success: true,
      },
    });
  }, [logEvent]);

  const logError = useCallback((error: Error, context?: Record<string, any>) => {
    logEvent({
      type: 'error',
      severity: 'error',
      message: `Error: ${error.message}`,
      data: {
        errorType: error.name,
        errorMessage: error.message,
        recoverable: true,
        ...context,
      },
      stackTrace: error.stack,
    });
  }, [logEvent]);

  const logCalculation = useCallback((type: string, inputs: Record<string, any>, outputs: Record<string, any>, steps?: any[]) => {
    logEvent({
      type: 'calculation',
      severity: 'success',
      message: `Calculation completed: ${type}`,
      data: {
        calculationType: type,
        inputs,
        outputs,
        steps,
        duration: 0, // Could be measured if needed
      },
    });
  }, [logEvent]);

  return {
    logClick,
    logInputChange,
    logStateChange,
    logFunctionCall,
    logError,
    logCalculation,
  };
}