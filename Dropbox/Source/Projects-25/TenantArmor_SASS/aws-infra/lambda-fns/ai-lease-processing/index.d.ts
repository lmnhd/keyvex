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
export interface AIAnalysisResults extends InitialAnalysisResults, ActionableInsightsData {
}
export interface ExtractedEvictionDetails {
    landlordName?: string;
    tenantName?: string;
    noticeDate?: string;
    deadlineDate?: string;
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
export declare const handler: (event: any, context: any) => Promise<void>;
