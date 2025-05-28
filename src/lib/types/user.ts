// TODO: Define comprehensive user types for the Keyvex platform

export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  preferences: UserPreferences;
  usage: UsageStats;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  metadata: Record<string, any>;
}

export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  dashboard: DashboardPreferences;
  metadata: Record<string, any>;
}

export interface NotificationPreferences {
  email: {
    toolCompleted: boolean;
    newLead: boolean;
    weeklyReport: boolean;
    productUpdates: boolean;
    marketing: boolean;
  };
  inApp: {
    toolCompleted: boolean;
    newLead: boolean;
    systemUpdates: boolean;
  };
  webhook?: {
    enabled: boolean;
    url?: string;
    events: string[];
  };
}

export interface PrivacyPreferences {
  profileVisibility: 'public' | 'private';
  allowAnalytics: boolean;
  allowMarketing: boolean;
  dataRetention: number; // days
  exportData: boolean;
}

export interface DashboardPreferences {
  defaultView: 'grid' | 'list';
  sortBy: 'name' | 'created' | 'updated' | 'views' | 'leads';
  sortOrder: 'asc' | 'desc';
  itemsPerPage: number;
  showAnalytics: boolean;
  widgets: DashboardWidget[];
}

export interface DashboardWidget {
  id: string;
  type: 'tools' | 'analytics' | 'leads' | 'activity' | 'quick-actions';
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: Record<string, any>;
  visible: boolean;
}

export interface UsageStats {
  toolsCreated: number;
  toolsPublished: number;
  totalViews: number;
  totalLeads: number;
  currentPeriod: PeriodUsage;
  limits: UsageLimits;
  lastReset: Date;
}

export interface PeriodUsage {
  toolsCreated: number;
  aiRequests: number;
  storageUsed: number; // bytes
  bandwidthUsed: number; // bytes
  customDomains: number;
  teamMembers: number;
}

export interface UsageLimits {
  toolsPerMonth: number;
  aiRequestsPerMonth: number;
  storageLimit: number; // bytes
  bandwidthLimit: number; // bytes
  customDomains: number;
  teamMembers: number;
  advancedFeatures: string[];
}

export interface UserSubscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialStart?: Date;
  trialEnd?: Date;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  paymentMethod?: PaymentMethod;
  invoices: Invoice[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  dueDate: Date;
  paidAt?: Date;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  createdAt: Date;
}

export interface UserActivity {
  id: string;
  userId: string;
  type: ActivityType;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export type ActivityType = 
  | 'login'
  | 'logout'
  | 'tool_created'
  | 'tool_published'
  | 'tool_deleted'
  | 'lead_captured'
  | 'subscription_changed'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'profile_updated'
  | 'settings_changed'
  | 'export_requested'
  | 'api_key_created'
  | 'api_key_deleted';

export interface UserSession {
  id: string;
  userId: string;
  sessionToken: string;
  deviceInfo: DeviceInfo;
  location?: LocationInfo;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile';
  os: string;
  browser: string;
  version: string;
  screenResolution?: string;
}

export interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface UserTeam {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: TeamMember[];
  subscription: UserSubscription;
  settings: TeamSettings;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  permissions: TeamPermission[];
  invitedAt: Date;
  joinedAt?: Date;
  invitedBy: string;
  status: 'pending' | 'active' | 'suspended';
}

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type TeamPermission = 
  | 'create_tools'
  | 'edit_tools'
  | 'delete_tools'
  | 'publish_tools'
  | 'view_analytics'
  | 'manage_leads'
  | 'manage_team'
  | 'manage_billing'
  | 'manage_settings';

export interface TeamSettings {
  allowMemberInvites: boolean;
  defaultRole: TeamRole;
  requireApproval: boolean;
  brandingEnabled: boolean;
  customDomain?: string;
  ssoEnabled: boolean;
  ssoProvider?: string;
  auditLogRetention: number; // days
}

export interface UserApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  hashedKey: string;
  permissions: ApiPermission[];
  lastUsed?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  metadata: Record<string, any>;
}

export type ApiPermission = 
  | 'read_tools'
  | 'write_tools'
  | 'read_leads'
  | 'write_leads'
  | 'read_analytics'
  | 'manage_webhooks';

export interface UserIntegration {
  id: string;
  userId: string;
  type: IntegrationType;
  name: string;
  config: IntegrationConfig;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
  syncErrors?: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export type IntegrationType = 
  | 'mailchimp'
  | 'convertkit'
  | 'hubspot'
  | 'salesforce'
  | 'zapier'
  | 'webhook'
  | 'google_analytics'
  | 'facebook_pixel'
  | 'custom';

export interface IntegrationConfig {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  webhookUrl?: string;
  settings: Record<string, any>;
  fieldMappings?: FieldMapping[];
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
  required: boolean;
}

export interface UserExport {
  id: string;
  userId: string;
  type: ExportType;
  format: ExportFormat;
  status: ExportStatus;
  downloadUrl?: string;
  expiresAt?: Date;
  requestedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  metadata: Record<string, any>;
}

export type ExportType = 'all_data' | 'tools' | 'leads' | 'analytics' | 'activity';

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

// TODO: Add user onboarding types
// TODO: Define user feedback and support types
// TODO: Add user referral and affiliate types
// TODO: Define user compliance and audit types
// TODO: Add user backup and recovery types 