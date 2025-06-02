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
  onStateUpdate?: (updater: () => void) => Promise<void>
) => {
  console.log('📞 Calling Tool Creation Agent with context:', context);
  
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
        logicArchitectInsights: context.logicArchitectInsights || (context.coreWConcept ? context : null)
      }
    };

    if (existingToolDefinition) {
      requestBody.existingTool = existingToolDefinition;
    }

    const response = await fetch('/api/ai/create-tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create tool');
    }

    const apiResponse = await response.json();
    console.log('✅ Tool Creation Agent returned:', apiResponse);
    
    // Handle API response structure: {success: true, tool: ProductToolDefinition, message: string}
    if (!apiResponse.success || !apiResponse.tool) {
      throw new Error(apiResponse.message || 'Tool creation failed');
    }

    const newToolDefinition: ProductToolDefinition = apiResponse.tool;
    console.log('✅ Extracted tool definition:', newToolDefinition.metadata.title);
    
    // Save to database
    await saveLastActiveToolToDB(newToolDefinition);
    await saveToolToDBList(newToolDefinition);

    // Update behavior tracker
    const tracker = getBehaviorTracker();
    tracker?.trackToolGeneration({
      toolDefinitionId: newToolDefinition.id,
      toolName: newToolDefinition.metadata.title,
      toolType: newToolDefinition.metadata.type,
      context: context, 
      success: true
    });

    return newToolDefinition;

  } catch (error) {
    console.error('❌ Tool Creation Agent error:', error);
    
    // Update behavior tracker for failure
    const tracker = getBehaviorTracker();
    tracker?.trackToolGeneration({
      toolDefinitionId: existingToolDefinition?.id || 'unknown',
      toolName: existingToolDefinition?.metadata.title || 'unknown',
      toolType: existingToolDefinition?.metadata.type || 'unknown',
      context: context,
      success: false,
      error: error instanceof Error ? error.message : String(error)
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

export const createToolWithBrainstorming = async (
  context: any,
  onBrainstormingUpdate?: (thoughts: any[]) => void,
  onBrainstormingComplete?: (result: any) => void
) => {
  console.log('🚀 Starting tool creation with brainstorming session...');
  
  try {
    // Structure request according to brainstorm API schema
    const brainstormRequest = {
      toolType: context.toolType || context.userIntent || 'custom-calculator',
      targetAudience: context.targetAudience || 'business professionals',
      industry: context.industry,
      businessContext: context.businessDescription || context.userIntent,
      availableData: {
        collectedAnswers: context.collectedAnswers,
        features: context.features,
        colors: context.colors,
        brandAnalysis: context.brandAnalysis,
        uploadedFiles: context.uploadedFiles,
        conversationHistory: context.conversationHistory
      }
    };

    const response = await fetch('/api/ai/logic-architect/brainstorm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brainstormRequest),
    });

    if (!response.ok || !response.body) {
      const errorData = response.body ? await response.json() : {};
      throw new Error(errorData.message || `Brainstorming API error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let latestBrainstormingResult = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6));
            console.log('🔧 Brainstorming stream chunk:', json);
            
            // Update thoughts via callback
            if (onBrainstormingUpdate) {
              onBrainstormingUpdate([{ ...json, timestamp: Date.now() }]);
            }
            
            if (json.type === 'complete' && json.data?.toolCreationContext) {
              console.log('🔧 Brainstorming complete with toolCreationContext:', json.data.toolCreationContext);
              latestBrainstormingResult = json.data.toolCreationContext;
              
              // Save logic result to database
              const logicResult: SavedLogicResult = {
                id: `logic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                date: new Date().toLocaleDateString(),
                toolType: context.toolType || 'custom-calculator',
                targetAudience: context.targetAudience || 'business professionals',
                industry: context.industry,
                result: json.data.toolCreationContext
              };
              
              await saveLogicResultToDB(logicResult);
              
              if (onBrainstormingComplete) {
                onBrainstormingComplete(json.data.toolCreationContext);
              }
            }
          } catch (parseError) {
            console.error('Failed to parse brainstorming stream data:', parseError);
          }
        }
      }
    }

    return latestBrainstormingResult;

  } catch (error) {
    console.error('❌ Brainstorming error:', error);
    throw error;
  }
}; 