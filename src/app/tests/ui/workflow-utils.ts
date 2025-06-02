// Workflow utilities for tool data manipulation and updates

export const updateToolDataFromAnswers = (answerId: string, value: string, toolData: any) => {
  const updatedToolData = { ...toolData };
  
  // Map answers to tool data properties
  if (answerId === 'tool-type') {
    updatedToolData.type = value;
  } else if (answerId === 'target-audience') {
    updatedToolData.targetAudience = value;
  } else if (answerId === 'industry-focus') {
    updatedToolData.industry = value;
  } else if (answerId === 'color-scheme') {
    updatedToolData.colorScheme = value;
  } else if (answerId === 'key-inputs') {
    updatedToolData.inputs = value.split(',').map((input: string) => input.trim());
  } else if (answerId === 'calculations') {
    updatedToolData.calculations = value;
  } else if (answerId === 'business-description') {
    updatedToolData.businessDescription = value;
  } else if (answerId === 'welcome-iterator') {
    updatedToolData.businessDescription = value; // Map iterator input to business description
  } else if (answerId === 'role-title') {
    updatedToolData.roleTitle = value;
  }
  
  return updatedToolData;
};

export const updateToolDataFromMultiPart = (questionId: string, value: string, toolData: any) => {
  const updatedToolData = { ...toolData };
  
  // Map multi-part questions to tool data
  if (questionId === 'business-context') {
    updatedToolData.businessDescription = value;
  } else if (questionId === 'target-users') {
    updatedToolData.targetAudience = value;
  } else if (questionId === 'desired-outcome') {
    updatedToolData.desiredOutcome = value;
  } else if (questionId === 'key-metrics') {
    updatedToolData.keyMetrics = value.split(',').map((metric: string) => metric.trim());
  } else if (questionId === 'data-inputs') {
    updatedToolData.dataInputs = value.split(',').map((input: string) => input.trim());
  }
  
  return updatedToolData;
};

export const processMockWorkflowStep = async (
  answers: Record<string, string>,
  currentStep: number,
  currentWorkflow: any[],
  totalSteps: number,
  transitionCallback?: (updater: () => void) => Promise<void>
) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (currentStep < currentWorkflow.length) {
    const nextQuestion = currentWorkflow[currentStep];
    
    return {
      nextQuestion,
      isMultiPart: nextQuestion.inputType === 'multiPart',
      shouldAdvanceStep: true
    };
  } else {
    return {
      nextQuestion: null,
      isMultiPart: false,
      shouldAdvanceStep: false,
      isComplete: true
    };
  }
};

export const handleMockFreeformResponse = async (input: string, currentWorkflow: any[]) => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes('color') || lowerInput.includes('style')) {
    return {
      message: "Great question about styling! Let me show you some color options that would work well for your calculator.",
      nextQuestion: currentWorkflow.find(q => q.id === 'color-scheme')
    };
  } else if (lowerInput.includes('input') || lowerInput.includes('field')) {
    return {
      message: "Perfect! Let's define what inputs your users will provide to get their calculations.",
      nextQuestion: currentWorkflow.find(q => q.id === 'key-inputs')
    };
  } else {
    return {
      message: "I understand! The calculator is looking great. You can continue customizing it, or ask me about specific features you'd like to add or modify.",
      nextQuestion: null
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
  
  // Return updated data
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
    currentStep: 0,
    totalSteps: 8,
    currentQuestionIndex: 0,
    questionQueue: [],
    collectedAnswers: {},
    toolData: {
      title: 'Business Calculator',
      description: 'A customizable calculator for your business needs',
      type: 'calculator',
      colorScheme: 'professional-blue',
      inputs: [],
      calculations: '',
      targetAudience: '',
      industry: ''
    },
    currentInput: '',
    isInMultiPart: false,
    multiPartQuestions: [],
    multiPartIndex: 0,
    multiPartAnswers: {},
    isEditingPrevious: false,
    editingTarget: null,
    conversationHistory: [],
    customColors: []
  };
};

export const extractAIContextFromAnswers = (answers: Record<string, string>) => {
  const expertise = answers['business-description'] || answers['welcome-iterator'] || 'business tools';
  const toolType = answers['tool-type'] || 'calculator';
  const targetAudience = answers['target-audience'] || answers['role-title'] || 'business professionals';
  const industry = answers['industry-focus'] || 'general business';
  
  return {
    expertise,
    toolType,
    targetAudience,
    industry,
    userMessage: `Based on my responses: ${expertise}. I'm creating a ${toolType} for ${targetAudience} in ${industry}.`
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
  return {
    id: `fallback-${type}-${Date.now()}`,
    message: type === 'ai-freeform' 
      ? "I'd love to hear more about what you're looking for. Please describe your ideal tool or ask me anything!"
      : 'What would you like to work on next? Feel free to describe your needs.',
    inputType: 'textarea',
    placeholder: type === 'ai-freeform' 
      ? 'Tell me about your tool idea, ask questions, or describe what you need...'
      : 'Describe what you want to create or any specific requirements...'
  };
};

// Generic tool data update function
export const updateToolData = (questionId: string, value: string, toolData: any, setToolData: (updater: (prev: any) => any) => void) => {
  // Simple tool data update that directly updates the toolData state
  setToolData((prev: any) => ({
    ...prev,
    [questionId]: value,
    // Also update specific known fields based on questionId patterns
    ...(questionId.includes('title') && { title: value }),
    ...(questionId.includes('description') && { description: value }),
    ...(questionId.includes('color') && { colorScheme: value }),
  }));
}; 