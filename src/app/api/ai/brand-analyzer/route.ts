// Brand Analyzer API Route for testing vision capabilities

import { NextRequest, NextResponse } from 'next/server';
import { MagicSparkAgent } from '@/lib/ai/agents/magic-spark';
import { debugLog } from '@/lib/auth/debug';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      imageData, 
      imageType = 'logo', 
      context,
      action = 'analyze'
    } = body;

    debugLog('Brand analyzer API called', { 
      action, 
      imageType, 
      hasImageData: !!imageData,
      hasContext: !!context 
    });

    const magicSpark = new MagicSparkAgent();

    if (action === 'analyze' && imageData) {
      // Analyze brand assets
      const analysis = await magicSpark.analyzeBrandAssets(
        imageData,
        imageType,
        context
      );

      return NextResponse.json({
        success: true,
        analysis,
        timestamp: new Date().toISOString()
      });

    } else if (action === 'stream-discovery') {
      // For streaming discovery, we'll return a simple response
      // In a real implementation, this would use streaming
      return NextResponse.json({
        success: true,
        message: 'Streaming discovery not implemented in this test route',
        suggestion: 'Use the test page for full streaming functionality'
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action or missing required parameters'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Brand analyzer API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Brand analysis failed'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint
  return NextResponse.json({
    success: true,
    message: 'Brand Analyzer API is running',
    endpoints: {
      POST: 'Analyze brand assets or start discovery',
      actions: ['analyze', 'stream-discovery']
    },
    timestamp: new Date().toISOString()
  });
} 