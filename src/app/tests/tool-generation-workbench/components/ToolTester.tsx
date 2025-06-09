'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Loader2, TestTube2, AlertCircle, CheckCircle, Code, Eye, Info, Save, Wand2, Pause, Play, StepForward, Bug, Zap, Settings, Database, Wifi, WifiOff } from 'lucide-react';
import {
  loadLogicResultsFromDB,
  runToolCreationProcess,
  ToolCreationJob,
  SavedLogicResult
} from './tool-tester-core-logic';
import { saveToolToDBList, saveV2JobToDB } from '../../ui/db-utils';
import { CanvasTool } from '@/components/tool-creator-ui/canvas-tool';
import DEFAULT_MODELS from '@/lib/ai/models/default-models.json';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { useToolGenerationStream, StepProgress, ConnectionStatus } from '../hooks/useToolGenerationStream';
import ProgressLog from './ProgressLog';
import TCCVisualizer from './TCCVisualizer';

interface ModelOption {
  id: string;
  name: string;
  provider?: string;
}

interface AgentModelMapping {
  [agentName: string]: string;
}

type WorkflowMode = 'v1' | 'v2' | 'debug';
type OrchestrationStatus = 'free' | 'paused' | 'runone';

const ToolTester: React.FC<{ isDarkMode: boolean, newBrainstormFlag?: number }> = ({ isDarkMode, newBrainstormFlag }) => {
  const [savedBrainstorms, setSavedBrainstorms] = useState<SavedLogicResult[]>([]);
  const [selectedBrainstormId, setSelectedBrainstormId] = useState<string | undefined>(undefined);
  
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]); // Multiple model selection (up to 5)
  const [agentModelMapping, setAgentModelMapping] = useState<AgentModelMapping>({});

  // LocalStorage keys
  const STORAGE_KEYS = {
    selectedModels: 'keyvex-tool-tester-selected-models',
    agentMapping: 'keyvex-tool-tester-agent-mapping'
  };

  const [isLoading, setIsLoading] = useState(false);
  const [testJob, setTestJob] = useState<ToolCreationJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedToolIds, setSavedToolIds] = useState<Set<string>>(new Set());
  const [savedV2JobIds, setSavedV2JobIds] = useState<Set<string>>(new Set());
  const [defaultPrimaryModel, setDefaultPrimaryModel] = useState<string | null>(null);
  const [assembledCode, setAssembledCode] = useState<string | null>(null);
  const [finalProduct, setFinalProduct] = useState<any>(null);

  // New state for advanced controls
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('v2');
  const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatus>('free');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  
  // TCC monitoring state
  const [tccData, setTccData] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isRefreshingTCC, setIsRefreshingTCC] = useState(false);

  // WebSocket logging state
  const [wsLogs, setWsLogs] = useState<string[]>([]);
  const [streamingExample, setStreamingExample] = useState<string>('');

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
      if (actualTcc.assembledComponentCode && !assembledCode) {
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

  const { connect, disconnect, connectionStatus, progressUpdates, messages }:{ connect: (jobId: string) => Promise<void>,
    disconnect: () => void, connectionStatus: ConnectionStatus, progressUpdates: StepProgress[], messages: any } = useToolGenerationStream({ 
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

  // Fetch the configured default model from the toolCreator API
  const fetchDefaultModel = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/create-tool'); 
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.defaultModel?.primary?.id) {
          setDefaultPrimaryModel(data.defaultModel.primary.id);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch default model, using fallback:', error);
    }
  }, []);

  const fetchModels = useCallback(() => {
    console.log('🔄 Starting fetchModels...');
    console.log('DEFAULT_MODELS structure:', DEFAULT_MODELS);
    
    try {
      const parsedModels: ModelOption[] = [];
      
      if (!DEFAULT_MODELS || !DEFAULT_MODELS.providers) {
        console.error('❌ DEFAULT_MODELS or providers is undefined!');
        setError('DEFAULT_MODELS data is not properly loaded.');
        return;
      }
      
      console.log('📁 Found providers:', Object.keys(DEFAULT_MODELS.providers));
      
      for (const providerKey in DEFAULT_MODELS.providers) {
        const provider = (DEFAULT_MODELS.providers as any)[providerKey];
        console.log(`🏢 Processing provider: ${providerKey}`, provider);
        
        if (!provider || !provider.models) {
          console.warn(`⚠️ Provider ${providerKey} has no models`);
          continue;
        }
        
        console.log(`📋 Found ${Object.keys(provider.models).length} models in ${providerKey}`);
        
        for (const modelKey in provider.models) {
          const model = (provider.models as any)[modelKey];
          console.log(`🤖 Processing model: ${modelKey}`, model);
          
          // Skip deprecated models (but only if explicitly marked as deprecated)
          if (model.deprecated === true) {
            console.log(`⚠️ Skipping deprecated model: ${modelKey}`);
            continue;
          }
          
          if (!model.id || !model.name) {
            console.warn(`⚠️ Model ${modelKey} missing id or name:`, model);
            continue;
          }
          
          // Include all non-deprecated models
          const modelOption = { 
            id: model.id, 
            name: `${model.name} (${provider.name})`,
            provider: provider.name
          };
          console.log(`✅ Adding model:`, modelOption);
          parsedModels.push(modelOption);
        }
      }
      
      console.log(`🎯 Final result: Loaded ${parsedModels.length} models:`, parsedModels);
      
      if (parsedModels.length === 0) {
        console.error('❌ No models were loaded! This is a problem.');
        setError('No AI models were found in the configuration.');
      } else {
        setAvailableModels(parsedModels);
      }
    } catch (err) {
      console.error('❌ Failed to parse models:', err);
      setError('Failed to load AI models from default-models.json. Check console.');
    }
  }, []);

  const fetchBrainstorms = useCallback(async () => {
    try {
      setIsLoading(true);
      const results = await loadLogicResultsFromDB();
      setSavedBrainstorms(results);
      setError(null);
    } catch (err) {
      console.error('Failed to load saved brainstorms:', err);
      setError('Failed to load saved brainstorms. Check console.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize selections from localStorage or defaults when data is available
  const [hasInitialized, setHasInitialized] = useState(false);
  
  useEffect(() => {
    if (availableModels.length > 0 && !hasInitialized) {
      console.log('🔄 Initializing model selections...');
    
      // First try to load from localStorage
      const storedSelectedModels = loadFromLocalStorage(STORAGE_KEYS.selectedModels, []);
      const storedAgentMapping = loadFromLocalStorage(STORAGE_KEYS.agentMapping, {});
      
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
        
        console.log('✅ Loaded from localStorage');
      } else if (defaultPrimaryModel) {
        // Fall back to default model logic
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
          
          console.log('✅ Initialized with defaults');
        }
      }
      
      setHasInitialized(true);
    }
  }, [availableModels.length, hasInitialized, defaultPrimaryModel]);

  // Set first brainstorm as default when available
  useEffect(() => {
    if (savedBrainstorms.length > 0 && !selectedBrainstormId) {
      setSelectedBrainstormId(savedBrainstorms[0].id);
    }
  }, [savedBrainstorms, selectedBrainstormId]);

  useEffect(() => {
    fetchDefaultModel();
    fetchModels();
    fetchBrainstorms();
  }, [newBrainstormFlag]); // Only depend on newBrainstormFlag, not the functions

  const handleModelToggle = (modelId: string, checked: boolean) => {
    let newSelectedIds: string[];
    if (checked && selectedModelIds.length < 5) {
      newSelectedIds = [...selectedModelIds, modelId];
    } else if (!checked) {
      newSelectedIds = selectedModelIds.filter(id => id !== modelId);
    } else {
      return; // No change needed
    }
    
    setSelectedModelIds(newSelectedIds);
    saveToLocalStorage(STORAGE_KEYS.selectedModels, newSelectedIds);
  };

  const handleAgentModelChange = (agentId: string, modelId: string) => {
    const newMapping = {
      ...agentModelMapping,
      [agentId]: modelId
    };
    
    setAgentModelMapping(newMapping);
    saveToLocalStorage(STORAGE_KEYS.agentMapping, newMapping);
  };

  const handleSubmit = async () => {
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
    
    // Set loading state and clear previous results
    setIsLoading(true);

    try {
      addWSLog(`Connecting to WebSocket first...`);
      
      // Connect to WebSocket BEFORE starting orchestration to ensure DynamoDB storage
      const tempJobId = `temp-${Date.now()}`;
      await connect(tempJobId);
      
      // Wait a moment for WebSocket connection to be stored in DynamoDB
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addWSLog(`WebSocket connected. Starting V2 orchestration...`);
      
      const newJob = await runToolCreationProcess(
        brainstorm,
        selectedModelIds[0],
        agentModelMapping
      );

      setTestJob(newJob); // Set the job state immediately to keep the UI persistent

      if (newJob.jobId && newJob.status !== 'error') {
        addWSLog(`Job created (${newJob.jobId}). WebSocket already connected and ready!`);
        // WebSocket is already connected, no need to reconnect
      } else {
        throw new Error(newJob.error || 'Job creation failed without a specific error.');
      }

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'An unknown error occurred';
      setError(errorMsg);
      addWSLog(`Error during orchestration start: ${errorMsg}`);
      // Update the existing job state with the error, rather than replacing it
      setTestJob(prev => ({
          ...(prev || { modelId: selectedModelIds[0] || 'unknown' }),
          status: 'error',
          error: errorMsg,
          endTime: Date.now()
      }));
      disconnect();
    } finally {
      setIsLoading(false);
    }
  };

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
      } catch (error) {
        console.error('Failed to resume orchestration:', error);
        setError('Failed to resume the orchestration process.');
        addWSLog(`Failed to resume orchestration: ${error}`);
      }
    }
  };

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

  const handleSaveTool = async (tool: ProductToolDefinition) => {
    try {
      await saveToolToDBList(tool);
      setSavedToolIds(prev => new Set([...prev, tool.id]));
      console.log(`✅ Tool saved to IndexedDB: ${tool.metadata.title}`);
      addWSLog(`Tool saved: ${tool.metadata.title}`);
    } catch (error) {
      console.error('❌ Error saving tool to IndexedDB:', error);
      setError('Failed to save tool to IndexedDB. Check console for details.');
      addWSLog(`Failed to save tool: ${error}`);
    }
  };

  const handleSaveV2Result = async (tool: ProductToolDefinition, tcc: any) => {
    if (!tcc || !tool) {
      setError('Cannot save result, TCC or Tool definition is missing.');
      return;
    }
    try {
      const jobPackage = {
        id: tcc.jobId,
        timestamp: Date.now(),
        productToolDefinition: tool,
        toolConstructionContext: tcc,
      };
      await saveV2JobToDB(jobPackage);
      setSavedV2JobIds(prev => new Set(prev).add(tcc.jobId));
      addWSLog(`V2 Result for job ${tcc.jobId} saved.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to save V2 result: ${msg}`);
      addWSLog(`Failed to save V2 result: ${msg}`);
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Wand2 className="mr-2 h-6 w-6 text-purple-500" /> 
          Enhanced Tool Generation Workbench
          <div className="ml-auto flex items-center gap-2">
            {getConnectionStatusIcon()}
            {getConnectionStatusBadge()}
          </div>
        </CardTitle>
        <CardDescription>Advanced tool creation with multi-model selection, real-time streaming, and granular agent control.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="selectedBrainstorm">1. Select Saved Brainstorm</Label>
              <Select 
                value={selectedBrainstormId}
                onValueChange={setSelectedBrainstormId} 
                disabled={isLoading || savedBrainstorms.length === 0}
              >
                <SelectTrigger id="selectedBrainstorm">
                  <SelectValue placeholder={savedBrainstorms.length === 0 ? "No brainstorms saved" : "Choose a brainstorm"} />
                </SelectTrigger>
                <SelectContent>
                  {savedBrainstorms.map(bs => (
                    <SelectItem key={bs.id} value={bs.id}>
                      {bs.toolType} for {bs.targetAudience} (Saved: {new Date(bs.timestamp).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBrainstormId && getSelectedBrainstormDetails() && (
              <Card className="bg-gray-50 dark:bg-gray-800/50">
                <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center"><Info className="mr-2 h-4 w-4 text-blue-500"/>Selected Brainstorm Details</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                    <p><strong>Tool Type:</strong> {getSelectedBrainstormDetails()?.toolType}</p>
                    <p><strong>Target:</strong> {getSelectedBrainstormDetails()?.targetAudience}</p>
                    <details className="mt-1">
                        <summary className="cursor-pointer font-medium">View Full Input Data</summary>
                        <pre className="mt-1 p-1.5 bg-white dark:bg-gray-700/50 rounded-md overflow-x-auto max-h-32 text-[10px]">
                        {JSON.stringify(getSelectedBrainstormDetails()?.result?.userInput || getSelectedBrainstormDetails()?.result, null, 2)}
                        </pre>
                    </details>
                </CardContent>
              </Card>
            )}
          </div>


        </div>

        <div className="space-y-4">
          <Label>2. Select Workflow Mode</Label>
          
          <Tabs value={workflowMode} onValueChange={(value) => setWorkflowMode(value as WorkflowMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="v1" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                V1 Legacy
              </TabsTrigger>
              <TabsTrigger value="v2" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                V2 Orchestration
              </TabsTrigger>
              <TabsTrigger value="debug" className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug & Inspect
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="v1" className="mt-4">
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">V1 Legacy Mode</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">Uses the original monolithic tool creation approach. Single API call, no streaming.</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label>Model Selection (Max 5)</Label>
                    <div className="rounded-md border bg-blue-50/50 dark:bg-blue-900/10 p-4">
                      {availableModels.length > 0 ? (
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {availableModels.map(model => (
                              <div key={model.id} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`v1-model-${model.id}`}
                                  checked={selectedModelIds.includes(model.id)}
                                  onCheckedChange={(checked) => handleModelToggle(model.id, checked as boolean)}
                                  disabled={isLoading || (!selectedModelIds.includes(model.id) && selectedModelIds.length >= 5)}
                                />
                                <Label htmlFor={`v1-model-${model.id}`} className="text-sm font-normal cursor-pointer flex items-center">
                                  {model.name}
                                  {model.id === defaultPrimaryModel && (
                                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md">
                                      Default
                                    </span>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-500">Loading models...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="v2" className="mt-4">
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-green-600" />
                    <div>
                      <h4 className="font-medium text-green-900 dark:text-green-100">V2 Multi-Agent Orchestration</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">Advanced multi-agent workflow with real-time progress streaming via WebSocket.</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label>Agent-Specific Model Configuration</Label>
                    <div className="rounded-md border bg-green-50/50 dark:bg-green-900/10 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availableAgents.map(agent => (
                          <div key={agent.id} className="space-y-2">
                            <Label htmlFor={`agent-model-${agent.id}`} className="text-sm font-medium" title={agent.description}>
                              {agent.name}
                            </Label>
                            <Select
                              value={agentModelMapping[agent.id] || ''}
                              onValueChange={(value) => handleAgentModelChange(agent.id, value)}
                              disabled={selectedModelIds.length === 0 || isLoading}
                            >
                              <SelectTrigger id={`agent-model-${agent.id}`} className="h-9">
                                <SelectValue placeholder="Select model..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableModels.map(model => (
                                  <SelectItem key={model.id} value={model.id}>
                                    {model.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="debug" className="mt-4">
              <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Bug className="h-5 w-5 text-red-600" />
                    <div>
                      <h4 className="font-medium text-red-900 dark:text-red-100">Debug & Inspect Mode</h4>
                      <p className="text-sm text-red-700 dark:text-red-300">Test individual agents in isolation with model assignment per agent.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="agent-select">Select Agent to Test</Label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger id="agent-select">
                        <SelectValue placeholder="Choose an agent to test..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAgents.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{agent.name}</span>
                              <span className="text-xs text-muted-foreground">{agent.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedAgent && (
                    <div className="space-y-2">
                      <Label>Model for {availableAgents.find(a => a.id === selectedAgent)?.name}</Label>
                      <Select 
                        value={agentModelMapping[selectedAgent] || ''} 
                        onValueChange={(value) => handleAgentModelChange(selectedAgent, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose model for this agent..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <Label>Available Models (for context)</Label>
                    <div className="rounded-md border bg-red-50/50 dark:bg-red-900/10 p-4">
                      {availableModels.length > 0 ? (
                        <ScrollArea className="h-32">
                          <div className="space-y-2">
                            {availableModels.map(model => (
                              <div key={model.id} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`debug-model-${model.id}`}
                                  checked={selectedModelIds.includes(model.id)}
                                  onCheckedChange={(checked) => handleModelToggle(model.id, checked as boolean)}
                                  disabled={isLoading || (!selectedModelIds.includes(model.id) && selectedModelIds.length >= 5)}
                                />
                                <Label htmlFor={`debug-model-${model.id}`} className="text-sm font-normal cursor-pointer flex items-center">
                                  {model.name}
                                  {model.id === defaultPrimaryModel && (
                                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md">
                                      Default
                                    </span>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-500">Loading models...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-center items-center pt-4 gap-4">
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !selectedBrainstormId || selectedModelIds.length === 0 || (workflowMode === 'debug' && !selectedAgent)} 
            size="lg" 
            className="flex-1"
          >
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <TestTube2 className="mr-2 h-5 w-5" />}
            {workflowMode === 'v1' ? 'Generate Tool (V1)' : 
             workflowMode === 'v2' ? 'Start V2 Orchestration' : 
             'Test Selected Agent'}
          </Button>

          {workflowMode === 'v2' && testJob && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleResume}
                disabled={orchestrationStatus !== 'paused' || isLoading}
                title="Resume"
              >
                <Play className="h-4 w-4"/>
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handlePause}
                disabled={orchestrationStatus === 'paused' || isLoading}
                title="Pause"
              >
                <Pause className="h-4 w-4"/>
              </Button>
               <Button 
                variant="outline" 
                size="icon" 
                onClick={handleStepForward}
                disabled={orchestrationStatus !== 'paused' || isLoading}
                title="Step Forward"
              >
                <StepForward className="h-4 w-4"/>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      
      { (testJob || progressUpdates.length > 0) && (
        <CardFooter className="flex-col items-start space-y-6 pt-6 border-t">
          <Tabs defaultValue="progress" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="tcc" disabled={workflowMode !== 'v2' || !testJob?.jobId}>TCC Monitor</TabsTrigger>
              <TabsTrigger value="websocket">WebSocket Logs</TabsTrigger>
              <TabsTrigger value="preview" disabled={!assembledCode}>Live Preview</TabsTrigger>
              <TabsTrigger value="result" disabled={testJob?.status !== 'success'}>Final Result</TabsTrigger>
            </TabsList>
            
            <TabsContent value="progress" className="mt-4">
              {workflowMode === 'v2' ? (
                <ProgressLog progressUpdates={progressUpdates} isDarkMode={isDarkMode} />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    {testJob?.status === 'loading' && (
                      <div className="flex flex-col items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="mt-2 text-sm text-gray-500">
                          {workflowMode === 'v1' ? 'V1 tool creation in progress...' : 'Testing selected agent...'}
                        </p>
                      </div>
                    )}
                    {testJob?.status === 'error' && testJob.error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Generation Failed</AlertTitle>
                        <AlertDescription className="text-xs break-all">{testJob.error}</AlertDescription>
                      </Alert>
                    )}
                    {testJob?.status === 'success' && (
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">
                          {workflowMode === 'v1' ? 'V1 Tool Created Successfully!' : 'Agent Test Completed!'}
                        </h3>
                        <p className="text-sm text-gray-600 mt-2">
                          Models used: {selectedModelIds.join(', ')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="tcc" className="mt-4">
              {workflowMode === 'v2' && testJob?.jobId ? (
                <TCCVisualizer 
                  tccData={tccData}
                  currentStep={currentStep}
                  jobId={testJob.jobId}
                  onRefreshTCC={handleRefreshTCC}
                  isLoading={isRefreshingTCC}
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-48 pt-6">
                    <div className="text-center">
                      <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">TCC Monitor is only available in V2 Orchestration mode</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="websocket" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                    {getConnectionStatusIcon()}
                      <span className="ml-2">WebSocket Debug Console</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getConnectionStatusBadge()}
                      {connectionStatus === 'connected' && (
                        <Badge variant="outline" className="text-green-600">
                          🟢 Live
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Real-time WebSocket connection monitoring with detailed debugging information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Environment Configuration Debug */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    <div className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Environment Configuration
                    </div>
                    <div className="text-xs space-y-1 grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">ENV Variable Set:</span> 
                        <span className={wsDebugInfo.hasEnvVar ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                          {wsDebugInfo.hasEnvVar ? '✅ Yes' : '❌ No'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Is Placeholder:</span> 
                        <span className={wsDebugInfo.isPlaceholder ? 'text-amber-600 ml-1' : 'text-green-600 ml-1'}>
                          {wsDebugInfo.isPlaceholder ? '⚠️ Yes' : '✅ No'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">WebSocket URL:</span>
                        <div className="font-mono text-gray-600 break-all mt-1 p-2 bg-white dark:bg-gray-900 rounded">
                          {wsDebugInfo.finalUrl}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Connection Statistics */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                    <div className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Connection Statistics
                    </div>
                    <div className="text-xs space-y-1 grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">Status:</span> 
                        <span className="ml-1 font-mono">{connectionStatus}</span>
                      </div>
                      <div>
                        <span className="font-medium">Attempts:</span> 
                        <span className="ml-1 font-mono">{wsDebugInfo.connectionAttempts}</span>
                      </div>
                      <div>
                        <span className="font-medium">Last Connected:</span>
                        <div className="font-mono text-gray-600 text-xs mt-1">
                          {wsDebugInfo.lastConnectionTime || 'Never'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Last Message:</span>
                        <div className="font-mono text-gray-600 text-xs mt-1">
                          {wsDebugInfo.lastMessageTime || 'None'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fallback Mode Warning */}
                  {connectionStatus === 'fallback' && (
                    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <AlertTitle className="text-orange-800 dark:text-orange-200">⚠️ FALLBACK MODE ACTIVE</AlertTitle>
                      <AlertDescription className="text-orange-700 dark:text-orange-300 text-sm">
                        <strong>NOT using real WebSocket!</strong> This is in-memory simulation for development.
                        <br />• Set <code className="bg-orange-100 dark:bg-orange-800 px-1 rounded">NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT</code> for production WebSocket
                        <br />• Messages below are simulated, not from a real WebSocket server
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Real-time Message Log */}
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Real-time Activity Log
                      {connectionStatus === 'fallback' && (
                        <span className="text-xs text-orange-600 font-normal">(Fallback Mode)</span>
                      )}
                    </Label>
                    <ScrollArea className="h-64 mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md border">
                      <div className="space-y-1">
                        {wsLogs.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-8">
                            {connectionStatus === 'fallback' 
                              ? '🔄 Fallback mode active - waiting for job progress...' 
                              : '🔄 Waiting for WebSocket activity...'
                            }
                            <br />
                            <span className="text-xs">Start a V2 orchestration to see real-time logs</span>
                          </p>
                        ) : (
                          wsLogs.map((log, index) => (
                            <p key={index} className={`text-xs font-mono ${
                              log.includes('[FALLBACK') ? 'text-orange-700 dark:text-orange-300' : 
                              log.includes('[ERROR]') ? 'text-red-700 dark:text-red-300' :
                              log.includes('[CONNECTION]') ? 'text-blue-700 dark:text-blue-300' :
                              log.includes('[MESSAGE]') ? 'text-green-700 dark:text-green-300' :
                              ''
                            }`}>
                              {log}
                            </p>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                  
                  {/* Progress Updates Summary */}
                  {progressUpdates.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Step Progress Summary ({progressUpdates.length} steps)
                      </Label>
                      <ScrollArea className="h-32 mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200">
                        <div className="space-y-2">
                          {progressUpdates.map((progress, index) => (
                            <div key={index} className="flex items-center gap-3 text-xs">
                              <div className={`w-2 h-2 rounded-full ${
                                progress.status === 'completed' ? 'bg-green-500' :
                                progress.status === 'running' ? 'bg-blue-500' :
                                progress.status === 'failed' ? 'bg-red-500' :
                                'bg-yellow-500'
                              }`} />
                              <span className="font-mono">{progress.stepName}</span>
                              <span className="text-gray-500">→</span>
                              <span className={`font-medium ${
                                progress.status === 'completed' ? 'text-green-600' :
                                progress.status === 'running' ? 'text-blue-600' :
                                progress.status === 'failed' ? 'text-red-600' :
                                'text-yellow-600'
                              }`}>
                                {progress.status}
                              </span>
                              {progress.isFallback && (
                                <Badge variant="outline" className="text-xs text-orange-600">
                                  Fallback
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Debug inspection area when preview/result tabs are disabled */}
                  {workflowMode === 'v2' && (!assembledCode || testJob?.status !== 'success') && tccData && (
                    <div>
                      <Label className="text-sm font-medium">🔍 Debug Inspection (Preview/Result tabs disabled):</Label>
                      <ScrollArea className="h-48 mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200">
                        <div className="text-xs font-mono space-y-2">
                          <p><strong>assembledCode:</strong> {assembledCode ? 'Available' : 'Missing'}</p>
                          <p><strong>testJob.status:</strong> {testJob?.status || 'No job'}</p>
                          <p><strong>TCC Keys:</strong> {Object.keys(tccData).join(', ')}</p>
                          
                          {tccData.assembledComponentCode && (
                            <div>
                              <p><strong>TCC.assembledComponentCode:</strong> Available ({tccData.assembledComponentCode.length} chars)</p>
                              <details className="mt-1">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Code</summary>
                                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs whitespace-pre-wrap">{tccData.assembledComponentCode}</pre>
                              </details>
                            </div>
                          )}

                          {tccData.styling && (
                            <div>
                              <p><strong>TCC.styling:</strong> Available</p>
                              <details className="mt-1">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Styling</summary>
                                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">{JSON.stringify(tccData.styling, null, 2)}</pre>
                              </details>
                            </div>
                          )}

                          {testJob?.result && (
                            <div>
                              <p><strong>testJob.result:</strong> Available</p>
                              <details className="mt-1">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Tool Definition</summary>
                                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">{JSON.stringify(testJob.result, null, 2)}</pre>
                              </details>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Eye className="mr-2 h-5 w-5"/>Component Preview</CardTitle>
                  <CardDescription>Live preview of the generated component. Interact with it to test functionality.</CardDescription>
                </CardHeader>
                <CardContent>
                  {assembledCode && testJob?.result ? (
                    <CanvasTool productToolDefinition={testJob.result} isDarkMode={isDarkMode} />
                  ) : assembledCode ? (
                    <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed border-red-500 bg-red-50">
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <p className="text-red-600 font-medium">NO TOOL DATA AVAILABLE</p>
                        <p className="text-red-500 text-sm">Component code exists but tool definition is missing.</p>
                        <p className="text-red-500 text-sm">This indicates a problem with the generation process.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
                      <p className="text-gray-500">Waiting for component code...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="result" className="mt-4">
               {testJob?.status === 'success' && testJob.result ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><CheckCircle className="mr-2 h-5 w-5 text-green-500"/>Generation Complete</CardTitle>
                    <CardDescription>The final tool definition has been created and is ready to be saved.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Models Used:</Badge>
                      {selectedModelIds.map(modelId => (
                        <Badge key={modelId} variant="secondary" className="text-xs">
                          {availableModels.find(m => m.id === modelId)?.name?.split(' ')[0] || modelId}
                        </Badge>
                      ))}
                    </div>
                    <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto max-h-96 text-sm">
                      {JSON.stringify(testJob.result, null, 2)}
                    </pre>
                    {workflowMode === 'v1' && testJob.result && (
                      <Button 
                        onClick={() => handleSaveTool(testJob.result!)} 
                        disabled={savedToolIds.has(testJob.result!.id)}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {savedToolIds.has(testJob.result!.id) ? 'Saved' : 'Save Tool to Browser DB'}
                      </Button>
                    )}
                    {workflowMode === 'v2' && testJob.result && tccData && (
                      <Button
                        onClick={() => handleSaveV2Result(testJob.result!, tccData)}
                        disabled={savedV2JobIds.has(tccData.jobId)}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {savedV2JobIds.has(tccData.jobId)
                          ? 'V2 Result Saved'
                          : 'Save V2 Generation Result'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
                  <p className="text-gray-500">Tool generation is not yet complete.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardFooter>
      )}
      
      {/* Debug Info */}
      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
        <div className="text-sm space-y-2">
          <div className="font-semibold text-yellow-800 dark:text-yellow-200">🐛 Debug State Information</div>
          <div className="text-xs space-y-1 text-yellow-700 dark:text-yellow-300">
            <div>• Available Models: {availableModels.length}</div>
            <div>• Selected Models: {JSON.stringify(selectedModelIds)}</div>
            <div>• First 3 Available: {JSON.stringify(availableModels.slice(0, 3).map(m => ({id: m.id, name: m.name})))}</div>
            <div>• Agent Mapping: {JSON.stringify(Object.fromEntries(Object.entries(agentModelMapping).slice(0, 3)))}</div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ToolTester;