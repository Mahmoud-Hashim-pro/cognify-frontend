/**
 * Cognify 2.0 - Milestone 7: Learning Strategy Intelligence
 *
 * Provides empirical tracking, statistical calibration, and actionable ranking
 * of pedagogical strategies per learner, concept, and instructional context.
 *
 * Core Principles:
 * 1. Strict Sample Size Tracking: Raw attempts (N), successes (S), and win rates.
 * 2. Statistical Calibration Guard: Requires N >= 3 before declaring a strategy calibrated.
 *    Uses Wilson score lower bound and Bayesian smoothing to prevent small-sample bias.
 * 3. Anti-Overclaiming Principle:
 *    Clearly models situational instructional efficacy per concept/task.
 *    Explicitly avoids labeling students with static, debunked "learning styles"
 *    (e.g., the visual/auditory neuromyth).
 */

import type { PedagogyStrategy, StudentState, StrategyOutcomeMetrics } from '../types/studentState.js';

export type CalibrationStage = 'insufficient_data' | 'early_calibration' | 'calibrated';

export interface WilsonScoreResult {
  lower: number;
  upper: number;
  center: number;
}

export interface StrategyIntelligenceRecord {
  strategy: PedagogyStrategy;
  nameEn: string;
  nameAr: string;
  attempts: number;
  successes: number;
  rawWinRate: number;            // 0.0 to 1.0 (S / N)
  wilsonLowerBound: number;      // 95% confidence lower bound
  bayesianWinRate: number;       // Laplace / Beta(1,1) smoothed win-rate
  confidenceScore: number;       // 0.0 to 1.0 statistical confidence in efficacy
  isCalibrating: boolean;        // true if attempts < 3
  calibrationStage: CalibrationStage;
  sampleSizeNoteEn: string;
  sampleSizeNoteAr: string;
  situationalInsightEn: string;
  situationalInsightAr: string;
}

export interface StrategyRecommendation {
  recommendedStrategy: PedagogyStrategy;
  fallbackStrategy?: PedagogyStrategy;
  confidenceScore: number;
  isCalibrated: boolean;
  rationaleEn: string;
  rationaleAr: string;
  evidenceSummary: {
    attempts: number;
    successes: number;
    winRate: number;
  };
}

/**
 * Anti-Overclaiming Principle Disclaimers:
 * Cognify adheres strictly to cognitive psychology evidence:
 * instructional modalities are task-situated strategies, NOT immutable student traits.
 */
export const ANTI_OVERCLAIMING_DISCLAIMER_EN =
  'Instructional strategy efficacy is empirical and situational, reflecting observed success on specific problem types and concepts. Cognify rejects static "learning style" labels (e.g., visual vs auditory learner myth): optimal pedagogical scaffolding is dynamic and evolves as student mastery deepens.';

export const ANTI_OVERCLAIMING_DISCLAIMER_AR =
  'فاعلية الاستراتيجيات التعليمية هي نتائج تجريبية وسياقية مرتبطة بطبيعة المفهوم والمسألة المطروحة، وتعكس الأداء الملاحظ في مهام محددة. يرفض كوجنيفاي تصنيفات "أنماط التعلم الثابتة": الاستراتيجية التعليمية المثلى متغيرة وتتكيف باستمرار مع تطور استيعاب الطالب.';

export const STRATEGY_DISPLAY_NAMES: Record<
  PedagogyStrategy,
  { nameEn: string; nameAr: string; descEn: string; descAr: string }
> = {
  worked_example: {
    nameEn: 'Worked Examples',
    nameAr: 'المسائل النموذجية المحلولة',
    descEn: 'Step-by-step code demonstrations before abstract practice.',
    descAr: 'تطبيق برمجي عملي موضح خطوة بخطوة قبل التدريب المستقل.',
  },
  analogies: {
    nameEn: 'Conceptual Analogies',
    nameAr: 'التشبيهات الواقعية',
    descEn: 'Physical real-world metaphors bridging complex mechanisms.',
    descAr: 'تقريب المفاهيم المجردة بأمثلة ملموسة من الحياة اليومية.',
  },
  scaffolded: {
    nameEn: 'Step-by-Step Scaffolding',
    nameAr: 'التفكيك التدريجي المنظم',
    descEn: 'Decomposing complex problems into smaller guided milestones.',
    descAr: 'تقسيم المشكلات المركبة إلى مراحل تدريجية موجهة.',
  },
  socratic: {
    nameEn: 'Socratic Inquiry',
    nameAr: 'الحوار الاستنتاجي السقراطي',
    descEn: 'Guiding self-discovery through targeted micro-questions.',
    descAr: 'تحفيز الاستنتاج الذاتي عبر أسئلة توجيهية ذكية.',
  },
  advanced_rigor: {
    nameEn: 'Formal & Technical Rigor',
    nameAr: 'العمق التقني والأكاديمي',
    descEn: 'Algorithmic proof, low-level architecture, and formal mechanics.',
    descAr: 'تحليل خوارزمي دقيق والتعمق في بنية المعمارية الرياضية.',
  },
};

/**
 * Calculates the Wilson Score Interval Lower Bound.
 * Provides a conservative, statistically grounded estimate of win-rate
 * that penalizes small sample sizes without arbitrary heuristic hacks.
 *
 * @param successes Number of successful outcomes (S)
 * @param attempts Total attempts (N)
 * @param z Confidence z-score (defaults to 1.96 for 95% confidence)
 */
export function calculateWilsonScoreInterval(
  successes: number,
  attempts: number,
  z: number = 1.96
): WilsonScoreResult {
  if (attempts <= 0) {
    return { lower: 0, upper: 0, center: 0 };
  }

  const p = Math.max(0, Math.min(1, successes / attempts));
  const z2 = z * z;
  const denominator = 1 + z2 / attempts;
  const center = (p + z2 / (2 * attempts)) / denominator;
  const radical = (p * (1 - p)) / attempts + z2 / (4 * attempts * attempts);
  const margin = (z * Math.sqrt(Math.max(0, radical))) / denominator;

  const lower = Math.max(0, Math.round((center - margin) * 1000) / 1000);
  const upper = Math.min(1, Math.round((center + margin) * 1000) / 1000);

  return {
    lower,
    upper,
    center: Math.round(center * 1000) / 1000,
  };
}

/**
 * Calculates Bayesian smoothed win-rate using Beta(alpha=1, beta=1) Laplace prior.
 * Smooths extreme 0% or 100% outcomes for tiny sample sizes.
 */
export function calculateBayesianSmoothedWinRate(
  successes: number,
  attempts: number,
  alpha: number = 1,
  beta: number = 1
): number {
  if (attempts <= 0) return 0.5;
  const smoothed = (successes + alpha) / (attempts + alpha + beta);
  return Math.round(smoothed * 1000) / 1000;
}

/**
 * Evaluates strategy efficacy with sample-size guard (N >= 3).
 */
export function evaluateStrategyEfficacy(
  attempts: number,
  successes: number,
  strategy: PedagogyStrategy
): StrategyIntelligenceRecord {
  const safeAttempts = Math.max(0, attempts);
  const safeSuccesses = Math.max(0, Math.min(safeAttempts, successes));
  const rawWinRate = safeAttempts > 0 ? safeSuccesses / safeAttempts : 0;
  const wilson = calculateWilsonScoreInterval(safeSuccesses, safeAttempts);
  const bayesianWinRate = calculateBayesianSmoothedWinRate(safeSuccesses, safeAttempts);

  // Sample size guard: N >= 3
  const isCalibrating = safeAttempts < 3;
  let calibrationStage: CalibrationStage = 'calibrated';
  if (safeAttempts === 0) {
    calibrationStage = 'insufficient_data';
  } else if (safeAttempts < 3) {
    calibrationStage = 'early_calibration';
  }

  // Statistical confidence score: Combines sample depth and interval certainty
  // Bounds between 0.1 (zero observations) and 1.0 (deeply validated)
  const sampleConfidence = Math.min(1.0, safeAttempts / 6);
  const intervalWidth = wilson.upper - wilson.lower;
  const certainty = safeAttempts > 0 ? Math.max(0, 1 - intervalWidth) : 0;
  const confidenceScore = Math.round(Math.min(1.0, (sampleConfidence * 0.6 + certainty * 0.4)) * 100) / 100;

  const meta = STRATEGY_DISPLAY_NAMES[strategy] || {
    nameEn: strategy,
    nameAr: strategy,
    descEn: '',
    descAr: '',
  };

  const sampleSizeNoteEn = isCalibrating
    ? `Calibrating (${safeAttempts}/3 observed exercises completed)`
    : `Empirically validated on ${safeAttempts} exercises (${safeSuccesses} successful)`;

  const sampleSizeNoteAr = isCalibrating
    ? `جاري المعايرة (${safeAttempts}/3 تمارين مكتملة)`
    : `تم التحقق تجريبيًا من ${safeAttempts} تمارين (${safeSuccesses} ناجحة)`;

  const situationalInsightEn = isCalibrating
    ? `Preliminary signal for ${meta.nameEn}. More exercises needed before drawing high-confidence conclusions.`
    : `Observed ${Math.round(rawWinRate * 100)}% task success rate with ${meta.nameEn} (Wilson lower bound: ${Math.round(wilson.lower * 100)}%).`;

  const situationalInsightAr = isCalibrating
    ? `مؤشر أولي لأسلوب ${meta.nameAr}. يلزم إتمام تمارين إضافية للوصول لمعايرة مؤكدة.`
    : `نسبة نجاح ملاحظة بلغت ${Math.round(rawWinRate * 100)}% باستخدام ${meta.nameAr} (الحد الأدنى لـ ويلسون: ${Math.round(wilson.lower * 100)}%).`;

  return {
    strategy,
    nameEn: meta.nameEn,
    nameAr: meta.nameAr,
    attempts: safeAttempts,
    successes: safeSuccesses,
    rawWinRate: Math.round(rawWinRate * 100) / 100,
    wilsonLowerBound: wilson.lower,
    bayesianWinRate,
    confidenceScore,
    isCalibrating,
    calibrationStage,
    sampleSizeNoteEn,
    sampleSizeNoteAr,
    situationalInsightEn,
    situationalInsightAr,
  };
}

/**
 * Evaluates and ranks all pedagogical strategies from StudentState.
 * Prioritizes calibrated strategies (N >= 3) by Wilson lower bound,
 * falling back to Bayesian win-rate for early-calibration states.
 */
export function rankStrategiesEmpirically(
  strategyMap: Partial<Record<PedagogyStrategy, { attempts: number; successes: number }>> = {}
): StrategyIntelligenceRecord[] {
  const allStrategies: PedagogyStrategy[] = [
    'worked_example',
    'analogies',
    'scaffolded',
    'socratic',
    'advanced_rigor',
  ];

  const records = allStrategies.map((strat) => {
    const data = strategyMap[strat] || { attempts: 0, successes: 0 };
    return evaluateStrategyEfficacy(data.attempts, data.successes, strat);
  });

  // Ranking logic:
  // 1. Fully calibrated strategies (N >= 3) come first, sorted by Wilson lower bound descending
  // 2. Calibrating strategies (N < 3) follow, sorted by Bayesian win-rate descending, then attempts descending
  records.sort((a, b) => {
    if (!a.isCalibrating && b.isCalibrating) return -1;
    if (a.isCalibrating && !b.isCalibrating) return 1;

    if (!a.isCalibrating && !b.isCalibrating) {
      if (b.wilsonLowerBound !== a.wilsonLowerBound) {
        return b.wilsonLowerBound - a.wilsonLowerBound;
      }
      return b.rawWinRate - a.rawWinRate;
    }

    // Both are calibrating
    if (b.bayesianWinRate !== a.bayesianWinRate) {
      return b.bayesianWinRate - a.bayesianWinRate;
    }
    return b.attempts - a.attempts;
  });

  return records;
}

/**
 * Recommends an empirical pedagogical strategy for a given concept context.
 * Takes into account:
 * 1. Concept-specific strategy history (if student previously succeeded on this concept)
 * 2. Global student strategy intelligence
 * 3. Fallback safe default ('scaffolded')
 */
export function getRecommendedStrategyForContext(
  conceptId: string,
  state: StudentState
): StrategyRecommendation {
  const cleanConcept = conceptId.toLowerCase().trim().replace(/[\s-]+/g, '_');
  const conceptRecord = state.conceptMastery?.[cleanConcept];

  // Check if concept has direct strategy outcomes
  if (conceptRecord?.strategyOutcomes) {
    const conceptRankings = rankStrategiesEmpirically(conceptRecord.strategyOutcomes as any);
    const topConcept = conceptRankings[0];
    if (topConcept && topConcept.attempts >= 1 && topConcept.rawWinRate >= 0.6) {
      return {
        recommendedStrategy: topConcept.strategy,
        fallbackStrategy: conceptRankings[1]?.strategy || 'scaffolded',
        confidenceScore: topConcept.confidenceScore,
        isCalibrated: !topConcept.isCalibrating,
        rationaleEn: topConcept.isCalibrating
          ? `Concept-specific early signal: ${topConcept.nameEn} succeeded on initial exercise for ${conceptId}.`
          : `Empirically validated for ${conceptId}: ${topConcept.nameEn} achieved ${Math.round(topConcept.rawWinRate * 100)}% task success over ${topConcept.attempts} attempts.`,
        rationaleAr: topConcept.isCalibrating
          ? `مؤشر أولي خاص بالمفهوم: حقق أسلوب ${topConcept.nameAr} نجاحًا في التمرين الأولي لـ ${conceptId}.`
          : `مثبت تجريبيًا لـ ${conceptId}: حقق ${topConcept.nameAr} نسبة نجاح ${Math.round(topConcept.rawWinRate * 100)}% عبر ${topConcept.attempts} محاولات.`,
        evidenceSummary: {
          attempts: topConcept.attempts,
          successes: topConcept.successes,
          winRate: topConcept.rawWinRate,
        },
      };
    }
  }

  // Tally global strategy outcomes across state.pedagogyEffectiveness & state.conceptMastery
  const globalStrategyMap: Partial<Record<PedagogyStrategy, { attempts: number; successes: number }>> = {};

  if (state.pedagogyEffectiveness) {
    for (const [s, data] of Object.entries(state.pedagogyEffectiveness)) {
      const strat = s as PedagogyStrategy;
      const attempts = (data.helpfulCount || 0) + (data.unhelpfulCount || 0);
      const successes = data.helpfulCount || 0;
      globalStrategyMap[strat] = { attempts, successes };
    }
  }

  const globalRankings = rankStrategiesEmpirically(globalStrategyMap);
  const bestGlobal = globalRankings[0];

  if (bestGlobal && bestGlobal.attempts > 0) {
    return {
      recommendedStrategy: bestGlobal.strategy,
      fallbackStrategy: globalRankings[1]?.strategy || 'scaffolded',
      confidenceScore: bestGlobal.confidenceScore,
      isCalibrated: !bestGlobal.isCalibrating,
      rationaleEn: bestGlobal.isCalibrating
        ? `Preliminary global adaptation: ${bestGlobal.nameEn} is in early calibration (${bestGlobal.attempts}/3 trials).`
        : `Longitudinal efficacy: ${bestGlobal.nameEn} is calibrated with a Wilson score lower bound of ${Math.round(bestGlobal.wilsonLowerBound * 100)}%.`,
      rationaleAr: bestGlobal.isCalibrating
        ? `تكيف أولي شامل: أسلوب ${bestGlobal.nameAr} في مرحلة المعايرة المبكرة (${bestGlobal.attempts}/3 محاولات).`
        : `أداء طولي مثبت: أسلوب ${bestGlobal.nameAr} معاير بحد أدنى موثوق لـ ويلسون يبلغ ${Math.round(bestGlobal.wilsonLowerBound * 100)}%.`,
      evidenceSummary: {
        attempts: bestGlobal.attempts,
        successes: bestGlobal.successes,
        winRate: bestGlobal.rawWinRate,
      },
    };
  }

  // Default fallback
  return {
    recommendedStrategy: 'scaffolded',
    confidenceScore: 0.5,
    isCalibrated: false,
    rationaleEn: 'Default baseline: Scaffolded step-by-step guidance is recommended until observational data is collected.',
    rationaleAr: 'الأسلوب الافتراضي المرجعي: يُوصى بالتفكيك المتدرج للخطوات لحين جمع بيانات تفاعل تجريبية كافية.',
    evidenceSummary: {
      attempts: 0,
      successes: 0,
      winRate: 0,
    },
  };
}

/**
 * Updates strategy attempt records immutably.
 */
export function trackStrategyAttempt(
  existing: { attempts: number; successes: number } | undefined,
  isSuccessful: boolean
): { attempts: number; successes: number } {
  const currentAttempts = existing?.attempts || 0;
  const currentSuccesses = existing?.successes || 0;
  return {
    attempts: currentAttempts + 1,
    successes: isSuccessful ? currentSuccesses + 1 : currentSuccesses,
  };
}
