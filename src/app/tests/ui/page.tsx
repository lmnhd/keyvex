'use client';

/*
================================================================================
MODEL-PROMPT-NOTES: Input Component Selection Guidelines
================================================================================

When generating dynamic questions for users, the AI model should select the 
appropriate input component based on these guidelines:

1. CHECKBOX COMPONENT (multiSelect):
   - Use when: Finite set of options (typically 3-8 choices)
   - Use when: Multiple values can be selected simultaneously
   - Use when: No custom values needed (closed set)
   - Example: "Which features do you want?" → Charts, Export, Sharing, etc.
   - Layout: Horizontal inline chips with checkboxes
   - Max selections: Usually 3-4 to maintain simplicity

2. SELECT COMPONENT (select):
   - Use when: Endless possible options but providing top 5-8 common choices
   - Use when: Only ONE value can be selected
   - Use when: Custom value input is needed as fallback
   - Example: "What's your industry?" → Technology, Healthcare, + Custom option
   - Layout: Dropdown with "Enter Custom Value" button
   - Always include custom value option for flexibility

3. RADIO COMPONENT (yesNoMaybe):
   - Use when: Simple binary or ternary choices
   - Use when: Finite set of 2-4 mutually exclusive options
   - Use when: Options are simple single words or short phrases
   - Example: "How confident are you?" → Very Confident, Need Help, Somewhat Sure
   - Layout: Horizontal inline buttons with radio circles
   - Keep labels short and clear
   - MAX 3 OPTIONS: This component is for very mundane, simplistic responses
   - For more complex single choices, use SELECT component instead

4. COLOR COMPONENT (colorSelect):
   - Use when: Selecting brand colors or visual themes
   - Use when: Visual representation helps decision making
   - Example: "Choose your color scheme" → Professional Blue, Modern Green, etc.
   - Layout: Horizontal chips with color dots + labels
   - Always include custom color option

5. TEXT INPUT COMPONENT (text):
   - Use when: Open-ended single-line responses needed
   - Use when: Providing suggestion chips helps but custom input required
   - Example: "What should we call your tool?" → with suggestions like "ROI Calculator"
   - Layout: Input field with optional suggestion chips above
   - Keep suggestions to 4-6 options max

6. TEXTAREA COMPONENT (textarea):
   - Use when: Multi-line descriptive text needed
   - Use when: Detailed explanations or descriptions required
   - Example: "Describe your business and target audience"
   - Layout: Fixed 2-row textarea (no scrolling)
   - Keep compact - avoid long-form content

7. MULTI-PART COMPONENT (multiPart):
   - Use when: Need to collect 3-5 related pieces of information
   - Use when: Each sub-question uses different input types
   - Example: Collecting audience + industry + metrics in sequence
   - Flow: One question at a time, auto-advance through sequence
   - Keep total sub-questions to 3-5 max

DESIGN PRINCIPLES:
- All components must fit in uniform container (no size changes)
- No scrolling required - everything visible at once
- Horizontal layouts preferred for space efficiency
- Simple, short labels (avoid long descriptions)
- Always provide escape hatch (custom options) when possible
- Maintain consistent visual hierarchy and spacing

COMPONENT SIZING:
- Checkboxes/radios: 3x3px indicators
- Color dots: 3x3px circles
- Button padding: px-3 py-2 for consistency
- Textarea: Fixed 2 rows maximum
- Container: Uniform height regardless of content

================================================================================
*/

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Send, 
  Loader2, 
  Calculator, 
  Palette, 
  Type, 
  Layout,
  Sparkles,
  Brain,
  RotateCcw,
  MessageCircle,
  MessageSquare,
  Moon,
  Sun,
  Settings,
  ChevronDown,
  Edit3,
  ChevronLeft,
  ChevronRight,
  X,
  History,
  Zap,
  CheckCircle,
  Upload
} from 'lucide-react';
import DynamicComponentRenderer from '@/components/tools/dynamic-component-renderer';
import { InputHistory } from '@/components/tool-creator-ui/input-history';
import { initBehaviorTracker, getBehaviorTracker } from '@/lib/ai/behavior-tracker';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { DynamicInput } from '@/components/tool-creator-ui/inputs';
import { ColorPickerPopup } from '@/components/tool-creator-ui/inputs';
import { FullFormPopup } from '@/components/tool-creator-ui/inputs/FullFormPopup';

// Local Storage Utilities for Development (Keep for LOGIC_STORAGE_KEY for now)
// const LOGIC_STORAGE_KEY = 'keyvex_logic_architect_results'; // REMOVED: Will use IndexedDB
// const TOOLS_STORAGE_KEY = 'keyvex_created_tools'; // REMOVED: Last active tool uses IndexedDB, list of all tools is removed from this page

// IndexedDB Constants
const DB_NAME = 'KeyvexUIDevDB';
const TOOL_STORE_NAME = 'productTools';
const LOGIC_RESULT_STORE_NAME = 'logicArchitectResults'; // NEW Store
const LAST_ACTIVE_TOOL_KEY = 'lastActiveTool_v1';

interface SavedLogicResult {
  id: string;
  timestamp: number;
  date: string;
  toolType: string;
  targetAudience: string;
  industry?: string;
  result: any;
}

// Reinstate SavedTool for the "all tools" list which still uses localStorage
interface SavedTool {
  id: string;
  timestamp: number;
  date: string;
  title: string;
  tool: ProductToolDefinition;
}

// IndexedDB Helper Functions
async function openToolDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3); // Increment DB version to 3 for schema change

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
    };
  });
}

async function saveLastActiveToolToDB(tool: ProductToolDefinition): Promise<void> {
  try {
    const db = await openToolDB();
    // First, save/update the full tool definition in the main store
    const transaction = db.transaction(TOOL_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    // Ensure the tool has an 'id' and 'updatedAt'
    const toolToSave = { ...tool, id: tool.id || `tool_${Date.now()}`, updatedAt: tool.updatedAt || Date.now() };
    const saveRequest = store.put(toolToSave);

    await new Promise<void>((resolveUpdate, rejectUpdate) => {
      saveRequest.onsuccess = () => {
        console.log('💾 Saved/Updated tool definition in main store for last active:', toolToSave.id);
        resolveUpdate();
      };
      saveRequest.onerror = (event) => {
        console.error('Failed to save tool definition to main store for last active:', (event.target as IDBRequest).error);
        rejectUpdate((event.target as IDBRequest).error);
      };
    });
    
    // Then, save the ID of this tool under the LAST_ACTIVE_TOOL_KEY in localStorage
    localStorage.setItem(LAST_ACTIVE_TOOL_KEY, toolToSave.id);
    console.log('💾 Saved last active tool ID to localStorage:', toolToSave.id);

  } catch (error) {
    console.error('Error in saveLastActiveToolToDB:', error);
    throw error;
  }
}

async function loadLastActiveToolFromDB(): Promise<ProductToolDefinition | null> {
  try {
    const lastActiveToolId = localStorage.getItem(LAST_ACTIVE_TOOL_KEY);
    if (!lastActiveToolId) {
      console.log('🔧 No last active tool ID found in localStorage.');
      return null;
    }

    const db = await openToolDB();
    const transaction = db.transaction(TOOL_STORE_NAME, 'readonly');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    const request = store.get(lastActiveToolId);

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result as ProductToolDefinition | undefined;
        if (result) {
          console.log('🔧 Loaded last active tool from IndexedDB (ID from localStorage):', result.metadata.title);
          resolve(result);
        } else {
          console.log('🔧 Last active tool ID found in localStorage, but tool not in IndexedDB. Clearing orphan ID.');
          localStorage.removeItem(LAST_ACTIVE_TOOL_KEY); 
          resolve(null);
        }
      };
      request.onerror = (event) => {
        console.error('Failed to load last active tool from IndexedDB:', (event.target as IDBRequest).error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error('Error in loadLastActiveToolFromDB:', error);
    return null;
  }
}

// NEW: Save Logic Architect result to IndexedDB
async function saveLogicResultToDB(logicResult: SavedLogicResult): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction(LOGIC_RESULT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(LOGIC_RESULT_STORE_NAME);
    const request = store.put(logicResult);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('💾 Saved logic result to IndexedDB:', logicResult.id);
        resolve();
      };
      request.onerror = (event) => {
        console.error('Failed to save logic result to IndexedDB:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  } catch (error) {
    console.error('Error in saveLogicResultToDB:', error);
    throw error;
  }
}

// NEW: Load Logic Architect results from IndexedDB, sorted by timestamp
async function loadLogicResultsFromDB(): Promise<SavedLogicResult[]> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction(LOGIC_RESULT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(LOGIC_RESULT_STORE_NAME);
    const index = store.index('timestamp'); // Use the timestamp index
    const request = index.getAll(); // Get all, then sort in JS, or use IDBCursor with direction 'prev'

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const results = (event.target as IDBRequest).result as SavedLogicResult[];
        // Sort descending by timestamp (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp);
        console.log(`🔧 Loaded ${results.length} logic results from IndexedDB.`);
        resolve(results.slice(0, 50)); // Limit to 50 most recent, similar to previous localStorage logic
      };
      request.onerror = (event) => {
        console.error('Failed to load logic results from IndexedDB:', (event.target as IDBRequest).error);
        resolve([]); // Return empty array on error
      };
    });
  } catch (error) {
    console.error('Error in loadLogicResultsFromDB:', error);
    return []; // Return empty array on error
  }
}

// NEW: Save a tool to the general list in IndexedDB
async function saveToolToDBList(tool: ProductToolDefinition): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction(TOOL_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    // Ensure the tool has a unique 'id' and 'updatedAt' for storing and sorting
    const toolToSave = { 
      ...tool, 
      id: tool.id || `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, 
      updatedAt: tool.updatedAt || Date.now() 
    };
    const request = store.put(toolToSave); // put will add or update if exists

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('💾 Saved tool to IndexedDB list (add/update):', toolToSave.metadata.title, toolToSave.id);
        resolve();
      };
      request.onerror = (event) => {
        console.error('Failed to save tool to IndexedDB list:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  } catch (error) {
    console.error('Error in saveToolToDBList:', error);
    throw error;
  }
}

// NEW: Load all tools from IndexedDB, sorted by updatedAt (newest first)
async function loadAllToolsFromDB(): Promise<ProductToolDefinition[]> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction(TOOL_STORE_NAME, 'readonly');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    const index = store.index('timestamp'); // Using 'timestamp' index which maps to 'updatedAt'
    const request = index.getAll(); 

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        let results = (event.target as IDBRequest).result as ProductToolDefinition[];
        // Filter out the entry that might correspond to LAST_ACTIVE_TOOL_KEY if it's just an ID string
        // However, with the new approach, LAST_ACTIVE_TOOL_KEY is just an ID in localStorage,
        // and the actual tool is stored normally. So, all items should be ProductToolDefinition.
        results = results.filter(item => typeof item === 'object' && item.id && item.metadata);

        // Sort descending by updatedAt (newest first)
        results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        console.log(`🔧 Loaded ${results.length} tools from IndexedDB list.`);
        resolve(results);
      };
      request.onerror = (event) => {
        console.error('Failed to load all tools from IndexedDB list:', (event.target as IDBRequest).error);
        resolve([]); 
      };
    });
  } catch (error) {
    console.error('Error in loadAllToolsFromDB:', error);
    return []; 
  }
}

// NEW: Delete a tool from the IndexedDB list by its ID
async function deleteToolFromDBList(toolId: string): Promise<void> {
  try {
    const db = await openToolDB();
    const transaction = db.transaction(TOOL_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TOOL_STORE_NAME);
    const request = store.delete(toolId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('🗑️ Deleted tool from IndexedDB list:', toolId);
        resolve();
      };
      request.onerror = (event) => {
        console.error('Failed to delete tool from IndexedDB list:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  } catch (error) {
    console.error('Error in deleteToolFromDBList:', error);
    throw error;
  }
}

// Restore localStorage function for the list of all saved tools
// const saveCreatedTool = (tool: ProductToolDefinition) => { // REMOVED
// try {
// const TOOLS_STORAGE_KEY_LITERAL = 'keyvex_created_tools'; // Define literal key
// const saved = localStorage.getItem(TOOLS_STORAGE_KEY_LITERAL);
// const existing: SavedTool[] = saved ? JSON.parse(saved) : [];
    
// const newTool: SavedTool = {
// id: tool.id || `tool_${Date.now()}`, // Use tool.id if available
// timestamp: Date.now(),
// date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
// title: tool.metadata.title,
// tool
// };
    
// existing.unshift(newTool);
// localStorage.setItem(TOOLS_STORAGE_KEY_LITERAL, JSON.stringify(existing.slice(0, 50)));
// console.log('💾 Saved created tool to localStorage (for all tools list):', newTool.id);
// } catch (error) {
// console.error('Failed to save created tool to localStorage (for all tools list):', error);
// }
// };

// Restore localStorage function for the list of all saved tools
// const getSavedTools = (): SavedTool[] => { // REMOVED
// try {
// const TOOLS_STORAGE_KEY_LITERAL = 'keyvex_created_tools'; // Define literal key
// const saved = localStorage.getItem(TOOLS_STORAGE_KEY_LITERAL);
// return saved ? JSON.parse(saved) : [];
// } catch (error) {
// console.error('Failed to load saved tools from localStorage (for all tools list):', error);
// return [];
// }
// };

// Mock workflow for testing different input types and transitions
const mockWorkflow = [
  {
    id: 'tool-type',
    message: "Let's create your lead magnet! What type of calculator would work best for your business?",
    inputType: 'select',
    options: [
      { value: 'roi', label: 'ROI Calculator' },
      { value: 'savings', label: 'Cost Savings Calculator' },
      { value: 'pricing', label: 'Pricing Calculator' },
      { value: 'assessment', label: 'Business Assessment' },
      { value: 'custom', label: 'Custom Calculator' }
    ],
    placeholder: 'Choose calculator type...',
    allowCustom: true
  },
  {
    id: 'features-wanted',
    message: "Great choice! Which features would you like to include in your calculator? (Select all that apply)",
    inputType: 'multiSelect',
    options: [
      { value: 'charts', label: 'Charts' },
      { value: 'export', label: 'PDF Export' },
      { value: 'email', label: 'Email Results' },
      { value: 'comparison', label: 'Comparison' },
      { value: 'sharing', label: 'Sharing' },
      { value: 'branding', label: 'Branding' }
    ],
    maxSelections: 4
  },
  {
    id: 'color-scheme',
    message: "Perfect! Now let's choose colors that represent your brand. Pick your primary color scheme:",
    inputType: 'colorSelect',
    options: [
      { value: 'professional-blue', label: 'Professional Blue', colors: ['#2563eb', '#1e40af'] },
      { value: 'modern-green', label: 'Modern Green', colors: ['#059669', '#047857'] },
      { value: 'elegant-purple', label: 'Elegant Purple', colors: ['#7c3aed', '#5b21b6'] },
      { value: 'warm-orange', label: 'Warm Orange', colors: ['#ea580c', '#c2410c'] },
      { value: 'bold-red', label: 'Bold Red', colors: ['#dc2626', '#b91c1c'] },
      { value: 'calm-teal', label: 'Calm Teal', colors: ['#0891b2', '#0e7490'] }
    ],
    allowCustom: true
  },
  {
    id: 'confidence-level',
    message: "How confident are you about your calculator's target audience and value proposition?",
    inputType: 'yesNoMaybe',
    options: [
      { value: 'yes', label: 'Very Confident' },
      { value: 'no', label: 'Need Help' },
      { value: 'maybe', label: 'Somewhat Sure' }
    ]
  },
  {
    id: 'business-description',
    message: "Excellent! Now tell me about your business and the specific problem this calculator will solve for your customers.",
    inputType: 'textarea',
    placeholder: 'Describe your business, target audience, the problem you solve, and how this calculator fits into your customer journey...',
    rows: 5
  },
  {
    id: 'multi-part-setup',
    message: "Perfect! Now I'll ask you a series of quick questions to fine-tune your calculator. Let's go through them one by one:",
    inputType: 'multiPart',
    questions: [
      {
        id: 'target-audience',
        question: "Who is your primary target audience?",
        inputType: 'select',
        options: [
          { value: 'small-business', label: 'Small Business Owners (1-50 employees)' },
          { value: 'mid-market', label: 'Mid-Market Companies (51-500 employees)' },
          { value: 'enterprise', label: 'Enterprise Organizations (500+ employees)' },
          { value: 'consultants', label: 'Consultants & Agencies' },
          { value: 'individuals', label: 'Individual Professionals' },
          { value: 'startups', label: 'Startups & Entrepreneurs' }
        ],
        allowCustom: true
      },
      {
        id: 'industry-focus',
        question: "What industry or sector do you primarily serve?",
        inputType: 'textarea',
        placeholder: 'e.g., Healthcare, Technology, Manufacturing, Professional Services...',
        rows: 2,
        suggestions: [
          'Technology',
          'Healthcare', 
          'Financial Services',
          'Manufacturing',
          'Professional Services',
          'E-commerce',
          'Education',
          'Real Estate'
        ]
      },
      {
        id: 'calculator-name',
        question: "What should we call your calculator?",
        inputType: 'textarea',
        placeholder: 'e.g., "ROI Calculator for Marketing Campaigns"',
        rows: 2,
        suggestions: [
          'ROI Calculator',
          'Cost Savings Calculator', 
          'Business Value Calculator',
          'Investment Calculator',
          'Pricing Calculator'
        ]
      },
      {
        id: 'key-metrics',
        question: "What are the main metrics or outputs your users want to see?",
        inputType: 'multiSelect',
        options: [
          { value: 'roi-percentage', label: 'ROI Percentage' },
          { value: 'dollar-savings', label: 'Dollar Savings' },
          { value: 'time-saved', label: 'Time Saved' },
          { value: 'efficiency-gain', label: 'Efficiency Gains' },
          { value: 'cost-reduction', label: 'Cost Reduction' },
          { value: 'revenue-increase', label: 'Revenue Increase' }
        ],
        maxSelections: 3
      }
    ]
  },
  {
    id: 'final-customization',
    message: "Almost done! Any final customizations, special requirements, or additional features you'd like to add?",
    inputType: 'textarea',
    placeholder: 'Describe any special calculations, integrations, design preferences, or unique features you need...',
    rows: 4
  }
];

// New mock workflow specifically for testing the multi-question iterator
const iteratorTestWorkflow = [
  {
    id: 'welcome-iterator',
    message: "Welcome to the Multi-Question Iterator Test! This flow will demonstrate how the iterator component works with various question types.",
    inputType: 'textarea',
    placeholder: 'Tell me what you\'d like to test about the iterator component...',
    rows: 3
  },
  {
    id: 'basic-info-collection',
    message: "Let's collect some basic information about you. I'll ask you 5 questions in sequence:",
    inputType: 'multiPart',
    questions: [
      {
        id: 'full-name',
        question: "What's your full name?",
        inputType: 'textarea',
        placeholder: 'Enter your first and last name...',
        rows: 2,
        suggestions: ['John Smith', 'Jane Doe', 'Alex Johnson']
      },
      {
        id: 'company-role',
        question: "What's your role at your company?",
        inputType: 'select',
        options: [
          { value: 'ceo', label: 'CEO/Founder' },
          { value: 'marketing', label: 'Marketing Manager' },
          { value: 'sales', label: 'Sales Manager' },
          { value: 'operations', label: 'Operations Manager' },
          { value: 'consultant', label: 'Consultant' },
          { value: 'other', label: 'Other' }
        ],
        allowCustom: true
      },
      {
        id: 'experience-level',
        question: "How many years of experience do you have in your field?",
        inputType: 'select',
        options: [
          { value: '0-2', label: '0-2 years' },
          { value: '3-5', label: '3-5 years' },
          { value: '6-10', label: '6-10 years' },
          { value: '11-15', label: '11-15 years' },
          { value: '15+', label: '15+ years' }
        ]
      },
      {
        id: 'primary-goals',
        question: "What are your primary business goals this year? (Select up to 3)",
        inputType: 'multiSelect',
        options: [
          { value: 'increase-revenue', label: 'Increase Revenue' },
          { value: 'reduce-costs', label: 'Reduce Costs' },
          { value: 'improve-efficiency', label: 'Improve Efficiency' },
          { value: 'expand-market', label: 'Expand Market Share' },
          { value: 'digital-transformation', label: 'Digital Transformation' },
          { value: 'team-growth', label: 'Team Growth' }
        ],
        maxSelections: 3
      },
      {
        id: 'additional-info',
        question: "Any additional information you'd like to share?",
        inputType: 'textarea',
        placeholder: 'Share anything else that might be relevant...',
        rows: 3
      }
    ]
  },
  {
    id: 'preferences-collection',
    message: "Great! Now let's understand your preferences and work style:",
    inputType: 'multiPart',
    questions: [
      {
        id: 'communication-style',
        question: "How do you prefer to communicate with tools and systems?",
        inputType: 'select',
        options: [
          { value: 'direct', label: 'Direct and to the point' },
          { value: 'detailed', label: 'Detailed explanations' },
          { value: 'visual', label: 'Visual examples and demos' },
          { value: 'interactive', label: 'Interactive guided experiences' }
        ]
      },
      {
        id: 'urgency-level',
        question: "How urgently do you need solutions to be implemented?",
        inputType: 'select',
        options: [
          { value: 'asap', label: 'ASAP (within days)' },
          { value: 'weeks', label: 'Within a few weeks' },
          { value: 'months', label: 'Within a few months' },
          { value: 'planning', label: 'Just planning ahead' }
        ]
      },
      {
        id: 'budget-range',
        question: "What's your typical budget range for business tools?",
        inputType: 'select',
        options: [
          { value: 'free', label: 'Free tools only' },
          { value: 'low', label: '$1-100/month' },
          { value: 'medium', label: '$100-500/month' },
          { value: 'high', label: '$500-2000/month' },
          { value: 'enterprise', label: '$2000+/month' }
        ]
      }
    ]
  },
  {
    id: 'final-thoughts',
    message: "Perfect! Last question - what would make this experience better for you?",
    inputType: 'textarea',
    placeholder: 'Share your thoughts on how we could improve this flow...',
    rows: 4
  }
];

interface DynamicInputProps {
  currentQuestion: any;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isDarkMode: boolean;
  onOpenColorPicker?: () => void;
  onPreviewUpdate?: (questionId: string, value: string) => void;
  customColors?: Array<{
    value: string;
    label: string;
    colors: string[];
  }>;
  hideSubmitButton?: boolean;
}

// function DynamicInput({ 
//   currentQuestion, 
//   value, 
//   onChange, 
//   onSubmit, 
//   isLoading, 
//   isDarkMode, 
//   onOpenColorPicker, 
//   onPreviewUpdate,
//   customColors = [],
//   hideSubmitButton = false
// }: DynamicInputProps) {
//   const [showCustomInput, setShowCustomInput] = useState(false);
//   const [customValue, setCustomValue] = useState('');
//   const [currentPage, setCurrentPage] = useState(0);
//   const [showColorPicker, setShowColorPicker] = useState(false);

//   // Reset pagination when question changes
//   useEffect(() => {
//     setCurrentPage(0);
//   }, [currentQuestion?.id]);

//   if (!currentQuestion) {
//     return (
//       <div className="flex gap-2 w-full">
//         <Textarea
//           value={value}
//           onChange={(e) => onChange(e.target.value)}
//           placeholder="Ask a question or provide feedback..."
//           rows={4}
//           disabled={isLoading}
//           className={`flex-1 resize-none ${
//             isDarkMode 
//               ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
//               : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
//           }`}
//         />
//         {!hideSubmitButton && (
//           <Button 
//             onClick={onSubmit}
//             disabled={isLoading || !value.trim()}
//             className="flex-shrink-0 self-start"
//           >
//             <Send className="h-4 w-4" />
//           </Button>
//         )}
//       </div>
//     );
//   }

//   const handleCustomSubmit = () => {
//     onChange(customValue);
//     setShowCustomInput(false);
//     setCustomValue('');
//     setTimeout(onSubmit, 100);
//   };

//   const renderInput = () => {
//     // Show custom input if toggled
//     if (showCustomInput) {
//       return (
//         <div className="space-y-2 w-full">
//           <div className="flex gap-2">
//             <Textarea
//               value={customValue}
//               onChange={(e) => setCustomValue(e.target.value)}
//               placeholder="Enter your custom value..."
//               rows={4}
//               className={`flex-1 resize-none ${
//                 isDarkMode 
//                   ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
//                   : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
//               }`}
//               autoFocus
//             />
//             {!hideSubmitButton && (
//               <Button 
//                 onClick={handleCustomSubmit}
//                 disabled={!customValue.trim()}
//                 className="flex-shrink-0 self-start"
//               >
//                 <Send className="h-4 w-4" />
//               </Button>
//             )}
//           </div>
//           <Button 
//             variant="outline" 
//             size="sm" 
//             onClick={() => setShowCustomInput(false)}
//             className={`w-full text-xs border ${
//               isDarkMode 
//                 ? 'text-gray-200 border-gray-500 bg-gray-700 hover:bg-gray-600' 
//                 : 'text-gray-900 border-gray-400 bg-white hover:bg-gray-50 hover:text-gray-900'
//             }`}
//           >
//             Back to Options
//           </Button>
//         </div>
//       );
//     }

//     switch (currentQuestion.inputType) {
//       case 'select':
//         return (
//           <div className="space-y-3 w-full">
//             <div className="flex gap-2">
//               <Select value={value} onValueChange={onChange}>
//                 <SelectTrigger className={`flex-1 ${
//                   isDarkMode 
//                     ? 'text-gray-100 bg-gray-600 border-gray-500' 
//                     : 'text-gray-900 bg-white border-gray-300'
//                 }`}>
//                   <SelectValue placeholder={currentQuestion.placeholder} />
//                 </SelectTrigger>
//                 <SelectContent className={`shadow-lg ${
//                   isDarkMode 
//                     ? 'bg-gray-700 border-gray-600' 
//                     : 'bg-white border-gray-300'
//                 }`}>
//                   {currentQuestion.options?.map((option: any) => (
//                     <SelectItem 
//                       key={option.value} 
//                       value={option.value} 
//                       className={`cursor-pointer ${
//                         isDarkMode 
//                           ? 'text-gray-100 bg-gray-700 hover:bg-gray-600 focus:bg-gray-600 data-[highlighted]:bg-gray-600 data-[highlighted]:text-gray-100' 
//                           : 'text-gray-900 bg-white hover:bg-blue-50 focus:bg-blue-50 data-[highlighted]:bg-blue-50 data-[highlighted]:text-gray-900'
//                       }`}
//                     >
//                       {option.label}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//               {!hideSubmitButton && (
//                 <Button 
//                   onClick={onSubmit}
//                   disabled={!value}
//                   className="flex-shrink-0"
//                 >
//                   <Send className="h-4 w-4" />
//                 </Button>
//               )}
//             </div>
//             <Button 
//               variant="outline" 
//               size="sm" 
//               onClick={() => setShowCustomInput(true)}
//               className={`w-full text-xs border ${
//                 isDarkMode 
//                   ? 'text-gray-200 border-gray-500 bg-gray-700 hover:bg-gray-600' 
//                   : 'text-gray-900 border-gray-400 bg-white hover:bg-gray-50 hover:text-gray-900'
//               }`}
//             >
//               <Edit3 className="h-3 w-3 mr-1" />
//               Enter Custom Value
//             </Button>
//           </div>
//         );

//       case 'colorSelect':
//         const colorItemsPerPage = 3; // Show 3 color options at a time (accounting for wider buttons)
        
//         // Combine original options with custom colors
//         const allColorOptions = [...(currentQuestion.options || []), ...customColors];
//         const colorTotalPages = Math.ceil(allColorOptions.length / colorItemsPerPage);
//         const colorStartIndex = currentPage * colorItemsPerPage;
//         const visibleColorOptions = allColorOptions.slice(colorStartIndex, colorStartIndex + colorItemsPerPage);
        
//         return (
//           <div className="space-y-3 w-full">
//             <div className="flex gap-2 justify-between items-center">
//               {/* Previous button */}
//               <button
//                 onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
//                 disabled={currentPage === 0}
//                 aria-label="Previous colors"
//                 className={`p-1 rounded ${
//                   currentPage === 0 
//                     ? 'text-gray-400 cursor-not-allowed' 
//                     : isDarkMode 
//                       ? 'text-gray-300 hover:text-gray-100' 
//                       : 'text-gray-600 hover:text-gray-900'
//                 }`}
//               >
//                 <ChevronLeft className="h-4 w-4" />
//               </button>
              
//               {/* Color options container */}
//               <div className="flex gap-2 flex-1 justify-center">
//                 {visibleColorOptions.map((option: any) => (
//                   <button
//                     key={option.value}
//                     onClick={() => {
//                       onChange(option.value);
//                       // Update preview immediately for color changes
//                       if (onPreviewUpdate && currentQuestion?.id) {
//                         onPreviewUpdate(currentQuestion.id, option.value);
//                       }
//                     }}
//                     className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${
//                       value === option.value 
//                         ? 'border-blue-500 bg-blue-50 shadow-sm' 
//                         : isDarkMode 
//                           ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-700/50' 
//                           : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
//                     }`}
//                   >
//                     {option.colors && (
//                       <div className="flex gap-1">
//                         {option.colors.map((color: string, i: number) => (
//                           <div
//                             key={i}
//                             className="w-3 h-3 rounded-full border shadow-sm"
//                             style={{ backgroundColor: color }}
//                           />
//                         ))}
//                       </div>
//                     )}
//                     <span className={`text-sm font-medium ${
//                       isDarkMode ? 'text-gray-100' : 'text-gray-900'
//                     }`}>{option.label}</span>
//                   </button>
//                 ))}
//               </div>
              
//               {/* Next button */}
//               <button
//                 onClick={() => setCurrentPage(Math.min(colorTotalPages - 1, currentPage + 1))}
//                 disabled={currentPage >= colorTotalPages - 1}
//                 aria-label="Next colors"
//                 className={`p-1 rounded ${
//                   currentPage >= colorTotalPages - 1 
//                     ? 'text-gray-400 cursor-not-allowed' 
//                     : isDarkMode 
//                       ? 'text-gray-300 hover:text-gray-100' 
//                       : 'text-gray-600 hover:text-gray-900'
//                 }`}
//               >
//                 <ChevronRight className="h-4 w-4" />
//               </button>
//             </div>
            
//             {/* Custom Color Picker */}
//             {showColorPicker && (
//               <div className="space-y-3 border-t pt-3">
//                 <div className="text-sm font-medium text-center">
//                   <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>
//                     Choose Your Custom Colors
//                   </span>
//                 </div>
                
//                 {/* Horizontal Color Wheel */}
//                 <div className="space-y-2">
//                   <div className="flex gap-2 items-center">
//                     <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
//                       Primary:
//                     </span>
//                     <input
//                       type="color"
//                       value={customValue.split(',')[0] || '#2563eb'}
//                       onChange={(e) => {
//                         const colors = customValue.split(',');
//                         colors[0] = e.target.value;
//                         setCustomValue(colors.join(','));
//                       }}
//                       className="w-8 h-6 rounded border cursor-pointer"
//                       aria-label="Select primary color"
//                     />
//                     <div 
//                       className="w-6 h-6 rounded border shadow-sm"
//                       style={{ backgroundColor: customValue.split(',')[0] || '#2563eb' }}
//                     />
//                   </div>
                  
//                   <div className="flex gap-2 items-center">
//                     <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
//                       Secondary:
//                     </span>
//                     <input
//                       type="color"
//                       value={customValue.split(',')[1] || '#1e40af'}
//                       onChange={(e) => {
//                         const colors = customValue.split(',');
//                         colors[1] = e.target.value;
//                         setCustomValue(colors.join(','));
//                       }}
//                       className="w-8 h-6 rounded border cursor-pointer"
//                       aria-label="Select secondary color"
//                     />
//                     <div 
//                       className="w-6 h-6 rounded border shadow-sm"
//                       style={{ backgroundColor: customValue.split(',')[1] || '#1e40af' }}
//                     />
//                   </div>
//                 </div>
                
//                 <div className="flex gap-2">
//                   <Button 
//                     onClick={handleCustomSubmit}
//                     disabled={!customValue.trim()}
//                     className="flex-1"
//                   >
//                     Use Custom Colors
//                   </Button>
//                   <Button 
//                     variant="outline" 
//                     size="sm" 
//                     onClick={() => setShowColorPicker(false)}
//                     className={`${
//                       isDarkMode 
//                         ? 'text-gray-200 border-gray-500 bg-gray-700 hover:bg-gray-600' 
//                         : 'text-gray-900 border-gray-400 bg-white hover:bg-gray-50 hover:text-gray-900'
//                     }`}
//                   >
//                     Cancel
//                   </Button>
//                 </div>
//               </div>
//             )}
            
//             {!showColorPicker && (
//               <div className="flex gap-2">
//                 <Button 
//                   variant="outline" 
//                   size="sm" 
//                   onClick={() => {
//                     if (onOpenColorPicker) {
//                       onOpenColorPicker();
//                     }
//                   }}
//                   className={`flex-1 text-xs border ${
//                     isDarkMode 
//                       ? 'text-gray-200 border-gray-500 bg-gray-700 hover:bg-gray-600' 
//                       : 'text-gray-900 border-gray-400 bg-white hover:bg-gray-50 hover:text-gray-900'
//                   }`}
//                 >
//                   <Palette className="h-3 w-3 mr-1" />
//                   Custom Color Scheme
//                 </Button>
//                 <Button 
//                   onClick={onSubmit}
//                   disabled={!value}
//                   className="flex-1"
//                 >
//                   Choose
//                 </Button>
//               </div>
//             )}
//           </div>
//         );

//       case 'multiSelect':
//         const selectedValues = value ? value.split(',') : [];
//         const itemsPerPage = 4; // Show 4 items at a time
//         const totalPages = Math.ceil((currentQuestion.options?.length || 0) / itemsPerPage);
//         const startIndex = currentPage * itemsPerPage;
//         const visibleOptions = currentQuestion.options?.slice(startIndex, startIndex + itemsPerPage) || [];
        
//         return (
//           <div className="space-y-3 w-full">
//             <div className="flex gap-2 justify-between items-center">
//               {/* Previous button */}
//               <button
//                 onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
//                 disabled={currentPage === 0}
//                 aria-label="Previous options"
//                 className={`p-1 rounded ${
//                   currentPage === 0 
//                     ? 'text-gray-400 cursor-not-allowed' 
//                     : isDarkMode 
//                       ? 'text-gray-300 hover:text-gray-100' 
//                       : 'text-gray-600 hover:text-gray-900'
//                 }`}
//               >
//                 <ChevronLeft className="h-4 w-4" />
//               </button>
              
//               {/* Options container */}
//               <div className="flex gap-2 flex-1 justify-center">
//                 {visibleOptions.map((option: any) => {
//                   const isSelected = selectedValues.includes(option.value);
//                   return (
//                     <button
//                       key={option.value}
//                       onClick={() => {
//                         let newValues;
//                         if (isSelected) {
//                           newValues = selectedValues.filter(v => v !== option.value);
//                         } else {
//                           if (selectedValues.length < (currentQuestion.maxSelections || 3)) {
//                             newValues = [...selectedValues, option.value];
//                           } else {
//                             return;
//                           }
//                         }
//                         onChange(newValues.join(','));
//                       }}
//                       className={`px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
//                         isSelected 
//                           ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
//                           : isDarkMode 
//                             ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-700/50 text-gray-200' 
//                             : 'border-gray-200 hover:border-gray-300 text-gray-900'
//                       }`}
//                     >
//                       <div className={`w-3 h-3 rounded border flex items-center justify-center ${
//                         isSelected 
//                           ? 'border-blue-500 bg-blue-500' 
//                           : isDarkMode 
//                             ? 'border-gray-500' 
//                             : 'border-gray-300'
//                       }`}>
//                         {isSelected && (
//                           <div className="w-1.5 h-1.5 bg-white" />
//                         )}
//                       </div>
//                       <span className="font-medium">{option.label}</span>
//                     </button>
//                   );
//                 })}
//               </div>
              
//               {/* Next button */}
//               <button
//                 onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
//                 disabled={currentPage >= totalPages - 1}
//                 aria-label="Next options"
//                 className={`p-1 rounded ${
//                   currentPage >= totalPages - 1 
//                     ? 'text-gray-400 cursor-not-allowed' 
//                     : isDarkMode 
//                       ? 'text-gray-300 hover:text-gray-100' 
//                       : 'text-gray-600 hover:text-gray-900'
//                 }`}
//               >
//                 <ChevronRight className="h-4 w-4" />
//               </button>
//             </div>
            
//             <div className="flex gap-2">
//               <Button 
//                 onClick={onSubmit}
//                 disabled={selectedValues.length === 0}
//                 className="flex-1"
//               >
//                 Continue ({selectedValues.length} selected)
//               </Button>
//             </div>
//           </div>
//         );

//       case 'textarea':
//         return (
//           <div className="flex gap-2 w-full">
//             <Textarea
//               value={value}
//               onChange={(e) => onChange(e.target.value)}
//               placeholder={currentQuestion.placeholder}
//               rows={4}
//               className={`flex-1 resize-none ${
//                 isDarkMode 
//                   ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
//                   : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
//               }`}
//             />
//             {!hideSubmitButton && (
//               <Button 
//                 onClick={onSubmit}
//                 disabled={!value.trim()}
//                 className="flex-shrink-0 self-start"
//               >
//                 <Send className="h-4 w-4" />
//               </Button>
//             )}
//           </div>
//         );

//       case 'yesNoMaybe':
//         return (
//           <div className="space-y-3 w-full">
//             <div className="flex gap-2 flex-wrap">
//               {currentQuestion.options?.map((option: any) => (
//                 <button
//                   key={option.value}
//                   onClick={() => {
//                     onChange(option.value);
//                     setTimeout(onSubmit, 100);
//                   }}
//                   className={`px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
//                     value === option.value 
//                       ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
//                       : isDarkMode 
//                         ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-700/50 text-gray-200' 
//                         : 'border-gray-200 hover:border-gray-300 text-gray-900'
//                   }`}
//                 >
//                   <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
//                     value === option.value 
//                       ? 'border-blue-500 bg-blue-500' 
//                       : isDarkMode 
//                         ? 'border-gray-500' 
//                         : 'border-gray-300'
//                   }`}>
//                     {value === option.value && (
//                       <div className="w-1.5 h-1.5 rounded-full bg-white" />
//                     )}
//                   </div>
//                   <span className="font-medium">{option.label}</span>
//                 </button>
//               ))}
//             </div>
            
//             {/* Spacer to maintain consistent container height */}
//             <div className="h-8" />
//           </div>
//         );

//       case 'fileUpload':
//         return (
//           <div className="space-y-3 w-full">
//             <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
//               isDarkMode 
//                 ? 'border-gray-600 hover:border-gray-500 bg-gray-800/30' 
//                 : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
//             }`}>
//               <input
//                 type="file"
//                 accept={currentQuestion.acceptedFileTypes?.join(',') || 'image/*'}
//                 onChange={(e) => {
//                   const file = e.target.files?.[0];
//                   if (file) {
//                     // For demo purposes, just set the filename
//                     onChange(file.name);
//                     // In real implementation, you'd handle file upload here
//                     console.log('File selected:', file);
//                   }
//                 }}
//                 className="hidden"
//                 id="file-upload"
//               />
//               <label 
//                 htmlFor="file-upload" 
//                 className={`cursor-pointer flex flex-col items-center gap-2 ${
//                   isDarkMode ? 'text-gray-300' : 'text-gray-600'
//                 }`}
//               >
//                 <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
//                   isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
//                 }`}>
//                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
//                   </svg>
//                 </div>
//                 <div>
//                   <span className="font-medium">
//                     {value ? `Selected: ${value}` : 'Click to upload file'}
//                   </span>
//                   <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
//                     {currentQuestion.placeholder || 'Upload your file'}
//                   </p>
//                   {currentQuestion.maxFileSize && (
//                     <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
//                       Max size: {currentQuestion.maxFileSize}
//                     </p>
//                   )}
//                 </div>
//               </label>
//             </div>
            
//             {value && (
//               <div className="flex gap-2">
//                 {!hideSubmitButton && (
//                   <Button 
//                     onClick={onSubmit}
//                     className="flex-1"
//                   >
//                     Continue with "{value}"
//                   </Button>
//                 )}
//                 <Button 
//                   variant="outline"
//                   onClick={() => onChange('')}
//                   className={`${
//                     isDarkMode 
//                       ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
//                       : 'border-gray-300 text-gray-700 hover:bg-gray-50'
//                   }`}
//                 >
//                   Clear
//                 </Button>
//               </div>
//             )}
//           </div>
//         );

//       default: // textarea for all free-hand text responses
//         return (
//           <div className="space-y-2 w-full">
//             {currentQuestion.suggestions && (
//               <div className="flex flex-wrap gap-1">
//                 {currentQuestion.suggestions.map((suggestion: string, i: number) => (
//                   <button
//                     key={i}
//                     onClick={() => onChange(suggestion)}
//                     className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border text-gray-900"
//                   >
//                     {suggestion}
//                   </button>
//                 ))}
//               </div>
//             )}
//             <div className="flex gap-2">
//               <Textarea
//                 value={value}
//                 onChange={(e) => onChange(e.target.value)}
//                 placeholder={currentQuestion.placeholder}
//                 rows={4}
//                 className={`flex-1 resize-none ${
//                   isDarkMode 
//                     ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
//                     : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
//                 }`}
//               />
//               {!hideSubmitButton && (
//                 <Button 
//                   onClick={onSubmit}
//                   disabled={!value.trim()}
//                   className="flex-shrink-0 self-start"
//                 >
//                   <Send className="h-4 w-4" />
//                 </Button>
//               )}
//             </div>
//           </div>
//         );
//     }
//   };

//   return renderInput();
// }

// Color Picker Popup Component
interface ColorPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (primaryColor: string, secondaryColor: string) => void;
  initialPrimary?: string;
  initialSecondary?: string;
  isDarkMode: boolean;
}

// function ColorPickerPopup({ 
//   isOpen, 
//   onClose, 
//   onSubmit, 
//   initialPrimary = '#2563eb', 
//   initialSecondary = '#1e40af',
//   isDarkMode 
// }: ColorPickerPopupProps) {
//   const [primaryColor, setPrimaryColor] = useState(initialPrimary);
//   const [secondaryColor, setSecondaryColor] = useState(initialSecondary);
//   const [hasSelectedColors, setHasSelectedColors] = useState(false);

//   if (!isOpen) return null;

//   const handleSubmit = () => {
//     onSubmit(primaryColor, secondaryColor);
//     onClose();
//   };

//   const handlePreview = () => {
//     setHasSelectedColors(true);
//   };

//   return (
//     <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
//       <div className={`rounded-xl shadow-2xl border max-w-2xl w-full ${
//         isDarkMode 
//           ? 'bg-gray-800 border-gray-600' 
//           : 'bg-white border-gray-300'
//       }`}>
//         {/* Header */}
//         <div className={`flex items-center justify-between p-4 border-b ${
//           isDarkMode ? 'border-gray-600' : 'border-gray-200'
//         }`}>
//           <h3 className={`text-lg font-semibold ${
//             isDarkMode ? 'text-gray-50' : 'text-gray-900'
//           }`}>
//             Choose Your Color Scheme
//           </h3>
//           <button
//             onClick={onClose}
//             className={`p-1 rounded hover:bg-gray-100 ${
//               isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
//             }`}
//             aria-label="Close color picker"
//           >
//             <X className="h-5 w-5" />
//           </button>
//         </div>

//         {/* Color Pickers */}
//         <div className="p-6">
//           {!hasSelectedColors && (
//             <div className="space-y-6">
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 {/* Primary Color Picker */}
//                 <div className="space-y-3">
//                   <div className="text-center">
//                     <h4 className={`font-medium mb-2 ${
//                       isDarkMode ? 'text-gray-200' : 'text-gray-700'
//                     }`}>
//                       Primary Color
//                     </h4>
//                     <div 
//                       className="w-16 h-16 rounded-lg border-2 border-gray-300 mx-auto mb-3 shadow-sm"
//                       style={{ backgroundColor: primaryColor }}
//                     />
//                   </div>
                  
//                   {/* Full-sized color picker */}
//                   <div className="relative">
//                     <input
//                       type="color"
//                       value={primaryColor}
//                       onChange={(e) => setPrimaryColor(e.target.value)}
//                       className="w-full h-32 rounded-lg border cursor-pointer"
//                       style={{
//                         WebkitAppearance: 'none',
//                         border: 'none',
//                         borderRadius: '8px',
//                         cursor: 'pointer'
//                       }}
//                       aria-label="Select primary color"
//                     />
//                   </div>
                  
//                   {/* Color value display */}
//                   <div className={`text-center text-sm font-mono ${
//                     isDarkMode ? 'text-gray-300' : 'text-gray-600'
//                   }`}>
//                     {primaryColor.toUpperCase()}
//                   </div>
//                 </div>

//                 {/* Secondary Color Picker */}
//                 <div className="space-y-3">
//                   <div className="text-center">
//                     <h4 className={`font-medium mb-2 ${
//                       isDarkMode ? 'text-gray-200' : 'text-gray-700'
//                     }`}>
//                       Secondary Color
//                     </h4>
//                     <div 
//                       className="w-16 h-16 rounded-lg border-2 border-gray-300 mx-auto mb-3 shadow-sm"
//                       style={{ backgroundColor: secondaryColor }}
//                     />
//                   </div>
                  
//                   {/* Full-sized color picker */}
//                   <div className="relative">
//                     <input
//                       type="color"
//                       value={secondaryColor}
//                       onChange={(e) => setSecondaryColor(e.target.value)}
//                       className="w-full h-32 rounded-lg border cursor-pointer"
//                       style={{
//                         WebkitAppearance: 'none',
//                         border: 'none',
//                         borderRadius: '8px',
//                         cursor: 'pointer'
//                       }}
//                       aria-label="Select secondary color"
//                     />
//                   </div>
                  
//                   {/* Color value display */}
//                   <div className={`text-center text-sm font-mono ${
//                     isDarkMode ? 'text-gray-300' : 'text-gray-600'
//                   }`}>
//                     {secondaryColor.toUpperCase()}
//                   </div>
//                 </div>
//               </div>

//               {/* Preview Section */}
//               <div className="p-4 rounded-lg border-2" style={{ 
//                 borderColor: primaryColor,
//                 background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)`
//               }}>
//                 <div className="text-center">
//                   <h5 className={`font-medium mb-2 ${
//                     isDarkMode ? 'text-gray-200' : 'text-gray-700'
//                   }`}>
//                     Live Preview
//                   </h5>
//                   <div className="flex items-center justify-center gap-3">
//                     <div 
//                       className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
//                       style={{ backgroundColor: primaryColor }}
//                     />
//                     <span className={`text-sm ${
//                       isDarkMode ? 'text-gray-300' : 'text-gray-600'
//                     }`}>
//                       +
//                     </span>
//                     <div 
//                       className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
//                       style={{ backgroundColor: secondaryColor }}
//                     />
//                   </div>
//                 </div>
//               </div>

//               {/* Action Buttons */}
//               <div className="flex gap-3">
//                 <Button
//                   variant="outline"
//                   onClick={onClose}
//                   className={`flex-1 ${
//                     isDarkMode 
//                       ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
//                       : 'border-gray-300 text-gray-700 hover:bg-gray-50'
//                   }`}
//                 >
//                   Cancel
//                 </Button>
//                 <Button
//                   onClick={handlePreview}
//                   className="flex-1"
//                   style={{ backgroundColor: primaryColor }}
//                 >
//                   Preview Selection
//                 </Button>
//               </div>
//             </div>
//           )}

//           {/* Selected Colors Confirmation View */}
//           {hasSelectedColors && (
//             <div className="text-center space-y-6">
//               <div>
//                 <h4 className={`text-lg font-semibold mb-4 ${
//                   isDarkMode ? 'text-gray-200' : 'text-gray-700'
//                 }`}>
//                   Your Selected Color Scheme
//                 </h4>
                
//                 {/* Large Color Preview */}
//                 <div className="flex items-center justify-center gap-6 mb-6">
//                   <div className="text-center">
//                     <div 
//                       className="w-20 h-20 rounded-xl border-2 border-gray-300 mx-auto mb-2 shadow-lg"
//                       style={{ backgroundColor: primaryColor }}
//                     />
//                     <p className={`text-sm font-medium ${
//                       isDarkMode ? 'text-gray-300' : 'text-gray-600'
//                     }`}>
//                       Primary
//                     </p>
//                     <p className={`text-xs font-mono ${
//                       isDarkMode ? 'text-gray-400' : 'text-gray-500'
//                     }`}>
//                       {primaryColor.toUpperCase()}
//                     </p>
//                   </div>
                  
//                   <div className="text-center">
//                     <div 
//                       className="w-20 h-20 rounded-xl border-2 border-gray-300 mx-auto mb-2 shadow-lg"
//                       style={{ backgroundColor: secondaryColor }}
//                     />
//                     <p className={`text-sm font-medium ${
//                       isDarkMode ? 'text-gray-300' : 'text-gray-600'
//                     }`}>
//                       Secondary
//                     </p>
//                     <p className={`text-xs font-mono ${
//                       isDarkMode ? 'text-gray-400' : 'text-gray-500'
//                     }`}>
//                       {secondaryColor.toUpperCase()}
//                     </p>
//                   </div>
//                 </div>
                
//                 {/* Edit Colors Button */}
//                 <Button
//                   variant="outline"
//                   onClick={() => setHasSelectedColors(false)}
//                   className={`${
//                     isDarkMode 
//                       ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
//                       : 'border-gray-300 text-gray-700 hover:bg-gray-50'
//                   }`}
//                 >
//                   Edit Colors
//                 </Button>
//               </div>

//               {/* Action Buttons */}
//               <div className="flex gap-3">
//                 <Button
//                   variant="outline"
//                   onClick={onClose}
//                   className={`flex-1 ${
//                     isDarkMode 
//                       ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
//                       : 'border-gray-300 text-gray-700 hover:bg-gray-50'
//                   }`}
//                 >
//                   Cancel
//                 </Button>
//                 <Button
//                   onClick={handleSubmit}
//                   className="flex-1"
//                   style={{ backgroundColor: primaryColor }}
//                 >
//                   Choose
//                 </Button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// Full Form Popup Component
interface FullFormPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (answers: Record<string, string>) => void;
  questions: any[];
  initialAnswers: Record<string, string>;
  isDarkMode: boolean;
}

// function FullFormPopup({ 
//   isOpen, 
//   onClose, 
//   onSubmit, 
//   questions, 
//   initialAnswers,
//   isDarkMode 
// }: FullFormPopupProps) {
//   const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);

//   // Update internal state when initialAnswers prop changes
//   useEffect(() => {
//     setAnswers(initialAnswers);
//   }, [initialAnswers]);

//   if (!isOpen) return null;

//   const handleSubmit = () => {
//     // Check if all questions have answers
//     const missingAnswers = questions.filter(q => !answers[q.id] || answers[q.id].trim() === '');
//     if (missingAnswers.length > 0) {
//       alert(`Please answer all questions. Missing: ${missingAnswers.map(q => q.question.slice(0, 30) + '...').join(', ')}`);
//       return;
//     }
    
//     onSubmit(answers);
//     onClose();
//   };

//   const updateAnswer = (questionId: string, value: string) => {
//     setAnswers(prev => ({ ...prev, [questionId]: value }));
//   };

//   // Check if all questions have been answered
//   const allQuestionsAnswered = questions.every(q => answers[q.id] && answers[q.id].trim() !== '');

//   return (
//     <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
//       <div className={`rounded-xl shadow-2xl border max-w-4xl w-full max-h-[90vh] overflow-hidden ${
//         isDarkMode 
//           ? 'bg-gray-800 border-gray-600' 
//           : 'bg-white border-gray-300'
//       }`}>
//         {/* Header */}
//         <div className={`flex items-center justify-between p-4 border-b ${
//           isDarkMode ? 'border-gray-600' : 'border-gray-200'
//         }`}>
//           <h3 className={`text-lg font-semibold ${
//             isDarkMode ? 'text-gray-50' : 'text-gray-900'
//           }`}>
//             Complete All Questions ({questions.length} total)
//           </h3>
//           <button
//             onClick={onClose}
//             className={`p-1 rounded hover:bg-gray-100 ${
//               isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
//             }`}
//             aria-label="Close full form"
//           >
//             <X className="h-5 w-5" />
//           </button>
//         </div>

//         {/* Form Content */}
//         <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
//           <div className="space-y-6">
//             {questions.map((question, index) => (
//               <div key={question.id} className={`p-4 rounded-lg border ${
//                 isDarkMode 
//                   ? 'border-gray-600 bg-gray-700/30' 
//                   : 'border-gray-200 bg-gray-50/50'
//               }`}>
//                 <div className="mb-3">
//                   <h4 className={`font-medium mb-1 ${
//                     isDarkMode ? 'text-gray-100' : 'text-gray-900'
//                   }`}>
//                     Question {index + 1}
//                   </h4>
//                   <p className={`text-sm ${
//                     isDarkMode ? 'text-gray-300' : 'text-gray-600'
//                   }`}>
//                     {question.question}
//                   </p>
//                 </div>
                
//                 <DynamicInput
//                   currentQuestion={question}
//                   value={answers[question.id] || ''}
//                   onChange={(value) => {
//                     updateAnswer(question.id, value);
//                   }}
//                   onSubmit={() => {}} // No individual submit in full form
//                   isLoading={false}
//                   isDarkMode={isDarkMode}
//                   hideSubmitButton={true}
//                 />
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Footer */}
//         <div className={`p-4 border-t ${
//           isDarkMode ? 'border-gray-600' : 'border-gray-200'
//         }`}>
//           <div className="flex gap-3">
//             <Button
//               variant="outline"
//               onClick={onClose}
//               className={`flex-1 ${
//                 isDarkMode 
//                   ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
//                   : 'border-gray-300 text-gray-700 hover:bg-gray-50'
//               }`}
//             >
//               Cancel
//             </Button>
//             <Button
//               onClick={handleSubmit}
//               disabled={!allQuestionsAnswered}
//               className="flex-1"
//             >
//               Submit All Answers
//             </Button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// ============================================================================
// OPTIONS MENU COMPONENT WITH COLLAPSIBLE SUB-MENUS
// ============================================================================

interface OptionsMenuProps {
  isDarkMode: boolean;
  onClose: () => void;
  useMockData: boolean;
  useIteratorTest: boolean;
  historyPanelSide: 'left' | 'right';
  savedLogicResults: SavedLogicResult[];
  savedTools: ProductToolDefinition[]; // Corrected type to ProductToolDefinition[]
  selectedModel: string;
  availableModels: Array<{ id: string; name: string }>;
  onToggleDarkMode: () => void;
  onToggleMockData: () => void;
  onToggleIteratorTest: () => void;
  onToggleHistoryPanel: () => void;
  onResetWorkflow: () => void;
  onShowLogicSelect: () => void;
  onShowToolsSelect: () => void; // Ensure this is correctly defined and used
  onTestBrainstorming: () => void;
  onTestToolCreation: () => void;
  onTestMultiPart: () => void;
  onTestFileUpload: () => void;
  onTestColorPicker: () => void;
  onTestComponentValidation: () => void;
  onModelChange: (model: string) => void;
}

interface MenuSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    badge?: string;
  }>;
}

function OptionsMenu({ 
  isDarkMode, 
  onClose, 
  useMockData,
  useIteratorTest,
  historyPanelSide,
  savedLogicResults,
  savedTools,
  selectedModel,
  availableModels,
  onToggleDarkMode,
  onToggleMockData,
  onToggleIteratorTest,
  onToggleHistoryPanel,
  onResetWorkflow,
  onShowLogicSelect,
  onShowToolsSelect,
  onTestBrainstorming,
  onTestToolCreation,
  onTestMultiPart,
  onTestFileUpload,
  onTestColorPicker,
  onTestComponentValidation,
  onModelChange
}: OptionsMenuProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['mode-workflow']));

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const menuSections: MenuSection[] = [
    {
      id: 'mode-workflow',
      title: 'Mode & Workflow',
      icon: <Settings className="h-4 w-4" />,
      items: [
        {
          icon: isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
          label: isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
          onClick: () => {
            onToggleDarkMode();
            onClose();
          }
        },
        {
          icon: <Brain className="h-4 w-4" />,
          label: useMockData ? 'Switch to Real AI' : 'Switch to Mock Mode',
          onClick: () => {
            onToggleMockData();
            onClose();
          }
        },
        {
          icon: <MessageCircle className="h-4 w-4" />,
          label: useIteratorTest ? 'Standard Workflow' : 'Iterator Test Workflow',
          onClick: () => {
            onToggleIteratorTest();
            onClose();
          }
        },
        {
          icon: <RotateCcw className="h-4 w-4" />,
          label: 'Reset Workflow',
          onClick: () => {
            onResetWorkflow();
            onClose();
          }
        }
      ]
    },
    {
      id: 'panel-settings',
      title: 'Panel Settings',
      icon: <Layout className="h-4 w-4" />,
      items: [
        {
          icon: historyPanelSide === 'left' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />,
          label: `History Panel: ${historyPanelSide === 'left' ? 'Left Side' : 'Right Side'}`,
          onClick: () => {
            onToggleHistoryPanel();
            onClose();
          }
        }
      ]
    },
    {
      id: 'test-commands',
      title: 'Test API Commands',
      icon: <MessageSquare className="h-4 w-4" />,
      items: [
        {
          icon: <MessageCircle className="h-4 w-4" />,
          label: 'Test Multi-Part Questions',
          onClick: () => {
            onTestMultiPart();
            onClose();
          }
        },
        {
          icon: <Upload className="h-4 w-4" />,
          label: 'Test File Upload',
          onClick: () => {
            onTestFileUpload();
            onClose();
          }
        },
        {
          icon: <Palette className="h-4 w-4" />,
          label: 'Test Color Picker',
          onClick: () => {
            onTestColorPicker();
            onClose();
          }
        }
      ]
    },
    {
      id: 'ai-tools',
      title: 'AI Tools & Logic Architect',
      icon: <Brain className="h-4 w-4" />,
      items: [
        {
          icon: <Brain className="h-4 w-4" />,
          label: 'Test Logic Architect Brainstorming',
          onClick: () => {
            onTestBrainstorming();
            onClose();
          }
        },
        {
          icon: <Zap className="h-4 w-4" />,
          label: 'Test Tool Creation Agent',
          onClick: () => {
            onTestToolCreation();
            onClose();
          }
        }
      ]
    },
    {
      id: 'data-management',
      title: 'Saved Data Management',
      icon: <History className="h-4 w-4" />,
      items: [
        {
          icon: <History className="h-4 w-4" />,
          label: 'View Saved Logic Results',
          onClick: () => {
            onShowLogicSelect();
            onClose();
          },
          badge: String(savedLogicResults.length)
        },
        {
          icon: <Calculator className="h-4 w-4" />,
          label: 'View Saved Tools',
          onClick: () => {
            onShowToolsSelect();
            onClose();
          },
          badge: String(savedTools.length)
        }
      ]
    },
    {
      id: 'development',
      title: 'Development & Testing',
      icon: <CheckCircle className="h-4 w-4" />,
      items: [
        {
          icon: <CheckCircle className="h-4 w-4" />,
          label: 'Run Component Validation Tests',
          onClick: () => {
            onTestComponentValidation();
            onClose();
          }
        }
      ]
    },
    {
      id: 'model-selection',
      title: 'Model Selection',
      icon: <Brain className="h-4 w-4" />,
      items: [] // Special section with custom rendering
    }
  ];

  return (
    <div className={`absolute right-0 top-full mt-2 w-72 rounded-xl shadow-xl border z-50 max-h-96 overflow-y-auto ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-600 shadow-black/20' 
        : 'bg-white border-gray-300 shadow-lg'
    }`}>
      <div className="py-2">
        {menuSections.map((section, sectionIndex) => (
          <div key={section.id}>
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className={`w-full px-4 py-3 text-left text-sm font-medium flex items-center justify-between transition-colors rounded-lg mx-2 ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {section.icon}
                <span>{section.title}</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                expandedSections.has(section.id) ? 'rotate-180' : ''
              }`} />
            </button>

            {/* Section Items */}
            {expandedSections.has(section.id) && (
              <div className="pb-2">
                {/* Special handling for model selection */}
                {section.id === 'model-selection' ? (
                  <div className="px-8 py-2">
                    <label htmlFor="model-select" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Choose Model:
                    </label>
                    <select
                      id="model-select"
                      value={selectedModel}
                      onChange={(e) => onModelChange(e.target.value)}
                      className={`w-full p-2 rounded-md border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-200' 
                          : 'bg-white border-gray-300 text-gray-700'
                      }`}
                    >
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Selected: {availableModels.find(m => m.id === selectedModel)?.name}
                    </p>
                  </div>
                ) : (
                  /* Regular menu items */
                  section.items.map((item, itemIndex) => (
                    <button
                      key={itemIndex}
                      onClick={item.onClick}
                      className={`w-full px-8 py-2 text-left text-sm flex items-center justify-between transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <Badge variant="outline" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Divider between sections (except last) */}
            {sectionIndex < menuSections.length - 1 && (
              <div className={`border-t my-2 mx-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================

export default function TestUIPage() {
  const [useMockData, setUseMockData] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [historyPanelSide, setHistoryPanelSide] = useState<'left' | 'right'>('left');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(7);
  const [lastAIMessage, setLastAIMessage] = useState("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPickerPopup, setShowColorPickerPopup] = useState(false);
  
  // Missing state declarations for handleStyleUpdate function
  const [aiResponseText, setAiResponseText] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [aiCurrentQuestion, setAiCurrentQuestion] = useState<{
    id: string;
    message: string;
    inputType: string;
    placeholder?: string;
    options?: Array<{ value: string; label: string; colors?: string[]; }>;
    allowCustom?: boolean;
    maxSelections?: number;
    suggestions?: string[];
    acceptedFileTypes?: string[];
    maxFileSize?: string;
    questions?: any[];
  } | null>(null);
  
  // Behavior tracking state
  const [responseStartTime, setResponseStartTime] = useState<number>(Date.now());
  const [behaviorTracker, setBehaviorTracker] = useState<any>(null);
  
  // Workflow selection state
  const [useIteratorTest, setUseIteratorTest] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<any[]>(mockWorkflow);
  
  // Question queue management
  const [questionQueue, setQuestionQueue] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [collectedAnswers, setCollectedAnswers] = useState<Record<string, string>>({});
  
  // Multi-part question state
  const [isInMultiPart, setIsInMultiPart] = useState(false);
  const [multiPartQuestions, setMultiPartQuestions] = useState<any[]>([]);
  const [multiPartIndex, setMultiPartIndex] = useState(0);
  const [multiPartAnswers, setMultiPartAnswers] = useState<Record<string, string>>({});
  
  // Conversation history tracking
  const [conversationHistory, setConversationHistory] = useState<Array<{
    step: number;
    questionIndex: number;
    questionId: string;
    isMultiPart: boolean;
    multiPartIndex?: number;
  }>>([]);
  const [isEditingPrevious, setIsEditingPrevious] = useState(false);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editingOverlayFadingOut, setEditingOverlayFadingOut] = useState(false);
  
  // NEW: Proper AI message history for counting responses
  const [aiMessageHistory, setAiMessageHistory] = useState<Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    type?: string;
  }>>([]);
  
  // Dynamic question history for AI workflow
  const [questionHistory, setQuestionHistory] = useState<Array<{
    id: string;
    message: string;
    inputType: string;
    options?: Array<{ value: string; label: string; colors?: string[]; }>;
    placeholder?: string;
    allowCustom?: boolean;
    maxSelections?: number;
    suggestions?: string[];
    questions?: any[]; // for multiPart
  }>>([]);
  
  // Custom colors state
  const [customColors, setCustomColors] = useState<Array<{
    value: string;
    label: string;
    colors: string[];
  }>>([]);
  
  // Full form popup state
  const [showFullFormPopup, setShowFullFormPopup] = useState(false);
  const [fullFormAnswers, setFullFormAnswers] = useState<Record<string, string>>({});
  
  // Transition state for fade effects
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionOpacity, setTransitionOpacity] = useState(1);
  
  // Tool data for canvas
  const [toolData, setToolData] = useState<any>({
    title: 'Business Calculator',
    description: 'Calculate your business metrics',
    colorScheme: 'professional-blue',
    inputs: [],
    outputFormat: ['percentage']
  });

  // AI-generated Product Tool Definition state
  const [productToolDefinition, setProductToolDefinition] = useState<ProductToolDefinition | null>(null);
  const [isGeneratingTool, setIsGeneratingTool] = useState(false);
  
  // NEW: Brainstorming streaming state
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [brainstormingThoughts, setBrainstormingThoughts] = useState<Array<{
    type: 'partial' | 'complete' | 'error';
    data: any;
    timestamp: number;
    message?: string; // Add optional message property for error types
  }>>([]);
  const [latestBrainstormingResult, setLatestBrainstormingResult] = useState<any>(null);
  const [showBrainstormingPanel, setShowBrainstormingPanel] = useState(false);
  
  // NEW: Local storage state for saved logic results and tools
  const [savedLogicResults, setSavedLogicResults] = useState<SavedLogicResult[]>([]);
  const [showLogicSelect, setShowLogicSelect] = useState(false);
  
  // NEW: State for list of all tools from IndexedDB
  const [savedToolsFromDB, setSavedToolsFromDB] = useState<ProductToolDefinition[]>([]);
  const [showToolsSelect, setShowToolsSelect] = useState(false); // Restored for the modal

  const [selectedModel, setSelectedModel] = useState('gpt-4.1'); // Default to flagship model

  // Available models for testing
  const availableModels = [
    // Flagship models
    { id: 'gpt-4.1', name: 'GPT-4.1 (Flagship)' },
    { id: 'gpt-4o', name: 'GPT-4o (Fast & Intelligent)' },
    { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o (Latest)' },
    { id: 'gpt-4o-audio-preview', name: 'GPT-4o Audio' },
    
    // Cost-optimized models
    { id: 'o4-mini', name: 'o4-mini (Fast Reasoning)' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (Fastest)' },
    { id: 'o3-mini', name: 'o3-mini' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o-mini-audio-preview', name: 'GPT-4o Mini Audio' },
    { id: 'o1-mini', name: 'o1-mini (Deprecated)' }
  ];

  // Initialize dark mode based on system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);

    // Load initial data from IndexedDB
    const loadInitialData = async () => {
      console.log("Attempting to load last active tool and all tools from IndexedDB...");
      const lastActiveTool = await loadLastActiveToolFromDB();
      if (lastActiveTool) {
        setProductToolDefinition(lastActiveTool);
        setToolData((prev: any) => ({
          ...prev, 
          title: lastActiveTool.metadata.title,
          description: lastActiveTool.metadata.description,
          colorScheme: typeof lastActiveTool.colorScheme === 'string' ? lastActiveTool.colorScheme : (lastActiveTool.colorScheme?.primary || 'professional-blue'),
          customColors: typeof lastActiveTool.colorScheme !== 'string' ? [lastActiveTool.colorScheme?.primary, lastActiveTool.colorScheme?.secondary].filter(Boolean) as string[] : undefined,
          features: lastActiveTool.metadata.features || [],
        }));
      } else {
        console.log("No last active tool found, starting fresh.");
      }

      const logicResultsFromDB = await loadLogicResultsFromDB();
      setSavedLogicResults(logicResultsFromDB);
      console.log(`Loaded ${logicResultsFromDB.length} logic results from IndexedDB initially.`);

      // NEW: Load all saved tools for the "View Saved Tools" list
      const allToolsFromDB = await loadAllToolsFromDB();
      setSavedToolsFromDB(allToolsFromDB);
      console.log(`Loaded ${allToolsFromDB.length} tools into savedToolsFromDB initially.`);
    };
    loadInitialData();
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Initialize with first mock question
  useEffect(() => {
    console.log('🔧 Initial setup useEffect triggered:', { useMockData, questionQueueLength: questionQueue.length });
    if (useMockData && questionQueue.length === 0) {
      console.log('🔧 Initializing with first mock question');
      setQuestionQueue([currentWorkflow[0]]);
      setCurrentQuestionIndex(0);
      // Also add to question history for consistent editing
      setQuestionHistory([currentWorkflow[0]]);
    }
    // Note: Removed the AI mode clearing logic to prevent circular dependency
    // AI responses should be allowed to set questionQueue without interference
  }, [useMockData, currentWorkflow]); // Removed questionQueue.length dependency

  // Handle mode switching - clear queue when switching to AI mode
  /* DISABLED: This useEffect was clearing AI-generated questions
  useEffect(() => {
    console.log('🔧 Mode switch detected, clearing queue for AI mode');
    if (!useMockData) {
      setQuestionQueue([]);
      setCurrentQuestionIndex(0);
      setCurrentInput('');
    }
  }, [useMockData]); // Only trigger when useMockData changes
  */

  // Handle workflow switching
  useEffect(() => {
    const newWorkflow = useIteratorTest ? iteratorTestWorkflow : mockWorkflow;
    setCurrentWorkflow(newWorkflow);
    
    // Update the welcome message based on workflow
    if (useIteratorTest) {
      setLastAIMessage("Welcome to the Multi-Question Iterator Test! This will help us test the iterator component with various question sequences.");
      setTotalSteps(iteratorTestWorkflow.length);
    } else {
      setLastAIMessage("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
      setTotalSteps(mockWorkflow.length);
    }
  }, [useIteratorTest]);

  const currentQuestion = isInMultiPart 
    ? multiPartQuestions[multiPartIndex] || null 
    : questionQueue[currentQuestionIndex] || null;

  // Debug logging for question state
  useEffect(() => {
    console.log('🔧 Question state updated:', {
      isInMultiPart,
      multiPartQuestionsLength: multiPartQuestions.length,
      multiPartIndex,
      questionQueueLength: questionQueue.length,
      currentQuestionIndex,
      currentQuestion: currentQuestion ? { id: currentQuestion.id, inputType: currentQuestion.inputType } : null
    });
  }, [isInMultiPart, multiPartQuestions, multiPartIndex, questionQueue, currentQuestionIndex, currentQuestion]);

  // Debug logging specifically for questionQueue changes
  useEffect(() => {
    console.log('🔧 questionQueue changed:', questionQueue.length, questionQueue.map(q => ({ id: q.id, inputType: q.inputType })));
  }, [questionQueue]);

  // Helper function to handle smooth transitions between questions
  const transitionToNewContent = async (updateFunction: () => void) => {
    setIsTransitioning(true);
    setTransitionOpacity(0); // Fade out
    
    // Wait for fade out to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Update content while invisible
    updateFunction();
    
    // Fade back in
    setTimeout(() => {
      setTransitionOpacity(1);
      setIsTransitioning(false);
    }, 50);
  };

  // Helper function to handle streaming AI responses
  const handleStreamingAIRequest = async (requestBody: any) => {
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
                    
                    // Use transition for smooth streaming updates
                    await transitionToNewContent(() => {
                      setLastAIMessage(partialMessage + '...');
                    });
                  }
                } else if (data.type === 'complete') {
                  // Final response with transition
                  await transitionToNewContent(() => {
                    if (data.data?.message) {
                      setLastAIMessage(data.data.message);
                    }
                  });
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

  const handleInputSubmit = async () => {
    if (!currentInput.trim() && !currentQuestion) return;

    // Track the interaction before processing
    const tracker = getBehaviorTracker();
    if (tracker && currentQuestion) {
      const questionId = isInMultiPart 
        ? multiPartQuestions[multiPartIndex]?.id 
        : currentQuestion.id;
      
      // Determine if user used suggestions or custom input
      const usedSuggestions = currentQuestion.options?.some((opt: any) => opt.value === currentInput) || false;
      const usedCustomInput = currentQuestion.allowCustom && !usedSuggestions;
      
      tracker.trackQuestionResponse({
        questionId: questionId || 'unknown',
        questionType: isInMultiPart 
          ? multiPartQuestions[multiPartIndex]?.inputType 
          : currentQuestion.inputType,
        userResponse: currentInput,
        responseStartTime,
        currentStep,
        totalSteps,
        workflowType: useIteratorTest ? 'iterator_test' : useMockData ? 'standard' : 'ai_mode',
        isMultiPart: isInMultiPart,
        usedSuggestions,
        usedCustomInput
      });
    }

    setIsLoading(true);

    try {
      if (isInMultiPart) {
        // Handle multi-part question flow
        const questionId = currentQuestion.id;
        const newMultiPartAnswers = { ...multiPartAnswers, [questionId]: currentInput };
        setMultiPartAnswers(newMultiPartAnswers);

        // Track conversation history for multi-part questions
        const conversationState = {
          step: currentStep,
          questionIndex: currentQuestionIndex,
          questionId,
          isMultiPart: true,
          multiPartIndex
        };
        
        // Only add to history if we're not editing (to avoid duplicates)
        if (!isEditingPrevious) {
          setConversationHistory(prev => [...prev, conversationState]);
        } else if (editingTarget === questionId) {
          // If we're editing this specific question, clear subsequent history
          setConversationHistory(prev => {
            const targetIndex = prev.findIndex(state => state.questionId === questionId);
            return targetIndex >= 0 ? prev.slice(0, targetIndex + 1) : prev;
          });
        }

        // Update tool data based on multi-part answer
        updateToolDataFromMultiPart(questionId, currentInput);

        if (multiPartIndex < multiPartQuestions.length - 1) {
          // Move to next multi-part question with transition
          await transitionToNewContent(() => {
            setMultiPartIndex(multiPartIndex + 1);
            setCurrentInput('');
            setLastAIMessage(`Question ${multiPartIndex + 2} of ${multiPartQuestions.length}: ${multiPartQuestions[multiPartIndex + 1].question}`);
          });
        } else {
          // Multi-part complete, return to main flow
          setIsInMultiPart(false);
          setMultiPartQuestions([]);
          setMultiPartIndex(0);
          
          // Store all multi-part answers as a single answer
          const mainQuestionId = 'multi-part-setup';
          const newAnswers = { ...collectedAnswers, [mainQuestionId]: JSON.stringify(newMultiPartAnswers) };
          setCollectedAnswers(newAnswers);
          
          // Continue with main workflow
          await processMockWorkflow(newAnswers);
          setMultiPartAnswers({});
        }
      } else if (currentQuestion) {
        // Handle regular question response
        const answerId = currentQuestion.id;
        
        // Track conversation history for regular questions
        const conversationState = {
          step: currentStep,
          questionIndex: currentQuestionIndex,
          questionId: answerId,
          isMultiPart: false
        };
        
        // Only add to history if we're not editing (to avoid duplicates)
        if (!isEditingPrevious) {
          setConversationHistory(prev => [...prev, conversationState]);
        } else if (editingTarget === answerId) {
          // If we're editing this specific question, clear subsequent history
          setConversationHistory(prev => {
            const targetIndex = prev.findIndex(state => state.questionId === answerId);
            return targetIndex >= 0 ? prev.slice(0, targetIndex + 1) : prev;
          });
        }
        
        // Regular single question
        const newAnswers = { ...collectedAnswers, [answerId]: currentInput };
        setCollectedAnswers(newAnswers);

        // Update tool data based on answer
        updateToolData(answerId, currentInput);

        // Move to next question or complete queue
        if (currentQuestionIndex < questionQueue.length - 1) {
          await transitionToNewContent(() => {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setCurrentInput('');
          });
        } else {
          // Queue complete, process with AI or move to next mock step
          if (useMockData) {
            await processMockWorkflow(newAnswers);
          } else {
            await processWithAI(newAnswers);
            // setQuestionQueue([]); // DISABLED: This was clearing AI-generated questions
            setCurrentQuestionIndex(0);
            setCurrentInput('');
          }
        }
      } else {
        // Handle free-form input
        if (useMockData) {
          await handleMockFreeformInput(currentInput);
        } else {
          await handleAIFreeformInput(currentInput);
        }
      }

      // Clear editing mode after successful submit
      if (isEditingPrevious) {
        // Start fade-out animation
        setEditingOverlayFadingOut(true);
        
        // Clear editing state after animation completes
        setTimeout(() => {
          setIsEditingPrevious(false);
          setEditingTarget(null);
          setEditingOverlayFadingOut(false);
        }, 500); // Match animation duration
      }

      // Input clearing is handled by each specific path above
    } catch (error) {
      console.error('Error handling input:', error);
      setLastAIMessage('Sorry, there was an error processing your input. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateToolData = (answerId: string, value: string) => {
    setToolData((prev: any) => {
      const updated = { ...prev };
      
      // Handle both mock workflow IDs and AI-generated IDs
      switch (answerId) {
        case 'tool-type':
          updated.type = value;
          break;
        case 'features-wanted':
        case 'test-feature-selection':
          updated.features = value.split(',');
          break;
        case 'color-scheme':
        case 'test-color-selection':
        case 'color-preference':
        case 'preferred-colors':
          updated.colorScheme = value;
          // Handle AI-generated colors by finding the actual color data
          if (currentQuestion && currentQuestion.options) {
            const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
            if (selectedOption && (selectedOption as any).colors) {
              updated.colorScheme = 'custom';
              updated.customColors = (selectedOption as any).colors;
              console.log('🎨 Applied AI-generated colors:', (selectedOption as any).colors);
            }
          }
          // If it's a custom color from color picker, find the custom color data
          if (value.startsWith('custom-')) {
            const customColor = customColors.find(c => c.value === value);
            if (customColor) {
              updated.colorScheme = 'custom';
              updated.customColors = customColor.colors;
            }
          }
          break;
        case 'confidence-level':
          updated.confidenceLevel = value;
          break;
        case 'business-description':
        case 'test-tool-description':
          updated.businessDescription = value;
          break;
        case 'calculator-title':
        case 'calculator-name':
        case 'test-tool-naming':
          updated.title = value;
          break;
        case 'final-customization':
          updated.customizations = value;
          break;
        case 'key-inputs':
          updated.inputs = value.split(',').map(s => s.trim()).filter(Boolean);
          break;
        case 'output-format':
          updated.outputFormat = value.split(',');
          break;
        default:
          // Smart detection for AI-generated questions
          const lowerAnswerId = answerId.toLowerCase();
          if (lowerAnswerId.includes('color') || lowerAnswerId.includes('palette') || lowerAnswerId.includes('scheme')) {
            updated.colorScheme = value;
            // Handle AI-generated colors by finding the actual color data
            if (currentQuestion && currentQuestion.options) {
              const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
              if (selectedOption && (selectedOption as any).colors) {
                updated.colorScheme = 'custom';
                updated.customColors = (selectedOption as any).colors;
                console.log('🎨 Applied AI-generated colors (smart detection):', (selectedOption as any).colors);
              }
            }
            // Handle custom colors
            if (value.startsWith('custom-')) {
              const customColor = customColors.find(c => c.value === value);
              if (customColor) {
                updated.colorScheme = 'custom';
                updated.customColors = customColor.colors;
              }
            }
          } else if (lowerAnswerId.includes('feature') || lowerAnswerId.includes('capability')) {
            updated.features = value.split(',');
          } else if (lowerAnswerId.includes('name') || lowerAnswerId.includes('title')) {
            updated.title = value;
          } else if (lowerAnswerId.includes('description') || lowerAnswerId.includes('business')) {
            updated.businessDescription = value;
          } else if (lowerAnswerId.includes('type') || lowerAnswerId.includes('category')) {
            updated.type = value;
          }
          break;
      }
      
      return updated;
    });
  };

  const updateToolDataFromMultiPart = (questionId: string, value: string) => {
    setToolData((prev: any) => {
      const updated = { ...prev };
      
      switch (questionId) {
        case 'target-audience':
          updated.targetAudience = value;
          break;
        case 'industry-focus':
          updated.industry = value;
          break;
        case 'calculator-name':
          updated.title = value;
          break;
        case 'key-metrics':
          updated.keyMetrics = value.split(',');
          break;
        case 'color-preference':
        case 'preferred-colors':
          updated.colorScheme = value;
          // Handle AI-generated colors by finding the actual color data
          if (multiPartQuestions[multiPartIndex] && multiPartQuestions[multiPartIndex].options) {
            const selectedOption = multiPartQuestions[multiPartIndex].options.find((opt: any) => opt.value === value);
            if (selectedOption && (selectedOption as any).colors) {
              updated.colorScheme = 'custom';
              updated.customColors = (selectedOption as any).colors;
              console.log('🎨 Applied AI-generated colors in iterator:', (selectedOption as any).colors);
            }
          }
          // If it's a custom color from color picker, find the custom color data
          if (value.startsWith('custom-')) {
            const customColor = customColors.find(c => c.value === value);
            if (customColor) {
              updated.colorScheme = 'custom';
              updated.customColors = customColor.colors;
            }
          }
          break;
        default:
          // Smart detection for AI-generated questions in iterator
          const lowerQuestionId = questionId.toLowerCase();
          if (lowerQuestionId.includes('color') || lowerQuestionId.includes('palette') || lowerQuestionId.includes('scheme')) {
            updated.colorScheme = value;
            // Handle AI-generated colors by finding the actual color data
            if (multiPartQuestions[multiPartIndex] && multiPartQuestions[multiPartIndex].options) {
              const selectedOption = multiPartQuestions[multiPartIndex].options.find((opt: any) => opt.value === value);
              if (selectedOption && (selectedOption as any).colors) {
                updated.colorScheme = 'custom';
                updated.customColors = (selectedOption as any).colors;
                console.log('🎨 Applied AI-generated colors (smart detection in iterator):', (selectedOption as any).colors);
              }
            }
            // Handle custom colors
            if (value.startsWith('custom-')) {
              const customColor = customColors.find(c => c.value === value);
              if (customColor) {
                updated.colorScheme = 'custom';
                updated.customColors = customColor.colors;
              }
            }
          } else if (lowerQuestionId.includes('feature') || lowerQuestionId.includes('capability')) {
            updated.features = value.split(',');
          } else if (lowerQuestionId.includes('name') || lowerQuestionId.includes('title')) {
            updated.title = value;
          } else if (lowerQuestionId.includes('description') || lowerQuestionId.includes('business')) {
            updated.businessDescription = value;
          } else if (lowerQuestionId.includes('type') || lowerQuestionId.includes('category')) {
            updated.type = value;
          } else if (lowerQuestionId.includes('audience') || lowerQuestionId.includes('target')) {
            updated.targetAudience = value;
          } else if (lowerQuestionId.includes('industry') || lowerQuestionId.includes('sector')) {
            updated.industry = value;
          } else if (lowerQuestionId.includes('metric') || lowerQuestionId.includes('output')) {
            updated.keyMetrics = value.split(',');
          }
          break;
      }
      
      return updated;
    });
  };

  const processMockWorkflow = async (answers: Record<string, string>) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (currentStep < currentWorkflow.length) {
      const nextQuestion = currentWorkflow[currentStep];
      
      // Check if this is a multiPart question and start it immediately
      if (nextQuestion.inputType === 'multiPart') {
        console.log('🔧 DEBUG: Auto-starting multi-part sequence');
        console.log('🔧 DEBUG: Questions:', nextQuestion.questions);
        await transitionToNewContent(() => {
          setIsInMultiPart(true);
          setMultiPartQuestions(nextQuestion.questions || []);
          setMultiPartIndex(0);
          setCurrentInput('');
          setLastAIMessage(`${nextQuestion.message}\n\nQuestion 1 of ${nextQuestion.questions?.length}: ${nextQuestion.questions?.[0]?.question}`);
        });
        
        // Track the multiPart question for editing functionality
        trackQuestion(nextQuestion);
      } else {
        await transitionToNewContent(() => {
          setQuestionQueue([nextQuestion]);
          setCurrentQuestionIndex(0);
          setLastAIMessage(nextQuestion.message);
          setCurrentInput('');
        });
        
        // Track the question for editing functionality
        trackQuestion(nextQuestion);
      }
      
      setCurrentStep(currentStep + 1);
    } else {
      setLastAIMessage("Perfect! Your calculator is taking shape. You can see the preview updating in real-time. Would you like to refine any aspect or add more features?");
      setCurrentStep(Math.min(currentStep + 1, totalSteps));
      setQuestionQueue([]);
      setCurrentQuestionIndex(0);
    }
  };

  const handleMockFreeformInput = async (input: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('color') || lowerInput.includes('style')) {
      await transitionToNewContent(() => {
        setLastAIMessage("Great question about styling! Let me show you some color options that would work well for your calculator.");
        setQuestionQueue([currentWorkflow.find(q => q.id === 'color-scheme')!]);
        setCurrentQuestionIndex(0);
      });
    } else if (lowerInput.includes('input') || lowerInput.includes('field')) {
      await transitionToNewContent(() => {
        setLastAIMessage("Perfect! Let's define what inputs your users will provide to get their calculations.");
        setQuestionQueue([currentWorkflow.find(q => q.id === 'key-inputs')!]);
        setCurrentQuestionIndex(0);
      });
    } else {
      setLastAIMessage("I understand! The calculator is looking great. You can continue customizing it, or ask me about specific features you'd like to add or modify.");
    }
  };

  const processWithAI = async (answers: Record<string, string>) => {
    try {
      // Use transition for AI message update
      await transitionToNewContent(() => {
        setLastAIMessage("Analyzing your responses and generating personalized suggestions...");
      });
      
      // Extract key information from answers
      const expertise = answers['business-description'] || answers['welcome-iterator'] || 'business tools';
      const toolType = answers['tool-type'] || 'calculator';
      const targetAudience = answers['target-audience'] || answers['role-title'] || 'business professionals';
      const industry = answers['industry-focus'] || 'general business';
      
      // Build user input message and update message history
      const userMessage = `Based on my responses: ${expertise}. I'm creating a ${toolType} for ${targetAudience} in ${industry}.`;
      const updatedMessageHistory = [...aiMessageHistory, {
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date(),
        type: 'user_input'
      }];
      
      // Track user message in state
      setAiMessageHistory(updatedMessageHistory);
      
      console.log('🔧 processWithAI: AI message count so far:', updatedMessageHistory.filter(msg => msg.role === 'assistant').length);
      
      // Call the test UI API with streaming support
      const result = await handleStreamingAIRequest({
        userInput: userMessage,
        conversationHistory: updatedMessageHistory, // Use proper AI message history
        collectedAnswers: answers,
        currentStep,
        productToolDefinition: productToolDefinition || null // Include current tool for style updates
      });

      if (result.success && result.response) {
        console.log('🔧 AI API response received:', result.response);
        
        // Track AI response
        setAiMessageHistory(prev => [...prev, {
          role: 'assistant',
          content: result.response.message,
          timestamp: new Date(),
          type: 'ai_response'
        }]);
        
        // NEW: Check for style update request
        if (result.response.shouldUpdateStyle && result.response.styleUpdateContext) {
          console.log('🎨 AI requested style update in processWithAI. Context:', result.response.styleUpdateContext);
          await handleStyleUpdate(
            result.response.styleUpdateContext.toolDefinitionId,
            result.response.styleUpdateContext.dataStyleId,
            result.response.styleUpdateContext.newTailwindClasses
          );
          setCurrentInput(''); // Clear user input after processing style update
          return; // Stop further processing
        }
        
        // Check if AI wants to create a tool - use enhanced brainstorming workflow
        if (result.response.toolCreationContext) {
          console.log('🔧 AI requested tool creation, using enhanced brainstorming workflow');
          const toolResult = await createToolWithBrainstorming(result.response.toolCreationContext);
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
      
      // Use transition for error message
      await transitionToNewContent(() => {
        setLastAIMessage(`AI processing encountered an issue: ${error instanceof Error ? error.message : 'Unknown error'}. Let me help you manually.`);
      });
      
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

  const handleAIFreeformInput = async (input: string) => {
    try {
      console.log('🔧 handleAIFreeformInput called with input:', input);
      
      // Use transition for AI thinking message
      await transitionToNewContent(() => {
        setLastAIMessage("Thinking about your question...");
      });
      
      // Build updated message history including this new user message
      const updatedMessageHistory = [...aiMessageHistory, {
        role: 'user' as const,
        content: input,
        timestamp: new Date(),
        type: 'user_input'
      }];
      
      // Track user message in state
      setAiMessageHistory(updatedMessageHistory);
      
      // Call the test UI API with current context INCLUDING productToolDefinition
      const requestBody = {
        userInput: input,
        conversationHistory: updatedMessageHistory, // Use the immediately updated history
        collectedAnswers,
        currentStep,
        productToolDefinition: productToolDefinition || null // Include current tool for style updates
      };
      
      console.log('🔧 Sending request to API:', requestBody);
      console.log('🔧 AI message count so far:', updatedMessageHistory.filter(msg => msg.role === 'assistant').length);
      console.log('🔧 Current productToolDefinition ID:', productToolDefinition?.id || 'none');
      
      // Use streaming request for real-time feedback
      const result = await handleStreamingAIRequest(requestBody);

      if (result.success && result.response) {
        // Track AI response
        setAiMessageHistory(prev => [...prev, {
          role: 'assistant',
          content: result.response.message,
          timestamp: new Date(),
          type: 'ai_response'
        }]);
        
        // Debug: Log the full AI response to understand its format
        console.log('🔍 Full AI response object:', result.response);
        console.log('🔍 shouldUpdateStyle value:', result.response.shouldUpdateStyle);
        console.log('🔍 styleUpdateContext value:', result.response.styleUpdateContext);
        
        // Check if AI wants to update styles first
        if (result.response.shouldUpdateStyle && result.response.styleUpdateContext) {
          console.log('🎨 AI requested style update in handleAIFreeformInput. Context:', result.response.styleUpdateContext);
          await handleStyleUpdate(
            result.response.styleUpdateContext.toolDefinitionId,
            result.response.styleUpdateContext.dataStyleId,
            result.response.styleUpdateContext.newTailwindClasses
          );
          return; // Exit early since style update handles its own flow
        }
        
        // Check if AI wants to create a tool - use enhanced brainstorming workflow
        if (result.response.toolCreationContext) {
          console.log('🔧 AI requested tool creation, using enhanced brainstorming workflow');
          const toolResult = await createToolWithBrainstorming(result.response.toolCreationContext);
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
      
      // Use transition for error message
      await transitionToNewContent(() => {
        setLastAIMessage(`I encountered an issue: ${error instanceof Error ? error.message : 'Unknown error'}. Let me help you continue building your tool.`);
      });
      
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

  const handleColorPickerSubmit = (primaryColor: string, secondaryColor: string) => {
    // Generate custom color entry
    const customColorNumber = customColors.length + 1;
    const customColorEntry = {
      value: `custom-${customColorNumber}`,
      label: `Custom${customColorNumber}`,
      colors: [primaryColor, secondaryColor]
    };
    
    // Add to custom colors array
    setCustomColors(prev => [...prev, customColorEntry]);
    
    // Update tool data with custom colors
    setToolData((prev: any) => ({
      ...prev,
      colorScheme: 'custom',
      customColors: [primaryColor, secondaryColor]
    }));
    
    // Set the current input value but don't advance the workflow
    setCurrentInput(customColorEntry.value);
    
    // Don't call processMockWorkflow here - let the user click "Choose" to advance
  };

  const resetWorkflow = () => {
    setCurrentStep(1);
    setQuestionQueue([currentWorkflow[0]]);
    setCurrentQuestionIndex(0);
    setCurrentInput('');
    setCollectedAnswers({});
    setCustomColors([]);
    setConversationHistory([]);
    setAiMessageHistory([]); // Reset AI message history
    setIsEditingPrevious(false);
    setEditingTarget(null);
    setEditingOverlayFadingOut(false);
    setQuestionHistory([currentWorkflow[0]]); // Reset and start with first question
    
    // Set appropriate welcome message based on workflow
    if (useIteratorTest) {
      setLastAIMessage("Welcome to the Multi-Question Iterator Test! This will help us test the iterator component with various question sequences.");
    } else {
      setLastAIMessage("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
    }
    
    setToolData({
      title: 'Business Calculator',
      description: 'Calculate your business metrics',
      colorScheme: 'professional-blue',
      inputs: [],
      outputFormat: ['percentage']
    });
  };

  const handleAnswerUpdate = (questionId: string, newValue: string) => {
    // Track edit behavior
    const tracker = getBehaviorTracker();
    if (tracker) {
      tracker.trackEdit(questionId, newValue);
    }

    // Find the original question from either AI history or mock workflow
    let originalQuestion = questionHistory.find(q => q.id === questionId);
    if (!originalQuestion) {
      // Fallback to mock workflow if not found in AI history
      originalQuestion = currentWorkflow.find(q => q.id === questionId);
    }
    
    if (!originalQuestion) {
      console.error(`Could not find original question for ${questionId}`);
      return;
    }
    
    // Set editing mode and show overlay
    setIsEditingPrevious(true);
    setEditingTarget(questionId);
    setEditingOverlayFadingOut(false);
    
    // Restore the original question state
    setQuestionQueue([originalQuestion]);
    setCurrentQuestionIndex(0);
    
    // Set the current input to the existing value for editing
    setCurrentInput(newValue);
    
    // Update the answer and tool data (keep existing data)
    setCollectedAnswers(prev => ({
      ...prev,
      [questionId]: newValue
    }));
    updateToolData(questionId, newValue);
    
    // Show feedback message
    setLastAIMessage(`Editing your answer for "${questionId.replace(/-/g, ' ')}". Make your changes below and submit to continue.`);
  };

  // Helper function to switch to chat mode
  const handleSwitchToChat = () => {
    // Track workflow choice
    const tracker = getBehaviorTracker();
    if (tracker) {
      tracker.trackChatMode();
    }

    // Clear current input and question queue to enable freeform chat
    setCurrentInput('');
    setQuestionQueue([]);
    setCurrentQuestionIndex(0);
    
    // Update AI message to indicate chat mode
    setLastAIMessage("Great! I'm here to chat. Ask me anything about your tool, or tell me what you'd like to work on next.");
    
    // Exit multi-part mode if active
    if (isInMultiPart) {
      setIsInMultiPart(false);
      setMultiPartQuestions([]);
      setMultiPartIndex(0);
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  // Helper function to track questions for editing
  const trackQuestion = (question: any) => {
    setQuestionHistory(prev => {
      // Avoid duplicates
      const exists = prev.find(q => q.id === question.id);
      if (exists) return prev;
      return [...prev, question];
    });
  };

  // TODO: For AI Integration - call this when LLM generates new questions
  const handleAIGeneratedQuestion = (aiQuestion: {
    id: string;
    message: string;
    inputType: string;
    options?: Array<{ value: string; label: string; colors?: string[]; }>;
    placeholder?: string;
    allowCustom?: boolean;
    maxSelections?: number;
    suggestions?: string[];
    acceptedFileTypes?: string[];
    maxFileSize?: string;
    questions?: any[];
  }) => {
    console.log('🔧 handleAIGeneratedQuestion called with:', aiQuestion);
    
    // Track AI question for editing functionality
    trackQuestion(aiQuestion);
    
    // Check if this is a multiPart question
    if (aiQuestion.inputType === 'multiPart' && aiQuestion.questions && aiQuestion.questions.length > 0) {
      console.log('🔧 Setting up multiPart question with', aiQuestion.questions.length, 'questions');
      // Set up multi-part state with transition
      transitionToNewContent(() => {
        setIsInMultiPart(true);
        setMultiPartQuestions(aiQuestion.questions!);
        setMultiPartIndex(0);
        setCurrentInput('');
        setLastAIMessage(`${aiQuestion.message}\n\nQuestion 1 of ${aiQuestion.questions!.length}: ${aiQuestion.questions![0].question}`);
      });
    } else {
      console.log('🔧 Setting up regular question:', aiQuestion.inputType);
      // Regular single question with transition
      console.log('🔧 About to set questionQueue with:', aiQuestion);
      transitionToNewContent(() => {
        setQuestionQueue([aiQuestion]);
        setCurrentQuestionIndex(0);
        setLastAIMessage(aiQuestion.message);
        setCurrentInput('');
      });
      console.log('🔧 After setting questionQueue with transition');
    }
  };

  // Initialize behavior tracker with user ID (in real app, get from Clerk)
  useEffect(() => {
    const userId = 'demo_user_' + Math.random().toString(36).substr(2, 9); // Mock user ID
    const tracker = initBehaviorTracker(userId);
    setBehaviorTracker(tracker);
    
    // Get adaptive suggestions and apply them
    const suggestions = tracker.getAdaptiveSuggestions();
    console.log('🧠 Adaptive suggestions loaded:', suggestions);
    
    // In a real implementation, you'd use these suggestions to:
    // - Adjust the workflow based on preferQuickMode
    // - Show/hide advanced options based on showAdvancedOptions
    // - Customize question types based on suggestedQuestionTypes
    // - Adjust complexity based on recommendedComplexity
    
  }, []);

  // Initialize localStorage data
  useEffect(() => {
    // setSavedLogicResults(getSavedLogicResults()); // REMOVED localStorage call
    // setSavedTools(getSavedTools()); // REMOVED localStorage call

    // Data is now loaded in the previous useEffect block from IndexedDB
  }, []);

  // Track when a question becomes active (user starts responding)
  useEffect(() => {
    if (currentQuestion || isInMultiPart) {
      setResponseStartTime(Date.now());
    }
  }, [currentQuestion, isInMultiPart, multiPartIndex]);

  // NEW: Enhanced Tool Creation Functions for Logic Architect Integration
  const callToolCreationAgent = async (context: any, existingToolDefinition?: ProductToolDefinition) => {
    console.log('📞 Calling Tool Creation Agent with context:', context);
    
    // Use transition for initial message
    await transitionToNewContent(() => {
      setLastAIMessage('Connecting to the Tool Creation Agent... Please wait a moment.');
    });
    
    setIsGeneratingTool(true);
    setProductToolDefinition(null); // Clear previous tool during generation

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
      
      setProductToolDefinition(newToolDefinition);
      
      // Use transition for success message
      await transitionToNewContent(() => {
        setLastAIMessage('✨ Your new tool has been generated! You can see it in the canvas.');
      });
      
      setToolData({
        title: newToolDefinition.metadata.title,
        description: newToolDefinition.metadata.description,
        colorScheme: typeof newToolDefinition.colorScheme === 'string' 
          ? newToolDefinition.colorScheme 
          : (newToolDefinition.colorScheme?.primary || 'professional-blue'),
        customColors: typeof newToolDefinition.colorScheme !== 'string' 
          ? [newToolDefinition.colorScheme?.primary, newToolDefinition.colorScheme?.secondary].filter(Boolean) as string[] 
          : undefined,
        features: newToolDefinition.metadata.features || [],
      });

      await saveLastActiveToolToDB(newToolDefinition);
      await saveToolToDBList(newToolDefinition); // Add to the list of all tools

      // Refresh the list of all tools
      const allToolsFromDB = await loadAllToolsFromDB();
      setSavedToolsFromDB(allToolsFromDB);

      // Save to local storage (legacy, if still used for anything, otherwise remove)
      // saveCreatedTool(newToolDefinition); // This was the old localStorage SavedTool[]
      
      // Update behavior tracker
      const tracker = getBehaviorTracker();
      tracker?.trackToolGeneration({
        toolDefinitionId: newToolDefinition.id,
        toolName: newToolDefinition.metadata.title,
        toolType: newToolDefinition.metadata.type,
        context: context, 
        success: true
      });

    } catch (error) {
      console.error('❌ Tool Creation Agent error:', error);
      
      // Use transition for error message
      await transitionToNewContent(() => {
        setLastAIMessage(error instanceof Error ? error.message : 'An unknown error occurred during tool creation.');
      });
      
      setIsGeneratingTool(false);
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
    } finally {
      setIsGeneratingTool(false);
    }
  };

  // NEW FUNCTION: Handle style updates for the current tool (LOCAL UPDATE)
  const handleStyleUpdate = async (toolDefinitionId: string, dataStyleId: string, newTailwindClasses: string) => {
    if (!productToolDefinition || productToolDefinition.id !== toolDefinitionId) {
      // Use transition for error message
      await transitionToNewContent(() => {
        setLastAIMessage("Style update requested for a different tool than the one loaded. Please load the correct tool.");
      });
      console.warn("Style update requested for tool ID", toolDefinitionId, "but current tool is", productToolDefinition?.id);
      return;
    }

    console.log(`🖌️ Updating style locally for tool: ${toolDefinitionId}, element: ${dataStyleId}, classes: ${newTailwindClasses}`);
    
    // Use transition for loading message
    await transitionToNewContent(() => {
      setLastAIMessage('🎨 Updating tool style...');
    });

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

      // Update local state
      setProductToolDefinition(updatedToolDefinition);
      
      // Persist to IndexedDB
      await saveLastActiveToolToDB(updatedToolDefinition);
      await saveToolToDBList(updatedToolDefinition);
      
      console.log(`🎨 Style updated successfully for element '${dataStyleId}' with classes: ${newTailwindClasses}`);
      console.log('🎨 Updated currentStyleMap:', updatedToolDefinition.currentStyleMap);
      
      // Use transition for success message
      await transitionToNewContent(() => {
        setLastAIMessage(`✅ Style updated! Changed ${dataStyleId} to use: ${newTailwindClasses}`);
      });

    } catch (error) {
      console.error('❌ Error updating tool style locally:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      
      // Use transition for error message
      await transitionToNewContent(() => {
        setLastAIMessage(`❌ Failed to update style: ${errorMessage}`);
      });
    }
  };

  const createToolWithBrainstorming = async (context: any) => {
    console.log('🚀 Starting tool creation with brainstorming session...');
    
    // Use transition for initial message
    await transitionToNewContent(() => {
      setLastAIMessage('🧠 Engaging Logic Architect for brainstorming... This may take a moment.');
    });
    
    setIsBrainstorming(true);
    setShowBrainstormingPanel(true);
    setBrainstormingThoughts([]);
    setLatestBrainstormingResult(null);
    setProductToolDefinition(null); // Clear previous tool

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); // FIXED: was '\\n', now correct '\n'
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              console.log('🔧 Brainstorming stream chunk:', json); // Debug log
              setBrainstormingThoughts(prev => [...prev, { ...json, timestamp: Date.now() }]);
              
              if (json.type === 'complete' && json.data?.toolCreationContext) {
                console.log('🔧 Brainstorming complete with toolCreationContext:', json.data.toolCreationContext);
                setLatestBrainstormingResult(json.data.toolCreationContext);
                
                // Save logic result to database
                const logicResult: SavedLogicResult = {
                  id: `logic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  timestamp: Date.now(),
                  date: new Date().toLocaleDateString(),
                  toolType: context.toolType || 'custom-tool',
                  targetAudience: context.targetAudience || 'business users',
                  industry: context.industry,
                  result: json.data.toolCreationContext
                };
                await saveLogicResultToDB(logicResult);
                
                // Refresh logic results list
                const logicResultsFromDB = await loadLogicResultsFromDB();
                setSavedLogicResults(logicResultsFromDB);
                
                // Use transition for completion message
                await transitionToNewContent(() => {
                  setLastAIMessage('✅ Brainstorming complete! Proceeding to tool generation...');
                });
                
                // Call tool creation agent with the brainstormed context
                console.log('🔧 About to call callToolCreationAgent with context:', json.data.toolCreationContext);
                await callToolCreationAgent(json.data.toolCreationContext); 
                console.log('🔧 callToolCreationAgent completed successfully');
                // No need to save to IndexedDB here, callToolCreationAgent will handle it
              } else if (json.type === 'complete' && json.data) {
                console.log('🔧 Brainstorming complete with generic data:', json.data);
                // Handle case where brainstorming result is in different format
                setLatestBrainstormingResult(json.data);
                
                // Save logic result to database (generic format)
                const logicResult: SavedLogicResult = {
                  id: `logic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  timestamp: Date.now(),
                  date: new Date().toLocaleDateString(),
                  toolType: context.toolType || json.data.toolType || 'custom-tool',
                  targetAudience: context.targetAudience || json.data.targetAudience || 'business users',
                  industry: context.industry || json.data.industry,
                  result: json.data
                };
                await saveLogicResultToDB(logicResult);
                
                // Refresh logic results list
                const logicResultsFromDB = await loadLogicResultsFromDB();
                setSavedLogicResults(logicResultsFromDB);
                
                // Use transition for completion message
                await transitionToNewContent(() => {
                  setLastAIMessage('✅ Brainstorming complete! Proceeding to tool generation...');
                });
                
                console.log('🔧 About to call callToolCreationAgent with generic data:', json.data);
                await callToolCreationAgent(json.data);
                console.log('🔧 callToolCreationAgent completed successfully (generic path)');
              } else if (json.type === 'error') {
                console.error('🔧 Brainstorming error:', json.message);
                // Use transition for error message
                await transitionToNewContent(() => {
                  setLastAIMessage(`⚠️ Brainstorming error: ${json.message}`);
                });
              } else if (json.type === 'partial' && json.data?.thought) {
                console.log('🔧 Brainstorming partial thought:', json.data.thought);
                // Use transition for thinking updates
                await transitionToNewContent(() => {
                  setLastAIMessage(`🧠 Thinking: ${json.data.thought}`);
                });
              }
            } catch (e) {
              console.warn('Failed to parse brainstorming stream chunk:', line, e);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Brainstorming or subsequent tool creation error:', error);
      
      // Use transition for error message
      await transitionToNewContent(() => {
        setLastAIMessage(error instanceof Error ? error.message : 'An error occurred during the brainstorming and tool creation process.');
      });
      
      setBrainstormingThoughts(prev => [...prev, { type: 'error', message: (error as Error).message, data: {}, timestamp: Date.now() }]);
    } finally {
      setIsBrainstorming(false);
      // setShowBrainstormingPanel(false); // Keep panel open to show results/errors
    }
  };

  // Canvas Component that shows the generated tool or placeholder
  const CanvasTool = ({ isDarkMode, className = '', productToolDefinition, isGenerating, generatingMessage }: any) => {
    if (isGenerating && generatingMessage) {
      return (
        <div className={`relative p-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${className}`}>
          {/* Show current tool blurred in background */}
          {productToolDefinition && productToolDefinition.componentCode && (
            <div className="filter blur-sm opacity-50 pointer-events-none">
              <DynamicComponentRenderer
                componentCode={productToolDefinition.componentCode}
                metadata={{
                  title: productToolDefinition.metadata.title,
                  description: productToolDefinition.metadata.description,
                  slug: productToolDefinition.slug
                }}
                currentStyleMap={productToolDefinition.currentStyleMap}
                onError={(error) => console.error('Canvas render error:', error)}
              />
            </div>
          )}
          
          {/* Loading overlay */}
          <div className="absolute inset-6 flex items-center justify-center bg-black/10 backdrop-blur-sm rounded-lg">
            <div className={`border-2 border-dashed rounded-lg p-8 text-center backdrop-blur-md bg-white/90 dark:bg-gray-800/90 ${
              isDarkMode ? 'border-gray-600' : 'border-gray-300'
            }`}>
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
              <h3 className="text-lg font-medium mb-2">Creating Your Tool</h3>
              <p className="text-sm opacity-70">
                {generatingMessage}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (productToolDefinition && productToolDefinition.componentCode) {
      return (
        <div className={`p-6 ${className}`}>
          <DynamicComponentRenderer
            componentCode={productToolDefinition.componentCode}
            metadata={{
              title: productToolDefinition.metadata.title,
              description: productToolDefinition.metadata.description,
              slug: productToolDefinition.slug
            }}
            currentStyleMap={productToolDefinition.currentStyleMap}
            onError={(error) => console.error('Canvas render error:', error)}
          />
        </div>
      );
    }

    // Default placeholder when no tool is generated yet
    return (
      <div className={`p-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${className}`}>
        <div className={`border-2 border-dashed rounded-lg p-8 text-center ${
          isDarkMode ? 'border-gray-600' : 'border-gray-300'
        }`}>
          <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Canvas Ready</h3>
          <p className="text-sm opacity-70">
            Your generated tool will appear here. Use the options menu to test tool creation!
          </p>
        </div>
      </div>
    );
  };

  // Tool Info Bubble Component
  const ToolInfoBubble = ({ productToolDefinition, isDarkMode }: { 
    productToolDefinition: ProductToolDefinition | null, 
    isDarkMode: boolean 
  }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Add additional safety checks
    if (!productToolDefinition || !productToolDefinition.metadata) return null;

    return (
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
        {/* Hover trigger */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
            isDarkMode 
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-gray-100 border-gray-600' 
              : 'bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 border-gray-300'
          } border-2 shadow-lg hover:shadow-xl`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Type className="h-4 w-4" />
        </div>

        {/* Info bubble */}
        {isHovered && (
          <div
            className={`absolute left-12 top-1/2 transform -translate-y-1/2 w-80 p-4 rounded-lg shadow-xl border-2 z-30 animate-in fade-in slide-in-from-left-2 duration-200 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600 text-gray-100' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Arrow pointing to trigger */}
            <div 
              className={`absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-2 w-0 h-0 ${
                isDarkMode 
                  ? 'border-r-gray-600' 
                  : 'border-r-gray-300'
              }`}
              style={{
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: '8px solid',
                borderRightColor: isDarkMode ? '#4B5563' : '#D1D5DB'
              }}
            />
            
            <div className="space-y-3">
              {/* Tool Title */}
              <div className="space-y-1">
                <h3 className="text-lg font-semibold leading-tight">
                  {productToolDefinition.metadata?.title || 'Untitled Tool'}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      isDarkMode ? 'border-gray-500 text-gray-300' : 'border-gray-400 text-gray-600'
                    }`}
                  >
                    {productToolDefinition.metadata?.type || 'Tool'}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      isDarkMode ? 'border-gray-500 text-gray-300' : 'border-gray-400 text-gray-600'
                    }`}
                  >
                    {productToolDefinition.metadata?.category || 'General'}
                  </Badge>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <p className={`text-sm leading-relaxed ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {productToolDefinition.metadata?.description || 'No description available'}
                </p>
                
                {productToolDefinition.metadata?.shortDescription && 
                 productToolDefinition.metadata?.shortDescription !== productToolDefinition.metadata?.description && (
                  <p className={`text-xs ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {productToolDefinition.metadata.shortDescription}
                  </p>
                )}
              </div>

              {/* Additional metadata */}
              <div className={`space-y-2 pt-2 border-t ${
                isDarkMode ? 'border-gray-600' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                    Target Audience:
                  </span>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                    {productToolDefinition.metadata?.targetAudience || 'General'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                    Industry:
                  </span>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                    {productToolDefinition.metadata?.industry || 'General'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                    Difficulty:
                  </span>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                    {productToolDefinition.metadata?.difficultyLevel || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                    Est. Time:
                  </span>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                    {productToolDefinition.metadata?.estimatedCompletionTime || 'N/A'} min
                  </span>
                </div>
              </div>

              {/* Features tags */}
              {productToolDefinition.metadata?.features && productToolDefinition.metadata.features.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-medium ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Features:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {productToolDefinition.metadata.features.slice(0, 6).map((feature, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className={`text-xs px-2 py-0.5 ${
                          isDarkMode 
                            ? 'bg-gray-700 text-gray-300 border-gray-600' 
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                        }`}
                      >
                        {feature}
                      </Badge>
                    ))}
                    {productToolDefinition.metadata.features.length > 6 && (
                      <Badge 
                        variant="secondary" 
                        className={`text-xs px-2 py-0.5 ${
                          isDarkMode 
                            ? 'bg-gray-700 text-gray-300 border-gray-600' 
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                        }`}
                      >
                        +{productToolDefinition.metadata.features.length - 6}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`h-screen flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Progress Header */}
      <div className={`border-b px-6 py-3 flex-shrink-0 ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-blue-600" />
            <span className={`font-medium ${isDarkMode ? 'text-gray-50' : 'text-gray-900'}`}>
              Tool Creator
            </span>
            <Badge variant="outline" className={`text-xs ${
              isDarkMode ? 'border-gray-600 text-gray-300' : ''
            }`}>
              {useMockData ? 'Mock Mode' : 'AI Mode'} • {useIteratorTest ? 'Iterator Test' : 'Standard'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className={`text-xs border-2 rounded-lg ${
                  isDarkMode 
                    ? 'border-gray-600 bg-gray-700 text-gray-50 hover:bg-gray-600 shadow-sm' 
                    : 'border-gray-400 bg-gray-100 text-gray-800 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                <Settings className="h-3 w-3 mr-1" />
                Options
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              
              {showOptionsMenu && (
                <OptionsMenu 
                  isDarkMode={isDarkMode} 
                  onClose={() => setShowOptionsMenu(false)}
                  useMockData={useMockData}
                  useIteratorTest={useIteratorTest}
                  historyPanelSide={historyPanelSide}
                  savedLogicResults={savedLogicResults}
                  savedTools={savedToolsFromDB} // FIXED: Pass actual saved tools from DB
                  selectedModel={selectedModel}
                  availableModels={availableModels}
                  onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                  onToggleMockData={() => setUseMockData(!useMockData)}
                  onToggleIteratorTest={() => {
                        setUseIteratorTest(!useIteratorTest);
                        resetWorkflow();
                  }}
                  onToggleHistoryPanel={() => setHistoryPanelSide(historyPanelSide === 'left' ? 'right' : 'left')}
                  onResetWorkflow={resetWorkflow}
                  onShowLogicSelect={() => setShowLogicSelect(true)}
                  onShowToolsSelect={() => setShowToolsSelect(true)} // FIXED: Actually show the tools panel
                  onTestBrainstorming={async () => {
                    try {
                      const testContext = {
                        userIntent: 'Create a marketing ROI calculator',
                        toolType: 'calculator',
                        targetAudience: 'small business owners',
                        industry: 'marketing',
                        businessDescription: 'Help businesses track their marketing investment returns'
                      };
                      await createToolWithBrainstorming(testContext);
                    } catch (error) {
                      console.error('Test brainstorming failed:', error);
                    }
                  }}
                  onTestToolCreation={async () => {
                    try {
                      // Use transition for start message
                      await transitionToNewContent(() => {
                        setLastAIMessage('🎲 Randomly selecting a tool type for testing...');
                      });
                      
                      // 🎲 10 Creative Calculator Types for Random Testing
                      const calculatorTypes = [
                        {
                          userIntent: 'Create a carbon footprint calculator for eco-conscious businesses',
                          toolType: 'environmental-calculator',
                          targetAudience: 'sustainability managers',
                          industry: 'environmental consulting',
                          features: ['emissions tracking', 'offset recommendations', 'reporting'],
                          businessDescription: 'Calculate and reduce your organization\'s carbon footprint with actionable insights'
                        },
                        {
                          userIntent: 'Build a wedding budget calculator with vendor comparisons',
                          toolType: 'budget-calculator',
                          targetAudience: 'engaged couples',
                          industry: 'wedding planning',
                          features: ['vendor tracking', 'payment scheduling', 'guest count impact'],
                          businessDescription: 'Plan your dream wedding while staying within budget with smart vendor recommendations'
                        },
                        {
                          userIntent: 'Design a freelancer rate calculator with market analysis',
                          toolType: 'pricing-calculator',
                          targetAudience: 'freelancers and consultants',
                          industry: 'professional services',
                          features: ['market rates', 'experience weighting', 'project complexity'],
                          businessDescription: 'Determine competitive freelance rates based on skills, experience, and market demand'
                        },
                        {
                          userIntent: 'Create a solar panel savings calculator for homeowners',
                          toolType: 'savings-calculator',
                          targetAudience: 'homeowners',
                          industry: 'renewable energy',
                          features: ['energy savings', 'tax incentives', 'payback period'],
                          businessDescription: 'Calculate potential savings from solar panel installation with incentive analysis'
                        },
                        {
                          userIntent: 'Build a restaurant profitability calculator with menu optimization',
                          toolType: 'profit-calculator',
                          targetAudience: 'restaurant owners',
                          industry: 'food service',
                          features: ['ingredient costs', 'labor analysis', 'menu pricing'],
                          businessDescription: 'Optimize menu pricing and track restaurant profitability with cost analysis'
                        },
                        {
                          userIntent: 'Design a crypto portfolio diversification calculator',
                          toolType: 'investment-calculator',
                          targetAudience: 'cryptocurrency investors',
                          industry: 'financial services',
                          features: ['risk assessment', 'allocation recommendations', 'rebalancing alerts'],
                          businessDescription: 'Build a balanced crypto portfolio with risk-adjusted diversification strategies'
                        },
                        {
                          userIntent: 'Create a pet care cost calculator for new pet owners',
                          toolType: 'cost-calculator',
                          targetAudience: 'prospective pet owners',
                          industry: 'pet care',
                          features: ['lifetime costs', 'breed comparisons', 'healthcare planning'],
                          businessDescription: 'Understand the true cost of pet ownership with comprehensive care planning'
                        },
                        {
                          userIntent: 'Build a productivity score calculator for remote teams',
                          toolType: 'assessment-calculator',
                          targetAudience: 'remote team managers',
                          industry: 'human resources',
                          features: ['team metrics', 'improvement suggestions', 'benchmark comparisons'],
                          businessDescription: 'Measure and improve remote team productivity with data-driven insights'
                        },
                        {
                          userIntent: 'Design a real estate investment analyzer with market trends',
                          toolType: 'investment-analyzer',
                          targetAudience: 'real estate investors',
                          industry: 'real estate',
                          features: ['cash flow analysis', 'market comparisons', 'financing options'],
                          businessDescription: 'Analyze real estate investment opportunities with comprehensive market data'
                        },
                        {
                          userIntent: 'Create a fitness goal calculator with personalized workout plans',
                          toolType: 'fitness-calculator',
                          targetAudience: 'fitness enthusiasts',
                          industry: 'health and wellness',
                          features: ['goal tracking', 'calorie calculations', 'progress milestones'],
                          businessDescription: 'Set and achieve fitness goals with personalized workout and nutrition planning'
                        }
                      ];

                      // 🎯 Randomly select one calculator type
                      const randomIndex = Math.floor(Math.random() * calculatorTypes.length);
                      const selectedCalculator = calculatorTypes[randomIndex];
                      
                      console.log(`🎲 Testing with random calculator: ${selectedCalculator.toolType} (${randomIndex + 1}/10)`);
                      
                      // Use transition for selection message
                      await transitionToNewContent(() => {
                        setLastAIMessage(`🎯 Selected: ${selectedCalculator.toolType.replace(/-/g, ' ')} for ${selectedCalculator.targetAudience}. Creating tool...`);
                      });
                      
                      await callToolCreationAgent(selectedCalculator);
                    } catch (error) {
                      console.error('Test tool creation failed:', error);
                      
                      // Use transition for error message
                      await transitionToNewContent(() => {
                        setLastAIMessage(`❌ Test tool creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      });
                    }
                  }}
                  onTestMultiPart={async () => {
                        if (!useMockData) {
                          setCurrentInput('send a test multi-input');
                          await handleAIFreeformInput('send a test multi-input');
                        } else {
                          setLastAIMessage('Switch to AI Mode to test API commands!');
                        }
                      }}
                  onTestFileUpload={async () => {
                        if (!useMockData) {
                          setCurrentInput('send a test image-upload');
                          await handleAIFreeformInput('send a test image-upload');
                        } else {
                          setLastAIMessage('Switch to AI Mode to test API commands!');
                        }
                      }}
                  onTestColorPicker={async () => {
                        if (!useMockData) {
                          setCurrentInput('send a test color-picker');
                          await handleAIFreeformInput('send a test color-picker');
                        } else {
                          setLastAIMessage('Switch to AI Mode to test API commands!');
                        }
                      }}
                  onTestComponentValidation={() => {
                    import('@/lib/prompts/tool-creation-prompt').then(module => {
                      console.log('🧪 Running component validation tests...');
                      const results = module.runComponentValidationTests();
                      if (results.failed === 0) {
                        setLastAIMessage(`✅ All component validation tests passed! (${results.passed} tests)`);
                      } else {
                        setLastAIMessage(`⚠️ Component validation tests failed: ${results.failed} failures out of ${results.passed + results.failed} tests. Check console for details.`);
                      }
                    });
                  }}
                  onModelChange={(model) => setSelectedModel(model)}
                />
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Progress value={progressPercentage} className="flex-1 h-2" />
          <span className={`text-xs font-medium min-w-fit ${
            isDarkMode ? 'text-gray-50' : 'text-gray-500'
          }`}>
            Step {currentStep}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Main Content - Canvas with Fixed Bottom */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* History Panel Tab */}
        {!showHistoryPanel && (
          <button
            onClick={() => setShowHistoryPanel(true)}
            className={`
              absolute top-1/2 transform -translate-y-1/2 z-30
              ${historyPanelSide === 'left' ? 'left-0' : 'right-0'}
              ${isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              }
              border shadow-lg transition-all duration-200 hover:shadow-xl
              ${historyPanelSide === 'left' 
                ? 'rounded-r-lg border-l-0 pl-2 pr-3' 
                : 'rounded-l-lg border-r-0 pr-2 pl-3'
              }
              py-3 flex items-center gap-2 text-sm font-medium
            `}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
            {historyPanelSide === 'left' ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </button>
        )}

        {/* Canvas Tool Section - Scrollable */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Tool Info Bubble */}
          <ToolInfoBubble 
            productToolDefinition={productToolDefinition}
            isDarkMode={isDarkMode}
          />

          {/* Editing Mode Overlay */}
          {isEditingPrevious && editingTarget && (
            <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-40 
              ${editingOverlayFadingOut 
                ? 'animate-out fade-out slide-out-to-top-2 duration-500' 
                : 'animate-in fade-in duration-500 slide-in-from-top-2'
              }
              ${isDarkMode 
                ? 'bg-orange-900/90 border-orange-600 text-orange-100' 
                : 'bg-orange-100/95 border-orange-400 text-orange-800'
              }
              border rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm
            `}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Edit3 className="h-4 w-4" />
                <span>Editing: {editingTarget.replace(/-/g, ' ')}</span>
              </div>
            </div>
          )}

          <CanvasTool 
            toolData={toolData} 
            colorScheme={toolData.colorScheme || 'professional-blue'}
            isDarkMode={isDarkMode}
            productToolDefinition={productToolDefinition ? productToolDefinition : undefined}
            isGenerating={isGeneratingTool}
            generatingMessage={isBrainstorming ? 'AI is brainstorming creative ideas for your tool...' : isGeneratingTool ? 'Creating your tool...' : undefined}
          />
        </div>

        {/* Bottom Section - AI Assistant and Input Side by Side */}
        <div className={` border-t flex-shrink-0 grid grid-cols-1 lg:grid-cols-2 transition-all duration-300 ease-in-out min-h-[280px] ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          {/* AI Assistant Section */}
          <div className={`p-6 border-r transition-all duration-300 ease-in-out ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className={`rounded-xl border h-40 flex flex-col transition-all duration-300 ease-in-out ${
              isDarkMode 
                ? 'bg-gray-700/50 border-gray-600 text-blue-100 shadow-sm backdrop-blur-sm' 
                : 'bg-blue-50 border-blue-400 text-blue-900'
            }`}>
              <div className={`flex items-center gap-2 text-sm font-medium p-4 pb-2 flex-shrink-0 ${
                isDarkMode ? 'text-gray-50' : 'text-gray-800'
              }`}>
                <Sparkles className="h-4 w-4" />
                <span>AI Assistant</span>
                {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div 
                  className={`text-sm leading-relaxed font-medium transition-all duration-300 ease-in-out ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                  style={{ 
                    opacity: transitionOpacity,
                    transform: `translateY(${transitionOpacity === 1 ? '0' : '10px'})` 
                  }}
                >
                  {lastAIMessage && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {lastAIMessage}
                    </div>
                  )}
                  {isLoading && !lastAIMessage && (
                    <div className={`flex items-center gap-2 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                      <span className="text-xs">AI is thinking...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className={`p-6 transition-all duration-300 ease-in-out ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="min-h-[168px] flex flex-col">
              {/* Show loading state when agent is building response */}
              {isLoading && !currentQuestion && !isInMultiPart ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className={`flex flex-col items-center gap-3 text-center ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">Building response...</span>
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      AI is generating your next question
                    </div>
                  </div>
                </div>
              ) : isInMultiPart ? (
                <div className={`space-y-4 flex-1 transition-all duration-300 ease-in-out ${
                  // Special styling for iterator component
                  isDarkMode 
                    ? 'border-2 border-yellow-500/70 bg-yellow-950/20 rounded-xl p-4' 
                    : 'border-2 border-yellow-400/80 bg-yellow-50/50 rounded-xl p-4'
                }`}>
                  <div className="space-y-3 flex-1">
                    <h3 className={`text-lg font-medium leading-relaxed transition-opacity duration-200 ${
                      isDarkMode ? 'text-gray-100' : 'text-gray-900'
                    }`} style={{ opacity: transitionOpacity }}>
                      {multiPartQuestions[multiPartIndex]?.question}
                    </h3>

                    <div 
                      className="transition-opacity duration-200 flex-1"
                      style={{ opacity: transitionOpacity }}
                    >
                      <DynamicInput
                        currentQuestion={multiPartQuestions[multiPartIndex]}
                        value={currentInput}
                        onChange={setCurrentInput}
                        onSubmit={handleInputSubmit}
                        isLoading={isLoading}
                        isDarkMode={isDarkMode}
                        onOpenColorPicker={() => setShowColorPickerPopup(true)}
                        onPreviewUpdate={(questionId, value) => {
                          // Enhanced preview update for live color changes in iterator
                          const currentQuestion = multiPartQuestions[multiPartIndex];
                          if (currentQuestion && currentQuestion.options) {
                            const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
                            if (selectedOption && (selectedOption as any).colors) {
                              // For AI-generated colors, update with actual hex values
                              setToolData((prev: any) => ({
                                ...prev,
                                colorScheme: 'custom',
                                customColors: (selectedOption as any).colors
                              }));
                              console.log('🎨 Iterator live preview update with AI colors:', (selectedOption as any).colors);
                              return;
                            }
                          }
                          // Fallback to standard update for predefined colors
                          updateToolDataFromMultiPart(questionId, value);
                        }}
                        customColors={customColors}
                      />
                    </div>
                  </div>
                  
                  {/* Iterator Progress Indicator */}
                  <div className="mt-3 pt-3 border-t border-yellow-400/30 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex gap-1 ${
                          isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
                        }`}>
                          {multiPartQuestions.map((_, index) => (
                            <div
                              key={index}
                              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                                index <= multiPartIndex
                                  ? isDarkMode ? 'bg-yellow-400' : 'bg-yellow-500'
                                  : isDarkMode ? 'bg-yellow-800' : 'bg-yellow-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className={`text-xs transition-colors duration-200 ${
                          isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
                        }`}>
                          {multiPartIndex < multiPartQuestions.length - 1 
                            ? 'Collecting responses...' 
                            : 'Final question - will submit all answers'
                          }
                        </span>
                      </div>
                      
                      {/* Buttons side by side */}
                      <div className="flex items-center gap-3">
                      {/* See Full Form Button */}
                      <button
                        onClick={() => {
                          // Initialize full form with current answers
                          const currentAnswers = { ...multiPartAnswers };
                          if (currentInput.trim()) {
                            currentAnswers[multiPartQuestions[multiPartIndex]?.id] = currentInput;
                          }
                          console.log('🔧 Opening full form with answers:', currentAnswers);
                          console.log('🔧 multiPartAnswers state:', multiPartAnswers);
                          console.log('🔧 Current input:', currentInput);
                          console.log('🔧 Current question ID:', multiPartQuestions[multiPartIndex]?.id);
                          setFullFormAnswers(currentAnswers);
                          setShowFullFormPopup(true);
                        }}
                        className={`text-xs underline hover:no-underline transition-all duration-200 ${
                          isDarkMode ? 'text-yellow-300 hover:text-yellow-200' : 'text-yellow-600 hover:text-yellow-700'
                        }`}
                      >
                        see full form
                      </button>
                        
                        {/* Speak Freely Button */}
                        <button
                          onClick={handleSwitchToChat}
                          disabled={isLoading}
                          className={`text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                            isDarkMode 
                              ? 'text-lime-400 hover:text-gray-200 hover:bg-gray-700/50' 
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                          } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <MessageSquare className="h-3 w-3" />
                          speak freely
                        </button>
                    </div>
                    </div>
                    
                  </div>
                </div>
              ) : (
                <div 
                  className="transition-all duration-300 ease-in-out flex-1 flex flex-col"
                  style={{ opacity: transitionOpacity }}
                >
                  <div className="flex-1">
                    <DynamicInput
                      currentQuestion={currentQuestion}
                      value={currentInput}
                      onChange={setCurrentInput}
                      onSubmit={handleInputSubmit}
                      isLoading={isLoading}
                      isDarkMode={isDarkMode}
                      onOpenColorPicker={() => setShowColorPickerPopup(true)}
                      onPreviewUpdate={(questionId, value) => {
                        // Enhanced preview update for live color changes
                        if (currentQuestion && currentQuestion.options) {
                          const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
                          if (selectedOption && (selectedOption as any).colors) {
                            // For AI-generated colors, update with actual hex values
                            setToolData((prev: any) => ({
                              ...prev,
                              colorScheme: 'custom',
                              customColors: (selectedOption as any).colors
                            }));
                            console.log('🎨 Live preview update with AI colors:', (selectedOption as any).colors);
                            return;
                          }
                        }
                        // Fallback to standard update for predefined colors
                        updateToolData(questionId, value);
                      }}
                      customColors={customColors}
                    />
                  </div>
                  
                  {/* Chat Button - Only show when there's a current question (structured input) */}
                  {currentQuestion && currentQuestion.inputType !== 'textarea' && (
                    <div className="mt-3 pt-3 border-t border-opacity-30 border-gray-300 flex-shrink-0 transition-all duration-300 ease-in-out">
                      <div className="flex justify-center">
                        <button
                          onClick={handleSwitchToChat}
                          disabled={isLoading}
                          className={`text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                            isDarkMode 
                              ? 'text-lime-400 hover:text-gray-200 hover:bg-gray-700/50' 
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                          } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <MessageSquare className="h-3 w-3" />
                          speak freely
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Input History Panel */}
      <InputHistory
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        side={historyPanelSide}
        answers={collectedAnswers}
        questionHistory={questionHistory}
        onAnswerUpdate={handleAnswerUpdate}
        isDarkMode={isDarkMode}
      />

      {/* Color Picker Popup */}
      <ColorPickerPopup
        isOpen={showColorPickerPopup}
        onClose={() => setShowColorPickerPopup(false)}
        onSubmit={handleColorPickerSubmit}
        isDarkMode={isDarkMode}
      />

      {/* Full Form Popup */}
      <FullFormPopup
        isOpen={showFullFormPopup}
        onClose={() => setShowFullFormPopup(false)}
        onSubmit={async (answers) => {
          // Handle full form submission - same as completing iterator sequence
          console.log('Full form submitted:', answers);
          
          // Set the answers and complete the multi-part sequence
          setMultiPartAnswers(answers);
          
          // Store all multi-part answers as a single answer for main workflow
          const mainQuestionId = questionQueue[currentQuestionIndex]?.id || 'multi-part-unknown';
          const newCollectedAnswers = { ...collectedAnswers, [mainQuestionId]: JSON.stringify(answers) };
          setCollectedAnswers(newCollectedAnswers);
          
          // Exit multi-part mode and continue workflow
          setIsInMultiPart(false);
          setMultiPartQuestions([]);
          setMultiPartIndex(0);
          setCurrentInput('');
          
          // Continue with main workflow
          await processMockWorkflow(newCollectedAnswers);
          
          setShowFullFormPopup(false);
        }}
        questions={multiPartQuestions}
        initialAnswers={fullFormAnswers}
        isDarkMode={isDarkMode}
      />

      {/* Behavior Learning Dashboard */}
      <div className="z-40">
        {/* Add your behavior learning dashboard component here */}
      </div>

      {/* NEW: Brainstorming Panel */}
      {showBrainstormingPanel && (
        <div className={`fixed top-4 right-4 w-80 max-h-96 rounded-xl shadow-2xl border z-50 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-gray-50' : 'text-gray-900'
            }`}>
              🧠 Logic Architect
            </h3>
            <button
              onClick={() => setShowBrainstormingPanel(false)}
              className={`p-1 rounded hover:bg-gray-100 ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
              }`}
              aria-label="Close brainstorming panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto max-h-80">
            {isBrainstorming && (
              <div className={`mb-4 text-center ${
                isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
              }`}>
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                <p className="text-sm font-medium">Brainstorming ideas...</p>
              </div>
            )}
            
            {brainstormingThoughts.length === 0 && !isBrainstorming ? (
              <div className={`text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No brainstorming session yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {brainstormingThoughts.map((thought, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      thought.type === 'error' 
                        ? isDarkMode 
                          ? 'border-red-600 bg-red-900/20' 
                          : 'border-red-300 bg-red-50'
                        : thought.type === 'complete'
                        ? isDarkMode 
                          ? 'border-green-600 bg-green-900/20' 
                          : 'border-green-300 bg-green-50'
                        : isDarkMode 
                          ? 'border-gray-600 bg-gray-700/30' 
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-1">
                        {thought.type === 'error' ? (
                          <X className="h-4 w-4 text-red-500" />
                        ) : thought.type === 'complete' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-700'
                        }`}>
                          {thought.type === 'error' && thought.message 
                            ? thought.message 
                            : thought.type === 'partial' && thought.data?.thought
                              ? thought.data.thought
                              : thought.type === 'complete' && thought.data?.coreWConcept
                                ? `✅ ${thought.data.coreWConcept}`
                                : typeof thought.data === 'string' 
                                  ? thought.data 
                                  : thought.type === 'complete'
                                    ? '✅ Brainstorming complete! Tool concept ready.'
                                    : JSON.stringify(thought.data, null, 2)
                          }
                        </p>
                        {(thought.type === 'partial' && thought.data?.progress) && (
                          <div className={`mt-2 w-full bg-gray-200 rounded-full h-1.5 ${
                            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                          }`}>
                            <div 
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${thought.data.progress}%` }}
                            />
                          </div>
                        )}
                        {thought.type === 'complete' && (
                          <div className={`mt-2 w-full bg-gray-200 rounded-full h-1.5 ${
                            isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                          }`}>
                            <div 
                              className="bg-green-500 h-1.5 rounded-full transition-all duration-1000"
                              style={{ width: '100%' }}
                            />
                          </div>
                        )}
                        <p className={`text-xs mt-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {new Date(thought.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW: Saved Logic Results Panel */}
      {showLogicSelect && (
        <div className={`fixed top-4 right-4 w-80 max-h-96 rounded-xl shadow-2xl border z-50 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-gray-50' : 'text-gray-900'
            }`}>
              💾 Saved Logic Results
            </h3>
            <button
              onClick={() => setShowLogicSelect(false)}
              className={`p-1 rounded hover:bg-gray-100 ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
              }`}
              aria-label="Close saved logic results panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto max-h-80">
            {savedLogicResults.length === 0 ? (
              <div className={`text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No saved logic results yet</p>
                <p className="text-xs mt-1">Test the Logic Architect to see results here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedLogicResults.map((result) => (
                  <div
                    key={result.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700/30 hover:bg-gray-700/50' 
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      console.log('Loading saved logic result:', result);
                      setLatestBrainstormingResult(result.result);
                      setShowLogicSelect(false);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                          {result.toolType} for {result.targetAudience}
                        </h4>
                        {result.industry && (
                          <p className={`text-xs ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            Industry: {result.industry}
                          </p>
                        )}
                        <p className={`text-xs ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {result.date}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Load
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW: Saved Tools Panel */}
      {showToolsSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl shadow-2xl border max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-300'
          }`}>
            <div className={`flex items-center justify-between p-4 border-b ${
              isDarkMode ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-gray-50' : 'text-gray-900'
              }`}>
                Saved Tools ({savedToolsFromDB.length})
              </h3>
              <button
                onClick={() => setShowToolsSelect(false)}
                className={`p-1 rounded hover:bg-gray-100 ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
                }`}
                aria-label="Close saved tools"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow">
              {savedToolsFromDB.length === 0 ? (
                <p className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  No tools saved yet. Create some tools to see them here!
                </p>
              ) : (
                <ul className="space-y-3">
                  {savedToolsFromDB.map((toolDef) => (
                    <li 
                      key={toolDef.id} 
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isDarkMode 
                          ? 'border-gray-700 hover:bg-gray-700/50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={async () => {
                        console.log("Loading tool from list:", toolDef.metadata.title);
                        setProductToolDefinition(toolDef);
                        // Update toolData for canvas preview
                        setToolData({
                          title: toolDef.metadata.title,
                          description: toolDef.metadata.description,
                          colorScheme: typeof toolDef.colorScheme === 'string' 
                            ? toolDef.colorScheme 
                            : (toolDef.colorScheme?.primary || 'professional-blue'),
                          customColors: typeof toolDef.colorScheme !== 'string' 
                            ? [toolDef.colorScheme?.primary, toolDef.colorScheme?.secondary].filter(Boolean) as string[] 
                            : undefined,
                          features: toolDef.metadata.features || [],
                        });
                        await saveLastActiveToolToDB(toolDef); // Set as last active
                        setShowToolsSelect(false);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className={`font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {toolDef.metadata.title}
                          </h4>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            ID: {toolDef.id} - Version: {toolDef.version} - Type: {toolDef.metadata.type}
                          </p>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Last Updated: {new Date(toolDef.updatedAt || 0).toLocaleString()}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'}
                          onClick={async (e) => {
                            e.stopPropagation(); // Prevent li onClick from firing
                            if (confirm(`Are you sure you want to delete "${toolDef.metadata.title}"?`)) {
                              await deleteToolFromDBList(toolDef.id);
                              const refreshedTools = await loadAllToolsFromDB();
                              setSavedToolsFromDB(refreshedTools);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={`p-4 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <Button
                variant="outline"
                onClick={() => setShowToolsSelect(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
