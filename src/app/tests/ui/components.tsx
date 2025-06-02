import React, { useState } from 'react';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import DynamicComponentRenderer from '@/components/tools/dynamic-component-renderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Loader2,
  Type
} from 'lucide-react';
import {
  OptionsMenuProps,
  MenuSection
} from './types';

// OptionsMenu Component
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

// CanvasTool Component
export function CanvasTool({ isDarkMode, className = '', productToolDefinition, isGenerating, generatingMessage }: any) {
  if (isGenerating && generatingMessage) {
    return (
      <div className={`relative p-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${className} min-h-[400px]`}>
        {/* Show current tool heavily blurred in background */}
        {productToolDefinition && productToolDefinition.componentCode && (
          <div className="absolute inset-0 filter blur-md opacity-30 pointer-events-none overflow-hidden">
            <div className="p-6">
              <DynamicComponentRenderer
                componentCode={productToolDefinition.componentCode}
                metadata={{
                  title: productToolDefinition.metadata.title,
                  description: productToolDefinition.metadata.description,
                  slug: productToolDefinition.slug
                }}
                currentStyleMap={productToolDefinition.currentStyleMap}
                onError={(error: Error) => console.error('Canvas render error:', error)}
              />
            </div>
          </div>
        )}
        
        {/* Loading overlay - centered and properly positioned */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className={`border-2 border-dashed rounded-lg p-8 text-center bg-white/95 dark:bg-gray-800/95 shadow-xl backdrop-blur-sm ${
            isDarkMode ? 'border-gray-600' : 'border-gray-300'
          }`}>
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
            <h3 className="text-lg font-medium mb-2">Now Building</h3>
            <p className="text-sm opacity-70">
              {generatingMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (productToolDefinition && productToolDefinition.componentCode) {
    return (
      <div className={`p-6 ${className}`}>
        <DynamicComponentRenderer
          componentCode={productToolDefinition.componentCode}
          metadata={{
            title: productToolDefinition.metadata.title,
            description: productToolDefinition.metadata.description,
            slug: productToolDefinition.slug
          }}
          currentStyleMap={productToolDefinition.currentStyleMap}
          onError={(error: Error) => console.error('Canvas render error:', error)}
        />
      </div>
    );
  }

  // Default placeholder when no tool is generated yet
  return (
    <div className={`p-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${className}`}>
      <div className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDarkMode ? 'border-gray-600' : 'border-gray-300'
      }`}>
        <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">Canvas Ready</h3>
        <p className="text-sm opacity-70">
          Your generated tool will appear here. Use the options menu to test tool creation!
        </p>
      </div>
    </div>
  );
}

// ToolInfoBubble Component
export function ToolInfoBubble({ productToolDefinition, isDarkMode }: { 
  productToolDefinition: ProductToolDefinition | null, 
  isDarkMode: boolean 
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Add additional safety checks
  if (!productToolDefinition || !productToolDefinition.metadata) return null;

  return (
    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
      {/* Hover trigger */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
          isDarkMode 
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-gray-100 border-gray-600' 
            : 'bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 border-gray-300'
        } border-2 shadow-lg hover:shadow-xl`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Type className="h-4 w-4" />
      </div>

      {/* Info bubble */}
      {isHovered && (
        <div
          className={`absolute left-12 top-1/2 transform -translate-y-1/2 w-80 p-4 rounded-lg shadow-xl border-2 z-30 animate-in fade-in slide-in-from-left-2 duration-200 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-600 text-gray-100' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Arrow pointing to trigger */}
          <div 
            className={`absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-2 w-0 h-0 ${
              isDarkMode 
                ? 'border-r-gray-600' 
                : 'border-r-gray-300'
            }`}
            style={{
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: '8px solid',
              borderRightColor: isDarkMode ? '#4B5563' : '#D1D5DB'
            }}
          />
          
          <div className="space-y-3">
            {/* Tool Title */}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold leading-tight">
                {productToolDefinition.metadata?.title || 'Untitled Tool'}
              </h3>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    isDarkMode ? 'border-gray-500 text-gray-300' : 'border-gray-400 text-gray-600'
                  }`}
                >
                  {productToolDefinition.metadata?.type || 'Tool'}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    isDarkMode ? 'border-gray-500 text-gray-300' : 'border-gray-400 text-gray-600'
                  }`}
                >
                  {productToolDefinition.metadata?.category || 'General'}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className={`text-sm leading-relaxed ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {productToolDefinition.metadata?.description || 'No description available'}
              </p>
              
              {productToolDefinition.metadata?.shortDescription && 
               productToolDefinition.metadata?.shortDescription !== productToolDefinition.metadata?.description && (
                <p className={`text-xs ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {productToolDefinition.metadata.shortDescription}
                </p>
              )}
            </div>

            {/* Additional metadata */}
            <div className={`space-y-2 pt-2 border-t ${
              isDarkMode ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  Target Audience:
                </span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {productToolDefinition.metadata?.targetAudience || 'General'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  Industry:
                </span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {productToolDefinition.metadata?.industry || 'General'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  Difficulty:
                </span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {productToolDefinition.metadata?.difficultyLevel || 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  Est. Time:
                </span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {productToolDefinition.metadata?.estimatedCompletionTime || 'N/A'} min
                </span>
              </div>
            </div>

            {/* Features tags */}
            {productToolDefinition.metadata?.features && productToolDefinition.metadata.features.length > 0 && (
              <div className="space-y-2">
                <p className={`text-xs font-medium ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Features:
                </p>
                <div className="flex flex-wrap gap-1">
                  {productToolDefinition.metadata.features.slice(0, 6).map((feature, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className={`text-xs px-2 py-0.5 ${
                        isDarkMode 
                          ? 'bg-gray-700 text-gray-300 border-gray-600' 
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      {feature}
                    </Badge>
                  ))}
                  {productToolDefinition.metadata.features.length > 6 && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs px-2 py-0.5 ${
                        isDarkMode 
                          ? 'bg-gray-700 text-gray-300 border-gray-600' 
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      +{productToolDefinition.metadata.features.length - 6}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 