// Validation Issues Tracker Implementation

import { ValidationIssue, ValidationReport, ValidationTracker } from '@/lib/types/validation';

class ValidationTrackerImpl implements ValidationTracker {
  private issues: ValidationIssue[] = [];
  private readonly STORAGE_KEY = 'keyvex_validation_issues';

  constructor() {
    this.loadFromStorage();
  }

  addIssue(issue: Omit<ValidationIssue, 'id' | 'timestamp'>): string {
    const newIssue: ValidationIssue = {
      ...issue,
      id: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.issues.push(newIssue);
    this.saveToStorage();
    
    console.log(`📋 VALIDATION TRACKED: ${newIssue.severity.toUpperCase()} - ${newIssue.issue}`);
    return newIssue.id;
  }

  getIssuesForTool(toolId: string): ValidationIssue[] {
    return this.issues.filter(issue => issue.toolId === toolId);
  }

  getAllUnresolvedIssues(): ValidationIssue[] {
    return this.issues.filter(issue => !issue.resolved);
  }

  generateReport(toolId: string): ValidationReport {
    const toolIssues = this.getIssuesForTool(toolId);
    const tool = toolIssues[0]; // Get tool info from first issue
    
    // Calculate quality score (100 - penalty points)
    let score = 100;
    toolIssues.forEach(issue => {
      switch (issue.severity) {
        case 'error': score -= 15; break;
        case 'warning': score -= 5; break;
        case 'info': score -= 1; break;
      }
    });
    score = Math.max(0, score);

    // Generate recommendations
    const recommendations = this.generateRecommendations(toolIssues);

    return {
      toolId,
      toolTitle: tool?.toolTitle || 'Unknown Tool',
      timestamp: Date.now(),
      issues: toolIssues,
      overallScore: score,
      recommendations
    };
  }

  markResolved(issueId: string): void {
    const issue = this.issues.find(i => i.id === issueId);
    if (issue) {
      issue.resolved = true;
      this.saveToStorage();
      console.log(`✅ VALIDATION RESOLVED: ${issue.issue}`);
    }
  }

  getCommonIssues(): { category: string; count: number; examples: string[] }[] {
    const categoryMap = new Map<string, { count: number; examples: string[] }>();
    
    this.issues.forEach(issue => {
      if (!categoryMap.has(issue.category)) {
        categoryMap.set(issue.category, { count: 0, examples: [] });
      }
      const entry = categoryMap.get(issue.category)!;
      entry.count++;
      if (entry.examples.length < 3) {
        entry.examples.push(issue.issue);
      }
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data
    })).sort((a, b) => b.count - a.count);
  }

  // Bulk operations for bug fixing
  getAutoFixableIssues(): ValidationIssue[] {
    return this.issues.filter(issue => issue.autoFixable && !issue.resolved);
  }

  getIssuesByCategory(category: ValidationIssue['category']): ValidationIssue[] {
    return this.issues.filter(issue => issue.category === category && !issue.resolved);
  }

  exportIssues(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalIssues: this.issues.length,
      unresolvedIssues: this.getAllUnresolvedIssues().length,
      issues: this.issues
    }, null, 2);
  }

  private generateRecommendations(issues: ValidationIssue[]): string[] {
    const recommendations = [];
    
    const reactKeysIssues = issues.filter(i => i.category === 'react-keys');
    if (reactKeysIssues.length > 0) {
      recommendations.push('Add unique key props to array elements to improve React performance');
    }

    const styleIssues = issues.filter(i => i.category === 'style-mapping');
    if (styleIssues.length > 0) {
      recommendations.push('Add data-style-id attributes to enable dynamic styling features');
    }

    const executionIssues = issues.filter(i => i.category === 'execution');
    if (executionIssues.length > 0) {
      recommendations.push('Fix JavaScript execution errors to ensure component stability');
    }

    if (issues.filter(i => i.severity === 'error').length > 0) {
      recommendations.push('Address critical errors first before deploying to production');
    }

    return recommendations;
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.issues));
      }
    } catch (error) {
      console.error('Failed to save validation issues to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          this.issues = JSON.parse(stored);
        }
      } else {
        // On the server or if localStorage is not available, initialize with empty issues
        this.issues = [];
      }
    } catch (error) {
      console.error('Failed to load validation issues from storage:', error);
      this.issues = [];
    }
  }
}

// Singleton instance
let trackerInstance: ValidationTrackerImpl | null = null;

export function getValidationTracker(): ValidationTracker {
  if (!trackerInstance) {
    trackerInstance = new ValidationTrackerImpl();
  }
  return trackerInstance;
}

// Helper function to track validation issues easily
export function trackValidationIssue(
  toolId: string,
  toolTitle: string,
  issue: string,
  category: ValidationIssue['category'],
  severity: ValidationIssue['severity'] = 'warning',
  details?: string,
  codeSnippet?: string,
  autoFixable: boolean = false
): string {
  const tracker = getValidationTracker();
  return tracker.addIssue({
    toolId,
    toolTitle,
    issue,
    category,
    severity,
    details,
    codeSnippet,
    resolved: false,
    autoFixable
  });
} 
