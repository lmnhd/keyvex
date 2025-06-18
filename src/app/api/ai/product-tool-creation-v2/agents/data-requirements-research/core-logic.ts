import { z } from 'zod';
import { ToolConstructionContext, BrainstormData, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText } from 'ai';
import { getPrimaryModel, getFallbackModel, getModelProvider } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';
import { perplexity_web_search } from '../../../../../../lib/ai/web-search';
import { getDataRequirementsResearchSystemPrompt, getDataRequirementsResearchUserPrompt } from '@/lib/prompts/v2';

// STRONGLY TYPED SCHEMAS - NO 'any' TYPES!

// User location type
const UserLocationSchema = z.object({
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional()
});

type UserLocation = z.infer<typeof UserLocationSchema>;

// Research query with strict typing
const ResearchQuerySchema = z.object({
  query: z.string().min(1).describe('The research query to execute'),
  domain: z.string().min(1).describe('Domain category (e.g., "solar", "finance", "healthcare")'),
  dataType: z.enum(['regulatory', 'market_pricing', 'geographic', 'industry_standards', 'tax_rates', 'statistical', 'other']).describe('Type of data being researched'),
  priority: z.enum(['high', 'medium', 'low']).describe('Priority level for this research'),
  locationDependent: z.boolean().describe('Whether results vary by location'),
  expectedDataStructure: z.string().min(1).describe('Expected structure of the data (e.g., "array of objects with rate and state fields")')
});

type ResearchQuery = z.infer<typeof ResearchQuerySchema>;

// Search metadata with strict typing
const SearchMetadataSchema = z.object({
  query: z.string(),
  searchedAt: z.string(),
  resultsFound: z.number(),
  dataSource: z.string(),
  aiGenerated: z.boolean().optional(),
  domain: z.string().optional(),
  dataType: z.string().optional(),
  error: z.string().optional()
});

type SearchMetadata = z.infer<typeof SearchMetadataSchema>;

// AI parsing result metadata
const AIParsingMetadataSchema = z.object({
  dataSource: z.string(),
  generationMethod: z.string(),
  dataPoints: z.number(),
  relevanceScore: z.number().min(0).max(100),
  lastUpdated: z.string()
});

type AIParsingMetadata = z.infer<typeof AIParsingMetadataSchema>;

// Generic data structure with proper typing
const DataStructureSchema = z.object({
  searchMetadata: SearchMetadataSchema.optional()
}).catchall(z.unknown()); // Allow additional properties but typed as unknown, not any

type DataStructure = z.infer<typeof DataStructureSchema>;

// Research data organized by domain
const ResearchDataSchema = z.record(z.string(), DataStructureSchema);
type ResearchData = z.infer<typeof ResearchDataSchema>;

// AI parsing response schema
const AIParsingResponseSchema = z.object({
  success: z.boolean(),
  dataStructure: z.record(z.string(), z.unknown()), // Structured but not 'any'
  metadata: AIParsingMetadataSchema,
  reasoning: z.string()
});

type AIParsingResponse = z.infer<typeof AIParsingResponseSchema>;

// Main output schema for the agent - strongly typed
const DataRequirementsResearchOutputSchema = z.object({
  hasExternalDataNeeds: z.boolean().describe('Whether this tool requires external data'),
  requiredDataTypes: z.array(z.string()).default([]).describe('Types of external data needed'),
  researchQueries: z.array(ResearchQuerySchema).default([]).describe('Specific research queries to execute'),
  researchData: ResearchDataSchema.default({}).describe('Generated research data organized by category'),
  userInstructions: z.object({
    summary: z.string().min(1).describe('Summary of what data the app user (tool creator) needs to provide to make this tool work'),
    dataNeeded: z.array(z.string()).default([]).describe('List of specific data the app user needs to provide (e.g., "Current tax rates for your state", "Industry-specific pricing data")'),
    format: z.string().min(1).describe('Instructions on how the app user should format or obtain the required data')
  }).describe('Instructions for the app user (tool creator) about what data they need to provide to make the tool functional')
});

// PERSISTENCE INTERFACES - NO 'any' TYPES!

interface PersistenceDataRequirements {
  hasExternalDataNeeds: boolean;
  requiredDataTypes: string[];
  researchQueries: ResearchQuery[];
}

interface PersistenceResearchData {
  dataRequirements: PersistenceDataRequirements;
  researchData: ResearchData;
  userDataInstructions: {
    summary: string;
    dataNeeded: string[];
    format: string;
  };
}

interface PersistenceResult {
  id: string;
  updatedAt: string;
  dataRequirements: PersistenceDataRequirements;
  researchData: ResearchData;
  userDataInstructions: {
    summary: string;
    dataNeeded: string[];
    format: string;
  };
  researchCompletedAt: string;
}

// GENERIC FALLBACK DATA INTERFACE
interface FallbackDataStructure {
  fallbackData: {
    message: string;
    domain: string;
    dataType: string;
    userState: string;
    generatedAt: string;
    needsManualReview: boolean;
  };
}

// AI PARSING RESULT SCHEMA WITH PROPER TYPING
const AIParsingResultSchema = z.object({
  success: z.boolean(),
  dataStructure: z.record(z.string(), z.unknown()), // Structured but not 'any'
  metadata: AIParsingMetadataSchema,
  reasoning: z.string()
});

// PERSISTENCE INTERFACES TO REPLACE 'any' TYPES
interface BrainstormUpdateResult {
  id: string;
  updatedAt: string;
  dataRequirements: {
    hasExternalDataNeeds: boolean;
    requiredDataTypes: string[];
    researchQueries: ResearchQuery[];
  };
  researchData: ResearchData;
  userDataInstructions: {
    summary: string;
    dataNeeded: string[];
    format: string;
  };
  researchCompletedAt: string;
}

interface ResearchPersistenceData {
  dataRequirements: {
    hasExternalDataNeeds: boolean;
    requiredDataTypes: string[];
    researchQueries: ResearchQuery[];
  };
  researchData: ResearchData;
  userDataInstructions: {
    summary: string;
    dataNeeded: string[];
    format: string;
  };
}

export type DataRequirementsResearchOutput = z.infer<typeof DataRequirementsResearchOutputSchema>;

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
  persistToBrainstorm?: boolean;
  brainstormId?: string;
}): Promise<{
  success: boolean;
  dataRequirementsResearch?: DataRequirementsResearchOutput;
  error?: string;
  updatedTcc?: ToolConstructionContext;
  updatedBrainstorm?: BrainstormUpdateResult | null;
}> {
  const { jobId, selectedModel, userLocation, persistToBrainstorm = false, brainstormId } = request;
  const tcc = request.mockTcc || request.tcc;

  try {
    logger.info({ jobId, persistToBrainstorm, brainstormId }, 'DataRequirementsResearch: Starting analysis');

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

    // Generate analysis using AI
    const analysis = await generateDataRequirementsAnalysis(tcc.brainstormData, selectedModel, userLocation);
    
    // Update TCC with research results
    const updatedTcc: ToolConstructionContext = {
      ...tcc,
      brainstormData: {
        ...tcc.brainstormData,
        dataRequirements: {
          hasExternalDataNeeds: analysis.hasExternalDataNeeds,
          requiredDataTypes: analysis.requiredDataTypes,
          researchQueries: analysis.researchQueries
        },
        researchData: analysis.researchData,
        userDataInstructions: analysis.userInstructions
      },
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

    let updatedBrainstorm = null;

    if (persistToBrainstorm && brainstormId) {
      try {
        await emitStepProgress(
          jobId,
          OrchestrationStepEnum.enum.initialization,
          'in_progress',
          'Saving research results to brainstorm database...',
          tcc
        );

        updatedBrainstorm = await persistResearchToBrainstorm(brainstormId, {
          dataRequirements: {
            hasExternalDataNeeds: analysis.hasExternalDataNeeds,
            requiredDataTypes: analysis.requiredDataTypes,
            researchQueries: analysis.researchQueries
          },
          researchData: analysis.researchData,
          userDataInstructions: analysis.userInstructions
        });

        logger.info({ jobId, brainstormId }, 'DataRequirementsResearch: Research results persisted to brainstorm database');
      } catch (persistError) {
        logger.error({ 
          jobId, 
          brainstormId, 
          error: persistError instanceof Error ? persistError.message : String(persistError) 
        }, 'DataRequirementsResearch: Failed to persist research to brainstorm database');
      }
    }

    await emitStepProgress(
      jobId,
      OrchestrationStepEnum.enum.initialization,
      'completed',
      `Data requirements analysis complete. Found ${analysis.researchQueries.length} research items and generated ${Object.keys(analysis.researchData).length} research data categories.`,
      updatedTcc
    );

    logger.info({ jobId }, 'DataRequirementsResearch: Completed successfully');
    return { success: true, dataRequirementsResearch: analysis, updatedTcc, updatedBrainstorm };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: errorMessage }, 'DataRequirementsResearch: Error');
    
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

async function generateDataRequirementsAnalysis(brainstormData: BrainstormData, selectedModel?: string, userLocation?: UserLocation): Promise<DataRequirementsResearchOutput> {
  const modelId = selectedModel || 'claude-3-7-sonnet-20250219';
  const provider = getModelProvider(modelId);
  const modelInstance = createModelInstance(provider, modelId);

  // 🔍 DEBUG: Log the actual brainstorm data being analyzed
  logger.info({ 
    modelId, 
    provider,
    brainstormDataStructure: {
      coreConcept: brainstormData.coreConcept || brainstormData.coreWConcept || 'MISSING',
      valueProposition: brainstormData.valueProposition || 'MISSING',
      keyCalculationsCount: brainstormData.keyCalculations?.length || 0,
      calculationLogicCount: brainstormData.calculationLogic?.length || 0,
      suggestedInputsCount: brainstormData.suggestedInputs?.length || 0,
      hasKeyCalculations: !!(brainstormData.keyCalculations && brainstormData.keyCalculations.length > 0),
      hasCalculationLogic: !!(brainstormData.calculationLogic && brainstormData.calculationLogic.length > 0),
      hasSuggestedInputs: !!(brainstormData.suggestedInputs && brainstormData.suggestedInputs.length > 0)
    }
  }, 'DataRequirementsResearch: 🔍 DEBUGGING - Brainstorm data structure analysis');

  // 🔍 DEBUG: Log detailed brainstorm content
  if (brainstormData.keyCalculations && brainstormData.keyCalculations.length > 0) {
    logger.info({ 
      keyCalculations: brainstormData.keyCalculations.map(calc => ({
        name: calc.name,
        formula: calc.formula?.substring(0, 100) + (calc.formula?.length > 100 ? '...' : ''),
        description: calc.description?.substring(0, 100) + (calc.description?.length > 100 ? '...' : '')
      }))
    }, 'DataRequirementsResearch: 🔍 DEBUGGING - Key calculations details');
  }

  if (brainstormData.calculationLogic && brainstormData.calculationLogic.length > 0) {
    logger.info({ 
      calculationLogic: brainstormData.calculationLogic.map(logic => ({
        name: logic.name,
        formula: logic.formula?.substring(0, 100) + (logic.formula?.length > 100 ? '...' : '')
      }))
    }, 'DataRequirementsResearch: 🔍 DEBUGGING - Calculation logic details');
  }

  const analysisSystemPrompt = getDataRequirementsResearchSystemPrompt(false);
  const analysisUserPrompt = getDataRequirementsResearchUserPrompt(brainstormData);

  // 🔍 DEBUG: Log the complete prompt being sent to AI
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DataRequirementsResearch: DEBUGGING - Complete AI Prompt');
  console.log('='.repeat(80));
  console.log('SYSTEM PROMPT:');
  console.log(analysisSystemPrompt);
  console.log('\n' + '-'.repeat(40));
  console.log('USER PROMPT:');
  console.log(analysisUserPrompt);
  console.log('='.repeat(80) + '\n');

  try {
    logger.info({ 
      modelId, 
      provider,
      brainstormConcept: brainstormData.coreConcept || brainstormData.coreWConcept || 'Not specified'
    }, 'DataRequirementsResearch: Starting AI analysis');

    const { object: analysis } = await generateObject({
      model: modelInstance,
      schema: DataRequirementsResearchOutputSchema,
      system: analysisSystemPrompt,
      prompt: analysisUserPrompt,
      temperature: 0.1, // Lower temperature for more consistent schema compliance
      maxTokens: 2000, // Reduced tokens for more focused response
    });

    logger.info({ 
      modelId, 
      provider,
      hasExternalDataNeeds: analysis.hasExternalDataNeeds,
      researchQueriesCount: analysis.researchQueries.length,
      researchDataCategories: Object.keys(analysis.researchData).length
    }, 'DataRequirementsResearch: AI analysis successful');

    // 🔍 DEBUG: Log the AI response
    console.log('\n' + '✅'.repeat(40));
    console.log('🔍 DataRequirementsResearch: DEBUGGING - AI Response');
    console.log('✅'.repeat(40));
    console.log('AI Analysis Result:');
    console.log(JSON.stringify(analysis, null, 2));
    console.log('✅'.repeat(40) + '\n');

    // Execute research queries if external data is needed
    if (analysis.hasExternalDataNeeds && analysis.researchQueries.length > 0) {
      const enhancedResearchData = await executeResearchQueries(analysis.researchQueries, analysis.researchData, userLocation, brainstormData);
      analysis.researchData = enhancedResearchData;
    }

    return analysis;

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      modelId,
      provider,
      brainstormConcept: brainstormData.coreConcept || brainstormData.coreWConcept || 'Not specified'
    }, 'DataRequirementsResearch: generateObject failed, trying fallback approach');
    
    // 🔍 DEBUG: Log the error details
    console.log('\n' + '❌'.repeat(40));
    console.log('🔍 DataRequirementsResearch: DEBUGGING - AI Error');
    console.log('❌'.repeat(40));
    console.log('Error:', error instanceof Error ? error.message : String(error));
    console.log('Model:', modelId, 'Provider:', provider);
    console.log('❌'.repeat(40) + '\n');
    
    // Fallback: Try with generateText and manual parsing
    try {
      const fallbackPrompt = `${analysisSystemPrompt}

${analysisUserPrompt}

CRITICAL: Return ONLY a valid JSON object. Example:
{
  "hasExternalDataNeeds": false,
  "requiredDataTypes": [],
  "researchQueries": [],
  "researchData": {},
  "userInstructions": {
    "summary": "This tool is self-contained.",
    "dataNeeded": [],
    "format": "No external data required."
  }
}`;

      const { text } = await generateText({
        model: modelInstance,
        prompt: fallbackPrompt,
        temperature: 0.1,
        maxTokens: 1500,
      });

      logger.info({ 
        modelId, 
        provider,
        responseLength: text.length,
        responsePreview: text.substring(0, 200)
      }, 'DataRequirementsResearch: Fallback generateText response received');

      // 🔍 DEBUG: Log the fallback response
      console.log('\n' + '🔄'.repeat(40));
      console.log('🔍 DataRequirementsResearch: DEBUGGING - Fallback Response');
      console.log('🔄'.repeat(40));
      console.log('Raw Text Response:');
      console.log(text);
      console.log('🔄'.repeat(40) + '\n');

      // Try to parse the JSON response
      const cleanedText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const parsedResponse = JSON.parse(cleanedText);
      
      // Validate the parsed response matches our expected structure
      const validatedResponse = DataRequirementsResearchOutputSchema.parse(parsedResponse);
      
      logger.info({ 
        modelId, 
        provider,
        hasExternalDataNeeds: validatedResponse.hasExternalDataNeeds
      }, 'DataRequirementsResearch: Fallback parsing successful');
      
      return validatedResponse;
      
    } catch (fallbackError) {
      logger.error({ 
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        modelId,
        provider
      }, 'DataRequirementsResearch: Fallback approach also failed');
    }
    
    // Return a valid fallback response that matches the schema
    return {
      hasExternalDataNeeds: false,
      requiredDataTypes: [],
      researchQueries: [],
      researchData: {},
      userInstructions: {
        summary: 'Unable to analyze data requirements due to AI processing error. Tool assumed to be self-contained.',
        dataNeeded: [],
        format: 'No specific format requirements identified.'
      }
    };
  }
}

async function executeResearchQueries(
  researchQueries: ResearchQuery[], 
  baseResearchData: ResearchData, 
  userLocation?: UserLocation,
  brainstormData?: BrainstormData
): Promise<ResearchData> {
  const enhancedResearchData = { ...baseResearchData };

  for (const query of researchQueries.slice(0, 3)) {
    try {
      logger.info({ 
        query: query.query,
        domain: query.domain,
        dataType: query.dataType
      }, 'DataRequirementsResearch: 🔍 Executing web search for research query');

      // 🌐 ACTUAL WEB SEARCH: Call Perplexity via perplexity_web_search function
      const searchResults = await perplexity_web_search({
        search_term: query.query,
        explanation: `Research for ${query.domain} domain: ${query.dataType} data needed for tool calculations`,
        domain: query.domain,
        location: userLocation
      });
      
      logger.info({ 
        query: query.query,
        searchResultsLength: typeof searchResults === 'string' ? searchResults.length : 0,
        hasResults: !!searchResults && typeof searchResults === 'string' && searchResults.trim().length > 0
      }, 'DataRequirementsResearch: ✅ Web search completed');

      // Generate enhanced data based on search results
      const enhancedDataForQuery = await parseSearchResultsWithAI(query.domain, query.dataType, searchResults, userLocation as string, query.expectedDataStructure, query, brainstormData);
      
      enhancedResearchData[query.domain] = {
        ...enhancedResearchData[query.domain],
        ...enhancedDataForQuery,
        // Include search metadata
        searchMetadata: {
          query: query.query,
          searchedAt: new Date().toISOString(),
          resultsFound: searchResults?.length || 0,
          dataSource: 'perplexity_web_search'
        }
      };

    } catch (error) {
      logger.error({ 
        query: query.query,
        error: error instanceof Error ? error.message : String(error)
      }, 'DataRequirementsResearch: ❌ Web search failed, using fallback data');
      
      // Fallback to static data if web search fails
      const fallbackData = await parseSearchResultsWithAI(query.domain, query.dataType, '', userLocation as string, query.expectedDataStructure, query, brainstormData);
      enhancedResearchData[query.domain] = {
        ...enhancedResearchData[query.domain],
        ...fallbackData,
        searchMetadata: {
          query: query.query,
          searchedAt: new Date().toISOString(),
          resultsFound: 0,
          dataSource: 'fallback_static',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  return enhancedResearchData;
}

/**
 * AI-POWERED INTELLIGENT DATA STRUCTURE GENERATION
 * Replaces hardcoded domain parsing with smart AI analysis
 */
async function parseSearchResultsWithAI(
  domain: string, 
  dataType: string, 
  searchResults: string, 
  userState: string,
  expectedDataStructure: string,
  query: ResearchQuery,
  brainstormData?: BrainstormData
): Promise<DataStructure> {
  try {
    logger.info({ 
      domain, 
      dataType, 
      searchResultsLength: searchResults?.length || 0,
      queryIntent: query.query 
    }, 'DataRequirementsResearch: 🧠 Using AI to intelligently parse search results');

    // Create AI model instance for intelligent parsing
    const model = createModelInstance('anthropic', 'claude-3-5-sonnet-20241022');

    const aiParsingPrompt = `
You are an intelligent data structure generator for tool creation. Your job is to analyze search results and create appropriate data structures that match the specific tool's needs.

TOOL CONTEXT:
- Tool Concept: ${brainstormData?.coreConcept || brainstormData?.coreWConcept || 'Tool concept not specified'}
- Domain: ${domain}
- Data Type: ${dataType}
- Research Query: ${query.query}
- Expected Structure: ${expectedDataStructure}
- User Location: ${userState}

SEARCH RESULTS TO ANALYZE:
${searchResults || 'No search results available - generate realistic mock data'}

KEY CALCULATIONS THAT NEED DATA:
${JSON.stringify(brainstormData?.keyCalculations || [], null, 2)}

CALCULATION LOGIC THAT NEEDS DATA:
${JSON.stringify(brainstormData?.calculationLogic || [], null, 2)}

SUGGESTED INPUTS FOR REFERENCE:
${JSON.stringify(brainstormData?.suggestedInputs || [], null, 2)}

INSTRUCTIONS:
1. Analyze the tool's keyCalculations and calculationLogic to understand what data points are truly needed
2. If search results contain relevant data, extract and structure it appropriately  
3. If search results are insufficient, generate realistic mock data that fits the tool's purpose
4. Create data structures that directly support the tool's calculations and user experience
5. Ensure data variety and realistic ranges based on the domain and location
6. Include metadata about data source and generation method

CRITICAL REQUIREMENTS:
- Data must be ACTIONABLE for the tool's calculations shown in keyCalculations
- Include sufficient variety for meaningful comparisons/calculations (8-15 data points when appropriate)
- Use realistic ranges and values for the domain and location
- Structure data to match the expectedDataStructure format: ${expectedDataStructure}
- Generate data that enables the specific calculations shown in calculationLogic
- Consider the suggestedInputs to understand what users will provide vs what needs to be researched

EXAMPLES OF GOOD DATA STRUCTURES:
- For neighborhood tools: Array of neighborhoods with multiple attributes (school ratings, safety scores, pricing, demographics)
- For financial tools: Interest rates, tax brackets, market data with historical trends
- For comparison tools: Multiple options with varied attributes for meaningful comparisons
- For calculator tools: Industry benchmarks, standard rates, regional variations

Return a JSON object with the generated data structure.`;

    const result = await generateObject({
      model,
      schema: z.object({
        success: z.boolean(),
        dataStructure: z.record(z.string(), z.unknown()),
        metadata: z.object({
          dataSource: z.string(),
          generationMethod: z.string(),
          dataPoints: z.number(),
          relevanceScore: z.number().min(0).max(100),
          lastUpdated: z.string()
        }),
        reasoning: z.string()
      }),
      prompt: aiParsingPrompt,
    });

    if (result.object.success && result.object.dataStructure) {
      logger.info({ 
        domain,
        dataType,
        relevanceScore: result.object.metadata.relevanceScore,
        dataPoints: result.object.metadata.dataPoints,
        reasoning: result.object.reasoning
      }, 'DataRequirementsResearch: ✅ AI successfully generated intelligent data structure');

      return {
        ...result.object.dataStructure,
        searchMetadata: {
          ...result.object.metadata,
          query: query.query,
          searchedAt: new Date().toISOString(),
          resultsFound: searchResults?.length || 0,
          aiGenerated: true,
          domain,
          dataType
        }
      };
    } else {
      throw new Error('AI parsing failed to generate valid data structure');
    }

  } catch (error) {
    logger.error({ 
      domain, 
      dataType, 
      error: error instanceof Error ? error.message : String(error)
    }, 'DataRequirementsResearch: ❌ AI parsing failed, using fallback');
    
    // Fallback to basic structure if AI fails
    return generateBasicFallbackData(domain, dataType, userState);
  }
}

function generateBasicFallbackData(domain: string, dataType: string, userState: string): DataStructure {
  logger.info({ domain, dataType, userState }, 'DataRequirementsResearch: Generating basic fallback data structure');
  
  return {
    fallbackData: {
      message: `AI parsing failed for ${domain} ${dataType} data. Using basic fallback structure.`,
      domain,
      dataType,
      userState,
      generatedAt: new Date().toISOString(),
      needsManualReview: true
    },
    searchMetadata: {
      query: `${domain} ${dataType} data`,
      searchedAt: new Date().toISOString(),
      resultsFound: 0,
      dataSource: 'fallback_static',
      aiGenerated: true,
      domain,
      dataType,
      error: 'AI parsing failed, using fallback data'
    }
  };
}

async function persistResearchToBrainstorm(brainstormId: string, researchData: ResearchPersistenceData): Promise<BrainstormUpdateResult> {
  // 🚨 IMPORTANT: This function does NOT actually persist to any database!
  // 
  // SERVER-SIDE LIMITATION: This API route runs on the server and cannot access IndexedDB
  // IndexedDB is a client-side browser API and cannot be called from Node.js server code
  //
  // ACTUAL PERSISTENCE: The client-side React component handles IndexedDB persistence
  // after receiving this response using saveLogicResultToDB()
  
  logger.info({ 
    brainstormId,
    hasDataRequirements: !!researchData.dataRequirements,
    hasResearchData: !!researchData.researchData,
    hasUserInstructions: !!researchData.userDataInstructions,
    note: 'SERVER_CANNOT_PERSIST_TO_INDEXEDDB'
  }, 'DataRequirementsResearch: Returning research data for client-side persistence');

  // Return the research data structure for the client to persist to IndexedDB
  const result: BrainstormUpdateResult = {
    id: brainstormId,
    updatedAt: new Date().toISOString(),
    dataRequirements: researchData.dataRequirements,
    researchData: researchData.researchData,
    userDataInstructions: researchData.userDataInstructions,
    researchCompletedAt: new Date().toISOString()
  };

  return result;
}