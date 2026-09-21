import React, { useState, useMemo } from 'react';
import {
  Activity,
  ShieldAlert,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Cpu,
  Server,
  Database,
  Gauge,
  WifiOff,
  Flame
} from 'lucide-react';
import {
  CircuitBreaker,
  SlidingWindowRateLimiter,
  calculateLatencyHistogram,
  getDegradedFallbackResponse,
  compileResilienceTelemetry
} from '../lib/resilienceEngine';
import type { ServiceProbe } from '../types/resilience';

interface SystemResilienceDashboardProps {
  isArabic?: boolean;
}

export const SystemResilienceDashboard: React.FC<SystemResilienceDashboardProps> = ({
  isArabic = false
}) => {
  // Circuit Breaker Instances in State
  const [geminiBreaker] = useState(() => new CircuitBreaker({
    failureThreshold: 3,
    recoveryTimeoutMs: 10000,
    halfOpenMaxProbes: 2
  }));

  const [breakerState, setBreakerState] = useState(geminiBreaker.getMetrics());

  // Rate Limiter in State
  const [rateLimiter] = useState(() => new SlidingWindowRateLimiter({
    windowMs: 60000,
    maxRequests: 30
  }));

  const [rateStatus, setRateStatus] = useState(() => rateLimiter.consume('client_ip_default', 0));

  // Latency Samples in State
  const [latencySamples, setLatencySamples] = useState<number[]>([
    120, 140, 155, 132, 190, 210, 145, 160, 310, 420, 135, 128, 175, 540, 142
  ]);

  // Degradation Test State
  const [selectedConcept, setSelectedConcept] = useState<'c_pointers' | 'recursion' | 'memory_leak'>('c_pointers');
  const [cachedOutput, setCachedOutput] = useState<string | null>(null);

  // Probes State
  const probes: ServiceProbe[] = useMemo(() => [
    {
      serviceId: 'gemini_flash',
      name: 'Google Gemini 2.5 API',
      status: breakerState.state === 'OPEN' ? 'critical' : breakerState.state === 'HALF_OPEN' ? 'degraded' : 'healthy',
      latencyMs: 142,
      circuitState: breakerState.state,
      lastChecked: Date.now(),
      errorBudgetRemainingPercent: breakerState.state === 'OPEN' ? 12 : 98.4,
      message: breakerState.state === 'OPEN' ? 'Circuit OPEN: Tripped due to 3 consecutive upstream 503 timeouts' : 'Operational'
    },
    {
      serviceId: 'groq_fallback',
      name: 'Groq Llama-3 Fallback',
      status: 'healthy',
      latencyMs: 88,
      circuitState: 'CLOSED',
      lastChecked: Date.now(),
      errorBudgetRemainingPercent: 99.8,
      message: 'Hot standby ready'
    },
    {
      serviceId: 'firestore_db',
      name: 'Cloud Firestore (Frankfurt)',
      status: 'healthy',
      latencyMs: 38,
      circuitState: 'CLOSED',
      lastChecked: Date.now(),
      errorBudgetRemainingPercent: 99.9,
      message: 'Sub-40ms healthy'
    },
    {
      serviceId: 'tts_euphonia',
      name: 'Web Speech & TTS Engine',
      status: 'healthy',
      latencyMs: 12,
      circuitState: 'CLOSED',
      lastChecked: Date.now(),
      errorBudgetRemainingPercent: 100,
      message: 'Local browser synthesizer ready'
    }
  ], [breakerState]);

  const telemetry = useMemo(() => {
    return compileResilienceTelemetry(probes, latencySamples, 864000);
  }, [probes, latencySamples]);

  // Actions
  const handleTripGeminiCircuit = () => {
    geminiBreaker.recordFailure();
    geminiBreaker.recordFailure();
    geminiBreaker.recordFailure();
    setBreakerState(geminiBreaker.getMetrics());
  };

  const handleResetGeminiCircuit = () => {
    geminiBreaker.forceState('CLOSED');
    setBreakerState(geminiBreaker.getMetrics());
  };

  const handleSendRateRequest = (cost = 1) => {
    const res = rateLimiter.consume('client_ip_default', cost);
    setRateStatus(res);
    if (res.allowed) {
      // Record simulated latency
      const lat = Math.round(90 + Math.random() * 150);
      setLatencySamples(prev => [...prev.slice(-30), lat]);
    }
  };

  const handleTestDegradedMode = () => {
    const res = getDegradedFallbackResponse(selectedConcept);
    setCachedOutput(res.text);
  };

  return (
    <div className="w-full min-h-screen bg-[#0A0C14] text-slate-100 p-4 sm:p-8 font-sans relative">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Cockpit Header */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400">
                  <Activity className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {isArabic ? 'لوحة قيادة المتانة والمراقبة والتشغيل' : 'Production Hardening & Resilience Cockpit'}
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    {isArabic
                      ? 'قواطع الدوائر الآلية (Circuit Breakers)، محدد المعدل الانزلاقي، ومصفوفة التدهور السلس'
                      : 'Circuit Breaker State Machines, Sliding Window Rate Limiting, Latency Percentiles & Graceful Degradation'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  telemetry.overallHealth === 'healthy'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : telemetry.overallHealth === 'degraded'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                {telemetry.overallHealth === 'healthy' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                System {telemetry.overallHealth.toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                Uptime 99.98%
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Service Probes & Circuit Breakers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400" />
              Distributed Service Probes & Circuit Breakers
            </h2>
            <span className="text-xs text-slate-400">Auto-recovers to HALF_OPEN in 10s</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {probes.map(p => {
              const stateColor =
                p.circuitState === 'CLOSED'
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : p.circuitState === 'HALF_OPEN'
                  ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  : 'text-rose-400 border-rose-500/30 bg-rose-500/10';

              return (
                <div
                  key={p.serviceId}
                  className="p-5 bg-[#121524]/90 border border-slate-800/80 rounded-2xl backdrop-blur-xl shadow-xl space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-white leading-tight">{p.name}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${stateColor}`}>
                      {p.circuitState}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-400 pt-1">
                    <div className="flex justify-between">
                      <span>Latency:</span>
                      <span className="font-mono text-white">{p.latencyMs} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Error Budget:</span>
                      <span className="font-mono text-emerald-400">{p.errorBudgetRemainingPercent}%</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 truncate pt-1 border-t border-slate-800">
                    {p.message}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Breaker Manual Controls */}
          <div className="p-4 bg-[#121524]/60 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>
                Gemini Breaker: State is <strong className="text-white font-mono">{breakerState.state}</strong> (Tripped {breakerState.totalTrippedCount} times)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTripGeminiCircuit}
                className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5" /> Simulate 3x Upstream Failures (Trip to OPEN)
              </button>
              <button
                onClick={handleResetGeminiCircuit}
                className="py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Force Reset (CLOSED)
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Sliding Window Rate Limiter & Latency Percentiles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rate Limiter Cockpit */}
          <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Sliding Window Rate Limiter (60s Window)
              </h3>
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold font-mono border ${
                rateStatus.allowed
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {rateStatus.allowed ? 'ALLOWING' : 'THROTTLED (429)'}
              </span>
            </div>

            <div className="p-4 bg-[#0A0C14] border border-slate-800 rounded-2xl space-y-3">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Consumed Window Quota:</span>
                <span className="font-mono font-bold text-white">{rateStatus.currentCount} / 30 RPM</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    rateStatus.currentCount < 20
                      ? 'bg-cyan-500'
                      : rateStatus.currentCount < 30
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, (rateStatus.currentCount / 30) * 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Remaining Quota: {rateStatus.remaining} reqs</span>
                <span>Reset in: ~{Math.round((rateStatus.resetTimeMs - Date.now()) / 1000)}s</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleSendRateRequest(1)}
                className="flex-1 py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition"
              >
                Send 1 Request
              </button>
              <button
                onClick={() => handleSendRateRequest(15)}
                className="py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold rounded-xl text-xs transition"
              >
                Simulate Burst (+15 Reqs)
              </button>
            </div>
          </div>

          {/* Latency Percentiles Histogram */}
          <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              Latency Percentile Histogram ({telemetry.latency.samples.length} Samples)
            </h3>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 bg-[#0A0C14] rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">p50 (Median)</span>
                <span className="text-xl font-bold font-mono text-cyan-400">{telemetry.latency.p50} ms</span>
              </div>
              <div className="p-3.5 bg-[#0A0C14] rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">p95</span>
                <span className="text-xl font-bold font-mono text-purple-400">{telemetry.latency.p95} ms</span>
              </div>
              <div className="p-3.5 bg-[#0A0C14] rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">p99 (Tail)</span>
                <span className="text-xl font-bold font-mono text-amber-400">{telemetry.latency.p99} ms</span>
              </div>
            </div>

            <div className="p-3 bg-[#0A0C14] rounded-2xl border border-slate-800 text-xs text-slate-400 flex justify-between">
              <span>Fastest Sample: <strong className="text-white font-mono">{telemetry.latency.min} ms</strong></span>
              <span>Average: <strong className="text-cyan-400 font-mono">{telemetry.latency.average} ms</strong></span>
              <span>Slowest Sample: <strong className="text-rose-400 font-mono">{telemetry.latency.max} ms</strong></span>
            </div>
          </div>
        </div>

        {/* Section 3: Graceful Degradation Matrix */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <WifiOff className="w-5 h-5 text-amber-400" />
                Graceful Degradation Matrix (Zero-Downtime Offline Fallbacks)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                When upstream AI networks disconnect or trip circuit breakers, Cognify serves vetted pedagogical explanations directly from local encrypted cache.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedConcept}
                onChange={e => setSelectedConcept(e.target.value as any)}
                className="bg-[#0A0C14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="c_pointers">C Pointers</option>
                <option value="recursion">Recursion</option>
                <option value="memory_leak">Memory Leak</option>
              </select>

              <button
                onClick={handleTestDegradedMode}
                className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
              >
                Fetch Offline Fallback
              </button>
            </div>
          </div>

          {cachedOutput && (
            <div className="p-4 bg-[#0A0C14] border border-amber-500/30 rounded-2xl space-y-2">
              <span className="text-[11px] font-mono text-amber-400 uppercase font-bold block">
                Cached Offline Response (Zero-API Call)
              </span>
              <p className="text-xs text-slate-200 leading-relaxed font-mono">
                {cachedOutput}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemResilienceDashboard;
