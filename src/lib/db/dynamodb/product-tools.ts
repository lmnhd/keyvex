import { ddbDocClient } from './client';
import { 
  PutCommand, 
  GetCommand, 
  QueryCommand, 
  DeleteCommand 
} from "@aws-sdk/lib-dynamodb";
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { DatabaseError } from '@/lib/types/database';

// Note: Ensure DYNAMODB_TABLE_NAME is set in production environments.
// Triggering a new deployment to verify Vercel environment variables.
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'keyvex-main-table-development';

export class ProductToolService {
  private tableName: string;

  constructor() {
    this.tableName = TABLE_NAME;
  }

  private handleError(error: any, operation: string): DatabaseError {
    const errorMessage = error.message || 'Unknown DynamoDB error';
    const errorCode = error.name || error.$metadata?.httpStatusCode || 'UNKNOWN_ERROR';
    
    return {
      operation: operation as any,
      errorType: errorCode,
      message: `DynamoDB ${operation} failed: ${errorMessage}`,
      retryable: ['ThrottledError', 'ProvisionedThroughputExceededError'].includes(errorCode),
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId
    };
  }

  async saveProductTool(tool: ProductToolDefinition): Promise<void> {
    const params = {
      TableName: this.tableName,
      Item: {
        PK: `USER#${tool.createdBy}`,
        SK: `TOOL#${tool.id}`,
        ...tool,
        updatedAt: new Date().toISOString(),
      },
    };

    try {
      await ddbDocClient.send(new PutCommand(params));
    } catch (error) {
      console.error('Error saving product tool:', error);
      throw new Error('Failed to save product tool to database');
    }
  }

  async getProductTool(userId: string, toolId: string): Promise<ProductToolDefinition | null> {
    const params = {
      TableName: this.tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `TOOL#${toolId}`,
      },
    };

    try {
      const { Item } = await ddbDocClient.send(new GetCommand(params));
      return (Item as ProductToolDefinition) || null;
    } catch (error) {
      console.error('Error getting product tool:', error);
      throw new Error('Failed to retrieve product tool from database');
    }
  }

  async listUserTools(userId: string): Promise<ProductToolDefinition[]> {
    console.log(`[ProductToolService] Listing tools for userId: ${userId}`);
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk and begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'TOOL#',
      },
    };

    try {
      const result = await ddbDocClient.send(new QueryCommand(params));
      console.log(`[ProductToolService] DynamoDB Query result for ${userId}:`, JSON.stringify(result, null, 2));
      const { Items } = result;
      return Items ? (Items as ProductToolDefinition[]) : [];
    } catch (error) {
      console.error('Error listing user tools:', error);
      throw new Error('Failed to list tools from database due to a backend error.');
    }
  }

  async deleteProductTool(userId: string, toolId: string): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `TOOL#${toolId}`,
      },
    };

    try {
      await ddbDocClient.send(new DeleteCommand(params));
    } catch (error) {
      console.error('Error deleting product tool:', error);
      throw new Error('Failed to delete product tool from database');
    }
  }
}