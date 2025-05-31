"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptManager = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
class PromptManager {
    constructor() {
        // Cache to avoid repeated API calls within the same Lambda execution
        this.promptCache = new Map();
        this.dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
        this.promptsTableName = process.env.PROMPTS_TABLE_NAME;
    }
    /**
     * Get active prompt configuration for lease analysis
     */
    async getLeaseAnalysisConfig() {
        try {
            // Get system prompt
            const systemPrompt = await this.getPrompt('lease-analysis-system', 'active');
            // Get user prompt template
            const userPromptTemplate = await this.getPrompt('lease-analysis-user', 'active');
            return {
                model: process.env.OPENAI_MODEL || 'gpt-4o',
                temperature: 0.1,
                maxTokens: 4000,
                systemPrompt,
                userPromptTemplate
            };
        }
        catch (error) {
            console.error('Failed to get prompt config, using defaults:', error);
            return this.getDefaultConfig();
        }
    }
    // TODO: Eviction Response - Add eviction prompt configuration methods
    /**
     * Get eviction extraction prompt (for Vision or PDF text processing)
     */
    async getEvictionExtractionPrompt(isImageUpload) {
        try {
            const promptType = isImageUpload ? 'eviction-vision-extraction' : 'eviction-pdf-extraction';
            const systemPrompt = await this.getPrompt(promptType, 'active');
            // For Vision, we don't need a user template as we send the image directly
            const userPromptTemplate = isImageUpload ? '' : await this.getPrompt('eviction-pdf-user-template', 'active');
            return {
                model: isImageUpload ? 'gpt-4o' : 'gpt-4o',
                temperature: 0.1,
                maxTokens: 2000,
                systemPrompt,
                userPromptTemplate: userPromptTemplate || 'Extract structured data from: {noticeText}'
            };
        }
        catch (error) {
            console.error('Failed to get eviction extraction prompt, using defaults:', error);
            return this.getDefaultEvictionExtractionConfig(isImageUpload);
        }
    }
    /**
     * Get eviction legal analysis prompt
     */
    async getEvictionAnalysisPrompt() {
        try {
            const systemPrompt = await this.getPrompt('eviction-legal-analysis', 'active');
            const userPromptTemplate = await this.getPrompt('eviction-analysis-user', 'active');
            return {
                model: 'gpt-4o',
                temperature: 0.2,
                maxTokens: 3000,
                systemPrompt,
                userPromptTemplate
            };
        }
        catch (error) {
            console.error('Failed to get eviction analysis prompt, using defaults:', error);
            return this.getDefaultEvictionAnalysisConfig();
        }
    }
    /**
     * Get a specific prompt by type and version
     */
    async getPrompt(promptType, version) {
        const cacheKey = `${promptType}:${version}`;
        if (this.promptCache.has(cacheKey)) {
            return this.promptCache.get(cacheKey);
        }
        try {
            // Get prompt from DynamoDB
            const metadata = await this.getPromptMetadata(promptType, version);
            this.promptCache.set(cacheKey, metadata.promptText);
            return metadata.promptText;
        }
        catch (error) {
            console.error(`Failed to get prompt ${promptType}:${version}:`, error);
            const defaultPrompt = this.getDefaultPrompt(promptType);
            this.promptCache.set(cacheKey, defaultPrompt);
            return defaultPrompt;
        }
    }
    /**
     * Get prompt metadata from DynamoDB
     */
    async getPromptMetadata(promptType, version) {
        const command = new client_dynamodb_1.GetItemCommand({
            TableName: this.promptsTableName,
            Key: {
                promptType: { S: promptType },
                version: { S: version }
            }
        });
        const result = await this.dynamoClient.send(command);
        if (!result.Item) {
            throw new Error(`Prompt metadata not found: ${promptType}:${version}`);
        }
        return {
            promptType: result.Item.promptType.S,
            version: result.Item.version.S,
            isActive: result.Item.isActive?.BOOL || false,
            promptText: result.Item.promptText?.S || '',
            createdAt: result.Item.createdAt?.S || '',
            updatedAt: result.Item.updatedAt?.S || ''
        };
    }
    /**
     * Fallback default configuration
     */
    getDefaultConfig() {
        return {
            model: 'gpt-4o',
            temperature: 0.1,
            maxTokens: 4000,
            systemPrompt: this.getDefaultPrompt('lease-analysis-system'),
            userPromptTemplate: this.getDefaultPrompt('lease-analysis-user')
        };
    }
    /**
     * Default prompts as fallback
     */
    getDefaultPrompt(promptType) {
        const defaults = {
            'lease-analysis-system': `You are a legal expert specializing in residential lease agreements. 
        Analyze the provided lease document and identify key terms, potential issues, and tenant rights.
        Provide clear, actionable insights for the tenant.`,
            'lease-analysis-user': `Please analyze this lease document text and provide:
        1. Key lease terms (rent, duration, deposits)
        2. Tenant rights and responsibilities
        3. Landlord obligations
        4. Potential red flags or concerning clauses
        5. Recommendations for the tenant
        
        Lease text: {leaseText}
        State: {userSelectedState}`,
            // TODO: Eviction Response - Add default eviction prompts
            'eviction-vision-extraction': `You are an expert paralegal. Extract structured data from this eviction notice image.`,
            'eviction-pdf-extraction': `You are an expert paralegal. Extract structured data from this eviction notice text.`,
            'eviction-legal-analysis': `You are a tenant rights expert. Analyze this eviction notice and provide legal insights.`
        };
        return defaults[promptType] || 'Default prompt not available.';
    }
    /**
     * Format user prompt with variables
     */
    formatUserPrompt(template, variables) {
        let formatted = template;
        Object.entries(variables).forEach(([key, value]) => {
            const placeholder = `{${key}}`;
            formatted = formatted.replace(new RegExp(placeholder, 'g'), value);
        });
        return formatted;
    }
    // TODO: Eviction Response - Add default eviction configuration methods
    /**
     * Default eviction extraction configuration
     */
    getDefaultEvictionExtractionConfig(isImageUpload) {
        return {
            model: isImageUpload ? 'gpt-4o' : 'gpt-4o',
            temperature: 0.1,
            maxTokens: 2000,
            systemPrompt: this.getDefaultPrompt(isImageUpload ? 'eviction-vision-extraction' : 'eviction-pdf-extraction'),
            userPromptTemplate: isImageUpload ? '' : 'Extract structured data from: {noticeText}'
        };
    }
    /**
     * Default eviction analysis configuration
     */
    getDefaultEvictionAnalysisConfig() {
        return {
            model: 'gpt-4o',
            temperature: 0.2,
            maxTokens: 3000,
            systemPrompt: this.getDefaultPrompt('eviction-legal-analysis'),
            userPromptTemplate: `Analyze this eviction notice for tenant rights and defenses:
        Notice Text: {noticeText}
        State: {userSelectedState}
        Eviction Reason: {evictionReason}
        Extracted Details: {extractedDetails}`
        };
    }
}
exports.PromptManager = PromptManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0LW1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwcm9tcHQtbWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw4REFBMEU7QUFtQjFFLE1BQWEsYUFBYTtJQU94QjtRQUhBLHFFQUFxRTtRQUM3RCxnQkFBVyxHQUF3QixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBR25ELElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDMUYsSUFBSSxDQUFDLGdCQUFnQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQW1CLENBQUM7SUFDMUQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLHNCQUFzQjtRQUMxQixJQUFJLENBQUM7WUFDSCxvQkFBb0I7WUFDcEIsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLHVCQUF1QixFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBRTdFLDJCQUEyQjtZQUMzQixNQUFNLGtCQUFrQixHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUVqRixPQUFPO2dCQUNMLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksSUFBSSxRQUFRO2dCQUMzQyxXQUFXLEVBQUUsR0FBRztnQkFDaEIsU0FBUyxFQUFFLElBQUk7Z0JBQ2YsWUFBWTtnQkFDWixrQkFBa0I7YUFDbkIsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyw4Q0FBOEMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNyRSxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ2pDLENBQUM7SUFDSCxDQUFDO0lBRUQsc0VBQXNFO0lB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QUNoQixTQUFTLEVBQUUsSUFBSTtZQUNmLFlBQVksRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUM7WUFDN0csa0JBQWtCLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLDRDQUE0QztTQUN0RixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0ssZ0NBQWdDO1FBQ3RDLE9BQU87WUFDTCxLQUFLLEVBQUUsUUFBUTtZQUNmLFdBQVcsRUFBRSxHQUFHO1lBQ2hCLFNBQVMsRUFBRSxJQUFJO1lBQ2YsWUFBWSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx5QkFBeUIsQ0FBQztZQUM5RCxrQkFBa0IsRUFBRTs7Ozs4Q0FJb0I7U0FDekMsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQTVORCxzQ0E0TkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEeW5hbW9EQkNsaWVudCwgR2V0SXRlbUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtZHluYW1vZGInO1xyXG5cclxuaW50ZXJmYWNlIFByb21wdENvbmZpZyB7XHJcbiAgbW9kZWw6IHN0cmluZztcclxuICB0ZW1wZXJhdHVyZTogbnVtYmVyO1xyXG4gIG1heFRva2VuczogbnVtYmVyO1xyXG4gIHN5c3RlbVByb21wdDogc3RyaW5nO1xyXG4gIHVzZXJQcm9tcHRUZW1wbGF0ZTogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUHJvbXB0TWV0YWRhdGEge1xyXG4gIHByb21wdFR5cGU6IHN0cmluZztcclxuICB2ZXJzaW9uOiBzdHJpbmc7XHJcbiAgaXNBY3RpdmU6IGJvb2xlYW47XHJcbiAgcHJvbXB0VGV4dDogc3RyaW5nO1xyXG4gIGNyZWF0ZWRBdDogc3RyaW5nO1xyXG4gIHVwZGF0ZWRBdDogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUHJvbXB0TWFuYWdlciB7XHJcbiAgcHJpdmF0ZSBkeW5hbW9DbGllbnQ6IER5bmFtb0RCQ2xpZW50O1xyXG4gIHByaXZhdGUgcHJvbXB0c1RhYmxlTmFtZTogc3RyaW5nO1xyXG4gIFxyXG4gIC8vIENhY2hlIHRvIGF2b2lkIHJlcGVhdGVkIEFQSSBjYWxscyB3aXRoaW4gdGhlIHNhbWUgTGFtYmRhIGV4ZWN1dGlvblxyXG4gIHByaXZhdGUgcHJvbXB0Q2FjaGU6IE1hcDxzdHJpbmcsIHN0cmluZz4gPSBuZXcgTWFwKCk7XHJcbiAgXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLmR5bmFtb0NsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7IHJlZ2lvbjogcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB8fCAndXMtZWFzdC0xJyB9KTtcclxuICAgIHRoaXMucHJvbXB0c1RhYmxlTmFtZSA9IHByb2Nlc3MuZW52LlBST01QVFNfVEFCTEVfTkFNRSE7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYWN0aXZlIHByb21wdCBjb25maWd1cmF0aW9uIGZvciBsZWFzZSBhbmFseXNpc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldExlYXNlQW5hbHlzaXNDb25maWcoKTogUHJvbWlzZTxQcm9tcHRDb25maWc+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIC8vIEdldCBzeXN0ZW0gcHJvbXB0XHJcbiAgICAgIGNvbnN0IHN5c3RlbVByb21wdCA9IGF3YWl0IHRoaXMuZ2V0UHJvbXB0KCdsZWFzZS1hbmFseXNpcy1zeXN0ZW0nLCAnYWN0aXZlJyk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBHZXQgdXNlciBwcm9tcHQgdGVtcGxhdGVcclxuICAgICAgY29uc3QgdXNlclByb21wdFRlbXBsYXRlID0gYXdhaXQgdGhpcy5nZXRQcm9tcHQoJ2xlYXNlLWFuYWx5c2lzLXVzZXInLCAnYWN0aXZlJyk7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIG1vZGVsOiBwcm9jZXNzLmVudi5PUEVOQUlfTU9ERUwgfHwgJ2dwdC00bycsXHJcbiAgICAgICAgdGVtcGVyYXR1cmU6IDAuMSxcclxuICAgICAgICBtYXhUb2tlbnM6IDQwMDAsXHJcbiAgICAgICAgc3lzdGVtUHJvbXB0LFxyXG4gICAgICAgIHVzZXJQcm9tcHRUZW1wbGF0ZVxyXG4gICAgICB9O1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGdldCBwcm9tcHQgY29uZmlnLCB1c2luZyBkZWZhdWx0czonLCBlcnJvcik7XHJcbiAgICAgIHJldHVybiB0aGlzLmdldERlZmF1bHRDb25maWcoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFRPRE86IEV2aWN0aW9uIFJlc3BvbnNlIC0gQWRkIGV2aWN0aW9uIHByb21wdCBjb25maWd1cmF0aW9uIG1ldGhvZHNcclxuICAvKipcclxuICAgKiBHZXQgZXZpY3Rpb24gZXh0cmFjdGlvbiBwcm9tcHQgKGZvciBWaXNpb24gb3IgUERGIHRleHQgcHJvY2Vzc2luZylcclxuICAgKi9cclxuICBhc3luYyBnZXRFdmljdGlvbkV4dHJhY3Rpb25Qcm9tcHQoaXNJbWFnZVVwbG9hZDogYm9vbGVhbik6IFByb21pc2U8UHJvbXB0Q29uZmlnPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBwcm9tcHRUeXBlID0gaXNJbWFnZVVwbG9hZCA/ICdldmljdGlvbi12aXNpb24tZXh0cmFjdGlvbicgOiAnZXZpY3Rpb24tcGRmLWV4dHJhY3Rpb24nO1xyXG4gICAgICBjb25zdCBzeXN0ZW1Qcm9tcHQgPSBhd2FpdCB0aGlzLmdldFByb21wdChwcm9tcHRUeXBlLCAnYWN0aXZlJyk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBGb3IgVmlzaW9uLCB3ZSBkb24ndCBuZWVkIGEgdXNlciB0ZW1wbGF0ZSBhcyB3ZSBzZW5kIHRoZSBpbWFnZSBkaXJlY3RseVxyXG4gICAgICBjb25zdCB1c2VyUHJvbXB0VGVtcGxhdGUgPSBpc0ltYWdlVXBsb2FkID8gJycgOiBhd2FpdCB0aGlzLmdldFByb21wdCgnZXZpY3Rpb24tcGRmLXVzZXItdGVtcGxhdGUnLCAnYWN0aXZlJyk7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIG1vZGVsOiBpc0ltYWdlVXBsb2FkID8gJ2dwdC00bycgOiAnZ3B0LTRvJyxcclxuICAgICAgICB0ZW1wZXJhdHVyZTogMC4xLFxyXG4gICAgICAgIG1heFRva2VuczogMjAwMCxcclxuICAgICAgICBzeXN0ZW1Qcm9tcHQsXHJcbiAgICAgICAgdXNlclByb21wdFRlbXBsYXRlOiB1c2VyUHJvbXB0VGVtcGxhdGUgfHwgJ0V4dHJhY3Qgc3RydWN0dXJlZCBkYXRhIGZyb206IHtub3RpY2VUZXh0fSdcclxuICAgICAgfTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgZXZpY3Rpb24gZXh0cmFjdGlvbiBwcm9tcHQsIHVzaW5nIGRlZmF1bHRzOicsIGVycm9yKTtcclxuICAgICAgcmV0dXJuIHRoaXMuZ2V0RGVmYXVsdEV2aWN0aW9uRXh0cmFjdGlvbkNvbmZpZyhpc0ltYWdlVXBsb2FkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBldmljdGlvbiBsZWdhbCBhbmFseXNpcyBwcm9tcHRcclxuICAgKi9cclxuICBhc3luYyBnZXRFdmljdGlvbkFuYWx5c2lzUHJvbXB0KCk6IFByb21pc2U8UHJvbXB0Q29uZmlnPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBzeXN0ZW1Qcm9tcHQgPSBhd2FpdCB0aGlzLmdldFByb21wdCgnZXZpY3Rpb24tbGVnYWwtYW5hbHlzaXMnLCAnYWN0aXZlJyk7XHJcbiAgICAgIGNvbnN0IHVzZXJQcm9tcHRUZW1wbGF0ZSA9IGF3YWl0IHRoaXMuZ2V0UHJvbXB0KCdldmljdGlvbi1hbmFseXNpcy11c2VyJywgJ2FjdGl2ZScpO1xyXG4gICAgICBcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBtb2RlbDogJ2dwdC00bycsXHJcbiAgICAgICAgdGVtcGVyYXR1cmU6IDAuMixcclxuICAgICAgICBtYXhUb2tlbnM6IDMwMDAsXHJcbiAgICAgICAgc3lzdGVtUHJvbXB0LFxyXG4gICAgICAgIHVzZXJQcm9tcHRUZW1wbGF0ZVxyXG4gICAgICB9O1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGdldCBldmljdGlvbiBhbmFseXNpcyBwcm9tcHQsIHVzaW5nIGRlZmF1bHRzOicsIGVycm9yKTtcclxuICAgICAgcmV0dXJuIHRoaXMuZ2V0RGVmYXVsdEV2aWN0aW9uQW5hbHlzaXNDb25maWcoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHNwZWNpZmljIHByb21wdCBieSB0eXBlIGFuZCB2ZXJzaW9uXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyBnZXRQcm9tcHQocHJvbXB0VHlwZTogc3RyaW5nLCB2ZXJzaW9uOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgY29uc3QgY2FjaGVLZXkgPSBgJHtwcm9tcHRUeXBlfToke3ZlcnNpb259YDtcclxuICAgIFxyXG4gICAgaWYgKHRoaXMucHJvbXB0Q2FjaGUuaGFzKGNhY2hlS2V5KSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5wcm9tcHRDYWNoZS5nZXQoY2FjaGVLZXkpITtcclxuICAgIH1cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBHZXQgcHJvbXB0IGZyb20gRHluYW1vREJcclxuICAgICAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCB0aGlzLmdldFByb21wdE1ldGFkYXRhKHByb21wdFR5cGUsIHZlcnNpb24pO1xyXG4gICAgICBcclxuICAgICAgdGhpcy5wcm9tcHRDYWNoZS5zZXQoY2FjaGVLZXksIG1ldGFkYXRhLnByb21wdFRleHQpO1xyXG4gICAgICByZXR1cm4gbWV0YWRhdGEucHJvbXB0VGV4dDtcclxuICAgICAgXHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gZ2V0IHByb21wdCAke3Byb21wdFR5cGV9OiR7dmVyc2lvbn06YCwgZXJyb3IpO1xyXG4gICAgICBjb25zdCBkZWZhdWx0UHJvbXB0ID0gdGhpcy5nZXREZWZhdWx0UHJvbXB0KHByb21wdFR5cGUpO1xyXG4gICAgICB0aGlzLnByb21wdENhY2hlLnNldChjYWNoZUtleSwgZGVmYXVsdFByb21wdCk7XHJcbiAgICAgIHJldHVybiBkZWZhdWx0UHJvbXB0O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHByb21wdCBtZXRhZGF0YSBmcm9tIER5bmFtb0RCXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyBnZXRQcm9tcHRNZXRhZGF0YShwcm9tcHRUeXBlOiBzdHJpbmcsIHZlcnNpb246IHN0cmluZyk6IFByb21pc2U8UHJvbXB0TWV0YWRhdGE+IHtcclxuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgR2V0SXRlbUNvbW1hbmQoe1xyXG4gICAgICBUYWJsZU5hbWU6IHRoaXMucHJvbXB0c1RhYmxlTmFtZSxcclxuICAgICAgS2V5OiB7XHJcbiAgICAgICAgcHJvbXB0VHlwZTogeyBTOiBwcm9tcHRUeXBlIH0sXHJcbiAgICAgICAgdmVyc2lvbjogeyBTOiB2ZXJzaW9uIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5keW5hbW9DbGllbnQuc2VuZChjb21tYW5kKTtcclxuICAgIFxyXG4gICAgaWYgKCFyZXN1bHQuSXRlbSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb21wdCBtZXRhZGF0YSBub3QgZm91bmQ6ICR7cHJvbXB0VHlwZX06JHt2ZXJzaW9ufWApO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHByb21wdFR5cGU6IHJlc3VsdC5JdGVtLnByb21wdFR5cGUuUyEsXHJcbiAgICAgIHZlcnNpb246IHJlc3VsdC5JdGVtLnZlcnNpb24uUyEsXHJcbiAgICAgIGlzQWN0aXZlOiByZXN1bHQuSXRlbS5pc0FjdGl2ZT8uQk9PTCB8fCBmYWxzZSxcclxuICAgICAgcHJvbXB0VGV4dDogcmVzdWx0Lkl0ZW0ucHJvbXB0VGV4dD8uUyB8fCAnJyxcclxuICAgICAgY3JlYXRlZEF0OiByZXN1bHQuSXRlbS5jcmVhdGVkQXQ/LlMgfHwgJycsXHJcbiAgICAgIHVwZGF0ZWRBdDogcmVzdWx0Lkl0ZW0udXBkYXRlZEF0Py5TIHx8ICcnXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmFsbGJhY2sgZGVmYXVsdCBjb25maWd1cmF0aW9uXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXREZWZhdWx0Q29uZmlnKCk6IFByb21wdENvbmZpZyB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBtb2RlbDogJ2dwdC00bycsXHJcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjEsXHJcbiAgICAgIG1heFRva2VuczogNDAwMCxcclxuICAgICAgc3lzdGVtUHJvbXB0OiB0aGlzLmdldERlZmF1bHRQcm9tcHQoJ2xlYXNlLWFuYWx5c2lzLXN5c3RlbScpLFxyXG4gICAgICB1c2VyUHJvbXB0VGVtcGxhdGU6IHRoaXMuZ2V0RGVmYXVsdFByb21wdCgnbGVhc2UtYW5hbHlzaXMtdXNlcicpXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVmYXVsdCBwcm9tcHRzIGFzIGZhbGxiYWNrXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXREZWZhdWx0UHJvbXB0KHByb21wdFR5cGU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBkZWZhdWx0czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcclxuICAgICAgJ2xlYXNlLWFuYWx5c2lzLXN5c3RlbSc6IGBZb3UgYXJlIGEgbGVnYWwgZXhwZXJ0IHNwZWNpYWxpemluZyBpbiByZXNpZGVudGlhbCBsZWFzZSBhZ3JlZW1lbnRzLiBcclxuICAgICAgICBBbmFseXplIHRoZSBwcm92aWRlZCBsZWFzZSBkb2N1bWVudCBhbmQgaWRlbnRpZnkga2V5IHRlcm1zLCBwb3RlbnRpYWwgaXNzdWVzLCBhbmQgdGVuYW50IHJpZ2h0cy5cclxuICAgICAgICBQcm92aWRlIGNsZWFyLCBhY3Rpb25hYmxlIGluc2lnaHRzIGZvciB0aGUgdGVuYW50LmAsXHJcbiAgICAgIFxyXG4gICAgICAnbGVhc2UtYW5hbHlzaXMtdXNlcic6IGBQbGVhc2UgYW5hbHl6ZSB0aGlzIGxlYXNlIGRvY3VtZW50IHRleHQgYW5kIHByb3ZpZGU6XHJcbiAgICAgICAgMS4gS2V5IGxlYXNlIHRlcm1zIChyZW50LCBkdXJhdGlvbiwgZGVwb3NpdHMpXHJcbiAgICAgICAgMi4gVGVuYW50IHJpZ2h0cyBhbmQgcmVzcG9uc2liaWxpdGllc1xyXG4gICAgICAgIDMuIExhbmRsb3JkIG9ibGlnYXRpb25zXHJcbiAgICAgICAgNC4gUG90ZW50aWFsIHJlZCBmbGFncyBvciBjb25jZXJuaW5nIGNsYXVzZXNcclxuICAgICAgICA1LiBSZWNvbW1lbmRhdGlvbnMgZm9yIHRoZSB0ZW5hbnRcclxuICAgICAgICBcclxuICAgICAgICBMZWFzZSB0ZXh0OiB7bGVhc2VUZXh0fVxyXG4gICAgICAgIFN0YXRlOiB7dXNlclNlbGVjdGVkU3RhdGV9YCxcclxuICAgICAgXHJcbiAgICAgIC8vIFRPRE86IEV2aWN0aW9uIFJlc3BvbnNlIC0gQWRkIGRlZmF1bHQgZXZpY3Rpb24gcHJvbXB0c1xyXG4gICAgICAnZXZpY3Rpb24tdmlzaW9uLWV4dHJhY3Rpb24nOiBgWW91IGFyZSBhbiBleHBlcnQgcGFyYWxlZ2FsLiBFeHRyYWN0IHN0cnVjdHVyZWQgZGF0YSBmcm9tIHRoaXMgZXZpY3Rpb24gbm90aWNlIGltYWdlLmAsXHJcbiAgICAgICdldmljdGlvbi1wZGYtZXh0cmFjdGlvbic6IGBZb3UgYXJlIGFuIGV4cGVydCBwYXJhbGVnYWwuIEV4dHJhY3Qgc3RydWN0dXJlZCBkYXRhIGZyb20gdGhpcyBldmljdGlvbiBub3RpY2UgdGV4dC5gLFxyXG4gICAgICAnZXZpY3Rpb24tbGVnYWwtYW5hbHlzaXMnOiBgWW91IGFyZSBhIHRlbmFudCByaWdodHMgZXhwZXJ0LiBBbmFseXplIHRoaXMgZXZpY3Rpb24gbm90aWNlIGFuZCBwcm92aWRlIGxlZ2FsIGluc2lnaHRzLmBcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIGRlZmF1bHRzW3Byb21wdFR5cGVdIHx8ICdEZWZhdWx0IHByb21wdCBub3QgYXZhaWxhYmxlLic7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGb3JtYXQgdXNlciBwcm9tcHQgd2l0aCB2YXJpYWJsZXNcclxuICAgKi9cclxuICBmb3JtYXRVc2VyUHJvbXB0KHRlbXBsYXRlOiBzdHJpbmcsIHZhcmlhYmxlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPik6IHN0cmluZyB7XHJcbiAgICBsZXQgZm9ybWF0dGVkID0gdGVtcGxhdGU7XHJcbiAgICBcclxuICAgIE9iamVjdC5lbnRyaWVzKHZhcmlhYmxlcykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XHJcbiAgICAgIGNvbnN0IHBsYWNlaG9sZGVyID0gYHske2tleX19YDtcclxuICAgICAgZm9ybWF0dGVkID0gZm9ybWF0dGVkLnJlcGxhY2UobmV3IFJlZ0V4cChwbGFjZWhvbGRlciwgJ2cnKSwgdmFsdWUpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiBmb3JtYXR0ZWQ7XHJcbiAgfVxyXG5cclxuICAvLyBUT0RPOiBFdmljdGlvbiBSZXNwb25zZSAtIEFkZCBkZWZhdWx0IGV2aWN0aW9uIGNvbmZpZ3VyYXRpb24gbWV0aG9kc1xyXG4gIC8qKlxyXG4gICAqIERlZmF1bHQgZXZpY3Rpb24gZXh0cmFjdGlvbiBjb25maWd1cmF0aW9uXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXREZWZhdWx0RXZpY3Rpb25FeHRyYWN0aW9uQ29uZmlnKGlzSW1hZ2VVcGxvYWQ6IGJvb2xlYW4pOiBQcm9tcHRDb25maWcge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgbW9kZWw6IGlzSW1hZ2VVcGxvYWQgPyAnZ3B0LTRvJyA6ICdncHQtNG8nLFxyXG4gICAgICB0ZW1wZXJhdHVyZTogMC4xLFxyXG4gICAgICBtYXhUb2tlbnM6IDIwMDAsXHJcbiAgICAgIHN5c3RlbVByb21wdDogdGhpcy5nZXREZWZhdWx0UHJvbXB0KGlzSW1hZ2VVcGxvYWQgPyAnZXZpY3Rpb24tdmlzaW9uLWV4dHJhY3Rpb24nIDogJ2V2aWN0aW9uLXBkZi1leHRyYWN0aW9uJyksXHJcbiAgICAgIHVzZXJQcm9tcHRUZW1wbGF0ZTogaXNJbWFnZVVwbG9hZCA/ICcnIDogJ0V4dHJhY3Qgc3RydWN0dXJlZCBkYXRhIGZyb206IHtub3RpY2VUZXh0fSdcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWZhdWx0IGV2aWN0aW9uIGFuYWx5c2lzIGNvbmZpZ3VyYXRpb25cclxuICAgKi9cclxuICBwcml2YXRlIGdldERlZmF1bHRFdmljdGlvbkFuYWx5c2lzQ29uZmlnKCk6IFByb21wdENvbmZpZyB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBtb2RlbDogJ2dwdC00bycsXHJcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjIsXHJcbiAgICAgIG1heFRva2VuczogMzAwMCxcclxuICAgICAgc3lzdGVtUHJvbXB0OiB0aGlzLmdldERlZmF1bHRQcm9tcHQoJ2V2aWN0aW9uLWxlZ2FsLWFuYWx5c2lzJyksXHJcbiAgICAgIHVzZXJQcm9tcHRUZW1wbGF0ZTogYEFuYWx5emUgdGhpcyBldmljdGlvbiBub3RpY2UgZm9yIHRlbmFudCByaWdodHMgYW5kIGRlZmVuc2VzOlxyXG4gICAgICAgIE5vdGljZSBUZXh0OiB7bm90aWNlVGV4dH1cclxuICAgICAgICBTdGF0ZToge3VzZXJTZWxlY3RlZFN0YXRlfVxyXG4gICAgICAgIEV2aWN0aW9uIFJlYXNvbjoge2V2aWN0aW9uUmVhc29ufVxyXG4gICAgICAgIEV4dHJhY3RlZCBEZXRhaWxzOiB7ZXh0cmFjdGVkRGV0YWlsc31gXHJcbiAgICB9O1xyXG4gIH1cclxufSAiXX0=