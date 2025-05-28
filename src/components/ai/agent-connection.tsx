'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  MessageCircle, 
  Upload, 
  Palette, 
  Sparkles, 
  Eye,
  Send,
  Loader2,
  RefreshCw,
  X
} from 'lucide-react';
import { MagicSparkAgent } from '@/lib/ai/agents/magic-spark';
import { VisualComponentFactory } from '@/components/ai/visual-components';



// Mock data for testing when AI is not available
const mockBrandAnalyses = {
  techStartup: {
    colors: [
      { hex: '#2563eb', name: 'Primary Blue', usage: 'primary', confidence: 0.9 },
      { hex: '#64748b', name: 'Slate Gray', usage: 'secondary', confidence: 0.8 },
      { hex: '#f8fafc', name: 'Light Gray', usage: 'neutral', confidence: 0.7 }
    ],
    personality: ['innovative', 'trustworthy', 'modern', 'professional'],
    style: 'modern',
    typography: {
      suggestedFonts: ['Inter', 'Roboto', 'Open Sans'],
      style: 'sans-serif'
    },
    recommendations: ['Focus on clean, modern design', 'Use consistent blue theme', 'Emphasize innovation'],
    confidence: 0.85
  },
  
  consultingFirm: {
    colors: [
      { hex: '#1e40af', name: 'Navy Blue', usage: 'primary', confidence: 0.9 },
      { hex: '#374151', name: 'Charcoal', usage: 'secondary', confidence: 0.8 },
      { hex: '#f3f4f6', name: 'Light Gray', usage: 'neutral', confidence: 0.7 }
    ],
    personality: ['professional', 'authoritative', 'reliable', 'sophisticated'],
    style: 'classic',
    typography: {
      suggestedFonts: ['Merriweather', 'Playfair Display', 'Source Serif Pro'],
      style: 'serif'
    },
    recommendations: ['Emphasize professionalism', 'Use traditional color scheme', 'Focus on trust and authority'],
    confidence: 0.88
  }
};

interface ConversationMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  components?: any[];
  analysis?: any;
  state?: any;
}

interface UploadedAsset {
  type: 'logo' | 'screenshot' | 'reference';
  data: string; // base64
  filename: string;
  preview?: string;
}

interface AgentConnectionProps {
  title?: string;
  description?: string;
  height?: string;
  showSessionState?: boolean;
  useMockData?: boolean;
  onAnalysisComplete?: (analysis: any) => void;
  onToolSuggestion?: (suggestion: any) => void;
  onStateChange?: (state: any) => void;
  className?: string;
}

export function AgentConnection({
  title = "Brand Intelligence Assistant",
  description = "Interactive conversation with dynamic forms and components",
  height = "700px",
  showSessionState = true,
  useMockData = false,
  onAnalysisComplete,
  onToolSuggestion,
  onStateChange,
  className = ""
}: AgentConnectionProps) {
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [currentComponent, setCurrentComponent] = useState<any | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const [sessionState, setSessionState] = useState<any>({
    phase: 'discovery',
    canProceed: false,
    confidence: 0
  });
  const [isSessionStateCollapsed, setIsSessionStateCollapsed] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const magicSparkRef = useRef<MagicSparkAgent | null>(null);

  const addSystemMessage = (content: string) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date()
    };
    setConversation(prev => [...prev, message]);
  };

  // Initialize Magic Spark agent
  useEffect(() => {
    try {
      magicSparkRef.current = new MagicSparkAgent();
      
      // Add welcome message
      setConversation([{
        id: '1',
        type: 'ai',
        content: "Hello! I'm your Brand Intelligence AI. I help create interactive business tools that perfectly match your brand identity. To get started, tell me about your business or upload your logo!",
        timestamp: new Date()
      }]);
      
      // Show initial file upload component after a brief delay
      setTimeout(() => {
        setCurrentComponent({
          type: 'FileUpload',
          id: 'initial-upload',
          props: {
            label: 'Upload your logo or brand asset',
            description: 'This helps me understand your brand aesthetic and personality',
            accept: 'image/*'
          },
          priority: 'immediate'
        });
      }, 1000);
      
    } catch (error) {
      console.error('Failed to initialize Magic Spark agent:', error);
      addSystemMessage('Using mock data mode - AI agent initialization failed');
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(sessionState);
  }, [sessionState, onStateChange]);

  // Notify parent of analysis completion
  useEffect(() => {
    if (currentAnalysis) {
      onAnalysisComplete?.(currentAnalysis);
    }
  }, [currentAnalysis, onAnalysisComplete]);

  const addUserMessage = (content: string) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };
    setConversation(prev => [...prev, message]);
  };

  const addAIMessage = (content: string, components?: any[], analysis?: any, state?: any) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type: 'ai',
      content,
      timestamp: new Date(),
      components,
      analysis,
      state
    };
    setConversation(prev => [...prev, message]);
  };

  const handleUserInput = async (input: string) => {
    console.log('handleUserInput called with:', input);
    console.log('useMockData:', useMockData);
    console.log('magicSparkRef.current:', !!magicSparkRef.current);
    
    if (!input.trim() || isStreaming) {
      console.log('Input rejected - empty or streaming');
      return;
    }
    
    addUserMessage(input);
    setCurrentInput('');
    setIsStreaming(true);

    try {
      if (useMockData || !magicSparkRef.current) {
        console.log('Using mock response');
        await simulateMockResponse(input);
      } else {
        console.log('Using real AI response');
        await magicSparkRef.current.streamBrandDiscovery(
          input,
          uploadedAssets,
          {
            businessType: 'consulting',
            sessionHistory: conversation
          },
          {
            onNarrative: (text) => {
              setConversation(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.type === 'ai' && !lastMessage.content) {
                  return [...prev.slice(0, -1), { ...lastMessage, content: text }];
                } else {
                  return [...prev, {
                    id: Date.now().toString(),
                    type: 'ai',
                    content: text,
                    timestamp: new Date()
                  }];
                }
              });
            },
            onComponent: (component) => {
              setCurrentComponent(component);
            },
            onAnalysis: (analysis) => {
              setCurrentAnalysis(analysis);
            },
            onStateUpdate: (state) => {
              setSessionState(state);
            },
            onComplete: (result) => {
              setIsStreaming(false);
            },
            onError: (error) => {
              console.error('Brand discovery error:', error);
              addSystemMessage(`Error: ${error.message}`);
              setIsStreaming(false);
            }
          }
        );
      }
    } catch (error) {
      console.error('Error in user input handling:', error);
      addSystemMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsStreaming(false);
    }
  };

  const simulateMockResponse = async (input: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('tech') || lowerInput.includes('startup') || lowerInput.includes('software')) {
      const analysis = mockBrandAnalyses.techStartup;
      setCurrentAnalysis(analysis);
      
      addAIMessage(
        `I can see you're in the tech space! Based on your description, I'm thinking a modern, innovative approach would work perfectly. Let me show you some brand colors that would resonate with your tech-savvy audience.`
      );
      
      setTimeout(() => {
        setCurrentComponent({
          type: 'ColorPalette',
          id: 'tech-colors',
          props: {
            colors: analysis.colors,
            title: 'Suggested Tech Brand Colors'
          },
          priority: 'immediate'
        });
      }, 500);
      
    } else if (lowerInput.includes('consulting') || lowerInput.includes('business') || lowerInput.includes('professional')) {
      const analysis = mockBrandAnalyses.consultingFirm;
      setCurrentAnalysis(analysis);
      
      addAIMessage(
        `Perfect! Consulting businesses need to project authority and trustworthiness. I'm seeing a more classic, professional approach would serve you well. Here's a color palette that conveys expertise and reliability.`
      );
      
      setTimeout(() => {
        setCurrentComponent({
          type: 'ColorPalette',
          id: 'consulting-colors',
          props: {
            colors: analysis.colors,
            title: 'Professional Consulting Colors'
          },
          priority: 'immediate'
        });
      }, 500);
      
      setTimeout(() => {
        setCurrentComponent({
          type: 'StylePreview',
          id: 'consulting-preview',
          props: {
            style: {
              colors: {
                primary: analysis.colors[0].hex,
                secondary: analysis.colors[1].hex,
                text: '#1f2937',
                background: '#ffffff'
              },
              fonts: {
                primary: analysis.typography.suggestedFonts[0]
              },
              personality: analysis.personality
            },
            title: 'How Your Brand Could Look'
          },
          priority: 'next'
        });
      }, 3000);
      
    } else {
      addAIMessage(
        `Interesting! Tell me more about your business. What industry are you in, and who is your target audience? This will help me suggest the perfect tool type and styling for your brand.`
      );
      
      setTimeout(() => {
        setCurrentComponent({
          type: 'BrandForm',
          id: 'brand-info',
          props: {
            fields: [
              {
                name: 'industry',
                label: 'Industry',
                type: 'select',
                options: [
                  { value: 'consulting', label: 'Consulting' },
                  { value: 'technology', label: 'Technology' },
                  { value: 'healthcare', label: 'Healthcare' },
                  { value: 'finance', label: 'Finance' },
                  { value: 'education', label: 'Education' },
                  { value: 'other', label: 'Other' }
                ],
                required: true
              },
              {
                name: 'targetAudience',
                label: 'Target Audience',
                type: 'text',
                placeholder: 'e.g., Small business owners, C-level executives, etc.',
                required: true
              },
              {
                name: 'businessGoals',
                label: 'Primary Business Goals',
                type: 'textarea',
                placeholder: 'What are you trying to achieve with your business?'
              }
            ],
            title: 'Tell me about your business',
            description: 'This helps me create the perfect tool for your brand'
          },
          priority: 'immediate'
        });
      }, 500);
    }
    
    setIsStreaming(false);
  };

  const handleFileUpload = async (file: File, base64: string) => {
    const asset: UploadedAsset = {
      type: 'logo',
      data: base64,
      filename: file.name,
      preview: URL.createObjectURL(file)
    };
    
    setUploadedAssets(prev => [...prev, asset]);
    setCurrentComponent(null);
    addUserMessage(`Uploaded ${file.name}`);
    
    await handleUserInput(`I've uploaded my ${file.name} logo. Please analyze it and help me create a tool that matches my brand.`);
  };

  const handleComponentAction = (componentId: string, action: string, data?: any) => {
    console.log('Component action:', { componentId, action, data });
    
    if (action === 'submit' && data) {
      setCurrentComponent(null);
      const formattedData = Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      handleUserInput(`Here's my business information: ${formattedData}`);
    } else if (action === 'approve') {
      setCurrentComponent(null);
      handleUserInput('I love this style! Let\'s continue with creating a tool.');
    } else if (action === 'reject') {
      setCurrentComponent(null);
      handleUserInput('Let\'s try a different style approach.');
    } else if (action === 'select' && data) {
      setCurrentComponent(null);
      onToolSuggestion?.(data);
      handleUserInput(`I'd like to create a ${data.type} tool: ${data.title}`);
    }
  };

  const renderComponent = (component: any, index: number) => {
    const Component = VisualComponentFactory[component.type as keyof typeof VisualComponentFactory];
    if (!Component) return null;

    const props = {
      ...component.props,
      onUpload: component.type === 'FileUpload' ? handleFileUpload : undefined,
      onSubmit: component.type === 'BrandForm' ? (data: any) => handleComponentAction(component.id, 'submit', data) : undefined,
      onApprove: component.type === 'StylePreview' ? () => handleComponentAction(component.id, 'approve') : undefined,
      onReject: component.type === 'StylePreview' ? () => handleComponentAction(component.id, 'reject') : undefined,
      onSelect: component.type === 'ToolSuggestions' ? (data: any) => handleComponentAction(component.id, 'select', data) : undefined,
      onColorSelect: component.type === 'ColorPalette' ? (color: any) => console.log('Color selected:', color) : undefined
    };

    return (
      <div key={`${component.id}-${index}`} className="mb-4">
        <Component {...props} />
      </div>
    );
  };

  const resetSession = () => {
    setConversation([]);
    setCurrentComponent(null);
    setUploadedAssets([]);
    setCurrentAnalysis(null);
    setSessionState({ phase: 'discovery', canProceed: false, confidence: 0 });
    setCurrentInput('');
    
    setTimeout(() => {
      setConversation([{
        id: '1',
        type: 'ai',
        content: "Hello! I'm your Brand Intelligence AI. I help create interactive business tools that perfectly match your brand identity. To get started, tell me about your business or upload your logo!",
        timestamp: new Date()
      }]);
      
      setTimeout(() => {
        setCurrentComponent({
          type: 'FileUpload',
          id: 'initial-upload',
          props: {
            label: 'Upload your logo or brand asset',
            description: 'This helps me understand your brand aesthetic and personality',
            accept: 'image/*'
          },
          priority: 'immediate'
        });
      }, 1000);
    }, 100);
  };

  return (
    <div className={`grid grid-cols-1 gap-8 ${className}`} style={{ gridTemplateColumns: showSessionState ? (isSessionStateCollapsed ? '1fr auto' : '1fr 300px') : '1fr' }}>
      {/* Unified Conversation Interface */}
      <div className="min-w-0">
        <Card className="flex flex-col overflow-hidden" style={{ height }}>
          <CardContent className="flex-1 flex min-h-0 overflow-hidden p-0">
            {/* Messages Section - Left Side */}
            <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-gray-900">
              <ScrollArea className="flex-1 p-4 overflow-hidden">
                <div className="space-y-3 min-h-0">
                  {conversation.map((message, index) => (
                    <div
                      key={message.id}
                      className="animate-in slide-in-from-bottom-3 fade-in duration-300 w-full"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="w-full">
                        <div className={`text-sm leading-relaxed ${
                          message.type === 'user'
                            ? 'text-yellow-300'
                            : message.type === 'system'
                            ? 'text-orange-300'
                            : 'text-blue-300'
                        }`}>
                          <span className={`font-medium ${
                            message.type === 'user' ? 'text-yellow-400' : 
                            message.type === 'system' ? 'text-orange-400' : 
                            'text-blue-400'
                          }`}>
                            {message.type === 'user' ? 'You: ' : 
                             message.type === 'system' ? 'System: ' : 
                             'AI: '}
                          </span>
                          {message.content}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isStreaming && (
                    <div className="animate-in slide-in-from-left-3 fade-in duration-300 w-full">
                      <div className="text-blue-300 text-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                          <span className="font-medium text-blue-400">AI: </span>
                          <span>thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>
              
              {/* Input Section - Bottom of Messages */}
              <div className="p-4 border-t border-gray-700 flex-shrink-0 bg-gray-800">
                <div className="flex gap-2 w-full">
                  <Input
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    placeholder="Tell me about your business or ask a question..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleUserInput(currentInput);
                      }
                    }}
                    disabled={isStreaming}
                    className="flex-1 min-w-0 bg-gray-700 text-gray-100 border-gray-600 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={resetSession}
                    className="flex-shrink-0 px-2"
                    title="Reset conversation"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={() => handleUserInput(currentInput)}
                    disabled={isStreaming || !currentInput.trim()}
                    className="flex-shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Interactive Forms Section - Right Side */}
            <div className="w-80 flex flex-col bg-gray-50 min-h-0">
              {/* Form Content Area - Full Height */}
              <div className="flex-1 p-4 overflow-hidden">
                {!currentComponent ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        Components appear here
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full animate-in slide-in-from-right-5 fade-in duration-500">
                    <div className="h-full overflow-y-auto">
                      {renderComponent(currentComponent, 0)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session State Panel - Horizontally Collapsible */}
      {showSessionState && (
        <div className={`transition-all duration-300 ${isSessionStateCollapsed ? 'w-12' : 'w-72'}`}>
          <Card className="flex flex-col overflow-hidden" style={{ height }}>
            {/* Collapsed State - Vertical */}
            {isSessionStateCollapsed ? (
              <div className="flex-1 flex flex-col items-center justify-start p-2 space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSessionStateCollapsed(false)}
                  className="h-8 w-8 p-0 rotate-0 hover:rotate-12 transition-transform"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                
                {/* Vertical indicators */}
                <div className="flex flex-col items-center space-y-2 text-xs">
                  <div className="writing-mode-vertical text-gray-600 transform rotate-90 whitespace-nowrap">
                    {sessionState.phase}
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <div className="writing-mode-vertical text-gray-500 transform rotate-90">
                    {Math.round(sessionState.confidence * 100)}%
                  </div>
                  {uploadedAssets.length > 0 && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <div className="writing-mode-vertical text-gray-500 transform rotate-90">
                        {uploadedAssets.length}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Expanded State */
              <>
                <CardHeader className="pb-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Session State</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSessionStateCollapsed(true)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3 flex-1 overflow-y-auto">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Phase:</span>
                    <Badge variant="outline">{sessionState.phase}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Confidence:</span>
                    <span className="text-sm font-medium">
                      {Math.round(sessionState.confidence * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Assets:</span>
                    <span className="text-sm font-medium">{uploadedAssets.length}</span>
                  </div>
                  {currentAnalysis && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-gray-600 mb-2">Brand Analysis:</p>
                      <div className="space-y-1">
                        <p className="text-xs">Style: {currentAnalysis.style}</p>
                        <p className="text-xs">Colors: {currentAnalysis.colors?.length || 0}</p>
                        <p className="text-xs">Confidence: {Math.round((currentAnalysis.confidence || 0) * 100)}%</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default AgentConnection; 