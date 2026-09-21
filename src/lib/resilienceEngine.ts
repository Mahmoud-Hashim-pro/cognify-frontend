/**
 * Milestone 19: Production Hardening, Observability & Resilience Engine
 * Circuit Breaker State Machine, Sliding Window Rate Limiting,
 * Latency Percentiles (p50, p95, p99), and Graceful Degradation Matrix.
 */

import type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  RateLimitConfig,
  RateLimitResult,
  LatencyHistogram,
  ServiceProbe,
  SystemResilienceTelemetry,
  HealthStatus
} from '../types/resilience';

// ============================================================================
// 1. Circuit Breaker Pattern
// ============================================================================

export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Circuit breaker is OPEN. Upstream call rejected to prevent cascade failure.') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime = 0;
  private lastStateChange = Date.now();
  private totalTrippedCount = 0;

  constructor(private config: CircuitBreakerConfig = {
    failureThreshold: 3,
    recoveryTimeoutMs: 15000,
    halfOpenMaxProbes: 2
  }) {}

  public getMetrics(): CircuitBreakerMetrics {
    this.checkAutoRecovery();
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalTrippedCount: this.totalTrippedCount
    };
  }

  public getState(): CircuitState {
    this.checkAutoRecovery();
    return this.state;
  }

  private checkAutoRecovery() {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime >= this.config.recoveryTimeoutMs) {
      this.state = 'HALF_OPEN';
      this.consecutiveSuccesses = 0;
      this.lastStateChange = Date.now();
    }
  }

  public async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.checkAutoRecovery();

    if (this.state === 'OPEN') {
      if (fallback) {
        return fallback();
      }
      throw new CircuitBreakerOpenError();
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      if (fallback) {
        return fallback();
      }
      throw err;
    }
  }

  public recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.config.halfOpenMaxProbes) {
        this.state = 'CLOSED';
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.lastStateChange = Date.now();
      }
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures = 0;
    }
  }

  public recordFailure() {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'CLOSED' && this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.totalTrippedCount++;
      this.lastStateChange = Date.now();
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.totalTrippedCount++;
      this.lastStateChange = Date.now();
    }
  }

  public forceState(state: CircuitState) {
    this.state = state;
    this.lastStateChange = Date.now();
    if (state === 'CLOSED') {
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
    }
  }
}

// ============================================================================
// 2. Sliding Window Rate Limiter
// ============================================================================

export class SlidingWindowRateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(private config: RateLimitConfig = { windowMs: 60000, maxRequests: 60 }) {}

  public consume(key: string, cost = 1): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const timestamps = (this.requests.get(key) || []).filter(t => t > windowStart);

    if (timestamps.length + cost <= this.config.maxRequests) {
      for (let i = 0; i < cost; i++) {
        timestamps.push(now);
      }
      this.requests.set(key, timestamps);
      return {
        allowed: true,
        remaining: this.config.maxRequests - timestamps.length,
        resetTimeMs: windowStart + this.config.windowMs,
        currentCount: timestamps.length
      };
    } else {
      this.requests.set(key, timestamps);
      return {
        allowed: false,
        remaining: Math.max(0, this.config.maxRequests - timestamps.length),
        resetTimeMs: windowStart + this.config.windowMs,
        currentCount: timestamps.length
      };
    }
  }

  public reset(key?: string) {
    if (key) this.requests.delete(key);
    else this.requests.clear();
  }
}

// ============================================================================
// 3. Latency Histogram Percentiles
// ============================================================================

export function calculateLatencyHistogram(samples: number[]): LatencyHistogram {
  if (!samples || samples.length === 0) {
    return { samples: [], p50: 0, p95: 0, p99: 0, min: 0, max: 0, average: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;

  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const average = parseFloat((sum / n).toFixed(2));

  function getPercentile(p: number): number {
    const idx = Math.ceil((p / 100) * n) - 1;
    return sorted[Math.max(0, Math.min(n - 1, idx))];
  }

  return {
    samples: sorted,
    p50: getPercentile(50),
    p95: getPercentile(95),
    p99: getPercentile(99),
    min,
    max,
    average
  };
}

// ============================================================================
// 4. Graceful Degradation & Cached Response Matrix
// ============================================================================

const CACHED_FALLBACK_REPOSITORIES: Record<string, string> = {
  c_pointers: 'A pointer stores the memory address of another variable. For example: `int x = 10; int *p = &x;`. When you use `*p`, you access the value at address `p`.',
  recursion: 'Recursion is a programming technique where a function solves a problem by calling a smaller instance of itself until reaching a base condition.',
  memory_leak: 'A memory leak occurs when heap memory allocated with `malloc()` is never released with `free()`, causing consumed memory to grow continuously.'
};

export function getDegradedFallbackResponse(conceptId: string): { text: string; source: 'offline_cache' } {
  const fallback = CACHED_FALLBACK_REPOSITORIES[conceptId] ||
    'The AI tutoring model is temporarily operating in degraded offline mode. Please review your textbook notes for this concept while connectivity recovers.';
  return {
    text: fallback,
    source: 'offline_cache'
  };
}

// ============================================================================
// 5. System Resilience Telemetry Aggregator
// ============================================================================

export function compileResilienceTelemetry(
  probes: ServiceProbe[],
  latencySamples: number[],
  uptimeSeconds = 864000
): SystemResilienceTelemetry {
  const latency = calculateLatencyHistogram(latencySamples);

  let overallHealth: HealthStatus = 'healthy';
  let hasCritical = false;
  let hasDegraded = false;

  for (const probe of probes) {
    if (probe.status === 'critical' || probe.circuitState === 'OPEN') {
      hasCritical = true;
    } else if (probe.status === 'degraded' || probe.circuitState === 'HALF_OPEN') {
      hasDegraded = true;
    }
  }

  if (hasCritical) overallHealth = 'critical';
  else if (hasDegraded) overallHealth = 'degraded';

  return {
    overallHealth,
    uptimeSeconds,
    services: probes,
    latency,
    degradedModeActive: hasCritical || hasDegraded,
    cachedFallbackAvailable: true
  };
}
