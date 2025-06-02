import { ProductToolDefinition, ToolColorScheme, ProductToolMetadata } from '@/lib/types/product-tool';

// IndexedDB helper functions (matching the test UI page implementation)
async function openToolDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ToolDatabase', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains('lastActiveTool')) {
        db.createObjectStore('lastActiveTool');
      }
      if (!db.objectStoreNames.contains('savedTools')) {
        db.createObjectStore('savedTools', { keyPath: 'id' });
      }
    };
  });
}

async function getProductToolDefinitionById(toolId: string): Promise<ProductToolDefinition | null> {
  console.log(`[CORE_LOGIC] Fetching tool definition for ID: ${toolId} from IndexedDB.`);
  
  try {
    const db = await openToolDB();
    
    // First try to get from lastActiveTool
    const lastActiveTransaction = db.transaction(['lastActiveTool'], 'readonly');
    const lastActiveStore = lastActiveTransaction.objectStore('lastActiveTool');
    const lastActiveRequest = lastActiveStore.get('current');
    
    const lastActiveTool = await new Promise<ProductToolDefinition | null>((resolve) => {
      lastActiveRequest.onsuccess = () => {
        const result = lastActiveRequest.result;
        resolve(result && result.id === toolId ? result : null);
      };
      lastActiveRequest.onerror = () => resolve(null);
    });
    
    if (lastActiveTool) {
      console.log(`[CORE_LOGIC] Found tool in lastActiveTool: ${toolId}`);
      return lastActiveTool;
    }
    
    // If not found in lastActiveTool, try savedTools
    const savedTransaction = db.transaction(['savedTools'], 'readonly');
    const savedStore = savedTransaction.objectStore('savedTools');
    const savedRequest = savedStore.get(toolId);
    
    const savedTool = await new Promise<ProductToolDefinition | null>((resolve) => {
      savedRequest.onsuccess = () => {
        const result = savedRequest.result;
        resolve(result ? result.tool || result : null);
      };
      savedRequest.onerror = () => resolve(null);
    });
    
    if (savedTool) {
      console.log(`[CORE_LOGIC] Found tool in savedTools: ${toolId}`);
      return savedTool;
    }
    
    console.log(`[CORE_LOGIC] Tool not found: ${toolId}`);
    return null;
    
  } catch (error) {
    console.error('[CORE_LOGIC] Error fetching tool from IndexedDB:', error);
    return null;
  }
}

async function updateProductToolDefinition(toolDefinition: ProductToolDefinition): Promise<ProductToolDefinition | null> {
  console.log(`[CORE_LOGIC] Updating tool definition for ID: ${toolDefinition.id} in IndexedDB.`);
  
  try {
    const db = await openToolDB();
    
    // Update in lastActiveTool if it's the current active tool
    const lastActiveTransaction = db.transaction(['lastActiveTool'], 'readwrite');
    const lastActiveStore = lastActiveTransaction.objectStore('lastActiveTool');
    const lastActiveRequest = lastActiveStore.get('current');
    
    const isCurrentActiveTool = await new Promise<boolean>((resolve) => {
      lastActiveRequest.onsuccess = () => {
        const result = lastActiveRequest.result;
        resolve(result && result.id === toolDefinition.id);
      };
      lastActiveRequest.onerror = () => resolve(false);
    });
    
    if (isCurrentActiveTool) {
      const updateActiveRequest = lastActiveStore.put(toolDefinition, 'current');
      await new Promise<void>((resolve, reject) => {
        updateActiveRequest.onsuccess = () => resolve();
        updateActiveRequest.onerror = () => reject(updateActiveRequest.error);
      });
      console.log(`[CORE_LOGIC] Updated tool in lastActiveTool: ${toolDefinition.id}`);
    }
    
    // Also update in savedTools if it exists there
    const savedTransaction = db.transaction(['savedTools'], 'readwrite');
    const savedStore = savedTransaction.objectStore('savedTools');
    const savedRequest = savedStore.get(toolDefinition.id);
    
    const savedToolExists = await new Promise<boolean>((resolve) => {
      savedRequest.onsuccess = () => resolve(!!savedRequest.result);
      savedRequest.onerror = () => resolve(false);
    });
    
    if (savedToolExists) {
      const savedToolEntry = {
        id: toolDefinition.id,
        timestamp: Date.now(),
        date: new Date().toISOString(),
        title: toolDefinition.metadata.title,
        tool: toolDefinition
      };
      
      const updateSavedRequest = savedStore.put(savedToolEntry);
      await new Promise<void>((resolve, reject) => {
        updateSavedRequest.onsuccess = () => resolve();
        updateSavedRequest.onerror = () => reject(updateSavedRequest.error);
      });
      console.log(`[CORE_LOGIC] Updated tool in savedTools: ${toolDefinition.id}`);
    }
    
    return toolDefinition;
    
  } catch (error) {
    console.error('[CORE_LOGIC] Error updating tool in IndexedDB:', error);
    return null;
  }
}

interface UpdateToolStyleArgs {
  toolDefinitionId: string;
  dataStyleId: string;
  newTailwindClasses: string;
  userId?: string;
}

interface UpdateToolStyleResult {
  success: boolean;
  message?: string;
  updatedToolDefinition?: ProductToolDefinition;
  status?: number;
}

export async function updateToolStyleCoreLogic(
  args: UpdateToolStyleArgs
): Promise<UpdateToolStyleResult> {
  const { toolDefinitionId, dataStyleId, newTailwindClasses, userId } = args;

  console.log(`[CORE_LOGIC] Attempting to update style for tool: ${toolDefinitionId}, element: ${dataStyleId}, classes: ${newTailwindClasses}`);

  try {
    const toolDefinition = await getProductToolDefinitionById(toolDefinitionId);

    if (!toolDefinition) {
      console.log(`[CORE_LOGIC] Tool definition not found for ID: ${toolDefinitionId}`);
      return { success: false, message: 'Tool definition not found.', status: 404 };
    }

    console.log(`[CORE_LOGIC] Found tool: ${toolDefinition.metadata.title}`);

    // Initialize currentStyleMap if it doesn't exist
    if (!toolDefinition.currentStyleMap) {
      toolDefinition.currentStyleMap = toolDefinition.initialStyleMap ? { ...toolDefinition.initialStyleMap } : {};
      console.log('[CORE_LOGIC] Initialized currentStyleMap for tool:', toolDefinition.id);
    }
    
    // Update the specific style
    console.log(`[CORE_LOGIC] Updating style for element '${dataStyleId}' from '${toolDefinition.currentStyleMap[dataStyleId] || 'undefined'}' to '${newTailwindClasses}'`);
    toolDefinition.currentStyleMap[dataStyleId] = newTailwindClasses;
    toolDefinition.updatedAt = Date.now();

    // Persist the changes to IndexedDB
    const updatedTool = await updateProductToolDefinition(toolDefinition);

    if (!updatedTool) {
      return { success: false, message: 'Failed to save updated tool definition.', status: 500 };
    }

    console.log(`[CORE_LOGIC] Successfully updated style for tool: ${toolDefinitionId}. Updated currentStyleMap:`, updatedTool.currentStyleMap);
    return { success: true, updatedToolDefinition: updatedTool };

  } catch (error) {
    console.error('[CORE_LOGIC] Error updating tool style:', error);
    return { success: false, message: 'An unexpected error occurred while updating the style.', status: 500 };
  }
} 