// TCC Manager - Single Source of Truth for Tool Construction Context
// Manages TCC state flow through agent pipeline

import { 
  ToolConstructionContext, 
  AgentType, 
  AgentStatus, 
  OrchestrationStep,
  createEmptyTCC,
  updateTCCWithAgentResult,
  isValidTCC 
} from '@/lib/types/tcc-unified';
import { filterBrainstormDataForAgent } from '@/lib/utils/brainstorm-filter';

export class TCCManager {
  private currentTCC: ToolConstructionContext | null = null;

  constructor() {}

  initializeTCC(jobId: string, userInput: any, brainstormData: any): ToolConstructionContext {
    this.currentTCC = createEmptyTCC();
    this.currentTCC.jobId = jobId;
    this.currentTCC.userInput = userInput;
    this.currentTCC.brainstormData = brainstormData;
    this.currentTCC.orchestrationSteps = [];
    
    console.log(`[TCC Manager] Initialized TCC for job: ${jobId}`);
    return this.currentTCC;
  }

  getCurrentTCC(): ToolConstructionContext {
    if (!this.currentTCC) {
      throw new Error('TCC not initialized. Call initializeTCC first.');
    }
    return this.currentTCC;
  }

  updateTCCAfterAgent(
    agent: AgentType, 
    agentResult: any, 
    status: AgentStatus = 'completed'
  ): ToolConstructionContext {
    if (!this.currentTCC) {
      throw new Error('TCC not initialized');
    }

    // Update TCC with agent result
    this.currentTCC = updateTCCWithAgentResult(this.currentTCC, agent, agentResult);

    // Add orchestration step
    const step: OrchestrationStep = {
      agent,
      status,
      timestamp: new Date().toISOString(),
      result: agentResult,
      validationPassed: true, // Will be set by validation manager
    };

    this.currentTCC.orchestrationSteps.push(step);

    console.log(`[TCC Manager] Updated TCC after ${agent} agent`);
    return this.currentTCC;
  }

  getFilteredBrainstormForAgent(agent: AgentType): any {
    if (!this.currentTCC?.brainstormData) {
      throw new Error('No brainstorm data available in TCC');
    }

    // Apply agent-specific filtering to reduce context window bloat
    const filteredData = filterBrainstormDataForAgent(this.currentTCC.brainstormData, agent);
    
    console.log(`[TCC Manager] Filtered brainstorm data for ${agent}:`, {
      originalSize: JSON.stringify(this.currentTCC.brainstormData).length,
      filteredSize: JSON.stringify(filteredData).length,
      reduction: `${Math.round((1 - JSON.stringify(filteredData).length / JSON.stringify(this.currentTCC.brainstormData).length) * 100)}%`
    });

    return filteredData;
  }

  validateTCCState(): { isValid: boolean; errors: string[] } {
    if (!this.currentTCC) {
      return { isValid: false, errors: ['TCC not initialized'] };
    }

    const validation = isValidTCC(this.currentTCC);
    
    if (!validation.isValid) {
      console.error('[TCC Manager] TCC validation failed:', validation.errors);
    }

    return validation;
  }

  getTCCForAgent(agent: AgentType): {
    tcc: ToolConstructionContext;
    filteredBrainstorm: any;
    previousResults: Record<string, any>;
  } {
    const tcc = this.getCurrentTCC();
    const filteredBrainstorm = this.getFilteredBrainstormForAgent(agent);

    // Get results from previous agents
    const previousResults: Record<string, any> = {};
    for (const step of tcc.orchestrationSteps) {
      if (step.status === 'completed' && step.result) {
        previousResults[step.agent] = step.result;
      }
    }

    return {
      tcc,
      filteredBrainstorm,
      previousResults,
    };
  }

  getAgentDependencies(agent: AgentType): AgentType[] {
    // Define agent dependencies for sequential execution
    const dependencies: Record<AgentType, AgentType[]> = {
      'function-planner': [],
      'state-design': ['function-planner'],
      'jsx-layout': ['function-planner', 'state-design'],
      'tailwind-styling': ['jsx-layout'],
      'component-assembler': ['function-planner', 'state-design', 'jsx-layout', 'tailwind-styling'],
      'code-validator': ['component-assembler'],
      'tool-finalizer': ['code-validator'],
    };

    return dependencies[agent] || [];
  }

  areAgentDependenciesMet(agent: AgentType): boolean {
    const dependencies = this.getAgentDependencies(agent);
    const completedAgents = this.currentTCC?.orchestrationSteps
      .filter(step => step.status === 'completed')
      .map(step => step.agent) || [];

    return dependencies.every(dep => completedAgents.includes(dep));
  }

  getNextAgent(): AgentType | null {
    if (!this.currentTCC) return null;

    const allAgents: AgentType[] = [
      'function-planner',
      'state-design', 
      'jsx-layout',
      'tailwind-styling',
      'component-assembler',
      'code-validator',
      'tool-finalizer'
    ];

    const completedAgents = this.currentTCC.orchestrationSteps
      .filter(step => step.status === 'completed')
      .map(step => step.agent);

    // Find first agent that hasn't completed and has dependencies met
    for (const agent of allAgents) {
      if (!completedAgents.includes(agent) && this.areAgentDependenciesMet(agent)) {
        return agent;
      }
    }

    return null; // All agents completed
  }

  getTCCSummary(): {
    jobId: string;
    completedAgents: AgentType[];
    currentAgent: AgentType | null;
    isComplete: boolean;
    validationStatus: { isValid: boolean; errors: string[] };
  } {
    if (!this.currentTCC) {
      return {
        jobId: 'none',
        completedAgents: [],
        currentAgent: null,
        isComplete: false,
        validationStatus: { isValid: false, errors: ['TCC not initialized'] }
      };
    }

    const completedAgents = this.currentTCC.orchestrationSteps
      .filter(step => step.status === 'completed')
      .map(step => step.agent);

    const currentAgent = this.getNextAgent();
    const isComplete = currentAgent === null;
    const validationStatus = this.validateTCCState();

    return {
      jobId: this.currentTCC.jobId,
      completedAgents,
      currentAgent,
      isComplete,
      validationStatus,
    };
  }
} 