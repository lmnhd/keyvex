import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatus } from "../../../hooks/useToolGenerationStream";

// ---------------------------
// TYPES
// ---------------------------

interface DebugInfoPanelProps {
  connectionStatus: ConnectionStatus;
  websocketEndpoint: string;
  env: string;
  isDarkMode: boolean;
}

/**
 * DebugInfoPanel
 * --------------
 * Shows WebSocket connection status, endpoint and runtime environment to aid
 * debugging during development.
 */
const DebugInfoPanel: React.FC<DebugInfoPanelProps> = ({
  connectionStatus,
  websocketEndpoint,
  env,
  isDarkMode,
}) => {
  const statusColor = connectionStatus === "connected" ? "green" : connectionStatus === "connecting" ? "yellow" : "red";
  const StatusIcon = connectionStatus === "connected" ? Wifi : WifiOff;

  return (
    <Alert className="w-full">
      <StatusIcon className={`h-4 w-4 text-${statusColor}-600`} />
      <AlertTitle className="flex items-center gap-2">
        WebSocket: {connectionStatus}
        <Badge variant="outline" className="text-xs">
          {env}
        </Badge>
      </AlertTitle>
      <AlertDescription className="break-all text-xs">
        Endpoint: {websocketEndpoint}
      </AlertDescription>
    </Alert>
  );
};

export default DebugInfoPanel;
