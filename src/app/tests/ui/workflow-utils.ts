// Workflow utilities for tool data manipulation and updates

export const updateToolDataFromAnswers = (answerId: string, value: string, toolData: any) => {
  // Handle both mock workflow IDs and AI-generated IDs
  switch (answerId) {
    case 'tool-type':
      return { ...toolData, type: value };
    case 'features-wanted':
    case 'test-feature-selection':
      return { ...toolData, features: value.split(',') };
    case 'color-scheme':
    case 'test-color-selection':
    case 'color-preference':
    case 'preferred-colors':
      return updateToolDataWithColors(toolData, value);
    case 'confidence-level':
      return { ...toolData, confidenceLevel: value };
    case 'business-description':
    case 'test-tool-description':
      return { ...toolData, businessDescription: value };
    case 'calculator-title':
    case 'calculator-name':
    case 'test-tool-naming':
      return { ...toolData, title: value };
    case 'final-customization':
      return { ...toolData, customizations: value };
    case 'key-inputs':
      return { ...toolData, inputs: value.split(',').map(s => s.trim()).filter(Boolean) };
    case 'output-format':
      return { ...toolData, outputFormat: value.split(',') };
    default:
      return smartDetectionForAnswers(answerId, value, toolData);
  }
};

export const updateToolDataFromMultiPart = (questionId: string, value: string, toolData: any) => {
  switch (questionId) {
    case 'target-audience':
      return { ...toolData, targetAudience: value };
    case 'industry-focus':
      return { ...toolData, industry: value };
    case 'calculator-name':
      return { ...toolData, title: value };
    case 'key-metrics':
      return { ...toolData, keyMetrics: value.split(',') };
    case 'color-preference':
    case 'preferred-colors':
      return updateToolDataWithColors(toolData, value);
    default:
      return smartDetectionForMultiPart(questionId, value, toolData);
  }
};

// Helper function to handle color updates with AI-generated colors support
const updateToolDataWithColors = (toolData: any, value: string, currentQuestion?: any, multiPartQuestions?: any[], multiPartIndex?: number, customColors?: any[]) => {
  const updated = { ...toolData, colorScheme: value };
  
  // Handle AI-generated colors by finding the actual color data
  if (currentQuestion && currentQuestion.options) {
    const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
    if (selectedOption && selectedOption.colors) {
      updated.colorScheme = 'custom';
      updated.customColors = selectedOption.colors;
      console.log('🎨 Applied AI-generated colors:', selectedOption.colors);
    }
  }
  
  // Handle multiPart AI-generated colors
  if (multiPartQuestions && multiPartIndex !== undefined && multiPartQuestions[multiPartIndex] && multiPartQuestions[multiPartIndex].options) {
    const selectedOption = multiPartQuestions[multiPartIndex].options.find((opt: any) => opt.value === value);
    if (selectedOption && selectedOption.colors) {
      updated.colorScheme = 'custom';
      updated.customColors = selectedOption.colors;
      console.log('🎨 Applied AI-generated colors in iterator:', selectedOption.colors);
    }
  }
  
  // Handle custom colors from color picker
  if (value.startsWith('custom-') && customColors) {
    const customColor = customColors.find(c => c.value === value);
    if (customColor) {
      updated.colorScheme = 'custom';
      updated.customColors = customColor.colors;
    }
  }
  
  return updated;
};

// Smart detection for AI-generated questions
const smartDetectionForAnswers = (answerId: string, value: string, toolData: any) => {
  const lowerAnswerId = answerId.toLowerCase();
  let updated = { ...toolData };
  
  if (lowerAnswerId.includes('color') || lowerAnswerId.includes('palette') || lowerAnswerId.includes('scheme')) {
    updated.colorScheme = value;
  } else if (lowerAnswerId.includes('feature') || lowerAnswerId.includes('capability')) {
    updated.features = value.split(',');
  } else if (lowerAnswerId.includes('name') || lowerAnswerId.includes('title')) {
    updated.title = value;
  } else if (lowerAnswerId.includes('description') || lowerAnswerId.includes('business')) {
    updated.businessDescription = value;
  } else if (lowerAnswerId.includes('type') || lowerAnswerId.includes('category')) {
    updated.type = value;
  }
  
  return updated;
};

// Smart detection for multi-part questions
const smartDetectionForMultiPart = (questionId: string, value: string, toolData: any) => {
  const lowerQuestionId = questionId.toLowerCase();
  let updated = { ...toolData };
  
  if (lowerQuestionId.includes('color') || lowerQuestionId.includes('palette') || lowerQuestionId.includes('scheme')) {
    updated.colorScheme = value;
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
  
  return updated;
};

export const processMockWorkflowStep = async (
  answers: Record<string, string>,
  currentStep: number,
  currentWorkflow: any[],
  totalSteps: number,
  transitionCallback?: (updater: () => void) => Promise<void>,
  setters?: {
    setIsInMultiPart: (value: boolean) => void;
    setMultiPartQuestions: (questions: any[]) => void;
    setMultiPartIndex: (index: number) => void;
    setCurrentInput: (input: string) => void;
    setLastAIMessage: (message: string) => void;
    setQuestionQueue: (queue: any[]) => void;
    setCurrentQuestionIndex: (index: number) => void;
    setCurrentStep: (step: number) => void;
    trackQuestion: (question: any) => void;
  }
) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (currentStep < currentWorkflow.length && setters) {
    const nextQuestion = currentWorkflow[currentStep];
    
    // Check if this is a multiPart question and start it immediately
    if (nextQuestion.inputType === 'multiPart') {
      console.log('🔧 DEBUG: Auto-starting multi-part sequence');
      console.log('🔧 DEBUG: Questions:', nextQuestion.questions);
      
      if (transitionCallback) {
        await transitionCallback(() => {
          setters.setIsInMultiPart(true);
          setters.setMultiPartQuestions(nextQuestion.questions || []);
          setters.setMultiPartIndex(0);
          setters.setCurrentInput('');
          setters.setLastAIMessage(`${nextQuestion.message}\n\nQuestion 1 of ${nextQuestion.questions?.length}: ${nextQuestion.questions?.[0]?.question}`);
        });
      }
      
      // Track the multiPart question for editing functionality
      setters.trackQuestion(nextQuestion);
    } else {
      if (transitionCallback) {
        await transitionCallback(() => {
          setters.setQuestionQueue([nextQuestion]);
          setters.setCurrentQuestionIndex(0);
          setters.setLastAIMessage(nextQuestion.message);
          setters.setCurrentInput('');
        });
      }
      
      // Track the question for editing functionality
      setters.trackQuestion(nextQuestion);
    }
    
    setters.setCurrentStep(currentStep + 1);
  } else if (setters) {
    setters.setLastAIMessage("Perfect! Your calculator is taking shape. You can see the preview updating in real-time. Would you like to refine any aspect or add more features?");
    setters.setCurrentStep(Math.min(currentStep + 1, totalSteps));
    setters.setQuestionQueue([]);
    setters.setCurrentQuestionIndex(0);
  }
};

export const handleMockFreeformResponse = async (input: string, currentWorkflow: any[]) => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes('color') || lowerInput.includes('style')) {
    return {
      message: "Great question about styling! Let me show you some color options that would work well for your calculator.",
      question: currentWorkflow.find(q => q.id === 'color-scheme')!,
      shouldSetQuestion: true
    };
  } else if (lowerInput.includes('input') || lowerInput.includes('field')) {
    return {
      message: "Perfect! Let's define what inputs your users will provide to get their calculations.",
      question: currentWorkflow.find(q => q.id === 'key-inputs')!,
      shouldSetQuestion: true
    };
  } else {
    return {
      message: "I understand! The calculator is looking great. You can continue customizing it, or ask me about specific features you'd like to add or modify.",
      question: null,
      shouldSetQuestion: false
    };
  }
};

export const handleColorPickerData = (primaryColor: string, secondaryColor: string, customColors: any[]) => {
  // Generate custom color entry
  const customColorNumber = customColors.length + 1;
  const customColorEntry = {
    value: `custom-${customColorNumber}`,
    label: `Custom${customColorNumber}`,
    colors: [primaryColor, secondaryColor]
  };
  
  return {
    customColorEntry,
    toolDataUpdate: {
      colorScheme: 'custom',
      customColors: [primaryColor, secondaryColor]
    }
  };
};

export const resetWorkflowState = () => {
  return {
    currentStep: 1,
    questionQueue: [],
    currentQuestionIndex: 0,
    currentInput: '',
    collectedAnswers: {},
    customColors: [],
    conversationHistory: [],
    isEditingPrevious: false,
    editingTarget: null,
    editingOverlayFadingOut: false,
    questionHistory: [],
    toolData: {
      title: 'Business Calculator',
      description: 'Calculate your business metrics',
      colorScheme: 'professional-blue',
      inputs: [],
      outputFormat: ['percentage']
    }
  };
};

export const extractAIContextFromAnswers = (answers: Record<string, string>) => {
  return {
    expertise: answers['business-description'] || answers['welcome-iterator'] || 'business tools',
    toolType: answers['tool-type'] || 'calculator',
    targetAudience: answers['target-audience'] || answers['role-title'] || 'business professionals',
    industry: answers['industry-focus'] || 'general business'
  };
};

export const createAIQuestion = (response: any) => {
  return {
    id: response.id || 'ai-freeform-response',
    message: response.message,
    inputType: response.inputType,
    options: response.options,
    placeholder: response.placeholder,
    suggestions: response.suggestions,
    maxSelections: response.maxSelections,
    allowCustom: response.allowCustom,
    acceptedFileTypes: response.acceptedFileTypes,
    maxFileSize: response.maxFileSize,
    questions: response.questions
  };
};

export const createFallbackQuestion = (type: 'manual' | 'ai-freeform' = 'manual') => {
  if (type === 'ai-freeform') {
    return {
      id: 'ai-freeform-fallback',
      message: "What would you like to focus on for your tool?",
      inputType: 'textarea',
      placeholder: 'Tell me what you\'d like to work on next for your business tool...',
      rows: 3
    };
  }
  
  return {
    id: 'manual-fallback',
    message: "Let's continue building your tool. What specific features or calculations should your tool include?",
    inputType: 'textarea',
    placeholder: 'Describe the features, calculations, or functionality you want...',
    rows: 4
  };
};

export const updateToolData = (questionId: string, value: string, toolData: any, setToolData: (updater: (prev: any) => any) => void) => {
  setToolData((prev: any) => updateToolDataFromAnswers(questionId, value, prev));
}; 
