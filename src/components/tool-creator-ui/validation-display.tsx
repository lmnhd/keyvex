'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  Wrench,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

interface ValidationIssue {
  id: string;
  issue: string;
  category: string;
  severity: 'warning' | 'error' | 'info';
  details?: string;
  codeSnippet?: string;
  autoFixable: boolean;
}

interface ValidationDisplayProps {
  issues: ValidationIssue[];
  blockers: Array<{
    issue: string;
    category: string;
    details?: string;
  }>;
  isVisible: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  canComplete: boolean;
}

export function ValidationDisplay({
  issues,
  blockers,
  isVisible,
  onClose,
  isDarkMode = false,
  canComplete
}: ValidationDisplayProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!isVisible || (issues.length === 0 && blockers.length === 0)) {
    return null;
  }

  const errorCount = issues.filter(i => i.severity === 'error').length + blockers.length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;
  const autoFixableCount = issues.filter(i => i.autoFixable).length;

  const getSeverityIcon = (severity: ValidationIssue['severity']) => {
    switch (severity) {
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: ValidationIssue['severity']) => {
    switch (severity) {
      case 'error': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'react-keys': 'bg-purple-100 text-purple-800',
      'style-mapping': 'bg-green-100 text-green-800',
      'execution': 'bg-red-100 text-red-800',
      'undefined-values': 'bg-orange-100 text-orange-800',
      'syntax': 'bg-pink-100 text-pink-800',
      'component-structure': 'bg-indigo-100 text-indigo-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className={`
      ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      ${!canComplete ? 'border-red-300 bg-red-50' : errorCount > 0 ? 'border-yellow-300 bg-yellow-50' : 'border-blue-300 bg-blue-50'}
      shadow-lg
    `}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {!canComplete ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : errorCount > 0 ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <CardTitle className={`text-lg ${isDarkMode ? 'text-gray-50' : 'text-gray-900'}`}>
                Component Validation
              </CardTitle>
            </div>
            
            <div className="flex items-center gap-2">
              {errorCount > 0 && (
                <Badge className="bg-red-100 text-red-800 border-red-300">
                  {errorCount} Error{errorCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                  {warningCount} Warning{warningCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {infoCount > 0 && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                  {infoCount} Info
                </Badge>
              )}
              {autoFixableCount > 0 && (
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <Wrench className="h-3 w-3 mr-1" />
                  {autoFixableCount} Auto-fixable
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <CardDescription className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
          {!canComplete 
            ? 'Tool has blocking errors that must be fixed before completion'
            : errorCount > 0 
            ? 'Tool has validation issues that should be addressed'
            : 'Tool validation passed - ready for use'
          }
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {/* Blocking errors first */}
            {blockers.map((blocker, index) => (
              <div key={`blocker-${index}`} className="p-3 border border-red-300 rounded-lg bg-red-50">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium text-red-800">{blocker.issue}</h4>
                    {blocker.details && (
                      <p className="text-sm text-red-700 mt-1">{blocker.details}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-800 border-red-300">BLOCKER</Badge>
                  <Badge className={getCategoryColor(blocker.category)}>
                    {blocker.category.replace(/-/g, ' ')}
                  </Badge>
                </div>
              </div>
            ))}

            {/* Regular validation issues */}
            {issues.map((issue) => (
              <div key={issue.id} className={`p-3 border rounded-lg ${
                issue.severity === 'error' ? 'border-red-300 bg-red-50' :
                issue.severity === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                'border-blue-300 bg-blue-50'
              }`}>
                <div className="flex items-start gap-2 mb-2">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1">
                    <h4 className={`font-medium ${
                      issue.severity === 'error' ? 'text-red-800' :
                      issue.severity === 'warning' ? 'text-yellow-800' :
                      'text-blue-800'
                    }`}>
                      {issue.issue}
                    </h4>
                    {issue.details && (
                      <p className={`text-sm mt-1 ${
                        issue.severity === 'error' ? 'text-red-700' :
                        issue.severity === 'warning' ? 'text-yellow-700' :
                        'text-blue-700'
                      }`}>
                        {issue.details}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getSeverityColor(issue.severity)}>
                    {issue.severity.toUpperCase()}
                  </Badge>
                  <Badge className={getCategoryColor(issue.category)}>
                    {issue.category.replace(/-/g, ' ')}
                  </Badge>
                  {issue.autoFixable && (
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      <Wrench className="h-3 w-3 mr-1" />
                      Auto-fixable
                    </Badge>
                  )}
                </div>

                {issue.codeSnippet && (
                  <details className="text-xs">
                    <summary className={`cursor-pointer hover:text-foreground ${
                      issue.severity === 'error' ? 'text-red-600' :
                      issue.severity === 'warning' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`}>
                      View code snippet
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto text-xs">
                      {issue.codeSnippet}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
} 
