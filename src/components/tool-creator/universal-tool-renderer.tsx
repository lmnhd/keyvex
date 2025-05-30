'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ToolDefinition, 
  SectionDefinition, 
  ComponentDefinition,
  CalculationRule,
  ConditionalRule,
  ColorScheme
} from '@/lib/types/tool-definition';
import { 
  DynamicComponentFactory, 
  DynamicComponentProvider,
  formatValue 
} from './dynamic-component-factory';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import * as LucideIcons from 'lucide-react';

// ============================================================================
// UNIVERSAL TOOL RENDERER
// ============================================================================

interface UniversalToolRendererProps {
  definition: ToolDefinition;
  isDarkMode?: boolean;
  className?: string;
  onValuesChange?: (values: Record<string, any>) => void;
  onComplete?: (results: any) => void;
}

export function UniversalToolRenderer({ 
  definition, 
  isDarkMode = false,
  className = '',
  onValuesChange,
  onComplete 
}: UniversalToolRendererProps) {
  const [componentValues, setComponentValues] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [calculationResults, setCalculationResults] = useState<Record<string, any>>({});
  
  // Get sorted sections by order
  const sortedSections = useMemo(() => {
    return [...definition.layout.structure.sections].sort((a, b) => a.order - b.order);
  }, [definition.layout.structure.sections]);
  
  // Get components grouped by section
  const componentsBySection = useMemo(() => {
    const grouped: Record<string, ComponentDefinition[]> = {};
    definition.components.forEach(component => {
      if (!grouped[component.sectionId]) {
        grouped[component.sectionId] = [];
      }
      grouped[component.sectionId].push(component);
    });
    
    // Sort components within each section by order
    Object.keys(grouped).forEach(sectionId => {
      grouped[sectionId].sort((a, b) => a.order - b.order);
    });
    
    return grouped;
  }, [definition.components]);
  
  // Handle value changes
  const handleValueChange = (componentId: string, value: any) => {
    setComponentValues(prev => {
      const newValues = { ...prev, [componentId]: value };
      onValuesChange?.(newValues);
      return newValues;
    });
    
    // Trigger calculations that depend on this component
    triggerDependentCalculations(componentId);
  };
  
  // Calculate dependencies
  const triggerDependentCalculations = (changedComponentId: string) => {
    // Find calculations that depend on this component
    const dependentCalculations = definition.logic.calculations.filter(calc =>
      calc.dependencies.includes(changedComponentId)
    );
    
    dependentCalculations.forEach(calc => {
      executeCalculation(calc);
    });
    
    // Check conditional rules
    definition.logic.conditions.forEach(condition => {
      if (condition.dependencies.includes(changedComponentId)) {
        evaluateCondition(condition);
      }
    });
  };
  
  // Execute a calculation
  const executeCalculation = (calculation: CalculationRule) => {
    try {
      // Get dependency values
      const depValues: Record<string, any> = {};
      calculation.dependencies.forEach(depId => {
        depValues[depId] = componentValues[depId];
      });
      
      // Create safe evaluation context
      const context = { ...depValues, Math, ...calculationResults };
      const func = new Function(...Object.keys(context), `return ${calculation.formula}`);
      const result = func(...Object.values(context));
      
      // Store result
      setCalculationResults(prev => ({
        ...prev,
        [calculation.id]: result
      }));
      
      // Update output component if specified
      if (calculation.outputComponentId) {
        setComponentValues(prev => ({
          ...prev,
          [calculation.outputComponentId]: result
        }));
      }
      
    } catch (error) {
      console.error(`Calculation error for ${calculation.id}:`, error);
    }
  };
  
  // Evaluate conditional rules
  const evaluateCondition = (condition: ConditionalRule) => {
    try {
      // Get dependency values
      const depValues: Record<string, any> = {};
      condition.dependencies.forEach(depId => {
        depValues[depId] = componentValues[depId];
      });
      
      // Evaluate condition
      const context = { ...depValues, Math, ...calculationResults };
      const func = new Function(...Object.keys(context), `return ${condition.condition}`);
      const result = func(...Object.values(context));
      
      // Execute actions based on result
      if (result) {
        condition.actions.forEach(action => {
          // TODO: Implement action execution (show/hide/enable/disable components)
          console.log('Executing action:', action);
        });
      }
      
    } catch (error) {
      console.error(`Condition evaluation error for ${condition.id}:`, error);
    }
  };
  
  // Apply color scheme to CSS variables
  const applyColorScheme = (colors: ColorScheme) => {
    const colorVars = {
      '--tool-primary': colors.primary,
      '--tool-secondary': colors.secondary,
      '--tool-accent': colors.accent || colors.primary,
      '--tool-background': colors.background,
      '--tool-surface': colors.surface,
      '--tool-text-primary': colors.text.primary,
      '--tool-text-secondary': colors.text.secondary,
      '--tool-text-muted': colors.text.muted,
      '--tool-border': colors.border,
      '--tool-success': colors.success,
      '--tool-warning': colors.warning,
      '--tool-error': colors.error,
      '--tool-info': colors.info,
    };
    
    return colorVars as React.CSSProperties;
  };
  
  // Render tool icon
  const renderIcon = () => {
    const iconConfig = definition.metadata.icon;
    if (!iconConfig) return null;
    
    if (iconConfig.type === 'lucide') {
      const IconComponent = (LucideIcons as any)[iconConfig.value];
      if (IconComponent) {
        return <IconComponent className="h-8 w-8 text-white" />;
      }
    }
    
    if (iconConfig.type === 'emoji') {
      return <span className="text-2xl">{iconConfig.value}</span>;
    }
    
    return <LucideIcons.Calculator className="h-8 w-8 text-white" />;
  };
  
  // Render a section
  const renderSection = (section: SectionDefinition) => {
    const components = componentsBySection[section.id] || [];
    
    if (components.length === 0) return null;
    
    const sectionStyle = {
      ...applyColorScheme(definition.styling.colors),
      ...section.style?.background && {
        backgroundColor: section.style.background.value,
        backgroundImage: section.style.background.type === 'gradient' ? section.style.background.value : undefined,
      }
    };
    
    const layoutClass = {
      'vertical': 'space-y-6',
      'horizontal': 'flex flex-wrap gap-6',
      'grid': `grid gap-6 ${section.span?.columns ? `grid-cols-${section.span.columns}` : 'grid-cols-1'}`,
      'flex': 'flex flex-wrap gap-6'
    }[section.layout] || 'space-y-6';
    
    const sectionContent = (
      <div className={layoutClass}>
        {components.map(component => (
          <DynamicComponentFactory
            key={component.id}
            definition={component}
            values={componentValues}
            onValueChange={handleValueChange}
            onCalculationTrigger={(componentId) => {
              // Find and execute calculations triggered by this component
              definition.logic.calculations
                .filter(calc => calc.dependencies.includes(componentId))
                .forEach(executeCalculation);
            }}
          />
        ))}
      </div>
    );
    
    // Wrap in card for certain section types
    if (section.type === 'header' || section.type === 'results') {
      return (
        <Card 
          key={section.id}
          className={section.style?.border || ''}
          style={sectionStyle}
        >
          {section.type === 'header' && (
            <CardHeader className="text-center">
              <div className="flex items-center justify-center">
                <div 
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                  style={{ backgroundColor: definition.styling.colors.primary }}
                >
                  {renderIcon()}
                </div>
              </div>
              <CardTitle className="text-2xl font-bold mb-2" style={{ color: definition.styling.colors.secondary }}>
                {definition.metadata.title}
              </CardTitle>
              <p className="text-gray-600">
                {definition.metadata.description}
              </p>
              
              {/* Feature badges */}
              {definition.metadata.features.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {definition.metadata.features.map((feature, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      style={{ 
                        borderColor: definition.styling.colors.primary,
                        color: definition.styling.colors.primary,
                        backgroundColor: `${definition.styling.colors.primary}10`
                      }}
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>
              )}
            </CardHeader>
          )}
          <CardContent className={section.style?.padding || 'p-6'}>
            {sectionContent}
          </CardContent>
        </Card>
      );
    }
    
    return (
      <div 
        key={section.id}
        className={section.style?.padding || ''}
        style={sectionStyle}
      >
        {sectionContent}
      </div>
    );
  };
  
  // Multi-step navigation
  const renderStepNavigation = () => {
    if (definition.layout.type !== 'multi-step' && definition.layout.type !== 'wizard') {
      return null;
    }
    
    const steps = definition.layout.structure.flow.steps || [];
    if (steps.length <= 1) return null;
    
    const navigation = definition.layout.structure.flow.navigation;
    
    return (
      <div className="space-y-4">
        {/* Progress indicator */}
        {navigation?.showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round((currentStep / (steps.length - 1)) * 100)}%</span>
            </div>
            <Progress value={(currentStep / (steps.length - 1)) * 100} />
          </div>
        )}
        
        {/* Step indicators */}
        {navigation?.showSteps && (
          <div className="flex justify-center space-x-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`w-3 h-3 rounded-full ${
                  index === currentStep 
                    ? 'bg-primary' 
                    : index < currentStep 
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
        
        {/* Navigation buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0 || !navigation?.allowBack}
          >
            {navigation?.buttons.previous || 'Previous'}
          </Button>
          
          <Button
            onClick={() => {
              if (currentStep === steps.length - 1) {
                onComplete?.(componentValues);
              } else {
                setCurrentStep(prev => Math.min(steps.length - 1, prev + 1));
              }
            }}
          >
            {currentStep === steps.length - 1 
              ? (navigation?.buttons.finish || 'Finish')
              : (navigation?.buttons.next || 'Next')
            }
          </Button>
        </div>
      </div>
    );
  };
  
  // Background style
  const backgroundStyle = isDarkMode 
    ? {
        background: `
          radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.04) 0%, transparent 40%),
          radial-gradient(circle at 20% 70%, rgba(255, 255, 255, 0.06) 0%, transparent 35%),
          radial-gradient(circle at 80% 30%, rgba(255, 255, 255, 0.03) 0%, transparent 45%)
        `
      }
    : {
        background: `
          radial-gradient(circle at 30% 20%, rgba(0, 0, 0, 0.06) 0%, transparent 50%),
          radial-gradient(circle at 70% 80%, rgba(0, 0, 0, 0.03) 0%, transparent 40%),
          radial-gradient(circle at 20% 70%, rgba(0, 0, 0, 0.04) 0%, transparent 35%),
          radial-gradient(circle at 80% 30%, rgba(0, 0, 0, 0.02) 0%, transparent 45%)
        `
      };
  
  // Get current step sections (for multi-step tools)
  const getCurrentStepSections = () => {
    if (definition.layout.type === 'multi-step' || definition.layout.type === 'wizard') {
      const steps = definition.layout.structure.flow.steps || [];
      const currentStepData = steps[currentStep];
      
      if (currentStepData) {
        return sortedSections.filter(section => 
          currentStepData.componentIds.some(compId => 
            componentsBySection[section.id]?.some(comp => comp.id === compId)
          )
        );
      }
    }
    
    return sortedSections;
  };
  
  const sectionsToRender = getCurrentStepSections();
  
  return (
    <DynamicComponentProvider 
      initialValues={componentValues}
      onValuesChange={setComponentValues}
    >
      <div 
        className={`w-full min-h-full flex items-center justify-center py-8 px-8 relative ${className}`}
        style={applyColorScheme(definition.styling.colors)}
      >
        {/* Background gradients */}
        <div 
          className={`absolute inset-0 pointer-events-none ${
            isDarkMode ? 'opacity-60' : 'opacity-40'
          }`}
          style={backgroundStyle}
        />
        
        {/* Tool Content */}
        <div 
          className={`w-full relative z-10 ${
            definition.layout.structure.container.maxWidth === 'full' 
              ? 'max-w-full' 
              : `max-w-${definition.layout.structure.container.maxWidth}`
          } mx-auto`}
        >
          <div className="space-y-8">
            {/* Render sections */}
            {sectionsToRender.map(renderSection)}
            
            {/* Step navigation for multi-step tools */}
            {renderStepNavigation()}
          </div>
        </div>
        
        {/* Custom CSS */}
        {definition.styling.customCSS && (
          <style dangerouslySetInnerHTML={{ __html: definition.styling.customCSS }} />
        )}
      </div>
    </DynamicComponentProvider>
  );
}

// ============================================================================
// TOOL DEFINITION VALIDATOR
// ============================================================================

export function validateToolDefinition(definition: ToolDefinition): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!definition.id) errors.push('Tool ID is required');
  if (!definition.metadata.title) errors.push('Tool title is required');
  if (!definition.metadata.description) errors.push('Tool description is required');
  
  // Component validation
  definition.components.forEach(component => {
    if (!component.id) errors.push(`Component missing ID`);
    if (!component.type) errors.push(`Component ${component.id} missing type`);
    if (!component.sectionId) errors.push(`Component ${component.id} missing sectionId`);
    
    // Check if sectionId exists
    const sectionExists = definition.layout.structure.sections.some(s => s.id === component.sectionId);
    if (!sectionExists) {
      errors.push(`Component ${component.id} references non-existent section ${component.sectionId}`);
    }
  });
  
  // Section validation
  definition.layout.structure.sections.forEach(section => {
    if (!section.id) errors.push('Section missing ID');
    if (!section.type) errors.push(`Section ${section.id} missing type`);
  });
  
  // Calculation validation
  definition.logic.calculations.forEach(calc => {
    if (!calc.id) errors.push('Calculation missing ID');
    if (!calc.formula) errors.push(`Calculation ${calc.id} missing formula`);
    
    // Check if dependencies exist
    calc.dependencies.forEach(depId => {
      const componentExists = definition.components.some(c => c.id === depId);
      if (!componentExists) {
        warnings.push(`Calculation ${calc.id} depends on non-existent component ${depId}`);
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
} 