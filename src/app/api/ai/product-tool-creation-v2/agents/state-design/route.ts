import { NextRequest, NextResponse } from 'next/server';
import { designStateLogic } from './core-logic';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  console.log('🎯 StateDesign Route: ==================== INCOMING REQUEST ====================');
  console.log('🎯 StateDesign Route: Request received at:', new Date().toISOString());
  console.log('🎯 StateDesign Route: Request URL:', request.url);
  console.log('🎯 StateDesign Route: Request method:', request.method);

  try {
    console.log('🎯 StateDesign Route: Parsing request body...');
    const body: { jobId: string; selectedModel?: string; tcc: ToolConstructionContext; } = await request.json();
    const { jobId, selectedModel, tcc } = body;

    console.log('🎯 StateDesign Route: ✅ Request body parsed:', {
      jobId,
      selectedModel: selectedModel || 'default',
      hasTcc: !!tcc,
    });

    if (!jobId || !tcc) {
      throw new Error('jobId and tcc must be provided in the request body.');
    }
    
    // Pass the received TCC directly to the core logic
    const result = await designStateLogic({
      jobId,
      selectedModel,
      tcc, // Pass the in-memory TCC
    });

    if (result.success && result.updatedTcc) {
      // Trigger check for parallel completion with the NEW TCC
      const baseUrl = request.nextUrl.origin;
      console.log('🎯 StateDesign Route: State logic design successful, checking parallel completion...');
      
      try {
        await checkParallelCompletion(baseUrl, jobId, result.updatedTcc);
        console.log('🎯 StateDesign Route: ✅ Parallel completion check completed successfully');
      } catch (error) {
        console.error('🎯 StateDesign Route: ❌ Failed to check parallel completion:', error);
      }

      console.log('🎯 StateDesign Route: Returning success response...');
      return NextResponse.json({
        success: true,
        stateLogic: result.stateLogic,
      });

    } else {
      console.error('🎯 StateDesign Route: ❌ State logic design failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'State design failed to return an updated TCC.'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('🎯 StateDesign Route: ==================== ROUTE ERROR ====================');
    console.error('🎯 StateDesign Route: ❌ Route error details:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    if (error instanceof Error && error.stack) {
      console.error('🎯 StateDesign Route: ❌ Error stack:', error.stack);
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
  jobId: string,
  tcc: ToolConstructionContext // Pass the full TCC
): Promise<void> {
  console.log('🎯 StateDesign Route: ==================== PARALLEL COMPLETION CHECK ====================');
  console.log('🎯 StateDesign Route: Parallel completion check details:', {
    baseUrl,
    jobId,
    targetUrl: `${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`,
    timestamp: new Date().toISOString()
  });

  try {
    console.log('🎯 StateDesign Route: Sending HTTP request to check-parallel-completion...');
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, tcc }), // Pass the full TCC object
    });

    console.log('🎯 StateDesign Route: ✅ HTTP response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('🎯 StateDesign Route: ❌ Parallel completion check failed:', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText
      });
      throw new Error(`Check parallel completion responded with status: ${response.status}, body: ${responseText}`);
    }

    console.log('🎯 StateDesign Route: ✅ Successfully triggered parallel completion check for jobId:', jobId);
  } catch (error) {
    console.error('🎯 StateDesign Route: ❌ Failed to trigger parallel completion check:', error);
    throw error;
  }
}
