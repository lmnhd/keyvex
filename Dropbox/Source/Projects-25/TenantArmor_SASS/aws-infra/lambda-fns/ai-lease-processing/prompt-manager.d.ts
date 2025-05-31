interface PromptConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    userPromptTemplate: string;
}
export declare class PromptManager {
    private dynamoClient;
    private promptsTableName;
    private promptCache;
    constructor();
    /**
     * Get active prompt configuration for lease analysis
     */
    getLeaseAnalysisConfig(): Promise<PromptConfig>;
    /**
     * Get eviction extraction prompt (for Vision or PDF text processing)
     */
    getEvictionExtractionPrompt(isImageUpload: boolean): Promise<PromptConfig>;
    /**
     * Get eviction legal analysis prompt
     */
    getEvictionAnalysisPrompt(): Promise<PromptConfig>;
    /**
     * Get a specific prompt by type and version
     */
    private getPrompt;
    /**
     * Get prompt metadata from DynamoDB
     */
    private getPromptMetadata;
    /**
     * Fallback default configuration
     */
    private getDefaultConfig;
    /**
     * Default prompts as fallback
     */
    private getDefaultPrompt;
    /**
     * Format user prompt with variables
     */
    formatUserPrompt(template: string, variables: Record<string, string>): string;
    /**
     * Default eviction extraction configuration
     */
    private getDefaultEvictionExtractionConfig;
    /**
     * Default eviction analysis configuration
     */
    private getDefaultEvictionAnalysisConfig;
}
export {};
