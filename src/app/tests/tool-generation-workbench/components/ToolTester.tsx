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
import { saveToolToDBList } from '../../ui/db-utils';
import { CanvasTool } from '@/components/tool-creator-ui/canvas-tool';
import DEFAULT_MODELS from '@/lib/ai/models/default-models.json';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { useToolGenerationStream, StepProgress } from '../hooks/useToolGenerationStream';
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
  const [defaultPrimaryModel, setDefaultPrimaryModel] = useState<string | null>(null);
  const [assembledCode, setAssembledCode] = useState<string | null>(null);

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

  const handleProgress = (progress: StepProgress) => {
    // Update current step
    setCurrentStep(progress.stepName);
    
    // Add WebSocket log
    addWSLog(`Progress: ${progress.stepName} - ${progress.status}`);
    
    // Update TCC data if available
    if (progress.data?.tcc) {
      setTccData(progress.data.tcc);
      addWSLog(`TCC updated with new data from ${progress.stepName}`);
    }
    
    // Handle assembled code from Component Assembler - fix the condition
    if (progress.stepName === 'assembling_component' && progress.status === 'completed') {
      // First check for assembledComponentCode in TCC
      if (progress.data?.tcc?.assembledComponentCode) {
        setAssembledCode(progress.data.tcc.assembledComponentCode);
        addWSLog(`Component code assembled successfully (from TCC)`);
      }
      // Also check for direct progress data
      else if (progress.data?.assembledComponent?.finalComponentCode) {
        setAssembledCode(progress.data.assembledComponent.finalComponentCode);
        addWSLog(`Component code assembled successfully (from progress data)`);
      }
      // Also check for backwards compatibility
      else if (progress.data?.assembledComponentCode) {
        setAssembledCode(progress.data.assembledComponentCode);
        addWSLog(`Component code assembled successfully (backwards compatibility)`);
      }
    }

    // Also handle from orchestration completion
    if (progress.stepName === 'tool_finalizer' && progress.status === 'completed' && progress.data?.finalTool) {
      // If we have a final tool but no assembled code yet, extract it from the tool
      if (!assembledCode && progress.data.finalTool.componentCode) {
        setAssembledCode(progress.data.finalTool.componentCode);
        addWSLog(`Component code extracted from final tool`);
      }
      
      // Update test job with final result
      setTestJob(prev => prev ? {
        ...prev,
        status: 'success',
        result: progress.data.finalTool
      } : {
        jobId: progress.data.jobId || '',
        modelId: selectedModelIds[0] || 'unknown',
        status: 'success',
        result: progress.data.finalTool,
        metadata: { models: selectedModelIds },
        error: null
      });
      addWSLog(`Final tool definition received`);
    }

    // Handle streaming example (simulate streamObject/streamText response)
    if (progress.stepName === 'planning_function_signatures' && progress.status === 'llm_call_pending') {
      setStreamingExample(prev => prev + `Streaming: Planning function ${Math.random().toString(36).substring(7)}...\n`);
    }

    // Handle general TCC updates that might contain assembled code
    if (progress.data?.tcc?.assembledComponentCode && !assembledCode) {
      setAssembledCode(progress.data.tcc.assembledComponentCode);
      addWSLog(`Component code found in TCC update`);
    }
  };

  const { connect, disconnect, connectionStatus, progressUpdates } = useToolGenerationStream({ onProgress: handleProgress });

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
  useEffect(() => {
    console.log('🔄 useEffect for initialization triggered');
    console.log('📊 State: availableModels.length =', availableModels.length, 'selectedModelIds.length =', selectedModelIds.length);
    
    if (availableModels.length > 0 && selectedModelIds.length === 0) {
      // First try to load from localStorage
      const storedSelectedModels = loadFromLocalStorage(STORAGE_KEYS.selectedModels, []);
      const storedAgentMapping = loadFromLocalStorage(STORAGE_KEYS.agentMapping, {});
      
      console.log('💾 Raw localStorage data:', {
        storedSelectedModels,
        storedAgentMapping
      });
      
      // Validate stored models exist in current available models
      console.log('🔍 Validating stored models against available models...');
      console.log('📋 Available model IDs:', availableModels.map(m => m.id));
      
      const validStoredModels = storedSelectedModels.filter((modelId: string) => {
        const exists = availableModels.some(m => m.id === modelId);
        console.log(`🤖 Model ${modelId}: ${exists ? '✅ exists' : '❌ not found'}`);
        return exists;
      });
      
      console.log('✅ Valid stored models:', validStoredModels);
      
      if (validStoredModels.length > 0) {
        // Use stored selections
        console.log('📝 Setting selectedModelIds to:', validStoredModels);
        setSelectedModelIds(validStoredModels);
        
        // Validate and set stored agent mapping
        const validAgentMapping: AgentModelMapping = {};
        availableAgents.forEach(agent => {
          const storedModel = storedAgentMapping[agent.id];
          if (storedModel && availableModels.some(m => m.id === storedModel)) {
            // Use stored model if it's valid
            validAgentMapping[agent.id] = storedModel;
          } else {
            // Fall back to default model from processModels
            validAgentMapping[agent.id] = getDefaultModelForAgent(agent.id);
          }
        });
        setAgentModelMapping(validAgentMapping);
        
        console.log('✅ Loaded model selections from localStorage:', {
          models: validStoredModels,
          agentMapping: validAgentMapping
        });
      } else if (defaultPrimaryModel) {
        // Fall back to default model logic
        const targetDefaultId = defaultPrimaryModel || 'gpt-4.1-mini';
        const defaultModel = availableModels.find(m => m.id === targetDefaultId) || 
                            availableModels.find(m => m.id === 'gpt-4.1-mini') || 
                            availableModels.find(m => m.id === 'gpt-4o') ||
                            availableModels[0]; // Last resort: use first available model
        
        if (defaultModel) {
          const defaultModels = [defaultModel.id];
          setSelectedModelIds(defaultModels);
          saveToLocalStorage(STORAGE_KEYS.selectedModels, defaultModels);
          
          // Initialize agent model mapping with models from processModels
          const initialMapping: AgentModelMapping = {};
          availableAgents.forEach(agent => {
            initialMapping[agent.id] = getDefaultModelForAgent(agent.id);
          });
          setAgentModelMapping(initialMapping);
          saveToLocalStorage(STORAGE_KEYS.agentMapping, initialMapping);
          
          console.log('Initialized with default model:', defaultModel.id);
        }
      }
    }
  }, [availableModels, defaultPrimaryModel, selectedModelIds.length, availableAgents, loadFromLocalStorage, saveToLocalStorage, getDefaultModelForAgent]);

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
  }, [fetchDefaultModel, fetchModels, fetchBrainstorms, newBrainstormFlag]);

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

  const handleJobUpdate = (updatedJob: ToolCreationJob) => {
    setTestJob(updatedJob);
  };

  const handleSubmit = async () => {
    if (!selectedBrainstormId) {
      setError('Please select a brainstorm result to test.');
      return;
    }
    if (selectedModelIds.length === 0) {
      setError(`Please select at least one AI model.`);
      return;
    }

    const selectedBrainstorm = savedBrainstorms.find(bs => bs.id === selectedBrainstormId);
    if (!selectedBrainstorm) {
      setError('Selected brainstorm result not found.');
      return;
    }

    const primaryModelId = selectedModelIds[0]; // Use first selected model as primary

    setIsLoading(true);
    setError(null);
    setTestJob(null);
    setAssembledCode(null);
    setWsLogs([]);
    setStreamingExample('');
    disconnect(); // Disconnect from any previous session

    addWSLog(`Starting ${workflowMode} workflow with ${selectedModelIds.length} models`);

    if (workflowMode === 'v1') {
      // Call the original V1 create-tool API
      try {
        setTestJob({ modelId: primaryModelId, status: 'loading', startTime: Date.now() });
        addWSLog(`V1: Starting tool creation with model ${primaryModelId}`);
        
        const response = await fetch('/api/ai/create-tool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIntent: selectedBrainstorm.result?.userInput || {},
            context: {
              targetAudience: selectedBrainstorm.targetAudience,
              industry: selectedBrainstorm.industry,
              toolType: selectedBrainstorm.toolType
            },
            selectedModels: selectedModelIds,
          }),
        });

        const result = await response.json();
        
        if (result.success && result.tool) {
          setTestJob({ 
            modelId: primaryModelId, 
            status: 'success', 
            result: result.tool,
            endTime: Date.now(),
            startTime: Date.now() - 10000
          });
          addWSLog(`V1: Tool creation completed successfully`);
        } else {
          setTestJob({ 
            modelId: primaryModelId, 
            status: 'error', 
            error: result.error || 'V1 tool creation failed',
            endTime: Date.now()
          });
          addWSLog(`V1: Tool creation failed - ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'V1 creation failed';
        setTestJob({ 
          modelId: primaryModelId, 
          status: 'error', 
          error: errorMsg,
          endTime: Date.now()
        });
        addWSLog(`V1: Error - ${errorMsg}`);
      }
    } else if (workflowMode === 'v2') {
      // V2 Orchestration Mode with WebSocket streaming
      addWSLog(`V2: Starting orchestration with models: ${selectedModelIds.join(', ')}`);
      const resultJob = await runToolCreationProcess(
        selectedBrainstorm, 
        primaryModelId, 
        handleJobUpdate,
        agentModelMapping // Pass the agent model mapping
      );
      setTestJob(resultJob);
      
      if (resultJob.status !== 'error' && resultJob.jobId) {
        console.log(`Tool creation started with Job ID: ${resultJob.jobId}. Now listening for updates...`);
        addWSLog(`V2: Connected to WebSocket for job ${resultJob.jobId}`);
        connect(resultJob.jobId);

        // Simulate streamObject example for function planner
        addWSLog(`V2: Starting streamObject example for Function Planner`);
        setStreamingExample('Starting streamObject streaming...\n');
      } else {
        setError(resultJob.error || 'Failed to start tool creation process.');
        addWSLog(`V2: Failed to start - ${resultJob.error}`);
      }
    } else if (workflowMode === 'debug') {
      // Debug Mode - Individual Agent Testing
      if (!selectedAgent) {
        setError('Please select an agent to test in debug mode.');
        setIsLoading(false);
        return;
      }
      
      const agentModel = agentModelMapping[selectedAgent] || primaryModelId;
      
      try {
        setTestJob({ modelId: agentModel, status: 'loading', startTime: Date.now() });
        addWSLog(`Debug: Testing ${selectedAgent} with model ${agentModel}`);
        
        // Call individual agent endpoint with proper mock TCC structure
        const mockTcc = {
          jobId: crypto.randomUUID(), // Generate proper UUID
          userInput: selectedBrainstorm.result?.userInput || {
            toolType: selectedBrainstorm.toolType || 'Test Tool',
            targetAudience: selectedBrainstorm.targetAudience || 'General Users',
            businessContext: selectedBrainstorm.result?.userInput?.businessContext || 'Test tool for agent isolation testing',
            selectedModel: agentModel
          },
          brainstormResult: {
            description: selectedBrainstorm.result?.userInput?.businessContext || 'Test tool for agent isolation testing',
            targetAudience: selectedBrainstorm.targetAudience || 'General Users',
            toolType: selectedBrainstorm.toolType || 'Test Tool',
            features: ['Basic functionality', 'User interface', 'Data processing'],
            designConsiderations: ['Clean interface', 'Responsive design', 'Accessibility']
          },
          agentModelMapping: agentModelMapping || {},
          // Add mock function signatures for agents that need them
          ...(selectedAgent !== 'function-planner' && {
            functionSignatures: [
              {
                name: 'processData',
                description: 'Process input data',
                parameters: [
                  { name: 'input', type: 'any', description: 'Input data to process' }
                ],
                returnType: 'ProcessedData'
              }
            ]
          }),
          // Add mock state logic for agents that need it
          ...((['jsx-layout', 'tailwind-styling', 'component-assembler'].includes(selectedAgent)) && {
            stateLogic: {
              stateVariables: [
                {
                  name: 'data',
                  type: 'any',
                  initialValue: 'null',
                  description: 'Main data state'
                },
                {
                  name: 'isLoading',
                  type: 'boolean',
                  initialValue: 'false',
                  description: 'Loading state'
                }
              ],
              functions: [
                {
                  name: 'handleDataUpdate',
                  body: 'setData(newData); setIsLoading(false);',
                  description: 'Update data state',
                  dependencies: ['data', 'isLoading']
                }
              ]
            }
          }),
          // Add mock JSX layout for styling and assembly agents
          ...((['tailwind-styling', 'component-assembler'].includes(selectedAgent)) && {
            jsxLayout: {
              componentStructure: '<div><h1>Test Component</h1><div>Content</div></div>',
              elementMap: [
                { elementId: 'header', purpose: 'Main heading', type: 'h1' },
                { elementId: 'content', purpose: 'Main content area', type: 'div' }
              ]
            }
          }),
          // Add mock styling for component assembler
          ...(selectedAgent === 'component-assembler' && {
            styling: {
              styleMap: {
                'header': 'text-2xl font-bold text-gray-900',
                'content': 'p-4 bg-gray-50 rounded-lg'
              },
              colorScheme: {
                primary: '#3b82f6',
                secondary: '#64748b',
                accent: '#8b5cf6',
                background: '#ffffff',
                surface: '#f9fafb',
                text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
                border: '#e5e7eb',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444'
              }
            }
          })
        };

        const response = await fetch(`/api/ai/product-tool-creation-v2/agents/${selectedAgent}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mockTcc,
            selectedModel: agentModel,
            testingOptions: {
              enableWebSocketStreaming: true,  // Enable streaming for testing
              enableTccOperations: false,      // Skip TCC store operations
              enableOrchestrationTriggers: false // Skip orchestration triggers
            }
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          setTestJob({ 
            modelId: agentModel, 
            status: 'success', 
            result: result,
            endTime: Date.now(),
            startTime: Date.now() - 5000
          });
          addWSLog(`Debug: ${selectedAgent} completed successfully`);
        } else {
          setTestJob({ 
            modelId: agentModel, 
            status: 'error', 
            error: result.error || `${selectedAgent} agent failed`,
            endTime: Date.now()
          });
          addWSLog(`Debug: ${selectedAgent} failed - ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Agent testing failed';
        setTestJob({ 
          modelId: agentModel, 
          status: 'error', 
          error: errorMsg,
          endTime: Date.now()
        });
        addWSLog(`Debug: Error - ${errorMsg}`);
      }
    }

    setIsLoading(false);
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
                  <CardTitle className="flex items-center">
                    {getConnectionStatusIcon()}
                    <span className="ml-2">WebSocket Activity & Streaming Logs</span>
                  </CardTitle>
                  <CardDescription>Real-time logs from WebSocket connection and streaming responses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                  
                  <div>
                    <Label className="text-sm font-medium">
                      Connection Status & Logs:
                      {connectionStatus === 'fallback' && (
                        <span className="ml-2 text-xs text-orange-600 font-normal">(Development Fallback Mode)</span>
                      )}
                    </Label>
                    <ScrollArea className="h-32 mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md border">
                      <div className="space-y-1">
                        {wsLogs.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            {connectionStatus === 'fallback' 
                              ? 'No fallback activity yet... (simulated WebSocket)' 
                              : 'No WebSocket activity yet...'
                            }
                          </p>
                        ) : (
                          wsLogs.map((log, index) => (
                            <p key={index} className={`text-xs font-mono ${
                              log.includes('[FALLBACK') ? 'text-orange-700 dark:text-orange-300' : ''
                            }`}>
                              {log}
                            </p>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                  
                  {streamingExample && (
                    <div>
                      <Label className="text-sm font-medium">StreamObject/StreamText Example:</Label>
                      <ScrollArea className="h-32 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200">
                        <pre className="text-xs font-mono whitespace-pre-wrap">{streamingExample}</pre>
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