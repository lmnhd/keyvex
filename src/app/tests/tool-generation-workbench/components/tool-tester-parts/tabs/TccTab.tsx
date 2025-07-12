"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  Database,
  Save,
  Download,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import TCCVisualizer from "../../TCCVisualizer";
import { WorkflowMode } from "../tool-tester-types";

// Types for props
interface TccDataMinimal {
  jobId?: string;
  functionPlanning?: unknown;
  stateLogic?: unknown;
  jsxLayout?: unknown;
  styling?: unknown;
  validationResults?: unknown;
  finalProduct?: { componentCode?: string };
}

interface TccTabProps {
  workflowMode: WorkflowMode;
  testJob: { jobId?: string } | null;
  tccData: TccDataMinimal | null;
  isRefreshingTCC: boolean;
  handleRefreshTCC: () => void;
  handleSaveTccSnapshot: () => void;
  handleLoadTccSnapshot: () => void;
  recoverLastValidTcc: () => void;
  hasTccBackup: boolean;
}

const TccTab: React.FC<TccTabProps> = ({
  workflowMode,
  testJob,
  tccData,
  isRefreshingTCC,
  handleRefreshTCC,
  handleSaveTccSnapshot,
  handleLoadTccSnapshot,
  recoverLastValidTcc,
  hasTccBackup,
}) => {
  const showVisualizer =
    (workflowMode === "v2" && testJob?.jobId && !testJob.jobId.startsWith("debug-")) ||
    (workflowMode === "debug" && tccData);

  if (showVisualizer) {
    return (
      <TCCVisualizer
        tccData={tccData as any}
        currentStep="loaded"
        jobId={testJob?.jobId || "debug-mode"}
        onRefreshTCC={workflowMode === "v2" ? handleRefreshTCC : () => {}}
        isLoading={isRefreshingTCC}
        handleSaveTccSnapshot={handleSaveTccSnapshot}
        handleLoadTccSnapshot={handleLoadTccSnapshot}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center text-base">
            <Database className="mr-2 h-5 w-5 text-green-500" />
            TCC Monitor
          </CardTitle>
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
                <code className="text-xs bg-green-100 dark:bg-green-800 px-1 rounded">
                  {tccData.jobId?.slice(0, 12)}...
                </code>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {tccData.functionPlanning ? "✅" : "⚪"} Function Planning
                </div>
                <div className="flex items-center gap-1">
                  {tccData.stateLogic ? "✅" : "⚪"} State Logic
                </div>
                <div className="flex items-center gap-1">
                  {tccData.jsxLayout ? "✅" : "⚪"} JSX Layout
                </div>
                <div className="flex items-center gap-1">
                  {tccData.styling ? "✅" : "⚪"} Styling
                </div>
                <div className="flex items-center gap-1">
                  {tccData.finalProduct?.componentCode ? "✅" : "⚪"} Final Product Code
                </div>
                <div className="flex items-center gap-1">
                  {tccData.validationResults ? "✅" : "⚪"} Validation
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
              <span>
                No current TCC data available. Run a tool generation first to populate TCC data.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TccTab;
