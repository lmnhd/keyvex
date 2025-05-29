'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Timer, 
  Users, 
  Activity,
  BarChart3,
  Clock,
  Edit3,
  MessageSquare,
  Zap,
  Target,
  History,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Calendar,
  Lightbulb
} from 'lucide-react';
import { getBehaviorTracker } from '@/lib/ai/behavior-tracker';
import type { 
  UserProfile, 
  BehaviorAnalysis, 
  AnalysisHistoryEntry, 
  UserEvolution,
  BehaviorEvolution 
} from '@/lib/ai/behavior-tracker';

interface AdminBehaviorDashboardProps {
  className?: string;
  isDarkMode?: boolean;
}

export function AdminBehaviorDashboard({ className = '', isDarkMode = false }: AdminBehaviorDashboardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisHistoryEntry | null>(null);
  const [showEvolutionDetails, setShowEvolutionDetails] = useState(false);

  const refreshData = () => {
    const tracker = getBehaviorTracker();
    if (tracker) {
      const userProfile = tracker.getUserProfile();
      const history = tracker.getAnalysisHistory();
      
      setProfile(userProfile);
      setAnalysisHistory(history);
      
      // Set most recent analysis as selected by default
      if (history.length > 0 && !selectedAnalysis) {
        setSelectedAnalysis(history[history.length - 1]);
      }
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Filter history by time range
  const filteredHistory = analysisHistory.filter(entry => {
    const cutoff = Date.now() - (
      selectedTimeRange === '24h' ? 24 * 60 * 60 * 1000 :
      selectedTimeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
      30 * 24 * 60 * 60 * 1000
    );
    return entry.timestamp > cutoff;
  });

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (trend: string) => {
    if (trend.includes('faster') || trend.includes('more_experimental') || trend.includes('becoming_expert')) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    }
    if (trend.includes('slower') || trend.includes('more_conservative') || trend.includes('becoming_beginner')) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return <div className="w-4 h-4 rounded-full bg-gray-400" />;
  };

  const getOverallTrendColor = (trend: string) => {
    switch (trend) {
      case 'becoming_expert': return 'text-green-600 bg-green-50 border-green-200';
      case 'becoming_beginner': return 'text-red-600 bg-red-50 border-red-200';
      case 'stable': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'inconsistent': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const exportBehaviorData = () => {
    const data = {
      profile,
      analysisHistory: filteredHistory,
      exportDate: new Date().toISOString(),
      timeRange: selectedTimeRange
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `behavior-analysis-${selectedTimeRange}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!profile) {
    return (
      <Card className={`${className} ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-center">
            <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No behavior data available</p>
              <p className="text-xs">User needs to interact more for analysis</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              User Behavior Intelligence
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              AI learning and adaptation insights
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setSelectedTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  selectedTimeRange === range
                    ? 'bg-blue-500 text-white'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          
          <Button variant="outline" size="sm" onClick={exportBehaviorData}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsVisible(!isVisible)}
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isVisible && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="evolution">Evolution</TabsTrigger>
            <TabsTrigger value="history">Analysis History</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Total Interactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{profile.totalInteractions}</div>
                  <p className="text-xs text-muted-foreground">
                    Confidence: <span className={getConfidenceColor(profile.confidenceScore)}>
                      {Math.round(profile.confidenceScore * 100)}%
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    Avg Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatTime(profile.averageResponseTime)}</div>
                  <p className="text-xs text-muted-foreground">
                    Speed: {profile.averageResponseTime < 5000 ? 'Fast' : profile.averageResponseTime < 15000 ? 'Medium' : 'Deliberate'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Exploration Level
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.round(profile.explorationTendency * 100)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {profile.explorationTendency > 0.6 ? 'Experimental' : profile.explorationTendency > 0.3 ? 'Balanced' : 'Conservative'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Workflow Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold capitalize">{profile.suggestedWorkflow}</div>
                  <p className="text-xs text-muted-foreground">
                    Optimal: {profile.optimalStepCount} steps
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Behavior Profile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Behavior Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Suggestion Reliance</span>
                      <span>{Math.round(profile.reliesOnSuggestions * 100)}%</span>
                    </div>
                    <Progress value={profile.reliesOnSuggestions * 100} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Patience Level</span>
                      <span>{Math.round(profile.patienceLevel * 100)}%</span>
                    </div>
                    <Progress value={profile.patienceLevel * 100} className="h-2" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Preferences</h4>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">
                        {profile.prefersStructuredQuestions ? 'Structured' : 'Freeform'}
                      </Badge>
                      <Badge variant="outline">
                        {profile.preferredComplexity}
                      </Badge>
                      <Badge variant="outline">
                        {profile.likelyToEditAnswers ? 'Edits Answers' : 'Decisive'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Input Type Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {profile.preferredInputTypes.slice(0, 5).map((type, index) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{type.replace(/([A-Z])/g, ' $1')}</span>
                        <div className="flex items-center gap-2">
                          <div className={`text-xs px-2 py-1 rounded ${
                            index === 0 ? 'bg-green-100 text-green-700' :
                            index === 1 ? 'bg-blue-100 text-blue-700' :
                            index === 2 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            #{index + 1}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Evolution Tab */}
          <TabsContent value="evolution" className="space-y-6">
            {profile.evolutionHistory.length > 0 ? (
              <>
                {/* Latest Evolution Summary */}
                {profile.evolutionHistory.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Latest Evolution Analysis
                      </CardTitle>
                      <CardDescription>
                        {formatDate(profile.evolutionHistory[profile.evolutionHistory.length - 1].date)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const latest = profile.evolutionHistory[profile.evolutionHistory.length - 1];
                        return (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <Badge className={`${getOverallTrendColor(latest.evolution.overallTrend)} border`}>
                                {latest.evolution.overallTrend.replace('_', ' ')}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                Confidence: {Math.round(latest.evolution.confidenceInTrend * 100)}%
                              </span>
                            </div>
                            
                            {latest.keyChanges.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Key Changes:</h4>
                                <ul className="text-sm space-y-1">
                                  {latest.keyChanges.map((change, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                                      {change}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {latest.triggeringEvents && latest.triggeringEvents.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Possible Triggers:</h4>
                                <div className="flex flex-wrap gap-1">
                                  {latest.triggeringEvents.map((event, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {event}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                {/* Evolution Trends */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Evolution Timeline
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowEvolutionDetails(!showEvolutionDetails)}
                      >
                        {showEvolutionDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {showEvolutionDetails ? 'Hide' : 'Show'} Details
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {profile.evolutionHistory.slice(-5).reverse().map((evolution, index) => (
                        <div key={evolution.analysisId} className="flex items-start gap-4 p-3 border border-gray-200 rounded-lg">
                          <div className="flex-shrink-0">
                            <Calendar className="h-4 w-4 text-gray-500 mt-1" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {formatDate(evolution.date)}
                              </span>
                              <Badge className={`${getOverallTrendColor(evolution.evolution.overallTrend)} border text-xs`}>
                                {evolution.evolution.overallTrend.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            {showEvolutionDetails && (
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {getTrendIcon(evolution.evolution.responseSpeedTrend)}
                                    Speed: {evolution.evolution.responseSpeedTrend}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getTrendIcon(evolution.evolution.explorationTrend)}
                                    Exploration: {evolution.evolution.explorationTrend.replace('more_', '')}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {getTrendIcon(evolution.evolution.editingTrend)}
                                    Editing: {evolution.evolution.editingTrend.replace('more_', '')}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getTrendIcon(evolution.evolution.workflowTrend)}
                                    Workflow: {evolution.evolution.workflowTrend.replace('more_', '')}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No evolution data yet</p>
                    <p className="text-xs text-muted-foreground">Evolution tracking starts after 24 hours of usage</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Analysis History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Analysis History ({filteredHistory.length} analyses)
                </CardTitle>
                <CardDescription>
                  Detailed behavior analysis over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredHistory.slice().reverse().map((entry) => (
                    <div 
                      key={entry.analysisId}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedAnalysis?.analysisId === entry.analysisId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedAnalysis(entry)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {formatDate(entry.timestamp)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              v{entry.version}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {entry.interactionCountAtTime} interactions • {entry.sessionCountAtTime} sessions
                          </p>
                        </div>
                        <div className="text-right">
                          {entry.analysis.evolution && (
                            <Badge className={`${getOverallTrendColor(entry.analysis.evolution.overallTrend)} border text-xs`}>
                              {entry.analysis.evolution.overallTrend.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Selected Analysis Details */}
            {selectedAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle>Analysis Details</CardTitle>
                  <CardDescription>
                    {formatDate(selectedAnalysis.timestamp)} • {selectedAnalysis.analysisId}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-medium">Behavior Patterns</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Response Speed:</span>
                          <Badge variant="outline">{selectedAnalysis.analysis.patterns.responseSpeed}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Exploration Level:</span>
                          <Badge variant="outline">{selectedAnalysis.analysis.patterns.explorationLevel}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Editing Frequency:</span>
                          <Badge variant="outline">{selectedAnalysis.analysis.patterns.editingFrequency}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Workflow Preference:</span>
                          <Badge variant="outline">{selectedAnalysis.analysis.patterns.workflowPreference}</Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-medium">AI Recommendations</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Question Complexity:</span>
                          <Badge variant="outline">{selectedAnalysis.analysis.recommendations.questionComplexity}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Suggestion Count:</span>
                          <Badge variant="outline">{selectedAnalysis.analysis.recommendations.suggestionCount}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Quick Mode:</span>
                          <Badge variant={selectedAnalysis.analysis.recommendations.enableQuickMode ? "default" : "secondary"}>
                            {selectedAnalysis.analysis.recommendations.enableQuickMode ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Advanced Options:</span>
                          <Badge variant={selectedAnalysis.analysis.recommendations.showAdvancedOptions ? "default" : "secondary"}>
                            {selectedAnalysis.analysis.recommendations.showAdvancedOptions ? 'Show' : 'Hide'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  AI Adaptation Insights
                </CardTitle>
                <CardDescription>
                  How the AI is adapting to this user's behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const suggestions = getBehaviorTracker()?.getAdaptiveSuggestions();
                    if (!suggestions) return <p className="text-sm text-muted-foreground">No insights available</p>;
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <h4 className="font-medium">Current Adaptations</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${suggestions.preferQuickMode ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <span className="text-sm">Quick Mode: {suggestions.preferQuickMode ? 'Enabled' : 'Disabled'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${suggestions.showAdvancedOptions ? 'bg-blue-500' : 'bg-gray-300'}`} />
                              <span className="text-sm">Advanced Options: {suggestions.showAdvancedOptions ? 'Visible' : 'Hidden'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full bg-yellow-500" />
                              <span className="text-sm">Optimal Steps: {suggestions.optimalStepCount}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-medium">Recommended Question Types</h4>
                          <div className="flex flex-wrap gap-1">
                            {suggestions.suggestedQuestionTypes.map((type) => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Complexity Level: <span className="font-medium">{suggestions.recommendedComplexity}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
} 