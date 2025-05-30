// Product Tool Types - Dynamic tool generation system for customer-facing tools
// These are the interactive widgets/calculators/assessments that users engage with

// ============================================================================
// CORE PRODUCT TOOL DEFINITION
// ============================================================================

export interface ProductToolDefinition {
  id: string;
  slug: string;                       // URL-friendly identifier
  version: string;                    // Schema version for compatibility
  status: ProductToolStatus;
  metadata: ProductToolMetadata;
  layout: LayoutDefinition;
  components: ComponentDefinition[];
  styling: StylingDefinition;
  logic: LogicDefinition;
  validation: ValidationRules;
  analytics: AnalyticsConfig;
  createdAt: number;
  updatedAt: number;
  createdBy: string;                  // User ID
  organizationId?: string;            // For multi-tenant support
}

export type ProductToolStatus = 'draft' | 'published' | 'archived' | 'testing';

// ============================================================================
// PRODUCT TOOL METADATA
// ============================================================================

export interface ProductToolMetadata {
  title: string;
  description: string;
  shortDescription?: string;          // For cards/previews
  type: ProductToolType;
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
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    ogImage?: string;
  };
  sharing?: {
    enabled: boolean;
    embedEnabled: boolean;
    socialSharing: boolean;
  };
}

export type ProductToolType = 
  | 'calculator' 
  | 'quiz' 
  | 'assessment' 
  | 'form' 
  | 'dashboard' 
  | 'configurator'
  | 'estimator'
  | 'planner'
  | 'analyzer'
  | 'generator'
  | 'custom';

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
  | 'text-input' | 'number-input' | 'email-input' | 'phone-input'
  | 'textarea' | 'select' | 'multi-select' | 'radio-group' | 'checkbox-group'
  | 'slider' | 'range-slider' | 'date-picker' | 'file-upload'
  | 'color-picker' | 'rating' | 'toggle' | 'currency-input'
  
  // Display Components
  | 'text' | 'heading' | 'paragraph' | 'list' | 'table' | 'card' | 'badge'
  | 'progress-bar' | 'gauge' | 'metric-display' | 'icon' | 'image' | 'divider'
  
  // Interactive Components
  | 'button' | 'button-group' | 'link' | 'tab-group' | 'accordion' | 'modal'
  
  // Chart Components
  | 'line-chart' | 'bar-chart' | 'pie-chart' | 'gauge-chart' | 'area-chart'
  | 'donut-chart' | 'radar-chart' | 'funnel-chart'
  
  // Layout Components
  | 'container' | 'grid' | 'flex' | 'stack' | 'spacer' | 'section'
  
  // Business Logic Components
  | 'calculation-display' | 'result-summary' | 'comparison-table'
  | 'recommendation' | 'score-display' | 'category-result'
  
  // Custom Components
  | 'custom';

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
  
  // Enhanced background styling options
  backgroundType?: 'solid' | 'gradient' | 'pattern' | 'texture' | 'dark';
  backgroundPattern?: 'dots' | 'grid' | 'diagonal' | 'waves';
  patternColor?: string;
  patternOpacity?: number;
  backgroundTexture?: 'paper' | 'fabric' | 'concrete' | 'wood';
  textureOpacity?: number;
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
// ANALYTICS & TRACKING
// ============================================================================

export interface AnalyticsConfig {
  enabled: boolean;
  trackingEvents: TrackingEvent[];
  conversionGoals?: ConversionGoal[];
  heatmapEnabled?: boolean;
  sessionRecordingEnabled?: boolean;
}

export interface TrackingEvent {
  id: string;
  name: string;
  trigger: 'component-interaction' | 'calculation' | 'completion' | 'custom';
  componentId?: string;
  properties?: Record<string, any>;
}

export interface ConversionGoal {
  id: string;
  name: string;
  description: string;
  trigger: 'completion' | 'specific-value' | 'custom';
  condition?: string;                // JavaScript condition
  value?: number;                    // Goal value
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
// DATABASE & API TYPES
// ============================================================================

export interface ProductToolRecord {
  PK: string;                        // PRODUCT_TOOL#{id}
  SK: string;                        // VERSION#{version}
  GSI1PK: string;                    // USER#{userId}
  GSI1SK: string;                    // CREATED#{timestamp}
  GSI2PK: string;                    // STATUS#{status}
  GSI2SK: string;                    // UPDATED#{timestamp}
  
  // Tool data
  id: string;
  slug: string;
  version: string;
  status: ProductToolStatus;
  definition: ProductToolDefinition;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  organizationId?: string;
  
  // Analytics
  viewCount?: number;
  completionCount?: number;
  lastUsed?: number;
}

export interface ProductToolUsageRecord {
  PK: string;                        // USAGE#{toolId}
  SK: string;                        // SESSION#{timestamp}#{sessionId}
  
  toolId: string;
  sessionId: string;
  userId?: string;
  timestamp: number;
  duration?: number;
  completed: boolean;
  completionData?: Record<string, any>;
  analytics: {
    interactions: number;
    calculationsRun: number;
    stepsCompleted: number;
    conversionGoals: string[];
  };
}

export interface ProductToolSearchIndex {
  PK: string;                        // SEARCH#{category}
  SK: string;                        // TOOL#{toolId}
  
  toolId: string;
  title: string;
  description: string;
  category: string;
  type: ProductToolType;
  tags: string[];
  status: ProductToolStatus;
  createdBy: string;
  organizationId?: string;
  popularity: number;                // View count + completion rate
  lastUpdated: number;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateProductToolRequest {
  definition: Omit<ProductToolDefinition, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;
}

export interface UpdateProductToolRequest {
  definition: Partial<ProductToolDefinition>;
}

export interface ProductToolListResponse {
  tools: ProductToolSummary[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ProductToolSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ProductToolType;
  category: string;
  status: ProductToolStatus;
  viewCount: number;
  completionCount: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  organizationId?: string;
}

export interface ProductToolAnalytics {
  toolId: string;
  period: {
    start: number;
    end: number;
  };
  metrics: {
    views: number;
    completions: number;
    conversionRate: number;
    averageDuration: number;
    uniqueUsers: number;
  };
  trends: {
    daily: AnalyticsDataPoint[];
    popular_components: ComponentUsage[];
    completion_funnel: FunnelStep[];
  };
}

export interface AnalyticsDataPoint {
  date: string;
  views: number;
  completions: number;
}

export interface ComponentUsage {
  componentId: string;
  interactions: number;
  completionRate: number;
}

export interface FunnelStep {
  stepId: string;
  stepName: string;
  entrants: number;
  exiters: number;
  conversionRate: number;
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
// HELPER TYPES
// ============================================================================

export type ProductToolDefinitionDraft = Partial<ProductToolDefinition> & {
  metadata: Partial<ProductToolMetadata> & { title: string };
};

export interface ProductToolValidationResult {
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