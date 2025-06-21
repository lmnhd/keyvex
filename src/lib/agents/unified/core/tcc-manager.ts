// TCC Manager - TCC state operations and brainstorm filtering
// Handles Single Source of Truth TCC management

import { AgentType, ToolConstructionContext, updateTCCWithAgentResult, OrchestrationStep } from '@/lib/types/tcc-unified';

export class TCCManager {
  
  // Filter brainstorm data for specific agent to optimize context
  filterBrainstormForAgent(tcc: ToolConstructionContext, agent: AgentType): ToolConstructionContext {
    const originalData = tcc.brainstormData;
    
    // Agent-specific filtering to reduce context window bloat
    let filteredBrainstormData: any;
    
    switch (agent) {
      case 'function-planner':
        // Function Planner needs: keyCalculations, interactionFlow, suggestedInputs
        filteredBrainstormData = {
          coreConcept: originalData.coreConcept,
          valueProposition: originalData.valueProposition,
          keyCalculations: originalData.keyCalculations || [],
          interactionFlow: originalData.interactionFlow || [],
          suggestedInputs: originalData.suggestedInputs || [],
          calculationLogic: originalData.calculationLogic || [],
          _formatVersion: originalData._formatVersion,
          _generatedAt: originalData._generatedAt,
        };
        break;
        
      case 'state-design':
        // State Designer needs: keyCalculations, suggestedInputs, calculationLogic, function signatures
        filteredBrainstormData = {
          coreConcept: originalData.coreConcept,
          valueProposition: originalData.valueProposition,
          keyCalculations: originalData.keyCalculations || [],
          suggestedInputs: originalData.suggestedInputs || [],
          calculationLogic: originalData.calculationLogic || [],
          // Include research data for realistic values
          researchData: originalData.researchData,
          mockData: originalData.mockData,
          dummyData: originalData.dummyData,
          _formatVersion: originalData._formatVersion,
          _generatedAt: originalData._generatedAt,
        };
        break;
        
      case 'jsx-layout':
        // JSX Layout needs: suggestedInputs, interactionFlow, leadCaptureStrategy
        filteredBrainstormData = {
          coreConcept: originalData.coreConcept,
          valueProposition: originalData.valueProposition,
          suggestedInputs: originalData.suggestedInputs || [],
          interactionFlow: originalData.interactionFlow || [],
          leadCaptureStrategy: originalData.leadCaptureStrategy,
          calculationLogic: originalData.calculationLogic || [],
          _formatVersion: originalData._formatVersion,
          _generatedAt: originalData._generatedAt,
        };
        break;
        
      case 'tailwind-styling':
        // Tailwind Styling needs: targetAudience, creativeEnhancements, industry context
        filteredBrainstormData = {
          coreConcept: originalData.coreConcept,
          valueProposition: originalData.valueProposition,
          creativeEnhancements: originalData.creativeEnhancements || [],
          leadCaptureStrategy: originalData.leadCaptureStrategy,
          _formatVersion: originalData._formatVersion,
          _generatedAt: originalData._generatedAt,
        };
        break;
        
      case 'component-assembler':
        // Component Assembler needs core data only
        filteredBrainstormData = {
          coreConcept: originalData.coreConcept,
          valueProposition: originalData.valueProposition,
          _formatVersion: originalData._formatVersion,
          _generatedAt: originalData._generatedAt,
        };
        break;
        
      case 'code-validator':
      case 'tool-finalizer':
        // These agents need minimal brainstorm data
        filteredBrainstormData = {
          coreConcept: originalData.coreConcept,
          valueProposition: originalData.valueProposition,
          _formatVersion: originalData._formatVersion,
          _generatedAt: originalData._generatedAt,
        };
        break;
        
      default:
        // Default: return original data
        filteredBrainstormData = originalData;
    }

    // Log filtering results
    const originalSize = JSON.stringify(originalData).length;
    const filteredSize = JSON.stringify(filteredBrainstormData).length;
    const reductionPercent = Math.round(((originalSize - filteredSize) / originalSize) * 100);
    
    console.log(`🔍 Brainstorm filtering for ${agent}:`, {
      originalSize,
      filteredSize,
      reductionPercent: `${reductionPercent}%`,
      agent
    });

    return {
      ...tcc,
      brainstormData: filteredBrainstormData,
    };
  }

  // Update TCC with agent result and manage state progression
  updateTCCWithResult(
    tcc: ToolConstructionContext,
    agent: AgentType,
    result: any,
    nextStep?: OrchestrationStep
  ): ToolConstructionContext {
    return updateTCCWithAgentResult(tcc, agent, result, nextStep);
  }

  // Validate TCC structure and data integrity
  validateTCC(tcc: ToolConstructionContext): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!tcc.userId) errors.push('userId is required');
    if (!tcc.jobId) errors.push('jobId is required');
    if (!tcc.userInput) errors.push('userInput is required');
    if (!tcc.brainstormData) errors.push('brainstormData is required');
    if (!tcc.agentModelMapping) errors.push('agentModelMapping is required');

    // Agent model mapping validation
    const requiredAgents: AgentType[] = [
      'function-planner',
      'state-design',
      'jsx-layout',
      'tailwind-styling',
      'component-assembler',
      'code-validator',
      'tool-finalizer'
    ];

    for (const agent of requiredAgents) {
      if (!tcc.agentModelMapping[agent]) {
        warnings.push(`No model assigned to ${agent}`);
      }
    }

    // Brainstorm data validation
    if (tcc.brainstormData) {
      if (!tcc.brainstormData.coreConcept) {
        errors.push('brainstormData.coreConcept is required');
      }
      if (!tcc.brainstormData.keyCalculations || tcc.brainstormData.keyCalculations.length === 0) {
        warnings.push('brainstormData.keyCalculations is empty');
      }
      if (!tcc.brainstormData.suggestedInputs || tcc.brainstormData.suggestedInputs.length === 0) {
        warnings.push('brainstormData.suggestedInputs is empty');
      }
    }

    // Step status validation
    const currentStep = tcc.currentOrchestrationStep;
    const stepStatus = tcc.stepStatus;
    
    if (currentStep !== 'completed') {
      const currentAgent = this.getAgentForStep(currentStep);
      if (stepStatus[currentAgent] !== 'in_progress' && stepStatus[currentAgent] !== 'completed') {
        warnings.push(`Current step ${currentStep} agent ${currentAgent} is not in progress`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Get the next orchestration step
  getNextOrchestrationStep(currentStep: OrchestrationStep): OrchestrationStep | null {
    const stepOrder: OrchestrationStep[] = [
      'planning_function_signatures',
      'designing_state_logic',
      'designing_jsx_layout',
      'applying_tailwind_styling',
      'assembling_component',
      'validating_code',
      'finalizing_tool',
      'completed'
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
      return null; // Already at the end
    }

    return stepOrder[currentIndex + 1];
  }

  // Get agent for orchestration step
  private getAgentForStep(step: OrchestrationStep): AgentType {
    const stepToAgentMap: Record<OrchestrationStep, AgentType> = {
      'planning_function_signatures': 'function-planner',
      'designing_state_logic': 'state-design',
      'designing_jsx_layout': 'jsx-layout',
      'applying_tailwind_styling': 'tailwind-styling',
      'assembling_component': 'component-assembler',
      'validating_code': 'code-validator',
      'finalizing_tool': 'tool-finalizer',
      'completed': 'tool-finalizer', // Default to last agent
    };
    return stepToAgentMap[step];
  }

  // Check if agent has required dependencies
  checkAgentDependencies(tcc: ToolConstructionContext, agent: AgentType): {
    canProceed: boolean;
    missingDependencies: string[];
  } {
    const missingDependencies: string[] = [];

    switch (agent) {
      case 'function-planner':
        // Function planner needs brainstorm data
        if (!tcc.brainstormData?.keyCalculations?.length) {
          missingDependencies.push('keyCalculations');
        }
        break;
        
      case 'state-design':
        // State design needs function signatures
        if (!tcc.definedFunctionSignatures?.functionSignatures?.length) {
          missingDependencies.push('function signatures from Function Planner');
        }
        break;
        
      case 'jsx-layout':
        // JSX layout needs state logic
        if (!tcc.stateLogic?.stateVariables?.length) {
          missingDependencies.push('state variables from State Design');
        }
        break;
        
      case 'tailwind-styling':
        // Tailwind styling needs JSX layout
        if (!tcc.jsxLayout?.componentStructure) {
          missingDependencies.push('component structure from JSX Layout');
        }
        break;
        
      case 'component-assembler':
        // Component assembler needs all previous results
        if (!tcc.stateLogic?.functions?.length) {
          missingDependencies.push('functions from State Design');
        }
        if (!tcc.jsxLayout?.componentStructure) {
          missingDependencies.push('component structure from JSX Layout');
        }
        if (!tcc.styling?.styledComponentCode) {
          missingDependencies.push('styled component code from Tailwind Styling');
        }
        break;
        
      case 'code-validator':
        // Code validator needs assembled component
        if (!tcc.assembledComponent?.finalComponentCode) {
          missingDependencies.push('final component code from Component Assembler');
        }
        break;
        
      case 'tool-finalizer':
        // Tool finalizer needs validated code
        if (!tcc.validationResult) {
          missingDependencies.push('validation result from Code Validator');
        }
        break;
    }

    return {
      canProceed: missingDependencies.length === 0,
      missingDependencies,
    };
  }

  // Get TCC summary for logging
  getTCCSummary(tcc: ToolConstructionContext): {
    jobId: string;
    currentStep: OrchestrationStep;
    completedAgents: AgentType[];
    pendingAgents: AgentType[];
    dataSize: number;
  } {
    const completedAgents: AgentType[] = [];
    const pendingAgents: AgentType[] = [];

    Object.entries(tcc.stepStatus).forEach(([agent, status]) => {
      if (status === 'completed') {
        completedAgents.push(agent as AgentType);
      } else if (status === 'pending' || status === 'in_progress') {
        pendingAgents.push(agent as AgentType);
      }
    });

    return {
      jobId: tcc.jobId,
      currentStep: tcc.currentOrchestrationStep,
      completedAgents,
      pendingAgents,
      dataSize: JSON.stringify(tcc).length,
    };
  }
} 