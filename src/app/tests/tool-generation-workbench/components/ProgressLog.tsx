'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, Loader2, XCircle, Clock, Wand2 } from 'lucide-react';
import { StepProgress } from '../hooks/useToolGenerationStream';

interface ProgressLogProps {
  progressUpdates?: StepProgress[];
  isDarkMode: boolean;
}

const getStatusIcon = (status: StepProgress['status']) => {
  switch (status) {
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'pending':
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const ProgressLog: React.FC<ProgressLogProps> = ({ progressUpdates = [], isDarkMode }) => {
  return (
    <Card className={`transition-all duration-300 ${isDarkMode ? 'dark' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Wand2 className="mr-2 h-5 w-5 text-purple-500" />
          Agent Progress Stream
        </CardTitle>
      </CardHeader>
      <CardContent>
        {progressUpdates.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-gray-500 dark:text-gray-400">
            Waiting for tool generation to start...
          </div>
        ) : (
          <ScrollArea className="h-64 pr-4">
            <div className="space-y-4">
              {progressUpdates.map((step, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="mt-1">{getStatusIcon(step.status)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">{step.stepName}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    {step.message && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{step.message}</p>
                    )}
                    {step.data && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer font-medium text-gray-500 dark:text-gray-400">View Data</summary>
                        <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto text-[10px] max-h-40">
                          {JSON.stringify(step.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ProgressLog; 
