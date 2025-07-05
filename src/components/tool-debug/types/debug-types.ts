// ============================================================================
// TOOL DEBUG SYSTEM - TYPE DEFINITIONS
// Comprehensive types for debugging generated tools in the workbench
// ============================================================================

export type DebugEventType = 
  | 'click'
  | 'input_change'
  | 'state_change'
  | 'function_call'
  | 'error'
  | 'render'
  | 'calculation';

export type DebugSeverity = 'info' | 'warning' | 'error' | 'success';

// Core debug event structure
export interface DebugEvent {
  id: string;
  timestamp: number;
  type: DebugEventType;
  severity: DebugSeverity;
  message: string;
  data: Record<string, any>;
  elementInfo?: ElementInfo;
  stackTrace?: string;
  correlationId?: string; // Link related events
}

// UI element information
export interface ElementInfo {
  id?: string;
  className?: string;
  tagName: string;
  textContent?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

// State change tracking
export interface StateChangeEvent extends DebugEvent {
  type: 'state_change';
  data: {
    variableName: string;
    previousValue: any;
    newValue: any;
    changeType: 'set' | 'update' | 'reset';
    trigger?: string; // What caused this change
  };
}

// User interaction tracking
export interface InteractionEvent extends DebugEvent {
  type: 'click' | 'input_change';
  data: {
    eventType: string;
    value?: any;
    previousValue?: any;
    inputType?: string;
  };
}

// Function execution tracking
export interface FunctionCallEvent extends DebugEvent {
  type: 'function_call';
  data: {
    functionName: string;
    parameters: any[];
    returnValue: any;
    executionTime: number;
    success: boolean;
    error?: string;
  };
}

// Error tracking
export interface ErrorEvent extends DebugEvent {
  type: 'error';
  severity: 'error';
  data: {
    errorType: string;
    errorMessage: string;
    component?: string;
    recoverable: boolean;
    userAction?: string; // What the user was doing when error occurred
  };
}

// Calculation tracking (specific to business logic tools)
export interface CalculationEvent extends DebugEvent {
  type: 'calculation';
  data: {
    calculationType: string;
    inputs: Record<string, any>;
    outputs: Record<string, any>;
    formula?: string;
    steps?: Array<{ step: string; value: any }>;
    duration: number;
  };
}

// Current tool state snapshot
export interface ToolState {
  variables: Record<string, {
    value: any;
    type: string;
    lastChanged: number;
    changeCount: number;
  }>;
  errors: ErrorEvent[];
  performance: PerformanceMetrics;
  lastActivity: number;
}

// Performance monitoring
export interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  memoryUsage?: number;
  eventCount: number;
  errorCount: number;
  warningCount: number;
}

// Debug configuration
export interface DebugConfig {
  enabled: boolean;
  eventTypes: DebugEventType[];
  maxEvents: number;
  autoScroll: boolean;
  showTimestamps: boolean;
  highlightErrors: boolean;
  collectPerformance: boolean;
  exportEnabled: boolean;
}

// Debug session data (for export/analysis)
export interface DebugSession {
  sessionId: string;
  toolId: string;
  toolMetadata: {
    title: string;
    type: string;
    agentVersion?: string;
    generatedAt: number;
  };
  startTime: number;
  endTime?: number;
  events: DebugEvent[];
  finalState: ToolState;
  config: DebugConfig;
  userAgent: string;
  browserInfo?: {
    viewport: { width: number; height: number };
    browser: string;
    version: string;
  };
}

// Transpilation format detection
export interface TranspilationFormatInfo {
  isTranspiled: boolean;
  hasImports: boolean;
  hasReactCreateElement: boolean;
  format: 'jsx-transpiled' | 'createElement' | 'jsx-raw' | 'unknown';
  estimatedOriginalFormat: string;
}

export interface CalculationFunctionDetection {
  arrowFunctions: string[];
  functionDeclarations: string[];
  calculationVars: string[];
  totalCount: number;
}

export interface TranspilationInfo {
  format: TranspilationFormatInfo;
  calculations: CalculationFunctionDetection;
}

// Hook return types
export interface UseToolDebuggerReturn {
  events: DebugEvent[];
  currentState: ToolState;
  config: DebugConfig;
  transpilationInfo: TranspilationInfo | null;
  logEvent: (event: Omit<DebugEvent, 'id' | 'timestamp'>) => void;
  clearEvents: () => void;
  exportSession: () => DebugSession;
  updateConfig: (newConfig: Partial<DebugConfig>) => void;
  isEnabled: boolean;
}

export interface UseEventLoggerReturn {
  logClick: (element: HTMLElement, additionalData?: Record<string, any>) => void;
  logInputChange: (element: HTMLInputElement, previousValue: any, newValue: any) => void;
  logStateChange: (variableName: string, previousValue: any, newValue: any, trigger?: string) => void;
  logFunctionCall: (functionName: string, params: any[], result: any, executionTime: number) => void;
  logError: (error: Error, context?: Record<string, any>) => void;
  logCalculation: (type: string, inputs: Record<string, any>, outputs: Record<string, any>, steps?: any[]) => void;
}

// Component props
export interface ToolDebugPanelProps {
  toolId?: string;
  componentCode?: string;
  metadata?: {
    title: string;
    description?: string;
    type?: string;
    version?: string;
    slug?: string;
  };
  onDebugEvent?: (event: DebugEvent) => void;
  className?: string;
}

export interface EventLoggerProps {
  events: DebugEvent[];
  onClear: () => void;
  onExport?: () => void;
  maxHeight?: string;
  showFilters?: boolean;
  className?: string;
}

export interface StateInspectorProps {
  currentState: ToolState;
  onStateEdit?: (variable: string, newValue: any) => void;
  readOnly?: boolean;
  className?: string;
}

export interface DebugControlPanelProps {
  config: DebugConfig;
  onConfigChange: (newConfig: Partial<DebugConfig>) => void;
  onClearAll: () => void;
  onExport?: () => void;
  className?: string;
}

// Utility types
export type EventFilter = {
  types: DebugEventType[];
  severity: DebugSeverity[];
  searchText?: string;
  timeRange?: { start: number; end: number };
};

export type DebugStats = {
  totalEvents: number;
  eventsByType: Record<DebugEventType, number>;
  eventsBySeverity: Record<DebugSeverity, number>;
  averageEventInterval: number;
  sessionDuration: number;
  errorRate: number;
};
