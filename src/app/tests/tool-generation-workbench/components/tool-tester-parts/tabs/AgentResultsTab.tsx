import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  CheckCircle,
  Zap,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ToolCreationJob } from '../../tool-tester-core-logic';

// --- Prop Types --------------------------------------------------------------
export interface AgentResultsTabProps {
  workflowMode: 'v2' | 'debug';
  testJob: ToolCreationJob | null;
  selectedAgent: string;
  tccData: any; // TODO: replace with strong TccData interface when available
  isLoading: boolean;
  handleTccFinalization: () => void;
}

// -----------------------------------------------------------------------------
/**
 * Displays the results of running an isolated agent when the workbench is in
 * `debug` workflow mode. Shows success, partial TCC data, and allows the user
 * to run finalization if applicable.
 */
const AgentResultsTab: React.FC<AgentResultsTabProps> = ({
  workflowMode,
  testJob,
  selectedAgent,
  tccData,
  isLoading,
  handleTccFinalization,
}) => {
  // Guard: Only relevant in debug mode with a result object
  const hasAgentResult =
    workflowMode === 'debug' &&
    testJob?.result &&
    typeof testJob.result === 'object' &&
    'updatedTcc' in testJob.result;

  if (!hasAgentResult) {
    // If no result yet, show placeholder
    if (workflowMode === 'debug') {
      return (
        <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
          <p className="text-gray-500">Run an isolated agent test to see results.</p>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
        <p className="text-gray-500">Tool generation is not yet complete.</p>
      </div>
    );
  }

  // Result-specific variables --------------------------------------------------
  const agentResult = testJob!.result as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const updatedTcc = agentResult.updatedTcc || tccData;

  // Helper: can we finalize?
  const canFinalize = !!updatedTcc && (
    (updatedTcc.jsxLayout && updatedTcc.stateLogic) ||
    updatedTcc.styling ||
    (updatedTcc.jsxLayout && updatedTcc.styling) ||
    (updatedTcc.stateLogic && updatedTcc.styling) ||
    updatedTcc.jsxLayout ||
    updatedTcc.stateLogic
  );

  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="mr-2 h-5 w-5 text-blue-500" />
            Isolated Agent Results - {selectedAgent}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-200">
              ✅ Agent Test Successful
            </AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
              The isolated agent completed successfully without triggering the next orchestration step.
            </AlertDescription>
          </Alert>

          {/* Finalize tool if possible */}
          {canFinalize && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <Zap className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-200">
                🎯 Ready for Finalization
              </AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                The tool has progressed through one or more agent steps. You can now run the final assembly, validation, and finalization stages.
                <br />
                <span className="text-xs mt-1 block">
                  TCC Status:
                  {updatedTcc.jsxLayout ? ' ✅ Layout' : ' ⏸️ Layout'}
                  {updatedTcc.stateLogic ? ' ✅ State' : ' ⏸️ State'}
                  {updatedTcc.styling ? ' ✅ Styling' : ' ⏸️ Styling'}
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
              </div>
            </Alert>
          )}

          {/* Agent-specific result displays */}
          {/* NOTE: Keep UI logic identical to the original inline implementation */}
          {selectedAgent === 'tailwind-styling' && updatedTcc?.styling && (
            <StylingResultsPanel styling={updatedTcc.styling} />
          )}

          {selectedAgent === 'jsx-layout' && updatedTcc?.jsxLayout && (
            <JsxLayoutResultsPanel jsxLayout={updatedTcc.jsxLayout} />
          )}

          {selectedAgent === 'state-design' && updatedTcc?.stateLogic && (
            <StateDesignResultsPanel stateLogic={updatedTcc.stateLogic} />
          )}

          {selectedAgent === 'function-planner' && updatedTcc?.definedFunctionSignatures && (
            <FunctionPlannerResultsPanel definedFunctions={updatedTcc.definedFunctionSignatures} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentResultsTab;

// -----------------------------------------------------------------------------
// --- Sub-components ----------------------------------------------------------
// -----------------------------------------------------------------------------
interface StylingResultsProps {
  styling: any; // TODO: strong typing
}

const StylingResultsPanel: React.FC<StylingResultsProps> = ({ styling }) => (
  <Card className="border-purple-200">
    <CardHeader>
      <CardTitle className="text-purple-700 text-lg">🎨 Styling Results</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {styling.styledComponentCode && (
          <div>
            <Badge variant="outline" className="mb-2">
              Styled Component Code
            </Badge>
            <pre className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md text-sm overflow-x-auto max-h-96">
              {styling.styledComponentCode}
            </pre>
          </div>
        )}
        {styling.styleMap && (
          <div>
            <Badge variant="outline" className="mb-2">
              Style Map (Element → Classes)
            </Badge>
            <div className="grid gap-2">
              {Object.entries(styling.styleMap).slice(0, 5).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between text-sm bg-purple-50 dark:bg-purple-900/20 p-2 rounded"
                >
                  <span className="font-mono text-purple-700">{key}</span>
                  <span className="text-purple-600">{String(value)}</span>
                </div>
              ))}
              {Object.keys(styling.styleMap).length > 5 && (
                <div className="text-sm text-purple-600">
                  + {Object.keys(styling.styleMap).length - 5} more styles
                </div>
              )}
            </div>
          </div>
        )}
        {styling.colorScheme && (
          <div>
            <Badge variant="outline" className="mb-2">
              Color Scheme
            </Badge>
            <div className="grid gap-2">
              <ColorSwatch label="Primary" value={styling.colorScheme.primary} />
              <ColorSwatch label="Secondary" value={styling.colorScheme.secondary} />
              <ColorSwatch label="Background" value={styling.colorScheme.background} />
            </div>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

interface ColorSwatchProps {
  label: string;
  value: string;
}
const ColorSwatch: React.FC<ColorSwatchProps> = ({ label, value }) => (
  <div className="flex justify-between text-sm bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
    <span className="font-mono text-purple-700">{label}</span>
    <span className="text-purple-600">{value}</span>
  </div>
);

// -----------------------------------------------------------------------------
interface JsxLayoutResultsProps {
  jsxLayout: any;
}
const JsxLayoutResultsPanel: React.FC<JsxLayoutResultsProps> = ({ jsxLayout }) => (
  <Card className="border-green-200">
    <CardHeader>
      <CardTitle className="text-green-700 text-lg">🏗️ JSX Layout Results</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {jsxLayout.componentStructure && (
          <div>
            <Badge variant="outline" className="mb-2">
              Component Structure
            </Badge>
            <pre className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md text-sm overflow-x-auto max-h-64">
              {jsxLayout.componentStructure}
            </pre>
          </div>
        )}
        {jsxLayout.layoutDecisions && (
          <div>
            <Badge variant="outline" className="mb-2">
              Layout Decisions
            </Badge>
            <div className="text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded max-h-64 overflow-y-auto">
              {JSON.stringify(jsxLayout.layoutDecisions, null, 2)}
            </div>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

// -----------------------------------------------------------------------------
interface StateDesignResultsProps {
  stateLogic: any;
}
const StateDesignResultsPanel: React.FC<StateDesignResultsProps> = ({ stateLogic }) => (
  <Card className="border-blue-200">
    <CardHeader>
      <CardTitle className="text-blue-700 text-lg">🎯 State Design Results</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {stateLogic.variables && (
          <div>
            <Badge variant="outline" className="mb-2">
              State Variables ({stateLogic.variables.length} total)
            </Badge>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stateLogic.variables.map((variable: any, idx: number) => (
                <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm">
                  <div className="font-semibold text-blue-700">
                    {variable.name}: {variable.type}
                  </div>
                  <div className="text-blue-600">{variable.description}</div>
                  <div className="text-xs text-blue-500">Initial Value: {JSON.stringify(variable.initialValue) || 'none'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {stateLogic.functions && (
          <div>
            <Badge variant="outline" className="mb-2">
              State Functions ({stateLogic.functions.length} total)
            </Badge>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stateLogic.functions.map((func: any, idx: number) => (
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
);

// -----------------------------------------------------------------------------
interface FunctionPlannerResultsProps {
  definedFunctions: any[];
}
const FunctionPlannerResultsPanel: React.FC<FunctionPlannerResultsProps> = ({ definedFunctions }) => (
  <Card className="border-orange-200">
    <CardHeader>
      <CardTitle className="text-orange-700 text-lg">⚙️ Function Planning Results</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div>
          <Badge variant="outline" className="mb-2">
            Defined Functions ({definedFunctions.length} total)
          </Badge>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {definedFunctions.map((func: any, idx: number) => (
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
);
