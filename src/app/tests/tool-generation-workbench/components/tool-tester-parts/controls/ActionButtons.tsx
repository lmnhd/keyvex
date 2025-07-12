import React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, StopCircle, Save } from "lucide-react";
import { OrchestrationStatus } from "../tool-tester-types";

// ---------------------------
// TYPES
// ---------------------------

interface ActionButtonsProps {
  /** Current orchestration status */
  status: OrchestrationStatus;
  /** Callback to start / resume orchestration */
  onRun: () => void;
  /** Callback to pause orchestration (where supported) */
  onPause: () => void;
  /** Callback to stop / cancel orchestration */
  onStop: () => void;
  /** Callback to persist the current TCC snapshot */
  onSave: () => void;
  /** Optional disabling flag */
  isBusy?: boolean;
}

/**
 * ActionButtons
 * -------------
 * Renders run / pause / stop / save buttons with appropriate enablement based
 * on the orchestration status.
 */
const ActionButtons: React.FC<ActionButtonsProps> = ({
  status,
  onRun,
  onPause,
  onStop,
  onSave,
  isBusy = false,
}) => {
  const isRunning = status === "running_v2";
  const isPaused = status === "paused";

  return (
    <div className="flex gap-3 flex-wrap">
      <Button
        variant="default"
        onClick={onRun}
        disabled={isBusy || isRunning}
        className="flex items-center gap-1"
      >
        <Play className="h-4 w-4" /> {isPaused ? "Resume" : "Run"}
      </Button>

      <Button
        variant="secondary"
        onClick={onPause}
        disabled={isBusy || !isRunning}
        className="flex items-center gap-1"
      >
        <Pause className="h-4 w-4" /> Pause
      </Button>

      <Button
        variant="destructive"
        onClick={onStop}
        disabled={isBusy || !isRunning}
        className="flex items-center gap-1"
      >
        <StopCircle className="h-4 w-4" /> Stop
      </Button>

      <Button
        variant="outline"
        onClick={onSave}
        disabled={isBusy}
        className="flex items-center gap-1"
      >
        <Save className="h-4 w-4" /> Save Snapshot
      </Button>
    </div>
  );
};

export default ActionButtons;
