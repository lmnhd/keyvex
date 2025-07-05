import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: SET BREAKPOINT HERE - Line 7
    console.log('🔍 BREAKPOINT TEST: Request received');
    
    // TODO: SET BREAKPOINT HERE - Line 10  
    const testData = {
      success: true,
      message: 'Breakpoint test successful',
      receivedData: body,
      timestamp: new Date().toISOString()
    };
    
    // TODO: SET BREAKPOINT HERE - Line 17
    console.log('🔍 BREAKPOINT TEST: About to return response');
    
    return NextResponse.json(testData);
    
  } catch (error) {
    // TODO: SET BREAKPOINT HERE - Line 23
    console.error('🔍 BREAKPOINT TEST: Error occurred', error);
    
    return NextResponse.json(
      { success: false, error: 'Test failed' },
      { status: 500 }
    );
  }
} 
