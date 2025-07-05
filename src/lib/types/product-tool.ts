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
  type: string;
  dependencies: string[];
  userInstructions: string;
  developerNotes: string;
  source: string;
  version: string;
  shortDescription?: string;
  category?: string;
  targetAudience?: string;
  industry?: string;
  tags?: string[];
  estimatedCompletionTime?: number; // minutes
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced';
  features?: string[];
  icon?: {
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
  componentCode: string;
  
  // Metadata
  metadata: ProductToolMetadata;
  
  // Style information
  initialStyleMap: Record<string, string>; 
  currentStyleMap: Record<string, string>;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  
  // Optional legacy fields
  version?: string;
  status?: 'draft' | 'published' | 'archived' | 'public';
  createdBy?: string;
  componentSet?: 'shadcn' | 'legacy';
  colorScheme?: ToolColorScheme;
  
  // Analytics
  analytics?: {
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
