/**
 * Canonical Student State & Learning Intelligence Types
 * Single source of truth for student state, cognitive stage,
 * concept mastery, pedagogy strategy, and personal learning models.
 */

import type { CognitiveStage } from '../lib/studentStateScaffolding';
import type { RetentionSchedule } from '../lib/spacedRetention';
import type { InterventionDirective } from '../lib/interventionEngine';
import type { AccessibilityState } from './accessibilityState';

export type PedagogyStrategy = 'analogies' | 'scaffolded' | 'worked_example' | 'socratic' | 'advanced_rigor';

export interface StrategyOutcomeMetrics {
  attempts: number;
  successes: number;
  rate: number; // successes / attempts (0.0 to 1.0)
  lastUsed: number;
}

export interface InterventionOutcomeRecord {
  id: string;
  interventionId: string;
  conceptId: string;
  strategy: PedagogyStrategy;
  outcome: 'success' | 'struggle' | 'in_progress';
  preInterventionAccuracy: number;
  postInterventionAccuracy: number;
  attemptsUnderIntervention: number;
  triggeredTimestamp: number;
  resolvedTimestamp?: number;
}

export interface ConceptMasteryRecord {
  conceptId: string;
  attempts: number;
  correct: number;
  accuracy: number;
  confidence: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  lastTested: number;
  mistakeTypes: string[];
  strategyOutcomes?: Partial<Record<PedagogyStrategy, StrategyOutcomeMetrics>>;
  bestObservedStrategy?: PedagogyStrategy;
  avgResponseTimeMs?: number;
}

export type StruggleSignalType = 'high_response_latency' | 'repeated_errors' | 'prerequisite_gap' | 'frequent_hints';

export interface LearningStrain {
  possibleStruggle: number; // 0.0 (smooth/fluent) to 1.0 (high strain)
  confidence: number;       // 0.0 to 1.0 (statistical confidence in struggle detection)
  signals: StruggleSignalType[];
}

export interface PedagogyMetrics {
  helpfulCount: number;
  unhelpfulCount: number;
  score: number; // 0.1 to 1.0 dynamic weighting
}

export type ResponseLatencyProfile = 'low' | 'medium' | 'high';
export type RetentionRiskLevel = 'low' | 'medium' | 'high';

export interface ConceptLearningProfile {
  conceptId: string;
  conceptNameEn: string;
  conceptNameAr: string;
  mastery: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  commonError?: string; // Top repeated mistake (e.g. 'dereference_null')
  latencyProfile: ResponseLatencyProfile; // low (<8s), medium (8-15s), high (>15s)
  avgResponseTimeMs: number;
  bestStrategy: PedagogyStrategy; // Highest win-rate strategy
  secondBestStrategy?: PedagogyStrategy; // Second-highest win-rate strategy
  retentionRisk: RetentionRiskLevel; // Derived from SM-2 repetitions and review delta
  lastEvaluated: number;
  totalAttempts: number;
  successfulRemediations: number;
}

export interface PersonalLearningModel {
  uid: string;
  updatedAt: number;
  primaryPreferredStrategy: PedagogyStrategy;
  secondaryPreferredStrategy?: PedagogyStrategy;
  conceptProfiles: Record<string, ConceptLearningProfile>;
  proactiveRemediationDirectives: string[];
}

export interface StudentState {
  uid: string;
  /**
   * Temporary initial onboarding pedagogical baseline (NOT a measurement of mental capacity or IQ).
   * Used strictly to adapt initial explanation tone and scaffolding.
   */
  cognitiveStage: CognitiveStage;
  activePedagogy: PedagogyStrategy;
  pedagogyEffectiveness: Record<PedagogyStrategy, PedagogyMetrics>;
  learningStrain: LearningStrain;
  struggleSignal: number;     // 0.0 to 1.0 (convenience scalar matching learningStrain.possibleStruggle)
  cognitiveLoadScore: number; // Deprecated alias maintained for backward compatibility
  conceptMastery: Record<string, ConceptMasteryRecord>;
  retentionSchedules: Record<string, RetentionSchedule>;
  activeInterventions: Record<string, InterventionDirective>;
  interventionHistory?: InterventionOutcomeRecord[];
  personalLearningModel?: PersonalLearningModel;
  accessibilityState?: AccessibilityState;
  totalExercisesCompleted: number;
  lastActiveTimestamp: number;
}

export type {
  CognitiveStage,
  RetentionSchedule,
  InterventionDirective,
  AccessibilityState,
};

export * from './learningProfile';
export * from './retention';
