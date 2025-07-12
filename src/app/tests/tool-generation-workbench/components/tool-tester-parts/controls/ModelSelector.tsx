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
import { type ModelOption } from "../tool-tester-types";

// ---------------------------
// TYPES
// ---------------------------

interface ModelSelectorProps {
  /** All models available to the current user */
  availableModels: ModelOption[];
  /** Currently selected primary model */
  primaryModel: string | null;
  /** Callback when primary model changes */
  setPrimaryModel: (modelId: string) => void;
  /** Optional loading flag */
  isLoading?: boolean;
}

/**
 * ModelSelector
 * -------------
 * Provides a dropdown for choosing the primary model used by the orchestration.
 * Other agent-specific model mappings are handled separately by `AgentMappingEditor`.
 */
const ModelSelector: React.FC<ModelSelectorProps> = ({
  availableModels,
  primaryModel,
  setPrimaryModel,
  isLoading = false,
}) => {
  return (
    <Card className="bg-gray-50 dark:bg-gray-800/50">
      <CardHeader>
        <CardTitle className="text-sm">2. Select Primary Model</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="primary-model-select">Primary Model</Label>
        <Select
          value={primaryModel ?? ""}
          onValueChange={setPrimaryModel}
          disabled={isLoading || availableModels.length === 0}
        >
          <SelectTrigger id="primary-model-select" className="max-w-md h-9">
            <SelectValue
              placeholder={
                availableModels.length === 0 ? "No models available" : "Choose a model"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};

export default ModelSelector;
