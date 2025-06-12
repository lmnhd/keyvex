import { ddbDocClient } from './client';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { V2ToolCreationJob } from '@/lib/types/v2-tool-creation-job';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'keyvex-main-table-development';

export class V2ToolCreationJobService {
  private tableName: string;

  constructor() {
    this.tableName = TABLE_NAME;
  }

  async saveJob(job: V2ToolCreationJob): Promise<void> {
    const params = {
      TableName: this.tableName,
      Item: {
        PK: `USER#${job.userId}`,
        SK: `JOB#${job.id}`,
        ...job,
        updatedAt: Date.now(),
      },
    };

    try {
      await ddbDocClient.send(new PutCommand(params));
    } catch (error) {
      console.error('Error saving V2 tool creation job:', error);
      throw new Error('Failed to save job to database');
    }
  }

  async updateJob(userId: string, jobId: string, updates: Partial<V2ToolCreationJob>): Promise<void> {
    // First get the existing job
    const existingJob = await this.getJob(userId, jobId);
    if (!existingJob) {
      throw new Error(`Job ${jobId} not found for user ${userId}`);
    }

    // Merge updates with existing job
    const updatedJob: V2ToolCreationJob = {
      ...existingJob,
      ...updates,
      id: jobId, // Ensure ID stays consistent
      userId: userId, // Ensure userId stays consistent
      updatedAt: Date.now(),
    };

    // Save the updated job
    await this.saveJob(updatedJob);
  }

  async getJob(userId: string, jobId: string): Promise<V2ToolCreationJob | null> {
    const params = {
      TableName: this.tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `JOB#${jobId}`,
      },
    };

    try {
      const { Item } = await ddbDocClient.send(new GetCommand(params));
      return (Item as V2ToolCreationJob) || null;
    } catch (error) {
      console.error('Error getting V2 tool creation job:', error);
      throw new Error('Failed to retrieve job from database');
    }
  }
}
