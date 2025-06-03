'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Send, 
  Loader2, 
  Calculator, 
  Palette, 
  Type, 
  Layout,
  Sparkles,
  Brain,
  RotateCcw,
  MessageCircle,
  MessageSquare,
  Moon,
  Sun,
  Settings,
  ChevronDown,
  Edit3,
  ChevronLeft,
  ChevronRight,
  X,
  History,
  Zap,
  CheckCircle,
  Upload
} from 'lucide-react';
import { DynamicInput } from '@/components/tool-creator-ui/inputs';
import { ColorPickerPopup } from '@/components/tool-creator-ui/inputs';
import { FullFormPopup } from '@/components/tool-creator-ui/inputs';
import { InputHistory } from '@/components/tool-creator-ui/input-history';
import { OptionsMenu } from '@/components/tool-creator-ui/options-menu';
import { InteractionPanel } from '@/components/tool-creator-ui/interaction-panel';
import { BrainstormingPanel } from '@/components/tool-creator-ui/brainstorming-panel';
import { SavedLogicPanel } from '@/components/tool-creator-ui/saved-logic-panel';
import { SavedToolsPanel } from '@/components/tool-creator-ui/saved-tools-panel';
import { initBehaviorTracker, getBehaviorTracker } from '@/lib/ai/behavior-tracker';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { CanvasTool } from '@/components/tool-creator-ui/canvas-tool';

// Import extracted modules
import { mockWorkflow, iteratorTestWorkflow, getRandomCalculatorType } from './mock-data';
import { getRandomTestScenario, RandomTestScenario, RANDOM_TEST_SCENARIOS } from './test-calculator-types';
import { ToolInfoBubble } from '@/components/tool-creator-ui/tool-info-bubble';
import { 
  SavedLogicResult, 
  SavedTool,
  DynamicInputProps,
  ColorPickerPopupProps,
  FullFormPopupProps 
} from './types';
import {
  openToolDB,
  saveLastActiveToolToDB,
  loadLastActiveToolFromDB,
  saveLogicResultToDB,
  loadLogicResultsFromDB,
  saveToolToDBList,
  loadAllToolsFromDB,
  deleteToolFromDBList,
  clearLastActiveToolFromDB
} from './db-utils';
import {
  handleStreamingAIRequest,
  callToolCreationAgent,
  handleStyleUpdate,
  createToolWithBrainstorming,
  handleAIFreeformInput,
  processWithAI
} from './ai-processing';

// Local Storage Utilities for Development
const LOGIC_STORAGE_KEY = 'keyvex_logic_architect_results';
const TOOLS_STORAGE_KEY = 'keyvex_created_tools';

const saveLogicResult = (toolType: string, targetAudience: string, industry: string | undefined, result: any) => {
  try {
    const saved = localStorage.getItem(LOGIC_STORAGE_KEY);
    const existing: SavedLogicResult[] = saved ? JSON.parse(saved) : [];
    
    const newResult: SavedLogicResult = {
      id: `logic_${Date.now()}`,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      toolType,
      targetAudience,
      industry,
      result
    };
    
    existing.unshift(newResult); // Add to beginning
    localStorage.setItem(LOGIC_STORAGE_KEY, JSON.stringify(existing.slice(0, 50))); // Keep last 50
    console.log('💾 Saved logic result to localStorage:', newResult.id);
  } catch (error) {
    console.error('Failed to save logic result:', error);
  }
};

const saveCreatedTool = (tool: ProductToolDefinition) => {
  try {
    const saved = localStorage.getItem(TOOLS_STORAGE_KEY);
    const existing: SavedTool[] = saved ? JSON.parse(saved) : [];
    
    const newTool: SavedTool = {
      id: `tool_${Date.now()}`,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      title: tool.metadata.title,
      tool
    };
    
    existing.unshift(newTool); // Add to beginning
    localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(existing.slice(0, 50))); // Keep last 50
    console.log('💾 Saved created tool to localStorage:', newTool.id);
  } catch (error) {
    console.error('Failed to save created tool:', error);
  }
};

const getSavedLogicResults = (): SavedLogicResult[] => {
  try {
    const saved = localStorage.getItem(LOGIC_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load logic results:', error);
    return [];
  }
};

const getSavedTools = (): SavedTool[] => {
  try {
    const saved = localStorage.getItem(TOOLS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load saved tools:', error);
    return [];
  }
};

// Enhanced validation function to check if a ProductToolDefinition is valid
const isValidProductToolDefinition = (tool: any): tool is ProductToolDefinition => {
  console.log('🔧 TRACE: Validating tool definition...');
  console.log('🔧 TRACE: Tool ID:', tool?.id);
  console.log('🔧 TRACE: Tool metadata title:', tool?.metadata?.title);
  console.log('🔧 TRACE: ComponentCode length:', tool?.componentCode?.length || 0);
  
  if (!tool || typeof tool !== 'object') {
    console.warn('⚠️ Tool validation failed: Not an object');
    return false;
  }
  
  // Check for required fields
  if (!tool.id || !tool.metadata || !tool.componentCode) {
    console.warn('⚠️ Tool validation failed: Missing required fields', {
      hasId: !!tool.id,
      hasMetadata: !!tool.metadata, 
      hasComponentCode: !!tool.componentCode
    });
    return false;
  }
  
  // Check for undefined values in critical fields
  if (String(tool.id).includes('undefined') || 
      String(tool.slug || '').includes('undefined') ||
      String(tool.metadata?.id || '').includes('undefined') ||
      String(tool.metadata?.title || '').includes('undefined')) {
    console.warn('⚠️ Tool validation failed: Contains undefined values in critical fields');
    return false;
  }

  // ENHANCED: Check if componentCode actually contains a React component
  const componentCode = String(tool.componentCode || '');
  
  // Must contain React.createElement (our required pattern)
  if (!componentCode.includes('React.createElement')) {
    console.warn('⚠️ Tool validation failed: componentCode does not contain React.createElement');
    return false;
  }
  
  // Must contain a function declaration that returns React elements
  const functionPattern = /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*return\s+React\.createElement/;
  if (!functionPattern.test(componentCode)) {
    console.warn('⚠️ Tool validation failed: componentCode does not contain a proper React component function');
    return false;
  }
  
  // Must contain React hooks (useState is required for our components)
  if (!componentCode.includes('useState')) {
    console.warn('⚠️ Tool validation failed: componentCode does not contain React hooks (useState)');
    return false;
  }

  // 🛡️ NEW: Check for Card component usage (will cause runtime errors)
  if (componentCode.includes('Card') || 
      componentCode.includes('CardHeader') ||
      componentCode.includes('CardContent') ||
      componentCode.includes('CardTitle')) {
    console.warn('⚠️ Tool validation failed: Component uses forbidden Card components');
    return false;
  }

  // NEW: Test component code for JavaScript execution safety AND React component structure
  try {
    console.log('🔧 TRACE: Testing component code JavaScript execution...');
    
    // Create a safe test environment to check if the componentCode will execute
    const testFunction = new Function(`
      "use strict";
      const React = { createElement: () => null };
      const useState = () => [null, () => {}];
      const useEffect = () => {};
      const useCallback = () => {};
      const useMemo = () => {};
      const Button = () => null;
      const Input = () => null;
      const Label = () => null;
      
      try {
        ${componentCode}
        
        // Enhanced check: Try to find and call the component function
        const functionNames = [];
        const funcRegex = /function\\s+(\\w+)\\s*\\([^)]*\\)/g;
        let match;
        while ((match = funcRegex.exec(\`${componentCode.replace(/`/g, '\\`')}\`)) !== null) {
          functionNames.push(match[1]);
        }
        
        if (functionNames.length === 0) {
          return { success: false, error: 'No function declarations found' };
        }
        
        // Try to call the first function (should be the React component)
        const componentFunction = eval(functionNames[0]);
        if (typeof componentFunction !== 'function') {
          return { success: false, error: 'Component is not a function' };
        }
        
        // Try to execute the component function (should return React elements)
        const result = componentFunction();
        
        return { success: true, componentName: functionNames[0] };
      } catch (error) {
        return { success: false, error: error.message };
      }
    `);
    
    const testResult = testFunction();
    
    if (!testResult.success) {
      console.warn('⚠️ Tool validation failed: Component code execution error:', testResult.error);
      return false;
    }
    
    console.log('🔧 TRACE: ✅ Component code execution test passed, component name:', testResult.componentName);
  } catch (executionError) {
    console.warn('⚠️ Tool validation failed: Component code is corrupted:', executionError);
    return false;
  }
  
  console.log('🔧 TRACE: ✅ Tool validation passed');
  return true;
};

// NEW: Add automatic cleanup of corrupted tools from IndexedDB
const clearCorruptedToolFromStorage = async (toolId: string) => {
  try {
    console.log('🧹 TRACE: Clearing corrupted tool from storage:', toolId);
    
    // Clear from IndexedDB using the correct imported function
    await clearLastActiveToolFromDB();
    
    // Clear from localStorage backup
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('tool_') || key === 'lastActiveToolId') {
        try {
          const toolData = JSON.parse(localStorage.getItem(key) || '{}');
          if (toolData.id === toolId) {
            localStorage.removeItem(key);
            console.log('🧹 TRACE: Removed corrupted tool from localStorage:', key);
          }
        } catch (e) {
          // If parsing fails, the localStorage item is also corrupted, remove it
          localStorage.removeItem(key);
          console.log('🧹 TRACE: Removed corrupted localStorage item:', key);
        }
      }
    });
    
    console.log('🧹 TRACE: ✅ Corrupted tool cleanup completed');
  } catch (error) {
    console.error('🧹 TRACE: ⚠️ Error during corrupted tool cleanup:', error);
  }
};

// Helper function to create a sample question for an existing tool
const createSampleQuestion = (tool: ProductToolDefinition) => {
  return {
    id: `sample_${Date.now()}`,
    message: `Sample question for ${tool.metadata.title}`,
    inputType: 'text' as const,
    placeholder: 'Enter your input here...',
    isInMultiPart: false,
    multiPartQuestions: []
  };
};

// Helper function to create a mock question for initial state
const createMockQuestion = () => {
  return {
    id: `mock_${Date.now()}`,
    message: 'What type of business tool would you like to create?',
    inputType: 'text' as const,
    placeholder: 'Describe your tool idea...',
    isInMultiPart: false,
    multiPartQuestions: []
  };
};

export default function TestUIPage() {
  const [useMockData, setUseMockData] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [historyPanelSide, setHistoryPanelSide] = useState<'left' | 'right'>('left');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(7);
  const [lastAIMessage, setLastAIMessage] = useState("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPickerPopup, setShowColorPickerPopup] = useState(false);
  
  // Behavior tracking state
  const [responseStartTime, setResponseStartTime] = useState<number>(Date.now());
  const [behaviorTracker, setBehaviorTracker] = useState<any>(null);
  
  // Workflow selection state
  const [useIteratorTest, setUseIteratorTest] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<any[]>(mockWorkflow);
  
  // Question queue management
  const [questionQueue, setQuestionQueue] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [collectedAnswers, setCollectedAnswers] = useState<Record<string, string>>({});
  
  // Multi-part question state
  const [isInMultiPart, setIsInMultiPart] = useState(false);
  const [multiPartQuestions, setMultiPartQuestions] = useState<any[]>([]);
  const [multiPartIndex, setMultiPartIndex] = useState(0);
  const [multiPartAnswers, setMultiPartAnswers] = useState<Record<string, string>>({});
  
  // Conversation history tracking
  const [conversationHistory, setConversationHistory] = useState<Array<{
    step: number;
    questionIndex: number;
    questionId: string;
    isMultiPart: boolean;
    multiPartIndex?: number;
  }>>([]);
  const [isEditingPrevious, setIsEditingPrevious] = useState(false);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editingOverlayFadingOut, setEditingOverlayFadingOut] = useState(false);
  
  // Dynamic question history for AI workflow
  const [questionHistory, setQuestionHistory] = useState<Array<{
    id: string;
    message: string;
    inputType: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    allowCustom?: boolean;
    maxSelections?: number;
    suggestions?: string[];
    questions?: any[]; // for multiPart
  }>>([]);
  
  // Custom colors state
  const [customColors, setCustomColors] = useState<Array<{
    value: string;
    label: string;
    colors: string[];
  }>>([]);
  
  // Full form popup state
  const [showFullFormPopup, setShowFullFormPopup] = useState(false);
  const [fullFormAnswers, setFullFormAnswers] = useState<Record<string, string>>({});
  
  // Transition state for fade effects
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionOpacity, setTransitionOpacity] = useState(1);
  
  // Tool data for canvas
  const [toolData, setToolData] = useState<any>({
    title: 'Business Calculator',
    description: 'Calculate your business metrics',
    colorScheme: 'professional-blue',
    inputs: [],
    outputFormat: ['percentage']
  });

  // AI-generated Product Tool Definition state
  const [productToolDefinition, setProductToolDefinition] = useState<ProductToolDefinition | null>(null);
  const [isGeneratingTool, setIsGeneratingTool] = useState(false);
  
  // NEW: Brainstorming streaming state
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [brainstormingThoughts, setBrainstormingThoughts] = useState<Array<{
    type: 'partial' | 'complete' | 'error';
    data: any;
    timestamp: number;
    message?: string; // Add optional message property for error types
  }>>([]);
  const [latestBrainstormingResult, setLatestBrainstormingResult] = useState<any>(null);
  const [showBrainstormingPanel, setShowBrainstormingPanel] = useState(false);
  
  // NEW: Local storage state for saved logic results and tools
  const [savedLogicResults, setSavedLogicResults] = useState<SavedLogicResult[]>([]);
  const [savedTools, setSavedTools] = useState<SavedTool[]>([]);
  const [showLogicSelect, setShowLogicSelect] = useState(false);
  const [showToolsSelect, setShowToolsSelect] = useState(false);

  // Initialize dark mode based on system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Initialize with first mock question
  useEffect(() => {
    console.log('🔧 Initial setup useEffect triggered:', { useMockData, questionQueueLength: questionQueue.length });
    if (useMockData && questionQueue.length === 0) {
      console.log('🔧 Initializing with first mock question');
      setQuestionQueue([currentWorkflow[0]]);
      setCurrentQuestionIndex(0);
      // Also add to question history for consistent editing
      setQuestionHistory([currentWorkflow[0]]);
    }
    // Note: Removed the AI mode clearing logic to prevent circular dependency
    // AI responses should be allowed to set questionQueue without interference
  }, [useMockData, currentWorkflow]); // Removed questionQueue.length dependency

  // Handle mode switching - clear queue when switching to AI mode
  /* DISABLED: This useEffect was clearing AI-generated questions
  useEffect(() => {
    console.log('🔧 Mode switch detected, clearing queue for AI mode');
    if (!useMockData) {
      setQuestionQueue([]);
      setCurrentQuestionIndex(0);
      setCurrentInput('');
    }
  }, [useMockData]); // Only trigger when useMockData changes
  */

  // Handle workflow switching
  useEffect(() => {
    const newWorkflow = useIteratorTest ? iteratorTestWorkflow : mockWorkflow;
    setCurrentWorkflow(newWorkflow);
    
    // Update the welcome message based on workflow
    if (useIteratorTest) {
      setLastAIMessage("Welcome to the Multi-Question Iterator Test! This will help us test the iterator component with various question sequences.");
      setTotalSteps(iteratorTestWorkflow.length);
    } else {
      setLastAIMessage("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
      setTotalSteps(mockWorkflow.length);
    }
  }, [useIteratorTest]);

  const currentQuestion = isInMultiPart 
    ? multiPartQuestions[multiPartIndex] || null 
    : questionQueue[currentQuestionIndex] || null;

  // Debug logging for question state
  useEffect(() => {
    console.log('🔧 Question state updated:', {
      isInMultiPart,
      multiPartQuestionsLength: multiPartQuestions.length,
      multiPartIndex,
      questionQueueLength: questionQueue.length,
      currentQuestionIndex,
      currentQuestion: currentQuestion ? { id: currentQuestion.id, inputType: currentQuestion.inputType } : null
    });
  }, [isInMultiPart, multiPartQuestions, multiPartIndex, questionQueue, currentQuestionIndex, currentQuestion]);

  // Debug logging specifically for questionQueue changes
  useEffect(() => {
    console.log('🔧 questionQueue changed:', questionQueue.length, questionQueue.map(q => ({ id: q.id, inputType: q.inputType })));
  }, [questionQueue]);

  // Helper function to handle smooth transitions between questions
  const transitionToNewContent = async (updateFunction: () => void) => {
    setIsTransitioning(true);
    setTransitionOpacity(0); // Fade out
    
    // Wait for fade out to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Update content while invisible
    updateFunction();
    
    // Fade back in
    setTimeout(() => {
      setTransitionOpacity(1);
      setIsTransitioning(false);
    }, 50);
  };

  // Helper function to handle streaming AI responses
  const handleStreamingAIRequest = async (requestBody: any) => {
    try {
      const response = await fetch('/api/ai/test-ui', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // Check if it's a streaming response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let partialMessage = '';

        if (!reader) throw new Error('No response reader available');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'partial' && data.data) {
                  // Update AI message with partial response
                  if (data.data.message) {
                    partialMessage = data.data.message;
                    setLastAIMessage(partialMessage + '...');
                  }
                } else if (data.type === 'complete') {
                  // Final response
                  return data;
                } else if (data.type === 'error') {
                  throw new Error(data.message || 'Streaming failed');
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', line);
              }
            }
          }
        }
      } else {
        // Fallback to regular JSON response (for test commands)
        return await response.json();
      }
    } catch (error) {
      console.error('Streaming request failed:', error);
      throw error;
    }
  };

  const handleInputSubmit = async () => {
    if (!currentInput.trim() && !currentQuestion) return;

    // Track the interaction before processing
    const tracker = getBehaviorTracker();
    if (tracker && currentQuestion) {
      const questionId = isInMultiPart 
        ? multiPartQuestions[multiPartIndex]?.id 
        : currentQuestion.id;
      
      // Determine if user used suggestions or custom input
      const usedSuggestions = currentQuestion.options?.some((opt: any) => opt.value === currentInput) || false;
      const usedCustomInput = currentQuestion.allowCustom && !usedSuggestions;
      
      tracker.trackQuestionResponse({
        questionId: questionId || 'unknown',
        questionType: isInMultiPart 
          ? multiPartQuestions[multiPartIndex]?.inputType 
          : currentQuestion.inputType,
        userResponse: currentInput,
        responseStartTime,
        currentStep,
        totalSteps,
        workflowType: useIteratorTest ? 'iterator_test' : useMockData ? 'standard' : 'ai_mode',
        isMultiPart: isInMultiPart,
        usedSuggestions,
        usedCustomInput
      });
    }

    setIsLoading(true);

    try {
      if (isInMultiPart) {
        // Handle multi-part question flow
        const questionId = currentQuestion.id;
        const newMultiPartAnswers = { ...multiPartAnswers, [questionId]: currentInput };
        setMultiPartAnswers(newMultiPartAnswers);

        // Track conversation history for multi-part questions
        const conversationState = {
          step: currentStep,
          questionIndex: currentQuestionIndex,
          questionId,
          isMultiPart: true,
          multiPartIndex
        };
        
        // Only add to history if we're not editing (to avoid duplicates)
        if (!isEditingPrevious) {
          setConversationHistory(prev => [...prev, conversationState]);
        } else if (editingTarget === questionId) {
          // If we're editing this specific question, clear subsequent history
          setConversationHistory(prev => {
            const targetIndex = prev.findIndex(state => state.questionId === questionId);
            return targetIndex >= 0 ? prev.slice(0, targetIndex + 1) : prev;
          });
        }

        // Update tool data based on multi-part answer
        updateToolDataFromMultiPart(questionId, currentInput);

        if (multiPartIndex < multiPartQuestions.length - 1) {
          // Move to next multi-part question with transition
          await transitionToNewContent(() => {
            setMultiPartIndex(multiPartIndex + 1);
            setCurrentInput('');
            setLastAIMessage(`Question ${multiPartIndex + 2} of ${multiPartQuestions.length}: ${multiPartQuestions[multiPartIndex + 1].question}`);
          });
        } else {
          // Multi-part complete, return to main flow
          setIsInMultiPart(false);
          setMultiPartQuestions([]);
          setMultiPartIndex(0);
          
          // Store all multi-part answers as a single answer
          const mainQuestionId = 'multi-part-setup';
          const newAnswers = { ...collectedAnswers, [mainQuestionId]: JSON.stringify(newMultiPartAnswers) };
          setCollectedAnswers(newAnswers);
          
          // Continue with main workflow
          await processMockWorkflow(newAnswers);
          setMultiPartAnswers({});
        }
      } else if (currentQuestion) {
        // Handle regular question response
        const answerId = currentQuestion.id;
        
        // Track conversation history for regular questions
        const conversationState = {
          step: currentStep,
          questionIndex: currentQuestionIndex,
          questionId: answerId,
          isMultiPart: false
        };
        
        // Only add to history if we're not editing (to avoid duplicates)
        if (!isEditingPrevious) {
          setConversationHistory(prev => [...prev, conversationState]);
        } else if (editingTarget === answerId) {
          // If we're editing this specific question, clear subsequent history
          setConversationHistory(prev => {
            const targetIndex = prev.findIndex(state => state.questionId === answerId);
            return targetIndex >= 0 ? prev.slice(0, targetIndex + 1) : prev;
          });
        }
        
        // Regular single question
        const newAnswers = { ...collectedAnswers, [answerId]: currentInput };
        setCollectedAnswers(newAnswers);

        // Update tool data based on answer
        updateToolData(answerId, currentInput);

        // Move to next question or complete queue
        if (currentQuestionIndex < questionQueue.length - 1) {
          await transitionToNewContent(() => {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setCurrentInput('');
          });
        } else {
          // Queue complete, process with AI or move to next mock step
          if (useMockData) {
            await processMockWorkflow(newAnswers);
          } else {
            await processWithAI(newAnswers, conversationHistory, currentStep, setLastAIMessage, handleAIGeneratedQuestion, setShowBrainstormingPanel, setIsBrainstorming, setBrainstormingThoughts, setIsGeneratingTool, setLatestBrainstormingResult, saveLogicResult, setSavedLogicResults, getSavedLogicResults, transitionToNewContent, productToolDefinition, setProductToolDefinition);
            // setQuestionQueue([]); // DISABLED: This was clearing AI-generated questions
            setCurrentQuestionIndex(0);
            setCurrentInput('');
          }
        }
      } else {
        // Handle free-form input
        if (useMockData) {
          await handleMockFreeformInput(currentInput);
        } else {
          await handleAIFreeformInput(currentInput, conversationHistory, collectedAnswers, currentStep, setLastAIMessage, handleAIGeneratedQuestion, setShowBrainstormingPanel, setIsBrainstorming, setBrainstormingThoughts, setIsGeneratingTool, setLatestBrainstormingResult, saveLogicResult, setSavedLogicResults, getSavedLogicResults, transitionToNewContent, productToolDefinition, setProductToolDefinition);
        }
      }

      // Clear editing mode after successful submit
      if (isEditingPrevious) {
        // Start fade-out animation
        setEditingOverlayFadingOut(true);
        
        // Clear editing state after animation completes
        setTimeout(() => {
          setIsEditingPrevious(false);
          setEditingTarget(null);
          setEditingOverlayFadingOut(false);
        }, 500); // Match animation duration
      }

      // Input clearing is handled by each specific path above
    } catch (error) {
      console.error('Error handling input:', error);
      setLastAIMessage('Sorry, there was an error processing your input. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateToolData = (answerId: string, value: string) => {
    setToolData((prev: any) => {
      const updated = { ...prev };
      
      // Handle both mock workflow IDs and AI-generated IDs
      switch (answerId) {
        case 'tool-type':
          updated.type = value;
          break;
        case 'features-wanted':
        case 'test-feature-selection':
          updated.features = value.split(',');
          break;
        case 'color-scheme':
        case 'test-color-selection':
        case 'color-preference':
        case 'preferred-colors':
          updated.colorScheme = value;
          // Handle AI-generated colors by finding the actual color data
          if (currentQuestion && currentQuestion.options) {
            const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
            if (selectedOption && selectedOption.colors) {
              updated.colorScheme = 'custom';
              updated.customColors = selectedOption.colors;
              console.log('🎨 Applied AI-generated colors:', selectedOption.colors);
            }
          }
          // If it's a custom color from color picker, find the custom color data
          if (value.startsWith('custom-')) {
            const customColor = customColors.find(c => c.value === value);
            if (customColor) {
              updated.colorScheme = 'custom';
              updated.customColors = customColor.colors;
            }
          }
          break;
        case 'confidence-level':
          updated.confidenceLevel = value;
          break;
        case 'business-description':
        case 'test-tool-description':
          updated.businessDescription = value;
          break;
        case 'calculator-title':
        case 'calculator-name':
        case 'test-tool-naming':
          updated.title = value;
          break;
        case 'final-customization':
          updated.customizations = value;
          break;
        case 'key-inputs':
          updated.inputs = value.split(',').map(s => s.trim()).filter(Boolean);
          break;
        case 'output-format':
          updated.outputFormat = value.split(',');
          break;
        default:
          // Smart detection for AI-generated questions
          const lowerAnswerId = answerId.toLowerCase();
          if (lowerAnswerId.includes('color') || lowerAnswerId.includes('palette') || lowerAnswerId.includes('scheme')) {
            updated.colorScheme = value;
            // Handle AI-generated colors by finding the actual color data
            if (currentQuestion && currentQuestion.options) {
              const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
              if (selectedOption && selectedOption.colors) {
                updated.colorScheme = 'custom';
                updated.customColors = selectedOption.colors;
                console.log('🎨 Applied AI-generated colors (smart detection):', selectedOption.colors);
              }
            }
            // Handle custom colors
            if (value.startsWith('custom-')) {
              const customColor = customColors.find(c => c.value === value);
              if (customColor) {
                updated.colorScheme = 'custom';
                updated.customColors = customColor.colors;
              }
            }
          } else if (lowerAnswerId.includes('feature') || lowerAnswerId.includes('capability')) {
            updated.features = value.split(',');
          } else if (lowerAnswerId.includes('name') || lowerAnswerId.includes('title')) {
            updated.title = value;
          } else if (lowerAnswerId.includes('description') || lowerAnswerId.includes('business')) {
            updated.businessDescription = value;
          } else if (lowerAnswerId.includes('type') || lowerAnswerId.includes('category')) {
            updated.type = value;
          }
          break;
      }
      
      return updated;
    });
  };

  const updateToolDataFromMultiPart = (questionId: string, value: string) => {
    setToolData((prev: any) => {
      const updated = { ...prev };
      
      switch (questionId) {
        case 'target-audience':
          updated.targetAudience = value;
          break;
        case 'industry-focus':
          updated.industry = value;
          break;
        case 'calculator-name':
          updated.title = value;
          break;
        case 'key-metrics':
          updated.keyMetrics = value.split(',');
          break;
        case 'color-preference':
        case 'preferred-colors':
          updated.colorScheme = value;
          // Handle AI-generated colors by finding the actual color data
          if (multiPartQuestions[multiPartIndex] && multiPartQuestions[multiPartIndex].options) {
            const selectedOption = multiPartQuestions[multiPartIndex].options.find((opt: any) => opt.value === value);
            if (selectedOption && selectedOption.colors) {
              updated.colorScheme = 'custom';
              updated.customColors = selectedOption.colors;
              console.log('🎨 Applied AI-generated colors in iterator:', selectedOption.colors);
            }
          }
          // If it's a custom color from color picker, find the custom color data
          if (value.startsWith('custom-')) {
            const customColor = customColors.find(c => c.value === value);
            if (customColor) {
              updated.colorScheme = 'custom';
              updated.customColors = customColor.colors;
            }
          }
          break;
        default:
          // Smart detection for AI-generated questions in iterator
          const lowerQuestionId = questionId.toLowerCase();
          if (lowerQuestionId.includes('color') || lowerQuestionId.includes('palette') || lowerQuestionId.includes('scheme')) {
            updated.colorScheme = value;
            // Handle AI-generated colors by finding the actual color data
            if (multiPartQuestions[multiPartIndex] && multiPartQuestions[multiPartIndex].options) {
              const selectedOption = multiPartQuestions[multiPartIndex].options.find((opt: any) => opt.value === value);
              if (selectedOption && selectedOption.colors) {
                updated.colorScheme = 'custom';
                updated.customColors = selectedOption.colors;
                console.log('🎨 Applied AI-generated colors (smart detection in iterator):', selectedOption.colors);
              }
            }
            // Handle custom colors
            if (value.startsWith('custom-')) {
              const customColor = customColors.find(c => c.value === value);
              if (customColor) {
                updated.colorScheme = 'custom';
                updated.customColors = customColor.colors;
              }
            }
          } else if (lowerQuestionId.includes('feature') || lowerQuestionId.includes('capability')) {
            updated.features = value.split(',');
          } else if (lowerQuestionId.includes('name') || lowerQuestionId.includes('title')) {
            updated.title = value;
          } else if (lowerQuestionId.includes('description') || lowerQuestionId.includes('business')) {
            updated.businessDescription = value;
          } else if (lowerQuestionId.includes('type') || lowerQuestionId.includes('category')) {
            updated.type = value;
          } else if (lowerQuestionId.includes('audience') || lowerQuestionId.includes('target')) {
            updated.targetAudience = value;
          } else if (lowerQuestionId.includes('industry') || lowerQuestionId.includes('sector')) {
            updated.industry = value;
          } else if (lowerQuestionId.includes('metric') || lowerQuestionId.includes('output')) {
            updated.keyMetrics = value.split(',');
          }
          break;
      }
      
      return updated;
    });
  };

  const processMockWorkflow = async (answers: Record<string, string>) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (currentStep < currentWorkflow.length) {
      const nextQuestion = currentWorkflow[currentStep];
      
      // Check if this is a multiPart question and start it immediately
      if (nextQuestion.inputType === 'multiPart') {
        console.log('🔧 DEBUG: Auto-starting multi-part sequence');
        console.log('🔧 DEBUG: Questions:', nextQuestion.questions);
        await transitionToNewContent(() => {
          setIsInMultiPart(true);
          setMultiPartQuestions(nextQuestion.questions || []);
          setMultiPartIndex(0);
          setCurrentInput('');
          setLastAIMessage(`${nextQuestion.message}\n\nQuestion 1 of ${nextQuestion.questions?.length}: ${nextQuestion.questions?.[0]?.question}`);
        });
        
        // Track the multiPart question for editing functionality
        trackQuestion(nextQuestion);
      } else {
        await transitionToNewContent(() => {
          setQuestionQueue([nextQuestion]);
          setCurrentQuestionIndex(0);
          setLastAIMessage(nextQuestion.message);
          setCurrentInput('');
        });
        
        // Track the question for editing functionality
        trackQuestion(nextQuestion);
      }
      
      setCurrentStep(currentStep + 1);
    } else {
      setLastAIMessage("Perfect! Your calculator is taking shape. You can see the preview updating in real-time. Would you like to refine any aspect or add more features?");
      setCurrentStep(Math.min(currentStep + 1, totalSteps));
      setQuestionQueue([]);
      setCurrentQuestionIndex(0);
    }
  };

  const handleMockFreeformInput = async (input: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('color') || lowerInput.includes('style')) {
      await transitionToNewContent(() => {
        setLastAIMessage("Great question about styling! Let me show you some color options that would work well for your calculator.");
        setQuestionQueue([currentWorkflow.find(q => q.id === 'color-scheme')!]);
        setCurrentQuestionIndex(0);
      });
    } else if (lowerInput.includes('input') || lowerInput.includes('field')) {
      await transitionToNewContent(() => {
        setLastAIMessage("Perfect! Let's define what inputs your users will provide to get their calculations.");
        setQuestionQueue([currentWorkflow.find(q => q.id === 'key-inputs')!]);
        setCurrentQuestionIndex(0);
      });
    } else {
      setLastAIMessage("I understand! The calculator is looking great. You can continue customizing it, or ask me about specific features you'd like to add or modify.");
    }
  };

  const handleColorPickerSubmit = (primaryColor: string, secondaryColor: string) => {
    // Generate custom color entry
    const customColorNumber = customColors.length + 1;
    const customColorEntry = {
      value: `custom-${customColorNumber}`,
      label: `Custom${customColorNumber}`,
      colors: [primaryColor, secondaryColor]
    };
    
    // Add to custom colors array
    setCustomColors(prev => [...prev, customColorEntry]);
    
    // Update tool data with custom colors
    setToolData((prev: any) => ({
      ...prev,
      colorScheme: 'custom',
      customColors: [primaryColor, secondaryColor]
    }));
    
    // Set the current input value but don't advance the workflow
    setCurrentInput(customColorEntry.value);
    
    // Don't call processMockWorkflow here - let the user click "Choose" to advance
  };

  const resetWorkflow = () => {
    setCurrentStep(1);
    setQuestionQueue([currentWorkflow[0]]);
    setCurrentQuestionIndex(0);
    setCurrentInput('');
    setCollectedAnswers({});
    setCustomColors([]);
    setConversationHistory([]);
    setIsEditingPrevious(false);
    setEditingTarget(null);
    setEditingOverlayFadingOut(false);
    setQuestionHistory([currentWorkflow[0]]); // Reset and start with first question
    
    // Set appropriate welcome message based on workflow
    if (useIteratorTest) {
      setLastAIMessage("Welcome to the Multi-Question Iterator Test! This will help us test the iterator component with various question sequences.");
    } else {
      setLastAIMessage("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
    }
    
    setToolData({
      title: 'Business Calculator',
      description: 'Calculate your business metrics',
      colorScheme: 'professional-blue',
      inputs: [],
      outputFormat: ['percentage']
    });
  };

  const handleAnswerUpdate = (questionId: string, newValue: string) => {
    // Track edit behavior
    const tracker = getBehaviorTracker();
    if (tracker) {
      tracker.trackEdit(questionId, newValue);
    }

    // Find the original question from either AI history or mock workflow
    let originalQuestion = questionHistory.find(q => q.id === questionId);
    if (!originalQuestion) {
      // Fallback to mock workflow if not found in AI history
      originalQuestion = currentWorkflow.find(q => q.id === questionId);
    }
    
    if (!originalQuestion) {
      console.error(`Could not find original question for ${questionId}`);
      return;
    }
    
    // Set editing mode and show overlay
    setIsEditingPrevious(true);
    setEditingTarget(questionId);
    setEditingOverlayFadingOut(false);
    
    // Restore the original question state
    setQuestionQueue([originalQuestion]);
    setCurrentQuestionIndex(0);
    
    // Set the current input to the existing value for editing
    setCurrentInput(newValue);
    
    // Update the answer and tool data (keep existing data)
    setCollectedAnswers(prev => ({
      ...prev,
      [questionId]: newValue
    }));
    updateToolData(questionId, newValue);
    
    // Show feedback message
    setLastAIMessage(`Editing your answer for "${questionId.replace(/-/g, ' ')}". Make your changes below and submit to continue.`);
  };

  // Helper function to switch to chat mode
  const handleSwitchToChat = () => {
    // Track workflow choice
    const tracker = getBehaviorTracker();
    if (tracker) {
      tracker.trackChatMode();
    }

    // Clear current input and question queue to enable freeform chat
    setCurrentInput('');
    setQuestionQueue([]);
    setCurrentQuestionIndex(0);
    
    // Update AI message to indicate chat mode
    setLastAIMessage("Great! I'm here to chat. Ask me anything about your tool, or tell me what you'd like to work on next.");
    
    // Exit multi-part mode if active
    if (isInMultiPart) {
      setIsInMultiPart(false);
      setMultiPartQuestions([]);
      setMultiPartIndex(0);
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  // Helper function to track questions for editing
  const trackQuestion = (question: any) => {
    setQuestionHistory(prev => {
      // Avoid duplicates
      const exists = prev.find(q => q.id === question.id);
      if (exists) return prev;
      return [...prev, question];
    });
  };

  // TODO: For AI Integration - call this when LLM generates new questions
  const handleAIGeneratedQuestion = (aiQuestion: {
    id: string;
    message: string;
    inputType: string;
    options?: any[];
    placeholder?: string;
    allowCustom?: boolean;
    maxSelections?: number;
    suggestions?: string[];
    acceptedFileTypes?: string[];
    maxFileSize?: string;
    questions?: any[];
  }) => {
    console.log('🔧 handleAIGeneratedQuestion called with:', aiQuestion);
    
    // Track AI question for editing functionality
    trackQuestion(aiQuestion);
    
    // Check if this is a multiPart question
    if (aiQuestion.inputType === 'multiPart' && aiQuestion.questions && aiQuestion.questions.length > 0) {
      console.log('🔧 Setting up multiPart question with', aiQuestion.questions.length, 'questions');
      // Set up multi-part state with transition
      transitionToNewContent(() => {
        setIsInMultiPart(true);
        setMultiPartQuestions(aiQuestion.questions!);
        setMultiPartIndex(0);
        setCurrentInput('');
        setLastAIMessage(`${aiQuestion.message}\n\nQuestion 1 of ${aiQuestion.questions!.length}: ${aiQuestion.questions![0].question}`);
      });
    } else {
      console.log('🔧 Setting up regular question:', aiQuestion.inputType);
      // Regular single question with transition
      console.log('🔧 About to set questionQueue with:', aiQuestion);
      transitionToNewContent(() => {
        setQuestionQueue([aiQuestion]);
        setCurrentQuestionIndex(0);
        setLastAIMessage(aiQuestion.message);
        setCurrentInput('');
      });
      console.log('🔧 After setting questionQueue with transition');
    }
  };

  // Initialize behavior tracker with user ID (in real app, get from Clerk)
  useEffect(() => {
    const userId = 'demo_user_' + Math.random().toString(36).substr(2, 9); // Mock user ID
    const tracker = initBehaviorTracker(userId);
    setBehaviorTracker(tracker);
    
    // Get adaptive suggestions and apply them
    const suggestions = tracker.getAdaptiveSuggestions();
    console.log('🧠 Adaptive suggestions loaded:', suggestions);
    
    // In a real implementation, you'd use these suggestions to:
    // - Adjust the workflow based on preferQuickMode
    // - Show/hide advanced options based on showAdvancedOptions
    // - Customize question types based on suggestedQuestionTypes
    // - Adjust complexity based on recommendedComplexity
    
  }, []);

  // Initialize localStorage data and load last active tool
  useEffect(() => {
    const initializeFromStorage = async () => {
      try {
        console.log('📱 Loading last active tool on startup');
        const lastTool = await loadLastActiveToolFromDB();
        
        if (lastTool) {
          console.log('📱 Loading last active tool on startup:', lastTool.metadata?.title);
          
          // ENHANCED: Use the improved validation with JavaScript execution testing
          if (isValidProductToolDefinition(lastTool)) {
            console.log('✅ Tool validation passed, tool loaded successfully');
            setProductToolDefinition(lastTool);
            
            // Add sample question to queue for this tool
            const sampleQuestion = createSampleQuestion(lastTool);
            setQuestionQueue([sampleQuestion]);
          } else {
            console.warn('⚠️ Tool validation FAILED - corrupted tool detected during startup');
            console.warn('⚠️ Tool ID:', (lastTool as any)?.id);
            console.warn('⚠️ Tool Title:', (lastTool as any)?.metadata?.title);
            
            // Clear the corrupted tool automatically
            await clearCorruptedToolFromStorage((lastTool as any)?.id || 'unknown');
            
            // Load initial state instead
            console.log('📱 Loading clean initial state after clearing corrupted tool');
            if (useMockData) {
              const firstQuestion = createMockQuestion();
              setQuestionQueue([firstQuestion]);
            }
          }
        } else {
          console.log('📱 No previous tool found, starting fresh');
          if (useMockData) {
            const firstQuestion = createMockQuestion();
            setQuestionQueue([firstQuestion]);
          }
        }
      } catch (error) {
        console.error('⚠️ Error during startup tool loading:', error);
        
        // If there's any error, clear potentially corrupted data and start fresh
        try {
          localStorage.clear(); // Clear all localStorage as a safety measure
          // Clear IndexedDB (we'll implement a safe clear function)
          console.log('🧹 Cleared all storage due to startup errors');
        } catch (clearError) {
          console.error('⚠️ Error clearing storage:', clearError);
        }
        
        // Load initial state
        if (useMockData) {
          const firstQuestion = createMockQuestion();
          setQuestionQueue([firstQuestion]);
        }
      }
    };

    initializeFromStorage();
  }, [useMockData]); // Only run on mount and when useMockData changes

  // Track when a question becomes active (user starts responding)
  useEffect(() => {
    if (currentQuestion || isInMultiPart) {
      setResponseStartTime(Date.now());
    }
  }, [currentQuestion, isInMultiPart, multiPartIndex]);

  return (
    <div className={`h-screen flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Progress Header */}
      <div className={`border-b px-6 py-3 flex-shrink-0 ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-blue-600" />
            <span className={`font-medium ${isDarkMode ? 'text-gray-50' : 'text-gray-900'}`}>
              Tool Creator
            </span>
            <Badge variant="outline" className={`text-xs ${
              isDarkMode ? 'border-gray-600 text-gray-300' : ''
            }`}>
              {useMockData ? 'Mock Mode' : 'AI Mode'} • {useIteratorTest ? 'Iterator Test' : 'Standard'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className={`text-xs border-2 rounded-lg ${
                  isDarkMode 
                    ? 'border-gray-600 bg-gray-700 text-gray-50 hover:bg-gray-600 shadow-sm' 
                    : 'border-gray-400 bg-gray-100 text-gray-800 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                <Settings className="h-3 w-3 mr-1" />
                Options
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              
              {showOptionsMenu && (
                <OptionsMenu 
                  isDarkMode={isDarkMode}
                  onClose={() => setShowOptionsMenu(false)}
                  useMockData={useMockData}
                  useIteratorTest={useIteratorTest}
                  historyPanelSide={historyPanelSide}
                  savedLogicResults={savedLogicResults}
                  savedTools={savedTools}
                  communicationModel={'gpt-4o'} // Default model for communication
                  logicArchitectModel={'gpt-4o'} // Default model for logic architect
                  createToolModel={'gpt-4o'} // Default model for tool creation
                  availableModels={[
                    { id: 'gpt-4o', name: 'GPT-4o' },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
                  ]}
                  onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                  onToggleMockData={() => setUseMockData(!useMockData)}
                  onToggleIteratorTest={() => setUseIteratorTest(!useIteratorTest)}
                  onToggleHistoryPanel={() => setHistoryPanelSide(historyPanelSide === 'left' ? 'right' : 'left')}
                  onResetWorkflow={resetWorkflow}
                  onShowLogicSelect={() => setShowLogicSelect(true)}
                  onShowToolsSelect={() => setShowToolsSelect(true)}
                  onTestBrainstorming={async () => {
                    try {
                      // Create a test context for brainstorming
                      const testContext = {
                        userIntent: 'Create a ROI calculator for business professionals',
                        toolType: 'ROI Calculator',
                        targetAudience: 'business professionals',
                        industry: 'general business',
                        businessDescription: 'Help businesses calculate return on investment for various scenarios',
                        collectedAnswers: {},
                        features: ['charts', 'export', 'comparisons'],
                        colors: ['professional-blue']
                      };

                      const newTool = await createToolWithBrainstorming(
                        testContext,
                        setShowBrainstormingPanel,
                        setIsBrainstorming,
                        setBrainstormingThoughts,
                        setIsGeneratingTool,
                        setLastAIMessage,
                        setLatestBrainstormingResult,
                        saveLogicResult,
                        setSavedLogicResults,
                        getSavedLogicResults,
                        transitionToNewContent
                      );

                      if (newTool) {
                        // 🛡️ Validate tool before saving to prevent storing corrupted tools
                        if (!isValidProductToolDefinition(newTool)) {
                          console.error('🛡️ VALIDATION: Brainstorming test tool failed validation - not saving');
                          setLastAIMessage(`❌ Generated tool failed validation checks. The AI created an invalid tool structure. Please try again.`);
                          return;
                        }
                        
                        setProductToolDefinition(newTool);
                        saveCreatedTool(newTool);
                        setSavedTools(getSavedTools());
                        
                        // 🛡️ Save to IndexedDB with validation
                        try {
                          await saveLastActiveToolToDB(newTool);
                          console.log('🛡️ VALIDATION: Brainstorming tool successfully saved to IndexedDB');
                        } catch (saveError) {
                          console.error('🛡️ VALIDATION: Failed to save brainstorming tool to IndexedDB:', saveError);
                        }
                      }
                    } catch (error) {
                      console.error('Brainstorming test failed:', error);
                      setLastAIMessage(`❌ Brainstorming test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                  }}
                  onTestToolCreation={async () => {
                    try {
                      // Set loading states and show loading message
                      setIsLoading(true);
                      setIsGeneratingTool(true);
                      
                      // 🎲 Get a random test scenario from our comprehensive test suite
                      const randomScenario = getRandomTestScenario();
                      
                      console.log(`🎲 Testing with random scenario: ${randomScenario.name} (${randomScenario.context.complexity} complexity)`);
                      
                      await transitionToNewContent(() => {
                        setLastAIMessage(`Creating random test tool: "${randomScenario.name}"...`);
                      });

                      console.log('🧪 TRACE: RANDOM TEST TOOL CREATION START');
                      console.log('🧪 TRACE: Random scenario context:', JSON.stringify(randomScenario.context, null, 2));

                      const newTool = await callToolCreationAgent(randomScenario.context, undefined, undefined);
                      
                      console.log('🧪 TRACE: callToolCreationAgent returned:', newTool?.id);
                      console.log('🧪 TRACE: Tool metadata title:', newTool?.metadata?.title);
                      
                      if (newTool) {
                        console.log('🛠️ Setting new random tool in state:', newTool.metadata.title);
                        
                        // 🛡️ Validate tool before saving to prevent storing corrupted tools
                        if (!isValidProductToolDefinition(newTool)) {
                          console.error('🛡️ VALIDATION: Random test tool failed validation - not saving');
                          await transitionToNewContent(() => {
                            setLastAIMessage(`❌ Generated tool failed validation checks. The AI created an invalid tool structure. Please try again.`);
                          });
                          return;
                        }
                        
                        // Update with success message and transition
                        await transitionToNewContent(() => {
                          setLastAIMessage(`✅ Successfully created random test tool: "${newTool.metadata.title}"! 🎲 Industry: ${randomScenario.context.industry} | Complexity: ${randomScenario.context.complexity}`);
                          setProductToolDefinition(newTool);
                        });
                        
                        saveCreatedTool(newTool); // Also save to localStorage for the UI
                        setSavedTools(getSavedTools()); // Refresh saved tools list
                        
                        // 🛡️ Save to IndexedDB with validation
                        try {
                          await saveLastActiveToolToDB(newTool);
                          console.log('🛡️ VALIDATION: Tool successfully saved to IndexedDB');
                        } catch (saveError) {
                          console.error('🛡️ VALIDATION: Failed to save tool to IndexedDB:', saveError);
                        }
                      }
                    } catch (error) {
                      console.error('🧪 TRACE: Random tool creation test failed:', error);
                      await transitionToNewContent(() => {
                        setLastAIMessage(`❌ Random tool creation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
                      });
                    } finally {
                      setIsLoading(false);
                      setIsGeneratingTool(false);
                    }
                  }}
                  onTestMultiPart={() => {
                    handleAIFreeformInput('send a test multi-input', conversationHistory, collectedAnswers, currentStep, setLastAIMessage, handleAIGeneratedQuestion, setShowBrainstormingPanel, setIsBrainstorming, setBrainstormingThoughts, setIsGeneratingTool, setLatestBrainstormingResult, saveLogicResult, setSavedLogicResults, getSavedLogicResults, transitionToNewContent, productToolDefinition, setProductToolDefinition);
                  }}
                  onTestFileUpload={() => {
                    handleAIFreeformInput('test file upload ui', conversationHistory, collectedAnswers, currentStep, setLastAIMessage, handleAIGeneratedQuestion, setShowBrainstormingPanel, setIsBrainstorming, setBrainstormingThoughts, setIsGeneratingTool, setLatestBrainstormingResult, saveLogicResult, setSavedLogicResults, getSavedLogicResults, transitionToNewContent, productToolDefinition, setProductToolDefinition);
                  }}
                  onTestColorPicker={() => {
                    handleAIFreeformInput('test color picker', conversationHistory, collectedAnswers, currentStep, setLastAIMessage, handleAIGeneratedQuestion, setShowBrainstormingPanel, setIsBrainstorming, setBrainstormingThoughts, setIsGeneratingTool, setLatestBrainstormingResult, saveLogicResult, setSavedLogicResults, getSavedLogicResults, transitionToNewContent, productToolDefinition, setProductToolDefinition);
                  }}
                  onTestComponentValidation={() => {
                    handleAIFreeformInput('test component validation', conversationHistory, collectedAnswers, currentStep, setLastAIMessage, handleAIGeneratedQuestion, setShowBrainstormingPanel, setIsBrainstorming, setBrainstormingThoughts, setIsGeneratingTool, setLatestBrainstormingResult, saveLogicResult, setSavedLogicResults, getSavedLogicResults, transitionToNewContent, productToolDefinition, setProductToolDefinition);
                  }}
                  onTestStyleUpdate={() => {
                    if (!productToolDefinition) {
                      setLastAIMessage('❌ No tool loaded. Please create a tool first before testing style updates.');
                      return;
                    }
                    handleAIFreeformInput('make the main title text larger and more prominent', conversationHistory, collectedAnswers, currentStep, setLastAIMessage, handleAIGeneratedQuestion, setShowBrainstormingPanel, setIsBrainstorming, setBrainstormingThoughts, setIsGeneratingTool, setLatestBrainstormingResult, saveLogicResult, setSavedLogicResults, getSavedLogicResults, transitionToNewContent, productToolDefinition, setProductToolDefinition);
                  }}
                  onCommunicationModelChange={(model: string) => {
                    console.log('Communication model changed to:', model);
                    // Could implement actual model switching here
                  }}
                  onLogicArchitectModelChange={(model: string) => {
                    console.log('Logic Architect model changed to:', model);
                    // Could implement actual model switching here
                  }}
                  onCreateToolModelChange={(model: string) => {
                    console.log('Create Tool model changed to:', model);
                    // Could implement actual model switching here
                  }}
                />
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Progress value={progressPercentage} className="flex-1 h-2" />
          <span className={`text-xs font-medium min-w-fit ${
            isDarkMode ? 'text-gray-50' : 'text-gray-500'
          }`}>
            Step {currentStep}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Main Content - Canvas with Fixed Bottom */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* History Panel Tab */}
        {!showHistoryPanel && (
          <button
            onClick={() => setShowHistoryPanel(true)}
            className={`
              absolute top-1/2 transform -translate-y-1/2 z-30
              ${historyPanelSide === 'left' ? 'left-0' : 'right-0'}
              ${isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              }
              border shadow-lg transition-all duration-200 hover:shadow-xl
              ${historyPanelSide === 'left' 
                ? 'rounded-r-lg border-l-0 pl-2 pr-3' 
                : 'rounded-l-lg border-r-0 pr-2 pl-3'
              }
              py-3 flex items-center gap-2 text-sm font-medium
            `}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
            {historyPanelSide === 'left' ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </button>
        )}

        {/* Canvas Tool Section - Scrollable */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Editing Mode Overlay */}
          {isEditingPrevious && editingTarget && (
            <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-40 
              ${editingOverlayFadingOut 
                ? 'animate-out fade-out slide-out-to-top-2 duration-500' 
                : 'animate-in fade-in duration-500 slide-in-from-top-2'
              }
              ${isDarkMode 
                ? 'bg-orange-900/90 border-orange-600 text-orange-100' 
                : 'bg-orange-100/95 border-orange-400 text-orange-800'
              }
              border rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm
            `}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Edit3 className="h-4 w-4" />
                <span>Editing: {editingTarget.replace(/-/g, ' ')}</span>
              </div>
            </div>
          )}

          <CanvasTool 
            isDarkMode={isDarkMode}
            productToolDefinition={productToolDefinition}
            isGenerating={isGeneratingTool}
            generatingMessage={isGeneratingTool ? "Creating your custom tool..." : ""}
          />
        </div>

        {/* Bottom Section - AI Assistant and Input Side by Side */}
        <InteractionPanel
          isDarkMode={isDarkMode}
          isLoading={isLoading}
          isGeneratingTool={isGeneratingTool}
          lastAIMessage={lastAIMessage}
          currentQuestion={currentQuestion}
          isInMultiPart={isInMultiPart}
          multiPartQuestions={multiPartQuestions}
          multiPartIndex={multiPartIndex}
          multiPartAnswers={multiPartAnswers}
          currentInput={currentInput}
          transitionOpacity={transitionOpacity}
          customColors={customColors}
          onInputChange={setCurrentInput}
          onInputSubmit={handleInputSubmit}
          onOpenColorPicker={() => setShowColorPickerPopup(true)}
          onPreviewUpdate={(questionId, value) => {
            // Enhanced preview update for live color changes
            if (currentQuestion && currentQuestion.options) {
              const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
              if (selectedOption && selectedOption.colors) {
                // For AI-generated colors, update with actual hex values
                setToolData((prev: any) => ({
                  ...prev,
                  colorScheme: 'custom',
                  customColors: selectedOption.colors
                }));
                console.log('🎨 Live preview update with AI colors:', selectedOption.colors);
                return;
              }
            }
            // Fallback to standard update for predefined colors
            updateToolData(questionId, value);
          }}
          onSwitchToChat={handleSwitchToChat}
          onShowFullForm={() => {
            // Initialize full form with current answers
            const currentAnswers = { ...multiPartAnswers };
            if (currentInput.trim()) {
              currentAnswers[multiPartQuestions[multiPartIndex]?.id] = currentInput;
            }
            setFullFormAnswers(currentAnswers);
            setShowFullFormPopup(true);
          }}
          setCurrentInput={setCurrentInput}
          setFullFormAnswers={setFullFormAnswers}
          setShowFullFormPopup={setShowFullFormPopup}
          updateToolDataFromMultiPart={updateToolDataFromMultiPart}
        />
      </div>

      {/* Input History Panel */}
      <InputHistory
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        side={historyPanelSide}
        answers={collectedAnswers}
        questionHistory={questionHistory}
        onAnswerUpdate={handleAnswerUpdate}
        isDarkMode={isDarkMode}
      />

      {/* Color Picker Popup */}
      <ColorPickerPopup
        isOpen={showColorPickerPopup}
        onClose={() => setShowColorPickerPopup(false)}
        onSubmit={handleColorPickerSubmit}
        isDarkMode={isDarkMode}
      />

      {/* Full Form Popup */}
      <FullFormPopup
        isOpen={showFullFormPopup}
        onClose={() => setShowFullFormPopup(false)}
        onSubmit={async (answers) => {
          // Handle full form submission - same as completing iterator sequence
          console.log('Full form submitted:', answers);
          
          // Set the answers and complete the multi-part sequence
          setMultiPartAnswers(answers);
          
          // Store all multi-part answers as a single answer for main workflow
          const mainQuestionId = questionQueue[currentQuestionIndex]?.id || 'multi-part-unknown';
          const newCollectedAnswers = { ...collectedAnswers, [mainQuestionId]: JSON.stringify(answers) };
          setCollectedAnswers(newCollectedAnswers);
          
          // Exit multi-part mode and continue workflow
          setIsInMultiPart(false);
          setMultiPartQuestions([]);
          setMultiPartIndex(0);
          setCurrentInput('');
          
          // Continue with main workflow
          await processMockWorkflow(newCollectedAnswers);
          
          setShowFullFormPopup(false);
        }}
        questions={multiPartQuestions}
        initialAnswers={fullFormAnswers}
        isDarkMode={isDarkMode}
      />

      {/* Behavior Learning Dashboard */}
      <div className="z-40">
        {/* Add your behavior learning dashboard component here */}
      </div>

      {/* Brainstorming Panel */}
      <BrainstormingPanel
        isOpen={showBrainstormingPanel}
        onClose={() => setShowBrainstormingPanel(false)}
        isBrainstorming={isBrainstorming}
        brainstormingThoughts={brainstormingThoughts}
        isDarkMode={isDarkMode}
      />

      {/* Saved Logic Results Panel */}
      <SavedLogicPanel
        isOpen={showLogicSelect}
        onClose={() => setShowLogicSelect(false)}
        savedLogicResults={savedLogicResults}
        onLoadResult={(result) => {
          console.log('Loading saved logic result:', result);
          setLatestBrainstormingResult(result.result);
          setShowLogicSelect(false);
        }}
        isDarkMode={isDarkMode}
      />

      {/* Saved Tools Panel */}
      <SavedToolsPanel
        isOpen={showToolsSelect}
        onClose={() => setShowToolsSelect(false)}
        savedTools={savedTools}
        onLoadTool={(savedTool) => {
          console.log('Loading saved tool:', savedTool.tool);
          setProductToolDefinition(savedTool.tool);
          setSavedTools(getSavedTools()); // Refresh saved tools list
          setShowToolsSelect(false);
        }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
