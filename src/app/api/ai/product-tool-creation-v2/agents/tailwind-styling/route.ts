import { applyStyling } from './core-logic';
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    logger.info({ 
      jobId: requestData.jobId,
      selectedModel: requestData.selectedModel || 'default'
    }, '🎨 TailwindStyling Route: Processing styling request');

    // Apply Tailwind styling
    const result = await applyStyling(requestData);
    
    if (result.success && result.styling) {
      logger.info({ 
        jobId: requestData.jobId,
        elementsStyled: result.styling.styleMap.length,
        colorSchemeKeys: Object.keys(result.styling.colorScheme).length
      }, '🎨 TailwindStyling Route: Styling applied successfully');

      // SUCCESS: Trigger check for parallel completion 
      const baseUrl = request.nextUrl.origin;
      
      // Check if parallel step completion allows proceeding to next step
      checkParallelCompletion(baseUrl, requestData.jobId).catch(error => {
        logger.error({ jobId: requestData.jobId, error }, '🎨 TailwindStyling: Failed to check parallel completion');
      });

      return NextResponse.json({
        success: true,
        message: 'Tailwind styling applied successfully',
        styling: result.styling
      });
    } else {
      logger.error({ 
        jobId: requestData.jobId,
        error: result.error
      }, '🎨 TailwindStyling Route: Styling application failed');
      
      return NextResponse.json({
        success: false,
        error: result.error || 'Unknown error applying styling'
      }, { status: 500 });
    }

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error)
    }, '🎨 TailwindStyling Route: Unexpected error');
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper function to check parallel completion and trigger next step
async function checkParallelCompletion(
  baseUrl: string, 
  jobId: string
): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      throw new Error(`Check parallel completion responded with status: ${response.status}`);
    }

    logger.info({ jobId }, '🎨 TailwindStyling: Successfully triggered parallel completion check');
  } catch (error) {
    logger.error({ jobId, error }, '🎨 TailwindStyling: Failed to check parallel completion');
    throw error;
  }
}