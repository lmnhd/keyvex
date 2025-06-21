/**
 * Function Planner Unified Module (Phase 1.2)
 * Pure logic for the unified agent system - NO core-logic dependencies
 */

import { z } from 'zod';
import { 
  AgentExecutionContext, 
  FunctionPlannerResult,
  AgentModule
} from '@/lib/types/tcc-unified';
import { 
  ToolConstructionContext, 
  DefinedFunctionSignature 
} from '@/lib/types/product-tool-creation-v2/tcc';
import logger from '@/lib/logger';

// Function planner output schema
const FunctionPlannerSchema = z.object({
  signatures: z.array(
    z.object({
      name: z.string().describe('The camelCase name of the function.'),
      description: z.string().describe('A brief explanation of what the function does.'),
    }),
  ),
});

export class FunctionPlannerModule implements AgentModule<any, FunctionPlannerResult> {
  
  async execute(
    context: AgentExecutionContext,
    input: { tcc: ToolConstructionContext; rawModelResult: any }
  ): Promise<FunctionPlannerResult> {
    const { tcc, rawModelResult } = input;
    
    logger.info({
      jobId: context.jobId,
      agentType: context.agentType,
      inputKeys: Object.keys(rawModelResult || {})
    }, '🔧 FunctionPlannerModule: Processing model result');

    // Extract signatures from model result
    const signatures = rawModelResult?.signatures || [];
    
    // Convert to DefinedFunctionSignature format
    const functionSignatures: DefinedFunctionSignature[] = signatures.map((sig: any) => ({
      name: sig.name,
      description: sig.description
    }));

    // Create metadata
    const metadata = {
      totalFunctions: functionSignatures.length,
      complexityLevel: this.determineFunctionComplexity(functionSignatures),
      estimatedImplementationTime: this.estimateImplementationTime(functionSignatures)
    };

    logger.info({
      jobId: context.jobId,
      functionCount: functionSignatures.length,
      complexity: metadata.complexityLevel,
      estimatedTime: metadata.estimatedImplementationTime
    }, '🔧 FunctionPlannerModule: Generated function signatures');

    return {
      functionSignatures,
      metadata
    };
  }

  validate(output: FunctionPlannerResult): any {
    // Basic validation - the ValidationManager handles comprehensive validation
    return {
      isValid: output.functionSignatures.length > 0,
      errors: output.functionSignatures.length === 0 ? [{ 
        type: 'logic' as const, 
        severity: 'error' as const, 
        message: 'No function signatures generated' 
      }] : [],
      warnings: [],
      suggestions: [],
      overallScore: output.functionSignatures.length > 0 ? 85 : 0,
      passesValidation: output.functionSignatures.length > 0
    };
  }

  getRequiredInputFields(): string[] {
    return ['tcc', 'rawModelResult'];
  }

  getOutputSchema(): z.ZodSchema<any> {
    return FunctionPlannerSchema;
  }

  private determineFunctionComplexity(signatures: DefinedFunctionSignature[]): 'simple' | 'moderate' | 'complex' {
    if (signatures.length <= 2) return 'simple';
    if (signatures.length <= 5) return 'moderate';
    return 'complex';
  }

  private estimateImplementationTime(signatures: DefinedFunctionSignature[]): string {
    const baseTime = signatures.length * 2; // 2 minutes per function
    return `${baseTime} minutes`;
  }
} 