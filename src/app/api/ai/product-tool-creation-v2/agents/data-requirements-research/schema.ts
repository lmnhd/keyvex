import { z } from 'zod';

// Schema for individual research queries
export const ResearchQuerySchema = z.object({
  query: z.string().describe('The research query to execute'),
  domain: z.string().describe('Domain category (e.g., "solar", "finance", "healthcare")'),
  dataType: z.enum([
    'regulatory',
    'market_pricing',
    'geographic',
    'industry_standards',
    'tax_rates',
    'statistical',
    'other',
  ] as const).describe('Type of data being researched'),
  priority: z.enum(['high', 'medium', 'low']).describe('Priority level for this research'),
  locationDependent: z.boolean().describe('Whether results vary by location'),
  expectedDataStructure: z.string().describe('Expected structure of the data (e.g., "array of objects with rate and state fields")'),
});

// Consolidated output schema for the Data Requirements & Research agent
export const DataRequirementsResearchOutputSchema = z.object({
  hasExternalDataNeeds: z.boolean().describe('Whether this tool requires external data'),
  requiredDataTypes: z.array(z.string()).describe('Types of external data needed'),
  researchQueries: z.array(ResearchQuerySchema).describe('Specific research queries to execute'),
  mockData: z.record(z.any()).describe('Generated mock data organized by category'),
  userInstructions: z.object({
    summary: z.string().describe('Summary of data requirements for the user'),
    dataNeeded: z.array(z.string()).describe('List of data the user needs to provide'),
    format: z.string().describe('Expected format for user data'),
  }).describe('Instructions for the user about data requirements'),
});

export type DataRequirementsResearchOutput = z.infer<typeof DataRequirementsResearchOutputSchema>;
