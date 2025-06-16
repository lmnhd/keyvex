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
  // Sanitize data to avoid circular references
  const sanitizeData = useCallback((data: any): any => {
    try {
      // First pass - handle known problematic objects
      const sanitized = JSON.parse(JSON.stringify(data, (key, value) => {
        // Handle DOM elements
        if (value instanceof Element) {
          return {
            type: 'DOM_ELEMENT',
            tagName: value.tagName?.toLowerCase(),
            id: value.id || undefined,
            className: value.className || undefined,
            textContent: value.textContent?.substring(0, 100) || undefined,
          };
        }
        
        // Handle React Fiber nodes
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'FiberNode') {
          return '[REACT_FIBER]';
        }
        
        // Handle functions
        if (typeof value === 'function') {
          return `[FUNCTION: ${value.name || 'anonymous'}]`;
        }
        
        // Skip problematic React internal properties
        if (typeof key === 'string' && (key.startsWith('__react') || key.startsWith('_'))) {
          return '[INTERNAL_PROPERTY]';
        }
        
        return value;
      }));
      
      return sanitized;
    } catch (error) {
      return { error: 'Data serialization failed', originalType: typeof data };
    }
  }, []);

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
      data: sanitizeData(data),
      severity,
      message: message || `${type.replace('_', ' ')} event`,
    };
  }, [sanitizeData]);

  // Add event to the queue - use flushSync to ensure immediate update but avoid render issues
  const addEvent = useCallback((event: DebugEvent) => {
    if (!config.enabled) return;
    
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
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
    }, 0);
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

  // Function call interception - Monitor calculation functions
  useEffect(() => {
    if (!isEnabled || !config.enabled) return;

    console.log('🐛 DEBUG: Setting up function call monitoring for toolId:', toolId);

    // Store original console.log to avoid infinite loops
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    // Track original function implementations
    const originalFunctions = new Map<string, Function>();

    // Function to wrap and monitor function calls
    const wrapFunction = (obj: any, funcName: string, contextName: string = 'window') => {
      if (typeof obj[funcName] === 'function' && !originalFunctions.has(`${contextName}.${funcName}`)) {
        const originalFunc = obj[funcName];
        originalFunctions.set(`${contextName}.${funcName}`, originalFunc);

        obj[funcName] = function(...args: any[]) {
          const startTime = performance.now();
          let returnValue: any;
          let success = true;
          let errorMessage: string | undefined;

          try {
            // Call original function
            returnValue = originalFunc.apply(this, args);
            
            // Handle promises
            if (returnValue && typeof returnValue.then === 'function') {
              returnValue.then((result: any) => {
                const endTime = performance.now();
                const event = createEvent('function_call', {
                  functionName: funcName,
                  contextName,
                  arguments: args.length > 0 ? args : undefined,
                  returnValue: result,
                  executionTime: endTime - startTime,
                  success: true,
                  isAsync: true,
                }, 'success', `Called: ${funcName} (${args.length} args) → ${JSON.stringify(result)?.substring(0, 50)}`);
                
                addEvent(event);
                originalConsoleLog('🐛 DEBUG: Async function call:', funcName, 'returned:', result);
              }).catch((error: any) => {
                const endTime = performance.now();
                const event = createEvent('function_call', {
                  functionName: funcName,
                  contextName,
                  arguments: args.length > 0 ? args : undefined,
                  error: error.message || String(error),
                  executionTime: endTime - startTime,
                  success: false,
                  isAsync: true,
                }, 'error', `Error in ${funcName}: ${error.message || String(error)}`);
                
                addEvent(event);
                originalConsoleError('🐛 DEBUG: Async function error:', funcName, error);
              });
            } else {
              // Synchronous function
              const endTime = performance.now();
              const event = createEvent('function_call', {
                functionName: funcName,
                contextName,
                arguments: args.length > 0 ? args : undefined,
                returnValue,
                executionTime: endTime - startTime,
                success: true,
                isAsync: false,
              }, 'success', `Called: ${funcName} (${args.length} args)${returnValue !== undefined ? ` → ${JSON.stringify(returnValue)?.substring(0, 50)}` : ''}`);
              
              addEvent(event);
              originalConsoleLog('🐛 DEBUG: Function call:', funcName, 'args:', args, 'returned:', returnValue);
            }

          } catch (error: any) {
            success = false;
            errorMessage = error.message || String(error);
            const endTime = performance.now();
            
            const event = createEvent('function_call', {
              functionName: funcName,
              contextName,
              arguments: args.length > 0 ? args : undefined,
              error: errorMessage,
              executionTime: endTime - startTime,
              success: false,
              isAsync: false,
            }, 'error', `Error in ${funcName}: ${errorMessage}`);
            
            addEvent(event);
            originalConsoleError('🐛 DEBUG: Function error:', funcName, error);
            
            // Re-throw the error to maintain original behavior
            throw error;
          }

          return returnValue;
        };

        originalConsoleLog('🐛 DEBUG: Wrapped function:', `${contextName}.${funcName}`);
      }
    };

    // DYNAMIC FUNCTION DETECTION - Find calculation-related functions (with filtering)
    const findCalculationFunctions = (obj: any, contextName: string) => {
      if (!obj || typeof obj !== 'object') return;
      
      // CRITICAL: Exclude browser built-in functions that cause infinite loops
      const excludedFunctions = new Set([
        'getcomputedstyle', 'queryselector', 'queryselectorall', 'addeventlistener',
        'removeeventlistener', 'settimeout', 'setinterval', 'requestanimationframe',
        'getboundingclientrect', 'scrollto', 'scrollintoview', 'focus', 'blur',
        'click', 'dispatchevent', 'createelement', 'createtextnode', 'append',
        'remove', 'setattribute', 'getattribute', 'classlist', 'style',
        'offsetwidth', 'offsetheight', 'clientwidth', 'clientheight'
      ]);
      
      Object.getOwnPropertyNames(obj).forEach(propName => {
        if (typeof obj[propName] === 'function') {
          const funcName = propName.toLowerCase();
          
          // Skip browser built-ins and system functions
          if (excludedFunctions.has(funcName) || 
              funcName.startsWith('webkit') || 
              funcName.startsWith('moz') || 
              funcName.startsWith('ms') ||
              funcName.includes('internal') ||
              funcName.includes('prototype')) {
            return;
          }
          
          // Check if function name suggests it's calculation-related
          const isCalculationFunction = 
            funcName.includes('calculate') ||
            funcName.includes('compute') ||
            funcName.includes('process') ||
            funcName.includes('estimate') ||
            funcName.includes('analyze') ||
            funcName.includes('evaluate') ||
            funcName.includes('assess') ||
            funcName.includes('determine') ||
            funcName.includes('generate') ||
            funcName.includes('total') ||
            funcName.includes('sum') ||
            funcName.includes('score') ||
            funcName.includes('rating') ||
            funcName.includes('ranking') ||
            funcName.includes('budget') ||
            funcName.includes('payment') ||
            funcName.includes('loan') ||
            funcName.includes('mortgage') ||
            funcName.includes('interest') ||
            funcName.includes('roi') ||
            funcName.includes('profit') ||
            funcName.includes('savings') ||
            funcName.includes('tax') ||
            funcName.includes('afford') ||
            (funcName.startsWith('handle') && (
              funcName.includes('submit') ||
              funcName.includes('calc') ||
              funcName.includes('run') ||
              funcName.includes('exec')
            ));

          if (isCalculationFunction && !originalFunctions.has(`${contextName}.${propName}`)) {
            console.log('🎯 DEBUG: Auto-detected calculation function:', `${contextName}.${propName}`);
            wrapFunction(obj, propName, contextName);
          }
        }
      });
    };

    // Check window object for calculation functions (limited scope to avoid infinite loops)
    // Only check specific properties that might contain user-defined calculation functions
    const windowCalculationProps = [
      'calculateNeighborhoodScore', 'calculateMortgage', 'calculateLoan', 'calculateROI',
      'handleCalculate', 'handleSubmit', 'processCalculation', 'runCalculation'
    ];
    
    windowCalculationProps.forEach(propName => {
      if (typeof (window as any)[propName] === 'function' && !originalFunctions.has(`window.${propName}`)) {
        console.log('🎯 DEBUG: Found specific calculation function on window:', propName);
        wrapFunction(window, propName, 'window');
      }
    });

    // Monitor React component instances - Look for calculation functions in tool container
    const checkForCalculationFunctions = () => {
      const toolContainer = document.querySelector('[data-tool-container="true"]');
      if (!toolContainer) return;

      // ENHANCED: Check for React component instances and their methods
      const walkReactTree = (fiber: any, depth = 0) => {
        if (!fiber || depth > 5) return; // Prevent infinite recursion
        
        try {
          // Check component instance for calculation methods
          if (fiber.stateNode && typeof fiber.stateNode === 'object') {
            const instance = fiber.stateNode;
            
            // Look for calculation methods on the component instance
            Object.getOwnPropertyNames(Object.getPrototypeOf(instance) || {}).forEach(methodName => {
              if (typeof instance[methodName] === 'function') {
                const funcName = methodName.toLowerCase();
                const isCalculationMethod = 
                  funcName.includes('calculate') ||
                  funcName.includes('compute') ||
                  funcName.includes('process') ||
                  funcName.includes('handle') && (
                    funcName.includes('submit') ||
                    funcName.includes('calc') ||
                    funcName.includes('run')
                  );

                if (isCalculationMethod && !originalFunctions.has(`component.${methodName}`)) {
                  console.log('🎯 DEBUG: Auto-detected React component method:', methodName);
                  wrapFunction(instance, methodName, 'component');
                }
              }
            });
          }

          // Check memoizedProps for function handlers
          if (fiber.memoizedProps) {
            Object.keys(fiber.memoizedProps).forEach(propName => {
              if (typeof fiber.memoizedProps[propName] === 'function') {
                const funcName = propName.toLowerCase();
                const isCalculationHandler = 
                  funcName.includes('calculate') ||
                  funcName.includes('onclick') ||
                  funcName.includes('onsubmit') ||
                  funcName.includes('handle');

                if (isCalculationHandler && !originalFunctions.has(`props.${propName}`)) {
                  console.log('🎯 DEBUG: Auto-detected prop handler:', propName);
                  // Note: We can't easily wrap props functions as they're recreated on each render
                  // But we can log their detection for debugging
                }
              }
            });
          }

          // Recursively check child and sibling fibers
          if (fiber.child) walkReactTree(fiber.child, depth + 1);
          if (fiber.sibling) walkReactTree(fiber.sibling, depth + 1);
        } catch (error) {
          console.warn('🐛 DEBUG: Error walking React tree:', error);
        }
      };

      // Start walking from the tool container's React fiber
      const reactFiber = (toolContainer as any)._reactInternalFiber || 
                        (toolContainer as any).__reactInternalInstance ||
                        (toolContainer as any)._reactInternals;
      
      if (reactFiber) {
        walkReactTree(reactFiber);
      }

      // ENHANCED: Look for React component functions by examining button onClick handlers
      try {
        const toolContainer = document.querySelector('[data-tool-container="true"]');
        if (toolContainer) {
          // Find all buttons that might trigger calculations
          const buttons = toolContainer.querySelectorAll('button');
          buttons.forEach(button => {
            const buttonText = button.textContent?.toLowerCase() || '';
            const isCalculationButton = ['calculate', 'compute', 'submit', 'start', 'quiz', 'run'].some(keyword => 
              buttonText.includes(keyword)
            );

            if (isCalculationButton) {
              // Get the React Fiber node for this button to access its props
              const fiberKey = Object.keys(button).find(key => 
                key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
              );
              
              if (fiberKey) {
                const fiber = (button as any)[fiberKey];
                let currentFiber = fiber;
                
                // Walk up the fiber tree to find the component that contains calculation functions
                while (currentFiber) {
                  if (currentFiber.memoizedProps && currentFiber.memoizedProps.onClick) {
                    const onClickHandler = currentFiber.memoizedProps.onClick;
                    
                    // Try to extract function name from the handler
                    const handlerString = onClickHandler.toString();
                    const calculateMatches = handlerString.match(/(\w*[Cc]alculate\w*)\s*\(/g);
                    
                    if (calculateMatches) {
                      calculateMatches.forEach((match: string) => {
                        const funcName = match.replace(/\s*\(.*$/, '');
                        console.log('🎯 DEBUG: Found calculation function in onClick handler:', funcName);
                        
                        // Try to patch the function by monkey-patching the onClick handler
                        if (!originalFunctions.has(`component.${funcName}`)) {
                          try {
                            // Create a wrapper for the onClick handler that logs the calculation
                            const originalOnClick = currentFiber.memoizedProps.onClick;
                            const wrappedOnClick = function(this: any, ...args: any[]) {
                              console.log('🎯 DEBUG: Button click triggering calculation functions');
                              
                              // Log before execution
                              const event = createEvent('function_call', {
                                functionName: funcName,
                                triggeredBy: 'button_click',
                                buttonText: button.textContent,
                                handlerDetected: true,
                              }, 'info', `Detected calculation: ${funcName} triggered by button`);
                              
                              addEvent(event);
                              
                              // Execute original handler and capture any errors
                              try {
                                const result = originalOnClick.apply(this, args);
                                
                                // Log successful execution
                                const successEvent = createEvent('calculation', {
                                  functionName: funcName,
                                  success: true,
                                  executionComplete: true,
                                }, 'success', `Calculation ${funcName} completed successfully`);
                                
                                addEvent(successEvent);
                                
                                return result;
                              } catch (error) {
                                // Log any errors during calculation
                                const errorEvent = createEvent('error', {
                                  functionName: funcName,
                                  error: error instanceof Error ? error.message : String(error),
                                  stack: error instanceof Error ? error.stack : undefined,
                                }, 'error', `Error in calculation ${funcName}: ${error}`);
                                
                                addEvent(errorEvent);
                                throw error;
                              }
                            };
                            
                            // Replace the onClick handler (this is aggressive but necessary for detection)
                            currentFiber.memoizedProps.onClick = wrappedOnClick;
                            originalFunctions.set(`component.${funcName}`, originalOnClick);
                            
                            console.log('🎯 DEBUG: Successfully wrapped onClick handler for:', funcName);
                          } catch (wrapError) {
                            console.warn('🐛 DEBUG: Could not wrap onClick handler:', wrapError);
                          }
                        }
                      });
                    }
                  }
                  
                  currentFiber = currentFiber.return;
                }
              }
            }
          });
        }
      } catch (error) {
        console.warn('🐛 DEBUG: Error checking React component functions:', error);
      }
    };

    // Initial check for functions (run once, not periodically to prevent loops)
    setTimeout(() => {
      // Check specific window properties once
      windowCalculationProps.forEach(propName => {
        if (typeof (window as any)[propName] === 'function' && !originalFunctions.has(`window.${propName}`)) {
          console.log('🎯 DEBUG: Found calculation function on window:', propName);
          wrapFunction(window, propName, 'window');
        }
      });

      // Check React components once
      try {
        checkForCalculationFunctions();
      } catch (error) {
        console.warn('🐛 DEBUG: Error during function check:', error);
      }
          }, 1000); // Run once after 1 second

    // Immediate check
    checkForCalculationFunctions();

    // ENHANCED: Monitor React state changes to detect calculation results
    // This is more reliable than function interception for React components
    let lastStateSnapshot: Record<string, any> = {};
    const monitorStateChanges = () => {
      const toolContainer = document.querySelector('[data-tool-container="true"]');
      if (!toolContainer) return;

      // Look for elements that might display calculation results
      const resultElements = toolContainer.querySelectorAll('[data-style-id*="result"], [data-style-id*="score"], [data-style-id*="total"], [data-style-id*="calculation"]');
      const currentSnapshot: Record<string, any> = {};

      resultElements.forEach((element, index) => {
        const text = element.textContent?.trim() || '';
        const elementKey = element.getAttribute('data-style-id') || `element-${index}`;
        currentSnapshot[elementKey] = text;

        // Check if this element's content changed and contains calculation-like data
        if (lastStateSnapshot[elementKey] !== text && text) {
          // Look for numeric patterns that suggest calculation results
          const numericPattern = /(\d+(?:\.\d+)?)/g;
          const numbers = text.match(numericPattern);
          
          if (numbers && numbers.length > 0) {
            console.log('🎯 DEBUG: Detected calculation result via state change:', elementKey, text);
            
            const event = createEvent('calculation', {
              elementId: elementKey,
              resultText: text,
              detectedNumbers: numbers,
              changeType: 'state_update',
              previousValue: lastStateSnapshot[elementKey] || 'empty',
              newValue: text,
            }, 'success', `Calculation result: ${text.substring(0, 50)}`);
            
            addEvent(event);
          }
        }
      });

      // Also monitor for any text content that changes and contains score/calculation keywords
      const allElements = toolContainer.querySelectorAll('*');
      allElements.forEach((element, index) => {
        const text = element.textContent?.trim() || '';
        const elementKey = `content-${index}`;
        
        if (text !== lastStateSnapshot[elementKey] && text) {
          const hasCalculationKeywords = ['score', 'total', 'result', 'calculation', 'neighborhood'].some(keyword => 
            text.toLowerCase().includes(keyword)
          );
          
          const hasNumbers = /\d+/.test(text);
          
          // Skip content change detection to prevent infinite loops
          // This was causing the debug system to detect its own event additions
          // and create new events continuously
        }
        
        currentSnapshot[elementKey] = text;
      });

      lastStateSnapshot = currentSnapshot;
    };

    // Set up state monitoring interval
    const stateMonitorInterval = setInterval(monitorStateChanges, 500);

    // Monitor console for calculation results (common pattern in generated tools)
    const originalConsoleLogForCalculations = console.log;
    console.log = function(...args: any[]) {
      // Look for calculation patterns in console output
      const message = args.join(' ');
      if (message.includes('calculate') || message.includes('result') || message.includes('total') || message.includes('score')) {
        const event = createEvent('calculation', {
          consoleOutput: args,
          detectedCalculation: true,
        }, 'info', `Calculation detected in console: ${message.substring(0, 100)}`);
        
        addEvent(event);
      }
      
      // Call original console.log
      return originalConsoleLogForCalculations.apply(console, args);
    };

    // Cleanup
    return () => {
      originalConsoleLog('🐛 DEBUG: Cleaning up function call monitoring for toolId:', toolId);
      
      // Restore original functions
      originalFunctions.forEach((originalFunc, key) => {
        const [contextName, funcName] = key.split('.');
        if (contextName === 'window' && (window as any)[funcName]) {
          (window as any)[funcName] = originalFunc;
        }
      });

      // Restore console.log
      console.log = originalConsoleLogForCalculations;

      // Clear intervals
      clearInterval(stateMonitorInterval);
      
      originalFunctions.clear();
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

  // Enhanced state variable tracking with calculation detection
  const trackStateVariable = useCallback((name: string, value: any, type?: string) => {
    setCurrentState(prevState => {
      const previousValue = prevState.variables[name]?.value;
      const isNewVariable = previousValue === undefined;
      const hasValueChanged = !isNewVariable && previousValue !== value;
      
      const newVariables = {
        ...prevState.variables,
        [name]: {
          value,
          type: type || typeof value,
          lastChanged: Date.now(),
          changeCount: (prevState.variables[name]?.changeCount || 0) + 1,
        },
      };

      // Detect if this looks like a calculation result
      const isCalculationResult = (() => {
        // Check if variable name suggests it's a result
        const resultNames = ['result', 'total', 'calculation', 'amount', 'payment', 'savings', 'profit', 'score', 'rating', 'percentage', 'balance', 'interest', 'tax', 'income', 'expense'];
        const nameContainsResult = resultNames.some(keyword => name.toLowerCase().includes(keyword));
        
        // Check if value looks like a calculation result (numeric)
        const isNumeric = typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
        
        // Check if this is a significant change (not just input tracking)
        const isSignificantChange = hasValueChanged && isNumeric && Math.abs(parseFloat(String(value)) || 0) > 0;
        
        return nameContainsResult || (isSignificantChange && !name.toLowerCase().includes('input'));
      })();

      // Determine severity and message
      let severity: 'info' | 'success' | 'warning' | 'error' = 'info';
      let message = `State: ${name} = ${JSON.stringify(value)}`;
      
      if (isCalculationResult) {
        severity = 'success';
        message = `Calculation result: ${name} → ${JSON.stringify(value)}`;
      } else if (hasValueChanged) {
        message = `State updated: ${name} → ${JSON.stringify(value)}`;
      } else if (isNewVariable) {
        message = `State initialized: ${name} = ${JSON.stringify(value)}`;
      }

      // Log state change event
      const event = createEvent('state_change', {
        variableName: name,
        previousValue,
        newValue: value,
        changeType: isNewVariable ? 'initialize' : 'update' as const,
        isCalculationResult,
        isNumericValue: typeof value === 'number',
        valueType: typeof value,
      }, severity, message);
      
      addEvent(event);

      // If this looks like a calculation result, also log as a calculation event
      if (isCalculationResult && hasValueChanged) {
        const calculationEvent = createEvent('calculation', {
          resultVariable: name,
          calculatedValue: value,
          previousValue,
          detectedVia: 'stateTracking',
          valueType: typeof value,
        }, 'success', `Calculated: ${name} = ${JSON.stringify(value)}`);
        
        addEvent(calculationEvent);
      }

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