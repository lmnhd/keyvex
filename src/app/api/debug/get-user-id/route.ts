import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/debug';

/**
 * Debug endpoint to get the current user ID for WebSocket connections
 */
export async function GET() {
  try {
    const userId = await requireAuth();
    return NextResponse.json({ 
      success: true, 
      userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: 'debug-user-123' // Fallback to default
    });
  }
} 