// Dynamic Tool Definition Types - JSON Schema Approach
// This enables AI to generate structured tool definitions that render as React components

// ============================================================================
// CORE TOOL DEFINITION SCHEMA
// ============================================================================

export interface ToolDefinition {
  id: string;
  version: string;                    // Schema version for compatibility
  metadata: ToolMetadata;
  layout: LayoutDefinition;
  components: ComponentDefinition[];
  styling: StylingDefinition;
  logic: LogicDefinition;
  validation: ValidationRules;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// METADATA & BASIC INFO
// ============================================================================

export interface ToolMetadata {
  title: string;
  description: string;
  type: 'calculator' | 'quiz' | 'assessment' | 'form' | 'dashboard' | 'custom';
  category: string;                   // e.g., 'roi-calculator', 'lead-qualifier'
  targetAudience: string;
  industry: string;
  tags: string[];
  estimatedCompletionTime?: number;   // minutes
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced';
  features: string[];
  icon?: {
    type: 'lucide' | 'custom' | 'emoji';
    value: string;                    // icon name or emoji or custom SVG
  };
}

// ============================================================================
// LAYOUT SYSTEM
// ============================================================================

export interface LayoutDefinition {
  type: 'single-page' | 'multi-step' | 'wizard' | 'dashboard' | 'split-view';
  structure: LayoutStructure;
  responsive: ResponsiveConfig;
  animation?: AnimationConfig;
}

export interface LayoutStructure {
  container: ContainerConfig;
  sections: SectionDefinition[];
  flow: FlowDefinition;
}

export interface ContainerConfig {
  maxWidth: string;                   // e.g., '2xl', '4xl', 'full'
  padding: string;                    // e.g., 'p-8', 'px-4 py-8'
  alignment: 'center' | 'left' | 'right';
  background?: BackgroundConfig;
}

export interface SectionDefinition {
  id: string;
  type: 'header' | 'content' | 'sidebar' | 'footer' | 'results' | 'custom';
  layout: 'vertical' | 'horizontal' | 'grid' | 'flex';
  order: number;
  span?: {
    columns?: number;               // For grid layouts
    rows?: number;
  };
  visibility?: VisibilityRule;
  style?: SectionStyle;
}

export interface FlowDefinition {
  type: 'linear' | 'conditional' | 'free-form';
  steps?: StepDefinition[];          // For multi-step tools
  navigation?: NavigationConfig;
}

export interface StepDefinition {
  id: string;
  title: string;
  description?: string;
  componentIds: string[];            // Components in this step
  validation?: StepValidation;
  nextStep?: ConditionalNext;
}

// ============================================================================
// COMPONENT SYSTEM
// ============================================================================

export interface ComponentDefinition {
  id: string;
  type: ComponentType;
  sectionId: string;                 // Which section this belongs to
  order: number;                     // Order within section
  props: ComponentProps;
  validation?: ComponentValidation;
  dependencies?: ComponentDependency[];
  visibility?: VisibilityRule;
  responsive?: ComponentResponsive;
}

export type ComponentType = 
  // Input Components
  | 'text-input' | 'number-input' | 'email-input' | 'currency-input'
  | 'textarea' | 'select' | 'multi-select' | 'radio-group' | 'checkbox-group'
  | 'slider' | 'date-picker' | 'file-upload' | 'toggle' | 'color-picker'
  
  // Display Components
  | 'heading' | 'text' | 'metric-display' | 'calculation-display' 
  | 'currency-display' | 'percentage-display' | 'progress-bar' | 'badge'
  | 'card' | 'divider' | 'icon'
  
  // Interactive Components
  | 'button' | 'export-button' | 'submit-button' | 'reset-button'
  
  // Chart Components
  | 'bar-chart' | 'line-chart' | 'pie-chart' | 'gauge-chart'
  
  // Layout Components
  | 'container' | 'grid' | 'section';

export interface ComponentProps {
  // Universal props
  label?: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  
  // Input-specific props
  value?: any;
  defaultValue?: any;
  options?: SelectOption[];
  min?: number;
  max?: number;
  step?: number;
  multiple?: boolean;
  
  // Display-specific props
  text?: string;
  html?: string;                     // For rich text content
  src?: string;                      // For images
  href?: string;                     // For links
  target?: string;
  
  // Chart-specific props
  data?: ChartData;
  chartConfig?: ChartConfig;
  
  // Calculation-specific props
  formula?: string;                  // JavaScript formula
  dependencies?: string[];           // Component IDs this depends on
  format?: ValueFormat;
  
  // Layout-specific props
  columns?: number;
  gap?: string;
  direction?: 'row' | 'column';
  align?: string;
  justify?: string;
  
  // Custom props (for extensibility)
  [key: string]: any;
}

// ============================================================================
// STYLING SYSTEM
// ============================================================================

export interface StylingDefinition {
  theme: ThemeConfig;
  colors: ColorScheme;
  typography: TypographyConfig;
  spacing: SpacingConfig;
  customCSS?: string;                // For advanced customizations
  animations?: AnimationLibrary;
}

export interface ThemeConfig {
  name: string;
  mode: 'light' | 'dark' | 'auto';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shadows: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  effects: {
    blur?: boolean;
    gradient?: boolean;
    noise?: boolean;
  };
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent?: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface TypographyConfig {
  fontFamily: {
    primary: string;
    secondary?: string;
    mono?: string;
  };
  scale: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };
  weights: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
}

// ============================================================================
// LOGIC & CALCULATIONS SYSTEM
// ============================================================================

export interface LogicDefinition {
  calculations: CalculationRule[];
  conditions: ConditionalRule[];
  actions: ActionRule[];
  formulas: FormulaDefinition[];
}

export interface CalculationRule {
  id: string;
  name: string;
  description?: string;
  formula: string;                   // JavaScript expression
  dependencies: string[];            // Component IDs
  outputComponentId: string;         // Where to display result
  triggers: TriggerRule[];           // When to recalculate
  format?: ValueFormat;
}

export interface ConditionalRule {
  id: string;
  condition: string;                 // JavaScript boolean expression
  dependencies: string[];
  actions: ConditionalAction[];
}

export interface ConditionalAction {
  type: 'show' | 'hide' | 'enable' | 'disable' | 'setValue' | 'addClass' | 'removeClass';
  target: string;                    // Component ID or CSS selector
  value?: any;                       // For setValue actions
}

export interface FormulaDefinition {
  id: string;
  name: string;
  description?: string;
  formula: string;
  parameters: FormulaParameter[];
  returnType: 'number' | 'string' | 'boolean' | 'object';
  category?: string;
}

// ============================================================================
// VALIDATION SYSTEM
// ============================================================================

export interface ValidationRules {
  components: ComponentValidation[];
  global: GlobalValidation[];
}

export interface ComponentValidation {
  componentId: string;
  rules: ValidationRule[];
  messages?: ValidationMessages;
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'url' | 'custom';
  value?: any;
  formula?: string;                  // For custom validation
  message?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface SelectOption {
  value: string | number;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
  group?: string;
  colors?: string[];                 // For color picker options - array of hex colors
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  [key: string]: any;
}

export interface ChartConfig {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: any;
  scales?: any;
  [key: string]: any;
}

export interface ValueFormat {
  type: 'currency' | 'percentage' | 'number' | 'decimal' | 'text' | 'date' | 'time';
  decimals?: number;
  currency?: string;                 // e.g., 'USD', 'EUR'
  locale?: string;                   // e.g., 'en-US', 'de-DE'
  prefix?: string;
  suffix?: string;
  thousandsSeparator?: string;
  decimalSeparator?: string;
}

export interface VisibilityRule {
  condition: string;                 // JavaScript boolean expression
  dependencies: string[];            // Component IDs this depends on
}

export interface ComponentDependency {
  componentId: string;
  type: 'value' | 'visibility' | 'validation' | 'calculation';
  trigger?: 'change' | 'blur' | 'focus' | 'immediate';
}

export interface ResponsiveConfig {
  breakpoints: {
    sm: string;                      // Styles for small screens
    md: string;                      // Styles for medium screens
    lg: string;                      // Styles for large screens
    xl: string;                      // Styles for extra large screens
  };
}

export interface AnimationConfig {
  enabled: boolean;
  duration: number;                  // milliseconds
  easing: string;                    // CSS easing function
  entrance?: string;                 // Animation when component appears
  exit?: string;                     // Animation when component disappears
}

// ============================================================================
// EXTENDED INTERFACES
// ============================================================================

export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'image' | 'pattern';
  value: string;                     // Color, gradient, URL, or pattern
  opacity?: number;
  overlay?: string;                  // Color overlay for images
}

export interface SectionStyle {
  background?: BackgroundConfig;
  border?: string;
  borderRadius?: string;
  padding?: string;
  margin?: string;
  shadow?: string;
}

export interface NavigationConfig {
  showSteps: boolean;
  showProgress: boolean;
  allowSkip: boolean;
  allowBack: boolean;
  buttons: {
    next: string;                    // Button text
    previous: string;
    skip?: string;
    finish: string;
  };
}

export interface StepValidation {
  required: boolean;
  customValidation?: string;         // JavaScript validation function
}

export interface ConditionalNext {
  condition: string;                 // JavaScript boolean expression
  nextStepId: string;
  fallbackStepId?: string;
}

export interface ComponentResponsive {
  hidden?: {
    sm?: boolean;
    md?: boolean;
    lg?: boolean;
    xl?: boolean;
  };
  span?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export interface SpacingConfig {
  scale: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
}

export interface AnimationLibrary {
  [animationName: string]: {
    keyframes: string;
    duration: string;
    easing: string;
  };
}

export interface TriggerRule {
  event: 'change' | 'blur' | 'focus' | 'click' | 'load' | 'interval';
  debounce?: number;                 // milliseconds
  condition?: string;                // Optional condition to check
}

export interface ActionRule {
  id: string;
  trigger: TriggerRule;
  action: string;                    // JavaScript code to execute
  dependencies: string[];
}

export interface FormulaParameter {
  name: string;
  type: 'number' | 'string' | 'boolean';
  required: boolean;
  description?: string;
  defaultValue?: any;
}

export interface GlobalValidation {
  condition: string;                 // JavaScript boolean expression
  message: string;
  dependencies: string[];
}

export interface ValidationMessages {
  required?: string;
  invalid?: string;
  custom?: { [key: string]: string };
}

// ============================================================================
// UTILITY & HELPER TYPES
// ============================================================================

export type ToolDefinitionDraft = Partial<ToolDefinition> & {
  id: string;
  metadata: Partial<ToolMetadata> & { title: string };
};

export interface ToolDefinitionUpdate {
  id: string;
  updates: Partial<ToolDefinition>;
  timestamp: number;
}

export interface ToolDefinitionValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;                      // JSON path to the error
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
} 