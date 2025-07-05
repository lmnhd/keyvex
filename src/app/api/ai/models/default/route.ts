// Default Models API Route - Provides default model configuration for components

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryModel, getFallbackModel } from '@/lib/ai/models/model-config';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  logger.info({ endpoint: '/api/ai/models/default', method: 'GET' }, '🔧 API [models/default]: GET request received');
  
  try {
    // Get the primary model for logicArchitect process (Data Requirements Research is part of Logic Architect workflow)
    const primaryModel = getPrimaryModel('logicArchitect');
    const fallbackModel = getFallbackModel('logicArchitect');
    
    const modelInfo = {
      success: true,
      agent: 'Data Requirements Research',
      defaultModel: {
        primary: primaryModel ? {
          id: primaryModel.modelInfo.id,
          name: primaryModel.modelInfo.name,
          provider: primaryModel.provider
        } : null,
        fallback: fallbackModel ? {
          id: fallbackModel.modelInfo.id,
          name: fallbackModel.modelInfo.name,
          provider: fallbackModel.provider
        } : null
      },
      // For compatibility with DataRequirementsResearch component
      primaryModel: primaryModel ? primaryModel.modelInfo.id : 'claude-3-7-sonnet-20250219'
    };

    logger.info({ 
      defaultPrimaryModel: modelInfo.defaultModel.primary?.id,
      defaultFallbackModel: modelInfo.defaultModel.fallback?.id
    }, '🔧 API [models/default]: Model info retrieved successfully');

    return NextResponse.json(modelInfo);

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error),
      endpoint: '/api/ai/models/default'
    }, '🔧 API [models/default]: GET request failed');
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get default model configuration',
        primaryModel: 'claude-3-7-sonnet-20250219' // Fallback
      },
      { status: 500 }
    );
  }
} 
