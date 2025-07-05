'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';

export default function BreakpointTestPage() {
  const [result, setResult] = useState<string>('');

  const testBreakpoint = async () => {
    try {
      const response = await fetch('/api/debug/test-breakpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Testing breakpoint' })
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-6 w-6" />
              Simple Breakpoint Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set a breakpoint in: <code>/api/debug/test-breakpoint/route.ts</code>
            </p>
            
            <Button onClick={testBreakpoint} className="w-full">
              Test API Breakpoint
            </Button>
            
            {result && (
              <div className="p-3 bg-gray-100 rounded">
                <pre className="text-sm">{result}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
