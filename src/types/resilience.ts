/**
 * Milestone 19: Production Hardening, Observability & Resilience Types
 * Circuit Breakers, Sliding Window Rate Limiting, Latency Percentiles (p50, p95, p99),
 * Health Diagnostics Probes, and Graceful Degradation Matrix.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;   // Number of consecutive failures to trip
  recoveryTimeoutMs: number;  // Time to wait before entering HALF_OPEN
  halfOpenMaxProbes: number;  // Number of successful probes required to close
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number;
  lastStateChange: number;
  totalTrippedCount: number;
}

export interface RateLimitConfig {
  windowMs: number;          // e.g. 60,000 ms (1 min)
  maxRequests: number;       // e.g. 60 requests
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTimeMs: number;
  currentCount: number;
}

export interface LatencyHistogram {
  samples: number[];
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  average: number;
}

export type HealthStatus = 'healthy' | 'degraded' | 'critical';

export interface ServiceProbe {
  serviceId: string;
  name: string;
  status: HealthStatus;
  latencyMs: number;
  circuitState: CircuitState;
  lastChecked: number;
  errorBudgetRemainingPercent: number;
  message?: string;
}

export interface SystemResilienceTelemetry {
  overallHealth: HealthStatus;
  uptimeSeconds: number;
  services: ServiceProbe[];
  latency: LatencyHistogram;
  degradedModeActive: boolean;
  cachedFallbackAvailable: boolean;
}
