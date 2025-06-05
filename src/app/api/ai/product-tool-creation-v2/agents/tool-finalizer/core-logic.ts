import { z } from 'zod';
import { ToolConstructionContext, OrchestrationStepEnum, OrchestrationStatusEnum } from '@/lib/types/product-tool-creation-v2/tcc';
import { getTCC, saveTCC } from '@/lib/db/tcc-store';
import { emitStepProgress } from '@/lib/streaming/progress-emitter';
import logger from '@/lib/logger';
import { generateSlug } from '@/lib/utils/slug';

// Input schema
const ToolFinalizerRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional()
});

export type ToolFinalizerRequest = z.infer<typeof ToolFinalizerRequestSchema>;

/**
 * Tool Finalizer Agent - Creates final product tool definition
 */
export async function finalizeTool(request: ToolFinalizerRequest): Promise<{
  success: boolean;
  finalToolDefinition?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    componentCode: string;
    metadata: {
      targetAudience: string;
      industry: string;
      complexity: number;
      dependencies: string[];
      features: string[];
      validationStatus: {
        isValid: boolean;
        errorCount: number;
        warningCount: number;
      };
    };
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
}> {
  const { jobId } = ToolFinalizerRequestSchema.parse(request);

  try {
    const tcc = await getTCC(jobId);
    if (!tcc) throw new Error(`TCC not found for jobId: ${jobId}`);

    logger.info({ jobId }, '📦 ToolFinalizer: Starting finalization');

    await emitStepProgress(jobId, OrchestrationStepEnum.enum.finalizing_tool, 'started', 'Creating final tool definition...');

    // Validate we have all required pieces
    if (!tcc.assembledComponentCode) throw new Error('Assembled component code not found in TCC');
    if (!tcc.validationResult) throw new Error('Validation result not found in TCC');

    // Update TCC status
    const tccInProgress = { ...tcc, status: OrchestrationStatusEnum.enum.in_progress, updatedAt: new Date().toISOString() };
    await saveTCC(tccInProgress);

    // Create final tool definition
    const finalToolDefinition = createFinalToolDefinition(tcc);

    // Update TCC with results - create proper FinalProductToolDefinition
    const finalProductTool = {
      id: finalToolDefinition.id,
      slug: finalToolDefinition.slug,
      version: '1.0.0',
      status: 'draft' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: tcc.userId || 'system',
      metadata: {
        id: finalToolDefinition.id,
        slug: finalToolDefinition.slug,
        title: finalToolDefinition.name,
        description: finalToolDefinition.description,
        shortDescription: finalToolDefinition.description.substring(0, 100),
        type: finalToolDefinition.category,
        category: finalToolDefinition.category,
        targetAudience: finalToolDefinition.metadata.targetAudience,
        industry: finalToolDefinition.metadata.industry,
        tags: [],
        estimatedCompletionTime: 5,
        difficultyLevel: 'beginner' as const,
        features: finalToolDefinition.metadata.features,
        icon: { type: 'emoji' as const, value: '🛠️' }
      },
      componentSet: 'shadcn' as const,
      componentCode: finalToolDefinition.componentCode,
      colorScheme: {
        primary: '#3b82f6',
        secondary: '#6b7280',
        background: '#ffffff',
        surface: '#f9fafb',
        text: { primary: '#111827', secondary: '#6b7280', muted: '#9ca3af' },
        border: '#e5e7eb',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
      },
      analytics: { enabled: false, completions: 0, averageTime: 0 }
    };

    const updatedTCC = {
      ...tccInProgress,
      finalProductToolDefinition: finalProductTool,
      status: OrchestrationStatusEnum.enum.completed,
      updatedAt: new Date().toISOString()
    };
    await saveTCC(updatedTCC);

    await emitStepProgress(jobId, OrchestrationStepEnum.enum.finalizing_tool, 'completed', 
      `Tool finalized: ${finalToolDefinition.name} (${finalToolDefinition.id})`);

    logger.info({ 
      jobId, 
      toolId: finalToolDefinition.id,
      toolName: finalToolDefinition.name
    }, '📦 ToolFinalizer: Tool finalized successfully');

    return { success: true, finalToolDefinition };

  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, '📦 ToolFinalizer: Error');
    await emitStepProgress(jobId, OrchestrationStepEnum.enum.finalizing_tool, 'failed', 
      `Tool finalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

/**
 * Create final tool definition from TCC
 */
function createFinalToolDefinition(tcc: ToolConstructionContext) {
  const now = new Date().toISOString();
  const toolName = generateToolName(tcc.userInput.description);
  
  return {
    id: `tool_${tcc.jobId}`,
    name: toolName,
    slug: generateSlug(toolName),
    description: tcc.userInput.description,
    category: determineCategory(tcc),
    componentCode: tcc.assembledComponentCode!,
    metadata: {
      targetAudience: tcc.userInput.targetAudience || 'General users',
      industry: tcc.userInput.industry || 'General',
      complexity: calculateComplexity(tcc.assembledComponentCode!),
      dependencies: extractDependencies(tcc.assembledComponentCode!),
      features: tcc.userInput.features || [],
      validationStatus: {
        isValid: tcc.validationResult!.isValid,
        errorCount: tcc.validationResult!.error ? 1 : 0,
        warningCount: 0
      }
    },
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Generate a clean tool name from description
 */
function generateToolName(description: string): string {
  return description
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Determine tool category based on TCC
 */
function determineCategory(tcc: ToolConstructionContext): string {
  const description = tcc.userInput.description.toLowerCase();
  const toolType = tcc.userInput.toolType?.toLowerCase() || '';
  
  if (toolType) return toolType.charAt(0).toUpperCase() + toolType.slice(1);
  
  if (description.includes('calculator') || description.includes('compute')) return 'Calculator';
  if (description.includes('converter') || description.includes('transform')) return 'Converter';
  if (description.includes('generator') || description.includes('create')) return 'Generator';
  if (description.includes('analyzer') || description.includes('analysis')) return 'Analyzer';
  if (description.includes('validator') || description.includes('check')) return 'Validator';
  if (description.includes('formatter') || description.includes('format')) return 'Formatter';
  
  return 'Utility';
}

/**
 * Extract dependencies from component code
 */
function extractDependencies(code: string): string[] {
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const dependencies = new Set<string>();
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    dependencies.add(match[1]);
  }

  return Array.from(dependencies);
}

/**
 * Calculate component complexity
 */
function calculateComplexity(code: string): number {
  let complexity = 0;
  complexity += (code.match(/useState/g) || []).length * 2;
  complexity += (code.match(/useEffect/g) || []).length * 3;
  complexity += (code.match(/useCallback/g) || []).length * 2;
  complexity += (code.match(/\?\s*[^\s:]+\s*:\s*[^\s]+/g) || []).length;
  return complexity;
} 