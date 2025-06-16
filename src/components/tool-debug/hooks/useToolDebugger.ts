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

export function useToolDebugger(toolId: string): UseToolDebuggerReturn {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [currentState, setCurrentState] = useState<ToolState>({
    variables: {},
    errors: [],
    performance: {
      renderCount: 0,
      eventCount: 0,
      errorCount: 0,
      warningCount: 0,
      memoryUsage: 0,
      lastRenderTime: Date.now(),
      averageRenderTime: 0,
    },
    lastActivity: Date.now(),
  });
  const [config, setConfig] = useState<DebugConfig>(DEFAULT_CONFIG);
  const [isEnabled, setIsEnabled] = useState(true);
  
  const eventsRef = useRef<DebugEvent[]>([]);
  const performanceRef = useRef<PerformanceMetrics>(currentState.performance);

  // Create a debug event
  const createEvent = useCallback((
    type: DebugEventType,
    data: any,
    severity: 'info' | 'warning' | 'error' | 'success' = 'info',
    message?: string
  ): DebugEvent => {
    return {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      data,
      severity,
      message: message || `${type.replace('_', ' ')} event`,
    };
  }, []);

  // Add event to the queue
  const addEvent = useCallback((event: DebugEvent) => {
    if (!config.enabled) return;
    
    setEvents(prevEvents => {
      const newEvents = [...prevEvents, event];
      // Limit events to prevent memory issues
      if (newEvents.length > config.maxEvents) {
        newEvents.splice(0, newEvents.length - config.maxEvents);
      }
      eventsRef.current = newEvents;
      return newEvents;
    });

    // Update performance metrics
    setCurrentState(prevState => {
      const newPerformance = {
        ...prevState.performance,
        eventCount: prevState.performance.eventCount + 1,
        errorCount: event.severity === 'error' ? prevState.performance.errorCount + 1 : prevState.performance.errorCount,
        warningCount: event.severity === 'warning' ? prevState.performance.warningCount + 1 : prevState.performance.warningCount,
      };
      performanceRef.current = newPerformance;
      
      return {
        ...prevState,
        performance: newPerformance,
        lastActivity: Date.now(),
      };
    });
  }, [config.enabled, config.maxEvents]);

  // GLOBAL EVENT CAPTURE - Monitor the entire document for events
  useEffect(() => {
    if (!isEnabled || !config.enabled) return;

    console.log('🐛 DEBUG: Starting global event monitoring for toolId:', toolId);

    // Create event listeners that capture events globally
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Only capture events from within the tool renderer area
      const toolContainer = document.querySelector('[data-tool-container="true"]');
      if (!toolContainer || !toolContainer.contains(target)) return;

      const event = createEvent('click', {
        elementType: target.tagName.toLowerCase(),
        elementId: target.id || undefined,
        elementClass: target.className || undefined,
        elementText: target.textContent?.substring(0, 50) || undefined,
        coordinates: { x: e.clientX, y: e.clientY },
        button: e.button,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
      }, 'info', `Click on ${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}`);
      
      addEvent(event);
      console.log('🐛 DEBUG: Captured click event:', event);
    };

    const handleGlobalInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      
      // Only capture events from within the tool renderer area
      const toolContainer = document.querySelector('[data-tool-container="true"]');
      if (!toolContainer || !toolContainer.contains(target)) return;

      // Handle different input types
      const inputData: any = {
        elementType: target.type || target.tagName.toLowerCase(),
        elementId: target.id || undefined,
        elementName: target.name || undefined,
        value: target.value,
      };

      // Add type-specific data
      if (target.type === 'checkbox' || target.type === 'radio') {
        inputData.checked = target.checked;
      }

      // Handle select elements
      if (target.tagName.toLowerCase() === 'select') {
        const selectElement = target as unknown as HTMLSelectElement;
        inputData.selectedIndex = selectElement.selectedIndex;
      }

      const event = createEvent('input_change', inputData, 'info', 
        `Input changed: ${target.name || target.id || 'input'} = "${target.value}"`);
      
      addEvent(event);
      console.log('🐛 DEBUG: Captured input event:', event);
    };

    const handleGlobalChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      
      // Only capture events from within the tool renderer area
      const toolContainer = document.querySelector('[data-tool-container="true"]');
      if (!toolContainer || !toolContainer.contains(target)) return;

      const changeData: any = {
        elementType: target.type || target.tagName.toLowerCase(),
        elementId: target.id || undefined,
        elementName: target.name || undefined,
        value: target.value,
        eventType: 'change',
      };

      if (target.type === 'checkbox' || target.type === 'radio') {
        changeData.checked = target.checked;
      }

      if (target.tagName.toLowerCase() === 'select') {
        const selectElement = target as unknown as HTMLSelectElement;
        changeData.selectedIndex = selectElement.selectedIndex;
      }

      const event = createEvent('input_change', changeData, 'info',
        `Change event: ${target.name || target.id || 'input'} = "${target.value}"`);
      
      addEvent(event);
      console.log('🐛 DEBUG: Captured change event:', event);
    };

    // Add global event listeners
    document.addEventListener('click', handleGlobalClick, true); // Use capture phase
    document.addEventListener('input', handleGlobalInput, true);
    document.addEventListener('change', handleGlobalChange, true);

    // Cleanup
    return () => {
      console.log('🐛 DEBUG: Cleaning up global event monitoring for toolId:', toolId);
      document.removeEventListener('click', handleGlobalClick, true);
      document.removeEventListener('input', handleGlobalInput, true);
      document.removeEventListener('change', handleGlobalChange, true);
    };
  }, [isEnabled, config.enabled, toolId, createEvent, addEvent]);

  // API for manually logging events (using correct signature)
  const logEvent = useCallback((event: Omit<DebugEvent, 'id' | 'timestamp'>) => {
    const fullEvent: DebugEvent = {
      id: `${event.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...event,
    };
    addEvent(fullEvent);
  }, [addEvent]);

  // State variable tracking
  const trackStateVariable = useCallback((name: string, value: any, type?: string) => {
    setCurrentState(prevState => {
      const newVariables = {
        ...prevState.variables,
        [name]: {
          value,
          type: type || typeof value,
          lastChanged: Date.now(),
          changeCount: (prevState.variables[name]?.changeCount || 0) + 1,
        },
      };

      // Log state change event
      const event = createEvent('state_change', {
        variableName: name,
        previousValue: prevState.variables[name]?.value,
        newValue: value,
        changeType: 'update' as const,
      }, 'info', `State: ${name} = ${JSON.stringify(value)}`);
      
      addEvent(event);

      return {
        ...prevState,
        variables: newVariables,
        lastActivity: Date.now(),
      };
    });
  }, [createEvent, addEvent]);

  // Clear all events
  const clearEvents = useCallback(() => {
    setEvents([]);
    eventsRef.current = [];
    
    const clearEvent: DebugEvent = {
      id: `clear_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'function_call',
      severity: 'info',
      message: 'Events cleared',
      data: {
        functionName: 'clearEvents',
        parameters: [],
        returnValue: null,
        executionTime: 0,
        success: true,
      },
    };
    
    setEvents([clearEvent]);
    eventsRef.current = [clearEvent];
  }, []);

  // Export session data
  const exportSession = useCallback((): DebugSession => {
    return {
      sessionId: `session_${Date.now()}`,
      toolId,
      toolMetadata: {
        title: 'Debug Session',
        type: 'tool',
        generatedAt: Date.now(),
      },
      startTime: events[0]?.timestamp || Date.now(),
      events: eventsRef.current,
      finalState: currentState,
      config,
      userAgent: navigator.userAgent,
    };
  }, [toolId, events, currentState, config]);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<DebugConfig>) => {
    setConfig(prevConfig => ({ ...prevConfig, ...newConfig }));
    
    const configEvent: DebugEvent = {
      id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'function_call',
      severity: 'info',
      message: 'Configuration updated',
      data: {
        functionName: 'updateConfig',
        parameters: [newConfig],
        returnValue: null,
        executionTime: 0,
        success: true,
      },
    };
    
    addEvent(configEvent);
  }, [addEvent]);

  // Initialize
  useEffect(() => {
    const initEvent: DebugEvent = {
      id: `init_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'function_call',
      severity: 'info',
      message: 'Debugger initialized',
      data: {
        functionName: 'initializeDebugger',
        parameters: [toolId],
        returnValue: null,
        executionTime: 0,
        success: true,
      },
    };
    
    addEvent(initEvent);
    setIsEnabled(true);
  }, [toolId, addEvent]);

  return {
    events,
    currentState,
    config,
    isEnabled,
    logEvent,
    clearEvents,
    exportSession,
    updateConfig,
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