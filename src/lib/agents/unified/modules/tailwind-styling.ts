/**
 * Tailwind Styling Unified Module (Phase 1.2 - Refactored for Centralized Execution)
 * Conforms to the new simplified agent module structure.
 */

import { z } from 'zod';
import { 
  TailwindStylingResult,
} from '../../../types/tcc-unified';
import { 
  BaseAgentModule 
} from '../core/base-agent-module';
import { ValidationResult } from '../../../types/tcc-unified';

/**
 * Zod schema for the Tailwind Styling's output.
 */
const TailwindStylingResultSchema = z.object({
  styling: z.object({
    styledComponentCode: z.string(),
    styleMap: z.record(z.string()),
    colorScheme: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string().optional(),
      background: z.string(),
      surface: z.string().optional(),
      text: z.object({
        primary: z.string(),
        secondary: z.string(),
        muted: z.string().optional()
      }),
      border: z.string().optional(),
      success: z.string().optional(),
      warning: z.string().optional(),
      error: z.string().optional()
    }).passthrough().optional(),
    designTokens: z.object({
      spacing: z.record(z.string()),
      typography: z.record(z.string()),
      shadows: z.record(z.string()),
      animations: z.record(z.string())
    }).optional()
  }),
  metadata: z.object({
    classCount: z.number(),
    responsiveBreakpoints: z.array(z.string()),
    colorSchemeType: z.string()
  })
});

/**
 * TailwindStylingModule - Now a configuration and validation provider.
 */
export class TailwindStylingModule extends BaseAgentModule {
  constructor() {
    super('tailwind-styling', 15000); // 15 second timeout
  }

  /**
   * Exposes the Zod schema for this agent's output.
   * ✅ ENHANCED: Handle AI returning JSON strings instead of objects
   */
  getOutputSchema(): z.ZodSchema<any> {
    return TailwindStylingResultSchema.transform((data) => {
      // 🔧 FIX: Parse JSON string if styling field is returned as string
      if (typeof data.styling === 'string') {
        try {
          data.styling = JSON.parse(data.styling);
        } catch (parseError) {
          // Let validation handle the error
          console.warn('Failed to parse styling JSON string:', parseError);
        }
      }
      return data;
    });
  }

  /**
   * Validate the styling's structured output.
   */
  validate(output: TailwindStylingResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check required styling fields (parsing handled by schema transform)
    if (!output.styling) {
      errors.push('Missing styling object');
      score -= 50;
    } else {
      if (!output.styling.styledComponentCode) {
        errors.push('Missing styled component code');
        score -= 30;
      }
      
      if (!output.styling.styleMap) {
        errors.push('Missing style map');
        score -= 20;
      } else if (Object.keys(output.styling.styleMap).length === 0) {
        warnings.push('Style map is empty');
        score -= 10;
      }

      if (!output.styling.colorScheme) {
        warnings.push('Missing color scheme');
        score -= 10;
      }
    }

    // Check metadata
    if (!output.metadata) {
      warnings.push('Missing metadata');
      score -= 5;
    } else {
      if (output.metadata.classCount === 0) {
        warnings.push('No Tailwind classes detected');
        score -= 10;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score),
      missingFields: []
    };
  }

  /**
   * Define the required TCC fields for this agent.
   */
  getRequiredInputFields(): string[] {
    return [
      'jsxLayout.componentStructure',
      'brainstormData.creativeEnhancements'
    ];
  }

  /**
   * Support edit mode
   */
  supportsEditMode(): boolean {
    return true;
  }

  /**
   * Provide a description for logging.
   */
  protected getAgentDescription(): string {
    return 'Applies comprehensive Tailwind CSS styling with responsive design and color schemes.';
  }
}
