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

    // Monitor calculation-related functions that are commonly generated
    const calculationFunctionNames = [
      'calculateMortgage', 'calculateLoan', 'calculateROI', 'calculateInvestment',
      'calculateBudget', 'calculateSavings', 'calculateTax', 'calculateMargin',
      'calculateProfit', 'calculateInterest', 'calculatePayment', 'calculateTotal',
      'calculateScore', 'calculateRatio', 'calculatePercentage', 'calculateGrowth',
      'calculate', 'compute', 'estimate', 'analyze', 'evaluate', 'assess',
      'handleCalculate', 'handleSubmit', 'handleGenerate', 'processCalculation',
      'performCalculation', 'runCalculation', 'executeCalculation'
    ];

    // Check for these functions on window object
    calculationFunctionNames.forEach(funcName => {
      if (typeof (window as any)[funcName] === 'function') {
        wrapFunction(window as any, funcName, 'window');
      }
    });

    // Monitor React component instances - Look for calculation functions in tool container
    const checkForCalculationFunctions = () => {
      const toolContainer = document.querySelector('[data-tool-container="true"]');
      if (toolContainer) {
        // Check for React fiber data that might contain function references
        const reactFiber = (toolContainer as any)._reactInternalFiber || 
                          (toolContainer as any).__reactInternalInstance ||
                          (toolContainer as any)._reactInternals;
        
        if (reactFiber && reactFiber.memoizedProps) {
          // Look for onClick handlers and other function props
          const props = reactFiber.memoizedProps;
          Object.keys(props).forEach(key => {
            if (key.startsWith('onClick') || key.startsWith('on') || key.includes('calculate') || key.includes('handle')) {
              if (typeof props[key] === 'function' && !originalFunctions.has(`component.${key}`)) {
                wrapFunction(props, key, 'component');
              }
            }
          });
        }
      }
    };

    // Set up periodic monitoring for new functions
    const functionMonitorInterval = setInterval(() => {
      // Re-check for new calculation functions
      calculationFunctionNames.forEach(funcName => {
        if (typeof (window as any)[funcName] === 'function' && !originalFunctions.has(`window.${funcName}`)) {
          wrapFunction(window as any, funcName, 'window');
        }
      });

      // Check React components
      checkForCalculationFunctions();
    }, 1000);

    // Immediate check
    checkForCalculationFunctions();

    // Monitor console for calculation results (common pattern in generated tools)
    const originalSetState = console.log;
    console.log = function(...args: any[]) {
      // Look for calculation patterns in console output
      const message = args.join(' ');
      if (message.includes('calculate') || message.includes('result') || message.includes('total')) {
        const event = createEvent('calculation', {
          consoleOutput: args,
          detectedCalculation: true,
        }, 'info', `Calculation detected: ${message.substring(0, 100)}`);
        
        addEvent(event);
      }
      
      // Call original console.log
      return originalConsoleLog.apply(console, args);
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
      console.log = originalConsoleLog;

      // Clear interval
      clearInterval(functionMonitorInterval);
      
      originalFunctions.clear();
    };
  }, [isEnabled, config.enabled, toolId, createEvent, addEvent]);

  // Enhanced calculation detection via DOM observation and button analysis
  useEffect(() => {
    if (!isEnabled || !config.enabled) return;

    console.log('🐛 DEBUG: Setting up enhanced calculation detection for toolId:', toolId);

    // Monitor DOM changes that might indicate calculation results
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Only monitor changes within the tool container
        const toolContainer = document.querySelector('[data-tool-container="true"]');
        if (!toolContainer || !toolContainer.contains(mutation.target as Node)) return;

        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          const target = mutation.target as HTMLElement;
          const textContent = target.textContent || '';
          
          // Detect calculation result patterns
          const calculationPatterns = [
            /\$[\d,]+\.?\d*/g, // Currency values
            /\d+\.?\d*%/g,     // Percentages  
            /[\d,]+\.?\d*/g,   // Numbers with decimals
          ];

          let hasCalculationPattern = false;
          let detectedValues: string[] = [];

          calculationPatterns.forEach(pattern => {
            const matches = textContent.match(pattern);
            if (matches && matches.length > 0) {
              hasCalculationPattern = true;
              detectedValues.push(...matches);
            }
          });

          // Look for result-related text
          const resultKeywords = ['result', 'total', 'calculation', 'amount', 'payment', 'savings', 'profit', 'loss', 'balance', 'score', 'rating', 'percentage'];
          const hasResultKeyword = resultKeywords.some(keyword => 
            textContent.toLowerCase().includes(keyword)
          );

          if (hasCalculationPattern && hasResultKeyword && detectedValues.length > 0) {
            const event = createEvent('calculation', {
              detectedValues,
              resultText: textContent.substring(0, 200),
              elementType: target.tagName.toLowerCase(),
              elementId: target.id || undefined,
              elementClasses: target.className || undefined,
              mutationType: mutation.type,
            }, 'success', `Calculation result detected: ${detectedValues.join(', ')}`);
            
            addEvent(event);
            console.log('🐛 DEBUG: Detected calculation result:', detectedValues, 'in element:', target);
          }
        }
      });
    });

    // Start observing the tool container
    const toolContainer = document.querySelector('[data-tool-container="true"]');
    if (toolContainer) {
      observer.observe(toolContainer, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: true,
      });
    }

    // Enhanced button click detection for calculations
    const enhancedClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Only capture events from within the tool renderer area
      const toolContainer = document.querySelector('[data-tool-container="true"]');
      if (!toolContainer || !toolContainer.contains(target)) return;

      // Detect calculation-related buttons
      const buttonText = target.textContent?.toLowerCase() || '';
      const buttonId = target.id?.toLowerCase() || '';
      const buttonClasses = target.className?.toLowerCase() || '';
      
      const calculationKeywords = [
        'calculate', 'compute', 'submit', 'generate', 'analyze', 'process',
        'total', 'estimate', 'determine', 'evaluate', 'run', 'execute',
        'get result', 'show result', 'find', 'check'
      ];

      const isCalculationButton = calculationKeywords.some(keyword => 
        buttonText.includes(keyword) || buttonId.includes(keyword) || buttonClasses.includes(keyword)
      );

      if (isCalculationButton && (target.tagName.toLowerCase() === 'button' || target.getAttribute('role') === 'button')) {
        // Capture form data before calculation
        const formData: Record<string, any> = {};
        const inputs = toolContainer.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
          const element = input as HTMLInputElement;
          const name = element.name || element.id || `input-${Array.from(inputs).indexOf(input)}`;
          
          if (element.type === 'checkbox' || element.type === 'radio') {
            formData[name] = element.checked;
          } else {
            formData[name] = element.value;
          }
        });

        const event = createEvent('function_call', {
          functionName: 'calculationButtonClick',
          buttonText: target.textContent,
          buttonId: target.id,
          formData,
          inputCount: inputs.length,
          triggeredBy: 'click',
        }, 'info', `Calculation triggered: "${buttonText}" button with ${inputs.length} inputs`);
        
        addEvent(event);

        // Set up a delayed check for results (common pattern is immediate DOM update)
        setTimeout(() => {
          const resultElements = toolContainer.querySelectorAll('[class*="result"], [id*="result"], [data-style-id*="result"]');
          if (resultElements.length > 0) {
            resultElements.forEach(element => {
              const text = element.textContent || '';
              if (text.trim()) {
                const resultEvent = createEvent('calculation', {
                  resultElement: {
                    text: text.substring(0, 200),
                    elementId: element.id,
                    elementClasses: element.className,
                  },
                  calculationTriggeredBy: buttonText,
                  delayMs: 100,
                }, 'success', `Result displayed: ${text.substring(0, 50)}`);
                
                addEvent(resultEvent);
              }
            });
          }
        }, 100);
      }
    };

    // Add the enhanced click handler
    document.addEventListener('click', enhancedClickHandler, true);

    // Cleanup
    return () => {
      console.log('🐛 DEBUG: Cleaning up enhanced calculation detection for toolId:', toolId);
      observer.disconnect();
      document.removeEventListener('click', enhancedClickHandler, true);
    };
  }, [isEnabled, config.enabled, toolId, createEvent, addEvent]);

  // Enhanced calculation detection via DOM observation and button analysis
  useEffect(() => {
    if (!isEnabled || !config.enabled) return;

    console.log('🐛 DEBUG: Setting up enhanced calculation detection for toolId:', toolId);

    // Monitor DOM changes that might indicate calculation results
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Only monitor changes within the tool container
        const toolContainer = document.querySelector('[data-tool-container="true"]');
        if (!toolContainer || !toolContainer.contains(mutation.target as Node)) return;

        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          const target = mutation.target as HTMLElement;
          const textContent = target.textContent || '';
          
          // Detect calculation result patterns
          const calculationPatterns = [
            /\$[\d,]+\.?\d*/g, // Currency values
            /\d+\.?\d*%/g,     // Percentages  
            /[\d,]+\.?\d*/g,   // Numbers with decimals
          ];

          let hasCalculationPattern = false;
          let detectedValues: string[] = [];

          calculationPatterns.forEach(pattern => {
            const matches = textContent.match(pattern);
            if (matches && matches.length > 0) {
              hasCalculationPattern = true;
              detectedValues.push(...matches);
            }
          });

          // Look for result-related text
          const resultKeywords = ['result', 'total', 'calculation', 'amount', 'payment', 'savings', 'profit', 'loss', 'balance', 'score', 'rating', 'percentage'];
          const hasResultKeyword = resultKeywords.some(keyword => 
            textContent.toLowerCase().includes(keyword)
          );

          if (hasCalculationPattern && hasResultKeyword && detectedValues.length > 0) {
            const event = createEvent('calculation', {
              detectedValues,
              resultText: textContent.substring(0, 200),
              elementType: target.tagName.toLowerCase(),
              elementId: target.id || undefined,
              elementClasses: target.className || undefined,
              mutationType: mutation.type,
            }, 'success', `Calculation result detected: ${detectedValues.join(', ')}`);
            
            addEvent(event);
            console.log('🐛 DEBUG: Detected calculation result:', detectedValues, 'in element:', target);
          }
        }
      });
    });

    // Start observing the tool container
    const toolContainer = document.querySelector('[data-tool-container="true"]');
    if (toolContainer) {
      observer.observe(toolContainer, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: true,
      });
    }

    // Enhanced button click detection for calculations
    const enhancedClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Only capture events from within the tool renderer area
      const toolContainer = document.querySelector('[data-tool-container="true"]');
      if (!toolContainer || !toolContainer.contains(target)) return;

      // Detect calculation-related buttons
      const buttonText = target.textContent?.toLowerCase() || '';
      const buttonId = target.id?.toLowerCase() || '';
      const buttonClasses = target.className?.toLowerCase() || '';
      
      const calculationKeywords = [
        'calculate', 'compute', 'submit', 'generate', 'analyze', 'process',
        'total', 'estimate', 'determine', 'evaluate', 'run', 'execute',
        'get result', 'show result', 'find', 'check'
      ];

      const isCalculationButton = calculationKeywords.some(keyword => 
        buttonText.includes(keyword) || buttonId.includes(keyword) || buttonClasses.includes(keyword)
      );

      if (isCalculationButton && (target.tagName.toLowerCase() === 'button' || target.getAttribute('role') === 'button')) {
        // Capture form data before calculation
        const formData: Record<string, any> = {};
        const inputs = toolContainer.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
          const element = input as HTMLInputElement;
          const name = element.name || element.id || `input-${Array.from(inputs).indexOf(input)}`;
          
          if (element.type === 'checkbox' || element.type === 'radio') {
            formData[name] = element.checked;
          } else {
            formData[name] = element.value;
          }
        });

        const event = createEvent('function_call', {
          functionName: 'calculationButtonClick',
          buttonText: target.textContent,
          buttonId: target.id,
          formData,
          inputCount: inputs.length,
          triggeredBy: 'click',
        }, 'info', `Calculation triggered: "${buttonText}" button with ${inputs.length} inputs`);
        
        addEvent(event);

        // Set up a delayed check for results (common pattern is immediate DOM update)
        setTimeout(() => {
          const resultElements = toolContainer.querySelectorAll('[class*="result"], [id*="result"], [data-style-id*="result"]');
          if (resultElements.length > 0) {
            resultElements.forEach(element => {
              const text = element.textContent || '';
              if (text.trim()) {
                const resultEvent = createEvent('calculation', {
                  resultElement: {
                    text: text.substring(0, 200),
                    elementId: element.id,
                    elementClasses: element.className,
                  },
                  calculationTriggeredBy: buttonText,
                  delayMs: 100,
                }, 'success', `Result displayed: ${text.substring(0, 50)}`);
                
                addEvent(resultEvent);
              }
            });
          }
        }, 100);
      }
    };

    // Add the enhanced click handler
    document.addEventListener('click', enhancedClickHandler, true);

    // Cleanup
    return () => {
      console.log('🐛 DEBUG: Cleaning up enhanced calculation detection for toolId:', toolId);
      observer.disconnect();
      document.removeEventListener('click', enhancedClickHandler, true);
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