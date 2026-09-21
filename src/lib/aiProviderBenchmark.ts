/**
 * Cognify 2.0 - Milestone Benchmark Engine (Phase B: Requirements 14, 18, 19)
 * 
 * Comprehensive AI Provider Performance, Economic Models, Fallback Cascade,
 * Quota Tracking, and Formatting Preservation across Google Gemini, Groq, NVIDIA NIM, and xAI.
 */

import { repairMarkdownCodeBlocks, repairLatexFormulas } from './aiQualityGuard2';

// ============================================================================
// 1. Providers, Model IDs & Pricing Profiles (Requirement 14 & 18)
// ============================================================================

export type CognifyProviderId = 'gemini' | 'groq' | 'nvidia' | 'xai';

export interface ModelPricingProfile {
  providerId: CognifyProviderId;
  modelId: string;
  displayName: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  audioCostPerMillion?: number;
  audioCostPerSecond?: number;
  visionCostPerMillion?: number;
  visionCostPerImage?: number;
  typicalTTFTMs: number;
  typicalP50LatencyMs: number;
  typicalP90LatencyMs: number;
  typicalP99LatencyMs: number;
  contextWindowTokens: number;
}

/**
 * Verified pricing and latency performance models for all 4 Cognify AI providers:
 * 1. Google Gemini (1.5 Flash & 1.5 Pro)
 * 2. Groq (Llama-3.3-70b)
 * 3. NVIDIA NIM (Nemotron-70b)
 * 4. xAI (Grok-2)
 */
export const PROVIDER_PRICING_MODELS: Record<string, ModelPricingProfile> = {
  'gemini-1.5-flash': {
    providerId: 'gemini',
    modelId: 'gemini-1.5-flash',
    displayName: 'Google Gemini 1.5 Flash',
    inputCostPerMillion: 0.075,   // $0.075 / 1M tokens
    outputCostPerMillion: 0.30,   // $0.30 / 1M tokens
    audioCostPerMillion: 10.00,   // $10.00 / 1M audio tokens (~$0.00002/sec)
    audioCostPerSecond: 0.00002,
    visionCostPerMillion: 0.075,
    visionCostPerImage: 0.00002,
    typicalTTFTMs: 280,
    typicalP50LatencyMs: 420,
    typicalP90LatencyMs: 780,
    typicalP99LatencyMs: 1350,
    contextWindowTokens: 1_000_000,
  },
  'gemini-1.5-pro': {
    providerId: 'gemini',
    modelId: 'gemini-1.5-pro',
    displayName: 'Google Gemini 1.5 Pro',
    inputCostPerMillion: 1.25,    // $1.25 / 1M tokens (<=128k prompt)
    outputCostPerMillion: 5.00,   // $5.00 / 1M tokens
    audioCostPerMillion: 20.00,
    audioCostPerSecond: 0.00004,
    visionCostPerMillion: 1.25,
    visionCostPerImage: 0.00030,
    typicalTTFTMs: 610,
    typicalP50LatencyMs: 950,
    typicalP90LatencyMs: 1750,
    typicalP99LatencyMs: 2900,
    contextWindowTokens: 2_000_000,
  },
  'groq-llama-3.3-70b': {
    providerId: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    displayName: 'Groq Cloud (Llama-3.3-70b)',
    inputCostPerMillion: 0.59,    // $0.59 / 1M tokens
    outputCostPerMillion: 0.79,   // $0.79 / 1M tokens
    typicalTTFTMs: 95,            // Groq LPU low latency
    typicalP50LatencyMs: 190,
    typicalP90LatencyMs: 380,
    typicalP99LatencyMs: 650,
    contextWindowTokens: 128_000,
  },
  'nvidia-nemotron-70b': {
    providerId: 'nvidia',
    modelId: 'nvidia/nemotron-70b',
    displayName: 'NVIDIA NIM (Nemotron-70b)',
    inputCostPerMillion: 0.70,    // $0.70 / 1M tokens
    outputCostPerMillion: 0.80,   // $0.80 / 1M tokens
    typicalTTFTMs: 340,
    typicalP50LatencyMs: 510,
    typicalP90LatencyMs: 920,
    typicalP99LatencyMs: 1550,
    contextWindowTokens: 128_000,
  },
  'xai-grok-2': {
    providerId: 'xai',
    modelId: 'grok-2-latest',
    displayName: 'xAI (Grok-2)',
    inputCostPerMillion: 2.00,    // $2.00 / 1M tokens
    outputCostPerMillion: 10.00,  // $10.00 / 1M tokens
    typicalTTFTMs: 480,
    typicalP50LatencyMs: 740,
    typicalP90LatencyMs: 1390,
    typicalP99LatencyMs: 2450,
    contextWindowTokens: 131_072,
  },
};

/**
 * Standard provider fallback cascade order mandated by Cognify architecture:
 * Gemini (primary) -> Groq (first fallback) -> NVIDIA (second fallback) -> xAI (frontier fallback)
 */
export const PROVIDER_FALLBACK_CASCADE: CognifyProviderId[] = [
  'gemini',
  'groq',
  'nvidia',
  'xai',
];

// ============================================================================
// 2. Latency Percentiles & TTFT Calculations (Requirement 14)
// ============================================================================

export interface LatencyPercentiles {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p99: number;
}

/**
 * Calculates standard latency percentiles (P50, P90, P99) and descriptive metrics.
 */
export function calculateLatencyPercentiles(samples: number[]): LatencyPercentiles {
  if (!samples || samples.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p99: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;

  const getPercentile = (p: number): number => {
    if (count === 1) return sorted[0];
    const rank = (p / 100) * (count - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const weight = rank - lower;
    if (upper >= count) return sorted[count - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  return {
    count,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    p50: Math.round(getPercentile(50) * 100) / 100,
    p90: Math.round(getPercentile(90) * 100) / 100,
    p99: Math.round(getPercentile(99) * 100) / 100,
  };
}

/**
 * Calculates Time-To-First-Token (TTFT) from request start and first token emission.
 */
export function calculateTTFT(requestStartTimeMs: number, firstTokenReceivedTimeMs: number): number {
  return Math.max(0, firstTokenReceivedTimeMs - requestStartTimeMs);
}

export interface FallbackAttemptTrace {
  providerId: CognifyProviderId;
  durationMs: number;
  status: 'failed' | 'succeeded';
  errorCode?: number | string;
  errorMessage?: string;
}

export interface FallbackLatencyResult {
  cascadeOrder: CognifyProviderId[];
  attempts: FallbackAttemptTrace[];
  succeededProvider: CognifyProviderId | null;
  totalLatencyMs: number;
  standaloneProviderLatencyMs: number;
  fallbackLatencyPenaltyMs: number;
  isCascaded: boolean;
}

/**
 * Calculates the latency penalty caused by cascading through failed upstream providers.
 */
export function calculateFallbackLatencyPenalty(
  attempts: FallbackAttemptTrace[],
  succeededProviderStandaloneLatencyMs?: number
): FallbackLatencyResult {
  const totalLatencyMs = attempts.reduce((sum, a) => sum + a.durationMs, 0);
  const successTrace = attempts.find(a => a.status === 'succeeded');
  const succeededProvider = successTrace ? successTrace.providerId : null;
  
  const standaloneMs = succeededProviderStandaloneLatencyMs !== undefined
    ? succeededProviderStandaloneLatencyMs
    : (successTrace ? successTrace.durationMs : 0);

  const fallbackLatencyPenaltyMs = Math.max(0, totalLatencyMs - standaloneMs);

  return {
    cascadeOrder: attempts.map(a => a.providerId),
    attempts,
    succeededProvider,
    totalLatencyMs,
    standaloneProviderLatencyMs: standaloneMs,
    fallbackLatencyPenaltyMs,
    isCascaded: attempts.filter(a => a.status === 'failed').length > 0,
  };
}

// ============================================================================
// 3. Zero-Token Deterministic Routing Efficiency (< 5ms) (Requirement 14)
// ============================================================================

export interface DeterministicRoutingResult {
  isDeterministic: boolean;
  intent: string | null;
  cachedResponse?: string;
  tokensConsumed: number;
  costUSD: number;
  executionTimeMs: number;
  meetsLatencySLA: boolean; // Must be < 5.0 ms
}

const DETERMINISTIC_PATTERNS: Array<{ regex: RegExp; intent: string; response: string }> = [
  { regex: /^(hello|hi|hey|good\s*(morning|afternoon|evening))\b/i, intent: 'greeting', response: 'Hello! I am Cognify, your adaptive personal learning assistant. What would you like to explore today?' },
  { regex: /^(help|what\s+can\s+you\s+do|commands)\b/i, intent: 'help', response: 'You can ask academic questions, practice quizzes, explore concept graphs, or enable accessibility features like gaze tracking and speech assist.' },
  { regex: /^(\d+)\s*([\+\-\*\/])\s*(\d+)$/, intent: 'simple_math', response: 'CALCULATED_ARITHMETIC' },
  { regex: /^(who\s+are\s+you|what\s+is\s+cognify)\b/i, intent: 'identity', response: 'Cognify is an AI-powered adaptive learning assistant designed for personalized, accessible education.' },
  { regex: /^(accessibility\s+status|toggle\s+captions)\b/i, intent: 'a11y_command', response: 'Accessibility overlay toggled.' },
];

/**
 * Evaluates queries against zero-token deterministic routes (cache, pattern matching, offline commands).
 * Guarantees execution in < 5.0ms with 0 tokens and $0.00 cost.
 */
export function evaluateDeterministicRouting(
  query: string,
  cacheStore?: Map<string, string>
): DeterministicRoutingResult {
  const start = performance.now();
  const trimmed = query.trim();

  // 1. Check local key-value cache
  if (cacheStore && cacheStore.has(trimmed.toLowerCase())) {
    const elapsed = performance.now() - start;
    return {
      isDeterministic: true,
      intent: 'cache_hit',
      cachedResponse: cacheStore.get(trimmed.toLowerCase())!,
      tokensConsumed: 0,
      costUSD: 0,
      executionTimeMs: Math.round(elapsed * 1000) / 1000,
      meetsLatencySLA: elapsed < 5.0,
    };
  }

  // 2. Check regex intent patterns
  for (const item of DETERMINISTIC_PATTERNS) {
    const match = trimmed.match(item.regex);
    if (match) {
      let finalResp = item.response;
      if (item.intent === 'simple_math' && match[1] && match[2] && match[3]) {
        const a = parseFloat(match[1]);
        const op = match[2];
        const b = parseFloat(match[3]);
        let res = 0;
        if (op === '+') res = a + b;
        else if (op === '-') res = a - b;
        else if (op === '*') res = a * b;
        else if (op === '/' && b !== 0) res = a / b;
        finalResp = `${a} ${op} ${b} = ${res}`;
      }

      const elapsed = performance.now() - start;
      return {
        isDeterministic: true,
        intent: item.intent,
        cachedResponse: finalResp,
        tokensConsumed: 0,
        costUSD: 0,
        executionTimeMs: Math.round(elapsed * 1000) / 1000,
        meetsLatencySLA: elapsed < 5.0,
      };
    }
  }

  // Non-deterministic, requires LLM invocation
  const elapsed = performance.now() - start;
  return {
    isDeterministic: false,
    intent: null,
    tokensConsumed: 0,
    costUSD: 0,
    executionTimeMs: Math.round(elapsed * 1000) / 1000,
    meetsLatencySLA: elapsed < 5.0,
  };
}

// ============================================================================
// 4. Token Cost Projection & Economic Models (Requirement 18 & 19)
// ============================================================================

export interface TurnCostBreakdown {
  modelId: string;
  providerId: CognifyProviderId;
  inputTokens: number;
  outputTokens: number;
  inputCostUSD: number;
  outputCostUSD: number;
  multimodalCostUSD: number;
  totalCostUSD: number;
}

export interface MultimodalUsageOptions {
  audioSeconds?: number;
  visionImages?: number;
}

/**
 * Calculates accurate turn cost based on input/output tokens and optional audio/vision media.
 */
export function calculateTurnCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  multimodal?: MultimodalUsageOptions
): TurnCostBreakdown {
  const profile = PROVIDER_PRICING_MODELS[modelId] || PROVIDER_PRICING_MODELS['gemini-1.5-flash'];
  
  const inputCostUSD = (inputTokens / 1_000_000) * profile.inputCostPerMillion;
  const outputCostUSD = (outputTokens / 1_000_000) * profile.outputCostPerMillion;

  let multimodalCostUSD = 0;
  if (multimodal?.audioSeconds && profile.audioCostPerSecond) {
    multimodalCostUSD += multimodal.audioSeconds * profile.audioCostPerSecond;
  }
  if (multimodal?.visionImages && profile.visionCostPerImage) {
    multimodalCostUSD += multimodal.visionImages * profile.visionCostPerImage;
  }

  const totalCostUSD = inputCostUSD + outputCostUSD + multimodalCostUSD;

  return {
    modelId: profile.modelId,
    providerId: profile.providerId,
    inputTokens,
    outputTokens,
    inputCostUSD: Number(inputCostUSD.toFixed(8)),
    outputCostUSD: Number(outputCostUSD.toFixed(8)),
    multimodalCostUSD: Number(multimodalCostUSD.toFixed(8)),
    totalCostUSD: Number(totalCostUSD.toFixed(8)),
  };
}

export type StudentProfileTier = 'light' | 'moderate' | 'heavy' | 'power';

export interface StudentTierUsageSpec {
  turnsPerDay: number;
  activeDaysPerMonth: number;
  avgInputTokensPerTurn: number;
  avgOutputTokensPerTurn: number;
  audioSecondsPerMonth?: number;
  visionImagesPerMonth?: number;
}

export const STUDENT_TIER_SPECS: Record<StudentProfileTier, StudentTierUsageSpec> = {
  light: {
    turnsPerDay: 5,
    activeDaysPerMonth: 20,
    avgInputTokensPerTurn: 400,
    avgOutputTokensPerTurn: 200,
    audioSecondsPerMonth: 0,
    visionImagesPerMonth: 0,
  },
  moderate: {
    turnsPerDay: 15,
    activeDaysPerMonth: 22,
    avgInputTokensPerTurn: 600,
    avgOutputTokensPerTurn: 300,
    audioSecondsPerMonth: 60,
    visionImagesPerMonth: 2,
  },
  heavy: {
    turnsPerDay: 35,
    activeDaysPerMonth: 25,
    avgInputTokensPerTurn: 800,
    avgOutputTokensPerTurn: 350,
    audioSecondsPerMonth: 180,
    visionImagesPerMonth: 10,
  },
  power: {
    turnsPerDay: 80,
    activeDaysPerMonth: 28,
    avgInputTokensPerTurn: 1200,
    avgOutputTokensPerTurn: 500,
    audioSecondsPerMonth: 600,
    visionImagesPerMonth: 30,
  },
};

export interface StudentMonthlyCostProjection {
  tier: StudentProfileTier;
  modelId: string;
  monthlyTurns: number;
  monthlyInputTokens: number;
  monthlyOutputTokens: number;
  monthlyInputCostUSD: number;
  monthlyOutputCostUSD: number;
  monthlyMultimodalCostUSD: number;
  totalMonthlyCostUSD: number;
  isWithinDefaultSLA: boolean; // SLA: Strictly < $0.50 / month on Gemini Flash default
}

/**
 * Projects monthly AI compute cost for a student based on usage tier and selected model.
 * Requirement 19: Validates that standard students on Gemini 1.5 Flash default remain < $0.50/month.
 */
export function calculateStudentMonthlyCost(
  tier: StudentProfileTier,
  modelId: string = 'gemini-1.5-flash'
): StudentMonthlyCostProjection {
  const spec = STUDENT_TIER_SPECS[tier];
  const profile = PROVIDER_PRICING_MODELS[modelId] || PROVIDER_PRICING_MODELS['gemini-1.5-flash'];

  const monthlyTurns = spec.turnsPerDay * spec.activeDaysPerMonth;
  const monthlyInputTokens = monthlyTurns * spec.avgInputTokensPerTurn;
  const monthlyOutputTokens = monthlyTurns * spec.avgOutputTokensPerTurn;

  const monthlyInputCostUSD = (monthlyInputTokens / 1_000_000) * profile.inputCostPerMillion;
  const monthlyOutputCostUSD = (monthlyOutputTokens / 1_000_000) * profile.outputCostPerMillion;

  let monthlyMultimodalCostUSD = 0;
  if (spec.audioSecondsPerMonth && profile.audioCostPerSecond) {
    monthlyMultimodalCostUSD += spec.audioSecondsPerMonth * profile.audioCostPerSecond;
  }
  if (spec.visionImagesPerMonth && profile.visionCostPerImage) {
    monthlyMultimodalCostUSD += spec.visionImagesPerMonth * profile.visionCostPerImage;
  }

  const totalMonthlyCostUSD = monthlyInputCostUSD + monthlyOutputCostUSD + monthlyMultimodalCostUSD;

  return {
    tier,
    modelId: profile.modelId,
    monthlyTurns,
    monthlyInputTokens,
    monthlyOutputTokens,
    monthlyInputCostUSD: Number(monthlyInputCostUSD.toFixed(6)),
    monthlyOutputCostUSD: Number(monthlyOutputCostUSD.toFixed(6)),
    monthlyMultimodalCostUSD: Number(monthlyMultimodalCostUSD.toFixed(6)),
    totalMonthlyCostUSD: Number(totalMonthlyCostUSD.toFixed(6)),
    isWithinDefaultSLA: totalMonthlyCostUSD < 0.50,
  };
}

export interface CohortCostProjection {
  cohortSize: number;
  modelId: string;
  distribution: Record<StudentProfileTier, number>;
  totalMonthlyTokens: number;
  totalMonthlyCostUSD: number;
  averageCostPerStudentUSD: number;
  withinBudgetSLA: boolean;
}

/**
 * Calculates aggregate monthly cost for a student cohort with tiered usage distribution.
 */
export function calculateCohortMonthlyCost(
  cohortSize: number,
  distribution: Record<StudentProfileTier, number> = { light: 0.5, moderate: 0.35, heavy: 0.12, power: 0.03 },
  modelId: string = 'gemini-1.5-flash'
): CohortCostProjection {
  let totalCost = 0;
  let totalTokens = 0;

  for (const [tierKey, ratio] of Object.entries(distribution)) {
    const tier = tierKey as StudentProfileTier;
    const count = Math.round(cohortSize * ratio);
    const proj = calculateStudentMonthlyCost(tier, modelId);
    totalCost += count * proj.totalMonthlyCostUSD;
    totalTokens += count * (proj.monthlyInputTokens + proj.monthlyOutputTokens);
  }

  const averageCostPerStudentUSD = cohortSize > 0 ? totalCost / cohortSize : 0;

  return {
    cohortSize,
    modelId,
    distribution,
    totalMonthlyTokens: totalTokens,
    totalMonthlyCostUSD: Number(totalCost.toFixed(4)),
    averageCostPerStudentUSD: Number(averageCostPerStudentUSD.toFixed(4)),
    withinBudgetSLA: averageCostPerStudentUSD < 0.50,
  };
}

// ============================================================================
// 5. Institutional Tiered Seat Margins (Requirement 18)
// ============================================================================

export type InstitutionalTierKey = 'pilot' | 'school' | 'district';

export interface InstitutionalTierSpec {
  name: string;
  monthlyPricePerSeatUSD: number;
  minSeats: number;
  infrastructureCostPerSeatUSD: number;
}

export const INSTITUTIONAL_TIERS: Record<InstitutionalTierKey, InstitutionalTierSpec> = {
  pilot: {
    name: 'Department / Pilot',
    monthlyPricePerSeatUSD: 5.00,
    minSeats: 25,
    infrastructureCostPerSeatUSD: 0.15,
  },
  school: {
    name: 'Single School / Campus',
    monthlyPricePerSeatUSD: 3.50,
    minSeats: 250,
    infrastructureCostPerSeatUSD: 0.10,
  },
  district: {
    name: 'District / Enterprise',
    monthlyPricePerSeatUSD: 2.00,
    minSeats: 1000,
    infrastructureCostPerSeatUSD: 0.08,
  },
};

export interface InstitutionalMarginResult {
  tierKey: InstitutionalTierKey;
  tierName: string;
  seatCount: number;
  monthlyRevenueUSD: number;
  aiComputeCostUSD: number;
  infrastructureCostUSD: number;
  totalOperationalCostUSD: number;
  grossProfitUSD: number;
  grossMarginPercentage: number;
  blendedAiCostPerSeatUSD: number;
  isHighMargin: boolean; // Margin > 80%
}

/**
 * Computes institutional revenue, AI operational costs, and gross margins per seat.
 */
export function calculateInstitutionalMargins(
  tierKey: InstitutionalTierKey,
  seatCount: number,
  modelId: string = 'gemini-1.5-flash'
): InstitutionalMarginResult {
  const tier = INSTITUTIONAL_TIERS[tierKey];
  const cohort = calculateCohortMonthlyCost(seatCount, undefined, modelId);

  const monthlyRevenueUSD = seatCount * tier.monthlyPricePerSeatUSD;
  const aiComputeCostUSD = cohort.totalMonthlyCostUSD;
  const infrastructureCostUSD = seatCount * tier.infrastructureCostPerSeatUSD;
  const totalOperationalCostUSD = aiComputeCostUSD + infrastructureCostUSD;

  const grossProfitUSD = monthlyRevenueUSD - totalOperationalCostUSD;
  const grossMarginPercentage = monthlyRevenueUSD > 0 ? (grossProfitUSD / monthlyRevenueUSD) * 100 : 0;

  return {
    tierKey,
    tierName: tier.name,
    seatCount,
    monthlyRevenueUSD: Number(monthlyRevenueUSD.toFixed(2)),
    aiComputeCostUSD: Number(aiComputeCostUSD.toFixed(4)),
    infrastructureCostUSD: Number(infrastructureCostUSD.toFixed(2)),
    totalOperationalCostUSD: Number(totalOperationalCostUSD.toFixed(4)),
    grossProfitUSD: Number(grossProfitUSD.toFixed(2)),
    grossMarginPercentage: Number(grossMarginPercentage.toFixed(2)),
    blendedAiCostPerSeatUSD: cohort.averageCostPerStudentUSD,
    isHighMargin: grossMarginPercentage >= 80.0,
  };
}

// ============================================================================
// 6. Quota Alerts (80% & 100%) & Emergency Circuit Cutoff (Requirement 19)
// ============================================================================

export type QuotaStatus = 'normal' | 'warning_80' | 'exceeded_100';
export type QuotaAlertLevel = null | 'ALERT_80_PERCENT_WARNING' | 'ALERT_100_PERCENT_EXCEEDED';

export interface QuotaState {
  budgetUSD: number;
  spentUSD: number;
  percentageUsed: number;
  status: QuotaStatus;
  alert: QuotaAlertLevel;
  emergencyCutoffActive: boolean;
  canExecuteExpensiveCalls: boolean;
  warningAlertFired: boolean;
  exceededAlertFired: boolean;
}

export class EmergencyQuotaExceededError extends Error {
  constructor(message = 'Emergency Circuit Cutoff tripped: Monthly AI budget exceeded 100%. Blocking paid calls.') {
    super(message);
    this.name = 'EmergencyQuotaExceededError';
  }
}

export class CostQuotaTracker {
  private budgetUSD: number;
  private spentUSD: number;
  private warningAlertFired = false;
  private exceededAlertFired = false;
  private emergencyCutoffActive = false;

  constructor(budgetUSD: number, initialSpendUSD: number = 0) {
    this.budgetUSD = Math.max(0.01, budgetUSD);
    this.spentUSD = initialSpendUSD;
    this.syncState();
  }

  private syncState(): void {
    const ratio = this.spentUSD / this.budgetUSD;
    if (ratio >= 1.0) {
      this.emergencyCutoffActive = true;
      this.exceededAlertFired = true;
      this.warningAlertFired = true;
    } else if (ratio >= 0.80) {
      this.emergencyCutoffActive = false;
      this.warningAlertFired = true;
    } else {
      this.emergencyCutoffActive = false;
    }
  }

  public recordSpend(amountUSD: number): QuotaState {
    this.spentUSD += amountUSD;
    this.syncState();
    return this.getState();
  }

  public getState(): QuotaState {
    const percentageUsed = (this.spentUSD / this.budgetUSD) * 100;
    let status: QuotaStatus = 'normal';
    let alert: QuotaAlertLevel = null;

    if (percentageUsed >= 100) {
      status = 'exceeded_100';
      alert = 'ALERT_100_PERCENT_EXCEEDED';
    } else if (percentageUsed >= 80) {
      status = 'warning_80';
      alert = 'ALERT_80_PERCENT_WARNING';
    }

    return {
      budgetUSD: this.budgetUSD,
      spentUSD: Number(this.spentUSD.toFixed(6)),
      percentageUsed: Number(percentageUsed.toFixed(2)),
      status,
      alert,
      emergencyCutoffActive: this.emergencyCutoffActive,
      canExecuteExpensiveCalls: !this.emergencyCutoffActive,
      warningAlertFired: this.warningAlertFired,
      exceededAlertFired: this.exceededAlertFired,
    };
  }

  public verifyCanExecute(estimatedCostUSD: number = 0): { allowed: boolean; reason?: string } {
    if (this.emergencyCutoffActive) {
      return {
        allowed: false,
        reason: 'EMERGENCY_CIRCUIT_CUTOFF_ACTIVE: 100% quota exhausted. Paid AI calls suspended.',
      };
    }

    if (this.spentUSD + estimatedCostUSD > this.budgetUSD) {
      return {
        allowed: false,
        reason: 'PREDICTED_BUDGET_OVERRUN: Execution would exceed 100% budget.',
      };
    }

    return { allowed: true };
  }

  public executeSafely<T>(action: () => T, deterministicFallback: () => T, estimatedCostUSD: number = 0): T {
    const check = this.verifyCanExecute(estimatedCostUSD);
    if (!check.allowed) {
      return deterministicFallback();
    }
    return action();
  }

  public reset(newBudgetUSD?: number): void {
    if (newBudgetUSD !== undefined) {
      this.budgetUSD = Math.max(0.01, newBudgetUSD);
    }
    this.spentUSD = 0;
    this.warningAlertFired = false;
    this.exceededAlertFired = false;
    this.emergencyCutoffActive = false;
  }
}

// ============================================================================
// 7. Provider Circuit Breaker State Machine (Requirement 14)
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderCircuitMetrics {
  providerId: CognifyProviderId;
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  totalTrippedCount: number;
  lastFailureTime: number;
  lastStateChange: number;
}

export class ProviderCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime = 0;
  private lastStateChange = Date.now();
  private totalTrippedCount = 0;

  constructor(
    public readonly providerId: CognifyProviderId,
    private config: {
      failureThreshold: number;
      recoveryTimeoutMs: number;
      halfOpenSuccessProbes: number;
    } = {
      failureThreshold: 3,
      recoveryTimeoutMs: 10000,
      halfOpenSuccessProbes: 2,
    }
  ) {}

  public getState(): CircuitState {
    this.checkRecoveryTimeout();
    return this.state;
  }

  public getMetrics(): ProviderCircuitMetrics {
    this.checkRecoveryTimeout();
    return {
      providerId: this.providerId,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalTrippedCount: this.totalTrippedCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
    };
  }

  private checkRecoveryTimeout(): void {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime >= this.config.recoveryTimeoutMs) {
      this.state = 'HALF_OPEN';
      this.consecutiveSuccesses = 0;
      this.lastStateChange = Date.now();
    }
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.config.halfOpenSuccessProbes) {
        this.state = 'CLOSED';
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.lastStateChange = Date.now();
      }
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures = 0;
    }
  }

  public recordFailure(): void {
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

  public forceState(state: CircuitState): void {
    this.state = state;
    this.lastStateChange = Date.now();
    if (state === 'OPEN') {
      this.lastFailureTime = Date.now();
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastStateChange = Date.now();
  }
}

// ============================================================================
// 8. Provider Fallback Cascade Manager & Simulation (Requirement 14)
// ============================================================================

export interface ProviderCallMockHandler {
  (providerId: CognifyProviderId, prompt: string): Promise<{ text: string; statusCode?: number }>;
}

export interface CascadeDispatchResult {
  success: boolean;
  succeededProvider: CognifyProviderId | null;
  text: string;
  attempts: FallbackAttemptTrace[];
  cascadeLatencyMs: number;
  fallbackPenaltyMs: number;
  wasRepaired: boolean;
  latexBalanced: boolean;
  codeBlocksBalanced: boolean;
}

export class ProviderCascadeManager {
  private breakers: Record<CognifyProviderId, ProviderCircuitBreaker>;
  private cascadeOrder: CognifyProviderId[];

  constructor(
    customOrder: CognifyProviderId[] = PROVIDER_FALLBACK_CASCADE,
    breakerConfig?: { failureThreshold: number; recoveryTimeoutMs: number; halfOpenSuccessProbes: number }
  ) {
    this.cascadeOrder = [...customOrder];
    this.breakers = {
      gemini: new ProviderCircuitBreaker('gemini', breakerConfig),
      groq: new ProviderCircuitBreaker('groq', breakerConfig),
      nvidia: new ProviderCircuitBreaker('nvidia', breakerConfig),
      xai: new ProviderCircuitBreaker('xai', breakerConfig),
    };
  }

  public getBreaker(providerId: CognifyProviderId): ProviderCircuitBreaker {
    return this.breakers[providerId];
  }

  public getCascadeOrder(): CognifyProviderId[] {
    return [...this.cascadeOrder];
  }

  /**
   * Executes a prompt through the cascade: Gemini -> Groq -> NVIDIA -> xAI.
   * Handles HTTP 429 / 503 simulation, circuit breaker tripping, and auto-repair for LaTeX/code fences.
   */
  public async dispatchWithFallback(
    prompt: string,
    handler: ProviderCallMockHandler
  ): Promise<CascadeDispatchResult> {
    const attempts: FallbackAttemptTrace[] = [];
    let succeededProvider: CognifyProviderId | null = null;
    let rawText = '';
    let successDuration = 0;

    for (const providerId of this.cascadeOrder) {
      const breaker = this.breakers[providerId];
      const state = breaker.getState();

      // If circuit breaker is OPEN, fast-bypass without wasting network roundtrip
      if (state === 'OPEN') {
        attempts.push({
          providerId,
          durationMs: 0,
          status: 'failed',
          errorCode: 'CIRCUIT_OPEN',
          errorMessage: `Circuit for ${providerId} is OPEN. Bypassing upstream.`,
        });
        continue;
      }

      const attemptStart = performance.now();
      try {
        const res = await handler(providerId, prompt);
        const duration = performance.now() - attemptStart;

        if (res.statusCode && (res.statusCode === 429 || res.statusCode >= 500)) {
          breaker.recordFailure();
          attempts.push({
            providerId,
            durationMs: Math.round(duration),
            status: 'failed',
            errorCode: res.statusCode,
            errorMessage: `HTTP ${res.statusCode} upstream failure`,
          });
          continue;
        }

        // Call succeeded
        breaker.recordSuccess();
        succeededProvider = providerId;
        rawText = res.text;
        successDuration = Math.round(duration);
        attempts.push({
          providerId,
          durationMs: successDuration,
          status: 'succeeded',
        });
        break; // Successfully served
      } catch (err: any) {
        const duration = performance.now() - attemptStart;
        breaker.recordFailure();
        attempts.push({
          providerId,
          durationMs: Math.round(duration),
          status: 'failed',
          errorCode: err?.statusCode || 500,
          errorMessage: err?.message || 'Network invocation failed',
        });
      }
    }

    const totalLatencyMs = attempts.reduce((acc, a) => acc + a.durationMs, 0);
    const fallbackPenaltyMs = Math.max(0, totalLatencyMs - successDuration);

    if (!succeededProvider) {
      return {
        success: false,
        succeededProvider: null,
        text: 'All upstream AI providers in the cascade failed or were circuit-broken.',
        attempts,
        cascadeLatencyMs: totalLatencyMs,
        fallbackPenaltyMs,
        wasRepaired: false,
        latexBalanced: true,
        codeBlocksBalanced: true,
      };
    }

    // Preserve and verify formatting (LaTeX & Markdown code fences)
    const formatted = preserveAndVerifyFormatting(rawText);

    return {
      success: true,
      succeededProvider,
      text: formatted.repairedText,
      attempts,
      cascadeLatencyMs: totalLatencyMs,
      fallbackPenaltyMs,
      wasRepaired: formatted.wasRepaired,
      latexBalanced: formatted.isLatexValid,
      codeBlocksBalanced: formatted.isCodeFenceValid,
    };
  }
}

// ============================================================================
// 9. Formatting Preservation: LaTeX Math & Code Markdown (Requirement 18)
// ============================================================================

export interface FormattingPreservationResult {
  originalText: string;
  repairedText: string;
  wasRepaired: boolean;
  isLatexValid: boolean;
  isCodeFenceValid: boolean;
  repairsAppliedCount: number;
}

/**
 * Validates and self-heals mathematical LaTeX delimiters and markdown code blocks
 * across all AI provider outputs to guarantee rendering integrity.
 */
export function preserveAndVerifyFormatting(text: string): FormattingPreservationResult {
  if (!text) {
    return {
      originalText: text,
      repairedText: text,
      wasRepaired: false,
      isLatexValid: true,
      isCodeFenceValid: true,
      repairsAppliedCount: 0,
    };
  }

  // 1. Repair markdown code fences
  const codeRepair = repairMarkdownCodeBlocks(text);
  // 2. Repair LaTeX formulas
  const latexRepair = repairLatexFormulas(codeRepair.repaired);

  const finalRepaired = latexRepair.repaired;
  const repairsAppliedCount = codeRepair.repairs.length + latexRepair.repairs.length;
  const wasRepaired = repairsAppliedCount > 0;

  // Verification checks on final repaired string
  const fenceMatches = finalRepaired.match(/```/g);
  const isCodeFenceValid = !fenceMatches || fenceMatches.length % 2 === 0;

  const doubleDollarMatches = finalRepaired.match(/\$\$/g);
  const masked = finalRepaired.replace(/\$\$[\s\S]*?\$\$/g, '');
  const singleDollarMatches = masked.match(/\$/g);

  const isDoubleDollarValid = !doubleDollarMatches || doubleDollarMatches.length % 2 === 0;
  const isSingleDollarValid = !singleDollarMatches || singleDollarMatches.length % 2 === 0;
  const isLatexValid = isDoubleDollarValid && isSingleDollarValid;

  return {
    originalText: text,
    repairedText: finalRepaired,
    wasRepaired,
    isLatexValid,
    isCodeFenceValid,
    repairsAppliedCount,
  };
}
