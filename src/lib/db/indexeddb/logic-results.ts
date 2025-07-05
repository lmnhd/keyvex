// IndexedDB operations for Logic Results (Brainstorm Data)

export interface SavedLogicResult {
  id: string;
  timestamp: number;
  date: string;
  toolType: string;
  targetAudience: string;
  industry?: string;
  result?: {
    userInput?: {
      toolType: string;
      targetAudience: string;
      industry?: string;
      businessContext?: string;
      selectedModel?: string;
    };
    brainstormOutput?: any;
    // Legacy format support
    [key: string]: any;
  };
}

const DB_NAME = 'KeyvexUIDevDB';
const DB_VERSION = 4;
const STORE_NAME = 'logicArchitectResults';

// Initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('toolType', 'toolType', { unique: false });
      }
    };
  });
}

// Save a logic result to IndexedDB
export async function saveLogicResultToDB(result: SavedLogicResult): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.put(result);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get all logic results from IndexedDB
export async function getAllLogicResults(): Promise<SavedLogicResult[]> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Sort by timestamp descending (newest first)
      const results = request.result.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
  });
}

// Get a specific logic result by ID
export async function getLogicResultById(id: string): Promise<SavedLogicResult | null> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

// Delete a logic result by ID
export async function deleteLogicResult(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Clear all logic results
export async function clearAllLogicResults(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get logic results by tool type
export async function getLogicResultsByToolType(toolType: string): Promise<SavedLogicResult[]> {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('toolType');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(toolType);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Sort by timestamp descending (newest first)
      const results = request.result.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
  });
} 
