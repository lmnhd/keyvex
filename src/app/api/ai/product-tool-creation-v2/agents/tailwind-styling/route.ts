import { applyStyling } from './core-logic';
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  console.log('🎨 TailwindStyling Route: ==================== INCOMING REQUEST ====================');
  console.log('🎨 TailwindStyling Route: Request received at:', new Date().toISOString());
  console.log('🎨 TailwindStyling Route: Request URL:', request.url);
  console.log('🎨 TailwindStyling Route: Request method:', request.method);

  try {
    console.log('🎨 TailwindStyling Route: Parsing request body...');
    const body = await request.json();
    console.log('🎨 TailwindStyling Route: ✅ Request body parsed:', {
      jobId: body.jobId,
      selectedModel: body.selectedModel || 'default',
      hasJobId: !!body.jobId,
      bodyKeys: Object.keys(body)
    });

    console.log('🎨 TailwindStyling Route: Calling applyStyling core function...');
    const startTime = Date.now();
    const result = await applyStyling({
      jobId: body.jobId,
      selectedModel: body.selectedModel
    });
    const duration = Date.now() - startTime;
    
    console.log('🎨 TailwindStyling Route: ✅ applyStyling completed:', {
      success: result.success,
      duration: `${duration}ms`,
      hasStyling: !!result.styling,
      styleMapCount: result.styling?.styleMap?.length || 0,
      colorSchemeKeys: result.styling?.colorScheme ? Object.keys(result.styling.colorScheme).length : 0,
      error: result.error || 'none'
    });

    if (result.success) {
      console.log('🎨 TailwindStyling Route: ✅ Styling applied successfully');
      console.log('🎨 TailwindStyling Route: Returning success response...');
      return NextResponse.json({
        success: true,
        styling: result.styling,
        message: 'Tailwind styling applied successfully'
      });
    } else {
      console.error('🎨 TailwindStyling Route: ❌ Styling application failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('🎨 TailwindStyling Route: ==================== ROUTE ERROR ====================');
    console.error('🎨 TailwindStyling Route: ❌ Route error details:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    if (error instanceof Error && error.stack) {
      console.error('🎨 TailwindStyling Route: ❌ Error stack:', error.stack);
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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