import { NextRequest, NextResponse } from 'next/server';
import { designJsxLayout } from './core-logic';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';

export async function POST(request: NextRequest) {
  console.log('🏗️ JSXLayout Route: ==================== INCOMING REQUEST ====================');

  try {
    const body: { jobId: string; selectedModel?: string; tcc: ToolConstructionContext; } = await request.json();
    const { jobId, selectedModel, tcc } = body;

    console.log('🏗️ JSXLayout Route: ✅ Request body parsed:', {
      jobId,
      selectedModel: selectedModel || 'default',
      hasTcc: !!tcc,
    });

    if (!jobId || !tcc) {
      throw new Error('jobId and tcc must be provided in the request body.');
    }

    // Pass the received TCC directly to the core logic
    const result = await designJsxLayout({
      jobId,
      selectedModel,
      tcc, // Pass the in-memory TCC
    });

    if (result.success && result.updatedTcc) {
      // Trigger check for parallel completion with the NEW TCC
      const baseUrl = request.nextUrl.origin;
      console.log('🏗️ JSXLayout Route: JSX layout design successful, checking parallel completion...');
      
      try {
        await checkParallelCompletion(baseUrl, jobId, result.updatedTcc);
        console.log('🏗️ JSXLayout Route: ✅ Parallel completion check completed successfully');
      } catch (error) {
        console.error('🏗️ JSXLayout Route: ❌ Failed to check parallel completion:', error);
      }

      console.log('🏗️ JSXLayout Route: Returning success response...');
      return NextResponse.json({
        success: true,
        jsxLayout: result.jsxLayout,
      });

    } else {
      console.error('🏗️ JSXLayout Route: ❌ JSX layout design failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'JSX layout design failed to return an updated TCC.'
      }, { status: 500 });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('🏗️ JSXLayout Route: ❌ Route error:', { errorMessage, stack: (error as Error).stack });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// Helper function to check parallel completion and trigger next step
async function checkParallelCompletion(
  baseUrl: string, 
  jobId: string,
  tcc: ToolConstructionContext // Pass the full TCC
): Promise<void> {
  console.log('🏗️ JSXLayout Route: ==================== PARALLEL COMPLETION CHECK ====================');
  try {
    const response = await fetch(`${baseUrl}/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, tcc }), // Pass the full TCC object
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Check parallel completion responded with status: ${response.status}, body: ${responseText}`);
    }

    console.log('🏗️ JSXLayout Route: ✅ Successfully triggered parallel completion check for jobId:', jobId);
  } catch (error) {
    console.error('🏗️ JSXLayout Route: ❌ Failed to trigger parallel completion check:', error);
    throw error;
  }
}

// REMOVED: Direct agent-to-agent calls to prevent Vercel timeouts
// All orchestration now handled by client-side coordination