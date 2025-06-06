import React from 'react';
import { ProductToolDefinition } from '@/lib/types/product-tool';

export interface SavedLogicResult {
  id: string;
  timestamp: number;
  date: string;
  toolType: string;
  targetAudience: string;
  industry?: string;
  result: any;
}

export interface SavedTool {
  id: string;
  timestamp: number;
  date: string;
  title: string;
  tool: ProductToolDefinition;
}

export interface DynamicInputProps {
  currentQuestion: any;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isDarkMode: boolean;
  onOpenColorPicker?: () => void;
  onPreviewUpdate?: (questionId: string, value: string) => void;
  customColors?: Array<{
    value: string;
    label: string;
    colors: string[];
  }>;
  hideSubmitButton?: boolean;
}

export interface ColorPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (primaryColor: string, secondaryColor: string) => void;
  initialPrimary?: string;
  initialSecondary?: string;
  isDarkMode: boolean;
}

export interface FullFormPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (answers: Record<string, string>) => void;
  questions: any[];
  initialAnswers: Record<string, string>;
  isDarkMode: boolean;
}

export interface OptionsMenuProps {
  isDarkMode: boolean;
  onClose: () => void;
  useMockData: boolean;
  useIteratorTest: boolean;
  historyPanelSide: 'left' | 'right';
  savedLogicResults: SavedLogicResult[];
  savedTools: SavedTool[];
  communicationModel: string;
  logicArchitectModel: string;
  createToolModel: string;
  availableModels: Array<{ id: string; name: string; provider?: string }>;
  onToggleDarkMode: () => void;
  onToggleMockData: () => void;
  onToggleIteratorTest: () => void;
  onToggleHistoryPanel: () => void;
  onResetWorkflow: () => void;
  onShowLogicSelect: () => void;
  onShowToolsSelect: () => void;
  onTestBrainstorming: () => void;
  onTestToolCreation: () => void;
  onTestMultiPart: () => void;
  onTestFileUpload: () => void;
  onTestColorPicker: () => void;
  onTestComponentValidation: () => void;
  onTestStyleUpdate: () => void;
  onCommunicationModelChange: (model: string) => void;
  onLogicArchitectModelChange: (model: string) => void;
  onCreateToolModelChange: (model: string) => void;
}

export interface MenuSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    badge?: string;
  }>;
}

// Question interface with properly typed data
export interface Question {
  id: string;
  text: string;
  type: 'text' | 'select' | 'multiselect' | 'range' | 'boolean' | 'color' | 'textarea';
  options?: string[];
  data?: Record<string, string | number | boolean | string[]>;
  required?: boolean;
  validation?: ValidationRule[];
  dependencies?: QuestionDependency[];
  metadata?: QuestionMetadata;
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: string | number;
  message: string;
}

export interface QuestionDependency {
  questionId: string;
  condition: 'equals' | 'not_equals' | 'contains' | 'not_contains';
  value: string | number | boolean;
}

export interface QuestionMetadata {
  category?: string;
  priority?: number;
  helpText?: string;
  placeholder?: string;
}

// Answer interface with typed values
export interface Answer {
  questionId: string;
  value: string | number | boolean | string[];
  timestamp: number;
  metadata?: AnswerMetadata;
}

export interface AnswerMetadata {
  confidence?: number;
  source?: 'user' | 'ai' | 'default';
  editCount?: number;
}

// Workflow state interfaces
export interface WorkflowState {
  currentPhase: 'initial' | 'questions' | 'processing' | 'results' | 'editing';
  currentQuestionIndex: number;
  completedQuestions: string[];
  answers: Record<string, Answer>;
  isTransitioning: boolean;
  processingStep?: ProcessingStep;
}

export interface ProcessingStep {
  name: string;
  description: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

// Tool-related interfaces
export interface SavedTool {
  id: string;
  name: string;
  definition: ProductToolDefinition;
  timestamp: number;
  version: string;
  metadata: SavedToolMetadata;
}

export interface SavedToolMetadata {
  source: 'generated' | 'imported' | 'template';
  tags?: string[];
  description?: string;
  lastModified: number;
}

// UI Component props interfaces
export interface ComponentRenderOptions {
  theme: 'light' | 'dark';
  size: 'small' | 'medium' | 'large';
  interactive: boolean;
  showDebugInfo?: boolean;
}

export interface ToolRenderError {
  type: 'compilation' | 'runtime' | 'validation';
  message: string;
  details?: string;
  timestamp: number;
}

// AI Processing interfaces
export interface AIProcessingContext {
  phase: string;
  sessionId: string;
  userId: string;
  answers: Record<string, Answer>;
  previousResults?: ProcessingResult[];
}

export interface ProcessingResult {
  type: 'component' | 'logic' | 'style' | 'validation';
  content: string;
  metadata: ProcessingResultMetadata;
  timestamp: number;
}

export interface ProcessingResultMetadata {
  model: string;
  tokensUsed: number;
  processingTime: number;
  confidence?: number;
}

// Storage and persistence interfaces
export interface StorageOperation {
  type: 'save' | 'load' | 'delete' | 'list';
  target: 'local' | 'cloud' | 'both';
  data?: Record<string, unknown>;
}

export interface StorageResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: number;
}

// Event and tracking interfaces
export interface UserInteraction {
  type: 'click' | 'input' | 'navigation' | 'selection';
  target: string;
  value?: string | number | boolean;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface BehaviorEvent {
  eventType: string;
  sessionId: string;
  userId?: string;
  data: Record<string, unknown>;
  timestamp: number;
} 