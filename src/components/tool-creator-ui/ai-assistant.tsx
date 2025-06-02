'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  MessageCircle,
  History 
} from 'lucide-react';

interface ConversationMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: 'ai' | 'system' | 'user';
}

interface AIAssistantProps {
  currentMessage: string;
  conversationHistory: ConversationMessage[];
  isLoading: boolean;
  isDarkMode?: boolean;
  className?: string;
  onNavigateHistory?: (direction: 'prev' | 'next') => void;
  showHistory?: boolean;
}

export function AIAssistant({
  currentMessage,
  conversationHistory = [],
  isLoading = false,
  isDarkMode = false,
  className = '',
  onNavigateHistory,
  showHistory = false
}: AIAssistantProps) {
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(
    conversationHistory.length > 0 ? conversationHistory.length - 1 : 0
  );
  const [showHistoryPane, setShowHistoryPane] = useState(false);

  const canNavigatePrev = conversationHistory.length > 0 && currentHistoryIndex > 0;
  const canNavigateNext = conversationHistory.length > 0 && currentHistoryIndex < conversationHistory.length - 1;

  const handlePrevious = () => {
    if (canNavigatePrev) {
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      onNavigateHistory?.('prev');
    }
  };

  const handleNext = () => {
    if (canNavigateNext) {
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      onNavigateHistory?.('next');
    }
  };

  const currentHistoryMessage = conversationHistory[currentHistoryIndex];
  const displayMessage = showHistory && currentHistoryMessage 
    ? currentHistoryMessage.content 
    : currentMessage;

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 text-sm font-medium ${
          isDarkMode ? 'text-gray-50' : 'text-gray-800'
        }`}>
          <Sparkles className="h-4 w-4" />
          <span>AI Assistant</span>
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>

        {/* Conversation History Controls */}
        {conversationHistory.length > 0 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistoryPane(!showHistoryPane)}
              className={`h-6 px-2 text-xs ${
                isDarkMode 
                  ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <History className="h-3 w-3 mr-1" />
              {conversationHistory.length}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={!canNavigatePrev}
              className={`h-6 w-6 p-0 ${
                isDarkMode 
                  ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700 disabled:opacity-30' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30'
              }`}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            
            <span className={`text-xs px-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {currentHistoryIndex + 1}/{conversationHistory.length}
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              disabled={!canNavigateNext}
              className={`h-6 w-6 p-0 ${
                isDarkMode 
                  ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700 disabled:opacity-30' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30'
              }`}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Main Message Display */}
      <div className={`rounded-xl p-4 border ${
        isDarkMode 
          ? 'bg-gray-700/50 border-gray-600 text-blue-100 shadow-sm backdrop-blur-sm' 
          : 'bg-blue-50 border-blue-400 text-blue-900'
      }`}>
        <p className="text-sm leading-relaxed font-medium">
          {displayMessage}
        </p>
        
        {/* Message metadata */}
        {showHistory && currentHistoryMessage && (
          <div className={`mt-2 pt-2 border-t flex items-center justify-between text-xs ${
            isDarkMode ? 'border-gray-600 text-gray-400' : 'border-blue-300 text-blue-700'
          }`}>
            <span className="capitalize">{currentHistoryMessage.type} message</span>
            <span>{formatTimestamp(currentHistoryMessage.timestamp)}</span>
          </div>
        )}
      </div>

      {/* History Pane */}
      {showHistoryPane && (
        <div className={`rounded-lg border p-3 space-y-2 max-h-48 overflow-y-auto ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-gray-50 border-gray-300'
        }`}>
          <div className={`text-xs font-medium flex items-center gap-2 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <MessageCircle className="h-3 w-3" />
            Conversation History
          </div>
          
          <div className="space-y-1">
            {conversationHistory.map((message, index) => (
              <button
                key={message.id}
                onClick={() => setCurrentHistoryIndex(index)}
                className={`w-full text-left p-2 rounded text-xs transition-colors ${
                  index === currentHistoryIndex
                    ? isDarkMode
                      ? 'bg-gray-700 text-gray-100'
                      : 'bg-blue-100 text-blue-900'
                    : isDarkMode
                      ? 'hover:bg-gray-700 text-gray-400'
                      : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`capitalize font-medium ${
                    message.type === 'ai' ? 'text-blue-500' : 
                    message.type === 'user' ? 'text-green-500' : 'text-gray-500'
                  }`}>
                    {message.type}
                  </span>
                  <span className="opacity-75">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                <p className="line-clamp-2">
                  {message.content.length > 100 
                    ? `${message.content.substring(0, 100)}...` 
                    : message.content
                  }
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 