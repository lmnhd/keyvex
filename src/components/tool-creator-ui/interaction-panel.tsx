'use client';

import React from 'react';
import { 
  Sparkles, 
  Loader2, 
  MessageSquare 
} from 'lucide-react';
import { DynamicInput } from '@/components/tool-creator-ui/inputs';

// Types for the InteractionPanel component
export interface InteractionPanelProps {
  isDarkMode: boolean;
  isLoading: boolean;
  isGeneratingTool?: boolean;
  lastAIMessage: string;
  currentQuestion: any;
  isInMultiPart: boolean;
  multiPartQuestions: any[];
  multiPartIndex: number;
  multiPartAnswers: Record<string, string>;
  currentInput: string;
  transitionOpacity: number;
  customColors: Array<{
    value: string;
    label: string;
    colors: string[];
  }>;
  onInputChange: (value: string) => void;
  onInputSubmit: () => void;
  onOpenColorPicker: () => void;
  onPreviewUpdate: (questionId: string, value: string) => void;
  onSwitchToChat: () => void;
  onShowFullForm: () => void;
  setCurrentInput: (value: string) => void;
  setFullFormAnswers: (answers: Record<string, string>) => void;
  setShowFullFormPopup: (show: boolean) => void;
  updateToolDataFromMultiPart: (questionId: string, value: string) => void;
}

export function InteractionPanel({
  isDarkMode,
  isLoading,
  isGeneratingTool = false,
  lastAIMessage,
  currentQuestion,
  isInMultiPart,
  multiPartQuestions,
  multiPartIndex,
  multiPartAnswers,
  currentInput,
  transitionOpacity,
  customColors,
  onInputChange,
  onInputSubmit,
  onOpenColorPicker,
  onPreviewUpdate,
  onSwitchToChat,
  onShowFullForm,
  setCurrentInput,
  setFullFormAnswers,
  setShowFullFormPopup,
  updateToolDataFromMultiPart
}: InteractionPanelProps) {
  
  const handleSwitchToChat = () => {
    onSwitchToChat();
  };

  const handleShowFullForm = () => {
    // Initialize full form with current answers
    const currentAnswers = { ...multiPartAnswers };
    if (currentInput.trim()) {
      currentAnswers[multiPartQuestions[multiPartIndex]?.id] = currentInput;
    }
    console.log('🔧 Opening full form with answers:', currentAnswers);
    console.log('🔧 multiPartAnswers state:', multiPartAnswers);
    console.log('🔧 Current input:', currentInput);
    console.log('🔧 Current question ID:', multiPartQuestions[multiPartIndex]?.id);
    setFullFormAnswers(currentAnswers);
    setShowFullFormPopup(true);
  };

  return (
    <div className={`border-t flex-shrink-0 grid grid-cols-1 lg:grid-cols-2 transition-all duration-300 ease-in-out min-h-[280px] ${
      isDarkMode ? 'border-gray-700' : 'border-gray-200'
    }`}>
      {/* AI Assistant Section */}
      <div className={`p-6 border-r transition-all duration-300 ease-in-out ${
        isDarkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className={`rounded-xl border h-40 flex flex-col transition-all duration-300 ease-in-out ${
          isDarkMode 
            ? 'bg-gray-700/50 border-gray-600 text-blue-100 shadow-sm backdrop-blur-sm' 
            : 'bg-blue-50 border-blue-400 text-blue-900'
        }`}>
          <div className={`flex items-center gap-2 text-sm font-medium p-4 pb-2 flex-shrink-0 ${
            isDarkMode ? 'text-gray-50' : 'text-gray-800'
          }`}>
            <Sparkles className="h-4 w-4" />
            <span>AI Assistant</span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <p className="text-sm text-gray-700 dark:text-gray-400 leading-relaxed font-medium">
              {lastAIMessage}
            </p>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className={`p-6 transition-all duration-300 ease-in-out ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="min-h-[168px] flex flex-col">
          {/* Show loading state when agent is building response or generating tools */}
          {(isLoading || isGeneratingTool) && !currentQuestion && !isInMultiPart ? (
            <div className="flex-1 flex items-center justify-center">
              <div className={`flex flex-col items-center gap-3 text-center ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">
                    {isGeneratingTool 
                      ? "Creating your tool..." 
                      : "Building response..."
                    }
                  </span>
                </div>
                <div className={`text-xs ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {isGeneratingTool 
                    ? "AI is generating React component code" 
                    : "AI is generating your next question"
                  }
                </div>
              </div>
            </div>
          ) : isInMultiPart ? (
            <div className={`space-y-4 flex-1 transition-all duration-300 ease-in-out ${
              // Special styling for iterator component
              isDarkMode 
                ? 'border-2 border-yellow-500/70 bg-yellow-950/20 rounded-xl p-4' 
                : 'border-2 border-yellow-400/80 bg-yellow-50/50 rounded-xl p-4'
            }`}>
              <div className="space-y-3 flex-1">
                <h3 className={`text-lg font-medium leading-relaxed transition-opacity duration-200 ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`} style={{ opacity: transitionOpacity }}>
                  {multiPartQuestions[multiPartIndex]?.question}
                </h3>

                <div 
                  className="transition-opacity duration-200 flex-1"
                  style={{ opacity: transitionOpacity }}
                >
                  <DynamicInput
                    currentQuestion={multiPartQuestions[multiPartIndex]}
                    value={currentInput}
                    onChange={onInputChange}
                    onSubmit={onInputSubmit}
                    isLoading={isLoading}
                    isDarkMode={isDarkMode}
                    onOpenColorPicker={onOpenColorPicker}
                    onPreviewUpdate={(questionId, value) => {
                      // Enhanced preview update for live color changes in iterator
                      const currentQuestion = multiPartQuestions[multiPartIndex];
                      if (currentQuestion && currentQuestion.options) {
                        const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
                        if (selectedOption && selectedOption.colors) {
                          // For AI-generated colors, update with actual hex values
                          console.log('🎨 Iterator live preview update with AI colors:', selectedOption.colors);
                          onPreviewUpdate('colorScheme', 'custom');
                          return;
                        }
                      }
                      // Fallback to standard update for predefined colors
                      updateToolDataFromMultiPart(questionId, value);
                    }}
                    customColors={customColors}
                  />
                </div>
              </div>
              
              {/* Iterator Progress Indicator */}
              <div className="mt-3 pt-3 border-t border-yellow-400/30 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex gap-1 ${
                      isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
                    }`}>
                      {multiPartQuestions.map((_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                            index <= multiPartIndex
                              ? isDarkMode ? 'bg-yellow-400' : 'bg-yellow-500'
                              : isDarkMode ? 'bg-yellow-800' : 'bg-yellow-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-xs transition-colors duration-200 ${
                      isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
                    }`}>
                      {multiPartIndex < multiPartQuestions.length - 1 
                        ? 'Collecting responses...' 
                        : 'Final question - will submit all answers'
                      }
                    </span>
                  </div>
                  
                  {/* Buttons side by side */}
                  <div className="flex items-center gap-3">
                    {/* See Full Form Button */}
                    <button
                      onClick={handleShowFullForm}
                      className={`text-xs underline hover:no-underline transition-all duration-200 ${
                        isDarkMode ? 'text-yellow-300 hover:text-yellow-200' : 'text-yellow-600 hover:text-yellow-700'
                      }`}
                    >
                      see full form
                    </button>
                    
                    {/* Speak Freely Button */}
                    <button
                      onClick={handleSwitchToChat}
                      disabled={isLoading}
                      className={`text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                        isDarkMode 
                          ? 'text-lime-400 hover:text-gray-200 hover:bg-gray-700/50' 
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <MessageSquare className="h-3 w-3" />
                      speak freely
                    </button>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-yellow-400/30 flex-shrink-0 transition-all duration-300 ease-in-out">
                  <div className="flex justify-center">
                    <button
                      onClick={handleSwitchToChat}
                      disabled={isLoading}
                      className={`text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                        isDarkMode 
                          ? 'text-lime-400 hover:text-gray-200 hover:bg-gray-700/50' 
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <MessageSquare className="h-3 w-3" />
                      speak freely
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div 
              className="transition-all duration-300 ease-in-out flex-1 flex flex-col"
              style={{ opacity: transitionOpacity }}
            >
              <div className="flex-1">
                <DynamicInput
                  currentQuestion={currentQuestion}
                  value={currentInput}
                  onChange={onInputChange}
                  onSubmit={onInputSubmit}
                  isLoading={isLoading}
                  isDarkMode={isDarkMode}
                  onOpenColorPicker={onOpenColorPicker}
                  onPreviewUpdate={onPreviewUpdate}
                  customColors={customColors}
                />
              </div>
              
              {/* Chat Button - Only show when there's a current question (structured input) */}
              {currentQuestion && currentQuestion.inputType !== 'textarea' && (
                <div className="mt-3 pt-3 border-t border-opacity-30 border-gray-300 flex-shrink-0 transition-all duration-300 ease-in-out">
                  <div className="flex justify-center">
                    <button
                      onClick={handleSwitchToChat}
                      disabled={isLoading}
                      className={`text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                        isDarkMode 
                          ? 'text-lime-400 hover:text-gray-200 hover:bg-gray-700/50' 
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <MessageSquare className="h-3 w-3" />
                      speak freely
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
