// Product Tool DynamoDB Service - Fully Working Version
import { getDbClient } from './index';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { ToolItem, ToolInteractionItem } from '@/lib/types/database';

// DynamoDB table name is accessed via environment variable in the commands below

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

// ============================================================================
// PRODUCT TOOL SERVICE
// ============================================================================

export class ProductToolService {
  
  /**
   * Save a product tool to DynamoDB
   * This converts from ProductToolDefinition to our ToolItem format
   */
  static async saveProductTool(
    definition: ProductToolDefinition,
    userId: string
  ): Promise<ProductToolDefinition> {
    const dbClient = getDbClient();
    const now = Date.now();
    
    // Ensure we have all required fields
    const toolId = definition.id || generateId();
    const slug = definition.slug || generateSlug(definition.metadata.title);
    
    const fullDefinition: ProductToolDefinition = {
      ...definition,
      id: toolId,
      slug,
      createdAt: definition.createdAt || now,
      updatedAt: now,
      createdBy: definition.createdBy || userId
    };
    
    // Create the ToolItem for DynamoDB single-table design
    const toolItem: ToolItem = {
      PK: `USER#${userId}`,
      SK: `TOOL#${toolId}`,
      GSI1PK: `TOOL#${toolId}`,
      GSI1SK: `STATUS#${definition.status}`,
      GSI2PK: `TYPE#${definition.metadata.type}`,
      GSI2SK: `CREATED#${now}`,
      entityType: 'TOOL',
      toolId: toolId,
      userId: userId,
      name: definition.metadata.title,
      description: definition.metadata.description,
      type: definition.metadata.type,
      status: definition.status,
      configuration: {
        metadata: definition.metadata,
        componentCode: definition.componentCode,
        componentSet: definition.componentSet,
        colorScheme: definition.colorScheme,
        initialStyleMap: definition.initialStyleMap,
        currentStyleMap: definition.currentStyleMap
      },
      styling: {
        colorScheme: definition.colorScheme,
        initialStyleMap: definition.initialStyleMap,
        currentStyleMap: definition.currentStyleMap
      },
      analytics: definition.analytics,
      createdAt: fullDefinition.createdAt,
      updatedAt: fullDefinition.updatedAt,
      version: parseInt(definition.version.split('.')[0]) || 1,
      metadata: {
        fullDefinition: fullDefinition,
        slug: slug
      }
    };
    
    try {
      await dbClient.putItem(toolItem);
      return fullDefinition;
    } catch (error) {
      console.error('Error saving product tool:', error);
      throw new Error('Failed to save product tool to database');
    }
  }
  
  /**
   * Get a product tool by ID
   */
  static async getProductTool(toolId: string, userId: string): Promise<ProductToolDefinition | null> {
    const dbClient = getDbClient();
    
    try {
      const result = await dbClient.getItem<ToolItem>(
        `USER#${userId}`,
        `TOOL#${toolId}`
      );
      
      if (!result) {
        return null;
      }
      
      return (result.metadata?.fullDefinition as ProductToolDefinition) || null;
    } catch (error) {
      console.error('Error getting product tool:', error);
      return null;
    }
  }
  
  /**
   * Get a product tool by ID (public access - searches across all users)
   */
  static async getPublicProductTool(toolId: string): Promise<ProductToolDefinition | null> {
    try {
      // Search for the tool using GSI1 (tool-specific queries)
      const dbClient = getDbClient();
      
      const queryResult = await dbClient.query<ToolItem>({
        GSI1PK: `TOOL#${toolId}`,
        limit: 1
      });
      
      if (queryResult.items.length === 0) {
        return null;
      }
      
      const tool = queryResult.items[0].metadata?.fullDefinition as ProductToolDefinition;
      
      // Only return if the tool is published/public
      if (tool && (tool.status === 'published' || tool.status === 'public')) {
        return tool;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting public product tool:', error);
      return null;
    }
  }
  
  /**
   * List user's product tools
   */
  static async listUserTools(userId: string): Promise<ProductToolDefinition[]> {
    try {
      // We need to use a custom query since the current client doesn't support begins_with
      // For now, let's use the low-level DynamoDB command directly
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const { QueryCommand } = await import('@aws-sdk/client-dynamodb');
      const { marshall, unmarshall } = await import('@aws-sdk/util-dynamodb');
      
      const client = new DynamoDBClient({ 
        region: process.env.AWS_REGION || 'us-east-1',
        ...(process.env.AWS_ACCESS_KEY_ID && {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          }
        })
      });
      
      const command = new QueryCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME || 'keyvex-main-table-development',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: marshall({
          ':pk': `USER#${userId}`,
          ':skPrefix': 'TOOL#'
        })
      });
      
      const result = await client.send(command);
      const items = (result.Items || []).map(item => unmarshall(item)) as ToolItem[];
      
      return items
        .map((item: ToolItem) => item.metadata?.fullDefinition)
        .filter((def): def is ProductToolDefinition => def !== null && def !== undefined);
    } catch (error) {
      console.error('Error listing user tools:', error);
      return [];
    }
  }
  
  /**
   * Delete a product tool
   */
  static async deleteProductTool(toolId: string, userId: string): Promise<boolean> {
    const dbClient = getDbClient();
    
    try {
      await dbClient.deleteItem(
        `USER#${userId}`,
        `TOOL#${toolId}`
      );
      return true;
    } catch (error) {
      console.error('Error deleting product tool:', error);
      return false;
    }
  }

  /**
   * Get tools by status across all users (for public browsing)
   */
  static async getToolsByStatus(status: string, limit: number = 20): Promise<ProductToolDefinition[]> {
    const dbClient = getDbClient();
    
    try {
      const queryResult = await dbClient.query<ToolItem>({
        GSI1SK: `STATUS#${status}`,
        limit
      });
      
      return queryResult.items
        .map((item: ToolItem) => item.metadata?.fullDefinition)
        .filter((def): def is ProductToolDefinition => def !== null && def !== undefined);
    } catch (error) {
      console.error('Error getting tools by status:', error);
      return [];
    }
  }

  /**
   * Get tools by type
   */
  static async getToolsByType(type: string, limit: number = 20): Promise<ProductToolDefinition[]> {
    const dbClient = getDbClient();
    
    try {
      const queryResult = await dbClient.query<ToolItem>({
        GSI2PK: `TYPE#${type}`,
        limit
      });
      
      return queryResult.items
        .map((item: ToolItem) => item.metadata?.fullDefinition)
        .filter((def): def is ProductToolDefinition => def !== null && def !== undefined);
    } catch (error) {
      console.error('Error getting tools by type:', error);
      return [];
    }
  }
  
  /**
   * Update an existing product tool
   */
  static async updateProductTool(
    toolId: string,
    definition: ProductToolDefinition,
    userId: string
  ): Promise<ProductToolDefinition> {
    const dbClient = getDbClient();
    
    try {
      // First, check if the tool exists and user has permission
      const existingTool = await this.getProductTool(toolId, userId);
      if (!existingTool) {
        throw new Error('Product tool not found');
      }
      
      // Update the definition with current timestamp
      const updatedDefinition: ProductToolDefinition = {
        ...definition,
        id: toolId,
        updatedAt: Date.now(),
        createdAt: existingTool.createdAt, // Preserve original creation time
        createdBy: existingTool.createdBy   // Preserve original creator
      };
      
      // Create updated ToolItem
      const toolItem: ToolItem = {
        PK: `USER#${userId}`,
        SK: `TOOL#${toolId}`,
        GSI1PK: `TOOL#${toolId}`,
        GSI1SK: `STATUS#${definition.status}`,
        GSI2PK: `TYPE#${definition.metadata.type}`,
        GSI2SK: `CREATED#${existingTool.createdAt}`, // Keep original creation time for sorting
        entityType: 'TOOL',
        toolId: toolId,
        userId: userId,
        name: definition.metadata.title,
        description: definition.metadata.description,
        type: definition.metadata.type,
        status: definition.status,
        configuration: {
          metadata: definition.metadata,
          componentCode: definition.componentCode,
          componentSet: definition.componentSet,
          colorScheme: definition.colorScheme,
          initialStyleMap: definition.initialStyleMap,
          currentStyleMap: definition.currentStyleMap
        },
        styling: {
          colorScheme: definition.colorScheme,
          initialStyleMap: definition.initialStyleMap,
          currentStyleMap: definition.currentStyleMap
        },
        analytics: definition.analytics,
        createdAt: existingTool.createdAt,
        updatedAt: updatedDefinition.updatedAt,
        version: (existingTool.version ? parseInt(existingTool.version.split('.')[0]) + 1 : 2),
        metadata: {
          fullDefinition: updatedDefinition,
          slug: definition.slug || existingTool.slug
        }
      };
      
      await dbClient.putItem(toolItem);
      return updatedDefinition;
    } catch (error) {
      console.error('Error updating product tool:', error);
      throw new Error('Failed to update product tool');
    }
  }
  
  /**
   * Record tool usage for analytics
   */
  static async recordToolUsage(
    toolId: string,
    sessionId: string,
    userId: string | null,
    interactionType: string = 'view',
    interactionData: Record<string, unknown> = {}
  ): Promise<void> {
    const dbClient = getDbClient();
    
    try {
      const now = Date.now();
      const interactionId = `${interactionType}_${now}_${Math.random().toString(36).substring(2, 11)}`;
      
      const interaction: ToolInteractionItem = {
        PK: `TOOL#${toolId}`,
        SK: `INTERACTION#${now}#${interactionId}`,
        GSI1PK: `ANALYTICS#${toolId}`,
        GSI1SK: `${interactionType}#${now}`,
        entityType: 'INTERACTION',
        toolId: toolId,
        interactionId: interactionId,
        sessionId: sessionId,
        userId: userId || undefined,
        interactionType: interactionType,
        interactionData: {
          timestamp: now,
          userAgent: interactionData.userAgent,
          ...interactionData
        },
        timestamp: now,
        createdAt: now,
        updatedAt: now,
        version: 1,
        metadata: {
          source: 'api',
          sessionId: sessionId
        }
      };
      
      await dbClient.putItem(interaction);
    } catch (error) {
      console.error('Error recording tool usage:', error);
      // Don't throw error for analytics - we don't want to break the main flow
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ProductToolService;