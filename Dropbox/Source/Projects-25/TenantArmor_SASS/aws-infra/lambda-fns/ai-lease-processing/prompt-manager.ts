import { DynamoDBClient, GetItemCommand, BatchGetItemCommand } from '@aws-sdk/client-dynamodb';

interface PromptConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userPromptTemplate: string;
}

interface PromptMetadata {
  promptType: string;
  version: string;
  isActive: boolean;
  promptText: string;
  createdAt: string;
  updatedAt: string;
}

// TODO: Eviction Response - Add template-specific interfaces
interface EvictionTemplate {
  state: string;
  reason: string;
  templateType: 'response' | 'meta';
  content: string;
  metadata?: EvictionTemplateMetadata;
}

interface EvictionTemplateMetadata {
  courtInstructions: string;
  legalAidContacts: Array<{
    name: string;
    phone?: string;
    url?: string;
    notes?: string;
  }>;
}

interface BatchTemplateRequest {
  state: string;
  reason: string;
  templateTypes: ('response' | 'meta')[];
}

export class PromptManager {
  private dynamoClient: DynamoDBClient;
  private promptsTableName: string;
  
  // Enhanced caching for prompts and templates
  private promptCache: Map<string, string> = new Map();
  private templateCache: Map<string, EvictionTemplate> = new Map();
  private batchLoadedStates: Set<string> = new Set(); // Track which state/reason combos are loaded
  
  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.promptsTableName = process.env.PROMPTS_TABLE_NAME!;
  }

  /**
   * Get active prompt configuration for lease analysis
   */
  async getLeaseAnalysisConfig(): Promise<PromptConfig> {
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
    } catch (error) {
      console.error('Failed to get prompt config, using defaults:', error);
      return this.getDefaultConfig();
    }
  }

  // TODO: Eviction Response - Add eviction prompt configuration methods
  /**
   * Get eviction extraction prompt (for Vision or PDF text processing)
   */
  async getEvictionExtractionPrompt(isImageUpload: boolean): Promise<PromptConfig> {
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
    } catch (error) {
      console.error('Failed to get eviction extraction prompt, using defaults:', error);
      return this.getDefaultEvictionExtractionConfig(isImageUpload);
    }
  }

  /**
   * Get eviction legal analysis prompt
   */
  async getEvictionAnalysisPrompt(): Promise<PromptConfig> {
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
    } catch (error) {
      console.error('Failed to get eviction analysis prompt, using defaults:', error);
      return this.getDefaultEvictionAnalysisConfig();
    }
  }

  // TODO: Eviction Response - Template Management Methods

  /**
   * Get a single eviction template (response letter or metadata)
   * Supports caching for efficiency
   */
  async getEvictionTemplate(state: string, reason: string, templateType: 'response' | 'meta'): Promise<EvictionTemplate> {
    const cacheKey = `template:${state}:${reason}:${templateType}`;
    
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    try {
      const template = await this.fetchTemplateFromDB(state, reason, templateType);
      this.templateCache.set(cacheKey, template);
      return template;
    } catch (error) {
      console.error(`Failed to get template ${state}/${reason}/${templateType}:`, error);
      // Return fallback template
      const fallbackTemplate = this.getFallbackTemplate(state, reason, templateType);
      this.templateCache.set(cacheKey, fallbackTemplate);
      return fallbackTemplate;
    }
  }

  /**
   * Batch load templates for multiple state/reason combinations
   * Critical for batch processing during data acquisition
   */
  async batchLoadTemplates(requests: BatchTemplateRequest[]): Promise<Map<string, EvictionTemplate>> {
    console.log(`(PromptManager) Batch loading templates for ${requests.length} requests`);
    
    const templates = new Map<string, EvictionTemplate>();
    const dbRequests: Array<{ state: string, reason: string, templateType: 'response' | 'meta' }> = [];
    
    // Check cache first, collect missing templates
    for (const request of requests) {
      for (const templateType of request.templateTypes) {
        const cacheKey = `template:${request.state}:${request.reason}:${templateType}`;
        
        if (this.templateCache.has(cacheKey)) {
          templates.set(cacheKey, this.templateCache.get(cacheKey)!);
        } else {
          dbRequests.push({ state: request.state, reason: request.reason, templateType });
        }
      }
    }
    
    // Batch fetch missing templates from DynamoDB
    if (dbRequests.length > 0) {
      console.log(`(PromptManager) Fetching ${dbRequests.length} templates from DynamoDB`);
      const batchResults = await this.batchFetchTemplatesFromDB(dbRequests);
      
      // Add to cache and results
      for (const [key, template] of batchResults) {
        this.templateCache.set(key, template);
        templates.set(key, template);
      }
    }
    
    console.log(`(PromptManager) Batch loaded ${templates.size} templates (${this.templateCache.size} cached total)`);
    return templates;
  }

  /**
   * Pre-warm template cache with commonly used templates
   * Call this at Lambda initialization for batch processing
   */
  async preWarmTemplateCache(states: string[] = ['CA', 'NY', 'TX'], reasons: string[] = ['non-payment']): Promise<void> {
    console.log(`(PromptManager) Pre-warming template cache for states: ${states.join(', ')}, reasons: ${reasons.join(', ')}`);
    
    const requests: BatchTemplateRequest[] = [];
    for (const state of states) {
      for (const reason of reasons) {
        requests.push({
          state,
          reason,
          templateTypes: ['response', 'meta']
        });
      }
    }
    
    await this.batchLoadTemplates(requests);
    console.log(`(PromptManager) Template cache pre-warmed with ${this.templateCache.size} templates`);
  }

  /**
   * Clear template cache (useful for testing or memory management)
   */
  clearTemplateCache(): void {
    this.templateCache.clear();
    this.batchLoadedStates.clear();
    console.log('(PromptManager) Template cache cleared');
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { promptCacheSize: number, templateCacheSize: number, preloadedStates: number } {
    return {
      promptCacheSize: this.promptCache.size,
      templateCacheSize: this.templateCache.size,
      preloadedStates: this.batchLoadedStates.size
    };
  }

  /**
   * Fetch a single template from DynamoDB
   */
  private async fetchTemplateFromDB(state: string, reason: string, templateType: 'response' | 'meta'): Promise<EvictionTemplate> {
    const promptId = `eviction_template_${state}_${reason}_${templateType}`;
    
    const command = new GetItemCommand({
      TableName: this.promptsTableName,
      Key: {
        promptId: { S: promptId },
        version: { S: 'active' }
      }
    });

    const result = await this.dynamoClient.send(command);
    
    if (!result.Item) {
      throw new Error(`Template not found: ${promptId}`);
    }

    const content = result.Item.content?.S || result.Item.promptText?.S || '';
    const metadata = result.Item.metadata?.S ? JSON.parse(result.Item.metadata.S) : undefined;

    return {
      state,
      reason,
      templateType,
      content,
      metadata
    };
  }

  /**
   * Batch fetch templates from DynamoDB using BatchGetItem
   */
  private async batchFetchTemplatesFromDB(
    requests: Array<{ state: string, reason: string, templateType: 'response' | 'meta' }>
  ): Promise<Map<string, EvictionTemplate>> {
    
    const results = new Map<string, EvictionTemplate>();
    
    // DynamoDB BatchGetItem has a limit of 100 items, so we may need to chunk
    const chunks = this.chunkArray(requests, 100);
    
    for (const chunk of chunks) {
      const requestItems: any = {};
      requestItems[this.promptsTableName] = {
        Keys: chunk.map(req => ({
          promptId: { S: `eviction_template_${req.state}_${req.reason}_${req.templateType}` },
          version: { S: 'active' }
        }))
      };

      try {
        const command = new BatchGetItemCommand({ RequestItems: requestItems });
        const result = await this.dynamoClient.send(command);
        
        if (result.Responses && result.Responses[this.promptsTableName]) {
          for (const item of result.Responses[this.promptsTableName]) {
            const promptId = item.promptId?.S || '';
            const [, , state, reason, templateType] = promptId.split('_');
            
            const template: EvictionTemplate = {
              state,
              reason,
              templateType: templateType as 'response' | 'meta',
              content: item.content?.S || item.promptText?.S || '',
              metadata: item.metadata?.S ? JSON.parse(item.metadata.S) : undefined
            };
            
            const cacheKey = `template:${state}:${reason}:${templateType}`;
            results.set(cacheKey, template);
          }
        }
        
        // Handle unprocessed keys (rate limiting, etc.)
        if (result.UnprocessedKeys && Object.keys(result.UnprocessedKeys).length > 0) {
          console.warn('(PromptManager) Some templates were not fetched due to unprocessed keys:', result.UnprocessedKeys);
          // TODO: Implement retry logic for unprocessed keys
        }
        
      } catch (error) {
        console.error('(PromptManager) Error in batch fetch:', error);
        // Create fallback templates for failed requests
        for (const req of chunk) {
          const cacheKey = `template:${req.state}:${req.reason}:${req.templateType}`;
          if (!results.has(cacheKey)) {
            results.set(cacheKey, this.getFallbackTemplate(req.state, req.reason, req.templateType));
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Get fallback template when DynamoDB fetch fails
   */
  private getFallbackTemplate(state: string, reason: string, templateType: 'response' | 'meta'): EvictionTemplate {
    if (templateType === 'response') {
      return {
        state,
        reason,
        templateType,
        content: `[tenantName]
[tenantAddress]

[Date]

[landlordName]
[landlordAddress]

RE: Response to Eviction Notice

Dear [landlordName],

I am writing in response to the eviction notice dated [noticeDate] regarding [propertyAddress].

I dispute this eviction notice and intend to defend my rights in court.

Sincerely,
[tenantName]

IMPORTANT: This is a fallback template. Please consult with a tenant rights attorney.`
      };
    } else {
      return {
        state,
        reason,
        templateType,
        content: '',
        metadata: {
          courtInstructions: `File your response at the appropriate court in ${state}. Consult local court rules for specific procedures.`,
          legalAidContacts: [
            {
              name: `${state} Legal Aid`,
              phone: 'Contact local legal aid for assistance',
              notes: 'This is a fallback contact. Please find local legal aid resources.'
            }
          ]
        }
      };
    }
  }

  /**
   * Utility function to chunk arrays for batch processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get a specific prompt by type and version
   */
  private async getPrompt(promptType: string, version: string): Promise<string> {
    const cacheKey = `${promptType}:${version}`;
    
    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey)!;
    }

    try {
      // Get prompt from DynamoDB
      const metadata = await this.getPromptMetadata(promptType, version);
      
      this.promptCache.set(cacheKey, metadata.promptText);
      return metadata.promptText;
      
    } catch (error) {
      console.error(`Failed to get prompt ${promptType}:${version}:`, error);
      const defaultPrompt = this.getDefaultPrompt(promptType);
      this.promptCache.set(cacheKey, defaultPrompt);
      return defaultPrompt;
    }
  }

  /**
   * Get prompt metadata from DynamoDB
   */
  private async getPromptMetadata(promptType: string, version: string): Promise<PromptMetadata> {
    const command = new GetItemCommand({
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
      promptType: result.Item.promptType.S!,
      version: result.Item.version.S!,
      isActive: result.Item.isActive?.BOOL || false,
      promptText: result.Item.promptText?.S || '',
      createdAt: result.Item.createdAt?.S || '',
      updatedAt: result.Item.updatedAt?.S || ''
    };
  }

  /**
   * Fallback default configuration
   */
  private getDefaultConfig(): PromptConfig {
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
  private getDefaultPrompt(promptType: string): string {
    const defaults: Record<string, string> = {
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
  formatUserPrompt(template: string, variables: Record<string, string>): string {
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
  private getDefaultEvictionExtractionConfig(isImageUpload: boolean): PromptConfig {
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
  private getDefaultEvictionAnalysisConfig(): PromptConfig {
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