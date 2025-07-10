import { useState, useCallback, useRef } from 'react';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { ToolConstructionContext, OrchestrationStepEnum } from '@/lib/types/tcc-unified';
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

  // (Legacy parallel-polling implementation removed – superseded by pollForCompletionV2.)

const pollForCompletionV2 = useCallback(
  async (jobId: string): Promise<ToolCreationV2Result> => {
    const startTime = Date.now();

    const cleanup = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          if (Date.now() - startTime > MAX_POLLING_TIME) {
            cleanup();
            reject(new Error('Tool creation process timed out'));
            return;
          }

          const response = await fetch(`/api/ai/v2-orchestration/tcc/${jobId}`, {
            signal: abortControllerRef.current?.signal,
          });

          if (!response.ok) {
            throw new Error(`Polling failed with status ${response.status}`);
          }

          const data = await response.json();
          if (!data.success || !data.tcc) {
            cleanup();
            reject(new Error(data.error || 'Invalid polling response'));
            return;
          }

          const tcc: ToolConstructionContext = data.tcc;
          const orchestrationStatus = tcc.status as string;
          const currentStep = tcc.currentOrchestrationStep as string;
          const stepDisplayName =
            STEP_DISPLAY_NAMES[
              currentStep as keyof typeof STEP_DISPLAY_NAMES
            ] || currentStep;

          let progressStatus: ToolCreationV2Progress['status'] = 'started';
          if (orchestrationStatus === 'completed') {
            progressStatus = 'completed';
          } else if (['failed', 'error'].includes(orchestrationStatus)) {
            progressStatus = 'failed';
          }

          addProgress({
            step: currentStep,
            status: progressStatus,
            message: `${stepDisplayName}: ${orchestrationStatus}`,
            timestamp: new Date().toISOString(),
            stepDisplayName,
          });

          if (orchestrationStatus === 'completed') {
            cleanup();
            resolve({ success: true, jobId, tcc, progress: [] });
          } else if (['failed', 'error'].includes(orchestrationStatus)) {
            cleanup();
            reject(new Error('Tool creation process failed'));
          }
        } catch (error: any) {
          cleanup();
          if (error?.name === 'AbortError') {
            reject(new Error('Process was cancelled'));
          } else {
            reject(error);
          }
        }
      };

      pollingRef.current = setInterval(poll, POLLING_INTERVAL);
      poll();
    });
  },
  [addProgress]
);

const createTool = useCallback(async (request: ToolCreationV2Request): Promise<ToolCreationV2Result> => {
  try {
    setIsCreating(true);
    setError(null);
    setProgress([]);
    setCurrentStep(null);

    abortControllerRef.current = new AbortController();

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

      const result = await pollForCompletionV2(jobId);
      
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
  }, [currentStep, addProgress, pollForCompletionV2]);

  return {
    createTool,
    isCreating,
    progress,
    currentStep,
    error,
    resetState
  };
}
