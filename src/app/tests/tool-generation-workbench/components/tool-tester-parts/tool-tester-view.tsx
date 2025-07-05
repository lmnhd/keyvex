import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Wand2, AlertCircle, Play, CheckCircle, Eye, Save, Copy, Download, Trash2, Settings, Database, ChevronRight, Pause, SkipForward, RefreshCw, Clock, Target, User, MessageSquare, Briefcase, Brain, Info, Zap, Activity, Wifi, WifiOff, Loader2, Code, Bug, TestTube2, StepForward, RotateCcw, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import React, { useState, useEffect } from 'react';
import { detectComponentCodeFormat } from '@/lib/transpilation/jsx-transpiler';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BrainstormData, WorkflowMode, ModelOption, AgentModelMapping, OrchestrationStatus, TccSource, AgentMode } from './tool-tester-types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { getScenariosForAgent } from '@/lib/testing/mock-tcc-scenarios';
import { ToolCreationJob } from '../tool-tester-core-logic';
import { ConnectionStatus, StepProgress } from '../../hooks/useToolGenerationStream';
import ProgressLog from '../ProgressLog';
import TCCVisualizer from '../TCCVisualizer';
import ToolDebugPanel from '@/components/tool-debug/ToolDebugPanel';
import { CanvasTool } from '@/components/tool-creator-ui/canvas-tool';
import { ScrollBar } from '@/components/ui/scroll-area';
import { DetailedBrainstormView } from '../DetailedBrainstormView';
import { 
  type BrainstormResult,
  type BrainstormData as BrainstormDataContent
} from '../../types/unified-brainstorm-types';

export default function ToolTesterView({
    testJob,
    getConnectionStatusIcon,
    getConnectionStatusBadge,
    error,
    selectedBrainstormId,
    setSelectedBrainstormId,
    selectedMockScenarioId,
    setSelectedMockScenarioId,
    selectedDebugTccJobId,
    setSelectedDebugTccJobId,
    setSelectedAgent,
    orchestrationStatus,
    setOrchestrationStatus,
    savedBrainstorms: savedBrainstormsContent,
    savedTools,
    savedV2Jobs,
    selectedLoadItem,
    setSelectedLoadItem,
    loadMode,
    setLoadMode,
    workflowMode,
    setWorkflowMode,
    selectedModelIds,
    handleModelToggle,
    defaultPrimaryModel,
    availableModels,
    handleLoadSavedItem,
    handleDeleteSavedItem,
    handleDeleteBrainstorm,
    handleRefreshTCC,
    getSelectedBrainstormDetails,
    isLoading,
    selectedAgent,
    agentModelMapping,
    setAgentModelMapping,
    tccSource,
    setTccSource,
    availableAgents,
    handleAgentModelChange,
    handleSubmit,
    handleResume,
    handlePause,
    handleSaveV2Result,
    savedToolIds,
    savedV2JobIds,
    handleStepForward,
    progressUpdates,
    assembledCode,
    tccData,
    getModelsUsed,
    isDarkMode,
    wsLogs,
    setWsLogs,
    wsLogsEndRef,
    progressSummaryEndRef,
    isRefreshingTCC,
    connectionStatus,
    wsDebugInfo,
    handleSaveTool,
    handleUpdateTool,
    agentMode,
    setAgentMode,
    handleTccFinalization,
    loadSource,
    setLoadSource,
    dynamoDBTools,
    editMessage,
    setEditMessage,
    hasTccBackup,
    tccHistory,
    recoverLastValidTcc,
    handleSaveTccSnapshot,
    handleLoadTccSnapshot
}: {
    testJob: ToolCreationJob | null;
    getConnectionStatusIcon: () => React.ReactNode;
    getConnectionStatusBadge: () => React.ReactNode;
    error: string | null;
    selectedBrainstormId: string;
    setSelectedBrainstormId: (id: string) => void;
    selectedMockScenarioId: string;
    setSelectedMockScenarioId: (id: string) => void;
    selectedDebugTccJobId: string | null;
    setSelectedDebugTccJobId: (id: string) => void;
    setSelectedAgent: (agent: string) => void;
    orchestrationStatus: OrchestrationStatus;
    setOrchestrationStatus: (status: OrchestrationStatus) => void;
    savedBrainstorms: BrainstormResult[];
    savedTools: ProductToolDefinition[];
    savedV2Jobs: any[];
    selectedLoadItem: { type: 'brainstorm' | 'tool' | 'v2job', id: string } | null;
    setSelectedLoadItem: (item: { type: 'brainstorm' | 'tool' | 'v2job', id: string } | null) => void;
    loadMode: 'new' | 'load';
    setLoadMode: (mode: 'new' | 'load') => void;
    workflowMode: WorkflowMode;
    setWorkflowMode: (mode: WorkflowMode) => void;
    selectedModelIds: string[];
    handleModelToggle: (modelId: string, checked: boolean) => void;
    defaultPrimaryModel: string | null | undefined;
    availableModels: ModelOption[];
    handleLoadSavedItem: () => void;
    handleDeleteSavedItem: (id: string, type: "tool" | "v2job") => Promise<void>;
    handleDeleteBrainstorm: (brainstormId: string) => void;
    handleRefreshTCC: () => void;
    getSelectedBrainstormDetails: () => BrainstormResult | null | undefined;
    isLoading: boolean;
    selectedAgent: string;
    agentModelMapping: AgentModelMapping;
    setAgentModelMapping: (mapping: AgentModelMapping) => void;
    tccSource: TccSource;
    setTccSource: (source: TccSource) => void;
    availableAgents: {
        id: string;
        name: string;
        description: string;
    }[];
    handleAgentModelChange: (agentId: string, modelId: string) => void;
    handleSubmit: () => void;
    handleResume: () => void;
    handlePause: () => void;
    handleSaveV2Result: (result: any, tccData: any) => void;
    savedToolIds: Set<string>;
    savedV2JobIds: Set<string>;
    handleStepForward: () => void;
    progressUpdates: StepProgress[];
    assembledCode: string | null;
    tccData: any;
    getModelsUsed: (job: ToolCreationJob) => string[];
    isDarkMode: boolean;
    wsLogs: string[];
    setWsLogs: (logs: string[]) => void;
    wsLogsEndRef: React.RefObject<HTMLDivElement | null>;
    progressSummaryEndRef: React.RefObject<HTMLDivElement | null>;
    isRefreshingTCC: boolean;
    connectionStatus: ConnectionStatus;
    wsDebugInfo: any;
    handleSaveTool: (tool: ProductToolDefinition) => void;
    handleUpdateTool: (tool: ProductToolDefinition) => void;
    agentMode: AgentMode;
    setAgentMode: (mode: AgentMode) => void;
    handleTccFinalization: () => Promise<void>;
    loadSource: 'indexeddb' | 'dynamodb';
    setLoadSource: (source: 'indexeddb' | 'dynamodb') => void;
    dynamoDBTools: ProductToolDefinition[];
    editMessage: string;
    setEditMessage: (message: string) => void;
    hasTccBackup: boolean;
    tccHistory: any[];
    recoverLastValidTcc: () => boolean;
    handleSaveTccSnapshot: () => void;
    handleLoadTccSnapshot: () => void;
}) {
  const [activeRightTab, setActiveRightTab] = useState('progress');

  // Safe hash function that doesn't fail on Unicode characters
  const safeHash = (str: string): string => {
    if (!str) return 'NO-CODE';
    return str.length.toString() + '-' + str.substring(0, 50).replace(/[^\w]/g, '').substring(0, 16);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Wand2 className="mr-2 h-6 w-6 text-purple-500" /> 
          Enhanced Tool Generation Workbench
          <div className="ml-auto flex items-center gap-2">
            {getConnectionStatusIcon()}
            {getConnectionStatusBadge()}
          </div>
        </CardTitle>
        <CardDescription>Advanced tool creation with multi-model selection, real-time streaming, and granular agent control.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="grid? grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="selectedBrainstorm">1. Select Saved Brainstorm</Label>
              <Select 
                value={selectedBrainstormId}
                onValueChange={setSelectedBrainstormId} 
                disabled={isLoading || savedBrainstormsContent.length === 0}
              >
                <SelectTrigger id="selectedBrainstorm" className="max-w-md">
                  <SelectValue placeholder={savedBrainstormsContent.length === 0 ? "No brainstorms saved" : "Choose a brainstorm"} />
                </SelectTrigger>
                <SelectContent>
                  {savedBrainstormsContent.map(bs => {
                    const fullText = `${bs.userInput.toolType} for ${bs.userInput.targetAudience} (Saved: ${new Date(bs.timestamp).toLocaleDateString()})`;
                    const truncatedText = fullText.length > 100 ? fullText.substring(0, 100) + '...' : fullText;
                    return (
                      <SelectItem key={bs.id} value={bs.id} title={fullText}>
                        {truncatedText}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedBrainstormId && getSelectedBrainstormDetails() && (
              <Card className="bg-gray-50 dark:bg-gray-800/50 col-span-4">
                <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center">
                      <Info className="mr-2 h-4 w-4 text-blue-500"/>
                      Selected Brainstorm Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-3">
                    {/* Quick Summary */}
                    <div className="space-y-1">
                    <p><strong>Tool Type:</strong> {getSelectedBrainstormDetails()?.userInput.toolType}</p>
                    <p><strong>Target:</strong> {getSelectedBrainstormDetails()?.userInput.targetAudience}</p>
                      <p><strong>Created:</strong> {new Date(getSelectedBrainstormDetails()!.timestamp).toLocaleString()}</p>
                      {getSelectedBrainstormDetails()?.brainstormData?.keyCalculations && (
                        <p><strong>Calculations:</strong> {getSelectedBrainstormDetails()?.brainstormData?.keyCalculations?.length || 0} key calculations defined</p>
                      )}
                      {getSelectedBrainstormDetails()?.brainstormData?.suggestedInputs && (
                        <p><strong>Inputs:</strong> {getSelectedBrainstormDetails()?.brainstormData?.suggestedInputs?.length || 0} input fields planned</p>
                      )}
                    </div>
                    
                    {/* Data Requirements Status */}
                    {(() => {
                      const brainstorm = getSelectedBrainstormDetails();
                      const hasDataRequirements = brainstorm?.brainstormData?.dataRequirements;
                      const hasExternalDataNeeds = hasDataRequirements?.hasExternalDataNeeds;
                      const hasGeneratedMockData = !!(
                        (brainstorm?.brainstormData?.mockData && Object.keys(brainstorm.brainstormData.mockData).length > 0) ||
                        (brainstorm?.brainstormData?.researchData && Object.keys(brainstorm.brainstormData.researchData).length > 0) ||
                        (brainstorm?.brainstormData?.dummyData && Object.keys(brainstorm.brainstormData.dummyData).length > 0)
                      );
                      
                      if (hasDataRequirements) {
                        return (
                          <div className="p-2 rounded border bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">Data Status:</span>
                              {hasExternalDataNeeds === false ? (
                                <Badge variant="secondary" className="text-xs">🔵 No External Data Needed</Badge>
                              ) : hasExternalDataNeeds === true ? (
                                hasGeneratedMockData ? (
                                  <Badge variant="default" className="text-xs">✅ Data Researched & Ready</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">🟡 Needs Research</Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="text-xs">⚪ Not Verified</Badge>
                              )}
                            </div>
                            {hasExternalDataNeeds === true && hasDataRequirements.requiredDataTypes && (
                              <div className="text-xs text-blue-600 mt-1">
                                Required: {hasDataRequirements.requiredDataTypes.join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Research Data Display */}
                    {(() => {
                      const brainstorm = getSelectedBrainstormDetails();
                      const researchData = brainstorm?.brainstormData?.researchData;
                      const userDataInstructions = brainstorm?.brainstormData?.userDataInstructions;
                      
                      if (researchData && Object.keys(researchData).length > 0) {
                        return (
                          <details className="mt-3">
                            <summary className="cursor-pointer font-medium text-green-600 hover:text-green-800 flex items-center select-none">
                              <ChevronRight className="mr-1 h-3 w-3 transition-transform duration-200" />
                              🔬 View Research Data Results ({Object.keys(researchData).length} domains)
                            </summary>
                            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg">
                              <div className="space-y-4">
                                {/* User Data Instructions */}
                                {userDataInstructions && (
                                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded">
                                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">📋 Data Requirements Summary</h4>
                                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">{userDataInstructions.summary}</p>
                                    {userDataInstructions.dataNeeded && (
                                      <div className="text-xs text-blue-600 dark:text-blue-400">
                                        <span className="font-medium">Required:</span> {userDataInstructions.dataNeeded.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Research Results by Domain */}
                                {Object.entries(researchData).map(([domain, data]: [string, any]) => (
                                  <div key={domain} className="border border-gray-200 rounded-lg">
                                    <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-t-lg">
                                      <h4 className="font-medium text-gray-800 dark:text-gray-200 capitalize">
                                        🏢 {domain.replace('_', ' ')} Research
                                      </h4>
                                    </div>
                                    <div className="p-3 space-y-3">
                                      {/* Market Data */}
                                      {data.marketData && (
                                        <div>
                                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📊 Market Data</h5>
                                          <div className="bg-white dark:bg-gray-900 p-2 rounded border text-xs">
                                            <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                                              {JSON.stringify(data.marketData, null, 2)}
                        </pre>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* General Data */}
                                      {data.generalData && (
                                        <div>
                                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📋 General Data</h5>
                                          <div className="bg-white dark:bg-gray-900 p-2 rounded border text-xs">
                                            <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                                              {JSON.stringify(data.generalData, null, 2)}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Search Metadata */}
                                      {data.searchMetadata && (
                                        <div>
                                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">🔍 Search Metadata</h5>
                                          <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded border text-xs space-y-1">
                                            {data.searchMetadata.query && (
                                              <div><span className="font-medium">Query:</span> {data.searchMetadata.query}</div>
                                            )}
                                            {data.searchMetadata.domain && (
                                              <div><span className="font-medium">Domain:</span> {data.searchMetadata.domain}</div>
                                            )}
                                            {data.searchMetadata.timestamp && (
                                              <div><span className="font-medium">Researched:</span> {new Date(data.searchMetadata.timestamp).toLocaleString()}</div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </details>
                        );
                      }
                      return null;
                    })()}

                    {/* Comprehensive Details (Collapsible) */}
                    <details className="mt-3">
                        <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-800 flex items-center select-none">
                          <ChevronRight className="mr-1 h-3 w-3 transition-transform duration-200" />
                          View Complete Brainstorm Analysis
                        </summary>
                        <div className="mt-3 -mx-4 -mb-4">
                          <div className="max-h-96 overflow-y-auto">
                            <DetailedBrainstormView data={getSelectedBrainstormDetails()?.brainstormData} />
                          </div>
                        </div>
                    </details>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-2">
            <Label>Mode Selection</Label>
            <Tabs value={loadMode} onValueChange={(value) => setLoadMode(value as 'new' | 'load')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new" className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  Create New Tool
                </TabsTrigger>
                <TabsTrigger value="load" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Load Saved Item
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {loadMode === 'load' && (
          <div className="space-y-4">
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                  <Database className="h-5 w-5 text-blue-600" />
                  Load Saved Items
                </CardTitle>
                <CardDescription>
                  Load previously saved brainstorms, Local Tools, or Saved Sessions to continue working or testing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="brainstorms" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="brainstorms">
                      Brainstorms ({savedBrainstormsContent.length})
                    </TabsTrigger>
                    <TabsTrigger value="tools">
                      Local Tools ({savedTools.filter(Boolean).length})
                    </TabsTrigger>
                    <TabsTrigger value="v2jobs">
                      Saved Sessions ({savedV2Jobs.filter(Boolean).length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="brainstorms" className="mt-4">
                    <div className="space-y-2">
                      <Label>Select a Saved Brainstorm</Label>
                      <ScrollArea className="h-48 border rounded-md p-3">
                        <div className="space-y-2">
                          {savedBrainstormsContent.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">No saved brainstorms found</p>
                          ) : (
                            savedBrainstormsContent.map(brainstorm => {
                              // Check if brainstorm has been through data verification
                              const hasDataRequirements = brainstorm.brainstormData?.dataRequirements;
                              const hasExternalDataNeeds = hasDataRequirements?.hasExternalDataNeeds;
                              const hasGeneratedMockData = !!(
                                (brainstorm.brainstormData?.mockData && Object.keys(brainstorm.brainstormData.mockData).length > 0) ||
                                (brainstorm.brainstormData?.researchData && Object.keys(brainstorm.brainstormData.researchData).length > 0) ||
                                (brainstorm.brainstormData?.dummyData && Object.keys(brainstorm.brainstormData.dummyData).length > 0)
                              );
                              const hasUserInstructions = brainstorm.brainstormData?.userDataInstructions;
                              
                              // Determine verification status
                              let verificationStatus: 'unverified' | 'no-data-needed' | 'data-researched' | 'partially-verified' = 'unverified';
                              let statusColor = 'text-gray-500';
                              let statusIcon = '⚪';
                              let statusText = 'Not Verified';
                              
                              if (hasDataRequirements) {
                                if (hasExternalDataNeeds === false) {
                                  verificationStatus = 'no-data-needed';
                                  statusColor = 'text-blue-600';
                                  statusIcon = '🔵';
                                  statusText = 'No External Data Needed';
                                } else if (hasExternalDataNeeds === true) {
                                  if (hasGeneratedMockData && hasUserInstructions) {
                                    verificationStatus = 'data-researched';
                                    statusColor = 'text-green-600';
                                    statusIcon = '✅';
                                    statusText = 'Data Researched & Ready';
                                  } else {
                                    verificationStatus = 'partially-verified';
                                    statusColor = 'text-yellow-600';
                                    statusIcon = '🟡';
                                    statusText = 'Partially Researched';
                                  }
                                }
                              }
                              
                              return (
                                <div 
                                  key={brainstorm.id}
                                  className={`p-3 rounded-md border cursor-pointer transition-colors ${
                                    selectedLoadItem?.type === 'brainstorm' && selectedLoadItem?.id === brainstorm.id
                                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300' 
                                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                  onClick={() => setSelectedLoadItem({ type: 'brainstorm', id: brainstorm.id })}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <h4 className="font-medium text-sm">{brainstorm.userInput.toolType} for {brainstorm.userInput.targetAudience}</h4>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {brainstorm.userInput.industry && `${brainstorm.userInput.industry} • `}
                                        {new Date(brainstorm.timestamp).toLocaleDateString()}
                                      </p>
                                      {/* 🆕 Data Verification Status */}
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className={`text-xs font-medium ${statusColor}`}>
                                          {statusIcon} {statusText}
                                        </span>
                                        {hasDataRequirements && hasExternalDataNeeds === true && (
                                          <Badge variant="outline" className="text-xs">
                                            {brainstorm.brainstormData?.dataRequirements?.requiredDataTypes?.length || 0} Data Types
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">Brainstorm</Badge>
                                      {/* 🆕 Data verification badge */}
                                      {verificationStatus !== 'unverified' && (
                                        <Badge 
                                          variant={
                                            verificationStatus === 'data-researched' ? 'default' :
                                            verificationStatus === 'no-data-needed' ? 'secondary' : 'outline'
                                          } 
                                          className="text-xs"
                                        >
                                          {verificationStatus === 'data-researched' ? 'Data Researched & Ready' :
                                           verificationStatus === 'no-data-needed' ? 'No Data Needed' : 'Partial'}
                                        </Badge>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Are you sure you want to delete this brainstorm? This action cannot be undone.')) {
                                            handleDeleteBrainstorm(brainstorm.id);
                                          }
                                        }}
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                        title="Delete this brainstorm"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>

                  <TabsContent value="tools" className="mt-4">
                    <div className="space-y-2">
                      <Label>Select a Local Tool</Label>
                      <ScrollArea className="h-48 border rounded-md p-3">
                        <div className="space-y-2">
                          {savedTools.filter(Boolean).length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">No Local Tools found</p>
                          ) : (
                            savedTools.filter(Boolean).map(tool => (
                              <div 
                                key={tool.id}
                                className={`p-3 rounded-md border cursor-pointer transition-colors ${
                                  selectedLoadItem?.type === 'tool' && selectedLoadItem?.id === tool.id
                                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300' 
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                                onClick={() => setSelectedLoadItem({ type: 'tool', id: tool.id })}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm">{tool.metadata?.title ?? 'Untitled Tool'}</h4>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {tool.metadata?.description ?? tool.metadata?.shortDescription ?? 'No description'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      {new Date(tool.updatedAt || tool.createdAt || Date.now()).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">Local Tool</Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSavedItem(tool.id, 'tool');
                                      }}
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>

                  <TabsContent value="v2jobs" className="mt-4">
                    <div className="space-y-2">
                      <Label>Select a Saved Session</Label>
                      <ScrollArea className="h-48 border rounded-md p-3">
                        <div className="space-y-2">
                          {savedV2Jobs.filter(Boolean).length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">No Saved Sessions found</p>
                          ) : (
                            savedV2Jobs.filter(Boolean).map(job => (
                              <div 
                                key={job.id}
                                className={`p-3 rounded-md border cursor-pointer transition-colors ${
                                  selectedLoadItem?.type === 'v2job' && selectedLoadItem?.id === job.id
                                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300' 
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                                onClick={() => setSelectedLoadItem({ type: 'v2job', id: job.id })}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm">{job.productToolDefinition?.metadata?.title ?? 'Untitled Tool'}</h4>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {job.productToolDefinition?.metadata?.description ?? 'No description'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      Job ID: {job.id.slice(0, 8)}... • {new Date(job.timestamp).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Saved Session</Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSavedItem(job.id, 'v2job');
                                      }}
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>
                </Tabs>

                {selectedLoadItem && (
                  <div className="flex justify-between items-center pt-3 border-t">
                    <div className="text-sm text-gray-600">
                      Selected: {selectedLoadItem.type === 'brainstorm' ? 'Brainstorm' : 
                                selectedLoadItem.type === 'tool' ? 'Local Tool' : 
                                'Saved Session'}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setSelectedLoadItem(null)}>
                        Cancel
                      </Button>
                      <Button onClick={handleLoadSavedItem}>
                        Load Selected Item
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {loadMode === 'new' && (
          <div className="space-y-4">
            <Label>2. Select Workflow Mode</Label>
            
            <Tabs value={workflowMode} onValueChange={(value) => setWorkflowMode(value as WorkflowMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="v2" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                V2 Orchestration
              </TabsTrigger>
              <TabsTrigger value="debug" className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug & Inspect
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="v2" className="mt-4">
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-green-600" />
                    <div>
                      <h4 className="font-medium text-green-900 dark:text-green-100">V2 Multi-Agent Orchestration</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">Advanced multi-agent workflow with real-time progress streaming via WebSocket.</p>
                    </div>
                  </div>

                                      <div className="space-y-3 pt-2">
                      <Label>Agent-Specific Model Configuration</Label>
                      <div className="text-xs text-gray-600 mb-2">
                        Available Models: {availableModels.length} | Agent Mapping Keys: {Object.keys(agentModelMapping).length}
                      </div>
                      <div className="rounded-md border bg-green-50/50 dark:bg-green-900/10 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availableAgents.map(agent => (
                          <div key={agent.id} className="space-y-2">
                            <Label htmlFor={`agent-model-${agent.id}`} className="text-sm font-medium" title={agent.description}>
                              {agent.name}
                            </Label>
                            <Select
                              value={agentModelMapping[agent.id] || ''}
                              onValueChange={(value) => handleAgentModelChange(agent.id, value)}
                              disabled={availableModels.length === 0 || isLoading}
                            >
                              <SelectTrigger id={`agent-model-${agent.id}`} className="h-9">
                                <SelectValue placeholder="Select model..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableModels.map(model => (
                                  <SelectItem key={model.id} value={model.id}>
                                    {model.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="debug" className="mt-4">
              <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Bug className="h-5 w-5 text-red-600" />
                    <div>
                      <h4 className="font-medium text-red-900 dark:text-red-100">Debug & Inspect Mode</h4>
                      <p className="text-sm text-red-700 dark:text-red-300">Test individual agents in isolation with a specific TCC source and model.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>1. Select TCC Data Source</Label>
                    <RadioGroup value={tccSource} onValueChange={(value) => setTccSource(value as TccSource)} className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="brainstorm" id="source-brainstorm" />
                        <Label htmlFor="source-brainstorm">From Selected Brainstorm</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mockScenario" id="source-mock" />
                        <Label htmlFor="source-mock">From Mock Scenario</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="savedV2Job" id="source-v2job" />
                        <Label htmlFor="source-v2job">From Saved Session</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="inMemory" id="source-inmemory" />
                        <Label>Load from: {loadSource === 'indexeddb' ? 'Browser (Local Tools & Saved Sessions)' : 'Cloud (Published Tools)'}</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {tccSource === 'mockScenario' && (
                    <div className="space-y-2 pl-6 border-l-2 border-red-200">
                      <Label htmlFor="mock-scenario-select">Select Mock Scenario</Label>
                      <Select 
                        value={selectedMockScenarioId} 
                        onValueChange={setSelectedMockScenarioId}
                        disabled={!selectedAgent}
                      >
                        <SelectTrigger id="mock-scenario-select">
                          <SelectValue placeholder={!selectedAgent ? "Select an agent first" : "Choose a mock scenario..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedAgent && getScenariosForAgent(selectedAgent).map(scenario => (
                            <SelectItem key={scenario.id} value={scenario.id}>
                              {scenario.name} ({scenario.complexity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {tccSource === 'savedV2Job' && (
                    <div className="space-y-2 pl-6 border-l-2 border-red-200">
                      <Label htmlFor="tcc-source-select">Select Session</Label>
                      <Select 
                        value={selectedDebugTccJobId || ''} 
                        onValueChange={setSelectedDebugTccJobId}
                        disabled={savedV2Jobs.filter(Boolean).length === 0}
                      >
                        <SelectTrigger id="tcc-source-select">
                          <SelectValue placeholder={savedV2Jobs.filter(Boolean).length === 0 ? "No sessions saved" : "Choose a saved session..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {savedV2Jobs.filter(Boolean).map(job => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.productToolDefinition?.metadata?.title ?? 'Untitled Tool'} ({job.id.slice(0, 8)}...)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {tccSource === 'inMemory' && (
                    <div className="space-y-3 pl-6 border-l-2 border-green-200">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <Label className="text-green-700 dark:text-green-300 font-medium">Current TCC Data Status</Label>
                      </div>
                      {tccData ? (
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Job ID:</span>
                              <code className="text-xs bg-green-100 dark:bg-green-800 px-1 rounded">{tccData.jobId?.slice(0, 12)}...</code>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                {tccData.functionPlanning ? '✅' : '⚪'} Function Planning
                              </div>
                              <div className="flex items-center gap-1">
                                {tccData.stateLogic ? '✅' : '⚪'} State Logic
                              </div>
                              <div className="flex items-center gap-1">
                                {tccData.jsxLayout ? '✅' : '⚪'} JSX Layout
                              </div>
                              <div className="flex items-center gap-1">
                                {tccData.styling ? '✅' : '⚪'} Styling
                              </div>
                              <div className="flex items-center gap-1">
                                {tccData.finalProduct?.componentCode ? '✅' : '⚪'} Final Product Code
                              </div>
                              <div className="flex items-center gap-1">
                                {tccData.validationResults ? '✅' : '⚪'} Validation
                              </div>
                            </div>
                            <div className="pt-2 border-t border-green-200">
                              <span className="text-xs text-green-600 dark:text-green-400">
                                ✅ Ready to use current in-memory TCC data for isolated agent testing
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200">
                          <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                            <span>⚠️</span>
                            <span>No current TCC data available. Run a tool generation first to populate TCC data.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>2. Select Agent to Test</Label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an agent to test..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAgents.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{agent.name}</span>
                              <span className="text-xs text-muted-foreground">{agent.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedAgent && (
                    <>
                      <div className="space-y-2">
                        <Label>3. Agent Mode</Label>
                        <RadioGroup 
                          value={agentMode} 
                          onValueChange={(value) => setAgentMode(value as AgentMode)} 
                          className="flex items-center space-x-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="create" id="mode-create" />
                            <Label htmlFor="mode-create">Create Mode</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="edit" id="mode-edit" />
                            <Label htmlFor="mode-edit">Edit Mode</Label>
                          </div>
                        </RadioGroup>
                        {agentMode === 'create' && (
                          <p className="text-sm text-muted-foreground">
                            Test agent creating new output from scratch using brainstorm/TCC data.
                          </p>
                        )}
                        {agentMode === 'edit' && (
                          <div className="pl-6 space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Test agent editing existing output with current state awareness and edit instructions.
                            </p>
                            <div className="space-y-2">
                              <Label htmlFor="edit-message">Edit Instructions</Label>
                              <Textarea
                                id="edit-message"
                                placeholder="Enter instructions for how the agent should modify its output..."
                                value={editMessage}
                                onChange={(e) => setEditMessage(e.target.value)}
                                rows={3}
                                className="text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                These instructions will be sent to the agent along with the current result to guide modifications.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                                                <Label>4. Select Model for {availableAgents.find(a => a.id === selectedAgent)?.name}</Label>
                        <Select 
                          value={agentModelMapping[selectedAgent] || ''} 
                          onValueChange={(value) => handleAgentModelChange(selectedAgent, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose model for this agent..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.map(model => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                    )}
                  </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        )}

        <div className="flex justify-center items-center pt-4 gap-4">
          <Button 
            onClick={handleSubmit} 
            disabled={
              isLoading || 
              loadMode === 'load' || 
              !selectedBrainstormId ||
              (workflowMode === 'v2' && testJob?.status === 'loading') ||
              (workflowMode === 'debug' && (
                !selectedAgent || 
                !agentModelMapping[selectedAgent] ||
                (tccSource === 'savedV2Job' && !selectedDebugTccJobId) ||
                (tccSource === 'mockScenario' && !selectedMockScenarioId) ||
                (tccSource === 'inMemory' && !tccData)
              ))
            } 
            size="lg" 
            className="flex-1"
          >
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <TestTube2 className="mr-2 h-5 w-5" />}
            {workflowMode === 'v2' ? 'Start V2 Orchestration' : 'Test Selected Agent'}
          </Button>

          {workflowMode === 'v2' && testJob && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleResume}
                disabled={orchestrationStatus !== 'paused' || isLoading}
                title="Resume"
              >
                <Play className="h-4 w-4"/>
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handlePause}
                disabled={orchestrationStatus === 'paused' || isLoading}
                title="Pause"
              >
                <Pause className="h-4 w-4"/>
              </Button>
               <Button 
                variant="outline" 
                size="icon" 
                onClick={handleStepForward}
                disabled={orchestrationStatus !== 'paused' || isLoading}
                title="Step Forward"
              >
                <StepForward className="h-4 w-4"/>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      
      { (testJob || progressUpdates.length > 0 || tccData) && (
        <CardFooter className="flex-col items-start space-y-6 pt-6 border-t">
          <Tabs defaultValue="progress" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="tcc" disabled={(!testJob?.jobId || testJob.jobId.startsWith('debug-')) && !tccData}>TCC Monitor</TabsTrigger>
              <TabsTrigger value="websocket">WebSocket Logs</TabsTrigger>
              <TabsTrigger
                value="preview"
                disabled={
                  !assembledCode &&
                  !tccData?.finalProduct?.componentCode &&
                  !(testJob?.result && typeof testJob.result === 'object' && (
                    'componentCode' in testJob.result || (testJob.result as any).finalProduct?.componentCode
                  )) &&
                  workflowMode !== 'debug'
                }
              >
                Live Preview
              </TabsTrigger>
              <TabsTrigger value="component-code" disabled={!assembledCode && !tccData?.finalProduct?.componentCode && !(testJob?.result && ( (testJob.result as any).componentCode || (testJob.result as any).finalProduct?.componentCode))}>Component Code</TabsTrigger>
              <TabsTrigger value="agent-results" disabled={workflowMode !== 'debug' || !testJob?.result}>Agent Results</TabsTrigger>
              <TabsTrigger value="result" disabled={!testJob?.result && workflowMode !== 'debug'}>Tool Definition</TabsTrigger>
            </TabsList>
            
            <TabsContent value="progress" className="mt-4">
              {workflowMode === 'v2' ? (
                <ProgressLog progressUpdates={progressUpdates} isDarkMode={isDarkMode} />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    {testJob?.status === 'loading' && (
                      <div className="flex flex-col items-center justify-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="mt-2 text-sm text-gray-500">
                          Testing selected agent...
                        </p>
                      </div>
                    )}
                    {testJob?.status === 'error' && testJob.error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Generation Failed</AlertTitle>
                        <AlertDescription className="text-xs break-all">{testJob.error}</AlertDescription>
                      </Alert>
                    )}
                    {testJob?.status === 'success' && (
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">
                          Agent Test Completed!
                        </h3>
                        <p className="text-sm text-gray-600 mt-2">
                          Models used: {getModelsUsed(testJob).join(', ')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="tcc" className="mt-4">
              {(workflowMode === 'v2' && testJob?.jobId && !testJob.jobId.startsWith('debug-')) || (workflowMode === 'debug' && tccData) ? (
                <TCCVisualizer 
                  tccData={tccData}
                  currentStep={progressUpdates.length > 0 ? progressUpdates[0].stepName : 'loaded'}
                  jobId={testJob?.jobId || 'debug-mode'}
                  onRefreshTCC={workflowMode === 'v2' ? () => { handleRefreshTCC(); } : () => {}}
                  isLoading={isRefreshingTCC}
                  handleSaveTccSnapshot={handleSaveTccSnapshot}
                  handleLoadTccSnapshot={handleLoadTccSnapshot}
                />
              ) : (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center text-base">
                        <Database className="mr-2 h-5 w-5 text-green-500" />
                        TCC Monitor
                      </CardTitle>
                      <CardDescription className="text-xs">
                        View the live Tool Construction Context object.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button onClick={handleSaveTccSnapshot} size="sm" variant="outline" disabled={!tccData}>
                        <Save className="mr-2 h-4 w-4" /> Save
                      </Button>
                      <Button onClick={handleLoadTccSnapshot} size="sm" variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Load
                      </Button>
                      <Button onClick={recoverLastValidTcc} size="sm" variant="outline" disabled={!hasTccBackup}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Recover
                      </Button>
                      <Button onClick={handleRefreshTCC} size="sm" variant="outline" disabled={isRefreshingTCC}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {tccData ? (
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Job ID:</span>
                            <code className="text-xs bg-green-100 dark:bg-green-800 px-1 rounded">{tccData.jobId?.slice(0, 12)}...</code>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              {tccData.functionPlanning ? '✅' : '⚪'} Function Planning
                            </div>
                            <div className="flex items-center gap-1">
                              {tccData.stateLogic ? '✅' : '⚪'} State Logic
                            </div>
                            <div className="flex items-center gap-1">
                              {tccData.jsxLayout ? '✅' : '⚪'} JSX Layout
                            </div>
                            <div className="flex items-center gap-1">
                              {tccData.styling ? '✅' : '⚪'} Styling
                            </div>
                            <div className="flex items-center gap-1">
                              {tccData.finalProduct?.componentCode ? '✅' : '⚪'} Final Product Code
                            </div>
                            <div className="flex items-center gap-1">
                              {tccData.validationResults ? '✅' : '⚪'} Validation
                            </div>
                          </div>
                          <div className="pt-2 border-t border-green-200">
                            <span className="text-xs text-green-600 dark:text-green-400">
                              ✅ Ready to use current in-memory TCC data for isolated agent testing
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200">
                        <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                          <span>⚠️</span>
                          <span>No current TCC data available. Run a tool generation first to populate TCC data.</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="websocket" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                    {getConnectionStatusIcon()}
                      <span className="ml-2">WebSocket Debug Console</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getConnectionStatusBadge()}
                      {connectionStatus === 'connected' && (
                        <Badge variant="outline" className="text-green-600">
                          🟢 Live
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Real-time WebSocket connection monitoring with detailed debugging information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Environment Configuration Debug */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    <div className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Environment Configuration
                    </div>
                    <div className="text-xs space-y-1 grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">ENV Variable Set:</span> 
                        <span className={wsDebugInfo.hasEnvVar ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                          {wsDebugInfo.hasEnvVar ? '✅ Yes' : '❌ No'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Is Placeholder:</span> 
                        <span className={wsDebugInfo.isPlaceholder ? 'text-amber-600 ml-1' : 'text-green-600 ml-1'}>
                          {wsDebugInfo.isPlaceholder ? '⚠️ Yes' : '✅ No'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">WebSocket URL:</span>
                        <div className="font-mono text-gray-600 break-all mt-1 p-2 bg-white dark:bg-gray-900 rounded">
                          {wsDebugInfo.finalUrl}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Connection Statistics */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                    <div className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Connection Statistics
                    </div>
                    <div className="text-xs space-y-1 grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">Status:</span> 
                        <span className="ml-1 font-mono">{connectionStatus}</span>
                      </div>
                      <div>
                        <span className="font-medium">Attempts:</span> 
                        <span className="ml-1 font-mono">{wsDebugInfo.connectionAttempts}</span>
                      </div>
                      <div>
                        <span className="font-medium">Last Connected:</span>
                        <div className="font-mono text-gray-600 text-xs mt-1">
                          {wsDebugInfo.lastConnectionTime || 'Never'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Last Message:</span>
                        <div className="font-mono text-gray-600 text-xs mt-1">
                          {wsDebugInfo.lastMessageTime || 'None'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fallback Mode Warning */}
                  {connectionStatus === 'fallback' && (
                    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <AlertTitle className="text-orange-800 dark:text-orange-200">⚠️ FALLBACK MODE ACTIVE</AlertTitle>
                      <AlertDescription className="text-orange-700 dark:text-orange-300 text-sm">
                        <strong>NOT using real WebSocket!</strong> This is in-memory simulation for development.
                        <br />• Set <code className="bg-orange-100 dark:bg-orange-800 px-1 rounded">NEXT_PUBLIC_WEBSOCKET_API_ENDPOINT</code> for production WebSocket
                        <br />• Messages below are simulated, not from a real WebSocket server
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Real-time Message Log */}
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Real-time Activity Log
                      {connectionStatus === 'fallback' && (
                        <span className="text-xs text-orange-600 font-normal">(Fallback Mode)</span>
                      )}
                    </Label>
                    <ScrollArea className="h-64 mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md border">
                      <div className="space-y-1">
                        {wsLogs.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-8">
                            {connectionStatus === 'fallback' 
                              ? '🔄 Fallback mode active - waiting for job progress...' 
                              : '🔄 Waiting for WebSocket activity...'
                            }
                            <br />
                            <span className="text-xs">Start a V2 orchestration to see real-time logs</span>
                          </p>
                        ) : (
                          wsLogs.map((log, index) => (
                            <p key={index} className={`text-xs font-mono ${
                              log.includes('[FALLBACK') ? 'text-orange-700 dark:text-orange-300' : 
                              log.includes('[ERROR]') ? 'text-red-700 dark:text-red-300' :
                              log.includes('[CONNECTION]') ? 'text-blue-700 dark:text-blue-300' :
                              log.includes('[MESSAGE]') ? 'text-green-700 dark:text-green-300' :
                              ''
                            }`}>
                              {log}
                            </p>
                          ))
                        )}
                        <div ref={wsLogsEndRef} />
                      </div>
                    </ScrollArea>
                  </div>
                  
                  {/* Progress Updates Summary */}
                  {progressUpdates.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Step Progress Summary ({progressUpdates.length} steps)
                      </Label>
                      <ScrollArea className="h-32 mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200">
                        <div className="space-y-2">
                          {progressUpdates.map((progress, index) => (
                            <div key={index} className="flex items-center gap-3 text-xs">
                              <div className={`w-2 h-2 rounded-full ${
                                progress.status === 'completed' ? 'bg-green-500' :
                                progress.status === 'running' ? 'bg-blue-500' :
                                progress.status === 'failed' ? 'bg-red-500' :
                                'bg-yellow-500'
                              }`} />
                              <span className="font-mono">{progress.stepName}</span>
                              <span className="text-gray-500">→</span>
                              <span className={`font-medium ${
                                progress.status === 'completed' ? 'text-green-600' :
                                progress.status === 'running' ? 'text-blue-600' :
                                progress.status === 'failed' ? 'text-red-600' :
                                'text-yellow-600'
                              }`}>
                                {progress.status}
                              </span>
                              {progress.isFallback && (
                                <Badge variant="outline" className="text-xs text-orange-600">
                                  Fallback
                                </Badge>
                              )}
                            </div>
                          ))}
                          <div ref={progressSummaryEndRef} />
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Debug inspection area when preview/result tabs are disabled */}
                  {workflowMode === 'v2' && (!assembledCode || testJob?.status !== 'success') && tccData && (
                    <div>
                      <Label className="text-sm font-medium">🔍 Debug Inspection (Preview/Result tabs disabled):</Label>
                      <ScrollArea className="h-48 mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200">
                        <div className="text-xs font-mono space-y-2">
                          <p><strong>assembledCode:</strong> {assembledCode ? 'Available' : 'Missing'}</p>
                          <p><strong>testJob.status:</strong> {testJob?.status || 'No job'}</p>
                          <p><strong>TCC Keys:</strong> {Object.keys(tccData).join(', ')}</p>
                          
                          {tccData.finalProduct?.componentCode && (
                            <div>
                              <p><strong>TCC.finalProduct.componentCode:</strong> Available ({tccData.finalProduct.componentCode.length} chars)</p>
                              <details className="mt-1">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Code</summary>
                                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs whitespace-pre-wrap">{tccData.finalProduct.componentCode}</pre>
                              </details>
                            </div>
                          )}

                          {tccData.styling && (
                            <div>
                              <p><strong>TCC.styling:</strong> Available</p>
                              <details className="mt-1">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Styling</summary>
                                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">{JSON.stringify(tccData.styling, null, 2)}</pre>
                              </details>
                            </div>
                          )}

                          {testJob?.result && (
                            <div>
                              <p><strong>testJob.result:</strong> Available</p>
                              <details className="mt-1">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Tool Definition</summary>
                                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">{JSON.stringify(testJob.result, null, 2)}</pre>
                              </details>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Eye className="mr-2 h-5 w-5"/>Live Preview with Debug Console</CardTitle>
                  <CardDescription>
                    {workflowMode === 'debug' ? 'Live preview of the agent\'s work with real-time debugging. Interact with the tool above to see debug events below.' : 'Live preview of the generated component with real-time debugging. Interact with the tool to see debug events.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Tool Preview Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Eye className="mr-2 h-4 w-4" />
                      Tool Preview
                    </h3>
                    {(() => {
                      // UNIFIED PREVIEW LOGIC - FIXED: Only use SINGLE SOURCE OF TRUTH
                      // Component code is ONLY stored in finalProduct.componentCode after assembly
                      
                      console.log('🔍 PREVIEW LOGIC TRACE =======================================');
                      console.log('🔍 SOURCES AVAILABLE:');
                      console.log('🔍   testJob?.result:', !!testJob?.result);
                      console.log('🔍   testJob?.result.componentCode length:', testJob?.result && typeof testJob.result === 'object' && 'componentCode' in testJob.result ? (testJob.result as any).componentCode?.length : 'N/A');
                      console.log('🔍   tccData?.finalProduct?.componentCode length:', tccData?.finalProduct?.componentCode?.length || 'N/A');
                      console.log('🔍   workflowMode:', workflowMode);
                      console.log('🔍   timestamp:', new Date().toISOString());
                      
                      let previewTool = null;
                      let previewSource = '';
                      
                      // PRIORITY 1: Use final tool result if available (V2 orchestration complete)
                      if (testJob?.result && typeof testJob.result === 'object' && 'finalProduct' in testJob.result && 'componentCode' in testJob.result.finalProduct) {
                        previewTool = {
                          id: testJob.result.id,
                          slug: testJob.result.slug,
                          componentCode: testJob.result.finalProduct.componentCode,
                          metadata: testJob.result.metadata,
                          initialStyleMap: testJob.result.initialStyleMap,
                          currentStyleMap: testJob.result.currentStyleMap,
                          createdAt: testJob.result.createdAt,
                          updatedAt: testJob.result.updatedAt
                        };
                        previewSource = 'Final Tool Result (finalProduct.componentCode)';
                        console.log('🔍 ✅ USING PRIORITY 1: Final Tool Result (finalProduct.componentCode)');
                        console.log('🔍     Tool ID:', previewTool.id);
                        console.log('🔍     Code length:', previewTool.componentCode.length);
                        console.log('🔍     Code hash:', safeHash(previewTool.componentCode));
                      }
                      // PRIORITY 1b: Use final tool result if available (V2 orchestration complete)
                       else if (testJob?.result && typeof testJob.result === 'object' && 'componentCode' in testJob.result) {
                        previewTool = testJob.result;
                        previewSource = 'Final Tool Result';
                        console.log('🔍 ✅ USING PRIORITY 1: Final Tool Result');
                        console.log('🔍     Tool ID:', (testJob.result as any).id);
                        console.log('🔍     Code length:', (testJob.result as any).componentCode?.length);
                        console.log('🔍     Code hash:', (testJob.result as any).componentCode ? safeHash((testJob.result as any).componentCode) : 'NO-CODE');
                        console.log('🔍     Contains sliders?:', (testJob.result as any).componentCode?.includes('Slider'));
                      }
                      // PRIORITY 1b: Use finalProduct.componentCode embedded inside the tool result (some agent pipelines)
                       else if (testJob?.result && typeof testJob.result === 'object' && (testJob.result as any).finalProduct?.componentCode) {
                         const finalProduct = (testJob.result as any).finalProduct;
                         previewTool = {
                           ...(testJob.result as any),
                           componentCode: finalProduct.componentCode,
                           metadata: finalProduct.metadata || (testJob.result as any).metadata || {
                             title: finalProduct.title || 'Generated Tool',
                             description: finalProduct.description || 'Tool generated via pipeline',
                             slug: finalProduct.slug || 'generated-tool'
                           }
                         } as any;
                         previewSource = 'Final Tool Result (finalProduct.componentCode)';
                         console.log('🔍 ✅ USING PRIORITY 1b: finalProduct.componentCode');
                         console.log('🔍     Tool ID:', (previewTool as any).id);
                         console.log('🔍     Code length:', finalProduct.componentCode?.length);
                         console.log('🔍     Code hash:', safeHash(finalProduct.componentCode));
                       }
                       // PRIORITY 2: Use TCC finalProduct component code (component assembler completed)
                      else if (tccData?.finalProduct?.componentCode) {
                        previewTool = {
                          id: tccData.jobId || `preview-${Date.now()}`,
                          slug: tccData.userInput?.description?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preview-tool',
                          componentCode: tccData.finalProduct.componentCode,
                          metadata: {
                            id: tccData.jobId || `preview-${Date.now()}`,
                            slug: tccData.userInput?.description?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preview-tool',
                            title: tccData.userInput?.description || 'Generated Tool Preview',
                            type: tccData.userInput?.toolType || 'Tool',
                            description: tccData.userInput?.description || 'Tool preview from TCC finalProduct',
                            userInstructions: 'This is a preview of the generated tool.',
                            developerNotes: 'Generated from TCC finalProduct component code.',
                            dependencies: ['react'],
                            source: 'tcc-finalproduct-preview',
                            version: '1.0.0-preview'
                          },
                          initialStyleMap: tccData.styling?.styleMap || {},
                          currentStyleMap: tccData.styling?.styleMap || {},
                          createdAt: Date.now(),
                          updatedAt: Date.now()
                        };
                        previewSource = 'TCC Final Product Code';
                        console.log('🔍 ✅ USING PRIORITY 2: TCC Final Product Code');
                        console.log('🔍     TCC Job ID:', tccData.jobId);
                        console.log('🔍     Code length:', tccData.finalProduct.componentCode.length);
                        console.log('🔍     Code hash:', safeHash(tccData.finalProduct.componentCode));
                        console.log('🔍     Contains sliders?:', tccData.finalProduct.componentCode.includes('Slider'));
                      }
                      // PRIORITY 3 – use assembledComponentCode if finalProduct hasn't arrived yet
                      else if (assembledCode) {
                        previewTool = {
                          id: tccData?.jobId || `preview-${Date.now()}`,
                          slug:
                            (tccData?.userInput?.description || 'preview-tool')
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, '-')
                              .replace(/^-+|-+$/g, ''),
                          componentCode: assembledCode,
                          metadata: {
                            id: tccData?.jobId || `preview-${Date.now()}`,
                            slug:
                              (tccData?.userInput?.description || 'preview-tool')
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/^-+|-+$/g, ''),
                            title:
                              tccData?.brainstormData?.coreConcept ||
                              'Generated Tool Preview',
                            type: tccData?.userInput?.toolType || 'Tool',
                            description:
                              tccData?.brainstormData?.valueProposition ||
                              'Preview generated from assembledComponentCode.',
                            userInstructions:
                              'Interact with this preview to test the generated tool.',
                            developerNotes:
                              'Preview built from assembledComponentCode before finalProduct was emitted.',
                            dependencies: ['react'],
                            source: 'assembled-component-preview',
                            version: '1.0.0-preview'
                          },
                          initialStyleMap: tccData?.styling?.styleMap || {},
                          currentStyleMap: tccData?.styling?.styleMap || {},
                          createdAt: Date.now(),
                          updatedAt: Date.now()
                        };
                        previewSource = 'Assembled Component Code';
                        console.log('🔍 ✅ USING PRIORITY 3: Assembled Component Code');
                        console.log('🔍     Code length:', assembledCode.length);
                        console.log('🔍     Code hash:', safeHash(assembledCode));
                      }
                      // PRIORITY 4 – debug-mode finalProduct
                      else if (workflowMode === 'debug' && testJob?.result && typeof testJob.result === 'object' && 'updatedTcc' in testJob.result) {
                        const debugTccData = (testJob.result as any).updatedTcc;
                        const originalTool = (testJob.result as any).originalTool;
                        
                        console.log('🔍 📋 DEBUG MODE - Checking for finalProduct code...');
                        console.log('🔍     debugTccData.finalProduct?.componentCode length:', debugTccData.finalProduct?.componentCode?.length || 'N/A');
                        
                        // ✅ SINGLE SOURCE OF TRUTH: Only use finalProduct.componentCode in debug mode
                        if (debugTccData.finalProduct?.componentCode) {
                          previewTool = {
                            id: debugTccData.jobId || originalTool?.id || `debug-${Date.now()}`,
                            slug: originalTool?.slug || debugTccData.userInput?.description?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'debug-tool',
                            componentCode: debugTccData.finalProduct.componentCode,
                            metadata: {
                              id: debugTccData.jobId || originalTool?.id || `debug-${Date.now()}`,
                              slug: originalTool?.slug || debugTccData.userInput?.description?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'debug-tool',
                              title: originalTool?.metadata?.title || debugTccData.userInput?.description || `Debug Tool: ${selectedAgent}`,
                              type: originalTool?.metadata?.type || debugTccData.userInput?.toolType || 'Debug Tool',
                              description: originalTool?.metadata?.description || debugTccData.userInput?.description || 'Tool created from isolated agent testing',
                              userInstructions: originalTool?.metadata?.userInstructions || 'Instructions not available in debug mode.',
                              developerNotes: originalTool?.metadata?.developerNotes || `Debug tool created from isolated ${selectedAgent} agent testing.`,
                              dependencies: originalTool?.metadata?.dependencies || ['react'],
                              source: 'debug-isolated-agent',
                              version: originalTool?.metadata?.version || '1.0.0-debug'
                            },
                            initialStyleMap: originalTool?.initialStyleMap || debugTccData.styling?.styleMap || {},
                            currentStyleMap: debugTccData.styling?.styleMap || originalTool?.currentStyleMap || originalTool?.initialStyleMap || {},
                            createdAt: originalTool?.createdAt || Date.now(),
                            updatedAt: Date.now()
                          };
                          previewSource = `Debug Agent: ${selectedAgent} (Final Product)`;
                          console.log('🔍 ✅ USING PRIORITY 3: Debug Mode Final Product Code');
                          console.log('🔍     Debug TCC Job ID:', debugTccData.jobId);
                          console.log('🔍     Code length:', debugTccData.finalProduct.componentCode.length);
                          console.log('🔍     Code hash:', safeHash(debugTccData.finalProduct.componentCode));
                          console.log('🔍     Contains sliders?:', debugTccData.finalProduct.componentCode.includes('Slider'));
                        } else {
                          console.log('🔍 ❌ DEBUG MODE: No finalProduct code available - preview will be empty');
                        }
                      } else {
                        console.log('🔍 ❌ NO PREVIEW SOURCE AVAILABLE');
                        console.log('🔍     All conditions failed - no preview will be shown');
                      }
                      
                      console.log('🔍 FINAL SELECTION:');
                      console.log('🔍   previewSource:', previewSource);
                      console.log('🔍   previewTool?.id:', previewTool?.id);
                      console.log('🔍   previewTool?.componentCode length:', previewTool?.componentCode?.length || 'N/A');
                      console.log('🔍 =========================================================');
                      
                      // Render the preview
                      if (previewTool) {
                        return (
                          <div className="space-y-4">
                            {/* Preview source indicator */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{previewSource}</Badge>
                                <span className="text-sm text-gray-600">
                                  {workflowMode === 'debug' ? 'Agent testing preview' : 'Tool generation preview'}
                                </span>
                              </div>
                              {workflowMode === 'debug' && (
                                <Badge variant="secondary" className="text-xs">
                                  🔍 Debug Mode
                                </Badge>
                              )}
                            </div>
                            
                            {/* Debug mode alert */}
                            {workflowMode === 'debug' && previewSource.includes('Debug') && (
                              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                                <Eye className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-blue-800 dark:text-blue-200">🔍 Debug Preview</AlertTitle>
                                <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                                  This preview is generated from the TCC data updated by the isolated agent. It shows how the tool would look with the current agent's output.
                                </AlertDescription>
                              </Alert>
                            )}
                            
                            {/* Component preview */}
                            <CanvasTool 
                              key={`canvas-tool-${previewTool?.id || previewTool?.metadata?.id || 'no-tool'}-${previewTool?.componentCode?.length || 0}-${previewTool?.componentCode?.substring(0, 100).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'no-code'}`}
                              productToolDefinition={previewTool as any} 
                              isDarkMode={isDarkMode} 
                            />
                          </div>
                        );
                      }
                      // No preview available
                      else if (workflowMode === 'debug') {
                        return (
                          <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50">
                            <div className="text-center">
                              <Eye className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                              <p className="text-blue-600 font-medium">AGENT PREVIEW NOT AVAILABLE</p>
                              <p className="text-blue-500 text-sm">This agent doesn't produce visual components.</p>
                              <p className="text-blue-500 text-sm">Check the "Agent Results" tab for detailed output.</p>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
                            <div className="text-center">
                              <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-500 font-medium">No Component Preview Available</p>
                              <p className="text-gray-400 text-sm">Run a tool generation to see the preview</p>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  {/* Debug Panel Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Bug className="mr-2 h-4 w-4" />
                      Debug Panel
                    </h3>
                    {(() => {
                      // Get the component code for debugging - SINGLE SOURCE OF TRUTH
                      const componentCode = assembledCode || (tccData?.finalProduct?.componentCode) || '';
                      const toolId = testJob?.jobId || 'debug-tool';
                      
                      if (componentCode) {
                        return (
                          <ToolDebugPanel
                            toolId={toolId}
                            componentCode={componentCode}
                            metadata={{
                              title: testJob?.result?.metadata?.title || 'Generated Tool',
                              description: testJob?.result?.metadata?.description || 'Debug session for generated tool',
                              slug: testJob?.result?.metadata?.slug || 'debug-tool'
                            }}
                            onDebugEvent={(event) => {
                              // Use setTimeout to avoid setState during render
                              setTimeout(() => {
                                console.log('Debug event captured:', event);
                              }, 0);
                            }}
                            className="h-[500px]"
                          />
                        );
                      } else {
                        return (
                          <div className="flex items-center justify-center h-48 p-6">
                            <div className="text-center">
                              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-500 font-medium">Tool Debug Not Available</p>
                              <p className="text-gray-400 text-sm">Generate a tool to enable interactive debugging</p>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="component-code" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Code className="mr-2 h-5 w-5 text-purple-500"/>
                    Raw Component Code
                  </CardTitle>
                  <CardDescription>
                    The actual component code being passed to the renderer. This shows exactly what was generated, including any problematic import statements.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Get the component code from various sources
                    let componentCode = '';
                    let codeSource = '';
                    
                    // Try to get from assembled code first (V2 orchestration result)
                    if (assembledCode) {
                      componentCode = assembledCode;
                      codeSource = 'Assembled Code (V2 Orchestration)';
                    }
                    // Try to get from TCC assembledComponentCode (component assembler result)
                    else if (tccData?.assembledComponentCode) {
                      componentCode = tccData.assembledComponentCode;
                      codeSource = 'TCC assembledComponentCode (Component Assembler)';
                    }
                    // Try to get from test job result (completed tool)
                    else if (testJob?.result && typeof testJob.result === 'object' && 'componentCode' in testJob.result) {
                      componentCode = (testJob.result as any).componentCode;
                      codeSource = 'Tool Definition componentCode';
                    }
                    // Fallback to finalProduct.componentCode if present within result
                    else if (testJob?.result && typeof testJob.result === 'object' && (testJob.result as any).finalProduct?.componentCode) {
                      componentCode = (testJob.result as any).finalProduct.componentCode;
                      codeSource = 'Tool Definition finalProduct.componentCode';
                    }
                    // Try to get from TCC data (debug/agent results) - SINGLE SOURCE OF TRUTH
                    else if (testJob?.result && typeof testJob.result === 'object' && 'updatedTcc' in testJob.result) {
                      const tccData = (testJob.result as any).updatedTcc;
                      if (tccData.finalProduct?.componentCode) {
                        componentCode = tccData.finalProduct.componentCode;
                        codeSource = 'TCC finalProduct.componentCode';
                      }
                      // REMOVED: No fallback to styled or JSX code that bypasses component fixes
                    }

                    if (componentCode) {
                      const formatDetection = detectComponentCodeFormat(componentCode);
                      const isJsx = formatDetection.codeFormat === 'jsx';
                      const lines = componentCode.split('\n');
                      const importLines = lines.filter(line => line.trim().startsWith('import '));
                      
                      return (
                        <div className="space-y-4">
                          {/* Code source and analysis */}
                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{codeSource}</Badge>
                              <span className="text-sm text-gray-600">
                                {lines.length} lines, {componentCode.length} characters
                              </span>
                            </div>
                            {isJsx && (
                              <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-300">
                                ✅ JSX Format: {importLines.length} import statement{importLines.length !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>

                          {/* Import statements analysis - UPDATED FOR NEW JSX DESIGN */}
                          {isJsx ? (
                            <Alert variant="default" className="border-green-200 bg-green-50 dark:bg-green-900/20">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <AlertTitle className="text-green-800 dark:text-green-200">✅ JSX Format Detected</AlertTitle>
                              <AlertDescription className="text-sm text-green-700 dark:text-green-300">
                                <p className="mb-2">This component uses the new JSX format with import statements:</p>
                                <ul className="list-disc list-inside text-xs space-y-1">
                                  {importLines.map((line, index) => (
                                    <li key={index} className="font-mono bg-green-100 dark:bg-green-800/50 px-2 py-1 rounded">
                                      {line.trim()}
                                    </li>
                                  ))}
                                </ul>
                                <p className="mt-2 text-xs">
                                  ✅ The DynamicComponentRenderer will use JSX transpilation to handle imports automatically.
                                </p>
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                              <Info className="h-4 w-4 text-blue-600" />
                              <AlertTitle className="text-blue-800 dark:text-blue-200">Legacy Component Format</AlertTitle>
                              <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                                <p className="text-xs">
                                  This component uses the legacy React.createElement format. Consider regenerating for modern JSX format.
                                </p>
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Component code display */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Component Code:</Label>
                            <ScrollArea className="h-96 w-full border rounded-md">
                              <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                                <code>{componentCode}</code>
                              </pre>
                              <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
                          <div className="text-center">
                            <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">No Component Code Available</p>
                            <p className="text-gray-400 text-sm">Run a tool generation or agent test to see code</p>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agent-results" className="mt-4">
              {workflowMode === 'debug' && testJob?.result && typeof testJob.result === 'object' && 'updatedTcc' in testJob.result ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Brain className="mr-2 h-5 w-5 text-blue-500"/>
                        Isolated Agent Results - {selectedAgent}
                      </CardTitle>
                      <CardDescription>
                        TCC (Tool Construction Context) data updated by the isolated agent test.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800 dark:text-green-200">✅ Agent Test Successful</AlertTitle>
                        <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                          The isolated agent completed successfully without triggering the next orchestration step.
                        </AlertDescription>
                      </Alert>

                      {/* Finalize Button - Only show if we have TCC data from layout/state/style agents */}
                      {(() => {
                        // CRITICAL FIX: Check both testJob.result.updatedTcc AND the tccData state
                        const testJobTccData = (testJob.result as any).updatedTcc;
                        const currentTccData = tccData;
                        const activeTccData = testJobTccData || currentTccData;
                        
                        const canFinalize = activeTccData && (
                          (activeTccData.jsxLayout && activeTccData.stateLogic) || // Layout + State completed
                          (activeTccData.styling) || // Styling completed
                          (activeTccData.jsxLayout && activeTccData.styling) || // Layout + Styling
                          (activeTccData.stateLogic && activeTccData.styling) || // State + Styling
                          (activeTccData.jsxLayout) || // Just layout (can finalize)
                          (activeTccData.stateLogic) // Just state (can finalize)
                        );

                        if (canFinalize) {
                          return (
                            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                              <Zap className="h-4 w-4 text-blue-600" />
                              <AlertTitle className="text-blue-800 dark:text-blue-200">🎯 Ready for Finalization</AlertTitle>
                              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                                The tool has progressed through one or more agent steps. You can now run the final assembly, validation, and finalization stages.
                                <br/>
                                <span className="text-xs mt-1 block">
                                  TCC Status: 
                                  {activeTccData.jsxLayout ? ' ✅ Layout' : ' ⏸️ Layout'}
                                  {activeTccData.stateLogic ? ' ✅ State' : ' ⏸️ State'}  
                                  {activeTccData.styling ? ' ✅ Styling' : ' ⏸️ Styling'}
                                </span>
                              </AlertDescription>
                              <div className="mt-3">
                                <Button 
                                  onClick={handleTccFinalization}
                                  disabled={isLoading}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  {isLoading ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Finalizing...
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="mr-2 h-4 w-4" />
                                      Finalize Tool
                                    </>
                                  )}
                                </Button>
                                <p className="text-xs text-blue-600 mt-2">
                                  This will run Component Assembler → Validator → Tool Finalizer in sequence.
                                </p>
                              </div>
                            </Alert>
                          );
                        }
                        return null;
                      })()}
                      
                      {(() => {
                        // ENHANCED: Use the same TCC data source logic for results display
                        const testJobTccData = (testJob.result as any).updatedTcc;
                        const currentTccData = tccData;
                        const activeTccData = testJobTccData || currentTccData;
                        
                        return (
                          <div className="space-y-4">
                            {/* Agent-specific results */}
                            {selectedAgent === 'tailwind-styling' && activeTccData?.styling && (
                              <Card className="border-purple-200">
                                <CardHeader>
                                  <CardTitle className="text-purple-700 text-lg">🎨 Styling Results</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {activeTccData.styling.styledComponentCode && (
                                      <div>
                                        <Badge variant="outline" className="mb-2">Styled Component Code</Badge>
                                        <pre className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md text-sm overflow-x-auto max-h-96 overflow-y-auto">
                                          {activeTccData.styling.styledComponentCode}
                                        </pre>
                                      </div>
                                    )}
                                    {activeTccData.styling.styleMap && (
                                      <div>
                                        <Badge variant="outline" className="mb-2">Style Map (Element → Classes)</Badge>
                                        <div className="grid gap-2">
                                          {Object.entries(activeTccData.styling.styleMap).slice(0, 5).map(([key, value]) => (
                                            <div key={key} className="flex justify-between text-sm bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                                              <span className="font-mono text-purple-700">{key}</span>
                                              <span className="text-purple-600">{String(value)}</span>
                                            </div>
                                          ))}
                                          {Object.keys(activeTccData.styling.styleMap).length > 5 && (
                                            <div className="text-sm text-purple-600">+ {Object.keys(activeTccData.styling.styleMap).length - 5} more styles</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {activeTccData.styling.colorScheme && (
                                      <div>
                                        <Badge variant="outline" className="mb-2">Color Scheme</Badge>
                                        <div className="grid gap-2">
                                          <div className="flex justify-between text-sm bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                                            <span className="font-mono text-purple-700">Primary</span>
                                            <span className="text-purple-600">{activeTccData.styling.colorScheme.primary}</span>
                                          </div>
                                          <div className="flex justify-between text-sm bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                                            <span className="font-mono text-purple-700">Secondary</span>
                                            <span className="text-purple-600">{activeTccData.styling.colorScheme.secondary}</span>
                                          </div>
                                          <div className="flex justify-between text-sm bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                                            <span className="font-mono text-purple-700">Background</span>
                                            <span className="text-purple-600">{activeTccData.styling.colorScheme.background}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                            
                            {selectedAgent === 'jsx-layout' && activeTccData?.jsxLayout && (
                              <Card className="border-green-200">
                                <CardHeader>
                                  <CardTitle className="text-green-700 text-lg">🏗️ JSX Layout Results</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {activeTccData.jsxLayout.componentStructure && (
                                      <div>
                                        <Badge variant="outline" className="mb-2">Component Structure</Badge>
                                        <pre className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md text-sm overflow-x-auto max-h-64">
                                          {activeTccData.jsxLayout.componentStructure}
                                        </pre>
                                      </div>
                                    )}
                                    {activeTccData.jsxLayout.layoutDecisions && (
                                      <div>
                                        <Badge variant="outline" className="mb-2">Layout Decisions</Badge>
                                        <div className="text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded max-h-64 overflow-y-auto">
                                          {JSON.stringify(activeTccData.jsxLayout.layoutDecisions, null, 2)}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {selectedAgent === 'state-design' && activeTccData?.stateLogic && (
                              <Card className="border-blue-200">
                                <CardHeader>
                                  <CardTitle className="text-blue-700 text-lg">🎯 State Design Results</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {/* 🔍 DEBUG: Show actual TCC structure */}
                                  <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                                    <div className="text-xs space-y-1 text-green-700 dark:text-green-300">
                                      <div className="font-semibold">✅ TCC Schema Compliance: State Design Data Structure</div>
                                      <div>• activeTccData.stateLogic exists: {activeTccData?.stateLogic ? '✅' : '❌'}</div>
                                      <div>• stateLogic keys: {activeTccData?.stateLogic ? Object.keys(activeTccData.stateLogic).join(', ') : 'N/A'}</div>
                                      <div>• variables field (TCC Schema): {activeTccData?.stateLogic?.variables ? `✅ (${activeTccData.stateLogic.variables.length})` : '❌'}</div>
                                      <div>• functions field (TCC Schema): {activeTccData?.stateLogic?.functions ? `✅ (${activeTccData.stateLogic.functions.length})` : '❌'}</div>
                                      <div>• imports field (TCC Schema): {activeTccData?.stateLogic?.imports ? `✅ (${activeTccData.stateLogic.imports.length})` : '❌'}</div>
                                      <div className="font-semibold text-green-800 mt-2">🎯 All field names now match TCC StateLogic schema!</div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    {/* ✅ FIXED: Use correct TCC schema field names */}
                                    {activeTccData.stateLogic.variables && (
                                      <div>
                                        <Badge variant="outline" className="mb-2">State Variables ({activeTccData.stateLogic.variables.length} total)</Badge>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                          {activeTccData.stateLogic.variables.map((variable: any, idx: number) => (
                                            <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm">
                                              <div className="font-semibold text-blue-700">{variable.name}: {variable.type}</div>
                                              <div className="text-blue-600">{variable.description}</div>
                                              <div className="text-xs text-blue-500">Initial Value: {JSON.stringify(variable.initialValue) || 'none'}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* ✅ FIXED: Use correct TCC schema field names */}
                                    {activeTccData.stateLogic.functions && (
                                      <div>
                                        <Badge variant="outline" className="mb-2">State Functions ({activeTccData.stateLogic.functions.length} total)</Badge>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                          {activeTccData.stateLogic.functions.map((func: any, idx: number) => (
                                            <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm">
                                              <div className="font-semibold text-blue-700">{func.name}</div>
                                              <div className="text-blue-600">{func.description}</div>
                                              <div className="text-xs text-blue-500 font-mono">
                                                Dependencies: {func.dependencies?.join(', ') || 'None'}
                                              </div>
                                              {func.body && (
                                                <div className="text-xs text-blue-400 mt-1 font-mono bg-blue-100 dark:bg-blue-800 p-1 rounded">
                                                  {func.body.substring(0, 100)}{func.body.length > 100 ? '...' : ''}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                            
                            {selectedAgent === 'function-planner' && activeTccData?.definedFunctionSignatures && (
                              <Card className="border-orange-200">
                                <CardHeader>
                                  <CardTitle className="text-orange-700 text-lg">⚙️ Function Planning Results</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    <div>
                                      <Badge variant="outline" className="mb-2">Defined Functions ({activeTccData.definedFunctionSignatures.length} total)</Badge>
                                      <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {activeTccData.definedFunctionSignatures.map((func: any, idx: number) => (
                                          <div key={idx} className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded text-sm">
                                            <div className="font-semibold text-orange-700">{func.name}</div>
                                            <div className="text-orange-600">{func.description}</div>
                                            <div className="text-xs text-orange-500 font-mono">
                                              Parameters: {func.parameters?.length || 0} | Returns: {func.returnType || 'void'}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              ) : workflowMode === 'debug' && testJob?.status === 'error' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <AlertCircle className="mr-2 h-5 w-5 text-red-500"/>
                      Agent Test Failed
                    </CardTitle>
                    <CardDescription>The isolated agent test encountered an error.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Agent Error</AlertTitle>
                      <AlertDescription className="text-xs break-all">{testJob.error}</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
                  <p className="text-gray-500">
                    {workflowMode === 'debug' ? 'Run an isolated agent test to see results.' : 'Tool generation is not yet complete.'}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="result" className="mt-4">
              {/* DEBUG: Add debugging info to help diagnose save button issues */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="text-sm space-y-1">
                  <div className="font-semibold text-blue-800 dark:text-blue-200">🔍 Debug: Save Button Conditions</div>
                  <div className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
                    <div>• testJob exists: {testJob ? '✅ Yes' : '❌ No'}</div>
                    <div>• testJob.status: {testJob?.status || 'undefined'}</div>
                    <div>• testJob.result exists: {testJob?.result ? '✅ Yes' : '❌ No'}</div>
                    <div>• Should show save buttons: {(testJob?.status === 'success' && testJob.result) ? '✅ Yes' : '❌ No'}</div>
                    <div>• Current workflow mode: {workflowMode}</div>
                    <div>• Load mode: {loadMode}</div>
                    {testJob?.result && (
                      <>
                        <div>• Current tool ID: {(testJob.result as any).id || 'No ID'}</div>
                        <div>• Tool in savedToolIds: {(testJob.result as any).id && savedToolIds.has((testJob.result as any).id) ? '✅ Yes' : '❌ No'}</div>
                        <div>• Selected load item: {selectedLoadItem ? `${selectedLoadItem.type}:${selectedLoadItem.id}` : 'None'}</div>
                        <div>• savedToolIds count: {savedToolIds.size}</div>
                        <div>• First few savedToolIds: [{Array.from(savedToolIds).slice(0, 3).join(', ')}]</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
               {testJob?.result ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <CheckCircle className="mr-2 h-5 w-5 text-green-500"/>
                      {workflowMode === 'debug' ? 'Isolated Agent Result' : 'Generation Complete'}
                    </CardTitle>
                    <CardDescription>
                      {workflowMode === 'debug' 
                        ? 'Tool Definition object showing the complete tool state after applying the isolated agent\'s changes. This matches the ProductToolDefinition format used in full generation.'
                        : 'The final tool definition has been created and is ready to be saved.'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Models Used:</Badge>
                      {getModelsUsed(testJob).map(modelId => (
                        <Badge key={modelId} variant="secondary" className="text-xs">
                          {availableModels.find(m => m.id === modelId)?.name?.split(' ')[0] || modelId}
                        </Badge>
                      ))}
                    </div>
                    
                    {workflowMode === 'debug' && (
                      <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800 dark:text-green-200">✅ Agent Test Complete</AlertTitle>
                        <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                          The isolated agent completed successfully. Below is the final ProductToolDefinition with the agent's changes applied.
                          This is the same format as full generation, enabling consistent testing and validation.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {(() => {
                      // For debug mode, transform TCC data into ProductToolDefinition format
                      if (workflowMode === 'debug' && testJob.result && typeof testJob.result === 'object' && 'updatedTcc' in testJob.result) {
                        const tccData = (testJob.result as any).updatedTcc;
                        const originalTool = (testJob.result as any).originalTool;
                        
                        // Create a ProductToolDefinition from the updated TCC
                        const transformedResult = {
                          id: tccData.jobId || originalTool?.id || `debug-${Date.now()}`,
                          slug: originalTool?.slug || tccData.userInput?.description?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'debug-tool',
                          componentCode: tccData.finalProduct?.componentCode || originalTool?.componentCode || '<div>Component code not available</div>',
                          metadata: {
                            id: tccData.jobId || originalTool?.id || `debug-${Date.now()}`,
                            slug: originalTool?.slug || tccData.userInput?.description?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'debug-tool',
                            title: originalTool?.metadata?.title || tccData.userInput?.description || 'Debug Tool',
                            type: originalTool?.metadata?.type || tccData.userInput?.toolType || 'Debug Tool',
                            description: originalTool?.metadata?.description || tccData.userInput?.description || 'Tool created from isolated agent testing',
                            userInstructions: originalTool?.metadata?.userInstructions || 'Instructions not available in debug mode.',
                            developerNotes: originalTool?.metadata?.developerNotes || `Debug tool created from isolated ${selectedAgent} agent testing.`,
                            dependencies: originalTool?.metadata?.dependencies || ['react'],
                            source: 'debug-isolated-agent',
                            version: originalTool?.metadata?.version || '1.0.0-debug'
                          },
                          initialStyleMap: originalTool?.initialStyleMap || tccData.styling?.styleMap || {},
                          currentStyleMap: tccData.styling?.styleMap || originalTool?.currentStyleMap || originalTool?.initialStyleMap || {},
                          createdAt: originalTool?.createdAt || Date.now(),
                          updatedAt: Date.now()
                        };

                        return (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-blue-600 border-blue-300">Agent Result</Badge>
                              <Badge variant="secondary" className="text-xs">{selectedAgent}</Badge>
                              <Badge variant="outline" className="text-xs">ProductToolDefinition Format</Badge>
                            </div>
                            
                            <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto max-h-96 text-sm">
                              {JSON.stringify(transformedResult, null, 2)}
                            </pre>
                            
                            <div className="flex gap-2">
                              {(() => {
                                const isAlreadySaved = savedToolIds.has(transformedResult.id);
                                const isLoadedTool = loadMode === 'load' && selectedLoadItem?.type === 'tool';
                                
                                return (
                                  <Button 
                                    onClick={() => isAlreadySaved || isLoadedTool ? handleUpdateTool(transformedResult as ProductToolDefinition) : handleSaveTool(transformedResult as ProductToolDefinition)}
                                    disabled={false}
                                    variant="default"
                                  >
                                    <Save className="mr-2 h-4 w-4" />
                                    {isAlreadySaved || isLoadedTool ? 'Update Tool' : 'Save Tool to Browser DB'}
                                  </Button>
                                );
                              })()}
                              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(transformedResult, null, 2))}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Result JSON
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => {
                                const blob = new Blob([JSON.stringify(transformedResult, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${selectedAgent}-agent-result.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}>
                                <Download className="mr-2 h-4 w-4" />
                                Export Result
                              </Button>
                            </div>
                          </div>
                        );
                      } else {
                        // For full generation, display the result as-is
                        return (
                          <div className="space-y-4">
                    <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto max-h-96 text-sm">
                      {JSON.stringify(testJob.result, null, 2)}
                    </pre>
                            
                    {/* Universal Save/Update Section - works for all modes */}
                    {testJob.result && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-green-600 border-green-300">Tool Definition Ready</Badge>
                          <Badge variant="secondary" className="text-xs">{workflowMode.toUpperCase()}</Badge>
                        </div>
                        
                        {/* DEBUG: Save/Update Button Logic Debug */}
                        {/* <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                          <div className="text-xs space-y-1 text-red-700 dark:text-red-300">
                            <div className="font-semibold">🔍 Save/Update Button Debug:</div>
                            {(() => {
                              const tool = testJob.result as ProductToolDefinition;
                              const isAlreadySaved = savedToolIds.has(tool.id);
                              const isLoadedTool = loadMode === 'load' && (selectedLoadItem?.type === 'tool' || selectedLoadItem?.type === 'v2job');
                              const wasLoadedAndFinalized = loadMode === 'load' && selectedLoadItem;
                              const shouldUpdate = isAlreadySaved || isLoadedTool || wasLoadedAndFinalized;
                              
                              return (
                                <>
                                  <div>• Tool ID: {tool.id}</div>
                                  <div>• Tool in savedToolIds: {isAlreadySaved ? '✅' : '❌'}</div>
                                  <div>• Load mode: {loadMode}</div>
                                  <div>• Selected load item: {selectedLoadItem ? `${selectedLoadItem.type}:${selectedLoadItem.id}` : 'None'}</div>
                                  <div>• Is loaded tool: {isLoadedTool ? '✅' : '❌'}</div>
                                  <div>• Was loaded and finalized: {wasLoadedAndFinalized ? '✅' : '❌'}</div>
                                  <div>• Should update: {shouldUpdate ? '✅' : '❌'}</div>
                                  <div>• Workflow mode: {workflowMode}</div>
                                </>
                              );
                            })()}
                          </div>
                        </div> */}

                        <div className="flex gap-2 flex-wrap">
                          {(() => {
                            const tool = testJob.result as ProductToolDefinition;
                            const isAlreadySaved = savedToolIds.has(tool.id);
                            const isLoadedTool = loadMode === 'load' && (selectedLoadItem?.type === 'tool' || selectedLoadItem?.type === 'v2job');
                            
                            // Additional check: if this tool was derived from TCC finalization of a loaded item
                            const wasLoadedAndFinalized = loadMode === 'load' && selectedLoadItem && (
                              // Check if we have a finalized tool that should replace the original
                              tool.metadata?.source === 'tcc-finalization' || 
                              // Or if the tool has metadata indicating it's an update
                              (tool.metadata?.version && tool.metadata.version !== '1.0.0') ||
                              // Or if selectedLoadItem exists and we're in a finalization workflow
                              (selectedLoadItem && (workflowMode === 'v2' || workflowMode === 'debug'))
                            );
                            
                            const shouldUpdate = isAlreadySaved || isLoadedTool || wasLoadedAndFinalized;
                            
                            return (
                              <Button 
                                onClick={() => {
                                  if (shouldUpdate && selectedLoadItem) {
                                    // For loaded tools, use the original tool ID for updating
                                    const toolToUpdate = {
                                      ...tool,
                                      id: selectedLoadItem.id, // Keep the original ID for updating
                                      updatedAt: Date.now()
                                    };
                                    handleUpdateTool(toolToUpdate);
                                  } else if (shouldUpdate) {
                                    handleUpdateTool(tool);
                                  } else {
                                    handleSaveTool(tool);
                                  }
                                }}
                                disabled={false}
                                variant="default"
                                size="default"
                              >
                                <Save className="mr-2 h-4 w-4" />
                                {shouldUpdate ? 'Update Tool' : 'Save Tool to Browser DB'}
                              </Button>
                            );
                          })()}
                          
                          {/* V2 specific save option */}
                          {workflowMode === 'v2' && tccData && (
                            <Button
                              onClick={() => handleSaveV2Result(testJob.result!, tccData)}
                              disabled={savedV2JobIds.has(tccData.jobId)}
                              variant="outline"
                            >
                              <Save className="mr-2 h-4 w-4" />
                              {savedV2JobIds.has(tccData.jobId)
                                ? 'V2 Context Saved'
                                : 'Save V2 Generation Context'}
                            </Button>
                          )}
                          
                          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(testJob.result, null, 2))}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy JSON
                          </Button>
                          
                          <Button variant="outline" size="sm" onClick={() => {
                            const tool = testJob.result as ProductToolDefinition;
                            const blob = new Blob([JSON.stringify(tool, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${tool.metadata?.title || 'tool'}-definition.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Tool
                          </Button>
                        </div>
                      </div>
                    )}
                          </div>
                        );
                      }
                    })()}
                  </CardContent>
                </Card>
              ) : workflowMode === 'debug' && testJob?.status === 'error' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <AlertCircle className="mr-2 h-5 w-5 text-red-500"/>
                      Agent Test Failed
                    </CardTitle>
                    <CardDescription>The isolated agent test encountered an error.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Agent Error</AlertTitle>
                      <AlertDescription className="text-xs break-all">{testJob.error}</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
                  <p className="text-gray-500">
                    {workflowMode === 'debug' ? 'Run an isolated agent test to see results.' : 'Tool generation is not yet complete.'}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardFooter>
      )}
      
      {/* Debug Info */}
      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
        <div className="text-sm space-y-2">
          <div className="font-semibold text-yellow-800 dark:text-yellow-200">🐛 Debug State Information</div>
          <div className="text-xs space-y-1 text-yellow-700 dark:text-yellow-300">
            <div>• Available Models: {availableModels.length}</div>
            <div>• Selected Models: {JSON.stringify(selectedModelIds)}</div>
            <div>• Default Primary Model: {defaultPrimaryModel || 'None'}</div>
            <div>• First 3 Available: {JSON.stringify(availableModels.slice(0, 3).map(m => ({id: m.id, name: m.name})))}</div>
            <div>• Agent Mapping Keys: {Object.keys(agentModelMapping).join(', ')}</div>
            <div>• Agent Mapping Sample: {JSON.stringify(Object.fromEntries(Object.entries(agentModelMapping).slice(0, 3)))}</div>
            <div>• Available Agents: {availableAgents.length}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
