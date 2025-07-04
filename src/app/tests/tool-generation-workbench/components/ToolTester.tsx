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

  const [primaryModel, setPrimaryModel] = useState<string | null>(null); // <-- ADD THIS LINE
  const [savedToolIds, setSavedToolIds] = useState<Set<string>>(new Set());
  const [savedV2JobIds, setSavedV2JobIds] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hasTccAutoLoaded, setHasTccAutoLoaded] = useState(false);
  
  const [tccData, setTccData] = useState<any>(null);
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
  
  // workflowMode to distinguish between V2 orchestration and debug mode
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
        hasAssembledCode: !!actualTcc.assembledComponentCode,
        hasFinalProduct: !!actualTcc.finalProduct,
      };
      console.log(`📊 [WORKBENCH] TCC Update received via WebSocket:`, tccUpdate);
      setTccData(actualTcc);
      updateTccWithBackup(actualTcc, progress.stepName);
    }

    // CRITICAL FIX: Listen for "completed" stepName from the orchestrator
    if (progress.stepName === 'completed' && progress.status === 'completed' && progress.data) {
      addWSLog(`✅ Workflow completion message received. Processing final product...`);
      
      const finalTcc = progress.data;
      const finalProductData = finalTcc.finalProduct;
      
      if (finalProductData && (finalProductData.id || finalProductData.componentCode)) {
        console.log("📦 Final product data found. Updating UI state.", finalProductData);
        setFinalProduct(finalProductData as ProductToolDefinition);
        
        setTestJob(prev => ({
          ...(prev as ToolCreationJob),
          status: 'success',
          result: finalProductData,
          endTime: Date.now()
        }));

        // Ensure the final, complete TCC is set
        setTccData(finalTcc);
        console.log("✅ Final TCC data set in state.", finalTcc);

      } else {
        addWSLog('⚠️ Final workflow step completed but no valid product data found in TCC.');
        console.warn('Final TCC data structure:', finalTcc);
      }
    } else if (progress.status === 'failed' && actualTcc) {
      addWSLog(`❌ Workflow failed at step: ${progress.stepName}. TCC state has been preserved.`);
      updateTccWithBackup(actualTcc, 'workflow-failure');
      setTestJob(prev => ({
        ...(prev as ToolCreationJob),
        status: 'error',
        endTime: Date.now()
      }));
      setTccData(actualTcc);
    }
  }, [addWSLog, updateTccWithBackup]);

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
        hasAssembledCode: !!updatedTcc?.assembledComponentCode,
        hasFinalProduct: !!updatedTcc?.finalProduct
      });

      // NEW → make this TCC the one the UI works with
      setTccData(updatedTcc);

      // 🛡️ backup
      updateTccWithBackup(updatedTcc, `websocket-${agentType}`);

      // assembled code
      if (updatedTcc?.assembledComponentCode) {
        setAssembledCode(updatedTcc.assembledComponentCode);
        addDetailedWSLog('debug', `✅ Assembled code updated from ${agentType}`, {
          codeLength: updatedTcc.assembledComponentCode.length
        });
      }

      // final product
      if (updatedTcc?.finalProduct) {
        setFinalProduct(updatedTcc.finalProduct);

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

  // Auto-scroll effect for progress summary
  useEffect(() => {
    if (progressSummaryEndRef.current) {
      progressSummaryEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progressUpdates]);

  // Get default model for agent from processModels in default-models.json
  const getDefaultModelForAgent = useCallback((agentId: string): string => {
    const processModelsMapping: { [key: string]: string } = {
      'function-planner': 'functionPlanner',
      'validator': 'validation',
      'tool-finalizer': 'toolCreator',
      'component-assembler': 'toolCreator',
      'state-design': 'toolCreator',
      'jsx-layout': 'toolCreator', 
      'tailwind-styling': 'styleMaster'
    };

    const processName = processModelsMapping[agentId];
    if (processName && (DEFAULT_MODELS.processModels as any)?.[processName]?.primary?.model) {
      const modelId = (DEFAULT_MODELS.processModels as any)[processName].primary.model;
      console.log(`🎯 Using default model for ${agentId}: ${modelId} (from processModels.${processName})`);
      return modelId;
    }

    // Fallback to gpt-4.1-mini if no specific mapping
    const fallback = 'gpt-4.1-mini';
    console.log(`⚠️ No processModel mapping for ${agentId}, using fallback: ${fallback}`);
    return fallback;
  }, []);

  // Function to get the actual models used in the workflow
  const getModelsUsed = useCallback(() => {
    if (workflowMode === 'debug' && selectedAgent) {
      // For debug mode, return the model assigned to the specific agent
      const agentModel = agentModelMapping[selectedAgent];
      return agentModel ? [agentModel] : [];
    } else {
      // For V2 orchestration, return all models in agent mapping
      return Object.values(agentModelMapping).filter((model, index, arr) => arr.indexOf(model) === index);
    }
  }, [workflowMode, selectedAgent, agentModelMapping]);

  // --- Utility: Initialize default models and agent mapping ---
  const initializeDefaultModels = useCallback(() => {
    if (!defaultPrimaryModel || availableModels.length === 0) {
      console.warn("⚠️ Cannot initialize default models yet. Missing defaultPrimaryModel or availableModels.");
      return;
    }
    // Set the primary model for the V2 orchestration workflow
    setPrimaryModel(defaultPrimaryModel);
    // Set up the default selected models list for the UI checkboxes
    const defaultSelectedIds = [defaultPrimaryModel];
    if (availableModels.some(m => m.id === 'gpt-4o') && !defaultSelectedIds.includes('gpt-4o')) {
      defaultSelectedIds.push('gpt-4o');
    }
    setSelectedModelIds(defaultSelectedIds);
    saveToLocalStorage(STORAGE_KEYS.selectedModels, defaultSelectedIds);
    // Set up the default agent-to-model mapping for the debug dropdowns
    const newAgentMapping: AgentModelMapping = {};
    availableAgents.forEach(agent => {
      newAgentMapping[agent.id] = getDefaultModelForAgent(agent.id) || defaultPrimaryModel;
    });
    setAgentModelMapping(newAgentMapping);
    saveToLocalStorage(STORAGE_KEYS.agentMapping, newAgentMapping);
    setPrimaryModel(defaultPrimaryModel);
  }, [defaultPrimaryModel, availableModels, saveToLocalStorage, getDefaultModelForAgent, availableAgents]);

  // Initialize selections from localStorage or defaults when data is available
  useEffect(() => {
    if (availableModels.length > 0 && defaultPrimaryModel && !hasInitialized) {
      // First try to load from localStorage
      const storedSelectedModels = loadFromLocalStorage(STORAGE_KEYS.selectedModels, []);
      const storedAgentMapping = loadFromLocalStorage(STORAGE_KEYS.agentMapping, {});
      if (storedSelectedModels.length > 0 && Object.keys(storedAgentMapping).length > 0) {
        // Validate stored models against available models
        const validStoredModels = storedSelectedModels.filter((id: string) => 
          availableModels.some(model => model.id === id)
        );
        if (validStoredModels.length > 0) {
          setSelectedModelIds(validStoredModels);
          setAgentModelMapping(storedAgentMapping);
          // Also set the primary model for orchestration from the mapping
          const storedPrimary = storedAgentMapping['function-planner'] || storedAgentMapping['logic-architect'] || validStoredModels[0];
          setPrimaryModel(storedPrimary);
        } else {
          // No valid models in storage, use defaults
          initializeDefaultModels();
        }
      } else {
        // Nothing in storage, use defaults
        initializeDefaultModels();
      }
      setHasInitialized(true);
    }
  }, [availableModels, defaultPrimaryModel, hasInitialized, initializeDefaultModels]);

  // Set most recent brainstorm as default when available (not first one which might be old/bad)
  useEffect(() => {
    if (savedBrainstorms.length > 0 && !selectedBrainstormId) {
      // Sort by timestamp descending and select the most recent one
      const sortedBrainstorms = [...savedBrainstorms].sort((a, b) => (b as any).timestamp - (a as any).timestamp);
      const mostRecentBrainstorm = sortedBrainstorms[0];
      
      console.log('🎯 Auto-selecting most recent brainstorm:', {
        total: savedBrainstorms.length,
        selected: (mostRecentBrainstorm as any).id,
        selectedData: {
          toolType: (mostRecentBrainstorm as any).toolType,
          targetAudience: (mostRecentBrainstorm as any).targetAudience,
          timestamp: new Date((mostRecentBrainstorm as any).timestamp).toLocaleString()
        }
      });
      
      setSelectedBrainstormId((mostRecentBrainstorm as any).id);
    }
  }, [savedBrainstorms, selectedBrainstormId]);

  // Data fetching is now handled by the useToolTesterData hook

  const handleModelToggle = (modelId: string, checked: boolean) => {
    console.log('🎛️ handleModelToggle:', { modelId, checked, currentCount: selectedModelIds.length });
    let newSelectedIds: string[];
    if (checked && selectedModelIds.length < 5) {
      newSelectedIds = [...selectedModelIds, modelId];
    } else if (!checked) {
      newSelectedIds = selectedModelIds.filter(id => id !== modelId);
    } else {
      console.log('⚠️ Model toggle ignored - limit reached or no change needed');
      return; // No change needed
    }
    
    console.log('💾 Saving new selected models:', newSelectedIds);
    setSelectedModelIds(newSelectedIds);
    saveToLocalStorage(STORAGE_KEYS.selectedModels, newSelectedIds);
  };

  const handleAgentModelChange = (agentId: string, modelId: string) => {
    console.log('🔄 handleAgentModelChange:', { agentId, modelId });
    const newMapping = {
      ...agentModelMapping,
      [agentId]: modelId
    };
    
    console.log('💾 Saving new agent mapping:', newMapping);
    setAgentModelMapping(newMapping);
    saveToLocalStorage(STORAGE_KEYS.agentMapping, newMapping);
  };

  const handleSubmit = async () => {
    // Reset state before starting
    clearLogsAndProgress();
    
    if (workflowMode === 'debug') {
      const debugParams = {
        userId,
        agentId: selectedAgent,
        modelId: agentModelMapping[selectedAgent],
        tccSource,
        brainstormId: tccSource === 'brainstorm' ? selectedBrainstormId : undefined,
        mockScenarioId: tccSource === 'mockScenario' ? selectedMockScenarioId : undefined,
        savedV2JobId: tccSource === 'savedV2Job' ? (selectedDebugTccJobId || undefined) : undefined,
        agentMode,
        editMessage: agentMode === 'edit' ? editMessage : undefined,
        currentTcc: tccData // Pass current TCC for edit mode
      };

      console.log("Running isolated agent test with params:", debugParams);
      addDetailedWSLog('debug', 'Starting isolated agent test...', debugParams);
      
      const result = await runIsolatedAgentTest(debugParams, addDetailedWSLog);
      
      if (result && result.success) {
        setTestJob({
          modelId: agentModelMapping[selectedAgent],
          jobId: `debug-${Date.now()}`,
          status: 'success',
          result: result.data,
          startTime: Date.now(),
          endTime: Date.now()
        });
        
        // CRITICAL FIX: Update TCC data from isolated agent test results
        if (result.data?.updatedTcc) {
          setTccData(result.data.updatedTcc);
          addDetailedWSLog('debug', '✅ TCC data updated from isolated agent test', {
            agentId: selectedAgent,
            tccKeys: Object.keys(result.data.updatedTcc)
          });
          
          // Update assembled code if available from different agent types
          if (result.data.updatedTcc.styling?.styledComponentCode) {
            setAssembledCode(result.data.updatedTcc.styling.styledComponentCode);
            addDetailedWSLog('debug', '✅ Assembled code updated from styling agent');
          } else if (result.data.updatedTcc.assembledComponentCode) {
            setAssembledCode(result.data.updatedTcc.assembledComponentCode);
            addDetailedWSLog('debug', '✅ Assembled code updated from component assembler');
          }
        }
        
        addDetailedWSLog('debug', 'Agent test completed successfully', result.data);
      } else {
        setError(result?.error || 'Agent test failed');
        addDetailedWSLog('error', 'Agent test failed', result);
      }
      
      setIsLoading(false);
      return;
    }
    
    if (!selectedBrainstormId) {
      setError("Please select a brainstorm.");
      setIsLoading(false);
      return;
    }
    setError(null);
    setTestJob(null);
    setAssembledCode(null);
    setFinalProduct(null);
    setWsLogs([]);
    // 🛡️ Use safe clear instead of setTccData(null) to maintain backup
    safeClearTcc(true); // Preserve backup when starting new operation
    setCurrentStep('');

    const brainstorm = savedBrainstorms.find(b => b.id === selectedBrainstormId);
    if (!brainstorm) {
      setError("Selected brainstorm data not found.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    addWSLog(`Creating V2 job for brainstorm: ${brainstorm.id}...`);

    try {
      const newJob = await runToolCreationProcess(
        brainstorm, 
        agentModelMapping[Object.keys(agentModelMapping)[0]] || defaultPrimaryModel || 'gpt-4o',
        agentModelMapping
      );
      if (!newJob || !newJob.jobId) {
        throw new Error("Tool creation process failed to return a valid job.");
      }
      
      setTestJob(newJob);
      setSavedV2JobIds(prev => new Set(prev).add(newJob.jobId!));
      
      const jobToSave = {
        id: newJob.jobId,
        timestamp: newJob.startTime,
        productToolDefinition: newJob.result as ProductToolDefinition,
        toolConstructionContext: newJob.toolConstructionContext,
      };
      await saveV2JobToDB(jobToSave);
      
      fetchSavedV2Jobs();
      
      addWSLog(`Connecting to WebSocket with new jobId: ${newJob.jobId}...`);
      await connect(newJob.jobId, userId);

      addWSLog(`Job created (${newJob.jobId}). WebSocket connected and ready!`);
      
      // The V2 orchestration is already started by runToolCreationProcess.
      // The redundant call below has been removed.
      setOrchestrationStatus('running_v2');

    } catch (err: any) {
      const errorMessage = err.message || 'An unknown error occurred during tool creation.';
      setError(errorMessage);
      addWSLog(`❌ Error starting V2 job: ${errorMessage}`);
      setOrchestrationStatus('free');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    if (!testJob || orchestrationStatus !== 'running_v2') return;
    addWSLog(`Pausing orchestration for job: ${testJob.jobId}`);
    // Future implementation: API call to pause backend job
  };

  const handleResume = async () => {
    if (!testJob || orchestrationStatus !== 'paused') return;
    addWSLog(`Resuming orchestration for job: ${testJob.jobId}`);
    // Future implementation: API call to resume backend job
  };

  const handleTccFinalization = async () => {
    if (!tccData || !tccData.jobId) {
      setError('Cannot finalize: No TCC data or Job ID available.');
      addDetailedWSLog('error', 'Finalization failed: Missing TCC data or Job ID.');
      return;
    }

    // CRITICAL FIX: Pass the entire up-to-date TCC from the client state
    // instead of just the jobId. This prevents the backend from fetching
    // a stale TCC from the database, resolving the "state management schism".
    // [memory:418492408972825814]
    addDetailedWSLog('debug', 'Starting TCC finalization with full TCC object from client state.', { jobId: tccData.jobId });
    setIsLoading(true);
    setError(null);

    try {
      // The core logic now receives the full TCC and the agent model mapping
      const result = await runTccFinalizationSteps(tccData, agentModelMapping);
      
      addDetailedWSLog('debug', 'TCC finalization successful.', { result });
      
      if (result.success && result.finalProduct) {
        setFinalProduct(result.finalProduct);
        if (result.finalProduct.componentCode) {
          setAssembledCode(result.finalProduct.componentCode);
        }
        
        // Update the testJob state
        setTestJob(prev => ({
          ...(prev ? prev : { jobId: tccData.jobId, startTime: Date.now(), status: 'running' }),
          status: 'success',
          result: result.finalProduct,
          endTime: Date.now(),
          modelId: agentModelMapping[Object.keys(agentModelMapping)[0]] || defaultPrimaryModel || 'gpt-4o'
        }));

        // Automatically save the result
        handleSaveV2Result(result.finalProduct, { ...tccData, finalProduct: result.finalProduct });

      } else {
        throw new Error(result.error || 'Finalization failed to produce a result.');
      }
    } catch (err: any) {
      console.error('Finalization process failed:', err);
      setError(`Finalization failed: ${err.message}`);
      addDetailedWSLog('error', 'TCC finalization failed.', { error: err.message });
      setTestJob(prev => ({
        ...(prev ? prev : { jobId: tccData.jobId, startTime: Date.now(), status: 'running' }),
        status: 'error',
        error: `Finalization failed: ${err.message}`,
        endTime: Date.now(),
        modelId: agentModelMapping[Object.keys(agentModelMapping)[0]] || defaultPrimaryModel || 'gpt-4o'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'fallback':
        return <WifiOff className="h-4 w-4 text-orange-500" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="outline" className="text-xs text-green-700 border-green-300">Live</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-400">Connecting</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-xs">Error</Badge>;
      case 'fallback':
        return <Badge variant="destructive" className="text-xs">Polling Fallback</Badge>;
      case 'polling':
        return <Badge variant="outline" className="text-xs text-blue-700 border-blue-400">Polling</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Offline</Badge>;
    }
  };

  const handleLoadSavedItem = async () => {
    if (!selectedLoadItem) return;

    setIsLoading(true);
    setError(null);
    setTestJob(null);
    setAssembledCode(null);
    // 🛡️ Use safe clear instead of setTccData(null) to maintain backup
    safeClearTcc(false); // Don't preserve backup when loading new item
    setFinalProduct(null);

    try {
        let jobToLoad: ToolCreationJob | null = null;

        if (loadSource === 'indexeddb') {
            if (selectedLoadItem.type === 'v2job') {
                const job = savedV2Jobs.find(j => j.id === selectedLoadItem.id);
                if (job) {
                    jobToLoad = {
                        jobId: job.id,
                        startTime: job.timestamp,
                        endTime: job.timestamp,
                        status: 'completed',
                        result: job.productToolDefinition,
                        productToolDefinition: job.productToolDefinition,
                        modelId: 'unknown', // V2 jobs don't store the modelId in this object
                        toolConstructionContext: job.toolConstructionContext,
                    };
                }
            } else if (selectedLoadItem.type === 'tool') {
                const tool = savedTools.find(t => t.id === selectedLoadItem.id);
                if (tool) {
                    jobToLoad = {
                        jobId: `loaded-tool-${tool.id}`,
                    startTime: tool.createdAt || Date.now(),
                        endTime: Date.now(),
                        status: 'success' as const,
                        result: tool,
                        productToolDefinition: tool,
                        modelId: 'unknown', // Legacy tool, model unknown
                        toolConstructionContext: {
                            jobId: `loaded-tool-${tool.id}`,
                            finalProductToolDefinition: tool,
                            userInput: { prompt: `Loaded from legacy tool: ${tool.metadata.title}` },
                        },
                    };
                }
            }
        } else if (loadSource === 'dynamodb') {
            const tool = dynamoDBTools.find(t => t.id === selectedLoadItem.id);
            if (tool) {
                const mockJobId = `loaded-ddb-${tool.id}`;
                jobToLoad = {
                    jobId: mockJobId,
                    startTime: Date.now(),
                    status: 'success' as const,
                    result: tool,
                    productToolDefinition: tool,
                    modelId: defaultPrimaryModel || 'gpt-4o',
                    toolConstructionContext: {
                        jobId: mockJobId,
                        finalProductToolDefinition: tool,
                        userInput: { prompt: `Loaded from DynamoDB tool: ${tool.metadata.title}` },
                    },
                };
            }
        }

        console.log('DEBUG: Attempting to load item. Final jobToLoad object:', JSON.stringify(jobToLoad, null, 2));

        if (jobToLoad) {
            console.log('DEBUG: jobToLoad is truthy. productToolDefinition:', JSON.stringify(jobToLoad.productToolDefinition, null, 2));
            setTestJob(jobToLoad);
            setAssembledCode(jobToLoad.productToolDefinition?.componentCode || JSON.stringify(jobToLoad.result, null, 2) || '');
            // 🛡️ Use backup system when loading TCC from saved job
            if (jobToLoad.toolConstructionContext) {
              updateTccWithBackup(jobToLoad.toolConstructionContext, 'loaded-job');
            }
            if (selectedLoadItem.type === 'v2job' || selectedLoadItem.type === 'tool') {
              setWorkflowMode('v2' as const);
            }
            setOrchestrationStatus('free' as const);
            addWSLog(`Loaded item: ${selectedLoadItem.id} from ${loadSource}`);
            alert(`Successfully loaded '${jobToLoad.productToolDefinition?.metadata.title}'.`);
        } else {
            const msg = `Could not find the selected item with ID: ${selectedLoadItem.id} in ${loadSource}.`;
            setError(msg);
            alert(`Load failed: Item not found.`);
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load item: ${errorMessage}`);
        console.error(err);
        alert(`Load failed: ${errorMessage}`);
    } finally {
        setIsLoading(false);
        setSelectedLoadItem(null);
    }
  };

  const handleSaveV2Result = async (tool: ProductToolDefinition, tcc: any) => {
    if (!tcc || !tcc.jobId) {
      const errorMsg = 'Cannot save session: Critical tool context (TCC) or Job ID is missing.';
      console.error(errorMsg, { tcc });
      setError(errorMsg);
      addWSLog(`❌ ${errorMsg}`);
      alert('Save Failed: Critical context data is missing.');
      return;
    }

    // Ensure the final tool definition from the TCC is used if available, as it's the source of truth
    const finalTool: ProductToolDefinition = tcc.finalProduct || tool;

    const jobPackage = {
      id: tcc.jobId, // Correct property name is 'id'
      timestamp: Date.now(), // Correct property name is 'timestamp'
      productToolDefinition: finalTool,
      toolConstructionContext: tcc,
    };

    try {
      console.log('📦 Saving session package to IndexedDB:', jobPackage);
      await saveV2JobToDB(jobPackage);
      addWSLog(`✅ Session saved: ${jobPackage.id}`);

      // Refresh the list of saved sessions (formerly V2 jobs)
      await fetchSavedV2Jobs();
      setSavedV2JobIds(prev => new Set([...prev, jobPackage.id]));

      alert('Session saved successfully!');
      console.log('✅ Session save process completed.');

    } catch (error) {
      const errorMessage = `Failed to save session: ${error instanceof Error ? error.message : String(error)}`;
      console.error('❌ Error saving session:', error);
      setError(errorMessage);
      addWSLog(`❌ ${errorMessage}`);
      alert(errorMessage);
    }
  };

  // handleSaveTool is the main entry point from the UI's "Save" button.
  const handleSaveTool = async (tool: ProductToolDefinition) => {
    if (!tccData) {
      setError("Cannot save session: No active tool context available.");
      alert("Save Failed: No active tool context. Please run a job first.");
      return;
    }
    // The `tool` passed here might be stale; the TCC has the latest `finalProduct`.
    await handleSaveV2Result(tool, tccData);
  };

  const handleDeleteSavedItem = async (id: string, type: 'tool' | 'v2job') => {
    try {
      if (type === 'tool') {
        await deleteToolFromDBList(id, userId);
        await fetchSavedTools();
        addWSLog(`Deleted saved tool from BOTH databases: ${id}`);
      } else if (type === 'v2job') {
        await deleteV2JobFromDB(id);
        await fetchSavedV2Jobs();
        addWSLog(`Deleted V2 job: ${id}`);
      }
    } catch (error) {
      console.error('Error deleting saved item:', error);
      setError('Failed to delete saved item. Check console.');
    }
  };

  // Handle deleting saved brainstorms
  const handleDeleteBrainstorm = async (brainstormId: string) => {
    try {
      const { deleteLogicResultFromDB } = await import('../../ui/db-utils');
      await deleteLogicResultFromDB(brainstormId);
      
      // Refresh the brainstorms list using the hook's fetch method
      // The hook should automatically refresh when the data changes
      setSavedBrainstorms(prev => prev.filter(b => b.id !== brainstormId));
      addWSLog(`Brainstorm deleted: ${brainstormId}`);
      
      // If the deleted brainstorm was selected, clear the selection
      if (selectedBrainstormId === brainstormId) {
        setSelectedBrainstormId('');
      }
    } catch (error) {
      console.error('❌ Error deleting brainstorm:', error);
      setError('Failed to delete brainstorm. Check console for details.');
      addWSLog(`Failed to delete brainstorm: ${error}`);
    }
  };

  const handleRefreshTCC = async () => {
    if (testJob?.jobId) {
      setIsRefreshingTCC(true);
      try {
        const response = await fetch(`/api/ai/product-tool-creation-v2/orchestrate/tcc/${testJob.jobId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.tcc) {
            setTccData(data.tcc);
            addWSLog(`TCC refreshed successfully`);
          }
        }
      } catch (error) {
        console.error('Failed to refresh TCC:', error);
        addWSLog(`Failed to refresh TCC: ${error}`);
      } finally {
        setIsRefreshingTCC(false);
      }
    }
  };

  const getSelectedBrainstormDetails = () => {
    return savedBrainstorms.find(b => b.id === selectedBrainstormId);
  }

  const handleStepForward = async () => {
    if (testJob?.jobId) {
      try {
        await fetch(`/api/ai/product-tool-creation-v2/orchestrate/step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: testJob.jobId }),
        });
        setOrchestrationStatus('runone');
        addWSLog(`Step forward executed for job ${testJob.jobId}`);
      } catch (error) {
        console.error('Failed to step forward:', error);
        setError('Failed to step forward in the orchestration process.');
        addWSLog(`Failed to step forward: ${error}`);
      }
    }
  };

  const handleUpdateTool = async (tool: ProductToolDefinition) => {
    try {
      // Update the timestamp to indicate it's been modified
      const updatedTool = {
        ...tool,
        updatedAt: Date.now()
      };
      
      console.log(`🎯 DEBUG: Updating tool ${tool.id} with userId: ${userId}`);
      await saveToolToDBList(updatedTool, userId);
      setSavedToolIds(prev => new Set([...prev, tool.id]));
      console.log(`✅ Tool updated in BOTH IndexedDB AND DynamoDB: ${tool.metadata.title}`);
      addWSLog(`Tool updated in BOTH databases: ${tool.metadata.title}`);
      
      // Refresh the saved tools list to reflect changes
      await fetchSavedTools();
    } catch (error) {
      console.error('❌ Error updating tool in databases:', error);
      setError('Failed to update tool in databases. Check console for details.');
      addWSLog(`Failed to update tool: ${error}`);
    }
  };

  useEffect(() => {
    if (availableAgents.length > 0) {
      setSelectedAgent(availableAgents[0].id);
    }
  }, [availableAgents]);

  return (
    <ToolTesterView
      testJob={testJob}
      getConnectionStatusIcon={getConnectionStatusIcon}
      getConnectionStatusBadge={getConnectionStatusBadge}
      error={error || dataError}
      selectedBrainstormId={selectedBrainstormId}
      setSelectedBrainstormId={setSelectedBrainstormId}
      selectedMockScenarioId={selectedMockScenarioId}
      setSelectedMockScenarioId={setSelectedMockScenarioId}
      selectedDebugTccJobId={selectedDebugTccJobId}
      setSelectedDebugTccJobId={setSelectedDebugTccJobId}
      setSelectedAgent={setSelectedAgent}
      orchestrationStatus={orchestrationStatus}
      setOrchestrationStatus={setOrchestrationStatus}
      savedBrainstorms={savedBrainstorms}
      savedTools={savedTools}
      savedV2Jobs={savedV2Jobs}
      selectedLoadItem={selectedLoadItem}
      setSelectedLoadItem={setSelectedLoadItem}
      loadMode={loadMode}
      setLoadMode={setLoadMode}
      workflowMode={workflowMode}
      setWorkflowMode={setWorkflowMode}
      selectedModelIds={selectedModelIds}
      handleModelToggle={handleModelToggle}
      defaultPrimaryModel={defaultPrimaryModel}
      availableModels={availableModels}
      handleLoadSavedItem={handleLoadSavedItem}
      handleDeleteSavedItem={handleDeleteSavedItem}
      handleDeleteBrainstorm={handleDeleteBrainstorm}
      handleRefreshTCC={handleRefreshTCC}
      getSelectedBrainstormDetails={getSelectedBrainstormDetails}
      isLoading={isLoading}
      selectedAgent={selectedAgent}
      agentModelMapping={agentModelMapping}
      setAgentModelMapping={setAgentModelMapping}
      tccSource={tccSource}
      setTccSource={setTccSource}
      availableAgents={availableAgents}
      handleAgentModelChange={handleAgentModelChange}
      handleSubmit={handleSubmit}
      handleResume={handleResume}
      handlePause={handlePause}
      handleSaveV2Result={handleSaveV2Result}
      savedToolIds={savedToolIds}
      savedV2JobIds={savedV2JobIds}
      handleStepForward={handleStepForward}
      progressUpdates={progressUpdates}
      assembledCode={assembledCode}
      tccData={tccData}
      getModelsUsed={getModelsUsed}
      isDarkMode={isDarkMode}
      wsLogs={wsLogs}
      setWsLogs={setWsLogs}
      wsLogsEndRef={wsLogsEndRef}
      progressSummaryEndRef={progressSummaryEndRef}
      isRefreshingTCC={isRefreshingTCC}
      connectionStatus={connectionStatus}
      wsDebugInfo={wsDebugInfo}
      handleSaveTool={handleSaveTool}
      handleUpdateTool={handleUpdateTool}
      agentMode={agentMode}
      setAgentMode={setAgentMode}
      handleTccFinalization={handleTccFinalization}
      loadSource={loadSource}
      setLoadSource={setLoadSource}
      dynamoDBTools={dynamoDBTools}
      editMessage={editMessage}
      setEditMessage={setEditMessage}
      // 🛡️ TCC PERSISTENCE: Recovery functionality props
      hasTccBackup={hasTccBackup}
      tccHistory={tccHistory}
      recoverLastValidTcc={recoverLastValidTcc}
      handleSaveTccSnapshot={handleSaveTccSnapshot}
      handleLoadTccSnapshot={handleLoadTccSnapshot}
    />
  );
};

export default ToolTester;