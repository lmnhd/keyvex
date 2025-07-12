'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToolGenerationStream, type StepProgress, type ConnectionStatus } from '../hooks/useToolGenerationStream';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import DEFAULT_MODELS from '@/lib/ai/models/default-models.json';
import { ToolCreationJob, runIsolatedAgentTest, runToolCreationProcess, runTccFinalizationSteps } from './tool-tester-core-logic';
import { loadAllToolsFromDB, loadV2JobsFromDB, saveToolToDBList, saveV2JobToDB, deleteToolFromDBList, deleteV2JobFromDB, saveToolToDynamoDBOnly } from '../../ui/db-utils';
import { type BrainstormResult } from '../types/unified-brainstorm-types';
import { 
  AgentModelMapping, 
  mockTccScenarios, 
  ModelOption, 
  OrchestrationStatus, 
  STORAGE_KEYS, 
  TccSource, 
  WorkflowMode, 
  AgentMode,
  TccUpdate
} from './tool-tester-parts/tool-tester-types';
import { useToolTesterData } from '../hooks/useToolTesterData';
import { useTccPersistence } from '../hooks/useTccPersistence';
import ToolTesterView from './tool-tester-parts/tool-tester-view';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@clerk/nextjs';
import { v4 as uuidv4 } from 'uuid';
import { ToolConstructionContext } from '@/lib/types/tcc-unified';


const ToolTester: React.FC<{ isDarkMode: boolean, newBrainstormFlag?: number }> = ({ isDarkMode, newBrainstormFlag }) => {
  // Get userId from Clerk or use test userId
  const { user } = useUser();
  const userId = user?.id || 'lem1'; // Always have a userId - real from Clerk or test userId

  // Use the custom hook for data fetching
  const {
    availableModels,
    defaultPrimaryModel,
    savedBrainstorms,
    setSavedBrainstorms,
    savedTools,
    setSavedTools,
    savedV2Jobs,
    setSavedV2Jobs,
    isLoading: dataLoading,
    error: dataError,
    setError: setDataError,
    fetchSavedTools,
    fetchSavedV2Jobs,
    dynamoDBTools,
    loadSource,
    setLoadSource,
  } = useToolTesterData(newBrainstormFlag, userId);

  const [primaryModel, setPrimaryModel] = useState<string | null>(null);
  const [savedToolIds, setSavedToolIds] = useState<Set<string>>(new Set());
  const [savedV2JobIds, setSavedV2JobIds] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hasTccAutoLoaded, setHasTccAutoLoaded] = useState(false);
  
  const [tccData, setTccData] = useState<ToolConstructionContext | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [wsLogs, setWsLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isRefreshingTCC, setIsRefreshingTCC] = useState(false);
  const [selectedBrainstormId, setSelectedBrainstormId] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMode, setLoadMode] = useState<'new' | 'load'>('new');
  const [selectedLoadItem, setSelectedLoadItem] = useState<{ type: 'brainstorm' | 'tool' | 'v2job', id: string } | null>(null);
  const [testJob, setTestJob] = useState<ToolCreationJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assembledCode, setAssembledCode] = useState<string | null>(null);
  const [finalProduct, setFinalProduct] = useState<ProductToolDefinition | null>(null);

  
  // Agent model mapping for individual agent testing
  const [agentModelMapping, setAgentModelMapping] = useState<AgentModelMapping>({});
  

    // workflowMode distinguishes between V2 orchestration and per-agent debug
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('v2');

  const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatus>('free');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [tccSource, setTccSource] = useState<TccSource>('brainstorm');
  const [selectedDebugTccJobId, setSelectedDebugTccJobId] = useState<string | null>(null);
  const [selectedMockScenarioId, setSelectedMockScenarioId] = useState<string>('');
  
  // Phase 3.2: Agent mode for create/edit toggle in debug section
  const [agentMode, setAgentMode] = useState<AgentMode>('create');
  const [editMessage, setEditMessage] = useState('');

  const addWSLog = useCallback((message: string) => {
    setWsLogs(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

   // Enhanced WebSocket logging with detailed console output
   const addDetailedWSLog = useCallback((type: 'connection' | 'message' | 'error' | 'debug', message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    setWsLogs(prev => [...prev.slice(-19), logMessage]);
  }, []);

  // 🔧 FALLBACK: Retrieve complete TCC when WebSocket transmission fails
  const attemptTccFallbackRetrieval = useCallback(async (jobId: string) => {
    try {
      addWSLog(`🔄 Fetching complete TCC for job: ${jobId}`);
      
      const response = await fetch(`/api/ai/v2-orchestration/tcc/${jobId}`);
      if (!response.ok) {
        throw new Error(`TCC retrieval failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.success || !result.tccData) {
        throw new Error('TCC retrieval response invalid or missing data');
      }
      
      const completeTcc = result.tccData;
      const fallbackFinalProduct = completeTcc?.finalProduct;
      
      if (fallbackFinalProduct && fallbackFinalProduct.componentCode && fallbackFinalProduct.id) {
        addWSLog('✅ Fallback TCC retrieval successful! Found complete finalProduct.');
        
        // Update state with complete TCC and final product
        setTccData(completeTcc);
        setFinalProduct(fallbackFinalProduct);
        
        setTestJob(prev => ({
          ...(prev as ToolCreationJob),
          status: 'success',
          result: fallbackFinalProduct,
          endTime: Date.now()
        }));
        
        console.log('🎯 [FALLBACK SUCCESS] Complete TCC retrieved:', completeTcc);
        console.log('🎯 [FALLBACK SUCCESS] Final product found:', fallbackFinalProduct);
        
      } else {
        addWSLog('❌ Fallback TCC retrieval failed: finalProduct still incomplete');
        console.warn('🚨 [FALLBACK FAILED] Retrieved TCC still missing finalProduct:', completeTcc);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addWSLog(`❌ Fallback TCC retrieval error: ${errorMessage}`);
      console.error('🚨 [FALLBACK ERROR] TCC retrieval failed:', error);
    }
  }, [addWSLog]);

  // TCC Persistence
  const {
    tccData: tccDataPersistence,
    lastValidTcc,
    tccHistory,
    updateTccWithBackup,
    recoverLastValidTcc,
    safeClearTcc,
    hasTccBackup,
    setTccData: setTccDataPersistence
  } = useTccPersistence(addDetailedWSLog);

  // --- TCC Snapshot Logic for Debugging ---
  const TCC_SNAPSHOT_KEY = 'debug_tcc_snapshot';

  const handleSaveTccSnapshot = useCallback(() => {
    if (tccData) {
      try {
        localStorage.setItem(TCC_SNAPSHOT_KEY, JSON.stringify(tccData));
        addDetailedWSLog('debug', '✅ TCC snapshot saved to localStorage for debugging.');
      } catch (error) {
        addDetailedWSLog('error', 'Failed to save TCC snapshot.', error);
      }
    } else {
      addDetailedWSLog('error', 'No TCC data available to save.');
    }
  }, [tccData, addDetailedWSLog]);

  const handleLoadTccSnapshot = useCallback(() => {
    try {
      const savedTcc = localStorage.getItem(TCC_SNAPSHOT_KEY);
      if (savedTcc) {
        const parsedTcc = JSON.parse(savedTcc);
        setTccDataPersistence(parsedTcc);
        addDetailedWSLog('debug', '✅ TCC snapshot loaded from localStorage.');
        
        // If TCC has component code, also set it as assembled code for preview
        if (parsedTcc?.finalProduct?.componentCode) {
          setAssembledCode(parsedTcc.finalProduct.componentCode);
          addDetailedWSLog('debug', '✅ Component code extracted from TCC and set for preview.');
        }
      } else {
        addDetailedWSLog('error', 'No TCC snapshot found in localStorage.');
      }
    } catch (error) {
      addDetailedWSLog('error', 'Failed to load or parse TCC snapshot.', error);
    }
  }, [setTccDataPersistence, addDetailedWSLog]);

  // Auto-load TCC snapshot on component mount if available and no current TCC data
  useEffect(() => {
    if (!tccData && !hasTccAutoLoaded) {
      try {
        const savedTcc = localStorage.getItem(TCC_SNAPSHOT_KEY);
        if (savedTcc) {
          const parsedTcc = JSON.parse(savedTcc);
          setTccDataPersistence(parsedTcc);
          addDetailedWSLog('debug', '✅ Auto-loaded TCC snapshot from localStorage on component mount.');
          
          // If TCC has component code, also set it as assembled code for preview
          if (parsedTcc?.finalProduct?.componentCode) {
            setAssembledCode(parsedTcc.finalProduct.componentCode);
            addDetailedWSLog('debug', '✅ Component code extracted from auto-loaded TCC and set for preview.');
          }
        }
      } catch (error) {
        console.warn('Failed to auto-load TCC snapshot:', error);
      }
      setHasTccAutoLoaded(true);
    }
  }, [tccData, hasTccAutoLoaded, setTccDataPersistence, addDetailedWSLog]);
  // --- End TCC Snapshot Logic ---

  // Add refs for auto-scrolling
  const wsLogsEndRef = useRef<HTMLDivElement>(null);
  const progressSummaryEndRef = useRef<HTMLDivElement>(null);

  // Available agents for individual testing (memoized to prevent re-creation)
  const availableAgents = React.useMemo(() => [
    { id: 'function-planner', name: 'Function Signature Planner', description: 'Plans tool functions and signatures' },
    { id: 'state-design', name: 'State Design Agent', description: 'Designs React state management' },
    { id: 'jsx-layout', name: 'JSX Layout Agent', description: 'Creates component structure' },
    { id: 'tailwind-styling', name: 'Tailwind Styling Agent', description: 'Applies complete styling system' },
    { id: 'component-assembler', name: 'Component Assembler', description: 'Combines all agent outputs' },
    { id: 'code-validator', name: 'Code Validator Agent', description: 'Validates generated code' },
    { id: 'tool-finalizer', name: 'Tool Finalizer', description: 'Creates final tool definition' }
  ], []);

  const handleJobUpdate = useCallback((progress: StepProgress) => {
    addWSLog(progress.message || `Progress for ${progress.stepName}: ${progress.status}`);
    setCurrentStep(progress.stepName);

    let actualTcc = progress.data;
    if (progress.data && progress.data.tcc) {
      actualTcc = progress.data.tcc;
    }
    
    if (actualTcc && actualTcc.jobId) {
      const tccUpdate: TccUpdate = {
        agentType: progress.stepName,
        tccKeys: Object.keys(actualTcc),
        hasAssembledCode: !!(actualTcc?.assembledComponentCode || actualTcc?.jsxLayout?.componentStructure),
        hasFinalProduct: !!actualTcc?.finalProduct,
      };
      console.log(`📊 [WORKBENCH] TCC Update received via WebSocket:`, tccUpdate);
      setTccData(prevTccData => ({
        ...prevTccData,
        ...actualTcc,
      }));
      updateTccWithBackup({ ...(tccData || {}), ...actualTcc }, progress.stepName);
    }

    // CRITICAL FIX: Listen for "completed" stepName from the orchestrator
    if (progress.stepName === 'completed' && progress.status === 'completed' && progress.data) {
      addWSLog(`✅ Workflow completion message received. Processing final product...`);
      
      // 🎯 SINGLE SOURCE OF TRUTH - Check for direct finalProduct first, then fallback to nested
      const directFinalProduct = progress.data.finalProduct;
      const finalTcc = (progress.data?.updatedTcc ?? progress.data) as ToolConstructionContext | undefined;
      const nestedFinalProduct = finalTcc?.finalProduct;
      
      // Priority: Direct finalProduct > Nested finalProduct
      const finalProductData = directFinalProduct || nestedFinalProduct;
      
      if (finalProductData && finalProductData.componentCode && finalProductData.id) {
        addWSLog(`✅ Final product received ${directFinalProduct ? 'directly' : 'from TCC'}. Updating UI state.`);
        console.log("📦 Final product data found:", {
          source: directFinalProduct ? 'direct' : 'nested',
          productId: finalProductData.id,
          hasComponentCode: !!finalProductData.componentCode,
          componentCodeLength: finalProductData.componentCode?.length
        });
        
        setFinalProduct(prevFinalProduct => ({
          ...(prevFinalProduct || {}),
          ...finalProductData,
        }));
        
        setTestJob(prev => ({
          ...(prev as ToolCreationJob),
          status: 'success',
          result: finalProductData,
          endTime: Date.now()
        }));

        // Set complete TCC if available
        if (finalTcc) {
          setTccData(finalTcc);
          console.log("✅ Final TCC data set in state.", finalTcc);
        }

      } else {
        // 🚨 FALLBACK: Both direct and nested finalProduct missing or incomplete
        addWSLog('⚠️ finalProduct missing or incomplete from WebSocket. Attempting fallback retrieval...');
        console.warn('Completion message analysis:', {
          hasDirectFinalProduct: !!directFinalProduct,
          hasNestedFinalProduct: !!nestedFinalProduct,
          directHasComponentCode: !!directFinalProduct?.componentCode,
          nestedHasComponentCode: !!nestedFinalProduct?.componentCode,
          progressData: progress.data
        });
        
        // 🔧 FALLBACK: Try to fetch complete TCC directly from API
        const fallbackJobId: string | null | undefined = finalTcc?.jobId || tccData?.jobId || currentJobId;
        if (fallbackJobId) {
          attemptTccFallbackRetrieval(fallbackJobId);
        } else {
          addWSLog('❌ CRITICAL: No jobId available for fallback retrieval.');
          console.error('No fallback possible - missing jobId:', { finalTcc, tccData, currentJobId });
        }
      }
    } else if (progress.status === 'failed' && actualTcc) {
      addWSLog(`❌ Workflow failed at step: ${progress.stepName}. TCC state has been preserved.`);
      updateTccWithBackup({ ...(tccData || {}), ...actualTcc }, 'workflow-failure');
      setTestJob(prev => ({
        ...(prev as ToolCreationJob),
        status: 'error',
        endTime: Date.now()
      }));
      setTccData(actualTcc);
    }
  }, [addWSLog, updateTccWithBackup, tccData, currentJobId, attemptTccFallbackRetrieval]);

  // Get the hook's return values 
  const { 
    connect, 
    disconnect, 
    connectionStatus, 
    progressUpdates, 
    messages, 
    setProgressUpdates 
  }: {
    connect: (jobId: string, userId: string) => Promise<void>;
    disconnect: () => void;
    connectionStatus: ConnectionStatus;
    progressUpdates: StepProgress[];
    messages: Array<{ type: string; data: any }>;
    setProgressUpdates: React.Dispatch<React.SetStateAction<StepProgress[]>>;
  } = useToolGenerationStream({ 
    onProgress: (progress) => {
      // Log detailed progress information
      addDetailedWSLog('message', `Step Progress: ${progress.stepName} -> ${progress.status}`, {
        jobId: progress.jobId,
        message: progress.message,
        dataKeys: progress.data ? Object.keys(progress.data) : [],
        isFallback: progress.isFallback
      });
      
      // Call the original handler
      handleJobUpdate(progress);
    },
    onMessage: (message) => {
      addDetailedWSLog('message', `WebSocket message received: ${message.type}`, message.data);
    },
    onError: (error) => {
      addDetailedWSLog('error', `WebSocket error: ${error}`);
    },
    onTccUpdate: (updatedTcc, agentType) => {
      // 📊 REAL-TIME TCC UPDATES - Update workbench state immediately
      console.log('📊 [WORKBENCH] TCC Update received via WebSocket:', {
        agentType,
        tccKeys: Object.keys(updatedTcc || {}),
        hasAssembledCode: !!(updatedTcc?.assembledComponentCode || updatedTcc?.jsxLayout?.componentStructure),
        hasFinalProduct: !!updatedTcc?.finalProduct
      });

      // NEW → make this TCC the one the UI works with
      setTccData(prevTccData => ({
        ...prevTccData,
        ...updatedTcc,
      }));

      // 🛡️ backup
      // Also pass the merged TCC to the backup function
      updateTccWithBackup({ ...(tccData || {}), ...updatedTcc }, `websocket-${agentType}`);

      // assembled code
      const potentialAssembled = updatedTcc?.assembledComponentCode || updatedTcc?.jsxLayout?.componentStructure;
      if (potentialAssembled) {
        setAssembledCode(potentialAssembled);
        addDetailedWSLog('debug', `✅ Assembled code updated from ${agentType}`, {
          codeLength: potentialAssembled.length,
          source: updatedTcc?.assembledComponentCode ? 'assembledComponentCode' : 'jsxLayout.componentStructure'
        });
      }

      // final product
      if (updatedTcc?.finalProduct) {
        // Also merge final product deeply to avoid losing other properties
        setFinalProduct(prevFinalProduct => ({
          ...(prevFinalProduct || {}),
          ...updatedTcc.finalProduct,
        }));

        // NEW → ensure testJob.result is set so Preview-priority #1 also works
        setTestJob(prev => {
          if (prev) {
            // Update existing job with the new final product
            return { ...prev, result: { finalProduct: updatedTcc.finalProduct } };
          }
          // Create a minimal job shell so Live Preview logic has a source
          return {
            jobId: updatedTcc.jobId,
            startTime: Date.now(),
            status: 'success',
            modelId: agentModelMapping[Object.keys(agentModelMapping)[0]] || defaultPrimaryModel || 'gpt-4o',
            result: { finalProduct: updatedTcc.finalProduct },
            endTime: Date.now(),
          } as ToolCreationJob;
        });

        addDetailedWSLog('debug', `✅ Final product updated from ${agentType}`, {
          productId: updatedTcc.finalProduct.id,
          hasComponentCode: !!updatedTcc.finalProduct.componentCode
        });
      }

      addDetailedWSLog('debug', `📊 TCC updated by ${agentType}`, {
        tccKeys: Object.keys(updatedTcc || {}),
        timestamp: new Date().toISOString()
      });
    }
  });

  useEffect(() => {
    // Automatically connect on initial load
    if (userId) {
      // Create a temporary job ID for the connection
      const initialJobId = `session-${uuidv4()}`;
      console.log(`Attempting to connect with userId: ${userId} and initialJobId: ${initialJobId}`);
      connect(initialJobId, userId);
    }

    return () => {
      disconnect();
    };
  }, [userId]);

  // Clear logs function - now setProgressUpdates is available
  const clearLogsAndProgress = useCallback(() => {
    setWsLogs([]);
    setProgressUpdates([]);
    setCurrentStep('');
    setError(null);
    addWSLog('🧹 Logs cleared - starting fresh test');
  }, [addWSLog, setProgressUpdates]);

  // WebSocket debug information state similar to test page
  const [wsDebugInfo, setWsDebugInfo] = useState({
    envVar: process.env.NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT,
    hasEnvVar: !!process.env.NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT,
    finalUrl: process.env.NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT || 'Not Set',
    isPlaceholder: (process.env.NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT || '').includes('your-websocket-api'),
    connectionAttempts: 0,
    lastConnectionTime: null as string | null,
    lastMessageTime: null as string | null
  });

  // LocalStorage utilities
  const saveToLocalStorage = useCallback((key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((key: string, defaultValue: any = null) => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return defaultValue;
    }
  }, []);

  // Auto-scroll effect for WebSocket logs
  useEffect(() => {
    if (wsLogsEndRef.current) {
      wsLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [wsLogs]);

  // TODO: once WorkbenchControlPanel extraction is complete, render it here.
  // Temporarily return null so the file compiles without missing props.
  return null;
}


export default ToolTester;
