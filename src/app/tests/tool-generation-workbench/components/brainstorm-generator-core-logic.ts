import { v4 as uuidv4 } from 'uuid';
import { SavedLogicResult } from '../../ui/types'; // Adjusted path
import { saveLogicResultToDB } from '../../ui/db-utils'; // Adjusted path

export interface BrainstormRequest {
  toolType: string;
  targetAudience: string;
  industry?: string;
  businessContext: string; // User's text description
  selectedModel?: string;
}

export interface BrainstormStreamData {
  type: 'partial' | 'complete' | 'error';
  data: any;
  timestamp: number;
  message?: string; 
}

export async function generateBrainstorm(
  request: BrainstormRequest,
  onProgress: (data: BrainstormStreamData) => void
): Promise<SavedLogicResult | null> {
  console.log('[BrainstormGeneratorCoreLogic] Initiating brainstorm generation with request:', JSON.stringify(request, null, 2));
  try {
    const response = await fetch('/api/ai/logic-architect/brainstorm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolType: request.toolType,
        targetAudience: request.targetAudience,
        industry: request.industry,
        businessContext: request.businessContext,
        selectedModel: request.selectedModel,
        availableData: {}, // Keep availableData simple for this use case
      }),
    });

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error during brainstorm generation (failed to parse API error response).' }));
      const statusText = response.statusText || 'No status text';
      const errorMessage = errorData.message || `HTTP error! status: ${response.status} - ${statusText}`;
      onProgress({ type: 'error', data: null, message: errorMessage, timestamp: Date.now() });
      console.error(`[BrainstormGeneratorCoreLogic] Brainstorm generation API error: ${response.status} - ${statusText}`, errorData);
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResultData: any = null;

    console.log('[BrainstormGeneratorCoreLogic] Starting to read brainstorm stream...');
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[BrainstormGeneratorCoreLogic] Brainstorm stream finished.');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n'); // SSE messages are separated by double newlines
      buffer = lines.pop() || ''; // Keep the last incomplete message in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonData = line.substring(6); // Remove 'data: ' prefix
            const streamData = JSON.parse(jsonData) as BrainstormStreamData;
            // console.log('[BrainstormGeneratorCoreLogic] Received stream data chunk:', streamData); // Can be too verbose
            onProgress(streamData);
            if (streamData.type === 'complete') {
              console.log('[BrainstormGeneratorCoreLogic] Received "complete" event. Full streamData object:', JSON.stringify(streamData, null, 2));
              console.log('[BrainstormGeneratorCoreLogic] Inspecting streamData.data within "complete" event:', JSON.stringify(streamData.data, null, 2));
              finalResultData = streamData.data;
            } else if (streamData.type === 'error') {
              console.error('[BrainstormGeneratorCoreLogic] Received "error" event from stream:', JSON.stringify(streamData, null, 2));
            }
          } catch (e) {
            console.warn('[BrainstormGeneratorCoreLogic] Failed to parse stream data chunk. Chunk:', line, 'Error:', e);
            onProgress({ type: 'error', data: null, message: 'Error parsing streaming data.', timestamp: Date.now() });
          }
        } else if (line.trim() !== '') {
          console.warn('[BrainstormGeneratorCoreLogic] Received non-SSE data in stream (ignoring):', line);
        }
      }
    }
    
    console.log('[BrainstormGeneratorCoreLogic] Exited stream reading loop. Current finalResultData:', JSON.stringify(finalResultData, null, 2));
    if (finalResultData) {
      console.log('[BrainstormGeneratorCoreLogic] finalResultData received:', JSON.stringify(finalResultData, null, 2));
      const newSavedLogicResult: SavedLogicResult = {
        id: uuidv4(),
        timestamp: Date.now(),
        date: new Date().toISOString(),
        toolType: request.toolType,
        targetAudience: request.targetAudience,
        industry: request.industry,
        result: { 
          userInput: {
            toolType: request.toolType,
            targetAudience: request.targetAudience,
            industry: request.industry,
            businessContext: request.businessContext,
            selectedModel: request.selectedModel,
          },
          brainstormOutput: finalResultData 
        },
      };
      console.log('[BrainstormGeneratorCoreLogic] Preparing to save to DB. Data:', JSON.stringify(newSavedLogicResult, null, 2));
      await saveLogicResultToDB(newSavedLogicResult);
      console.log('[BrainstormGeneratorCoreLogic] Successfully saved to DB. Result ID:', newSavedLogicResult.id);
      return newSavedLogicResult;
    } else {
      console.error('[BrainstormGeneratorCoreLogic] Stream completed but finalResultData is null or undefined. This is unexpected.');
      onProgress({ type: 'error', data: null, message: 'Brainstorm generation completed but no final data payload was found in the "complete" event.', timestamp: Date.now() });
      return null;
    }

  } catch (error) {
    console.error('[BrainstormGeneratorCoreLogic] Critical failure in generateBrainstorm function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown critical error during brainstorm generation.';
    onProgress({ type: 'error', data: null, message: errorMessage, timestamp: Date.now() });
    return null;
  }
}
