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

      // REMOVED: Direct agent calls to prevent Vercel timeouts
      // Client-side orchestration will handle next step coordination

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