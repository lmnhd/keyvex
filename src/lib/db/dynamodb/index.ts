import { DynamoDBClient } from './client';

let dbClient: DynamoDBClient | null = null;

/**
 * Get or create a DynamoDB client instance
 */
export function getDbClient(): DynamoDBClient {
  if (!dbClient) {
    const tableName = process.env.DYNAMODB_TABLE_NAME || 'keyvex-main-table-development';
    const region = process.env.AWS_REGION || 'us-east-1';
    
    dbClient = new DynamoDBClient(tableName, region);
  }
  
  return dbClient;
}

export { DynamoDBClient } from './client';
export { ProductToolService } from './product-tools'; 