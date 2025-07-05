import { NextRequest, NextResponse } from 'next/server';
import { emitStepProgress } from '@/lib/streaming/progress-emitter.server';

export async function POST(request: NextRequest) {
  try {
    const { jobId, userId = 'debug-user-123', testMessage = 'Test message from debug endpoint' } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }
    
    // Try to send a test message immediately
    console.log(`🧪 [DEBUG-WEBSOCKET-TEST] Attempting to send message to userId: ${userId}, jobId: ${jobId}`);
    
    await emitStepProgress(
      jobId,
      'planning_function_signatures',
      'in_progress',
      testMessage,
      { userId, testData: 'Debug WebSocket test', timestamp: new Date().toISOString() }
    );
    
    console.log(`🧪 [DEBUG-WEBSOCKET-TEST] Message sent successfully`);
    
    return NextResponse.json({
      success: true,
      message: 'Test message sent to WebSocket',
      jobId,
      userId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🧪 [DEBUG-WEBSOCKET-TEST] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 
