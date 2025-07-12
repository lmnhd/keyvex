"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Code, CheckCircle, Info } from "lucide-react";
import { detectComponentCodeFormat } from "@/lib/transpilation/jsx-transpiler";
import { buildPreviewTool } from "@/app/tests/tool-generation-workbench/components/tool-tester-parts/buildPreviewTool";

// --- Strongly-typed helper interfaces ---
interface TccDataForCode {
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

export interface ComponentCodeTabProps {
  assembledCode: string | null;
  tccData: TccDataForCode | null;
  testJob: ToolCreationJobMinimal | null;
}

const ComponentCodeTab: React.FC<ComponentCodeTabProps> = ({ assembledCode, tccData, testJob }) => {
  // Build single source of truth for the component code
  const previewTool = buildPreviewTool({
    assembledCode: assembledCode ?? undefined,
    tccComponentCode: tccData?.assembledComponentCode ?? undefined,
    finalProductComponentCode: tccData?.finalProduct?.componentCode ?? undefined,
    testJobComponentCode: testJob?.result?.componentCode ?? undefined,
  });

  const componentCode = previewTool.componentCode;
  const codeSource = componentCode ? "Component Code (Unified Source)" : "No component code available";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Code className="mr-2 h-5 w-5 text-purple-500" />
          Raw Component Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        {componentCode ? (
          <div className="space-y-4">
            {/* Code source & statistics */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{codeSource}</Badge>
                <span className="text-sm text-gray-600">
                  {componentCode.split("\n").length} lines, {componentCode.length} characters
                </span>
              </div>
            </div>

            {/* JSX/legacy format analysis */}
            {(() => {
              const formatDetection = detectComponentCodeFormat(componentCode);
              const isJsx = formatDetection.codeFormat === "jsx";
              const lines = componentCode.split("\n");
              const importLines = lines.filter((line) => line.trim().startsWith("import "));

              if (isJsx) {
                return (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800 dark:text-green-200">✅ JSX Format Detected</AlertTitle>
                    <AlertDescription className="text-sm text-green-700 dark:text-green-300">
                      <p className="mb-2">This component uses the modern JSX format with import statements:</p>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {importLines.map((line, idx) => (
                          <li key={idx} className="font-mono bg-green-100 dark:bg-green-800/50 px-2 py-1 rounded">
                            {line.trim()}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs">
                        ✅ DynamicComponentRenderer will transpile the JSX and handle the imports automatically.
                      </p>
                    </AlertDescription>
                  </Alert>
                );
              }

              return (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800 dark:text-blue-200">Legacy Component Format</AlertTitle>
                  <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="text-xs">
                      This component uses the legacy React.createElement format. Consider regenerating it to modern JSX.
                    </p>
                  </AlertDescription>
                </Alert>
              );
            })()}

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
        ) : (
          <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed">
            <div className="text-center">
              <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No Component Code Available</p>
              <p className="text-gray-400 text-sm">Run a tool generation or agent test to see code</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ComponentCodeTab;
