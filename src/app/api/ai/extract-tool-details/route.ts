import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractToolDetailsLogic, ToolDetailsSchema, ExtractedToolDetails } from './core-logic';

// Define the Zod schema for the incoming request body
const ApiRequestSchema = z.object({
  description: z.string().min(10, { message: "Description must be at least 10 characters long." }).max(5000, { message: "Description must be at most 5000 characters long." }),
});

export async function POST(request: NextRequest) {
  try {
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error('[API Route] Error parsing JSON request body:', error);
      return NextResponse.json({ success: false, message: 'Invalid JSON format in request body.' }, { status: 400 });
    }

    const validationResult = ApiRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.warn('[API Route] Invalid request body:', validationResult.error.flatten());
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid request body.', 
          errors: validationResult.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const { description } = validationResult.data;

    console.log(`[API Route] Received request to extract tool details for description: "${description.substring(0,100)}..."`);

    const extractedDetails: ExtractedToolDetails = await extractToolDetailsLogic({ description });

    return NextResponse.json({ success: true, data: extractedDetails }, { status: 200 });

  } catch (error) {
    console.error('[API Route] Error in extract-tool-details endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    
    // More specific error for core logic failures
    if (errorMessage.startsWith('Failed to extract tool details')) {
        return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
    }
    if (errorMessage === 'Input description cannot be empty.') {
        return NextResponse.json({ success: false, message: errorMessage }, { status: 400 });
    }

    return NextResponse.json({ success: false, message: 'Internal server error while extracting tool details.' }, { status: 500 });
  }
}

// Optional: GET handler for health check or API description
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Extract Tool Details API is active.',
    description: 'POST a JSON object with a "description" field to this endpoint to get AI-extracted toolType and targetAudience using o4-mini.',
    expectedInput: {
      description: 'string (min 10, max 5000 characters)'
    },
    expectedOutput: {
      toolType: 'string',
      targetAudience: 'string'
    }
  }, { status: 200 });
}
