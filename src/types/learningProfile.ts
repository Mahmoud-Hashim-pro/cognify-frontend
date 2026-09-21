/**
 * Phase 2C - Sprint 1: Learning Profile Contract
 *
 * Defines the canonical data contract between the Cognify Intelligence/PLM layer
 * and consumer presentations (Student Intelligence Profile, Teacher Dashboards, etc.).
 *
 * The frontend NEVER queries raw event tables or computes intelligence statistics;
 * this contract is computed authoritatively by the domain learningProfileService.
 */

import type { PedagogyStrategy, ResponseLatencyProfile, RetentionRiskLevel } from './studentState';

export interface ConceptMasterySummary {
  conceptId: string;
  conceptNameEn: string;
  conceptNameAr: string;
  masteryPercentage: number; // 0 - 100
  confidencePercentage: number; // 0 - 100
  status: 'mastered' | 'developing' | 'struggling';
  attemptsCount: number;
  commonError?: string;
  latencyProfile: ResponseLatencyProfile;
  retentionRisk: RetentionRiskLevel;
  bestStrategy?: PedagogyStrategy;
  recentImprovementPercentage?: number; // e.g. +18%
  lastPracticedIso: string;
}

export interface StrategyEffectivenessSummary {
  strategy: PedagogyStrategy;
  nameEn: string;
  nameAr: string;
  nameFr: string;
  scorePercentage: number; // 0 - 100
  attemptsCount: number;
  successesCount: number;
  isOptimal: boolean;
  isCalibrating: boolean; // true if attempts < 3
  sampleSizeNoteEn: string;
  sampleSizeNoteAr: string;
}

export interface CurrentLearningFocus {
  conceptId: string;
  conceptNameEn: string;
  conceptNameAr: string;
  reasonEn: string;
  reasonAr: string;
  recommendedStrategy: PedagogyStrategy;
  prerequisiteToReview?: {
    conceptId: string;
    conceptNameEn: string;
    conceptNameAr: string;
  };
}

export interface RecentProgressSummary {
  conceptId: string;
  conceptNameEn: string;
  conceptNameAr: string;
  deltaPercentage: number; // e.g. +18
  trend: 'improving' | 'steady' | 'regressing';
  headlineEn: string;
  headlineAr: string;
}

export interface RetentionAlertItem {
  conceptId: string;
  conceptNameEn: string;
  conceptNameAr: string;
  intervalDays: number;
  riskLevel: RetentionRiskLevel;
  isDue: boolean;
  messageEn: string;
  messageAr: string;
}

export interface PersonalLearningProfile {
  uid: string;
  displayName?: string;
  generatedAt: number;
  overallMasteryPercentage: number;
  overallConfidencePercentage: number;
  primaryPreferredStrategy: PedagogyStrategy;
  secondaryPreferredStrategy?: PedagogyStrategy;
  conceptProfiles: Record<string, ConceptMasterySummary>;
  masteredConcepts: ConceptMasterySummary[];
  developingConcepts: ConceptMasterySummary[];
  strugglingConcepts: ConceptMasterySummary[];
  currentFocus?: CurrentLearningFocus;
  effectiveStrategies: StrategyEffectivenessSummary[];
  retentionAlerts: RetentionAlertItem[];
  recentProgress: RecentProgressSummary[];
  proactiveRemediationDirectives: string[];
  ethicalDisclaimerEn: string;
  ethicalDisclaimerAr: string;
}
