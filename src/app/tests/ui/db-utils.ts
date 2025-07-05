import { ProductToolDefinition } from '@/lib/types/product-tool';
import { SavedLogicResult } from './types';
// Import unified brainstorm types
import { type BrainstormResult } from '../tool-generation-workbench/types/unified-brainstorm-types';


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

export async function saveLogicResultToDB(logicResult: BrainstormResult): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([LOGIC_RESULT_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(LOGIC_RESULT_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(logicResult);
      request.onsuccess = () => {
        console.log('✅ Unified BrainstormResult saved to IndexedDB:', logicResult.id);
        resolve();
      };
      request.onerror = () => {
        console.error('❌ Error saving BrainstormResult to IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
  } catch (error) {
    console.error('❌ Error saving BrainstormResult to IndexedDB:', error);
  }
}

export async function loadLogicResultsFromDB(): Promise<BrainstormResult[]> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([LOGIC_RESULT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(LOGIC_RESULT_STORE_NAME);
    const index = store.index('timestamp');
    
    const results = await new Promise<BrainstormResult[]>((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        // Sort by timestamp descending (most recent first)
        const sortedResults = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(sortedResults);
      };
      request.onerror = () => {
        console.error('❌ Error loading BrainstormResults from IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
    console.log(`✅ Loaded ${results.length} unified BrainstormResults from IndexedDB`);
    return results;
  } catch (error) {
    console.error('❌ Error loading BrainstormResults from IndexedDB:', error);
    return [];
  }
}

export async function deleteLogicResultFromDB(logicResultId: string): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([LOGIC_RESULT_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(LOGIC_RESULT_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(logicResultId);
      request.onsuccess = () => {
        console.log('✅ Logic result deleted from IndexedDB:', logicResultId);
        resolve();
      };
      request.onerror = () => {
        console.error('❌ Error deleting logic result from IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
  } catch (error) {
    console.error('❌ Error deleting logic result from IndexedDB:', error);
    throw error; // Re-throw so caller can handle error display
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

// ENHANCED FUNCTIONS - Save to both IndexedDB and DynamoDB
export async function saveToolToDBList(tool: ProductToolDefinition, userId?: string): Promise<void> {
  try {
    // Save to IndexedDB first (existing functionality)
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

    // Also save to DynamoDB via API call (NEW functionality)
    if (userId) {
      try {
        const response = await fetch('/api/product-tools/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool: {
              ...tool,
              createdBy: userId,
              updatedAt: Date.now()
            }
          }),
        });

        if (response.ok) {
          console.log('✅ Tool also saved to DynamoDB:', tool.metadata.title);
        } else {
          const error = await response.text();
          console.error('❌ DynamoDB save failed:', error);
        }
      } catch (dynamoError) {
        console.error('❌ Error saving tool to DynamoDB (IndexedDB save still succeeded):', dynamoError);
        // Don't throw - IndexedDB save succeeded
      }
    } else {
      console.warn('⚠️ No userId provided, skipping DynamoDB save');
    }
  } catch (error) {
    console.error('❌ Error saving tool to IndexedDB list:', error);
    throw error; // Re-throw if IndexedDB fails
  }
}

export async function loadAllToolsFromDB(userId?: string): Promise<ProductToolDefinition[]> {
  try {
    // Load from IndexedDB first (existing functionality)
    const db = await openToolDB();
    const transaction = db.transaction([TOOL_STORE_NAME], 'readonly');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    const index = store.index('timestamp');
    
    const indexedDbTools = await new Promise<ProductToolDefinition[]>((resolve, reject) => {
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
    //console.log(`✅ Loaded ${indexedDbTools.length} tools from IndexedDB`);

    // Also try to load from DynamoDB via API call and merge (NEW functionality)
    if (userId) {
      try {
        const response = await fetch(`/api/product-tools/list?userId=${encodeURIComponent(userId)}`);
        
        if (response.ok) {
          const dynamoDbTools = await response.json();
          console.log(`✅ Loaded ${dynamoDbTools.length} tools from DynamoDB`);
          
          // Merge tools, preferring DynamoDB versions (more up-to-date)
          const toolMap = new Map<string, ProductToolDefinition>();
          
          // Add IndexedDB tools first
          indexedDbTools.forEach(tool => {
            toolMap.set(tool.id, tool);
          });
          
          // Override with DynamoDB tools (they take precedence)
          dynamoDbTools.forEach((tool: ProductToolDefinition) => {
            toolMap.set(tool.id, tool);
          });
          
          const mergedTools = Array.from(toolMap.values())
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          
          console.log(`✅ Merged ${mergedTools.length} unique tools from both sources`);
          return mergedTools;
        } else {
          console.error('❌ Failed to load tools from DynamoDB, using IndexedDB only');
          return indexedDbTools;
        }
      } catch (dynamoError) {
        console.error('❌ Error loading tools from DynamoDB (returning IndexedDB tools):', dynamoError);
        return indexedDbTools;
      }
    } else {
      console.warn('⚠️ No userId provided, returning only IndexedDB tools');
      return indexedDbTools;
    }
  } catch (error) {
    console.error('❌ Error loading tools from IndexedDB:', error);
    return [];
  }
}

export async function deleteToolFromDBList(toolId: string, userId?: string): Promise<void> {
  try {
    // Delete from IndexedDB first (existing functionality)
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

    // Also delete from DynamoDB via API call (NEW functionality)
    if (userId) {
      try {
        const response = await fetch(`/api/product-tools/${toolId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });

        if (response.ok) {
          console.log('✅ Tool also deleted from DynamoDB:', toolId);
        } else {
          const error = await response.text();
          console.error('❌ DynamoDB delete failed:', error);
        }
      } catch (dynamoError) {
        console.error('❌ Error deleting tool from DynamoDB (IndexedDB delete still succeeded):', dynamoError);
        // Don't throw - IndexedDB delete succeeded
      }
    } else {
      console.warn('⚠️ No userId provided, skipping DynamoDB delete');
    }
  } catch (error) {
    console.error('❌ Error deleting tool from IndexedDB list:', error);
    throw error; // Re-throw if IndexedDB fails
  }
}

// NEW API-BASED DYNAMODB FUNCTIONS
export async function saveToolToDynamoDBOnly(tool: ProductToolDefinition, userId: string): Promise<void> {
  try {
    const response = await fetch('/api/product-tools/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: {
          ...tool,
          createdBy: userId,
          updatedAt: Date.now()
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DynamoDB save failed: ${error}`);
    }

    console.log('✅ Tool saved to DynamoDB only:', tool.metadata.title);
  } catch (error) {
    console.error('❌ Error saving tool to DynamoDB:', error);
    throw error;
  }
}

export async function loadAllToolsFromDynamoDBOnly(userId: string): Promise<ProductToolDefinition[]> {
  try {
    const response = await fetch(`/api/product-tools/list?userId=${encodeURIComponent(userId)}`);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DynamoDB load failed: ${error}`);
    }

    const tools = await response.json();
    console.log(`✅ Loaded ${tools.length} tools from DynamoDB only`);
    return tools;
  } catch (error) {
    console.error('❌ Error loading tools from DynamoDB:', error);
    return [];
  }
}

export async function getToolFromDynamoDBOnly(toolId: string, userId: string): Promise<ProductToolDefinition | null> {
  try {
    const response = await fetch(`/api/product-tools/${toolId}?userId=${encodeURIComponent(userId)}`);
    
    if (response.status === 404) {
      console.log('ℹ️ Tool not found in DynamoDB:', toolId);
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DynamoDB get failed: ${error}`);
    }

    const tool = await response.json();
    console.log('✅ Tool loaded from DynamoDB:', tool.metadata.title);
    return tool;
  } catch (error) {
    console.error('❌ Error loading tool from DynamoDB:', error);
    return null;
  }
}

export async function deleteToolFromDynamoDBOnly(toolId: string, userId: string): Promise<void> {
  try {
    const response = await fetch(`/api/product-tools/${toolId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DynamoDB delete failed: ${error}`);
    }

    console.log('✅ Tool deleted from DynamoDB only:', toolId);
  } catch (error) {
    console.error('❌ Error deleting tool from DynamoDB:', error);
    throw error;
  }
}

// NEW: Function to load all tools from DynamoDB without requiring a userId param
// The API route will handle auth and fallbacks.
export async function loadToolsFromDynamoDB(): Promise<ProductToolDefinition[]> {
  console.log('Attempting to load all tools from DynamoDB via API...');
  try {
    const response = await fetch('/api/product-tools/list');
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = `Failed to load tools from DynamoDB: ${response.status} ${response.statusText}. Details: ${errorData.error || 'Unknown error'}`;
      console.error(errorMessage, errorData);
      throw new Error(errorMessage);
    }
    const tools = await response.json();
    if (!Array.isArray(tools)) {
        console.error('API did not return an array for tools:', tools);
        throw new Error('Invalid data format received from server.');
    }
    console.log(`✅ Successfully loaded ${tools.length} tools from DynamoDB.`);
    return tools;
  } catch (error) {
    console.error('❌ An exception occurred while loading tools from DynamoDB:', error);
    // Re-throw the error so the calling component can handle it
    throw error;
  }
}

// UTILITY FUNCTIONS
export async function syncToolFromIndexedDBToDynamoDB(toolId: string, userId: string): Promise<void> {
  try {
    // Load from IndexedDB
    const db = await openToolDB();
    const transaction = db.transaction([TOOL_STORE_NAME], 'readonly');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    
    const toolData = await new Promise<any>((resolve, reject) => {
      const request = store.get(toolId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    db.close();

    if (!toolData || !toolData.tool) {
      throw new Error(`Tool ${toolId} not found in IndexedDB`);
    }

    // Save to DynamoDB
    await saveToolToDynamoDBOnly(toolData.tool, userId);
    console.log('✅ Tool synced from IndexedDB to DynamoDB:', toolId);
  } catch (error) {
    console.error('❌ Error syncing tool from IndexedDB to DynamoDB:', error);
    throw error;
  }
}

export async function syncAllToolsFromIndexedDBToDynamoDB(userId: string): Promise<void> {
  try {
    // Load only from IndexedDB for this sync operation
    const db = await openToolDB();
    const transaction = db.transaction([TOOL_STORE_NAME], 'readonly');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    const index = store.index('timestamp');
    
    const indexedDbTools = await new Promise<ProductToolDefinition[]>((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        const allData = request.result;
        const toolData = allData
          .filter(item => item.id !== LAST_ACTIVE_TOOL_KEY)
          .map(item => item.tool)
          .filter(tool => tool && tool.id);
        resolve(toolData);
      };
      request.onerror = () => reject(request.error);
    });
    
    db.close();

    console.log(`🔄 Syncing ${indexedDbTools.length} tools from IndexedDB to DynamoDB...`);
    
    for (const tool of indexedDbTools) {
      try {
        await saveToolToDynamoDBOnly(tool, userId);
        console.log(`✅ Synced tool: ${tool.metadata.title}`);
      } catch (error) {
        console.error(`❌ Error syncing tool ${tool.id}:`, error);
      }
    }
    
    console.log('✅ Bulk sync completed');
  } catch (error) {
    console.error('❌ Error during bulk sync:', error);
    throw error;
  }
}

// NEW V2 JOB LOADING FUNCTIONS
export async function getV2JobFromDB(jobId: string): Promise<any | null> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([V2_JOBS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(V2_JOBS_STORE_NAME);

    const result = await new Promise<any>((resolve, reject) => {
      const request = store.get(jobId);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        console.error('❌ Error loading V2 job from IndexedDB:', request.error);
        reject(request.error);
      };
    });

    db.close();
    return result;
  } catch (error) {
    console.error('❌ Error loading V2 job from IndexedDB:', error);
    return null;
  }
}

export async function loadV2JobsFromDB(): Promise<Array<{
  id: string;
  timestamp: number;
  productToolDefinition: ProductToolDefinition;
  toolConstructionContext: any;
}>> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([V2_JOBS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(V2_JOBS_STORE_NAME);
    const index = store.index('timestamp');
    
    const results = await new Promise<Array<{
      id: string;
      timestamp: number;
      productToolDefinition: ProductToolDefinition;
      toolConstructionContext: any;
    }>>((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        // Sort by timestamp descending (most recent first)
        const sortedResults = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(sortedResults);
      };
      request.onerror = () => {
        console.error('❌ Error loading V2 jobs from IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
    //console.log(`✅ Loaded ${results.length} V2 jobs from IndexedDB`);
    return results;
  } catch (error) {
    console.error('❌ Error loading V2 jobs from IndexedDB:', error);
    return [];
  }
}

export async function deleteV2JobFromDB(jobId: string): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction([V2_JOBS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(V2_JOBS_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(jobId);
      request.onsuccess = () => {
        console.log('✅ V2 job deleted from IndexedDB:', jobId);
        resolve();
      };
      request.onerror = () => {
        console.error('❌ Error deleting V2 job from IndexedDB:', request.error);
        reject(request.error);
      };
    });
    
    db.close();
  } catch (error) {
    console.error('❌ Error deleting V2 job from IndexedDB:', error);
  }
} 
