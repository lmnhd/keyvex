import { NextRequest, NextResponse } from 'next/server';
import { analyzeDataRequirementsAndResearch } from '../product-tool-creation-v2/agents/data-requirements-research/core-logic';
import { BrainstormData, ToolConstructionContext } from '@/lib/types/tcc-unified';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brainstormData, selectedModel, userLocation } = body;

    if (!brainstormData) {
      return NextResponse.json({ error: 'brainstormData is required' }, { status: 400 });
    }

    if (!selectedModel) {
      return NextResponse.json({ error: 'selectedModel is required' }, { status: 400 });
    }

    const jobId = uuidv4();
    
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
    const result = await analyzeDataRequirementsAndResearch({
      jobId,
      selectedModel,
      mockTcc,
      userLocation
    });

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Research analysis failed' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      jobId,
      dataRequirementsResearch: result.dataRequirementsResearch,
    });

  } catch (error) {
    console.error('Data requirements research error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}