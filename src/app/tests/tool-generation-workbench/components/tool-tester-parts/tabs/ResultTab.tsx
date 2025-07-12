import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Copy, Download, Save, CheckCircle } from 'lucide-react';
import { ProductToolDefinition } from '@/lib/types/product-tool';
import { ToolCreationJob } from '../../tool-tester-core-logic';


// -----------------------------------------------------------------------------
export interface ResultTabProps {

  testJob: ToolCreationJob | null;
  selectedAgent: string;
  tccData: { jobId: string } | null;
  savedV2JobIds: Set<string>;
  getModelsUsed: (job: ToolCreationJob) => string[];
  availableModels: { id: string; name: string }[];
  savedToolIds: Set<string>;
  loadMode: 'new' | 'load';
  selectedLoadItem: { type: string; id: string } | null;
  handleUpdateTool: (tool: ProductToolDefinition) => void;
  handleSaveTool: (tool: ProductToolDefinition) => void;
  handleSaveV2Result: (tool: ProductToolDefinition, tcc: { jobId: string }) => void;
}

/**
 * Displays the final ProductToolDefinition (full generation or isolated agent
 * result). Handles save/update/export actions consistently.
 */
const ResultTab: React.FC<ResultTabProps> = ({
  testJob,
  selectedAgent,
  tccData,
  savedV2JobIds,
  getModelsUsed,
  availableModels,
  savedToolIds,
  loadMode,
  selectedLoadItem,
  handleUpdateTool,
  handleSaveTool,
  handleSaveV2Result,
}) => {
  if (!testJob) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
        <p className="text-gray-500">No job results available.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  const debugSaveConditions = (
    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
      <div className="text-sm space-y-1">
        <div className="font-semibold text-blue-800 dark:text-blue-200">🔍 Debug: Save Button Conditions</div>
        <div className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
          <div>• testJob exists: {testJob ? '✅ Yes' : '❌ No'}</div>
          <div>• testJob.status: {testJob?.status || 'undefined'}</div>
          <div>• testJob.result exists: {testJob?.result ? '✅ Yes' : '❌ No'}</div>
          <div>• Should show save buttons: {testJob?.status === 'success' && testJob.result ? '✅ Yes' : '❌ No'}</div>

          <div>• Load mode: {loadMode}</div>
          {testJob?.result && (
            <>
              <div>• Current tool ID: {(testJob.result as any).id || 'No ID'}</div>
              <div>• Tool in savedToolIds: {(testJob.result as any).id && savedToolIds.has((testJob.result as any).id) ? '✅ Yes' : '❌ No'}</div>
              <div>• Selected load item: {selectedLoadItem ? `${selectedLoadItem.type}:${selectedLoadItem.id}` : 'None'}</div>
              <div>• savedToolIds count: {savedToolIds.size}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  const renderDefinition = () => {
    const isDebug = typeof testJob.result === 'object' && testJob.result && 'updatedTcc' in testJob.result;
    if (!testJob.result) return null;

    // Debug mode transformation block
    if (
      isDebug &&
      typeof testJob.result === 'object' &&
      'updatedTcc' in testJob.result
    ) {
      const debugTcc = (testJob.result as any).updatedTcc;
      const originalTool = (testJob.result as any).originalTool;

      const transformedResult: ProductToolDefinition = {
        id: debugTcc.jobId || originalTool?.id || `debug-${Date.now()}`,
        slug:
          originalTool?.slug ||
          debugTcc.userInput?.description
            ?.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') ||
          'debug-tool',
        componentCode:
          debugTcc.finalProduct?.componentCode ||
          originalTool?.componentCode ||
          '<div>Component code not available</div>',
        metadata: {
          id: debugTcc.jobId || originalTool?.id || `debug-${Date.now()}`,
          slug:
            originalTool?.slug ||
            debugTcc.userInput?.description
              ?.toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '') ||
            'debug-tool',
          title:
            originalTool?.metadata?.title ||
            debugTcc.userInput?.description ||
            'Debug Tool',
          type:
            originalTool?.metadata?.type ||
            debugTcc.userInput?.toolType ||
            'Debug Tool',
          description:
            originalTool?.metadata?.description ||
            debugTcc.userInput?.description ||
            'Tool created from isolated agent testing',
          userInstructions:
            originalTool?.metadata?.userInstructions ||
            'Instructions not available in debug mode.',
          developerNotes:
            originalTool?.metadata?.developerNotes ||
            `Debug tool created from isolated ${selectedAgent} agent testing.`,
          dependencies: originalTool?.metadata?.dependencies || ['react'],
          source: 'debug-isolated-agent',
          version: originalTool?.metadata?.version || '1.0.0-debug',
        },
        initialStyleMap:
          originalTool?.initialStyleMap || debugTcc.styling?.styleMap || {},
        currentStyleMap:
          debugTcc.styling?.styleMap ||
          originalTool?.currentStyleMap ||
          originalTool?.initialStyleMap ||
          {},
        createdAt: originalTool?.createdAt || Date.now(),
        updatedAt: Date.now(),
      } as ProductToolDefinition;

      return (
        <AgentDerivedDefinition
          definition={transformedResult}
          modelsUsed={getModelsUsed(testJob)}
          availableModels={availableModels}
          savedToolIds={savedToolIds}
          loadMode={loadMode}
          selectedLoadItem={selectedLoadItem}
          handleUpdateTool={handleUpdateTool}
          handleSaveTool={handleSaveTool}
        />
      );
    }

    // Full generation result block
    return (
      <FullGenerationDefinition
        definition={testJob.result as ProductToolDefinition}
        modelsUsed={getModelsUsed(testJob)}
        availableModels={availableModels}
        savedToolIds={savedToolIds}
        loadMode={loadMode}
        selectedLoadItem={selectedLoadItem}
        handleUpdateTool={handleUpdateTool}
        handleSaveTool={handleSaveTool}
        tccData={tccData}
        savedV2JobIds={savedV2JobIds}
        handleSaveV2Result={handleSaveV2Result}
      />
    );
  };

  // ---------------------------------------------------------------------------
  return (
    <div className="mt-4">
      {debugSaveConditions}
      {renderDefinition()}
    </div>
  );
};

export default ResultTab;

// -----------------------------------------------------------------------------
// --- Helper Presentations -----------------------------------------------------
// -----------------------------------------------------------------------------
interface AgentDerivedProps {
  definition: ProductToolDefinition;
  modelsUsed: string[];
  availableModels: { id: string; name: string }[];
  savedToolIds: Set<string>;
  loadMode: 'new' | 'load';
  selectedLoadItem: { type: string; id: string } | null;
  handleUpdateTool: (tool: ProductToolDefinition) => void;
  handleSaveTool: (tool: ProductToolDefinition) => void;
}

const AgentDerivedDefinition: React.FC<AgentDerivedProps> = ({
  definition,
  modelsUsed,
  availableModels,
  savedToolIds,
  loadMode,
  selectedLoadItem,
  handleUpdateTool,
  handleSaveTool,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle className="mr-2 h-5 w-5 text-green-500" /> Agent Result
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ModelsUsedBadges models={modelsUsed} available={availableModels} />

        <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto max-h-96 text-sm">
          {JSON.stringify(definition, null, 2)}
        </pre>

        <SaveButtons
          definition={definition}
          savedToolIds={savedToolIds}
          loadMode={loadMode}
          selectedLoadItem={selectedLoadItem}
          handleUpdateTool={handleUpdateTool}
          handleSaveTool={handleSaveTool}
        />
      </CardContent>
    </Card>
  );
};

// -----------------------------------------------------------------------------
interface FullGenerationProps {
  definition: ProductToolDefinition;
  tccData: { jobId: string } | null;
  savedV2JobIds: Set<string>;
  modelsUsed: string[];
  availableModels: { id: string; name: string }[];
  savedToolIds: Set<string>;
  loadMode: 'new' | 'load';
  selectedLoadItem: { type: string; id: string } | null;
  handleUpdateTool: (tool: ProductToolDefinition) => void;
  handleSaveTool: (tool: ProductToolDefinition) => void;
  handleSaveV2Result: (tool: ProductToolDefinition, tcc: { jobId: string }) => void;
}
  
//   tccData: { jobId: string } | null;
//   savedV2JobIds: Set<string>;
//   modelsUsed: string[];
//   availableModels: { id: string; name: string }[];
//   savedToolIds: Set<string>;
//   loadMode: 'new' | 'load';
//   selectedLoadItem: { type: string; id: string } | null;
//   handleUpdateTool: (tool: ProductToolDefinition) => void;
//   handleSaveTool: (tool: ProductToolDefinition) => void;

const FullGenerationDefinition: React.FC<FullGenerationProps> = ({
  definition,
  tccData,
  savedV2JobIds,
  modelsUsed,
  availableModels,
  savedToolIds,
  loadMode,
  selectedLoadItem,
  handleUpdateTool,
  handleSaveTool,
  handleSaveV2Result,
}) => {
  const canSaveV2Context = !!tccData;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle className="mr-2 h-5 w-5 text-green-500" /> Generation Complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ModelsUsedBadges models={modelsUsed} available={availableModels} />

        <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto max-h-96 text-sm">
          {JSON.stringify(definition, null, 2)}
        </pre>

        <div className="flex gap-2 flex-wrap">
          <SaveButtons
            definition={definition}
            savedToolIds={savedToolIds}
            loadMode={loadMode}
            selectedLoadItem={selectedLoadItem}
            handleUpdateTool={handleUpdateTool}
            handleSaveTool={handleSaveTool}
          />

          {canSaveV2Context && (
            <Button
              variant="secondary"
              size="default"
              disabled={tccData ? savedV2JobIds.has(tccData.jobId) : false}
              onClick={() => tccData && handleSaveV2Result(definition, tccData)}
            >
              <Save className="mr-2 h-4 w-4" />
              {tccData && savedV2JobIds.has(tccData.jobId) ? 'V2 Context Saved' : 'Save V2 Generation Context'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(JSON.stringify(definition, null, 2))}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([JSON.stringify(definition, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${definition.metadata?.title || 'tool'}-definition.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-2 h-4 w-4" /> Export Tool
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// -----------------------------------------------------------------------------
interface ModelsUsedBadgesProps {
  models: string[];
  available: { id: string; name: string }[];
}

const ModelsUsedBadges: React.FC<ModelsUsedBadgesProps> = ({ models, available }) => (
  <div className="flex items-center gap-2 mb-2">
    <Badge variant="outline">Models Used:</Badge>
    {models.map((modelId) => (
      <Badge key={modelId} variant="secondary" className="text-xs">
        {available.find((m) => m.id === modelId)?.name?.split(' ')[0] || modelId}
      </Badge>
    ))}
  </div>
);

// -----------------------------------------------------------------------------
interface SaveButtonsProps {
  definition: ProductToolDefinition;
  savedToolIds: Set<string>;
  loadMode: 'new' | 'load';
  selectedLoadItem: { type: string; id: string } | null;
  handleUpdateTool: (tool: ProductToolDefinition) => void;
  handleSaveTool: (tool: ProductToolDefinition) => void;
}

const SaveButtons: React.FC<SaveButtonsProps> = ({
  definition,
  savedToolIds,
  loadMode,
  selectedLoadItem,
  handleUpdateTool,
  handleSaveTool,
}) => {
  const isAlreadySaved = savedToolIds.has(definition.id);
  const isLoadedTool = loadMode === 'load' && selectedLoadItem?.type === 'tool';
  const shouldUpdate = isAlreadySaved || isLoadedTool;

  return (
    <Button
      onClick={() => (shouldUpdate ? handleUpdateTool(definition) : handleSaveTool(definition))}
      variant="default"
      size="default"
    >
      <Save className="mr-2 h-4 w-4" /> {shouldUpdate ? 'Update Tool' : 'Save Tool to Browser DB'}
    </Button>
  );
};
