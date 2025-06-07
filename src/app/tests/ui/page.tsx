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
import { SavedToolsPopup } from './saved-tools-popup';
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
  processWithAI,
  createToolWithSavedBrainstorm
} from './ai-processing';
import { clearAllSavedData, getSavedTools } from './local-storage';
import { 
  isValidProductToolDefinition, 
  clearCorruptedToolFromStorage, 
  createSampleQuestion, 
  createMockQuestion 
} from './validation-utils';
import { 
  updateToolDataFromAnswers, 
  updateToolDataFromMultiPart, 
  processMockWorkflowStep, 
  handleMockFreeformResponse,
  handleColorPickerData,
  resetWorkflowState,
  extractAIContextFromAnswers,
  createAIQuestion,
  createFallbackQuestion
} from './workflow-utils';
import {
  transitionToNewContent as transitionHelper,
  trackQuestion,
  handleAnswerUpdate as handleAnswerUpdateHelper,
  handleSwitchToChat as handleSwitchToChatHelper,
  handleEditingModeCleanup,
  resetWorkflow as resetWorkflowHelper,
  initializeBehaviorTracking,
  trackQuestionActivation,
  trackInteractionBehavior
} from './handler-utils';

// Local Storage Utilities for Development
// const LOGIC_STORAGE_KEY = 'keyvex_logic_architect_results';
// const TOOLS_STORAGE_KEY = 'keyvex_created_tools';

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
  const [showSavedToolsPopup, setShowSavedToolsPopup] = useState(false);

  // NEW: Saved brainstorm selection mode
  const [useSavedBrainstorm, setUseSavedBrainstorm] = useState(false);
  const [selectedSavedBrainstorm, setSelectedSavedBrainstorm] = useState<SavedLogicResult | null>(null);

  // NEW: Model selection state
  const [communicationModel, setCommunicationModel] = useState('gpt-4o');
  const [logicArchitectModel, setLogicArchitectModel] = useState('gpt-4o');
  const [createToolModel, setCreateToolModel] = useState('gpt-4o');

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
    if (useMockData && questionQueue.length === 0 && currentWorkflow[0]) {
      console.log('🔧 Initializing with first mock question');
      setQuestionQueue([currentWorkflow[0]]);
      setCurrentQuestionIndex(0);
      // Also add to question history for consistent editing
      setQuestionHistory([currentWorkflow[0]]);
    }
    // Clear question history when switching to AI mode to prevent errors
    if (!useMockData) {
      console.log('🔧 Clearing question history for AI mode');
      setQuestionHistory([]);
    }
  }, [useMockData, currentWorkflow]); // Removed questionQueue.length dependency

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

  // Initialize DB, then storage, then behavior tracker
  useEffect(() => {
    openToolDB().then(() => {
      console.log("Database opened successfully");
      
      // Clear any corrupted tool on startup to prevent rendering errors
      setProductToolDefinition(null);
      
      initializeFromStorage(); // Load data from IndexedDB
      
      // Initialize behavior tracker after DB is open and initial data load attempted
      if (!behaviorTracker) {
        const trackerInstance = initBehaviorTracker('test-ui-page');
        setBehaviorTracker(trackerInstance);
        console.log("Behavior tracker initialized.");
      }
    }).catch(error => {
      console.error("Failed to open database:", error);
      // Attempt to initialize behavior tracker even if DB fails, as it might be used for non-DB related tracking
      if (!behaviorTracker) {
        const trackerInstance = initBehaviorTracker('test-ui-page');
        setBehaviorTracker(trackerInstance);
        console.warn("Behavior tracker initialized despite DB opening failure.");
      }
    });
  }, []); // Empty dependency array ensures this runs once on mount

  // Helper to load and set saved tools from IndexedDB
  const loadAndSetSavedTools = async () => {
    try {
      const toolsFromDB = await loadAllToolsFromDB();
      const formattedTools: SavedTool[] = toolsFromDB.map(tool => ({
        id: tool.id,
        timestamp: tool.updatedAt || tool.createdAt || Date.now(), // Ensure fallback for timestamp
        date: new Date(tool.updatedAt || tool.createdAt || Date.now()).toLocaleString(),
        title: tool.metadata?.title || 'Untitled Tool',
        tool: tool,
      })) as SavedTool[];
      setSavedTools(formattedTools);
      console.log('💾 Loaded saved tools from IndexedDB:', formattedTools.length);
    } catch (error) {
      console.error('❌ Error loading saved tools from IndexedDB:', error);
      setSavedTools([]); // Set to empty array on error
    }
  };

  // Helper to load and set saved logic results from IndexedDB
  const loadAndSetSavedLogicResults = async () => {
    try {
      const logicResultsFromDB = await loadLogicResultsFromDB();
      setSavedLogicResults(logicResultsFromDB);
      console.log('💾 Loaded saved logic results from IndexedDB:', logicResultsFromDB.length);
    } catch (error) {
      console.error('❌ Error loading saved logic results from IndexedDB:', error);
      setSavedLogicResults([]); // Set to empty array on error
    }
  };

  // Add missing clearConversationHistory function
  const clearConversationHistory = () => {
    setConversationHistory([]);
    setQuestionHistory([]);
    setCollectedAnswers({});
    setCurrentInput('');
    setLastAIMessage("Conversation history cleared. How can I help you?");
  };

  // Initialize data from IndexedDB (called after DB is confirmed open)
  const initializeFromStorage = async () => {
    console.log('🔄 Initializing from IndexedDB...');
    const lastTool = await loadLastActiveToolFromDB();
    if (lastTool && isValidProductToolDefinition(lastTool)) {
      console.log('✅ Loaded last active tool from DB:', lastTool.metadata.title);
      // Temporarily disabled to prevent crash from corrupted tool. Will be re-enabled.
      // setProductToolDefinition(lastTool); 
    } else if (lastTool) {
      console.warn('🚨 Found corrupted tool in DB, clearing it.');
      await clearLastActiveToolFromDB();
    }

    await loadAndSetSavedTools();
    await loadAndSetSavedLogicResults();
    
    console.log('🔧 Storage initialization complete.');
  };

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
    if (isLoading || isGeneratingTool || isBrainstorming) return;

    setIsLoading(true);
    setLastAIMessage("Processing your input...");
    
    // Fix trackInteractionBehavior call - use simplified version that matches current usage
    const tracker = getBehaviorTracker();
    if (tracker) {
      // Fix: Use the correct method signature for trackInteraction
      tracker.trackInteraction({
        interactionType: 'question_response',
        userResponse: currentInput,
        responseTime: Date.now() - responseStartTime,
        currentStep,
        totalSteps,
        workflowType: useIteratorTest ? 'iterator_test' : useMockData ? 'standard' : 'ai_mode',
        isMultiPart: false,
        usedSuggestions: false,
        usedCustomInput: true,
        editedPrevious: false,
        switchedToChat: false
      });
    }

    const currentQuestion = questionQueue[currentQuestionIndex];
    let tempCollectedAnswers = { ...collectedAnswers };

    // In AI mode, allow freeform input even without a current question
    if (!currentQuestion && useMockData) {
      console.warn('No current question available in mock mode');
      setIsLoading(false);
      return;
    }

    // Track the interaction before processing
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

    if (currentQuestion && (currentInput.trim() || currentQuestion.inputType === 'file-upload' || currentQuestion.inputType === 'color-picker')) {
        if (currentQuestion.inputType === 'file-upload') {
            // File upload handling logic (remains unchanged, assuming it doesn't directly save to LS for tools/logic)
        } else if (currentQuestion.inputType === 'color-picker') {
            // Color picker handling logic (remains unchanged)
        } else {
            tempCollectedAnswers[currentQuestion.id] = currentInput;
        }
        setCollectedAnswers(tempCollectedAnswers);
        setCurrentInput('');
    }

    if (useMockData) {
      // Mock data workflow processing
      console.log("🧪 Mock mode - processing workflow");
      await processMockWorkflow(tempCollectedAnswers);
      setIsLoading(false);
    } else {
      // AI Workflow
      console.log("🤖 AI Workflow: Processing with AI", {
        currentInput,
        hasCurrentQuestion: !!currentQuestion,
        tempCollectedAnswers,
        conversationHistoryLength: conversationHistory.length
      });
      
      if (!currentQuestion && currentInput.trim()) {
        // Freeform chat mode - use the dedicated freeform handler
        console.log("🤖 Freeform chat mode detected");
        await handleMockFreeformInput(currentInput);
      } else {
        // Standard AI workflow with questions
        setIsLoading(true);
        setLastAIMessage("Processing your input...");
        try {
          await processWithAI(
            tempCollectedAnswers,
            conversationHistory,
            currentStep,
            setLastAIMessage,
            handleAIGeneratedQuestion,
            setShowBrainstormingPanel,
            setIsBrainstorming,
            setBrainstormingThoughts,
            setIsGeneratingTool,
            setLatestBrainstormingResult,
            stubSaveLogicResult, // Add stub function
            stubSetSavedLogicResults, // Add stub function  
            stubGetSavedLogicResults, // Add stub function
            transitionToNewContent,
            productToolDefinition,
            setProductToolDefinition
          );
          
          // Clear the input after processing
          setCurrentInput('');
          // After processing, if a brainstorm result might have been saved by processWithAI (via ai-processing.ts),
          // refresh the list from IndexedDB.
          await loadAndSetSavedLogicResults();
        } catch (error) {
          console.error("AI processing error:", error);
          setLastAIMessage("Sorry, I encountered an error. Please try again.");
        } finally {
          setIsLoading(false); // Ensure isLoading is reset
        }
      }
    }
    // ... (advanceToNextQuestion or other logic previously here)
    // This part needs to be carefully reviewed from original to ensure flow integrity.
    // For now, assuming advanceToNextQuestion or similar is handled correctly after AI/mock processing.
    if (currentQuestionIndex < questionQueue.length - 1) {
        // advanceToNextQuestion(); // Or similar logic
    } else {
        // End of queue logic
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
    console.log('🔧 processMockWorkflow called:', { currentStep, workflowLength: currentWorkflow.length, answers });
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

  // Add stub functions for localStorage parameters that are no longer used
  const stubSaveLogicResult = (toolType: string, targetAudience: string, industry: string | undefined, result: any, storageKey: string) => {
    // This function is no longer used since we migrated to IndexedDB
    console.log('🔧 Legacy saveLogicResult stub called - functionality moved to IndexedDB');
  };
  
  const stubSetSavedLogicResults = (results: any[]) => {
    // This function is no longer used since we migrated to IndexedDB  
    console.log('🔧 Legacy setSavedLogicResults stub called - functionality moved to IndexedDB');
  };
  
  const stubGetSavedLogicResults = (storageKey: string) => {
    // This function is no longer used since we migrated to IndexedDB
    console.log('🔧 Legacy getSavedLogicResults stub called - functionality moved to IndexedDB');
    return [];
  };

  const handleMockFreeformInput = async (input: string) => {
    if (isLoading || isGeneratingTool || isBrainstorming) return;
    setIsLoading(true);
    setLastAIMessage('Processing freeform input...');
    setCurrentInput(''); // Clear input after submission

    try {
      await handleAIFreeformInput(
        input,
        conversationHistory,
        collectedAnswers,
        currentStep,
        setLastAIMessage,
        handleAIGeneratedQuestion,
        setShowBrainstormingPanel,
        setIsBrainstorming,
        setBrainstormingThoughts,
        setIsGeneratingTool,
        setLatestBrainstormingResult,
        stubSaveLogicResult, // Add stub function
        stubSetSavedLogicResults, // Add stub function
        stubGetSavedLogicResults, // Add stub function
        transitionToNewContent,
        productToolDefinition,
        setProductToolDefinition
      );
      // After processing, if a brainstorm result might have been saved, refresh the list
      await loadAndSetSavedLogicResults();
    } catch (error) {
      console.error("AI freeform input processing error:", error);
      setLastAIMessage("Sorry, I encountered an error. Please try again.");
    } finally {
      setIsLoading(false);
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
    
    // Clear any corrupted tool on canvas
    setProductToolDefinition(null);
    
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

  // Track when a question becomes active (user starts responding)
  useEffect(() => {
    if (currentQuestion || isInMultiPart) {
      setResponseStartTime(Date.now());
    }
  }, [currentQuestion, isInMultiPart, multiPartIndex]);

  // Handler for creating tool with saved brainstorm
  const handleTestToolCreationWithSavedBrainstorm = async () => {
    if (!selectedSavedBrainstorm) {
      setLastAIMessage("Please select a saved brainstorm result first.");
      return;
    }
    setIsGeneratingTool(true);
    setLastAIMessage(`Creating tool from saved brainstorm: ${selectedSavedBrainstorm.toolType}`);
    setShowOptionsMenu(false); 

    try {
      // Fix: createToolWithSavedBrainstorm doesn't return a tool, it updates state directly
      await createToolWithSavedBrainstorm(
        selectedSavedBrainstorm,
        setIsGeneratingTool,
        setLastAIMessage,
        transitionToNewContent,
        setProductToolDefinition,
        isValidProductToolDefinition,
        createToolModel
      );

      // The tool is set via setProductToolDefinition in the function above
      setLastAIMessage(`✅ Tool created successfully from saved brainstorm!`);
      await loadAndSetSavedTools();
    } catch (error) {
      console.error("Error creating tool from saved brainstorm:", error);
      setLastAIMessage(`Error creating tool: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGeneratingTool(false);
      setSelectedSavedBrainstorm(null); 
      setUseSavedBrainstorm(false); 
    }
  };

  const handleClearAllSavedData = async () => {
    console.log("Clearing all saved data...");
    // clearAllSavedData from local-storage.ts might need to be updated to also clear IndexedDB thoroughly
    // For now, we ensure our specific IndexedDB stores are cleared regarding tools/logic.
    await openToolDB().then(db => {
        const tx = db.transaction(['productTools', 'logicArchitectResults', 'lastActiveTool'], 'readwrite');
        tx.objectStore('productTools').clear();
        tx.objectStore('logicArchitectResults').clear();
        tx.objectStore('lastActiveTool').clear();
        // Fix: return the transaction completion promise
        return new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
    }).catch(err => console.error("Error clearing IndexedDB stores:", err));
    
    // Also call the original clearAllSavedData if it handles other localStorage items
    try {
      clearAllSavedData('test-ui'); // Fix: provide required arguments
    } catch (error) {
      console.warn("clearAllSavedData function call failed:", error);
    }

    setSavedLogicResults([]);
    setSavedTools([]);
    setProductToolDefinition(null); 
    setLastAIMessage("All saved data has been cleared from IndexedDB and localStorage.");
    // Refresh lists from DB (they should be empty now)
    await loadAndSetSavedTools();
    await loadAndSetSavedLogicResults();
  };

  // Handler for deleting saved tools
  const handleDeleteSavedTool = async (toolId: string) => {
    try {
      await deleteToolFromDBList(toolId);
      await loadAndSetSavedTools(); // Refresh the list
    } catch (error) {
      console.error('Error deleting tool:', error);
      throw error; // Re-throw so popup can handle error display
    }
  };

  // Mock tool creation function for testing
  const mockToolCreation = async () => {
    setIsGeneratingTool(true);
    setLastAIMessage("🧪 Running mock tool creation test...");
    
    try {
      // Simulate the full workflow using mock data
      const calculatorType = getRandomCalculatorType();
      console.log(`🧪 Mock Tool Creation: ${calculatorType.toolType} - ${calculatorType.userIntent}`);
      
      // Simulate a delay for tool creation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Complete the mock workflow by advancing through the steps quickly
      setLastAIMessage("🧪 Mock workflow completed! Switch to AI mode to test real tool creation.");
      
      // Update to show a sample tool on canvas
      const sampleTool: ProductToolDefinition = {
        id: `mock-tool-${Date.now()}`,
        slug: `mock-tool-${Date.now()}`,
        version: '1.0.0',
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'mock-test',
        
        metadata: {
          id: `mock-tool-${Date.now()}`,
          slug: `mock-tool-${Date.now()}`,
          title: `${calculatorType.toolType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
          description: calculatorType.userIntent,
          shortDescription: `Mock ${calculatorType.toolType}`,
          type: 'calculator',
          category: 'business',
          targetAudience: calculatorType.targetAudience,
          industry: calculatorType.industry,
          tags: ['mock', 'test', ...calculatorType.features],
          estimatedCompletionTime: 5,
          difficultyLevel: 'beginner',
          features: calculatorType.features,
          icon: { type: 'lucide', value: 'Calculator' }
        },
        
        componentSet: 'shadcn',
        componentCode: `'use client';
const { useState } = React;
function MockBusinessCalculator() {
  const [revenue, setRevenue] = useState('');
  const [costs, setCosts] = useState('');
  
  const profit = (parseFloat(revenue) || 0) - (parseFloat(costs) || 0);
  const margin = revenue ? ((profit / parseFloat(revenue)) * 100).toFixed(1) : '0';
  
  return React.createElement('div', { 
    className: 'max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg',
    'data-style-id': 'main-container',
    key: 'main-container'
  }, [
    React.createElement('h1', { 
      className: 'text-2xl font-bold text-gray-900 mb-6',
      'data-style-id': 'main-title',
      key: 'main-title'
    }, '${calculatorType.toolType.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())}'),
    React.createElement('div', { 
      className: 'space-y-4 mb-6',
      key: 'inputs-section'
    }, [
      React.createElement('div', { key: 'revenue-input' }, [
        React.createElement('label', { 
          className: 'block text-sm font-medium text-gray-700 mb-2',
          key: 'revenue-label'
        }, 'Revenue ($)'),
        React.createElement('input', {
          type: 'number',
          value: revenue,
          onChange: (e) => setRevenue(e.target.value),
          className: 'w-full p-3 border border-gray-300 rounded-lg',
          'data-style-id': 'revenue-input',
          key: 'revenue-field'
        })
      ]),
      React.createElement('div', { key: 'costs-input' }, [
        React.createElement('label', { 
          className: 'block text-sm font-medium text-gray-700 mb-2',
          key: 'costs-label'
        }, 'Costs ($)'),
        React.createElement('input', {
          type: 'number',
          value: costs,
          onChange: (e) => setCosts(e.target.value),
          className: 'w-full p-3 border border-gray-300 rounded-lg',
          'data-style-id': 'costs-input',
          key: 'costs-field'
        })
      ])
    ]),
    React.createElement('div', { 
      className: 'bg-blue-50 p-4 rounded-lg',
      'data-style-id': 'results-section',
      key: 'results-section'
    }, [
      React.createElement('h3', { 
        className: 'text-lg font-semibold text-blue-900 mb-2',
        key: 'results-title'
      }, 'Results'),
      React.createElement('p', { 
        className: 'text-blue-800',
        key: 'profit-result'
      }, 'Profit: $' + profit.toLocaleString()),
      React.createElement('p', { 
        className: 'text-blue-800',
        key: 'margin-result'
      }, 'Margin: ' + margin + '%')
    ])
  ]);
}`,
        
        initialStyleMap: {
          'main-container': 'max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg',
          'main-title': 'text-2xl font-bold text-gray-900 mb-6',
          'revenue-input': 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500',
          'costs-input': 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500',
          'results-section': 'bg-blue-50 p-4 rounded-lg border border-blue-200'
        },
        
        currentStyleMap: {
          'main-container': 'max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg',
          'main-title': 'text-2xl font-bold text-gray-900 mb-6',
          'revenue-input': 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500',
          'costs-input': 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500',
          'results-section': 'bg-blue-50 p-4 rounded-lg border border-blue-200'
        },
        
        colorScheme: {
          primary: '#3b82f6',
          secondary: '#1e40af',
          background: '#ffffff',
          surface: '#f9fafb',
          text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
          border: '#e5e7eb',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444'
        },
        
        analytics: { enabled: true, completions: 0, averageTime: 0 }
      };
      
      // Set the mock tool on canvas
      await transitionToNewContent(() => {
        setProductToolDefinition(sampleTool);
        setLastAIMessage(`🧪 Mock tool "${sampleTool.metadata.title}" created and displayed on canvas!`);
      });
      
    } catch (error) {
      console.error("Mock tool creation error:", error);
      setLastAIMessage(`❌ Mock tool creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingTool(false);
    }
  };

  const onTestToolCreation = async () => {
    if (!useMockData) {
      console.log("Starting full workflow test (brainstorming + tool creation)...");
      setLastAIMessage("🚧 Testing full workflow: brainstorming + tool creation...");
    } else {
      console.log("Starting mock tool creation test...");
      setLastAIMessage("🚧 Testing mock tool creation...");
      await mockToolCreation();
      return;
    }

    const baseContext = {
      userIntent: 'Create a test business tool',
      toolType: 'calculator',
      targetAudience: 'business professionals',
      industry: 'business',
      businessDescription: 'General business consulting',
      features: ['calculations', 'reporting'],
      colors: ['blue', 'green'],
      collectedAnswers: {}
    };

    try {
      // Call the function that includes brainstorming
      const newTool = await createToolWithBrainstorming(
        baseContext,
        setShowBrainstormingPanel,
        setIsBrainstorming,
        setBrainstormingThoughts,
        setIsGeneratingTool, // It will manage this state internally too
        setLastAIMessage,
        setLatestBrainstormingResult,
        transitionToNewContent, // Make sure this is correctly defined and passed
        logicArchitectModel,
        createToolModel
      );

      // The createToolWithBrainstorming function should ideally return the created tool
      // or handle setting it and updating UI messages internally.
      // For this example, we assume it returns the tool or null/throws error.
      // The actual saving to DB and state update is now handled within createToolWithBrainstorming/callToolCreationAgent

      if (newTool && isValidProductToolDefinition(newTool)) {
        // 🔧 FIX: Ensure canvas displays the tool by updating state AFTER brainstorming is complete
        console.log('🎨 Setting product tool definition for canvas display:', newTool.metadata.title);
        
        // Update canvas state to display the tool
        await transitionToNewContent(() => {
          setProductToolDefinition(newTool);
          setLastAIMessage(`✅ Full workflow test tool '${newTool.metadata.title}' created and ready on canvas!`);
        });
        
        // Refresh saved data lists
        await loadAndSetSavedTools(); // Refresh saved tools list
        await loadAndSetSavedLogicResults(); // Refresh saved brainstorming results list
        
        console.log('🎯 Canvas should now display tool:', newTool.id);
      } else if (newTool === null && !isGeneratingTool) {
        // This case implies brainstorming or creation was aborted but no hard error thrown,
        // and isGeneratingTool was reset.
        // setLastAIMessage("Tool creation process was inconclusive or manually stopped before completion.");
        // No specific error, message already set by createToolWithBrainstorming
      } else if (!newTool) {
        // This case implies an error occurred and was handled internally by createToolWithBrainstorming,
        // which should have set an appropriate error message via setLastAIMessage.
        console.error("Error: Test tool creation via full workflow failed. The function returned no tool, and an error message should have been set.");
        // setLastAIMessage might have already been updated by createToolWithBrainstorming
      }
    } catch (error) {
      console.error("Error during 'onTestToolCreation' (full workflow):", error);
      setLastAIMessage(`Error creating test tool via full workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // setIsGeneratingTool(false); // Ensure it's reset on catch, though createToolWithBrainstorming should also handle this in its finally block
    } finally {
      // setIsGeneratingTool(false); // createToolWithBrainstorming should manage this.
      // If it doesn't, or there are paths where it might not, uncommenting this might be necessary.
      // For now, trust createToolWithBrainstorming to reset its own state setters.
      console.log("onTestToolCreation finally block reached. isGeneratingTool:", isGeneratingTool);
    }
  };

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
                  onClose={() => setShowOptionsMenu(false)}
                  onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                  isDarkMode={isDarkMode}
                  useMockData={useMockData}
                  useIteratorTest={useIteratorTest}
                  historyPanelSide={historyPanelSide}
                  savedLogicResults={savedLogicResults}
                  savedTools={savedTools}
                  communicationModel={communicationModel}
                  logicArchitectModel={logicArchitectModel}
                  createToolModel={createToolModel}
                  availableModels={[
                    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
                    { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' }
                  ]}
                  useSavedBrainstorm={useSavedBrainstorm}
                  selectedSavedBrainstorm={selectedSavedBrainstorm}
                  onToggleMockData={() => setUseMockData(!useMockData)}
                  onToggleIteratorTest={() => setUseIteratorTest(!useIteratorTest)}
                  onToggleHistoryPanel={() => setHistoryPanelSide(historyPanelSide === 'left' ? 'right' : 'left')}
                  onResetWorkflow={resetWorkflow}
                  onShowLogicSelect={() => setShowLogicSelect(true)}
                  onShowToolsSelect={() => setShowSavedToolsPopup(true)}
                  onTestBrainstorming={() => {
                    // Test brainstorming functionality
                    setShowOptionsMenu(false);
                  }}
                  onTestToolCreation={onTestToolCreation}
                  onTestMultiPart={() => {
                    // Test multi-part functionality
                    setShowOptionsMenu(false);
                  }}
                  onTestFileUpload={() => {
                    // Test file upload functionality
                    setShowOptionsMenu(false);
                  }}
                  onTestColorPicker={() => {
                    // Test color picker functionality
                    setShowOptionsMenu(false);
                  }}
                  onTestComponentValidation={() => {
                    // Test component validation functionality
                    setShowOptionsMenu(false);
                  }}
                  onTestStyleUpdate={() => {
                    // Test style update functionality
                    setShowOptionsMenu(false);
                  }}
                  onCommunicationModelChange={setCommunicationModel}
                  onLogicArchitectModelChange={setLogicArchitectModel}
                  onCreateToolModelChange={setCreateToolModel}
                  onToggleSavedBrainstormMode={() => setUseSavedBrainstorm(!useSavedBrainstorm)}
                  onSelectSavedBrainstorm={(result: SavedLogicResult) => {
                    setSelectedSavedBrainstorm(result);
                    setUseSavedBrainstorm(true);
                    setLastAIMessage(`Selected brainstorm: ${result.toolType}. Click 'Create with Saved Brainstorm'.`);
                    setShowOptionsMenu(false);
                  }}
                  onTestToolCreationWithSavedBrainstorm={handleTestToolCreationWithSavedBrainstorm}
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
        questionHistory={questionHistory.filter(q => q && q.id && q.inputType && q.message)}
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
        onLoadTool={async (savedTool) => {
          console.log('Loading saved tool:', savedTool.tool);
          setProductToolDefinition(savedTool.tool);
          await saveLastActiveToolToDB(savedTool.tool); // Save to IndexedDB as last active
          await loadAndSetSavedTools(); // Refresh saved tools list from IndexedDB
          setShowToolsSelect(false);
        }}
        isDarkMode={isDarkMode}
      />

      {/* Saved Tools Popup */}
      <SavedToolsPopup
        isOpen={showSavedToolsPopup}
        onClose={() => setShowSavedToolsPopup(false)}
        savedTools={savedTools}
        onLoadTool={async (tool) => {
          console.log('Loading saved tool from popup:', tool);
          setProductToolDefinition(tool);
          await saveLastActiveToolToDB(tool); // Save to IndexedDB as last active
          // Don't close the popup - let user browse multiple tools
        }}
        onDeleteTool={handleDeleteSavedTool}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
