'use client';

/*
================================================================================
MODEL-PROMPT-NOTES: Input Component Selection Guidelines
================================================================================

When generating dynamic questions for users, the AI model should select the 
appropriate input component based on these guidelines:

1. CHECKBOX COMPONENT (multiSelect):
   - Use when: Finite set of options (typically 3-8 choices)
   - Use when: Multiple values can be selected simultaneously
   - Use when: No custom values needed (closed set)
   - Example: "Which features do you want?" → Charts, Export, Sharing, etc.
   - Layout: Horizontal inline chips with checkboxes
   - Max selections: Usually 3-4 to maintain simplicity

2. SELECT COMPONENT (select):
   - Use when: Endless possible options but providing top 5-8 common choices
   - Use when: Only ONE value can be selected
   - Use when: Custom value input is needed as fallback
   - Example: "What's your industry?" → Technology, Healthcare, + Custom option
   - Layout: Dropdown with "Enter Custom Value" button
   - Always include custom value option for flexibility

3. RADIO COMPONENT (yesNoMaybe):
   - Use when: Simple binary or ternary choices
   - Use when: Finite set of 2-4 mutually exclusive options
   - Use when: Options are simple single words or short phrases
   - Example: "How confident are you?" → Very Confident, Need Help, Somewhat Sure
   - Layout: Horizontal inline buttons with radio circles
   - Keep labels short and clear

4. COLOR COMPONENT (colorSelect):
   - Use when: Selecting brand colors or visual themes
   - Use when: Visual representation helps decision making
   - Example: "Choose your color scheme" → Professional Blue, Modern Green, etc.
   - Layout: Horizontal chips with color dots + labels
   - Always include custom color option

5. TEXT INPUT COMPONENT (text):
   - Use when: Open-ended single-line responses needed
   - Use when: Providing suggestion chips helps but custom input required
   - Example: "What should we call your tool?" → with suggestions like "ROI Calculator"
   - Layout: Input field with optional suggestion chips above
   - Keep suggestions to 4-6 options max

6. TEXTAREA COMPONENT (textarea):
   - Use when: Multi-line descriptive text needed
   - Use when: Detailed explanations or descriptions required
   - Example: "Describe your business and target audience"
   - Layout: Fixed 2-row textarea (no scrolling)
   - Keep compact - avoid long-form content

7. MULTI-PART COMPONENT (multiPart):
   - Use when: Need to collect 3-5 related pieces of information
   - Use when: Each sub-question uses different input types
   - Example: Collecting audience + industry + metrics in sequence
   - Flow: One question at a time, auto-advance through sequence
   - Keep total sub-questions to 3-5 max

DESIGN PRINCIPLES:
- All components must fit in uniform container (no size changes)
- No scrolling required - everything visible at once
- Horizontal layouts preferred for space efficiency
- Simple, short labels (avoid long descriptions)
- Always provide escape hatch (custom options) when possible
- Maintain consistent visual hierarchy and spacing

COMPONENT SIZING:
- Checkboxes/radios: 3x3px indicators
- Color dots: 3x3px circles
- Button padding: px-3 py-2 for consistency
- Textarea: Fixed 2 rows maximum
- Container: Uniform height regardless of content

================================================================================
*/

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Send, 
  Loader2, 
  Calculator, 
  Palette, 
  Type, 
  Layout,
  Sparkles,
  Brain,
  RotateCcw,
  MessageCircle,
  Moon,
  Sun,
  Settings,
  ChevronDown,
  Edit3,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { MagicSparkAgent } from '@/lib/ai/agents/magic-spark';

// Mock workflow for testing different input types and transitions
const mockWorkflow = [
  {
    id: 'tool-type',
    message: "Let's create your lead magnet! What type of calculator would work best for your business?",
    inputType: 'select',
    options: [
      { value: 'roi', label: 'ROI Calculator' },
      { value: 'savings', label: 'Cost Savings Calculator' },
      { value: 'pricing', label: 'Pricing Calculator' },
      { value: 'assessment', label: 'Business Assessment' },
      { value: 'custom', label: 'Custom Calculator' }
    ],
    placeholder: 'Choose calculator type...',
    allowCustom: true
  },
  {
    id: 'features-wanted',
    message: "Great choice! Which features would you like to include in your calculator? (Select all that apply)",
    inputType: 'multiSelect',
    options: [
      { value: 'charts', label: 'Charts' },
      { value: 'export', label: 'PDF Export' },
      { value: 'email', label: 'Email Results' },
      { value: 'comparison', label: 'Comparison' },
      { value: 'sharing', label: 'Sharing' },
      { value: 'branding', label: 'Branding' }
    ],
    maxSelections: 4
  },
  {
    id: 'color-scheme',
    message: "Perfect! Now let's choose colors that represent your brand. Pick your primary color scheme:",
    inputType: 'colorSelect',
    options: [
      { value: 'professional-blue', label: 'Professional Blue', colors: ['#2563eb', '#1e40af'] },
      { value: 'modern-green', label: 'Modern Green', colors: ['#059669', '#047857'] },
      { value: 'elegant-purple', label: 'Elegant Purple', colors: ['#7c3aed', '#5b21b6'] },
      { value: 'warm-orange', label: 'Warm Orange', colors: ['#ea580c', '#c2410c'] },
      { value: 'bold-red', label: 'Bold Red', colors: ['#dc2626', '#b91c1c'] },
      { value: 'calm-teal', label: 'Calm Teal', colors: ['#0891b2', '#0e7490'] }
    ],
    allowCustom: true
  },
  {
    id: 'confidence-level',
    message: "How confident are you about your calculator's target audience and value proposition?",
    inputType: 'yesNoMaybe',
    options: [
      { value: 'yes', label: 'Very Confident' },
      { value: 'no', label: 'Need Help' },
      { value: 'maybe', label: 'Somewhat Sure' }
    ]
  },
  {
    id: 'business-description',
    message: "Excellent! Now tell me about your business and the specific problem this calculator will solve for your customers.",
    inputType: 'textarea',
    placeholder: 'Describe your business, target audience, the problem you solve, and how this calculator fits into your customer journey...',
    rows: 5
  },
  {
    id: 'multi-part-setup',
    message: "Perfect! Now I'll ask you a series of quick questions to fine-tune your calculator. Let's go through them one by one:",
    inputType: 'multiPart',
    questions: [
      {
        id: 'target-audience',
        question: "Who is your primary target audience?",
        inputType: 'select',
        options: [
          { value: 'small-business', label: 'Small Business Owners (1-50 employees)' },
          { value: 'mid-market', label: 'Mid-Market Companies (51-500 employees)' },
          { value: 'enterprise', label: 'Enterprise Organizations (500+ employees)' },
          { value: 'consultants', label: 'Consultants & Agencies' },
          { value: 'individuals', label: 'Individual Professionals' },
          { value: 'startups', label: 'Startups & Entrepreneurs' }
        ],
        allowCustom: true
      },
      {
        id: 'industry-focus',
        question: "What industry or sector do you primarily serve?",
        inputType: 'text',
        placeholder: 'e.g., Healthcare, Technology, Manufacturing, Professional Services...',
        suggestions: [
          'Technology',
          'Healthcare', 
          'Financial Services',
          'Manufacturing',
          'Professional Services',
          'E-commerce',
          'Education',
          'Real Estate'
        ]
      },
      {
        id: 'calculator-name',
        question: "What should we call your calculator?",
        inputType: 'text',
        placeholder: 'e.g., "ROI Calculator for Marketing Campaigns"',
        suggestions: [
          'ROI Calculator',
          'Cost Savings Calculator', 
          'Business Value Calculator',
          'Investment Calculator',
          'Pricing Calculator'
        ]
      },
      {
        id: 'key-metrics',
        question: "What are the main metrics or outputs your users want to see?",
        inputType: 'multiSelect',
        options: [
          { value: 'roi-percentage', label: 'ROI Percentage' },
          { value: 'dollar-savings', label: 'Dollar Savings' },
          { value: 'time-saved', label: 'Time Saved' },
          { value: 'efficiency-gain', label: 'Efficiency Gains' },
          { value: 'cost-reduction', label: 'Cost Reduction' },
          { value: 'revenue-increase', label: 'Revenue Increase' }
        ],
        maxSelections: 3
      }
    ]
  },
  {
    id: 'final-customization',
    message: "Almost done! Any final customizations, special requirements, or additional features you'd like to add?",
    inputType: 'textarea',
    placeholder: 'Describe any special calculations, integrations, design preferences, or unique features you need...',
    rows: 4
  }
];

interface CanvasToolProps {
  toolData: any;
  colorScheme: string;
}

function CanvasTool({ toolData, colorScheme }: CanvasToolProps) {
  const getColorScheme = (scheme: string) => {
    const schemes = {
      'professional-blue': { primary: '#2563eb', secondary: '#1e40af', bg: '#eff6ff' },
      'modern-green': { primary: '#059669', secondary: '#047857', bg: '#ecfdf5' },
      'elegant-purple': { primary: '#7c3aed', secondary: '#5b21b6', bg: '#f3e8ff' },
      'warm-orange': { primary: '#ea580c', secondary: '#c2410c', bg: '#fff7ed' },
      'custom': toolData.customColors ? {
        primary: toolData.customColors[0],
        secondary: toolData.customColors[1],
        bg: `${toolData.customColors[0]}10`
      } : { primary: '#6b7280', secondary: '#4b5563', bg: '#f9fafb' },
      default: { primary: '#6b7280', secondary: '#4b5563', bg: '#f9fafb' }
    };
    return schemes[scheme as keyof typeof schemes] || schemes.default;
  };

  const colors = getColorScheme(colorScheme);

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <Card className="w-full max-w-2xl mx-auto shadow-lg" style={{ backgroundColor: colors.bg }}>
        <CardContent className="p-8">
          {/* Tool Header */}
          <div className="text-center mb-8">
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ backgroundColor: colors.primary }}
            >
              <Calculator className="h-8 w-8 text-white" />
            </div>
            <h1 
              className="text-2xl font-bold mb-2"
              style={{ color: colors.secondary }}
            >
              {toolData.title || 'Your Calculator'}
            </h1>
            <p className="text-gray-600">
              {toolData.description || 'Calculate your business metrics instantly'}
            </p>
          </div>

          {/* Mock Calculator Interface */}
          <div className="space-y-6">
            {toolData.inputs?.map((input: string, index: number) => (
              <div key={index} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {input}
                </label>
                <Input 
                  placeholder={`Enter ${input.toLowerCase()}`}
                  className="w-full text-gray-900 placeholder:text-gray-500"
                />
              </div>
            )) || (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Monthly Revenue
                  </label>
                  <Input placeholder="Enter monthly revenue" className="w-full text-gray-900 placeholder:text-gray-500" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Marketing Budget
                  </label>
                  <Input placeholder="Enter marketing budget" className="w-full text-gray-900 placeholder:text-gray-500" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Conversion Rate (%)
                  </label>
                  <Input placeholder="Enter conversion rate" className="w-full text-gray-900 placeholder:text-gray-500" />
                </div>
              </>
            )}

            <Button 
              className="w-full py-3 text-lg font-semibold"
              style={{ backgroundColor: colors.primary }}
            >
              Calculate Results
            </Button>

            {/* Mock Results */}
            <div 
              className="mt-6 p-4 rounded-lg border-2"
              style={{ borderColor: colors.primary, backgroundColor: 'white' }}
            >
              <h3 className="font-semibold mb-2" style={{ color: colors.secondary }}>
                Your Results:
              </h3>
              <div className="text-3xl font-bold" style={{ color: colors.primary }}>
                {toolData.outputFormat?.includes('percentage') ? '24.5%' : 
                 toolData.outputFormat?.includes('currency') ? '$12,450' : 
                 '8.7/10'}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Based on your inputs
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface DynamicInputProps {
  currentQuestion: any;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isDarkMode: boolean;
  onOpenColorPicker?: () => void;
  onPreviewUpdate?: (questionId: string, value: string) => void;
}

function DynamicInput({ currentQuestion, value, onChange, onSubmit, isLoading, isDarkMode, onOpenColorPicker, onPreviewUpdate }: DynamicInputProps) {
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
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask a question or provide feedback..."
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          disabled={isLoading}
          className={`flex-1 ${
            isDarkMode 
              ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
              : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
          }`}
        />
        <Button 
          onClick={onSubmit}
          disabled={isLoading || !value.trim()}
          className="flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
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
            <Input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Enter your custom value..."
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              className={`flex-1 ${
                isDarkMode 
                  ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
                  : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
              }`}
              autoFocus
            />
            <Button 
              onClick={handleCustomSubmit}
              disabled={!customValue.trim()}
              className="flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
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
              <Button 
                onClick={onSubmit}
                disabled={!value}
                className="flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
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
        const colorTotalPages = Math.ceil((currentQuestion.options?.length || 0) / colorItemsPerPage);
        const colorStartIndex = currentPage * colorItemsPerPage;
        const visibleColorOptions = currentQuestion.options?.slice(colorStartIndex, colorStartIndex + colorItemsPerPage) || [];
        
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
                          : 'border-gray-200 hover:border-gray-300'
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
          <div className="space-y-2 w-full">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={currentQuestion.placeholder}
              rows={2}
              className={`w-full resize-none ${
                isDarkMode 
                  ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
                  : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
              }`}
            />
            <Button 
              onClick={onSubmit}
              disabled={!value.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Continue
            </Button>
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
          </div>
        );

      case 'multiPart':
        return (
          <div className="space-y-3 w-full">
            <div className="text-sm text-gray-600 mb-3">
              I'll ask you {currentQuestion.questions?.length} questions, one at a time.
            </div>
            <Button 
              onClick={() => {
                onChange('start-multipart');
                setTimeout(onSubmit, 100);
              }}
              className="w-full"
            >
              Start Questions ({currentQuestion.questions?.length} total)
            </Button>
          </div>
        );

      default: // text input
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
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={currentQuestion.placeholder}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                className={`flex-1 ${
                  isDarkMode 
                    ? 'text-gray-100 placeholder:text-gray-400 bg-gray-600 border-gray-500' 
                    : 'text-gray-900 placeholder:text-gray-500 bg-white border-gray-300'
                }`}
              />
              <Button 
                onClick={onSubmit}
                disabled={!value.trim()}
                className="flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
    }
  };

  return renderInput();
}

// Color Picker Popup Component
interface ColorPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (primaryColor: string, secondaryColor: string) => void;
  initialPrimary?: string;
  initialSecondary?: string;
  isDarkMode: boolean;
}

function ColorPickerPopup({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialPrimary = '#2563eb', 
  initialSecondary = '#1e40af',
  isDarkMode 
}: ColorPickerPopupProps) {
  const [primaryColor, setPrimaryColor] = useState(initialPrimary);
  const [secondaryColor, setSecondaryColor] = useState(initialSecondary);
  const [hasSelectedColors, setHasSelectedColors] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit(primaryColor, secondaryColor);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-xl shadow-2xl border max-w-2xl w-full ${
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
            Choose Your Color Scheme
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded hover:bg-gray-100 ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
            }`}
            aria-label="Close color picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Color Pickers */}
        <div className="p-6">
          {!hasSelectedColors && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Primary Color Picker */}
              <div className="space-y-3">
                <div className="text-center">
                  <h4 className={`font-medium mb-2 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    Primary Color
                  </h4>
                  <div 
                    className="w-16 h-16 rounded-lg border-2 border-gray-300 mx-auto mb-3 shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  />
                </div>
                
                {/* Full-sized color picker */}
                <div className="relative">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      setHasSelectedColors(true);
                    }}
                    className="w-full h-32 rounded-lg border cursor-pointer"
                    style={{
                      WebkitAppearance: 'none',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                    aria-label="Select primary color"
                  />
                </div>
                
                {/* Color value display */}
                <div className={`text-center text-sm font-mono ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {primaryColor.toUpperCase()}
                </div>
              </div>

              {/* Secondary Color Picker */}
              <div className="space-y-3">
                <div className="text-center">
                  <h4 className={`font-medium mb-2 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    Secondary Color
                  </h4>
                  <div 
                    className="w-16 h-16 rounded-lg border-2 border-gray-300 mx-auto mb-3 shadow-sm"
                    style={{ backgroundColor: secondaryColor }}
                  />
                </div>
                
                {/* Full-sized color picker */}
                <div className="relative">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => {
                      setSecondaryColor(e.target.value);
                      setHasSelectedColors(true);
                    }}
                    className="w-full h-32 rounded-lg border cursor-pointer"
                    style={{
                      WebkitAppearance: 'none',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                    aria-label="Select secondary color"
                  />
                </div>
                
                {/* Color value display */}
                <div className={`text-center text-sm font-mono ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {secondaryColor.toUpperCase()}
                </div>
              </div>
            </div>
          )}

          {/* Selected Colors View */}
          {hasSelectedColors && (
            <div className="text-center space-y-6">
              <div>
                <h4 className={`text-lg font-semibold mb-4 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Your Selected Color Scheme
                </h4>
                
                {/* Large Color Preview */}
                <div className="flex items-center justify-center gap-6 mb-6">
                  <div className="text-center">
                    <div 
                      className="w-20 h-20 rounded-xl border-2 border-gray-300 mx-auto mb-2 shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Primary
                    </p>
                    <p className={`text-xs font-mono ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {primaryColor.toUpperCase()}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div 
                      className="w-20 h-20 rounded-xl border-2 border-gray-300 mx-auto mb-2 shadow-lg"
                      style={{ backgroundColor: secondaryColor }}
                    />
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Secondary
                    </p>
                    <p className={`text-xs font-mono ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {secondaryColor.toUpperCase()}
                    </p>
                  </div>
                </div>
                
                {/* Edit Colors Button */}
                <Button
                  variant="outline"
                  onClick={() => setHasSelectedColors(false)}
                  className={`${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-200 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Edit Colors
                </Button>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {!hasSelectedColors && (
            <div className="mt-6 p-4 rounded-lg border-2" style={{ 
              borderColor: primaryColor,
              background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)`
            }}>
              <div className="text-center">
                <h5 className={`font-medium mb-2 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Color Scheme Preview
                </h5>
                <div className="flex items-center justify-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <span className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    +
                  </span>
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: secondaryColor }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
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
              className="flex-1"
              style={{ backgroundColor: primaryColor }}
            >
              Choose
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestUIPage() {
  const [useMockData, setUseMockData] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps] = useState(7);
  const [lastAIMessage, setLastAIMessage] = useState("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPickerPopup, setShowColorPickerPopup] = useState(false);
  
  // Question queue management
  const [questionQueue, setQuestionQueue] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [collectedAnswers, setCollectedAnswers] = useState<Record<string, string>>({});
  
  // Multi-part question state
  const [isInMultiPart, setIsInMultiPart] = useState(false);
  const [multiPartQuestions, setMultiPartQuestions] = useState<any[]>([]);
  const [multiPartIndex, setMultiPartIndex] = useState(0);
  const [multiPartAnswers, setMultiPartAnswers] = useState<Record<string, string>>({});
  
  // Tool data for canvas
  const [toolData, setToolData] = useState<any>({
    title: 'Business Calculator',
    description: 'Calculate your business metrics',
    colorScheme: 'professional-blue',
    inputs: [],
    outputFormat: ['percentage']
  });

  const magicSparkRef = useRef<MagicSparkAgent | null>(null);

  // Initialize dark mode based on system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Initialize agent
  useEffect(() => {
    if (!useMockData) {
      try {
        magicSparkRef.current = new MagicSparkAgent();
      } catch (error) {
        console.error('Failed to initialize Magic Spark agent:', error);
        setUseMockData(true);
      }
    }
  }, [useMockData]);

  // Initialize with first mock question
  useEffect(() => {
    if (useMockData && questionQueue.length === 0) {
      setQuestionQueue([mockWorkflow[0]]);
      setCurrentQuestionIndex(0);
    }
  }, [useMockData, questionQueue.length]);

  const currentQuestion = isInMultiPart 
    ? multiPartQuestions[multiPartIndex] || null 
    : questionQueue[currentQuestionIndex] || null;

  const handleInputSubmit = async () => {
    if (!currentInput.trim() && !currentQuestion) return;

    setIsLoading(true);

    try {
      if (isInMultiPart) {
        // Handle multi-part question flow
        const questionId = currentQuestion.id;
        const newMultiPartAnswers = { ...multiPartAnswers, [questionId]: currentInput };
        setMultiPartAnswers(newMultiPartAnswers);

        // Update tool data based on multi-part answer
        updateToolDataFromMultiPart(questionId, currentInput);

        if (multiPartIndex < multiPartQuestions.length - 1) {
          // Move to next multi-part question
          setMultiPartIndex(multiPartIndex + 1);
          setCurrentInput('');
          setLastAIMessage(`Question ${multiPartIndex + 2} of ${multiPartQuestions.length}: ${multiPartQuestions[multiPartIndex + 1].question}`);
        } else {
          // Multi-part complete, return to main flow
          setIsInMultiPart(false);
          setMultiPartQuestions([]);
          setMultiPartIndex(0);
          
          // Store all multi-part answers as a single answer
          const mainQuestionId = 'multi-part-setup';
          const newAnswers = { ...collectedAnswers, [mainQuestionId]: JSON.stringify(newMultiPartAnswers) };
          setCollectedAnswers(newAnswers);
          
          // Continue with main workflow
          await processMockWorkflow(newAnswers);
          setMultiPartAnswers({});
        }
      } else if (currentQuestion) {
        // Handle regular question response
        const answerId = currentQuestion.id;
        
        // Check if this is starting a multi-part question
        if (currentQuestion.inputType === 'multiPart' && currentInput === 'start-multipart') {
          setIsInMultiPart(true);
          setMultiPartQuestions(currentQuestion.questions || []);
          setMultiPartIndex(0);
          setCurrentInput('');
          setLastAIMessage(`Question 1 of ${currentQuestion.questions?.length}: ${currentQuestion.questions?.[0]?.question}`);
        } else {
          // Regular single question
          const newAnswers = { ...collectedAnswers, [answerId]: currentInput };
          setCollectedAnswers(newAnswers);

          // Update tool data based on answer
          updateToolData(answerId, currentInput);

          // Move to next question or complete queue
          if (currentQuestionIndex < questionQueue.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setCurrentInput('');
          } else {
            // Queue complete, process with AI or move to next mock step
            if (useMockData) {
              await processMockWorkflow(newAnswers);
            } else {
              await processWithAI(newAnswers);
              setQuestionQueue([]);
              setCurrentQuestionIndex(0);
              setCurrentInput('');
            }
          }
        }
      } else {
        // Handle free-form input
        if (useMockData) {
          await handleMockFreeformInput(currentInput);
        } else {
          await handleAIFreeformInput(currentInput);
        }
      }

      // Input clearing is handled by each specific path above
    } catch (error) {
      console.error('Error handling input:', error);
      setLastAIMessage('Sorry, there was an error processing your input. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateToolData = (answerId: string, value: string) => {
    setToolData((prev: any) => {
      const updated = { ...prev };
      
      switch (answerId) {
        case 'tool-type':
          updated.type = value;
          break;
        case 'features-wanted':
          updated.features = value.split(',');
          break;
        case 'color-scheme':
          updated.colorScheme = value;
          // Immediately update preview for color changes
          break;
        case 'confidence-level':
          updated.confidenceLevel = value;
          break;
        case 'business-description':
          updated.businessDescription = value;
          break;
        case 'calculator-title':
        case 'calculator-name':
          updated.title = value;
          break;
        case 'final-customization':
          updated.customizations = value;
          break;
        case 'key-inputs':
          updated.inputs = value.split(',').map(s => s.trim()).filter(Boolean);
          break;
        case 'output-format':
          updated.outputFormat = value.split(',');
          break;
      }
      
      return updated;
    });
  };

  const updateToolDataFromMultiPart = (questionId: string, value: string) => {
    setToolData((prev: any) => {
      const updated = { ...prev };
      
      switch (questionId) {
        case 'target-audience':
          updated.targetAudience = value;
          break;
        case 'industry-focus':
          updated.industry = value;
          break;
        case 'calculator-name':
          updated.title = value;
          break;
        case 'key-metrics':
          updated.keyMetrics = value.split(',');
          break;
        case 'color-preference':
          updated.colorScheme = value;
          break;
      }
      
      return updated;
    });
  };

  const processMockWorkflow = async (answers: Record<string, string>) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (currentStep < mockWorkflow.length) {
      const nextQuestion = mockWorkflow[currentStep];
      setQuestionQueue([nextQuestion]);
      setCurrentQuestionIndex(0);
      setCurrentStep(currentStep + 1);
      setLastAIMessage(nextQuestion.message);
      setCurrentInput('');
    } else {
      setLastAIMessage("Perfect! Your calculator is taking shape. You can see the preview updating in real-time. Would you like to refine any aspect or add more features?");
      setCurrentStep(Math.min(currentStep + 1, totalSteps));
      setQuestionQueue([]);
      setCurrentQuestionIndex(0);
    }
  };

  const handleMockFreeformInput = async (input: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('color') || lowerInput.includes('style')) {
      setLastAIMessage("Great question about styling! Let me show you some color options that would work well for your calculator.");
      setQuestionQueue([mockWorkflow.find(q => q.id === 'color-scheme')!]);
      setCurrentQuestionIndex(0);
    } else if (lowerInput.includes('input') || lowerInput.includes('field')) {
      setLastAIMessage("Perfect! Let's define what inputs your users will provide to get their calculations.");
      setQuestionQueue([mockWorkflow.find(q => q.id === 'key-inputs')!]);
      setCurrentQuestionIndex(0);
    } else {
      setLastAIMessage("I understand! The calculator is looking great. You can continue customizing it, or ask me about specific features you'd like to add or modify.");
    }
  };

  const processWithAI = async (answers: Record<string, string>) => {
    // TODO: Implement real AI processing
    setLastAIMessage("Processing your responses with AI...");
  };

  const handleAIFreeformInput = async (input: string) => {
    // TODO: Implement real AI conversation
    setLastAIMessage("AI response to: " + input);
  };

  const handleColorPickerSubmit = (primaryColor: string, secondaryColor: string) => {
    const colorValue = `custom-${primaryColor}-${secondaryColor}`;
    // Update tool data with custom colors
    setToolData((prev: any) => ({
      ...prev,
      colorScheme: 'custom',
      customColors: [primaryColor, secondaryColor]
    }));
    // Continue with the workflow
    setCollectedAnswers(prev => ({ ...prev, 'color-scheme': colorValue }));
    processMockWorkflow({ ...collectedAnswers, 'color-scheme': colorValue });
  };

  const resetWorkflow = () => {
    setCurrentStep(1);
    setQuestionQueue([mockWorkflow[0]]);
    setCurrentQuestionIndex(0);
    setCurrentInput('');
    setCollectedAnswers({});
    setLastAIMessage("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
    setToolData({
      title: 'Business Calculator',
      description: 'Calculate your business metrics',
      colorScheme: 'professional-blue',
      inputs: [],
      outputFormat: ['percentage']
    });
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Slim Progress Bar */}
      <div className={`border-b px-6 py-3 flex-shrink-0 ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-blue-600" />
            <span className={`font-medium ${isDarkMode ? 'text-gray-50' : 'text-gray-900'}`}>
              Tool Creator
            </span>
            <Badge variant="outline" className={`text-xs ${
              isDarkMode ? 'border-gray-600 text-gray-300' : ''
            }`}>
              {useMockData ? 'Mock Mode' : 'AI Mode'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className={`text-xs border-2 rounded-lg ${
                  isDarkMode 
                    ? 'border-gray-600 bg-gray-700 text-gray-50 hover:bg-gray-600 shadow-sm' 
                    : 'border-gray-400 bg-gray-100 text-gray-800 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                <Settings className="h-3 w-3 mr-1" />
                Options
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              
              {showOptionsMenu && (
                <div className={`absolute right-0 top-full mt-2 w-52 rounded-xl shadow-xl border z-50 ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-600 shadow-black/20' 
                    : 'bg-white border-gray-300 shadow-lg'
                }`}>
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setIsDarkMode(!isDarkMode);
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    </button>
                    <button
                      onClick={() => {
                        setUseMockData(!useMockData);
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <Brain className="h-4 w-4" />
                      {useMockData ? 'Switch to Real AI' : 'Switch to Mock Mode'}
                    </button>
                    <div className={`border-t my-2 mx-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
                    <button
                      onClick={() => {
                        resetWorkflow();
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset Workflow
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={progressPercentage} className="flex-1 h-2" />
          <span className={`text-xs font-medium min-w-fit ${
            isDarkMode ? 'text-gray-50' : 'text-gray-500'
          }`}>
            Step {currentStep}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto relative">
        {/* Smooth circular gradient texture */}
        <div 
          className={`absolute inset-0 pointer-events-none ${
            isDarkMode ? 'opacity-60' : 'opacity-40'
          }`}
          style={{
            background: isDarkMode 
              ? `
                radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
                radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.04) 0%, transparent 40%),
                radial-gradient(circle at 20% 70%, rgba(255, 255, 255, 0.06) 0%, transparent 35%),
                radial-gradient(circle at 80% 30%, rgba(255, 255, 255, 0.03) 0%, transparent 45%)
              `
              : `
                radial-gradient(circle at 30% 20%, rgba(0, 0, 0, 0.06) 0%, transparent 50%),
                radial-gradient(circle at 70% 80%, rgba(0, 0, 0, 0.03) 0%, transparent 40%),
                radial-gradient(circle at 20% 70%, rgba(0, 0, 0, 0.04) 0%, transparent 35%),
                radial-gradient(circle at 80% 30%, rgba(0, 0, 0, 0.02) 0%, transparent 45%)
              `
          }}
        />
        
        {/* Fine noise texture overlay */}
        <div 
          className={`absolute inset-0 pointer-events-none ${
            isDarkMode ? 'opacity-30' : 'opacity-20'
          }`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' fill='%23000000' opacity='${isDarkMode ? '0.3' : '0.6'}'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px',
            mixBlendMode: isDarkMode ? 'screen' : 'multiply'
          }}
        />
        
        <CanvasTool toolData={toolData} colorScheme={toolData.colorScheme} />
      </div>

      {/* Bottom Input Strip */}
      <div className={`border-t p-4 flex-shrink-0 ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`} style={{ maxHeight: '25vh' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-7xl mx-auto">
          {/* AI Message Section */}
          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-sm font-medium ${
              isDarkMode ? 'text-gray-50' : 'text-gray-800'
            }`}>
              <Sparkles className="h-4 w-4" />
              <span>AI Assistant</span>
              {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            <div className={`rounded-xl p-4 border ${
              isDarkMode 
                ? 'bg-gray-700/50 border-gray-600 text-blue-100 shadow-sm backdrop-blur-sm' 
                : 'bg-blue-50 border-blue-400 text-blue-900'
            }`}>
              <p className="text-sm leading-relaxed font-medium">
                {lastAIMessage}
              </p>
            </div>
          </div>

          {/* Dynamic Input Section */}
          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-sm font-medium ${
              isDarkMode ? 'text-gray-50' : 'text-gray-800'
            }`}>
              <MessageCircle className="h-4 w-4" />
              <span>
                {isInMultiPart 
                  ? `Multi-part Question ${multiPartIndex + 1}/${multiPartQuestions.length}`
                  : currentQuestion 
                    ? `Question ${currentQuestionIndex + 1}/${questionQueue.length}` 
                    : 'Your Input'
                }
              </span>
            </div>
            <div className={`rounded-xl p-4 border ${
              isDarkMode 
                ? 'bg-gray-700/50 border-gray-600 shadow-sm backdrop-blur-sm' 
                : 'bg-gray-50 border-gray-400'
            }`}>
              <DynamicInput
                currentQuestion={currentQuestion}
                value={currentInput}
                onChange={setCurrentInput}
                onSubmit={handleInputSubmit}
                isLoading={isLoading}
                isDarkMode={isDarkMode}
                onOpenColorPicker={() => setShowColorPickerPopup(true)}
                onPreviewUpdate={(questionId, value) => {
                  // Immediately update tool preview for color changes
                  if (questionId === 'color-scheme') {
                    updateToolData(questionId, value);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Step Indicator */}
      <div className={`fixed bottom-6 left-6 rounded-full shadow-lg border px-3 py-2 ${
        isDarkMode 
          ? 'bg-gray-800/80 border-gray-700 text-gray-50 backdrop-blur-sm shadow-black/20' 
          : 'bg-white border-gray-200 text-gray-600'
      }`}>
        <span className="text-xs font-medium">
          {currentStep}/{totalSteps}
        </span>
      </div>

      {/* Color Picker Popup */}
      <ColorPickerPopup
        isOpen={showColorPickerPopup}
        onClose={() => setShowColorPickerPopup(false)}
        onSubmit={handleColorPickerSubmit}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}