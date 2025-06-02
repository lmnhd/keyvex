'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// Import extracted modules
import { mockWorkflow, iteratorTestWorkflow, getRandomCalculatorType } from './mock-data';
import { OptionsMenu, CanvasTool, ToolInfoBubble } from './components';
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
  deleteToolFromDBList
} from './db-utils';
import {
  handleStreamingAIRequest,
  callToolCreationAgent,
  handleStyleUpdate,
  createToolWithBrainstorming
} from './ai-processing';
import {
  updateToolDataFromAnswers,
  updateToolDataFromMultiPart,
  processMockWorkflowStep,
  handleMockFreeformResponse,
  handleColorPickerData,
  resetWorkflowState,
  extractAIContextFromAnswers,
  createAIQuestion,
  createFallbackQuestion,
  updateToolData
} from './workflow-utils';

// Import additional components
import { DynamicInput } from '@/components/tool-creator-ui/inputs/DynamicInput';
import { ColorPickerPopup } from '@/components/tool-creator-ui/ColorPickerPopup';
import { FullFormPopup } from '@/components/tool-creator-ui/FullFormPopup';
import { InputHistory } from '@/components/tool-creator-ui/InputHistory';
import { initBehaviorTracker, getBehaviorTracker } from '@/lib/ai/behavior-tracker';
import { ProductToolDefinition } from '@/lib/types/product-tool';

// Local Storage Utilities for Development
const LOGIC_STORAGE_KEY = 'keyvex_logic_architect_results';
const TOOLS_STORAGE_KEY = 'keyvex_created_tools';

// IndexedDB Constants
const DB_NAME = 'KeyvexUIDevDB';
const TOOL_STORE_NAME = 'productTools';
const LOGIC_RESULT_STORE_NAME = 'logicArchitectResults';
const LAST_ACTIVE_TOOL_KEY = 'lastActiveTool_v1';

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
    
    existing.unshift(newResult);
    localStorage.setItem(LOGIC_STORAGE_KEY, JSON.stringify(existing.slice(0, 50)));
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
    
    existing.unshift(newTool);
    localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(existing.slice(0, 50)));
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

// Continue with the rest of the original component...
export default function UITestPage() {
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
    message?: string;
  }>>([]);
  const [latestBrainstormingResult, setLatestBrainstormingResult] = useState<any>(null);
  const [showBrainstormingPanel, setShowBrainstormingPanel] = useState(false);
  
  // NEW: Local storage state for saved logic results and tools
  const [savedLogicResults, setSavedLogicResults] = useState<SavedLogicResult[]>([]);
  const [savedTools, setSavedTools] = useState<SavedTool[]>([]);
  const [showLogicSelect, setShowLogicSelect] = useState(false);
  const [showToolsSelect, setShowToolsSelect] = useState(false);
  
  // Model selection state
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [availableModels] = useState([
    { id: 'gpt-4o', name: 'GPT-4o (OpenAI)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (OpenAI)' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Anthropic)' }
  ]);

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
      setQuestionHistory([currentWorkflow[0]]);
    }
  }, [useMockData, currentWorkflow]);

  // Handle workflow switching
  useEffect(() => {
    const newWorkflow = useIteratorTest ? iteratorTestWorkflow : mockWorkflow;
    setCurrentWorkflow(newWorkflow);
    
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

  // Helper function to handle smooth transitions between questions
  const transitionToNewContent = async (updateFunction: () => void) => {
    setIsTransitioning(true);
    setTransitionOpacity(0);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    updateFunction();
    
    setTimeout(() => {
      setTransitionOpacity(1);
      setIsTransitioning(false);
    }, 50);
  };

  // Progress calculation
  const progressPercentage = Math.round((currentStep / totalSteps) * 100);

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
                  selectedModel={selectedModel}
                  availableModels={availableModels}
                  onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                  onToggleMockData={() => setUseMockData(!useMockData)}
                  onToggleIteratorTest={() => {
                        setUseIteratorTest(!useIteratorTest);
                        // Reset workflow when switching
                  }}
                  onToggleHistoryPanel={() => setHistoryPanelSide(historyPanelSide === 'left' ? 'right' : 'left')}
                  onResetWorkflow={() => {
                    // Reset workflow logic
                    console.log('Reset workflow called');
                  }}
                  onShowLogicSelect={() => setShowLogicSelect(true)}
                  onShowToolsSelect={() => setShowToolsSelect(true)}
                  onTestBrainstorming={async () => {
                    try {
                      const testContext = {
                        userIntent: 'Create a marketing ROI calculator',
                        toolType: 'calculator',
                        targetAudience: 'small business owners',
                        industry: 'marketing',
                        businessDescription: 'Help businesses track their marketing investment returns'
                      };
                      await createToolWithBrainstorming(testContext, setBrainstormingThoughts, setIsBrainstorming, setShowBrainstormingPanel);
                    } catch (error) {
                      console.error('Test brainstorming failed:', error);
                    }
                  }}
                  onTestToolCreation={async () => {
                    try {
                      await transitionToNewContent(() => {
                        setLastAIMessage('🎲 Randomly selecting a tool type for testing...');
                      });
                      
                      const selectedCalculator = getRandomCalculatorType();
                      console.log(`🎲 Testing with random calculator: ${selectedCalculator.toolType}`);
                      
                      await transitionToNewContent(() => {
                        setLastAIMessage(`🎯 Selected: ${selectedCalculator.toolType.replace(/-/g, ' ')} for ${selectedCalculator.targetAudience}. Creating tool...`);
                      });
                      
                      await callToolCreationAgent(selectedCalculator, setProductToolDefinition, setIsGeneratingTool, transitionToNewContent, setLastAIMessage);
                    } catch (error) {
                      console.error('Test tool creation failed:', error);
                      
                      await transitionToNewContent(() => {
                        setLastAIMessage(`❌ Test tool creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      });
                    }
                  }}
                  onTestMultiPart={async () => {
                        if (!useMockData) {
                          setCurrentInput('send a test multi-input');
                          // await handleAIFreeformInput('send a test multi-input');
                        } else {
                          setLastAIMessage('Switch to AI Mode to test API commands!');
                        }
                      }}
                  onTestFileUpload={async () => {
                        if (!useMockData) {
                          setCurrentInput('send a test image-upload');
                          // await handleAIFreeformInput('send a test image-upload');
                        } else {
                          setLastAIMessage('Switch to AI Mode to test API commands!');
                        }
                      }}
                  onTestColorPicker={async () => {
                        if (!useMockData) {
                          setCurrentInput('send a test color-picker');
                          // await handleAIFreeformInput('send a test color-picker');
                        } else {
                          setLastAIMessage('Switch to AI Mode to test API commands!');
                        }
                      }}
                  onTestComponentValidation={() => {
                    import('@/lib/prompts/tool-creation-prompt').then(module => {
                      console.log('🧪 Running component validation tests...');
                      const results = module.runComponentValidationTests();
                      if (results.failed === 0) {
                        setLastAIMessage(`✅ All component validation tests passed! (${results.passed} tests)`);
                      } else {
                        setLastAIMessage(`⚠️ Component validation tests failed: ${results.failed} failures out of ${results.passed + results.failed} tests. Check console for details.`);
                      }
                    });
                  }}
                  onModelChange={(model) => setSelectedModel(model)}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Canvas Tool Section */}
        <div className="flex-1 overflow-y-auto relative">
          <ToolInfoBubble 
            productToolDefinition={productToolDefinition}
            isDarkMode={isDarkMode}
          />

          <CanvasTool 
            toolData={toolData} 
            colorScheme={toolData.colorScheme || 'professional-blue'}
            isDarkMode={isDarkMode}
            productToolDefinition={productToolDefinition ? productToolDefinition : undefined}
            isGenerating={isGeneratingTool}
            generatingMessage={isBrainstorming ? 'AI is brainstorming creative ideas for your tool...' : isGeneratingTool ? 'Creating your tool...' : undefined}
          />
        </div>

        {/* Bottom Section - AI Assistant and Input */}
        <div className={`border-t flex-shrink-0 grid grid-cols-1 lg:grid-cols-2 transition-all duration-300 ease-in-out min-h-[280px] ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          {/* AI Assistant Section */}
          <div className={`p-6 border-r transition-all duration-300 ease-in-out ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className={`rounded-xl border h-40 flex flex-col transition-all duration-300 ease-in-out ${
              isDarkMode 
                ? 'bg-gray-700/50 border-gray-600 text-blue-100 shadow-sm backdrop-blur-sm' 
                : 'bg-blue-50 border-blue-400 text-blue-900'
            }`}>
              <div className={`flex items-center gap-2 text-sm font-medium p-4 pb-2 flex-shrink-0 ${
                isDarkMode ? 'text-gray-50' : 'text-gray-800'
              }`}>
                <Sparkles className="h-4 w-4" />
                <span>AI Assistant</span>
                {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div 
                  className={`text-sm leading-relaxed font-medium transition-all duration-300 ease-in-out ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                  style={{ 
                    opacity: transitionOpacity,
                    transform: `translateY(${transitionOpacity === 1 ? '0' : '10px'})` 
                  }}
                >
                  {lastAIMessage && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {lastAIMessage}
                    </div>
                  )}
                  {isLoading && !lastAIMessage && (
                    <div className={`flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                      <span className="text-xs">AI is thinking...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className={`p-6 transition-all duration-300 ease-in-out ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="min-h-[168px] flex flex-col">
              <div className="text-center text-gray-500">
                <p className="text-sm">Input components will be rendered here</p>
                <p className="text-xs mt-2">Current question: {currentQuestion?.id || 'None'}</p>
                <p className="text-xs">Mock data: {useMockData ? 'Yes' : 'No'}</p>
                <p className="text-xs">Iterator test: {useIteratorTest ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 