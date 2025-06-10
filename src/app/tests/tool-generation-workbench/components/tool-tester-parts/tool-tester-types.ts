export interface BrainstormData {
    id: string;
    toolType: string;
    targetAudience: string;
    businessContext?: string;
    industry?: string;
    timestamp: number;
    result?: any;
  }
  
  export interface ModelOption {
    id: string;
    name: string;
    provider?: string;
  }
  
  export interface AgentModelMapping {
    [agentName: string]: string;
  }
  
  export type WorkflowMode = 'v1' | 'v2' | 'debug';
  export type OrchestrationStatus = 'free' | 'paused' | 'runone';
  export type TccSource = 'brainstorm' | 'savedV2Job' | 'mockScenario';
  
  export const STORAGE_KEYS = {
    selectedModels: 'tool-generation-workbench-selected-models',
    agentMapping: 'tool-generation-workbench-agent-mapping'
  };
  
  // Mock TCC scenarios for testing
  export const mockTccScenarios = [
    {
      id: 'simple-calculator',
      name: 'Simple Calculator',
      tcc: {
        jobId: 'mock-calculator-1',
        userInput: {
          description: 'A simple calculator tool',
          targetAudience: 'general users',
          toolType: 'calculator'
        }
      }
    }
  ];
  