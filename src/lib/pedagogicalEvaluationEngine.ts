/**
 * Milestone 17: Automated Pedagogical Evaluation Engine
 * Longitudinal Hake Normalized Gain ($g$), Randomized Strategy A/B Trials,
 * Welch's two-sample t-test, Cohen's d Effect Size, and Pedagogical Promotion Recommendations.
 */

import type {
  HakeGainTier,
  LongitudinalStudentGain,
  LongitudinalTrajectoryWindow,
  StrategyCohortStats,
  PedagogicalABExperiment
} from '../types/evaluation';
import type { PedagogyStrategy } from '../types/studentState';

// ============================================================================
// 1. Core Hake Normalized Gain Formula
// ============================================================================

/**
 * Calculates Hake's normalized learning gain:
 * g = (Post - Pre) / (100 - Pre)
 *
 * Boundary handling:
 * - Pre >= 100: returns 1.0 if Post >= 100, else 0.0
 * - Post < Pre: returns negative gain (learning regression)
 * - Result is strictly bounded to [-1.0, 1.0]
 */
export function calculateHakeGain(preScore: number, postScore: number): number {
  const pre = Math.max(0, Math.min(100, preScore));
  const post = Math.max(0, Math.min(100, postScore));

  if (pre >= 100) {
    return post >= 100 ? 1.0 : 0.0;
  }

  const denominator = 100 - pre;
  if (denominator === 0) {
    return post >= 100 ? 1.0 : 0.0;
  }

  const rawGain = (post - pre) / denominator;
  const bounded = Math.max(-1.0, Math.min(1.0, rawGain));
  return parseFloat(bounded.toFixed(4));
}

/**
 * Categorizes normalized gain into Hake's canonical tiers:
 * High: g >= 0.7
 * Medium: 0.3 <= g < 0.7
 * Low: 0.0 <= g < 0.3
 * Regression: g < 0.0
 */
export function classifyHakeTier(g: number): HakeGainTier {
  if (g < 0) return 'regression';
  if (g >= 0.7) return 'high';
  if (g >= 0.3) return 'medium';
  return 'low';
}

// ============================================================================
// 2. Statistical Functions (Welch's t-test, Cohen's d, p-value)
// ============================================================================

/**
 * Standard Error Function approximation (erf) using Abramowitz and Stegun formula 7.1.26
 * Maximum error < 1.5e-7
 */
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

/**
 * Normal Cumulative Distribution Function Phi(z)
 */
export function normalCDF(z: number): number {
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

/**
 * Calculates mean, variance, and standard deviation for a cohort
 */
export function calculateCohortStats(
  gains: number[],
  preScores: number[],
  postScores: number[],
  strategy: PedagogyStrategy
): StrategyCohortStats {
  const n = gains.length;
  if (n === 0) {
    return {
      strategy,
      sampleSize: 0,
      meanPre: 0,
      meanPost: 0,
      meanGain: 0,
      varianceGain: 0,
      standardDeviationGain: 0
    };
  }

  const sumPre = preScores.reduce((acc, v) => acc + v, 0);
  const sumPost = postScores.reduce((acc, v) => acc + v, 0);
  const sumGain = gains.reduce((acc, v) => acc + v, 0);

  const meanPre = sumPre / n;
  const meanPost = sumPost / n;
  const meanGain = sumGain / n;

  if (n === 1) {
    return {
      strategy,
      sampleSize: 1,
      meanPre: parseFloat(meanPre.toFixed(2)),
      meanPost: parseFloat(meanPost.toFixed(2)),
      meanGain: parseFloat(meanGain.toFixed(4)),
      varianceGain: 0,
      standardDeviationGain: 0
    };
  }

  const sumSqDiff = gains.reduce((acc, v) => acc + Math.pow(v - meanGain, 2), 0);
  const varianceGain = sumSqDiff / (n - 1);
  const standardDeviationGain = Math.sqrt(varianceGain);

  return {
    strategy,
    sampleSize: n,
    meanPre: parseFloat(meanPre.toFixed(2)),
    meanPost: parseFloat(meanPost.toFixed(2)),
    meanGain: parseFloat(meanGain.toFixed(4)),
    varianceGain: parseFloat(varianceGain.toFixed(6)),
    standardDeviationGain: parseFloat(standardDeviationGain.toFixed(4))
  };
}

/**
 * Computes Welch's Two-Sample t-test and Cohen's d effect size
 */
export function computeWelchTTest(statsA: StrategyCohortStats, statsB: StrategyCohortStats): {
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  cohensD: number;
} {
  const nA = statsA.sampleSize;
  const nB = statsB.sampleSize;

  if (nA < 2 || nB < 2) {
    return { tStatistic: 0, degreesOfFreedom: 1, pValue: 1.0, cohensD: 0 };
  }

  const vA = statsA.varianceGain;
  const vB = statsB.varianceGain;
  const mA = statsA.meanGain;
  const mB = statsB.meanGain;

  const seA = vA / nA;
  const seB = vB / nB;
  const standardErrorDiff = Math.sqrt(seA + seB);

  if (standardErrorDiff === 0) {
    return { tStatistic: 0, degreesOfFreedom: nA + nB - 2, pValue: 1.0, cohensD: 0 };
  }

  const t = (mB - mA) / standardErrorDiff;

  // Welch-Satterthwaite equation for degrees of freedom
  const numDf = Math.pow(seA + seB, 2);
  const denDf = (Math.pow(seA, 2) / (nA - 1)) + (Math.pow(seB, 2) / (nB - 1));
  const df = denDf > 0 ? numDf / denDf : nA + nB - 2;

  // Two-tailed p-value via normal CDF approximation
  const pValue = 2.0 * (1.0 - normalCDF(Math.abs(t)));

  // Cohen's d with pooled standard deviation
  const pooledVar = (((nA - 1) * vA) + ((nB - 1) * vB)) / (nA + nB - 2);
  const pooledSd = Math.sqrt(Math.max(0.000001, pooledVar));
  const cohensD = (mB - mA) / pooledSd;

  return {
    tStatistic: parseFloat(t.toFixed(4)),
    degreesOfFreedom: parseFloat(df.toFixed(2)),
    pValue: parseFloat(Math.max(0.0001, Math.min(1.0, pValue)).toFixed(4)),
    cohensD: parseFloat(cohensD.toFixed(3))
  };
}

// ============================================================================
// 3. Pedagogical A/B Trial Evaluation & Promotion
// ============================================================================

export function evaluatePedagogicalABTrial(
  experimentId: string,
  conceptId: string,
  conceptTitle: string,
  strategyA: PedagogyStrategy,
  recordsA: Array<{ pre: number; post: number }>,
  strategyB: PedagogyStrategy,
  recordsB: Array<{ pre: number; post: number }>,
  minSampleSize = 5
): PedagogicalABExperiment {
  const gainsA = recordsA.map(r => calculateHakeGain(r.pre, r.post));
  const preA = recordsA.map(r => r.pre);
  const postA = recordsA.map(r => r.post);
  const statsA = calculateCohortStats(gainsA, preA, postA, strategyA);

  const gainsB = recordsB.map(r => calculateHakeGain(r.pre, r.post));
  const preB = recordsB.map(r => r.pre);
  const postB = recordsB.map(r => r.post);
  const statsB = calculateCohortStats(gainsB, preB, postB, strategyB);

  const tTest = computeWelchTTest(statsA, statsB);
  const hasSufficientData = statsA.sampleSize >= minSampleSize && statsB.sampleSize >= minSampleSize;
  const isSignificant = hasSufficientData && tTest.pValue < 0.05;

  let winner: PedagogyStrategy | 'inconclusive' = 'inconclusive';
  let promotionRecommendation: PedagogicalABExperiment['promotionRecommendation'];

  if (isSignificant) {
    if (statsB.meanGain > statsA.meanGain) {
      winner = strategyB;
      promotionRecommendation = {
        recommendedStrategy: strategyB,
        confidence: parseFloat((1.0 - tTest.pValue).toFixed(3)),
        rationaleEn: `Strategy '${strategyB}' produced a statistically significant higher learning gain (g = ${statsB.meanGain.toFixed(2)} vs ${statsA.meanGain.toFixed(2)}, p = ${tTest.pValue}, Cohen's d = ${tTest.cohensD}). Recommend promoting to default for '${conceptTitle}'.`,
        rationaleAr: `حققت استراتيجية '${strategyB}' مكاسب تعلم أعلى ذات دلالة إحصائية (g = ${statsB.meanGain.toFixed(2)} مقابل ${statsA.meanGain.toFixed(2)}، p = ${tTest.pValue}). نوصي بترقيتها كافتراضية لمفهوم '${conceptTitle}'.`
      };
    } else if (statsA.meanGain > statsB.meanGain) {
      winner = strategyA;
      promotionRecommendation = {
        recommendedStrategy: strategyA,
        confidence: parseFloat((1.0 - tTest.pValue).toFixed(3)),
        rationaleEn: `Strategy '${strategyA}' maintained superior performance over '${strategyB}' (g = ${statsA.meanGain.toFixed(2)} vs ${statsB.meanGain.toFixed(2)}, p = ${tTest.pValue}).`,
        rationaleAr: `حافظت استراتيجية '${strategyA}' على أداء متفوق على '${strategyB}' (g = ${statsA.meanGain.toFixed(2)} مقابل ${statsB.meanGain.toFixed(2)}).`
      };
    }
  }

  return {
    experimentId,
    conceptId,
    conceptTitle,
    strategyA,
    strategyB,
    startDate: Date.now() - (7 * 86400000),
    status: hasSufficientData ? (isSignificant ? 'concluded' : 'active') : 'insufficient_data',
    statsA,
    statsB,
    tStatistic: tTest.tStatistic,
    degreesOfFreedom: tTest.degreesOfFreedom,
    pValue: tTest.pValue,
    cohensD: tTest.cohensD,
    isStatisticallySignificant: isSignificant,
    winner,
    promotionRecommendation
  };
}

// ============================================================================
// 4. Longitudinal Trajectory Windows
// ============================================================================

export function aggregateLongitudinalWindows(
  records: LongitudinalStudentGain[]
): LongitudinalTrajectoryWindow[] {
  const now = Date.now();
  const oneWeekAgo = now - (7 * 86400000);
  const oneMonthAgo = now - (30 * 86400000);
  const oneSemesterAgo = now - (120 * 86400000);

  function computeWindow(window: 'weekly' | 'monthly' | 'semester', startTime: number): LongitudinalTrajectoryWindow {
    const windowRecords = records.filter(r => r.timestamp >= startTime);
    if (windowRecords.length === 0) {
      return {
        window,
        sampleCount: 0,
        averagePreScore: 0,
        averagePostScore: 0,
        averageGain: 0,
        gainTier: 'low',
        topPerformingStrategy: 'worked_example'
      };
    }

    const sumPre = windowRecords.reduce((acc, r) => acc + r.preScore, 0);
    const sumPost = windowRecords.reduce((acc, r) => acc + r.postScore, 0);
    const sumGain = windowRecords.reduce((acc, r) => acc + r.normalizedGain, 0);

    const avgPre = sumPre / windowRecords.length;
    const avgPost = sumPost / windowRecords.length;
    const avgGain = sumGain / windowRecords.length;

    // Strategy tally
    const stratCounts: Record<string, { totalGain: number; count: number }> = {};
    for (const r of windowRecords) {
      if (!stratCounts[r.strategyUsed]) stratCounts[r.strategyUsed] = { totalGain: 0, count: 0 };
      stratCounts[r.strategyUsed].totalGain += r.normalizedGain;
      stratCounts[r.strategyUsed].count++;
    }

    let topStrat: PedagogyStrategy = 'worked_example';
    let maxAvgGain = -Infinity;
    for (const [strat, data] of Object.entries(stratCounts)) {
      const avg = data.totalGain / data.count;
      if (avg > maxAvgGain) {
        maxAvgGain = avg;
        topStrat = strat as PedagogyStrategy;
      }
    }

    return {
      window,
      sampleCount: windowRecords.length,
      averagePreScore: parseFloat(avgPre.toFixed(1)),
      averagePostScore: parseFloat(avgPost.toFixed(1)),
      averageGain: parseFloat(avgGain.toFixed(4)),
      gainTier: classifyHakeTier(avgGain),
      topPerformingStrategy: topStrat
    };
  }

  return [
    computeWindow('weekly', oneWeekAgo),
    computeWindow('monthly', oneMonthAgo),
    computeWindow('semester', oneSemesterAgo)
  ];
}
