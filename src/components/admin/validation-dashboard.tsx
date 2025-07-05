// Admin Validation Dashboard Component - Modular implementation
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, 
  CheckCircle, 
  Info, 
  AlertTriangle,
  Download,
  RefreshCw,
  Wrench,
  BarChart3,
  TestTube
} from 'lucide-react';
import { getValidationTracker } from '@/lib/validation/validation-tracker';
import { ValidationIssue } from '@/lib/types/validation';

export function AdminValidationDashboard() {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [commonIssues, setCommonIssues] = useState<{ category: string; count: number; examples: string[] }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadValidationData();
  }, []);

  const loadValidationData = () => {
    setLoading(true);
    try {
      const tracker = getValidationTracker();
      const allIssues = showResolved ? tracker.getAllUnresolvedIssues() : [...tracker.getAllUnresolvedIssues()];
      setIssues(allIssues);
      setCommonIssues(tracker.getCommonIssues());
    } catch (error) {
      console.error('Failed to load validation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = issues.filter(issue => {
    if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && issue.severity !== selectedSeverity) return false;
    return true;
  });

  const getSeverityIcon = (severity: ValidationIssue['severity']) => {
    switch (severity) {
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: ValidationIssue['severity']) => {
    const colors = {
      error: 'bg-red-100 text-red-800 border-red-300',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      info: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[severity];
  };

  const getCategoryBadge = (category: ValidationIssue['category']) => {
    const colors = {
      'react-keys': 'bg-purple-100 text-purple-800',
      'style-mapping': 'bg-green-100 text-green-800',
      'execution': 'bg-red-100 text-red-800',
      'undefined-values': 'bg-orange-100 text-orange-800',
      'syntax': 'bg-pink-100 text-pink-800',
      'component-structure': 'bg-indigo-100 text-indigo-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const exportIssues = () => {
    const tracker = getValidationTracker();
    const exportData = JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalIssues: issues.length,
      unresolvedIssues: tracker.getAllUnresolvedIssues().length,
      issues: issues
    }, null, 2);
    
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-issues-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markResolved = (issueId: string) => {
    const tracker = getValidationTracker();
    tracker.markResolved(issueId);
    loadValidationData();
  };

  const autoFixableCount = issues.filter(i => i.autoFixable && !i.resolved).length;
  const errorCount = issues.filter(i => i.severity === 'error' && !i.resolved).length;
  const warningCount = issues.filter(i => i.severity === 'warning' && !i.resolved).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TestTube className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold">Component Validation</h2>
            <p className="text-sm text-muted-foreground">AI-generated component quality tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportIssues}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={loadValidationData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Total Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{issues.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-green-500" />
              Auto-Fixable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{autoFixableCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Common Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Most Common Issues</CardTitle>
          <CardDescription>Top validation issues by frequency</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {commonIssues.slice(0, 5).map((common, index) => (
              <div key={common.category} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                  <Badge className={getCategoryBadge(common.category as ValidationIssue['category'])}>
                    {common.category.replace(/-/g, ' ')}
                  </Badge>
                  <span className="text-sm">{common.examples[0]}</span>
                </div>
                <Badge variant="outline">{common.count} issues</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Category:</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
                aria-label="Filter by category"
              >
                <option value="all">All Categories</option>
                <option value="react-keys">React Keys</option>
                <option value="style-mapping">Style Mapping</option>
                <option value="execution">Execution</option>
                <option value="undefined-values">Undefined Values</option>
                <option value="syntax">Syntax</option>
                <option value="component-structure">Component Structure</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Severity:</label>
              <select 
                value={selectedSeverity} 
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
                aria-label="Filter by severity"
              >
                <option value="all">All Severities</option>
                <option value="error">Errors</option>
                <option value="warning">Warnings</option>
                <option value="info">Info</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? 'Hide' : 'Show'} Resolved
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Issues List */}
      <Card>
        <CardHeader>
          <CardTitle>Issues ({filteredIssues.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredIssues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {loading ? 'Loading issues...' : 'No issues found with current filters'}
              </div>
            ) : (
              filteredIssues.slice(0, 10).map((issue) => (
                <div key={issue.id} className="p-3 border rounded-lg hover:bg-muted/30">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(issue.severity)}
                      <h4 className="font-medium">{issue.issue}</h4>
                      {issue.autoFixable && (
                        <Badge className="bg-green-100 text-green-800">Auto-fixable</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityBadge(issue.severity)}>
                        {issue.severity}
                      </Badge>
                      {!issue.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markResolved(issue.id)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <Badge className={getCategoryBadge(issue.category)}>
                      {issue.category.replace(/-/g, ' ')}
                    </Badge>
                    <span>Tool: {issue.toolTitle}</span>
                    <span>{new Date(issue.timestamp).toLocaleDateString()}</span>
                  </div>

                  {issue.details && (
                    <p className="text-sm text-muted-foreground mb-2">{issue.details}</p>
                  )}

                  {issue.codeSnippet && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View code snippet
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto text-xs">
                        {issue.codeSnippet}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
            {filteredIssues.length > 10 && (
              <div className="text-center text-sm text-muted-foreground">
                ... and {filteredIssues.length - 10} more issues
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
