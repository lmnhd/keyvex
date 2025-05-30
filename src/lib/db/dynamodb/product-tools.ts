// Product Tool DynamoDB Service
// Note: AWS SDK dependencies need to be installed: npm install @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb

import { 
  ProductToolDefinition, 
  ProductToolRecord, 
  ProductToolUsageRecord, 
  ProductToolSearchIndex,
  ProductToolSummary,
  ProductToolStatus,
  ProductToolType,
  ProductToolListResponse,
  ProductToolAnalytics
} from '@/lib/types/product-tool';

// ============================================================================
// MOCK DYNAMODB IMPLEMENTATION (until AWS SDK is installed)
// ============================================================================

// TODO: Replace with actual AWS SDK imports once installed:
// import { DynamoDBClient, ... } from '@aws-sdk/client-dynamodb';
// import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

interface DynamoDBClientConfig {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

class MockDynamoDBClient {
  constructor(config: DynamoDBClientConfig) {
    // Mock implementation
  }
  
  async send(command: any): Promise<any> {
    // Mock implementation - would actually send to DynamoDB
    console.log('Mock DynamoDB operation:', command.constructor.name);
    return { Items: [], Item: null };
  }
}

const marshall = (obj: any): any => obj; // Mock implementation
const unmarshall = (obj: any): any => obj; // Mock implementation

// Mock command classes
class GetItemCommand {
  constructor(public params: any) {}
}
class PutItemCommand {
  constructor(public params: any) {}
}
class UpdateItemCommand {
  constructor(public params: any) {}
}
class DeleteItemCommand {
  constructor(public params: any) {}
}
class QueryCommand {
  constructor(public params: any) {}
}
class ScanCommand {
  constructor(public params: any) {}
}
class TransactWriteItemsCommand {
  constructor(public params: any) {}
}

// ============================================================================
// DYNAMODB CLIENT SETUP
// ============================================================================

const dynamoClient = new MockDynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'keyvex-main';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function createProductToolRecord(
  definition: ProductToolDefinition, 
  userId: string, 
  organizationId?: string
): ProductToolRecord {
  const now = Date.now();
  
  return {
    PK: `PRODUCT_TOOL#${definition.id}`,
    SK: `VERSION#${definition.version}`,
    GSI1PK: `USER#${userId}`,
    GSI1SK: `CREATED#${now}`,
    GSI2PK: `STATUS#${definition.status}`,
    GSI2SK: `UPDATED#${now}`,
    
    id: definition.id,
    slug: definition.slug,
    version: definition.version,
    status: definition.status,
    definition,
    
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    organizationId,
    
    viewCount: 0,
    completionCount: 0,
    lastUsed: now
  };
}

function createSearchIndexRecord(
  toolRecord: ProductToolRecord
): ProductToolSearchIndex {
  return {
    PK: `SEARCH#${toolRecord.definition.metadata.category}`,
    SK: `TOOL#${toolRecord.id}`,
    
    toolId: toolRecord.id,
    title: toolRecord.definition.metadata.title,
    description: toolRecord.definition.metadata.description,
    category: toolRecord.definition.metadata.category,
    type: toolRecord.definition.metadata.type,
    tags: toolRecord.definition.metadata.tags,
    status: toolRecord.status,
    createdBy: toolRecord.createdBy,
    organizationId: toolRecord.organizationId,
    popularity: 0,
    lastUpdated: toolRecord.updatedAt
  };
}

// ============================================================================
// PRODUCT TOOL CRUD OPERATIONS
// ============================================================================

export class ProductToolService {
  
  /**
   * Create a new product tool
   */
  static async createProductTool(
    definition: Omit<ProductToolDefinition, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
    userId: string,
    organizationId?: string
  ): Promise<ProductToolDefinition> {
    const id = generateId();
    const slug = definition.slug || generateSlug(definition.metadata.title);
    const now = Date.now();
    
    const fullDefinition: ProductToolDefinition = {
      ...definition,
      id,
      slug,
      createdAt: now,
      updatedAt: now,
      createdBy: userId
    };
    
    const toolRecord = createProductToolRecord(fullDefinition, userId, organizationId);
    const searchRecord = createSearchIndexRecord(toolRecord);
    
    // Use a transaction to ensure both records are created
    const transactCommand = new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: marshall(toolRecord),
            ConditionExpression: 'attribute_not_exists(PK)'
          }
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: marshall(searchRecord)
          }
        }
      ]
    });
    
    try {
      await dynamoClient.send(transactCommand);
      return fullDefinition;
    } catch (error) {
      console.error('Error creating product tool:', error);
      throw new Error('Failed to create product tool');
    }
  }
  
  /**
   * Get a product tool by ID
   */
  static async getProductTool(toolId: string): Promise<ProductToolDefinition | null> {
    const getCommand = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PRODUCT_TOOL#${toolId}`,
        SK: 'VERSION#1.0.0' // TODO: Support versioning
      })
    });
    
    try {
      const result = await dynamoClient.send(getCommand);
      
      if (!result.Item) {
        return null;
      }
      
      const record = unmarshall(result.Item) as ProductToolRecord;
      return record.definition;
    } catch (error) {
      console.error('Error getting product tool:', error);
      throw new Error('Failed to get product tool');
    }
  }
  
  /**
   * Get a product tool by slug
   */
  static async getProductToolBySlug(slug: string): Promise<ProductToolDefinition | null> {
    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1', // Assuming we have this index
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: 'slug = :slug AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':pk': 'TOOL_SLUG_INDEX', // We'd need a special index for this
        ':slug': slug,
        ':status': 'published'
      })
    });
    
    try {
      const result = await dynamoClient.send(queryCommand);
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }
      
      const record = unmarshall(result.Items[0]) as ProductToolRecord;
      return record.definition;
    } catch (error) {
      console.error('Error getting product tool by slug:', error);
      return null;
    }
  }
  
  /**
   * Update a product tool
   */
  static async updateProductTool(
    toolId: string,
    updates: Partial<ProductToolDefinition>,
    userId: string
  ): Promise<ProductToolDefinition> {
    // First, get the existing tool
    const existing = await this.getProductTool(toolId);
    if (!existing) {
      throw new Error('Product tool not found');
    }
    
    // Check permissions (basic check)
    if (existing.createdBy !== userId) {
      throw new Error('Unauthorized to update this tool');
    }
    
    // Merge updates
    const updatedDefinition: ProductToolDefinition = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };
    
    const updateCommand = new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PRODUCT_TOOL#${toolId}`,
        SK: `VERSION#${existing.version}`
      }),
      UpdateExpression: 'SET definition = :def, updatedAt = :updated, GSI2SK = :gsi2sk',
      ExpressionAttributeValues: marshall({
        ':def': updatedDefinition,
        ':updated': updatedDefinition.updatedAt,
        ':gsi2sk': `UPDATED#${updatedDefinition.updatedAt}`
      })
    });
    
    try {
      await dynamoClient.send(updateCommand);
      return updatedDefinition;
    } catch (error) {
      console.error('Error updating product tool:', error);
      throw new Error('Failed to update product tool');
    }
  }
  
  /**
   * Delete a product tool
   */
  static async deleteProductTool(toolId: string, userId: string): Promise<void> {
    // Check permissions first
    const existing = await this.getProductTool(toolId);
    if (!existing || existing.createdBy !== userId) {
      throw new Error('Unauthorized or tool not found');
    }
    
    const deleteCommand = new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PRODUCT_TOOL#${toolId}`,
        SK: `VERSION#${existing.version}`
      })
    });
    
    try {
      await dynamoClient.send(deleteCommand);
    } catch (error) {
      console.error('Error deleting product tool:', error);
      throw new Error('Failed to delete product tool');
    }
  }
  
  /**
   * List product tools with pagination
   */
  static async listProductTools(
    filters: {
      userId?: string;
      status?: ProductToolStatus;
      type?: ProductToolType;
      category?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ProductToolListResponse> {
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    
    let queryCommand: QueryCommand;
    
    if (filters.userId) {
      // Query by user
      queryCommand = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: marshall({
          ':pk': `USER#${filters.userId}`
        }),
        Limit: limit,
        ScanIndexForward: false // Most recent first
      });
    } else if (filters.status) {
      // Query by status
      queryCommand = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: marshall({
          ':pk': `STATUS#${filters.status}`
        }),
        Limit: limit,
        ScanIndexForward: false
      });
    } else {
      // Scan all (not recommended for production)
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: marshall({
          ':pk': 'PRODUCT_TOOL#'
        }),
        Limit: limit
      });
      
      const result = await dynamoClient.send(scanCommand);
      const tools = (result.Items || [])
        .map((item: any) => unmarshall(item) as ProductToolRecord)
        .map((record: ProductToolRecord) => this.recordToSummary(record));
      
      return {
        tools,
        pagination: {
          limit,
          offset,
          total: tools.length,
          hasMore: false
        }
      };
    }
    
    try {
      const result = await dynamoClient.send(queryCommand);
      const tools = (result.Items || [])
        .map((item: any) => unmarshall(item) as ProductToolRecord)
        .map((record: ProductToolRecord) => this.recordToSummary(record));
      
      return {
        tools,
        pagination: {
          limit,
          offset,
          total: tools.length,
          hasMore: result.LastEvaluatedKey !== undefined
        }
      };
    } catch (error) {
      console.error('Error listing product tools:', error);
      throw new Error('Failed to list product tools');
    }
  }
  
  /**
   * Search product tools
   */
  static async searchProductTools(
    query: string,
    filters: {
      category?: string;
      type?: ProductToolType;
      tags?: string[];
      limit?: number;
    } = {}
  ): Promise<ProductToolSummary[]> {
    // This is a simple implementation. In production, you'd use OpenSearch or similar
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :searchPK) AND contains(title, :query)',
      ExpressionAttributeValues: marshall({
        ':searchPK': 'SEARCH#',
        ':query': query
      }),
      Limit: filters.limit || 20
    });
    
    try {
      const result = await dynamoClient.send(scanCommand);
      const searchResults = (result.Items || [])
        .map((item: any) => unmarshall(item) as ProductToolSearchIndex);
      
      // Convert search results to summaries
      const tools: (ProductToolSummary | null)[] = await Promise.all(
        searchResults.map(async (searchResult: ProductToolSearchIndex) => {
          const tool = await this.getProductTool(searchResult.toolId);
          if (!tool) return null;
          
          return {
            id: tool.id,
            slug: tool.slug,
            title: tool.metadata.title,
            description: tool.metadata.description,
            type: tool.metadata.type,
            category: tool.metadata.category,
            status: tool.status,
            viewCount: 0, // Would get from analytics
            completionCount: 0,
            createdAt: tool.createdAt,
            updatedAt: tool.updatedAt,
            createdBy: tool.createdBy,
            organizationId: tool.organizationId
          };
        })
      );
      
      return tools.filter((tool): tool is ProductToolSummary => tool !== null);
    } catch (error) {
      console.error('Error searching product tools:', error);
      throw new Error('Failed to search product tools');
    }
  }
  
  /**
   * Record tool usage/analytics
   */
  static async recordToolUsage(
    toolId: string,
    sessionId: string,
    userId: string | null,
    completionData?: Record<string, any>
  ): Promise<void> {
    const now = Date.now();
    
    const usageRecord: ProductToolUsageRecord = {
      PK: `USAGE#${toolId}`,
      SK: `SESSION#${now}#${sessionId}`,
      
      toolId,
      sessionId,
      userId: userId || undefined,
      timestamp: now,
      completed: !!completionData,
      completionData,
      analytics: {
        interactions: 1,
        calculationsRun: 0,
        stepsCompleted: 0,
        conversionGoals: []
      }
    };
    
    const putCommand = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(usageRecord)
    });
    
    try {
      await dynamoClient.send(putCommand);
      
      // Also increment view/completion count on the main tool record
      const updateCommand = new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          PK: `PRODUCT_TOOL#${toolId}`,
          SK: 'VERSION#1.0.0' // TODO: Support versioning
        }),
        UpdateExpression: completionData 
          ? 'ADD viewCount :one, completionCount :one SET lastUsed = :now'
          : 'ADD viewCount :one SET lastUsed = :now',
        ExpressionAttributeValues: marshall({
          ':one': 1,
          ':now': now
        })
      });
      
      await dynamoClient.send(updateCommand);
    } catch (error) {
      console.error('Error recording tool usage:', error);
      // Don't throw - analytics shouldn't break the main flow
    }
  }
  
  /**
   * Get tool analytics
   */
  static async getToolAnalytics(
    toolId: string,
    startDate: number,
    endDate: number
  ): Promise<ProductToolAnalytics> {
    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
      ExpressionAttributeValues: marshall({
        ':pk': `USAGE#${toolId}`,
        ':start': `SESSION#${startDate}`,
        ':end': `SESSION#${endDate}`
      })
    });
    
    try {
      const result = await dynamoClient.send(queryCommand);
      const usageRecords = (result.Items || [])
        .map((item: any) => unmarshall(item) as ProductToolUsageRecord);
      
      // Calculate metrics
      const totalViews = usageRecords.length;
      const totalCompletions = usageRecords.filter((r: ProductToolUsageRecord) => r.completed).length;
      const conversionRate = totalViews > 0 ? (totalCompletions / totalViews) * 100 : 0;
      
      const analytics: ProductToolAnalytics = {
        toolId,
        period: { start: startDate, end: endDate },
        metrics: {
          views: totalViews,
          completions: totalCompletions,
          conversionRate,
          averageDuration: 0, // Would calculate from duration fields
          uniqueUsers: new Set(usageRecords.map((r: ProductToolUsageRecord) => r.userId).filter(Boolean)).size
        },
        trends: {
          daily: [], // Would group by day
          popular_components: [],
          completion_funnel: []
        }
      };
      
      return analytics;
    } catch (error) {
      console.error('Error getting tool analytics:', error);
      throw new Error('Failed to get tool analytics');
    }
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  private static recordToSummary(record: ProductToolRecord): ProductToolSummary {
    return {
      id: record.id,
      slug: record.slug,
      title: record.definition.metadata.title,
      description: record.definition.metadata.description,
      type: record.definition.metadata.type,
      category: record.definition.metadata.category,
      status: record.status,
      viewCount: record.viewCount || 0,
      completionCount: record.completionCount || 0,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      organizationId: record.organizationId
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ProductToolService; 