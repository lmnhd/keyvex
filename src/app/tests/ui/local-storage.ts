import { SavedLogicResult, SavedTool } from "@/components/tool-creator-ui/options-menu";
import { ProductToolDefinition } from "@/lib/types/product-tool";
import { clearLastActiveToolFromDB, openToolDB, LOGIC_RESULT_STORE_NAME } from "./db-utils";

export const saveCreatedTool = (tool: ProductToolDefinition, TOOLS_STORAGE_KEY: string) => {
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
      
      existing.unshift(newTool); // Add to beginning
      localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(existing.slice(0, 50))); // Keep last 50
      console.log('💾 Saved created tool to localStorage:', newTool.id);
    } catch (error) {
      console.error('Failed to save created tool:', error);
    }
  };
  
  export const getSavedTools = (TOOLS_STORAGE_KEY: string): SavedTool[] => {
    try {
      const saved = localStorage.getItem(TOOLS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load saved tools:', error);
      return [];
    }
  };
  
  // NEW: Clear all old data to start fresh with new validation system
  export const clearAllSavedData = async (TOOLS_STORAGE_KEY: string) => {
    try {
      console.log('🧹 Clearing all saved data to start fresh with new validation system...');
      
      // Clear localStorage for tools if still used
      localStorage.removeItem(TOOLS_STORAGE_KEY);
      
      // Clear any other keyvex-related localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.includes('keyvex') || key.includes('tool_')) {
          localStorage.removeItem(key);
          console.log('🧹 Removed localStorage item:', key);
        }
      });
      
      // Clear IndexedDB
      try {
        await clearLastActiveToolFromDB();

        // Also clear all logic results from IndexedDB
        const db = await openToolDB();
        const transaction = db.transaction([LOGIC_RESULT_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(LOGIC_RESULT_STORE_NAME);
        await new Promise<void>((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => {
            console.log(`🧹 Cleared all items from IndexedDB store: ${LOGIC_RESULT_STORE_NAME}`);
            resolve();
          };
          request.onerror = () => {
            console.error(`🧹 Error clearing IndexedDB store ${LOGIC_RESULT_STORE_NAME}:`, request.error);
            reject(request.error);
          };
        });
        db.close();

        console.log('🧹 Cleared IndexedDB data');
      } catch (dbError) {
        console.warn('🧹 Could not clear all IndexedDB data during clearAllSavedData:', dbError);
      }
      
      console.log('🧹 ✅ All relevant saved data cleared successfully');
      return true;
    } catch (error) {
      console.error('🧹 ❌ Error clearing saved data:', error);
      return false;
    }
  };