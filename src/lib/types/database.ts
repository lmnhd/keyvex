// TODO: Define comprehensive database types for DynamoDB single-table design

// Base interface for all DynamoDB items
export interface KeyvexTableItem {
  PK: string;           // Partition Key
  SK: string;           // Sort Key
  GSI1PK?: string;      // Global Secondary Index 1 PK
  GSI1SK?: string;      // Global Secondary Index 1 SK
  GSI2PK?: string;      // Global Secondary Index 2 PK
  GSI2SK?: string;      // Global Secondary Index 2 SK
  entityType: EntityType;
  createdAt: number;    // Unix timestamp
  updatedAt: number;    // Unix timestamp
  ttl?: number;         // Auto-expire for temporary data
  metadata: Record<string, unknown>; // Extensible metadata
  version: number;      // For optimistic locking
  [key: string]: unknown;   // Entity-specific fields
}

export type EntityType = 
  | 'USER' 
  | 'TOOL' 
  | 'SESSION' 
  | 'MESSAGE' 
  | 'LEAD' 
  | 'INTERACTION' 
  | 'CONNECTION' 
  | 'SUBSCRIPTION' 
  | 'ACTIVITY' 
  | 'INTEGRATION' 
  | 'EXPORT' 
  | 'API_KEY' 
  | 'TEAM' 
  | 'TEAM_MEMBER';

// User entity
export interface UserItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: 'PROFILE';
  GSI1PK: `EMAIL#${string}`;      // For email lookups
  GSI1SK: 'USER';
  entityType: 'USER';
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  preferences: Record<string, unknown>;
  usage: Record<string, unknown>;
  lastLoginAt?: number;
}

// Tool entity
export interface ToolItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: `TOOL#${string}`;           // TOOL#{toolId}
  GSI1PK: `TOOL#${string}`;       // For tool-specific queries
  GSI1SK: `STATUS#${string}`;     // For filtering by status
  GSI2PK: `TYPE#${string}`;       // For filtering by tool type
  GSI2SK: `CREATED#${number}`;    // For sorting by creation date
  entityType: 'TOOL';
  toolId: string;
  userId: string;
  name: string;
  description: string;
  type: string;
  status: string;
  configuration: Record<string, unknown>;
  styling: Record<string, unknown>;
  analytics: Record<string, unknown>;
  publishedAt?: number;
}

// AI Session entity
export interface AISessionItem extends KeyvexTableItem {
  PK: `SESSION#${string}`;        // SESSION#{sessionId}
  SK: 'METADATA';
  GSI1PK: `USER#${string}`;       // For user's sessions
  GSI1SK: `SESSION#${number}`;    // Sorted by creation time
  entityType: 'SESSION';
  sessionId: string;
  userId: string;
  toolId?: string;
  currentStep: string;
  status: string;
  sessionData: Record<string, unknown>;
  expiresAt?: number;
}

// Conversation Message entity
export interface ConversationMessageItem extends KeyvexTableItem {
  PK: `SESSION#${string}`;        // SESSION#{sessionId}
  SK: `MESSAGE#${number}#${string}`; // MESSAGE#{timestamp}#{messageId}
  entityType: 'MESSAGE';
  sessionId: string;
  messageId: string;
  role: string;
  content: string;
  timestamp: number;
}

// Lead entity
export interface LeadItem extends KeyvexTableItem {
  PK: `TOOL#${string}`;           // TOOL#{toolId}
  SK: `LEAD#${string}`;           // LEAD#{leadId}
  GSI1PK: `EMAIL#${string}`;      // For email lookups
  GSI1SK: `LEAD#${number}`;       // Sorted by creation time
  entityType: 'LEAD';
  leadId: string;
  toolId: string;
  email: string;
  name?: string;
  phone?: string;
  customFields: Record<string, unknown>;
  responses: Record<string, unknown>[];
  score?: number;
  result?: string;
  resultCategory?: string;
  source: string;
}

// Tool Interaction entity (for analytics)
export interface ToolInteractionItem extends KeyvexTableItem {
  PK: `TOOL#${string}`;           // TOOL#{toolId}
  SK: `INTERACTION#${number}#${string}`; // INTERACTION#{timestamp}#{interactionId}
  GSI1PK: `ANALYTICS#${string}`;  // For analytics queries
  GSI1SK: `${string}#${number}`;  // {interactionType}#{timestamp}
  entityType: 'INTERACTION';
  toolId: string;
  interactionId: string;
  sessionId?: string;
  userId?: string;
  interactionType: string;
  interactionData: Record<string, unknown>;
  timestamp: number;
}

// WebSocket Connection entity
export interface WebSocketConnectionItem extends KeyvexTableItem {
  PK: `CONNECTION#${string}`;     // CONNECTION#{connectionId}
  SK: 'METADATA';
  GSI1PK: `USER#${string}`;       // For user's connections
  GSI1SK: `CONNECTION#${number}`; // Sorted by connection time
  entityType: 'CONNECTION';
  connectionId: string;
  userId: string;
  sessionId?: string;
  connectedAt: number;
  lastActivity: number;
  ttl: number; // Auto-cleanup stale connections
}

// Subscription entity
export interface SubscriptionItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: 'SUBSCRIPTION';
  GSI1PK: `STRIPE#${string}`;     // For Stripe lookups
  GSI1SK: 'SUBSCRIPTION';
  entityType: 'SUBSCRIPTION';
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: string;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  trialStart?: number;
  trialEnd?: number;
  billingCycle: string;
  amount: number;
  currency: string;
}

// User Activity entity
export interface UserActivityItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: `ACTIVITY#${number}#${string}`; // ACTIVITY#{timestamp}#{activityId}
  GSI1PK: `ACTIVITY#${string}`;   // For activity type queries
  GSI1SK: `${number}`;            // Sorted by timestamp
  entityType: 'ACTIVITY';
  userId: string;
  activityId: string;
  type: string;
  description: string;
  entityType_activity?: string;
  entityId?: string;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}

// User Integration entity
export interface UserIntegrationItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: `INTEGRATION#${string}`;    // INTEGRATION#{integrationId}
  GSI1PK: `INTEGRATION#${string}`; // For integration type queries
  GSI1SK: `USER#${string}`;       // For user lookups
  entityType: 'INTEGRATION';
  userId: string;
  integrationId: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  status: string;
  lastSync?: number;
  syncErrors?: string[];
}

// User Export entity
export interface UserExportItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: `EXPORT#${string}`;         // EXPORT#{exportId}
  GSI1PK: `EXPORT#${string}`;     // For export status queries
  GSI1SK: `${number}`;            // Sorted by request time
  entityType: 'EXPORT';
  userId: string;
  exportId: string;
  type: string;
  format: string;
  status: string;
  downloadUrl?: string;
  expiresAt?: number;
  requestedAt: number;
  completedAt?: number;
  errorMessage?: string;
}

// API Key entity
export interface UserApiKeyItem extends KeyvexTableItem {
  PK: `USER#${string}`;           // USER#{clerkId}
  SK: `API_KEY#${string}`;        // API_KEY#{keyId}
  GSI1PK: `API_KEY#${string}`;    // For key prefix lookups
  GSI1SK: 'ACTIVE';               // For active key queries
  entityType: 'API_KEY';
  userId: string;
  keyId: string;
  name: string;
  keyPrefix: string;
  hashedKey: string;
  permissions: string[];
  lastUsed?: number;
  expiresAt?: number;
  isActive: boolean;
}

// Team entity
export interface TeamItem extends KeyvexTableItem {
  PK: `TEAM#${string}`;           // TEAM#{teamId}
  SK: 'METADATA';
  GSI1PK: `OWNER#${string}`;      // For owner lookups
  GSI1SK: `TEAM#${number}`;       // Sorted by creation time
  entityType: 'TEAM';
  teamId: string;
  name: string;
  slug: string;
  ownerId: string;
  settings: Record<string, unknown>;
}

// Team Member entity
export interface TeamMemberItem extends KeyvexTableItem {
  PK: `TEAM#${string}`;           // TEAM#{teamId}
  SK: `MEMBER#${string}`;         // MEMBER#{userId}
  GSI1PK: `USER#${string}`;       // For user's teams
  GSI1SK: `TEAM#${string}`;       // Team reference
  entityType: 'TEAM_MEMBER';
  teamId: string;
  userId: string;
  role: string;
  permissions: string[];
  invitedAt: number;
  joinedAt?: number;
  invitedBy: string;
  status: string;
}

// Query patterns and helper types
export interface QueryParams {
  PK?: string;
  SK?: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  scanIndexForward?: boolean;
  filterExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, unknown>;
}

export interface QueryResult<T extends KeyvexTableItem> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
  count: number;
  scannedCount: number;
}

export interface BatchWriteRequest {
  putRequests: KeyvexTableItem[];
  deleteRequests: { PK: string; SK: string }[];
}

export interface TransactionWriteRequest {
  put?: KeyvexTableItem[];
  update?: UpdateRequest[];
  delete?: { PK: string; SK: string }[];
  conditionCheck?: ConditionCheckRequest[];
}

export interface UpdateRequest {
  PK: string;
  SK: string;
  updateExpression: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, unknown>;
  conditionExpression?: string;
}

export interface ConditionCheckRequest {
  PK: string;
  SK: string;
  conditionExpression: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, unknown>;
}

// Database operation types
export type DatabaseOperation = 
  | 'get'
  | 'put'
  | 'update'
  | 'delete'
  | 'query'
  | 'scan'
  | 'batchGet'
  | 'batchWrite'
  | 'transactWrite'
  | 'transactGet';

export interface DatabaseError {
  operation: DatabaseOperation;
  errorType: string;
  message: string;
  retryable: boolean;
  statusCode?: number;
  requestId?: string;
}

// Cache-related types
export interface CacheKey {
  prefix: string;
  identifier: string;
  version?: string;
}

export interface CacheOptions {
  ttl?: number; // seconds
  tags?: string[];
  compress?: boolean;
}

export interface CacheResult<T> {
  data: T | null;
  hit: boolean;
  ttl?: number;
}

// TODO: Add database migration types
// TODO: Define backup and restore types
// TODO: Add database monitoring and metrics types
// TODO: Define data validation and schema types
// TODO: Add database connection pool types 
