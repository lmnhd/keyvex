import { v4 as uuidv4 } from 'uuid';
import { saveLogicResultToDB } from '../../ui/db-utils';
// --- PHASE 1: UNIFIED TYPES ---
import { 
  type BrainstormResult,
  type BrainstormRequest,
  type BrainstormStreamData,
  type BrainstormUserInput,
  validateBrainstormData,
  BrainstormResultSchema
} from '../types/unified-brainstorm-types';

export { type BrainstormRequest, type BrainstormStreamData } from '../types/unified-brainstorm-types';

export async function generateBrainstorm(
  request: BrainstormRequest,
  onProgress: (data: BrainstormStreamData) => void
): Promise<BrainstormResult | null> {
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
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            console.log('[BrainstormGeneratorCoreLogic] Received stream data:', data.type, data.message || '(no message)');
            
            if (data.type === 'partial' && data.data?.thought) {
              onProgress({ type: 'partial', data: { thought: data.data.thought }, timestamp: Date.now() });
            } else if (data.type === 'complete') {
              console.log('[BrainstormGeneratorCoreLogic] Stream complete, final data:', JSON.stringify(data.data, null, 2));
              finalResultData = data.data;
              onProgress({ type: 'complete', data: data.data, timestamp: Date.now() });
              break;
            } else if (data.type === 'error') {
              onProgress({ type: 'error', data: null, message: data.message, timestamp: Date.now() });
              return null;
          }
          } catch (parseError) {
            console.warn('[BrainstormGeneratorCoreLogic] Failed to parse stream data:', line);
        }
      }
      }
      
      if (finalResultData) break;
    }
    
    console.log('[BrainstormGeneratorCoreLogic] Exited stream reading loop. Current finalResultData:', JSON.stringify(finalResultData, null, 2));
    if (finalResultData) {
      console.log('[BrainstormGeneratorCoreLogic] finalResultData received:', JSON.stringify(finalResultData, null, 2));
      
      // --- PHASE 1: GENERATE UNIFIED STRUCTURE ---
      // Create the new unified BrainstormResult structure (no more nested result.brainstormOutput)
      const userInput: BrainstormUserInput = {
            toolType: request.toolType,
            targetAudience: request.targetAudience,
            industry: request.industry,
            businessContext: request.businessContext,
            selectedModel: request.selectedModel,
      };

      // Validate the brainstorm data to ensure it matches BrainstormDataSchema
      // NO FALLBACKS - Let it fail if Logic Architect generates bad data
      console.log('[BrainstormGeneratorCoreLogic] Validating Logic Architect output (NO FALLBACKS)');
      const validatedBrainstormData = validateBrainstormData(finalResultData);

      const newBrainstormResult: BrainstormResult = {
        id: uuidv4(),
        timestamp: Date.now(),
        date: new Date().toISOString(),
        userInput,
        brainstormData: validatedBrainstormData,
      };

      // Validate the complete result
      BrainstormResultSchema.parse(newBrainstormResult); // Validate but don't use the result
      
      console.log('[BrainstormGeneratorCoreLogic] Preparing to save to DB. Data:', JSON.stringify(newBrainstormResult, null, 2));
      
      // --- TEMPORARY: Save in legacy format for backward compatibility ---
      // TODO: Remove this once all consumers are updated to use the new format
      const legacyFormat = {
        id: newBrainstormResult.id,
        timestamp: newBrainstormResult.timestamp,
        date: newBrainstormResult.date,
        toolType: userInput.toolType,
        targetAudience: userInput.targetAudience,
        industry: userInput.industry,
        result: {
          userInput: userInput,
          brainstormOutput: newBrainstormResult.brainstormData
        }
      };
      
      await saveLogicResultToDB(legacyFormat as any); // Type assertion for legacy compatibility
      console.log('[BrainstormGeneratorCoreLogic] Successfully saved to DB. Result ID:', newBrainstormResult.id);
      return newBrainstormResult;
    } else {
      console.error('[BrainstormGeneratorCoreLogic] Stream completed but finalResultData is null or undefined. This is unexpected.');
      onProgress({ type: 'error', data: null, message: 'Brainstorm generation completed but no final data payload was found in the "complete" event.', timestamp: Date.now() });
      return null;
    }

  } catch (error) {
    console.error('[BrainstormGeneratorCoreLogic] Error during brainstorm generation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during brainstorm generation.';
    onProgress({ type: 'error', data: null, message: errorMessage, timestamp: Date.now() });
    return null;
  }
}
