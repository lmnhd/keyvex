// TODO: Define comprehensive AI types for the Keyvex platform

export interface ToolSuggestion {
  id: string;
  type: 'calculator' | 'quiz' | 'assessment';
  title: string;
  description: string;
  targetAudience: string;
  estimatedCompletionTime: number;
  complexity: 'simple' | 'medium' | 'complex';
  suggestedQuestions?: string[];
  metadata: Record<string, any>;
}

export interface FrameworkInput {
  toolType: string;
  expertise: string;
  targetAudience: string;
  goals: string[];
  methodology?: string;
  existingContent?: string;
}

export interface LogicStructure {
  framework: {
    methodology: string;
    steps: LogicStep[];
    scoringSystem: ScoringSystem;
  };
  questions: Question[];
  resultCategories: ResultCategory[];
  metadata: Record<string, any>;
}

export interface LogicStep {
  id: string;
  title: string;
  description: string;
  order: number;
  questions: string[];
  weight?: number;
}

export interface ScoringSystem {
  type: 'points' | 'weighted' | 'categorical' | 'custom';
  maxScore?: number;
  weights?: Record<string, number>;
  formula?: string;
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'scale' | 'text' | 'number' | 'boolean';
  options?: QuestionOption[];
  validation?: ValidationRule[];
  scoring?: QuestionScoring;
  order: number;
  required: boolean;
  metadata: Record<string, any>;
}

export interface QuestionOption {
  id: string;
  text: string;
  value: string | number;
  score?: number;
  followUpQuestions?: string[];
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export interface QuestionScoring {
  points?: number;
  weight?: number;
  category?: string;
  formula?: string;
}

export interface ResultCategory {
  id: string;
  name: string;
  description: string;
  scoreRange?: {
    min: number;
    max: number;
  };
  conditions?: ResultCondition[];
  recommendations: string[];
  metadata: Record<string, any>;
}

export interface ResultCondition {
  type: 'score' | 'answer' | 'category' | 'custom';
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
  questionId?: string;
}

export interface ContentContext {
  toolType: string;
  framework: LogicStructure;
  brandingGuidelines?: BrandingInput;
  existingContent?: string;
  tone: 'professional' | 'friendly' | 'authoritative' | 'casual';
  targetAudience: string;
}

export interface ContentPieces {
  title: string;
  description: string;
  instructions: string;
  questions: ContentQuestion[];
  resultDescriptions: Record<string, string>;
  callToAction: string;
  metadata: Record<string, any>;
}

export interface ContentQuestion {
  id: string;
  text: string;
  helpText?: string;
  placeholder?: string;
  errorMessages: Record<string, string>;
}

export interface BrandingInput {
  companyName?: string;
  industry?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  fonts?: {
    heading?: string;
    body?: string;
  };
  tone: string;
  logoUrl?: string;
  existingBrandAssets?: string[];
}

export interface StyleConfig {
  theme: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
      border: string;
    };
    fonts: {
      heading: string;
      body: string;
      sizes: Record<string, string>;
    };
    spacing: Record<string, string>;
    borderRadius: string;
    shadows: Record<string, string>;
  };
  layout: {
    maxWidth: string;
    padding: string;
    gaps: Record<string, string>;
  };
  components: {
    button: ComponentStyle;
    input: ComponentStyle;
    card: ComponentStyle;
    progress: ComponentStyle;
  };
  customCSS?: string;
  metadata: Record<string, any>;
}

export interface ComponentStyle {
  base: string;
  variants: Record<string, string>;
  states: Record<string, string>;
}

export interface AISession {
  id: string;
  userId: string;
  toolId?: string;
  currentStep: AIStep;
  status: 'active' | 'completed' | 'abandoned' | 'error';
  sessionData: Record<string, any>;
  conversationHistory: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export type AIStep = 'magic-spark' | 'logic-architect' | 'content-crafter' | 'style-master' | 'review' | 'publish';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AIProvider {
  name: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface AIRequest {
  provider: AIProvider;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: any[];
  metadata?: Record<string, any>;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  metadata?: Record<string, any>;
}

// TODO: Add more AI-specific types as needed
// TODO: Define streaming response types
// TODO: Add validation schemas using Zod
// TODO: Define error types for AI operations 