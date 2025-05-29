'use client';

import React, { useState } from 'react';
import { MultiQuestionIterator } from '@/components/tool-creator/multi-question-iterator';
import { Button } from '@/components/ui/button'; // Assuming Button is in ui
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Assuming Card components

// Define the structure for a question, mirroring MultiQuestionConfig
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

const mockIteratorQuestions: MultiQuestionConfig[] = [
  {
    id: 'toolName',
    question: "What would you like to name your new tool?",
    inputType: 'text',
    placeholder: 'e.g., "Customer Onboarding Checklist"',
    suggestions: ["Project Planner", "Budget Calculator", "Feedback Form"],
    required: true,
  },
  {
    id: 'toolType',
    question: "What type of tool are you creating?",
    inputType: 'select',
    placeholder: 'Select tool type',
    options: [
      { value: 'calculator', label: 'Calculator' },
      { value: 'quiz', label: 'Quiz' },
      { value: 'assessment', label: 'Assessment' },
      { value: 'checklist', label: 'Checklist' },
    ],
    allowCustom: true,
    required: true,
  },
  {
    id: 'targetAudience',
    question: "Who is the primary target audience for this tool?",
    inputType: 'text',
    placeholder: 'e.g., "Small business owners"',
    required: false,
  },
  {
    id: 'mainGoal',
    question: "What is the main goal your users will achieve with this tool?",
    inputType: 'text',
    placeholder: 'e.g., "To quickly estimate project costs"',
  },
];

export default function MultiIteratorTestPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [iteratorKey, setIteratorKey] = useState(0); // Used to reset the iterator
  const [completedAnswers, setCompletedAnswers] = useState<Record<string, string> | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const handleComplete = (answers: Record<string, string>) => {
    console.log('Iterator completed with answers:', answers);
    setCompletedAnswers(answers);
    setCancelled(false);
  };

  const handleCancel = () => {
    console.log('Iterator cancelled');
    setCompletedAnswers(null);
    setCancelled(true);
  };

  const resetIterator = () => {
    setIteratorKey(prevKey => prevKey + 1);
    setCompletedAnswers(null);
    setCancelled(false);
  };

  return (
    <div className={`p-4 sm:p-8 min-h-screen transition-colors ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}`}>
      <div className="max-w-2xl mx-auto">
        <Card className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
          <CardHeader>
            <CardTitle className={`${isDarkMode ? 'text-white' : 'text-black'}`}>MultiQuestionIterator Test Page</CardTitle>
            <div className="flex space-x-2 mt-2">
              <Button onClick={() => setIsDarkMode(!isDarkMode)}>
                Toggle Dark Mode ({isDarkMode ? 'On' : 'Off'})
              </Button>
              <Button onClick={resetIterator} variant="outline">
                Reset Iterator
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <MultiQuestionIterator
              key={iteratorKey}
              questions={mockIteratorQuestions}
              onComplete={handleComplete}
              onCancel={handleCancel}
              isDarkMode={isDarkMode}
              className="mt-4"
            />

            {completedAnswers && (
              <div className={`mt-6 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-green-50 border-green-200'}`}>
                <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>Iteration Completed!</h3>
                <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(completedAnswers, null, 2)}</pre>
              </div>
            )}

            {cancelled && (
              <div className={`mt-6 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-red-50 border-red-200'}`}>
                <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>Iteration Cancelled.</h3>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 