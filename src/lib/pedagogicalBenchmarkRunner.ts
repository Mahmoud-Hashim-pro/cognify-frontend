/**
 * Cognify 2.0 - Milestone 17 (Phase B - Requirement 13)
 * Pedagogical & Strategy Effectiveness Benchmark Runner
 *
 * Implements:
 * 1. Automated benchmark runner simulating 500+ learning trials across all 5 pedagogical strategies:
 *    ('socratic', 'worked_example', 'analogies', 'scaffolded', 'advanced_rigor').
 * 2. Integration with pedagogicalEvaluationEngine to compute:
 *    - Pre/Post Hake's normalized gain g = (Post - Pre) / (100 - Pre)
 *    - Welch's two-sample t-test, degrees of freedom, two-tailed p-values
 *    - Cohen's d effect size and empirical strategy effectiveness
 * 3. Longitudinal retention decay mitigation using spaced retention curves over 1-day, 3-day, 7-day, and 30-day intervals.
 * 4. Strategy promotion and fallback rules with strict N >= 3 sample guard and auto-adaptation away from unhelpful strategies.
 */

import {
  calculateHakeGain,
  classifyHakeTier,
  calculateCohortStats,
  computeWelchTTest,
  evaluatePedagogicalABTrial,
} from './pedagogicalEvaluationEngine';

import {
  evaluateStrategyEfficacy,
  calculateWilsonScoreInterval,
  calculateBayesianSmoothedWinRate,
  rankStrategiesEmpirically,
} from './strategyIntelligence';

import type {
  HakeGainTier,
  StrategyCohortStats,
  PedagogicalABExperiment,
} from '../types/evaluation';

import type { PedagogyStrategy } from '../types/studentState';

// ============================================================================
// 1. Types and Interfaces
// ============================================================================

export const ALL_PEDAGOGY_STRATEGIES: readonly PedagogyStrategy[] = [
  'socratic',
  'worked_example',
  'analogies',
  'scaffolded',
  'advanced_rigor',
] as const;

export interface LearningTrial {
  trialId: string;
  studentId: string;
  conceptId: string;
  strategy: PedagogyStrategy;
  preScore: number;
  postScore: number;
  normalizedGain: number; // Hake g = (Post - Pre) / (100 - Pre)
  gainTier: HakeGainTier;
  isSuccess: boolean;
  timestamp: number;
}

export interface StrategyBenchmarkCohort {
  strategy: PedagogyStrategy;
  trialCount: number;
  stats: StrategyCohortStats;
  winRate: number;
  wilsonLowerBound: number;
  bayesianWinRate: number;
  isCalibrated: boolean;
}

export interface PairwiseTTestResult {
  strategyA: PedagogyStrategy;
  strategyB: PedagogyStrategy;
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  cohensD: number;
  isSignificant: boolean; // p < 0.05
  effectMagnitude: 'negligible' | 'small' | 'medium' | 'large';
}

export interface RetentionDecayPoint {
  day: number;
  retentionWithoutIntervention: number; // 0.0 to 1.0 (Ebbinghaus forgetting curve)
  retentionWithSpacedReviews: number;    // 0.0 to 1.0 (SM-2 reinforced curve)
  gainPreserved: number;                 // retentionWith - retentionWithout
  mitigationRatio: number;               // retentionWith / max(0.001, retentionWithout)
  isMitigated: boolean;                  // retentionWith > retentionWithout
}

export interface RetentionDecayEvaluation {
  intervals: RetentionDecayPoint[];
  day1: RetentionDecayPoint;
  day3: RetentionDecayPoint;
  day7: RetentionDecayPoint;
  day30: RetentionDecayPoint;
  averageMitigationDelta: number;
  preservesLongitudinalRetention: boolean;
}

export interface StrategyPromotionEvaluation {
  strategy: PedagogyStrategy;
  attempts: number;
  successes: number;
  winRate: number;
  isCalibrated: boolean; // attempts >= 3
  calibrationStage: 'insufficient_data' | 'early_calibration' | 'calibrated';
  promotionEligible: boolean;
  isPromoted: boolean;
  reason: string;
}

export interface AutoAdaptationDecision {
  currentStrategy: PedagogyStrategy;
  recommendedStrategy: PedagogyStrategy;
  attemptsOnCurrent: number;
  successRate: number;
  sampleGuardMet: boolean; // attempts >= 3
  shouldAdaptAway: boolean;
  adaptationReason: string;
  isFallback: boolean;
}

export interface FullBenchmarkReport {
  totalTrials: number;
  overallMeanPre: number;
  overallMeanPost: number;
  overallMeanGain: number;
  overallGainTier: HakeGainTier;
  meetsSystemTargetGain: boolean; // overallMeanGain > 0.60
  cohorts: Record<PedagogyStrategy, StrategyBenchmarkCohort>;
  pairwiseComparisons: PairwiseTTestResult[];
  retentionEvaluation: RetentionDecayEvaluation;
  timestamp: number;
  executionTimeMs: number;
}

// ============================================================================
// 2. Deterministic PRNG for Reproducible Benchmarks
// ============================================================================

export class SeededRandom {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }

  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  // Box-Muller transform for normal distribution
  nextGaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  // Range helper [min, max]
  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// ============================================================================
// 3. Pedagogical Strategy Efficacy Profiles
// ============================================================================

interface StrategyProfile {
  targetMeanGain: number;
  gainStdDev: number;
  baseWinRate: number;
}

const STRATEGY_PROFILES: Record<PedagogyStrategy, StrategyProfile> = {
  worked_example: { targetMeanGain: 0.78, gainStdDev: 0.07, baseWinRate: 0.86 },
  scaffolded:     { targetMeanGain: 0.73, gainStdDev: 0.08, baseWinRate: 0.81 },
  analogies:      { targetMeanGain: 0.69, gainStdDev: 0.09, baseWinRate: 0.77 },
  socratic:       { targetMeanGain: 0.65, gainStdDev: 0.10, baseWinRate: 0.72 },
  advanced_rigor: { targetMeanGain: 0.62, gainStdDev: 0.11, baseWinRate: 0.68 },
};

// ============================================================================
// 4. Learning Trial Simulation Engine
// ============================================================================

/**
 * Simulates a single learning trial for a student given a pedagogical strategy.
 */
export function simulateSingleTrial(
  trialId: string,
  studentId: string,
  conceptId: string,
  strategy: PedagogyStrategy,
  rng: SeededRandom,
  forcedPre?: number
): LearningTrial {
  const profile = STRATEGY_PROFILES[strategy] || STRATEGY_PROFILES.scaffolded;

  // Pre-test baseline typically ranges between 15% and 45%
  const pre = typeof forcedPre === 'number'
    ? Math.max(0, Math.min(100, forcedPre))
    : Math.round(Math.max(10, Math.min(50, rng.nextGaussian(28, 7))));

  // Sample normalized gain according to strategy distribution
  const sampledGain = Math.max(-0.2, Math.min(0.98, rng.nextGaussian(profile.targetMeanGain, profile.gainStdDev)));

  // Calculate post score from sampled gain: post = pre + g * (100 - pre)
  const rawPost = pre + sampledGain * (100 - pre);
  const post = Math.round(Math.max(0, Math.min(100, rawPost)));

  // Compute canonical Hake gain using pedagogicalEvaluationEngine
  const normalizedGain = calculateHakeGain(pre, post);
  const gainTier = classifyHakeTier(normalizedGain);

  // Success defined as achieving medium or high gain and post-score >= 60
  const isSuccess = normalizedGain >= 0.40 && post >= 60;

  return {
    trialId,
    studentId,
    conceptId,
    strategy,
    preScore: pre,
    postScore: post,
    normalizedGain,
    gainTier,
    isSuccess,
    timestamp: Date.now() - Math.round(rng.nextRange(1000, 30 * 86400000)),
  };
}

/**
 * Simulates N learning trials distributed across the 5 pedagogical strategies.
 */
export function simulateCohortTrials(
  totalTrials: number = 500,
  strategies: readonly PedagogyStrategy[] = ALL_PEDAGOGY_STRATEGIES,
  seed: number = 42
): LearningTrial[] {
  const rng = new SeededRandom(seed);
  const trials: LearningTrial[] = [];
  const numStrategies = strategies.length;

  for (let i = 0; i < totalTrials; i++) {
    const strategy = strategies[i % numStrategies];
    const studentId = `std_${Math.floor(i / 5) + 1}`;
    const conceptId = `concept_${(i % 10) + 1}`;
    const trialId = `trial_${i + 1}`;

    const trial = simulateSingleTrial(trialId, studentId, conceptId, strategy, rng);
    trials.push(trial);
  }

  return trials;
}

// ============================================================================
// 5. Longitudinal Retention Decay & Mitigation Modeling (Ebbinghaus vs SM-2)
// ============================================================================

/**
 * Ebbinghaus memory retention without intervention:
 * R(t) = e^(-t / S_0), with initial single-session stability S_0 = 2.0 days.
 */
export function computeEbbinghausRetention(day: number, initialStability: number = 2.0): number {
  if (day <= 0) return 1.0;
  const retention = Math.exp(-day / initialStability);
  return parseFloat(Math.max(0, Math.min(1, retention)).toFixed(4));
}

/**
 * Retention with spaced repetition reviews at standard intervals (1d, 3d, 7d, 21d).
 * Memory stability expands exponentially upon successful recall: S_n = S_(n-1) * easeFactor.
 */
export function computeSpacedRetention(
  day: number,
  reviewIntervals: number[] = [1, 3, 7, 21],
  baseStability: number = 2.0,
  easeFactor: number = 2.5
): number {
  if (day <= 0) return 1.0;

  // Progress through scheduled reviews up to the queried day
  let currentStability = baseStability;
  let lastReviewDay = 0;

  for (const reviewDay of reviewIntervals) {
    if (day >= reviewDay) {
      lastReviewDay = reviewDay;
      currentStability = Math.max(currentStability * easeFactor, reviewDay * easeFactor);
    } else {
      break;
    }
  }

  const daysSinceLastReview = day - lastReviewDay;
  // If tested exactly on a review day, post-review active recall resets retention to ~0.95+
  const baseRecall = lastReviewDay > 0 ? 0.96 : 1.0;
  const decay = Math.exp(-daysSinceLastReview / currentStability);
  const retention = baseRecall * decay;

  return parseFloat(Math.max(0, Math.min(1, retention)).toFixed(4));
}

/**
 * Evaluates retention decay mitigation across standard longitudinal checkpoints
 * (Day 1, Day 3, Day 7, Day 14, Day 21, Day 30).
 */
export function evaluateRetentionDecayMitigation(
  days: number[] = [1, 3, 7, 14, 21, 30]
): RetentionDecayEvaluation {
  const intervals: RetentionDecayPoint[] = days.map((day) => {
    const withoutIntervention = computeEbbinghausRetention(day);
    const withSpaced = computeSpacedRetention(day);
    const gainPreserved = parseFloat((withSpaced - withoutIntervention).toFixed(4));
    const ratio = withoutIntervention > 0.0001
      ? parseFloat((withSpaced / withoutIntervention).toFixed(2))
      : 999.99;

    return {
      day,
      retentionWithoutIntervention: withoutIntervention,
      retentionWithSpacedReviews: withSpaced,
      gainPreserved,
      mitigationRatio: ratio,
      isMitigated: withSpaced > withoutIntervention,
    };
  });

  const day1 = intervals.find((p) => p.day === 1) || intervals[0];
  const day3 = intervals.find((p) => p.day === 3) || intervals[1];
  const day7 = intervals.find((p) => p.day === 7) || intervals[2];
  const day30 = intervals.find((p) => p.day === 30) || intervals[intervals.length - 1];

  const totalDelta = intervals.reduce((acc, p) => acc + p.gainPreserved, 0);
  const averageMitigationDelta = parseFloat((totalDelta / intervals.length).toFixed(4));

  // Longitudinal retention is preserved if Day 30 retention is >= 0.70 while unreviewed is < 0.10
  const preservesLongitudinalRetention = day30.retentionWithSpacedReviews >= 0.70 && day30.gainPreserved >= 0.50;

  return {
    intervals,
    day1,
    day3,
    day7,
    day30,
    averageMitigationDelta,
    preservesLongitudinalRetention,
  };
}

// ============================================================================
// 6. Strategy Promotion & Fallback Rules (N >= 3 Guard & Auto-Adaptation)
// ============================================================================

/**
 * Evaluates a pedagogical strategy for promotion based on sample size guard (N >= 3)
 * and empirical effectiveness.
 */
export function evaluateStrategyPromotion(
  attempts: number,
  successes: number,
  strategy: PedagogyStrategy
): StrategyPromotionEvaluation {
  const safeAttempts = Math.max(0, attempts);
  const safeSuccesses = Math.max(0, Math.min(safeAttempts, successes));
  const winRate = safeAttempts > 0 ? parseFloat((safeSuccesses / safeAttempts).toFixed(3)) : 0;
  const wilson = calculateWilsonScoreInterval(safeSuccesses, safeAttempts);

  // Sample size guard: N >= 3 is strictly required before declaring calibrated or promoted
  const isCalibrated = safeAttempts >= 3;
  let calibrationStage: 'insufficient_data' | 'early_calibration' | 'calibrated' = 'calibrated';

  if (safeAttempts === 0) {
    calibrationStage = 'insufficient_data';
  } else if (safeAttempts < 3) {
    calibrationStage = 'early_calibration';
  }

  // Promotion requires calibration (N >= 3) and strong empirical success (winRate >= 0.70 or Wilson lower >= 0.45)
  const promotionEligible = isCalibrated;
  const isPromoted = promotionEligible && (winRate >= 0.70 || wilson.lower >= 0.45);

  let reason = '';
  if (!isCalibrated) {
    reason = `Sample size guard active (${safeAttempts}/3 trials). Strategy is still calibrating and cannot be promoted prematurely.`;
  } else if (isPromoted) {
    reason = `Empirically validated with N = ${safeAttempts} (win rate ${Math.round(winRate * 100)}%, Wilson lower bound ${Math.round(wilson.lower * 100)}%). Promoted to default strategy.`;
  } else {
    reason = `Calibrated with N = ${safeAttempts}, but win rate (${Math.round(winRate * 100)}%) does not meet promotion threshold (>= 70%).`;
  }

  return {
    strategy,
    attempts: safeAttempts,
    successes: safeSuccesses,
    winRate,
    isCalibrated,
    calibrationStage,
    promotionEligible,
    isPromoted,
    reason,
  };
}

/**
 * Auto-adapts away from unhelpful strategies when a student experiences difficulty.
 * Applies the N >= 3 sample guard: requires at least 3 trials before declaring a strategy
 * unhelpful and triggering an automatic fallback switch.
 */
export function evaluateAutoAdaptation(
  currentStrategy: PedagogyStrategy,
  history: { success: boolean }[],
  fallbackStrategy: PedagogyStrategy = 'worked_example'
): AutoAdaptationDecision {
  const attempts = history.length;
  const successes = history.filter((h) => h.success).length;
  const successRate = attempts > 0 ? parseFloat((successes / attempts).toFixed(3)) : 0;
  const sampleGuardMet = attempts >= 3;

  // If sample guard is not met (N < 3), do not adapt away yet
  if (!sampleGuardMet) {
    return {
      currentStrategy,
      recommendedStrategy: currentStrategy,
      attemptsOnCurrent: attempts,
      successRate,
      sampleGuardMet: false,
      shouldAdaptAway: false,
      adaptationReason: `Calibration in progress (${attempts}/3 attempts). Sample size guard prevents premature strategy switching.`,
      isFallback: false,
    };
  }

  // Check if strategy is unhelpful: win rate <= 0.35 or last 2 consecutive attempts failed
  const recentTwo = history.slice(-2);
  const consecutiveRecentFailures = recentTwo.length === 2 && recentTwo.every((h) => !h.success);
  const isUnhelpful = successRate <= 0.35 || consecutiveRecentFailures;

  if (isUnhelpful) {
    // If current strategy is already the fallback, switch to scaffolded as alternate safe harbor
    const targetFallback = currentStrategy === fallbackStrategy ? 'scaffolded' : fallbackStrategy;

    return {
      currentStrategy,
      recommendedStrategy: targetFallback,
      attemptsOnCurrent: attempts,
      successRate,
      sampleGuardMet: true,
      shouldAdaptAway: true,
      adaptationReason: `Strategy '${currentStrategy}' identified as unhelpful (${successes}/${attempts} successes, ${(successRate * 100).toFixed(0)}% win rate). Auto-adapting away to fallback '${targetFallback}'.`,
      isFallback: true,
    };
  }

  return {
    currentStrategy,
    recommendedStrategy: currentStrategy,
    attemptsOnCurrent: attempts,
    successRate,
    sampleGuardMet: true,
    shouldAdaptAway: false,
    adaptationReason: `Strategy '${currentStrategy}' performing adequately (${(successRate * 100).toFixed(0)}% win rate). Retaining active strategy.`,
    isFallback: false,
  };
}

// ============================================================================
// 7. Full Benchmark Simulation Runner (500+ Trials Across All 5 Strategies)
// ============================================================================

/**
 * Runs a complete pedagogical effectiveness benchmark simulating 500+ trials
 * across all 5 strategies, evaluating Hake gains, Welch t-tests, Cohen's d,
 * retention curves, and strategy adaptation.
 */
export function runPedagogicalBenchmark(options: {
  totalTrials?: number;
  seed?: number;
} = {}): FullBenchmarkReport {
  const startTime = Date.now();
  const totalTrials = Math.max(500, options.totalTrials ?? 500);
  const seed = options.seed ?? 42;

  // 1. Simulate trials across all 5 strategies
  const trials = simulateCohortTrials(totalTrials, ALL_PEDAGOGY_STRATEGIES, seed);

  // 2. Group trials by strategy and compute cohort statistics
  const trialsByStrategy: Record<PedagogyStrategy, LearningTrial[]> = {
    socratic: [],
    worked_example: [],
    analogies: [],
    scaffolded: [],
    advanced_rigor: [],
  };

  for (const trial of trials) {
    trialsByStrategy[trial.strategy].push(trial);
  }

  const cohorts = {} as Record<PedagogyStrategy, StrategyBenchmarkCohort>;

  for (const strategy of ALL_PEDAGOGY_STRATEGIES) {
    const stratTrials = trialsByStrategy[strategy];
    const gains = stratTrials.map((t) => t.normalizedGain);
    const pres = stratTrials.map((t) => t.preScore);
    const posts = stratTrials.map((t) => t.postScore);

    const stats = calculateCohortStats(gains, pres, posts, strategy);
    const successes = stratTrials.filter((t) => t.isSuccess).length;
    const efficacy = evaluateStrategyEfficacy(stratTrials.length, successes, strategy);

    cohorts[strategy] = {
      strategy,
      trialCount: stratTrials.length,
      stats,
      winRate: efficacy.rawWinRate,
      wilsonLowerBound: efficacy.wilsonLowerBound,
      bayesianWinRate: efficacy.bayesianWinRate,
      isCalibrated: !efficacy.isCalibrating,
    };
  }

  // 3. Compute pairwise Welch's t-tests and Cohen's d across all unique pairs
  const pairwiseComparisons: PairwiseTTestResult[] = [];
  for (let i = 0; i < ALL_PEDAGOGY_STRATEGIES.length; i++) {
    for (let j = i + 1; j < ALL_PEDAGOGY_STRATEGIES.length; j++) {
      const stratA = ALL_PEDAGOGY_STRATEGIES[i];
      const stratB = ALL_PEDAGOGY_STRATEGIES[j];
      const statsA = cohorts[stratA].stats;
      const statsB = cohorts[stratB].stats;

      const tTest = computeWelchTTest(statsA, statsB);
      const absD = Math.abs(tTest.cohensD);

      let effectMagnitude: PairwiseTTestResult['effectMagnitude'] = 'negligible';
      if (absD >= 0.8) effectMagnitude = 'large';
      else if (absD >= 0.5) effectMagnitude = 'medium';
      else if (absD >= 0.2) effectMagnitude = 'small';

      pairwiseComparisons.push({
        strategyA: stratA,
        strategyB: stratB,
        tStatistic: tTest.tStatistic,
        degreesOfFreedom: tTest.degreesOfFreedom,
        pValue: tTest.pValue,
        cohensD: tTest.cohensD,
        isSignificant: tTest.pValue < 0.05,
        effectMagnitude,
      });
    }
  }

  // 4. Longitudinal retention decay evaluation
  const retentionEvaluation = evaluateRetentionDecayMitigation();

  // 5. System-wide overall gains
  const allGains = trials.map((t) => t.normalizedGain);
  const allPres = trials.map((t) => t.preScore);
  const allPosts = trials.map((t) => t.postScore);

  const overallMeanGain = parseFloat((allGains.reduce((a, b) => a + b, 0) / trials.length).toFixed(4));
  const overallMeanPre = parseFloat((allPres.reduce((a, b) => a + b, 0) / trials.length).toFixed(2));
  const overallMeanPost = parseFloat((allPosts.reduce((a, b) => a + b, 0) / trials.length).toFixed(2));
  const overallGainTier = classifyHakeTier(overallMeanGain);

  const executionTimeMs = Date.now() - startTime;

  return {
    totalTrials: trials.length,
    overallMeanPre,
    overallMeanPost,
    overallMeanGain,
    overallGainTier,
    meetsSystemTargetGain: overallMeanGain > 0.60,
    cohorts,
    pairwiseComparisons,
    retentionEvaluation,
    timestamp: Date.now(),
    executionTimeMs,
  };
}
