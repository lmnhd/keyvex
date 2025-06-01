'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToolsList } from '@/components/tools/tools-list';
import { 
  Plus, 
  BarChart3, 
  Users, 
  TrendingUp,
  Calculator,
  HelpCircle,
  ClipboardList,
  Eye,
  Database,
  Upload,
  FileSpreadsheet,
  Wifi,
  Globe,
  CheckCircle2,
  AlertCircle,
  Settings,
  Link2,
  Cloud,
  Server,
  FileText
} from 'lucide-react';

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'data' | 'analytics'>('overview');

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    redirect('/sign-in');
  }

  const handleCreateNew = () => {
    window.location.href = '/create';
  };

  const handleEditTool = (toolId: string) => {
    // TODO: Navigate to edit tool page
    console.log('Edit tool:', toolId);
  };

  const handleViewTool = (toolId: string) => {
    // TODO: Navigate to tool view page
    console.log('View tool:', toolId);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {user.firstName || user.emailAddresses[0]?.emailAddress}!
        </h1>
        <p className="text-muted-foreground mt-2">
          Here's what's happening with your interactive tools today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tools</p>
                <p className="text-2xl font-bold">5</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-500">+2</span>
              <span className="text-muted-foreground ml-1">this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">3,420</p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-500">+12%</span>
              <span className="text-muted-foreground ml-1">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completions</p>
                <p className="text-2xl font-bold">1,087</p>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <ClipboardList className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-500">+8%</span>
              <span className="text-muted-foreground ml-1">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Leads Generated</p>
                <p className="text-2xl font-bold">267</p>
              </div>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-500">+15%</span>
              <span className="text-muted-foreground ml-1">vs last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleCreateNew}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Create New Tool</h3>
                <p className="text-muted-foreground text-sm">
                  Use AI to build calculators, quizzes, and assessments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveTab('tools')}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Manage Tools</h3>
                <p className="text-muted-foreground text-sm">
                  View and edit your existing tools
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveTab('analytics')}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">View Analytics</h3>
                <p className="text-muted-foreground text-sm">
                  Track performance and leads
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest tool interactions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-3 bg-muted/50 rounded-lg">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Calculator className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Business Assessment Calculator</p>
                <p className="text-sm text-muted-foreground">Generated 12 new leads today</p>
              </div>
              <Badge variant="secondary">+12 leads</Badge>
            </div>
            <div className="flex items-center space-x-4 p-3 bg-muted/50 rounded-lg">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Marketing Strategy Quiz</p>
                <p className="text-sm text-muted-foreground">Updated content and styling</p>
              </div>
              <Badge variant="outline">Updated</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderToolData = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tool Data Sources</h2>
        <p className="text-muted-foreground">
          Connect your tools to real data sources for dynamic, personalized experiences
        </p>
      </div>

      {/* Data Source Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Connected Sources</p>
                <p className="text-2xl font-bold">3</p>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">CSV Files</Badge>
                <Badge variant="secondary" className="text-xs">SQL DB</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tools Using Data</p>
                <p className="text-2xl font-bold">2</p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-sm text-muted-foreground">Real estate quiz, Fitness calc</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data Health</p>
                <p className="text-2xl font-bold text-green-600">Good</p>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-sm text-muted-foreground">Last sync: 2 hours ago</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Connect Options */}
      <Card>
        <CardHeader>
          <CardTitle>Connect New Data Source</CardTitle>
          <CardDescription>Choose how you want to add data to your tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* File Upload */}
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
              <CardContent className="p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center mb-4">
                  <Upload className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="font-semibold mb-2">Upload Files</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  CSV, Excel, or Access files
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  Choose Files
                </Button>
              </CardContent>
            </Card>

            {/* Database Connection */}
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-4">
                  <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold mb-2">SQL Database</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  MySQL, PostgreSQL, SQL Server
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  Connect DB
                </Button>
              </CardContent>
            </Card>

            {/* Cloud Services */}
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mb-4">
                  <Cloud className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold mb-2">Cloud Apps</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Google Sheets, Salesforce, Airtable
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  Browse Apps
                </Button>
              </CardContent>
            </Card>

            {/* API Endpoint */}
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold mb-2">API Endpoint</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  REST API, GraphQL, Webhooks
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  Add API
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Existing Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Your Data Sources</CardTitle>
          <CardDescription>Manage and monitor your connected data sources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Sample Connected Source 1 */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h4 className="font-semibold">Neighborhood Data.csv</h4>
                  <p className="text-sm text-muted-foreground">
                    Real estate data • 2,450 records • Updated 2 hours ago
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Sample Connected Source 2 */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold">Customer CRM Database</h4>
                  <p className="text-sm text-muted-foreground">
                    MySQL • customers, leads tables • Live connection
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <Wifi className="h-3 w-3 mr-1" />
                  Live
                </Badge>
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Sample Disconnected Source */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Cloud className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h4 className="font-semibold">Google Sheets - Products</h4>
                  <p className="text-sm text-muted-foreground">
                    Product catalog • Connection error • Last sync: 3 days ago
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Error
                </Badge>
                <Button size="sm" variant="outline">
                  Reconnect
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Integration Wizard */}
      <Card>
        <CardHeader>
          <CardTitle>Smart Data Integration</CardTitle>
          <CardDescription>
            Let AI help you connect your tools to the right data sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Smart Data Detection
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                  Upload any file and our AI will automatically detect data types, 
                  suggest field mappings, and recommend the best tools to create.
                </p>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  Start Smart Upload
                </Button>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  Mock-to-Real Migration
                </h4>
                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                  Start with demo data, then seamlessly transition to your real data 
                  without rebuilding your tools.
                </p>
                <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-100">
                  Learn More
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Popular Integrations</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Google Sheets</span>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">MySQL</span>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Cloud className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Salesforce</span>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Server className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">PostgreSQL</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Data Templates & Examples</CardTitle>
          <CardDescription>
            Download sample data formats or start with pre-configured datasets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex items-center space-x-3 mb-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold">Real Estate Sample</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Property listings, neighborhood data, market trends
              </p>
              <Button size="sm" variant="outline" className="w-full">
                Download Template
              </Button>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex items-center space-x-3 mb-3">
                <FileText className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold">Customer CRM</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Lead scoring, customer segments, contact information
              </p>
              <Button size="sm" variant="outline" className="w-full">
                Download Template
              </Button>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex items-center space-x-3 mb-3">
                <FileText className="h-5 w-5 text-orange-600" />
                <h4 className="font-semibold">Product Catalog</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Inventory, pricing, specifications, categories
              </p>
              <Button size="sm" variant="outline" className="w-full">
                Download Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <p className="text-muted-foreground">
          Detailed performance metrics for your tools
        </p>
      </div>
      
      <Card>
        <CardContent className="p-12 text-center">
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Analytics Dashboard Coming Soon</h3>
              <p className="text-muted-foreground text-sm">
                Detailed analytics and reporting features will be available here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Navigation Tabs */}
          <div className="flex space-x-1 mb-8 bg-muted p-1 rounded-lg w-fit">
            <Button
              variant={activeTab === 'overview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </Button>
            <Button
              variant={activeTab === 'tools' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('tools')}
            >
              My Tools
            </Button>
            <Button
              variant={activeTab === 'data' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('data')}
            >
              Tool Data
            </Button>
            <Button
              variant={activeTab === 'analytics' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </Button>
          </div>

          {/* Content */}
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'tools' && (
            <ToolsList
              onCreateNew={handleCreateNew}
              onEditTool={handleEditTool}
              onViewTool={handleViewTool}
            />
          )}
          {activeTab === 'data' && renderToolData()}
          {activeTab === 'analytics' && renderAnalytics()}
        </div>
      </div>
    </div>
  );
} 