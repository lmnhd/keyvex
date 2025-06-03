import { ProductToolDefinition } from '@/lib/types/product-tool';
import { getBehaviorTracker } from '@/lib/ai/behavior-tracker';
import { SavedLogicResult } from './types';
import { saveLastActiveToolToDB, saveToolToDBList, loadAllToolsFromDB, saveLogicResultToDB } from './db-utils';

export const handleStreamingAIRequest = async (requestBody: any) => {
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
                // Update AI message with partial response with smooth transition
                if (data.data.message) {
                  partialMessage = data.data.message;
                  
                  // Note: The actual transition logic will be handled by the caller
                  // since it depends on React state setters
                  return { type: 'partial', message: partialMessage + '...' };
                }
              } else if (data.type === 'complete') {
                // Final response with transition
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

export const callToolCreationAgent = async (
  context: any, 
  existingToolDefinition?: ProductToolDefinition,
  onStateUpdate?: (updater: () => void) => Promise<void>,
  selectedModel?: string
) => {
  console.log('📞 TRACE: callToolCreationAgent START');
  console.log('📞 TRACE: Raw context input:', JSON.stringify(context, null, 2));
  console.log('📞 TRACE: existingToolDefinition:', existingToolDefinition?.id || 'none');
  console.log('📞 TRACE: selectedModel:', selectedModel || 'not specified');
  
  // Enhanced model logging
  if (selectedModel) {
    console.log('🚀 Communication Agent Model Selection:');
    console.log('   🤖 Model Name:', selectedModel);
    console.log('   🎯 Selection Method: User Selected');
  } else {
    console.log('🚀 Communication Agent Model Selection:');
    console.log('   🤖 Model Name: Default (not specified)');
    console.log('   🎯 Selection Method: API Default');
  }
  
  // Use transition for initial message if available
  if (onStateUpdate) {
    await onStateUpdate(() => {
      // Note: State updates will be handled by the caller
      console.log('Tool creation starting...');
    });
  }

  try {
    // Extract userIntent and build context for API
    const userIntent = context.userIntent || context.coreWConcept || 'Create a custom business tool';
    console.log('📞 TRACE: Extracted userIntent:', userIntent);
    
    const requestBody: any = {
      userIntent,
      context: {
        targetAudience: context.targetAudience,
        industry: context.industry,
        toolType: context.toolType,
        features: context.features,
        businessDescription: context.businessDescription,
        colors: context.colors,
        collectedAnswers: context.collectedAnswers,
        brandAnalysis: context.brandAnalysis,
        conversationHistory: context.conversationHistory,
        selectedWorkflow: context.selectedWorkflow,
        uploadedFiles: context.uploadedFiles,
        brainstormingResult: context.brainstormingResult || context,
        logicArchitectInsights: context.logicArchitectInsights || (context.coreWConcept ? context : null),
        selectedModel: selectedModel // Pass selected model to context
      }
    };

    console.log('📞 TRACE: Built requestBody for API:', JSON.stringify(requestBody, null, 2));
    console.log('📞 TRACE: Context.brainstormingResult:', context.brainstormingResult);
    console.log('📞 TRACE: Context.logicArchitectInsights:', context.logicArchitectInsights);
    console.log('📞 TRACE: Passing selectedModel to API:', selectedModel);

    if (existingToolDefinition) {
      requestBody.existingTool = existingToolDefinition;
      console.log('📞 TRACE: Added existingTool to requestBody');
    }

    console.log('📞 TRACE: About to call /api/ai/create-tool');
    const response = await fetch('/api/ai/create-tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📞 TRACE: API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('📞 TRACE: API error response:', errorData);
      throw new Error(errorData.message || 'Failed to create tool');
    }

    const apiResponse = await response.json();
    console.log('📞 TRACE: API success response:', JSON.stringify(apiResponse, null, 2));
    
    // Handle API response structure: {success: true, tool: ProductToolDefinition, message: string}
    if (!apiResponse.success || !apiResponse.tool) {
      console.error('📞 TRACE: Invalid API response structure:', { success: apiResponse.success, hasTool: !!apiResponse.tool });
      throw new Error(apiResponse.message || 'Tool creation failed');
    }

    const newToolDefinition: ProductToolDefinition = apiResponse.tool;
    console.log('📞 TRACE: Extracted tool definition ID:', newToolDefinition.id);
    console.log('📞 TRACE: Extracted tool definition slug:', newToolDefinition.slug);
    console.log('📞 TRACE: Extracted tool definition title:', newToolDefinition.metadata.title);
    console.log('📞 TRACE: Tool componentCode length:', newToolDefinition.componentCode?.length || 0);
    console.log('📞 TRACE: Tool initialStyleMap:', newToolDefinition.initialStyleMap);
    
    // Check for undefined values in critical fields
    const undefinedFields = [];
    if (!newToolDefinition.id || newToolDefinition.id.includes('undefined')) {
      undefinedFields.push('id: ' + newToolDefinition.id);
    }
    if (!newToolDefinition.slug || newToolDefinition.slug.includes('undefined')) {
      undefinedFields.push('slug: ' + newToolDefinition.slug);
    }
    if (!newToolDefinition.metadata?.id || newToolDefinition.metadata.id.includes('undefined')) {
      undefinedFields.push('metadata.id: ' + newToolDefinition.metadata?.id);
    }
    if (!newToolDefinition.metadata?.slug || newToolDefinition.metadata.slug.includes('undefined')) {
      undefinedFields.push('metadata.slug: ' + newToolDefinition.metadata?.slug);
    }
    
    if (undefinedFields.length > 0) {
      console.error('📞 TRACE: ⚠️ UNDEFINED VALUES DETECTED in tool definition:', undefinedFields);
    } else {
      console.log('📞 TRACE: ✅ No undefined values detected in critical fields');
    }
    
    // Save to database
    console.log('📞 TRACE: Saving to database...');
    await saveLastActiveToolToDB(newToolDefinition);
    await saveToolToDBList(newToolDefinition);
    console.log('📞 TRACE: Database save complete');

    // Update behavior tracker
    const tracker = getBehaviorTracker();
    tracker?.trackToolGeneration({
      toolDefinitionId: newToolDefinition.id,
      toolName: newToolDefinition.metadata.title,
      toolType: newToolDefinition.metadata.type,
      context: context, 
      success: true,
      validationResults: [{
        isValid: true, // Assume valid since tool was successfully created
        issues: [],
        blockers: [],
        timestamp: Date.now(),
        attempt: 1,
        sessionPhase: 'ai_processing_creation',
        userContext: {
          selectedModel: 'ai-processing-default',
          hasExternalBrainstorming: false,
          toolComplexity: 'ai-generated'
        }
      }]
    });

    console.log('📞 TRACE: callToolCreationAgent SUCCESS - returning tool');
    return newToolDefinition;

  } catch (error) {
    console.error('📞 TRACE: callToolCreationAgent ERROR:', error);
    
    // Update behavior tracker for failure
    const tracker = getBehaviorTracker();
    tracker?.trackToolGeneration({
      toolDefinitionId: existingToolDefinition?.id || 'unknown',
      toolName: existingToolDefinition?.metadata.title || 'unknown',
      toolType: existingToolDefinition?.metadata.type || 'unknown',
      context: context,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      validationResults: []
    });

    throw error;
  }
};

export const handleStyleUpdate = async (
  toolDefinitionId: string,
  dataStyleId: string, 
  newTailwindClasses: string,
  productToolDefinition: ProductToolDefinition | null
) => {
  if (!productToolDefinition || productToolDefinition.id !== toolDefinitionId) {
    console.warn("Style update requested for tool ID", toolDefinitionId, "but current tool is", productToolDefinition?.id);
    throw new Error("Style update requested for a different tool than the one loaded. Please load the correct tool.");
  }

  console.log(`🖌️ Updating style locally for tool: ${toolDefinitionId}, element: ${dataStyleId}, classes: ${newTailwindClasses}`);

  try {
    // Create updated tool definition with new style
    const updatedToolDefinition: ProductToolDefinition = {
      ...productToolDefinition,
      currentStyleMap: {
        ...productToolDefinition.currentStyleMap,
        [dataStyleId]: newTailwindClasses
      },
      updatedAt: Date.now()
    };

    // Persist to IndexedDB
    await saveLastActiveToolToDB(updatedToolDefinition);
    await saveToolToDBList(updatedToolDefinition);
    
    console.log(`🎨 Style updated successfully for element '${dataStyleId}' with classes: ${newTailwindClasses}`);
    console.log('🎨 Updated currentStyleMap:', updatedToolDefinition.currentStyleMap);
    
    return updatedToolDefinition;

  } catch (error) {
    console.error('❌ Error updating tool style locally:', error);
    throw error;
  }
};

// NEW: Function to call the style update API and apply changes
export const callStyleUpdateAPI = async (
  toolDefinitionId: string,
  dataStyleId: string,
  newTailwindClasses: string
): Promise<ProductToolDefinition | null> => {
  console.log(`🎨 Calling style update API for tool: ${toolDefinitionId}, element: ${dataStyleId}, classes: ${newTailwindClasses}`);

  try {
    const response = await fetch('/api/ai/update-tool-style', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolDefinitionId,
        dataStyleId,
        newTailwindClasses
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update style');
    }

    const apiResponse = await response.json();
    console.log('✅ Style Update API returned:', apiResponse);
    
    if (!apiResponse.success || !apiResponse.updatedToolDefinition) {
      throw new Error(apiResponse.message || 'Style update failed');
    }

    const updatedToolDefinition: ProductToolDefinition = apiResponse.updatedToolDefinition;
    console.log('✅ Style updated successfully:', updatedToolDefinition.metadata.title);
    
    return updatedToolDefinition;

  } catch (error) {
    console.error('❌ Style Update API error:', error);
    throw error;
  }
};

export const createToolWithBrainstorming = async (
  context: any,
  setShowBrainstormingPanel: (show: boolean) => void,
  setIsBrainstorming: (loading: boolean) => void,
  setBrainstormingThoughts: (setter: (prev: any[]) => any[]) => void,
  setIsGeneratingTool: (generating: boolean) => void,
  setLastAIMessage: (message: string) => void,
  setLatestBrainstormingResult: (result: any) => void,
  saveLogicResult: (toolType: string, targetAudience: string, industry: string | undefined, result: any, storageKey: string) => void,
  setSavedLogicResults: (results: any[]) => void,
  getSavedLogicResults: (storageKey: string) => any[],
  transitionToNewContent: (updateFunction: () => void) => Promise<void>,
  logicArchitectModel: string = 'default',
  createToolModel: string = 'default'
) => {
  console.log('🧠 Starting tool creation with brainstorming...');
  
  try {
    // STEP 0: Start canvas transition and UI updates IMMEDIATELY
    console.log('🎨 Starting canvas transition and brainstorming UI...');
    
    // Show brainstorming panel and start transition
    setShowBrainstormingPanel(true);
    setIsBrainstorming(true);
    setBrainstormingThoughts(() => []);
    setIsGeneratingTool(true); // Start generating state early
    setLastAIMessage('🧠 Let me brainstorm some creative ideas for your tool...');
    
    // Start canvas transition immediately
    await transitionToNewContent(() => {
      // This will start the fade effect while brainstorming happens
      console.log('🎨 Canvas transition started during brainstorming');
    });
    
    // Step 1: Logic Architect Brainstorming with Streaming
    const brainstormingResponse = await fetch('/api/ai/logic-architect/brainstorm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolType: context.toolType || 'calculator',
        targetAudience: context.targetAudience || 'business professionals', 
        industry: context.industry || '',
        businessDescription: context.businessDescription || '',
        selectedModel: logicArchitectModel !== 'default' ? logicArchitectModel : undefined, // Pass model if not default
        availableData: {
          collectedAnswers: context.collectedAnswers || {},
          features: context.features || [],
          colors: context.colors || [],
          brandAnalysis: context.brandAnalysis,
          uploadedFiles: context.uploadedFiles,
          conversationHistory: context.conversationHistory
        }
      }),
    });

    // Handle streaming brainstorming response
    if (brainstormingResponse.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = brainstormingResponse.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('No brainstorming reader available');

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
              
              // Add thought to panel
              setBrainstormingThoughts(prev => [...prev, {
                type: data.type,
                data: data.data,
                timestamp: Date.now()
              }]);
              
              if (data.type === 'complete') {
                console.log('🧠 Logic Architect brainstorming complete:', data.data);
                setLatestBrainstormingResult(data.data);
                
                // Save logic result to localStorage
                saveLogicResult(
                  context.toolType || 'calculator',
                  context.targetAudience || 'business professionals',
                  context.industry,
                  data.data,
                  'brainstorming'
                );
                
                // Update saved logic results list
                setSavedLogicResults(getSavedLogicResults('brainstorming'));
                
                // Update context with brainstorming results
                context.brainstormingResult = data.data;
                context.logicArchitectInsights = data.data;
                break;
              }
            } catch (parseError) {
              console.warn('Failed to parse brainstorming data:', line);
            }
          }
        }
      }
    } else {
      // Non-streaming fallback
      const brainstormingData = await brainstormingResponse.json();
      if (brainstormingData.success) {
        setLatestBrainstormingResult(brainstormingData.result);
        context.brainstormingResult = brainstormingData.result;
        context.logicArchitectInsights = brainstormingData.result;
        
        // Save logic result
        saveLogicResult(
          context.toolType || 'calculator',
          context.targetAudience || 'business professionals',
          context.industry,
          brainstormingData.result,
          'brainstorming'
        );
        setSavedLogicResults(getSavedLogicResults('brainstorming'));
      }
    }
    
    setIsBrainstorming(false);
    setLastAIMessage('✨ Great! I\'ve got some amazing ideas. Now let me create your tool...');
    
    // Step 2: Call Tool Creation Agent with enriched context
    setLastAIMessage('🛠️ Creating your tool with the brainstormed ideas...');
    
    // Debug: Log the context being passed to tool creation
    console.log('🔧 Context being passed to Tool Creation Agent:', {
      brainstormingResult: context.brainstormingResult,
      logicArchitectInsights: context.logicArchitectInsights,
      coreWConcept: context.brainstormingResult?.coreWConcept || context.logicArchitectInsights?.coreWConcept
    });
    
    const tool = await callToolCreationAgent(context, undefined, undefined, createToolModel);
    
    // Add final completion thought to brainstorming panel
    setBrainstormingThoughts(prev => [...prev, {
      type: 'complete',
      data: {
        coreWConcept: `Tool Created: ${tool.metadata.title}`,
        message: `✅ Successfully created "${tool.metadata.title}" based on brainstormed concept`
      },
      timestamp: Date.now()
    }]);
    
    setLastAIMessage(`🎉 Your "${tool.metadata.title}" is ready! Check out the preview and let me know if you'd like any adjustments.`);
    
    return tool;
    
  } catch (error) {
    console.error('❌ Tool creation with brainstorming failed:', error);
    setIsBrainstorming(false);
    setIsGeneratingTool(false);
    setLastAIMessage(`Sorry, there was an error creating your tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};

export const processWithAI = async (
  answers: Record<string, string>, 
  conversationHistory: any[], 
  currentStep: any, 
  setLastAIMessage: (message: string) => void, 
  handleAIGeneratedQuestion: (question: any) => void, 
  setShowBrainstormingPanel: (show: boolean) => void, 
  setIsBrainstorming: (loading: boolean) => void, 
  setBrainstormingThoughts: (setter: (prev: any[]) => any[]) => void, 
  setIsGeneratingTool: (generating: boolean) => void, 
  setLatestBrainstormingResult: (result: any) => void, 
  saveLogicResult: (toolType: string, targetAudience: string, industry: string | undefined, result: any, storageKey: string) => void, 
  setSavedLogicResults: (results: any[]) => void, 
  getSavedLogicResults: (storageKey: string) => any[], 
  transitionToNewContent: (updateFunction: () => void) => Promise<void>,
  productToolDefinition?: ProductToolDefinition | null,
  setProductToolDefinition?: (tool: ProductToolDefinition | null) => void,
  toolsStorageKey?: string
) => {
  try {
    setLastAIMessage("Analyzing your responses and generating personalized suggestions...");
    
    // Extract key information from answers
    const expertise = answers['business-description'] || answers['welcome-iterator'] || 'business tools';
    const toolType = answers['tool-type'] || 'calculator';
    const targetAudience = answers['target-audience'] || answers['role-title'] || 'business professionals';
    const industry = answers['industry-focus'] || 'general business';
    
    // Call the test UI API with streaming support
    const result = await handleStreamingAIRequest({
      userInput: `Based on my responses: ${expertise}. I'm creating a ${toolType} for ${targetAudience} in ${industry}.`,
      conversationHistory: conversationHistory || [],
      collectedAnswers: answers,
      currentStep,
      productToolDefinition // Pass current tool for context
    });

    if (result.success && result.response) {
      console.log('🔧 AI API response received:', result.response);
      
      // Check if AI wants to update tool style
      if (result.response.shouldUpdateStyle && result.response.styleUpdateContext && setProductToolDefinition) {
        console.log('🎨 AI requested style update:', result.response.styleUpdateContext);
        
        try {
          const updatedTool = await callStyleUpdateAPI(
            result.response.styleUpdateContext.toolDefinitionId,
            result.response.styleUpdateContext.dataStyleId,
            result.response.styleUpdateContext.newTailwindClasses
          );
          
          if (updatedTool) {
            setProductToolDefinition(updatedTool);
            setLastAIMessage(`🎨 Style updated! Changed ${result.response.styleUpdateContext.dataStyleId} styling.`);
          }
        } catch (styleError) {
          console.error('❌ Style update failed:', styleError);
          setLastAIMessage(`❌ Style update failed: ${styleError instanceof Error ? styleError.message : 'Unknown error'}`);
        }
        return; // Exit early since we handled the style update
      }
      
      // Check if AI wants to create a tool - use enhanced brainstorming workflow
      if (result.response.toolCreationContext) {
        console.log('🔧 AI requested tool creation, using enhanced brainstorming workflow');
        const toolResult = await createToolWithBrainstorming(result.response.toolCreationContext, setShowBrainstormingPanel, setIsBrainstorming, setBrainstormingThoughts, setIsGeneratingTool, setLastAIMessage, setLatestBrainstormingResult, saveLogicResult, setSavedLogicResults, getSavedLogicResults, transitionToNewContent, result.response.toolCreationContext.selectedModel);
        return; // Exit early since tool creation handles its own flow
      }
      
      const aiQuestion = {
        id: result.response.id || 'ai-freeform-response',
        message: result.response.message,
        inputType: result.response.inputType,
        options: result.response.options,
        placeholder: result.response.placeholder,
        suggestions: result.response.suggestions,
        maxSelections: result.response.maxSelections,
        allowCustom: result.response.allowCustom,
        acceptedFileTypes: result.response.acceptedFileTypes,
        maxFileSize: result.response.maxFileSize,
        questions: result.response.questions
      };
      
      console.log('🔧 About to call handleAIGeneratedQuestion with:', aiQuestion);
      handleAIGeneratedQuestion(aiQuestion);
      
      console.log('AI response processed', { 
        inputType: aiQuestion.inputType,
        hasOptions: !!aiQuestion.options?.length 
      });
      
    } else {
      throw new Error(result.message || 'Failed to get AI response');
    }
    
  } catch (error) {
    console.error('Error in AI processing:', error);
    setLastAIMessage(`AI processing encountered an issue: ${error instanceof Error ? error.message : 'Unknown error'}. Let me help you manually.`);
    
    // Fallback to manual question
    const fallbackQuestion = {
      id: 'manual-fallback',
      message: "Let's continue building your tool. What specific features or calculations should your tool include?",
      inputType: 'textarea',
      placeholder: 'Describe the features, calculations, or functionality you want...',
      rows: 4
    };
    
    handleAIGeneratedQuestion(fallbackQuestion);
  }
};

export const handleAIFreeformInput = async (
  input: string, 
  conversationHistory: any[], 
  collectedAnswers: any, 
  currentStep: any, 
  setLastAIMessage: (message: string) => void, 
  handleAIGeneratedQuestion: (question: any) => void, 
  setShowBrainstormingPanel: (show: boolean) => void, 
  setIsBrainstorming: (loading: boolean) => void, 
  setBrainstormingThoughts: (setter: (prev: any[]) => any[]) => void, 
  setIsGeneratingTool: (generating: boolean) => void, 
  setLatestBrainstormingResult: (result: any) => void, 
  saveLogicResult: (toolType: string, targetAudience: string, industry: string | undefined, result: any, storageKey: string) => void, 
  setSavedLogicResults: (results: any[]) => void, 
  getSavedLogicResults: (storageKey: string) => any[], 
  transitionToNewContent: (updateFunction: () => void) => Promise<void>,
  productToolDefinition?: ProductToolDefinition | null,
  setProductToolDefinition?: (tool: ProductToolDefinition | null) => void,
  toolsStorageKey?: string
) => {
  try {
    console.log('🔧 handleAIFreeformInput called with input:', input);
    setLastAIMessage("Thinking about your question...");
    
    // Call the test UI API with current context
    const requestBody = {
      userInput: input,
      conversationHistory: conversationHistory || [],
      collectedAnswers,
      currentStep,
      productToolDefinition, // Pass current tool for context
      selectedModel: toolsStorageKey
    };
    
    console.log('🔧 Sending request to API:', requestBody);
    
    // Use streaming request for real-time feedback
    const result = await handleStreamingAIRequest(requestBody);

    if (result.success && result.response) {
      // Check if AI wants to update tool style
      if (result.response.shouldUpdateStyle && result.response.styleUpdateContext && setProductToolDefinition) {
        console.log('🎨 AI requested style update:', result.response.styleUpdateContext);
        
        try {
          const updatedTool = await callStyleUpdateAPI(
            result.response.styleUpdateContext.toolDefinitionId,
            result.response.styleUpdateContext.dataStyleId,
            result.response.styleUpdateContext.newTailwindClasses
          );
          
          if (updatedTool) {
            setProductToolDefinition(updatedTool);
            setLastAIMessage(`🎨 Style updated! Changed ${result.response.styleUpdateContext.dataStyleId} styling.`);
          }
        } catch (styleError) {
          console.error('❌ Style update failed:', styleError);
          setLastAIMessage(`❌ Style update failed: ${styleError instanceof Error ? styleError.message : 'Unknown error'}`);
        }
        return; // Exit early since we handled the style update
      }
      
      // Check if AI wants to create a tool - use enhanced brainstorming workflow
      if (result.response.toolCreationContext) {
        console.log('🔧 AI requested tool creation, using enhanced brainstorming workflow');
        const toolResult = await createToolWithBrainstorming(result.response.toolCreationContext, setShowBrainstormingPanel, setIsBrainstorming, setBrainstormingThoughts, setIsGeneratingTool, setLastAIMessage, setLatestBrainstormingResult, saveLogicResult, setSavedLogicResults, getSavedLogicResults, transitionToNewContent, result.response.toolCreationContext.selectedModel);
        return; // Exit early since tool creation handles its own flow
      }
      
      const aiQuestion = {
        id: result.response.id || 'ai-freeform-response',
        message: result.response.message,
        inputType: result.response.inputType,
        options: result.response.options,
        placeholder: result.response.placeholder,
        suggestions: result.response.suggestions,
        maxSelections: result.response.maxSelections,
        allowCustom: result.response.allowCustom,
        acceptedFileTypes: result.response.acceptedFileTypes,
        maxFileSize: result.response.maxFileSize,
        questions: result.response.questions
      };
      
      handleAIGeneratedQuestion(aiQuestion);
      
      console.log('AI freeform response processed', { 
        inputType: aiQuestion.inputType,
        isTestCommand: result.isTestCommand,
        detectedCommand: result.detectedCommand
      });
      
    } else {
      throw new Error(result.message || 'Failed to get AI response');
    }
    
  } catch (error) {
    console.error('Error in AI freeform input:', error);
    setLastAIMessage(`I encountered an issue: ${error instanceof Error ? error.message : 'Unknown error'}. Let me help you continue building your tool.`);
    
    // Fallback question
    const fallbackQuestion = {
      id: 'ai-freeform-fallback',
      message: "What would you like to focus on for your tool?",
      inputType: 'textarea',
      placeholder: 'Tell me what you\'d like to work on next for your business tool...',
      rows: 3
    };
    
    handleAIGeneratedQuestion(fallbackQuestion);
  }
};

// NEW: Create tool using saved brainstorm result (bypasses Logic Architect)
export const createToolWithSavedBrainstorm = async (
  savedBrainstorm: SavedLogicResult,
  setIsGeneratingTool: (generating: boolean) => void,
  setLastAIMessage: (message: string) => void,
  transitionToNewContent: (updateFunction: () => void) => Promise<void>,
  setProductToolDefinition: (tool: ProductToolDefinition | null) => void,
  saveCreatedTool: (tool: ProductToolDefinition, storageKey: string) => void,
  setSavedTools: (tools: any[]) => void,
  getSavedTools: (storageKey: string) => any[],
  isValidProductToolDefinition: (tool: any) => tool is ProductToolDefinition,
  createToolModel: string = 'default'
) => {
  console.log('🔄 Creating tool with saved brainstorm:', savedBrainstorm.id);
  
  try {
    setIsGeneratingTool(true);
    setLastAIMessage('🛠️ Creating tool with saved brainstorm result...');
    
    // Start canvas transition
    await transitionToNewContent(() => {
      setLastAIMessage(`🔄 Using saved brainstorm: "${savedBrainstorm.toolType}" for ${savedBrainstorm.targetAudience}`);
    });
    
    // Create context from saved brainstorm result
    const context = {
      userIntent: 'Create a custom business tool',
      toolType: savedBrainstorm.toolType,
      targetAudience: savedBrainstorm.targetAudience,
      industry: savedBrainstorm.industry,
      businessDescription: `Tool for ${savedBrainstorm.targetAudience} in ${savedBrainstorm.industry || 'general business'}`,
      // Include the brainstorming result directly to skip Logic Architect
      brainstormingResult: savedBrainstorm.result,
      logicArchitectInsights: savedBrainstorm.result,
      collectedAnswers: {}
    };

    console.log('🧪 TRACE: SAVED BRAINSTORM TOOL CREATION START');
    console.log('🧪 TRACE: Using saved brainstorm context:', JSON.stringify(context, null, 2));

    const newTool = await callToolCreationAgent(
      context, 
      undefined, 
      undefined, 
      createToolModel !== 'default' ? createToolModel : undefined
    );
    
    console.log('🧪 TRACE: callToolCreationAgent returned:', newTool?.id);
    console.log('🧪 TRACE: Tool metadata title:', newTool?.metadata?.title);
    
    if (newTool) {
      console.log('🛠️ Setting new tool from saved brainstorm:', newTool.metadata.title);
      
      // 🛡️ Validate tool before saving to prevent storing corrupted tools
      if (!isValidProductToolDefinition(newTool)) {
        console.error('🛡️ VALIDATION: Saved brainstorm tool failed validation - not saving');
        await transitionToNewContent(() => {
          setLastAIMessage(`❌ Generated tool failed validation checks. The AI created an invalid tool structure. Please try again.`);
        });
        return;
      }
      
      // Update with success message and transition
      await transitionToNewContent(() => {
        setLastAIMessage(`✅ Successfully created tool from saved brainstorm: "${newTool.metadata.title}"! 🧠 Used: ${savedBrainstorm.toolType} logic`);
        setProductToolDefinition(newTool);
      });
      
      saveCreatedTool(newTool, 'saved-brainstorm');
      setSavedTools(getSavedTools('saved-brainstorm'));
      
      // 🛡️ Save to IndexedDB with validation
      try {
        await saveLastActiveToolToDB(newTool);
        console.log('🛡️ VALIDATION: Saved brainstorm tool successfully saved to IndexedDB');
      } catch (saveError) {
        console.error('🛡️ VALIDATION: Failed to save saved brainstorm tool to IndexedDB:', saveError);
      }
    }
  } catch (error) {
    console.error('🧪 TRACE: Saved brainstorm tool creation failed:', error);
    await transitionToNewContent(() => {
      setLastAIMessage(`❌ Saved brainstorm tool creation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    });
  } finally {
    setIsGeneratingTool(false);
  }
};

