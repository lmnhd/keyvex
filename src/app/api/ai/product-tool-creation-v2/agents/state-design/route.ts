import { NextRequest, NextResponse } from 'next/server';
import { designStateLogic } from './core-logic';
import logger from '@/lib/logger';
import { ToolConstructionContext } from '@/lib/types/product-tool-creation-v2/tcc';
import { z } from 'zod';

// Phase 2: Edit mode schema for agents
const EditModeContextSchema = z.object({
  isEditMode: z.boolean(),
  instructions: z.array(z.object({
    targetAgent: z.string(),
    editType: z.enum(['refine', 'replace', 'enhance']),
    instructions: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    createdAt: z.string(),
  })),
  context: z.string(),
});

const StateDesignRequestSchema = z.object({
  jobId: z.string(),
  selectedModel: z.string().optional(),
  tcc: z.custom<ToolConstructionContext>().optional(),
  mockTcc: z.custom<ToolConstructionContext>().optional(),
  editMode: EditModeContextSchema.optional(),       // ✅ Complex edit mode (existing)
  isEditMode: z.boolean().optional(),               // ✅ Simple edit mode (ADD)
  editInstructions: z.string().optional(),          // ✅ Simple edit mode (ADD)
  isSequentialMode: z.boolean().optional(),         // ✅ Sequential mode detection (ADD)
});

export async function POST(request: NextRequest) {
  logger.info('🎯 StateDesign Route: Route handler started');
  
  try {
    const body = await request.json();
    
    // 🔍 CRITICAL DEBUG: Log the raw request body BEFORE schema parsing
    logger.info({
      rawBodyKeys: Object.keys(body),
      jobIdPresent: 'jobId' in body,
      jobIdValue: body.jobId,
      jobIdType: typeof body.jobId,
      fullBodySample: {
        jobId: body.jobId,
        selectedModel: body.selectedModel,
        hasGoogleTcc: !!body.tcc,
        hasMockTcc: !!body.mockTcc,
        isIsolatedTest: body.isIsolatedTest
      }
    }, '🎯 StateDesign Route: 🔍 RAW REQUEST BODY ANALYSIS');
    
    const { jobId, selectedModel, tcc, mockTcc, editMode, isEditMode, editInstructions, isSequentialMode } = StateDesignRequestSchema.parse(body);

    // Detect isolated test mode
    const isIsolatedTest = !!mockTcc;
    const activeTcc = mockTcc || tcc;

    if (!jobId || (!tcc && !mockTcc)) {
      return NextResponse.json(
        { success: false, error: "jobId and either tcc or mockTcc must be provided." },
        { status: 400 }
      );
    }

    // 🚨 ISOLATION TEST LOGGING: Show exactly what TCC data we received
    console.log(`\n🎯 ========== STATE DESIGN ROUTE - RECEIVED DATA ==========`);
    console.log(`JobId: ${jobId}`);
    console.log(`Selected Model: ${selectedModel}`);
    console.log(`Is Isolated Test: ${isIsolatedTest}`);
    console.log(`Is Sequential Mode: ${isSequentialMode}`);
    console.log(`TCC Present: ${!!tcc}`);
    console.log(`Mock TCC Present: ${!!mockTcc}`);
    
    if (activeTcc) {
      console.log(`\n--- ACTIVE TCC STRUCTURE ---`);
      console.log(`TCC Keys: ${Object.keys(activeTcc).join(', ')}`);
      console.log(`TCC Job ID: ${activeTcc.jobId}`);
      console.log(`TCC User ID: ${activeTcc.userId}`);
      console.log(`TCC Has Brainstorm Data: ${!!activeTcc.brainstormData}`);
      console.log(`TCC Has Function Signatures: ${!!activeTcc.definedFunctionSignatures}`);
      console.log(`Function Signatures Count: ${activeTcc.definedFunctionSignatures?.length || 0}`);
      
      if (activeTcc.brainstormData) {
        console.log(`\n--- BRAINSTORM DATA ANALYSIS ---`);
        console.log(`Brainstorm Keys: ${Object.keys(activeTcc.brainstormData).join(', ')}`);
        console.log(`Core Concept: ${activeTcc.brainstormData.coreConcept || 'N/A'}`);
        console.log(`Tool Type: ${activeTcc.brainstormData.toolType || 'N/A'}`);
        console.log(`Suggested Inputs Count: ${activeTcc.brainstormData.suggestedInputs?.length || 0}`);
        console.log(`Key Calculations Count: ${activeTcc.brainstormData.keyCalculations?.length || 0}`);
        
        if (activeTcc.brainstormData.suggestedInputs?.length > 0) {
          console.log(`\n--- FIRST 3 SUGGESTED INPUTS ---`);
          console.log(JSON.stringify(activeTcc.brainstormData.suggestedInputs.slice(0, 3), null, 2));
        }
        
        if (activeTcc.brainstormData.keyCalculations?.length > 0) {
          console.log(`\n--- FIRST 3 KEY CALCULATIONS ---`);
          console.log(JSON.stringify(activeTcc.brainstormData.keyCalculations.slice(0, 3), null, 2));
        }
      }
      
      if (activeTcc.definedFunctionSignatures && activeTcc.definedFunctionSignatures.length > 0) {
        console.log(`\n--- FUNCTION SIGNATURES ---`);
        console.log(JSON.stringify(activeTcc.definedFunctionSignatures, null, 2));
      }
    }
    
    console.log(`🎯 ========== END RECEIVED DATA ==========\n`);

    // ADD to both agents' route handlers:
    const isEditModeActive = isEditMode || editMode?.isEditMode || false;
    const editInstructionsArray = editInstructions ? [editInstructions] : (editMode?.instructions || []);

    logger.info({ 
      jobId, 
      selectedModel,
      isEditMode: isEditModeActive,
      editInstructionsCount: editInstructionsArray.length,
      isIsolatedTest,
      activeTccKeys: activeTcc ? Object.keys(activeTcc) : [],
      hasBrainstormData: !!activeTcc?.brainstormData,
      hasFunctionSignatures: !!activeTcc?.definedFunctionSignatures,
      functionSignatureCount: activeTcc?.definedFunctionSignatures?.length || 0
    }, '🎯 StateDesign Route: Request received with isolation detection');
    
    // Call the pure core logic function with edit mode context
    const result = await designStateLogic({
      jobId,
      selectedModel,
      tcc: mockTcc || tcc,
      editMode,
    });

    if (!result.success || !result.updatedTcc) {
      logger.error({ jobId, error: result.error }, '🎯 StateDesign Route: Core logic failed');
      return NextResponse.json(
        { success: false, error: result.error || 'State design failed' },
        { status: 500 }
      );
    }

    // Only trigger orchestration if NOT in isolated test mode AND NOT in sequential mode
    if (!isIsolatedTest && !isSequentialMode) {
      logger.info({ jobId }, '🎯 StateDesign Route: Core logic successful, checking parallel completion.');

      // Non-blocking call to the centralized parallel completion checker endpoint
      const checkCompletionUrl = new URL('/api/ai/product-tool-creation-v2/orchestrate/check-parallel-completion', request.nextUrl.origin);
      fetch(checkCompletionUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              jobId,
              tcc: result.updatedTcc,
          }),
      }).catch(error => {
          logger.error({ jobId, error: error.message }, '🎯 StateDesign Route: Failed to trigger parallel completion check endpoint');
      });
    } else if (isSequentialMode) {
      logger.info({ jobId }, '🎯 StateDesign Route: ✅ Sequential mode - skipping parallel completion, orchestrator will handle next step');
    } else {
      logger.info({ jobId }, '🎯 StateDesign Route: ✅ Isolated test mode - skipping parallel completion check');
    }

    // Return appropriate response for isolated vs normal mode
    const responseData: any = {
      success: true,
      stateLogic: result.stateLogic,
    };

    if (isIsolatedTest || isSequentialMode) {
      responseData.updatedTcc = result.updatedTcc;
      logger.info({ jobId }, `🎯 StateDesign Route: ✅ Including updatedTcc in ${isIsolatedTest ? 'isolated test' : 'sequential'} response`);
      
      // 🔍 DEBUG: Log what we're actually returning
      logger.info({
        jobId,
        responseDataKeys: Object.keys(responseData),
        hasUpdatedTcc: !!responseData.updatedTcc,
        updatedTccKeys: responseData.updatedTcc ? Object.keys(responseData.updatedTcc) : [],
        hasStateLogicInUpdatedTcc: !!responseData.updatedTcc?.stateLogic,
        stateLogicVariableCount: responseData.updatedTcc?.stateLogic?.variables?.length || 0,
        stateLogicFunctionCount: responseData.updatedTcc?.stateLogic?.functions?.length || 0
      }, '🎯 StateDesign Route: 🔍 DEBUG - Response data structure');
    }

    logger.info({ jobId }, '🎯 StateDesign Route: Returning success response.');
    return NextResponse.json(responseData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '🎯 StateDesign Route: Route handler error');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}