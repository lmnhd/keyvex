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
  selectedModel: string;
  availableModels: Array<{ id: string; name: string }>;
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
  onModelChange: (model: string) => void;
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