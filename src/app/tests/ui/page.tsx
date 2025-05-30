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
   - MAX 3 OPTIONS: This component is for very mundane, simplistic responses
   - For more complex single choices, use SELECT component instead

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
  MessageSquare,
  Moon,
  Sun,
  Settings,
  ChevronDown,
  Edit3,
  ChevronLeft,
  ChevronRight,
  X,
  History,
  Zap,
  CheckCircle,
  Upload
} from 'lucide-react';
import { CanvasTool } from '@/components/tool-creator/canvas-tool';
import { InputHistory } from '@/components/tool-creator/input-history';
import { initBehaviorTracker, getBehaviorTracker } from '@/lib/ai/behavior-tracker';
import { ProductToolDefinition } from '@/lib/types/product-tool';

// Local Storage Utilities for Development
const LOGIC_STORAGE_KEY = 'keyvex_logic_architect_results';
const TOOLS_STORAGE_KEY = 'keyvex_created_tools';

interface SavedLogicResult {
  id: string;
  timestamp: number;
  date: string;
  toolType: string;
  targetAudience: string;
  industry?: string;
  result: any;
}

interface SavedTool {
  id: string;
  timestamp: number;
  date: string;
  title: string;
  tool: ProductToolDefinition;
}

const saveLogicResult = (toolType: string, targetAudience: string, industry: string | undefined, result: any) => {
  try {
    const saved = localStorage.getItem(LOGIC_STORAGE_KEY);
    const existing: SavedLogicResult[] = saved ? JSON.parse(saved) : [];
    
    const newResult: SavedLogicResult = {
      id: `logic_${Date.now()}`,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      toolType,
      targetAudience,
      industry,
      result
    };
    
    existing.unshift(newResult); // Add to beginning
    localStorage.setItem(LOGIC_STORAGE_KEY, JSON.stringify(existing.slice(0, 50))); // Keep last 50
    console.log('💾 Saved logic result to localStorage:', newResult.id);
  } catch (error) {
    console.error('Failed to save logic result:', error);
  }
};

const saveCreatedTool = (tool: ProductToolDefinition) => {
  try {
    const saved = localStorage.getItem(TOOLS_STORAGE_KEY);
    const existing: SavedTool[] = saved ? JSON.parse(saved) : [];
    
    const newTool: SavedTool = {
      id: `tool_${Date.now()}`,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      title: tool.metadata.title,
      tool
    };
    
    existing.unshift(newTool); // Add to beginning
    localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(existing.slice(0, 50))); // Keep last 50
    console.log('💾 Saved created tool to localStorage:', newTool.id);
  } catch (error) {
    console.error('Failed to save created tool:', error);
  }
};

const getSavedLogicResults = (): SavedLogicResult[] => {
  try {
    const saved = localStorage.getItem(LOGIC_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load logic results:', error);
    return [];
  }
};

const getSavedTools = (): SavedTool[] => {
  try {
    const saved = localStorage.getItem(TOOLS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load saved tools:', error);
    return [];
  }
};

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
        inputType: 'textarea',
        placeholder: 'e.g., Healthcare, Technology, Manufacturing, Professional Services...',
        rows: 2,
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
        inputType: 'textarea',
        placeholder: 'e.g., "ROI Calculator for Marketing Campaigns"',
        rows: 2,
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

// New mock workflow specifically for testing the multi-question iterator
const iteratorTestWorkflow = [
  {
    id: 'welcome-iterator',
    message: "Welcome to the Multi-Question Iterator Test! This flow will demonstrate how the iterator component works with various question types.",
    inputType: 'textarea',
    placeholder: 'Tell me what you\'d like to test about the iterator component...',
    rows: 3
  },
  {
    id: 'basic-info-collection',
    message: "Let's collect some basic information about you. I'll ask you 5 questions in sequence:",
    inputType: 'multiPart',
    questions: [
      {
        id: 'full-name',
        question: "What's your full name?",
        inputType: 'textarea',
        placeholder: 'Enter your first and last name...',
        rows: 2,
        suggestions: ['John Smith', 'Jane Doe', 'Alex Johnson']
      },
      {
        id: 'role-title',
        question: "What's your professional role?",
        inputType: 'select',
        options: [
          { value: 'ceo', label: 'CEO/Founder' },
          { value: 'marketing', label: 'Marketing Manager' },
          { value: 'sales', label: 'Sales Director' },
          { value: 'consultant', label: 'Business Consultant' },
          { value: 'freelancer', label: 'Freelancer' },
          { value: 'other', label: 'Other Role' }
        ],
        allowCustom: true
      },
      {
        id: 'experience-level',
        question: "How would you describe your experience level?",
        inputType: 'yesNoMaybe',
        options: [
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'expert', label: 'Expert' }
        ]
      },
      {
        id: 'interests',
        question: "Which areas interest you most? (Select up to 3)",
        inputType: 'multiSelect',
        options: [
          { value: 'ai', label: 'Artificial Intelligence' },
          { value: 'marketing', label: 'Digital Marketing' },
          { value: 'sales', label: 'Sales Automation' },
          { value: 'analytics', label: 'Data Analytics' },
          { value: 'design', label: 'Design & UX' },
          { value: 'development', label: 'Software Development' }
        ],
        maxSelections: 3
      },
      {
        id: 'goals',
        question: "What are your main goals for this year?",
        inputType: 'textarea',
        placeholder: 'Describe your professional goals, challenges you want to solve, or skills you want to develop...',
        rows: 3
      }
    ]
  },
  {
    id: 'preferences-collection',
    message: "Great! Now let's gather your preferences. Another set of 4 questions coming up:",
    inputType: 'multiPart',
    questions: [
      {
        id: 'preferred-colors',
        question: "What's your preferred color scheme for professional tools?",
        inputType: 'colorSelect',
        options: [
          { value: 'corporate-blue', label: 'Corporate Blue', colors: ['#1e3a8a', '#3b82f6'] },
          { value: 'nature-green', label: 'Nature Green', colors: ['#065f46', '#10b981'] },
          { value: 'sunset-orange', label: 'Sunset Orange', colors: ['#c2410c', '#f97316'] },
          { value: 'royal-purple', label: 'Royal Purple', colors: ['#581c87', '#a855f7'] },
          { value: 'elegant-gray', label: 'Elegant Gray', colors: ['#374151', '#6b7280'] }
        ],
        allowCustom: true
      },
      {
        id: 'communication-style',
        question: "How do you prefer to receive information?",
        inputType: 'select',
        options: [
          { value: 'detailed', label: 'Detailed explanations' },
          { value: 'concise', label: 'Brief and to the point' },
          { value: 'visual', label: 'Visual examples and demos' },
          { value: 'interactive', label: 'Interactive tutorials' }
        ],
        allowCustom: false
      },
      {
        id: 'meeting-preference',
        question: "Do you prefer virtual or in-person meetings?",
        inputType: 'yesNoMaybe',
        options: [
          { value: 'virtual', label: 'Virtual' },
          { value: 'in-person', label: 'In-Person' },
          { value: 'hybrid', label: 'Both/Hybrid' }
        ]
      },
      {
        id: 'additional-comments',
        question: "Any additional comments or special requirements?",
        inputType: 'textarea',
        placeholder: 'Share any specific needs, accessibility requirements, or other preferences...',
        rows: 2
      }
    ]
  },
  {
    id: 'iterator-feedback',
    message: "Perfect! You've just completed two multi-question sequences. How was the experience with the iterator component?",
    inputType: 'textarea',
    placeholder: 'Share your feedback about the multi-question iterator - was it smooth, clear, intuitive?...',
    rows: 4
  }
];

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

function DynamicInput({ 
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

  const handlePreview = () => {
    setHasSelectedColors(true);
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
            <div className="space-y-6">
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
                      onChange={(e) => setPrimaryColor(e.target.value)}
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
                      onChange={(e) => setSecondaryColor(e.target.value)}
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

              {/* Preview Section */}
              <div className="p-4 rounded-lg border-2" style={{ 
                borderColor: primaryColor,
                background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)`
              }}>
                <div className="text-center">
                  <h5 className={`font-medium mb-2 ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    Live Preview
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

              {/* Action Buttons */}
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
                  onClick={handlePreview}
                  className="flex-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  Preview Selection
                </Button>
              </div>
            </div>
          )}

          {/* Selected Colors Confirmation View */}
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

              {/* Action Buttons */}
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
                  className="flex-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  Choose
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Full Form Popup Component
interface FullFormPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (answers: Record<string, string>) => void;
  questions: any[];
  initialAnswers: Record<string, string>;
  isDarkMode: boolean;
}

function FullFormPopup({ 
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

export default function TestUIPage() {
  const [useMockData, setUseMockData] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [historyPanelSide, setHistoryPanelSide] = useState<'left' | 'right'>('left');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(7);
  const [lastAIMessage, setLastAIMessage] = useState("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPickerPopup, setShowColorPickerPopup] = useState(false);
  
  // Behavior tracking state
  const [responseStartTime, setResponseStartTime] = useState<number>(Date.now());
  const [behaviorTracker, setBehaviorTracker] = useState<any>(null);
  
  // Workflow selection state
  const [useIteratorTest, setUseIteratorTest] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<any[]>(mockWorkflow);
  
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
  
  // Conversation history tracking
  const [conversationHistory, setConversationHistory] = useState<Array<{
    step: number;
    questionIndex: number;
    questionId: string;
    isMultiPart: boolean;
    multiPartIndex?: number;
  }>>([]);
  const [isEditingPrevious, setIsEditingPrevious] = useState(false);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editingOverlayFadingOut, setEditingOverlayFadingOut] = useState(false);
  
  // Dynamic question history for AI workflow
  const [questionHistory, setQuestionHistory] = useState<Array<{
    id: string;
    message: string;
    inputType: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    allowCustom?: boolean;
    maxSelections?: number;
    suggestions?: string[];
    questions?: any[]; // for multiPart
  }>>([]);
  
  // Custom colors state
  const [customColors, setCustomColors] = useState<Array<{
    value: string;
    label: string;
    colors: string[];
  }>>([]);
  
  // Full form popup state
  const [showFullFormPopup, setShowFullFormPopup] = useState(false);
  const [fullFormAnswers, setFullFormAnswers] = useState<Record<string, string>>({});
  
  // Transition state for fade effects
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionOpacity, setTransitionOpacity] = useState(1);
  
  // Tool data for canvas
  const [toolData, setToolData] = useState<any>({
    title: 'Business Calculator',
    description: 'Calculate your business metrics',
    colorScheme: 'professional-blue',
    inputs: [],
    outputFormat: ['percentage']
  });

  // AI-generated Product Tool Definition state
  const [productToolDefinition, setProductToolDefinition] = useState<ProductToolDefinition | null>(null);
  const [isGeneratingTool, setIsGeneratingTool] = useState(false);
  
  // NEW: Brainstorming streaming state
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [brainstormingThoughts, setBrainstormingThoughts] = useState<Array<{
    type: 'partial' | 'complete' | 'error';
    data: any;
    timestamp: number;
    message?: string; // Add optional message property for error types
  }>>([]);
  const [latestBrainstormingResult, setLatestBrainstormingResult] = useState<any>(null);
  const [showBrainstormingPanel, setShowBrainstormingPanel] = useState(false);
  
  // NEW: Local storage state for saved logic results and tools
  const [savedLogicResults, setSavedLogicResults] = useState<SavedLogicResult[]>([]);
  const [savedTools, setSavedTools] = useState<SavedTool[]>([]);
  const [showLogicSelect, setShowLogicSelect] = useState(false);
  const [showToolsSelect, setShowToolsSelect] = useState(false);

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

  // Initialize with first mock question
  useEffect(() => {
    console.log('🔧 Initial setup useEffect triggered:', { useMockData, questionQueueLength: questionQueue.length });
    if (useMockData && questionQueue.length === 0) {
      console.log('🔧 Initializing with first mock question');
      setQuestionQueue([currentWorkflow[0]]);
      setCurrentQuestionIndex(0);
      // Also add to question history for consistent editing
      setQuestionHistory([currentWorkflow[0]]);
    }
    // Note: Removed the AI mode clearing logic to prevent circular dependency
    // AI responses should be allowed to set questionQueue without interference
  }, [useMockData, currentWorkflow]); // Removed questionQueue.length dependency

  // Handle mode switching - clear queue when switching to AI mode
  /* DISABLED: This useEffect was clearing AI-generated questions
  useEffect(() => {
    console.log('🔧 Mode switch detected, clearing queue for AI mode');
    if (!useMockData) {
      setQuestionQueue([]);
      setCurrentQuestionIndex(0);
      setCurrentInput('');
    }
  }, [useMockData]); // Only trigger when useMockData changes
  */

  // Handle workflow switching
  useEffect(() => {
    const newWorkflow = useIteratorTest ? iteratorTestWorkflow : mockWorkflow;
    setCurrentWorkflow(newWorkflow);
    
    // Update the welcome message based on workflow
    if (useIteratorTest) {
      setLastAIMessage("Welcome to the Multi-Question Iterator Test! This will help us test the iterator component with various question sequences.");
      setTotalSteps(iteratorTestWorkflow.length);
    } else {
      setLastAIMessage("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
      setTotalSteps(mockWorkflow.length);
    }
  }, [useIteratorTest]);

  const currentQuestion = isInMultiPart 
    ? multiPartQuestions[multiPartIndex] || null 
    : questionQueue[currentQuestionIndex] || null;

  // Debug logging for question state
  useEffect(() => {
    console.log('🔧 Question state updated:', {
      isInMultiPart,
      multiPartQuestionsLength: multiPartQuestions.length,
      multiPartIndex,
      questionQueueLength: questionQueue.length,
      currentQuestionIndex,
      currentQuestion: currentQuestion ? { id: currentQuestion.id, inputType: currentQuestion.inputType } : null
    });
  }, [isInMultiPart, multiPartQuestions, multiPartIndex, questionQueue, currentQuestionIndex, currentQuestion]);

  // Debug logging specifically for questionQueue changes
  useEffect(() => {
    console.log('🔧 questionQueue changed:', questionQueue.length, questionQueue.map(q => ({ id: q.id, inputType: q.inputType })));
  }, [questionQueue]);

  // Helper function to handle smooth transitions between questions
  const transitionToNewContent = async (updateFunction: () => void) => {
    setIsTransitioning(true);
    setTransitionOpacity(0); // Fade out
    
    // Wait for fade out to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Update content while invisible
    updateFunction();
    
    // Fade back in
    setTimeout(() => {
      setTransitionOpacity(1);
      setIsTransitioning(false);
    }, 50);
  };

  // Helper function to handle streaming AI responses
  const handleStreamingAIRequest = async (requestBody: any) => {
    try {
      const response = await fetch('/api/ai/test-ui', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // Check if it's a streaming response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let partialMessage = '';

        if (!reader) throw new Error('No response reader available');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'partial' && data.data) {
                  // Update AI message with partial response
                  if (data.data.message) {
                    partialMessage = data.data.message;
                    setLastAIMessage(partialMessage + '...');
                  }
                } else if (data.type === 'complete') {
                  // Final response
                  return data;
                } else if (data.type === 'error') {
                  throw new Error(data.message || 'Streaming failed');
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', line);
              }
            }
          }
        }
      } else {
        // Fallback to regular JSON response (for test commands)
        return await response.json();
      }
    } catch (error) {
      console.error('Streaming request failed:', error);
      throw error;
    }
  };

  const handleInputSubmit = async () => {
    if (!currentInput.trim() && !currentQuestion) return;

    // Track the interaction before processing
    const tracker = getBehaviorTracker();
    if (tracker && currentQuestion) {
      const questionId = isInMultiPart 
        ? multiPartQuestions[multiPartIndex]?.id 
        : currentQuestion.id;
      
      // Determine if user used suggestions or custom input
      const usedSuggestions = currentQuestion.options?.some((opt: any) => opt.value === currentInput) || false;
      const usedCustomInput = currentQuestion.allowCustom && !usedSuggestions;
      
      tracker.trackQuestionResponse({
        questionId: questionId || 'unknown',
        questionType: isInMultiPart 
          ? multiPartQuestions[multiPartIndex]?.inputType 
          : currentQuestion.inputType,
        userResponse: currentInput,
        responseStartTime,
        currentStep,
        totalSteps,
        workflowType: useIteratorTest ? 'iterator_test' : useMockData ? 'standard' : 'ai_mode',
        isMultiPart: isInMultiPart,
        usedSuggestions,
        usedCustomInput
      });
    }

    setIsLoading(true);

    try {
      if (isInMultiPart) {
        // Handle multi-part question flow
        const questionId = currentQuestion.id;
        const newMultiPartAnswers = { ...multiPartAnswers, [questionId]: currentInput };
        setMultiPartAnswers(newMultiPartAnswers);

        // Track conversation history for multi-part questions
        const conversationState = {
          step: currentStep,
          questionIndex: currentQuestionIndex,
          questionId,
          isMultiPart: true,
          multiPartIndex
        };
        
        // Only add to history if we're not editing (to avoid duplicates)
        if (!isEditingPrevious) {
          setConversationHistory(prev => [...prev, conversationState]);
        } else if (editingTarget === questionId) {
          // If we're editing this specific question, clear subsequent history
          setConversationHistory(prev => {
            const targetIndex = prev.findIndex(state => state.questionId === questionId);
            return targetIndex >= 0 ? prev.slice(0, targetIndex + 1) : prev;
          });
        }

        // Update tool data based on multi-part answer
        updateToolDataFromMultiPart(questionId, currentInput);

        if (multiPartIndex < multiPartQuestions.length - 1) {
          // Move to next multi-part question with transition
          await transitionToNewContent(() => {
            setMultiPartIndex(multiPartIndex + 1);
            setCurrentInput('');
            setLastAIMessage(`Question ${multiPartIndex + 2} of ${multiPartQuestions.length}: ${multiPartQuestions[multiPartIndex + 1].question}`);
          });
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
        
        // Track conversation history for regular questions
        const conversationState = {
          step: currentStep,
          questionIndex: currentQuestionIndex,
          questionId: answerId,
          isMultiPart: false
        };
        
        // Only add to history if we're not editing (to avoid duplicates)
        if (!isEditingPrevious) {
          setConversationHistory(prev => [...prev, conversationState]);
        } else if (editingTarget === answerId) {
          // If we're editing this specific question, clear subsequent history
          setConversationHistory(prev => {
            const targetIndex = prev.findIndex(state => state.questionId === answerId);
            return targetIndex >= 0 ? prev.slice(0, targetIndex + 1) : prev;
          });
        }
        
        // Regular single question
        const newAnswers = { ...collectedAnswers, [answerId]: currentInput };
        setCollectedAnswers(newAnswers);

        // Update tool data based on answer
        updateToolData(answerId, currentInput);

        // Move to next question or complete queue
        if (currentQuestionIndex < questionQueue.length - 1) {
          await transitionToNewContent(() => {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setCurrentInput('');
          });
        } else {
          // Queue complete, process with AI or move to next mock step
          if (useMockData) {
            await processMockWorkflow(newAnswers);
          } else {
            await processWithAI(newAnswers);
            // setQuestionQueue([]); // DISABLED: This was clearing AI-generated questions
            setCurrentQuestionIndex(0);
            setCurrentInput('');
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

      // Clear editing mode after successful submit
      if (isEditingPrevious) {
        // Start fade-out animation
        setEditingOverlayFadingOut(true);
        
        // Clear editing state after animation completes
        setTimeout(() => {
          setIsEditingPrevious(false);
          setEditingTarget(null);
          setEditingOverlayFadingOut(false);
        }, 500); // Match animation duration
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
      
      // Handle both mock workflow IDs and AI-generated IDs
      switch (answerId) {
        case 'tool-type':
          updated.type = value;
          break;
        case 'features-wanted':
        case 'test-feature-selection':
          updated.features = value.split(',');
          break;
        case 'color-scheme':
        case 'test-color-selection':
        case 'color-preference':
        case 'preferred-colors':
          updated.colorScheme = value;
          // Handle AI-generated colors by finding the actual color data
          if (currentQuestion && currentQuestion.options) {
            const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
            if (selectedOption && selectedOption.colors) {
              updated.colorScheme = 'custom';
              updated.customColors = selectedOption.colors;
              console.log('🎨 Applied AI-generated colors:', selectedOption.colors);
            }
          }
          // If it's a custom color from color picker, find the custom color data
          if (value.startsWith('custom-')) {
            const customColor = customColors.find(c => c.value === value);
            if (customColor) {
              updated.colorScheme = 'custom';
              updated.customColors = customColor.colors;
            }
          }
          break;
        case 'confidence-level':
          updated.confidenceLevel = value;
          break;
        case 'business-description':
        case 'test-tool-description':
          updated.businessDescription = value;
          break;
        case 'calculator-title':
        case 'calculator-name':
        case 'test-tool-naming':
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
        default:
          // Smart detection for AI-generated questions
          const lowerAnswerId = answerId.toLowerCase();
          if (lowerAnswerId.includes('color') || lowerAnswerId.includes('palette') || lowerAnswerId.includes('scheme')) {
            updated.colorScheme = value;
            // Handle AI-generated colors by finding the actual color data
            if (currentQuestion && currentQuestion.options) {
              const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
              if (selectedOption && selectedOption.colors) {
                updated.colorScheme = 'custom';
                updated.customColors = selectedOption.colors;
                console.log('🎨 Applied AI-generated colors (smart detection):', selectedOption.colors);
              }
            }
            // Handle custom colors
            if (value.startsWith('custom-')) {
              const customColor = customColors.find(c => c.value === value);
              if (customColor) {
                updated.colorScheme = 'custom';
                updated.customColors = customColor.colors;
              }
            }
          } else if (lowerAnswerId.includes('feature') || lowerAnswerId.includes('capability')) {
            updated.features = value.split(',');
          } else if (lowerAnswerId.includes('name') || lowerAnswerId.includes('title')) {
            updated.title = value;
          } else if (lowerAnswerId.includes('description') || lowerAnswerId.includes('business')) {
            updated.businessDescription = value;
          } else if (lowerAnswerId.includes('type') || lowerAnswerId.includes('category')) {
            updated.type = value;
          }
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
        case 'preferred-colors':
          updated.colorScheme = value;
          // Handle AI-generated colors by finding the actual color data
          if (multiPartQuestions[multiPartIndex] && multiPartQuestions[multiPartIndex].options) {
            const selectedOption = multiPartQuestions[multiPartIndex].options.find((opt: any) => opt.value === value);
            if (selectedOption && selectedOption.colors) {
              updated.colorScheme = 'custom';
              updated.customColors = selectedOption.colors;
              console.log('🎨 Applied AI-generated colors in iterator:', selectedOption.colors);
            }
          }
          // If it's a custom color from color picker, find the custom color data
          if (value.startsWith('custom-')) {
            const customColor = customColors.find(c => c.value === value);
            if (customColor) {
              updated.colorScheme = 'custom';
              updated.customColors = customColor.colors;
            }
          }
          break;
        default:
          // Smart detection for AI-generated questions in iterator
          const lowerQuestionId = questionId.toLowerCase();
          if (lowerQuestionId.includes('color') || lowerQuestionId.includes('palette') || lowerQuestionId.includes('scheme')) {
            updated.colorScheme = value;
            // Handle AI-generated colors by finding the actual color data
            if (multiPartQuestions[multiPartIndex] && multiPartQuestions[multiPartIndex].options) {
              const selectedOption = multiPartQuestions[multiPartIndex].options.find((opt: any) => opt.value === value);
              if (selectedOption && selectedOption.colors) {
                updated.colorScheme = 'custom';
                updated.customColors = selectedOption.colors;
                console.log('🎨 Applied AI-generated colors (smart detection in iterator):', selectedOption.colors);
              }
            }
            // Handle custom colors
            if (value.startsWith('custom-')) {
              const customColor = customColors.find(c => c.value === value);
              if (customColor) {
                updated.colorScheme = 'custom';
                updated.customColors = customColor.colors;
              }
            }
          } else if (lowerQuestionId.includes('feature') || lowerQuestionId.includes('capability')) {
            updated.features = value.split(',');
          } else if (lowerQuestionId.includes('name') || lowerQuestionId.includes('title')) {
            updated.title = value;
          } else if (lowerQuestionId.includes('description') || lowerQuestionId.includes('business')) {
            updated.businessDescription = value;
          } else if (lowerQuestionId.includes('type') || lowerQuestionId.includes('category')) {
            updated.type = value;
          } else if (lowerQuestionId.includes('audience') || lowerQuestionId.includes('target')) {
            updated.targetAudience = value;
          } else if (lowerQuestionId.includes('industry') || lowerQuestionId.includes('sector')) {
            updated.industry = value;
          } else if (lowerQuestionId.includes('metric') || lowerQuestionId.includes('output')) {
            updated.keyMetrics = value.split(',');
          }
          break;
      }
      
      return updated;
    });
  };

  const processMockWorkflow = async (answers: Record<string, string>) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (currentStep < currentWorkflow.length) {
      const nextQuestion = currentWorkflow[currentStep];
      
      // Check if this is a multiPart question and start it immediately
      if (nextQuestion.inputType === 'multiPart') {
        console.log('🔧 DEBUG: Auto-starting multi-part sequence');
        console.log('🔧 DEBUG: Questions:', nextQuestion.questions);
        await transitionToNewContent(() => {
          setIsInMultiPart(true);
          setMultiPartQuestions(nextQuestion.questions || []);
          setMultiPartIndex(0);
          setCurrentInput('');
          setLastAIMessage(`${nextQuestion.message}\n\nQuestion 1 of ${nextQuestion.questions?.length}: ${nextQuestion.questions?.[0]?.question}`);
        });
        
        // Track the multiPart question for editing functionality
        trackQuestion(nextQuestion);
      } else {
        await transitionToNewContent(() => {
          setQuestionQueue([nextQuestion]);
          setCurrentQuestionIndex(0);
          setLastAIMessage(nextQuestion.message);
          setCurrentInput('');
        });
        
        // Track the question for editing functionality
        trackQuestion(nextQuestion);
      }
      
      setCurrentStep(currentStep + 1);
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
      await transitionToNewContent(() => {
        setLastAIMessage("Great question about styling! Let me show you some color options that would work well for your calculator.");
        setQuestionQueue([currentWorkflow.find(q => q.id === 'color-scheme')!]);
        setCurrentQuestionIndex(0);
      });
    } else if (lowerInput.includes('input') || lowerInput.includes('field')) {
      await transitionToNewContent(() => {
        setLastAIMessage("Perfect! Let's define what inputs your users will provide to get their calculations.");
        setQuestionQueue([currentWorkflow.find(q => q.id === 'key-inputs')!]);
        setCurrentQuestionIndex(0);
      });
    } else {
      setLastAIMessage("I understand! The calculator is looking great. You can continue customizing it, or ask me about specific features you'd like to add or modify.");
    }
  };

  const processWithAI = async (answers: Record<string, string>) => {
    try {
      setLastAIMessage("Analyzing your responses and generating personalized suggestions...");
      
      // Extract key information from answers
      const expertise = answers['business-description'] || answers['welcome-iterator'] || 'business tools';
      const toolType = answers['tool-type'] || 'calculator';
      const targetAudience = answers['target-audience'] || answers['role-title'] || 'business professionals';
      const industry = answers['industry-focus'] || 'general business';
      
      // Call the test UI API with streaming support
      const result = await handleStreamingAIRequest({
        userInput: `Based on my responses: ${expertise}. I'm creating a ${toolType} for ${targetAudience} in ${industry}.`,
        conversationHistory: conversationHistory || [],
        collectedAnswers: answers,
        currentStep
      });

      if (result.success && result.response) {
        console.log('🔧 AI API response received:', result.response);
        
        // Check if AI wants to create a tool - use enhanced brainstorming workflow
        if (result.response.toolCreationContext) {
          console.log('🔧 AI requested tool creation, using enhanced brainstorming workflow');
          const toolResult = await createToolWithBrainstorming(result.response.toolCreationContext);
          return; // Exit early since tool creation handles its own flow
        }
        
        const aiQuestion = {
          id: result.response.id || 'ai-freeform-response',
          message: result.response.message,
          inputType: result.response.inputType,
          options: result.response.options,
          placeholder: result.response.placeholder,
          suggestions: result.response.suggestions,
          maxSelections: result.response.maxSelections,
          allowCustom: result.response.allowCustom,
          acceptedFileTypes: result.response.acceptedFileTypes,
          maxFileSize: result.response.maxFileSize,
          questions: result.response.questions
        };
        
        console.log('🔧 About to call handleAIGeneratedQuestion with:', aiQuestion);
        handleAIGeneratedQuestion(aiQuestion);
        
        console.log('AI response processed', { 
          inputType: aiQuestion.inputType,
          hasOptions: !!aiQuestion.options?.length 
        });
        
      } else {
        throw new Error(result.message || 'Failed to get AI response');
      }
      
    } catch (error) {
      console.error('Error in AI processing:', error);
      setLastAIMessage(`AI processing encountered an issue: ${error instanceof Error ? error.message : 'Unknown error'}. Let me help you manually.`);
      
      // Fallback to manual question
      const fallbackQuestion = {
        id: 'manual-fallback',
        message: "Let's continue building your tool. What specific features or calculations should your tool include?",
        inputType: 'textarea',
        placeholder: 'Describe the features, calculations, or functionality you want...',
        rows: 4
      };
      
      handleAIGeneratedQuestion(fallbackQuestion);
    }
  };

  const handleAIFreeformInput = async (input: string) => {
    try {
      console.log('🔧 handleAIFreeformInput called with input:', input);
      setLastAIMessage("Thinking about your question...");
      
      // Call the test UI API with current context
      const requestBody = {
        userInput: input,
        conversationHistory: conversationHistory || [],
        collectedAnswers,
        currentStep
      };
      
      console.log('🔧 Sending request to API:', requestBody);
      
      // Use streaming request for real-time feedback
      const result = await handleStreamingAIRequest(requestBody);

      if (result.success && result.response) {
        // Check if AI wants to create a tool - use enhanced brainstorming workflow
        if (result.response.toolCreationContext) {
          console.log('🔧 AI requested tool creation, using enhanced brainstorming workflow');
          const toolResult = await createToolWithBrainstorming(result.response.toolCreationContext);
          return; // Exit early since tool creation handles its own flow
        }
        
        const aiQuestion = {
          id: result.response.id || 'ai-freeform-response',
          message: result.response.message,
          inputType: result.response.inputType,
          options: result.response.options,
          placeholder: result.response.placeholder,
          suggestions: result.response.suggestions,
          maxSelections: result.response.maxSelections,
          allowCustom: result.response.allowCustom,
          acceptedFileTypes: result.response.acceptedFileTypes,
          maxFileSize: result.response.maxFileSize,
          questions: result.response.questions
        };
        
        handleAIGeneratedQuestion(aiQuestion);
        
        console.log('AI freeform response processed', { 
          inputType: aiQuestion.inputType,
          isTestCommand: result.isTestCommand,
          detectedCommand: result.detectedCommand
        });
        
      } else {
        throw new Error(result.message || 'Failed to get AI response');
      }
      
    } catch (error) {
      console.error('Error in AI freeform input:', error);
      setLastAIMessage(`I encountered an issue: ${error instanceof Error ? error.message : 'Unknown error'}. Let me help you continue building your tool.`);
      
      // Fallback question
      const fallbackQuestion = {
        id: 'ai-freeform-fallback',
        message: "What would you like to focus on for your tool?",
        inputType: 'textarea',
        placeholder: 'Tell me what you\'d like to work on next for your business tool...',
        rows: 3
      };
      
      handleAIGeneratedQuestion(fallbackQuestion);
    }
  };

  const handleColorPickerSubmit = (primaryColor: string, secondaryColor: string) => {
    // Generate custom color entry
    const customColorNumber = customColors.length + 1;
    const customColorEntry = {
      value: `custom-${customColorNumber}`,
      label: `Custom${customColorNumber}`,
      colors: [primaryColor, secondaryColor]
    };
    
    // Add to custom colors array
    setCustomColors(prev => [...prev, customColorEntry]);
    
    // Update tool data with custom colors
    setToolData((prev: any) => ({
      ...prev,
      colorScheme: 'custom',
      customColors: [primaryColor, secondaryColor]
    }));
    
    // Set the current input value but don't advance the workflow
    setCurrentInput(customColorEntry.value);
    
    // Don't call processMockWorkflow here - let the user click "Choose" to advance
  };

  const resetWorkflow = () => {
    setCurrentStep(1);
    setQuestionQueue([currentWorkflow[0]]);
    setCurrentQuestionIndex(0);
    setCurrentInput('');
    setCollectedAnswers({});
    setCustomColors([]);
    setConversationHistory([]);
    setIsEditingPrevious(false);
    setEditingTarget(null);
    setEditingOverlayFadingOut(false);
    setQuestionHistory([currentWorkflow[0]]); // Reset and start with first question
    
    // Set appropriate welcome message based on workflow
    if (useIteratorTest) {
      setLastAIMessage("Welcome to the Multi-Question Iterator Test! This will help us test the iterator component with various question sequences.");
    } else {
      setLastAIMessage("Welcome! Let's create your perfect lead magnet calculator. I'll guide you through each step with smart suggestions to make this quick and easy.");
    }
    
    setToolData({
      title: 'Business Calculator',
      description: 'Calculate your business metrics',
      colorScheme: 'professional-blue',
      inputs: [],
      outputFormat: ['percentage']
    });
  };

  const handleAnswerUpdate = (questionId: string, newValue: string) => {
    // Track edit behavior
    const tracker = getBehaviorTracker();
    if (tracker) {
      tracker.trackEdit(questionId, newValue);
    }

    // Find the original question from either AI history or mock workflow
    let originalQuestion = questionHistory.find(q => q.id === questionId);
    if (!originalQuestion) {
      // Fallback to mock workflow if not found in AI history
      originalQuestion = currentWorkflow.find(q => q.id === questionId);
    }
    
    if (!originalQuestion) {
      console.error(`Could not find original question for ${questionId}`);
      return;
    }
    
    // Set editing mode and show overlay
    setIsEditingPrevious(true);
    setEditingTarget(questionId);
    setEditingOverlayFadingOut(false);
    
    // Restore the original question state
    setQuestionQueue([originalQuestion]);
    setCurrentQuestionIndex(0);
    
    // Set the current input to the existing value for editing
    setCurrentInput(newValue);
    
    // Update the answer and tool data (keep existing data)
    setCollectedAnswers(prev => ({
      ...prev,
      [questionId]: newValue
    }));
    updateToolData(questionId, newValue);
    
    // Show feedback message
    setLastAIMessage(`Editing your answer for "${questionId.replace(/-/g, ' ')}". Make your changes below and submit to continue.`);
  };

  // Helper function to switch to chat mode
  const handleSwitchToChat = () => {
    // Track workflow choice
    const tracker = getBehaviorTracker();
    if (tracker) {
      tracker.trackChatMode();
    }

    // Clear current input and question queue to enable freeform chat
    setCurrentInput('');
    setQuestionQueue([]);
    setCurrentQuestionIndex(0);
    
    // Update AI message to indicate chat mode
    setLastAIMessage("Great! I'm here to chat. Ask me anything about your tool, or tell me what you'd like to work on next.");
    
    // Exit multi-part mode if active
    if (isInMultiPart) {
      setIsInMultiPart(false);
      setMultiPartQuestions([]);
      setMultiPartIndex(0);
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  // Helper function to track questions for editing
  const trackQuestion = (question: any) => {
    setQuestionHistory(prev => {
      // Avoid duplicates
      const exists = prev.find(q => q.id === question.id);
      if (exists) return prev;
      return [...prev, question];
    });
  };

  // TODO: For AI Integration - call this when LLM generates new questions
  const handleAIGeneratedQuestion = (aiQuestion: {
    id: string;
    message: string;
    inputType: string;
    options?: any[];
    placeholder?: string;
    allowCustom?: boolean;
    maxSelections?: number;
    suggestions?: string[];
    acceptedFileTypes?: string[];
    maxFileSize?: string;
    questions?: any[];
  }) => {
    console.log('🔧 handleAIGeneratedQuestion called with:', aiQuestion);
    
    // Track AI question for editing functionality
    trackQuestion(aiQuestion);
    
    // Check if this is a multiPart question
    if (aiQuestion.inputType === 'multiPart' && aiQuestion.questions && aiQuestion.questions.length > 0) {
      console.log('🔧 Setting up multiPart question with', aiQuestion.questions.length, 'questions');
      // Set up multi-part state with transition
      transitionToNewContent(() => {
        setIsInMultiPart(true);
        setMultiPartQuestions(aiQuestion.questions!);
        setMultiPartIndex(0);
        setCurrentInput('');
        setLastAIMessage(`${aiQuestion.message}\n\nQuestion 1 of ${aiQuestion.questions!.length}: ${aiQuestion.questions![0].question}`);
      });
    } else {
      console.log('🔧 Setting up regular question:', aiQuestion.inputType);
      // Regular single question with transition
      console.log('🔧 About to set questionQueue with:', aiQuestion);
      transitionToNewContent(() => {
        setQuestionQueue([aiQuestion]);
        setCurrentQuestionIndex(0);
        setLastAIMessage(aiQuestion.message);
        setCurrentInput('');
      });
      console.log('🔧 After setting questionQueue with transition');
    }
  };

  // Initialize behavior tracker with user ID (in real app, get from Clerk)
  useEffect(() => {
    const userId = 'demo_user_' + Math.random().toString(36).substr(2, 9); // Mock user ID
    const tracker = initBehaviorTracker(userId);
    setBehaviorTracker(tracker);
    
    // Get adaptive suggestions and apply them
    const suggestions = tracker.getAdaptiveSuggestions();
    console.log('🧠 Adaptive suggestions loaded:', suggestions);
    
    // In a real implementation, you'd use these suggestions to:
    // - Adjust the workflow based on preferQuickMode
    // - Show/hide advanced options based on showAdvancedOptions
    // - Customize question types based on suggestedQuestionTypes
    // - Adjust complexity based on recommendedComplexity
    
  }, []);

  // Initialize localStorage data
  useEffect(() => {
    setSavedLogicResults(getSavedLogicResults());
    setSavedTools(getSavedTools());
  }, []);

  // Track when a question becomes active (user starts responding)
  useEffect(() => {
    if (currentQuestion || isInMultiPart) {
      setResponseStartTime(Date.now());
    }
  }, [currentQuestion, isInMultiPart, multiPartIndex]);

  // NEW: Enhanced Tool Creation Functions for Logic Architect Integration
  const callToolCreationAgent = async (context: any, productToolDefinition?: ProductToolDefinition) => {
    console.log('🛠️ Calling Tool Creation Agent...');
    setIsGeneratingTool(true);
    
    try {
      const response = await fetch('/api/ai/create-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIntent: context.userIntent || 'Create a business calculator',
          context: {
            targetAudience: context.targetAudience || 'business professionals',
            industry: context.industry || '',
            toolType: context.toolType || 'calculator',
            features: context.features || [],
            businessDescription: context.businessDescription || '',
            colors: context.colors || [],
            collectedAnswers: context.collectedAnswers || {},
            brandAnalysis: context.brandAnalysis,
            conversationHistory: context.conversationHistory || [],
            selectedWorkflow: context.selectedWorkflow || [],
            uploadedFiles: context.uploadedFiles || [],
            brainstormingResult: context.brainstormingResult || latestBrainstormingResult,
            logicArchitectInsights: context.logicArchitectInsights || latestBrainstormingResult
          },
          existingTool: productToolDefinition,
          updateType: context.updateType || 'general'
        }),
      });

      const result = await response.json();
      
      if (result.success && result.tool) {
        console.log('✅ Tool Creation Agent completed successfully');
        setProductToolDefinition(result.tool);
        
        // Save to localStorage for development
        saveCreatedTool(result.tool);
        
        // Update saved tools list
        setSavedTools(getSavedTools());
        
        return result.tool;
      } else {
        throw new Error(result.message || 'Tool creation failed');
      }
    } catch (error) {
      console.error('❌ Tool Creation Agent error:', error);
      throw error;
    } finally {
      setIsGeneratingTool(false);
    }
  };

  const createToolWithBrainstorming = async (context: any) => {
    console.log('🧠 Starting tool creation with brainstorming...');
    
    try {
      // Show brainstorming panel
      setShowBrainstormingPanel(true);
      setIsBrainstorming(true);
      setBrainstormingThoughts([]);
      setLastAIMessage('🧠 Let me brainstorm some creative ideas for your tool...');
      
      // Step 1: Logic Architect Brainstorming with Streaming
      const brainstormingResponse = await fetch('/api/ai/logic-architect/brainstorm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolType: context.toolType || 'calculator',
          targetAudience: context.targetAudience || 'business professionals', 
          industry: context.industry || '',
          businessDescription: context.businessDescription || '',
          availableData: {
            collectedAnswers: context.collectedAnswers || {},
            features: context.features || [],
            colors: context.colors || [],
            brandAnalysis: context.brandAnalysis,
            uploadedFiles: context.uploadedFiles,
            conversationHistory: context.conversationHistory
          }
        }),
      });

      // Handle streaming brainstorming response
      if (brainstormingResponse.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = brainstormingResponse.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (!reader) throw new Error('No brainstorming reader available');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                // Add thought to panel
                setBrainstormingThoughts(prev => [...prev, {
                  type: data.type,
                  data: data.data,
                  timestamp: Date.now()
                }]);
                
                if (data.type === 'complete') {
                  console.log('🧠 Logic Architect brainstorming complete:', data.data);
                  setLatestBrainstormingResult(data.data);
                  
                  // Save logic result to localStorage
                  saveLogicResult(
                    context.toolType || 'calculator',
                    context.targetAudience || 'business professionals',
                    context.industry,
                    data.data
                  );
                  
                  // Update saved logic results list
                  setSavedLogicResults(getSavedLogicResults());
                  
                  // Update context with brainstorming results
                  context.brainstormingResult = data.data;
                  context.logicArchitectInsights = data.data;
                  break;
                }
              } catch (parseError) {
                console.warn('Failed to parse brainstorming data:', line);
              }
            }
          }
        }
      } else {
        // Non-streaming fallback
        const brainstormingData = await brainstormingResponse.json();
        if (brainstormingData.success) {
          setLatestBrainstormingResult(brainstormingData.result);
          context.brainstormingResult = brainstormingData.result;
          context.logicArchitectInsights = brainstormingData.result;
          
          // Save logic result
          saveLogicResult(
            context.toolType || 'calculator',
            context.targetAudience || 'business professionals',
            context.industry,
            brainstormingData.result
          );
          setSavedLogicResults(getSavedLogicResults());
        }
      }
      
      setIsBrainstorming(false);
      setLastAIMessage('✨ Great! I\'ve got some amazing ideas. Now let me create your tool...');
      
      // Step 2: Call Tool Creation Agent with enriched context
      setLastAIMessage('🛠️ Creating your tool with the brainstormed ideas...');
      const tool = await callToolCreationAgent(context);
      
      setLastAIMessage(`🎉 Your "${tool.metadata.title}" is ready! Check out the preview and let me know if you'd like any adjustments.`);
      
      return tool;
      
    } catch (error) {
      console.error('❌ Tool creation with brainstorming failed:', error);
      setIsBrainstorming(false);
      setIsGeneratingTool(false);
      setLastAIMessage(`Sorry, there was an error creating your tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  return (
    <div className={`h-screen flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Progress Header */}
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
              {useMockData ? 'Mock Mode' : 'AI Mode'} • {useIteratorTest ? 'Iterator Test' : 'Standard'}
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
                    <button
                      onClick={() => {
                        setUseIteratorTest(!useIteratorTest);
                        resetWorkflow();
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {useIteratorTest ? 'Standard Workflow' : 'Iterator Test Workflow'}
                    </button>
                    <div className={`border-t my-2 mx-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
                    <button
                      onClick={() => {
                        setHistoryPanelSide(historyPanelSide === 'left' ? 'right' : 'left');
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      {historyPanelSide === 'left' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      History Panel: {historyPanelSide === 'left' ? 'Left Side' : 'Right Side'}
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
                    <div className={`border-t my-2 mx-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
                    <div className="px-4 py-2">
                      <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Test API Commands
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        setShowOptionsMenu(false);
                        if (!useMockData) {
                          setCurrentInput('send a test multi-input');
                          await handleAIFreeformInput('send a test multi-input');
                        } else {
                          setLastAIMessage('Switch to AI Mode to test API commands!');
                        }
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Test Multi-Part Questions
                    </button>
                    <button
                      onClick={async () => {
                        setShowOptionsMenu(false);
                        if (!useMockData) {
                          setCurrentInput('send a test image-upload');
                          await handleAIFreeformInput('send a test image-upload');
                        } else {
                          setLastAIMessage('Switch to AI Mode to test API commands!');
                        }
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <Palette className="h-4 w-4" />
                      Test File Upload
                    </button>
                    <button
                      onClick={async () => {
                        setShowOptionsMenu(false);
                        if (!useMockData) {
                          setCurrentInput('send a test color-picker');
                          await handleAIFreeformInput('send a test color-picker');
                        } else {
                          setLastAIMessage('Switch to AI Mode to test API commands!');
                        }
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <Palette className="h-4 w-4" />
                      Test Color Picker
                    </button>
                    <div className={`border-t my-2 mx-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
                    <div className="px-4 py-2">
                      <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        NEW: Tool Creation & Logic Architect
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        setShowOptionsMenu(false);
                        try {
                          const testContext = {
                            userIntent: 'Create a marketing ROI calculator',
                            toolType: 'calculator',
                            targetAudience: 'small business owners',
                            industry: 'marketing',
                            businessDescription: 'Help businesses track their marketing investment returns'
                          };
                          await createToolWithBrainstorming(testContext);
                        } catch (error) {
                          console.error('Test brainstorming failed:', error);
                        }
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <Brain className="h-4 w-4" />
                      Test Logic Architect Brainstorming
                    </button>
                    <button
                      onClick={async () => {
                        setShowOptionsMenu(false);
                        try {
                          const testContext = {
                            userIntent: 'Create a business assessment tool',
                            toolType: 'assessment',
                            targetAudience: 'entrepreneurs',
                            industry: 'general business',
                            features: ['scoring', 'recommendations', 'export'],
                            businessDescription: 'Comprehensive business readiness assessment'
                          };
                          await callToolCreationAgent(testContext);
                        } catch (error) {
                          console.error('Test tool creation failed:', error);
                        }
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <Zap className="h-4 w-4" />
                      Test Tool Creation Agent
                    </button>
                    <div className={`border-t my-2 mx-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
                    <div className="px-4 py-2">
                      <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Saved Data Management
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        setShowLogicSelect(true);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <History className="h-4 w-4" />
                      View Saved Logic Results ({savedLogicResults.length})
                    </button>
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        setShowToolsSelect(true);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors rounded-lg mx-2 ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-50' : 'hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <Calculator className="h-4 w-4" />
                      View Saved Tools ({savedTools.length})
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

      {/* Main Content - Canvas with Fixed Bottom */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* History Panel Tab */}
        {!showHistoryPanel && (
          <button
            onClick={() => setShowHistoryPanel(true)}
            className={`
              absolute top-1/2 transform -translate-y-1/2 z-30
              ${historyPanelSide === 'left' ? 'left-0' : 'right-0'}
              ${isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              }
              border shadow-lg transition-all duration-200 hover:shadow-xl
              ${historyPanelSide === 'left' 
                ? 'rounded-r-lg border-l-0 pl-2 pr-3' 
                : 'rounded-l-lg border-r-0 pr-2 pl-3'
              }
              py-3 flex items-center gap-2 text-sm font-medium
            `}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
            {historyPanelSide === 'left' ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </button>
        )}

        {/* Canvas Tool Section - Scrollable */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Editing Mode Overlay */}
          {isEditingPrevious && editingTarget && (
            <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-40 
              ${editingOverlayFadingOut 
                ? 'animate-out fade-out slide-out-to-top-2 duration-500' 
                : 'animate-in fade-in duration-500 slide-in-from-top-2'
              }
              ${isDarkMode 
                ? 'bg-orange-900/90 border-orange-600 text-orange-100' 
                : 'bg-orange-100/95 border-orange-400 text-orange-800'
              }
              border rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm
            `}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Edit3 className="h-4 w-4" />
                <span>Editing: {editingTarget.replace(/-/g, ' ')}</span>
              </div>
            </div>
          )}

          <CanvasTool 
            toolData={toolData} 
            colorScheme={toolData.colorScheme || 'professional-blue'}
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Bottom Section - AI Assistant and Input Side by Side */}
        <div className={` border-t flex-shrink-0 grid grid-cols-1 lg:grid-cols-2 transition-all duration-300 ease-in-out min-h-[280px] ${
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
              {/* Show loading state when agent is building response */}
              {isLoading && !currentQuestion && !isInMultiPart ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className={`flex flex-col items-center gap-3 text-center ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">Building response...</span>
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      AI is generating your next question
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
                        onChange={setCurrentInput}
                        onSubmit={handleInputSubmit}
                        isLoading={isLoading}
                        isDarkMode={isDarkMode}
                        onOpenColorPicker={() => setShowColorPickerPopup(true)}
                        onPreviewUpdate={(questionId, value) => {
                          // Enhanced preview update for live color changes in iterator
                          const currentQuestion = multiPartQuestions[multiPartIndex];
                          if (currentQuestion && currentQuestion.options) {
                            const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
                            if (selectedOption && selectedOption.colors) {
                              // For AI-generated colors, update with actual hex values
                              setToolData((prev: any) => ({
                                ...prev,
                                colorScheme: 'custom',
                                customColors: selectedOption.colors
                              }));
                              console.log('🎨 Iterator live preview update with AI colors:', selectedOption.colors);
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
                          onClick={() => {
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
                          }}
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
                      onChange={setCurrentInput}
                      onSubmit={handleInputSubmit}
                      isLoading={isLoading}
                      isDarkMode={isDarkMode}
                      onOpenColorPicker={() => setShowColorPickerPopup(true)}
                      onPreviewUpdate={(questionId, value) => {
                        // Enhanced preview update for live color changes
                        if (currentQuestion && currentQuestion.options) {
                          const selectedOption = currentQuestion.options.find((opt: any) => opt.value === value);
                          if (selectedOption && selectedOption.colors) {
                            // For AI-generated colors, update with actual hex values
                            setToolData((prev: any) => ({
                              ...prev,
                              colorScheme: 'custom',
                              customColors: selectedOption.colors
                            }));
                            console.log('🎨 Live preview update with AI colors:', selectedOption.colors);
                            return;
                          }
                        }
                        // Fallback to standard update for predefined colors
                        updateToolData(questionId, value);
                      }}
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
      </div>

      {/* Input History Panel */}
      <InputHistory
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        side={historyPanelSide}
        answers={collectedAnswers}
        questionHistory={questionHistory}
        onAnswerUpdate={handleAnswerUpdate}
        isDarkMode={isDarkMode}
      />

      {/* Color Picker Popup */}
      <ColorPickerPopup
        isOpen={showColorPickerPopup}
        onClose={() => setShowColorPickerPopup(false)}
        onSubmit={handleColorPickerSubmit}
        isDarkMode={isDarkMode}
      />

      {/* Full Form Popup */}
      <FullFormPopup
        isOpen={showFullFormPopup}
        onClose={() => setShowFullFormPopup(false)}
        onSubmit={async (answers) => {
          // Handle full form submission - same as completing iterator sequence
          console.log('Full form submitted:', answers);
          
          // Set the answers and complete the multi-part sequence
          setMultiPartAnswers(answers);
          
          // Store all multi-part answers as a single answer for main workflow
          const mainQuestionId = questionQueue[currentQuestionIndex]?.id || 'multi-part-unknown';
          const newCollectedAnswers = { ...collectedAnswers, [mainQuestionId]: JSON.stringify(answers) };
          setCollectedAnswers(newCollectedAnswers);
          
          // Exit multi-part mode and continue workflow
          setIsInMultiPart(false);
          setMultiPartQuestions([]);
          setMultiPartIndex(0);
          setCurrentInput('');
          
          // Continue with main workflow
          await processMockWorkflow(newCollectedAnswers);
          
          setShowFullFormPopup(false);
        }}
        questions={multiPartQuestions}
        initialAnswers={fullFormAnswers}
        isDarkMode={isDarkMode}
      />

      {/* Behavior Learning Dashboard */}
      <div className="z-40">
        {/* Add your behavior learning dashboard component here */}
      </div>

      {/* NEW: Brainstorming Panel */}
      {showBrainstormingPanel && (
        <div className={`fixed top-4 right-4 w-80 max-h-96 rounded-xl shadow-2xl border z-50 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-gray-50' : 'text-gray-900'
            }`}>
              🧠 Logic Architect
            </h3>
            <button
              onClick={() => setShowBrainstormingPanel(false)}
              className={`p-1 rounded hover:bg-gray-100 ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
              }`}
              aria-label="Close brainstorming panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto max-h-80">
            {isBrainstorming && (
              <div className={`mb-4 text-center ${
                isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
              }`}>
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                <p className="text-sm font-medium">Brainstorming ideas...</p>
              </div>
            )}
            
            {brainstormingThoughts.length === 0 && !isBrainstorming ? (
              <div className={`text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No brainstorming session yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {brainstormingThoughts.map((thought, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      thought.type === 'error' 
                        ? isDarkMode 
                          ? 'border-red-600 bg-red-900/20' 
                          : 'border-red-300 bg-red-50'
                        : thought.type === 'complete'
                        ? isDarkMode 
                          ? 'border-green-600 bg-green-900/20' 
                          : 'border-green-300 bg-green-50'
                        : isDarkMode 
                          ? 'border-gray-600 bg-gray-700/30' 
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-1">
                        {thought.type === 'error' ? (
                          <X className="h-4 w-4 text-red-500" />
                        ) : thought.type === 'complete' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-700'
                        }`}>
                          {thought.type === 'error' && thought.message 
                            ? thought.message 
                            : typeof thought.data === 'string' 
                              ? thought.data 
                              : JSON.stringify(thought.data, null, 2)
                          }
                        </p>
                        <p className={`text-xs mt-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {new Date(thought.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW: Saved Logic Results Panel */}
      {showLogicSelect && (
        <div className={`fixed top-4 right-4 w-80 max-h-96 rounded-xl shadow-2xl border z-50 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-gray-50' : 'text-gray-900'
            }`}>
              💾 Saved Logic Results
            </h3>
            <button
              onClick={() => setShowLogicSelect(false)}
              className={`p-1 rounded hover:bg-gray-100 ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
              }`}
              aria-label="Close saved logic results panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto max-h-80">
            {savedLogicResults.length === 0 ? (
              <div className={`text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No saved logic results yet</p>
                <p className="text-xs mt-1">Test the Logic Architect to see results here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedLogicResults.map((result) => (
                  <div
                    key={result.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700/30 hover:bg-gray-700/50' 
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      console.log('Loading saved logic result:', result);
                      setLatestBrainstormingResult(result.result);
                      setShowLogicSelect(false);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                          {result.toolType} for {result.targetAudience}
                        </h4>
                        {result.industry && (
                          <p className={`text-xs ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            Industry: {result.industry}
                          </p>
                        )}
                        <p className={`text-xs ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {result.date}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Load
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW: Saved Tools Panel */}
      {showToolsSelect && (
        <div className={`fixed top-4 right-4 w-80 max-h-96 rounded-xl shadow-2xl border z-50 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          <div className={`flex items-center justify-between p-4 border-b ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold ${
              isDarkMode ? 'text-gray-50' : 'text-gray-900'
            }`}>
              🛠️ Saved Tools
            </h3>
            <button
              onClick={() => setShowToolsSelect(false)}
              className={`p-1 rounded hover:bg-gray-100 ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'text-gray-500'
              }`}
              aria-label="Close saved tools panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto max-h-80">
            {savedTools.length === 0 ? (
              <div className={`text-center ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No saved tools yet</p>
                <p className="text-xs mt-1">Create tools to see them saved here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedTools.map((savedTool) => (
                  <div
                    key={savedTool.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700/30 hover:bg-gray-700/50' 
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      console.log('Loading saved tool:', savedTool.tool);
                      setProductToolDefinition(savedTool.tool);
                      setShowToolsSelect(false);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                          {savedTool.title}
                        </h4>
                        <p className={`text-xs ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {savedTool.tool.metadata.description?.slice(0, 60)}...
                        </p>
                        <p className={`text-xs ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {savedTool.date}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Load
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
