'use client';

import React, { useState, useRef } from 'react';
import { Upload, Palette, Eye, Check, X, FileImage, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Utility function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// File Upload Component
interface FileUploadProps {
  accept?: string;
  label?: string;
  description?: string;
  onUpload?: (file: File, base64: string) => void;
  preview?: string;
  multiple?: boolean;
}

export function FileUploadComponent({ 
  accept = "image/*", 
  label = "Upload your logo or brand asset", 
  description = "This helps me understand your brand aesthetic",
  onUpload,
  preview,
  multiple = false
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setUploadedFile(file);
    if (onUpload) {
      try {
        const base64 = await fileToBase64(file);
        onUpload(file, base64);
      } catch (error) {
        console.error('Error converting file to base64:', error);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileImage className="h-5 w-5" />
          {label}
        </CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : uploadedFile 
              ? 'border-green-500 bg-green-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileInputChange}
            className="hidden"
            aria-label={label || "Upload file"}
            title={label || "Upload file"}
          />
          
          {uploadedFile ? (
            <div className="space-y-3">
              <Check className="mx-auto h-10 w-10 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-700 truncate">
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-green-600">
                  File uploaded successfully
                </p>
              </div>
              {preview && (
                <div className="mt-3">
                  <img 
                    src={preview} 
                    alt="Preview" 
                    className="max-h-24 mx-auto rounded border"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="mx-auto h-10 w-10 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {isDragging ? 'Drop your file here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG, SVG up to 10MB
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Color Palette Component
interface ColorPaletteProps {
  colors: Array<{
    hex: string;
    name: string;
    usage: string;
    confidence?: number;
  }>;
  title?: string;
  onColorSelect?: (color: any) => void;
  editable?: boolean;
}

export function ColorPaletteComponent({ 
  colors, 
  title = "Brand Colors", 
  onColorSelect,
  editable = false 
}: ColorPaletteProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          Colors extracted from your brand assets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {colors.map((color, index) => (
            <div 
              key={index}
              className={`flex flex-col items-center space-y-2 p-2 rounded-lg border transition-all ${
                onColorSelect ? 'cursor-pointer hover:shadow-md' : ''
              }`}
              onClick={() => onColorSelect?.(color)}
            >
              <div 
                className="w-12 h-12 rounded-lg border-2 border-gray-200 shadow-sm"
                style={{ backgroundColor: color.hex }}
              />
              <div className="text-center">
                <p className="text-xs font-medium text-gray-900 truncate max-w-full">
                  {color.name}
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  {color.hex}
                </p>
                <Badge variant="secondary" className="text-xs mt-1">
                  {color.usage}
                </Badge>
                {color.confidence && (
                  <p className="text-xs text-gray-400 mt-1">
                    {Math.round(color.confidence * 100)}%
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Brand Form Component
interface BrandFormProps {
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select';
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
    required?: boolean;
  }>;
  onSubmit?: (data: Record<string, any>) => void;
  prefilled?: Record<string, any>;
  title?: string;
  description?: string;
}

export function BrandFormComponent({ 
  fields, 
  onSubmit, 
  prefilled = {},
  title = "Tell me about your brand",
  description = "This information helps me create tools that perfectly match your brand identity"
}: BrandFormProps) {
  const [formData, setFormData] = useState(prefilled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  const handleFieldChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              
              {field.type === 'text' && (
                <Input
                  id={field.name}
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
              
              {field.type === 'textarea' && (
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={3}
                />
              )}
              
              {field.type === 'select' && field.options && (
                <Select 
                  value={formData[field.name] || ''} 
                  onValueChange={(value) => handleFieldChange(field.name, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
          
          <Button type="submit" className="w-full">
            Continue with Brand Analysis
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Style Preview Component
interface StylePreviewProps {
  style?: {
    colors?: {
      primary?: string;
      secondary?: string;
      text?: string;
      background?: string;
    };
    fonts?: {
      primary?: string;
      secondary?: string;
    };
    personality?: string[];
  };
  onApprove?: () => void;
  onReject?: () => void;
  title?: string;
}

export function StylePreviewComponent({ 
  style, 
  onApprove, 
  onReject,
  title = "Style Preview" 
}: StylePreviewProps) {
  const colors = style?.colors || {
    primary: '#2563eb',
    secondary: '#64748b',
    text: '#1f2937',
    background: '#ffffff'
  };
  
  const fonts = style?.fonts || {
    primary: 'Inter, sans-serif',
    secondary: 'Inter, sans-serif'
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          See how your brand could look in an interactive tool
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Style Preview */}
        <div 
          className="p-6 rounded-lg border-2"
          style={{ 
            backgroundColor: colors.background,
            color: colors.text,
            fontFamily: fonts.primary
          }}
        >
          <h3 
            className="text-xl font-bold mb-3"
            style={{ color: colors.primary }}
          >
            Sample Business Assessment
          </h3>
          <p className="mb-4" style={{ color: colors.text }}>
            This is how your interactive tool might look with your brand styling. 
            The colors and typography reflect your brand personality.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span>Question 1: What's your primary business goal?</span>
              <Badge style={{ backgroundColor: colors.primary, color: 'white' }}>
                Required
              </Badge>
            </div>
            
            <Button 
              style={{ 
                backgroundColor: colors.primary, 
                color: 'white',
                fontFamily: fonts.primary
              }}
              className="w-full"
            >
              Continue Assessment
            </Button>
          </div>
          
          {style?.personality && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600 mb-2">Brand Personality:</p>
              <div className="flex flex-wrap gap-2">
                {style.personality.map((trait, index) => (
                  <Badge key={index} variant="outline">
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={onApprove}
            className="flex-1"
            style={{ backgroundColor: colors.primary }}
          >
            <Check className="mr-2 h-4 w-4" />
            Looks Great! Continue
          </Button>
          <Button 
            onClick={onReject}
            variant="outline"
            className="flex-1"
          >
            <X className="mr-2 h-4 w-4" />
            Let's Adjust
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Tool Suggestions Component
interface ToolSuggestionsProps {
  suggestions: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    estimatedTime?: number;
    complexity?: string;
  }>;
  onSelect?: (suggestion: any) => void;
  title?: string;
}

export function ToolSuggestionsComponent({ 
  suggestions, 
  onSelect,
  title = "Recommended Tools for Your Brand" 
}: ToolSuggestionsProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          Based on your brand analysis, here are the best tool types for your business
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((suggestion) => (
            <Card 
              key={suggestion.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-200"
              onClick={() => onSelect?.(suggestion)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="secondary">{suggestion.type}</Badge>
                  {suggestion.complexity && (
                    <Badge variant="outline">{suggestion.complexity}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 mb-3">
                  {suggestion.description}
                </p>
                {suggestion.estimatedTime && (
                  <p className="text-xs text-gray-500">
                    ~{suggestion.estimatedTime} minutes to complete
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Component Factory for dynamic rendering
export const VisualComponentFactory = {
  FileUpload: FileUploadComponent,
  ColorPalette: ColorPaletteComponent,
  BrandForm: BrandFormComponent,
  StylePreview: StylePreviewComponent,
  ToolSuggestions: ToolSuggestionsComponent,
  FontSelector: ({ fonts, onSelect }: any) => (
    <div className="space-y-2">
      <Label>Font Selection</Label>
      <Select onValueChange={onSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a font" />
        </SelectTrigger>
        <SelectContent>
          {fonts?.map((font: string) => (
            <SelectItem key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
};

export default VisualComponentFactory; 
