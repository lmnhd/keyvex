import { NextRequest, NextResponse } from 'next/server';
import { designJsxLayout } from './core-logic';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { z } from 'zod';

// Define the request schema locally
const jsxLayoutRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  mockTcc: z.custom<ToolConstructionContext>().optional(),
});

export async function POST(request: NextRequest) {
  logger.info('🏗️ JSXLayout Route: Route handler started');

  try {
    const body = await request.json();
    const parsedRequest = jsxLayoutRequestSchema.parse(body);
    
    // Detect isolated testing mode - if mockTcc is provided, it's likely an isolated test
    const isIsolatedTest = !!parsedRequest.mockTcc;
    
    logger.info({ 
      jobId: parsedRequest.jobId, 
      selectedModel: parsedRequest.selectedModel,
      isIsolatedTest 
    }, '🏗️ JSXLayout API: Request received');

    // Call the core logic with isolated test flag
    const result = await designJsxLayout({
      jobId: parsedRequest.jobId,
      selectedModel: parsedRequest.selectedModel,
      mockTcc: parsedRequest.mockTcc,
      isIsolatedTest
    });

    // Skip orchestration triggering during isolated testing
    if (!isIsolatedTest && result.success && result.updatedTcc) {
      logger.info({ jobId: parsedRequest.jobId }, '🏗️ JSXLayout Route: Core logic successful, triggering next step.');

      // Trigger the next step by calling the centralized orchestrator endpoint
      const triggerUrl = new URL('/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion', request.nextUrl.origin);
      fetch(triggerUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: parsedRequest.jobId,
          tcc: result.updatedTcc,
        }),
      }).catch(error => {
        logger.error({ jobId: parsedRequest.jobId, error: error.message }, '🏗️ JSXLayout Route: Failed to trigger next step orchestration endpoint');
      });
        
      logger.info({ jobId: parsedRequest.jobId }, '🏗️ JSXLayout Route: Successfully triggered next step.');
    } else if (isIsolatedTest) {
      logger.info({ jobId: parsedRequest.jobId }, '🏗️ JSXLayout Route: Isolated test mode - skipping orchestration trigger');
    }

    return NextResponse.json(result);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🏗️ JSXLayout Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}