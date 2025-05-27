// Tools List Component - Display and manage user tools

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Calculator,
  HelpCircle,
  ClipboardList,
  BarChart3,
  MoreHorizontal,
  Eye,
  Edit,
  Copy,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  Plus
} from 'lucide-react';

interface Tool {
  id: string;
  title: string;
  description?: string;
  type: 'calculator' | 'quiz' | 'assessment' | 'survey';
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  analytics: {
    views: number;
    completions: number;
    leads: number;
  };
}

interface ToolsListProps {
  onCreateNew?: () => void;
  onEditTool?: (toolId: string) => void;
  onViewTool?: (toolId: string) => void;
}

const TOOL_ICONS = {
  calculator: Calculator,
  quiz: HelpCircle,
  assessment: ClipboardList,
  survey: BarChart3
};

const STATUS_COLORS = {
  draft: 'secondary',
  published: 'default',
  archived: 'outline'
} as const;

export function ToolsList({ onCreateNew, onEditTool, onViewTool }: ToolsListProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // TODO: Replace with actual API call
  const fetchTools = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const response = await fetch(`/api/tools?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }

      const result = await response.json();
      
      if (result.success) {
        setTools(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch tools');
      }

    } catch (error) {
      console.error('Fetch tools error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch tools');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTool = async (toolId: string) => {
    if (!confirm('Are you sure you want to delete this tool? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/tools?toolId=${toolId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete tool');
      }

      const result = await response.json();
      
      if (result.success) {
        setTools(tools.filter(tool => tool.id !== toolId));
      } else {
        throw new Error(result.error || 'Failed to delete tool');
      }

    } catch (error) {
      console.error('Delete tool error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete tool');
    }
  };

  const duplicateTool = async (toolId: string) => {
    try {
      // TODO: Implement tool duplication
      console.log('Duplicating tool:', toolId);
      // For now, just refresh the list
      await fetchTools();
    } catch (error) {
      console.error('Duplicate tool error:', error);
      setError(error instanceof Error ? error.message : 'Failed to duplicate tool');
    }
  };

  useEffect(() => {
    fetchTools();
  }, [searchTerm, statusFilter, typeFilter]);

  const filteredTools = tools.filter(tool => {
    const matchesSearch = !searchTerm || 
      tool.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || tool.status === statusFilter;
    const matchesType = typeFilter === 'all' || tool.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getConversionRate = (analytics: Tool['analytics']) => {
    if (analytics.views === 0) return 0;
    return Math.round((analytics.leads / analytics.views) * 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Tools</h2>
          <p className="text-muted-foreground">
            Manage your interactive tools and track their performance
          </p>
        </div>
        {onCreateNew && (
          <Button onClick={onCreateNew} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Create New Tool</span>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">Search tools</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search tools..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="calculator">Calculator</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="assessment">Assessment</SelectItem>
                  <SelectItem value="survey">Survey</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Tools List */}
      {filteredTools.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">No tools found</h3>
                <p className="text-muted-foreground text-sm">
                  {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                    ? 'Try adjusting your filters or search terms.'
                    : 'Get started by creating your first interactive tool.'}
                </p>
              </div>
              {onCreateNew && !searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
                <Button onClick={onCreateNew} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Tool
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTools.map((tool) => {
            const IconComponent = TOOL_ICONS[tool.type];
            const conversionRate = getConversionRate(tool.analytics);

            return (
              <Card key={tool.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-lg truncate">{tool.title}</h3>
                          <Badge variant={STATUS_COLORS[tool.status]}>
                            {tool.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {tool.type}
                          </Badge>
                        </div>
                        {tool.description && (
                          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                            {tool.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Eye className="h-4 w-4" />
                            <span>{tool.analytics.views.toLocaleString()} views</span>
                          </div>
                          <div>
                            <span>{tool.analytics.completions.toLocaleString()} completions</span>
                          </div>
                          <div>
                            <span>{tool.analytics.leads.toLocaleString()} leads</span>
                          </div>
                          <div>
                            <span>{conversionRate}% conversion</span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Updated {formatDate(tool.updatedAt)}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {onViewTool && (
                          <DropdownMenuItem onClick={() => onViewTool(tool.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Tool
                          </DropdownMenuItem>
                        )}
                        {onEditTool && (
                          <DropdownMenuItem onClick={() => onEditTool(tool.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Tool
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => duplicateTool(tool.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {tool.status === 'published' && (
                          <DropdownMenuItem>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Live Tool
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => deleteTool(tool.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Tool
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
} 