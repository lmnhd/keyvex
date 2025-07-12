"use client";

import React from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import ProgressLog from "../../ProgressLog";
import { WorkflowMode } from "../tool-tester-types";
import { ToolCreationJob } from "../tool-tester-core-logic";


// Define the props explicitly (no 'any')
interface ProgressTabProps {
  workflowMode: WorkflowMode;
  testJob: ToolCreationJob | null;
  getModelsUsed: (job: ToolCreationJob) => string[];
  isDarkMode: boolean;
}

const ProgressTab: React.FC<ProgressTabProps> = ({ workflowMode, testJob, getModelsUsed, isDarkMode }) => {
  if (workflowMode === "v2") {
    return <ProgressLog isDarkMode={isDarkMode} />;
  }

  // Debug / agent-testing mode UI
  return (
    <Card>
      <CardContent className="pt-6">
        {testJob?.status === "loading" && (
          <div className="flex flex-col items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="mt-2 text-sm text-gray-500">Testing selected agent...</p>
          </div>
        )}
        {testJob?.status === "error" && testJob.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Generation Failed</AlertTitle>
            <AlertDescription className="text-xs break-all">{testJob.error}</AlertDescription>
          </Alert>
        )}
        {testJob?.status === "success" && (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Agent Test Completed!</h3>
            <p className="text-sm text-gray-600 mt-2">
              Models used: {getModelsUsed(testJob).join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProgressTab;
