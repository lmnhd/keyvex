import { ProductToolDefinition } from './product-tool';

export interface V2ToolCreationJob {
  id: string; // Job ID
  userId: string; // User who initiated the job
  status: 'running' | 'completed' | 'failed';
  productToolDefinition?: ProductToolDefinition;
  toolConstructionContext?: any;
  createdAt: number;
  updatedAt: number;
}
