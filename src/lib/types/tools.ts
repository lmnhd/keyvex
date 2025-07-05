// TODO: Define comprehensive tool types for the Keyvex platform

export interface Tool {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: ToolType;
  status: ToolStatus;
  configuration: ToolConfiguration;
  styling: ToolStyling;
  analytics: ToolAnalytics;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  metadata: Record<string, any>;
}

export type ToolType = 'calculator' | 'quiz' | 'assessment';

export type ToolStatus = 'draft' | 'published' | 'archived' | 'deleted';

export interface ToolConfiguration {
  questions: ToolQuestion[];
  logic: ToolLogic;
  results: ToolResult[];
  settings: ToolSettings;
  metadata: Record<string, any>;
}

export interface ToolQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: ToolQuestionOption[];
  validation: ToolValidation;
  scoring?: ToolQuestionScoring;
  order: number;
  required: boolean;
  conditional?: ConditionalLogic;
  metadata: Record<string, any>;
}

export type QuestionType = 
  | 'multiple-choice' 
  | 'single-choice' 
  | 'scale' 
  | 'text' 
  | 'number' 
  | 'email' 
  | 'boolean' 
  | 'date' 
  | 'file-upload';

export interface ToolQuestionOption {
  id: string;
  text: string;
  value: string | number;
  score?: number;
  nextQuestion?: string;
  metadata: Record<string, any>;
}

export interface ToolValidation {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customValidation?: string;
  errorMessage?: string;
}

export interface ToolQuestionScoring {
  type: 'points' | 'weighted' | 'categorical';
  value: number;
  weight?: number;
  category?: string;
  formula?: string;
}

export interface ConditionalLogic {
  showIf: LogicCondition[];
  hideIf?: LogicCondition[];
  operator: 'AND' | 'OR';
}

export interface LogicCondition {
  questionId: string;
  operator: 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'contains' | 'not-contains';
  value: any;
}

export interface ToolLogic {
  scoringSystem: ScoringSystemConfig;
  resultCalculation: ResultCalculation;
  branching?: BranchingLogic[];
  customFormulas?: CustomFormula[];
  metadata: Record<string, any>;
}

export interface ScoringSystemConfig {
  type: 'simple-sum' | 'weighted-sum' | 'average' | 'custom';
  weights?: Record<string, number>;
  maxScore?: number;
  passingScore?: number;
  formula?: string;
}

export interface ResultCalculation {
  type: 'score-based' | 'category-based' | 'formula-based' | 'rule-based';
  rules: ResultRule[];
  defaultResult?: string;
}

export interface ResultRule {
  id: string;
  conditions: RuleCondition[];
  operator: 'AND' | 'OR';
  resultId: string;
  priority: number;
}

export interface RuleCondition {
  type: 'score' | 'answer' | 'category' | 'custom';
  questionId?: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not-in';
  value: any;
}

export interface BranchingLogic {
  fromQuestionId: string;
  conditions: LogicCondition[];
  toQuestionId: string;
  operator: 'AND' | 'OR';
}

export interface CustomFormula {
  id: string;
  name: string;
  formula: string;
  variables: Record<string, string>;
  description?: string;
}

export interface ToolResult {
  id: string;
  title: string;
  description: string;
  recommendations?: string[];
  scoreRange?: {
    min: number;
    max: number;
  };
  category?: string;
  image?: string;
  callToAction?: CallToAction;
  metadata: Record<string, any>;
}

export interface CallToAction {
  text: string;
  url?: string;
  type: 'link' | 'email' | 'phone' | 'download' | 'custom';
  target?: '_blank' | '_self';
}

export interface ToolSettings {
  allowRetake: boolean;
  showProgress: boolean;
  showScore: boolean;
  requireEmail: boolean;
  requireName: boolean;
  customFields?: CustomField[];
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  metadata: Record<string, any>;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface NotificationSettings {
  emailOnCompletion: boolean;
  emailTemplate?: string;
  webhookUrl?: string;
  integrations: IntegrationSettings[];
}

export interface IntegrationSettings {
  type: 'mailchimp' | 'convertkit' | 'hubspot' | 'salesforce' | 'zapier' | 'webhook';
  enabled: boolean;
  config: Record<string, any>;
}

export interface PrivacySettings {
  collectIP: boolean;
  cookieConsent: boolean;
  dataRetention: number; // days
  gdprCompliant: boolean;
  privacyPolicyUrl?: string;
}

export interface ToolStyling {
  theme: ToolTheme;
  layout: LayoutConfig;
  branding: BrandingConfig;
  customCSS?: string;
  metadata: Record<string, any>;
}

export interface ToolTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
  };
  fonts: {
    heading: FontConfig;
    body: FontConfig;
  };
  spacing: SpacingConfig;
  borderRadius: string;
  shadows: ShadowConfig;
}

export interface FontConfig {
  family: string;
  sizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  weights: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
}

export interface SpacingConfig {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface ShadowConfig {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface LayoutConfig {
  maxWidth: string;
  padding: string;
  questionSpacing: string;
  progressBarStyle: 'bar' | 'steps' | 'percentage' | 'none';
  buttonStyle: 'rounded' | 'square' | 'pill';
  cardStyle: 'flat' | 'elevated' | 'outlined';
}

export interface BrandingConfig {
  logo?: {
    url: string;
    width: number;
    height: number;
    position: 'top-left' | 'top-center' | 'top-right';
  };
  companyName?: string;
  tagline?: string;
  footer?: {
    text: string;
    links: FooterLink[];
  };
}

export interface FooterLink {
  text: string;
  url: string;
  target?: '_blank' | '_self';
}

export interface ToolAnalytics {
  views: number;
  starts: number;
  completions: number;
  abandonment: number;
  averageTime: number; // seconds
  conversionRate: number; // percentage
  leadsCaptured: number;
  lastUpdated: Date;
  detailedStats: DetailedAnalytics;
}

export interface DetailedAnalytics {
  daily: DailyStats[];
  questionAnalytics: QuestionAnalytics[];
  resultDistribution: Record<string, number>;
  deviceBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  geographicData: Record<string, number>;
}

export interface DailyStats {
  date: string;
  views: number;
  starts: number;
  completions: number;
  leads: number;
}

export interface QuestionAnalytics {
  questionId: string;
  views: number;
  answers: number;
  skips: number;
  averageTime: number;
  answerDistribution: Record<string, number>;
}

export interface ToolInteraction {
  id: string;
  toolId: string;
  sessionId?: string;
  userId?: string;
  type: InteractionType;
  data: InteractionData;
  timestamp: Date;
  metadata: Record<string, any>;
}

export type InteractionType = 
  | 'view' 
  | 'start' 
  | 'question-answer' 
  | 'question-skip' 
  | 'complete' 
  | 'abandon' 
  | 'lead-capture' 
  | 'result-view' 
  | 'share' 
  | 'download';

export interface InteractionData {
  questionId?: string;
  answer?: any;
  timeSpent?: number;
  deviceInfo?: DeviceInfo;
  location?: LocationInfo;
  referrer?: string;
  userAgent?: string;
}

export interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile';
  os: string;
  browser: string;
  screenSize: string;
}

export interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

export interface Lead {
  id: string;
  toolId: string;
  email: string;
  name?: string;
  phone?: string;
  customFields: Record<string, any>;
  responses: LeadResponse[];
  score?: number;
  result?: string;
  resultCategory?: string;
  source: string;
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface LeadResponse {
  questionId: string;
  answer: any;
  score?: number;
  timeSpent?: number;
}

// TODO: Add tool template types
// TODO: Define tool sharing and collaboration types
// TODO: Add tool versioning types
// TODO: Define tool marketplace types
// TODO: Add tool export/import types 
