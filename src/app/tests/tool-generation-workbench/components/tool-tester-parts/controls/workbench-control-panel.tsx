import React from "react";
import BrainstormSelector from "./BrainstormSelector";
import ModelSelector from "./ModelSelector";
import AgentMappingEditor, { type AgentInfo } from "./AgentMappingEditor";
import ActionButtons from "./ActionButtons";
import DebugInfoPanel from "./DebugInfoPanel";
import { type BrainstormResult } from "../../../types/unified-brainstorm-types";
import {
  type ModelOption,
  type AgentModelMapping,
  OrchestrationStatus,
} from "../tool-tester-types";
import { ConnectionStatus } from "../../../hooks/useToolGenerationStream";

// ---------------------------
// TYPES
// ---------------------------

interface WorkbenchControlPanelProps {
  // Brainstorm selection
  savedBrainstorms: BrainstormResult[];
  selectedBrainstormId: string;
  setSelectedBrainstormId: (id: string) => void;
  // Data helpers
  getSelectedBrainstormDetails: () => BrainstormResult | undefined | null;
  // Model selection
  availableModels: ModelOption[];
  primaryModel: string | null;
  setPrimaryModel: (modelId: string) => void;
  // Agent mapping
  availableAgents: AgentInfo[];
  agentModelMapping: AgentModelMapping;
  onAgentModelChange: (agentId: string, modelId: string) => void;
  // Orchestration control
  orchestrationStatus: OrchestrationStatus;
  onRun: () => void;
  onPause: () => void;
  onStop: () => void;
  onSaveSnapshot: () => void;
  isBusy?: boolean;
  // Debug info
  connectionStatus: ConnectionStatus;
  websocketEndpoint: string;
  env: string;
  isDarkMode: boolean;
  // Loading flags
  isLoading?: boolean;
}

/**
 * WorkbenchControlPanel
 * --------------------
 * High-level wrapper that combines all sub-controls for the Tool Generation
 * Workbench. Keeps file short by delegating UI details to smaller components.
 */
const WorkbenchControlPanel: React.FC<WorkbenchControlPanelProps> = ({
  // Brainstorm
  savedBrainstorms,
  selectedBrainstormId,
  setSelectedBrainstormId,
  getSelectedBrainstormDetails,
  // Models
  availableModels,
  primaryModel,
  setPrimaryModel,
  // Agents
  availableAgents,
  agentModelMapping,
  onAgentModelChange,
  // Orchestration
  orchestrationStatus,
  onRun,
  onPause,
  onStop,
  onSaveSnapshot,
  isBusy = false,
  // Debug
  connectionStatus,
  websocketEndpoint,
  env,
  isDarkMode,
  // Loading
  isLoading = false,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Brainstorm Selector */}
      <BrainstormSelector
        savedBrainstorms={savedBrainstorms}
        selectedBrainstormId={selectedBrainstormId}
        setSelectedBrainstormId={setSelectedBrainstormId}
        getSelectedBrainstormDetails={getSelectedBrainstormDetails}
        isLoading={isLoading}
      />

      {/* 2. Primary Model Selector */}
      <ModelSelector
        availableModels={availableModels}
        primaryModel={primaryModel}
        setPrimaryModel={setPrimaryModel}
        isLoading={isLoading}
      />

      {/* 3. Agent-Specific Model Mapping */}
      <AgentMappingEditor
        availableAgents={availableAgents}
        availableModels={availableModels}
        agentModelMapping={agentModelMapping}
        onAgentModelChange={onAgentModelChange}
        isLoading={isLoading}
      />

      {/* 4. Action Buttons */}
      <ActionButtons
        status={orchestrationStatus}
        onRun={onRun}
        onPause={onPause}
        onStop={onStop}
        onSave={onSaveSnapshot}
        isBusy={isBusy}
      />

      {/* 5. Debug Info */}
      <DebugInfoPanel
        connectionStatus={connectionStatus}
        websocketEndpoint={websocketEndpoint}
        env={env}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default WorkbenchControlPanel;
