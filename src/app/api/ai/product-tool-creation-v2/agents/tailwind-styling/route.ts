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

      // Trigger the next step: Programmatic Assembler
      try {
        const assemblerResponse = await fetch('/api/ai/product-tool-creation-v2/agents/programmatic-assembler', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId: requestData.jobId,
            selectedModel: requestData.selectedModel
          }),
        });

        if (!assemblerResponse.ok) {
          logger.warn({ 
            jobId: requestData.jobId,
            assemblerStatus: assemblerResponse.status,
            assemblerStatusText: assemblerResponse.statusText
          }, '🎨 TailwindStyling Route: Failed to trigger Programmatic Assembler');
        } else {
          logger.info({ 
            jobId: requestData.jobId 
          }, '🎨 TailwindStyling Route: Successfully triggered Programmatic Assembler');
        }
      } catch (triggerError) {
        logger.error({ 
          jobId: requestData.jobId,
          triggerError: triggerError instanceof Error ? triggerError.message : String(triggerError)
        }, '🎨 TailwindStyling Route: Error triggering Programmatic Assembler');
      }

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