import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Wand2, AlertCircle, Play, CheckCircle, Eye, Save, Copy, Download, Trash2, Settings, Database, ChevronRight, Pause, SkipForward, RefreshCw, Clock, Target, User, MessageSquare, Briefcase, Brain, Info, Zap, Activity, Wifi, WifiOff, Loader2, Code, Bug, TestTube2, StepForward, RotateCcw, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import React, { useState, useEffect } from 'react';

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
import ToolDebugPanel from '@/components/tool-debug/ToolDebugPanel';
import { CanvasTool } from '@/components/tool-creator-ui/canvas-tool';
import { ScrollBar } from '@/components/ui/scroll-area';
import { DetailedBrainstormView } from '../DetailedBrainstormView';
import {
  type BrainstormResult,
  type BrainstormData as BrainstormDataContent
} from '../../types/unified-brainstorm-types';
import DynamicComponentRenderer from '@/components/tools/dynamic-component-renderer';
import { buildPreviewTool } from '@/app/tests/tool-generation-workbench/components/tool-tester-parts/buildPreviewTool';
import PreviewTab from './tabs/PreviewTab';
import ProgressTab from './tabs/ProgressTab';
import TccTab from './tabs/TccTab';
import ComponentCodeTab from './tabs/ComponentCodeTab';
import AgentResultsTab from './tabs/AgentResultsTab';
import ResultTab from './tabs/ResultTab';



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
  assembledCode,
  tccData,
  getModelsUsed,
  isDarkMode,

  isRefreshingTCC,
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
  getConnectionStatusIcon: () => React.ReactElement;
  getConnectionStatusBadge: () => React.ReactElement;
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
  assembledCode: string | null;
  tccData: any;
  getModelsUsed: (job: ToolCreationJob) => string[];
  isDarkMode: boolean;
  isRefreshingTCC: boolean;
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



  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Wand2 className="mr-2 h-6 w-6 text-purple-500" />
          Enhanced Tool Generation Workbench
        </CardTitle>
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
                    <Info className="mr-2 h-4 w-4 text-blue-500" />
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
                                  className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedLoadItem?.type === 'brainstorm' && selectedLoadItem?.id === brainstorm.id
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
                                className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedLoadItem?.type === 'tool' && selectedLoadItem?.id === tool.id
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
                                className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedLoadItem?.type === 'v2job' && selectedLoadItem?.id === job.id
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
                <Play className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handlePause}
                disabled={orchestrationStatus === 'paused' || isLoading}
                title="Pause"
              >
                <Pause className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleStepForward}
                disabled={orchestrationStatus !== 'paused' || isLoading}
                title="Step Forward"
              >
                <StepForward className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      {(testJob || tccData) && (
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
              <TabsTrigger value="component-code" disabled={!assembledCode && !tccData?.finalProduct?.componentCode && !(testJob?.result && ((testJob.result as any).componentCode || (testJob.result as any).finalProduct?.componentCode))}>Component Code</TabsTrigger>
              <TabsTrigger value="agent-results" disabled={workflowMode !== 'debug' || !testJob?.result}>Agent Results</TabsTrigger>
              <TabsTrigger value="result" disabled={!testJob?.result && workflowMode !== 'debug'}>Tool Definition</TabsTrigger>
            </TabsList>

            <TabsContent value="progress" className="mt-4">
              <ProgressTab
                workflowMode={workflowMode}
                testJob={testJob}
                getModelsUsed={getModelsUsed}
                isDarkMode={isDarkMode}
              />
            </TabsContent>

            <TabsContent value="tcc" className="mt-4">
              <TccTab
                workflowMode={workflowMode}
                testJob={testJob}
                tccData={tccData}
                isRefreshingTCC={isRefreshingTCC}
                handleRefreshTCC={handleRefreshTCC}
                handleSaveTccSnapshot={handleSaveTccSnapshot}
                handleLoadTccSnapshot={handleLoadTccSnapshot}
                recoverLastValidTcc={recoverLastValidTcc}
                hasTccBackup={hasTccBackup}
              />
            </TabsContent>



            
            <TabsContent value="preview" className="mt-4">
              <PreviewTab
                workflowMode={workflowMode}
                assembledCode={assembledCode}
                tccData={tccData}
                testJob={testJob}
              />

              <CardContent className="space-y-6">
                {/* Tool Preview Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <Eye className="mr-2 h-4 w-4" />
                    Tool Preview
                  </h3>
                  {(() => {
                    const previewTool = buildPreviewTool({
                      assembledCode: assembledCode ?? undefined,
                      tccComponentCode: tccData?.assembledComponentCode,
                      finalProductComponentCode: tccData?.finalProduct?.componentCode,
                      finalProductMetadata: testJob?.result?.metadata,
                      testJobComponentCode: testJob?.result?.componentCode,
                      testJobMetadata: testJob?.result?.metadata,
                    });

                    if (previewTool.componentCode) {
                      return (
                        <DynamicComponentRenderer
                          componentCode={previewTool.componentCode}
                          metadata={previewTool.metadata}
                          onError={(err) => console.error('🔥 Preview render error:', err)}
                        />
                      );
                    }

                    return (
                      <div className="text-center py-8 text-gray-500">
                        <p>No component available for preview</p>
                        <p className="text-xs mt-1">
                          Complete the tool generation process to see the preview
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Debug Panel Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <Bug className="mr-2 h-4 w-4" />
                    Debug Panel
                  </h3>
                  {(() => {
                    // 🚨 SINGLE SOURCE OF TRUTH FOR COMPONENT CODE
                    const componentCode = buildPreviewTool({
                      assembledCode: assembledCode ?? undefined,
                      tccComponentCode: tccData?.assembledComponentCode,
                      finalProductComponentCode: tccData?.finalProduct?.componentCode,
                      testJobComponentCode: testJob?.result?.componentCode,
                    }).componentCode;
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

            </TabsContent>

            {/* Component Code Tab */}
            <TabsContent value="component-code" className="mt-4">
              <ComponentCodeTab
                assembledCode={assembledCode}
                tccData={tccData}
                testJob={testJob}
              />
            </TabsContent>


            <TabsContent value="agent-results" className="mt-4">
              <AgentResultsTab
                workflowMode={workflowMode}
                testJob={testJob}
                selectedAgent={selectedAgent}
                tccData={tccData}
                isLoading={isLoading}
                handleTccFinalization={handleTccFinalization}
              />
            </TabsContent>
            

            <TabsContent value="result" className="mt-4">
              <ResultTab 
              testJob={testJob}
              selectedAgent={selectedAgent}
              tccData={tccData}
              savedV2JobIds={savedV2JobIds}
              availableModels={availableModels}
              getModelsUsed={getModelsUsed}
              savedToolIds={savedToolIds}
              loadMode={loadMode}
              selectedLoadItem={selectedLoadItem}
              handleUpdateTool={handleUpdateTool}
              handleSaveTool={handleSaveTool}
              handleSaveV2Result={handleSaveV2Result}
              />
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
            <div>• First 3 Available: {JSON.stringify(availableModels.slice(0, 3).map(m => ({ id: m.id, name: m.name })))}</div>
            <div>• Agent Mapping Keys: {Object.keys(agentModelMapping).join(', ')}</div>
            <div>• Agent Mapping Sample: {JSON.stringify(Object.fromEntries(Object.entries(agentModelMapping).slice(0, 3)))}</div>
            <div>• Available Agents: {availableAgents.length}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
