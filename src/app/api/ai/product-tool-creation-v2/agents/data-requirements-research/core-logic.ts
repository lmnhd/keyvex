import { z } from 'zod';
import { DataRequirementsResearchOutputSchema, DataRequirementsResearchOutput } from './schema';
import { ToolConstructionContext, BrainstormData, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/tcc-unified';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';
import { executeResearchQueries, refineMockDataWithResearch } from './research-utils';
//import { executeResearchQueries, refineMockDataWithResearch } from './research-utils';

// 🎯 DATA REQUIREMENTS & RESEARCH AGENT
// This agent analyzes brainstorm data to identify external data needs,
// conducts research using web search, and generates mock data for tool creation



function createModelInstance(provider: string, modelId: string) {
  switch (provider) {
    case 'openai': return openai(modelId);
    case 'anthropic': return anthropic(modelId);
    default: return openai('gpt-4o');
  }
}

/**
 * Data Requirements & Research Agent
 * Analyzes brainstorm data, identifies external data needs, conducts research, and generates mock data
 */
export async function analyzeDataRequirementsAndResearch(request: {
  jobId: string;
  selectedModel?: string;
  tcc?: ToolConstructionContext;
  mockTcc?: ToolConstructionContext;
  userLocation?: {
    state?: string;
    country?: string;
    zipCode?: string;
  };
}): Promise<{
  success: boolean;
  dataRequirementsResearch?: DataRequirementsResearchOutput;
  error?: string;
  updatedTcc?: ToolConstructionContext;
}> {
  const { jobId, selectedModel, userLocation } = request;
  const tcc = request.mockTcc || request.tcc;

  try {
    logger.info({ jobId }, '🔍 DataRequirementsResearch: Starting analysis');

    if (!tcc) {
      throw new Error(`A valid TCC object was not provided for jobId: ${jobId}`);
    }

    if (!tcc.brainstormData) {
      throw new Error(`No brainstorm data found in TCC for jobId: ${jobId}`);
    }

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.initialization,
      'in_progress',
      'Analyzing data requirements from brainstorm...',
      tcc
    );

    // Generate first-pass analysis using AI
    const analysis = await generateDataRequirementsAnalysis(tcc.brainstormData, selectedModel, userLocation);

    // If external data is needed, perform Perplexity web research and refine mock data
    if (analysis.hasExternalDataNeeds && analysis.researchQueries.length > 0) {
      const searchResults = await executeResearchQueries(analysis.researchQueries);
      const refinement = await refineMockDataWithResearch(
        tcc.brainstormData,
        analysis,
        searchResults,
        selectedModel || 'gpt-4o'
      );
      analysis.mockData = refinement.mockData as Record<string, any>;
      analysis.userInstructions = refinement.userInstructions as { summary: string; dataNeeded: string[]; format: string; };
    }

    // Update TCC with research results - store in step results to preserve brainstormData validation
    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      brainstormData: tcc.brainstormData, // Keep original brainstorm data intact for validation
      steps: {
        ...tcc.steps,
        dataRequirementsResearch: {
          status: OrchestrationStatusEnum.enum.completed,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          result: analysis,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.initialization,
      'completed',
      `Data requirements analysis complete. Found ${analysis.researchQueries.length} research items and generated ${Object.keys(analysis.mockData).length} mock data categories.`,
      updatedTcc
    );

    logger.info({ jobId }, '🔍 DataRequirementsResearch: Completed successfully');
    return { success: true, dataRequirementsResearch: analysis, updatedTcc };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, '🔍 DataRequirementsResearch: Error');
    
    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.initialization,
      'failed',
      errorMessage,
      tcc
    );
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate comprehensive data requirements analysis using AI
 */
async function generateDataRequirementsAnalysis(brainstormData: BrainstormData, selectedModel?: string, userLocation?: any): Promise<DataRequirementsResearchOutput> {
  const modelId = selectedModel || 'gpt-4o';
  const provider = getModelProvider(modelId);
  const modelInstance = createModelInstance(provider, modelId);

  const systemPrompt = `You are a data requirements analyst and mock data generator. Analyze tool requirements to identify external data needs and generate realistic mock data.

ANALYSIS WORKFLOW:
1. Identify External Data Needs - Look for calculations requiring real-world data
2. Generate Research Queries - Create specific, actionable research queries  
3. Generate Mock Data - Create realistic data structures for testing
4. Create User Instructions - Provide clear guidance for data requirements

CRITICAL ANALYSIS POINTS:
- Tax rates, regulations (regulatory data)
- Market prices, costs (market_pricing data)  
- State/country specific info (geographic data)
- Industry standards, benchmarks (industry_standards data)
- Statistical averages, ranges (statistical data)

MOCK DATA GENERATION:
- Create 3-10 realistic data points per category
- Use proper data types and realistic ranges
- Include edge cases for testing
- Base data on tool's calculation needs
- Make data location-specific if needed

REQUIRED OUTPUT STRUCTURE - YOU MUST INCLUDE ALL FIELDS:
1. hasExternalDataNeeds: boolean (true if tool needs external data)
2. requiredDataTypes: array of string data type categories needed
3. researchQueries: array of objects, each with ALL these required fields:
   - query: string (the search query)
   - domain: string (domain category like "solar", "finance")
   - dataType: string (must be one of: "regulatory", "market_pricing", "geographic", "industry_standards", "tax_rates", "statistical", "other")
   - priority: string (must be one of: "high", "medium", "low")
   - locationDependent: boolean (whether results vary by location)
   - expectedDataStructure: string (expected structure description)
4. mockData: object with category keys and realistic data values
5. userInstructions: object with exactly these fields:
   - summary: string (summary of data requirements)
   - dataNeeded: array of strings (list of data user needs to provide)
   - format: string (expected format for user data)

CRITICAL: Every researchQueries object MUST have ALL 6 fields. Every userInstructions object MUST have exactly 3 fields with correct types.`;

  const locationContext = userLocation ? `
USER LOCATION CONTEXT:
- State: ${userLocation.state || 'Not specified'}
- Country: ${userLocation.country || 'Not specified'}
- Zip Code: ${userLocation.zipCode || 'Not specified'}` : '';

  const userPrompt = `Analyze this tool's data requirements and generate comprehensive mock data:

TOOL DETAILS:
- Core Concept: ${brainstormData.coreConcept || brainstormData.coreWConcept || 'Not specified'}
- Tool Type: ${brainstormData.promptOptions?.toolComplexity || 'Unknown'}
- Industry Focus: ${brainstormData.promptOptions?.industryFocus || 'General'}
${locationContext}

KEY CALCULATIONS NEEDING DATA:
${brainstormData.keyCalculations?.map(calc => `- ${calc.name}: ${calc.formula} (Variables: ${calc.variables?.join(', ') || 'none'})`).join('\n') || 'No calculations specified'}

DETAILED CALCULATION LOGIC:
${brainstormData.calculationLogic?.map(logic => `- ${logic.name}: ${logic.formula}`).join('\n') || 'No detailed logic specified'}

TOOL INPUTS:
${brainstormData.suggestedInputs?.map(input => `- ${input.label} (${input.type}): ${input.description}`).join('\n') || 'No inputs specified'}

EXAMPLES OF EXTERNAL DATA NEEDS:
- Solar tools: Tax incentives, utility rates, installation costs by state
- Financial tools: Interest rates, market benchmarks, tax rates
- Real estate tools: Property values, tax rates, market trends
- Business tools: Industry benchmarks, regulatory requirements
- Health tools: Medical costs, insurance rates, regional data

Perform comprehensive analysis and generate realistic mock data that will enable this tool to work properly during development and testing.`;

  try {
    const result = await generateObject({
      model: modelInstance,
      schema: DataRequirementsResearchOutputSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
      maxTokens: 16384
    });


    return result.object;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      errorType: error?.constructor?.name || 'Unknown'
    }, '🔍 Schema validation error details');
    throw error;
  }
}
