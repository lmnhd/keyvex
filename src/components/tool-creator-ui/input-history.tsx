'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Edit3, 
  History, 
  Palette,
  Type,
  List,
  MessageSquare
} from 'lucide-react';

interface InputHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  answers: Record<string, string>;
  questionHistory: Array<{
    id: string;
    message?: string;
    inputType: string;
    options?: Array<{ value: string; label: string }>;
  }>;
  onAnswerUpdate?: (questionId: string, newValue: string) => void;
  isDarkMode: boolean;
}

export function InputHistory({
  isOpen,
  onClose,
  side = 'right',
  answers,
  questionHistory,
  onAnswerUpdate,
  isDarkMode = false
}: InputHistoryProps) {
  const getInputTypeIcon = (inputType: string) => {
    switch (inputType) {
      case 'colorSelect':
        return <Palette className="h-3 w-3" />;
      case 'text':
      case 'textarea':
        return <Type className="h-3 w-3" />;
      case 'select':
      case 'multiSelect':
        return <List className="h-3 w-3" />;
      case 'yesNoMaybe':
        return <MessageSquare className="h-3 w-3" />;
      default:
        return <Edit3 className="h-3 w-3" />;
    }
  };

  const formatValue = (value: string, inputType: string) => {
    if (inputType === 'multiSelect') {
      return value.split(',').map(v => v.trim()).join(', ');
    }
    if (inputType === 'colorSelect' && value.startsWith('custom-')) {
      return 'Custom Color Scheme';
    }
    return value;
  };

  const getQuestionText = (questionId: string) => {
    const question = questionHistory.find(q => q.id === questionId);
    if (!question || !question.message) return questionId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Extract the key part of the question message
    const message = question.message;
    // Look for the actual question part (usually after punctuation)
    const questionStart = message.search(/[!?.]\s*(.+)/);
    if (questionStart !== -1) {
      const actualQuestion = message.substring(questionStart + 2);
      return actualQuestion.split('?')[0].trim();
    }
    
    // Fallback to the beginning of the message
    return message.split('.')[0].trim();
  };

  const truncateText = (text: string, maxLength: number = 10) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const handleEditClick = (questionId: string, currentValue: string) => {
    onAnswerUpdate?.(questionId, currentValue);
  };

  const collectedAnswers = Object.entries(answers).map(([questionId, value]) => {
    const question = questionHistory.find(q => q.id === questionId);
    return {
      questionId,
      questionText: getQuestionText(questionId),
      value,
      inputType: question?.inputType || 'text'
    };
  }).filter(answer => answer.questionText); // Filter out any answers with empty question text

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div 
        className={`
          fixed top-0 h-full w-96 z-50 transform transition-transform duration-300 ease-in-out
          ${side === 'left' ? 'left-0' : 'right-0'}
          ${isOpen 
            ? 'translate-x-0' 
            : side === 'left' 
              ? '-translate-x-full' 
              : 'translate-x-full'
          }
          ${isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
          }
          border-${side === 'left' ? 'r' : 'l'} shadow-xl
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            <h2 className={`text-lg font-semibold ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              History
            </h2>
            <Badge variant="outline" className="text-xs">
              {collectedAnswers.length}
            </Badge>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className={`${
              isDarkMode 
                ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {collectedAnswers.length === 0 ? (
            <div className={`text-center py-8 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No answers yet</p>
              <p className="text-xs mt-1">Start answering questions to build your history</p>
            </div>
          ) : (
            <div className="space-y-2">
              {collectedAnswers.map((answer, index) => (
                <div
                  key={answer.questionId}
                  className={`px-3 py-2 rounded-md border transition-colors group hover:shadow-sm ${
                    isDarkMode 
                      ? 'bg-gray-700/30 border-gray-600 hover:bg-gray-700/50' 
                      : 'bg-gray-50/50 border-gray-200 hover:bg-gray-100/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Type Icon */}
                    <div className={`flex-shrink-0 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {getInputTypeIcon(answer.inputType)}
                    </div>
                    
                    {/* Question & Value */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          isDarkMode 
                            ? 'bg-gray-600 text-gray-300' 
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          #{index + 1}
                        </span>
                        <span className={`text-xs font-medium ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          {truncateText(answer.questionText, 35)}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 truncate ${
                        isDarkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                        {formatValue(answer.value, answer.inputType)}
                      </p>
                    </div>
                    
                    {/* Edit Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(answer.questionId, answer.value)}
                      className={`h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                        isDarkMode 
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600' 
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div className={`
          absolute top-1/2 transform -translate-y-1/2 w-1 h-20 bg-gray-300 rounded cursor-col-resize
          ${side === 'left' ? '-right-0.5' : '-left-0.5'}
          hover:bg-blue-500 transition-colors
        `} />
      </div>
    </>
  );
} 
