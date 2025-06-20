// --- PHASE 1: UNIFIED TYPES ---
// Import unified brainstorm types instead of defining conflicting ones
export { 
  type BrainstormResult as BrainstormData, // Alias for backward compatibility during migration
  type BrainstormRequest,
  type BrainstormStreamData,
  type BrainstormUserInput,
  type BrainstormData as BrainstormDataContent,
  validateBrainstormResult,
  isBrainstormResult,
  migrateLegacySavedLogicResult,
  migrateLegacyBrainstormData
} from '../../types/unified-brainstorm-types';

// Remove the old conflicting BrainstormData interface - now using unified types

export interface ModelOption {
  id: string;
  name: string;
  provider?: string;
}

export type AgentModelMapping = Record<string, string>;

export type OrchestrationStatus = 'free' | 'paused' | 'runone';

export const STORAGE_KEYS = {
  selectedModels: 'tool-generation-workbench-selected-models',
  agentMapping: 'tool-generation-workbench-agent-mapping',
} as const;

export type TccSource = 'brainstorm' | 'mockScenario' | 'savedV2Job' | 'inMemory';

export type WorkflowMode = 'v1' | 'v2' | 'debug';

export type AgentMode = 'create' | 'edit';

// Mock TCC scenarios for testing individual agents
export const mockTccScenarios = [
  {
    id: 'roi-calculator',
    name: 'ROI Calculator',
    description: 'A business ROI calculation tool',
    mockTcc: {
      jobId: 'mock-roi-calc',
      userInput: {
        description: 'Create an ROI calculator for marketing campaigns',
        targetAudience: 'Marketing Managers',
        industry: 'Digital Marketing',
        toolType: 'ROI Calculator'
      },
      brainstormData: {
        coreConcept: 'Marketing ROI Calculator',
        valueProposition: 'Help marketing managers calculate and optimize campaign ROI',
        keyCalculations: [
          {
            name: 'ROI Percentage',
            formula: '((Revenue - Investment) / Investment) * 100',
            description: 'Calculate return on investment as percentage',
            variables: ['revenue', 'investment']
          }
        ],
        interactionFlow: [
          {
            step: 1,
            title: 'Input Campaign Data',
            description: 'Enter campaign investment and revenue data',
            userAction: 'Fill in investment amount and generated revenue'
          }
        ],
        leadCaptureStrategy: {
          timing: 'after_calculation',
          method: 'email_signup',
          incentive: 'ROI optimization guide'
        },
        creativeEnhancements: ['Visual ROI chart', 'Comparison with industry benchmarks'],
        suggestedInputs: [
          {
            id: 'investment',
            label: 'Campaign Investment ($)',
            type: 'number',
            required: true,
            description: 'Total amount invested in the marketing campaign'
          },
          {
            id: 'revenue',
            label: 'Generated Revenue ($)',
            type: 'number',
            required: true,
            description: 'Revenue directly attributed to the campaign'
          }
        ],
        calculationLogic: [
          {
            id: 'roi_calc',
            name: 'ROI Calculation',
            formula: '((revenue - investment) / investment) * 100',
            dependencies: ['investment', 'revenue'],
            outputFormat: 'percentage'
          }
        ],
        promptOptions: {
          includeComprehensiveColors: true,
          includeGorgeousStyling: true,
          includeAdvancedLayouts: false,
          styleComplexity: 'enhanced',
          industryFocus: 'Digital Marketing',
          toolComplexity: 'moderate'
        }
      }
    }
  }
] as const;
  