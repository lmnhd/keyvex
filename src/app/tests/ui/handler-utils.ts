// Event Handler Utilities
// Contains helper functions for managing state transitions, question tracking, and user interactions

import { getBehaviorTracker } from '@/lib/ai/behavior-tracker';

// Helper function to handle smooth transitions between questions
export const transitionToNewContent = async (
  updateFunction: () => void,
  setIsTransitioning: (transitioning: boolean) => void,
  setTransitionOpacity: (opacity: number) => void
) => {
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

// Helper function to track questions for editing functionality
export const trackQuestion = (
  question: any,
  setQuestionHistory: (updater: (prev: any[]) => any[]) => void
) => {
  setQuestionHistory(prev => {
    // Avoid duplicates
    const exists = prev.find(q => q.id === question.id);
    if (exists) return prev;
    return [...prev, question];
  });
};

// Helper function to handle answer updates for editing mode
export const handleAnswerUpdate = (
  questionId: string,
  newValue: string,
  questionHistory: any[],
  currentWorkflow: any[],
  setters: {
    setIsEditingPrevious: (editing: boolean) => void;
    setEditingTarget: (target: string | null) => void;
    setEditingOverlayFadingOut: (fading: boolean) => void;
    setQuestionQueue: (queue: any[]) => void;
    setCurrentQuestionIndex: (index: number) => void;
    setCurrentInput: (input: string) => void;
    setCollectedAnswers: (updater: (prev: any) => any) => void;
    setLastAIMessage: (message: string) => void;
    updateToolData: (questionId: string, value: string) => void;
  }
) => {
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
  setters.setIsEditingPrevious(true);
  setters.setEditingTarget(questionId);
  setters.setEditingOverlayFadingOut(false);
  
  // Restore the original question state
  setters.setQuestionQueue([originalQuestion]);
  setters.setCurrentQuestionIndex(0);
  
  // Set the current input to the existing value for editing
  setters.setCurrentInput(newValue);
  
  // Update the answer and tool data (keep existing data)
  setters.setCollectedAnswers(prev => ({
    ...prev,
    [questionId]: newValue
  }));
  setters.updateToolData(questionId, newValue);
  
  // Show feedback message
  setters.setLastAIMessage(`Editing your answer for "${questionId.replace(/-/g, ' ')}". Make your changes below and submit to continue.`);
};

// Helper function to switch to chat mode
export const handleSwitchToChat = (
  setters: {
    setCurrentInput: (input: string) => void;
    setQuestionQueue: (queue: any[]) => void;
    setCurrentQuestionIndex: (index: number) => void;
    setLastAIMessage: (message: string) => void;
    setIsInMultiPart: (inMultiPart: boolean) => void;
    setMultiPartQuestions: (questions: any[]) => void;
    setMultiPartIndex: (index: number) => void;
  }
) => {
  // Track workflow choice
  const tracker = getBehaviorTracker();
  if (tracker) {
    tracker.trackChatMode();
  }

  // Clear current input and question queue to enable freeform chat
  setters.setCurrentInput('');
  setters.setQuestionQueue([]);
  setters.setCurrentQuestionIndex(0);
  
  // Update AI message to indicate chat mode
  setters.setLastAIMessage("Great! I'm here to chat. Ask me anything about your tool, or tell me what you'd like to work on next.");
  
  // Exit multi-part mode if active
  setters.setIsInMultiPart(false);
  setters.setMultiPartQuestions([]);
  setters.setMultiPartIndex(0);
};

// Helper function to handle editing mode cleanup
export const handleEditingModeCleanup = (
  isEditingPrevious: boolean,
  setters: {
    setEditingOverlayFadingOut: (fading: boolean) => void;
    setIsEditingPrevious: (editing: boolean) => void;
    setEditingTarget: (target: string | null) => void;
  }
) => {
  if (isEditingPrevious) {
    // Start fade-out animation
    setters.setEditingOverlayFadingOut(true);
    
    // Clear editing state after animation completes
    setTimeout(() => {
      setters.setIsEditingPrevious(false);
      setters.setEditingTarget(null);
      setters.setEditingOverlayFadingOut(false);
    }, 500); // Match animation duration
  }
};

// Helper function to reset all workflow state
export const resetWorkflow = (
  currentWorkflow: any[],
  useIteratorTest: boolean,
  setters: {
    setCurrentStep: (step: number) => void;
    setQuestionQueue: (queue: any[]) => void;
    setCurrentQuestionIndex: (index: number) => void;
    setCurrentInput: (input: string) => void;
    setCollectedAnswers: (answers: Record<string, string>) => void;
    setCustomColors: (colors: any[]) => void;
    setConversationHistory: (history: any[]) => void;
    setIsEditingPrevious: (editing: boolean) => void;
    setEditingTarget: (target: string | null) => void;
    setEditingOverlayFadingOut: (fading: boolean) => void;
    setQuestionHistory: (history: any[]) => void;
    setLastAIMessage: (message: string) => void;
    setToolData: (data: any) => void;
  }
) => {
  setters.setCurrentStep(1);
  setters.setQuestionQueue([currentWorkflow[0]]);
  setters.setCurrentQuestionIndex(0);
  setters.setCurrentInput('');
  setters.setCollectedAnswers({});
  setters.setCustomColors([]);
  setters.setConversationHistory([]);
  setters.setIsEditingPrevious(false);
  setters.setEditingTarget(null);
  setters.setEditingOverlayFadingOut(false);
  setters.setQuestionHistory([currentWorkflow[0]]); // Reset and start with first question
  
  // Set appropriate welcome message based on workflow
  if (useIteratorTest) {
    setters.setLastAIMessage("Welcome to the Multi-Question Iterator Test! This will help us test the iterator component with various question sequences.");
  } else {
    setters.setLastAIMessage("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
  }
  
  setters.setToolData({
    title: 'Business Calculator',
    description: 'Calculate your business metrics',
    colorScheme: 'professional-blue',
    inputs: [],
    outputFormat: ['percentage']
  });
};

// Helper function to handle behavior tracker initialization
export const initializeBehaviorTracking = (
  setBehaviorTracker: (tracker: any) => void
) => {
  const userId = 'demo_user_' + Math.random().toString(36).substr(2, 9); // Mock user ID
  const tracker = getBehaviorTracker();
  setBehaviorTracker(tracker);
  
  // Get adaptive suggestions and apply them
  const suggestions = tracker?.getAdaptiveSuggestions();
  console.log('🧠 Adaptive suggestions loaded:', suggestions);
  
  // In a real implementation, you'd use these suggestions to:
  // - Adjust the workflow based on preferQuickMode
  // - Show/hide advanced options based on showAdvancedOptions
  // - Customize question types based on suggestedQuestionTypes
  // - Adjust complexity based on recommendedComplexity
  
  return suggestions;
};

// Helper function to track when a question becomes active
export const trackQuestionActivation = (
  currentQuestion: any,
  isInMultiPart: boolean,
  multiPartIndex: number,
  setResponseStartTime: (time: number) => void
) => {
  if (currentQuestion || isInMultiPart) {
    setResponseStartTime(Date.now());
  }
};

// Helper function to track interaction before processing
export const trackInteractionBehavior = (
  currentQuestion: any,
  currentInput: string,
  isInMultiPart: boolean,
  multiPartQuestions: any[],
  multiPartIndex: number,
  responseStartTime: number,
  currentStep: number,
  totalSteps: number,
  useIteratorTest: boolean,
  useMockData: boolean
) => {
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
}; 
