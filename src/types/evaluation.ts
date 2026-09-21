/**
 * Milestone 17: Automated Pedagogical Evaluation Engine Types
 * Longitudinal Hake Normalized Gain, Randomized Pedagogical A/B Trials,
 * Welch's t-test, Cohen's d Effect Size, and Pedagogical Strategy Promotion.
 */

import type { PedagogyStrategy } from './studentState';

export type HakeGainTier = 'high' | 'medium' | 'low' | 'regression';

export interface LongitudinalStudentGain {
  studentUid: string;
  conceptId: string;
  preScore: number;
  postScore: number;
  normalizedGain: number; // Hake g = (Post - Pre) / (100 - Pre)
  gainTier: HakeGainTier;
  strategyUsed: PedagogyStrategy;
  timestamp: number;
}

export interface LongitudinalTrajectoryWindow {
  window: 'weekly' | 'monthly' | 'semester';
  sampleCount: number;
  averagePreScore: number;
  averagePostScore: number;
  averageGain: number;
  gainTier: HakeGainTier;
  topPerformingStrategy: PedagogyStrategy;
}

export interface StrategyCohortStats {
  strategy: PedagogyStrategy;
  sampleSize: number;
  meanPre: number;
  meanPost: number;
  meanGain: number;
  varianceGain: number;
  standardDeviationGain: number;
}

export interface PedagogicalABExperiment {
  experimentId: string;
  conceptId: string;
  conceptTitle: string;
  strategyA: PedagogyStrategy; // Control
  strategyB: PedagogyStrategy; // Treatment
  startDate: number;
  status: 'active' | 'concluded' | 'insufficient_data';
  statsA: StrategyCohortStats;
  statsB: StrategyCohortStats;
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  cohensD: number; // Effect size
  isStatisticallySignificant: boolean; // p < 0.05
  winner?: PedagogyStrategy | 'inconclusive';
  promotionRecommendation?: {
    recommendedStrategy: PedagogyStrategy;
    confidence: number;
    rationaleEn: string;
    rationaleAr: string;
  };
}

export interface PedagogicalEvaluationOverview {
  overallCohortGain: number;
  overallGainTier: HakeGainTier;
  activeExperiments: PedagogicalABExperiment[];
  windows: LongitudinalTrajectoryWindow[];
  topRemediationStrategy: PedagogyStrategy;
}
