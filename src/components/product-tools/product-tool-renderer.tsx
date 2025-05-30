'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProductToolDefinition, ComponentDefinition } from '@/lib/types/product-tool';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, ChevronLeft, CheckCircle, AlertTriangle, Calculator } from 'lucide-react';
import ProductToolComponentFactory from './product-tool-component-factory';

// ============================================================================
// TYPES
// ============================================================================

interface ProductToolContextType {
  values: Record<string, any>;
  setValue: (componentId: string, value: any) => void;
  errors: Record<string, string>;
  setError: (componentId: string, error: string | null) => void;
  currentStep: number;
  totalSteps: number;
  isCalculating: boolean;
}

export const ProductToolContext = React.createContext<ProductToolContextType | null>(null);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ProductToolRendererProps {
  toolDefinition: ProductToolDefinition;
  onComplete?: (data: Record<string, any>) => void;
  className?: string;
  hideCompleteButton?: boolean;
}

export default function ProductToolRenderer({ 
  toolDefinition, 
  onComplete,
  className = '',
  hideCompleteButton
}: ProductToolRendererProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  const isMultiStep = toolDefinition.layout.type === 'multi-step' || toolDefinition.layout.type === 'wizard';
  const steps = toolDefinition.layout.structure.flow.steps || [];
  const totalSteps = isMultiStep ? steps.length : 1;
  const currentStepData = isMultiStep ? steps[currentStep] : null;
  
  // Get components for current step or all components if single page
  const currentComponents = React.useMemo(() => {
    if (!isMultiStep) {
      return toolDefinition.components;
    }
    
    if (!currentStepData) {
      return [];
    }
    
    return toolDefinition.components.filter(comp => 
      currentStepData.componentIds.includes(comp.id)
    );
  }, [toolDefinition.components, currentStepData, isMultiStep]);

  // ============================================================================
  // STYLING HELPERS
  // ============================================================================
  
  const colors = toolDefinition.styling.colors;
  
  // Enhanced tool background styling - supports gradients, patterns, and textures
  const getToolBackgroundStyle = () => {
    const baseBackground = colors.background || '#ffffff';
    
    // Handle gradient backgrounds
    if (colors.backgroundType === 'gradient' && baseBackground.includes('gradient')) {
      return { background: baseBackground };
    }
    
    // Handle pattern backgrounds
    if (colors.backgroundPattern) {
      const patternColor = colors.patternColor || '#e2e8f0';
      const patternOpacity = colors.patternOpacity || 0.1;
      
      let patternSvg = '';
      switch (colors.backgroundPattern) {
        case 'dots':
          patternSvg = `data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='dots' x='0' y='0' width='20' height='20' patternUnits='userSpaceOnUse'%3E%3Ccircle cx='10' cy='10' r='2' fill='${encodeURIComponent(patternColor)}' opacity='${patternOpacity}'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23dots)'/%3E%3C/svg%3E`;
          break;
        case 'grid':
          patternSvg = `data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='${encodeURIComponent(patternColor)}' stroke-width='1' opacity='${patternOpacity}'/%3E%3C/svg%3E`;
          break;
        case 'diagonal':
          patternSvg = `data:image/svg+xml,%3Csvg width='30' height='30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,30 l30,-30 M-5,5 l10,-10 M25,35 l10,-10' stroke='${encodeURIComponent(patternColor)}' stroke-width='1' opacity='${patternOpacity}'/%3E%3C/svg%3E`;
          break;
        case 'waves':
          patternSvg = `data:image/svg+xml,%3Csvg width='60' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,10 Q15,0 30,10 T60,10' fill='none' stroke='${encodeURIComponent(patternColor)}' stroke-width='1' opacity='${patternOpacity}'/%3E%3C/svg%3E`;
          break;
      }
      
      return {
        backgroundColor: baseBackground,
        backgroundImage: `url("${patternSvg}")`
      };
    }
    
    // Handle texture backgrounds
    if (colors.backgroundTexture) {
      const textureOpacity = colors.textureOpacity || 0.05;
      let textureSvg = '';
      
      switch (colors.backgroundTexture) {
        case 'paper':
          textureSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3CfeColorMatrix values='0 0 0 0 0.9 0 0 0 0 0.9 0 0 0 0 0.9 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paper)' opacity='${textureOpacity}'/%3E%3C/svg%3E`;
          break;
        case 'fabric':
          textureSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='fabric'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.6' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.8 0 0 0 0 0.8 0 0 0 0 0.8 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23fabric)' opacity='${textureOpacity}'/%3E%3C/svg%3E`;
          break;
        case 'concrete':
          textureSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='concrete'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0.7 0 0 0 0 0.7 0 0 0 0 0.7 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23concrete)' opacity='${textureOpacity}'/%3E%3C/svg%3E`;
          break;
        case 'wood':
          textureSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='wood'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.4' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.6 0 0 0 0 0.5 0 0 0 0 0.3 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23wood)' opacity='${textureOpacity}'/%3E%3C/svg%3E`;
          break;
      }
      
      return {
        backgroundColor: baseBackground,
        backgroundImage: `url("${textureSvg}")`
      };
    }
    
    // Default solid background
    return { backgroundColor: baseBackground };
  };
  
  const toolBackgroundStyle = getToolBackgroundStyle();

  // ============================================================================
  // CONTEXT METHODS
  // ============================================================================
  
  const setValue = useCallback((componentId: string, value: any) => {
    setValues(prev => ({ ...prev, [componentId]: value }));
    
    // Clear error when value changes
    if (errors[componentId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[componentId];
        return newErrors;
      });
    }
    
    // Trigger calculations
    triggerCalculations();
  }, [errors]);

  const setError = useCallback((componentId: string, error: string | null) => {
    if (error) {
      setErrors(prev => ({ ...prev, [componentId]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[componentId];
        return newErrors;
      });
    }
  }, []);

  // ============================================================================
  // CALCULATIONS
  // ============================================================================
  
  const triggerCalculations = useCallback(() => {
    if (!toolDefinition.logic.calculations.length) return;
    
    setIsCalculating(true);
    
    try {
      toolDefinition.logic.calculations.forEach(calc => {
        // Check if all dependencies are available
        const hasAllDependencies = calc.dependencies.every(dep => 
          values[dep] !== undefined && values[dep] !== null && values[dep] !== ''
        );
        
        if (!hasAllDependencies) return;
        
        try {
          // Create a safe evaluation context with sanitized parameter names
          const context = calc.dependencies.reduce((acc, dep) => {
            acc[dep] = values[dep];
            return acc;
          }, {} as Record<string, any>);
          
          // Create sanitized parameter names (replace invalid chars with underscores)
          const sanitizeParamName = (name: string) => name.replace(/[^a-zA-Z0-9_$]/g, '_');
          
          // Create mapping of sanitized names to actual values
          const sanitizedParams: string[] = [];
          const paramValues: any[] = [];
          const paramMapping: Record<string, string> = {};
          
          calc.dependencies.forEach(dep => {
            const sanitized = sanitizeParamName(dep);
            sanitizedParams.push(sanitized);
            paramValues.push(values[dep]);
            paramMapping[dep] = sanitized;
          });
          
          // Transform the formula to use sanitized parameter names
          let transformedFormula = calc.formula;
          Object.entries(paramMapping).forEach(([original, sanitized]) => {
            // Replace all occurrences of the original parameter name with the sanitized version
            const regex = new RegExp(`\\b${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            transformedFormula = transformedFormula.replace(regex, sanitized);
          });
          
          // Add common math functions as additional parameters
          const mathParams = ['Math', 'parseFloat', 'parseInt', 'Number', 'String', 'Boolean'];
          const mathValues = [Math, parseFloat, parseInt, Number, String, Boolean];
          
          const allParams = [...sanitizedParams, ...mathParams];
          const allValues = [...paramValues, ...mathValues];
          
          // Evaluate the formula safely
          const result = new Function(...allParams, `return ${transformedFormula}`)(...allValues);
          
          // Update the output component
          setValues(prev => ({ ...prev, [calc.outputComponentId]: result }));
          
        } catch (error) {
          console.error(`Calculation error for ${calc.id}:`, error);
          console.error('Formula:', calc.formula);
          console.error('Dependencies:', calc.dependencies);
          console.error('Values:', calc.dependencies.map(dep => ({ [dep]: values[dep] })));
          setError(calc.outputComponentId, 'Calculation error');
        }
      });
    } finally {
      setIsCalculating(false);
    }
  }, [toolDefinition.logic.calculations, values, setError]);

  // ============================================================================
  // VALIDATION
  // ============================================================================
  
  const validateCurrentStep = useCallback(() => {
    const stepErrors: string[] = [];
    
    currentComponents.forEach(component => {
      if (!component.validation) return;
      
      component.validation.rules?.forEach(rule => {
        const value = values[component.id];
        
        switch (rule.type) {
          case 'required':
            if (!value || value === '' || (Array.isArray(value) && value.length === 0)) {
              stepErrors.push(rule.message || `${component.props.label || component.id} is required`);
            }
            break;
            
          case 'min':
            if (typeof value === 'number' && value < rule.value) {
              stepErrors.push(rule.message || `${component.props.label || component.id} must be at least ${rule.value}`);
            }
            break;
            
          case 'max':
            if (typeof value === 'number' && value > rule.value) {
              stepErrors.push(rule.message || `${component.props.label || component.id} must be at most ${rule.value}`);
            }
            break;
            
          case 'email':
            if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              stepErrors.push(rule.message || 'Please enter a valid email address');
            }
            break;
        }
      });
    });
    
    setValidationErrors(stepErrors);
    return stepErrors.length === 0;
  }, [currentComponents, values]);

  // ============================================================================
  // NAVIGATION
  // ============================================================================
  
  const nextStep = useCallback(() => {
    if (!validateCurrentStep()) return;
    
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, totalSteps, validateCurrentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    if (!validateCurrentStep()) return;
    
    // Record completion analytics
    fetch(`/api/product-tools/${toolDefinition.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: `session_${Date.now()}`,
        completionData: values
      })
    }).catch(console.error);
    
    onComplete?.(values);
  }, [toolDefinition.id, values, validateCurrentStep, onComplete]);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    triggerCalculations();
  }, [values]);

  // ============================================================================
  // LAYOUT OPTIMIZATION UTILITIES
  // ============================================================================
  
  // Group components intelligently for better space usage
  const optimizeComponentLayout = (components: any[]) => {
    const sorted = components.sort((a, b) => a.order - b.order);
    const groups: any[][] = [];
    let currentGroup: any[] = [];
    
    sorted.forEach((component, index) => {
      // Determine if component can be grouped with others
      const canGroup = shouldGroupComponent(component, currentGroup);
      
      if (canGroup && currentGroup.length < getMaxGroupSize(component)) {
        currentGroup.push(component);
      } else {
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [component];
      }
    });
    
    // Add the last group if it has items
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  };
  
  // Determine if a component should be grouped with others
  const shouldGroupComponent = (component: any, currentGroup: any[]) => {
    // Don't group if current group is empty
    if (currentGroup.length === 0) return true;
    
    const componentType = component.type;
    const groupTypes = currentGroup.map(c => c.type);
    
    // Group number inputs together (max 2-3 per row)
    if (componentType === 'number-input' && groupTypes.every(t => t === 'number-input')) {
      return true;
    }
    
    // Group currency inputs together
    if (componentType === 'currency-input' && groupTypes.every(t => t === 'currency-input')) {
      return true;
    }
    
    // Group small display components
    if (['badge', 'icon', 'text'].includes(componentType) && 
        groupTypes.every(t => ['badge', 'icon', 'text'].includes(t))) {
      return true;
    }
    
    // Don't group calculation displays - they need full width
    if (['calculation-display', 'currency-display', 'percentage-display'].includes(componentType)) {
      return false;
    }
    
    // Don't group with different types
    return false;
  };
  
  // Get maximum items per group based on component type
  const getMaxGroupSize = (component: any) => {
    switch (component.type) {
      case 'number-input':
      case 'currency-input':
        return 2; // Max 2 inputs per row for good UX
      case 'badge':
      case 'icon':
        return 4; // Can have more small items
      case 'text':
        return 3;
      default:
        return 1; // Most components get full width
    }
  };
  
  // Render a group of components with appropriate layout
  const renderComponentGroup = (group: any[], groupIndex: number) => {
    if (group.length === 1) {
      // Single component - full width
      return (
        <div key={`group-${groupIndex}`} className="w-full">
          <ProductToolComponentFactory definition={group[0]} />
        </div>
      );
    }
    
    // Multiple components - use grid layout
    const isNumberInput = group[0].type === 'number-input' || group[0].type === 'currency-input';
    const gridCols = Math.min(group.length, isNumberInput ? 2 : 4);
    
    return (
      <div 
        key={`group-${groupIndex}`} 
        className={`grid gap-4 ${
          gridCols === 2 ? 'grid-cols-1 sm:grid-cols-2' :
          gridCols === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
          gridCols === 4 ? 'grid-cols-2 sm:grid-cols-4' :
          'grid-cols-1'
        }`}
      >
        {group.map(component => (
          <div key={component.id} className={isNumberInput ? 'min-w-0' : ''}>
            <ProductToolComponentFactory definition={component} />
          </div>
        ))}
      </div>
    );
  };

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================
  
  const contextValue: ProductToolContextType = {
    values,
    setValue,
    errors,
    setError,
    currentStep,
    totalSteps,
    isCalculating
  };

  // ============================================================================
  // MAIN RENDER - WITH BEAUTIFUL STYLING
  // ============================================================================
  
  return (
    <ProductToolContext.Provider value={contextValue}>
      <Card className="w-full max-w-2xl mx-auto shadow-lg" style={toolBackgroundStyle}>
        <CardContent className="p-8">
          
          {/* Beautiful Header */}
          <div className="text-center mb-8">
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ backgroundColor: colors.primary }}
            >
              <Calculator className="h-8 w-8 text-white" />
            </div>
            <h1 
              className="text-2xl font-bold mb-2"
              style={{ color: colors.text.primary }}
            >
              {toolDefinition.metadata.title}
            </h1>
            <p className="mb-4" style={{ color: colors.text.secondary }}>
              {toolDefinition.metadata.description}
            </p>
            
            {/* Feature badges */}
            {toolDefinition.metadata.features.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {toolDefinition.metadata.features.map((feature, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    style={{ 
                      borderColor: colors.primary,
                      color: colors.primary,
                      backgroundColor: `${colors.primary}10`
                    }}
                  >
                    {feature}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Multi-step Progress */}
          {isMultiStep && (
            <Card className="mb-6" style={{ backgroundColor: colors.surface }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium" style={{ color: colors.text.primary }}>
                    {currentStepData?.title || `Step ${currentStep + 1}`}
                  </h3>
                  <span className="text-sm" style={{ color: colors.text.muted }}>
                    {currentStep + 1} of {totalSteps}
                  </span>
                </div>
                
                <Progress 
                  value={((currentStep + 1) / totalSteps) * 100} 
                  className="mb-2"
                />
                
                {currentStepData?.description && (
                  <p className="text-sm" style={{ color: colors.text.secondary }}>
                    {currentStepData.description}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-red-800 mb-1">
                      Please fix the following errors:
                    </h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Components */}
          <div className="space-y-6">
            {optimizeComponentLayout(currentComponents)
              .map((group, groupIndex) => renderComponentGroup(group, groupIndex))}
          </div>

          {/* Navigation */}
          {isMultiStep && (
            <Card className="mt-8" style={{ backgroundColor: colors.surface }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  {currentStep === totalSteps - 1 ? (
                    <Button
                      onClick={handleComplete}
                      disabled={validationErrors.length > 0}
                      className="flex items-center gap-2"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Complete
                    </Button>
                  ) : (
                    <Button
                      onClick={nextStep}
                      disabled={validationErrors.length > 0}
                      className="flex items-center gap-2"
                      style={{ backgroundColor: colors.primary }}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Single Page Complete Button */}
          {!isMultiStep && !hideCompleteButton && false && (
            <Card className="mt-8" style={{ backgroundColor: colors.surface }}>
              <CardContent className="p-4 text-center">
                <Button
                  onClick={handleComplete}
                  disabled={validationErrors.length > 0}
                  size="lg"
                  className="flex items-center gap-2"
                  style={{ backgroundColor: colors.primary }}
                >
                  <CheckCircle className="h-4 w-4" />
                  Complete {toolDefinition.metadata.title}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Target Audience & Industry */}
          {(toolDefinition.metadata.targetAudience || toolDefinition.metadata.industry) && (
            <div className="mt-6 pt-4 border-t" style={{ borderColor: colors.border }}>
              <div className="flex justify-center gap-6 text-xs" style={{ color: colors.text.muted }}>
                {toolDefinition.metadata.targetAudience && (
                  <span>Target: {toolDefinition.metadata.targetAudience}</span>
                )}
                {toolDefinition.metadata.industry && (
                  <span>Industry: {toolDefinition.metadata.industry}</span>
                )}
              </div>
            </div>
          )}
          
        </CardContent>
      </Card>
    </ProductToolContext.Provider>
  );
} 