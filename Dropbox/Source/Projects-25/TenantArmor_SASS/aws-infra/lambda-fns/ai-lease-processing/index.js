"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const openai_1 = __importDefault(require("openai"));
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const prompt_manager_1 = require("./prompt-manager");
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
async function performAiLeaseAnalysisInternal(extractedText, userSelectedState, // Can be undefined if not present
openaiClient) {
    let initialAnalysisResults;
    let actionableInsightsData;
    const stateForPrompt = userSelectedState || 'general'; // Fallback if state is not provided
    // Initialize PromptManager to load dynamic prompts
    const promptManager = new prompt_manager_1.PromptManager();
    let promptConfig;
    try {
        promptConfig = await promptManager.getLeaseAnalysisConfig();
        console.log('(AI Lambda) Successfully loaded dynamic prompts from external sources.');
    }
    catch (promptError) {
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
        if (!rawContentInitial)
            throw new Error('Initial analysis: No content from AI.');
        initialAnalysisResults = JSON.parse(rawContentInitial);
        console.log('(AI Lambda) Initial analysis successful.');
    }
    catch (aiError) {
        console.error('(AI Lambda) Error during initial AI analysis:', aiError);
        throw new Error(`Initial AI Analysis Failed: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
    }
    // === PHASE 2: Generate Actionable Insights ===
    try {
        let contextForInsights = `Summary: ${initialAnalysisResults.summary}. Overall Severity: ${initialAnalysisResults.overallSeverity}.`;
        const highSeverityIssues = initialAnalysisResults.clauses
            .flatMap((c) => c.issues)
            .filter((i) => i.severity === 'High')
            .map((i) => i.description);
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
        if (!rawContentInsights)
            throw new Error('Actionable insights: No content from AI.');
        actionableInsightsData = JSON.parse(rawContentInsights);
        console.log('(AI Lambda) Actionable insights generation successful.');
    }
    catch (aiError) {
        console.error('(AI Lambda) Error during actionable insights generation:', aiError);
        const error = new Error(`Actionable Insights Generation Failed: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
        error.partialResults = initialAnalysisResults; // Attach partial results
        throw error;
    }
    return { initialAnalysisResults, actionableInsightsData };
}
// TODO: Eviction Response - Add core eviction processing function
// === EVICTION PROCESSING FUNCTION ===
async function performEvictionAnalysisInternal(extractedText, userSelectedState, userFormData, // Optional user-provided metadata
isImageUpload, // true for images, false for PDFs
openaiClient, leaseContext // TODO: Lease context for enhanced analysis
) {
    const promptManager = new prompt_manager_1.PromptManager();
    const stateForPrompt = userSelectedState || userFormData?.state || 'general';
    // Initialize variables for final results
    let leaseBasedRecommendations = [];
    // === PHASE 1: Extract Structured Data from Notice ===
    let extractedDetails;
    try {
        console.log(`(AI Lambda) Extracting eviction notice details for ${isImageUpload ? 'image' : 'PDF text'}...`);
        const extractionPrompt = await promptManager.getEvictionExtractionPrompt(isImageUpload);
        const systemMessage = `${extractionPrompt.systemPrompt}
    
Respond ONLY with a valid JSON object adhering to this schema: ${JSON.stringify(evictionExtractionSchema, null, 2)}`;
        let messages;
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
        }
        else {
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
        if (!rawExtraction)
            throw new Error('No extraction content from AI.');
        extractedDetails = JSON.parse(rawExtraction);
        // Merge with user-provided form data (user data takes precedence)
        if (userFormData) {
            extractedDetails = {
                ...extractedDetails,
                ...Object.fromEntries(Object.entries(userFormData).filter(([_, value]) => value !== undefined && value !== ''))
            };
        }
        console.log('(AI Lambda) Eviction details extraction successful.');
    }
    catch (error) {
        console.error('(AI Lambda) Error during eviction details extraction:', error);
        throw new Error(`Eviction Details Extraction Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    // === PHASE 2: Generate Legal Insights with RAG ===
    let legalInsights;
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
        }
        else {
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
        if (!rawInsights)
            throw new Error('No insights content from AI.');
        legalInsights = JSON.parse(rawInsights);
        // TODO: Generate lease-specific recommendations if context is available
        if (leaseContext?.leaseAnalysisResults) {
            leaseBasedRecommendations = await generateLeaseBasedRecommendations(extractedDetails, leaseContext.leaseAnalysisResults, openaiClient, promptManager);
        }
        console.log('(AI Lambda) Legal insights generation successful.');
    }
    catch (error) {
        console.error('(AI Lambda) Error during legal insights generation:', error);
        throw new Error(`Legal Insights Generation Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    // === PHASE 3: Populate Templates ===
    let populatedTemplates;
    try {
        console.log('(AI Lambda) Populating eviction response templates...');
        populatedTemplates = await populateEvictionTemplates(extractedDetails, stateForPrompt);
        console.log('(AI Lambda) Template population successful.');
    }
    catch (error) {
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
async function populateEvictionTemplates(extractedDetails, state) {
    // TODO: Implement template reading from file system or S3
    // For now, return placeholder templates
    console.log('(AI Lambda) Template population - TODO: Implement file reading logic');
    const templateData = {
        tenantName: extractedDetails.tenantName || '[Tenant Name]',
        landlordName: extractedDetails.landlordName || '[Landlord Name]',
        noticeDate: extractedDetails.noticeDate || '[Notice Date]',
        deadlineDate: extractedDetails.deadlineDate || '[Deadline Date]',
        county: extractedDetails.detectedCounty || '[County]',
        state: state.toUpperCase(),
        paymentDate: '[Payment Date]', // TODO: Extract from user form data
        paymentMethod: '[Payment Method]', // TODO: Extract from user form data
        rentAmount: extractedDetails.rentAmountDue || '[Rent Amount]'
    };
    // TODO: Read actual template files based on state and reason
    const reason = determineEvictionReason(extractedDetails.evictionReasonSummary);
    console.log(`(AI Lambda) Determined eviction reason: ${reason} for state: ${state}`);
    // Placeholder populated letter
    const populatedLetter = `[${templateData.tenantName}]
[Your Address]
[Date]

[${templateData.landlordName}]
[Landlord Address]

RE: Response to Eviction Notice Dated ${templateData.noticeDate}

I dispute this eviction notice under ${templateData.state} law. 

[Template content would be populated here based on ${reason} and ${state}]

Sincerely,
${templateData.tenantName}`;
    // Placeholder court instructions and legal aid contacts
    return {
        populatedLetter,
        courtInstructions: `File your response at the ${templateData.county} County Superior Court within the deadline specified in your notice.`,
        legalAidContacts: [
            {
                name: `${state} Legal Aid Society`,
                phone: "555-LEGAL-AID",
                url: `https://legalaid${state.toLowerCase()}.org`
            }
        ]
    };
}
// TODO: Eviction Response - Helper function to determine eviction reason from summary
function determineEvictionReason(reasonSummary) {
    if (!reasonSummary)
        return 'unknown';
    const summary = reasonSummary.toLowerCase();
    if (summary.includes('rent') || summary.includes('payment')) {
        return 'non-payment';
    }
    else if (summary.includes('violation') || summary.includes('breach')) {
        return 'lease-violation';
    }
    else if (summary.includes('end') || summary.includes('expir') || summary.includes('term')) {
        return 'no-cause';
    }
    return 'other';
}
// TODO: Eviction Response - Add lease-based recommendations helper function
async function generateLeaseBasedRecommendations(extractedDetails, leaseAnalysisResults, openaiClient, promptManager) {
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
        if (!rawResponse)
            throw new Error('No response from AI for lease recommendations.');
        const parsed = JSON.parse(rawResponse);
        return Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    }
    catch (error) {
        console.error('(AI Lambda) Error generating lease-based recommendations:', error);
        return []; // Return empty array on error, don't fail the entire process
    }
}
// TODO: Eviction Response - Add function to retrieve user's lease context
async function getUserLeaseContext(userId) {
    try {
        console.log(`(AI Lambda) Retrieving lease context for user: ${userId}`);
        // TODO: Query DynamoDB for user's most recent lease analysis
        // For now, return null - this will be implemented when we have user context
        console.log('(AI Lambda) Lease context retrieval - TODO: Implement DynamoDB query for user lease history');
        return null;
    }
    catch (error) {
        console.error('(AI Lambda) Error retrieving lease context:', error);
        return null; // Don't fail eviction processing if lease context retrieval fails
    }
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
const dynamoDBClient = new client_dynamodb_1.DynamoDBClient({ region: AWS_REGION });
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoDBClient);
let openaiClient;
async function initializeOpenAIClient() {
    if (openaiClient) {
        return openaiClient;
    }
    console.log(`Fetching OpenAI API key from Secrets Manager: ${OPENAI_API_KEY_SECRET_NAME}`);
    const secretsClient = new client_secrets_manager_1.SecretsManagerClient({ region: AWS_REGION });
    try {
        const command = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: OPENAI_API_KEY_SECRET_NAME });
        const data = await secretsClient.send(command);
        let secretValue;
        if (data.SecretString) {
            secretValue = data.SecretString;
        }
        else if (data.SecretBinary) {
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
            if (!apiKey && typeof secretJson === 'string')
                apiKey = secretJson; // if JSON is just the key string itself
            else if (!apiKey)
                apiKey = secretValue; // Fallback if key not found in JSON structure
        }
        catch (e) {
            // Not a JSON string, assume the secret IS the API key
            apiKey = secretValue;
        }
        if (!apiKey) {
            throw new Error("Unable to extract OpenAI API Key from secret.");
        }
        openaiClient = new openai_1.default({ apiKey });
        console.log("OpenAI client initialized successfully.");
        return openaiClient;
    }
    catch (err) {
        console.error("Error fetching/parsing OpenAI API key from Secrets Manager:", err);
        throw new Error(`Failed to retrieve/parse OpenAI API Key: ${err instanceof Error ? err.message : String(err)}`);
    }
}
const handler = async (event, context) => {
    console.log('AI Lease Processing Lambda invoked. Event:', JSON.stringify(event, null, 2));
    try {
        openaiClient = await initializeOpenAIClient();
    }
    catch (initError) {
        console.error("Failed to initialize OpenAI client:", initError);
        throw initError;
    }
    for (const record of event.Records) {
        let analysisId;
        let sqsMessageBody; // To store the parsed body for wider use
        try {
            sqsMessageBody = JSON.parse(record.body);
            analysisId = sqsMessageBody.analysisId;
            const userUploadedFileName = sqsMessageBody.originalFileName || sqsMessageBody.userUploadedFileName; // Use originalFileName from SQS
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
            const extractedText = sqsMessageBody.extractedText;
            const userSelectedState = sqsMessageBody.userSelectedState;
            const documentType = sqsMessageBody.documentType; // 'LEASE' or 'EVICTION_NOTICE'
            const isImageUpload = sqsMessageBody.isImageUpload;
            const userFormData = sqsMessageBody.userFormData; // Optional user-provided metadata for evictions
            const userId = sqsMessageBody.userId; // For lease context retrieval
            // s3Key, s3Bucket are also available in sqsMessageBody if needed later
            // 2. Update status to AI_PROCESSING_IN_PROGRESS
            console.log(`Updating status to AI_PROCESSING_IN_PROGRESS for ${analysisId}`);
            const updateInProgressParams = {
                TableName: DYNAMODB_TABLE,
                Key: { analysisId },
                UpdateExpression: "set #status = :status, #lastUpdatedTimestamp = :timestamp",
                ExpressionAttributeNames: { "#status": "status", "#lastUpdatedTimestamp": "lastUpdatedTimestamp" },
                ExpressionAttributeValues: {
                    ":status": "AI_PROCESSING_IN_PROGRESS",
                    ":timestamp": new Date().toISOString(),
                },
            };
            await docClient.send(new lib_dynamodb_1.UpdateCommand(updateInProgressParams));
            let finalResults = null;
            let finalStatus = '';
            let errorDetails = null;
            try {
                // 3. Route to appropriate analysis based on document type
                console.log(`Processing document type: ${documentType || 'LEASE'} for ${analysisId} using text of length ${extractedText.length} for state: ${userSelectedState || 'general'}`);
                if (documentType === 'EVICTION_NOTICE') {
                    // Route to eviction processing
                    console.log(`Performing eviction analysis for ${analysisId}`);
                    // Get lease context if userId is provided
                    let leaseContext = null;
                    if (userId) {
                        leaseContext = await getUserLeaseContext(userId);
                    }
                    const evictionResults = await performEvictionAnalysisInternal(extractedText, userSelectedState, userFormData, isImageUpload || false, openaiClient, leaseContext || undefined);
                    finalResults = evictionResults;
                    finalStatus = 'ANALYSIS_COMPLETE';
                    console.log(`Eviction analysis successful for ${analysisId}`);
                }
                else {
                    // Default to lease analysis (backward compatibility)
                    console.log(`Performing lease analysis for ${analysisId}`);
                    const { initialAnalysisResults, actionableInsightsData } = await performAiLeaseAnalysisInternal(extractedText, // From SQS message
                    userSelectedState, // From SQS message
                    openaiClient);
                    finalResults = { ...initialAnalysisResults, ...actionableInsightsData };
                    finalStatus = 'ANALYSIS_COMPLETE';
                    console.log(`Lease analysis successful for ${analysisId}`);
                }
            }
            catch (aiError) {
                console.error(`Error during AI processing for ${analysisId}:`, aiError);
                finalStatus = 'AI_PROCESSING_FAILED';
                errorDetails = aiError.message || "Unknown AI processing error.";
                // Partial results handling only applies to lease analysis
                if (documentType !== 'EVICTION_NOTICE' && aiError.partialResults) {
                    // If actionable insights failed, but initial analysis succeeded (lease only)
                    finalResults = { ...aiError.partialResults, actionableInsights: { overallRecommendation: "", nextSteps: [] } };
                    finalStatus = 'PARTIAL_ANALYSIS_INSIGHTS_FAILED';
                    errorDetails = `Insights: ${errorDetails}`;
                    console.log(`Partial results saved for ${analysisId} due to insights failure.`);
                }
            }
            // 4. Update DynamoDB with final results/status
            console.log(`Updating status to ${finalStatus} for ${analysisId}`);
            const updateFinalParams = {
                TableName: DYNAMODB_TABLE,
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
            await docClient.send(new lib_dynamodb_1.UpdateCommand(updateFinalParams));
            console.log(`Successfully processed and updated ${analysisId}. Status: ${finalStatus}`);
        }
        catch (error) {
            console.error(`Failed to process SQS record for analysisId ${analysisId || 'unknown'}:`, error);
            // If analysisId is known and error is not during final DDB update, try to update DDB with error status
            if (analysisId) {
                await updateDynamoDBOnError(analysisId, 'AI_PROCESSING_FAILED', error.message || 'Unknown error during SQS record processing');
            }
        }
    }
};
exports.handler = handler;
// Helper function to update DynamoDB on error, to avoid code duplication in catch blocks
async function updateDynamoDBOnError(analysisId, status, errorMessage) {
    console.log(`Updating DynamoDB for ${analysisId} with error status ${status} due to: ${errorMessage}`);
    try {
        const errorUpdateParams = {
            TableName: DYNAMODB_TABLE,
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
        await docClient.send(new lib_dynamodb_1.UpdateCommand(errorUpdateParams));
        console.log(`Successfully updated ${analysisId} with error status.`);
    }
    catch (dbError) {
        console.error(`Failed to update DynamoDB with error status for ${analysisId}:`, dbError);
        // Swallow this error as the main error is already logged.
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxvREFBNEI7QUFDNUIsOERBQTBEO0FBQzFELHdEQUEwRjtBQUMxRiw0RUFBOEY7QUFDOUYscURBQWlEO0FBMEdqRCwwREFBMEQ7QUFDMUQsTUFBTSx5QkFBeUIsR0FBRztJQUNoQyxJQUFJLEVBQUUsUUFBUTtJQUNkLFVBQVUsRUFBRTtRQUNWLE9BQU8sRUFBRTtZQUNQLElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLDBIQUEwSDtTQUN4STtRQUNELGVBQWUsRUFBRTtZQUNmLElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLDRKQUE0SjtZQUN6SyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQztTQUNoQztRQUNELE9BQU8sRUFBRTtZQUNQLElBQUksRUFBRSxPQUFPO1lBQ2IsV0FBVyxFQUFFLGtFQUFrRTtZQUMvRSxLQUFLLEVBQUU7Z0JBQ0wsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsVUFBVSxFQUFFO29CQUNWLEtBQUssRUFBRTt3QkFDTCxJQUFJLEVBQUUsUUFBUTt3QkFDZCxXQUFXLEVBQUUsZ0lBQWdJO3FCQUM5STtvQkFDRCxJQUFJLEVBQUU7d0JBQ0osSUFBSSxFQUFFLFFBQVE7d0JBQ2QsV0FBVyxFQUFFLHNFQUFzRTtxQkFDcEY7b0JBQ0QsTUFBTSxFQUFFO3dCQUNOLElBQUksRUFBRSxPQUFPO3dCQUNiLFdBQVcsRUFBRSxzR0FBc0c7d0JBQ25ILEtBQUssRUFBRTs0QkFDTCxJQUFJLEVBQUUsUUFBUTs0QkFDZCxVQUFVLEVBQUU7Z0NBQ1YsV0FBVyxFQUFFO29DQUNYLElBQUksRUFBRSxRQUFRO29DQUNkLFdBQVcsRUFBRSx3REFBd0Q7aUNBQ3RFO2dDQUNELFFBQVEsRUFBRTtvQ0FDUixJQUFJLEVBQUUsUUFBUTtvQ0FDZCxXQUFXLEVBQUUsaUZBQWlGO29D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RUFBRSxNQUFNO2dCQUNqQixlQUFlLEVBQUUsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQUUsMkJBQTJCO2dCQUM3RSxZQUFZLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7YUFDekM7U0FDSixDQUFDO1FBQ0YsTUFBTSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksNEJBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7UUFDM0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsVUFBVSxxQkFBcUIsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFBQyxPQUFPLE9BQU8sRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxtREFBbUQsVUFBVSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekYsMERBQTBEO0lBQzlELENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IE9wZW5BSSBmcm9tICdvcGVuYWknO1xyXG5pbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYic7XHJcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIEdldENvbW1hbmQsIFVwZGF0ZUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9saWItZHluYW1vZGInO1xyXG5pbXBvcnQgeyBTZWNyZXRzTWFuYWdlckNsaWVudCwgR2V0U2VjcmV0VmFsdWVDb21tYW5kIH0gZnJvbSBcIkBhd3Mtc2RrL2NsaWVudC1zZWNyZXRzLW1hbmFnZXJcIjtcclxuaW1wb3J0IHsgUHJvbXB0TWFuYWdlciB9IGZyb20gJy4vcHJvbXB0LW1hbmFnZXInO1xyXG5cclxuLyoqXHJcbiAqIEFJIERvY3VtZW50IFByb2Nlc3NpbmcgTGFtYmRhXHJcbiAqIFxyXG4gKiBUaGlzIExhbWJkYSBmdW5jdGlvbiBwcm9jZXNzZXMgYm90aDpcclxuICogMS4gTEVBU0UgZG9jdW1lbnRzIC0gQW5hbHl6ZXMgbGVhc2UgYWdyZWVtZW50cyBmb3IgdGVuYW50IHByb3RlY3Rpb25cclxuICogMi4gRVZJQ1RJT05fTk9USUNFIGRvY3VtZW50cyAtIFByb2Nlc3NlcyBldmljdGlvbiBub3RpY2VzIGFuZCBnZW5lcmF0ZXMgcmVzcG9uc2UgdGVtcGxhdGVzXHJcbiAqIFxyXG4gKiBSb3V0ZXMgcHJvY2Vzc2luZyBiYXNlZCBvbiBkb2N1bWVudFR5cGUgaW4gU1FTIG1lc3NhZ2U6XHJcbiAqIC0gJ0VWSUNUSU9OX05PVElDRScg4oaSIHBlcmZvcm1FdmljdGlvbkFuYWx5c2lzSW50ZXJuYWwoKVxyXG4gKiAtICdMRUFTRScgb3IgdW5kZWZpbmVkIOKGkiBwZXJmb3JtQWlMZWFzZUFuYWx5c2lzSW50ZXJuYWwoKSAoYmFja3dhcmQgY29tcGF0aWJpbGl0eSlcclxuICovXHJcblxyXG4vLyAtLS0gVHlwZVNjcmlwdCBJbnRlcmZhY2VzIGZvciBBSSBTY2hlbWFzIChjb3BpZWQgZnJvbSBsZWFzZUFuYWx5c2lzTG9naWMudHMpIC0tLVxyXG5leHBvcnQgaW50ZXJmYWNlIElzc3VlIHtcclxuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xyXG4gIHNldmVyaXR5OiBcIkhpZ2hcIiB8IFwiTWVkaXVtXCIgfCBcIkxvd1wiO1xyXG4gIHJlY29tbWVuZGF0aW9uOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ2xhdXNlIHtcclxuICB0aXRsZTogc3RyaW5nO1xyXG4gIHRleHQ6IHN0cmluZztcclxuICBpc3N1ZXM6IElzc3VlW107XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSW5pdGlhbEFuYWx5c2lzUmVzdWx0cyB7XHJcbiAgc3VtbWFyeTogc3RyaW5nO1xyXG4gIG92ZXJhbGxTZXZlcml0eTogXCJIaWdoXCIgfCBcIk1lZGl1bVwiIHwgXCJMb3dcIjtcclxuICBjbGF1c2VzOiBDbGF1c2VbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBOZXh0U3RlcCB7XHJcbiAgc3RlcDogc3RyaW5nO1xyXG4gIGltcG9ydGFuY2U6IFwiSGlnaFwiIHwgXCJNZWRpdW1cIiB8IFwiQ29uc2lkZXJcIjtcclxuICBkZXRhaWxzPzogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFjdGlvbmFibGVJbnNpZ2h0c0RhdGEge1xyXG4gIGFjdGlvbmFibGVJbnNpZ2h0czoge1xyXG4gICAgb3ZlcmFsbFJlY29tbWVuZGF0aW9uOiBzdHJpbmc7XHJcbiAgICBuZXh0U3RlcHM6IE5leHRTdGVwW107XHJcbiAgfTtcclxufVxyXG5cclxuLy8gQ29tYmluZWQgc3RydWN0dXJlIGZvciBEeW5hbW9EQlxyXG5leHBvcnQgaW50ZXJmYWNlIEFJQW5hbHlzaXNSZXN1bHRzIGV4dGVuZHMgSW5pdGlhbEFuYWx5c2lzUmVzdWx0cywgQWN0aW9uYWJsZUluc2lnaHRzRGF0YSB7fVxyXG5cclxuLy8gVE9ETzogRXZpY3Rpb24gUmVzcG9uc2UgLSBBZGQgZXZpY3Rpb24tc3BlY2lmaWMgaW50ZXJmYWNlcyBhbmQgc2NoZW1hc1xyXG4vLyA9PT0gRVZJQ1RJT04gUFJPQ0VTU0lORyBJTlRFUkZBQ0VTID09PVxyXG5leHBvcnQgaW50ZXJmYWNlIEV4dHJhY3RlZEV2aWN0aW9uRGV0YWlscyB7XHJcbiAgbGFuZGxvcmROYW1lPzogc3RyaW5nO1xyXG4gIHRlbmFudE5hbWU/OiBzdHJpbmc7XHJcbiAgbm90aWNlRGF0ZT86IHN0cmluZzsgLy8gWVlZWS1NTS1ERFxyXG4gIGRlYWRsaW5lRGF0ZT86IHN0cmluZzsgLy8gWVlZWS1NTS1ERFxyXG4gIGRldGVjdGVkU3RhdGU/OiBzdHJpbmc7XHJcbiAgZGV0ZWN0ZWRDb3VudHk/OiBzdHJpbmc7XHJcbiAgZXZpY3Rpb25SZWFzb25TdW1tYXJ5Pzogc3RyaW5nO1xyXG4gIHNwZWNpZmljQ2xhdXNlc0NpdGVkPzogc3RyaW5nW107XHJcbiAgcmVudEFtb3VudER1ZT86IHN0cmluZztcclxuICBsZWFzZUVuZERhdGVNZW50aW9uZWQ/OiBzdHJpbmc7XHJcbiAgZnVsbEV4dHJhY3RlZFRleHQ6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQb3B1bGF0ZWRFdmljdGlvblRlbXBsYXRlcyB7XHJcbiAgcG9wdWxhdGVkTGV0dGVyOiBzdHJpbmc7XHJcbiAgY291cnRJbnN0cnVjdGlvbnM6IHN0cmluZztcclxuICBsZWdhbEFpZENvbnRhY3RzOiBBcnJheTx7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICBwaG9uZT86IHN0cmluZztcclxuICAgIHVybD86IHN0cmluZztcclxuICAgIG5vdGVzPzogc3RyaW5nO1xyXG4gIH0+O1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEV2aWN0aW9uTGVnYWxJbnNpZ2h0cyB7XHJcbiAgbGVnYWxJbnNpZ2h0c01hcmtkb3duOiBzdHJpbmc7XHJcbiAga2V5RGVhZGxpbmVzOiBzdHJpbmdbXTtcclxuICBwb3RlbnRpYWxEZWZlbnNlczogc3RyaW5nW107XHJcbiAgaW1tZWRpYXRlQWN0aW9uczogc3RyaW5nW107XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRXZpY3Rpb25BbmFseXNpc1Jlc3VsdHMge1xyXG4gIGV4dHJhY3RlZE5vdGljZURldGFpbHM6IEV4dHJhY3RlZEV2aWN0aW9uRGV0YWlscztcclxuICBwb3B1bGF0ZWRUZW1wbGF0ZXM6IFBvcHVsYXRlZEV2aWN0aW9uVGVtcGxhdGVzO1xyXG4gIGxlZ2FsSW5zaWdodHM6IEV2aWN0aW9uTGVnYWxJbnNpZ2h0cztcclxuICBkb2N1bWVudFR5cGU6ICdFVklDVElPTl9OT1RJQ0UnO1xyXG59XHJcblxyXG4vLyBUT0RPOiBFdmljdGlvbiBSZXNwb25zZSAtIEFkZCBsZWFzZSBjb250ZXh0IGludGVyZmFjZXMgZm9yIGVuaGFuY2VkIGFuYWx5c2lzXHJcbi8vID09PSBMRUFTRSBDT05URVhUIElOVEVHUkFUSU9OID09PVxyXG5leHBvcnQgaW50ZXJmYWNlIExlYXNlQ29udGV4dERhdGEge1xyXG4gIGFuYWx5c2lzSWQ6IHN0cmluZztcclxuICB1c2VySWQ6IHN0cmluZztcclxuICBsZWFzZUFuYWx5c2lzUmVzdWx0cz86IEFJQW5hbHlzaXNSZXN1bHRzO1xyXG4gIG9yaWdpbmFsTGVhc2VUZXh0Pzogc3RyaW5nO1xyXG4gIHVwbG9hZFRpbWVzdGFtcDogc3RyaW5nO1xyXG4gIGZpbGVOYW1lPzogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEVuaGFuY2VkRXZpY3Rpb25BbmFseXNpc1Jlc3VsdHMgZXh0ZW5kcyBFdmljdGlvbkFuYWx5c2lzUmVzdWx0cyB7XHJcbiAgbGVhc2VDb250ZXh0PzogTGVhc2VDb250ZXh0RGF0YTtcclxuICBsZWFzZUJhc2VkUmVjb21tZW5kYXRpb25zPzogc3RyaW5nW107XHJcbn1cclxuXHJcbi8vIC0tLSBTY2hlbWEgZm9yIHRoZSBmaXJzdCBBSSBjYWxsIChJbml0aWFsIEFuYWx5c2lzKSAtLS1cclxuY29uc3QgaW5pdGlhbEFuYWx5c2lzSnNvblNjaGVtYSA9IHtcclxuICB0eXBlOiBcIm9iamVjdFwiLFxyXG4gIHByb3BlcnRpZXM6IHtcclxuICAgIHN1bW1hcnk6IHsgXHJcbiAgICAgIHR5cGU6IFwic3RyaW5nXCIsIFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJBIGNvbmNpc2Ugb3ZlcmFsbCBzdW1tYXJ5IG9mIHRoZSBsZWFzZSBhZ3JlZW1lbnQsIGhpZ2hsaWdodGluZyBpdHMgbWFpbiBwdXJwb3NlIGFuZCBhbnkgaW1tZWRpYXRlIHN0YW5kb3V0IG9ic2VydmF0aW9ucy5cIlxyXG4gICAgfSxcclxuICAgIG92ZXJhbGxTZXZlcml0eToge1xyXG4gICAgICB0eXBlOiBcInN0cmluZ1wiLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJBbiBvdmVyYWxsIHJpc2sgYXNzZXNzbWVudCBmb3IgdGhlIGxlYXNlLCBjYXRlZ29yaXplZCBhcyAnSGlnaCcsICdNZWRpdW0nLCBvciAnTG93Jy4gVGhpcyBzaG91bGQgYmUgYmFzZWQgb24gdGhlIG51bWJlciBhbmQgc2V2ZXJpdHkgb2YgaWRlbnRpZmllZCBpc3N1ZXMuXCIsXHJcbiAgICAgIGVudW06IFtcIkhpZ2hcIiwgXCJNZWRpdW1cIiwgXCJMb3dcIl1cclxuICAgIH0sXHJcbiAgICBjbGF1c2VzOiB7XHJcbiAgICAgIHR5cGU6IFwiYXJyYXlcIixcclxuICAgICAgZGVzY3JpcHRpb246IFwiQW4gYXJyYXkgb2YgaW1wb3J0YW50IGNsYXVzZXMgZXh0cmFjdGVkIGZyb20gdGhlIGxlYXNlIGRvY3VtZW50LlwiLFxyXG4gICAgICBpdGVtczoge1xyXG4gICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXHJcbiAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgdGl0bGU6IHsgXHJcbiAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsIFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJBIGNsZWFyLCBjb25jaXNlIHRpdGxlIGZvciB0aGUgY2xhdXNlIChlLmcuLCAnUmVudCBQYXltZW50IFRlcm1zJywgJ1N1YmxldHRpbmcgUmVzdHJpY3Rpb25zJywgJ01haW50ZW5hbmNlIFJlc3BvbnNpYmlsaXRpZXMnKS5cIlxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHRleHQ6IHsgXHJcbiAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsIFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJUaGUgdmVyYmF0aW0gdGV4dCBvZiB0aGUgY2xhdXNlIGFzIGl0IGFwcGVhcnMgaW4gdGhlIGxlYXNlIGRvY3VtZW50LlwiXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgaXNzdWVzOiB7XHJcbiAgICAgICAgICAgIHR5cGU6IFwiYXJyYXlcIixcclxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQSBsaXN0IG9mIHBvdGVudGlhbCBpc3N1ZXMsIGNvbmNlcm5zLCBvciBwb2ludHMgb2YgYXR0ZW50aW9uIGlkZW50aWZpZWQgd2l0aGluIHRoaXMgc3BlY2lmaWMgY2xhdXNlLlwiLFxyXG4gICAgICAgICAgICBpdGVtczoge1xyXG4gICAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXHJcbiAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHsgXHJcbiAgICAgICAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsIFxyXG4gICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJBIGNsZWFyIGRlc2NyaXB0aW9uIG9mIHRoZSBwb3RlbnRpYWwgaXNzdWUgb3IgY29uY2Vybi5cIlxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHNldmVyaXR5OiB7XHJcbiAgICAgICAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXHJcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSBzZXZlcml0eSBvZiB0aGlzIHNwZWNpZmljIGlzc3VlLCBjYXRlZ29yaXplZCBhcyAnSGlnaCcsICdNZWRpdW0nLCBvciAnTG93Jy5cIixcclxuICAgICAgICAgICAgICAgICAgZW51bTogW1wiSGlnaFwiLCBcIk1lZGl1bVwiLCBcIkxvd1wiXVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHJlY29tbWVuZGF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgIHR5cGU6IFwic3RyaW5nXCIsXHJcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkEgcHJhY3RpY2FsIHJlY29tbWVuZGF0aW9uIG9yIGFjdGlvbiB0aGUgdXNlciBtaWdodCBjb25zaWRlciByZWdhcmRpbmcgdGhpcyBpc3N1ZSAoZS5nLiwgJ1NlZWsgY2xhcmlmaWNhdGlvbiBmcm9tIGxhbmRsb3JkJywgJ0NvbnN1bHQgYSBsZWdhbCBwcm9mZXNzaW9uYWwnLCAnQmUgYXdhcmUgb2YgdGhpcyBpbXBsaWNhdGlvbicpLlwiXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICByZXF1aXJlZDogW1wiZGVzY3JpcHRpb25cIiwgXCJzZXZlcml0eVwiLCBcInJlY29tbWVuZGF0aW9uXCJdXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbXCJ0aXRsZVwiLCBcInRleHRcIiwgXCJpc3N1ZXNcIl1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcbiAgcmVxdWlyZWQ6IFtcInN1bW1hcnlcIiwgXCJvdmVyYWxsU2V2ZXJpdHlcIiwgXCJjbGF1c2VzXCJdXHJcbn07XHJcblxyXG4vLyAtLS0gU2NoZW1hIGZvciB0aGUgc2Vjb25kIEFJIGNhbGwgKEFjdGlvbmFibGUgSW5zaWdodHMpIC0tLVxyXG5jb25zdCBhY3Rpb25hYmxlSW5zaWdodHNKc29uU2NoZW1hID0ge1xyXG4gIHR5cGU6IFwib2JqZWN0XCIsXHJcbiAgcHJvcGVydGllczoge1xyXG4gICAgYWN0aW9uYWJsZUluc2lnaHRzOiB7XHJcbiAgICAgIHR5cGU6IFwib2JqZWN0XCIsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlByb3ZpZGVzIHNtYXJ0IGFkdmljZSBhbmQgYWN0aW9uYWJsZSBuZXh0IHN0ZXBzIGZvciB0aGUgdXNlciBiYXNlZCBvbiB0aGUgb3ZlcmFsbCBhbmFseXNpcy5cIixcclxuICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgIG92ZXJhbGxSZWNvbW1lbmRhdGlvbjoge1xyXG4gICAgICAgICAgdHlwZTogXCJzdHJpbmdcIixcclxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkEgYnJpZWYgb3ZlcmFsbCByZWNvbW1lbmRhdGlvbiBvciB0YWtlYXdheSBtZXNzYWdlIGZvciB0aGUgdXNlciBiYXNlZCBvbiB0aGUgbGVhc2UgYW5hbHlzaXMuXCJcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5leHRTdGVwczoge1xyXG4gICAgICAgICAgdHlwZTogXCJhcnJheVwiLFxyXG4gICAgICAgICAgZGVzY3JpcHRpb246IFwiQSBsaXN0IG9mIDItNCBjb25jcmV0ZSwgYWN0aW9uYWJsZSBuZXh0IHN0ZXBzIHRoZSB1c2VyIHNob3VsZCBjb25zaWRlci5cIixcclxuICAgICAgICAgIGl0ZW1zOiB7XHJcbiAgICAgICAgICAgIHR5cGU6IFwib2JqZWN0XCIsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICBzdGVwOiB7IHR5cGU6IFwic3RyaW5nXCIsIGRlc2NyaXB0aW9uOiBcIkEgc2luZ2xlIGFjdGlvbmFibGUgc3RlcC5cIiB9LFxyXG4gICAgICAgICAgICAgIGltcG9ydGFuY2U6IHsgXHJcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0cmluZ1wiLCBcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkluZGljYXRlcyB0aGUgaW1wb3J0YW5jZSBvciB1cmdlbmN5IChlLmcuLCAnSGlnaCcsICdNZWRpdW0nLCAnQ29uc2lkZXInKS5cIixcclxuICAgICAgICAgICAgICAgIGVudW06IFtcIkhpZ2hcIiwgXCJNZWRpdW1cIiwgXCJDb25zaWRlclwiXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgZGV0YWlsczogeyB0eXBlOiBcInN0cmluZ1wiLCBkZXNjcmlwdGlvbjogXCIoT3B0aW9uYWwpIEZ1cnRoZXIgZGV0YWlscyBvciByYXRpb25hbGUgZm9yIHRoaXMgc3RlcCwgaWYgbmVjZXNzYXJ5LlwiIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcmVxdWlyZWQ6IFtcInN0ZXBcIiwgXCJpbXBvcnRhbmNlXCJdXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICByZXF1aXJlZDogW1wib3ZlcmFsbFJlY29tbWVuZGF0aW9uXCIsIFwibmV4dFN0ZXBzXCJdXHJcbiAgICB9XHJcbiAgfSxcclxuICByZXF1aXJlZDogW1wiYWN0aW9uYWJsZUluc2lnaHRzXCJdXHJcbn07XHJcblxyXG4vLyBUT0RPOiBFdmljdGlvbiBSZXNwb25zZSAtIEFkZCBldmljdGlvbi1zcGVjaWZpYyBKU09OIHNjaGVtYXMgZm9yIHN0cnVjdHVyZWQgQUkgb3V0cHV0XHJcbi8vID09PSBFVklDVElPTiBQUk9DRVNTSU5HIFNDSEVNQVMgPT09XHJcblxyXG4vLyBTY2hlbWEgZm9yIFZpc2lvbi9QREYgdGV4dCBleHRyYWN0aW9uIG9mIGV2aWN0aW9uIG5vdGljZSBkZXRhaWxzXHJcbmNvbnN0IGV2aWN0aW9uRXh0cmFjdGlvblNjaGVtYSA9IHtcclxuICB0eXBlOiBcIm9iamVjdFwiLFxyXG4gIHByb3BlcnRpZXM6IHtcclxuICAgIGxhbmRsb3JkTmFtZTogeyB0eXBlOiBcInN0cmluZ1wiLCBkZXNjcmlwdGlvbjogXCJOYW1lIG9mIHRoZSBsYW5kbG9yZCBvciBwcm9wZXJ0eSBtYW5hZ2VtZW50IGNvbXBhbnlcIiB9LFxyXG4gICAgdGVuYW50TmFtZTogeyB0eXBlOiBcInN0cmluZ1wiLCBkZXNjcmlwdGlvbjogXCJOYW1lIG9mIHRoZSB0ZW5hbnQocykgaWYgdmlzaWJsZSBvbiB0aGUgbm90aWNlXCIgfSxcclxuICAgIG5vdGljZURhdGU6IHsgXHJcbiAgICAgIHR5cGU6IFwic3RyaW5nXCIsIFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJEYXRlIHRoZSBub3RpY2Ugd2FzIGlzc3VlZCAoWVlZWS1NTS1ERCBmb3JtYXQpXCIsXHJcbiAgICAgIHBhdHRlcm46IFwiXlxcXFxkezR9LVxcXFxkezJ9LVxcXFxkezJ9JFwiXHJcbiAgICB9LFxyXG4gICAgZGVhZGxpbmVEYXRlOiB7IFxyXG4gICAgICB0eXBlOiBcInN0cmluZ1wiLCBcclxuICAgICAgZGVzY3JpcHRpb246IFwiRGVhZGxpbmUgZGF0ZSBmb3IgdGVuYW50IHJlc3BvbnNlIG9yIGFjdGlvbiAoWVlZWS1NTS1ERCBmb3JtYXQpXCIsXHJcbiAgICAgIHBhdHRlcm46IFwiXlxcXFxkezR9LVxcXFxkezJ9LVxcXFxkezJ9JFwiXHJcbiAgICB9LFxyXG4gICAgZGV0ZWN0ZWRTdGF0ZTogeyB0eXBlOiBcInN0cmluZ1wiLCBkZXNjcmlwdGlvbjogXCJTdGF0ZSBkZXRlY3RlZCBmcm9tIHRoZSBub3RpY2UgKGUuZy4sICdDQScsICdDYWxpZm9ybmlhJylcIiB9LFxyXG4gICAgZGV0ZWN0ZWRDb3VudHk6IHsgdHlwZTogXCJzdHJpbmdcIiwgZGVzY3JpcHRpb246IFwiQ291bnR5IGRldGVjdGVkIGZyb20gdGhlIG5vdGljZSBpZiB2aXNpYmxlXCIgfSxcclxuICAgIGV2aWN0aW9uUmVhc29uU3VtbWFyeTogeyBcclxuICAgICAgdHlwZTogXCJzdHJpbmdcIiwgXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkJyaWVmIHN1bW1hcnkgb2YgdGhlIHN0YXRlZCByZWFzb24gZm9yIGV2aWN0aW9uIChlLmcuLCAnbm9uLXBheW1lbnQgb2YgcmVudCcsICdsZWFzZSB2aW9sYXRpb24nKVwiIFxyXG4gICAgfSxcclxuICAgIHNwZWNpZmljQ2xhdXNlc0NpdGVkOiB7XHJcbiAgICAgIHR5cGU6IFwiYXJyYXlcIixcclxuICAgICAgaXRlbXM6IHsgdHlwZTogXCJzdHJpbmdcIiB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJBbnkgc3BlY2lmaWMgbGVhc2UgY2xhdXNlcyBvciBsZWdhbCBjb2RlcyBtZW50aW9uZWQgaW4gdGhlIG5vdGljZVwiXHJcbiAgICB9LFxyXG4gICAgcmVudEFtb3VudER1ZTogeyB0eXBlOiBcInN0cmluZ1wiLCBkZXNjcmlwdGlvbjogXCJBbW91bnQgb2YgcmVudCBkdWUgaWYgdGhpcyBpcyBhIG5vbi1wYXltZW50IG5vdGljZVwiIH0sXHJcbiAgICBsZWFzZUVuZERhdGVNZW50aW9uZWQ6IHsgdHlwZTogXCJzdHJpbmdcIiwgZGVzY3JpcHRpb246IFwiTGVhc2UgZW5kIGRhdGUgaWYgbWVudGlvbmVkIGluIHRoZSBub3RpY2VcIiB9LFxyXG4gICAgZnVsbEV4dHJhY3RlZFRleHQ6IHsgXHJcbiAgICAgIHR5cGU6IFwic3RyaW5nXCIsIFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb21wbGV0ZSB0ZXh0IGV4dHJhY3RlZCBmcm9tIHRoZSBldmljdGlvbiBub3RpY2VcIiBcclxuICAgIH1cclxuICB9LFxyXG4gIHJlcXVpcmVkOiBbXCJmdWxsRXh0cmFjdGVkVGV4dFwiXVxyXG59O1xyXG5cclxuLy8gU2NoZW1hIGZvciBsZWdhbCBpbnNpZ2h0cyBnZW5lcmF0aW9uXHJcbmNvbnN0IGV2aWN0aW9uTGVnYWxJbnNpZ2h0c1NjaGVtYSA9IHtcclxuICB0eXBlOiBcIm9iamVjdFwiLFxyXG4gIHByb3BlcnRpZXM6IHtcclxuICAgIGxlZ2FsSW5zaWdodHNNYXJrZG93bjoge1xyXG4gICAgICB0eXBlOiBcInN0cmluZ1wiLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb21wcmVoZW5zaXZlIGxlZ2FsIGluc2lnaHRzIGluIE1hcmtkb3duIGZvcm1hdCBjb3ZlcmluZyB0ZW5hbnQgcmlnaHRzLCBkZWFkbGluZXMsIGFuZCBkZWZlbnNlIHN0cmF0ZWdpZXNcIlxyXG4gICAgfSxcclxuICAgIGtleURlYWRsaW5lczoge1xyXG4gICAgICB0eXBlOiBcImFycmF5XCIsXHJcbiAgICAgIGl0ZW1zOiB7IHR5cGU6IFwic3RyaW5nXCIgfSxcclxuICAgICAgZGVzY3JpcHRpb246IFwiTGlzdCBvZiBjcml0aWNhbCBkZWFkbGluZXMgdGhlIHRlbmFudCBtdXN0IGJlIGF3YXJlIG9mXCJcclxuICAgIH0sXHJcbiAgICBwb3RlbnRpYWxEZWZlbnNlczoge1xyXG4gICAgICB0eXBlOiBcImFycmF5XCIsIFxyXG4gICAgICBpdGVtczogeyB0eXBlOiBcInN0cmluZ1wiIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBvdGVudGlhbCBsZWdhbCBkZWZlbnNlcyBvciBjaGFsbGVuZ2VzIHRoZSB0ZW5hbnQgbWlnaHQgcmFpc2VcIlxyXG4gICAgfSxcclxuICAgIGltbWVkaWF0ZUFjdGlvbnM6IHtcclxuICAgICAgdHlwZTogXCJhcnJheVwiLFxyXG4gICAgICBpdGVtczogeyB0eXBlOiBcInN0cmluZ1wiIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkltbWVkaWF0ZSBhY3Rpb25zIHRoZSB0ZW5hbnQgc2hvdWxkIHRha2UgKDItNCBpdGVtcylcIlxyXG4gICAgfVxyXG4gIH0sXHJcbiAgcmVxdWlyZWQ6IFtcImxlZ2FsSW5zaWdodHNNYXJrZG93blwiLCBcImtleURlYWRsaW5lc1wiLCBcImltbWVkaWF0ZUFjdGlvbnNcIl1cclxufTtcclxuXHJcbi8vIC0tLSBDb3JlIEFJIFByb2Nlc3NpbmcgRnVuY3Rpb24gKGNvcGllZCBhbmQgYWRhcHRlZCBmcm9tIGxlYXNlQW5hbHlzaXNMb2dpYy50cykgLS0tXHJcbmFzeW5jIGZ1bmN0aW9uIHBlcmZvcm1BaUxlYXNlQW5hbHlzaXNJbnRlcm5hbChcclxuICBleHRyYWN0ZWRUZXh0OiBzdHJpbmcsXHJcbiAgdXNlclNlbGVjdGVkU3RhdGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgLy8gQ2FuIGJlIHVuZGVmaW5lZCBpZiBub3QgcHJlc2VudFxyXG4gIG9wZW5haUNsaWVudDogT3BlbkFJXHJcbik6IFByb21pc2U8eyBpbml0aWFsQW5hbHlzaXNSZXN1bHRzOiBJbml0aWFsQW5hbHlzaXNSZXN1bHRzOyBhY3Rpb25hYmxlSW5zaWdodHNEYXRhOiBBY3Rpb25hYmxlSW5zaWdodHNEYXRhIH0+IHtcclxuICBsZXQgaW5pdGlhbEFuYWx5c2lzUmVzdWx0czogSW5pdGlhbEFuYWx5c2lzUmVzdWx0cztcclxuICBsZXQgYWN0aW9uYWJsZUluc2lnaHRzRGF0YTogQWN0aW9uYWJsZUluc2lnaHRzRGF0YTtcclxuICBjb25zdCBzdGF0ZUZvclByb21wdCA9IHVzZXJTZWxlY3RlZFN0YXRlIHx8ICdnZW5lcmFsJzsgLy8gRmFsbGJhY2sgaWYgc3RhdGUgaXMgbm90IHByb3ZpZGVkXHJcblxyXG4gIC8vIEluaXRpYWxpemUgUHJvbXB0TWFuYWdlciB0byBsb2FkIGR5bmFtaWMgcHJvbXB0c1xyXG4gIGNvbnN0IHByb21wdE1hbmFnZXIgPSBuZXcgUHJvbXB0TWFuYWdlcigpO1xyXG4gIGxldCBwcm9tcHRDb25maWc7XHJcbiAgXHJcbiAgdHJ5IHtcclxuICAgIHByb21wdENvbmZpZyA9IGF3YWl0IHByb21wdE1hbmFnZXIuZ2V0TGVhc2VBbmFseXNpc0NvbmZpZygpO1xyXG4gICAgY29uc29sZS5sb2coJyhBSSBMYW1iZGEpIFN1Y2Nlc3NmdWxseSBsb2FkZWQgZHluYW1pYyBwcm9tcHRzIGZyb20gZXh0ZXJuYWwgc291cmNlcy4nKTtcclxuICB9IGNhdGNoIChwcm9tcHRFcnJvcikge1xyXG4gICAgY29uc29sZS53YXJuKCcoQUkgTGFtYmRhKSBGYWlsZWQgdG8gbG9hZCBkeW5hbWljIHByb21wdHMsIHVzaW5nIGRlZmF1bHRzOicsIHByb21wdEVycm9yKTtcclxuICAgIC8vIEZhbGxiYWNrIHRvIGhhcmRjb2RlZCBwcm9tcHRzIGlmIGV4dGVybmFsIHNvdXJjZXMgZmFpbFxyXG4gICAgcHJvbXB0Q29uZmlnID0ge1xyXG4gICAgICBtb2RlbDogcHJvY2Vzcy5lbnYuT1BFTkFJX01PREVMIHx8ICdncHQtNG8nLFxyXG4gICAgICB0ZW1wZXJhdHVyZTogMC4yLFxyXG4gICAgICBtYXhUb2tlbnM6IDQwMDAsXHJcbiAgICAgIHN5c3RlbVByb21wdDogYFlvdSBhcmUgYSBsZWdhbCBhc3Npc3RhbnQgc3BlY2lhbGl6aW5nIGluICR7c3RhdGVGb3JQcm9tcHR9IGxlYXNlIGFncmVlbWVudHMuIEFuYWx5emUgdGhlIGxlYXNlIHRleHQuYCxcclxuICAgICAgdXNlclByb21wdFRlbXBsYXRlOiBgTGVhc2UgdGV4dDoge2xlYXNlVGV4dH1gXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLy8gPT09IFBIQVNFIDE6IEluaXRpYWwgTGVhc2UgQW5hbHlzaXMgPT09XHJcbiAgdHJ5IHtcclxuICAgIC8vIEZvcm1hdCB0aGUgc3lzdGVtIHByb21wdCB0byBpbmNsdWRlIHNjaGVtYSBhbmQgc3RhdGUtc3BlY2lmaWMgY29udGV4dFxyXG4gICAgY29uc3Qgc3lzdGVtTWVzc2FnZUluaXRpYWwgPSBgJHtwcm9tcHRDb25maWcuc3lzdGVtUHJvbXB0fSBcclxuICAgIFxyXG5SZXNwb25kIE9OTFkgd2l0aCBhIHZhbGlkIEpTT04gb2JqZWN0IGFkaGVyaW5nIHRvIHRoaXMgc2NoZW1hOiAke0pTT04uc3RyaW5naWZ5KGluaXRpYWxBbmFseXNpc0pzb25TY2hlbWEsIG51bGwsIDIpfWA7XHJcblxyXG4gICAgLy8gRm9ybWF0IHRoZSB1c2VyIHByb21wdCB3aXRoIHZhcmlhYmxlc1xyXG4gICAgY29uc3QgdXNlck1lc3NhZ2VJbml0aWFsID0gcHJvbXB0TWFuYWdlci5mb3JtYXRVc2VyUHJvbXB0KHByb21wdENvbmZpZy51c2VyUHJvbXB0VGVtcGxhdGUsIHtcclxuICAgICAgbGVhc2VUZXh0OiBleHRyYWN0ZWRUZXh0LFxyXG4gICAgICB1c2VyU2VsZWN0ZWRTdGF0ZTogc3RhdGVGb3JQcm9tcHRcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZygnKEFJIExhbWJkYSkgQ2FsbGluZyBPcGVuQUkgZm9yIGluaXRpYWwgYW5hbHlzaXMuLi4nKTtcclxuICAgIGNvbnN0IHJlc3BvbnNlSW5pdGlhbCA9IGF3YWl0IG9wZW5haUNsaWVudC5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7XHJcbiAgICAgIG1vZGVsOiBwcm9tcHRDb25maWcubW9kZWwsXHJcbiAgICAgIG1lc3NhZ2VzOiBbeyByb2xlOiBcInN5c3RlbVwiLCBjb250ZW50OiBzeXN0ZW1NZXNzYWdlSW5pdGlhbCB9LCB7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiB1c2VyTWVzc2FnZUluaXRpYWwgfV0sXHJcbiAgICAgIHJlc3BvbnNlX2Zvcm1hdDogeyB0eXBlOiBcImpzb25fb2JqZWN0XCIgfSxcclxuICAgICAgdGVtcGVyYXR1cmU6IHByb21wdENvbmZpZy50ZW1wZXJhdHVyZSxcclxuICAgICAgbWF4X3Rva2VuczogcHJvbXB0Q29uZmlnLm1heFRva2VucyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJhd0NvbnRlbnRJbml0aWFsID0gcmVzcG9uc2VJbml0aWFsLmNob2ljZXNbMF0/Lm1lc3NhZ2U/LmNvbnRlbnQ7XHJcbiAgICBpZiAoIXJhd0NvbnRlbnRJbml0aWFsKSB0aHJvdyBuZXcgRXJyb3IoJ0luaXRpYWwgYW5hbHlzaXM6IE5vIGNvbnRlbnQgZnJvbSBBSS4nKTtcclxuICAgIGluaXRpYWxBbmFseXNpc1Jlc3VsdHMgPSBKU09OLnBhcnNlKHJhd0NvbnRlbnRJbml0aWFsKSBhcyBJbml0aWFsQW5hbHlzaXNSZXN1bHRzO1xyXG4gICAgY29uc29sZS5sb2coJyhBSSBMYW1iZGEpIEluaXRpYWwgYW5hbHlzaXMgc3VjY2Vzc2Z1bC4nKTtcclxuXHJcbiAgfSBjYXRjaCAoYWlFcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignKEFJIExhbWJkYSkgRXJyb3IgZHVyaW5nIGluaXRpYWwgQUkgYW5hbHlzaXM6JywgYWlFcnJvcik7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEluaXRpYWwgQUkgQW5hbHlzaXMgRmFpbGVkOiAke2FpRXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGFpRXJyb3IubWVzc2FnZSA6IFN0cmluZyhhaUVycm9yKX1gKTtcclxuICB9XHJcblxyXG4gIC8vID09PSBQSEFTRSAyOiBHZW5lcmF0ZSBBY3Rpb25hYmxlIEluc2lnaHRzID09PVxyXG4gIHRyeSB7XHJcbiAgICBsZXQgY29udGV4dEZvckluc2lnaHRzID0gYFN1bW1hcnk6ICR7aW5pdGlhbEFuYWx5c2lzUmVzdWx0cy5zdW1tYXJ5fS4gT3ZlcmFsbCBTZXZlcml0eTogJHtpbml0aWFsQW5hbHlzaXNSZXN1bHRzLm92ZXJhbGxTZXZlcml0eX0uYDtcclxuICAgIGNvbnN0IGhpZ2hTZXZlcml0eUlzc3VlcyA9IGluaXRpYWxBbmFseXNpc1Jlc3VsdHMuY2xhdXNlc1xyXG4gICAgICAuZmxhdE1hcCgoYzogQ2xhdXNlKSA9PiBjLmlzc3VlcylcclxuICAgICAgLmZpbHRlcigoaTogSXNzdWUpID0+IGkuc2V2ZXJpdHkgPT09ICdIaWdoJylcclxuICAgICAgLm1hcCgoaTogSXNzdWUpID0+IGkuZGVzY3JpcHRpb24pO1xyXG4gICAgaWYgKGhpZ2hTZXZlcml0eUlzc3Vlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnRleHRGb3JJbnNpZ2h0cyArPSBgIEtleSBoaWdoLXNldmVyaXR5IGlzc3VlcyBpbmNsdWRlOiAke2hpZ2hTZXZlcml0eUlzc3Vlcy5qb2luKCc7ICcpfWA7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc3lzdGVtTWVzc2FnZUluc2lnaHRzID0gYEJhc2VkIG9uIHRoZSBmb2xsb3dpbmcgbGVhc2UgYW5hbHlzaXMgY29udGV4dCBmb3IgYSAke3N0YXRlRm9yUHJvbXB0fSBsZWFzZSwgcHJvdmlkZSBhY3Rpb25hYmxlIG5leHQgc3RlcHMgZm9yIHRoZSB1c2VyLiBSZXNwb25kIE9OTFkgd2l0aCBhIHZhbGlkIEpTT04gb2JqZWN0IGFkaGVyaW5nIHRvIHRoaXMgc2NoZW1hOiAke0pTT04uc3RyaW5naWZ5KGFjdGlvbmFibGVJbnNpZ2h0c0pzb25TY2hlbWEsIG51bGwsIDIpfWA7XHJcbiAgICBjb25zdCB1c2VyTWVzc2FnZUluc2lnaHRzID0gYENvbnRleHQ6ICR7Y29udGV4dEZvckluc2lnaHRzLnN1YnN0cmluZygwLCAzNTAwKX0gUGxlYXNlIHByb3ZpZGUgYWN0aW9uYWJsZSBpbnNpZ2h0cy5gO1xyXG5cclxuICAgIGNvbnNvbGUubG9nKCcoQUkgTGFtYmRhKSBDYWxsaW5nIE9wZW5BSSBmb3IgYWN0aW9uYWJsZSBpbnNpZ2h0cy4uLicpO1xyXG4gICAgY29uc3QgcmVzcG9uc2VJbnNpZ2h0cyA9IGF3YWl0IG9wZW5haUNsaWVudC5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7XHJcbiAgICAgIG1vZGVsOiBwcm9jZXNzLmVudi5PUEVOQUlfTU9ERUwgfHwgXCJncHQtNG9cIiwgLy8gVXNlIGVudmlyb25tZW50IHZhcmlhYmxlIGZvciBtb2RlbFxyXG4gICAgICBtZXNzYWdlczogW3sgcm9sZTogXCJzeXN0ZW1cIiwgY29udGVudDogc3lzdGVtTWVzc2FnZUluc2lnaHRzIH0sIHsgcm9sZTogXCJ1c2VyXCIsIGNvbnRlbnQ6IHVzZXJNZXNzYWdlSW5zaWdodHMgfV0sXHJcbiAgICAgIHJlc3BvbnNlX2Zvcm1hdDogeyB0eXBlOiBcImpzb25fb2JqZWN0XCIgfSxcclxuICAgICAgdGVtcGVyYXR1cmU6IDAuNSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJhd0NvbnRlbnRJbnNpZ2h0cyA9IHJlc3BvbnNlSW5zaWdodHMuY2hvaWNlc1swXT8ubWVzc2FnZT8uY29udGVudDtcclxuICAgIGlmICghcmF3Q29udGVudEluc2lnaHRzKSB0aHJvdyBuZXcgRXJyb3IoJ0FjdGlvbmFibGUgaW5zaWdodHM6IE5vIGNvbnRlbnQgZnJvbSBBSS4nKTtcclxuICAgIGFjdGlvbmFibGVJbnNpZ2h0c0RhdGEgPSBKU09OLnBhcnNlKHJhd0NvbnRlbnRJbnNpZ2h0cykgYXMgQWN0aW9uYWJsZUluc2lnaHRzRGF0YTtcclxuICAgIGNvbnNvbGUubG9nKCcoQUkgTGFtYmRhKSBBY3Rpb25hYmxlIGluc2lnaHRzIGdlbmVyYXRpb24gc3VjY2Vzc2Z1bC4nKTtcclxuXHJcbiAgfSBjYXRjaCAoYWlFcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignKEFJIExhbWJkYSkgRXJyb3IgZHVyaW5nIGFjdGlvbmFibGUgaW5zaWdodHMgZ2VuZXJhdGlvbjonLCBhaUVycm9yKTtcclxuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKGBBY3Rpb25hYmxlIEluc2lnaHRzIEdlbmVyYXRpb24gRmFpbGVkOiAke2FpRXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGFpRXJyb3IubWVzc2FnZSA6IFN0cmluZyhhaUVycm9yKX1gKTtcclxuICAgIChlcnJvciBhcyBhbnkpLnBhcnRpYWxSZXN1bHRzID0gaW5pdGlhbEFuYWx5c2lzUmVzdWx0czsgLy8gQXR0YWNoIHBhcnRpYWwgcmVzdWx0c1xyXG4gICAgdGhyb3cgZXJyb3I7XHJcbiAgfVxyXG5cclxuICByZXR1cm4geyBpbml0aWFsQW5hbHlzaXNSZXN1bHRzLCBhY3Rpb25hYmxlSW5zaWdodHNEYXRhIH07XHJcbn1cclxuXHJcbi8vIFRPRE86IEV2aWN0aW9uIFJlc3BvbnNlIC0gQWRkIGNvcmUgZXZpY3Rpb24gcHJvY2Vzc2luZyBmdW5jdGlvblxyXG4vLyA9PT0gRVZJQ1RJT04gUFJPQ0VTU0lORyBGVU5DVElPTiA9PT1cclxuYXN5bmMgZnVuY3Rpb24gcGVyZm9ybUV2aWN0aW9uQW5hbHlzaXNJbnRlcm5hbChcclxuICBleHRyYWN0ZWRUZXh0OiBzdHJpbmcsXHJcbiAgdXNlclNlbGVjdGVkU3RhdGU6IHN0cmluZyB8IHVuZGVmaW5lZCxcclxuICB1c2VyRm9ybURhdGE6IGFueSwgLy8gT3B0aW9uYWwgdXNlci1wcm92aWRlZCBtZXRhZGF0YVxyXG4gIGlzSW1hZ2VVcGxvYWQ6IGJvb2xlYW4sIC8vIHRydWUgZm9yIGltYWdlcywgZmFsc2UgZm9yIFBERnNcclxuICBvcGVuYWlDbGllbnQ6IE9wZW5BSSxcclxuICBsZWFzZUNvbnRleHQ/OiBMZWFzZUNvbnRleHREYXRhIC8vIFRPRE86IExlYXNlIGNvbnRleHQgZm9yIGVuaGFuY2VkIGFuYWx5c2lzXHJcbik6IFByb21pc2U8RW5oYW5jZWRFdmljdGlvbkFuYWx5c2lzUmVzdWx0cz4ge1xyXG4gIFxyXG4gIGNvbnN0IHByb21wdE1hbmFnZXIgPSBuZXcgUHJvbXB0TWFuYWdlcigpO1xyXG4gIGNvbnN0IHN0YXRlRm9yUHJvbXB0ID0gdXNlclNlbGVjdGVkU3RhdGUgfHwgdXNlckZvcm1EYXRhPy5zdGF0ZSB8fCAnZ2VuZXJhbCc7XHJcbiAgXHJcbiAgLy8gSW5pdGlhbGl6ZSB2YXJpYWJsZXMgZm9yIGZpbmFsIHJlc3VsdHNcclxuICBsZXQgbGVhc2VCYXNlZFJlY29tbWVuZGF0aW9uczogc3RyaW5nW10gPSBbXTtcclxuICBcclxuICAvLyA9PT0gUEhBU0UgMTogRXh0cmFjdCBTdHJ1Y3R1cmVkIERhdGEgZnJvbSBOb3RpY2UgPT09XHJcbiAgbGV0IGV4dHJhY3RlZERldGFpbHM6IEV4dHJhY3RlZEV2aWN0aW9uRGV0YWlscztcclxuICBcclxuICB0cnkge1xyXG4gICAgY29uc29sZS5sb2coYChBSSBMYW1iZGEpIEV4dHJhY3RpbmcgZXZpY3Rpb24gbm90aWNlIGRldGFpbHMgZm9yICR7aXNJbWFnZVVwbG9hZCA/ICdpbWFnZScgOiAnUERGIHRleHQnfS4uLmApO1xyXG4gICAgXHJcbiAgICBjb25zdCBleHRyYWN0aW9uUHJvbXB0ID0gYXdhaXQgcHJvbXB0TWFuYWdlci5nZXRFdmljdGlvbkV4dHJhY3Rpb25Qcm9tcHQoaXNJbWFnZVVwbG9hZCk7XHJcbiAgICBjb25zdCBzeXN0ZW1NZXNzYWdlID0gYCR7ZXh0cmFjdGlvblByb21wdC5zeXN0ZW1Qcm9tcHR9XHJcbiAgICBcclxuUmVzcG9uZCBPTkxZIHdpdGggYSB2YWxpZCBKU09OIG9iamVjdCBhZGhlcmluZyB0byB0aGlzIHNjaGVtYTogJHtKU09OLnN0cmluZ2lmeShldmljdGlvbkV4dHJhY3Rpb25TY2hlbWEsIG51bGwsIDIpfWA7XHJcblxyXG4gICAgbGV0IG1lc3NhZ2VzOiBhbnlbXTtcclxuICAgIFxyXG4gICAgaWYgKGlzSW1hZ2VVcGxvYWQpIHtcclxuICAgICAgLy8gRm9yIFZpc2lvbiBBUEkgKGltYWdlcylcclxuICAgICAgbWVzc2FnZXMgPSBbXHJcbiAgICAgICAgeyByb2xlOiBcInN5c3RlbVwiLCBjb250ZW50OiBzeXN0ZW1NZXNzYWdlIH0sXHJcbiAgICAgICAgeyBcclxuICAgICAgICAgIHJvbGU6IFwidXNlclwiLCBcclxuICAgICAgICAgIGNvbnRlbnQ6IFtcclxuICAgICAgICAgICAgeyB0eXBlOiBcInRleHRcIiwgdGV4dDogXCJFeHRyYWN0IGV2aWN0aW9uIG5vdGljZSBkZXRhaWxzIGZyb20gdGhpcyBpbWFnZTpcIiB9LFxyXG4gICAgICAgICAgICB7IHR5cGU6IFwiaW1hZ2VfdXJsXCIsIGltYWdlX3VybDogeyB1cmw6IGBkYXRhOmltYWdlL2pwZWc7YmFzZTY0LCR7ZXh0cmFjdGVkVGV4dH1gIH0gfVxyXG4gICAgICAgICAgXVxyXG4gICAgICAgIH1cclxuICAgICAgXTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIEZvciBQREYgdGV4dCBwcm9jZXNzaW5nXHJcbiAgICAgIGNvbnN0IHVzZXJNZXNzYWdlID0gcHJvbXB0TWFuYWdlci5mb3JtYXRVc2VyUHJvbXB0KGV4dHJhY3Rpb25Qcm9tcHQudXNlclByb21wdFRlbXBsYXRlLCB7XHJcbiAgICAgICAgbm90aWNlVGV4dDogZXh0cmFjdGVkVGV4dCxcclxuICAgICAgICB1c2VyU2VsZWN0ZWRTdGF0ZTogc3RhdGVGb3JQcm9tcHRcclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICBtZXNzYWdlcyA9IFtcclxuICAgICAgICB7IHJvbGU6IFwic3lzdGVtXCIsIGNvbnRlbnQ6IHN5c3RlbU1lc3NhZ2UgfSxcclxuICAgICAgICB7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiB1c2VyTWVzc2FnZSB9XHJcbiAgICAgIF07XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZXh0cmFjdGlvblJlc3BvbnNlID0gYXdhaXQgb3BlbmFpQ2xpZW50LmNoYXQuY29tcGxldGlvbnMuY3JlYXRlKHtcclxuICAgICAgbW9kZWw6IGlzSW1hZ2VVcGxvYWQgPyAnZ3B0LTRvJyA6ICdncHQtNG8nLCAvLyBVc2UgVmlzaW9uIG1vZGVsIGZvciBpbWFnZXNcclxuICAgICAgbWVzc2FnZXMsXHJcbiAgICAgIHJlc3BvbnNlX2Zvcm1hdDogeyB0eXBlOiBcImpzb25fb2JqZWN0XCIgfSxcclxuICAgICAgdGVtcGVyYXR1cmU6IDAuMSxcclxuICAgICAgbWF4X3Rva2VuczogMjAwMCxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJhd0V4dHJhY3Rpb24gPSBleHRyYWN0aW9uUmVzcG9uc2UuY2hvaWNlc1swXT8ubWVzc2FnZT8uY29udGVudDtcclxuICAgIGlmICghcmF3RXh0cmFjdGlvbikgdGhyb3cgbmV3IEVycm9yKCdObyBleHRyYWN0aW9uIGNvbnRlbnQgZnJvbSBBSS4nKTtcclxuICAgIFxyXG4gICAgZXh0cmFjdGVkRGV0YWlscyA9IEpTT04ucGFyc2UocmF3RXh0cmFjdGlvbikgYXMgRXh0cmFjdGVkRXZpY3Rpb25EZXRhaWxzO1xyXG4gICAgXHJcbiAgICAvLyBNZXJnZSB3aXRoIHVzZXItcHJvdmlkZWQgZm9ybSBkYXRhICh1c2VyIGRhdGEgdGFrZXMgcHJlY2VkZW5jZSlcclxuICAgIGlmICh1c2VyRm9ybURhdGEpIHtcclxuICAgICAgZXh0cmFjdGVkRGV0YWlscyA9IHtcclxuICAgICAgICAuLi5leHRyYWN0ZWREZXRhaWxzLFxyXG4gICAgICAgIC4uLk9iamVjdC5mcm9tRW50cmllcyhcclxuICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHVzZXJGb3JtRGF0YSkuZmlsdGVyKChbXywgdmFsdWVdKSA9PiB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSAnJylcclxuICAgICAgICApXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKCcoQUkgTGFtYmRhKSBFdmljdGlvbiBkZXRhaWxzIGV4dHJhY3Rpb24gc3VjY2Vzc2Z1bC4nKTtcclxuXHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoJyhBSSBMYW1iZGEpIEVycm9yIGR1cmluZyBldmljdGlvbiBkZXRhaWxzIGV4dHJhY3Rpb246JywgZXJyb3IpO1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBFdmljdGlvbiBEZXRhaWxzIEV4dHJhY3Rpb24gRmFpbGVkOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gKTtcclxuICB9XHJcblxyXG4gIC8vID09PSBQSEFTRSAyOiBHZW5lcmF0ZSBMZWdhbCBJbnNpZ2h0cyB3aXRoIFJBRyA9PT1cclxuICBsZXQgbGVnYWxJbnNpZ2h0czogRXZpY3Rpb25MZWdhbEluc2lnaHRzO1xyXG4gIFxyXG4gIHRyeSB7XHJcbiAgICBjb25zb2xlLmxvZygnKEFJIExhbWJkYSkgR2VuZXJhdGluZyBsZWdhbCBpbnNpZ2h0cyB3aXRoIFJBRy4uLicpO1xyXG4gICAgXHJcbiAgICBjb25zdCBhbmFseXNpc1Byb21wdCA9IGF3YWl0IHByb21wdE1hbmFnZXIuZ2V0RXZpY3Rpb25BbmFseXNpc1Byb21wdCgpO1xyXG4gICAgXHJcbiAgICAvLyBUT0RPOiBBZGQgUkFHIHJldHJpZXZhbCBoZXJlIC0gcXVlcnkgdmVjdG9yIGRhdGFiYXNlIGJhc2VkIG9uOlxyXG4gICAgLy8gLSBleHRyYWN0ZWREZXRhaWxzLmRldGVjdGVkU3RhdGUgfHwgc3RhdGVGb3JQcm9tcHRcclxuICAgIC8vIC0gZXh0cmFjdGVkRGV0YWlscy5ldmljdGlvblJlYXNvblN1bW1hcnlcclxuICAgIC8vIC0gZXh0cmFjdGVkRGV0YWlscy5mdWxsRXh0cmFjdGVkVGV4dCAoZm9yIHNlbWFudGljIHNpbWlsYXJpdHkpXHJcbiAgICBjb25zdCByYWdDb250ZXh0ID0gXCJcIjsgLy8gUGxhY2Vob2xkZXIgZm9yIFJBRyByZXRyaWV2ZWQgY29udGV4dFxyXG4gICAgXHJcbiAgICAvLyBUT0RPOiBMZWFzZSBDb250ZXh0IEludGVncmF0aW9uIC0gRW5oYW5jZSBhbmFseXNpcyB3aXRoIGxlYXNlIGRhdGFcclxuICAgIGxldCBsZWFzZUNvbnRleHRQcm9tcHQgPSAnJztcclxuICAgIFxyXG4gICAgaWYgKGxlYXNlQ29udGV4dD8ubGVhc2VBbmFseXNpc1Jlc3VsdHMpIHtcclxuICAgICAgY29uc29sZS5sb2coJyhBSSBMYW1iZGEpIEluY29ycG9yYXRpbmcgbGVhc2UgY29udGV4dCBpbnRvIGV2aWN0aW9uIGFuYWx5c2lzLi4uJyk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBFeHRyYWN0IGtleSBsZWFzZSBpbmZvcm1hdGlvbiBmb3IgY29udGV4dFxyXG4gICAgICBjb25zdCBsZWFzZUluZm8gPSBsZWFzZUNvbnRleHQubGVhc2VBbmFseXNpc1Jlc3VsdHM7XHJcbiAgICAgIGNvbnN0IGhpZ2hSaXNrQ2xhdXNlcyA9IGxlYXNlSW5mby5jbGF1c2VzXHJcbiAgICAgICAgPy5maWx0ZXIoY2xhdXNlID0+IGNsYXVzZS5pc3N1ZXMuc29tZShpc3N1ZSA9PiBpc3N1ZS5zZXZlcml0eSA9PT0gJ0hpZ2gnKSlcclxuICAgICAgICAubWFwKGNsYXVzZSA9PiBgJHtjbGF1c2UudGl0bGV9OiAke2NsYXVzZS5pc3N1ZXMubWFwKGkgPT4gaS5kZXNjcmlwdGlvbikuam9pbignOyAnKX1gKVxyXG4gICAgICAgIC5qb2luKCdcXG4nKSB8fCAnJztcclxuICAgICAgXHJcbiAgICAgIGxlYXNlQ29udGV4dFByb21wdCA9IGBcclxuICAgICAgXHJcbklNUE9SVEFOVCBMRUFTRSBDT05URVhUOlxyXG4tIExlYXNlIEFuYWx5c2lzIFN1bW1hcnk6ICR7bGVhc2VJbmZvLnN1bW1hcnkgfHwgJ04vQSd9XHJcbi0gT3ZlcmFsbCBMZWFzZSBSaXNrIExldmVsOiAke2xlYXNlSW5mby5vdmVyYWxsU2V2ZXJpdHkgfHwgJ04vQSd9XHJcbi0gSGlnaC1SaXNrIExlYXNlIENsYXVzZXM6ICR7aGlnaFJpc2tDbGF1c2VzIHx8ICdOb25lIGlkZW50aWZpZWQnfVxyXG4tIFByZXZpb3VzIExlYXNlIFJlY29tbWVuZGF0aW9uczogJHtsZWFzZUluZm8uYWN0aW9uYWJsZUluc2lnaHRzPy5vdmVyYWxsUmVjb21tZW5kYXRpb24gfHwgJ04vQSd9XHJcblxyXG5Vc2UgdGhpcyBsZWFzZSBjb250ZXh0IHRvIGlkZW50aWZ5IGlmIHRoZSBldmljdGlvbiBub3RpY2UgcmVsYXRlcyB0byBhbnkgb2YgdGhlc2UgcHJldmlvdXNseSBpZGVudGlmaWVkIGxlYXNlIGlzc3Vlcy5gO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc29sZS5sb2coJyhBSSBMYW1iZGEpIE5vIGxlYXNlIGNvbnRleHQgYXZhaWxhYmxlIC0gcHJvY2VlZGluZyB3aXRoIG5vdGljZS1vbmx5IGFuYWx5c2lzLi4uJyk7XHJcbiAgICAgIGxlYXNlQ29udGV4dFByb21wdCA9ICdcXG5cXG5OT1RFOiBObyBsZWFzZSBhZ3JlZW1lbnQgY29udGV4dCBhdmFpbGFibGUuIEFuYWx5c2lzIGJhc2VkIHNvbGVseSBvbiBldmljdGlvbiBub3RpY2UuJztcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3Qgc3lzdGVtTWVzc2FnZSA9IGAke2FuYWx5c2lzUHJvbXB0LnN5c3RlbVByb21wdH1cclxuICAgIFxyXG5MZWdhbCBDb250ZXh0OiAke3JhZ0NvbnRleHR9JHtsZWFzZUNvbnRleHRQcm9tcHR9XHJcblxyXG5SZXNwb25kIE9OTFkgd2l0aCBhIHZhbGlkIEpTT04gb2JqZWN0IGFkaGVyaW5nIHRvIHRoaXMgc2NoZW1hOiAke0pTT04uc3RyaW5naWZ5KGV2aWN0aW9uTGVnYWxJbnNpZ2h0c1NjaGVtYSwgbnVsbCwgMil9YDtcclxuXHJcbiAgICBjb25zdCB1c2VyTWVzc2FnZSA9IHByb21wdE1hbmFnZXIuZm9ybWF0VXNlclByb21wdChhbmFseXNpc1Byb21wdC51c2VyUHJvbXB0VGVtcGxhdGUsIHtcclxuICAgICAgbm90aWNlVGV4dDogZXh0cmFjdGVkRGV0YWlscy5mdWxsRXh0cmFjdGVkVGV4dCxcclxuICAgICAgdXNlclNlbGVjdGVkU3RhdGU6IHN0YXRlRm9yUHJvbXB0LFxyXG4gICAgICBldmljdGlvblJlYXNvbjogZXh0cmFjdGVkRGV0YWlscy5ldmljdGlvblJlYXNvblN1bW1hcnkgfHwgJ3Vua25vd24nLFxyXG4gICAgICBleHRyYWN0ZWREZXRhaWxzOiBKU09OLnN0cmluZ2lmeShleHRyYWN0ZWREZXRhaWxzLCBudWxsLCAyKVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgaW5zaWdodHNSZXNwb25zZSA9IGF3YWl0IG9wZW5haUNsaWVudC5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7XHJcbiAgICAgIG1vZGVsOiAnZ3B0LTRvJyxcclxuICAgICAgbWVzc2FnZXM6IFtcclxuICAgICAgICB7IHJvbGU6IFwic3lzdGVtXCIsIGNvbnRlbnQ6IHN5c3RlbU1lc3NhZ2UgfSxcclxuICAgICAgICB7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiB1c2VyTWVzc2FnZSB9XHJcbiAgICAgIF0sXHJcbiAgICAgIHJlc3BvbnNlX2Zvcm1hdDogeyB0eXBlOiBcImpzb25fb2JqZWN0XCIgfSxcclxuICAgICAgdGVtcGVyYXR1cmU6IDAuMixcclxuICAgICAgbWF4X3Rva2VuczogMzAwMCxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJhd0luc2lnaHRzID0gaW5zaWdodHNSZXNwb25zZS5jaG9pY2VzWzBdPy5tZXNzYWdlPy5jb250ZW50O1xyXG4gICAgaWYgKCFyYXdJbnNpZ2h0cykgdGhyb3cgbmV3IEVycm9yKCdObyBpbnNpZ2h0cyBjb250ZW50IGZyb20gQUkuJyk7XHJcbiAgICBcclxuICAgIGxlZ2FsSW5zaWdodHMgPSBKU09OLnBhcnNlKHJhd0luc2lnaHRzKSBhcyBFdmljdGlvbkxlZ2FsSW5zaWdodHM7XHJcbiAgICBcclxuICAgIC8vIFRPRE86IEdlbmVyYXRlIGxlYXNlLXNwZWNpZmljIHJlY29tbWVuZGF0aW9ucyBpZiBjb250ZXh0IGlzIGF2YWlsYWJsZVxyXG4gICAgaWYgKGxlYXNlQ29udGV4dD8ubGVhc2VBbmFseXNpc1Jlc3VsdHMpIHtcclxuICAgICAgbGVhc2VCYXNlZFJlY29tbWVuZGF0aW9ucyA9IGF3YWl0IGdlbmVyYXRlTGVhc2VCYXNlZFJlY29tbWVuZGF0aW9ucyhcclxuICAgICAgICBleHRyYWN0ZWREZXRhaWxzLCBcclxuICAgICAgICBsZWFzZUNvbnRleHQubGVhc2VBbmFseXNpc1Jlc3VsdHMsIFxyXG4gICAgICAgIG9wZW5haUNsaWVudCwgXHJcbiAgICAgICAgcHJvbXB0TWFuYWdlclxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZygnKEFJIExhbWJkYSkgTGVnYWwgaW5zaWdodHMgZ2VuZXJhdGlvbiBzdWNjZXNzZnVsLicpO1xyXG5cclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignKEFJIExhbWJkYSkgRXJyb3IgZHVyaW5nIGxlZ2FsIGluc2lnaHRzIGdlbmVyYXRpb246JywgZXJyb3IpO1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBMZWdhbCBJbnNpZ2h0cyBHZW5lcmF0aW9uIEZhaWxlZDogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT0gUEhBU0UgMzogUG9wdWxhdGUgVGVtcGxhdGVzID09PVxyXG4gIGxldCBwb3B1bGF0ZWRUZW1wbGF0ZXM6IFBvcHVsYXRlZEV2aWN0aW9uVGVtcGxhdGVzO1xyXG4gIFxyXG4gIHRyeSB7XHJcbiAgICBjb25zb2xlLmxvZygnKEFJIExhbWJkYSkgUG9wdWxhdGluZyBldmljdGlvbiByZXNwb25zZSB0ZW1wbGF0ZXMuLi4nKTtcclxuICAgIFxyXG4gICAgcG9wdWxhdGVkVGVtcGxhdGVzID0gYXdhaXQgcG9wdWxhdGVFdmljdGlvblRlbXBsYXRlcyhleHRyYWN0ZWREZXRhaWxzLCBzdGF0ZUZvclByb21wdCk7XHJcbiAgICBjb25zb2xlLmxvZygnKEFJIExhbWJkYSkgVGVtcGxhdGUgcG9wdWxhdGlvbiBzdWNjZXNzZnVsLicpO1xyXG5cclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignKEFJIExhbWJkYSkgRXJyb3IgZHVyaW5nIHRlbXBsYXRlIHBvcHVsYXRpb246JywgZXJyb3IpO1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBUZW1wbGF0ZSBQb3B1bGF0aW9uIEZhaWxlZDogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4ge1xyXG4gICAgZXh0cmFjdGVkTm90aWNlRGV0YWlsczogZXh0cmFjdGVkRGV0YWlscyxcclxuICAgIHBvcHVsYXRlZFRlbXBsYXRlcyxcclxuICAgIGxlZ2FsSW5zaWdodHMsXHJcbiAgICBkb2N1bWVudFR5cGU6ICdFVklDVElPTl9OT1RJQ0UnLFxyXG4gICAgbGVhc2VDb250ZXh0OiBsZWFzZUNvbnRleHQsXHJcbiAgICBsZWFzZUJhc2VkUmVjb21tZW5kYXRpb25zOiBsZWFzZUJhc2VkUmVjb21tZW5kYXRpb25zXHJcbiAgfTtcclxufVxyXG5cclxuLy8gVE9ETzogRXZpY3Rpb24gUmVzcG9uc2UgLSBBZGQgdGVtcGxhdGUgcG9wdWxhdGlvbiBoZWxwZXIgZnVuY3Rpb25cclxuYXN5bmMgZnVuY3Rpb24gcG9wdWxhdGVFdmljdGlvblRlbXBsYXRlcyhcclxuICBleHRyYWN0ZWREZXRhaWxzOiBFeHRyYWN0ZWRFdmljdGlvbkRldGFpbHMsIFxyXG4gIHN0YXRlOiBzdHJpbmdcclxuKTogUHJvbWlzZTxQb3B1bGF0ZWRFdmljdGlvblRlbXBsYXRlcz4ge1xyXG4gIFxyXG4gIC8vIFRPRE86IEltcGxlbWVudCB0ZW1wbGF0ZSByZWFkaW5nIGZyb20gZmlsZSBzeXN0ZW0gb3IgUzNcclxuICAvLyBGb3Igbm93LCByZXR1cm4gcGxhY2Vob2xkZXIgdGVtcGxhdGVzXHJcbiAgY29uc29sZS5sb2coJyhBSSBMYW1iZGEpIFRlbXBsYXRlIHBvcHVsYXRpb24gLSBUT0RPOiBJbXBsZW1lbnQgZmlsZSByZWFkaW5nIGxvZ2ljJyk7XHJcbiAgXHJcbiAgY29uc3QgdGVtcGxhdGVEYXRhID0ge1xyXG4gICAgdGVuYW50TmFtZTogZXh0cmFjdGVkRGV0YWlscy50ZW5hbnROYW1lIHx8ICdbVGVuYW50IE5hbWVdJyxcclxuICAgIGxhbmRsb3JkTmFtZTogZXh0cmFjdGVkRGV0YWlscy5sYW5kbG9yZE5hbWUgfHwgJ1tMYW5kbG9yZCBOYW1lXScsXHJcbiAgICBub3RpY2VEYXRlOiBleHRyYWN0ZWREZXRhaWxzLm5vdGljZURhdGUgfHwgJ1tOb3RpY2UgRGF0ZV0nLFxyXG4gICAgZGVhZGxpbmVEYXRlOiBleHRyYWN0ZWREZXRhaWxzLmRlYWRsaW5lRGF0ZSB8fCAnW0RlYWRsaW5lIERhdGVdJyxcclxuICAgIGNvdW50eTogZXh0cmFjdGVkRGV0YWlscy5kZXRlY3RlZENvdW50eSB8fCAnW0NvdW50eV0nLFxyXG4gICAgc3RhdGU6IHN0YXRlLnRvVXBwZXJDYXNlKCksXHJcbiAgICBwYXltZW50RGF0ZTogJ1tQYXltZW50IERhdGVdJywgLy8gVE9ETzogRXh0cmFjdCBmcm9tIHVzZXIgZm9ybSBkYXRhXHJcbiAgICBwYXltZW50TWV0aG9kOiAnW1BheW1lbnQgTWV0aG9kXScsIC8vIFRPRE86IEV4dHJhY3QgZnJvbSB1c2VyIGZvcm0gZGF0YVxyXG4gICAgcmVudEFtb3VudDogZXh0cmFjdGVkRGV0YWlscy5yZW50QW1vdW50RHVlIHx8ICdbUmVudCBBbW91bnRdJ1xyXG4gIH07XHJcblxyXG4gIC8vIFRPRE86IFJlYWQgYWN0dWFsIHRlbXBsYXRlIGZpbGVzIGJhc2VkIG9uIHN0YXRlIGFuZCByZWFzb25cclxuICBjb25zdCByZWFzb24gPSBkZXRlcm1pbmVFdmljdGlvblJlYXNvbihleHRyYWN0ZWREZXRhaWxzLmV2aWN0aW9uUmVhc29uU3VtbWFyeSk7XHJcbiAgY29uc29sZS5sb2coYChBSSBMYW1iZGEpIERldGVybWluZWQgZXZpY3Rpb24gcmVhc29uOiAke3JlYXNvbn0gZm9yIHN0YXRlOiAke3N0YXRlfWApO1xyXG4gIFxyXG4gIC8vIFBsYWNlaG9sZGVyIHBvcHVsYXRlZCBsZXR0ZXJcclxuICBjb25zdCBwb3B1bGF0ZWRMZXR0ZXIgPSBgWyR7dGVtcGxhdGVEYXRhLnRlbmFudE5hbWV9XVxyXG5bWW91ciBBZGRyZXNzXVxyXG5bRGF0ZV1cclxuXHJcblske3RlbXBsYXRlRGF0YS5sYW5kbG9yZE5hbWV9XVxyXG5bTGFuZGxvcmQgQWRkcmVzc11cclxuXHJcblJFOiBSZXNwb25zZSB0byBFdmljdGlvbiBOb3RpY2UgRGF0ZWQgJHt0ZW1wbGF0ZURhdGEubm90aWNlRGF0ZX1cclxuXHJcbkkgZGlzcHV0ZSB0aGlzIGV2aWN0aW9uIG5vdGljZSB1bmRlciAke3RlbXBsYXRlRGF0YS5zdGF0ZX0gbGF3LiBcclxuXHJcbltUZW1wbGF0ZSBjb250ZW50IHdvdWxkIGJlIHBvcHVsYXRlZCBoZXJlIGJhc2VkIG9uICR7cmVhc29ufSBhbmQgJHtzdGF0ZX1dXHJcblxyXG5TaW5jZXJlbHksXHJcbiR7dGVtcGxhdGVEYXRhLnRlbmFudE5hbWV9YDtcclxuXHJcbiAgLy8gUGxhY2Vob2xkZXIgY291cnQgaW5zdHJ1Y3Rpb25zIGFuZCBsZWdhbCBhaWQgY29udGFjdHNcclxuICByZXR1cm4ge1xyXG4gICAgcG9wdWxhdGVkTGV0dGVyLFxyXG4gICAgY291cnRJbnN0cnVjdGlvbnM6IGBGaWxlIHlvdXIgcmVzcG9uc2UgYXQgdGhlICR7dGVtcGxhdGVEYXRhLmNvdW50eX0gQ291bnR5IFN1cGVyaW9yIENvdXJ0IHdpdGhpbiB0aGUgZGVhZGxpbmUgc3BlY2lmaWVkIGluIHlvdXIgbm90aWNlLmAsXHJcbiAgICBsZWdhbEFpZENvbnRhY3RzOiBbXHJcbiAgICAgIHtcclxuICAgICAgICBuYW1lOiBgJHtzdGF0ZX0gTGVnYWwgQWlkIFNvY2lldHlgLFxyXG4gICAgICAgIHBob25lOiBcIjU1NS1MRUdBTC1BSURcIixcclxuICAgICAgICB1cmw6IGBodHRwczovL2xlZ2FsYWlkJHtzdGF0ZS50b0xvd2VyQ2FzZSgpfS5vcmdgXHJcbiAgICAgIH1cclxuICAgIF1cclxuICB9O1xyXG59XHJcblxyXG4vLyBUT0RPOiBFdmljdGlvbiBSZXNwb25zZSAtIEhlbHBlciBmdW5jdGlvbiB0byBkZXRlcm1pbmUgZXZpY3Rpb24gcmVhc29uIGZyb20gc3VtbWFyeVxyXG5mdW5jdGlvbiBkZXRlcm1pbmVFdmljdGlvblJlYXNvbihyZWFzb25TdW1tYXJ5Pzogc3RyaW5nKTogc3RyaW5nIHtcclxuICBpZiAoIXJlYXNvblN1bW1hcnkpIHJldHVybiAndW5rbm93bic7XHJcbiAgXHJcbiAgY29uc3Qgc3VtbWFyeSA9IHJlYXNvblN1bW1hcnkudG9Mb3dlckNhc2UoKTtcclxuICBcclxuICBpZiAoc3VtbWFyeS5pbmNsdWRlcygncmVudCcpIHx8IHN1bW1hcnkuaW5jbHVkZXMoJ3BheW1lbnQnKSkge1xyXG4gICAgcmV0dXJuICdub24tcGF5bWVudCc7XHJcbiAgfSBlbHNlIGlmIChzdW1tYXJ5LmluY2x1ZGVzKCd2aW9sYXRpb24nKSB8fCBzdW1tYXJ5LmluY2x1ZGVzKCdicmVhY2gnKSkge1xyXG4gICAgcmV0dXJuICdsZWFzZS12aW9sYXRpb24nO1xyXG4gIH0gZWxzZSBpZiAoc3VtbWFyeS5pbmNsdWRlcygnZW5kJykgfHwgc3VtbWFyeS5pbmNsdWRlcygnZXhwaXInKSB8fCBzdW1tYXJ5LmluY2x1ZGVzKCd0ZXJtJykpIHtcclxuICAgIHJldHVybiAnbm8tY2F1c2UnO1xyXG4gIH1cclxuICBcclxuICByZXR1cm4gJ290aGVyJztcclxufVxyXG5cclxuLy8gVE9ETzogRXZpY3Rpb24gUmVzcG9uc2UgLSBBZGQgbGVhc2UtYmFzZWQgcmVjb21tZW5kYXRpb25zIGhlbHBlciBmdW5jdGlvblxyXG5hc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUxlYXNlQmFzZWRSZWNvbW1lbmRhdGlvbnMoXHJcbiAgZXh0cmFjdGVkRGV0YWlsczogRXh0cmFjdGVkRXZpY3Rpb25EZXRhaWxzLFxyXG4gIGxlYXNlQW5hbHlzaXNSZXN1bHRzOiBBSUFuYWx5c2lzUmVzdWx0cyxcclxuICBvcGVuYWlDbGllbnQ6IE9wZW5BSSxcclxuICBwcm9tcHRNYW5hZ2VyOiBQcm9tcHRNYW5hZ2VyXHJcbik6IFByb21pc2U8c3RyaW5nW10+IHtcclxuICBcclxuICB0cnkge1xyXG4gICAgY29uc29sZS5sb2coJyhBSSBMYW1iZGEpIEdlbmVyYXRpbmcgbGVhc2Utc3BlY2lmaWMgcmVjb21tZW5kYXRpb25zLi4uJyk7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSBhIGZvY3VzZWQgcHJvbXB0IHRvIGdlbmVyYXRlIGxlYXNlLXNwZWNpZmljIHJlY29tbWVuZGF0aW9uc1xyXG4gICAgY29uc3Qgc3lzdGVtUHJvbXB0ID0gYFlvdSBhcmUgYSB0ZW5hbnQgcmlnaHRzIGV4cGVydC4gQmFzZWQgb24gdGhlIGV2aWN0aW9uIG5vdGljZSBkZXRhaWxzIGFuZCB0aGUgcHJldmlvdXNseSBhbmFseXplZCBsZWFzZSBhZ3JlZW1lbnQsIHByb3ZpZGUgc3BlY2lmaWMgcmVjb21tZW5kYXRpb25zIHRoYXQgbGV2ZXJhZ2Uga25vd2xlZGdlIG9mIHRoZSBsZWFzZSB0ZXJtcy5cclxuICAgIFxyXG4gICAgRm9jdXMgb246XHJcbiAgICAxLiBIb3cgdGhlIGV2aWN0aW9uIG5vdGljZSByZWxhdGVzIHRvIHNwZWNpZmljIGxlYXNlIGNsYXVzZXNcclxuICAgIDIuIFdoZXRoZXIgdGhlIGxhbmRsb3JkIGlzIGZvbGxvd2luZyBsZWFzZSB0ZXJtcyBjb3JyZWN0bHlcclxuICAgIDMuIEFueSBsZWFzZS1iYXNlZCBkZWZlbnNlcyB0aGUgdGVuYW50IG1pZ2h0IGhhdmVcclxuICAgIDQuIEluY29uc2lzdGVuY2llcyBiZXR3ZWVuIHRoZSBsZWFzZSBhbmQgdGhlIGV2aWN0aW9uIG5vdGljZVxyXG4gICAgXHJcbiAgICBSZXNwb25kIHdpdGggYSBKU09OIGFycmF5IG9mIHJlY29tbWVuZGF0aW9uIHN0cmluZ3MuIE1heGltdW0gNSByZWNvbW1lbmRhdGlvbnMuYDtcclxuICAgIFxyXG4gICAgY29uc3QgdXNlclByb21wdCA9IGBcclxuICAgIEVWSUNUSU9OIE5PVElDRSBERVRBSUxTOlxyXG4gICAgLSBSZWFzb246ICR7ZXh0cmFjdGVkRGV0YWlscy5ldmljdGlvblJlYXNvblN1bW1hcnkgfHwgJ1Vua25vd24nfVxyXG4gICAgLSBOb3RpY2UgRGF0ZTogJHtleHRyYWN0ZWREZXRhaWxzLm5vdGljZURhdGUgfHwgJ1Vua25vd24nfVxyXG4gICAgLSBEZWFkbGluZTogJHtleHRyYWN0ZWREZXRhaWxzLmRlYWRsaW5lRGF0ZSB8fCAnVW5rbm93bid9XHJcbiAgICAtIEFtb3VudCBEdWU6ICR7ZXh0cmFjdGVkRGV0YWlscy5yZW50QW1vdW50RHVlIHx8ICdOL0EnfVxyXG4gICAgXHJcbiAgICBMRUFTRSBBTkFMWVNJUyBDT05URVhUOlxyXG4gICAgLSBTdW1tYXJ5OiAke2xlYXNlQW5hbHlzaXNSZXN1bHRzLnN1bW1hcnl9XHJcbiAgICAtIEhpZ2gtUmlzayBDbGF1c2VzOiAke2xlYXNlQW5hbHlzaXNSZXN1bHRzLmNsYXVzZXNcclxuICAgICAgPy5maWx0ZXIoYyA9PiBjLmlzc3Vlcy5zb21lKGkgPT4gaS5zZXZlcml0eSA9PT0gJ0hpZ2gnKSlcclxuICAgICAgLm1hcChjID0+IGMudGl0bGUpXHJcbiAgICAgIC5qb2luKCcsICcpIHx8ICdOb25lJ31cclxuICAgIFxyXG4gICAgR2VuZXJhdGUgbGVhc2Utc3BlY2lmaWMgcmVjb21tZW5kYXRpb25zIGZvciByZXNwb25kaW5nIHRvIHRoaXMgZXZpY3Rpb24gbm90aWNlLmA7XHJcblxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBvcGVuYWlDbGllbnQuY2hhdC5jb21wbGV0aW9ucy5jcmVhdGUoe1xyXG4gICAgICBtb2RlbDogJ2dwdC00bycsXHJcbiAgICAgIG1lc3NhZ2VzOiBbXHJcbiAgICAgICAgeyByb2xlOiBcInN5c3RlbVwiLCBjb250ZW50OiBzeXN0ZW1Qcm9tcHQgfSxcclxuICAgICAgICB7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiB1c2VyUHJvbXB0IH1cclxuICAgICAgXSxcclxuICAgICAgcmVzcG9uc2VfZm9ybWF0OiB7IHR5cGU6IFwianNvbl9vYmplY3RcIiB9LFxyXG4gICAgICB0ZW1wZXJhdHVyZTogMC4zLFxyXG4gICAgICBtYXhfdG9rZW5zOiAxMDAwLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcmF3UmVzcG9uc2UgPSByZXNwb25zZS5jaG9pY2VzWzBdPy5tZXNzYWdlPy5jb250ZW50O1xyXG4gICAgaWYgKCFyYXdSZXNwb25zZSkgdGhyb3cgbmV3IEVycm9yKCdObyByZXNwb25zZSBmcm9tIEFJIGZvciBsZWFzZSByZWNvbW1lbmRhdGlvbnMuJyk7XHJcbiAgICBcclxuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmF3UmVzcG9uc2UpO1xyXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkLnJlY29tbWVuZGF0aW9ucykgPyBwYXJzZWQucmVjb21tZW5kYXRpb25zIDogW107XHJcbiAgICBcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignKEFJIExhbWJkYSkgRXJyb3IgZ2VuZXJhdGluZyBsZWFzZS1iYXNlZCByZWNvbW1lbmRhdGlvbnM6JywgZXJyb3IpO1xyXG4gICAgcmV0dXJuIFtdOyAvLyBSZXR1cm4gZW1wdHkgYXJyYXkgb24gZXJyb3IsIGRvbid0IGZhaWwgdGhlIGVudGlyZSBwcm9jZXNzXHJcbiAgfVxyXG59XHJcblxyXG4vLyBUT0RPOiBFdmljdGlvbiBSZXNwb25zZSAtIEFkZCBmdW5jdGlvbiB0byByZXRyaWV2ZSB1c2VyJ3MgbGVhc2UgY29udGV4dFxyXG5hc3luYyBmdW5jdGlvbiBnZXRVc2VyTGVhc2VDb250ZXh0KHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxMZWFzZUNvbnRleHREYXRhIHwgbnVsbD4ge1xyXG4gIFxyXG4gIHRyeSB7XHJcbiAgICBjb25zb2xlLmxvZyhgKEFJIExhbWJkYSkgUmV0cmlldmluZyBsZWFzZSBjb250ZXh0IGZvciB1c2VyOiAke3VzZXJJZH1gKTtcclxuICAgIFxyXG4gICAgLy8gVE9ETzogUXVlcnkgRHluYW1vREIgZm9yIHVzZXIncyBtb3N0IHJlY2VudCBsZWFzZSBhbmFseXNpc1xyXG4gICAgLy8gRm9yIG5vdywgcmV0dXJuIG51bGwgLSB0aGlzIHdpbGwgYmUgaW1wbGVtZW50ZWQgd2hlbiB3ZSBoYXZlIHVzZXIgY29udGV4dFxyXG4gICAgY29uc29sZS5sb2coJyhBSSBMYW1iZGEpIExlYXNlIGNvbnRleHQgcmV0cmlldmFsIC0gVE9ETzogSW1wbGVtZW50IER5bmFtb0RCIHF1ZXJ5IGZvciB1c2VyIGxlYXNlIGhpc3RvcnknKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgICBcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignKEFJIExhbWJkYSkgRXJyb3IgcmV0cmlldmluZyBsZWFzZSBjb250ZXh0OicsIGVycm9yKTtcclxuICAgIHJldHVybiBudWxsOyAvLyBEb24ndCBmYWlsIGV2aWN0aW9uIHByb2Nlc3NpbmcgaWYgbGVhc2UgY29udGV4dCByZXRyaWV2YWwgZmFpbHNcclxuICB9XHJcbn1cclxuXHJcbmNvbnN0IERZTkFNT0RCX1RBQkxFID0gcHJvY2Vzcy5lbnYuRFlOQU1PREJfTEVBU0VfQU5BTFlTRVNfVEFCTEU7XHJcbmNvbnN0IE9QRU5BSV9BUElfS0VZX1NFQ1JFVF9OQU1FID0gcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVlfU0VDUkVUX05BTUU7XHJcbmNvbnN0IEFXU19SRUdJT04gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OO1xyXG5cclxuaWYgKCFEWU5BTU9EQl9UQUJMRSkge1xyXG4gIHRocm93IG5ldyBFcnJvcihcIkRZTkFNT0RCX0xFQVNFX0FOQUxZU0VTX1RBQkxFIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIG5vdCBzZXQuXCIpO1xyXG59XHJcbmlmICghT1BFTkFJX0FQSV9LRVlfU0VDUkVUX05BTUUpIHtcclxuICB0aHJvdyBuZXcgRXJyb3IoXCJPUEVOQUlfQVBJX0tFWV9TRUNSRVRfTkFNRSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBub3Qgc2V0LlwiKTtcclxufVxyXG5pZiAoIUFXU19SRUdJT04pIHtcclxuICB0aHJvdyBuZXcgRXJyb3IoXCJBV1NfUkVHSU9OIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIG5vdCBzZXQuXCIpO1xyXG59XHJcblxyXG5jb25zdCBkeW5hbW9EQkNsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7IHJlZ2lvbjogQVdTX1JFR0lPTiB9KTtcclxuY29uc3QgZG9jQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGR5bmFtb0RCQ2xpZW50KTtcclxubGV0IG9wZW5haUNsaWVudDogT3BlbkFJO1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZU9wZW5BSUNsaWVudCgpOiBQcm9taXNlPE9wZW5BST4ge1xyXG4gIGlmIChvcGVuYWlDbGllbnQpIHtcclxuICAgIHJldHVybiBvcGVuYWlDbGllbnQ7XHJcbiAgfVxyXG4gIGNvbnNvbGUubG9nKGBGZXRjaGluZyBPcGVuQUkgQVBJIGtleSBmcm9tIFNlY3JldHMgTWFuYWdlcjogJHtPUEVOQUlfQVBJX0tFWV9TRUNSRVRfTkFNRX1gKTtcclxuICBjb25zdCBzZWNyZXRzQ2xpZW50ID0gbmV3IFNlY3JldHNNYW5hZ2VyQ2xpZW50KHsgcmVnaW9uOiBBV1NfUkVHSU9OIH0pO1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IEdldFNlY3JldFZhbHVlQ29tbWFuZCh7IFNlY3JldElkOiBPUEVOQUlfQVBJX0tFWV9TRUNSRVRfTkFNRSB9KTtcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBzZWNyZXRzQ2xpZW50LnNlbmQoY29tbWFuZCk7XHJcbiAgICBsZXQgc2VjcmV0VmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcclxuICAgIGlmIChkYXRhLlNlY3JldFN0cmluZykge1xyXG4gICAgICBzZWNyZXRWYWx1ZSA9IGRhdGEuU2VjcmV0U3RyaW5nO1xyXG4gICAgfSBlbHNlIGlmIChkYXRhLlNlY3JldEJpbmFyeSkge1xyXG4gICAgICAvLyBJZiBTZWNyZXRCaW5hcnkgaXMgdXNlZCwgeW91IG5lZWQgdG8gZGVjb2RlIGl0IChlLmcuLCBiYXNlNjQpXHJcbiAgICAgIC8vIEZvciB0aGlzIGV4YW1wbGUsIGFzc3VtaW5nIFNlY3JldFN0cmluZ1xyXG4gICAgICBjb25zb2xlLndhcm4oXCJPcGVuQUkgQVBJIEtleSBzZWNyZXQgaXMgYmluYXJ5LCBleHBlY3RlZCBzdHJpbmcuXCIpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPcGVuQUkgQVBJIEtleSBzZWNyZXQgaXMgYmluYXJ5LCBleHBlY3RlZCBzdHJpbmcuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghc2VjcmV0VmFsdWUpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwiT3BlbkFJIEFQSSBLZXkgc2VjcmV0IHN0cmluZyBpcyBlbXB0eS5cIik7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUmV0cmlldmVkIE9wZW5BSSBBUEkgS2V5IHNlY3JldCBpcyBlbXB0eS5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gVHJ5IHRvIHBhcnNlIGFzIEpTT04sIGlmIGl0IGZhaWxzLCBhc3N1bWUgaXQncyBhIHBsYWluIHN0cmluZyBrZXlcclxuICAgIGxldCBhcGlLZXk7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHNlY3JldEpzb24gPSBKU09OLnBhcnNlKHNlY3JldFZhbHVlKTtcclxuICAgICAgICAvLyBBZGp1c3QgdGhpcyBpZiB5b3VyIHNlY3JldCBpcyBzdG9yZWQgd2l0aCBhIGRpZmZlcmVudCBrZXkgd2l0aGluIHRoZSBKU09OXHJcbiAgICAgICAgYXBpS2V5ID0gc2VjcmV0SnNvbi5PUEVOQUlfQVBJX0tFWSB8fCBzZWNyZXRKc29uLmFwaUtleSB8fCBzZWNyZXRKc29uLmtleTtcclxuICAgICAgICBpZiAoIWFwaUtleSAmJiB0eXBlb2Ygc2VjcmV0SnNvbiA9PT0gJ3N0cmluZycpIGFwaUtleSA9IHNlY3JldEpzb247IC8vIGlmIEpTT04gaXMganVzdCB0aGUga2V5IHN0cmluZyBpdHNlbGZcclxuICAgICAgICBlbHNlIGlmICghYXBpS2V5KSBhcGlLZXkgPSBzZWNyZXRWYWx1ZTsgLy8gRmFsbGJhY2sgaWYga2V5IG5vdCBmb3VuZCBpbiBKU09OIHN0cnVjdHVyZVxyXG5cclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAvLyBOb3QgYSBKU09OIHN0cmluZywgYXNzdW1lIHRoZSBzZWNyZXQgSVMgdGhlIEFQSSBrZXlcclxuICAgICAgICBhcGlLZXkgPSBzZWNyZXRWYWx1ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWFwaUtleSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBleHRyYWN0IE9wZW5BSSBBUEkgS2V5IGZyb20gc2VjcmV0LlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBvcGVuYWlDbGllbnQgPSBuZXcgT3BlbkFJKHsgYXBpS2V5IH0pO1xyXG4gICAgY29uc29sZS5sb2coXCJPcGVuQUkgY2xpZW50IGluaXRpYWxpemVkIHN1Y2Nlc3NmdWxseS5cIik7XHJcbiAgICByZXR1cm4gb3BlbmFpQ2xpZW50O1xyXG5cclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBmZXRjaGluZy9wYXJzaW5nIE9wZW5BSSBBUEkga2V5IGZyb20gU2VjcmV0cyBNYW5hZ2VyOlwiLCBlcnIpO1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcmV0cmlldmUvcGFyc2UgT3BlbkFJIEFQSSBLZXk6ICR7ZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpfWApO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoZXZlbnQ6IGFueSwgY29udGV4dDogYW55KTogUHJvbWlzZTx2b2lkPiA9PiB7XHJcbiAgY29uc29sZS5sb2coJ0FJIExlYXNlIFByb2Nlc3NpbmcgTGFtYmRhIGludm9rZWQuIEV2ZW50OicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XHJcbiAgXHJcbiAgdHJ5IHtcclxuICAgIG9wZW5haUNsaWVudCA9IGF3YWl0IGluaXRpYWxpemVPcGVuQUlDbGllbnQoKTsgXHJcbiAgfSBjYXRjaCAoaW5pdEVycm9yKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIGluaXRpYWxpemUgT3BlbkFJIGNsaWVudDpcIiwgaW5pdEVycm9yKTtcclxuICAgIHRocm93IGluaXRFcnJvcjtcclxuICB9XHJcblxyXG4gIGZvciAoY29uc3QgcmVjb3JkIG9mIGV2ZW50LlJlY29yZHMpIHtcclxuICAgIGxldCBhbmFseXNpc0lkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcbiAgICBsZXQgc3FzTWVzc2FnZUJvZHk6IGFueTsgLy8gVG8gc3RvcmUgdGhlIHBhcnNlZCBib2R5IGZvciB3aWRlciB1c2VcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBzcXNNZXNzYWdlQm9keSA9IEpTT04ucGFyc2UocmVjb3JkLmJvZHkpO1xyXG4gICAgICBhbmFseXNpc0lkID0gc3FzTWVzc2FnZUJvZHkuYW5hbHlzaXNJZDtcclxuICAgICAgY29uc3QgdXNlclVwbG9hZGVkRmlsZU5hbWUgPSBzcXNNZXNzYWdlQm9keS5vcmlnaW5hbEZpbGVOYW1lIHx8IHNxc01lc3NhZ2VCb2R5LnVzZXJVcGxvYWRlZEZpbGVOYW1lOyAvLyBVc2Ugb3JpZ2luYWxGaWxlTmFtZSBmcm9tIFNRU1xyXG5cclxuICAgICAgaWYgKCFhbmFseXNpc0lkKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcImFuYWx5c2lzSWQgaXMgbWlzc2luZyBpbiBTUVMgbWVzc2FnZSBib2R5OlwiLCBzcXNNZXNzYWdlQm9keSk7XHJcbiAgICAgICAgY29udGludWU7IFxyXG4gICAgICB9XHJcbiAgICAgIC8vIEVuc3VyZSBjcml0aWNhbCBkYXRhIGZyb20gU1FTIG1lc3NhZ2UgaXMgcHJlc2VudFxyXG4gICAgICBpZiAoIXNxc01lc3NhZ2VCb2R5LmV4dHJhY3RlZFRleHQpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGBFeHRyYWN0ZWQgdGV4dCBpcyBtaXNzaW5nIGluIFNRUyBtZXNzYWdlIGJvZHkgZm9yIGFuYWx5c2lzSWQ6ICR7YW5hbHlzaXNJZH1gKTtcclxuICAgICAgICAvLyBVcGRhdGUgRERCIHdpdGggZXJyb3IgYW5kIGNvbnRpbnVlXHJcbiAgICAgICAgYXdhaXQgdXBkYXRlRHluYW1vREJPbkVycm9yKGFuYWx5c2lzSWQsIFwiQUlfUFJPQ0VTU0lOR19GQUlMRURcIiwgXCJNaXNzaW5nIGV4dHJhY3RlZFRleHQgaW4gU1FTIG1lc3NhZ2VcIik7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKCFzcXNNZXNzYWdlQm9keS51c2VyU2VsZWN0ZWRTdGF0ZSkge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihgdXNlclNlbGVjdGVkU3RhdGUgaXMgbWlzc2luZyBpbiBTUVMgbWVzc2FnZSBib2R5IGZvciBhbmFseXNpc0lkOiAke2FuYWx5c2lzSWR9LiBBSSB3aWxsIHVzZSBhIGdlbmVyYWwgcHJvbXB0LmApO1xyXG4gICAgICAgIC8vIEFJIGZ1bmN0aW9uIGhhcyBhIGZhbGxiYWNrLCBzbyB0aGlzIGlzIG5vdCBmYXRhbCwgYnV0IGdvb2QgdG8gbG9nLlxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zb2xlLmxvZyhgUHJvY2Vzc2luZyBhbmFseXNpc0lkOiAke2FuYWx5c2lzSWR9IGZvciBmaWxlOiAke3VzZXJVcGxvYWRlZEZpbGVOYW1lIHx8ICdOL0EnfWApO1xyXG5cclxuICAgICAgLy8gMS4gRGF0YSBkaXJlY3RseSBmcm9tIFNRUyBtZXNzYWdlIGJvZHlcclxuICAgICAgY29uc3QgZXh0cmFjdGVkVGV4dCA9IHNxc01lc3NhZ2VCb2R5LmV4dHJhY3RlZFRleHQgYXMgc3RyaW5nO1xyXG4gICAgICBjb25zdCB1c2VyU2VsZWN0ZWRTdGF0ZSA9IHNxc01lc3NhZ2VCb2R5LnVzZXJTZWxlY3RlZFN0YXRlIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcclxuICAgICAgY29uc3QgZG9jdW1lbnRUeXBlID0gc3FzTWVzc2FnZUJvZHkuZG9jdW1lbnRUeXBlIGFzIHN0cmluZyB8IHVuZGVmaW5lZDsgLy8gJ0xFQVNFJyBvciAnRVZJQ1RJT05fTk9USUNFJ1xyXG4gICAgICBjb25zdCBpc0ltYWdlVXBsb2FkID0gc3FzTWVzc2FnZUJvZHkuaXNJbWFnZVVwbG9hZCBhcyBib29sZWFuIHwgdW5kZWZpbmVkO1xyXG4gICAgICBjb25zdCB1c2VyRm9ybURhdGEgPSBzcXNNZXNzYWdlQm9keS51c2VyRm9ybURhdGE7IC8vIE9wdGlvbmFsIHVzZXItcHJvdmlkZWQgbWV0YWRhdGEgZm9yIGV2aWN0aW9uc1xyXG4gICAgICBjb25zdCB1c2VySWQgPSBzcXNNZXNzYWdlQm9keS51c2VySWQgYXMgc3RyaW5nIHwgdW5kZWZpbmVkOyAvLyBGb3IgbGVhc2UgY29udGV4dCByZXRyaWV2YWxcclxuICAgICAgLy8gczNLZXksIHMzQnVja2V0IGFyZSBhbHNvIGF2YWlsYWJsZSBpbiBzcXNNZXNzYWdlQm9keSBpZiBuZWVkZWQgbGF0ZXJcclxuXHJcbiAgICAgIC8vIDIuIFVwZGF0ZSBzdGF0dXMgdG8gQUlfUFJPQ0VTU0lOR19JTl9QUk9HUkVTU1xyXG4gICAgICBjb25zb2xlLmxvZyhgVXBkYXRpbmcgc3RhdHVzIHRvIEFJX1BST0NFU1NJTkdfSU5fUFJPR1JFU1MgZm9yICR7YW5hbHlzaXNJZH1gKTtcclxuICAgICAgY29uc3QgdXBkYXRlSW5Qcm9ncmVzc1BhcmFtcyA9IHtcclxuICAgICAgICBUYWJsZU5hbWU6IERZTkFNT0RCX1RBQkxFISxcclxuICAgICAgICBLZXk6IHsgYW5hbHlzaXNJZCB9LFxyXG4gICAgICAgIFVwZGF0ZUV4cHJlc3Npb246IFwic2V0ICNzdGF0dXMgPSA6c3RhdHVzLCAjbGFzdFVwZGF0ZWRUaW1lc3RhbXAgPSA6dGltZXN0YW1wXCIsXHJcbiAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7IFwiI3N0YXR1c1wiOiBcInN0YXR1c1wiLCBcIiNsYXN0VXBkYXRlZFRpbWVzdGFtcFwiOiBcImxhc3RVcGRhdGVkVGltZXN0YW1wXCIgfSxcclxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XHJcbiAgICAgICAgICBcIjpzdGF0dXNcIjogXCJBSV9QUk9DRVNTSU5HX0lOX1BST0dSRVNTXCIsXHJcbiAgICAgICAgICBcIjp0aW1lc3RhbXBcIjogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH07XHJcbiAgICAgIGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBVcGRhdGVDb21tYW5kKHVwZGF0ZUluUHJvZ3Jlc3NQYXJhbXMpKTtcclxuXHJcbiAgICAgIGxldCBmaW5hbFJlc3VsdHM6IEFJQW5hbHlzaXNSZXN1bHRzIHwgRW5oYW5jZWRFdmljdGlvbkFuYWx5c2lzUmVzdWx0cyB8IG51bGwgPSBudWxsO1xyXG4gICAgICBsZXQgZmluYWxTdGF0dXM6IHN0cmluZyA9ICcnO1xyXG4gICAgICBsZXQgZXJyb3JEZXRhaWxzOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgLy8gMy4gUm91dGUgdG8gYXBwcm9wcmlhdGUgYW5hbHlzaXMgYmFzZWQgb24gZG9jdW1lbnQgdHlwZVxyXG4gICAgICAgIGNvbnNvbGUubG9nKGBQcm9jZXNzaW5nIGRvY3VtZW50IHR5cGU6ICR7ZG9jdW1lbnRUeXBlIHx8ICdMRUFTRSd9IGZvciAke2FuYWx5c2lzSWR9IHVzaW5nIHRleHQgb2YgbGVuZ3RoICR7ZXh0cmFjdGVkVGV4dC5sZW5ndGh9IGZvciBzdGF0ZTogJHt1c2VyU2VsZWN0ZWRTdGF0ZSB8fCAnZ2VuZXJhbCd9YCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGRvY3VtZW50VHlwZSA9PT0gJ0VWSUNUSU9OX05PVElDRScpIHtcclxuICAgICAgICAgIC8vIFJvdXRlIHRvIGV2aWN0aW9uIHByb2Nlc3NpbmdcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGBQZXJmb3JtaW5nIGV2aWN0aW9uIGFuYWx5c2lzIGZvciAke2FuYWx5c2lzSWR9YCk7XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIC8vIEdldCBsZWFzZSBjb250ZXh0IGlmIHVzZXJJZCBpcyBwcm92aWRlZFxyXG4gICAgICAgICAgbGV0IGxlYXNlQ29udGV4dDogTGVhc2VDb250ZXh0RGF0YSB8IG51bGwgPSBudWxsO1xyXG4gICAgICAgICAgaWYgKHVzZXJJZCkge1xyXG4gICAgICAgICAgICBsZWFzZUNvbnRleHQgPSBhd2FpdCBnZXRVc2VyTGVhc2VDb250ZXh0KHVzZXJJZCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIGNvbnN0IGV2aWN0aW9uUmVzdWx0cyA9IGF3YWl0IHBlcmZvcm1FdmljdGlvbkFuYWx5c2lzSW50ZXJuYWwoXHJcbiAgICAgICAgICAgIGV4dHJhY3RlZFRleHQsXHJcbiAgICAgICAgICAgIHVzZXJTZWxlY3RlZFN0YXRlLFxyXG4gICAgICAgICAgICB1c2VyRm9ybURhdGEsXHJcbiAgICAgICAgICAgIGlzSW1hZ2VVcGxvYWQgfHwgZmFsc2UsXHJcbiAgICAgICAgICAgIG9wZW5haUNsaWVudCxcclxuICAgICAgICAgICAgbGVhc2VDb250ZXh0IHx8IHVuZGVmaW5lZFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgZmluYWxSZXN1bHRzID0gZXZpY3Rpb25SZXN1bHRzO1xyXG4gICAgICAgICAgZmluYWxTdGF0dXMgPSAnQU5BTFlTSVNfQ09NUExFVEUnO1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYEV2aWN0aW9uIGFuYWx5c2lzIHN1Y2Nlc3NmdWwgZm9yICR7YW5hbHlzaXNJZH1gKTtcclxuICAgICAgICAgIFxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAvLyBEZWZhdWx0IHRvIGxlYXNlIGFuYWx5c2lzIChiYWNrd2FyZCBjb21wYXRpYmlsaXR5KVxyXG4gICAgICAgICAgY29uc29sZS5sb2coYFBlcmZvcm1pbmcgbGVhc2UgYW5hbHlzaXMgZm9yICR7YW5hbHlzaXNJZH1gKTtcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgY29uc3QgeyBpbml0aWFsQW5hbHlzaXNSZXN1bHRzLCBhY3Rpb25hYmxlSW5zaWdodHNEYXRhIH0gPSBhd2FpdCBwZXJmb3JtQWlMZWFzZUFuYWx5c2lzSW50ZXJuYWwoXHJcbiAgICAgICAgICAgIGV4dHJhY3RlZFRleHQsICAgICAgICAgIC8vIEZyb20gU1FTIG1lc3NhZ2VcclxuICAgICAgICAgICAgdXNlclNlbGVjdGVkU3RhdGUsICAgICAgLy8gRnJvbSBTUVMgbWVzc2FnZVxyXG4gICAgICAgICAgICBvcGVuYWlDbGllbnRcclxuICAgICAgICAgICk7XHJcbiAgICAgICAgICBmaW5hbFJlc3VsdHMgPSB7IC4uLmluaXRpYWxBbmFseXNpc1Jlc3VsdHMsIC4uLmFjdGlvbmFibGVJbnNpZ2h0c0RhdGEgfTtcclxuICAgICAgICAgIGZpbmFsU3RhdHVzID0gJ0FOQUxZU0lTX0NPTVBMRVRFJztcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGBMZWFzZSBhbmFseXNpcyBzdWNjZXNzZnVsIGZvciAke2FuYWx5c2lzSWR9YCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgfSBjYXRjaCAoYWlFcnJvcjogYW55KSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgZHVyaW5nIEFJIHByb2Nlc3NpbmcgZm9yICR7YW5hbHlzaXNJZH06YCwgYWlFcnJvcik7XHJcbiAgICAgICAgZmluYWxTdGF0dXMgPSAnQUlfUFJPQ0VTU0lOR19GQUlMRUQnO1xyXG4gICAgICAgIGVycm9yRGV0YWlscyA9IGFpRXJyb3IubWVzc2FnZSB8fCBcIlVua25vd24gQUkgcHJvY2Vzc2luZyBlcnJvci5cIjtcclxuICAgICAgICBcclxuICAgICAgICAvLyBQYXJ0aWFsIHJlc3VsdHMgaGFuZGxpbmcgb25seSBhcHBsaWVzIHRvIGxlYXNlIGFuYWx5c2lzXHJcbiAgICAgICAgaWYgKGRvY3VtZW50VHlwZSAhPT0gJ0VWSUNUSU9OX05PVElDRScgJiYgYWlFcnJvci5wYXJ0aWFsUmVzdWx0cykge1xyXG4gICAgICAgICAgICAvLyBJZiBhY3Rpb25hYmxlIGluc2lnaHRzIGZhaWxlZCwgYnV0IGluaXRpYWwgYW5hbHlzaXMgc3VjY2VlZGVkIChsZWFzZSBvbmx5KVxyXG4gICAgICAgICAgICBmaW5hbFJlc3VsdHMgPSB7IC4uLihhaUVycm9yLnBhcnRpYWxSZXN1bHRzIGFzIEluaXRpYWxBbmFseXNpc1Jlc3VsdHMpLCBhY3Rpb25hYmxlSW5zaWdodHM6IHsgb3ZlcmFsbFJlY29tbWVuZGF0aW9uOiBcIlwiLCBuZXh0U3RlcHM6IFtdfSB9O1xyXG4gICAgICAgICAgICBmaW5hbFN0YXR1cyA9ICdQQVJUSUFMX0FOQUxZU0lTX0lOU0lHSFRTX0ZBSUxFRCc7XHJcbiAgICAgICAgICAgIGVycm9yRGV0YWlscyA9IGBJbnNpZ2h0czogJHtlcnJvckRldGFpbHN9YDtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFBhcnRpYWwgcmVzdWx0cyBzYXZlZCBmb3IgJHthbmFseXNpc0lkfSBkdWUgdG8gaW5zaWdodHMgZmFpbHVyZS5gKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIDQuIFVwZGF0ZSBEeW5hbW9EQiB3aXRoIGZpbmFsIHJlc3VsdHMvc3RhdHVzXHJcbiAgICAgIGNvbnNvbGUubG9nKGBVcGRhdGluZyBzdGF0dXMgdG8gJHtmaW5hbFN0YXR1c30gZm9yICR7YW5hbHlzaXNJZH1gKTtcclxuICAgICAgY29uc3QgdXBkYXRlRmluYWxQYXJhbXM6IGFueSA9IHtcclxuICAgICAgICBUYWJsZU5hbWU6IERZTkFNT0RCX1RBQkxFISxcclxuICAgICAgICBLZXk6IHsgYW5hbHlzaXNJZCB9LFxyXG4gICAgICAgIFVwZGF0ZUV4cHJlc3Npb246IFwic2V0ICNzdGF0dXMgPSA6c3RhdHVzLCAjYW5hbHlzaXNSZXN1bHRzID0gOmFuYWx5c2lzUmVzdWx0cywgI2xhc3RVcGRhdGVkVGltZXN0YW1wID0gOnRpbWVzdGFtcFwiLFxyXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xyXG4gICAgICAgICAgXCIjc3RhdHVzXCI6IFwic3RhdHVzXCIsXHJcbiAgICAgICAgICBcIiNhbmFseXNpc1Jlc3VsdHNcIjogXCJhbmFseXNpc1Jlc3VsdHNcIixcclxuICAgICAgICAgIFwiI2xhc3RVcGRhdGVkVGltZXN0YW1wXCI6IFwibGFzdFVwZGF0ZWRUaW1lc3RhbXBcIixcclxuICAgICAgICB9LFxyXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcclxuICAgICAgICAgIFwiOnN0YXR1c1wiOiBmaW5hbFN0YXR1cyxcclxuICAgICAgICAgIFwiOmFuYWx5c2lzUmVzdWx0c1wiOiBmaW5hbFJlc3VsdHMsIC8vIFN0b3JlIHRoZSBjb21iaW5lZCByZXN1bHRzXHJcbiAgICAgICAgICBcIjp0aW1lc3RhbXBcIjogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH07XHJcbiAgICAgIGlmIChlcnJvckRldGFpbHMpIHtcclxuICAgICAgICB1cGRhdGVGaW5hbFBhcmFtcy5VcGRhdGVFeHByZXNzaW9uICs9IFwiLCAjZXJyb3JEZXRhaWxzID0gOmVycm9yRGV0YWlsc1wiO1xyXG4gICAgICAgIHVwZGF0ZUZpbmFsUGFyYW1zLkV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lc1tcIiNlcnJvckRldGFpbHNcIl0gPSBcImVycm9yRGV0YWlsc1wiO1xyXG4gICAgICAgIHVwZGF0ZUZpbmFsUGFyYW1zLkV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXNbXCI6ZXJyb3JEZXRhaWxzXCJdID0gZXJyb3JEZXRhaWxzO1xyXG4gICAgICB9XHJcbiAgICAgIGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBVcGRhdGVDb21tYW5kKHVwZGF0ZUZpbmFsUGFyYW1zKSk7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBTdWNjZXNzZnVsbHkgcHJvY2Vzc2VkIGFuZCB1cGRhdGVkICR7YW5hbHlzaXNJZH0uIFN0YXR1czogJHtmaW5hbFN0YXR1c31gKTtcclxuXHJcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBwcm9jZXNzIFNRUyByZWNvcmQgZm9yIGFuYWx5c2lzSWQgJHthbmFseXNpc0lkIHx8ICd1bmtub3duJ306YCwgZXJyb3IpO1xyXG4gICAgICAvLyBJZiBhbmFseXNpc0lkIGlzIGtub3duIGFuZCBlcnJvciBpcyBub3QgZHVyaW5nIGZpbmFsIEREQiB1cGRhdGUsIHRyeSB0byB1cGRhdGUgRERCIHdpdGggZXJyb3Igc3RhdHVzXHJcbiAgICAgIGlmIChhbmFseXNpc0lkKSB7IFxyXG4gICAgICAgIGF3YWl0IHVwZGF0ZUR5bmFtb0RCT25FcnJvcihhbmFseXNpc0lkLCAnQUlfUFJPQ0VTU0lOR19GQUlMRUQnLCBlcnJvci5tZXNzYWdlIHx8ICdVbmtub3duIGVycm9yIGR1cmluZyBTUVMgcmVjb3JkIHByb2Nlc3NpbmcnKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufTtcclxuXHJcbi8vIEhlbHBlciBmdW5jdGlvbiB0byB1cGRhdGUgRHluYW1vREIgb24gZXJyb3IsIHRvIGF2b2lkIGNvZGUgZHVwbGljYXRpb24gaW4gY2F0Y2ggYmxvY2tzXHJcbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUR5bmFtb0RCT25FcnJvcihhbmFseXNpc0lkOiBzdHJpbmcsIHN0YXR1czogc3RyaW5nLCBlcnJvck1lc3NhZ2U6IHN0cmluZykge1xyXG4gICAgY29uc29sZS5sb2coYFVwZGF0aW5nIER5bmFtb0RCIGZvciAke2FuYWx5c2lzSWR9IHdpdGggZXJyb3Igc3RhdHVzICR7c3RhdHVzfSBkdWUgdG86ICR7ZXJyb3JNZXNzYWdlfWApO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBlcnJvclVwZGF0ZVBhcmFtcyA9IHtcclxuICAgICAgICAgICAgVGFibGVOYW1lOiBEWU5BTU9EQl9UQUJMRSEsXHJcbiAgICAgICAgICAgIEtleTogeyBhbmFseXNpc0lkIH0sXHJcbiAgICAgICAgICAgIFVwZGF0ZUV4cHJlc3Npb246IFwic2V0ICNzdGF0dXMgPSA6c3RhdHVzLCAjZXJyb3JEZXRhaWxzID0gOmVycm9yRGV0YWlscywgI2xhc3RVcGRhdGVkVGltZXN0YW1wID0gOnRpbWVzdGFtcFwiLFxyXG4gICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHsgXHJcbiAgICAgICAgICAgICAgICBcIiNzdGF0dXNcIjogXCJzdGF0dXNcIiwgXHJcbiAgICAgICAgICAgICAgICBcIiNlcnJvckRldGFpbHNcIjogXCJlcnJvckRldGFpbHNcIixcclxuICAgICAgICAgICAgICAgIFwiI2xhc3RVcGRhdGVkVGltZXN0YW1wXCI6IFwibGFzdFVwZGF0ZWRUaW1lc3RhbXBcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XHJcbiAgICAgICAgICAgICAgICBcIjpzdGF0dXNcIjogc3RhdHVzLFxyXG4gICAgICAgICAgICAgICAgXCI6ZXJyb3JEZXRhaWxzXCI6IGVycm9yTWVzc2FnZS5zdWJzdHJpbmcoMCwgMjAwMCksIC8vIENhcCBlcnJvciBtZXNzYWdlIGxlbmd0aFxyXG4gICAgICAgICAgICAgICAgXCI6dGltZXN0YW1wXCI6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9O1xyXG4gICAgICAgIGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBVcGRhdGVDb21tYW5kKGVycm9yVXBkYXRlUGFyYW1zKSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFN1Y2Nlc3NmdWxseSB1cGRhdGVkICR7YW5hbHlzaXNJZH0gd2l0aCBlcnJvciBzdGF0dXMuYCk7XHJcbiAgICB9IGNhdGNoIChkYkVycm9yKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBEeW5hbW9EQiB3aXRoIGVycm9yIHN0YXR1cyBmb3IgJHthbmFseXNpc0lkfTpgLCBkYkVycm9yKTtcclxuICAgICAgICAvLyBTd2FsbG93IHRoaXMgZXJyb3IgYXMgdGhlIG1haW4gZXJyb3IgaXMgYWxyZWFkeSBsb2dnZWQuXHJcbiAgICB9XHJcbn0gIl19