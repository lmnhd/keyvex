import { NextRequest, NextResponse } from 'next/server';
import { designStateLogic } from './core-logic';

export async function POST(request: NextRequest) {
  console.log('🎯 StateDesign Route: ==================== INCOMING REQUEST ====================');
  console.log('🎯 StateDesign Route: Request received at:', new Date().toISOString());
  console.log('🎯 StateDesign Route: Request URL:', request.url);
  console.log('🎯 StateDesign Route: Request method:', request.method);

  try {
    console.log('🎯 StateDesign Route: Parsing request body...');
    const body = await request.json();
    console.log('🎯 StateDesign Route: ✅ Request body parsed:', {
      jobId: body.jobId,
      selectedModel: body.selectedModel || 'default',
      hasJobId: !!body.jobId,
      hasMockTcc: !!body.mockTcc,
      bodyKeys: Object.keys(body)
    });

    // Check if this is a mock testing scenario
    if (body.mockTcc) {
      const testingMode = body.testingOptions ? 'Enhanced Testing' : 'Basic Mock';
      console.log(`🎯 StateDesign Route: 🧪 ${testingMode.toUpperCase()} MODE DETECTED`);
      console.log('🎯 StateDesign Route: Using provided mock TCC for testing');
      
      if (body.testingOptions) {
        console.log('🎯 StateDesign Route: Testing options:', {
          enableWebSocketStreaming: body.testingOptions.enableWebSocketStreaming || false,
          enableTccOperations: body.testingOptions.enableTccOperations || false,
          enableOrchestrationTriggers: body.testingOptions.enableOrchestrationTriggers || false
        });
      }
      
      console.log('🎯 StateDesign Route: Calling designStateLogic with mock data...');
      const startTime = Date.now();
      const result = await designStateLogic({
        jobId: body.mockTcc.jobId || crypto.randomUUID(),
        selectedModel: body.selectedModel || body.mockTcc.agentModelMapping?.['state-design'] || 'gpt-4-turbo',
        mockTcc: body.mockTcc,
        testingOptions: body.testingOptions
      });
      const duration = Date.now() - startTime;
      
      console.log('🎯 StateDesign Route: ✅ Mock testing completed:', {
        success: result.success,
        duration: `${duration}ms`,
        hasStateLogic: !!result.stateLogic,
        stateVariableCount: result.stateLogic?.stateVariables?.length || 0,
        functionCount: result.stateLogic?.functions?.length || 0,
        error: result.error || 'none'
      });

      // For mock testing, return immediately without triggering orchestration
      return NextResponse.json({
        success: result.success,
        stateLogic: result.stateLogic,
        message: result.success ? 'State logic designed successfully (mock mode)' : 'State logic design failed (mock mode)',
        mockMode: true,
        error: result.error
      });
    }

    // Normal orchestration mode
    console.log('🎯 StateDesign Route: Calling designStateLogic core function...');
    const startTime = Date.now();
    const result = await designStateLogic({
      jobId: body.jobId,
      selectedModel: body.selectedModel
    });
    const duration = Date.now() - startTime;
    
    console.log('🎯 StateDesign Route: ✅ designStateLogic completed:', {
      success: result.success,
      duration: `${duration}ms`,
      hasStateLogic: !!result.stateLogic,
      stateVariableCount: result.stateLogic?.stateVariables?.length || 0,
      functionCount: result.stateLogic?.functions?.length || 0,
      error: result.error || 'none'
    });

    if (result.success) {
      // SUCCESS: Trigger check for parallel completion instead of directly triggering JSX agent
      const baseUrl = request.nextUrl.origin;
      console.log('🎯 StateDesign Route: State logic design successful, checking parallel completion...');
      console.log('🎯 StateDesign Route: Base URL for parallel completion check:', baseUrl);
      
      // Check if parallel step completion allows proceeding to next step
      try {
        console.log('🎯 StateDesign Route: Calling checkParallelCompletion...');
        await checkParallelCompletion(baseUrl, body.jobId);
        console.log('🎯 StateDesign Route: ✅ Parallel completion check completed successfully');
      } catch (error) {
        console.error('🎯 StateDesign Route: ❌ Failed to check parallel completion:', {
          jobId: body.jobId,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        // Don't fail the whole request if parallel completion check fails
      }

      console.log('🎯 StateDesign Route: Returning success response...');
      return NextResponse.json({
        success: true,
        stateLogic: result.stateLogic,
        message: 'State logic designed successfully'
      });
    } else {
      console.error('🎯 StateDesign Route: ❌ State logic design failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
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
  jobId: string
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
    const requestPayload = { jobId };
    console.log('🎯 StateDesign Route: Request payload:', requestPayload);

    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
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

    const responseData = await response.json();
    console.log('🎯 StateDesign Route: ✅ Parallel completion check response:', responseData);
    console.log('🎯 StateDesign Route: ✅ Successfully triggered parallel completion check for jobId:', jobId);
  } catch (error) {
    console.error('🎯 StateDesign Route: ❌ Failed to check parallel completion:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      baseUrl,
      jobId
    });
    throw error;
  }
}
