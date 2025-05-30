// Tool Default Values System - Provides professional defaults for all tool properties

import { ProductToolDefinition } from '@/lib/types/product-tool';

// Default color schemes that always look professional
export const DEFAULT_COLOR_SCHEMES = {
  professional: {
    primary: '#2563eb',
    secondary: '#1e40af',
    background: '#ffffff',
    surface: '#f8fafc',
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
      muted: '#9ca3af'
    },
    border: '#e5e7eb',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6'
  },
  modern: {
    primary: '#7c3aed',
    secondary: '#5b21b6',
    background: '#ffffff',
    surface: '#fafafa',
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#94a3b8'
    },
    border: '#e2e8f0',
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0ea5e9'
  },
  warm: {
    primary: '#ea580c',
    secondary: '#c2410c',
    background: '#ffffff',
    surface: '#fefcfb',
    text: {
      primary: '#1c1917',
      secondary: '#57534e',
      muted: '#a8a29e'
    },
    border: '#e7e5e4',
    success: '#16a34a',
    warning: '#ca8a04',
    error: '#dc2626',
    info: '#0284c7'
  }
};

// Default layout structure that's mobile-friendly and professional
export const DEFAULT_LAYOUT = {
  type: 'single-page' as const,
  structure: {
    container: {
      maxWidth: '2xl',
      padding: '6',
      alignment: 'center' as const
    },
    sections: [
      {
        id: 'header',
        type: 'header',
        layout: 'centered',
        order: 1
      },
      {
        id: 'inputs',
        type: 'form',
        layout: 'grid',
        order: 2
      },
      {
        id: 'results',
        type: 'display',
        layout: 'cards',
        order: 3
      }
    ],
    flow: {
      type: 'sequential'
    }
  },
  responsive: {
    breakpoints: {
      mobile: {
        container: {
          maxWidth: 'full',
          padding: '4'
        }
      },
      tablet: {
        container: {
          maxWidth: 'xl',
          padding: '6'
        }
      }
    }
  }
};

// Default theme settings that work well everywhere
export const DEFAULT_THEME = {
  name: 'Professional',
  mode: 'light' as const,
  borderRadius: 'md' as const,
  shadows: 'sm' as const,
  effects: {
    transitions: 'smooth',
    hover: 'subtle'
  }
};

// Default typography that's readable and professional
export const DEFAULT_TYPOGRAPHY = {
  fontFamily: {
    primary: 'Inter, system-ui, sans-serif'
  },
  scale: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem'
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  }
};

// Default spacing system
export const DEFAULT_SPACING = {
  scale: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '3rem',
    '2xl': '4rem'
  }
};

// Default analytics settings
export const DEFAULT_ANALYTICS = {
  enabled: true,
  trackingEvents: [
    {
      id: 'tool-start',
      name: 'Tool Start',
      event: 'tool_interaction_start',
      trigger: 'component-interaction' as const,
      parameters: {
        tool_type: 'calculator'
      }
    },
    {
      id: 'calculation-complete',
      name: 'Calculation Complete', 
      event: 'calculation_complete',
      trigger: 'calculation' as const,
      parameters: {
        calculation_type: 'primary'
      }
    }
  ]
};

/**
 * Extract color scheme from user preferences
 */
export function detectColorScheme(context: any): 'professional' | 'modern' | 'warm' {
  if (context?.colors) {
    const colors = context.colors;
    if (colors.includes('#7c3aed') || colors.includes('#5b21b6')) return 'modern';
    if (colors.includes('#ea580c') || colors.includes('#c2410c')) return 'warm';
  }
  
  if (context?.industry) {
    const industry = context.industry.toLowerCase();
    if (industry.includes('tech') || industry.includes('startup')) return 'modern';
    if (industry.includes('creative') || industry.includes('design')) return 'warm';
  }
  
  return 'professional'; // Safe default
}

/**
 * Generate intelligent metadata defaults
 */
export function generateMetadataDefaults(context: any = {}) {
  const baseTitle = context?.toolType || 'Business Calculator';
  
  return {
    title: baseTitle,
    description: `Professional ${baseTitle.toLowerCase()} with actionable insights`,
    shortDescription: `Calculate and analyze your ${baseTitle.toLowerCase()}`,
    type: 'calculator' as const,
    category: 'business-tools' as const,
    targetAudience: context?.targetAudience || 'business-professionals',
    industry: context?.industry || 'general',
    tags: ['calculator', 'business', 'analysis'],
    estimatedCompletionTime: 300,
    difficultyLevel: 'intermediate' as const,
    features: ['calculations', 'insights'],
    icon: {
      type: 'lucide' as const,
      value: 'calculator'
    }
  };
}

/**
 * Generate smart validation rules for components
 */
export function generateValidationDefaults(components: any[]) {
  return {
    components: components
      .filter(comp => comp.type === 'textInput' || comp.type === 'numberInput')
      .map(comp => ({
        componentId: comp.id,
        rules: [
          {
            type: 'required',
            message: 'This field is required'
          }
        ]
      })),
    global: []
  };
} 