/**
 * Phase 2B: Personal Learning Model (PLM)
 *
 * Consolidates granular, event-sourced learning signals (concept mastery,
 * response latencies, error patterns, strategy outcomes, and spaced retention schedules)
 * into a stable, longitudinal cognitive profile for each learner.
 *
 * Transitions the AI tutor from reactive intervention (adapting only after errors)
 * to proactive personalization (initiating instruction with the student's empirically
 * proven strategies and pre-empting known historical stumbling blocks).
 */

import { getConcept } from './conceptGraph.js';
import type {
  PedagogyStrategy,
  StrategyOutcomeMetrics,
  InterventionOutcomeRecord,
  ConceptMasteryRecord,
  RetentionSchedule,
  StudentState,
  ResponseLatencyProfile,
  RetentionRiskLevel,
  ConceptLearningProfile,
  PersonalLearningModel,
} from '../types/studentState.js';

export type {
  ResponseLatencyProfile,
  RetentionRiskLevel,
  ConceptLearningProfile,
  PersonalLearningModel,
};

/**
 * Derives a categorical latency profile from average response time in milliseconds.
 */
export function deriveLatencyProfile(avgMs: number): ResponseLatencyProfile {
  if (avgMs > 15000) return 'high';
  if (avgMs >= 8000) return 'medium';
  return 'low';
}

/**
 * Derives the retention risk level from an SM-2 spaced retention schedule.
 */
export function deriveRetentionRisk(schedule?: RetentionSchedule, now: number = Date.now()): RetentionRiskLevel {
  if (!schedule || schedule.repetitions === 0) {
    return 'high';
  }
  if (schedule.status === 'regressed') {
    return 'high';
  }
  if (schedule.nextReviewDate <= now) {
    return 'high'; // Review is already overdue
  }
  const hoursUntilReview = (schedule.nextReviewDate - now) / (1000 * 60 * 60);
  if (hoursUntilReview <= 48) {
    return 'medium'; // Review is due within 48 hours
  }
  return 'low'; // Safely consolidated
}

/**
 * Synthesizes the primary common error from historical mistake types and intervention outcomes.
 */
export function synthesizeCommonError(
  mistakeTypes: string[] = [],
  history: InterventionOutcomeRecord[] = []
): string | undefined {
  if (mistakeTypes.length === 0 && history.length === 0) return undefined;

  // Tally mistake types
  const counts: Record<string, number> = {};
  for (const m of mistakeTypes) {
    counts[m] = (counts[m] || 0) + 2;
  }
  for (const h of history) {
    if (h.outcome === 'struggle') {
      const key = `${h.conceptId}_struggle`;
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  let topMistake: string | undefined = undefined;
  let topCount = 0;
  for (const [m, count] of Object.entries(counts)) {
    if (count > topCount) {
      topCount = count;
      topMistake = m;
    }
  }

  return topMistake || mistakeTypes[0];
}

/**
 * Ranks pedagogical strategies for a concept by empirical win-rate and frequency.
 */
export function rankStrategies(
  strategyOutcomes?: Partial<Record<PedagogyStrategy, StrategyOutcomeMetrics>>,
  fallbackBest: PedagogyStrategy = 'scaffolded'
): { best: PedagogyStrategy; secondBest?: PedagogyStrategy } {
  if (!strategyOutcomes || Object.keys(strategyOutcomes).length === 0) {
    return { best: fallbackBest };
  }

  // Sort by success rate descending, then attempts descending
  const sorted = Object.entries(strategyOutcomes)
    .filter(([_, m]) => m && m.attempts > 0)
    .sort((a, b) => {
      const metricA = a[1]!;
      const metricB = b[1]!;
      if (metricB.rate !== metricA.rate) {
        return metricB.rate - metricA.rate;
      }
      return metricB.attempts - metricA.attempts;
    });

  if (sorted.length === 0) {
    return { best: fallbackBest };
  }

  const best = sorted[0][0] as PedagogyStrategy;
  const secondBest = sorted.length > 1 ? (sorted[1][0] as PedagogyStrategy) : undefined;

  return { best, secondBest };
}

/**
 * Builds a single concept's consolidated learning profile.
 */
export function buildConceptLearningProfile(
  cleanConcept: string,
  record: ConceptMasteryRecord,
  schedule?: RetentionSchedule,
  history: InterventionOutcomeRecord[] = [],
  now: number = Date.now()
): ConceptLearningProfile {
  const conceptMeta = getConcept(cleanConcept);
  const conceptNameEn = conceptMeta?.nameEn || cleanConcept.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const conceptNameAr = conceptMeta?.nameAr || cleanConcept;

  const conceptHistory = history.filter((h) => h.conceptId === cleanConcept);
  const successfulRemediations = conceptHistory.filter((h) => h.outcome === 'success').length;

  const commonError = synthesizeCommonError(record.mistakeTypes, conceptHistory);
  const { best, secondBest } = rankStrategies(record.strategyOutcomes, record.bestObservedStrategy || 'scaffolded');

  // Derive empirical latency profile based on tracked average response time
  const avgResponseTimeMs = record.avgResponseTimeMs ?? (record.consecutiveIncorrect >= 2 ? 16800 : 5500);
  const latencyProfile = deriveLatencyProfile(avgResponseTimeMs);
  const retentionRisk = deriveRetentionRisk(schedule, now);

  // Normalized mastery score combining accuracy and streak confidence
  const rawMastery = record.attempts > 0 ? (record.correct / record.attempts) : 0;
  const confidenceWeight = record.confidence || 0.5;
  const mastery = Math.min(1.0, Math.round(((rawMastery * 0.7) + (confidenceWeight * 0.3)) * 100) / 100);

  return {
    conceptId: cleanConcept,
    conceptNameEn,
    conceptNameAr,
    mastery,
    confidence: record.confidence,
    commonError,
    latencyProfile,
    avgResponseTimeMs,
    bestStrategy: best,
    secondBestStrategy: secondBest,
    retentionRisk,
    lastEvaluated: record.lastTested || now,
    totalAttempts: record.attempts,
    successfulRemediations,
  };
}

/**
 * Generates actionable proactive remediation prompt directives for the AI tutor.
 */
export function generateProactiveDirectives(
  plm: PersonalLearningModel,
  currentTopic?: string
): string[] {
  const directives: string[] = [];

  // If a specific topic is engaged, check if a profile exists for it
  if (currentTopic) {
    const clean = currentTopic.toLowerCase().trim().replace(/[\s-]+/g, '_');
    const profile = plm.conceptProfiles[clean];
    if (profile) {
      if (profile.commonError || profile.latencyProfile === 'high' || profile.bestStrategy === 'worked_example') {
        const errorNote = profile.commonError ? ` (historical stumbling block: "${profile.commonError}")` : '';
        const strategyNote = profile.bestStrategy === 'worked_example'
          ? 'step-by-step worked examples with physical real-world analogies'
          : profile.bestStrategy === 'analogies'
          ? 'intuitive physical analogies before technical notation'
          : `${profile.bestStrategy} guidance`;

        directives.push(
          `The student has a documented historical learning pattern for "${profile.conceptNameEn}"${errorNote} with ${profile.latencyProfile} response latency. Do NOT wait for the student to fail. Proactively open your explanation using ${strategyNote}.`
        );
      }
    }
  }

  // Global dominant strategy preference directive
  if (plm.primaryPreferredStrategy && plm.primaryPreferredStrategy !== 'scaffolded') {
    directives.push(
      `The learner's overall highest-efficacy instructional modality is ${plm.primaryPreferredStrategy.toUpperCase()}${plm.secondaryPreferredStrategy ? ` (followed by ${plm.secondaryPreferredStrategy.toUpperCase()})` : ''}. Emphasize this instructional style across explanations.`
    );
  }

  return directives;
}

/**
 * Pure consolidation engine: builds the authoritative Personal Learning Model
 * from the complete StudentState.
 */
export function buildPersonalLearningModel(state: StudentState, now: number = Date.now()): PersonalLearningModel {
  const conceptProfiles: Record<string, ConceptLearningProfile> = {};
  const history = state.interventionHistory || [];

  // Tally global strategy successes across all concepts to rank primary & secondary
  const globalStrategyScores: Record<string, { attempts: number; successes: number; rate: number }> = {};

  for (const [conceptId, record] of Object.entries(state.conceptMastery)) {
    const schedule = state.retentionSchedules[conceptId];
    const profile = buildConceptLearningProfile(conceptId, record, schedule, history, now);
    conceptProfiles[conceptId] = profile;

    if (record.strategyOutcomes) {
      for (const [strat, m] of Object.entries(record.strategyOutcomes)) {
        if (m) {
          const entry = globalStrategyScores[strat] || { attempts: 0, successes: 0, rate: 0 };
          entry.attempts += m.attempts;
          entry.successes += m.successes;
          entry.rate = entry.attempts > 0 ? entry.successes / entry.attempts : 0;
          globalStrategyScores[strat] = entry;
        }
      }
    }
  }

  // Determine global top strategies
  const sortedGlobal = Object.entries(globalStrategyScores).sort((a, b) => {
    if (b[1].rate !== a[1].rate) return b[1].rate - a[1].rate;
    return b[1].attempts - a[1].attempts;
  });

  const primaryPreferredStrategy: PedagogyStrategy = (sortedGlobal.length > 0
    ? sortedGlobal[0][0]
    : state.activePedagogy || 'scaffolded') as PedagogyStrategy;

  const secondaryPreferredStrategy: PedagogyStrategy | undefined = sortedGlobal.length > 1
    ? (sortedGlobal[1][0] as PedagogyStrategy)
    : undefined;

  const plm: PersonalLearningModel = {
    uid: state.uid,
    updatedAt: now,
    primaryPreferredStrategy,
    secondaryPreferredStrategy,
    conceptProfiles,
    proactiveRemediationDirectives: [],
  };

  plm.proactiveRemediationDirectives = generateProactiveDirectives(plm);

  return plm;
}
