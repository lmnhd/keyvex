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
  ChevronDown,
  Dice6,
  Sparkles,
  Type
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
  communicationModel: string;
  logicArchitectModel: string;
  createToolModel: string;
  availableModels: Array<{ id: string; name: string; provider?: string }>;
  useSavedBrainstorm?: boolean;
  selectedSavedBrainstorm?: SavedLogicResult | null;
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
  onToggleSavedBrainstormMode?: () => void;
  onSelectSavedBrainstorm?: (brainstorm: SavedLogicResult) => void;
  onTestToolCreationWithSavedBrainstorm?: () => void;
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
  communicationModel,
  logicArchitectModel,
  createToolModel,
  availableModels,
  useSavedBrainstorm,
  selectedSavedBrainstorm,
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
  onCommunicationModelChange,
  onLogicArchitectModelChange,
  onCreateToolModelChange,
  onToggleSavedBrainstormMode,
  onSelectSavedBrainstorm,
  onTestToolCreationWithSavedBrainstorm
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
      id: 'models',
      title: 'AI Models',
      icon: <Brain className="h-4 w-4" />,
      items: [] // Special section with custom rendering for all models
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
      id: 'ai-tools-logic-architect',
      title: 'AI Tools & Logic Architect',
      icon: <Brain className="h-4 w-4" />,
      items: [
        {
          icon: <Sparkles className="h-4 w-4" />,
          label: 'Test Brainstorming',
          onClick: () => {
            onTestBrainstorming();
            onClose();
          }
        },
        {
          icon: <Calculator className="h-4 w-4" />,
          label: 'Test Tool Creation Agent',
          onClick: () => {
            onTestToolCreation();
            onClose();
          }
        },
        {
          icon: <Settings className="h-4 w-4" />,
          label: 'Test Multi-Part UI',
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
        },
        {
          icon: <CheckCircle className="h-4 w-4" />,
          label: 'Test Component Validation',
          onClick: () => {
            onTestComponentValidation();
            onClose();
          }
        },
        {
          icon: <Type className="h-4 w-4" />,
          label: 'Test Style Update',
          onClick: () => {
            onTestStyleUpdate();
            onClose();
          }
        }
      ]
    },
    {
      id: 'saved-brainstorms',
      title: 'Saved Brainstorm Mode',
      icon: <Brain className="h-4 w-4" />,
      items: [] // Special section with custom rendering for brainstorm selection
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
                {/* Special handling for model selection sections */}
                {section.id === 'models' ? (
                  <div className="px-8 py-2 space-y-4">
                    {/* Communication Agent Model */}
                    <div>
                      <label htmlFor="communication-model-select" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Communication Agent (Conversation & Questions):
                      </label>
                      <select
                        id="communication-model-select"
                        value={communicationModel}
                        onChange={(e) => onCommunicationModelChange(e.target.value)}
                        className={`w-full p-2 rounded-md border text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-200' 
                            : 'bg-white border-gray-300 text-gray-700'
                        }`}
                      >
                        <option value="default">Use Default (from config)</option>
                        <optgroup label="OpenAI">
                          {availableModels
                            .filter(model => model.provider === 'openai')
                            .map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Anthropic">
                          {availableModels
                            .filter(model => model.provider === 'anthropic')
                            .map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {communicationModel === 'default' ? (
                          'Using configured default model'
                        ) : (
                          <>
                            Selected: {availableModels.find(m => m.id === communicationModel)?.name}
                            {availableModels.find(m => m.id === communicationModel)?.provider && (
                              <span className="ml-1 opacity-70">
                                ({availableModels.find(m => m.id === communicationModel)?.provider})
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>

                    {/* Logic Architect Agent Model */}
                    <div>
                      <label htmlFor="logic-architect-model-select" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Logic Architect Agent (Brainstorming & Analysis):
                      </label>
                      <select
                        id="logic-architect-model-select"
                        value={logicArchitectModel}
                        onChange={(e) => onLogicArchitectModelChange(e.target.value)}
                        className={`w-full p-2 rounded-md border text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-200' 
                            : 'bg-white border-gray-300 text-gray-700'
                        }`}
                      >
                        <option value="default">Use Default (from config)</option>
                        <optgroup label="OpenAI">
                          {availableModels
                            .filter(model => model.provider === 'openai')
                            .map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Anthropic">
                          {availableModels
                            .filter(model => model.provider === 'anthropic')
                            .map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {logicArchitectModel === 'default' ? (
                          'Using configured default model'
                        ) : (
                          <>
                            Selected: {availableModels.find(m => m.id === logicArchitectModel)?.name}
                            {availableModels.find(m => m.id === logicArchitectModel)?.provider && (
                              <span className="ml-1 opacity-70">
                                ({availableModels.find(m => m.id === logicArchitectModel)?.provider})
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>

                    {/* Create Tool Agent Model */}
                    <div>
                      <label htmlFor="create-tool-model-select" className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Create Tool Agent (Tool Generation):
                      </label>
                      <select
                        id="create-tool-model-select"
                        value={createToolModel}
                        onChange={(e) => onCreateToolModelChange(e.target.value)}
                        className={`w-full p-2 rounded-md border text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-200' 
                            : 'bg-white border-gray-300 text-gray-700'
                        }`}
                      >
                        <option value="default">Use Default (from config)</option>
                        <optgroup label="OpenAI">
                          {availableModels
                            .filter(model => model.provider === 'openai')
                            .map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Anthropic">
                          {availableModels
                            .filter(model => model.provider === 'anthropic')
                            .map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {createToolModel === 'default' ? (
                          'Using configured default model'
                        ) : (
                          <>
                            Selected: {availableModels.find(m => m.id === createToolModel)?.name}
                            {availableModels.find(m => m.id === createToolModel)?.provider && (
                              <span className="ml-1 opacity-70">
                                ({availableModels.find(m => m.id === createToolModel)?.provider})
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ) : section.id === 'saved-brainstorms' ? (
                  <div className="px-8 py-2 space-y-4">
                    {/* Toggle for Saved Brainstorm Mode */}
                    <div className="flex items-center justify-between">
                      <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Use Saved Brainstorm Mode
                      </label>
                      <button
                        onClick={onToggleSavedBrainstormMode}
                        title={`${useSavedBrainstorm ? 'Disable' : 'Enable'} saved brainstorm mode`}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          useSavedBrainstorm 
                            ? 'bg-blue-600' 
                            : isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            useSavedBrainstorm ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    {/* Description */}
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      When enabled, 'Test Tool Creation Agent' will skip Logic Architect brainstorming and use your selected saved brainstorm result instead.
                    </p>
                    
                    {/* Saved Brainstorm Selection */}
                    {useSavedBrainstorm && (
                      <div>
                        <label className={`block text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Select Saved Brainstorm:
                        </label>
                        <select
                          value={selectedSavedBrainstorm?.id || ''}
                          title="Select a saved brainstorm result"
                          onChange={(e) => {
                            const brainstorm = savedLogicResults.find(b => b.id === e.target.value);
                            if (brainstorm && onSelectSavedBrainstorm) {
                              onSelectSavedBrainstorm(brainstorm);
                            }
                          }}
                          className={`w-full p-2 rounded-md border text-sm ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'bg-white border-gray-300 text-gray-700'
                          }`}
                        >
                          <option value="">Choose a saved brainstorm...</option>
                          {savedLogicResults.map((brainstorm) => (
                            <option key={brainstorm.id} value={brainstorm.id}>
                              {brainstorm.toolType} - {brainstorm.targetAudience} ({brainstorm.date})
                            </option>
                          ))}
                        </select>
                        
                        {selectedSavedBrainstorm && (
                          <div className={`mt-2 p-2 rounded border text-xs ${
                            isDarkMode 
                              ? 'bg-gray-800 border-gray-600 text-gray-300' 
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}>
                            <strong>Selected:</strong> {selectedSavedBrainstorm.toolType}<br/>
                            <strong>Audience:</strong> {selectedSavedBrainstorm.targetAudience}<br/>
                            <strong>Industry:</strong> {selectedSavedBrainstorm.industry || 'N/A'}<br/>
                            <strong>Date:</strong> {selectedSavedBrainstorm.date}
                          </div>
                        )}
                        
                        {/* Test with Selected Brainstorm Button */}
                        {selectedSavedBrainstorm && onTestToolCreationWithSavedBrainstorm && (
                          <button
                            onClick={() => {
                              onTestToolCreationWithSavedBrainstorm();
                              onClose();
                            }}
                            className={`w-full mt-3 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              isDarkMode
                                ? 'bg-green-700 hover:bg-green-600 text-green-100'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            🚀 Test Tool Creation with Selected Brainstorm
                          </button>
                        )}
                      </div>
                    )}
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
