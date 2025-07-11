import { NextRequest, NextResponse } from 'next/server';
import { analyzeDataRequirementsAndResearch } from '../product-tool-creation-v2/agents/data-requirements-research/core-logic';
import { BrainstormData, ToolConstructionContext } from '@/lib/types/tcc-unified';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [STANDALONE-RESEARCH] API called');
    const body = await request.json();
    console.log('🔍 [STANDALONE-RESEARCH] Request body received:', { 
      hasBrainstormData: !!body.brainstormData,
      selectedModel: body.selectedModel 
    });
    
    const { brainstormData, selectedModel, userLocation } = body;

    if (!brainstormData) {
      console.error('❌ [STANDALONE-RESEARCH] Missing brainstormData');
      return NextResponse.json({ error: 'brainstormData is required' }, { status: 400 });
    }

    if (!selectedModel) {
      console.error('❌ [STANDALONE-RESEARCH] Missing selectedModel');
      return NextResponse.json({ error: 'selectedModel is required' }, { status: 400 });
    }

    const jobId = uuidv4();
    console.log('🔍 [STANDALONE-RESEARCH] Generated jobId:', jobId);
    
    // Create a minimal TCC for the V2 agent
    const mockTcc: ToolConstructionContext = {
      jobId,
      brainstormData: brainstormData as BrainstormData,
      userId: 'standalone-user',
      currentOrchestrationStep: 'dataRequirementsResearch' as any,
      status: 'in_progress' as any,
      userInput: {
        description: brainstormData.valueProposition || 'Tool creation',
        toolType: brainstormData.promptOptions?.toolComplexity || 'moderate'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tccVersion: '1.0.0'
    };

    // Call the V2 agent logic directly
    console.log('🔍 [STANDALONE-RESEARCH] Calling V2 agent logic...');
    const result = await analyzeDataRequirementsAndResearch({
      jobId,
      selectedModel,
      mockTcc,
      userLocation
    });
    
    console.log('🔍 [STANDALONE-RESEARCH] V2 agent result:', { 
      success: result.success, 
      hasData: !!result.dataRequirementsResearch 
    });

    if (!result.success) {
      console.error('❌ [STANDALONE-RESEARCH] V2 agent failed:', result.error);
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Research analysis failed' 
      }, { status: 500 });
    }

    console.log('✅ [STANDALONE-RESEARCH] Success, returning data');
    return NextResponse.json({
      success: true,
      jobId,
      dataRequirementsResearch: result.dataRequirementsResearch,
    });

  } catch (error) {
    console.error('❌ [STANDALONE-RESEARCH] Unexpected error:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}