import { useState, useCallback, useRef } from 'react';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { ToolConstructionContext, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/tcc-unified';
import logger from '@/lib/logger';

export interface ToolCreationV2Request {
  userIntent: string;
  context?: {
    targetAudience?: string;
    industry?: string;
    toolType?: string;
    features?: string[];
    businessDescription?: string;
    brainstormingResult?: any;
    logicArchitectInsights?: any;
  };
  selectedModel?: string;
  existingTool?: any;
  updateType?: 'color' | 'title' | 'description' | 'features' | 'components' | 'general';
}

export interface ToolCreationV2Progress {
  step: string;
  status: 'pending' | 'started' | 'completed' | 'failed';
  message: string;
  timestamp: string;
  stepDisplayName: string;
}

export interface ToolCreationV2Result {
  success: boolean;
  tool?: ProductToolDefinition;
  jobId?: string;
  tcc?: ToolConstructionContext;
  error?: string;
  progress: ToolCreationV2Progress[];
}

export interface UseProductToolCreationV2Return {
  createTool: (request: ToolCreationV2Request) => Promise<ToolCreationV2Result>;
  isCreating: boolean;
  progress: ToolCreationV2Progress[];
  currentStep: string | null;
  error: string | null;
  resetState: () => void;
}

const STEP_DISPLAY_NAMES = {
  [OrchestrationStepEnum.enum.initialization]: 'Initializing',
  [OrchestrationStepEnum.enum.planning_function_signatures]: 'Planning Functions',
  [OrchestrationStepEnum.enum.designing_state_logic]: 'Designing State Logic',
  [OrchestrationStepEnum.enum.designing_jsx_layout]: 'Creating JSX Layout',
  [OrchestrationStepEnum.enum.applying_tailwind_styling]: 'Applying Styles',
  [OrchestrationStepEnum.enum.assembling_component]: 'Assembling Component',
  [OrchestrationStepEnum.enum.completed]: 'Completed',
  [OrchestrationStepEnum.enum.failed]: 'Failed'
};

const POLLING_INTERVAL = 1000; // 1 second
const MAX_POLLING_TIME = 300000; // 5 minutes total timeout

export function useProductToolCreationV2(): UseProductToolCreationV2Return {
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState<ToolCreationV2Progress[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetState = useCallback(() => {
    setIsCreating(false);
    setProgress([]);
    setCurrentStep(null);
    setError(null);
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const addProgress = useCallback((newProgress: ToolCreationV2Progress) => {
    setProgress(prev => [...prev, newProgress]);
    setCurrentStep(newProgress.step);
    logger.info({ step: newProgress.step, status: newProgress.status }, '?? V2 Progress Update');
  }, []);

  const pollForCompletion = useCallback(async (jobId: string): Promise<ToolCreationV2Result> => {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          if (Date.now() - startTime > MAX_POLLING_TIME) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            reject(new Error('Tool creation process timed out'));
            return;
          }

          const response = await fetch('/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
            signal: abortControllerRef.current?.signal
          });

          if (!response.ok) {
            throw new Error(`Check completion failed: ${response.status}`);
          }

          const data = await response.json();
          
          if (!data.success) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            reject(new Error(data.error || 'Unknown error during polling'));
            return;
          }

          const stepDisplayName = STEP_DISPLAY_NAMES[data.currentStep as keyof typeof STEP_DISPLAY_NAMES] || data.currentStep;
          
          if (data.isComplete && data.readyToTriggerNext && data.nextStep) {
            addProgress({
              step: data.currentStep,
              status: 'completed',
              message: `${stepDisplayName} completed`,
              timestamp: new Date().toISOString(),
              stepDisplayName
            });

            const triggerResponse = await fetch('/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId, nextStep: data.nextStep }),
              signal: abortControllerRef.current?.signal
            });

            if (!triggerResponse.ok) {
              throw new Error(`Failed to trigger next step: ${triggerResponse.status}`);
            }

            const triggerData = await triggerResponse.json();
            if (!triggerData.success) {
              throw new Error(triggerData.error || 'Failed to trigger next step');
            }

            if (triggerData.agentTriggered) {
              addProgress({
                step: data.nextStep,
                status: 'started',
                message: `${triggerData.stepDisplayName} started`,
                timestamp: new Date().toISOString(),
                stepDisplayName: triggerData.stepDisplayName
              });
            }

          } else if (data.currentStep === OrchestrationStepEnum.enum.completed) {
            addProgress({
              step: data.currentStep,
              status: 'completed',
              message: 'Tool creation completed successfully!',
              timestamp: new Date().toISOString(),
              stepDisplayName: 'Completed'
            });

            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }

            resolve({
              success: true,
              jobId,
              progress: [],
              tool: {
                id: `tool-v2-${Date.now()}`,
                slug: `tool-v2-slug-${Date.now()}`,
                version: '1.0',
                status: 'draft',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: 'user',
                metadata: {
                  id: `meta-v2-${Date.now()}`,
                  slug: `meta-v2-slug-${Date.now()}`,
                  title: 'V2 Generated Tool',
                  description: 'Tool created using V2 orchestration',
                  shortDescription: 'V2 Tool',
                  type: 'tool',
                  category: 'general',
                  targetAudience: 'general users',
                  industry: 'various',
                  tags: [],
                  estimatedCompletionTime: 5,
                  difficultyLevel: 'beginner',
                  features: [],
                  icon: { type: 'lucide', value: 'Package' }
                },
                componentSet: 'shadcn',
                componentCode: "'use client';\nfunction V2GeneratedTool() { return React.createElement('div', { className: 'p-4' }, 'V2 Tool Successfully Created!'); }",
                colorScheme: {
                  primary: '#3b82f6',
                  secondary: '#6b7280',
                  background: '#ffffff',
                  surface: '#f9fafb',
                  text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
                  border: '#e5e7eb',
                  success: '#10b981',
                  warning: '#f59e0b',
                  error: '#ef4444'
                },
                initialStyleMap: {},
                currentStyleMap: {},
                analytics: { enabled: true, completions: 0, averageTime: 0 }
              }
            });
            
          } else if (data.status === 'failed') {
            addProgress({
              step: data.currentStep,
              status: 'failed',
              message: 'Process failed',
              timestamp: new Date().toISOString(),
              stepDisplayName
            });

            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            
            reject(new Error('Tool creation process failed'));
          }
          
        } catch (error) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          
          if (error instanceof Error && error.name === 'AbortError') {
            reject(new Error('Process was cancelled'));
          } else {
            reject(error);
          }
        }
      };

      pollingRef.current = setInterval(poll, POLLING_INTERVAL);
      poll();
    });
  }, [addProgress]);

  const createTool = useCallback(async (request: ToolCreationV2Request): Promise<ToolCreationV2Result> => {
    try {
      setIsCreating(true);
      setError(null);
      setProgress([]);
      setCurrentStep(null);

      abortControllerRef.current = new AbortController();

      logger.info({ request }, '?? V2: Starting tool creation');

      addProgress({
        step: OrchestrationStepEnum.enum.initialization,
        status: 'started',
        message: 'Initializing tool creation process...',
        timestamp: new Date().toISOString(),
        stepDisplayName: 'Initializing'
      });

      const startResponse = await fetch('/api/ai/v2-orchestration/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: request.userIntent,
          targetAudience: request.context?.targetAudience,
          industry: request.context?.industry,
          toolType: request.context?.toolType,
          features: request.context?.features || []
        }),
        signal: abortControllerRef.current.signal
      });

      if (!startResponse.ok) {
        throw new Error(`Failed to start orchestration: ${startResponse.status}`);
      }

      const startData = await startResponse.json();
      if (!startData.success) {
        throw new Error(startData.error || 'Failed to start orchestration process');
      }

      const jobId = startData.jobId;
      logger.info({ jobId }, '?? V2: Orchestration started');

      addProgress({
        step: OrchestrationStepEnum.enum.initialization,
        status: 'completed',
        message: 'Process initialized successfully',
        timestamp: new Date().toISOString(),
        stepDisplayName: 'Initializing'
      });

      const result = await pollForCompletion(jobId);
      
      setIsCreating(false);
      return {
        ...result,
        progress: []
      };

    } catch (error) {
      setIsCreating(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      logger.error({ error: errorMessage }, '?? V2: Tool creation failed');
      
      addProgress({
        step: currentStep || 'unknown',
        status: 'failed',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        stepDisplayName: 'Failed'
      });

      return {
        success: false,
        error: errorMessage,
        progress: []
      };
    }
  }, [currentStep, addProgress, pollForCompletion]);

  return {
    createTool,
    isCreating,
    progress,
    currentStep,
    error,
    resetState
  };
}
