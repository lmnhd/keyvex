// Validation Issues Tracking Types

export interface ValidationIssue {
  id: string;
  toolId: string;
  toolTitle: string;
  severity: 'warning' | 'error' | 'info';
  category: 'react-keys' | 'style-mapping' | 'execution' | 'undefined-values' | 'syntax' | 'component-structure';
  issue: string;
  details?: string;
  codeSnippet?: string;
  timestamp: number;
  resolved: boolean;
  autoFixable: boolean;
}

export interface ValidationReport {
  toolId: string;
  toolTitle: string;
  timestamp: number;
  issues: ValidationIssue[];
  overallScore: number; // 0-100 quality score
  recommendations: string[];
}

export interface ValidationTracker {
  addIssue(issue: Omit<ValidationIssue, 'id' | 'timestamp'>): string;
  getIssuesForTool(toolId: string): ValidationIssue[];
  getAllUnresolvedIssues(): ValidationIssue[];
  generateReport(toolId: string): ValidationReport;
  markResolved(issueId: string): void;
  getCommonIssues(): { category: string; count: number; examples: string[] }[];
} 