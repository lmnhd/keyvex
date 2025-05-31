import OpenAI from 'openai';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { PromptManager } from './prompt-manager';

/**
 * AI Document Processing Lambda
 * 
 * This Lambda function processes both:
 * 1. LEASE documents - Analyzes lease agreements for tenant protection
 * 2. EVICTION_NOTICE documents - Processes eviction notices and generates response templates
 * 
 * Routes processing based on documentType in SQS message:
 * - 'EVICTION_NOTICE' → performEvictionAnalysisInternal()
 * - 'LEASE' or undefined → performAiLeaseAnalysisInternal() (backward compatibility)
 */

// --- TypeScript Interfaces for AI Schemas (copied from leaseAnalysisLogic.ts) ---
export interface Issue {
  description: string;
  severity: "High" | "Medium" | "Low";
  recommendation: string;
}

export interface Clause {
  title: string;
  text: string;
  issues: Issue[];
}

export interface InitialAnalysisResults {
  summary: string;
  overallSeverity: "High" | "Medium" | "Low";
  clauses: Clause[];
}

export interface NextStep {
  step: string;
  importance: "High" | "Medium" | "Consider";
  details?: string;
}

export interface ActionableInsightsData {
  actionableInsights: {
    overallRecommendation: string;
    nextSteps: NextStep[];
  };
}

// Combined structure for DynamoDB
export interface AIAnalysisResults extends InitialAnalysisResults, ActionableInsightsData {}

// TODO: Eviction Response - Add eviction-specific interfaces and schemas
// === EVICTION PROCESSING INTERFACES ===
export interface ExtractedEvictionDetails {
  landlordName?: string;
  tenantName?: string;
  noticeDate?: string; // YYYY-MM-DD
  deadlineDate?: string; // YYYY-MM-DD
  detectedState?: string;
  detectedCounty?: string;
  evictionReasonSummary?: string;
  specificClausesCited?: string[];
  rentAmountDue?: string;
  leaseEndDateMentioned?: string;
  fullExtractedText: string;
}

export interface PopulatedEvictionTemplates {
  populatedLetter: string;
  courtInstructions: string;
  legalAidContacts: Array<{
    name: string;
    phone?: string;
    url?: string;
    notes?: string;
  }>;
}

export interface EvictionLegalInsights {
  legalInsightsMarkdown: string;
  keyDeadlines: string[];
  potentialDefenses: string[];
  immediateActions: string[];
}

export interface EvictionAnalysisResults {
  extractedNoticeDetails: ExtractedEvictionDetails;
  populatedTemplates: PopulatedEvictionTemplates;
  legalInsights: EvictionLegalInsights;
  documentType: 'EVICTION_NOTICE';
}

// TODO: Eviction Response - Add lease context interfaces for enhanced analysis
// === LEASE CONTEXT INTEGRATION ===
export interface LeaseContextData {
  analysisId: string;
  userId: string;
  leaseAnalysisResults?: AIAnalysisResults;
  originalLeaseText?: string;
  uploadTimestamp: string;
  fileName?: string;
}

export interface EnhancedEvictionAnalysisResults extends EvictionAnalysisResults {
  leaseContext?: LeaseContextData;
  leaseBasedRecommendations?: string[];
}

// TODO: Eviction Response - Add batch processing interfaces
export interface BatchEvictionRequest {
  analysisId: string;
  extractedText: string;
  userSelectedState?: string;
  userFormData?: any;
  isImageUpload: boolean;
  userId?: string;
}

export interface BatchEvictionResults {
  successful: Array<{
    analysisId: string;
    results: EnhancedEvictionAnalysisResults;
  }>;
  failed: Array<{
    analysisId: string;
    error: string;
  }>;
  batchMetrics: {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    processingTimeMs: number;
    templateCacheHits: number;
    templateCacheMisses: number;
  };
}

// TODO: Data Collection - Add generalized data collection interfaces for batch processing
// === DATA COLLECTION BATCH PROCESSING ===

export interface DataCollectionRequest {
  requestId: string;
  dataSource: 'HUD' | 'COURT_RECORDS' | 'STATE_BAR' | 'LEGAL_AID' | 'CUSTOM';
  sourceUrl?: string;
  sourceMetadata?: Record<string, any>;
  collectionType: 'LEGAL_TEMPLATES' | 'CASE_DATA' | 'RESOURCE_DIRECTORY' | 'FORMS' | 'STATUTES';
  targetParameters?: {
    states?: string[];
    categories?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
    searchTerms?: string[];
  };
  processingInstructions?: {
    extractionMode: 'FULL_TEXT' | 'STRUCTURED_DATA' | 'METADATA_ONLY';
    outputFormat: 'JSON' | 'MARKDOWN' | 'RAW_TEXT';
    aiProcessing?: boolean;
    validationRules?: string[];
  };
}

export interface CollectedDataItem {
  itemId: string;
  sourceType: string;
  sourceUrl: string;
  title?: string;
  content: string;
  metadata: Record<string, any>;
  extractedAt: string;
  qualityScore?: number;
  validationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW';
}

export interface DataCollectionResults {
  successful: Array<{
    requestId: string;
    collectedItems: CollectedDataItem[];
    sourceMetrics: {
      totalFound: number;
      extracted: number;
      filtered: number;
      validationPassed: number;
    };
  }>;
  failed: Array<{
    requestId: string;
    error: string;
    sourceUrl?: string;
  }>;
  batchMetrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalItemsCollected: number;
    processingTimeMs: number;
    sourceTypes: Record<string, number>;
    averageQualityScore?: number;
  };
}

// --- Schema for the first AI call (Initial Analysis) ---
const initialAnalysisJsonSchema = {
  type: "object",
  properties: {
    summary: { 
      type: "string", 
      description: "A concise overall summary of the lease agreement, highlighting its main purpose and any immediate standout observations."
    },
    overallSeverity: {
      type: "string",
      description: "An overall risk assessment for the lease, categorized as 'High', 'Medium', or 'Low'. This should be based on the number and severity of identified issues.",
      enum: ["High", "Medium", "Low"]
    },
    clauses: {
      type: "array",
      description: "An array of important clauses extracted from the lease document.",
      items: {
        type: "object",
        properties: {
          title: { 
            type: "string", 
            description: "A clear, concise title for the clause (e.g., 'Rent Payment Terms', 'Subletting Restrictions', 'Maintenance Responsibilities')."
          },
          text: { 
            type: "string", 
            description: "The verbatim text of the clause as it appears in the lease document."
          },
          issues: {
            type: "array",
            description: "A list of potential issues, concerns, or points of attention identified within this specific clause.",
            items: {
              type: "object",
              properties: {
                description: { 
                  type: "string", 
                  description: "A clear description of the potential issue or concern."
                },
                severity: {
                  type: "string",
                  description: "The severity of this specific issue, categorized as 'High', 'Medium', or 'Low'.",
                  enum: ["High", "Medium", "Low"]
                },
                recommendation: {
                  type: "string",
                  description: "A practical recommendation or action the user might consider regarding this issue (e.g., 'Seek clarification from landlord', 'Consult a legal professional', 'Be aware of this implication')."
                }
              },
              required: ["description", "severity", "recommendation"]
            }
          }
        },
        required: ["title", "text", "issues"]
      }
    }
  },
  required: ["summary", "overallSeverity", "clauses"]
};

// --- Schema for the second AI call (Actionable Insights) ---
const actionableInsightsJsonSchema = {
  type: "object",
  properties: {
    actionableInsights: {
      type: "object",
      description: "Provides smart advice and actionable next steps for the user based on the overall analysis.",
      properties: {
        overallRecommendation: {
          type: "string",
          description: "A brief overall recommendation or takeaway message for the user based on the lease analysis."
        },
        nextSteps: {
          type: "array",
          description: "A list of 2-4 concrete, actionable next steps the user should consider.",
          items: {
            type: "object",
            properties: {
              step: { type: "string", description: "A single actionable step." },
              importance: { 
                type: "string", 
                description: "Indicates the importance or urgency (e.g., 'High', 'Medium', 'Consider').",
                enum: ["High", "Medium", "Consider"]
              },
              details: { type: "string", description: "(Optional) Further details or rationale for this step, if necessary." }
            },
            required: ["step", "importance"]
          }
        }
      },
      required: ["overallRecommendation", "nextSteps"]
    }
  },
  required: ["actionableInsights"]
};

// TODO: Eviction Response - Add eviction-specific JSON schemas for structured AI output
// === EVICTION PROCESSING SCHEMAS ===

// Schema for Vision/PDF text extraction of eviction notice details
const evictionExtractionSchema = {
  type: "object",
  properties: {
    landlordName: { type: "string", description: "Name of the landlord or property management company" },
    tenantName: { type: "string", description: "Name of the tenant(s) if visible on the notice" },
    noticeDate: { 
      type: "string", 
      description: "Date the notice was issued (YYYY-MM-DD format)",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$"
    },
    deadlineDate: { 
      type: "string", 
      description: "Deadline date for tenant response or action (YYYY-MM-DD format)",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$"
    },
    detectedState: { type: "string", description: "State detected from the notice (e.g., 'CA', 'California')" },
    detectedCounty: { type: "string", description: "County detected from the notice if visible" },
    evictionReasonSummary: { 
      type: "string", 
      description: "Brief summary of the stated reason for eviction (e.g., 'non-payment of rent', 'lease violation')" 
    },
    specificClausesCited: {
      type: "array",
      items: { type: "string" },
      description: "Any specific lease clauses or legal codes mentioned in the notice"
    },
    rentAmountDue: { type: "string", description: "Amount of rent due if this is a non-payment notice" },
    leaseEndDateMentioned: { type: "string", description: "Lease end date if mentioned in the notice" },
    fullExtractedText: { 
      type: "string", 
      description: "Complete text extracted from the eviction notice" 
    }
  },
  required: ["fullExtractedText"]
};

// Schema for legal insights generation
const evictionLegalInsightsSchema = {
  type: "object",
  properties: {
    legalInsightsMarkdown: {
      type: "string",
      description: "Comprehensive legal insights in Markdown format covering tenant rights, deadlines, and defense strategies"
    },
    keyDeadlines: {
      type: "array",
      items: { type: "string" },
      description: "List of critical deadlines the tenant must be aware of"
    },
    potentialDefenses: {
      type: "array", 
      items: { type: "string" },
      description: "Potential legal defenses or challenges the tenant might raise"
    },
    immediateActions: {
      type: "array",
      items: { type: "string" },
      description: "Immediate actions the tenant should take (2-4 items)"
    }
  },
  required: ["legalInsightsMarkdown", "keyDeadlines", "immediateActions"]
};

// --- Core AI Processing Function (copied and adapted from leaseAnalysisLogic.ts) ---
async function performAiLeaseAnalysisInternal(
  extractedText: string,
  userSelectedState: string | undefined, // Can be undefined if not present
  openaiClient: OpenAI
): Promise<{ initialAnalysisResults: InitialAnalysisResults; actionableInsightsData: ActionableInsightsData }> {
  let initialAnalysisResults: InitialAnalysisResults;
  let actionableInsightsData: ActionableInsightsData;
  const stateForPrompt = userSelectedState || 'general'; // Fallback if state is not provided

  // Initialize PromptManager to load dynamic prompts
  const promptManager = new PromptManager();
  let promptConfig;
  
  try {
    promptConfig = await promptManager.getLeaseAnalysisConfig();
    console.log('(AI Lambda) Successfully loaded dynamic prompts from external sources.');
  } catch (promptError) {
    console.warn('(AI Lambda) Failed to load dynamic prompts, using defaults:', promptError);
    // Fallback to hardcoded prompts if external sources fail
    promptConfig = {
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.2,
      maxTokens: 4000,
      systemPrompt: `You are a legal assistant specializing in ${stateForPrompt} lease agreements. Analyze the lease text.`,
      userPromptTemplate: `Lease text: {leaseText}`
    };
  }

  // === PHASE 1: Initial Lease Analysis ===
  try {
    // Format the system prompt to include schema and state-specific context
    const systemMessageInitial = `${promptConfig.systemPrompt} 
    
Respond ONLY with a valid JSON object adhering to this schema: ${JSON.stringify(initialAnalysisJsonSchema, null, 2)}`;

    // Format the user prompt with variables
    const userMessageInitial = promptManager.formatUserPrompt(promptConfig.userPromptTemplate, {
      leaseText: extractedText,
      userSelectedState: stateForPrompt
    });
    
    console.log('(AI Lambda) Calling OpenAI for initial analysis...');
    const responseInitial = await openaiClient.chat.completions.create({
      model: promptConfig.model,
      messages: [{ role: "system", content: systemMessageInitial }, { role: "user", content: userMessageInitial }],
      response_format: { type: "json_object" },
      temperature: promptConfig.temperature,
      max_tokens: promptConfig.maxTokens,
    });

    const rawContentInitial = responseInitial.choices[0]?.message?.content;
    if (!rawContentInitial) throw new Error('Initial analysis: No content from AI.');
    initialAnalysisResults = JSON.parse(rawContentInitial) as InitialAnalysisResults;
    console.log('(AI Lambda) Initial analysis successful.');

  } catch (aiError) {
    console.error('(AI Lambda) Error during initial AI analysis:', aiError);
    throw new Error(`Initial AI Analysis Failed: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
  }

  // === PHASE 2: Generate Actionable Insights ===
  try {
    let contextForInsights = `Summary: ${initialAnalysisResults.summary}. Overall Severity: ${initialAnalysisResults.overallSeverity}.`;
    const highSeverityIssues = initialAnalysisResults.clauses
      .flatMap((c: Clause) => c.issues)
      .filter((i: Issue) => i.severity === 'High')
      .map((i: Issue) => i.description);
    if (highSeverityIssues.length > 0) {
      contextForInsights += ` Key high-severity issues include: ${highSeverityIssues.join('; ')}`;
    }

    const systemMessageInsights = `Based on the following lease analysis context for a ${stateForPrompt} lease, provide actionable next steps for the user. Respond ONLY with a valid JSON object adhering to this schema: ${JSON.stringify(actionableInsightsJsonSchema, null, 2)}`;
    const userMessageInsights = `Context: ${contextForInsights.substring(0, 3500)} Please provide actionable insights.`;

    console.log('(AI Lambda) Calling OpenAI for actionable insights...');
    const responseInsights = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o", // Use environment variable for model
      messages: [{ role: "system", content: systemMessageInsights }, { role: "user", content: userMessageInsights }],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const rawContentInsights = responseInsights.choices[0]?.message?.content;
    if (!rawContentInsights) throw new Error('Actionable insights: No content from AI.');
    actionableInsightsData = JSON.parse(rawContentInsights) as ActionableInsightsData;
    console.log('(AI Lambda) Actionable insights generation successful.');

  } catch (aiError) {
    console.error('(AI Lambda) Error during actionable insights generation:', aiError);
    const error = new Error(`Actionable Insights Generation Failed: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
    (error as any).partialResults = initialAnalysisResults; // Attach partial results
    throw error;
  }

  return { initialAnalysisResults, actionableInsightsData };
}

// TODO: Eviction Response - Add core eviction processing function
// === EVICTION PROCESSING FUNCTION ===
async function performEvictionAnalysisInternal(
  extractedText: string,
  userSelectedState: string | undefined,
  userFormData: any, // Optional user-provided metadata
  isImageUpload: boolean, // true for images, false for PDFs
  openaiClient: OpenAI,
  leaseContext?: LeaseContextData // TODO: Lease context for enhanced analysis
): Promise<EnhancedEvictionAnalysisResults> {
  
  const promptManager = new PromptManager();
  const stateForPrompt = userSelectedState || userFormData?.state || 'general';
  
  // Initialize variables for final results
  let leaseBasedRecommendations: string[] = [];
  
  // === PHASE 1: Extract Structured Data from Notice ===
  let extractedDetails: ExtractedEvictionDetails;
  
  try {
    console.log(`(AI Lambda) Extracting eviction notice details for ${isImageUpload ? 'image' : 'PDF text'}...`);
    
    const extractionPrompt = await promptManager.getEvictionExtractionPrompt(isImageUpload);
    const systemMessage = `${extractionPrompt.systemPrompt}
    
Respond ONLY with a valid JSON object adhering to this schema: ${JSON.stringify(evictionExtractionSchema, null, 2)}`;

    let messages: any[];
    
    if (isImageUpload) {
      // For Vision API (images)
      messages = [
        { role: "system", content: systemMessage },
        { 
          role: "user", 
          content: [
            { type: "text", text: "Extract eviction notice details from this image:" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${extractedText}` } }
          ]
        }
      ];
    } else {
      // For PDF text processing
      const userMessage = promptManager.formatUserPrompt(extractionPrompt.userPromptTemplate, {
        noticeText: extractedText,
        userSelectedState: stateForPrompt
      });
      
      messages = [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ];
    }

    const extractionResponse = await openaiClient.chat.completions.create({
      model: isImageUpload ? 'gpt-4o' : 'gpt-4o', // Use Vision model for images
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    });

    const rawExtraction = extractionResponse.choices[0]?.message?.content;
    if (!rawExtraction) throw new Error('No extraction content from AI.');
    
    extractedDetails = JSON.parse(rawExtraction) as ExtractedEvictionDetails;
    
    // Merge with user-provided form data (user data takes precedence)
    if (userFormData) {
      extractedDetails = {
        ...extractedDetails,
        ...Object.fromEntries(
          Object.entries(userFormData).filter(([_, value]) => value !== undefined && value !== '')
        )
      };
    }
    
    console.log('(AI Lambda) Eviction details extraction successful.');

  } catch (error) {
    console.error('(AI Lambda) Error during eviction details extraction:', error);
    throw new Error(`Eviction Details Extraction Failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // === PHASE 2: Generate Legal Insights with RAG ===
  let legalInsights: EvictionLegalInsights;
  
  try {
    console.log('(AI Lambda) Generating legal insights with RAG...');
    
    const analysisPrompt = await promptManager.getEvictionAnalysisPrompt();
    
    // TODO: Add RAG retrieval here - query vector database based on:
    // - extractedDetails.detectedState || stateForPrompt
    // - extractedDetails.evictionReasonSummary
    // - extractedDetails.fullExtractedText (for semantic similarity)
    const ragContext = ""; // Placeholder for RAG retrieved context
    
    // TODO: Lease Context Integration - Enhance analysis with lease data
    let leaseContextPrompt = '';
    
    if (leaseContext?.leaseAnalysisResults) {
      console.log('(AI Lambda) Incorporating lease context into eviction analysis...');
      
      // Extract key lease information for context
      const leaseInfo = leaseContext.leaseAnalysisResults;
      const highRiskClauses = leaseInfo.clauses
        ?.filter(clause => clause.issues.some(issue => issue.severity === 'High'))
        .map(clause => `${clause.title}: ${clause.issues.map(i => i.description).join('; ')}`)
        .join('\n') || '';
      
      leaseContextPrompt = `
      
IMPORTANT LEASE CONTEXT:
- Lease Analysis Summary: ${leaseInfo.summary || 'N/A'}
- Overall Lease Risk Level: ${leaseInfo.overallSeverity || 'N/A'}
- High-Risk Lease Clauses: ${highRiskClauses || 'None identified'}
- Previous Lease Recommendations: ${leaseInfo.actionableInsights?.overallRecommendation || 'N/A'}

Use this lease context to identify if the eviction notice relates to any of these previously identified lease issues.`;
    } else {
      console.log('(AI Lambda) No lease context available - proceeding with notice-only analysis...');
      leaseContextPrompt = '\n\nNOTE: No lease agreement context available. Analysis based solely on eviction notice.';
    }
    
    const systemMessage = `${analysisPrompt.systemPrompt}
    
Legal Context: ${ragContext}${leaseContextPrompt}

Respond ONLY with a valid JSON object adhering to this schema: ${JSON.stringify(evictionLegalInsightsSchema, null, 2)}`;

    const userMessage = promptManager.formatUserPrompt(analysisPrompt.userPromptTemplate, {
      noticeText: extractedDetails.fullExtractedText,
      userSelectedState: stateForPrompt,
      evictionReason: extractedDetails.evictionReasonSummary || 'unknown',
      extractedDetails: JSON.stringify(extractedDetails, null, 2)
    });

    const insightsResponse = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 3000,
    });

    const rawInsights = insightsResponse.choices[0]?.message?.content;
    if (!rawInsights) throw new Error('No insights content from AI.');
    
    legalInsights = JSON.parse(rawInsights) as EvictionLegalInsights;
    
    // TODO: Generate lease-specific recommendations if context is available
    if (leaseContext?.leaseAnalysisResults) {
      leaseBasedRecommendations = await generateLeaseBasedRecommendations(
        extractedDetails, 
        leaseContext.leaseAnalysisResults, 
        openaiClient, 
        promptManager
      );
    }
    
    console.log('(AI Lambda) Legal insights generation successful.');

  } catch (error) {
    console.error('(AI Lambda) Error during legal insights generation:', error);
    throw new Error(`Legal Insights Generation Failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // === PHASE 3: Populate Templates ===
  let populatedTemplates: PopulatedEvictionTemplates;
  
  try {
    console.log('(AI Lambda) Populating eviction response templates...');
    
    populatedTemplates = await populateEvictionTemplates(extractedDetails, stateForPrompt, promptManager, isImageUpload);
    console.log('(AI Lambda) Template population successful.');

  } catch (error) {
    console.error('(AI Lambda) Error during template population:', error);
    throw new Error(`Template Population Failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    extractedNoticeDetails: extractedDetails,
    populatedTemplates,
    legalInsights,
    documentType: 'EVICTION_NOTICE',
    leaseContext: leaseContext,
    leaseBasedRecommendations: leaseBasedRecommendations
  };
}

// TODO: Eviction Response - Add template population helper function
async function populateEvictionTemplates(
  extractedDetails: ExtractedEvictionDetails, 
  state: string,
  promptManager: PromptManager,
  isBatchProcessing: boolean = false
): Promise<PopulatedEvictionTemplates> {
  
  try {
    console.log(`(AI Lambda) Populating templates for state: ${state}, batch: ${isBatchProcessing}`);
    
    const reason = determineEvictionReason(extractedDetails.evictionReasonSummary);
    console.log(`(AI Lambda) Determined eviction reason: ${reason} for state: ${state}`);
    
    // Get both response letter and metadata templates
    const responseTemplate = await promptManager.getEvictionTemplate(state, reason, 'response');
    const metaTemplate = await promptManager.getEvictionTemplate(state, reason, 'meta');
    
    // Prepare template substitution variables
    const templateVars = {
      tenantName: extractedDetails.tenantName || '[Tenant Name]',
      landlordName: extractedDetails.landlordName || '[Landlord Name]',
      noticeDate: extractedDetails.noticeDate || '[Notice Date]',
      deadlineDate: extractedDetails.deadlineDate || '[Deadline Date]',
      county: extractedDetails.detectedCounty || '[County]',
      state: state.toUpperCase(),
      propertyAddress: '[Property Address]', // TODO: Extract from notice or user form
      tenantAddress: '[Tenant Address]', // TODO: Extract from user form
      landlordAddress: '[Landlord Address]', // TODO: Extract from notice
      rentAmount: extractedDetails.rentAmountDue || '[Rent Amount]',
      currentDate: new Date().toLocaleDateString()
    };

    // Populate the response letter template
    let populatedLetter = responseTemplate.content;
    for (const [key, value] of Object.entries(templateVars)) {
      const placeholder = `[${key}]`;
      populatedLetter = populatedLetter.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    // Extract court instructions and legal aid contacts from metadata template
    const courtInstructions = metaTemplate.metadata?.courtInstructions || 
      `File your response at the appropriate court in ${templateVars.county} County, ${state}. Consult local court rules for specific procedures and deadlines.`;
    
    const legalAidContacts = metaTemplate.metadata?.legalAidContacts || [
      {
        name: `${state} Legal Aid`,
        phone: 'Contact local legal aid for assistance',
        notes: 'Please find local legal aid resources for specific guidance.'
      }
    ];

    // Enhance court instructions with specific variables
    let enhancedCourtInstructions = courtInstructions;
    for (const [key, value] of Object.entries(templateVars)) {
      const placeholder = `[${key}]`;
      enhancedCourtInstructions = enhancedCourtInstructions.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    console.log(`(AI Lambda) Template population completed for ${state}/${reason}`);
    
    return {
      populatedLetter,
      courtInstructions: enhancedCourtInstructions,
      legalAidContacts
    };
    
  } catch (error) {
    console.error('(AI Lambda) Error populating templates:', error);
    
    // Fallback to basic template on error
    const templateData = {
      tenantName: extractedDetails.tenantName || '[Tenant Name]',
      landlordName: extractedDetails.landlordName || '[Landlord Name]',
      noticeDate: extractedDetails.noticeDate || '[Notice Date]',
      deadlineDate: extractedDetails.deadlineDate || '[Deadline Date]',
      county: extractedDetails.detectedCounty || '[County]',
      state: state.toUpperCase(),
      rentAmount: extractedDetails.rentAmountDue || '[Rent Amount]'
    };

    const fallbackLetter = `${templateData.tenantName}
[Your Address]

${new Date().toLocaleDateString()}

${templateData.landlordName}
[Landlord Address]

RE: Response to Eviction Notice Dated ${templateData.noticeDate}

Dear ${templateData.landlordName},

I am writing in response to the eviction notice dated ${templateData.noticeDate} regarding the property at [Property Address].

I dispute this eviction notice and intend to defend my rights in court. I request additional time to prepare my response and gather necessary documentation.

Please direct all further communications regarding this matter to me in writing.

Sincerely,
${templateData.tenantName}

IMPORTANT: This is a basic template. Please consult with a tenant rights attorney for specific legal advice.`;

    return {
      populatedLetter: fallbackLetter,
      courtInstructions: `File your response at the ${templateData.county} County Superior Court within the deadline specified in your notice. Consult local court rules for specific procedures.`,
      legalAidContacts: [
        {
          name: `${state} Legal Aid Society`,
          phone: "Contact local legal aid for assistance",
          notes: "This is a fallback contact. Please find local legal aid resources."
        }
      ]
    };
  }
}

// TODO: Eviction Response - Helper function to determine eviction reason from summary
function determineEvictionReason(reasonSummary?: string): string {
  if (!reasonSummary) return 'unknown';
  
  const summary = reasonSummary.toLowerCase();
  
  if (summary.includes('rent') || summary.includes('payment')) {
    return 'non-payment';
  } else if (summary.includes('violation') || summary.includes('breach')) {
    return 'lease-violation';
  } else if (summary.includes('end') || summary.includes('expir') || summary.includes('term')) {
    return 'no-cause';
  }
  
  return 'other';
}

// TODO: Eviction Response - Add lease-based recommendations helper function
async function generateLeaseBasedRecommendations(
  extractedDetails: ExtractedEvictionDetails,
  leaseAnalysisResults: AIAnalysisResults,
  openaiClient: OpenAI,
  promptManager: PromptManager
): Promise<string[]> {
  
  try {
    console.log('(AI Lambda) Generating lease-specific recommendations...');
    
    // Create a focused prompt to generate lease-specific recommendations
    const systemPrompt = `You are a tenant rights expert. Based on the eviction notice details and the previously analyzed lease agreement, provide specific recommendations that leverage knowledge of the lease terms.
    
    Focus on:
    1. How the eviction notice relates to specific lease clauses
    2. Whether the landlord is following lease terms correctly
    3. Any lease-based defenses the tenant might have
    4. Inconsistencies between the lease and the eviction notice
    
    Respond with a JSON array of recommendation strings. Maximum 5 recommendations.`;
    
    const userPrompt = `
    EVICTION NOTICE DETAILS:
    - Reason: ${extractedDetails.evictionReasonSummary || 'Unknown'}
    - Notice Date: ${extractedDetails.noticeDate || 'Unknown'}
    - Deadline: ${extractedDetails.deadlineDate || 'Unknown'}
    - Amount Due: ${extractedDetails.rentAmountDue || 'N/A'}
    
    LEASE ANALYSIS CONTEXT:
    - Summary: ${leaseAnalysisResults.summary}
    - High-Risk Clauses: ${leaseAnalysisResults.clauses
      ?.filter(c => c.issues.some(i => i.severity === 'High'))
      .map(c => c.title)
      .join(', ') || 'None'}
    
    Generate lease-specific recommendations for responding to this eviction notice.`;

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1000,
    });

    const rawResponse = response.choices[0]?.message?.content;
    if (!rawResponse) throw new Error('No response from AI for lease recommendations.');
    
    const parsed = JSON.parse(rawResponse);
    return Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    
  } catch (error) {
    console.error('(AI Lambda) Error generating lease-based recommendations:', error);
    return []; // Return empty array on error, don't fail the entire process
  }
}

// TODO: Eviction Response - Add function to retrieve user's lease context
async function getUserLeaseContext(userId: string): Promise<LeaseContextData | null> {
  
  try {
    console.log(`(AI Lambda) Retrieving lease context for user: ${userId}`);
    
    // TODO: Query DynamoDB for user's most recent lease analysis
    // For now, return null - this will be implemented when we have user context
    console.log('(AI Lambda) Lease context retrieval - TODO: Implement DynamoDB query for user lease history');
    
    return null;
    
  } catch (error) {
    console.error('(AI Lambda) Error retrieving lease context:', error);
    return null; // Don't fail eviction processing if lease context retrieval fails
  }
}

// TODO: Eviction Response - Add batch processing handler
export async function processBatchEvictionAnalysis(
  requests: BatchEvictionRequest[],
  openaiClient: OpenAI,
  promptManager: PromptManager
): Promise<BatchEvictionResults> {
  
  const startTime = Date.now();
  console.log(`(AI Lambda) Starting batch eviction analysis for ${requests.length} requests`);
  
  const successful: Array<{ analysisId: string; results: EnhancedEvictionAnalysisResults }> = [];
  const failed: Array<{ analysisId: string; error: string }> = [];
  
  try {
    // Pre-warm template cache with states/reasons from the batch
    const uniqueStates = [...new Set(requests.map(r => r.userSelectedState).filter((state): state is string => state !== undefined))];
    if (uniqueStates.length > 0) {
      console.log(`(AI Lambda) Pre-warming template cache for states: ${uniqueStates.join(', ')}`);
      await promptManager.preWarmTemplateCache(uniqueStates, ['non-payment', 'lease-violation', 'no-cause']);
    }
    
    // Process requests in parallel with concurrency limit
    const concurrencyLimit = 5; // Adjust based on Lambda memory and OpenAI rate limits
    const chunks = chunkArray(requests, concurrencyLimit);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (request) => {
        try {
          console.log(`(AI Lambda) Processing eviction analysis: ${request.analysisId}`);
          
          // Retrieve lease context if userId provided
          let leaseContext: LeaseContextData | undefined;
          if (request.userId) {
            leaseContext = await getUserLeaseContext(request.userId) || undefined;
          }
          
          const results = await performEvictionAnalysisInternal(
            request.extractedText,
            request.userSelectedState,
            request.userFormData,
            request.isImageUpload,
            openaiClient,
            leaseContext
          );
          
          successful.push({
            analysisId: request.analysisId,
            results
          });
          
          console.log(`(AI Lambda) Batch item completed: ${request.analysisId}`);
          
        } catch (error) {
          console.error(`(AI Lambda) Batch item failed: ${request.analysisId}`, error);
          failed.push({
            analysisId: request.analysisId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });
      
      await Promise.all(chunkPromises);
    }
    
  } catch (error) {
    console.error('(AI Lambda) Critical error in batch processing:', error);
    // Mark remaining unprocessed requests as failed
    for (const request of requests) {
      if (!successful.find(s => s.analysisId === request.analysisId) && 
          !failed.find(f => f.analysisId === request.analysisId)) {
        failed.push({
          analysisId: request.analysisId,
          error: 'Batch processing interrupted'
        });
      }
    }
  }
  
  const endTime = Date.now();
  const cacheStats = promptManager.getCacheStats();
  
  const batchMetrics = {
    totalProcessed: requests.length,
    successCount: successful.length,
    failureCount: failed.length,
    processingTimeMs: endTime - startTime,
    templateCacheHits: Math.max(0, cacheStats.templateCacheSize - requests.length), // Approximation
    templateCacheMisses: Math.min(requests.length, cacheStats.templateCacheSize)
  };
  
  console.log(`(AI Lambda) Batch processing completed:`, batchMetrics);
  
  return {
    successful,
    failed,
    batchMetrics
  };
}

// TODO: Eviction Response - Utility function for chunking arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

const DYNAMODB_TABLE = process.env.DYNAMODB_LEASE_ANALYSES_TABLE;
const OPENAI_API_KEY_SECRET_NAME = process.env.OPENAI_API_KEY_SECRET_NAME;
const AWS_REGION = process.env.AWS_REGION;

if (!DYNAMODB_TABLE) {
  throw new Error("DYNAMODB_LEASE_ANALYSES_TABLE environment variable is not set.");
}
if (!OPENAI_API_KEY_SECRET_NAME) {
  throw new Error("OPENAI_API_KEY_SECRET_NAME environment variable is not set.");
}
if (!AWS_REGION) {
  throw new Error("AWS_REGION environment variable is not set.");
}

const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
let openaiClient: OpenAI;

async function initializeOpenAIClient(): Promise<OpenAI> {
  if (openaiClient) {
    return openaiClient;
  }
  console.log(`Fetching OpenAI API key from Secrets Manager: ${OPENAI_API_KEY_SECRET_NAME}`);
  const secretsClient = new SecretsManagerClient({ region: AWS_REGION });
  try {
    const command = new GetSecretValueCommand({ SecretId: OPENAI_API_KEY_SECRET_NAME });
    const data = await secretsClient.send(command);
    let secretValue: string | undefined;
    if (data.SecretString) {
      secretValue = data.SecretString;
    } else if (data.SecretBinary) {
      // If SecretBinary is used, you need to decode it (e.g., base64)
      // For this example, assuming SecretString
      console.warn("OpenAI API Key secret is binary, expected string.");
      throw new Error("OpenAI API Key secret is binary, expected string.");
    }

    if (!secretValue) {
        console.error("OpenAI API Key secret string is empty.");
        throw new Error("Retrieved OpenAI API Key secret is empty.");
    }

    // Try to parse as JSON, if it fails, assume it's a plain string key
    let apiKey;
    try {
        const secretJson = JSON.parse(secretValue);
        // Adjust this if your secret is stored with a different key within the JSON
        apiKey = secretJson.OPENAI_API_KEY || secretJson.apiKey || secretJson.key;
        if (!apiKey && typeof secretJson === 'string') apiKey = secretJson; // if JSON is just the key string itself
        else if (!apiKey) apiKey = secretValue; // Fallback if key not found in JSON structure

    } catch (e) {
        // Not a JSON string, assume the secret IS the API key
        apiKey = secretValue;
    }

    if (!apiKey) {
        throw new Error("Unable to extract OpenAI API Key from secret.");
    }

    openaiClient = new OpenAI({ apiKey });
    console.log("OpenAI client initialized successfully.");
    return openaiClient;

  } catch (err) {
    console.error("Error fetching/parsing OpenAI API key from Secrets Manager:", err);
    throw new Error(`Failed to retrieve/parse OpenAI API Key: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const handler = async (event: any, context: any): Promise<void> => {
  console.log('AI Lease Processing Lambda invoked. Event:', JSON.stringify(event, null, 2));
  
  try {
    openaiClient = await initializeOpenAIClient(); 
  } catch (initError) {
    console.error("Failed to initialize OpenAI client:", initError);
    throw initError;
  }

  for (const record of event.Records) {
    let analysisId: string | undefined;
    let sqsMessageBody: any; // To store the parsed body for wider use

    try {
      sqsMessageBody = JSON.parse(record.body);
      analysisId = sqsMessageBody.analysisId;
      const userUploadedFileName = sqsMessageBody.originalFileName || sqsMessageBody.userUploadedFileName; // Use originalFileName from SQS

      // TODO: Eviction Response - Check for batch processing mode
      if (sqsMessageBody.batchProcessing && sqsMessageBody.batchRequests) {
        console.log('(AI Lambda) Batch eviction processing mode detected');
        await handleBatchProcessing(sqsMessageBody.batchRequests, sqsMessageBody.batchId);
        continue; // Skip to next record after batch processing
      }

      // TODO: Data Collection - Check for data collection batch processing mode
      if (sqsMessageBody.dataCollectionBatch && sqsMessageBody.dataCollectionRequests) {
        console.log('(AI Lambda) Batch data collection mode detected');
        await handleDataCollectionBatch(sqsMessageBody.dataCollectionRequests, sqsMessageBody.batchId);
        continue; // Skip to next record after batch processing
      }

      if (!analysisId) {
        console.error("analysisId is missing in SQS message body:", sqsMessageBody);
        continue; 
      }
      // Ensure critical data from SQS message is present
      if (!sqsMessageBody.extractedText) {
        console.error(`Extracted text is missing in SQS message body for analysisId: ${analysisId}`);
        // Update DDB with error and continue
        await updateDynamoDBOnError(analysisId, "AI_PROCESSING_FAILED", "Missing extractedText in SQS message");
        continue;
      }
      if (!sqsMessageBody.userSelectedState) {
        console.warn(`userSelectedState is missing in SQS message body for analysisId: ${analysisId}. AI will use a general prompt.`);
        // AI function has a fallback, so this is not fatal, but good to log.
      }

      console.log(`Processing analysisId: ${analysisId} for file: ${userUploadedFileName || 'N/A'}`);

      // 1. Data directly from SQS message body
      const extractedText = sqsMessageBody.extractedText as string;
      const userSelectedState = sqsMessageBody.userSelectedState as string | undefined;
      const documentType = sqsMessageBody.documentType as string | undefined; // 'LEASE' or 'EVICTION_NOTICE'
      const isImageUpload = sqsMessageBody.isImageUpload as boolean | undefined;
      const userFormData = sqsMessageBody.userFormData; // Optional user-provided metadata for evictions
      const userId = sqsMessageBody.userId as string | undefined; // For lease context retrieval
      // s3Key, s3Bucket are also available in sqsMessageBody if needed later

      // 2. Update status to AI_PROCESSING_IN_PROGRESS
      console.log(`Updating status to AI_PROCESSING_IN_PROGRESS for ${analysisId}`);
      const updateInProgressParams = {
        TableName: DYNAMODB_TABLE!,
        Key: { analysisId },
        UpdateExpression: "set #status = :status, #lastUpdatedTimestamp = :timestamp",
        ExpressionAttributeNames: { "#status": "status", "#lastUpdatedTimestamp": "lastUpdatedTimestamp" },
        ExpressionAttributeValues: {
          ":status": "AI_PROCESSING_IN_PROGRESS",
          ":timestamp": new Date().toISOString(),
        },
      };
      await docClient.send(new UpdateCommand(updateInProgressParams));

      let finalResults: AIAnalysisResults | EnhancedEvictionAnalysisResults | null = null;
      let finalStatus: string = '';
      let errorDetails: string | null = null;

      try {
        // 3. Route to appropriate analysis based on document type
        console.log(`Processing document type: ${documentType || 'LEASE'} for ${analysisId} using text of length ${extractedText.length} for state: ${userSelectedState || 'general'}`);
        
        if (documentType === 'EVICTION_NOTICE') {
          // Route to eviction processing
          console.log(`Performing eviction analysis for ${analysisId}`);
          
          // Get lease context if userId is provided
          let leaseContext: LeaseContextData | null = null;
          if (userId) {
            leaseContext = await getUserLeaseContext(userId);
          }
          
          const evictionResults = await performEvictionAnalysisInternal(
            extractedText,
            userSelectedState,
            userFormData,
            isImageUpload || false,
            openaiClient,
            leaseContext || undefined
          );
          
          finalResults = evictionResults;
          finalStatus = 'ANALYSIS_COMPLETE';
          console.log(`Eviction analysis successful for ${analysisId}`);
          
        } else {
          // Default to lease analysis (backward compatibility)
          console.log(`Performing lease analysis for ${analysisId}`);
          
          const { initialAnalysisResults, actionableInsightsData } = await performAiLeaseAnalysisInternal(
            extractedText,          // From SQS message
            userSelectedState,      // From SQS message
            openaiClient
          );
          finalResults = { ...initialAnalysisResults, ...actionableInsightsData };
          finalStatus = 'ANALYSIS_COMPLETE';
          console.log(`Lease analysis successful for ${analysisId}`);
        }

      } catch (aiError: any) {
        console.error(`Error during AI processing for ${analysisId}:`, aiError);
        finalStatus = 'AI_PROCESSING_FAILED';
        errorDetails = aiError.message || "Unknown AI processing error.";
        
        // Partial results handling only applies to lease analysis
        if (documentType !== 'EVICTION_NOTICE' && aiError.partialResults) {
            // If actionable insights failed, but initial analysis succeeded (lease only)
            finalResults = { ...(aiError.partialResults as InitialAnalysisResults), actionableInsights: { overallRecommendation: "", nextSteps: []} };
            finalStatus = 'PARTIAL_ANALYSIS_INSIGHTS_FAILED';
            errorDetails = `Insights: ${errorDetails}`;
            console.log(`Partial results saved for ${analysisId} due to insights failure.`);
        }
      }

      // 4. Update DynamoDB with final results/status
      console.log(`Updating status to ${finalStatus} for ${analysisId}`);
      const updateFinalParams: any = {
        TableName: DYNAMODB_TABLE!,
        Key: { analysisId },
        UpdateExpression: "set #status = :status, #analysisResults = :analysisResults, #lastUpdatedTimestamp = :timestamp",
        ExpressionAttributeNames: {
          "#status": "status",
          "#analysisResults": "analysisResults",
          "#lastUpdatedTimestamp": "lastUpdatedTimestamp",
        },
        ExpressionAttributeValues: {
          ":status": finalStatus,
          ":analysisResults": finalResults, // Store the combined results
          ":timestamp": new Date().toISOString(),
        },
      };
      if (errorDetails) {
        updateFinalParams.UpdateExpression += ", #errorDetails = :errorDetails";
        updateFinalParams.ExpressionAttributeNames["#errorDetails"] = "errorDetails";
        updateFinalParams.ExpressionAttributeValues[":errorDetails"] = errorDetails;
      }
      await docClient.send(new UpdateCommand(updateFinalParams));
      console.log(`Successfully processed and updated ${analysisId}. Status: ${finalStatus}`);

    } catch (error: any) {
      console.error(`Failed to process SQS record for analysisId ${analysisId || 'unknown'}:`, error);
      // If analysisId is known and error is not during final DDB update, try to update DDB with error status
      if (analysisId) { 
        await updateDynamoDBOnError(analysisId, 'AI_PROCESSING_FAILED', error.message || 'Unknown error during SQS record processing');
      }
    }
  }
};

// Helper function to update DynamoDB on error, to avoid code duplication in catch blocks
async function updateDynamoDBOnError(analysisId: string, status: string, errorMessage: string) {
    console.log(`Updating DynamoDB for ${analysisId} with error status ${status} due to: ${errorMessage}`);
    try {
        const errorUpdateParams = {
            TableName: DYNAMODB_TABLE!,
            Key: { analysisId },
            UpdateExpression: "set #status = :status, #errorDetails = :errorDetails, #lastUpdatedTimestamp = :timestamp",
            ExpressionAttributeNames: { 
                "#status": "status", 
                "#errorDetails": "errorDetails",
                "#lastUpdatedTimestamp": "lastUpdatedTimestamp"
            },
            ExpressionAttributeValues: {
                ":status": status,
                ":errorDetails": errorMessage.substring(0, 2000), // Cap error message length
                ":timestamp": new Date().toISOString(),
            },
        };
        await docClient.send(new UpdateCommand(errorUpdateParams));
        console.log(`Successfully updated ${analysisId} with error status.`);
    } catch (dbError) {
        console.error(`Failed to update DynamoDB with error status for ${analysisId}:`, dbError);
        // Swallow this error as the main error is already logged.
    }
}

// TODO: Eviction Response - Add batch processing handler for Lambda
async function handleBatchProcessing(batchRequests: BatchEvictionRequest[], batchId: string): Promise<void> {
  console.log(`(AI Lambda) Starting batch processing for batch ID: ${batchId} with ${batchRequests.length} requests`);
  
  try {
    // Initialize PromptManager for batch operations
    const promptManager = new PromptManager();
    
    // Process the batch using the batch processing function
    const batchResults = await processBatchEvictionAnalysis(batchRequests, openaiClient, promptManager);
    
    // Update DynamoDB for each successful result
    for (const success of batchResults.successful) {
      try {
        const updateParams = {
          TableName: DYNAMODB_TABLE!,
          Key: { analysisId: success.analysisId },
          UpdateExpression: "set #status = :status, #analysisResults = :analysisResults, #lastUpdatedTimestamp = :timestamp, #batchId = :batchId",
          ExpressionAttributeNames: {
            "#status": "status",
            "#analysisResults": "analysisResults",
            "#lastUpdatedTimestamp": "lastUpdatedTimestamp",
            "#batchId": "batchId"
          },
          ExpressionAttributeValues: {
            ":status": "ANALYSIS_COMPLETE",
            ":analysisResults": success.results,
            ":timestamp": new Date().toISOString(),
            ":batchId": batchId
          },
        };
        await docClient.send(new UpdateCommand(updateParams));
        console.log(`(AI Lambda) Batch item ${success.analysisId} updated successfully`);
      } catch (updateError) {
        console.error(`(AI Lambda) Failed to update DynamoDB for successful batch item ${success.analysisId}:`, updateError);
      }
    }
    
    // Update DynamoDB for each failed result
    for (const failure of batchResults.failed) {
      try {
        const errorUpdateParams = {
          TableName: DYNAMODB_TABLE!,
          Key: { analysisId: failure.analysisId },
          UpdateExpression: "set #status = :status, #errorDetails = :errorDetails, #lastUpdatedTimestamp = :timestamp, #batchId = :batchId",
          ExpressionAttributeNames: {
            "#status": "status",
            "#errorDetails": "errorDetails",
            "#lastUpdatedTimestamp": "lastUpdatedTimestamp",
            "#batchId": "batchId"
          },
          ExpressionAttributeValues: {
            ":status": "AI_PROCESSING_FAILED",
            ":errorDetails": failure.error.substring(0, 2000), // Cap error message length
            ":timestamp": new Date().toISOString(),
            ":batchId": batchId
          },
        };
        await docClient.send(new UpdateCommand(errorUpdateParams));
        console.log(`(AI Lambda) Batch item ${failure.analysisId} updated with error status`);
      } catch (updateError) {
        console.error(`(AI Lambda) Failed to update DynamoDB for failed batch item ${failure.analysisId}:`, updateError);
      }
    }
    
    // Log batch completion metrics
    console.log(`(AI Lambda) Batch processing completed for batch ID: ${batchId}. Metrics:`, batchResults.batchMetrics);
    
  } catch (batchError) {
    console.error(`(AI Lambda) Batch processing failed for batch ID: ${batchId}:`, batchError);
    // TODO: Consider implementing fallback processing for failed batches
    throw batchError; // Re-throw to be handled by outer try-catch
  }
}

// TODO: Data Collection - Add data collection batch processing handler
async function handleDataCollectionBatch(dataCollectionRequests: DataCollectionRequest[], batchId: string): Promise<void> {
  console.log(`(Data Collection) Starting batch data collection for batch ID: ${batchId} with ${dataCollectionRequests.length} requests`);
  
  try {
    // Initialize PromptManager for potential AI processing
    const promptManager = new PromptManager();
    
    // Process the data collection batch
    const collectionResults = await processBatchDataCollection(
      dataCollectionRequests, 
      openaiClient, // Optional for AI enhancement
      promptManager  // Optional for template-based processing
    );
    
    // Store results in DynamoDB or S3 depending on size/type
    await storeDataCollectionResults(collectionResults, batchId);
    
    // Log completion metrics
    console.log(`(Data Collection) Batch processing completed for batch ID: ${batchId}. Metrics:`, collectionResults.batchMetrics);
    
  } catch (error) {
    console.error(`(Data Collection) Batch processing failed for batch ID: ${batchId}:`, error);
    // TODO: Store failure information for monitoring and retry
    throw error; // Re-throw to be handled by outer try-catch
  }
}

// TODO: Data Collection - Store batch collection results
async function storeDataCollectionResults(results: DataCollectionResults, batchId: string): Promise<void> {
  console.log(`(Data Collection) Storing results for batch ID: ${batchId}`);
  
  try {
    // Create a summary record in DynamoDB
    const summaryRecord = {
      batchId,
      batchType: 'DATA_COLLECTION',
      status: 'COMPLETED',
      totalRequests: results.batchMetrics.totalRequests,
      successfulRequests: results.batchMetrics.successfulRequests,
      failedRequests: results.batchMetrics.failedRequests,
      totalItemsCollected: results.batchMetrics.totalItemsCollected,
      processingTimeMs: results.batchMetrics.processingTimeMs,
      sourceTypes: results.batchMetrics.sourceTypes,
      averageQualityScore: results.batchMetrics.averageQualityScore,
      completedAt: new Date().toISOString(),
      resultsLocation: `s3://data-collection-results/${batchId}/` // TODO: Configure S3 bucket
    };
    
    // Store summary in DynamoDB (using same table with different key structure)
    const summaryParams = {
      TableName: DYNAMODB_TABLE!,
      Item: {
        analysisId: `data_collection_batch_${batchId}`,
        batchType: 'DATA_COLLECTION',
        status: 'COMPLETED',
        batchSummary: summaryRecord,
        lastUpdatedTimestamp: new Date().toISOString()
      }
    };
    
    await docClient.send(new PutCommand(summaryParams));
    
    // TODO: Store detailed results in S3 for large datasets
    // For now, just log the successful completion
    console.log(`(Data Collection) Successfully stored batch summary for ${batchId}`);
    
  } catch (error) {
    console.error(`(Data Collection) Failed to store results for batch ${batchId}:`, error);
    throw error;
  }
}

// TODO: Data Collection - Main batch data collection processor
export async function processBatchDataCollection(
  requests: DataCollectionRequest[],
  openaiClient?: OpenAI, // Optional for AI-enhanced processing
  promptManager?: PromptManager // Optional for template-based processing
): Promise<DataCollectionResults> {
  
  const startTime = Date.now();
  console.log(`(Data Collection) Starting batch data collection for ${requests.length} requests`);
  
  const successful: Array<{
    requestId: string;
    collectedItems: CollectedDataItem[];
    sourceMetrics: {
      totalFound: number;
      extracted: number;
      filtered: number;
      validationPassed: number;
    };
  }> = [];
  
  const failed: Array<{
    requestId: string;
    error: string;
    sourceUrl?: string;
  }> = [];
  
  const sourceTypeStats: Record<string, number> = {};
  let totalItemsCollected = 0;
  let totalQualitySum = 0;
  let itemsWithQuality = 0;
  
  try {
    // Group requests by data source type for optimized processing
    const requestsBySource = requests.reduce((acc, req) => {
      const key = req.dataSource;
      if (!acc[key]) acc[key] = [];
      acc[key].push(req);
      sourceTypeStats[key] = (sourceTypeStats[key] || 0) + 1;
      return acc;
    }, {} as Record<string, DataCollectionRequest[]>);
    
    console.log(`(Data Collection) Processing ${Object.keys(requestsBySource).length} different source types`);
    
    // Process each source type sequentially to avoid overwhelming endpoints
    for (const [sourceType, sourceRequests] of Object.entries(requestsBySource)) {
      console.log(`(Data Collection) Processing ${sourceRequests.length} requests from source: ${sourceType}`);
      
      // Process requests within each source type with concurrency control
      const concurrencyLimit = getSourceConcurrencyLimit(sourceType);
      const chunks = chunkArray(sourceRequests, concurrencyLimit);
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (request) => {
          try {
            console.log(`(Data Collection) Processing request: ${request.requestId} from ${sourceType}`);
            
            const collectionResult = await processDataCollectionRequest(
              request,
              openaiClient,
              promptManager
            );
            
            successful.push(collectionResult);
            totalItemsCollected += collectionResult.collectedItems.length;
            
            // Calculate quality metrics
            collectionResult.collectedItems.forEach(item => {
              if (item.qualityScore !== undefined) {
                totalQualitySum += item.qualityScore;
                itemsWithQuality++;
              }
            });
            
            console.log(`(Data Collection) Request completed: ${request.requestId} (${collectionResult.collectedItems.length} items)`);
            
          } catch (error) {
            console.error(`(Data Collection) Request failed: ${request.requestId}`, error);
            failed.push({
              requestId: request.requestId,
              error: error instanceof Error ? error.message : 'Unknown error',
              sourceUrl: request.sourceUrl
            });
          }
        });
        
        await Promise.all(chunkPromises);
        
        // Add delay between chunks to be respectful to external services
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
      }
    }
    
  } catch (error) {
    console.error('(Data Collection) Critical error in batch processing:', error);
    // Mark remaining unprocessed requests as failed
    for (const request of requests) {
      if (!successful.find(s => s.requestId === request.requestId) && 
          !failed.find(f => f.requestId === request.requestId)) {
        failed.push({
          requestId: request.requestId,
          error: 'Batch processing interrupted'
        });
      }
    }
  }
  
  const endTime = Date.now();
  const averageQualityScore = itemsWithQuality > 0 ? totalQualitySum / itemsWithQuality : undefined;
  
  const batchMetrics = {
    totalRequests: requests.length,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    totalItemsCollected,
    processingTimeMs: endTime - startTime,
    sourceTypes: sourceTypeStats,
    averageQualityScore
  };
  
  console.log(`(Data Collection) Batch processing completed:`, batchMetrics);
  
  return {
    successful,
    failed,
    batchMetrics
  };
}

// TODO: Data Collection - Individual request processor
async function processDataCollectionRequest(
  request: DataCollectionRequest,
  openaiClient?: OpenAI,
  promptManager?: PromptManager
): Promise<{
  requestId: string;
  collectedItems: CollectedDataItem[];
  sourceMetrics: {
    totalFound: number;
    extracted: number;
    filtered: number;
    validationPassed: number;
  };
}> {
  
  console.log(`(Data Collection) Processing ${request.dataSource} request: ${request.requestId}`);
  
  let collectedItems: CollectedDataItem[] = [];
  let sourceMetrics = {
    totalFound: 0,
    extracted: 0,
    filtered: 0,
    validationPassed: 0
  };
  
  try {
    // Route to appropriate data source handler
    switch (request.dataSource) {
      case 'HUD':
        ({ collectedItems, sourceMetrics } = await processHudDataSource(request));
        break;
      case 'COURT_RECORDS':
        ({ collectedItems, sourceMetrics } = await processCourtRecordsSource(request));
        break;
      case 'STATE_BAR':
        ({ collectedItems, sourceMetrics } = await processStateBarSource(request));
        break;
      case 'LEGAL_AID':
        ({ collectedItems, sourceMetrics } = await processLegalAidSource(request));
        break;
      case 'CUSTOM':
        ({ collectedItems, sourceMetrics } = await processCustomDataSource(request));
        break;
      default:
        throw new Error(`Unsupported data source: ${request.dataSource}`);
    }
    
    // Apply AI processing if requested and available
    if (request.processingInstructions?.aiProcessing && openaiClient && promptManager) {
      collectedItems = await enhanceDataWithAI(collectedItems, request, openaiClient, promptManager);
    }
    
    // Apply validation rules
    if (request.processingInstructions?.validationRules) {
      collectedItems = await validateCollectedData(collectedItems, request.processingInstructions.validationRules);
      sourceMetrics.validationPassed = collectedItems.filter(item => 
        item.validationStatus === 'APPROVED'
      ).length;
    }
    
  } catch (error) {
    console.error(`(Data Collection) Error processing request ${request.requestId}:`, error);
    throw error;
  }
  
  return {
    requestId: request.requestId,
    collectedItems,
    sourceMetrics
  };
}

// TODO: Data Collection - Source-specific processors (placeholder implementations)
async function processHudDataSource(request: DataCollectionRequest): Promise<{
  collectedItems: CollectedDataItem[];
  sourceMetrics: { totalFound: number; extracted: number; filtered: number; validationPassed: number; };
}> {
  console.log(`(Data Collection) Processing HUD data source for request: ${request.requestId}`);
  
  // TODO: Implement HUD API integration or web scraping
  // Placeholder implementation
  const mockItems: CollectedDataItem[] = [
    {
      itemId: `hud_${Date.now()}_1`,
      sourceType: 'HUD',
      sourceUrl: request.sourceUrl || 'https://www.hud.gov',
      title: 'Fair Housing Guidelines',
      content: 'Mock HUD content for testing',
      metadata: {
        documentType: 'guidelines',
        lastUpdated: new Date().toISOString(),
        jurisdiction: 'federal'
      },
      extractedAt: new Date().toISOString(),
      qualityScore: 0.85,
      validationStatus: 'PENDING'
    }
  ];
  
  return {
    collectedItems: mockItems,
    sourceMetrics: {
      totalFound: 1,
      extracted: 1,
      filtered: 1,
      validationPassed: 0
    }
  };
}

async function processCourtRecordsSource(request: DataCollectionRequest): Promise<{
  collectedItems: CollectedDataItem[];
  sourceMetrics: { totalFound: number; extracted: number; filtered: number; validationPassed: number; };
}> {
  console.log(`(Data Collection) Processing Court Records for request: ${request.requestId}`);
  
  // TODO: Implement court records API integration
  // This would integrate with PACER, state court systems, etc.
  const mockItems: CollectedDataItem[] = [];
  
  return {
    collectedItems: mockItems,
    sourceMetrics: {
      totalFound: 0,
      extracted: 0,
      filtered: 0,
      validationPassed: 0
    }
  };
}

async function processStateBarSource(request: DataCollectionRequest): Promise<{
  collectedItems: CollectedDataItem[];
  sourceMetrics: { totalFound: number; extracted: number; filtered: number; validationPassed: number; };
}> {
  console.log(`(Data Collection) Processing State Bar source for request: ${request.requestId}`);
  
  // TODO: Implement state bar association form/template scraping
  // This would scrape official forms from state bar websites
  const mockItems: CollectedDataItem[] = [];
  
  return {
    collectedItems: mockItems,
    sourceMetrics: {
      totalFound: 0,
      extracted: 0,
      filtered: 0,
      validationPassed: 0
    }
  };
}

async function processLegalAidSource(request: DataCollectionRequest): Promise<{
  collectedItems: CollectedDataItem[];
  sourceMetrics: { totalFound: number; extracted: number; filtered: number; validationPassed: number; };
}> {
  console.log(`(Data Collection) Processing Legal Aid source for request: ${request.requestId}`);
  
  // TODO: Implement legal aid organization resource scraping
  // This would collect verified templates from legal aid organizations
  const mockItems: CollectedDataItem[] = [];
  
  return {
    collectedItems: mockItems,
    sourceMetrics: {
      totalFound: 0,
      extracted: 0,
      filtered: 0,
      validationPassed: 0
    }
  };
}

async function processCustomDataSource(request: DataCollectionRequest): Promise<{
  collectedItems: CollectedDataItem[];
  sourceMetrics: { totalFound: number; extracted: number; filtered: number; validationPassed: number; };
}> {
  console.log(`(Data Collection) Processing Custom data source for request: ${request.requestId}`);
  
  // TODO: Implement custom/generic web scraping
  // This would handle custom URLs and extraction patterns
  const mockItems: CollectedDataItem[] = [];
  
  return {
    collectedItems: mockItems,
    sourceMetrics: {
      totalFound: 0,
      extracted: 0,
      filtered: 0,
      validationPassed: 0
    }
  };
}

// TODO: Data Collection - AI enhancement helper
async function enhanceDataWithAI(
  items: CollectedDataItem[],
  request: DataCollectionRequest,
  openaiClient: OpenAI,
  promptManager: PromptManager
): Promise<CollectedDataItem[]> {
  console.log(`(Data Collection) Enhancing ${items.length} items with AI processing`);
  
  // TODO: Implement AI-powered content analysis, quality scoring, categorization, etc.
  // For now, just return items unchanged
  return items;
}

// TODO: Data Collection - Validation helper
async function validateCollectedData(
  items: CollectedDataItem[],
  validationRules: string[]
): Promise<CollectedDataItem[]> {
  console.log(`(Data Collection) Validating ${items.length} items with ${validationRules.length} rules`);
  
  // TODO: Implement validation logic based on rules
  // For now, mark all as needing review
  return items.map(item => ({
    ...item,
    validationStatus: 'NEEDS_REVIEW' as const
  }));
}

// TODO: Data Collection - Concurrency control helper
function getSourceConcurrencyLimit(sourceType: string): number {
  // Different sources may have different rate limits
  switch (sourceType) {
    case 'HUD':
      return 2; // Be respectful to government APIs
    case 'COURT_RECORDS':
      return 1; // Very conservative for court systems
    case 'STATE_BAR':
      return 3; // Moderate for professional sites
    case 'LEGAL_AID':
      return 3; // Moderate for non-profit sites
    case 'CUSTOM':
      return 2; // Conservative default
    default:
      return 2;
  }
} 