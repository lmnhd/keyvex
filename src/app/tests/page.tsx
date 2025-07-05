// Tests Index Page - Navigation hub for all test pages

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TestTube, 
  Code, 
  Palette, 
  Settings, 
  IterationCw,
  Database,
  Zap,
  ArrowRight,
  FileText,
  Cog,
  Save,
  Wifi,
  Bug
} from 'lucide-react';

const TEST_PAGES = [
  {
    title: 'API Testing',
    description: 'Test all API routes and endpoints before AWS integration',
    path: '/tests/api',
    icon: Code,
    category: 'API',
    status: 'active'
  },
  {
    title: 'API Testing (Legacy)',
    description: 'Legacy API testing interface (backup)',
    path: '/tests/api-legacy',
    icon: Database,
    category: 'API',
    status: 'legacy'
  },
  {
    title: 'UI Components',
    description: 'Test UI components, workflows, and user interactions',
    path: '/tests/ui',
    icon: Palette,
    category: 'UI',
    status: 'active'
  },
  {
    title: 'Dynamic Tools',
    description: 'Test JSX compilation and dynamic component rendering functionality',
    path: '/tests/dynamic-tools',
    icon: Cog,
    category: 'UI',
    status: 'active'
  },
  {
    title: 'Saved Tools',
    description: 'Manage and test saved tools and brainstorms from localStorage',
    path: '/tests/saved-tools',
    icon: Save,
    category: 'UI',
    status: 'active'
  },
  {
    title: 'Validation Dashboard',
    description: 'Track and manage AI-generated component validation issues (now in Admin → Validation tab)',
    path: '/admin',
    icon: TestTube,
    category: 'Admin',
    status: 'active'
  },
  {
    title: 'Model Configuration',
    description: 'Test AI model configurations and provider settings',
    path: '/tests/model-config',
    icon: Settings,
    category: 'AI',
    status: 'active'
  },
  {
    title: 'Multi-Iterator',
    description: 'Test multi-question iterator component functionality',
    path: '/tests/multi-iterator',
    icon: IterationCw,
    category: 'UI',
    status: 'active'
  },
  {
    title: 'Brand Intelligence',
    description: 'Test brand analysis and intelligence features',
    path: '/tests/brand-intelligence',
    icon: Zap,
    category: 'AI',
    status: 'active'
  },
  {
    title: 'Admin Test Data',
    description: 'Generate and manage test data for admin dashboard',
    path: '/tests/admin/test-data',
    icon: FileText,
    category: 'Admin',
    status: 'active'
  },
  {
    title: 'WebSocket Testing',
    description: 'Test WebSocket connections, real-time messaging, and V2 orchestration progress updates',
    path: '/tests/websocket-test',
    icon: Wifi,
    category: 'API',
    status: 'active'
  },
  {
    title: 'Breakpoint Debugging',
    description: 'Debug and test VS Code breakpoint functionality with Turbopack',
    path: '/tests/breakpoint',
    icon: Bug,
    category: 'Debug',
    status: 'active'
  },
];

const CATEGORIES = ['All', 'API', 'UI', 'AI', 'Admin', 'Debug'];

export default function TestsIndexPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredTests = selectedCategory === 'All' 
    ? TEST_PAGES 
    : TEST_PAGES.filter(test => test.category === selectedCategory);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'legacy':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'API':
        return Code;
      case 'UI':
        return Palette;
      case 'AI':
        return Zap;
      case 'Admin':
        return FileText;
      case 'Debug':
        return Bug;
      default:
        return TestTube;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <TestTube className="h-8 w-8 text-blue-600" />
            Test Suite Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive testing interface for all Keyvex components and features
          </p>
        </div>

        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="flex items-center gap-2"
              >
                {category !== 'All' && (
                  React.createElement(getCategoryIcon(category), { className: "h-4 w-4" })
                )}
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Test Pages Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTests.map((test) => {
            const IconComponent = test.icon;
            
            return (
              <Card key={test.path} className="relative hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <IconComponent className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{test.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {test.category}
                          </Badge>
                          <Badge className={`text-xs ${getStatusColor(test.status)}`}>
                            {test.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <CardDescription className="mb-4 min-h-[3rem]">
                    {test.description}
                  </CardDescription>
                  
                  <Link href={test.path}>
                    <Button className="w-full flex items-center justify-center gap-2">
                      Open Test Page
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TestTube className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Tests</p>
                  <p className="text-2xl font-bold">{TEST_PAGES.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">API Tests</p>
                  <p className="text-2xl font-bold">
                    {TEST_PAGES.filter(t => t.category === 'API').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">UI Tests</p>
                  <p className="text-2xl font-bold">
                    {TEST_PAGES.filter(t => t.category === 'UI').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">AI Tests</p>
                  <p className="text-2xl font-bold">
                    {TEST_PAGES.filter(t => t.category === 'AI').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>All test pages have been organized under <code>/tests/</code> for better project structure.</p>
        </div>
      </div>
    </div>
  );
} 
