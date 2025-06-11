import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
// TCC Store operations removed - using prop-based TCC passing
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

const assembledComponentSchema = z.object({
  finalComponentCode: z.string()
    .min(10)
    .describe('The complete, functional React component code using React.createElement syntax. Must be executable JavaScript without imports or exports.'),
  componentName: z.string()
    .min(1)
    .describe('The name of the generated component (e.g., "BusinessHealthCalculator")'),
  hooks: z.array(z.string())
    .optional()
    .default([])
    .describe('Array of React hooks used (e.g., ["useState", "useEffect"]). Can be empty.'),
  functions: z.array(z.string())
    .optional()
    .default([])
    .describe('Array of function names defined in the component. Can be empty.'),
  estimatedLines: z.number()
    .int()
    .min(1)
    .optional()
    .default(50)
    .describe('Estimated number of lines in the component code'),
});

// Type definitions for component assembly
export type AssembledComponent = z.infer<typeof assembledComponentSchema>;

export type ComponentAssemblerResult = {
  success: boolean;
  assembledComponent?: AssembledComponent;
  error?: string;
};

// Input schema
const ComponentAssemblerRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  mockTcc: z.custom<Partial<ToolConstructionContext>>().optional()
});

export type ComponentAssemblerRequest = z.infer<typeof ComponentAssemblerRequestSchema>;

function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

/**
 * Component Assembler Agent - Combines JSX, state, and styling into final React component
 */
export async function assembleComponent(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
}): Promise<{
  success: boolean;
  assembledComponent?: AssembledComponent;
  error?: string;
  updatedTcc?: ToolConstructionContext;
}> {
  const { jobId, selectedModel } = request;
  const tcc = request.mockTcc || request.tcc;

  try {
    logger.info({ jobId }, '🔧 ComponentAssembler: Starting component assembly');

    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    // Validate we have all required pieces
    if (!tcc.jsxLayout || !tcc.stateLogic || !tcc.styling) {
      const missing = [
        !tcc.jsxLayout && 'jsxLayout',
        !tcc.stateLogic && 'stateLogic',
        !tcc.styling && 'styling',
      ].filter(Boolean).join(', ');
      throw new Error(`Prerequisites missing in TCC: ${missing}`);
    }

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
      'Assembling final React component...',
      tcc // Pass TCC with userId
    );

    // Assemble the component with AI
    const assembledComponent = await generateAssembledComponent(
      tcc,
      selectedModel,
    );

    // Update TCC with results
    const updatedTCC: ToolConstructionContext = {
      ...tcc,
      assembledComponentCode: assembledComponent.finalComponentCode,
      currentOrchestrationStep: OrchestrationStepEnum.enum.validating_code, // Set next step
      steps: {
        ...tcc.steps,
        assemblingComponent: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt:
            tcc.steps?.assemblingComponent?.startedAt ||
            new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: assembledComponent,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // Debug: Log what we're storing in TCC
    logger.info({
      jobId,
      assembledCodeLength: assembledComponent.finalComponentCode.length,
      hasImportsInFinalCode: assembledComponent.finalComponentCode.includes('import ')
    }, '🔧 ComponentAssembler: 🔍 TCC Update Debug - storing assembled component code');

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'completed',
      'Component assembled successfully!',
      updatedTCC // Pass updated TCC with userId
    );

    logger.info({ jobId }, '🔧 ComponentAssembler: Completed successfully');
    return { success: true, assembledComponent, updatedTcc: updatedTCC };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { jobId, error: errorMessage },
      '🔧 ComponentAssembler: Error in main execution block',
    );
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'failed',
      errorMessage,
      tcc // Pass TCC with userId even on failure
    );
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Triggers the check-parallel-completion endpoint to move the orchestration forward.
 * @param jobId The ID of the current tool creation job.
 */
async function triggerNextOrchestrationStep(jobId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  
  try {
    logger.info({ jobId, baseUrl }, '🔧 ComponentAssembler: Triggering next orchestration step...');
    
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Orchestrator responded with status ${response.status}: ${errorBody}`);
    }

    logger.info({ jobId }, '🔧 ComponentAssembler: Successfully triggered next orchestration step.');

  } catch (error) {
    logger.error({ 
      jobId, 
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error) 
    }, '🔧 ComponentAssembler: Failed to trigger next orchestration step.');
  }
}

/**
 * Use AI to generate the assembled component based on existing TCC parts
 */
async function generateAssembledComponent(tcc: ToolConstructionContext, selectedModel?: string): Promise<AssembledComponent> {
  // 🔍 DEBUG: Log brainstorm data structure for debugging
  logger.info({ 
    jobId: tcc.jobId,
    hasBrainstormData: !!tcc.brainstormData,
    brainstormDataKeys: tcc.brainstormData ? Object.keys(tcc.brainstormData) : [],
    brainstormDataSize: tcc.brainstormData ? JSON.stringify(tcc.brainstormData).length : 0
  }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Available brainstorm data structure');

  if (tcc.brainstormData) {
    const brainstorm = tcc.brainstormData;
    logger.info({ 
      jobId: tcc.jobId,
      coreConcept: brainstorm.coreConcept || brainstorm.coreWConcept || 'Not specified',
      valueProposition: brainstorm.valueProposition || 'Not specified',
      suggestedInputsCount: brainstorm.suggestedInputs?.length || 0,
      keyCalculationsCount: brainstorm.keyCalculations?.length || 0,
      interactionFlowCount: brainstorm.interactionFlow?.length || 0,
      hasLeadCaptureStrategy: !!brainstorm.leadCaptureStrategy,
      hasCalculationLogic: !!brainstorm.calculationLogic && brainstorm.calculationLogic.length > 0
    }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Detailed brainstorm data analysis');

    // Log specific brainstorm fields that could influence component assembly
    if (brainstorm.keyCalculations && brainstorm.keyCalculations.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        keyCalculations: brainstorm.keyCalculations.map(calc => ({
          name: calc.name,
          formula: calc.formula?.substring(0, 100) + (calc.formula?.length > 100 ? '...' : ''),
          description: calc.description?.substring(0, 100) + (calc.description?.length > 100 ? '...' : '')
        }))
      }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Key calculations that should be implemented');
    }

    if (brainstorm.calculationLogic && brainstorm.calculationLogic.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        calculationLogic: brainstorm.calculationLogic.map(logic => ({
          name: logic.name,
          formula: logic.formula?.substring(0, 100) + (logic.formula?.length > 100 ? '...' : '')
        }))
      }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Calculation logic for function implementation');
    }

    if (brainstorm.interactionFlow && brainstorm.interactionFlow.length > 0) {
      logger.info({ 
        jobId: tcc.jobId,
        interactionFlow: brainstorm.interactionFlow.map(step => ({
          step: step.step,
          title: step.title,
          userAction: step.userAction?.substring(0, 100) + (step.userAction?.length > 100 ? '...' : '')
        }))
      }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] Interaction flow for user experience');
    }
  } else {
    logger.warn({ 
      jobId: tcc.jobId,
      userInputDescription: tcc.userInput?.description?.substring(0, 100) + '...',
      toolType: tcc.userInput?.toolType || 'Not specified',
      targetAudience: tcc.userInput?.targetAudience || 'Not specified'
    }, '🔧 ComponentAssembler: [BRAINSTORM DEBUG] ⚠️ NO BRAINSTORM DATA - Component assembly working with minimal context only');
  }

  // Get model configuration
  const { provider, modelId } = getModelForAgent('componentAssembler', selectedModel, tcc);
  logger.info({ provider, modelId }, '🔧 ComponentAssembler: Using model');
  const modelInstance = createModelInstance(provider, modelId);

  const systemPrompt = `You are a React component assembler. Convert JSX to React.createElement syntax and integrate state logic.

🚨 CRITICAL OUTPUT REQUIREMENTS:
- Return a JSON object with: finalComponentCode, componentName, hooks, functions, estimatedLines
- finalComponentCode: Complete JavaScript React component using React.createElement() ONLY
- componentName: Valid JavaScript identifier (e.g., "BusinessCalculator")
- hooks: Array of hook names used (e.g., ["useState", "useEffect"]) or empty array
- functions: Array of function names defined or empty array  
- estimatedLines: Number estimate of code lines

🚨 VARIABLE NAMING RULES - CRITICAL:
- NEVER use the same name for local variables as React state variables
- State variables: revenue, netIncome, currentAssets, etc.
- Local variables: rev, income, assets, etc. (use abbreviated forms)
- Example: const rev = Number(revenue); NOT const revenue = Number(revenue);

❌ FORBIDDEN:
- NO import statements
- NO export statements  
- NO JSX syntax (<div>, <Button>)
- NO TypeScript (interface, React.FC, type annotations)
- NO variable name collisions (shadowing state variables)

✅ REQUIRED FORMAT:
\`\`\`javascript
'use client';

const ComponentName = () => {
  const [state, setState] = useState(initialValue);
  
  const handleFunction = () => {
    // Use abbreviated names: const val = Number(state);
    // NOT: const state = Number(state);
  };
  
  return React.createElement('div', { 
    className: 'styles',
    'data-style-id': 'element-id',
    key: 'unique-key'
  }, [
    React.createElement(Card, { key: 'card' }, 'content')
  ]);
};
\`\`\`

AVAILABLE COMPONENTS (use directly):
React, useState, useEffect, useCallback, useMemo, Card, CardHeader, CardContent, CardTitle, Button, Input, Label, Select, Textarea, AlertCircle, Info, Loader2

RULES:
1. Start with 'use client';
2. Use React.createElement() for ALL elements
3. Add 'data-style-id' and 'key' props
4. Apply className from provided styling
5. Integrate all state logic provided
6. Use abbreviated variable names in calculations (rev, income, assets, etc.)
7. End with just the function - NO exports`;

  // Generate component name with debugging
  const suggestedComponentName = generateComponentName(tcc.userInput.description);
  logger.info({
    tccJobId: tcc.jobId,
    originalDescription: tcc.userInput.description,
    suggestedComponentName,
    hasStyledCode: !!(tcc as any).styling?.styledComponentCode,
    hasJsxLayout: !!tcc.jsxLayout?.componentStructure,
    hasStateLogic: !!tcc.stateLogic
  }, '🔧 ComponentAssembler: 🔍 Input data analysis');

  const userPrompt = `Please assemble the React component using the following parts.

Component Name Suggestion: ${suggestedComponentName}

STYLED JSX CODE (complete JSX with Tailwind classes already applied):
\`\`\`jsx
${(tcc as any).styling?.styledComponentCode || tcc.jsxLayout?.componentStructure || 'No styled code available'}
\`\`\`

STATE LOGIC (the brains and functionality):
\`\`\`json
${JSON.stringify(tcc.stateLogic, null, 2)}
\`\`\`

STYLE MAP (for reference - element IDs to classes):
\`\`\`json
${JSON.stringify((tcc as any).styling?.styleMap, null, 2)}
\`\`\`

Convert the styled JSX above to React.createElement() syntax and integrate with the state logic. Generate the complete JSON object containing the final component code WITHOUT imports and using the available components from the execution context.`;

  // Log prompts with proper formatting for debugging
  logger.info({
    tccJobId: tcc.jobId,
    provider,
    modelId,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length
  }, '🔧 ComponentAssembler: 📝 Sending prompts to AI (see formatted output below)');
  
  // Output formatted prompts to console for easy reading
  console.log('\n' + '='.repeat(80));
  console.log('🔧 ComponentAssembler SYSTEM PROMPT:');
  console.log('='.repeat(80));
  console.log(systemPrompt);
  console.log('='.repeat(80));
  console.log('🔧 ComponentAssembler USER PROMPT:'); 
  console.log('='.repeat(80));
  console.log(userPrompt);
  console.log('='.repeat(80) + '\n');

  try {
    const { object } = await generateObject({
      model: modelInstance,
      schema: assembledComponentSchema,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.1,
      maxTokens: 8192,
    });
    logger.info({ 
      tccJobId: tcc.jobId, 
      provider, 
      modelId 
    }, '🔧 ComponentAssembler: ✅ AI generation successful');

    // Log the AI response for debugging
    console.log('\n' + '='.repeat(80));
    console.log('🔧 ComponentAssembler AI RESPONSE:');
    console.log('='.repeat(80));
    console.log('Component Code:');
    console.log(object.finalComponentCode);
    console.log('\nComponent Name:');
    console.log(object.componentName);
    console.log('\nHooks:');
    console.log(JSON.stringify(object.hooks || [], null, 2));
    console.log('='.repeat(80) + '\n');

    // Post-process to automatically remove import statements if AI ignored instructions
    let finalCode = object.finalComponentCode;
    const hasImports = finalCode.includes('import ');
    
    if (hasImports) {
      logger.warn({
        tccJobId: tcc.jobId,
        provider,
        modelId
      }, '🔧 ComponentAssembler: ⚠️ AI generated imports despite instructions! Auto-removing...');
      
      // Remove import lines
      const lines = finalCode.split('\n');
      const filteredLines = lines.filter(line => !line.trim().startsWith('import '));
      finalCode = filteredLines.join('\n');
      
      console.log('\n' + '⚠️'.repeat(40));
      console.log('🔧 ComponentAssembler: FIXED - Removed import statements:');
      console.log('⚠️'.repeat(40));
      console.log('CLEANED CODE:');
      console.log(finalCode);
      console.log('⚠️'.repeat(40) + '\n');
      
      // Update the object
      object.finalComponentCode = finalCode;
    }

    // Post-process to automatically remove TypeScript syntax if AI ignored instructions
    const hasTypeScriptSyntax = finalCode.includes('interface ') || finalCode.includes(': React.FC') || finalCode.includes('<string>') || finalCode.includes('<number>');
    
    if (hasTypeScriptSyntax) {
      logger.warn({
        tccJobId: tcc.jobId,
        provider,
        modelId
      }, '🔧 ComponentAssembler: ⚠️ AI generated TypeScript syntax despite instructions! Auto-removing...');
      
      // Strip TypeScript syntax
      let strippedCode = finalCode;
      
      // Remove interface declarations entirely
      strippedCode = strippedCode.replace(/interface\s+\w+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
      
      // Remove React.FC type annotations
      strippedCode = strippedCode.replace(/:\s*React\.FC\s*<[^>]*>/g, '');
      strippedCode = strippedCode.replace(/:\s*FC\s*<[^>]*>/g, '');
      
      // Remove type annotations from function parameters
      strippedCode = strippedCode.replace(/(\w+)\s*:\s*[^,)=]+/g, '$1');
      
      // Remove generic type parameters
      strippedCode = strippedCode.replace(/<[^<>]*(?:<[^<>]*>[^<>]*)*>/g, '');
      
      // Clean up any double spaces or empty lines
      strippedCode = strippedCode
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .replace(/  +/g, ' ')
        .trim();
      
      finalCode = strippedCode;
      
      console.log('\n' + '🔧'.repeat(40));
      console.log('🔧 ComponentAssembler: FIXED - Removed TypeScript syntax:');
      console.log('🔧'.repeat(40));
      console.log('JAVASCRIPT CODE:');
      console.log(finalCode);
      console.log('🔧'.repeat(40) + '\n');
      
      // Update the object
      object.finalComponentCode = finalCode;
    }

    // Post-process to automatically remove export statements if AI ignored instructions
    const hasExportStatements = finalCode.includes('export ');
    
    if (hasExportStatements) {
      logger.warn({
        tccJobId: tcc.jobId,
        provider,
        modelId
      }, '🔧 ComponentAssembler: ⚠️ AI generated export statements despite instructions! Auto-removing...');
      
      // Strip export statements
      let cleanedCode = finalCode;
      
      // Remove export default statements
      cleanedCode = cleanedCode.replace(/export\s+default\s+\w+\s*;?\s*$/gm, '');
      
      // Remove export const/let/var statements
      cleanedCode = cleanedCode.replace(/export\s+(const|let|var)\s+/g, '$1 ');
      
      // Remove standalone export statements
      cleanedCode = cleanedCode.replace(/export\s*\{[^}]*\}\s*;?\s*$/gm, '');
      
      // Clean up any trailing empty lines
      cleanedCode = cleanedCode.replace(/\n\s*\n\s*$/g, '\n').trim();
      
      finalCode = cleanedCode;
      
      console.log('\n' + '🚫'.repeat(40));
      console.log('🔧 ComponentAssembler: FIXED - Removed export statements:');
      console.log('🚫'.repeat(40));
      console.log('CLEANED CODE:');
      console.log(finalCode);
      console.log('🚫'.repeat(40) + '\n');
      
      // Update the object
      object.finalComponentCode = finalCode;
    }

    // Post-process to fix variable name collisions (e.g., using 'revenue' as both state and local variable)
    const hasVariableCollisions = finalCode.match(/const\s+(\w+)\s*=\s*Number\(\1\)/g);
    
    if (hasVariableCollisions) {
      logger.warn({
        tccJobId: tcc.jobId,
        provider,
        modelId,
        collisions: hasVariableCollisions
      }, '🔧 ComponentAssembler: ⚠️ AI generated variable name collisions! Auto-fixing...');
      
      // Fix variable collisions by using abbreviated variable names
      let fixedCode = finalCode;
      
      // Pattern: const revenue = Number(revenue) becomes const rev = Number(revenue)
      // Use abbreviated names to avoid conflicts
      const varMap: Record<string, string> = {
        'revenue': 'rev',
        'netIncome': 'income',
        'currentAssets': 'assets',
        'currentLiabilities': 'liabilities',
        'totalLiabilities': 'totalLiabs',
        'shareholdersEquity': 'equity'
      };
      
      // Replace each collision with a safe variable name
      hasVariableCollisions.forEach(collision => {
        const match = collision.match(/const\s+(\w+)\s*=\s*Number\(\1\)/);
        if (match) {
          const varName = match[1];
          const safeVarName = varMap[varName] || `${varName}Val`;
          
          // Replace the collision declaration and subsequent usage in the same function
          const functionPattern = new RegExp(
            `(const\\s+${varName}\\s*=\\s*Number\\(${varName}\\);[\\s\\S]*?)(\\b${varName}\\b)(?![a-zA-Z])([\\s\\S]*?)(?=\\n\\s*\\}|$)`,
            'g'
          );
          
          fixedCode = fixedCode.replace(
            new RegExp(`const\\s+${varName}\\s*=\\s*Number\\(${varName}\\)`, 'g'),
            `const ${safeVarName} = Number(${varName})`
          );
          
          // Replace usage within the calculation logic (but not in Number() calls)
          fixedCode = fixedCode.replace(
            new RegExp(`(const\\s+${safeVarName}\\s*=\\s*Number\\([^)]+\\);[\\s\\S]*?)(\\b${varName}\\b)(?!\\s*[),])`, 'g'),
            (match, prefix, varUsage) => {
              // Replace variable usage in calculations but preserve state variable references
              if (match.includes('/ ' + varName) || match.includes('* ' + varName) || match.includes('- ' + varName) || match.includes('+ ' + varName)) {
                return match.replace(varUsage, safeVarName);
              }
              return match;
            }
          );
        }
      });
      
      finalCode = fixedCode;
      
      console.log('\n' + '🔄'.repeat(40));
      console.log('🔧 ComponentAssembler: FIXED - Variable name collisions:');
      console.log('🔄'.repeat(40));
      console.log('FIXED CODE:');
      console.log(finalCode);
      console.log('🔄'.repeat(40) + '\n');
      
      // Update the object
      object.finalComponentCode = finalCode;
    }

    // Log final code length and imports check for debugging
    logger.info({
      jobId: tcc.jobId,
      assembledCodeLength: finalCode.length,
      hasImportsInFinalCode: finalCode.includes('import '),
      hasExportsInFinalCode: finalCode.includes('export '),
    }, '🔧 ComponentAssembler: 🔍 TCC Update Debug - storing assembled component code');

    return object;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error), 
      provider, 
      modelId,
      tccJobId: tcc.jobId,
      userDescription: tcc.userInput.description 
    }, '🔧 ComponentAssembler: 🚨 AI GENERATION FAILED - Returning ERROR FALLBACK component');
    
    // Emit a warning about fallback usage
    await emitStepProgress(
      tcc.jobId,
      OrchestrationStepEnum.enum.assembling_component,
      'in_progress',
      '⚠️ AI generation failed, using error fallback component...',
      tcc
    );
    
    return generateFallbackComponent(tcc);
  }
}

function getModelForAgent(agentName: string, selectedModel?: string, tcc?: ToolConstructionContext): { provider: string; modelId: string } {
    // PRIORITY 1: User-selected model from UI (highest priority)
    if (selectedModel && selectedModel !== 'default') {
        const provider = getModelProvider(selectedModel);
        if (provider !== 'unknown') {
            logger.info({ 
                agentName, 
                selectedModel, 
                provider, 
                source: 'USER_SELECTED' 
            }, '🔧 ComponentAssembler: Using USER-SELECTED model from UI');
            return { provider, modelId: selectedModel };
        } else {
            logger.warn({ 
                agentName, 
                selectedModel 
            }, '🔧 ComponentAssembler: User-selected model has unknown provider, falling back to TCC mapping');
        }
    }

    // PRIORITY 2: Agent model mapping from TCC (from workbench agent-specific configuration)
    if (tcc?.agentModelMapping && tcc.agentModelMapping['component-assembler']) {
        const mappedModel = tcc.agentModelMapping['component-assembler'];
        const provider = getModelProvider(mappedModel);
        if (provider !== 'unknown') {
            logger.info({ 
                agentName, 
                mappedModel, 
                provider, 
                source: 'TCC_AGENT_MAPPING' 
            }, '🔧 ComponentAssembler: Using TCC AGENT MAPPING model from workbench');
            return { provider, modelId: mappedModel };
        } else {
            logger.warn({ 
                agentName, 
                mappedModel 
            }, '🔧 ComponentAssembler: TCC mapped model has unknown provider, falling back to config');
        }
    } else if (tcc) {
        logger.warn({ 
            agentName,
            hasAgentModelMapping: !!tcc.agentModelMapping,
            agentMappingKeys: tcc.agentModelMapping ? Object.keys(tcc.agentModelMapping) : [],
            source: 'TCC_AGENT_MAPPING_MISSING'
        }, '🔧 ComponentAssembler: ⚠️ No TCC agent mapping found for component-assembler');
    }

    // PRIORITY 3: Primary model from configuration
    const primaryModel = getPrimaryModel(agentName as any);
    if (primaryModel && 'modelInfo' in primaryModel) {
        logger.info({ 
            agentName, 
            provider: primaryModel.provider, 
            modelId: primaryModel.modelInfo.id,
            source: 'PRIMARY_CONFIG' 
        }, '🔧 ComponentAssembler: Using PRIMARY model from configuration');
        return { provider: primaryModel.provider, modelId: primaryModel.modelInfo.id };
    }

    // PRIORITY 4: Fallback model from configuration
    const fallbackModel = getFallbackModel(agentName as any);
    if (fallbackModel && 'modelInfo' in fallbackModel) {
        logger.warn({ 
            agentName, 
            provider: fallbackModel.provider, 
            modelId: fallbackModel.modelInfo.id,
            source: 'FALLBACK_CONFIG' 
        }, '🔧 ComponentAssembler: ⚠️ Using FALLBACK model from configuration');
        return { provider: fallbackModel.provider, modelId: fallbackModel.modelInfo.id };
    }

    // PRIORITY 5: Final hardcoded fallback (indicates configuration problem)
    logger.error({ 
        agentName, 
        selectedModel,
        tccAgentMapping: tcc?.agentModelMapping ? Object.keys(tcc.agentModelMapping) : 'No TCC provided',
        source: 'HARDCODED_FALLBACK' 
    }, '🔧 ComponentAssembler: 🚨 CRITICAL: No model configuration found! Using hardcoded fallback - check model configuration!');
    return { provider: 'openai', modelId: 'gpt-4o' }; // Final fallback
}

/**
 * Generate component name from user input
 */
function generateComponentName(userInput: string): string {
  const name = userInput || 'Tool';
  
  // Handle specific case of "No description provided"
  if (name.toLowerCase().includes('no description provided') || name.toLowerCase().includes('nodescriptionprovided')) {
    return 'GeneratedTool';
  }
  
  // Clean the name: remove special chars, handle spaces properly
  const cleanedName = name
    .replace(/[^a-zA-Z0-9 ]/g, '') // Remove special characters
    .split(/\s+/) // Split on whitespace
    .filter(Boolean) // Remove empty strings
    .map((word, index) => {
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(''); // Join without spaces for camelCase
  
  // Handle empty/corrupted names
  if (!cleanedName || cleanedName.length === 0) {
    return 'GeneratedTool';
  }
  
  // Ensure name starts with a letter (not number)
  let finalName = cleanedName;
  if (/^[0-9]/.test(finalName)) {
    finalName = 'Tool' + finalName;
  }
  
  // Additional safety check - ensure it's a valid JavaScript identifier
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(finalName)) {
    logger.warn({ 
      originalUserInput: userInput,
      cleanedName,
      finalName,
      reason: 'Invalid JavaScript identifier, using fallback'
    }, '🔧 ComponentAssembler: Component name validation failed');
    return 'GeneratedTool';
  }
  
  return finalName;
}

/**
 * Extract imports from component code
 */
function extractImports(code: string): string[] {
  const importMatches = code.match(/import\s+.*?\s+from\s+['"][^'"]+['"]/g) || [];
  return importMatches.map(imp => imp.match(/from\s+['"]([^'"]+)['"]/)?.[1] || '').filter(Boolean);
}

/**
 * Extract React hooks from component code
 */
function extractHooks(code: string): string[] {
  const hookMatches = code.match(/use[A-Z][a-zA-Z]*\(/g) || [];
  return [...new Set(hookMatches.map(hook => hook.replace('(', '')))];
}

/**
 * Extract function definitions from component code
 */
function extractFunctions(code: string): string[] {
  const functionMatches = code.match(/(?:const|function)\s+([a-zA-Z][a-zA-Z0-9]*)\s*[=\(]/g) || [];
  return functionMatches.map(func => func.match(/(?:const|function)\s+([a-zA-Z][a-zA-Z0-9]*)/)?.[1] || '').filter(Boolean);
}

/**
 * Generate fallback component when AI parsing fails
 */
function generateFallbackComponent(tcc: ToolConstructionContext): AssembledComponent {
  const componentName = generateComponentName(tcc.userInput.description);
  const timestamp = new Date().toISOString();
  
  return {
    finalComponentCode: `'use client';

const ${componentName} = () => {
  return React.createElement('div', { 
    className: 'p-8 max-w-2xl mx-auto',
    'data-style-id': 'error-container'
  }, [
    React.createElement(Card, { 
      className: 'border-red-500 bg-red-50',
      'data-style-id': 'error-card',
      key: 'error-card'
    }, [
      React.createElement(CardHeader, { 
        className: 'bg-red-100 border-b border-red-200',
        'data-style-id': 'error-header',
        key: 'header'
      }, [
        React.createElement('div', { 
          className: 'flex items-center space-x-2',
          key: 'header-content'
        }, [
          React.createElement(AlertCircle, { 
            className: 'h-6 w-6 text-red-600',
            key: 'icon'
          }),
          React.createElement(CardTitle, { 
            className: 'text-red-800',
            key: 'title'
          }, '🚨 COMPONENT GENERATION FAILED')
        ])
      ]),
      React.createElement(CardContent, { 
        className: 'p-6 space-y-4',
        'data-style-id': 'error-content',
        key: 'content'
      }, [
        React.createElement('div', { 
          className: 'bg-red-100 border border-red-300 rounded-lg p-4',
          key: 'error-details'
        }, [
          React.createElement('h3', { 
            className: 'font-semibold text-red-800 mb-2',
            key: 'error-title'
          }, 'ERROR: AI Component Assembly Failed'),
          React.createElement('p', { 
            className: 'text-red-700 text-sm mb-2',
            key: 'error-description'
          }, 'The AI model failed to generate the component code. This is a fallback error component.'),
          React.createElement('p', { 
            className: 'text-red-600 text-xs',
            key: 'timestamp'
          }, 'Timestamp: ${timestamp}')
        ]),
        React.createElement('div', { 
          className: 'space-y-2',
          key: 'tool-info'
        }, [
          React.createElement('h4', { 
            className: 'font-medium text-red-800',
            key: 'tool-title'
          }, 'Requested Tool:'),
          React.createElement('p', { 
            className: 'text-sm text-red-700',
            key: 'tool-description'
          }, '${tcc.userInput.description}')
        ]),
        React.createElement('div', { 
          className: 'mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded',
          key: 'warning'
        }, [
          React.createElement('p', { 
            className: 'text-yellow-800 text-xs font-medium',
            key: 'warning-text'
          }, '⚠️ This is a system-generated fallback component indicating an error in the AI generation process.')
        ])
      ])
    ])
  ]);
};`,
    componentName: `${componentName}_ERROR_FALLBACK`,
    hooks: [],
    functions: [],
    estimatedLines: 45
  };
} 