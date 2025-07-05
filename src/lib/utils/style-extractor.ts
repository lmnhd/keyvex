/**
 * Style Extractor Utility
 * 
 * Automatically processes React.createElement component code to:
 * 1. Extract inline Tailwind className styles
 * 2. Generate unique data-style-id attributes  
 * 3. Create corresponding initialStyleMap
 * 4. Replace/enhance component code with data-style-id attributes
 * 
 * This eliminates the need for AI to perfectly generate style mappings
 * and ensures 100% compatibility with our validation requirements.
 */

export interface StyleExtractionResult {
  modifiedComponentCode: string;
  initialStyleMap: Record<string, string>;
  extractedStyles: Array<{
    elementType: string;
    originalClassName: string;
    generatedId: string;
    contextHint?: string;
  }>;
  totalElements: number;
  totalStylesExtracted: number;
}

export interface StyleExtractionOptions {
  preserveExistingDataStyleIds?: boolean;
  generateDescriptiveIds?: boolean;
  includeBasicElements?: boolean; // Whether to add data-style-id to basic divs, spans, etc.
  idPrefix?: string; // Custom prefix for generated IDs
}

const DEFAULT_OPTIONS: StyleExtractionOptions = {
  preserveExistingDataStyleIds: true,
  generateDescriptiveIds: true,
  includeBasicElements: true,
  idPrefix: ''
};

/**
 * Main function to extract styles and enhance component code
 */
export function extractAndEnhanceStyles(
  componentCode: string,
  options: StyleExtractionOptions = {}
): StyleExtractionResult {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  console.log('🎨 STYLE EXTRACTOR: Starting style extraction and enhancement...');
  console.log('🎨 STYLE EXTRACTOR: Component code length:', componentCode.length);
  console.log('🎨 STYLE EXTRACTOR: Options:', config);
  
  const result: StyleExtractionResult = {
    modifiedComponentCode: componentCode,
    initialStyleMap: {},
    extractedStyles: [],
    totalElements: 0,
    totalStylesExtracted: 0
  };
  
  try {
    // Step 1: Parse React.createElement calls and extract style information
    const elementMatches = findReactCreateElementCalls(componentCode);
    console.log(`🎨 STYLE EXTRACTOR: Found ${elementMatches.length} React.createElement calls`);
    
    result.totalElements = elementMatches.length;
    
    // Step 2: Process each element to extract styles and generate IDs
    let modifiedCode = componentCode;
    let idCounter = 1;
    
    for (const element of elementMatches) {
      const enhancementResult = enhanceElementWithStyleId(
        element,
        idCounter,
        config
      );
      
      if (enhancementResult.modified) {
        // Replace the original element with the enhanced version
        modifiedCode = modifiedCode.replace(element.fullMatch, enhancementResult.enhancedElement);
        
        // Add to style map if we extracted/generated styles
        if (enhancementResult.styleMapping) {
          result.initialStyleMap[enhancementResult.styleMapping.id] = enhancementResult.styleMapping.className;
          result.extractedStyles.push({
            elementType: element.elementType,
            originalClassName: enhancementResult.styleMapping.className,
            generatedId: enhancementResult.styleMapping.id,
            contextHint: enhancementResult.contextHint
          });
          result.totalStylesExtracted++;
        }
        
        idCounter++;
      }
    }
    
    result.modifiedComponentCode = modifiedCode;
    
    console.log(`🎨 STYLE EXTRACTOR: Extraction complete!`);
    console.log(`🎨 STYLE EXTRACTOR: Enhanced ${result.totalStylesExtracted} elements with styles`);
    console.log(`🎨 STYLE EXTRACTOR: Generated style map with ${Object.keys(result.initialStyleMap).length} entries`);
    
    return result;
    
  } catch (error) {
    console.error('🎨 STYLE EXTRACTOR: Error during extraction:', error);
    
    // Return original code on error
    return {
      modifiedComponentCode: componentCode,
      initialStyleMap: {},
      extractedStyles: [],
      totalElements: 0,
      totalStylesExtracted: 0
    };
  }
}

interface ElementMatch {
  fullMatch: string;
  elementType: string;
  propsString: string;
  hasClassName: boolean;
  hasDataStyleId: boolean;
  className?: string;
  existingDataStyleId?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Find and parse React.createElement calls in component code
 */
function findReactCreateElementCalls(code: string): ElementMatch[] {
  const elements: ElementMatch[] = [];
  
  // Regex to match React.createElement calls
  // This handles: React.createElement('div', { props }, children)
  const createElementRegex = /React\.createElement\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\{[^}]*\}|\{[\s\S]*?\}|\null)\s*(?:,[\s\S]*?)?\)/g;
  
  let match;
  while ((match = createElementRegex.exec(code)) !== null) {
    const fullMatch = match[0];
    const elementType = match[1];
    const propsString = match[2] || '{}';
    
    // Check if this element has className
    const classNameMatch = propsString.match(/className\s*:\s*['"`]([^'"`]+)['"`]/);
    const dataStyleIdMatch = propsString.match(/['"`]data-style-id['"`]\s*:\s*['"`]([^'"`]+)['"`]/);
    
    elements.push({
      fullMatch,
      elementType,
      propsString,
      hasClassName: !!classNameMatch,
      hasDataStyleId: !!dataStyleIdMatch,
      className: classNameMatch?.[1],
      existingDataStyleId: dataStyleIdMatch?.[1],
      startIndex: match.index,
      endIndex: match.index + fullMatch.length
    });
  }
  
  return elements;
}

interface ElementEnhancementResult {
  modified: boolean;
  enhancedElement: string;
  styleMapping?: {
    id: string;
    className: string;
  };
  contextHint?: string;
}

/**
 * Enhance a single React element with data-style-id and extract styles
 */
function enhanceElementWithStyleId(
  element: ElementMatch,
  idCounter: number,
  config: StyleExtractionOptions
): ElementEnhancementResult {
  
  // Skip if element already has data-style-id and we're preserving existing ones
  if (element.hasDataStyleId && config.preserveExistingDataStyleIds) {
    console.log(`🎨 STYLE EXTRACTOR: Skipping ${element.elementType} - already has data-style-id: ${element.existingDataStyleId}`);
    return { modified: false, enhancedElement: element.fullMatch };
  }
  
  // Skip elements without className unless includeBasicElements is true
  if (!element.hasClassName && !config.includeBasicElements) {
    console.log(`🎨 STYLE EXTRACTOR: Skipping ${element.elementType} - no className and includeBasicElements is false`);
    return { modified: false, enhancedElement: element.fullMatch };
  }
  
  // Generate a descriptive ID for this element
  const generatedId = generateDescriptiveId(element, idCounter, config);
  const contextHint = generateContextHint(element);
  
  console.log(`🎨 STYLE EXTRACTOR: Enhancing ${element.elementType} with ID: ${generatedId}`);
  
  // Create the enhanced props object
  let enhancedProps = element.propsString;
  
  // Add data-style-id to props
  if (enhancedProps === '{}' || enhancedProps === 'null') {
    // Empty props object
    enhancedProps = `{ 'data-style-id': '${generatedId}' }`;
  } else {
    // Add to existing props
    // Remove the closing brace and add our new property
    enhancedProps = enhancedProps.slice(0, -1).trim();
    if (enhancedProps !== '{') {
      enhancedProps += ', ';
    }
    enhancedProps += `'data-style-id': '${generatedId}' }`;
  }
  
  // Create the enhanced element
  const enhancedElement = element.fullMatch.replace(
    element.propsString,
    enhancedProps
  );
  
  // Create style mapping if element has className
  const styleMapping = element.hasClassName ? {
    id: generatedId,
    className: element.className!
  } : undefined;
  
  return {
    modified: true,
    enhancedElement,
    styleMapping,
    contextHint
  };
}

/**
 * Generate descriptive IDs based on element type and context
 */
function generateDescriptiveId(
  element: ElementMatch,
  counter: number,
  config: StyleExtractionOptions
): string {
  const prefix = config.idPrefix || '';
  
  if (!config.generateDescriptiveIds) {
    return `${prefix}element-${counter}`;
  }
  
  // Generate descriptive names based on element type and className
  const elementType = element.elementType;
  const className = element.className || '';
  
  // Common patterns for generating meaningful IDs
  if (elementType === 'div') {
    if (className.includes('container')) return `${prefix}main-container`;
    if (className.includes('header')) return `${prefix}header-section`;
    if (className.includes('content')) return `${prefix}content-area`;
    if (className.includes('footer')) return `${prefix}footer-section`;
    if (className.includes('grid')) return `${prefix}grid-layout`;
    if (className.includes('flex')) return `${prefix}flex-container`;
    return `${prefix}container-${counter}`;
  }
  
  if (elementType === 'button') {
    if (className.includes('primary')) return `${prefix}primary-button`;
    if (className.includes('secondary')) return `${prefix}secondary-button`;
    if (className.includes('submit')) return `${prefix}submit-button`;
    if (className.includes('cancel')) return `${prefix}cancel-button`;
    return `${prefix}button-${counter}`;
  }
  
  if (elementType === 'input') {
    if (className.includes('search')) return `${prefix}search-input`;
    if (className.includes('email')) return `${prefix}email-input`;
    if (className.includes('password')) return `${prefix}password-input`;
    return `${prefix}input-${counter}`;
  }
  
  if (elementType === 'h1') return `${prefix}main-title`;
  if (elementType === 'h2') return `${prefix}section-title`;
  if (elementType === 'h3') return `${prefix}subsection-title`;
  if (elementType === 'p') return `${prefix}text-content-${counter}`;
  if (elementType === 'span') return `${prefix}text-span-${counter}`;
  if (elementType === 'label') return `${prefix}form-label-${counter}`;
  
  // Default fallback
  return `${prefix}${elementType}-${counter}`;
}

/**
 * Generate context hints for debugging and logging
 */
function generateContextHint(element: ElementMatch): string {
  const hints = [];
  
  if (element.className) {
    const className = element.className;
    if (className.includes('bg-')) hints.push('background');
    if (className.includes('text-')) hints.push('text');
    if (className.includes('border')) hints.push('border');
    if (className.includes('p-') || className.includes('px-') || className.includes('py-')) hints.push('padding');
    if (className.includes('m-') || className.includes('mx-') || className.includes('my-')) hints.push('margin');
    if (className.includes('w-') || className.includes('h-')) hints.push('sizing');
    if (className.includes('flex') || className.includes('grid')) hints.push('layout');
  }
  
  return hints.length > 0 ? hints.join(', ') : 'basic element';
}

/**
 * Validate that the extraction was successful
 */
export function validateStyleExtraction(result: StyleExtractionResult): {
  isValid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Check that we have at least some style mappings
  if (Object.keys(result.initialStyleMap).length === 0) {
    warnings.push('No style mappings were generated - component may not have styleable elements');
  }
  
  // Check that style map entries are valid
  for (const [id, className] of Object.entries(result.initialStyleMap)) {
    if (!id.trim()) {
      issues.push(`Empty style ID found in mapping`);
    }
    if (!className.trim()) {
      issues.push(`Empty className found for ID: ${id}`);
    }
    if (!result.modifiedComponentCode.includes(`'data-style-id': '${id}'`)) {
      issues.push(`Style mapping ID '${id}' not found in component code`);
    }
  }
  
  // Check that component code contains data-style-id attributes
  const dataStyleIdCount = (result.modifiedComponentCode.match(/data-style-id/g) || []).length;
  if (dataStyleIdCount === 0) {
    issues.push('No data-style-id attributes found in modified component code');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Simple utility to preview the extraction results
 */
export function previewStyleExtraction(result: StyleExtractionResult): string {
  const preview = [
    '🎨 STYLE EXTRACTION PREVIEW',
    '=' .repeat(50),
    `📊 Total Elements: ${result.totalElements}`,
    `✨ Enhanced Elements: ${result.totalStylesExtracted}`,
    `🗺️  Style Map Entries: ${Object.keys(result.initialStyleMap).length}`,
    '',
    '📋 Generated Style Mappings:',
    ...Object.entries(result.initialStyleMap).map(([id, className]) => 
      `   ${id} → "${className}"`
    ),
    '',
    '🔧 Enhanced Elements:',
    ...result.extractedStyles.map(style => 
      `   ${style.elementType} (${style.generatedId}): ${style.contextHint}`
    ),
    '',
    '💻 Modified Code Preview (first 500 chars):',
    result.modifiedComponentCode.substring(0, 500) + '...'
  ];
  
  return preview.join('\n');
} 
