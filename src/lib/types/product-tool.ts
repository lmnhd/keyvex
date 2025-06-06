// ============================================================================
// SIMPLIFIED PRODUCT TOOL TYPES
// For React Component-Based Tool System
// ============================================================================

// Basic metadata for tools
export interface ProductToolMetadata {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  type: string;
  category: string;
  targetAudience: string;
  industry: string;
  tags: string[];
  estimatedCompletionTime: number; // minutes
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  features: string[];
  icon: {
    type: 'lucide' | 'emoji';
    value: string;
  };
}

// Simple color scheme for tools
export interface ToolColorScheme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  border: string;
  success: string;
  warning: string;
  error: string;
}

// Main tool definition - stores React component code
export interface ProductToolDefinition {
  // Basic info
  id: string;
  slug: string;
  version: string;
  status: 'draft' | 'published' | 'archived' | 'public';
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  
  // Metadata
  metadata: ProductToolMetadata;
  
  // Component set used (ShadCN or legacy HTML)
  componentSet: 'shadcn' | 'legacy';
  
  // React component code as a string (pre-compiled to JS)
  componentCode: string;
  
  // Style information
  colorScheme: ToolColorScheme; // Predefined color scheme
  initialStyleMap?: Record<string, string>; // Generated once by AI, maps data-style-id to Tailwind classes
  currentStyleMap?: Record<string, string>;  // Active, editable style map, initially a copy of initialStyleMap
  
  // Analytics
  analytics: {
    enabled: boolean;
    completions: number;
    averageTime: number;
  };
}

// For tool creation requests
export interface ToolCreationRequest {
  userIntent: string;
  context?: {
    targetAudience?: string;
    industry?: string;
    toolType?: string;
    features?: string[];
    businessDescription?: string;
    colors?: string[];
    collectedAnswers?: Record<string, any>;
    brandAnalysis?: {
      colors?: any[];
      style?: string;
      personality?: string[];
      recommendations?: string[];
    };
    conversationHistory?: any[];
    logicArchitectInsights?: {
      coreWConcept?: string;
      keyCalculations?: any[];
      interactionFlow?: any[];
      valueProposition?: string;
      creativeEnhancements?: string[];
      userExperienceFlow?: any[];
      businessLogic?: any[];
    };
  };
}

// For component validation
export interface ComponentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
} 