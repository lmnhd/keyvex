// Logic Architect Component - Framework and logic building interface

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle,
  Lightbulb,
  ArrowRight,
  Edit3
} from 'lucide-react';

interface LogicArchitectProps {
  selectedSuggestion: any;
  expertise: string;
  targetAudience: string;
  onNext: () => void;
  onFrameworkGenerated: (framework: any) => void;
  sessionId?: string;
}

interface FrameworkStep {
  id: number;
  title: string;
  type: 'intro' | 'input' | 'logic' | 'output';
  description?: string;
  required?: boolean;
}

export function LogicArchitect({
  selectedSuggestion,
  expertise,
  targetAudience,
  onNext,
  onFrameworkGenerated,
  sessionId
}: LogicArchitectProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [framework, setFramework] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementFeedback, setRefinementFeedback] = useState('');

  // TODO: Replace with actual API call
  const generateFramework = async (streaming = false) => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      if (streaming) {
        // TODO: Implement streaming
        const mockSteps = [
          'Analyzing tool requirements...',
          'Designing framework structure...',
          'Creating logic flow...',
          'Optimizing for target audience...',
          'Finalizing framework...'
        ];

        for (let i = 0; i < mockSteps.length; i++) {
          setCurrentStep(mockSteps[i]);
          setProgress(((i + 1) / mockSteps.length) * 100);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // TODO: Replace with actual API call
      const response = await fetch('/api/ai/logic-architect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedSuggestion,
          expertise,
          targetAudience,
          action: 'generate',
          sessionId,
          stream: streaming
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate framework');
      }

      const result = await response.json();
      
      if (result.success) {
        setFramework(result.data);
        onFrameworkGenerated(result.data);
        setProgress(100);
        setCurrentStep('Framework generated successfully!');
      } else {
        throw new Error(result.error || 'Framework generation failed');
      }

    } catch (error) {
      console.error('Framework generation error:', error);
      setError(error instanceof Error ? error.message : 'Framework generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const refineFramework = async () => {
    if (!framework || !refinementFeedback.trim()) return;

    setIsRefining(true);
    setError(null);

    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/ai/logic-architect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedSuggestion,
          expertise,
          targetAudience,
          action: 'refine',
          currentFramework: framework,
          userFeedback: refinementFeedback,
          sessionId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refine framework');
      }

      const result = await response.json();
      
      if (result.success) {
        setFramework(result.data);
        onFrameworkGenerated(result.data);
        setRefinementFeedback('');
      } else {
        throw new Error(result.error || 'Framework refinement failed');
      }

    } catch (error) {
      console.error('Framework refinement error:', error);
      setError(error instanceof Error ? error.message : 'Framework refinement failed');
    } finally {
      setIsRefining(false);
    }
  };

  const validateFramework = async () => {
    if (!framework) return;

    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/ai/logic-architect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedSuggestion,
          expertise,
          targetAudience,
          action: 'validate',
          currentFramework: framework,
          sessionId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate framework');
      }

      const result = await response.json();
      
      if (result.success) {
        // TODO: Show validation results
        console.log('Validation results:', result.data);
      }

    } catch (error) {
      console.error('Framework validation error:', error);
      setError(error instanceof Error ? error.message : 'Framework validation failed');
    }
  };

  const renderFrameworkStructure = () => {
    if (!framework?.structure?.steps) return null;

    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-lg">Framework Structure</h4>
        <div className="space-y-3">
          {framework.structure.steps.map((step: FrameworkStep, index: number) => (
            <div key={step.id} className="flex items-center space-x-3 p-3 border border-border rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div className="flex-grow">
                <div className="flex items-center space-x-2">
                  <h5 className="font-medium">{step.title}</h5>
                  <Badge variant={step.type === 'logic' ? 'default' : 'secondary'}>
                    {step.type}
                  </Badge>
                  {step.required && (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                {step.description && (
                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                )}
              </div>
              <Button variant="ghost" size="sm">
                <Edit3 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Logic Architect</span>
          </CardTitle>
          <CardDescription>
            Building the framework and logic structure for your {selectedSuggestion?.type || 'tool'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tool Overview */}
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Tool Overview</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p className="font-medium">{selectedSuggestion?.type || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Expertise:</span>
                <p className="font-medium">{expertise}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Audience:</span>
                <p className="font-medium">{targetAudience}</p>
              </div>
            </div>
          </div>

          {/* Generation Controls */}
          {!framework && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Generate Framework</h4>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => generateFramework(false)}
                    disabled={isGenerating}
                    variant="outline"
                  >
                    {isGenerating ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {isGenerating ? 'Generating...' : 'Generate'}
                  </Button>
                  <Button
                    onClick={() => generateFramework(true)}
                    disabled={isGenerating}
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Stream Generate
                  </Button>
                </div>
              </div>

              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{currentStep}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}

              {error && (
                <div className="flex items-center space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">{error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setError(null)}
                    className="ml-auto"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Generated Framework */}
          {framework && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <h4 className="font-semibold">Framework Generated</h4>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={validateFramework}
                  >
                    Validate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateFramework(false)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
              </div>

              {/* Framework Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Complexity</Label>
                  <Badge variant="secondary" className="mt-1">
                    {framework.complexity || 'Medium'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Estimated Time</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {framework.estimatedTime || '15-20 minutes'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Framework Structure */}
              {renderFrameworkStructure()}

              <Separator />

              {/* Refinement Section */}
              <div className="space-y-4">
                <h4 className="font-semibold">Refine Framework</h4>
                <div className="space-y-3">
                  <Label htmlFor="refinement-feedback">
                    What would you like to change or improve?
                  </Label>
                  <Textarea
                    id="refinement-feedback"
                    placeholder="Describe any changes you'd like to make to the framework structure, logic, or flow..."
                    value={refinementFeedback}
                    onChange={(e) => setRefinementFeedback(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={refineFramework}
                    disabled={isRefining || !refinementFeedback.trim()}
                    variant="outline"
                  >
                    {isRefining ? 'Refining...' : 'Refine Framework'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          {framework && (
            <div className="flex justify-end pt-4">
              <Button onClick={onNext} className="flex items-center space-x-2">
                <span>Continue to Content Crafter</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 
