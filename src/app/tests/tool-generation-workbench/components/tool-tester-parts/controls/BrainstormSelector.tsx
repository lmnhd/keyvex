import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Info, ChevronRight } from "lucide-react";

import { type BrainstormResult } from "../../../types/unified-brainstorm-types";

// ---------------------------
// TYPES
// ---------------------------

interface BrainstormSelectorProps {
  savedBrainstorms: BrainstormResult[];
  selectedBrainstormId: string;
  setSelectedBrainstormId: (id: string) => void;
  getSelectedBrainstormDetails: () => BrainstormResult | null | undefined;
  isLoading: boolean;
}

/**
 * BrainstormSelector
 * ------------------
 * Handles selection of a saved brainstorm and renders an information panel
 * summarising the chosen brainstorm including data-requirement and research status.
 */
const BrainstormSelector: React.FC<BrainstormSelectorProps> = ({
  savedBrainstorms,
  selectedBrainstormId,
  setSelectedBrainstormId,
  getSelectedBrainstormDetails,
  isLoading,
}) => {
  const selectedBrainstorm = getSelectedBrainstormDetails();

  return (
    <div className="space-y-4">
      {/* Brainstorm selection dropdown */}
      <div className="space-y-2">
        <Label htmlFor="selectedBrainstorm">1. Select Saved Brainstorm</Label>
        <Select
          value={selectedBrainstormId}
          onValueChange={setSelectedBrainstormId}
          disabled={isLoading || savedBrainstorms.length === 0}
        >
          <SelectTrigger id="selectedBrainstorm" className="max-w-md">
            <SelectValue
              placeholder={
                savedBrainstorms.length === 0
                  ? "No brainstorms saved"
                  : "Choose a brainstorm"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {savedBrainstorms.map((bs) => {
              const fullText = `${bs.userInput.toolType} for ${bs.userInput.targetAudience} (Saved: ${new Date(
                bs.timestamp,
              ).toLocaleDateString()})`;
              const truncatedText =
                fullText.length > 100 ? `${fullText.substring(0, 100)}...` : fullText;
              return (
                <SelectItem key={bs.id} value={bs.id} title={fullText}>
                  {truncatedText}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Selected brainstorm summary card */}
      {selectedBrainstormId && selectedBrainstorm && (
        <Card className="bg-gray-50 dark:bg-gray-800/50 col-span-4">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center">
              <Info className="mr-2 h-4 w-4 text-blue-500" />
              Selected Brainstorm Details
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-3">
            {/* Quick summary */}
            <div className="space-y-1">
              <p>
                <strong>Tool Type:</strong> {selectedBrainstorm.userInput.toolType}
              </p>
              <p>
                <strong>Target:</strong> {selectedBrainstorm.userInput.targetAudience}
              </p>
              <p>
                <strong>Created:</strong>{" "}
                {new Date(selectedBrainstorm.timestamp).toLocaleString()}
              </p>
              {selectedBrainstorm.brainstormData?.keyCalculations && (
                <p>
                  <strong>Calculations:</strong>{" "}
                  {selectedBrainstorm.brainstormData.keyCalculations.length} key calculations defined
                </p>
              )}
              {selectedBrainstorm.brainstormData?.suggestedInputs && (
                <p>
                  <strong>Inputs:</strong>{" "}
                  {selectedBrainstorm.brainstormData.suggestedInputs.length} input fields planned
                </p>
              )}
            </div>

            {/* Data requirement status */}
            {(() => {
              const dataRequirements = selectedBrainstorm.brainstormData?.dataRequirements;
              const hasExternalDataNeeds = dataRequirements?.hasExternalDataNeeds;
              const hasGeneratedMockData = Boolean(
                (selectedBrainstorm.brainstormData?.mockData &&
                  Object.keys(selectedBrainstorm.brainstormData.mockData).length > 0) ||
                  (selectedBrainstorm.brainstormData?.researchData &&
                    Object.keys(selectedBrainstorm.brainstormData.researchData).length > 0) ||
                  (selectedBrainstorm.brainstormData?.dummyData &&
                    Object.keys(selectedBrainstorm.brainstormData.dummyData).length > 0),
              );

              if (!dataRequirements) return null;

              return (
                <div className="p-2 rounded border bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">Data Status:</span>
                    {hasExternalDataNeeds === false ? (
                      <Badge variant="secondary" className="text-xs">
                        🔵 No External Data Needed
                      </Badge>
                    ) : hasExternalDataNeeds === true ? (
                      hasGeneratedMockData ? (
                        <Badge variant="default" className="text-xs">
                          ✅ Data Researched &amp; Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          🟡 Needs Research
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        ⚪ Not Verified
                      </Badge>
                    )}
                  </div>
                  {hasExternalDataNeeds === true && dataRequirements.requiredDataTypes && (
                    <div className="text-xs text-blue-600 mt-1">
                      Required: {dataRequirements.requiredDataTypes.join(", ")}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Research data */}
            {(() => {
              const researchData = selectedBrainstorm.brainstormData?.researchData;
              const userDataInstructions = selectedBrainstorm.brainstormData?.userDataInstructions;

              if (!researchData || Object.keys(researchData).length === 0) return null;

              return (
                <details className="mt-3">
                  <summary className="cursor-pointer font-medium text-green-600 hover:text-green-800 flex items-center select-none">
                    <ChevronRight className="mr-1 h-3 w-3 transition-transform duration-200" />
                    🔬 View Research Data Results ({Object.keys(researchData).length} domains)
                  </summary>
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg">
                    <div className="space-y-4">
                      {/* User data instructions */}
                      {userDataInstructions && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded">
                          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                            📋 Data Requirements Summary
                          </h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                            {userDataInstructions.summary}
                          </p>
                          {userDataInstructions.dataNeeded && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              <span className="font-medium">Required:</span>{" "}
                              {userDataInstructions.dataNeeded.join(", ")}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Research results by domain */}
                      {Object.entries(researchData).map(([domain, data]) => (
                        <div key={domain} className="border border-gray-200 rounded-lg">
                          <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-t-lg">
                            <h4 className="font-medium text-gray-800 dark:text-gray-200 capitalize">
                              🏢 {domain.replace("_", " ")} Research
                            </h4>
                          </div>
                          <div className="p-3 space-y-3">
                            {data.marketData && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  📊 Market Data
                                </h5>
                                <div className="bg-white dark:bg-gray-900 p-2 rounded border text-xs">
                                  <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                                    {JSON.stringify(data.marketData, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}
                            {data.generalData && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  📋 General Data
                                </h5>
                                <div className="bg-white dark:bg-gray-900 p-2 rounded border text-xs">
                                  <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                                    {JSON.stringify(data.generalData, null, 2)}
                                  </pre>
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
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BrainstormSelector;
