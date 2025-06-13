'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Eye, CheckCircle, AlertCircle } from 'lucide-react';
// import ProductToolRenderer from '@/components/product-tools/product-tool-renderer'; // REMOVED - transitioning to React components

// ============================================================================
// PRODUCT TOOL PUBLIC PAGE
// ============================================================================

export default function ProductToolPage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [tool, setTool] = useState<ProductToolDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchTool = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // TODO: Implement getBySlug endpoint
        const response = await fetch(`/api/product-tools/slug/${slug}`);
        
        if (!response.ok) {
          throw new Error('Tool not found');
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.message || 'Failed to load tool');
        }
        
        setTool(data.data);
      } catch (err) {
        console.error('Error fetching tool:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tool');
      } finally {
        setLoading(false);
      }
    };

    fetchTool();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading tool...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Tool Not Found
                </h2>
                <p className="text-gray-600 mb-4">
                  {error || 'The requested tool could not be found.'}
                </p>
                <a
                  href="/tools"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Browse All Tools
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tool Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {tool.metadata.title}
                  </h1>
                  <Badge variant={tool.status === 'published' ? 'default' : 'secondary'}>
                    {tool.status}
                  </Badge>
                </div>
                
                <p className="text-gray-600 mb-4">
                  {tool.metadata.description}
                </p>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>Created by {tool.createdBy}</span>
                  </div>
                  
                  {tool.metadata.estimatedCompletionTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{tool.metadata.estimatedCompletionTime} min</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    <span>{tool.metadata.type}</span>
                  </div>
                </div>
                
                {tool.metadata.tags && tool.metadata.tags.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    {tool.metadata.tags?.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tool Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Placeholder for the removed ProductToolRenderer */}
        </div>
      </div>
    </div>
  );
} 