// Agent Executor - Main execution logic with comprehensive logging
// Handles agent execution, retry logic, and dependency validation

import { AgentType, ToolConstructionContext, AgentStatus } from '@/lib/types/tcc-unified';
import { ModelManager } from './model-manager';
import { TCCManager } from './tcc-manager';
import { ValidationManager, ValidationResult } from './validation-manager';

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  validationResult?: ValidationResult;
  retryCount: number;
  executionTime: number;
}

export interface AgentExecutionContext {
  agent: AgentType;
  tcc: ToolConstructionContext;
  filteredBrainstorm: any;
  previousResults: Record<string, any>;
  modelId: string;
  maxRetries: number;
}

export class AgentExecutor {
  private modelManager: ModelManager;
  private tccManager: TCCManager;
  private validationManager: ValidationManager;

  constructor(
    modelManager: ModelManager,
    tccManager: TCCManager,
    validationManager: ValidationManager
  ) {
    this.modelManager = modelManager;
    this.tccManager = tccManager;
    this.validationManager = validationManager;
  }

  async executeAgent(context: AgentExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;
    let lastValidationResult: ValidationResult | undefined;

    console.log(`[Agent Executor] Starting ${context.agent} execution...`);

    while (retryCount <= context.maxRetries) {
      try {
        // 1. Get AI model for this agent
        const model = await this.modelManager.getModelForAgent(
          context.agent,
          { [context.agent]: context.modelId } // Convert to AgentModelMapping format
        );

        // 2. Get agent-specific prompt and system message
        const { systemPrompt, userPrompt } = await this.getPromptsForAgent(
          context.agent,
          context.filteredBrainstorm,
          context.previousResults,
          lastValidationResult // Include validation errors for retry
        );

        // 3. Execute AI generation
        console.log(`[Agent Executor] Executing ${context.agent} (attempt ${retryCount + 1}/${context.maxRetries + 1})`);
        
        const aiResult = await this.callAIAgent(model, systemPrompt, userPrompt, context.agent);

        // 4. Validate result
        const validationResult = await this.validationManager.validateAgentResult(
          context.agent,
          aiResult,
          context.tcc
        );

        lastValidationResult = validationResult;

        // 5. Check if validation passed or auto-correction succeeded
        const finalResult = validationResult.correctedData || aiResult;
        
        if (validationResult.isValid || validationResult.correctedData) {
          const executionTime = Date.now() - startTime;
          
          console.log(`[Agent Executor] ${context.agent} completed successfully:`, {
            retryCount,
            executionTime: `${executionTime}ms`,
            autoCorrected: !!validationResult.correctedData,
            warningCount: validationResult.warnings.length,
          });

          return {
            success: true,
            result: finalResult,
            validationResult,
            retryCount,
            executionTime,
          };
        }

        // 6. Validation failed - prepare for retry
        lastError = `Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`;
        
        if (!validationResult.retryRecommended) {
          // Don't retry if validation says it won't help
          break;
        }

        retryCount++;
        
        if (retryCount <= context.maxRetries) {
          console.log(`[Agent Executor] ${context.agent} validation failed, retrying...`, {
            attempt: retryCount + 1,
            errors: validationResult.errors.length,
            reason: lastError,
          });
        }

      } catch (error) {
        lastError = `Execution error: ${error}`;
        retryCount++;
        
        console.error(`[Agent Executor] ${context.agent} execution failed:`, error);
        
        if (retryCount <= context.maxRetries) {
          console.log(`[Agent Executor] Retrying ${context.agent} after error...`);
        }
      }
    }

    // All retries exhausted
    const executionTime = Date.now() - startTime;
    
    console.error(`[Agent Executor] ${context.agent} failed after ${retryCount} attempts:`, {
      finalError: lastError,
      executionTime: `${executionTime}ms`,
    });

    return {
      success: false,
      error: lastError || 'Unknown error',
      validationResult: lastValidationResult,
      retryCount,
      executionTime,
    };
  }

  private async getPromptsForAgent(
    agent: AgentType,
    filteredBrainstorm: any,
    previousResults: Record<string, any>,
    validationResult?: ValidationResult
  ): Promise<{ systemPrompt: string; userPrompt: string }> {
    // Import agent-specific prompts
    const promptModules: Record<AgentType, () => Promise<any>> = {
      'function-planner': () => import('@/lib/prompts/function-planner-prompt'),
      'state-design': () => import('@/lib/prompts/state-design-prompt'),
      'jsx-layout': () => import('@/lib/prompts/jsx-layout-prompt'),
      'tailwind-styling': () => import('@/lib/prompts/tailwind-styling-prompt'),
      'component-assembler': () => import('@/lib/prompts/component-assembler-prompt'),
      'code-validator': () => import('@/lib/prompts/code-validator-prompt'),
      'tool-finalizer': () => import('@/lib/prompts/tool-finalizer-prompt'),
    };

    const promptModule = await promptModules[agent]();
    
    // Get system prompt
    const systemPrompt = promptModule.getSystemPrompt ? 
      promptModule.getSystemPrompt() : 
      promptModule.systemPrompt;

    // Get user prompt with context
    let userPrompt = promptModule.getUserPrompt ? 
      promptModule.getUserPrompt(filteredBrainstorm, previousResults) :
      promptModule.getUserPrompt || '';

    // Add validation feedback for retries
    if (validationResult && !validationResult.isValid) {
      userPrompt += '\n\n--- VALIDATION FEEDBACK FOR RETRY ---\n';
      userPrompt += 'The previous attempt had the following issues:\n';
      validationResult.errors.forEach(error => {
        userPrompt += `- ${error.message}\n`;
      });
      userPrompt += '\nPlease address these issues in your response.\n';
    }

    return { systemPrompt, userPrompt };
  }

  private async callAIAgent(
    model: any,
    systemPrompt: string,
    userPrompt: string,
    agent: AgentType
  ): Promise<any> {
    try {
      // Use generateObject for structured output (AI-First approach)
      const schema = await this.getSchemaForAgent(agent);
      
      if (schema) {
        const result = await model.generateObject({
          schema,
          system: systemPrompt,
          prompt: userPrompt,
        });
        
        return result.object;
      } else {
        // Fallback to generateText for agents without schemas
        const result = await model.generateText({
          system: systemPrompt,
          prompt: userPrompt,
        });
        
        return { content: result.text };
      }

    } catch (error) {
      console.error(`[Agent Executor] AI call failed for ${agent}:`, error);
      throw error;
    }
  }

  private async getSchemaForAgent(agent: AgentType): Promise<any> {
    // Import agent-specific Zod schemas
    try {
      const schemaModules: Record<AgentType, () => Promise<any>> = {
        'function-planner': () => import('@/lib/schemas/function-planner-schema'),
        'state-design': () => import('@/lib/schemas/state-design-schema'),
        'jsx-layout': () => import('@/lib/schemas/jsx-layout-schema'),
        'tailwind-styling': () => import('@/lib/schemas/tailwind-styling-schema'),
        'component-assembler': () => import('@/lib/schemas/component-assembler-schema'),
        'code-validator': () => import('@/lib/schemas/code-validator-schema'),
        'tool-finalizer': () => import('@/lib/schemas/tool-finalizer-schema'),
      };

      const schemaModule = await schemaModules[agent]();
      return schemaModule.schema || schemaModule.default;

    } catch (error) {
      console.warn(`[Agent Executor] No schema found for ${agent}, using text generation`);
      return null;
    }
  }

  async validateAgentDependencies(
    agent: AgentType,
    tcc: ToolConstructionContext
  ): Promise<{ isValid: boolean; missingDependencies: AgentType[] }> {
    const dependencies = this.tccManager.getAgentDependencies(agent);
    const completedAgents = tcc.orchestrationSteps
      .filter(step => step.status === 'completed')
      .map(step => step.agent);

    const missingDependencies = dependencies.filter(dep => !completedAgents.includes(dep));

    return {
      isValid: missingDependencies.length === 0,
      missingDependencies,
    };
  }

  getExecutionMetrics(agent: AgentType, executionResult: ExecutionResult): {
    agent: AgentType;
    success: boolean;
    executionTime: number;
    retryCount: number;
    validationPassed: boolean;
    errorCount: number;
    warningCount: number;
  } {
    return {
      agent,
      success: executionResult.success,
      executionTime: executionResult.executionTime,
      retryCount: executionResult.retryCount,
      validationPassed: executionResult.validationResult?.isValid || false,
      errorCount: executionResult.validationResult?.errors.length || 0,
      warningCount: executionResult.validationResult?.warnings.length || 0,
    };
  }
} 