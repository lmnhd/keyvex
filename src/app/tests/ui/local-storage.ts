import { SavedLogicResult, SavedTool } from "@/components/tool-creator-ui/options-menu";
import { ProductToolDefinition } from "@/lib/types/product-tool";
import { clearLastActiveToolFromDB } from "./db-utils";

export const saveLogicResult = (toolType: string, targetAudience: string, industry: string | undefined, result: any, LOGIC_STORAGE_KEY: string) => {
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
      
      existing.unshift(newResult); // Add to beginning
      localStorage.setItem(LOGIC_STORAGE_KEY, JSON.stringify(existing.slice(0, 50))); // Keep last 50
      console.log('💾 Saved logic result to localStorage:', newResult.id);
    } catch (error) {
      console.error('Failed to save logic result:', error);
    }
  };
  
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
  
  export const getSavedLogicResults = (LOGIC_STORAGE_KEY: string): SavedLogicResult[] => {
    try {
      const saved = localStorage.getItem(LOGIC_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load logic results:', error);
      return [];
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
  export const clearAllSavedData = async (LOGIC_STORAGE_KEY: string, TOOLS_STORAGE_KEY: string) => {
    try {
      console.log('🧹 Clearing all saved data to start fresh with new validation system...');
      
      // Clear localStorage
      localStorage.removeItem(LOGIC_STORAGE_KEY);
      localStorage.removeItem(TOOLS_STORAGE_KEY);
      
      // Clear any other keyvex-related localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.includes('keyvex') || key.includes('tool_') || key.includes('logic_')) {
          localStorage.removeItem(key);
          console.log('🧹 Removed localStorage item:', key);
        }
      });
      
      // Clear IndexedDB
      try {
        await clearLastActiveToolFromDB();
        console.log('🧹 Cleared IndexedDB last active tool');
      } catch (dbError) {
        console.warn('🧹 Could not clear IndexedDB:', dbError);
      }
      
      console.log('🧹 ✅ All saved data cleared successfully');
      return true;
    } catch (error) {
      console.error('🧹 ❌ Error clearing saved data:', error);
      return false;
    }
  };