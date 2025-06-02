import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateToolStyleCoreLogic } from './core-logic';
// import { requireAuth } from '@/lib/auth/debug'; // Uncomment if auth is needed

const updateStyleRequestSchema = z.object({
  toolDefinitionId: z.string(), // ID of the ProductToolDefinition
  dataStyleId: z.string(),      // The 'data-style-id' of the element to update
  newTailwindClasses: z.string(), // The new Tailwind classes to apply
});

export async function POST(request: NextRequest) {
  try {
    // const userId = await requireAuth(); // Uncomment if auth is needed
    const body = await request.json();
    const validatedData = updateStyleRequestSchema.parse(body);

    const result = await updateToolStyleCoreLogic({
      toolDefinitionId: validatedData.toolDefinitionId,
      dataStyleId: validatedData.dataStyleId,
      newTailwindClasses: validatedData.newTailwindClasses,
      // userId // Pass if auth is used and core logic needs it
    });

    if (!result.success || !result.updatedToolDefinition) {
      return NextResponse.json({ success: false, message: result.message || 'Failed to update style.' }, { status: result.status || 400 });
    }

    return NextResponse.json({ success: true, updatedToolDefinition: result.updatedToolDefinition });
  } catch (error) {
    console.error('[UPDATE_TOOL_STYLE_API] Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: 'Invalid request body.', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}

// Optional: GET handler for health check or info if needed
// export async function GET(request: NextRequest) {
//   return NextResponse.json({ success: true, message: 'Update Tool Style API is active.' });
// } 