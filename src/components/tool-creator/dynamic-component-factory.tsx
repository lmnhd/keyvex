'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ComponentDefinition, ComponentType, ComponentProps, ValueFormat } from '@/lib/types/tool-definition';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// Icons
import * as LucideIcons from 'lucide-react';


// ============================================================================
// COMPONENT VALUE FORMATTING
// ============================================================================

export function formatValue(value: any, format?: ValueFormat): string {
  if (value === null || value === undefined || value === '') return '';

  if (!format) return String(value);

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  switch (format.type) {
    case 'currency':
      return new Intl.NumberFormat(format.locale || 'en-US', {
        style: 'currency',
        currency: format.currency || 'USD',
        minimumFractionDigits: format.decimals ?? 2,
        maximumFractionDigits: format.decimals ?? 2,
      }).format(numValue);

    case 'percentage':
      return new Intl.NumberFormat(format.locale || 'en-US', {
        style: 'percent',
        minimumFractionDigits: format.decimals ?? 1,
        maximumFractionDigits: format.decimals ?? 1,
      }).format(numValue / 100);

    case 'number':
    case 'decimal':
      return new Intl.NumberFormat(format.locale || 'en-US', {
        minimumFractionDigits: format.decimals ?? 0,
        maximumFractionDigits: format.decimals ?? 2,
      }).format(numValue);

    case 'date':
      return new Date(value).toLocaleDateString(format.locale || 'en-US');

    case 'time':
      return new Date(value).toLocaleTimeString(format.locale || 'en-US');

    default:
      const formatted = String(value);
      return `${format.prefix || ''}${formatted}${format.suffix || ''}`;
  }
}

// ============================================================================
// DYNAMIC COMPONENT CONTEXT
// ============================================================================

interface DynamicComponentContextType {
  values: Record<string, any>;
  updateValue: (componentId: string, value: any) => void;
  getComponentValue: (componentId: string) => any;
  triggerCalculation: (componentId: string) => void;
}

const DynamicComponentContext = React.createContext<DynamicComponentContextType | null>(null);

export function useDynamicComponent() {
  const context = React.useContext(DynamicComponentContext);
  if (!context) {
    throw new Error('useDynamicComponent must be used within a DynamicComponentProvider');
  }
  return context;
}

// ============================================================================
// INDIVIDUAL COMPONENT RENDERERS
// ============================================================================

// Input Components
function TextInputComponent({ definition, value, onChange }: ComponentRendererProps) {
  const { props } = definition || {};
  const textColor = ensureContrast(props?.textColor, props?.backgroundColor);
  
  return (
    <div className="space-y-2">
      {props?.label && (
        <Label htmlFor={definition?.id} className="text-sm font-medium">
          {props.label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input
        id={definition?.id}
        type="text"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={props?.placeholder}
        disabled={props?.disabled}
        required={props?.required}
        className={props?.className}
        style={{
          ...props?.style,
          color: textColor,
          backgroundColor: props?.backgroundColor,
          borderColor: props?.borderColor
        }}
      />
      {props?.helperText && (
        <p className="text-xs text-gray-500">{props.helperText}</p>
      )}
    </div>
  );
}

function NumberInputComponent({ definition, value, onChange }: ComponentRendererProps) {
  const { props } = definition || {};
  const textColor = ensureContrast(props?.textColor, props?.backgroundColor);
  
  // Enhanced default value handling - show 0 instead of empty for better visibility
  const displayValue = value !== undefined && value !== null && value !== '' ? value : '';
  const defaultPlaceholder = props?.placeholder || `Enter ${props?.label?.toLowerCase() || 'value'}...`;
  
  return (
    <div className={`space-y-2 ${props?.className || ''}`} style={props?.containerStyle}>
      {props?.label && (
        <Label htmlFor={definition?.id} className="text-sm font-medium">
          {props.label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input
        id={definition?.id}
        type="number"
        value={displayValue}
        onChange={(e) => {
          const newValue = e.target.value === '' ? undefined : parseFloat(e.target.value);
          onChange?.(newValue);
        }}
        placeholder={defaultPlaceholder}
        disabled={props?.disabled}
        required={props?.required}
        min={props?.min}
        max={props?.max}
        step={props?.step || (props?.label?.toLowerCase().includes('percentage') ? 0.1 : 1)}
        className={`${props?.className || ''} 
          // Enhanced visibility styling
          border-2 focus:border-3 transition-all duration-200
          ${!props?.borderColor ? 'border-gray-300 dark:border-gray-600' : ''}
          ${!props?.backgroundColor ? 'bg-white dark:bg-gray-800' : ''}
          font-medium placeholder:font-normal
          focus:ring-2 focus:ring-blue-500/20
          hover:border-gray-400 dark:hover:border-gray-500
        `.replace(/\s+/g, ' ').trim()}
        style={{
          ...props?.style,
          color: textColor,
          backgroundColor: props?.backgroundColor,
          borderColor: props?.borderColor,
          minWidth: '120px', // Prevent inputs from being too narrow
          fontSize: props?.fontSize || '16px', // Ensure readable text size
          // Add subtle shadow for better definition
          boxShadow: props?.borderColor ? 
            `0 0 0 1px ${props.borderColor}20, 0 1px 2px rgba(0,0,0,0.05)` :
            '0 1px 2px rgba(0,0,0,0.05)'
        }}
      />
      {props?.helperText && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{props.helperText}</p>
      )}
      
      {/* Add unit indicator if applicable */}
      {props?.unit && (
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
          {props.unit}
        </span>
      )}
    </div>
  );
}

function TextareaComponent({ definition, value, onChange }: ComponentRendererProps) {
  const { props } = definition || {};
  const textColor = ensureContrast(props?.textColor, props?.backgroundColor);
  
  return (
    <div className="space-y-2">
      {props?.label && (
        <Label htmlFor={definition?.id} className="text-sm font-medium">
          {props.label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Textarea
        id={definition?.id}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={props?.placeholder}
        disabled={props?.disabled}
        required={props?.required}
        className={props?.className}
        style={{
          ...props?.style,
          color: textColor,
          backgroundColor: props?.backgroundColor,
          borderColor: props?.borderColor
        }}
        rows={4}
      />
      {props?.helperText && (
        <p className="text-xs text-gray-500">{props.helperText}</p>
      )}
    </div>
  );
}

function SelectComponent({ definition, value, onChange }: ComponentRendererProps) {
  const { props } = definition || {};
  
  return (
    <div className="space-y-2">
      {props?.label && (
        <Label htmlFor={definition?.id} className="text-sm font-medium">
          {props.label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Select value={value || ''} onValueChange={onChange} disabled={props?.disabled}>
        <SelectTrigger className={props?.className} style={props?.style}>
          <SelectValue placeholder={props?.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {props?.options?.map((option) => (
            <SelectItem 
              key={option.value} 
              value={String(option.value)}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props?.helperText && (
        <p className="text-xs text-gray-500">{props.helperText}</p>
      )}
    </div>
  );
}

function CheckboxGroupComponent({ definition, value, onChange }: ComponentRendererProps) {
  const { props } = definition || {};
  const selectedValues = Array.isArray(value) ? value : [];
  
  const handleChange = (optionValue: string, checked: boolean) => {
    let newValue;
    if (checked) {
      newValue = [...selectedValues, optionValue];
    } else {
      newValue = selectedValues.filter(v => v !== optionValue);
    }
    onChange?.(newValue);
  };
  
  return (
    <div className="space-y-3">
      {props?.label && (
        <Label className="text-sm font-medium">
          {props.label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="space-y-2">
        {props?.options?.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <Checkbox
              id={`${definition?.id}-${option.value}`}
              checked={selectedValues.includes(String(option.value))}
              onCheckedChange={(checked) => handleChange(String(option.value), checked as boolean)}
              disabled={props?.disabled || option.disabled}
            />
            <Label 
              htmlFor={`${definition?.id}-${option.value}`}
              className="text-sm font-normal cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </div>
      {props?.helperText && (
        <p className="text-xs text-gray-500">{props.helperText}</p>
      )}
    </div>
  );
}

function RadioGroupComponent({ definition, value, onChange }: ComponentRendererProps) {
  const { props } = definition || {};
  
  return (
    <div className="space-y-3">
      {props?.label && (
        <Label className="text-sm font-medium">
          {props.label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <RadioGroup value={value || ''} onValueChange={onChange} disabled={props?.disabled}>
        {props?.options?.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem
              value={String(option.value)}
              id={`${definition?.id}-${option.value}`}
              disabled={option.disabled}
            />
            <Label 
              htmlFor={`${definition?.id}-${option.value}`}
              className="text-sm font-normal cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {props?.helperText && (
        <p className="text-xs text-gray-500">{props.helperText}</p>
      )}
    </div>
  );
}

function SliderComponent({ definition, value, onChange }: ComponentRendererProps) {
  const { props } = definition || {};
  const numValue = typeof value === 'number' ? value : (props?.min || 0);
  
  return (
    <div className="space-y-3">
      {props?.label && (
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">
            {props.label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <span className="text-sm text-gray-500">{numValue}</span>
        </div>
      )}
      <Slider
        value={[numValue]}
        onValueChange={(values) => onChange?.(values[0])}
        min={props?.min || 0}
        max={props?.max || 100}
        step={props?.step || 1}
        disabled={props?.disabled}
        className={props?.className}
      />
      {props?.helperText && (
        <p className="text-xs text-gray-500">{props.helperText}</p>
      )}
    </div>
  );
}

function ColorPickerComponent({ definition, value, onChange }: ComponentRendererProps) {
  const { props } = definition || {};
  
  return (
    <div className="space-y-3">
      {props?.label && (
        <Label className="text-sm font-medium">
          {props.label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="space-y-2">
        {props?.options?.map((option) => {
          // Get the display color - use first color from colors array, or fallback to value
          const displayColor = option.colors?.[0] || option.value;
          
          return (
            <div key={option.value} className="flex items-center space-x-3 cursor-pointer" onClick={() => onChange?.(option.value)}>
              <div 
                className={`w-6 h-6 rounded-full border-2 ${
                  value === option.value ? 'border-gray-900 ring-2 ring-gray-300' : 'border-gray-300'
                }`}
                style={{ backgroundColor: displayColor as string }}
              />
              <Label 
                className={`text-sm cursor-pointer ${
                  value === option.value ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'
                }`}
              >
                {option.label}
              </Label>
            </div>
          );
        })}
      </div>
      {props?.helperText && (
        <p className="text-xs text-gray-500">{props.helperText}</p>
      )}
    </div>
  );
}

function ButtonComponent({ definition, onClick }: ComponentRendererProps & { onClick?: () => void }) {
  const { props } = definition || {};
  
  return (
    <Button
      onClick={onClick}
      disabled={props?.disabled}
      className={props?.className}
      style={props?.style}
      variant={props?.variant || 'default'}
      size={props?.size || 'default'}
    >
      {props?.text || props?.label || 'Button'}
    </Button>
  );
}

// Display Components
function HeadingComponent({ definition }: ComponentRendererProps) {
  const { props } = definition || {};
  const level = Math.min(Math.max((props?.level) || 2, 1), 6); // Clamp between 1-6
  const tagName = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  
  return React.createElement(
    tagName,
    {
      className: `font-bold ${props?.className || ''}`,
      style: props?.style
    },
    props?.text || props?.label || 'Heading'
  );
}

function TextComponent({ definition }: ComponentRendererProps) {
  const { props } = definition || {};
  
  if (props?.html) {
    return (
      <div 
        className={props.className}
        style={props.style}
        dangerouslySetInnerHTML={{ __html: props.html }}
      />
    );
  }
  
  return (
    <p 
      className={props?.className}
      style={props?.style}
    >
      {props?.text}
    </p>
  );
}

function BadgeComponent({ definition }: ComponentRendererProps) {
  const { props } = definition || {};
  
  return (
    <Badge 
      variant={props?.variant || 'default'}
      className={props?.className}
      style={props?.style}
    >
      {props?.text || props?.label}
    </Badge>
  );
}

function ProgressBarComponent({ definition, value }: ComponentRendererProps) {
  const { props } = definition || {};
  const progress = typeof value === 'number' ? value : (props?.value || 0);
  
  return (
    <div className="space-y-2">
      {props?.label && (
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">{props.label}</Label>
          <span className="text-sm text-gray-500">{progress}%</span>
        </div>
      )}
      <Progress 
        value={progress}
        className={props?.className}
        style={props?.style}
      />
    </div>
  );
}

function IconComponent({ definition }: ComponentRendererProps) {
  const { props } = definition || {};
  
  if (props?.type === 'lucide' && props.value) {
    const IconComponent = (LucideIcons as any)[props.value];
    if (IconComponent) {
      return (
        <IconComponent 
          size={props.size || 24}
          className={props.className}
          style={props.style}
        />
      );
    }
  }
  
  if (props?.type === 'emoji') {
    return (
      <span 
        className={props.className}
        style={{ fontSize: props.size || '24px', ...props.style }}
      >
        {props.value}
      </span>
    );
  }
  
  return null;
}

function DividerComponent({ definition }: ComponentRendererProps) {
  const { props } = definition || {};
  
  return (
    <Separator 
      orientation={props?.orientation || 'horizontal'}
      className={props?.className}
      style={props?.style}
    />
  );
}

function CardComponent({ definition, children }: ComponentRendererProps & { children?: React.ReactNode }) {
  const { props } = definition || {};
  
  return (
    <Card className={props?.className} style={props?.style}>
      {props?.title && (
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {props?.text || children}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CUSTOM DISPLAY COMPONENT - NO SHADCN DEPENDENCIES
// ============================================================================

interface CustomDisplayProps {
  label?: string;
  value: string | number;
  format?: ValueFormat;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  padding?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  helperText?: string;
  className?: string;
  style?: React.CSSProperties;
}

function CustomDisplay({ 
  label, 
  value, 
  format,
  textColor,
  backgroundColor = '#f8fafc', 
  borderColor = '#e5e7eb',
  borderWidth = '1px',
  borderRadius = '8px',
  padding = '16px',
  fontSize = '24px',
  fontWeight = '700',
  textAlign = 'left',
  helperText,
  className = '',
  style = {}
}: CustomDisplayProps) {
  const formattedValue = formatValue(value, format);
  
  // Handle empty/undefined values
  const displayValue = formattedValue || (value === 0 ? '0' : '—');
  
  // Ensure proper text contrast
  const finalTextColor = ensureContrast(textColor, backgroundColor);
  
  // Debug logging
  console.log('CustomDisplay render:', { 
    label, 
    value, 
    formattedValue, 
    displayValue,
    format,
    textColor,
    backgroundColor,
    finalTextColor
  });
  
  return (
    <div className={`display-component ${className}`} style={style}>
      {label && (
        <div 
          style={{
            fontSize: '14px',
            fontWeight: '500',
            color: finalTextColor,
            marginBottom: '8px'
          }}
        >
          {label}
        </div>
      )}
      <div 
        style={{
          color: finalTextColor,
          backgroundColor,
          borderColor,
          borderWidth,
          borderStyle: 'solid',
          borderRadius,
          padding,
          fontSize,
          fontWeight,
          textAlign,
          // Force override any inherited styles
          background: backgroundColor,
          boxSizing: 'border-box' as const,
          minHeight: '60px', // Ensure visible height even when empty
          display: 'flex',
          alignItems: 'center',
          justifyContent: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start'
        }}
      >
        {displayValue}
      </div>
      {helperText && (
        <div 
          style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '4px'
          }}
        >
          {helperText}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UPDATED CALCULATION DISPLAY USING CUSTOM DISPLAY
// ============================================================================

// Calculation Display Component
function CalculationDisplayComponent({ definition, value }: ComponentRendererProps) {
  const { props } = definition || {};
  const { getComponentValue } = useDynamicComponent();
  
  // Get values from dependencies
  const dependencyValues = useMemo(() => {
    if (!props?.dependencies) return {};
    
    const values: Record<string, any> = {};
    props.dependencies.forEach(depId => {
      values[depId] = getComponentValue(depId);
    });
    return values;
  }, [props?.dependencies, getComponentValue]);
  
  // Calculate result using formula
  const calculatedValue = useMemo(() => {
    if (!props?.formula) {
      // No formula, use direct value or default
      return value !== undefined ? value : 0;
    }
    
    try {
      // Check if all dependencies have values
      const hasAllDependencies = props.dependencies?.every(depId => {
        const depValue = dependencyValues[depId];
        return depValue !== undefined && depValue !== null && depValue !== '';
      });
      
      if (!hasAllDependencies) {
        // Dependencies not ready, show placeholder
        return 0;
      }
      
      // Create a safe evaluation context
      const context = { ...dependencyValues, Math };
      const func = new Function(...Object.keys(context), `return ${props.formula}`);
      const result = func(...Object.values(context));
      
      // Ensure result is a number
      return typeof result === 'number' ? result : 0;
    } catch (error) {
      console.error('Calculation error:', error);
      return 'Error';
    }
  }, [props?.formula, dependencyValues, value, props?.dependencies]);
  
  // Debug logging
  console.log('CalculationDisplay:', {
    id: definition?.id,
    formula: props?.formula,
    dependencies: props?.dependencies,
    dependencyValues,
    calculatedValue,
    props
  });
  
  return (
    <CustomDisplay
      label={props?.label}
      value={calculatedValue}
      format={props?.format}
      textColor={props?.textColor}
      backgroundColor={props?.backgroundColor}
      borderColor={props?.borderColor}
      borderWidth={props?.borderWidth}
      borderRadius={props?.borderRadius}
      padding={props?.padding}
      fontSize={props?.fontSize}
      fontWeight={props?.fontWeight}
      textAlign={props?.textAlign}
      helperText={props?.helperText}
      className={props?.className}
      style={props?.style}
    />
  );
}

// ============================================================================
// CONTRAST CALCULATION UTILITIES
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function calculateLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5; // Default to medium if can't parse
  
  const { r, g, b } = rgb;
  
  // Convert to linear RGB
  const toLinear = (c: number) => {
    const normalized = c / 255;
    return normalized <= 0.03928 
      ? normalized / 12.92 
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  
  const linearR = toLinear(r);
  const linearG = toLinear(g);
  const linearB = toLinear(b);
  
  // Calculate relative luminance
  return 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
}

function getContrastingTextColor(backgroundColor: string): string {
  const luminance = calculateLuminance(backgroundColor);
  // If background is light (luminance > 0.5), use dark text
  // If background is dark (luminance <= 0.5), use light text
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
}

function ensureContrast(textColor: string | undefined, backgroundColor: string | undefined): string {
  // If no background specified, use default dark text
  if (!backgroundColor) return textColor || '#1f2937';
  
  // If text color is specified, check if it has good contrast
  if (textColor) {
    const textLuminance = calculateLuminance(textColor);
    const bgLuminance = calculateLuminance(backgroundColor);
    const contrast = (Math.max(textLuminance, bgLuminance) + 0.05) / (Math.min(textLuminance, bgLuminance) + 0.05);
    
    // If contrast is good (>= 4.5:1), keep the specified color
    if (contrast >= 4.5) return textColor;
  }
  
  // Otherwise, calculate the best contrasting color
  return getContrastingTextColor(backgroundColor);
}

// ============================================================================
// COMPONENT TYPE MAPPING
// ============================================================================

interface ComponentRendererProps {
  definition: ComponentDefinition;
  value?: any;
  onChange?: (value: any) => void;
}

const COMPONENT_RENDERERS: Record<ComponentType, React.ComponentType<ComponentRendererProps & any>> = {
  // Input Components
  'text-input': TextInputComponent,
  'number-input': NumberInputComponent,
  'email-input': TextInputComponent,
  'currency-input': NumberInputComponent,
  'textarea': TextareaComponent,
  'select': SelectComponent,
  'multi-select': CheckboxGroupComponent,
  'radio-group': RadioGroupComponent,
  'checkbox-group': CheckboxGroupComponent,
  'slider': SliderComponent,
  'date-picker': TextInputComponent, // TODO: Implement proper date picker
  'file-upload': TextInputComponent, // TODO: Implement file upload
  'toggle': CheckboxGroupComponent, // TODO: Implement toggle
  'color-picker': ColorPickerComponent,
  
  // Display Components - ALL using CustomDisplay
  'heading': HeadingComponent,
  'text': TextComponent,
  'metric-display': CalculationDisplayComponent,        // Uses CustomDisplay
  'calculation-display': CalculationDisplayComponent,   // Uses CustomDisplay
  'currency-display': CalculationDisplayComponent,      // Uses CustomDisplay  
  'percentage-display': CalculationDisplayComponent,    // Uses CustomDisplay
  'progress-bar': ProgressBarComponent,
  'badge': BadgeComponent,
  'card': CardComponent,
  'divider': DividerComponent,
  'icon': IconComponent,
  
  // Interactive Components
  'button': ButtonComponent,
  'export-button': ButtonComponent,
  'submit-button': ButtonComponent,
  'reset-button': ButtonComponent,
  
  // Chart Components - Temporary placeholder implementations
  'bar-chart': ChartComponent,
  'line-chart': ChartComponent,
  'pie-chart': ChartComponent,
  'gauge-chart': ProgressBarComponent,
  
  // Layout Components
  'container': CardComponent,
  'grid': CardComponent, // TODO: Implement grid
  'section': CardComponent,
};

// ============================================================================
// MAIN COMPONENT FACTORY
// ============================================================================

interface DynamicComponentFactoryProps {
  definition: ComponentDefinition;
  values: Record<string, any>;
  onValueChange: (componentId: string, value: any) => void;
  onCalculationTrigger?: (componentId: string) => void;
}

export function DynamicComponentFactory({ 
  definition, 
  values, 
  onValueChange,
  onCalculationTrigger 
}: DynamicComponentFactoryProps) {
  const ComponentRenderer = COMPONENT_RENDERERS[definition.type];
  
  if (!ComponentRenderer) {
    console.warn(`Unknown component type: ${definition.type}`);
    return (
      <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
        <p className="text-sm text-gray-500">
          Unknown component: {definition.type}
        </p>
      </div>
    );
  }
  
  const value = values[definition.id];
  
  const handleChange = (newValue: any) => {
    onValueChange(definition.id, newValue);
    
    // Trigger calculations if this component affects others
    if (onCalculationTrigger) {
      onCalculationTrigger(definition.id);
    }
  };
  
  const handleClick = () => {
    if (definition.type === 'button' && onCalculationTrigger) {
      onCalculationTrigger(definition.id);
    }
  };
  
  return (
    <ComponentRenderer
      definition={definition}
      value={value}
      onChange={handleChange}
      onClick={handleClick}
    />
  );
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface DynamicComponentProviderProps {
  children: React.ReactNode;
  initialValues?: Record<string, any>;
  onValuesChange?: (values: Record<string, any>) => void;
}

export function DynamicComponentProvider({ 
  children, 
  initialValues = {},
  onValuesChange 
}: DynamicComponentProviderProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  
  const updateValue = (componentId: string, value: any) => {
    setValues(prev => {
      const newValues = { ...prev, [componentId]: value };
      onValuesChange?.(newValues);
      return newValues;
    });
  };
  
  const getComponentValue = (componentId: string) => {
    return values[componentId];
  };
  
  const triggerCalculation = (componentId: string) => {
    // This could trigger recalculation of dependent components
    console.log('Calculation triggered for:', componentId);
  };
  
  const contextValue: DynamicComponentContextType = {
    values,
    updateValue,
    getComponentValue,
    triggerCalculation,
  };
  
  return (
    <DynamicComponentContext.Provider value={contextValue}>
      {children}
    </DynamicComponentContext.Provider>
  );
}

// ============================================================================
// Chart Components - Temporary placeholder implementations
// ============================================================================

function ChartComponent({ definition }: ComponentRendererProps) {
  const { props } = definition || {};
  
  return (
    <Card className={props?.className} style={props?.style}>
      {props?.title && (
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              {definition?.type === 'bar-chart' ? '📊 Bar Chart' : 
               definition?.type === 'line-chart' ? '📈 Line Chart' : 
               definition?.type === 'pie-chart' ? '🥧 Pie Chart' : '📊 Chart'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {props?.label || 'Chart visualization coming soon'}
            </div>
            {props?.helperText && (
              <div className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                {props.helperText}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 