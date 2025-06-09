import { NextRequest, NextResponse } from 'next/server';
import { applyStyling } from './core-logic';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { z } from 'zod';

// Define the request schema locally since it's not exported from core-logic
const tailwindStylingRequestSchema = z.object({
  jobId: z.string().uuid(),
  selectedModel: z.string().optional(),
  tcc: z.custom<ToolConstructionContext>().optional(), // For orchestration calls
  mockTcc: z.custom<ToolConstructionContext>().optional(), // For isolated testing
});

export async function POST(request: NextRequest) {
  logger.info('🎨 TailwindStyling Route: Route handler started');

  try {
    const body = await request.json();
    const parsedRequest = tailwindStylingRequestSchema.parse(body);
    
    // Detect isolated testing mode - if mockTcc is provided, it's likely an isolated test
    const isIsolatedTest = !!parsedRequest.mockTcc;
    
    logger.info({ 
      jobId: parsedRequest.jobId, 
      selectedModel: parsedRequest.selectedModel,
      isIsolatedTest 
    }, '🎨 TailwindStyling API: Request received');

    // Call the core logic with both tcc and mockTcc
    const result = await applyStyling({
      jobId: parsedRequest.jobId,
      selectedModel: parsedRequest.selectedModel,
      tcc: parsedRequest.tcc, // Pass tcc from orchestration
      mockTcc: parsedRequest.mockTcc, // Pass mockTcc for isolated testing
      isIsolatedTest
    });

    // Skip orchestration triggering during isolated testing
    if (!isIsolatedTest && result.success && result.updatedTcc) {
      logger.info({ jobId: parsedRequest.jobId }, '🎨 TailwindStyling Route: Core logic successful, triggering next step.');
    // Trigger the next step by calling the centralized orchestrator endpoint
    const triggerUrl = new URL('/api/ai/product-tool-creation-v2/orchestrate/trigger-next-step', request.nextUrl.origin);
    fetch(triggerUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          jobId: parsedRequest.jobId,
        nextStep: result.updatedTcc.currentOrchestrationStep,
        tcc: result.updatedTcc,
      }),
    }).catch(error => {
        logger.error({ jobId: parsedRequest.jobId, error: error.message }, '🎨 TailwindStyling Route: Failed to trigger next step orchestration endpoint');
    });
      
      logger.info({ jobId: parsedRequest.jobId }, '🎨 TailwindStyling Route: Successfully triggered next step.');
    } else if (isIsolatedTest) {
      logger.info({ jobId: parsedRequest.jobId }, '🎨 TailwindStyling Route: Isolated test mode - skipping orchestration trigger');
    }

    return NextResponse.json(result);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🎨 TailwindStyling Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}