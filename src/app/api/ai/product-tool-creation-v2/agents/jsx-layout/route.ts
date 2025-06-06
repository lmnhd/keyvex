import { NextRequest, NextResponse } from 'next/server';
import { designJsxLayout } from './core-logic';

export async function POST(request: NextRequest) {
  console.log('🏗️ JSXLayout Route: ==================== INCOMING REQUEST ====================');
  console.log('🏗️ JSXLayout Route: Request received at:', new Date().toISOString());
  console.log('🏗️ JSXLayout Route: Request URL:', request.url);
  console.log('🏗️ JSXLayout Route: Request method:', request.method);

  try {
    console.log('🏗️ JSXLayout Route: Parsing request body...');
    const body = await request.json();
    console.log('🏗️ JSXLayout Route: ✅ Request body parsed:', {
      jobId: body.jobId,
      selectedModel: body.selectedModel || 'default',
      hasJobId: !!body.jobId,
      hasMockTcc: !!body.mockTcc,
      bodyKeys: Object.keys(body)
    });

    // Check if this is a mock testing scenario
    if (body.mockTcc) {
      console.log('🏗️ JSXLayout Route: 🧪 MOCK TESTING MODE DETECTED');
      console.log('🏗️ JSXLayout Route: Using provided mock TCC for testing');
      
      console.log('🏗️ JSXLayout Route: Calling designJsxLayout with mock data...');
      const startTime = Date.now();
      const result = await designJsxLayout({
        jobId: body.mockTcc.jobId || crypto.randomUUID(),
        selectedModel: body.selectedModel || body.mockTcc.agentModelMapping?.['jsx-layout'] || 'gpt-4-turbo',
        mockTcc: body.mockTcc
      });
      const duration = Date.now() - startTime;
      
      console.log('🏗️ JSXLayout Route: ✅ Mock testing completed:', {
        success: result.success,
        duration: `${duration}ms`,
        hasJsxLayout: !!result.jsxLayout,
        componentStructureLength: result.jsxLayout?.componentStructure?.length || 0,
        elementMapCount: result.jsxLayout?.elementMap?.length || 0,
        error: result.error || 'none'
      });

      // For mock testing, return immediately without triggering orchestration
      return NextResponse.json({
        success: result.success,
        jsxLayout: result.jsxLayout,
        message: result.success ? 'JSX layout designed successfully (mock mode)' : 'JSX layout design failed (mock mode)',
        mockMode: true,
        error: result.error
      });
    }

    // Normal orchestration mode
    console.log('🏗️ JSXLayout Route: Calling designJSXLayout core function...');
    const startTime = Date.now();
    const result = await designJsxLayout({
      jobId: body.jobId,
      selectedModel: body.selectedModel
    });
    const duration = Date.now() - startTime;
    
    console.log('🏗️ JSXLayout Route: ✅ designJSXLayout completed:', {
      success: result.success,
      duration: `${duration}ms`,
      hasJsxLayout: !!result.jsxLayout,
      componentStructureLength: result.jsxLayout?.componentStructure?.length || 0,
      elementMapCount: result.jsxLayout?.elementMap?.length || 0,
      error: result.error || 'none'
    });

    if (result.success) {
      // SUCCESS: Trigger check for parallel completion instead of directly triggering next agent
      const baseUrl = request.nextUrl.origin;
      console.log('🏗️ JSXLayout Route: JSX layout design successful, checking parallel completion...');
      console.log('🏗️ JSXLayout Route: Base URL for parallel completion check:', baseUrl);
      
      // Check if parallel step completion allows proceeding to next step
      try {
        console.log('🏗️ JSXLayout Route: Calling checkParallelCompletion...');
        await checkParallelCompletion(baseUrl, body.jobId);
        console.log('🏗️ JSXLayout Route: ✅ Parallel completion check completed successfully');
      } catch (error) {
        console.error('🏗️ JSXLayout Route: ❌ Failed to check parallel completion:', {
          jobId: body.jobId,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        // Don't fail the whole request if parallel completion check fails
      }

      console.log('🏗️ JSXLayout Route: Returning success response...');
      return NextResponse.json({
        success: true,
        jsxLayout: result.jsxLayout,
        message: 'JSX layout designed successfully'
      });
    } else {
      console.error('🏗️ JSXLayout Route: ❌ JSX layout design failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('🏗️ JSXLayout Route: ==================== ROUTE ERROR ====================');
    console.error('🏗️ JSXLayout Route: ❌ Route error details:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    if (error instanceof Error && error.stack) {
      console.error('🏗️ JSXLayout Route: ❌ Error stack:', error.stack);
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
  console.log('🏗️ JSXLayout Route: ==================== PARALLEL COMPLETION CHECK ====================');
  console.log('🏗️ JSXLayout Route: Parallel completion check details:', {
    baseUrl,
    jobId,
    targetUrl: `${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`,
    timestamp: new Date().toISOString()
  });

  try {
    console.log('🏗️ JSXLayout Route: Sending HTTP request to check-parallel-completion...');
    const requestPayload = { jobId };
    console.log('🏗️ JSXLayout Route: Request payload:', requestPayload);

    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    console.log('🏗️ JSXLayout Route: ✅ HTTP response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('🏗️ JSXLayout Route: ❌ Parallel completion check failed:', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText
      });
      throw new Error(`Check parallel completion responded with status: ${response.status}, body: ${responseText}`);
    }

    const responseData = await response.json();
    console.log('🏗️ JSXLayout Route: ✅ Parallel completion check response:', responseData);
    console.log('🏗️ JSXLayout Route: ✅ Successfully triggered parallel completion check for jobId:', jobId);
  } catch (error) {
    console.error('🏗️ JSXLayout Route: ❌ Failed to check parallel completion:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      baseUrl,
      jobId
    });
    throw error;
  }
}

// REMOVED: Direct agent-to-agent calls to prevent Vercel timeouts
// All orchestration now handled by client-side coordination