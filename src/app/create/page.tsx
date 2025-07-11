// TODO: Implement main tool creation page with AI workflow

'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Save, Eye, Brain, X } from 'lucide-react';
import { MagicSpark } from '@/components/ai/magic-spark';
import { LogicArchitect } from '@/components/ai/logic-architect';
import { AgentConnection } from '@/components/ai/agent-connection';
import { useAISessionStore } from '@/lib/stores/ai-session';
import { AIStep } from '@/lib/types/ai';

const STEPS: { key: AIStep; title: string; description: string }[] = [
  {
    key: 'magic-spark',
    title: 'Magic Spark',
    description: 'Discover your perfect tool'
  },
  {
    key: 'logic-architect',
    title: 'Logic Architect',
    description: 'Build the framework'
  },
  {
    key: 'content-crafter',
    title: 'Content Crafter',
    description: 'Create engaging content'
  },
  {
    key: 'style-master',
    title: 'Style Master',
    description: 'Design the look & feel'
  },
  {
    key: 'review',
    title: 'Review',
    description: 'Preview and refine'
  },
  {
    key: 'publish',
    title: 'Publish',
    description: 'Launch your tool'
  }
];

export default function CreateToolPage() {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAgentConnection, setShowAgentConnection] = useState(true);
  const [brandAnalysis, setBrandAnalysis] = useState<any>(null);
  const [useMockData, setUseMockData] = useState(false);

  const {
    currentSession,
    createSession,
    setCurrentStep,
    nextStep,
    previousStep,
    reset
  } = useAISessionStore();

  // Initialize session on page load
  useEffect(() => {
    if (user && !currentSession) {
      createSession(user.id);
    }
  }, [user, currentSession, createSession]);

  const currentStepIndex = currentSession 
    ? STEPS.findIndex(step => step.key === currentSession.currentStep)
    : 0;

  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleStepClick = (stepKey: AIStep) => {
    setCurrentStep(stepKey);
  };

  const handleNext = () => {
    nextStep();
  };

  const handlePrevious = () => {
    previousStep();
  };

  const handleSave = async () => {
    // TODO: Implement save functionality
    setIsLoading(true);
    try {
      // Save current progress
      console.log('Saving progress...');
    } catch (error) {
      setError('Failed to save progress');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = () => {
    // TODO: Implement preview functionality
    console.log('Opening preview...');
  };

  const handleAgentConnectionToggle = () => {
    setShowAgentConnection(!showAgentConnection);
  };

  const handleAnalysisComplete = (analysis: any) => {
    console.log('Brand analysis completed:', analysis);
    setBrandAnalysis(analysis);
    // TODO: Apply brand analysis to current tool creation
  };

  const handleToolSuggestion = (suggestion: any) => {
    console.log('Tool suggestion from agent:', suggestion);
    // TODO: Apply suggestion to current session
    setShowAgentConnection(false); // Close agent connection after suggestion
  };

  const handleAgentStateChange = (state: any) => {
    console.log('Agent state changed:', state);
    // TODO: Sync agent state with main creation flow
  };

  const renderCurrentStep = () => {
    if (!currentSession) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground">Initializing AI session...</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    switch (currentSession.currentStep) {
      case 'magic-spark':
        return (
          <MagicSpark 
            onNext={handleNext}
            onSuggestionSelect={(suggestion) => {
              console.log('Selected suggestion:', suggestion);
            }}
          />
        );
      
      case 'logic-architect':
        return (
          <LogicArchitect
            selectedSuggestion={currentSession.sessionData?.selectedSuggestion}
            expertise={currentSession.sessionData?.expertise || ''}
            targetAudience={currentSession.sessionData?.targetAudience || ''}
            onNext={handleNext}
            onFrameworkGenerated={(framework: any) => {
              // TODO: Store framework in session
              console.log('Framework generated:', framework);
            }}
            sessionId={currentSession.id}
          />
        );
      
      case 'content-crafter':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Content Crafter</CardTitle>
              <CardDescription>
                Creating engaging content for your tool
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Content Crafter component will be implemented here...
              </p>
              {/* TODO: Implement Content Crafter component */}
            </CardContent>
          </Card>
        );
      
      case 'style-master':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Style Master</CardTitle>
              <CardDescription>
                Designing the visual style and branding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Style Master component will be implemented here...
              </p>
              {/* TODO: Implement Style Master component */}
            </CardContent>
          </Card>
        );
      
      case 'review':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Review & Preview</CardTitle>
              <CardDescription>
                Review your tool and make final adjustments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Review component will be implemented here...
              </p>
              {/* TODO: Implement Review component */}
            </CardContent>
          </Card>
        );
      
      case 'publish':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Publish Your Tool</CardTitle>
              <CardDescription>
                Configure publishing settings and launch your tool
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Publish component will be implemented here...
              </p>
              {/* TODO: Implement Publish component */}
            </CardContent>
          </Card>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Create Interactive Tool</h1>
            <p className="text-muted-foreground">
              Build engaging calculators, quizzes, and assessments with AI assistance
            </p>
            {brandAnalysis && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  <Brain className="h-3 w-3 mr-1" />
                  Brand Analysis Available
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Style: {brandAnalysis.style} • Colors: {brandAnalysis.colors?.length || 0}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave} disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              Save Progress
            </Button>
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setUseMockData(!useMockData)}
              className={useMockData ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "bg-green-50 border-green-200 text-green-700"}
            >
              {useMockData ? 'Mock AI' : 'Real AI'}
            </Button>
            <Button 
              variant={showAgentConnection ? "default" : "outline"}
              onClick={handleAgentConnectionToggle}
              className={showAgentConnection ? "bg-blue-600 text-white" : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"}
            >
              <Brain className="mr-2 h-4 w-4" />
              {showAgentConnection ? 'Close Agent' : 'Brand Agent'}
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Step Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.key} className="flex items-center">
                <button
                  onClick={() => handleStepClick(step.key)}
                  className={`flex flex-col items-center space-y-2 p-2 rounded-lg transition-colors ${
                    currentSession?.currentStep === step.key
                      ? 'bg-primary text-primary-foreground'
                      : index <= currentStepIndex
                      ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  disabled={index > currentStepIndex + 1}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentSession?.currentStep === step.key
                      ? 'bg-primary-foreground text-primary'
                      : index <= currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium">{step.title}</div>
                    <div className="text-xs opacity-70">{step.description}</div>
                  </div>
                </button>
                
                {index < STEPS.length - 1 && (
                  <div className={`w-8 h-px mx-2 ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-sm text-destructive">
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Connection */}
      {showAgentConnection && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  Brand Intelligence Agent
                </CardTitle>
                <CardDescription>
                  Get AI assistance with brand analysis and tool suggestions
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleAgentConnectionToggle}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2">
            <AgentConnection
              title="Brand Intelligence Assistant"
              description="Get personalized tool suggestions based on your brand"
              height="500px"
              showSessionState={false}
              useMockData={useMockData}
              onAnalysisComplete={handleAnalysisComplete}
              onToolSuggestion={handleToolSuggestion}
              onStateChange={handleAgentStateChange}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}

      {/* Current Step Content */}
      <div className="min-h-[600px]">
        {renderCurrentStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStepIndex === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Step {currentStepIndex + 1} of {STEPS.length}
          </Badge>
        </div>

        <Button
          onClick={handleNext}
          disabled={currentStepIndex === STEPS.length - 1}
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// TODO: Add auto-save functionality
// TODO: Implement step validation before proceeding
// TODO: Add keyboard shortcuts for navigation
// TODO: Implement session recovery on page refresh
// TODO: Add collaborative editing features
// TODO: Implement tool templates and quick start options 
