import { ProductToolDefinition } from '@/lib/types/product-tool';
import { SavedLogicResult } from './types';

// IndexedDB Constants
const DB_NAME = 'KeyvexUIDevDB';
const DB_VERSION = 4; // Incremented version
const TOOL_STORE_NAME = 'productTools';
export const LOGIC_RESULT_STORE_NAME = 'logicArchitectResults';
const V2_JOBS_STORE_NAME = 'v2ToolCreationJobs';
const LAST_ACTIVE_TOOL_KEY = 'lastActiveTool_v1';

// IndexedDB Helper Functions
export async function openToolDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION); // Use new version

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      reject('Error opening IndexedDB');
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      console.log(`Upgrading IndexedDB from version ${oldVersion} to ${db.version}`);

      // Object store for individual product tools (used for last active and list of all)
      if (!db.objectStoreNames.contains(TOOL_STORE_NAME)) {
        const toolStore = db.createObjectStore(TOOL_STORE_NAME, { keyPath: 'id' });
        toolStore.createIndex('timestamp', 'updatedAt', { unique: false }); // Index for sorting by recent changes
        console.log(`Object store "${TOOL_STORE_NAME}" created with keyPath 'id' and index 'timestamp' (on 'updatedAt').`);
      } else {
        // If store exists, ensure index is present (idempotent check)
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        if (transaction) {
          const toolStore = transaction.objectStore(TOOL_STORE_NAME);
          if (!toolStore.indexNames.contains('timestamp')) {
            toolStore.createIndex('timestamp', 'updatedAt', { unique: false });
            console.log(`Index 'timestamp' (on 'updatedAt') created for existing store "${TOOL_STORE_NAME}".`);
          }
        }
      }
      
      // Object store for Logic Architect results
      if (!db.objectStoreNames.contains(LOGIC_RESULT_STORE_NAME)) {
        const logicStore = db.createObjectStore(LOGIC_RESULT_STORE_NAME, { keyPath: 'id' });
        logicStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log(`Object store "${LOGIC_RESULT_STORE_NAME}" created.`);
      }

      // NEW: Object store for V2 tool creation jobs
      if (!db.objectStoreNames.contains(V2_JOBS_STORE_NAME)) {
        const jobStore = db.createObjectStore(V2_JOBS_STORE_NAME, { keyPath: 'id' });
        jobStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log(`Object store "${V2_JOBS_STORE_NAME}" created.`);
      }
    };
  });
}

export async function saveLastActiveToolToDB(tool: ProductToolDefinition): Promise<void> {
  try {
    // Add null check to prevent startup crashes
    if (!tool || !tool.metadata) {
      console.warn('⚠️ Cannot save null or invalid tool to IndexedDB');
      return;
    }

    const db = await openToolDB();
    const transaction = db.transaction([TOOL_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    
    // Use a special key for the last active tool
    const lastActiveToolData = {
      id: LAST_ACTIVE_TOOL_KEY,
      tool: tool,
      updatedAt: Date.now()
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(lastActiveToolData);
      request.onsuccess = () => {
        console.log('✅ Last active tool saved to IndexedDB:', tool.metadata.title);
        resolve();
      };
      request.onerror = () => {
        console.error('❌ Error saving last active tool to IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
  } catch (error) {
    console.error('❌ Error saving last active tool to IndexedDB:', error);
  }
}

// NEW: Separate function to clear the last active tool from IndexedDB
export async function clearLastActiveToolFromDB(): Promise<void> {
  try {
    console.log('🧹 Clearing last active tool from IndexedDB');
    
    const db = await openToolDB();
    const transaction = db.transaction([TOOL_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(LAST_ACTIVE_TOOL_KEY);
      request.onsuccess = () => {
        console.log('✅ Last active tool cleared from IndexedDB');
        resolve();
      };
      request.onerror = () => {
        console.error('❌ Error clearing last active tool from IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
  } catch (error) {
    console.error('❌ Error clearing last active tool from IndexedDB:', error);
  }
}

export async function loadLastActiveToolFromDB(): Promise<ProductToolDefinition | null> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([TOOL_STORE_NAME], 'readonly');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    
    const lastActiveTool = await new Promise<any>((resolve, reject) => {
      const request = store.get(LAST_ACTIVE_TOOL_KEY);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        console.error('❌ Error loading last active tool from IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
    
    if (lastActiveTool && lastActiveTool.tool) {
      console.log('✅ Last active tool loaded from IndexedDB:', lastActiveTool.tool.metadata.title);
      return lastActiveTool.tool;
    } else {
      console.log('ℹ️ No last active tool found in IndexedDB');
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading last active tool from IndexedDB:', error);
    return null;
  }
}

export async function saveLogicResultToDB(logicResult: SavedLogicResult): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([LOGIC_RESULT_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(LOGIC_RESULT_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(logicResult);
      request.onsuccess = () => {
        console.log('✅ Logic result saved to IndexedDB:', logicResult.id);
        resolve();
      };
      request.onerror = () => {
        console.error('❌ Error saving logic result to IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
  } catch (error) {
    console.error('❌ Error saving logic result to IndexedDB:', error);
  }
}

export async function loadLogicResultsFromDB(): Promise<SavedLogicResult[]> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([LOGIC_RESULT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(LOGIC_RESULT_STORE_NAME);
    const index = store.index('timestamp');
    
    const results = await new Promise<SavedLogicResult[]>((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        // Sort by timestamp descending (most recent first)
        const sortedResults = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(sortedResults);
      };
      request.onerror = () => {
        console.error('❌ Error loading logic results from IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
    console.log(`✅ Loaded ${results.length} logic results from IndexedDB`);
    return results;
  } catch (error) {
    console.error('❌ Error loading logic results from IndexedDB:', error);
    return [];
  }
}

export async function saveV2JobToDB(jobPackage: {
  id: string;
  timestamp: number;
  productToolDefinition: ProductToolDefinition;
  toolConstructionContext: any;
}): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([V2_JOBS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(V2_JOBS_STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(jobPackage);
      request.onsuccess = () => {
        console.log('✅ V2 Job saved to IndexedDB:', jobPackage.id);
        resolve();
      };
      request.onerror = () => {
        console.error('❌ Error saving V2 Job to IndexedDB:', request.error);
        reject(request.error);
      };
    });

    db.close();
  } catch (error) {
    console.error('❌ Error saving V2 job to IndexedDB:', error);
  }
}

export async function saveToolToDBList(tool: ProductToolDefinition): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([TOOL_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    
    // Save or update the tool in the list (not the last active tool)
    const toolData = {
      id: tool.id,
      tool: tool,
      title: tool.metadata.title,
      updatedAt: Date.now()
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(toolData);
      request.onsuccess = () => {
        console.log('✅ Tool saved to IndexedDB list:', tool.metadata.title);
        resolve();
      };
      request.onerror = () => {
        console.error('❌ Error saving tool to IndexedDB list:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
  } catch (error) {
    console.error('❌ Error saving tool to IndexedDB list:', error);
  }
}

export async function loadAllToolsFromDB(): Promise<ProductToolDefinition[]> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([TOOL_STORE_NAME], 'readonly');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    const index = store.index('timestamp');
    
    const tools = await new Promise<ProductToolDefinition[]>((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        // Filter out the last active tool entry and extract the tool objects
        const allData = request.result;
        const toolData = allData
          .filter(item => item.id !== LAST_ACTIVE_TOOL_KEY) // Exclude last active tool entry
          .sort((a, b) => b.updatedAt - a.updatedAt) // Sort by most recent first
          .map(item => item.tool) // Extract the tool object
          .filter(tool => tool && tool.id); // Ensure valid tools
        
        resolve(toolData);
      };
      request.onerror = () => {
        console.error('❌ Error loading tools from IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
    console.log(`✅ Loaded ${tools.length} tools from IndexedDB`);
    return tools;
  } catch (error) {
    console.error('❌ Error loading tools from IndexedDB:', error);
    return [];
  }
}

export async function deleteToolFromDBList(toolId: string): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([TOOL_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(toolId);
      request.onsuccess = () => {
        console.log('✅ Tool deleted from IndexedDB list:', toolId);
        resolve();
      };
      request.onerror = () => {
        console.error('❌ Error deleting tool from IndexedDB list:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
  } catch (error) {
    console.error('❌ Error deleting tool from IndexedDB list:', error);
  }
} 