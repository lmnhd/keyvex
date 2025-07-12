// Utility for selecting the single source-of-truth component code and metadata
// used by the Tool-Generation workbench preview.
// -----------------------------------------------------------------------------
// Strongly-typed on purpose – NO `any` allowed.
// -----------------------------------------------------------------------------

export interface ToolMetadata {
  title: string;
  description: string;
  slug: string;
}

// Accept partial metadata from various sources
export type PartialToolMetadata = Partial<ToolMetadata>;

export interface PreviewTool {
  /** Raw JSX / TSX source of the component */
  componentCode: string;
  /** Human-friendly metadata displayed in the UI */
  metadata: ToolMetadata;
}

export interface PreviewToolSource {
  /** Highest-priority code passed in directly by the caller */
  assembledCode?: string;
  /** Code held inside ToolConstructionContext */
  tccComponentCode?: string;
  /** Code coming from a final product structure */
  finalProductComponentCode?: string;
  /** Metadata coming from final product (if available) */
  finalProductMetadata?: PartialToolMetadata;
  /** Code produced by a test job result */
  testJobComponentCode?: string;
  /** Metadata produced by a test job result */
  testJobMetadata?: PartialToolMetadata;
}

/**
 * Build a `PreviewTool` object, choosing the first non-empty code source based
 * on the well-defined priority order and merging the best available metadata.
 */
export function buildPreviewTool(source: PreviewToolSource): PreviewTool {
  const componentCode =
    source.assembledCode?.trim() ||
    source.tccComponentCode?.trim() ||
    source.finalProductComponentCode?.trim() ||
    source.testJobComponentCode?.trim() ||
    '';

  const metadata: ToolMetadata = {
    title:
      source.finalProductMetadata?.title ||
      source.testJobMetadata?.title ||
      'Generated Tool',
    description:
      source.finalProductMetadata?.description ||
      source.testJobMetadata?.description ||
      'AI-generated component',
    slug:
      source.finalProductMetadata?.slug ||
      source.testJobMetadata?.slug ||
      'generated-tool',
  };

  return {
    componentCode,
    metadata,
  };
}
