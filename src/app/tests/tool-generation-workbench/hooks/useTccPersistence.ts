import { useState, useCallback } from 'react';

// 🛡️ TCC PERSISTENCE HOOK: Manages TCC state with backup and recovery system
interface TccHistoryEntry {
  timestamp: number;
  agentType?: string;
  tcc: any;
  source?: string;
}

interface UseTccPersistenceReturn {
  tccData: any;
  lastValidTcc: any;
  tccHistory: TccHistoryEntry[];
  updateTccWithBackup: (newTcc: any, source?: string) => void;
  recoverLastValidTcc: () => boolean;
  safeClearTcc: (preserveBackup?: boolean) => void;
  hasTccBackup: boolean;
  setTccData: (tcc: any) => void; // Direct setter for compatibility
}

export function useTccPersistence(
  addLog?: (type: 'connection' | 'message' | 'error' | 'debug', message: string, data?: any) => void
): UseTccPersistenceReturn {
  const [tccData, setTccData] = useState<any>(null);
  const [lastValidTcc, setLastValidTcc] = useState<any>(null);
  const [tccHistory, setTccHistory] = useState<TccHistoryEntry[]>([]);

  // Enhanced TCC update function with backup system
  const updateTccWithBackup = useCallback((newTcc: any, source?: string) => {
    if (newTcc && typeof newTcc === 'object' && newTcc.jobId) {
      // Store the previous TCC as backup before updating
      if (tccData) {
        setLastValidTcc({ ...tccData });
      }
      
      // Add to TCC history for debugging (keep last 10 entries)
      setTccHistory(prev => [...prev.slice(-9), {
        timestamp: Date.now(),
        agentType: source,
        tcc: { ...newTcc },
        source: source || 'unknown'
      }]);
      
      setTccData(newTcc);
      
      addLog?.('debug', `🛡️ TCC Updated from ${source || 'unknown'}`, {
        jobId: newTcc.jobId,
        hasJsxLayout: !!newTcc.jsxLayout,
        hasStateLogic: !!newTcc.stateLogic,
        hasStyling: !!newTcc.styling,
        hasAssembledCode: !!newTcc.assembledComponentCode,
        hasFinalProduct: !!newTcc.finalProduct,
        backupAvailable: !!lastValidTcc
      });
    } else {
      addLog?.('error', '🚨 Invalid TCC update attempted', { newTcc, source });
    }
  }, [tccData, lastValidTcc, addLog]);

  // Recovery function to restore last valid TCC
  const recoverLastValidTcc = useCallback(() => {
    if (lastValidTcc) {
      setTccData({ ...lastValidTcc });
      
      addLog?.('debug', '🔄 TCC Recovered from backup', {
        jobId: lastValidTcc.jobId,
        hasJsxLayout: !!lastValidTcc.jsxLayout,
        hasStateLogic: !!lastValidTcc.stateLogic,
        hasStyling: !!lastValidTcc.styling,
        hasAssembledCode: !!lastValidTcc.assembledComponentCode,
        hasFinalProduct: !!lastValidTcc.finalProduct
      });
      
      return true;
    }
    
    addLog?.('error', '❌ No TCC backup available for recovery');
    return false;
  }, [lastValidTcc, addLog]);

  // Clear TCC with optional backup preservation
  const safeClearTcc = useCallback((preserveBackup: boolean = true) => {
    if (preserveBackup && tccData) {
      setLastValidTcc({ ...tccData });
      addLog?.('debug', `🗑️ TCC cleared with backup preserved`, {
        jobId: tccData.jobId
      });
    } else {
      addLog?.('debug', `🗑️ TCC cleared without backup`);
    }
    setTccData(null);
  }, [tccData, addLog]);

  return {
    tccData,
    lastValidTcc,
    tccHistory,
    updateTccWithBackup,
    recoverLastValidTcc,
    safeClearTcc,
    hasTccBackup: !!lastValidTcc,
    setTccData // Direct setter for backward compatibility
  };
} 
