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
import { type ModelOption, type AgentModelMapping } from "../tool-tester-types";

// ---------------------------
// TYPES
// ---------------------------

export interface AgentInfo {
  id: string;
  name: string;
  description?: string;
}

interface AgentMappingEditorProps {
  /** The list of all agents that can be configured */
  availableAgents: AgentInfo[];
  /** All models the user can pick */
  availableModels: ModelOption[];
  /** Current mapping of agentId -> modelId */
  agentModelMapping: AgentModelMapping;
  /** Callback when a single agent's model changes */
  onAgentModelChange: (agentId: string, modelId: string) => void;
  /** Optional loading flag */
  isLoading?: boolean;
}

/**
 * AgentMappingEditor
 * ------------------
 * Lets the user assign specific models to each agent in the orchestration.
 */
const AgentMappingEditor: React.FC<AgentMappingEditorProps> = ({
  availableAgents,
  availableModels,
  agentModelMapping,
  onAgentModelChange,
  isLoading = false,
}) => {
  return (
    <Card className="bg-gray-50 dark:bg-gray-800/50">
      <CardHeader>
        <CardTitle className="text-sm">3. Agent-Specific Model Mapping</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-gray-600 mb-3">
          Available Models: {availableModels.length} | Agent Keys: {availableAgents.length}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableAgents.map((agent) => (
            <div key={agent.id} className="space-y-2">
              <Label
                htmlFor={`agent-model-${agent.id}`}
                className="text-sm font-medium"
                title={agent.description}
              >
                {agent.name}
              </Label>
              <Select
                value={agentModelMapping[agent.id] ?? ""}
                onValueChange={(value) => onAgentModelChange(agent.id, value)}
                disabled={availableModels.length === 0 || isLoading}
              >
                <SelectTrigger id={`agent-model-${agent.id}`} className="h-9">
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentMappingEditor;
