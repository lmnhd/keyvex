'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Sun,
  Moon,
  Brain,
  MessageCircle,
  RotateCcw,
  Layout,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Upload,
  Palette,
  Zap,
  History,
  Calculator,
  CheckCircle,
  ChevronDown
} from 'lucide-react';

// Types for the OptionsMenu component
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
  tool: any; // ProductToolDefinition
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

export function OptionsMenu({ 
  isDarkMode, 
  onClose, 
  useMockData,
  useIteratorTest,
  historyPanelSide,
  savedLogicResults,
  savedTools,
  selectedModel,
  availableModels,
  onToggleDarkMode,
  onToggleMockData,
  onToggleIteratorTest,
  onToggleHistoryPanel,
  onResetWorkflow,
  onShowLogicSelect,
  onShowToolsSelect,
  onTestBrainstorming,
  onTestToolCreation,
  onTestMultiPart,
  onTestFileUpload,
  onTestColorPicker,
  onTestComponentValidation,
  onTestStyleUpdate,
  onModelChange
}: OptionsMenuProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['mode-workflow']));

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const menuSections: MenuSection[] = [
    {
      id: 'mode-workflow',
      title: 'Mode & Workflow',
      icon: <Settings className="h-4 w-4" />,
      items: [
        {
          icon: isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
          label: isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
          onClick: () => {
            onToggleDarkMode();
            onClose();
          }
        },
        {
          icon: <Brain className="h-4 w-4" />,
          label: useMockData ? 'Switch to Real AI' : 'Switch to Mock Mode',
          onClick: () => {
            onToggleMockData();
            onClose();
          }
        },
        {
          icon: <MessageCircle className="h-4 w-4" />,
          label: useIteratorTest ? 'Standard Workflow' : 'Iterator Test Workflow',
          onClick: () => {
            onToggleIteratorTest();
            onClose();
          }
        },
        {
          icon: <RotateCcw className="h-4 w-4" />,
          label: 'Reset Workflow',
          onClick: () => {
            onResetWorkflow();
            onClose();
          }
        }
      ]
    },
    {
      id: 'panel-settings',
      title: 'Panel Settings',
      icon: <Layout className="h-4 w-4" />,
      items: [
        {
          icon: historyPanelSide === 'left' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />,
          label: `History Panel: ${historyPanelSide === 'left' ? 'Left Side' : 'Right Side'}`,
          onClick: () => {
            onToggleHistoryPanel();
            onClose();
          }
        }
      ]
    },
    {
      id: 'test-commands',
      title: 'Test API Commands',
      icon: <MessageSquare className="h-4 w-4" />,
      items: [
        {
          icon: <MessageCircle className="h-4 w-4" />,
          label: 'Test Multi-Part Questions',
          onClick: () => {
            onTestMultiPart();
            onClose();
          }
        },
        {
          icon: <Upload className="h-4 w-4" />,
          label: 'Test File Upload',
          onClick: () => {
            onTestFileUpload();
            onClose();
          }
        },
        {
          icon: <Palette className="h-4 w-4" />,
          label: 'Test Color Picker',
          onClick: () => {
            onTestColorPicker();
            onClose();
          }
        }
      ]
    },
    {
      id: 'ai-tools',
      title: 'AI Tools & Logic Architect',
      icon: <Brain className="h-4 w-4" />,
      items: [
        {
          icon: <Brain className="h-4 w-4" />,
          label: 'Test Logic Architect Brainstorming',
          onClick: () => {
            onTestBrainstorming();
            onClose();
          }
        },
        {
          icon: <Zap className="h-4 w-4" />,
          label: 'Test Tool Creation Agent',
          onClick: () => {
            onTestToolCreation();
            onClose();
          }
        }
      ]
    },
    {
      id: 'data-management',
      title: 'Saved Data Management',
      icon: <History className="h-4 w-4" />,
      items: [
        {
          icon: <History className="h-4 w-4" />,
          label: 'View Saved Logic Results',
          onClick: () => {
            onShowLogicSelect();
            onClose();
          },
          badge: String(savedLogicResults.length)
        },
        {
          icon: <Calculator className="h-4 w-4" />,
          label: 'View Saved Tools',
          onClick: () => {
            onShowToolsSelect();
            onClose();
          },
          badge: String(savedTools.length)
        }
      ]
    },
    {
      id: 'development',
      title: 'Development & Testing',
      icon: <CheckCircle className="h-4 w-4" />,
      items: [
        {
          icon: <CheckCircle className="h-4 w-4" />,
          label: 'Run Component Validation Tests',
          onClick: () => {
            onTestComponentValidation();
            onClose();
          }
        },
        {
          icon: <Palette className="h-4 w-4" />,
          label: 'Test AI Style Updates',
          onClick: () => {
            onTestStyleUpdate();
            onClose();
          }
        }
      ]
    },
    {
      id: 'model-selection',
      title: 'Model Selection',
      icon: <Brain className="h-4 w-4" />,
      items: [] // Special section with custom rendering
    }
  ];

  return (
    <div className={`absolute right-0 top-full mt-2 w-72 rounded-xl shadow-xl border z-50 max-h-96 overflow-y-auto ${
      isDarkMode 
        ? 'bg-gray-800 border-gray-600 shadow-black/20' 
        : 'bg-white border-gray-300 shadow-lg'
    }`}>
      <div className="py-2">
        {menuSections.map((section, sectionIndex) => (
          <div key={section.id}>
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className={`w-full px-4 py-3 text-left text-sm font-medium flex items-center justify-between transition-colors rounded-lg mx-2 ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {section.icon}
                <span>{section.title}</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                expandedSections.has(section.id) ? 'rotate-180' : ''
              }`} />
            </button>

            {/* Section Items */}
            {expandedSections.has(section.id) && (
              <div className="pb-2">
                {/* Special handling for model selection */}
                {section.id === 'model-selection' ? (
                  <div className="px-8 py-2">
                    <label htmlFor="model-select" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Choose Model:
                    </label>
                    <select
                      id="model-select"
                      value={selectedModel}
                      onChange={(e) => onModelChange(e.target.value)}
                      className={`w-full p-2 rounded-md border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-200' 
                          : 'bg-white border-gray-300 text-gray-700'
                      }`}
                    >
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Selected: {availableModels.find(m => m.id === selectedModel)?.name}
                    </p>
                  </div>
                ) : (
                  /* Regular menu items */
                  section.items.map((item, itemIndex) => (
                    <button
                      key={itemIndex}
                      onClick={item.onClick}
                      className={`w-full px-8 py-2 text-left text-sm flex items-center justify-between transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <Badge variant="outline" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Divider between sections (except last) */}
            {sectionIndex < menuSections.length - 1 && (
              <div className={`border-t my-2 mx-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 