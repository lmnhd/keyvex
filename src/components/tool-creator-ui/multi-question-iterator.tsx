'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Send, CheckCircle } from 'lucide-react';

interface MultiQuestionConfig {
  id: string;
  question: string;
  inputType: 'text' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
  suggestions?: string[];
  allowCustom?: boolean;
  required?: boolean;
}

interface MultiQuestionIteratorProps {
  questions: MultiQuestionConfig[];
  onComplete: (answers: Record<string, string>) => void;
  onCancel?: () => void;
  isDarkMode?: boolean;
  className?: string;
}

export function MultiQuestionIterator({
  questions,
  onComplete,
  onCancel,
  isDarkMode = false,
  className = ''
}: MultiQuestionIteratorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentValue, setCurrentValue] = useState('');

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const canProceed = currentValue.trim() !== '' || !currentQuestion?.required;
  const progressPercentage = ((currentIndex + 1) / questions.length) * 100;

  const handleNext = () => {
    if (!canProceed) return;

    // Save current answer
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: currentValue
    };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      // Complete the sequence
      onComplete(newAnswers);
    } else {
      // Move to next question
      setCurrentIndex(currentIndex + 1);
      setCurrentValue(answers[questions[currentIndex + 1]?.id] || '');
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      // Save current answer before going back
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: currentValue
      }));
      
      setCurrentIndex(currentIndex - 1);
      setCurrentValue(answers[questions[currentIndex - 1]?.id] || '');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canProceed) {
      e.preventDefault();
      handleNext();
    }
  };

  const renderInput = () => {
    switch (currentQuestion.inputType) {
      case 'select':
        return (
          <div className="space-y-3">
            <Select value={currentValue} onValueChange={setCurrentValue}>
              <SelectTrigger className={`w-full ${
                isDarkMode 
                  ? 'text-gray-100 bg-gray-600 border-gray-500' 
                  : 'text-gray-900 bg-white border-gray-300'
              }`}>
                <SelectValue placeholder={currentQuestion.placeholder} />
              </SelectTrigger>
              <SelectContent className={`shadow-lg ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600' 
                  : 'bg-white border-gray-300'
              }`}>
                {currentQuestion.options?.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className={`cursor-pointer ${
                      isDarkMode 
                        ? 'text-gray-100 hover:bg-gray-600 focus:bg-gray-600' 
                        : 'text-gray-900 hover:bg-blue-50 focus:bg-blue-50'
                    }`}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {currentQuestion.allowCustom && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentValue('')}
                className={`w-full text-xs ${
                  isDarkMode 
                    ? 'border-gray-500 text-gray-200 hover:bg-gray-700' 
                    : 'border-gray-400 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Enter Custom Value
              </Button>
            )}
          </div>
        );

      case 'text':
      default:
        return (
          <div className="space-y-2">
            {currentQuestion.suggestions && (
              <div className="flex flex-wrap gap-1">
                {currentQuestion.suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentValue(suggestion)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      isDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-200'
                        : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700'
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <Input
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder={currentQuestion.placeholder}
              onKeyPress={handleKeyPress}
              className={`w-full ${
                isDarkMode 
                  ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
                  : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
              }`}
            />
          </div>
        );
    }
  };

  return (
    <div className={`space-y-4 w-full ${className}`}>
      {/* Progress Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {/* <span className={`text-sm font-medium ${
            isDarkMode ? 'text-gray-200' : 'text-gray-700'
          }`}>
            Question {currentIndex + 1} of {questions.length}
          </span> */}
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {Math.round(progressPercentage)}% complete
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className={`w-full h-2 rounded-full ${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          <div 
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="space-y-3">
        <h3 className={`text-lg font-medium leading-relaxed ${
          isDarkMode ? 'text-gray-100' : 'text-gray-900'
        }`}>
          {currentQuestion?.question}
        </h3>

        {/* Input */}
        {renderInput()}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className={`flex items-center gap-2 ${
            isDarkMode 
              ? 'border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-50' 
              : 'border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50'
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <Button
          onClick={handleNext}
          disabled={!canProceed}
          className="flex-1 flex items-center justify-center gap-2"
        >
          {isLastQuestion ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Complete
            </>
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>

        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            className={`${
              isDarkMode 
                ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Answer Summary (for debugging/preview) */}
      {Object.keys(answers).length > 0 && (
        <div className={`mt-6 p-3 rounded-lg border text-xs ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-600 text-gray-300' 
            : 'bg-gray-50 border-gray-200 text-gray-600'
        }`}>
          <div className="font-medium mb-2">Progress Summary:</div>
          {Object.entries(answers).map(([questionId, answer]) => (
            <div key={questionId} className="flex justify-between">
              <span className="opacity-75">{questionId}:</span>
              <span className="font-medium">{answer}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
