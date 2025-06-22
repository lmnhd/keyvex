import { z } from 'zod';

export const ProductToolMetadataSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.string(),
  dependencies: z.array(z.string()),
  userInstructions: z.string(),
  developerNotes: z.string(),
  source: z.string(),
  version: z.string(),
  shortDescription: z.string(),
  category: z.string(),
  targetAudience: z.string().optional(),
  industry: z.string().optional(),
  tags: z.array(z.string()).optional(),
  estimatedCompletionTime: z.number().optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  features: z.array(z.string()).optional(),
  icon: z.object({
    type: z.enum(['lucide', 'emoji']),
    value: z.string(),
  }).optional(),
});

export const ToolColorSchemeSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  surface: z.string(),
  text: z.object({
    primary: z.string(),
    secondary: z.string(),
    muted: z.string(),
  }),
  border: z.string(),
  success: z.string(),
  warning: z.string(),
  error: z.string(),
});

export const ProductToolDefinitionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  componentCode: z.string(),
  metadata: ProductToolMetadataSchema,
  initialStyleMap: z.record(z.string()),
  currentStyleMap: z.record(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  createdBy: z.string(),
  componentSet: z.enum(['shadcn', 'legacy']).optional(),
  colorScheme: ToolColorSchemeSchema.optional(),
  analytics: z.object({
    enabled: z.boolean(),
    completions: z.number(),
    averageTime: z.number(),
  }).optional(),
});