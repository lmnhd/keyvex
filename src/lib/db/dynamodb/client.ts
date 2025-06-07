import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION || 'us-east-1';

// Full DynamoDB Client
const client = new DynamoDBClient({
  region: region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Document Client for simplified data manipulation (e.g., using JSON)
const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    // Automatically remove undefined values from objects
    removeUndefinedValues: true,
  },
});

export { ddbDocClient };
