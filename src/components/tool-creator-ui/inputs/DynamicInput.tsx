'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Send, 
  Edit3,
  ChevronLeft,
  ChevronRight,
  Palette
} from 'lucide-react';

interface DynamicInputProps {
  currentQuestion: any;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isDarkMode: boolean;
  onOpenColorPicker?: () => void;
  onPreviewUpdate?: (questionId: string, value: string) => void;
  customColors?: Array<{
    value: string;
    label: string;
    colors: string[];
  }>;
  hideSubmitButton?: boolean;
}

export default function DynamicInput({ 
  currentQuestion, 
  value, 
  onChange, 
  onSubmit, 
  isLoading, 
  isDarkMode, 
  onOpenColorPicker, 
  onPreviewUpdate,
  customColors = [],
  hideSubmitButton = false
}: DynamicInputProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Reset pagination when question changes
  useEffect(() => {
    setCurrentPage(0);
  }, [currentQuestion?.id]);

  if (!currentQuestion) {
    return (
      <div className="flex gap-2 w-full">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask a question or provide feedback..."
          rows={4}
          disabled={isLoading}
          className={`flex-1 resize-none ${
            isDarkMode 
              ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
              : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
          }`}
        />
        {!hideSubmitButton && (
          <Button 
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
            className="flex-shrink-0 self-start"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  const handleCustomSubmit = () => {
    onChange(customValue);
    setShowCustomInput(false);
    setCustomValue('');
    setTimeout(onSubmit, 100);
  };

  const renderInput = () => {
    // Show custom input if toggled
    if (showCustomInput) {
      return (
        <div className="space-y-2 w-full">
          <div className="flex gap-2">
            <Textarea
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Enter your custom value..."
              rows={4}
              className={`flex-1 resize-none ${
                isDarkMode 
                  ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
                  : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
              }`}
              autoFocus
            />
            {!hideSubmitButton && (
              <Button 
                onClick={handleCustomSubmit}
                disabled={!customValue.trim()}
                className="flex-shrink-0 self-start"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowCustomInput(false)}
            className={`w-full text-xs border ${
              isDarkMode 
                ? 'text-gray-200 border-gray-500 bg-gray-700 hover:bg-gray-600' 
                : 'text-gray-900 border-gray-400 bg-white hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Back to Options
          </Button>
        </div>
      );
    }

    switch (currentQuestion.inputType) {
      case 'select':
        return (
          <div className="space-y-3 w-full">
            <div className="flex gap-2">
              <Select value={value} onValueChange={onChange}>
                <SelectTrigger className={`flex-1 ${
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
                  {currentQuestion.options?.map((option: any) => (
                    <SelectItem 
                      key={option.value} 
                      value={option.value} 
                      className={`cursor-pointer ${
                        isDarkMode 
                          ? 'text-gray-100 bg-gray-700 hover:bg-gray-600 focus:bg-gray-600 data-[highlighted]:bg-gray-600 data-[highlighted]:text-gray-100' 
                          : 'text-gray-900 bg-white hover:bg-blue-50 focus:bg-blue-50 data-[highlighted]:bg-blue-50 data-[highlighted]:text-gray-900'
                      }`}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hideSubmitButton && (
                <Button 
                  onClick={onSubmit}
                  disabled={!value}
                  className="flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowCustomInput(true)}
              className={`w-full text-xs border ${
                isDarkMode 
                  ? 'text-gray-200 border-gray-500 bg-gray-700 hover:bg-gray-600' 
                  : 'text-gray-900 border-gray-400 bg-white hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Edit3 className="h-3 w-3 mr-1" />
              Enter Custom Value
            </Button>
          </div>
        );

      case 'colorSelect':
        const colorItemsPerPage = 3; // Show 3 color options at a time (accounting for wider buttons)
        
        // Combine original options with custom colors
        const allColorOptions = [...(currentQuestion.options || []), ...customColors];
        const colorTotalPages = Math.ceil(allColorOptions.length / colorItemsPerPage);
        const colorStartIndex = currentPage * colorItemsPerPage;
        const visibleColorOptions = allColorOptions.slice(colorStartIndex, colorStartIndex + colorItemsPerPage);
        
        return (
          <div className="space-y-3 w-full">
            <div className="flex gap-2 justify-between items-center">
              {/* Previous button */}
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                aria-label="Previous colors"
                className={`p-1 rounded ${
                  currentPage === 0 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : isDarkMode 
                      ? 'text-gray-300 hover:text-gray-100' 
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              {/* Color options container */}
              <div className="flex gap-2 flex-1 justify-center">
                {visibleColorOptions.map((option: any) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      // Update preview immediately for color changes
                      if (onPreviewUpdate && currentQuestion?.id) {
                        onPreviewUpdate(currentQuestion.id, option.value);
                      }
                    }}
                    className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                      value === option.value 
                        ? 'border-blue-500 bg-blue-50 shadow-sm' 
                        : isDarkMode 
                          ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-700/50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {option.colors && (
                      <div className="flex gap-1">
                        {option.colors.map((color: string, i: number) => (
                          <div
                            key={i}
                            className="w-3 h-3 rounded-full border shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    )}
                    <span className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-100' : 'text-gray-900'
                    }`}>{option.label}</span>
                  </button>
                ))}
              </div>
              
              {/* Next button */}
              <button
                onClick={() => setCurrentPage(Math.min(colorTotalPages - 1, currentPage + 1))}
                disabled={currentPage >= colorTotalPages - 1}
                aria-label="Next colors"
                className={`p-1 rounded ${
                  currentPage >= colorTotalPages - 1 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : isDarkMode 
                      ? 'text-gray-300 hover:text-gray-100' 
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            
            {/* Custom Color Picker */}
            {showColorPicker && (
              <div className="space-y-3 border-t pt-3">
                <div className="text-sm font-medium text-center">
                  <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>
                    Choose Your Custom Colors
                  </span>
                </div>
                
                {/* Horizontal Color Wheel */}
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Primary:
                    </span>
                    <input
                      type="color"
                      value={customValue.split(',')[0] || '#2563eb'}
                      onChange={(e) => {
                        const colors = customValue.split(',');
                        colors[0] = e.target.value;
                        setCustomValue(colors.join(','));
                      }}
                      className="w-8 h-6 rounded border cursor-pointer"
                      aria-label="Select primary color"
                    />
                    <div 
                      className="w-6 h-6 rounded border shadow-sm"
                      style={{ backgroundColor: customValue.split(',')[0] || '#2563eb' }}
                    />
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Secondary:
                    </span>
                    <input
                      type="color"
                      value={customValue.split(',')[1] || '#1e40af'}
                      onChange={(e) => {
                        const colors = customValue.split(',');
                        colors[1] = e.target.value;
                        setCustomValue(colors.join(','));
                      }}
                      className="w-8 h-6 rounded border cursor-pointer"
                      aria-label="Select secondary color"
                    />
                    <div 
                      className="w-6 h-6 rounded border shadow-sm"
                      style={{ backgroundColor: customValue.split(',')[1] || '#1e40af' }}
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCustomSubmit}
                    disabled={!customValue.trim()}
                    className="flex-1"
                  >
                    Use Custom Colors
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowColorPicker(false)}
                    className={`${
                      isDarkMode 
                        ? 'text-gray-200 border-gray-500 bg-gray-700 hover:bg-gray-600' 
                        : 'text-gray-900 border-gray-400 bg-white hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {!showColorPicker && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (onOpenColorPicker) {
                      onOpenColorPicker();
                    }
                  }}
                  className={`flex-1 text-xs border ${
                    isDarkMode 
                      ? 'text-gray-200 border-gray-500 bg-gray-700 hover:bg-gray-600' 
                      : 'text-gray-900 border-gray-400 bg-white hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Palette className="h-3 w-3 mr-1" />
                  Custom Color Scheme
                </Button>
                <Button 
                  onClick={onSubmit}
                  disabled={!value}
                  className="flex-1"
                >
                  Choose
                </Button>
              </div>
            )}
          </div>
        );

      case 'multiSelect':
        const selectedValues = value ? value.split(',') : [];
        const itemsPerPage = 4; // Show 4 items at a time
        const totalPages = Math.ceil((currentQuestion.options?.length || 0) / itemsPerPage);
        const startIndex = currentPage * itemsPerPage;
        const visibleOptions = currentQuestion.options?.slice(startIndex, startIndex + itemsPerPage) || [];
        
        return (
          <div className="space-y-3 w-full">
            <div className="flex gap-2 justify-between items-center">
              {/* Previous button */}
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                aria-label="Previous options"
                className={`p-1 rounded ${
                  currentPage === 0 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : isDarkMode 
                      ? 'text-gray-300 hover:text-gray-100' 
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              {/* Options container */}
              <div className="flex gap-2 flex-1 justify-center">
                {visibleOptions.map((option: any) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        let newValues;
                        if (isSelected) {
                          newValues = selectedValues.filter(v => v !== option.value);
                        } else {
                          if (selectedValues.length < (currentQuestion.maxSelections || 3)) {
                            newValues = [...selectedValues, option.value];
                          } else {
                            return;
                          }
                        }
                        onChange(newValues.join(','));
                      }}
                      className={`px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                          : isDarkMode 
                            ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-700/50 text-gray-200' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-900'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded border flex items-center justify-center ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500' 
                          : isDarkMode 
                            ? 'border-gray-500' 
                            : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <div className="w-1.5 h-1.5 bg-white" />
                        )}
                      </div>
                      <span className="font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Next button */}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                aria-label="Next options"
                className={`p-1 rounded ${
                  currentPage >= totalPages - 1 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : isDarkMode 
                      ? 'text-gray-300 hover:text-gray-100' 
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={onSubmit}
                disabled={selectedValues.length === 0}
                className="flex-1"
              >
                Continue ({selectedValues.length} selected)
              </Button>
            </div>
          </div>
        );

      case 'textarea':
        return (
          <div className="flex gap-2 w-full">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={currentQuestion.placeholder}
              rows={4}
              className={`flex-1 resize-none ${
                isDarkMode 
                  ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
                  : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
              }`}
            />
            {!hideSubmitButton && (
              <Button 
                onClick={onSubmit}
                disabled={!value.trim()}
                className="flex-shrink-0 self-start"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        );

      case 'yesNoMaybe':
        return (
          <div className="space-y-3 w-full">
            <div className="flex gap-2 flex-wrap">
              {currentQuestion.options?.map((option: any) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setTimeout(onSubmit, 100);
                  }}
                  className={`px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                    value === option.value 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                      : isDarkMode 
                        ? 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-700/50 text-gray-200' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-900'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                    value === option.value 
                      ? 'border-blue-500 bg-blue-500' 
                      : isDarkMode 
                        ? 'border-gray-500' 
                        : 'border-gray-300'
                  }`}>
                    {value === option.value && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="font-medium">{option.label}</span>
                </button>
              ))}
            </div>
            
            {/* Spacer to maintain consistent container height */}
            <div className="h-8" />
          </div>
        );

      case 'fileUpload':
        return (
          <div className="space-y-3 w-full">
            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDarkMode 
                ? 'border-gray-600 hover:border-gray-500 bg-gray-800/30' 
                : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
            }`}>
              <input
                type="file"
                accept={currentQuestion.acceptedFileTypes?.join(',') || 'image/*'}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // For demo purposes, just set the filename
                    onChange(file.name);
                    // In real implementation, you'd handle file upload here
                    console.log('File selected:', file);
                  }
                }}
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload" 
                className={`cursor-pointer flex flex-col items-center gap-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <span className="font-medium">
                    {value ? `Selected: ${value}` : 'Click to upload file'}
                  </span>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {currentQuestion.placeholder || 'Upload your file'}
                  </p>
                  {currentQuestion.maxFileSize && (
                    <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Max size: {currentQuestion.maxFileSize}
                    </p>
                  )}
                </div>
              </label>
            </div>
            
            {value && (
              <div className="flex gap-2">
                {!hideSubmitButton && (
                  <Button 
                    onClick={onSubmit}
                    className="flex-1"
                  >
                    Continue with "{value}"
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => onChange('')}
                  className={`${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        );

      default: // textarea for all free-hand text responses
        return (
          <div className="space-y-2 w-full">
            {currentQuestion.suggestions && (
              <div className="flex flex-wrap gap-1">
                {currentQuestion.suggestions.map((suggestion: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => onChange(suggestion)}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border text-gray-900"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={currentQuestion.placeholder}
                rows={4}
                className={`flex-1 resize-none ${
                  isDarkMode 
                    ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
                    : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
                }`}
              />
              {!hideSubmitButton && (
                <Button 
                  onClick={onSubmit}
                  disabled={!value.trim()}
                  className="flex-shrink-0 self-start"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
    }
  };

  return renderInput();
} 
