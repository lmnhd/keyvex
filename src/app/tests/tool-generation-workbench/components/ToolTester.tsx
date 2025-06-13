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
  migrateLegacySavedLogicResult,
  isBrainstormResult
} from './tool-tester-parts/tool-tester-types';
import { useToolTesterData } from '../hooks/useToolTesterData';
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

  const [selectedBrainstormId, setSelectedBrainstormId] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMode, setLoadMode] = useState<'new' | 'load'>('new');
  const [selectedLoadItem, setSelectedLoadItem] = useState<{ type: 'brainstorm' | 'tool' | 'v2job', id: string } | null>(null);
  const [testJob, setTestJob] = useState<ToolCreationJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assembledCode, setAssembledCode] = useState<string | null>(null);
  const [finalProduct, setFinalProduct] = useState<ProductToolDefinition | null>(null);
  const [savedToolIds, setSavedToolIds] = useState<Set<string>>(new Set());
  const [savedV2JobIds, setSavedV2JobIds] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Agent model mapping for individual agent testing
  const [agentModelMapping, setAgentModelMapping] = useState<AgentModelMapping>({});
  
  // NEW: workflowMode to distinguish between V1, V2 orchestration, and debug mode
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('v2');
  const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatus>('free');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [tccSource, setTccSource] = useState<TccSource>('brainstorm');
  const [selectedDebugTccJobId, setSelectedDebugTccJobId] = useState<string | null>(null);
  const [selectedMockScenarioId, setSelectedMockScenarioId] = useState<string>('');
  
  // Phase 3.2: Agent mode for create/edit toggle in debug section
  const [agentMode, setAgentMode] = useState<AgentMode>('create');
  const [editMessage, setEditMessage] = useState('');
  
  // TCC monitoring state
  const [tccData, setTccData] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isRefreshingTCC, setIsRefreshingTCC] = useState(false);

  // WebSocket logging state
  const [wsLogs, setWsLogs] = useState<string[]>([]);
  const [streamingExample, setStreamingExample] = useState<string>('');
  
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
    { id: 'validator', name: 'Validator Agent', description: 'Validates generated code' },
    { id: 'tool-finalizer', name: 'Tool Finalizer', description: 'Creates final tool definition' }
  ], []);

  const addWSLog = useCallback((message: string) => {
    setWsLogs(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  // Enhanced WebSocket logging with detailed console output like the test page
  const addDetailedWSLog = useCallback((type: 'connection' | 'message' | 'error' | 'debug', message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    
    // Add to UI logs
    setWsLogs(prev => [...prev.slice(-19), logMessage]);
    
    // Enhanced console logging like the test page
    if (type === 'connection') {
      console.log(`🔗 [WebSocket Connection] ${message}`, data);
    } else if (type === 'message') {
      console.log(`📨 [WebSocket Message] ${message}`, data);
    } else if (type === 'error') {
      console.error(`❌ [WebSocket Error] ${message}`, data);
    } else if (type === 'debug') {
      console.log(`🐛 [WebSocket Debug] ${message}`, data);
    }
  }, []);

  // Clear logs function
  const clearLogsAndProgress = useCallback(() => {
    setWsLogs([]);
    setProgressUpdates && setProgressUpdates([]);
    setCurrentStep('');
    setError(null);
    addWSLog('🧹 Logs cleared - starting fresh test');
  }, [addWSLog]);

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

  const handleJobUpdate = useCallback((progress: StepProgress) => {
    addWSLog(progress.message || `Progress for ${progress.stepName}: ${progress.status}`);
    setCurrentStep(progress.stepName);

    // Handle TCC data - could be nested or direct
    let actualTcc = progress.data;
    if (progress.data?.tcc) {
      // If data has a nested tcc property, use that
      actualTcc = progress.data.tcc;
    } else if (progress.data?.userId || progress.data?.jobId) {
      // If data looks like a TCC itself, use it directly
      actualTcc = progress.data;
    }

    if (actualTcc) {
      setTccData(actualTcc);
      if (actualTcc.assembledComponentCode) {
        setAssembledCode(actualTcc.assembledComponentCode);
        addWSLog('✅ Assembled code received from TCC update!');
      }
    }

    // Handle final tool completion
    if (progress.stepName === 'finalizing_tool' && progress.status === 'completed' && progress.data) {
      // Check if finalProduct is nested in the data or if data is the product itself
      const finalProductData = progress.data.finalProduct || progress.data;
      
      if (finalProductData && (finalProductData.id || finalProductData.componentCode)) {
        setFinalProduct(finalProductData);
        if (finalProductData.componentCode) {
          setAssembledCode(finalProductData.componentCode);
        }
        addWSLog('✅ Final product received!');

        setTestJob(prev => ({
          ...(prev as ToolCreationJob),
          status: 'success',
          result: finalProductData,
          endTime: Date.now()
        }));
      } else {
        addWSLog('⚠️ Final tool step completed but no valid product data found');
        console.warn('Final tool data structure:', progress.data);
      }
    }
  }, [addWSLog, assembledCode]);

  // Enhanced progress monitoring with detailed logging
  const enhancedHandleJobUpdate = useCallback((progress: StepProgress) => {
    // Log detailed progress information
    addDetailedWSLog('message', `Step Progress: ${progress.stepName} -> ${progress.status}`, {
      jobId: progress.jobId,
      message: progress.message,
      dataKeys: progress.data ? Object.keys(progress.data) : [],
      isFallback: progress.isFallback
    });
    
    // Call the original handler
    handleJobUpdate(progress);
  }, [handleJobUpdate, addDetailedWSLog]);

  const { connect, disconnect, connectionStatus, progressUpdates, messages, setProgressUpdates } = useToolGenerationStream({ 
    onProgress: enhancedHandleJobUpdate,
    onMessage: (message) => {
      addDetailedWSLog('message', `WebSocket message received: ${message.type}`, message.data);
    },
    onError: (error) => {
      addDetailedWSLog('error', `WebSocket error: ${error}`);
    }
  }) as any; // Add type assertion since connect is now async


  // Enhanced connection monitoring
  useEffect(() => {
    if (connectionStatus === 'connected') {
      addDetailedWSLog('connection', 'WebSocket connection established successfully');
    } else if (connectionStatus === 'connecting') {
      addDetailedWSLog('connection', 'Attempting WebSocket connection...');
    } else if (connectionStatus === 'error') {
      addDetailedWSLog('error', 'WebSocket connection failed');
    } else if (connectionStatus === 'fallback') {
      addDetailedWSLog('debug', 'Using fallback mode - no real WebSocket connection');
    }
  }, [connectionStatus, addDetailedWSLog]);

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
    } else if (workflowMode === 'v2') {
      // For V2 orchestration, return all models in agent mapping
      return Object.values(agentModelMapping).filter((model, index, arr) => arr.indexOf(model) === index);
    } else {
      // For V1 mode, return selected model IDs
      return selectedModelIds;
    }
  }, [workflowMode, selectedAgent, agentModelMapping, selectedModelIds]);

  // Initialize selections from localStorage or defaults when data is available
  useEffect(() => {
    if (availableModels.length > 0 && !hasInitialized) {
      console.log('🔄 Initializing model selections...', {
        availableModelsCount: availableModels.length,
        defaultPrimaryModel,
        hasInitialized
      });
    
      // First try to load from localStorage
      const storedSelectedModels = loadFromLocalStorage(STORAGE_KEYS.selectedModels, []);
      const storedAgentMapping = loadFromLocalStorage(STORAGE_KEYS.agentMapping, {});
      
      console.log('📦 Loaded from localStorage:', {
        storedSelectedModels,
        storedAgentMapping
      });
      
      // Validate stored models exist in current available models
      const validStoredModels = storedSelectedModels.filter((modelId: string) => 
        availableModels.some(m => m.id === modelId)
      );
      
      if (validStoredModels.length > 0) {
        // Use stored selections
        setSelectedModelIds(validStoredModels);
        
        // Validate and set stored agent mapping
        const validAgentMapping: AgentModelMapping = {};
        availableAgents.forEach(agent => {
          const storedModel = storedAgentMapping[agent.id];
          if (storedModel && availableModels.some(m => m.id === storedModel)) {
            validAgentMapping[agent.id] = storedModel;
          } else {
            validAgentMapping[agent.id] = getDefaultModelForAgent(agent.id);
          }
        });
        setAgentModelMapping(validAgentMapping);
        
        console.log('✅ Loaded from localStorage', {
          validStoredModels,
          validAgentMapping
        });
      } else {
        // Fall back to default model logic regardless of defaultPrimaryModel availability
        const targetDefaultId = defaultPrimaryModel || 'gpt-4.1-mini';
        const defaultModel = availableModels.find(m => m.id === targetDefaultId) || 
                            availableModels.find(m => m.id === 'gpt-4.1-mini') || 
                            availableModels.find(m => m.id === 'gpt-4o') ||
                            availableModels[0];
        
        if (defaultModel) {
          const defaultModels = [defaultModel.id];
          setSelectedModelIds(defaultModels);
          saveToLocalStorage(STORAGE_KEYS.selectedModels, defaultModels);
          
          // Initialize agent model mapping
          const initialMapping: AgentModelMapping = {};
          availableAgents.forEach(agent => {
            initialMapping[agent.id] = getDefaultModelForAgent(agent.id);
          });
          setAgentModelMapping(initialMapping);
          saveToLocalStorage(STORAGE_KEYS.agentMapping, initialMapping);
          
          console.log('✅ Initialized with defaults', {
            defaultModel: defaultModel.id,
            defaultModels,
            initialMapping
          });
        }
      }
      
      setHasInitialized(true);
    }
  }, [availableModels, hasInitialized, defaultPrimaryModel, availableAgents, getDefaultModelForAgent, loadFromLocalStorage, saveToLocalStorage]);

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
    // Clear logs and progress indicators when starting new test
    clearLogsAndProgress();
    
    // For load mode, we don't need to generate - the user should use the Load Selected Item button
    if (loadMode === 'load') {
      setError("Please use the 'Load Selected Item' button in the Load Saved Items section to load an existing item.");
      return;
    }
    
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
        
        if (result.data?.updatedTcc) {
          setTccData(result.data.updatedTcc);
          if (result.data.updatedTcc.styling?.styledComponentCode) {
            setAssembledCode(result.data.updatedTcc.styling.styledComponentCode);
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
    
    if (!selectedBrainstormId || selectedModelIds.length === 0) {
      setError("Please select a brainstorm and at least one model.");
      return;
    }
    setError(null);
    setTestJob(null);
    setAssembledCode(null);
    setFinalProduct(null);
    setWsLogs([]);
    setTccData(null);
    setCurrentStep('');

    const brainstorm = savedBrainstorms.find(b => b.id === selectedBrainstormId);
    if (!brainstorm) {
      setError("Selected brainstorm data not found.");
      return;
    }
    
    setIsLoading(true);

    try {
      addWSLog(`Connecting to WebSocket first...`);

      // CRITICAL FIX: Create a single UUID that will be used throughout the entire process
      const jobId = uuidv4();
      
      // Connect with the SAME jobId that will be used for the actual process
      await connect(jobId, userId);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addWSLog(`WebSocket connected. Starting V2 orchestration with jobId: ${jobId}...`);
      
      // CRITICAL FIX: Convert legacy format to unified format
      // savedBrainstorms contains legacy SavedLogicResult format, but runToolCreationProcess expects BrainstormResult
      let unifiedBrainstorm;
      if (isBrainstormResult(brainstorm)) {
        // Already in unified format
        unifiedBrainstorm = brainstorm;
        addWSLog(`✅ Brainstorm is already in unified format`);
      } else {
        // Convert from legacy format to unified format
        addWSLog(`🔄 Converting legacy brainstorm format to unified format...`);
        unifiedBrainstorm = migrateLegacySavedLogicResult(brainstorm);
        addWSLog(`✅ Legacy brainstorm converted to unified format`);
      }
      
      // Pass the unified brainstorm to ensure consistency
      const newJob = await runToolCreationProcess(
        unifiedBrainstorm, // ✅ Pass the unified brainstorm object
        selectedModelIds[0],
        agentModelMapping,
        jobId // CRITICAL: Pass the same jobId
      );

      setTestJob(newJob);

      if (newJob.jobId && newJob.status !== 'error') {
        addWSLog(`Job created (${newJob.jobId}). WebSocket already connected and ready!`);
      } else {
        throw new Error(newJob.error || 'Job creation failed without a specific error.');
      }

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'An unknown error occurred';
      setError(errorMsg);
      addWSLog(`Error during orchestration start: ${errorMsg}`);
      setTestJob(prev => ({
          ...(prev || { modelId: selectedModelIds[0] || 'unknown', startTime: Date.now() }),
          status: 'error',
          error: errorMsg,
          endTime: Date.now()
      }));
      disconnect();
    } finally {
      setIsLoading(false);
    }
  };
  // ...

  const handlePause = async () => {
    if (testJob?.jobId) {
      try {
        await fetch(`/api/ai/product-tool-creation-v2/orchestrate/pause`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: testJob.jobId }),
        });
        setOrchestrationStatus('paused');
        addWSLog(`Orchestration paused for job ${testJob.jobId}`);
        connect(testJob.jobId, userId);
      } catch (error) {
        console.error('Failed to pause orchestration:', error);
        setError('Failed to pause the orchestration process.');
        addWSLog(`Failed to pause orchestration: ${error}`);
      }
    }
  };

  const handleResume = async () => {
    if (testJob?.jobId) {
      try {
        await fetch(`/api/ai/product-tool-creation-v2/orchestrate/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: testJob.jobId }),
        });
        setOrchestrationStatus('free');
        addWSLog(`Orchestration resumed for job ${testJob.jobId}`);
        connect(testJob.jobId, userId);
      } catch (error) {
        console.error('Failed to resume orchestration:', error);
        setError('Failed to resume the orchestration process.');
        addWSLog(`Failed to resume orchestration: ${error}`);
      }
    }
  };

  // ...

  const handleTccFinalization = async () => {
    if (!testJob?.result || !('updatedTcc' in testJob.result)) {
      setError('No TCC data available for finalization. Run an agent test first.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      addWSLog(`Starting TCC Finalization - running final 3 steps...`);
      connect(testJob.jobId, userId);

      const tccData = (testJob.result as any).updatedTcc;
      const result = await runTccFinalizationSteps(tccData, agentModelMapping);

      if (result.success && result.finalProduct) {
        // Update the test job with the final product
        setTestJob(prev => ({
          ...(prev as ToolCreationJob),
          status: 'success',
          result: result.finalProduct,
          endTime: Date.now()
        }));

        setFinalProduct(result.finalProduct);
        if (result.finalProduct.componentCode) {
          setAssembledCode(result.finalProduct.componentCode);
        }
        
        addWSLog('✅ TCC Finalization completed successfully!');
        addWSLog(`📦 Final tool: ${result.finalProduct.metadata?.title || 'Generated Tool'}`);
      } else {
        throw new Error(result.error || 'Finalization failed');
      }
    } catch (error) {
      console.error('❌ TCC Finalization error:', error);
      setError(error instanceof Error ? error.message : String(error));
      addWSLog(`❌ Finalization failed: ${error}`);
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

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'WebSocket Connected';
      case 'fallback':
        return 'FALLBACK MODE (In-Memory)';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Disconnected';
    }
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="outline" className="text-xs text-green-700 border-green-300">Real WebSocket</Badge>;
      case 'fallback':
        return <Badge variant="destructive" className="text-xs">FALLBACK MODE</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300">Connecting</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-xs">Error</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Disconnected</Badge>;
    }
  };

  const handleLoadSavedItem = async () => {
    if (!selectedLoadItem) return;

    setIsLoading(true);
    setError(null);
    setTestJob(null);
    setAssembledCode(null);
    setTccData(null);
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
            setTccData(jobToLoad.toolConstructionContext || null);
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
    if (!tool || !tcc || !tcc.jobId) {
      setError('Cannot save V2 result: Missing tool definition or TCC with jobId.');
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`Saving V2 result for job ID: ${tcc.jobId}`);
    try {
      // Step 1: Save the full job package to the correct IndexedDB table.
      const jobPackage = {
        id: tcc.jobId,
        timestamp: Date.now(),
        productToolDefinition: tool,
        toolConstructionContext: tcc,
      };
      await saveV2JobToDB(jobPackage);
      console.log('✅ V2 job saved to IndexedDB table: v2ToolCreationJobs');

      // Step 2: Save the tool definition to DynamoDB.
      await saveToolToDynamoDBOnly(tool, userId);
      console.log('✅ Tool saved to DynamoDB.');

      // Step 3: Update UI state.
      setSavedV2JobIds(prev => new Set(prev).add(tcc.jobId));
      await fetchSavedV2Jobs(); // Refresh the list of saved V2 jobs
      
      alert('V2 result saved successfully to IndexedDB and DynamoDB!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(`Failed to save V2 result: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTool = async (tool: ProductToolDefinition) => {
    if (!tccData) {
        setError("Cannot save tool: No active V2 test job context available.");
        alert("Save failed: No active V2 test job context. Please run a V2 job first.");
        return;
    }
    // Delegate to the correct V2 save handler to ensure consistent behavior
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
    />
  );
};

export default ToolTester;
