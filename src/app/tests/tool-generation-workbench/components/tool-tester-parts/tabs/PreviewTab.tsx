"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Eye, Bug, Settings } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import DynamicComponentRenderer from "@/components/tools/dynamic-component-renderer";
import ToolDebugPanel from "@/components/tool-debug/ToolDebugPanel";
import { detectComponentCodeFormat } from "@/lib/transpilation/jsx-transpiler";
import { buildPreviewTool } from "@/app/tests/tool-generation-workbench/components/tool-tester-parts/buildPreviewTool";
import { WorkflowMode } from "../tool-tester-types";

interface TccDataPreview {
  assembledComponentCode?: string | null;
  finalProduct?: { componentCode?: string | null } | null;
}

interface JobResultMeta {
  componentCode?: string | null;
  metadata?: { title?: string; description?: string; slug?: string };
}

interface ToolCreationJobMinimal {
  jobId?: string;
  result?: JobResultMeta | null;
}

interface PreviewTabProps {
  workflowMode: WorkflowMode;
  assembledCode: string | null;
  tccData: TccDataPreview | null;
  testJob: ToolCreationJobMinimal | null;
}

const PreviewTab: React.FC<PreviewTabProps> = ({ workflowMode, assembledCode, tccData, testJob }) => {
  // Build preview source of truth
  const previewTool = buildPreviewTool({
    assembledCode: assembledCode ?? undefined,
    tccComponentCode: tccData?.assembledComponentCode ?? undefined,
    finalProductComponentCode: tccData?.finalProduct?.componentCode ?? undefined,
    finalProductMetadata: testJob?.result?.metadata ?? undefined,
    testJobComponentCode: testJob?.result?.componentCode ?? undefined,
    testJobMetadata: testJob?.result?.metadata ?? undefined,
  });

  const { componentCode, metadata } = previewTool;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Eye className="mr-2 h-5 w-5" />Live Preview with Debug Console
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Tool Preview */}
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <Eye className="mr-2 h-4 w-4" />
            Tool Preview
          </h3>
          {componentCode ? (
            <DynamicComponentRenderer
              componentCode={componentCode}
              metadata={metadata}
              onError={(err) => console.error("🔥 Preview render error:", err)}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No component available for preview</p>
              <p className="text-xs mt-1">Complete the tool generation process to see the preview</p>
            </div>
          )}
        </section>

        {/* Debug Panel */}
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <Bug className="mr-2 h-4 w-4" />
            Debug Panel
          </h3>
          {componentCode ? (
            <ToolDebugPanel
              toolId={testJob?.jobId || "debug-tool"}
              componentCode={componentCode}
              metadata={{
                title: testJob?.result?.metadata?.title || "Generated Tool",
                description: testJob?.result?.metadata?.description || "Debug session for generated tool",
                slug: testJob?.result?.metadata?.slug || "debug-tool",
              }}
              onDebugEvent={(event) => setTimeout(() => console.log("Debug event:", event), 0)}
              className="h-[500px]"
            />
          ) : (
            <div className="flex items-center justify-center h-48 p-6">
              <div className="text-center">
                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Tool Debug Not Available</p>
                <p className="text-gray-400 text-sm">Generate a tool to enable interactive debugging</p>
              </div>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
};

export default PreviewTab;
