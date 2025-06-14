import { NextRequest, NextResponse } from 'next/server';
import { analyzeDataRequirementsAndResearch } from '../product-tool-creation-v2/agents/data-requirements-research/core-logic';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { auth } from '@clerk/nextjs/server';
import logger from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      brainstormData, 
      brainstormId, 
      selectedModel, 
      userLocation, 
      persistToBrainstorm = false 
    } = body;

    if (!brainstormData) {
      return NextResponse.json({ error: 'brainstormData is required' }, { status: 400 });
    }

    if (persistToBrainstorm && !brainstormId) {
      return NextResponse.json({ error: 'brainstormId is required when persistToBrainstorm is true' }, { status: 400 });
    }

    const jobId = uuidv4();
    
    logger.info({ 
      jobId, 
      userId, 
      brainstormId, 
      persistToBrainstorm,
      hasUserLocation: !!userLocation 
    }, '🔍 DataRequirementsResearch API: Starting research analysis');

    // Create a mock TCC with the brainstorm data
    const mockTcc: Partial<ToolConstructionContext> = {
      jobId,
      userId,
      brainstormData,
      steps: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Call the research agent
    const result = await analyzeDataRequirementsAndResearch({
      jobId,
      selectedModel,
      mockTcc,
      userLocation,
      persistToBrainstorm,
      brainstormId,
    });

    if (!result.success) {
      logger.error({ jobId, error: result.error }, '🔍 DataRequirementsResearch API: Analysis failed');
      return NextResponse.json({ 
        error: result.error || 'Research analysis failed' 
      }, { status: 500 });
    }

    logger.info({ 
      jobId, 
      userId, 
      brainstormId, 
      persistToBrainstorm,
      hasResearchResults: !!result.dataRequirementsResearch,
      wasPersistedToDB: !!result.updatedBrainstorm
    }, '🔍 DataRequirementsResearch API: Analysis completed successfully');

    return NextResponse.json({
      success: true,
      jobId,
      dataRequirementsResearch: result.dataRequirementsResearch,
      updatedBrainstorm: result.updatedBrainstorm,
      wasPersistedToDB: !!result.updatedBrainstorm,
    });

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error) 
    }, '🔍 DataRequirementsResearch API: Unexpected error');
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 