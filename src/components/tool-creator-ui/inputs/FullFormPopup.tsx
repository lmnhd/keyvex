'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import DynamicInput from './DynamicInput';

export interface FullFormPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (answers: Record<string, string>) => void;
  questions: any[];
  initialAnswers: Record<string, string>;
  isDarkMode: boolean;
}

export function FullFormPopup({ 
  isOpen, 
  onClose, 
  onSubmit, 
  questions, 
  initialAnswers,
  isDarkMode 
}: FullFormPopupProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);

  // Update internal state when initialAnswers prop changes
  useEffect(() => {
    setAnswers(initialAnswers);
  }, [initialAnswers]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    // Check if all questions have answers
    const missingAnswers = questions.filter(q => !answers[q.id] || answers[q.id].trim() === '');
    if (missingAnswers.length > 0) {
      alert(`Please answer all questions. Missing: ${missingAnswers.map(q => q.question.slice(0, 30) + '...').join(', ')}`);
      return;
    }
    
    onSubmit(answers);
    onClose();
  };

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // Check if all questions have been answered
  const allQuestionsAnswered = questions.every(q => answers[q.id] && answers[q.id].trim() !== '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-xl shadow-2xl border max-w-4xl w-full max-h-[90vh] overflow-hidden ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-600' 
          : 'bg-white border-gray-300'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? 'border-gray-600' : 'border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold ${
            isDarkMode ? 'text-gray-50' : 'text-gray-900'
          }`}>
            Complete All Questions ({questions.length} total)
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded hover:bg-gray-100 ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
            }`}
            aria-label="Close full form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id} className={`p-4 rounded-lg border ${
                isDarkMode 
                  ? 'border-gray-600 bg-gray-700/30' 
                  : 'border-gray-200 bg-gray-50/50'
              }`}>
                <div className="mb-3">
                  <h4 className={`font-medium mb-1 ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    Question {index + 1}
                  </h4>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {question.question}
                  </p>
                </div>
                
                <DynamicInput
                  currentQuestion={question}
                  value={answers[question.id] || ''}
                  onChange={(value) => {
                    updateAnswer(question.id, value);
                  }}
                  onSubmit={() => {}} // No individual submit in full form
                  isLoading={false}
                  isDarkMode={isDarkMode}
                  hideSubmitButton={true}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${
          isDarkMode ? 'border-gray-600' : 'border-gray-200'
        }`}>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className={`flex-1 ${
                isDarkMode 
                  ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!allQuestionsAnswered}
              className="flex-1"
            >
              Submit All Answers
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 
