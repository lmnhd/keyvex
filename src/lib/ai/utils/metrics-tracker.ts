// AI Metrics Tracker
// Automatically tracks AI model usage for admin dashboard monitoring

import { debugLog } from '../../auth/debug';

interface RequestMetrics {
  process: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latency: number;
  success: boolean;
  error?: string;
  startTime: number;
}

export class MetricsTracker {
  private static instance: MetricsTracker;
  private enabled: boolean = true;
  private pendingMetrics: RequestMetrics[] = [];
  private batchSize: number = 10;
  private flushInterval: number = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Start the flush timer
    this.startFlushTimer();
  }

  static getInstance(): MetricsTracker {
    if (!MetricsTracker.instance) {
      MetricsTracker.instance = new MetricsTracker();
    }
    return MetricsTracker.instance;
  }

  /**
   * Start tracking a new AI request
   */
  startRequest(process: string, provider: string, model: string): RequestTracker {
    if (!this.enabled) {
      return new RequestTracker(process, provider, model, false);
    }

    return new RequestTracker(process, provider, model, true, this);
  }

  /**
   * Record completed request metrics
   */
  recordRequest(metrics: RequestMetrics): void {
    if (!this.enabled) return;

    this.pendingMetrics.push(metrics);
    debugLog('Metrics recorded', { 
      process: metrics.process, 
      cost: this.calculateCost(metrics),
      latency: metrics.latency 
    });

    // Flush if batch size reached
    if (this.pendingMetrics.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Enable or disable metrics tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    } else if (enabled && !this.flushTimer) {
      this.startFlushTimer();
    }
  }

  /**
   * Manually flush pending metrics
   */
  async flush(): Promise<void> {
    if (this.pendingMetrics.length === 0) return;

    const metricsToSend = [...this.pendingMetrics];
    this.pendingMetrics = [];

    try {
      await this.sendMetricsToAPI(metricsToSend);
      debugLog('Metrics flushed', { count: metricsToSend.length });
    } catch (error) {
      console.error('Failed to send metrics:', error);
      // Re-add metrics to pending queue for retry
      this.pendingMetrics.unshift(...metricsToSend);
    }
  }

  /**
   * Get current metrics queue status
   */
  getStatus(): {
    enabled: boolean;
    pendingCount: number;
    batchSize: number;
    flushInterval: number;
  } {
    return {
      enabled: this.enabled,
      pendingCount: this.pendingMetrics.length,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval
    };
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private async sendMetricsToAPI(metrics: RequestMetrics[]): Promise<void> {
    // Only send metrics in development/staging environments
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    for (const metric of metrics) {
      try {
        const response = await fetch('/api/admin/metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'track_request',
            ...metric
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Failed to send individual metric:', error);
        // Continue with other metrics
      }
    }
  }

  private calculateCost(metrics: RequestMetrics): number {
    // This would use the model configuration to calculate actual cost
    // For now, return a simple estimation
    const inputCost = (metrics.inputTokens / 1000) * 0.01; // $0.01 per 1k tokens
    const outputCost = (metrics.outputTokens / 1000) * 0.02; // $0.02 per 1k tokens
    return inputCost + outputCost;
  }
}

/**
 * Request tracker for individual AI requests
 */
export class RequestTracker {
  private startTime: number;
  private process: string;
  private provider: string;
  private model: string;
  private enabled: boolean;
  private tracker?: MetricsTracker;

  constructor(
    process: string, 
    provider: string, 
    model: string, 
    enabled: boolean = true,
    tracker?: MetricsTracker
  ) {
    this.process = process;
    this.provider = provider;
    this.model = model;
    this.enabled = enabled;
    this.tracker = tracker;
    this.startTime = Date.now();
  }

  /**
   * Mark request as completed successfully
   */
  success(inputTokens: number, outputTokens: number): void {
    if (!this.enabled || !this.tracker) return;

    const latency = Date.now() - this.startTime;
    
    this.tracker.recordRequest({
      process: this.process,
      provider: this.provider,
      model: this.model,
      inputTokens,
      outputTokens,
      latency,
      success: true,
      startTime: this.startTime
    });
  }

  /**
   * Mark request as failed
   */
  error(error: string, inputTokens: number = 0, outputTokens: number = 0): void {
    if (!this.enabled || !this.tracker) return;

    const latency = Date.now() - this.startTime;
    
    this.tracker.recordRequest({
      process: this.process,
      provider: this.provider,
      model: this.model,
      inputTokens,
      outputTokens,
      latency,
      success: false,
      error,
      startTime: this.startTime
    });
  }

  /**
   * Get elapsed time since request started
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }
}

// Singleton instance
export const metricsTracker = MetricsTracker.getInstance();

// Convenience functions
export function trackAIRequest(process: string, provider: string, model: string): RequestTracker {
  return metricsTracker.startRequest(process, provider, model);
}

export function enableMetricsTracking(enabled: boolean = true): void {
  metricsTracker.setEnabled(enabled);
}

export function flushMetrics(): Promise<void> {
  return metricsTracker.flush();
}

export function getMetricsStatus() {
  return metricsTracker.getStatus();
} 