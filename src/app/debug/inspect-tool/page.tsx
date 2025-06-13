'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Code, AlertCircle, FileText } from 'lucide-react';

interface ToolCodeInfo {
  toolId: string;
  title: string;
  componentCode: string;
  codeLength: number;
  hasImports: boolean;
  firstLines: string[];
}

export default function InspectToolPage() {
  const [toolId, setToolId] = useState('');
  const [userId, setUserId] = useState('lem1');
  const [toolInfo, setToolInfo] = useState<ToolCodeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInspect = async () => {
    if (!toolId.trim()) {
      setError('Please enter a tool ID');
      return;
    }

    setLoading(true);
    setError(null);
    setToolInfo(null);

    try {
      const response = await fetch(`/api/debug/get-tool-code?toolId=${encodeURIComponent(toolId)}&userId=${encodeURIComponent(userId)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch tool');
      }

      const data = await response.json();
      setToolInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInspect();
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Tool Code Inspector</h1>
        <p className="text-gray-600">Debug and inspect component code for any tool ID</p>
      </div>

      {/* Input Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Tool Lookup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="toolId">Tool ID</Label>
              <Input
                id="toolId"
                placeholder="Enter tool ID (from logs or database)"
                value={toolId}
                onChange={(e) => setToolId(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <div>
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="User ID (default: lem1)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleInspect} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Loading...' : 'Inspect Tool'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tool Information */}
      {toolInfo && (
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Tool Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Tool ID</Label>
                  <p className="text-sm text-gray-600 mt-1">{toolInfo.toolId}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Title</Label>
                  <p className="text-sm text-gray-600 mt-1">{toolInfo.title}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Code Length</Label>
                  <p className="text-sm text-gray-600 mt-1">{toolInfo.codeLength.toLocaleString()} characters</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Has Imports</Label>
                  <div className="mt-1">
                    <Badge variant={toolInfo.hasImports ? "destructive" : "default"}>
                      {toolInfo.hasImports ? "❌ HAS IMPORTS" : "✅ NO IMPORTS"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* First Lines Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Component Code Preview (First 10 Lines)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {toolInfo.firstLines.map((line, index) => (
                  <div key={index} className={`${line.includes('import ') ? 'bg-red-100 px-1 rounded' : ''}`}>
                    <span className="text-gray-400 select-none">{String(index + 1).padStart(2, ' ')}:</span> {line}
                  </div>
                ))}
              </pre>
            </CardContent>
          </Card>

          {/* Full Component Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Full Component Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-xs max-h-96">
                {toolInfo.componentCode}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 